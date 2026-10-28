/**
 * Per-workspace scratch documents: free-form project notes and the owner's
 * manual terminal quick commands.
 *
 * Both live in `<workspace>/.dsh` (`notes.json` / `quick-commands.json`) so the
 * data stays with the project instead of one browser profile, matching the
 * browser bookmarks and workspace memory. Writes are serialized per file and
 * use a temp-file rename, so notes autosave and a command edit cannot
 * interleave a read-modify-write. Symlinked or out-of-root state paths are
 * refused, and SSH workspaces have no local `.dsh` to write to.
 */

import { randomUUID } from 'node:crypto'
import { promises as fsp } from 'node:fs'
import path from 'node:path'

/** Directory created inside a workspace for plugin-owned state. */
export const SCRATCHPAD_DIRNAME = '.dsh'

/** File holding one workspace's free-form project notes. */
export const NOTES_FILENAME = 'notes.json'

/** File holding one workspace's manual terminal quick commands. */
export const QUICK_COMMANDS_FILENAME = 'quick-commands.json'

/** Document format versions. */
export const NOTES_VERSION = 1
export const QUICK_COMMANDS_VERSION = 1

/** Hard limits mirrored by the browser UI. */
export const NOTES_MAX_CHARS = 20000
export const NOTES_MAX_BYTES = 128 * 1024
export const QUICK_COMMANDS_MAX = 50
export const QUICK_COMMAND_LABEL_MAX = 60
export const QUICK_COMMAND_TEXT_MAX = 2000
export const QUICK_COMMANDS_MAX_BYTES = 256 * 1024

/** A structured, caller-facing failure with a stable machine code. */
export class ScratchpadError extends Error {
  /**
   * @param code - stable machine-readable code.
   * @param message - human-readable explanation.
   */
  constructor(code, message) {
    super(message)
    this.name = 'ScratchpadError'
    this.code = code
    // The Host request handler maps this field onto the API error envelope.
    this.sideCode = code
  }
}

/** Absolute path of the plugin state directory inside one workspace. */
function stateDirectory(root) {
  return path.join(path.resolve(root), SCRATCHPAD_DIRNAME)
}

/** Absolute path of one scratch document. */
function documentPath(root, filename) {
  return path.join(stateDirectory(root), filename)
}

/** Reject a root that could escape the caller's workspace containment. */
function assertRoot(root) {
  if (typeof root !== 'string' || root.length === 0 || !path.isAbsolute(root)) {
    throw new ScratchpadError('bad-root', '工作区根目录必须是绝对路径')
  }
  return path.resolve(root)
}

/** Whether `candidate` is the root itself or one of its descendants. */
function isInsideRoot(root, candidate) {
  const relative = path.relative(path.resolve(root), candidate)
  if (relative === '') return true
  if (path.isAbsolute(relative)) return false
  return relative !== '..' && !relative.startsWith(`..${path.sep}`)
}

/** Refuse a real `.dsh` directory that points outside the workspace. */
async function assertStateDirectory(root) {
  let real
  try {
    real = await fsp.realpath(stateDirectory(root))
  } catch (error) {
    if (error !== null && typeof error === 'object' && error.code === 'ENOENT') return
    throw error
  }
  if (!isInsideRoot(root, real)) {
    throw new ScratchpadError('outside-root', '工作区 .dsh 目录指向工作区之外，已拒绝访问')
  }
}

/** Refuse a scratch document that is a symlink or resolves outside the workspace. */
async function assertDocumentFile(root, filename) {
  await assertStateDirectory(root)
  const file = documentPath(root, filename)
  let info
  try {
    info = await fsp.lstat(file)
  } catch (error) {
    if (error !== null && typeof error === 'object' && error.code === 'ENOENT') return
    throw error
  }
  if (info.isSymbolicLink()) {
    throw new ScratchpadError('unsafe', `工作区 ${filename} 是符号链接，已拒绝访问`)
  }
  let real
  try {
    real = await fsp.realpath(file)
  } catch (error) {
    if (error !== null && typeof error === 'object' && error.code === 'ENOENT') return
    throw error
  }
  if (!isInsideRoot(root, real)) {
    throw new ScratchpadError('outside-root', `工作区 ${filename} 指向工作区之外，已拒绝访问`)
  }
}

/** Create `.dsh/.gitignore` so plugin state does not dirty the repository. */
async function ensureStateDirectory(root) {
  await fsp.mkdir(stateDirectory(root), { recursive: true })
  await assertStateDirectory(root)
  try {
    await fsp.writeFile(path.join(stateDirectory(root), '.gitignore'), '*\n', {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    })
  } catch (error) {
    if (error === null || typeof error !== 'object' || error.code !== 'EEXIST') throw error
  }
}

/** Read one document, returning `null` when it does not exist yet. */
async function readDocument(root, filename) {
  await assertDocumentFile(root, filename)
  try {
    return await fsp.readFile(documentPath(root, filename), 'utf8')
  } catch (error) {
    if (error !== null && typeof error === 'object' && error.code === 'ENOENT') return null
    throw error
  }
}

/** Write one document atomically. */
async function writeDocument(root, filename, state, maxBytes) {
  const text = `${JSON.stringify(state, null, 2)}\n`
  if (Buffer.byteLength(text, 'utf8') > maxBytes) {
    throw new ScratchpadError('full', `工作区 ${filename} 过大，请精简内容后重试`)
  }
  await ensureStateDirectory(root)
  await assertDocumentFile(root, filename)
  const temporary = path.join(
    stateDirectory(root),
    `.${filename}.${String(process.pid)}-${String(Date.now())}-${randomUUID()}.tmp`,
  )
  const target = documentPath(root, filename)
  await fsp.writeFile(temporary, text, { encoding: 'utf8', mode: 0o600 })
  try {
    await fsp.rename(temporary, target)
  } catch {
    // Windows can refuse to replace an existing target; the direct write still
    // keeps the document complete and the temp file is removed either way.
    try {
      await fsp.writeFile(target, text, { encoding: 'utf8', mode: 0o600 })
    } finally {
      await fsp.rm(temporary, { force: true }).catch(() => {})
    }
  }
}

/** Per-file mutation queues: read-modify-write runs one at a time. */
const mutationQueues = new Map()

/**
 * Run one mutation under a document's queue.
 * @param key - resolved document path.
 * @param operation - read-modify-write body.
 * @returns operation result.
 */
function withMutationLock(key, operation) {
  const previous = mutationQueues.get(key) ?? Promise.resolve()
  const current = previous.catch(() => {}).then(operation)
  mutationQueues.set(key, current)
  return current.finally(() => {
    if (mutationQueues.get(key) === current) mutationQueues.delete(key)
  })
}

/** Count Unicode code points so an emoji-heavy note is not cut short. */
function charCount(text) {
  return [...text].length
}

/** Empty notes snapshot. */
function emptyNotes() {
  return { version: NOTES_VERSION, text: '', updatedAt: 0 }
}

/** Parse `.dsh/notes.json`; a corrupt document is reported instead of cleared. */
function parseNotes(text, filename) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new ScratchpadError('corrupt', `工作区 ${filename} 不是有效的 JSON，请手动修复或删除后重试`)
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ScratchpadError('corrupt', `工作区 ${filename} 格式无法识别，请手动修复或删除后重试`)
  }
  const notesText = typeof parsed.text === 'string' ? parsed.text : ''
  if (charCount(notesText) > NOTES_MAX_CHARS) {
    throw new ScratchpadError('corrupt', `工作区 ${filename} 超过 ${String(NOTES_MAX_CHARS)} 字符上限`)
  }
  return {
    version: NOTES_VERSION,
    text: notesText,
    updatedAt: Number.isFinite(parsed.updatedAt) && parsed.updatedAt > 0 ? parsed.updatedAt : 0,
  }
}

/** Snapshot returned by notes reads and writes. */
function notesSnapshot(workspace, state) {
  return {
    version: NOTES_VERSION,
    text: state.text,
    updatedAt: state.updatedAt,
    path: documentPath(workspace, NOTES_FILENAME),
  }
}

/**
 * Read one workspace's project notes. A missing document is not an error.
 * @param root - absolute workspace root.
 * @returns `{ version, text, updatedAt, path }`.
 */
export async function readNotes(root) {
  const workspace = assertRoot(root)
  const text = await readDocument(workspace, NOTES_FILENAME)
  const state = text === null ? emptyNotes() : parseNotes(text, NOTES_FILENAME)
  return notesSnapshot(workspace, state)
}

/**
 * Replace one workspace's project notes.
 * @param root - absolute workspace root.
 * @param text - the full note body (may be empty).
 * @returns `{ version, text, updatedAt, path }`.
 */
export async function saveNotes(root, text) {
  const workspace = assertRoot(root)
  if (typeof text !== 'string') throw new ScratchpadError('bad-text', '备注内容必须是字符串')
  if (charCount(text) > NOTES_MAX_CHARS) {
    throw new ScratchpadError('too-long', `备注最多 ${String(NOTES_MAX_CHARS)} 字符`)
  }
  if (Buffer.byteLength(text, 'utf8') > NOTES_MAX_BYTES) {
    throw new ScratchpadError('too-long', '备注内容过大')
  }
  return withMutationLock(documentPath(workspace, NOTES_FILENAME), async () => {
    const state = { version: NOTES_VERSION, text, updatedAt: Date.now() }
    await writeDocument(workspace, NOTES_FILENAME, state, NOTES_MAX_BYTES)
    return notesSnapshot(workspace, state)
  })
}

/** Normalize one quick command for storage and display. */
function normalizeQuickCommandLabel(value) {
  const label = typeof value === 'string' ? value.trim().replace(/\s+/gu, ' ') : ''
  if (label.length === 0) throw new ScratchpadError('bad-label', '请填写快捷命令名称')
  if (charCount(label) > QUICK_COMMAND_LABEL_MAX) {
    throw new ScratchpadError('bad-label', `快捷命令名称最多 ${String(QUICK_COMMAND_LABEL_MAX)} 字符`)
  }
  return label
}

/** Normalize one quick command body; it must fit on a single shell line. */
function normalizeQuickCommandText(value) {
  const command = typeof value === 'string' ? value.trim() : ''
  if (command.length === 0) throw new ScratchpadError('bad-command', '请填写快捷命令内容')
  if (charCount(command) > QUICK_COMMAND_TEXT_MAX) {
    throw new ScratchpadError('bad-command', `快捷命令最多 ${String(QUICK_COMMAND_TEXT_MAX)} 字符`)
  }
  if (/[\r\n]/u.test(command)) {
    throw new ScratchpadError('bad-command', '快捷命令不能包含换行；多条命令请用 && 连接')
  }
  return command
}

/** One accepted quick-command row. */
function normalizeQuickCommandRow(entry) {
  if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) return null
  const label = typeof entry.label === 'string' ? entry.label.trim() : ''
  const command = typeof entry.command === 'string' ? entry.command.trim() : ''
  if (label.length === 0 || command.length === 0) return null
  return {
    id: typeof entry.id === 'string' && entry.id.length > 0 ? entry.id : randomUUID(),
    label: label.slice(0, QUICK_COMMAND_LABEL_MAX),
    command: command.slice(0, QUICK_COMMAND_TEXT_MAX),
    createdAt: Number.isFinite(entry.createdAt) && entry.createdAt > 0 ? entry.createdAt : Date.now(),
  }
}

/** Empty quick-command document. */
function emptyQuickCommands() {
  return { version: QUICK_COMMANDS_VERSION, commands: [], updatedAt: 0 }
}

/** Parse `.dsh/quick-commands.json`; malformed rows are dropped, bad JSON is reported. */
function parseQuickCommands(text, filename) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new ScratchpadError('corrupt', `工作区 ${filename} 不是有效的 JSON，请手动修复或删除后重试`)
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ScratchpadError('corrupt', `工作区 ${filename} 格式无法识别，请手动修复或删除后重试`)
  }
  const rows = Array.isArray(parsed.commands) ? parsed.commands : []
  const commands = []
  const seen = new Set()
  for (const row of rows) {
    const command = normalizeQuickCommandRow(row)
    if (command === null || seen.has(command.command)) continue
    seen.add(command.command)
    commands.push(command)
    if (commands.length >= QUICK_COMMANDS_MAX) break
  }
  return {
    version: QUICK_COMMANDS_VERSION,
    commands,
    updatedAt: Number.isFinite(parsed.updatedAt) && parsed.updatedAt > 0 ? parsed.updatedAt : 0,
  }
}

/** Snapshot returned by quick-command reads and writes. */
function quickCommandsSnapshot(workspace, state) {
  return {
    version: QUICK_COMMANDS_VERSION,
    commands: state.commands,
    total: state.commands.length,
    updatedAt: state.updatedAt,
    path: documentPath(workspace, QUICK_COMMANDS_FILENAME),
  }
}

/** Read the current quick-command document, tolerating a missing file. */
async function readQuickCommands(workspace) {
  const text = await readDocument(workspace, QUICK_COMMANDS_FILENAME)
  return text === null ? emptyQuickCommands() : parseQuickCommands(text, QUICK_COMMANDS_FILENAME)
}

/**
 * Read one workspace's manual terminal quick commands.
 * @param root - absolute workspace root.
 * @returns `{ version, commands, total, updatedAt, path }`.
 */
export async function listQuickCommands(root) {
  const workspace = assertRoot(root)
  const state = await readQuickCommands(workspace)
  return quickCommandsSnapshot(workspace, state)
}

/**
 * Add one manual quick command, or update an existing row when `id` is given.
 * @param root - absolute workspace root.
 * @param input - `{ id?, label, command }`.
 * @returns `{ version, commands, total, updatedAt, path, id }`.
 */
export async function saveQuickCommand(root, input) {
  const workspace = assertRoot(root)
  const body = input !== null && typeof input === 'object' ? input : {}
  const label = normalizeQuickCommandLabel(body.label)
  const command = normalizeQuickCommandText(body.command)
  const requestedId = typeof body.id === 'string' && body.id.length > 0 ? body.id : null
  return withMutationLock(documentPath(workspace, QUICK_COMMANDS_FILENAME), async () => {
    const state = await readQuickCommands(workspace)
    let id = requestedId
    if (requestedId !== null) {
      const index = state.commands.findIndex((entry) => entry.id === requestedId)
      if (index < 0) throw new ScratchpadError('unknown-id', '快捷命令已不存在，请刷新后重试')
      const duplicate = state.commands.some((entry) => entry.id !== requestedId && entry.command === command)
      if (duplicate) throw new ScratchpadError('duplicate', '这条命令已经存在')
      state.commands[index] = { ...state.commands[index], label, command }
    } else {
      if (state.commands.some((entry) => entry.command === command)) {
        throw new ScratchpadError('duplicate', '这条命令已经存在')
      }
      if (state.commands.length >= QUICK_COMMANDS_MAX) {
        throw new ScratchpadError('full', `最多保存 ${String(QUICK_COMMANDS_MAX)} 条快捷命令`)
      }
      id = randomUUID()
      state.commands.push({ id, label, command, createdAt: Date.now() })
    }
    state.updatedAt = Date.now()
    await writeDocument(workspace, QUICK_COMMANDS_FILENAME, state, QUICK_COMMANDS_MAX_BYTES)
    return { ...quickCommandsSnapshot(workspace, state), id }
  })
}

/**
 * Remove one manual quick command.
 * @param root - absolute workspace root.
 * @param id - row id returned by a save/list.
 * @returns `{ version, commands, total, updatedAt, path }`.
 */
export async function deleteQuickCommand(root, id) {
  const workspace = assertRoot(root)
  if (typeof id !== 'string' || id.length === 0) throw new ScratchpadError('bad-id', '缺少快捷命令 ID')
  return withMutationLock(documentPath(workspace, QUICK_COMMANDS_FILENAME), async () => {
    const state = await readQuickCommands(workspace)
    const next = state.commands.filter((entry) => entry.id !== id)
    if (next.length === state.commands.length) throw new ScratchpadError('unknown-id', '快捷命令已不存在，请刷新后重试')
    state.commands = next
    state.updatedAt = Date.now()
    await writeDocument(workspace, QUICK_COMMANDS_FILENAME, state, QUICK_COMMANDS_MAX_BYTES)
    return quickCommandsSnapshot(workspace, state)
  })
}
