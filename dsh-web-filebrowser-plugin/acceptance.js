/**
 * Per-workspace acceptance checklist.
 *
 * The development workspace already knows every registered workspace root.
 * This module owns one small JSON document inside each root
 * (`.dsh/acceptance.json`) so the product-manager panel, the generated delivery
 * report and the model tools all operate on the same checklist — and no
 * workspace can see another workspace's items.
 *
 * Two consumers share the store:
 * - Host tools (`acceptance_list` / `acceptance_add` / `acceptance_update` /
 *   `acceptance_delete` / `acceptance_clear_passed`) let the model act as the
 *   product manager: split a requirement into checkable items before delivery
 *   and record pass/fail verdicts after re-testing. This is deliberately
 *   separate from the session-scoped `todo_write` plan tool and from the
 *   workspace todo board.
 * - The Host file API exposes the same document and the generated Chinese
 *   Markdown report to the browser's acceptance panel.
 *
 * Files are written with a temp-file rename under a per-root in-process lock so
 * a tool call and a panel edit cannot clobber each other. A generated
 * `.dsh/.gitignore` keeps the state out of Git by default.
 */

import { randomUUID } from 'node:crypto'
import { promises as fsp } from 'node:fs'
import path from 'node:path'
import { resolveAgentWorkspace } from './memory.js'
import { isSshRoot } from './ssh.js'

/** Directory created inside a workspace for plugin-owned state. */
export const ACCEPTANCE_DIRNAME = '.dsh'

/** File name holding one workspace's acceptance document. */
export const ACCEPTANCE_FILENAME = 'acceptance.json'

/** Document format version. */
export const ACCEPTANCE_VERSION = 1

/** Hard bounds; the model receives them in validation errors. */
export const ACCEPTANCE_MAX_ITEMS = 300
export const ACCEPTANCE_MAX_TITLE = 500
export const ACCEPTANCE_MAX_NOTE = 4000
export const ACCEPTANCE_MAX_CATEGORY = 64
export const ACCEPTANCE_MAX_REQUIREMENT = 2000
export const ACCEPTANCE_MAX_BYTES = 1024 * 1024

/** Accepted verdicts an acceptance item can carry. */
export const ACCEPTANCE_STATUSES = ['pending', 'pass', 'fail', 'blocked']

/** Prompt section name and ordering (right after the workspace-todo guide). */
const SECTION_NAME = 'dsh-web-filebrowser:workspace-acceptance-guide'
const SECTION_ORDER = 2386

/** Model-facing guidance folded into the system prompt for workspace sessions. */
export const ACCEPTANCE_SECTION = `## 工作区验收清单（持久化）

本工作区把交付验收项保存在 \`.dsh/acceptance.json\`，Dev Workspace 侧边栏与模型工具读写同一份清单。你的角色是产品经理：在交付前先把用户需求拆成可勾选、可验证的验收项，用 \`acceptance_add\` 写入（新项状态为 pending），每项用 title 写结论式的验收点、用 requirement 写清验收条件、用 category 标注所属模块；复测或回归后，用 \`acceptance_update\` 把结果回填为 pass 或 fail（因外部依赖无法验证时写 blocked），并在 note 中写清证据、复现步骤或失败原因。acceptance_update 改变状态时会自动记录 checkedAt，把状态改回 pending 会清除该时间。用 \`acceptance_list\` 随时查看全部验收项，用 \`acceptance_clear_passed\` 清理已通过的项。验收清单、工作区待办（todo_list）和会话级 \`todo_write\` 执行计划是三个不同的概念：验收清单只回答“这次交付是否达标”，请在交付总结前逐项核对并修复 fail 项；验收清单只保存在本地工作区，SSH 远程工作区暂不支持。`

/** Chinese label for each status, used by the Markdown report. */
const STATUS_LABELS = { pending: '待验收', pass: '通过', fail: '未通过', blocked: '受阻' }

/** Compact upper-case mark for each status, used by model-facing tool text. */
const STATUS_MARKS = { pending: 'PENDING', pass: 'PASS', fail: 'FAIL', blocked: 'BLOCKED' }

/** A structured, caller-facing failure with a stable machine code. */
export class AcceptanceError extends Error {
  /**
   * @param code - stable machine-readable code.
   * @param message - human-readable explanation.
   */
  constructor(code, message) {
    super(message)
    this.name = 'AcceptanceError'
    this.code = code
    // The Host request handler maps this field onto the API error envelope.
    this.sideCode = code
  }
}

/** An empty acceptance document. */
export function emptyAcceptance() {
  return { version: ACCEPTANCE_VERSION, updatedAt: 0, items: [] }
}

/** Absolute path of one workspace's acceptance document. */
export function acceptanceFile(root) {
  return path.join(path.resolve(root), ACCEPTANCE_DIRNAME, ACCEPTANCE_FILENAME)
}

/** Absolute path of the plugin state directory inside one workspace. */
function stateDirectory(root) {
  return path.join(path.resolve(root), ACCEPTANCE_DIRNAME)
}

/** Reject a root that could escape the caller's workspace containment. */
function assertRoot(root) {
  if (typeof root !== 'string' || root.length === 0) {
    throw new AcceptanceError('bad-root', '工作区根目录必须是绝对路径')
  }
  if (isSshRoot(root)) {
    throw new AcceptanceError('ssh-unsupported', 'SSH 远程工作区暂不支持本地验收清单')
  }
  if (!path.isAbsolute(root)) {
    throw new AcceptanceError('bad-root', '工作区根目录必须是绝对路径')
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
    throw new AcceptanceError('outside-root', '工作区验收目录指向工作区之外，已拒绝访问')
  }
}

/** Refuse an acceptance file that is a symlink or resolves outside the workspace. */
async function assertAcceptanceFile(root) {
  await assertStateDirectory(root)
  const file = acceptanceFile(root)
  let info
  try {
    info = await fsp.lstat(file)
  } catch (error) {
    if (error !== null && typeof error === 'object' && error.code === 'ENOENT') return
    throw error
  }
  if (info.isSymbolicLink()) {
    throw new AcceptanceError('unsafe', '工作区验收文件是符号链接，已拒绝访问')
  }
  let real
  try {
    real = await fsp.realpath(file)
  } catch (error) {
    if (error !== null && typeof error === 'object' && error.code === 'ENOENT') return
    throw error
  }
  if (!isInsideRoot(root, real)) {
    throw new AcceptanceError('outside-root', '工作区验收文件指向工作区之外，已拒绝访问')
  }
}

/** Validate an acceptance item title. */
export function validateAcceptanceTitle(value) {
  if (typeof value !== 'string') throw new AcceptanceError('bad-title', '验收项标题必须是字符串')
  const title = value.trim()
  if (title.length === 0) throw new AcceptanceError('bad-title', '验收项标题不能为空')
  if (title.length > ACCEPTANCE_MAX_TITLE) {
    throw new AcceptanceError('bad-title', `验收项标题最多 ${String(ACCEPTANCE_MAX_TITLE)} 个字符`)
  }
  return title
}

/** Validate an optional acceptance note. */
export function validateAcceptanceNote(value) {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') throw new AcceptanceError('bad-note', '备注必须是字符串')
  const note = value.trim()
  if (note.length > ACCEPTANCE_MAX_NOTE) {
    throw new AcceptanceError('bad-note', `备注最多 ${String(ACCEPTANCE_MAX_NOTE)} 个字符`)
  }
  return note
}

/** Validate an optional acceptance category. */
export function validateAcceptanceCategory(value) {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') throw new AcceptanceError('bad-category', '分类必须是字符串')
  const category = value.trim()
  if (category.length > ACCEPTANCE_MAX_CATEGORY) {
    throw new AcceptanceError('bad-category', `分类最多 ${String(ACCEPTANCE_MAX_CATEGORY)} 个字符`)
  }
  return category
}

/** Validate an optional acceptance requirement. */
export function validateAcceptanceRequirement(value) {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') throw new AcceptanceError('bad-requirement', '验收条件必须是字符串')
  const requirement = value.trim()
  if (requirement.length > ACCEPTANCE_MAX_REQUIREMENT) {
    throw new AcceptanceError('bad-requirement', `验收条件最多 ${String(ACCEPTANCE_MAX_REQUIREMENT)} 个字符`)
  }
  return requirement
}

/** Validate one status value. */
export function validateAcceptanceStatus(value) {
  if (typeof value !== 'string' || !ACCEPTANCE_STATUSES.includes(value)) {
    throw new AcceptanceError('bad-status', `状态必须是 ${ACCEPTANCE_STATUSES.join(' / ')} 之一`)
  }
  return value
}

/** Normalize one item read from disk; malformed items are dropped. */
function normalizeStoredItem(value, now) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const id = typeof value.id === 'string' ? value.id.trim().slice(0, 64) : ''
  const title = typeof value.title === 'string' ? value.title.trim() : ''
  if (id.length === 0 || title.length === 0) return null
  const status = ACCEPTANCE_STATUSES.includes(value.status) ? value.status : 'pending'
  const createdAt = Number.isFinite(value.createdAt) && value.createdAt > 0 ? Math.floor(value.createdAt) : now
  const updatedAt = Number.isFinite(value.updatedAt) && value.updatedAt > 0 ? Math.floor(value.updatedAt) : createdAt
  const checkedAt =
    status === 'pending' ? undefined : Number.isFinite(value.checkedAt) && value.checkedAt > 0 ? Math.floor(value.checkedAt) : updatedAt
  return {
    id,
    title: title.slice(0, ACCEPTANCE_MAX_TITLE),
    status,
    note: typeof value.note === 'string' ? value.note.trim().slice(0, ACCEPTANCE_MAX_NOTE) : '',
    category: typeof value.category === 'string' ? value.category.trim().slice(0, ACCEPTANCE_MAX_CATEGORY) : '',
    requirement:
      typeof value.requirement === 'string' ? value.requirement.trim().slice(0, ACCEPTANCE_MAX_REQUIREMENT) : '',
    createdAt,
    updatedAt,
    ...(checkedAt === undefined ? {} : { checkedAt }),
  }
}

/** Normalize a parsed document, accepting a bare item array for hand edits. */
function normalizeStoredState(value) {
  const source = Array.isArray(value) ? { items: value } : value
  if (source === null || typeof source !== 'object') {
    throw new AcceptanceError('corrupt', '工作区验收文件格式无效')
  }
  const now = Date.now()
  const seen = new Set()
  const items = []
  for (const candidate of Array.isArray(source.items) ? source.items : []) {
    const item = normalizeStoredItem(candidate, now)
    if (item === null || seen.has(item.id)) continue
    seen.add(item.id)
    items.push(item)
  }
  const updatedAt = Number.isFinite(source.updatedAt) && source.updatedAt > 0 ? Math.floor(source.updatedAt) : 0
  return { version: ACCEPTANCE_VERSION, updatedAt, items }
}

/** Parse one document and normalize it. */
function parseAcceptance(text, file) {
  let value
  try {
    value = JSON.parse(text)
  } catch {
    throw new AcceptanceError('corrupt', `工作区验收文件无法解析：${file}`)
  }
  return normalizeStoredState(value)
}

/** Serialize one document with a trailing newline. */
function serializeAcceptance(state) {
  return `${JSON.stringify({ version: ACCEPTANCE_VERSION, updatedAt: state.updatedAt, items: state.items }, null, 2)}\n`
}

/** Read one workspace's acceptance document, returning an empty document when absent. */
export async function readAcceptance(root) {
  const workspace = assertRoot(root)
  const file = acceptanceFile(workspace)
  await assertAcceptanceFile(workspace)
  let text
  try {
    text = await fsp.readFile(file, 'utf8')
  } catch (error) {
    if (error !== null && typeof error === 'object' && error.code === 'ENOENT') return emptyAcceptance()
    throw error
  }
  return parseAcceptance(text, file)
}

/** Create `.dsh/.gitignore` so plugin state does not dirty the repository. */
async function ensureStateDirectory(root) {
  const directory = stateDirectory(root)
  await fsp.mkdir(directory, { recursive: true })
  await assertStateDirectory(root)
  try {
    await fsp.writeFile(path.join(directory, '.gitignore'), '*\n', { encoding: 'utf8', flag: 'wx', mode: 0o600 })
  } catch (error) {
    if (error === null || typeof error !== 'object' || error.code !== 'EEXIST') throw error
  }
}

/** Write one document atomically. */
async function writeAcceptance(root, state) {
  const file = acceptanceFile(root)
  const text = serializeAcceptance(state)
  if (Buffer.byteLength(text, 'utf8') > ACCEPTANCE_MAX_BYTES) {
    throw new AcceptanceError('full', '工作区验收文件过大；请删除一些验收项后重试')
  }
  await ensureStateDirectory(root)
  await assertAcceptanceFile(root)
  const temporary = path.join(
    stateDirectory(root),
    `.acceptance-${String(process.pid)}-${String(Date.now())}-${randomUUID()}.tmp`,
  )
  await fsp.writeFile(temporary, text, { encoding: 'utf8', mode: 0o600 })
  try {
    await fsp.rename(temporary, file)
  } catch {
    // Windows can refuse to replace an existing target; the direct write still
    // keeps the document complete and the temp file is removed either way.
    try {
      await fsp.writeFile(file, text, { encoding: 'utf8', mode: 0o600 })
    } finally {
      await fsp.rm(temporary, { force: true }).catch(() => {})
    }
  }
}

/** Per-root mutation queue: read-modify-write runs one at a time. */
const mutationQueues = new Map()

/**
 * Run one mutation under the root's queue.
 * @param root - absolute workspace root.
 * @param operation - read-modify-write body.
 * @returns operation result.
 */
function withMutationLock(root, operation) {
  const key = path.resolve(root)
  const previous = mutationQueues.get(key) ?? Promise.resolve()
  const current = previous.catch(() => {}).then(operation)
  mutationQueues.set(key, current)
  return current.finally(() => {
    if (mutationQueues.get(key) === current) mutationQueues.delete(key)
  })
}

/** Generate a short, stable id that is unique within one document. */
function createItemId(items) {
  const used = new Set(items.map((item) => item.id))
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const id = randomUUID().replaceAll('-', '').slice(0, 10)
    if (!used.has(id)) return id
  }
  throw new AcceptanceError('full', '无法生成新的验收项标识，请稍后重试')
}

/** Copy one item for a browser/tool response. */
function publicItem(item) {
  return {
    id: item.id,
    title: item.title,
    status: item.status,
    note: item.note,
    category: item.category,
    requirement: item.requirement,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    ...(item.checkedAt === undefined ? {} : { checkedAt: item.checkedAt }),
  }
}

/** Convert one item to the tool output shape (no null values, no store-only fields). */
function toolItem(item) {
  return { ...publicItem(item), checkedAt: item.checkedAt ?? 0 }
}

/** Newest-updated first, with deterministic tie-breaks. */
function compareItems(left, right) {
  const updated = right.updatedAt - left.updatedAt
  if (updated !== 0) return updated
  const created = right.createdAt - left.createdAt
  if (created !== 0) return created
  return left.id.localeCompare(right.id)
}

/** Build the snapshot returned by every read; items are newest-updated first. */
function snapshot(state) {
  const items = state.items.map(publicItem).sort(compareItems)
  const counts = { pending: 0, pass: 0, fail: 0, blocked: 0 }
  for (const item of items) counts[item.status] += 1
  return {
    items,
    total: items.length,
    pending: counts.pending,
    pass: counts.pass,
    fail: counts.fail,
    blocked: counts.blocked,
    updatedAt: state.updatedAt,
  }
}

/**
 * Read one workspace's whole checklist for the browser panel.
 * @param root - absolute workspace root.
 * @returns `{ items, total, pending, pass, fail, blocked, updatedAt, path }`
 *   with every item, newest-updated first.
 */
export async function listAcceptance(root) {
  const workspace = assertRoot(root)
  const state = await readAcceptance(workspace)
  return { ...snapshot(state), path: acceptanceFile(workspace) }
}

/**
 * Add one acceptance item to the checklist.
 * @param root - absolute workspace root.
 * @param input - `{ title, note?, category?, requirement? }`.
 * @returns the new item, with status `pending`.
 */
export async function addAcceptance(root, input) {
  const workspace = assertRoot(root)
  const title = validateAcceptanceTitle(input?.title)
  const note = validateAcceptanceNote(input?.note)
  const category = validateAcceptanceCategory(input?.category)
  const requirement = validateAcceptanceRequirement(input?.requirement)
  return withMutationLock(workspace, async () => {
    const state = await readAcceptance(workspace)
    if (state.items.length >= ACCEPTANCE_MAX_ITEMS) {
      throw new AcceptanceError(
        'full',
        `每个工作区最多 ${String(ACCEPTANCE_MAX_ITEMS)} 个验收项；请先清理已通过的验收项`,
      )
    }
    const now = Date.now()
    const item = {
      id: createItemId(state.items),
      title,
      status: 'pending',
      note,
      category,
      requirement,
      createdAt: now,
      updatedAt: now,
    }
    state.items.push(item)
    state.updatedAt = now
    await writeAcceptance(workspace, state)
    return publicItem(item)
  })
}

/**
 * Update one acceptance item's fields and/or verdict.
 *
 * `title`, `note`, `category` and `requirement` are replaced when supplied; an
 * empty string clears an optional field. A status change records `checkedAt`
 * when the new verdict is pass/fail/blocked, and clears it when the item goes
 * back to pending.
 *
 * @param root - absolute workspace root.
 * @param input - `{ id, title?, note?, status?, category?, requirement? }`.
 * @returns the updated item.
 */
export async function updateAcceptance(root, input) {
  const workspace = assertRoot(root)
  const id = typeof input?.id === 'string' ? input.id.trim() : ''
  if (id.length === 0) throw new AcceptanceError('bad-id', '缺少验收项标识')
  const has = (key) => input !== null && typeof input === 'object' && Object.prototype.hasOwnProperty.call(input, key)
  if (!['title', 'note', 'status', 'category', 'requirement'].some(has)) {
    throw new AcceptanceError('bad-request', '请至少提供一个要修改的字段')
  }
  const title = has('title') ? validateAcceptanceTitle(input.title) : undefined
  const note = has('note') ? validateAcceptanceNote(input.note) : undefined
  const category = has('category') ? validateAcceptanceCategory(input.category) : undefined
  const requirement = has('requirement') ? validateAcceptanceRequirement(input.requirement) : undefined
  const status = has('status') ? validateAcceptanceStatus(input.status) : undefined
  return withMutationLock(workspace, async () => {
    const state = await readAcceptance(workspace)
    const item = state.items.find((candidate) => candidate.id === id)
    if (item === undefined) throw new AcceptanceError('not-found', `没有找到验收项 ${id}`)
    if (title !== undefined) item.title = title
    if (note !== undefined) item.note = note
    if (category !== undefined) item.category = category
    if (requirement !== undefined) item.requirement = requirement
    if (status !== undefined && status !== item.status) {
      item.status = status
      if (status === 'pending') delete item.checkedAt
      else item.checkedAt = Date.now()
    }
    const now = Date.now()
    item.updatedAt = now
    state.updatedAt = now
    await writeAcceptance(workspace, state)
    return publicItem(item)
  })
}

/**
 * Delete one acceptance item by id.
 * @param root - absolute workspace root.
 * @param id - item id.
 * @returns `{ removed }`; `false` when no item carries that id.
 */
export async function deleteAcceptance(root, id) {
  const workspace = assertRoot(root)
  const target = typeof id === 'string' ? id.trim() : ''
  if (target.length === 0) throw new AcceptanceError('bad-id', '缺少验收项标识')
  return withMutationLock(workspace, async () => {
    const state = await readAcceptance(workspace)
    const index = state.items.findIndex((item) => item.id === target)
    if (index < 0) return { removed: false }
    state.items.splice(index, 1)
    state.updatedAt = Date.now()
    await writeAcceptance(workspace, state)
    return { removed: true }
  })
}

/**
 * Remove every passed acceptance item.
 * @param root - absolute workspace root.
 * @returns `{ removed }` with the number of deleted items.
 */
export async function clearPassedAcceptance(root) {
  const workspace = assertRoot(root)
  return withMutationLock(workspace, async () => {
    const state = await readAcceptance(workspace)
    const before = state.items.length
    state.items = state.items.filter((item) => item.status !== 'pass')
    const removed = before - state.items.length
    if (removed === 0) return { removed: 0 }
    state.updatedAt = Date.now()
    await writeAcceptance(workspace, state)
    return { removed }
  })
}

/** Format one epoch millisecond value for the report, in UTC. */
function formatTimestamp(value) {
  if (!Number.isFinite(value) || value <= 0) return '—'
  const date = new Date(Math.floor(value))
  const pad = (part) => String(part).padStart(2, '0')
  return `${String(date.getUTCFullYear())}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`
}

/** Escape one Markdown table cell. */
function escapeCell(value) {
  return value.replaceAll('|', '\\|').replaceAll('\r\n', '<br>').replaceAll('\n', '<br>')
}

/** Normalize one item for the report so hand-edited documents still render. */
function normalizeReportItem(candidate) {
  if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) return null
  return {
    id: typeof candidate.id === 'string' ? candidate.id : '',
    title:
      typeof candidate.title === 'string' && candidate.title.trim().length > 0
        ? candidate.title.trim()
        : '（未命名验收项）',
    status: ACCEPTANCE_STATUSES.includes(candidate.status) ? candidate.status : 'pending',
    note: typeof candidate.note === 'string' ? candidate.note : '',
    category: typeof candidate.category === 'string' ? candidate.category : '',
    requirement: typeof candidate.requirement === 'string' ? candidate.requirement : '',
    createdAt: Number.isFinite(candidate.createdAt) ? candidate.createdAt : 0,
    updatedAt: Number.isFinite(candidate.updatedAt) ? candidate.updatedAt : 0,
    checkedAt: Number.isFinite(candidate.checkedAt) ? candidate.checkedAt : 0,
  }
}

/**
 * Build the Chinese Markdown acceptance report for one document.
 *
 * The report carries the generation time, per-status counts, one table of every
 * item (序号|状态|条目|备注|时间) and a separate "未通过项" list so failing
 * acceptance items are impossible to miss.
 *
 * @param doc - acceptance document (as returned by `readAcceptance`).
 * @returns Markdown report text.
 */
export function buildAcceptanceReport(doc) {
  const source = doc !== null && typeof doc === 'object' && Array.isArray(doc.items) ? doc.items : []
  const items = source.map(normalizeReportItem).filter((item) => item !== null)
  items.sort(compareItems)
  const counts = { pending: 0, pass: 0, fail: 0, blocked: 0 }
  for (const item of items) counts[item.status] += 1
  const lines = [
    '# 验收报告',
    '',
    `- 生成时间：${formatTimestamp(Date.now())}`,
    `- 数据更新时间：${formatTimestamp(doc?.updatedAt)}`,
    `- 共 ${String(items.length)} 项：通过 ${String(counts.pass)} · 未通过 ${String(counts.fail)} · 待验收 ${String(counts.pending)} · 受阻 ${String(counts.blocked)}`,
    '',
    '## 验收项',
    '',
  ]
  if (items.length === 0) {
    lines.push('（暂无验收项）')
  } else {
    lines.push('| 序号 | 状态 | 条目 | 备注 | 时间 |', '| --- | --- | --- | --- | --- |')
    items.forEach((item, index) => {
      const details = []
      if (item.category.length > 0) details.push(`分类：${item.category}`)
      if (item.requirement.length > 0) details.push(`验收条件：${item.requirement}`)
      const entry =
        details.length === 0
          ? escapeCell(item.title)
          : `${escapeCell(item.title)}<br>${escapeCell(details.join('；'))}`
      const note = item.note.length === 0 ? '—' : escapeCell(item.note)
      const time = item.checkedAt > 0 ? item.checkedAt : item.updatedAt
      lines.push(
        `| ${String(index + 1)} | ${STATUS_LABELS[item.status]} | ${entry} | ${note} | ${formatTimestamp(time)} |`,
      )
    })
  }
  const failed = items.filter((item) => item.status === 'fail')
  if (failed.length > 0) {
    lines.push('', '## 未通过项', '')
    for (const item of failed) {
      const category = item.category.length === 0 ? '' : `（${item.category}）`
      lines.push(`- **${item.title}**${category}`)
      if (item.requirement.length > 0) lines.push(`  - 验收条件：${escapeCell(item.requirement)}`)
      lines.push(`  - 备注：${item.note.length === 0 ? '（无）' : item.note.replaceAll(/\r?\n/gu, ' ')}`)
      lines.push(`  - 复测时间：${formatTimestamp(item.checkedAt > 0 ? item.checkedAt : item.updatedAt)}`)
    }
  }
  return `${lines.join('\n').trimEnd()}\n`
}

/**
 * Read one workspace's checklist and render the Markdown report.
 * @param root - absolute workspace root.
 * @returns Markdown report text.
 */
export async function buildAcceptanceMarkdown(root) {
  const workspace = assertRoot(root)
  return buildAcceptanceReport(await readAcceptance(workspace))
}

/** A registry-ready output schema for one acceptance item. */
const ITEM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    status: { type: 'string', description: 'One of pending, pass, fail or blocked.' },
    note: { type: 'string' },
    category: { type: 'string' },
    requirement: { type: 'string' },
    createdAt: { type: 'integer' },
    updatedAt: { type: 'integer' },
    checkedAt: { type: 'integer', description: '0 while the item is still pending.' },
  },
  required: ['id', 'title', 'status', 'note', 'category', 'requirement', 'createdAt', 'updatedAt', 'checkedAt'],
}

/** Cap the rendered list response even when notes are long. */
const LIST_RENDER_MAX_CHARS = 8000
const LIST_NOTE_EXCERPT_CHARS = 300

/** Render a bounded acceptance list for one tool result. */
function renderAcceptanceList(value) {
  if (value.items.length === 0) return `No acceptance items in ${value.scope}.`
  const lines = []
  let used = 0
  for (const item of value.items) {
    const note =
      item.note.length > LIST_NOTE_EXCERPT_CHARS && value.items.length > 2
        ? `${item.note.slice(0, LIST_NOTE_EXCERPT_CHARS).trimEnd()}… (see acceptance_list for the full note)`
        : item.note
    const category = item.category.length === 0 ? '' : ` (${item.category})`
    const noteText = note.length === 0 ? '' : ` — ${note.replaceAll(/\r?\n/gu, ' ')}`
    const line = `- [${item.id}] ${STATUS_MARKS[item.status]} ${item.title}${category}${noteText}`
    if (lines.length > 0 && used + line.length > LIST_RENDER_MAX_CHARS) break
    lines.push(line)
    used += line.length + 1
  }
  const omitted = value.total - lines.length
  const suffix =
    omitted > 0
      ? `\n(${String(omitted)} more ${omitted === 1 ? 'item is' : 'items are'} not shown; clear passed items to shorten the list.)`
      : ''
  return `Workspace acceptance checklist (${value.scope}): ${String(value.total)} items — ${String(value.pass)} pass / ${String(value.fail)} fail / ${String(value.pending)} pending / ${String(value.blocked)} blocked\n${lines.join('\n')}${suffix}`
}

/** Throw when a tool call has no agent/workspace, or has an SSH workspace. */
function toolWorkspace(ctx, exec) {
  const root = resolveAgentWorkspace(ctx, exec.agent)
  if (root === null) {
    throw new Error('The workspace acceptance checklist is unavailable because this session has no workspace directory.')
  }
  if (isSshRoot(root) || isSshRoot(exec.agent?.session?.meta?.cwd)) {
    throw new AcceptanceError(
      'ssh-unsupported',
      'SSH remote workspaces have no local acceptance checklist (.dsh/acceptance.json); use a local workspace instead.',
    )
  }
  return root
}

/** Read a required string tool argument. */
function requiredString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${name} must be a non-empty string`)
  }
  return value
}

/** Read an optional string tool argument. */
function optionalString(value, name) {
  if (value === undefined) return undefined
  if (typeof value !== 'string') throw new Error(`${name} must be a string`)
  return value
}

/**
 * Register the five model-facing acceptance tools. Registration is skipped per
 * tool on failure so one schema problem cannot remove the rest.
 * @param ctx - context providing `tools`.
 * @returns disposer for every registered tool.
 */
export function registerAcceptanceTools(ctx) {
  const disposers = []
  const register = (definition) => {
    try {
      const dispose = ctx.tools.register(definition)
      if (typeof dispose === 'function') disposers.push(dispose)
    } catch (error) {
      ctx.logger?.warn?.('dsh-web-filebrowser: failed to register an acceptance tool', error)
    }
  }

  register({
    name: 'acceptance_list',
    description:
      "List the workspace acceptance checklist stored in .dsh/acceptance.json — the delivery checklist the product manager (owner) maintains. Returns every item, newest-updated first, with counts per status. This is separate from the session-scoped todo_write plan and from the workspace todo board.",
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {},
      required: [],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          items: { type: 'array', items: ITEM_SCHEMA },
          total: { type: 'integer' },
          pending: { type: 'integer' },
          pass: { type: 'integer' },
          fail: { type: 'integer' },
          blocked: { type: 'integer' },
          scope: { type: 'string' },
        },
        required: ['items', 'total', 'pending', 'pass', 'fail', 'blocked', 'scope'],
      },
      render: (_args, value) => [{ type: 'text', text: renderAcceptanceList(value) }],
    },
    async execute(args, exec) {
      exec.signal.throwIfAborted()
      const root = toolWorkspace(ctx, exec)
      const result = await listAcceptance(root)
      exec.signal.throwIfAborted()
      return {
        items: result.items.map(toolItem),
        total: result.total,
        pending: result.pending,
        pass: result.pass,
        fail: result.fail,
        blocked: result.blocked,
        scope: root,
      }
    },
  })

  register({
    name: 'acceptance_add',
    description:
      "Add one acceptance item to the workspace delivery checklist. Use it before delivery to turn a requirement into a checkable item: title states the verdict-sized acceptance point, requirement spells out how it is verified, category tags the module. New items start as pending; record the pass/fail result later with acceptance_update. This is not the session todo_write plan and not the workspace todo board.",
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        title: { type: 'string', description: 'The acceptance point, phrased as a checkable statement.' },
        note: { type: 'string', description: 'Optional detail, evidence plan or reproduction steps.' },
        category: { type: 'string', description: 'Optional module or area label (at most 64 characters).' },
        requirement: { type: 'string', description: 'Optional acceptance condition that must hold.' },
      },
      required: ['title'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          item: ITEM_SCHEMA,
          scope: { type: 'string' },
        },
        required: ['item', 'scope'],
      },
      render: (_args, value) => [
        { type: 'text', text: `Added acceptance item ${value.item.id}: ${value.item.title} (pending).` },
      ],
    },
    async execute(args, exec) {
      exec.signal.throwIfAborted()
      const root = toolWorkspace(ctx, exec)
      const item = await addAcceptance(root, {
        title: requiredString(args?.title, 'title'),
        note: optionalString(args?.note, 'note'),
        category: optionalString(args?.category, 'category'),
        requirement: optionalString(args?.requirement, 'requirement'),
      })
      exec.signal.throwIfAborted()
      return { item: toolItem(item), scope: root }
    },
  })

  register({
    name: 'acceptance_update',
    description:
      'Update one acceptance item by id. After re-testing, set status to pass or fail (blocked when an external dependency prevents verification) and write the evidence or failure reason into note. Setting a status records checkedAt; setting it back to pending clears it. Passing only id and status, or id and note, is enough. This is not the session todo_write plan.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        id: { type: 'string', description: 'Item id from acceptance_list.' },
        title: { type: 'string', description: 'Replacement checkable statement.' },
        note: { type: 'string', description: 'Replacement note (evidence, repro, failure reason); empty string clears it.' },
        status: {
          type: 'string',
          enum: ACCEPTANCE_STATUSES,
          description: 'New verdict: pending, pass, fail or blocked.',
        },
        category: { type: 'string', description: 'Replacement category; empty string clears it.' },
        requirement: { type: 'string', description: 'Replacement acceptance condition; empty string clears it.' },
      },
      required: ['id'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          item: ITEM_SCHEMA,
          scope: { type: 'string' },
        },
        required: ['item', 'scope'],
      },
      render: (_args, value) => [
        {
          type: 'text',
          text: `Updated acceptance item ${value.item.id}: ${value.item.title} (${value.item.status}).`,
        },
      ],
    },
    async execute(args, exec) {
      exec.signal.throwIfAborted()
      const root = toolWorkspace(ctx, exec)
      const patch = { id: requiredString(args?.id, 'id') }
      if (args?.title !== undefined) patch.title = optionalString(args.title, 'title')
      if (args?.note !== undefined) patch.note = optionalString(args.note, 'note')
      if (args?.status !== undefined) patch.status = String(args.status)
      if (args?.category !== undefined) patch.category = optionalString(args.category, 'category')
      if (args?.requirement !== undefined) patch.requirement = optionalString(args.requirement, 'requirement')
      if (Object.keys(patch).length === 1) throw new Error('Provide at least one field to update.')
      const item = await updateAcceptance(root, patch)
      exec.signal.throwIfAborted()
      return { item: toolItem(item), scope: root }
    },
  })

  register({
    name: 'acceptance_delete',
    description:
      'Delete one acceptance item from the workspace delivery checklist. Use it when an item is obsolete or was written by mistake; use acceptance_update with status pass/fail when the item was actually verified. Use acceptance_clear_passed to remove every passed item at once.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        id: { type: 'string', description: 'Item id from acceptance_list.' },
      },
      required: ['id'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          removed: { type: 'boolean' },
          scope: { type: 'string' },
        },
        required: ['removed', 'scope'],
      },
      render: (_args, value) => [
        {
          type: 'text',
          text: value.removed
            ? 'Deleted the acceptance item.'
            : 'No acceptance item was deleted; the id was not found.',
        },
      ],
    },
    async execute(args, exec) {
      exec.signal.throwIfAborted()
      const root = toolWorkspace(ctx, exec)
      const result = await deleteAcceptance(root, requiredString(args?.id, 'id'))
      exec.signal.throwIfAborted()
      return { removed: result.removed, scope: root }
    },
  })

  register({
    name: 'acceptance_clear_passed',
    description:
      'Remove every passed acceptance item from the workspace delivery checklist, for example after a delivery has been signed off. Failed, blocked and pending items are kept.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {},
      required: [],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          removed: { type: 'integer' },
          scope: { type: 'string' },
        },
        required: ['removed', 'scope'],
      },
      render: (_args, value) => [
        {
          type: 'text',
          text:
            value.removed === 0
              ? 'No passed acceptance items were cleared.'
              : `Cleared ${String(value.removed)} passed acceptance ${value.removed === 1 ? 'item' : 'items'}.`,
        },
      ],
    },
    async execute(args, exec) {
      exec.signal.throwIfAborted()
      const root = toolWorkspace(ctx, exec)
      const result = await clearPassedAcceptance(root)
      exec.signal.throwIfAborted()
      return { removed: result.removed, scope: root }
    },
  })

  return () => {
    for (const dispose of disposers.splice(0)) dispose()
  }
}

/**
 * Register the workspace-acceptance guidance section. The checklist itself is
 * not injected into the prompt; the model reads it on demand with
 * `acceptance_list` so a long checklist cannot crowd the conversation context.
 * @param ctx - context providing `systemPrompt`.
 * @returns disposer for the section registration.
 */
export function registerAcceptancePrompt(ctx) {
  const disposers = []
  try {
    const section = ctx.systemPrompt.section({
      name: SECTION_NAME,
      order: SECTION_ORDER,
      text: (assembly) =>
        resolveAgentWorkspace(ctx, assembly?.agent ?? assembly?.scope) === null ? '' : ACCEPTANCE_SECTION,
    })
    if (typeof section === 'function') disposers.push(section)
  } catch (error) {
    ctx.logger?.warn?.('dsh-web-filebrowser: failed to register the acceptance guide', error)
  }
  return () => {
    for (const dispose of disposers.splice(0)) dispose()
  }
}
