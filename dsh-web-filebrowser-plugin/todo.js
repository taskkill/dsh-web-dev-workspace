/**
 * Per-workspace todo list.
 *
 * The development workspace already knows every registered workspace root.
 * This module owns one small JSON document inside each root
 * (`.dsh/todos.json`) so the sidebar panel, every chat session and the model
 * tools all operate on the same task board — and no workspace can see another
 * workspace's tasks.
 *
 * Two consumers share the store:
 * - Host tools (`todo_list` / `todo_add` / `todo_update` / `todo_delete`) let
 *   the model read and curate the user's persistent tasks. This is deliberately
 *   separate from the session-scoped `todo_write` plan tool.
 * - The Host file API exposes the same document to the browser's Todo panel.
 *
 * Files are written with a temp-file rename under a per-root in-process lock so
 * a tool call and a panel edit cannot clobber each other. A generated
 * `.dsh/.gitignore` keeps the state out of Git by default.
 */

import { randomUUID } from 'node:crypto'
import { promises as fsp } from 'node:fs'
import path from 'node:path'
import { resolveAgentWorkspace } from './memory.js'

/** Directory created inside a workspace for plugin-owned state. */
export const TODO_DIRNAME = '.dsh'

/** File name holding one workspace's todo document. */
export const TODO_FILENAME = 'todos.json'

/** Document format version. */
export const TODO_VERSION = 1

/** Hard bounds; the model receives them in validation errors. */
export const TODO_MAX_TASKS = 500
export const TODO_MAX_TITLE = 500
export const TODO_MAX_NOTE = 4000
export const TODO_MAX_TAGS = 8
export const TODO_MAX_TAG = 32
export const TODO_MAX_BYTES = 1024 * 1024

/** Accepted enumerations, ordered from low to high urgency. */
export const TODO_PRIORITIES = ['low', 'normal', 'high', 'urgent']
export const TODO_STATUSES = ['open', 'done']

/** Prompt section name and ordering (next to the workspace-memory guide). */
const SECTION_NAME = 'dsh-web-filebrowser:workspace-todo-guide'
const SECTION_ORDER = 2385

/** Model-facing guidance folded into the system prompt for workspace sessions. */
export const TODO_SECTION = `## Workspace todo list (persistent)

This workspace keeps the user's task board in \`.dsh/todos.json\`; the Dev Workspace sidebar shows the same list. Use \`todo_list\` when the user asks what is pending, \`todo_add\` to capture a task, \`todo_update\` to edit a task or change its status, and \`todo_delete\` to remove one. Mark a task done as soon as the work it describes is finished. This board is separate from the session-scoped \`todo_write\` plan tool: \`todo_write\` tracks your own execution plan, while these tools manage the user's persistent tasks. Keep titles short, put detail in the note, and only set a due date (YYYY-MM-DD) the user gave or clearly implied; never invent deadlines.`

/** A structured, caller-facing failure with a stable machine code. */
export class TodoError extends Error {
  /**
   * @param code - stable machine-readable code.
   * @param message - human-readable explanation.
   */
  constructor(code, message) {
    super(message)
    this.name = 'TodoError'
    this.code = code
    // The Host request handler maps this field onto the API error envelope.
    this.sideCode = code
  }
}

/** An empty todo document. */
export function emptyTodo() {
  return { version: TODO_VERSION, updatedAt: 0, tasks: [] }
}

/** Absolute path of one workspace's todo document. */
export function todoFile(root) {
  return path.join(path.resolve(root), TODO_DIRNAME, TODO_FILENAME)
}

/** Absolute path of the plugin state directory inside one workspace. */
function stateDirectory(root) {
  return path.join(path.resolve(root), TODO_DIRNAME)
}

/** Reject a root that could escape the caller's workspace containment. */
function assertRoot(root) {
  if (typeof root !== 'string' || root.length === 0 || !path.isAbsolute(root)) {
    throw new TodoError('bad-root', '工作区根目录必须是绝对路径')
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
    throw new TodoError('outside-root', '工作区待办目录指向工作区之外，已拒绝访问')
  }
}

/** Refuse a todo file that is a symlink or resolves outside the workspace. */
async function assertTodoFile(root) {
  await assertStateDirectory(root)
  const file = todoFile(root)
  let info
  try {
    info = await fsp.lstat(file)
  } catch (error) {
    if (error !== null && typeof error === 'object' && error.code === 'ENOENT') return
    throw error
  }
  if (info.isSymbolicLink()) {
    throw new TodoError('unsafe', '工作区待办文件是符号链接，已拒绝访问')
  }
  let real
  try {
    real = await fsp.realpath(file)
  } catch (error) {
    if (error !== null && typeof error === 'object' && error.code === 'ENOENT') return
    throw error
  }
  if (!isInsideRoot(root, real)) {
    throw new TodoError('outside-root', '工作区待办文件指向工作区之外，已拒绝访问')
  }
}

/** Normalize one tag list read from disk: keep strings, trim, de-duplicate, bound. */
function normalizeStoredTags(value) {
  if (!Array.isArray(value)) return []
  const seen = new Set()
  const tags = []
  for (const item of value) {
    if (typeof item !== 'string') continue
    const tag = item.trim().slice(0, TODO_MAX_TAG)
    if (tag.length === 0) continue
    const key = tag.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    tags.push(tag)
    if (tags.length >= TODO_MAX_TAGS) break
  }
  return tags
}

/** Validate a tag list supplied by a tool or the browser. */
export function validateTodoTags(value) {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) throw new TodoError('bad-tags', '标签必须是字符串数组')
  const seen = new Set()
  const tags = []
  for (const item of value) {
    if (typeof item !== 'string') throw new TodoError('bad-tags', '标签必须是字符串数组')
    const tag = item.trim()
    if (tag.length === 0) continue
    if (tag.length > TODO_MAX_TAG) {
      throw new TodoError('bad-tags', `单个标签最多 ${String(TODO_MAX_TAG)} 个字符`)
    }
    const key = tag.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    tags.push(tag)
    if (tags.length > TODO_MAX_TAGS) {
      throw new TodoError('bad-tags', `最多 ${String(TODO_MAX_TAGS)} 个标签`)
    }
  }
  return tags
}

const DUE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u

/** Parse one `YYYY-MM-DD` calendar date without timezone drift. */
function parseDueDate(value) {
  if (typeof value !== 'string') return null
  const match = DUE_PATTERN.exec(value)
  if (match === null) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < 1970 || month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return value
}

/** Normalize a stored due date; hand-edited garbage becomes "no due date". */
function normalizeStoredDue(value) {
  return parseDueDate(value)
}

/** Validate a due date supplied by a tool or the browser; empty clears it. */
export function validateTodoDue(value) {
  if (value === undefined || value === null || value === '') return null
  const parsed = parseDueDate(value)
  if (parsed === null) throw new TodoError('bad-due', '截止日期必须是 YYYY-MM-DD')
  return parsed
}

/** Validate a task title. */
export function validateTodoTitle(value) {
  if (typeof value !== 'string') throw new TodoError('bad-title', '任务标题必须是字符串')
  const title = value.trim()
  if (title.length === 0) throw new TodoError('bad-title', '任务标题不能为空')
  if (title.length > TODO_MAX_TITLE) {
    throw new TodoError('bad-title', `任务标题最多 ${String(TODO_MAX_TITLE)} 个字符`)
  }
  return title
}

/** Validate an optional task note. */
export function validateTodoNote(value) {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') throw new TodoError('bad-note', '备注必须是字符串')
  const note = value.trim()
  if (note.length > TODO_MAX_NOTE) {
    throw new TodoError('bad-note', `备注最多 ${String(TODO_MAX_NOTE)} 个字符`)
  }
  return note
}

/** Validate one priority value. */
export function validateTodoPriority(value) {
  if (typeof value !== 'string' || !TODO_PRIORITIES.includes(value)) {
    throw new TodoError('bad-priority', `优先级必须是 ${TODO_PRIORITIES.join(' / ')} 之一`)
  }
  return value
}

/** Validate one status value. */
export function validateTodoStatus(value) {
  if (typeof value !== 'string' || !TODO_STATUSES.includes(value)) {
    throw new TodoError('bad-status', '状态必须是 open 或 done')
  }
  return value
}

/** Normalize one task read from disk; malformed tasks are dropped. */
function normalizeStoredTask(value, now) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const id = typeof value.id === 'string' ? value.id.trim().slice(0, 64) : ''
  const title = typeof value.title === 'string' ? value.title.trim() : ''
  if (id.length === 0 || title.length === 0) return null
  const createdAt = Number.isFinite(value.createdAt) && value.createdAt > 0 ? Math.floor(value.createdAt) : now
  const updatedAt = Number.isFinite(value.updatedAt) && value.updatedAt > 0 ? Math.floor(value.updatedAt) : createdAt
  const status = value.status === 'done' || value.done === true ? 'done' : 'open'
  const completedAt =
    status === 'done' && Number.isFinite(value.completedAt) && value.completedAt > 0
      ? Math.floor(value.completedAt)
      : status === 'done'
        ? updatedAt
        : undefined
  return {
    id,
    title: title.slice(0, TODO_MAX_TITLE),
    note: typeof value.note === 'string' ? value.note.trim().slice(0, TODO_MAX_NOTE) : '',
    status,
    priority: TODO_PRIORITIES.includes(value.priority) ? value.priority : 'normal',
    due: normalizeStoredDue(value.due),
    tags: normalizeStoredTags(value.tags),
    createdAt,
    updatedAt,
    ...(completedAt === undefined ? {} : { completedAt }),
    ...(typeof value.source === 'string' && value.source.length > 0 ? { source: value.source.slice(0, 200) } : {}),
  }
}

/** Normalize a parsed document, accepting a bare task array for hand edits. */
function normalizeStoredState(value) {
  const source = Array.isArray(value) ? { tasks: value } : value
  if (source === null || typeof source !== 'object') {
    throw new TodoError('corrupt', '工作区待办文件格式无效')
  }
  const now = Date.now()
  const seen = new Set()
  const tasks = []
  for (const candidate of Array.isArray(source.tasks) ? source.tasks : []) {
    const task = normalizeStoredTask(candidate, now)
    if (task === null || seen.has(task.id)) continue
    seen.add(task.id)
    tasks.push(task)
  }
  const updatedAt = Number.isFinite(source.updatedAt) && source.updatedAt > 0 ? Math.floor(source.updatedAt) : 0
  return { version: TODO_VERSION, updatedAt, tasks }
}

/** Parse one document and normalize it. */
function parseTodo(text, file) {
  let value
  try {
    value = JSON.parse(text)
  } catch (error) {
    throw new TodoError('corrupt', `工作区待办文件无法解析：${file}`, error)
  }
  return normalizeStoredState(value)
}

/** Serialize one document with a trailing newline. */
function serializeTodo(state) {
  return `${JSON.stringify({ version: TODO_VERSION, updatedAt: state.updatedAt, tasks: state.tasks }, null, 2)}\n`
}

/** Read one workspace's todo document, returning an empty document when absent. */
export async function readTodo(root) {
  const workspace = assertRoot(root)
  const file = todoFile(workspace)
  await assertTodoFile(workspace)
  let text
  try {
    text = await fsp.readFile(file, 'utf8')
  } catch (error) {
    if (error !== null && typeof error === 'object' && error.code === 'ENOENT') return emptyTodo()
    throw error
  }
  return parseTodo(text, file)
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
async function writeTodo(root, state) {
  const file = todoFile(root)
  const text = serializeTodo(state)
  if (Buffer.byteLength(text, 'utf8') > TODO_MAX_BYTES) {
    throw new TodoError('full', '工作区待办文件过大；请删除一些任务后重试')
  }
  await ensureStateDirectory(root)
  await assertTodoFile(root)
  const temporary = path.join(stateDirectory(root), `.todos-${String(process.pid)}-${String(Date.now())}-${randomUUID()}.tmp`)
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
function createTaskId(tasks) {
  const used = new Set(tasks.map((task) => task.id))
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const id = randomUUID().replaceAll('-', '').slice(0, 10)
    if (!used.has(id)) return id
  }
  throw new TodoError('full', '无法生成新的任务标识，请稍后重试')
}

/** Copy one task for a response. */
function publicTask(task) {
  return {
    id: task.id,
    title: task.title,
    note: task.note,
    status: task.status,
    priority: task.priority,
    due: task.due,
    tags: [...task.tags],
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    ...(task.completedAt === undefined ? {} : { completedAt: task.completedAt }),
    ...(task.source === undefined ? {} : { source: task.source }),
  }
}

/** Build the panel snapshot returned by every mutation. */
function snapshot(state, extra = {}) {
  const tasks = state.tasks.map(publicTask)
  const open = tasks.reduce((count, task) => count + (task.status === 'open' ? 1 : 0), 0)
  return {
    ...extra,
    tasks,
    total: tasks.length,
    open,
    done: tasks.length - open,
    updatedAt: state.updatedAt,
  }
}

/**
 * Read one workspace's whole board for the browser panel.
 * @param root - absolute workspace root.
 * @returns `{ tasks, total, open, done, updatedAt, path }`.
 */
export async function listTodos(root) {
  const workspace = assertRoot(root)
  const state = await readTodo(workspace)
  return snapshot(state, { path: todoFile(workspace) })
}

/**
 * Add one task to the board.
 * @param root - absolute workspace root.
 * @param input - `{ title, note?, priority?, due?, tags?, source? }`.
 * @returns `{ task, tasks, total, open, done, updatedAt }`.
 */
export async function addTodo(root, input) {
  const workspace = assertRoot(root)
  const title = validateTodoTitle(input?.title)
  const note = validateTodoNote(input?.note)
  const priority = input?.priority === undefined ? 'normal' : validateTodoPriority(input.priority)
  const due = input?.due === undefined ? null : validateTodoDue(input.due)
  const tags = validateTodoTags(input?.tags)
  const source = typeof input?.source === 'string' && input.source.length > 0 ? input.source.slice(0, 200) : undefined
  return withMutationLock(workspace, async () => {
    const state = await readTodo(workspace)
    if (state.tasks.length >= TODO_MAX_TASKS) {
      throw new TodoError('full', `每个工作区最多 ${String(TODO_MAX_TASKS)} 个任务；请先完成或删除一些任务`)
    }
    const now = Date.now()
    const task = {
      id: createTaskId(state.tasks),
      title,
      note,
      status: 'open',
      priority,
      due,
      tags,
      createdAt: now,
      updatedAt: now,
      ...(source === undefined ? {} : { source }),
    }
    state.tasks.push(task)
    state.updatedAt = now
    await writeTodo(workspace, state)
    return { task: publicTask(task), ...snapshot(state) }
  })
}

/**
 * Update one task's fields and/or status.
 *
 * `note`, `due` and `tags` are replaced when supplied; an empty string clears
 * the note and an empty due date clears the deadline. Setting `status: "done"`
 * records `completedAt`, and reopening clears it.
 *
 * @param root - absolute workspace root.
 * @param input - `{ id, title?, note?, priority?, due?, tags?, status? }`.
 * @returns `{ task, tasks, total, open, done, updatedAt }`.
 */
export async function updateTodo(root, input) {
  const workspace = assertRoot(root)
  const id = typeof input?.id === 'string' ? input.id.trim() : ''
  if (id.length === 0) throw new TodoError('bad-id', '缺少任务标识')
  const has = (key) => input !== null && typeof input === 'object' && Object.prototype.hasOwnProperty.call(input, key)
  if (!['title', 'note', 'priority', 'due', 'tags', 'status'].some(has)) {
    throw new TodoError('bad-request', '请至少提供一个要修改的字段')
  }
  const title = has('title') ? validateTodoTitle(input.title) : undefined
  const note = has('note') ? validateTodoNote(input.note) : undefined
  const priority = has('priority') ? validateTodoPriority(input.priority) : undefined
  const due = has('due') ? validateTodoDue(input.due) : undefined
  const tags = has('tags') ? validateTodoTags(input.tags) : undefined
  const status = has('status') ? validateTodoStatus(input.status) : undefined
  return withMutationLock(workspace, async () => {
    const state = await readTodo(workspace)
    const task = state.tasks.find((candidate) => candidate.id === id)
    if (task === undefined) throw new TodoError('not-found', `没有找到任务 ${id}`)
    if (title !== undefined) task.title = title
    if (note !== undefined) task.note = note
    if (priority !== undefined) task.priority = priority
    if (due !== undefined) task.due = due
    if (tags !== undefined) task.tags = tags
    if (status !== undefined && status !== task.status) {
      task.status = status
      if (status === 'done') task.completedAt = Date.now()
      else delete task.completedAt
    }
    const now = Date.now()
    task.updatedAt = now
    state.updatedAt = now
    await writeTodo(workspace, state)
    return { task: publicTask(task), ...snapshot(state) }
  })
}

/**
 * Delete one task by id.
 * @param root - absolute workspace root.
 * @param id - task id.
 * @returns `{ deleted, tasks, total, open, done, updatedAt }`.
 */
export async function deleteTodo(root, id) {
  const workspace = assertRoot(root)
  const target = typeof id === 'string' ? id.trim() : ''
  if (target.length === 0) throw new TodoError('bad-id', '缺少任务标识')
  return withMutationLock(workspace, async () => {
    const state = await readTodo(workspace)
    const index = state.tasks.findIndex((task) => task.id === target)
    if (index < 0) return { deleted: false, ...snapshot(state) }
    state.tasks.splice(index, 1)
    state.updatedAt = Date.now()
    await writeTodo(workspace, state)
    return { deleted: true, ...snapshot(state) }
  })
}

/**
 * Remove every completed task.
 * @param root - absolute workspace root.
 * @returns `{ deleted, tasks, total, open, done, updatedAt }`.
 */
export async function clearCompletedTodos(root) {
  const workspace = assertRoot(root)
  return withMutationLock(workspace, async () => {
    const state = await readTodo(workspace)
    const before = state.tasks.length
    state.tasks = state.tasks.filter((task) => task.status !== 'done')
    const deleted = before - state.tasks.length
    if (deleted === 0) return { deleted: 0, ...snapshot(state) }
    state.updatedAt = Date.now()
    await writeTodo(workspace, state)
    return { deleted, ...snapshot(state) }
  })
}

/** Priority rank for the model-facing list; urgent first. */
function priorityRank(priority) {
  const index = TODO_PRIORITIES.indexOf(priority)
  return index < 0 ? TODO_PRIORITIES.indexOf('normal') : index
}

/** Sort open tasks first, then by urgency, due date and age. */
function compareTasks(left, right) {
  if (left.status !== right.status) return left.status === 'open' ? -1 : 1
  const priority = priorityRank(right.priority) - priorityRank(left.priority)
  if (priority !== 0) return priority
  const due = (left.due ?? '9999-12-31').localeCompare(right.due ?? '9999-12-31')
  if (due !== 0) return due
  return left.createdAt - right.createdAt
}

/** Normalize one search limit. */
function normalizeLimit(value) {
  if (!Number.isInteger(value)) return 50
  return Math.max(1, Math.min(200, value))
}

/**
 * Query one workspace's board for a model tool call.
 * @param root - absolute workspace root.
 * @param input - `{ status?, query?, priority?, limit? }`.
 * @returns `{ entries, total, open, scope }` where `total` counts every match.
 */
export async function queryTodos(root, input) {
  const workspace = assertRoot(root)
  const state = await readTodo(workspace)
  const status = input?.status === undefined ? 'open' : input.status
  if (status !== 'open' && status !== 'done' && status !== 'all') {
    throw new TodoError('bad-status', 'status 必须是 open / done / all')
  }
  const priority = input?.priority === undefined ? null : validateTodoPriority(input.priority)
  const query = typeof input?.query === 'string' ? input.query.trim().toLowerCase() : ''
  const tokens = query.length === 0 ? [] : query.split(/\s+/u).filter((token) => token.length > 0)
  const limit = normalizeLimit(input?.limit)
  const all = state.tasks.map(publicTask)
  const open = all.reduce((count, task) => count + (task.status === 'open' ? 1 : 0), 0)
  const matches = all.filter((task) => {
    if (status !== 'all' && task.status !== status) return false
    if (priority !== null && task.priority !== priority) return false
    if (tokens.length === 0) return true
    const haystack = `${task.title}\n${task.note}\n${task.tags.join('\n')}`.toLowerCase()
    return tokens.every((token) => haystack.includes(token))
  })
  matches.sort(compareTasks)
  return { entries: matches.slice(0, limit), total: matches.length, open, scope: workspace }
}

/** Escape the closing tag if a task happens to contain it. */
function escapeContextText(value) {
  return value.replaceAll('</workspace-todos>', '<\\/workspace-todos>')
}

/** Model-facing one-line account of a task. */
function taskLine(task) {
  const marks = [task.status === 'done' ? '[x]' : '[ ]', task.priority, task.due === null ? '' : `due ${task.due}`]
    .filter((part) => part.length > 0)
    .join(' · ')
  const tags = task.tags.length === 0 ? '' : ` (tags: ${task.tags.join(', ')})`
  const note = task.note.length === 0 ? '' : `\n  ${escapeContextText(task.note).replaceAll('\n', '\n  ')}`
  return `- [${task.id}] ${marks} ${task.title}${tags}${note}`
}

/** Cap the rendered tool response even when notes are long. */
const LIST_RENDER_MAX_CHARS = 8000
const LIST_NOTE_EXCERPT_CHARS = 500

/** Render a bounded task list for one tool result. */
function renderTaskList(entries, scope, total, open) {
  if (entries.length === 0) return `No matching tasks in ${scope}. (${String(open)} open)`
  const lines = []
  let used = 0
  for (const task of entries) {
    const excerpt = {
      ...task,
      note:
        task.note.length > LIST_NOTE_EXCERPT_CHARS && entries.length > 2
          ? `${task.note.slice(0, LIST_NOTE_EXCERPT_CHARS).trimEnd()}… (narrow the query for the full note)`
          : task.note,
    }
    const line = taskLine(excerpt)
    if (lines.length > 0 && used + line.length > LIST_RENDER_MAX_CHARS) break
    lines.push(line)
    used += line.length + 1
  }
  const omitted = total - lines.length
  const suffix =
    omitted > 0
      ? `\n(${String(omitted)} more ${omitted === 1 ? 'task is' : 'tasks are'} not shown; narrow the query or raise the limit.)`
      : ''
  return `Workspace todos (${scope}): ${String(open)} open\n${lines.join('\n')}${suffix}`
}

/** A registry-ready output schema for one task. */
const TASK_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    note: { type: 'string' },
    status: { type: 'string' },
    priority: { type: 'string' },
    due: { type: 'string', description: 'YYYY-MM-DD, or an empty string when there is no due date.' },
    tags: { type: 'array', items: { type: 'string' } },
    createdAt: { type: 'integer' },
    updatedAt: { type: 'integer' },
    completedAt: { type: 'integer', description: '0 when the task is still open.' },
  },
  required: ['id', 'title', 'note', 'status', 'priority', 'due', 'tags', 'createdAt', 'updatedAt', 'completedAt'],
}

/** Convert a task to the tool output shape (no null values, no store-only fields). */
function toolTask(task) {
  return {
    id: task.id,
    title: task.title,
    note: task.note,
    status: task.status,
    priority: task.priority,
    due: task.due ?? '',
    tags: [...task.tags],
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    completedAt: task.completedAt ?? 0,
  }
}

/** Throw when a tool call has no agent/workspace. */
function toolWorkspace(ctx, exec) {
  const root = resolveAgentWorkspace(ctx, exec.agent)
  if (root === null) {
    throw new Error('Workspace todos are unavailable because this session has no workspace directory.')
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

/** Read an optional tag array tool argument. */
function optionalTags(value) {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error('tags must be an array of strings')
  }
  return value
}

/** Read an optional integer tool argument. */
function optionalLimit(value) {
  if (value === undefined) return undefined
  if (!Number.isInteger(value)) throw new Error('limit must be an integer')
  return value
}

/**
 * Register the four model-facing todo tools. Registration is skipped per tool
 * on failure so one schema problem cannot remove the rest.
 * @param ctx - context providing `tools`.
 * @returns disposer for every registered tool.
 */
export function registerTodoTools(ctx) {
  const disposers = []
  const register = (definition) => {
    try {
      const dispose = ctx.tools.register(definition)
      if (typeof dispose === 'function') disposers.push(dispose)
    } catch (error) {
      ctx.logger?.warn?.('dsh-web-filebrowser: failed to register a todo tool', error)
    }
  }

  register({
    name: 'todo_list',
    description:
      "List the user's persistent tasks in this workspace (stored in .dsh/todos.json and shown in the Dev Workspace sidebar). This is separate from the session-scoped todo_write plan tool. Defaults to open tasks; filter by text, status or priority.",
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        status: { type: 'string', enum: ['open', 'done', 'all'], description: 'Which tasks to list (default open).' },
        query: { type: 'string', description: 'Text to match in title, note or tags.' },
        priority: { type: 'string', enum: TODO_PRIORITIES, description: 'Only return tasks with this priority.' },
        limit: { type: 'integer', description: 'Maximum tasks to return (1-200, default 50).' },
      },
      required: [],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          entries: { type: 'array', items: TASK_SCHEMA },
          total: { type: 'integer' },
          open: { type: 'integer' },
          scope: { type: 'string' },
        },
        required: ['entries', 'total', 'open', 'scope'],
      },
      render: (_args, value) => [
        { type: 'text', text: renderTaskList(value.entries, value.scope, value.total, value.open) },
      ],
    },
    async execute(args, exec) {
      exec.signal.throwIfAborted()
      const root = toolWorkspace(ctx, exec)
      const result = await queryTodos(root, {
        status: optionalString(args?.status, 'status'),
        query: optionalString(args?.query, 'query'),
        priority: args?.priority === undefined ? undefined : String(args.priority),
        limit: optionalLimit(args?.limit),
      })
      exec.signal.throwIfAborted()
      return { entries: result.entries.map(toolTask), total: result.total, open: result.open, scope: result.scope }
    },
  })

  register({
    name: 'todo_add',
    description:
      "Add one task to the user's persistent workspace todo list. Use this when the user asks to remember something to do, or when they state an actionable follow-up. Keep the title short; put detail in note. Only set due (YYYY-MM-DD) when the user gave or clearly implied it. Use todo_write instead for your own execution plan.",
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        title: { type: 'string', description: 'Short, action-oriented task title.' },
        note: { type: 'string', description: 'Optional detail, context or acceptance criteria.' },
        priority: { type: 'string', enum: TODO_PRIORITIES, description: 'Optional priority (default normal).' },
        due: { type: 'string', description: 'Optional local due date, YYYY-MM-DD.' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Optional labels (up to 8).' },
      },
      required: ['title'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          task: TASK_SCHEMA,
          total: { type: 'integer' },
          open: { type: 'integer' },
          scope: { type: 'string' },
        },
        required: ['task', 'total', 'open', 'scope'],
      },
      render: (_args, value) => [
        {
          type: 'text',
          text: `Added todo ${value.task.id}: ${value.task.title} (${String(value.open)} open, ${String(value.total)} total).`,
        },
      ],
    },
    async execute(args, exec) {
      exec.signal.throwIfAborted()
      const root = toolWorkspace(ctx, exec)
      const result = await addTodo(root, {
        title: requiredString(args?.title, 'title'),
        note: optionalString(args?.note, 'note'),
        priority: args?.priority,
        due: args?.due,
        tags: optionalTags(args?.tags),
        source: exec.agent?.id,
      })
      exec.signal.throwIfAborted()
      return { task: toolTask(result.task), total: result.total, open: result.open, scope: root }
    },
  })

  register({
    name: 'todo_update',
    description:
      "Update one existing task in the user's persistent workspace todo list. Get the id from todo_list or the Dev Workspace sidebar. Set status to done when the work is finished and back to open to reopen a task. Empty note or due clears that field. This is not the session todo_write plan.",
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        id: { type: 'string', description: 'Task id from todo_list.' },
        title: { type: 'string', description: 'Replacement title.' },
        note: { type: 'string', description: 'Replacement note; empty string clears it.' },
        priority: { type: 'string', enum: TODO_PRIORITIES, description: 'Replacement priority.' },
        due: { type: 'string', description: 'Replacement local due date (YYYY-MM-DD); empty string clears it.' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Replacement tags.' },
        status: { type: 'string', enum: TODO_STATUSES, description: 'Mark the task open or done.' },
      },
      required: ['id'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          task: TASK_SCHEMA,
          total: { type: 'integer' },
          open: { type: 'integer' },
          scope: { type: 'string' },
        },
        required: ['task', 'total', 'open', 'scope'],
      },
      render: (_args, value) => [
        {
          type: 'text',
          text: `Updated todo ${value.task.id}: ${value.task.title} (${value.task.status}; ${String(value.open)} open, ${String(value.total)} total).`,
        },
      ],
    },
    async execute(args, exec) {
      exec.signal.throwIfAborted()
      const root = toolWorkspace(ctx, exec)
      const patch = { id: requiredString(args?.id, 'id') }
      if (args?.title !== undefined) patch.title = optionalString(args.title, 'title')
      if (args?.note !== undefined) patch.note = optionalString(args.note, 'note')
      if (args?.priority !== undefined) patch.priority = args.priority
      if (args?.due !== undefined) patch.due = args.due
      if (args?.tags !== undefined) patch.tags = optionalTags(args.tags)
      if (args?.status !== undefined) patch.status = args.status
      if (Object.keys(patch).length === 1) throw new Error('Provide at least one field to update.')
      const result = await updateTodo(root, patch)
      exec.signal.throwIfAborted()
      return { task: toolTask(result.task), total: result.total, open: result.open, scope: root }
    },
  })

  register({
    name: 'todo_delete',
    description:
      "Delete one task from the user's persistent workspace todo list. Use it when a task is obsolete or the user asks to remove it; use todo_update with status done instead when the work was actually completed.",
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        id: { type: 'string', description: 'Task id from todo_list.' },
      },
      required: ['id'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          deleted: { type: 'boolean' },
          total: { type: 'integer' },
          open: { type: 'integer' },
          scope: { type: 'string' },
        },
        required: ['deleted', 'total', 'open', 'scope'],
      },
      render: (_args, value) => [
        {
          type: 'text',
          text: value.deleted
            ? `Deleted the todo. The workspace now has ${String(value.open)} open of ${String(value.total)}.`
            : `No todo was deleted; the workspace still has ${String(value.open)} open of ${String(value.total)}.`,
        },
      ],
    },
    async execute(args, exec) {
      exec.signal.throwIfAborted()
      const root = toolWorkspace(ctx, exec)
      const result = await deleteTodo(root, requiredString(args?.id, 'id'))
      exec.signal.throwIfAborted()
      return { deleted: result.deleted, total: result.total, open: result.open, scope: root }
    },
  })

  return () => {
    for (const dispose of disposers.splice(0)) dispose()
  }
}

/**
 * Register the workspace-todo guidance section. The board itself is not
 * injected into the prompt; the model reads it on demand with `todo_list` so a
 * long task list cannot crowd the conversation context.
 * @param ctx - context providing `systemPrompt`.
 * @returns disposer for the section registration.
 */
export function registerTodoPrompt(ctx) {
  const disposers = []
  try {
    const section = ctx.systemPrompt.section({
      name: SECTION_NAME,
      order: SECTION_ORDER,
      text: (assembly) =>
        resolveAgentWorkspace(ctx, assembly?.agent ?? assembly?.scope) === null ? '' : TODO_SECTION,
    })
    if (typeof section === 'function') disposers.push(section)
  } catch (error) {
    ctx.logger?.warn?.('dsh-web-filebrowser: failed to register the todo guide', error)
  }
  return () => {
    for (const dispose of disposers.splice(0)) dispose()
  }
}
