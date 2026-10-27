/**
 * Per-workspace workbench agent assignments (`v1.2.75 MVP`).
 *
 * The Owner works from the Dev Workspace workbench: pick a role/member/new agent,
 * describe a task with acceptance criteria, link it to a pipeline stage (or keep
 * it ad-hoc) and dispatch a structured order into the current conversation. The
 * Lead executes it with the Harness native team tools; this module only stores
 * the project-side dispatch board, its audit trail and its status bridge.
 *
 * One small JSON document lives inside each workspace
 * (`.dsh/agent-assignments.json`) so every browser window and every workspace
 * restore sees the same records — and no workspace can see another one's data.
 * The store is written with a temp-file rename under a per-root in-process lock,
 * a generated `.dsh/.gitignore` keeps it out of Git, corrupt documents return a
 * `corrupt` error (the file is never silently cleared or overwritten) and the
 * file/record limits are enforced on write.
 *
 * Invariants:
 * - assignments NEVER write `.dsh/pipeline.json`; the current round is read with
 *   `readPipeline` and stage ids are validated against the assignable subset;
 * - the owner-only panel routes are the only consumers: no model tools are
 *   registered here, so an agent can never assign work to itself;
 * - `approval` / `release` are owner gates and cannot be assigned.
 */

import { randomUUID } from 'node:crypto'
import { promises as fsp } from 'node:fs'
import path from 'node:path'
import { readPipeline } from './pipeline.js'
import { isSshRoot } from './ssh.js'

/** Directory created inside a workspace for plugin-owned state. */
export const ASSIGNMENTS_DIRNAME = '.dsh'

/** File name holding one workspace's assignment document. */
export const ASSIGNMENTS_FILENAME = 'agent-assignments.json'

/** Document format version. */
export const ASSIGNMENTS_VERSION = 1

/** Hard bounds enforced on every write. */
export const ASSIGNMENT_MAX_ITEMS = 100
export const ASSIGNMENT_MAX_BYTES = 1024 * 1024
export const ASSIGNMENT_MAX_TITLE = 120
export const ASSIGNMENT_MAX_DETAIL = 4000
export const ASSIGNMENT_MAX_ACCEPTANCE = 10
export const ASSIGNMENT_MAX_ACCEPTANCE_TEXT = 500
export const ASSIGNMENT_MAX_ARTIFACTS = 10
export const ASSIGNMENT_MAX_ARTIFACT = 500
export const ASSIGNMENT_MAX_NOTE = 4000
export const ASSIGNMENT_MAX_HISTORY = 50
export const ASSIGNMENT_MAX_MEMBER = 120
export const ASSIGNMENT_MAX_AGENT_NAME = 120
export const ASSIGNMENT_MAX_ID = 64
export const ASSIGNMENT_MIN_ID = 10

/** Assignment statuses: the normal flow plus the three terminal states. */
export const ASSIGNMENT_STATUSES = ['dispatched', 'running', 'review', 'done', 'failed', 'cancelled']

/** Statuses that end the assignment lifecycle (only "reassign" creates anew). */
export const ASSIGNMENT_TERMINAL_STATUSES = ['done', 'failed', 'cancelled']

/** Statuses whose records may be deleted from the board. */
export const ASSIGNMENT_DELETABLE_STATUSES = ['done', 'failed', 'cancelled']

/** Allowed forward transitions. Terminal states have no outgoing transition. */
export const ASSIGNMENT_TRANSITIONS = {
  dispatched: ['running', 'failed', 'cancelled'],
  running: ['review', 'failed', 'cancelled'],
  review: ['done', 'failed', 'cancelled'],
  done: [],
  failed: [],
  cancelled: [],
}

/** Statuses where a same-status update is a "nudge" (催办) that appends history. */
export const ASSIGNMENT_NUDGE_STATUSES = ['dispatched', 'running']

/** Assignable roles (mirrors the OPC team roles). */
export const ASSIGNMENT_ROLES = [
  'product-manager',
  'ui-designer',
  'fullstack-developer',
  'qa-engineer',
  'project-manager-agent',
  'devops',
]

/** Pipeline stages an assignment may be linked to (approval/release are gates). */
export const ASSIGNMENT_STAGE_IDS = ['product', 'design', 'development', 'testing', 'acceptance']

/** Pipeline stages that must never be assigned (owner-only gates). */
export const ASSIGNMENT_LOCKED_STAGE_IDS = ['approval', 'release']

/** Stage id accepted for the "auto-detect" client choice. */
export const ASSIGNMENT_AUTO_STAGE = 'auto'

/** Assignment priorities, P1 is the default. */
export const ASSIGNMENT_PRIORITIES = ['P0', 'P1', 'P2']

/** Fixed history actor for every panel operation. */
export const ASSIGNMENT_HISTORY_ACTOR = 'owner'

/** A structured, caller-facing failure with a stable machine code. */
export class AssignmentError extends Error {
  /**
   * @param code - stable machine-readable code.
   * @param message - human-readable explanation.
   */
  constructor(code, message) {
    super(message)
    this.name = 'AssignmentError'
    this.code = code
    // The Host request handler maps this field onto the API error envelope.
    this.sideCode = code
  }
}

/** An empty assignment document. */
export function emptyAssignments() {
  return { version: ASSIGNMENTS_VERSION, updatedAt: 0, items: [] }
}

/** Absolute path of one workspace's assignment document. */
export function assignmentFile(root) {
  return path.join(path.resolve(root), ASSIGNMENTS_DIRNAME, ASSIGNMENTS_FILENAME)
}

/** Absolute path of the plugin state directory inside one workspace. */
function stateDirectory(root) {
  return path.join(path.resolve(root), ASSIGNMENTS_DIRNAME)
}

/** Reject a root that could escape the caller's workspace containment. */
function assertRoot(root) {
  if (typeof root !== 'string' || root.length === 0) {
    throw new AssignmentError('bad-root', '工作区根目录必须是绝对路径')
  }
  if (isSshRoot(root)) {
    throw new AssignmentError('ssh-unsupported', 'SSH 远程工作区暂不支持工作台指派')
  }
  if (!path.isAbsolute(root)) {
    throw new AssignmentError('bad-root', '工作区根目录必须是绝对路径')
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
    throw new AssignmentError('outside-root', '工作区指派目录指向工作区之外，已拒绝访问')
  }
}

/** Refuse an assignment file that is a symlink or resolves outside the workspace. */
async function assertAssignmentFile(root) {
  await assertStateDirectory(root)
  const file = assignmentFile(root)
  let info
  try {
    info = await fsp.lstat(file)
  } catch (error) {
    if (error !== null && typeof error === 'object' && error.code === 'ENOENT') return
    throw error
  }
  if (info.isSymbolicLink()) {
    throw new AssignmentError('unsafe', '工作区指派文件是符号链接，已拒绝访问')
  }
  let real
  try {
    real = await fsp.realpath(file)
  } catch (error) {
    if (error !== null && typeof error === 'object' && error.code === 'ENOENT') return
    throw error
  }
  if (!isInsideRoot(root, real)) {
    throw new AssignmentError('outside-root', '工作区指派文件指向工作区之外，已拒绝访问')
  }
}

/** Trim a stored/requested string to one line. */
function trimmedString(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

/** Build one assignment id (10 lowercase hex chars, unique in the document). */
function createAssignmentId(items) {
  const used = new Set(items.map((item) => item.id))
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const id = randomUUID().replaceAll('-', '').slice(0, 10)
    if (!used.has(id)) return id
  }
  throw new AssignmentError('full', '无法生成新的指派标识，请稍后重试')
}

/** Validate one non-empty text field. */
function validateText(value, name, maxLength) {
  if (typeof value !== 'string') throw new AssignmentError('bad-request', `${name}必须是字符串`)
  const text = value.trim()
  if (text.length === 0) throw new AssignmentError('bad-request', `${name}不能为空`)
  if (text.length > maxLength) {
    throw new AssignmentError('too-large', `${name}最多 ${String(maxLength)} 个字符`)
  }
  return text
}

/** Validate an optional note (empty string allowed). */
function validateNote(value) {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') throw new AssignmentError('bad-request', '备注必须是字符串')
  const note = value.trim()
  if (note.length > ASSIGNMENT_MAX_NOTE) {
    throw new AssignmentError('too-large', `备注最多 ${String(ASSIGNMENT_MAX_NOTE)} 个字符`)
  }
  return note
}

/** Validate the task title. */
export function validateAssignmentTitle(value) {
  return validateText(value, '任务标题', ASSIGNMENT_MAX_TITLE)
}

/** Validate the task detail. */
export function validateAssignmentDetail(value) {
  return validateText(value, '详细说明', ASSIGNMENT_MAX_DETAIL)
}

/** Validate the acceptance-criteria list (1..10 items, 1..500 chars each). */
export function validateAssignmentAcceptance(value) {
  if (!Array.isArray(value)) throw new AssignmentError('bad-request', '验收标准必须是数组')
  if (value.length === 0) throw new AssignmentError('bad-request', '验收标准至少 1 条')
  if (value.length > ASSIGNMENT_MAX_ACCEPTANCE) {
    throw new AssignmentError('too-large', `验收标准最多 ${String(ASSIGNMENT_MAX_ACCEPTANCE)} 条`)
  }
  return value.map((entry, index) => {
    if (typeof entry !== 'string') {
      throw new AssignmentError('bad-request', `第 ${String(index + 1)} 条验收标准必须是字符串`)
    }
    const text = entry.trim()
    if (text.length === 0) {
      throw new AssignmentError('bad-request', `第 ${String(index + 1)} 条验收标准不能为空`)
    }
    if (text.length > ASSIGNMENT_MAX_ACCEPTANCE_TEXT) {
      throw new AssignmentError(
        'too-large',
        `第 ${String(index + 1)} 条验收标准最多 ${String(ASSIGNMENT_MAX_ACCEPTANCE_TEXT)} 个字符`,
      )
    }
    return text
  })
}

/** Validate the optional expected-artifact path list (<=10 x <=500 chars). */
export function validateAssignmentArtifacts(value) {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) throw new AssignmentError('bad-request', '期望产物必须是数组')
  if (value.length > ASSIGNMENT_MAX_ARTIFACTS) {
    throw new AssignmentError('too-large', `期望产物最多 ${String(ASSIGNMENT_MAX_ARTIFACTS)} 条`)
  }
  const artifacts = []
  for (const entry of value) {
    if (typeof entry !== 'string') throw new AssignmentError('bad-request', '期望产物路径必须是字符串')
    const text = entry.trim()
    if (text.length === 0) continue
    if (text.length > ASSIGNMENT_MAX_ARTIFACT) {
      throw new AssignmentError('too-large', `期望产物路径最多 ${String(ASSIGNMENT_MAX_ARTIFACT)} 个字符`)
    }
    artifacts.push(text)
  }
  return artifacts
}

/** Validate one assignment target: `role` | `member` | `newAgent` (exactly one). */
export function validateAssignmentTarget(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new AssignmentError('bad-request', '交给谁必须是对象')
  }
  const hasRole = typeof value.role === 'string' && value.role.trim().length > 0
  const hasMember = typeof value.member === 'string' && value.member.trim().length > 0
  const hasNewAgent = value.newAgent !== null && typeof value.newAgent === 'object' && !Array.isArray(value.newAgent)
  const selected = [hasRole, hasMember, hasNewAgent].filter(Boolean).length
  if (selected === 0) throw new AssignmentError('bad-request', '请选择交给谁（角色 / 成员 / 新建 Agent）')
  if (selected > 1) throw new AssignmentError('bad-request', '角色 / 成员 / 新建 Agent 只能三选一')
  if (hasRole) {
    const role = value.role.trim()
    if (!ASSIGNMENT_ROLES.includes(role)) {
      throw new AssignmentError('bad-request', `未知角色：${role}；必须是 ${ASSIGNMENT_ROLES.join(' / ')} 之一`)
    }
    return { role }
  }
  if (hasMember) {
    const member = trimmedString(value.member, ASSIGNMENT_MAX_MEMBER)
    if (member.length === 0) throw new AssignmentError('bad-request', '成员名不能为空')
    return { member }
  }
  const newAgent = value.newAgent
  const name = validateText(newAgent.name, '新建 Agent 名称', ASSIGNMENT_MAX_AGENT_NAME)
  const role = typeof newAgent.role === 'string' ? newAgent.role.trim() : ''
  if (!ASSIGNMENT_ROLES.includes(role)) {
    throw new AssignmentError('bad-request', `新建 Agent 角色必须是 ${ASSIGNMENT_ROLES.join(' / ')} 之一`)
  }
  return { newAgent: { name, role } }
}

/** Validate a linked stage id. `''` = ad-hoc task; `auto` = client-side detection. */
export function validateAssignmentStageId(value) {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') throw new AssignmentError('bad-request', '关联阶段必须是字符串')
  const stageId = value.trim()
  if (stageId.length === 0) return ''
  if (ASSIGNMENT_LOCKED_STAGE_IDS.includes(stageId)) {
    throw new AssignmentError('bad-request', '人工确认 / 发布上线只能由 Owner 在流水线面板审批，不可指派')
  }
  if (stageId === ASSIGNMENT_AUTO_STAGE) return ASSIGNMENT_AUTO_STAGE
  if (!ASSIGNMENT_STAGE_IDS.includes(stageId)) {
    throw new AssignmentError('bad-request', `未知关联阶段：${stageId}`)
  }
  return stageId
}

/** Validate the priority field (defaults to P1). */
export function validateAssignmentPriority(value) {
  if (value === undefined || value === null) return 'P1'
  if (typeof value !== 'string' || !ASSIGNMENT_PRIORITIES.includes(value.trim())) {
    throw new AssignmentError('bad-request', '优先级必须是 P0 / P1 / P2')
  }
  return value.trim()
}

/** Normalize one stored history entry. */
function normalizeStoredHistory(value, fallbackAt) {
  if (!Array.isArray(value)) return []
  const entries = []
  for (const candidate of value) {
    if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) continue
    entries.push({
      at: Number.isFinite(candidate.at) && candidate.at > 0 ? Math.floor(candidate.at) : fallbackAt,
      status: ASSIGNMENT_STATUSES.includes(candidate.status) ? candidate.status : 'dispatched',
      note: typeof candidate.note === 'string' ? candidate.note.trim().slice(0, ASSIGNMENT_MAX_NOTE) : '',
      actor: candidate.actor === 'owner' ? 'owner' : ASSIGNMENT_HISTORY_ACTOR,
    })
  }
  return entries.slice(-ASSIGNMENT_MAX_HISTORY)
}

/** Normalize one stored target; invalid targets fall back to a role target. */
function normalizeStoredTarget(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  try {
    return validateAssignmentTarget(value)
  } catch {
    return null
  }
}

/** Normalize one stored item; malformed items are dropped. */
function normalizeStoredItem(value, now) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const id = typeof value.id === 'string' ? value.id.trim().slice(0, ASSIGNMENT_MAX_ID) : ''
  const title = typeof value.title === 'string' ? value.title.trim().slice(0, ASSIGNMENT_MAX_TITLE) : ''
  const target = normalizeStoredTarget(value.assignedTo)
  if (id.length === 0 || title.length === 0 || target === null) return null
  const createdAt = Number.isFinite(value.createdAt) && value.createdAt > 0 ? Math.floor(value.createdAt) : now
  const updatedAt = Number.isFinite(value.updatedAt) && value.updatedAt > 0 ? Math.floor(value.updatedAt) : createdAt
  return {
    id,
    round: Number.isInteger(value.round) && value.round > 0 ? value.round : 1,
    title,
    detail: typeof value.detail === 'string' ? value.detail.trim().slice(0, ASSIGNMENT_MAX_DETAIL) : '',
    acceptance: Array.isArray(value.acceptance)
      ? value.acceptance
          .filter((entry) => typeof entry === 'string' && entry.trim().length > 0)
          .slice(0, ASSIGNMENT_MAX_ACCEPTANCE)
          .map((entry) => entry.trim().slice(0, ASSIGNMENT_MAX_ACCEPTANCE_TEXT))
      : [],
    assignedTo: target,
    stageId: typeof value.stageId === 'string' ? value.stageId.trim().slice(0, 40) : '',
    priority: ASSIGNMENT_PRIORITIES.includes(value.priority) ? value.priority : 'P1',
    expectedArtifacts: Array.isArray(value.expectedArtifacts)
      ? value.expectedArtifacts
          .filter((entry) => typeof entry === 'string' && entry.trim().length > 0)
          .slice(0, ASSIGNMENT_MAX_ARTIFACTS)
          .map((entry) => entry.trim().slice(0, ASSIGNMENT_MAX_ARTIFACT))
      : [],
    status: ASSIGNMENT_STATUSES.includes(value.status) ? value.status : 'dispatched',
    note: typeof value.note === 'string' ? value.note.trim().slice(0, ASSIGNMENT_MAX_NOTE) : '',
    createdAt,
    updatedAt,
    history: normalizeStoredHistory(value.history, updatedAt),
  }
}

/** Normalize a parsed document; malformed entries are dropped, never "fixed" silently. */
function normalizeStoredState(value) {
  const source = Array.isArray(value) ? { items: value } : value
  if (source === null || typeof source !== 'object' || Array.isArray(source)) {
    throw new AssignmentError('corrupt', '工作区指派文件格式无效')
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
  return {
    version: ASSIGNMENTS_VERSION,
    updatedAt: Number.isFinite(source.updatedAt) && source.updatedAt > 0 ? Math.floor(source.updatedAt) : 0,
    items,
  }
}

/** Serialize one document with a trailing newline. */
function serializeAssignments(state) {
  const document = {
    version: ASSIGNMENTS_VERSION,
    updatedAt: state.updatedAt,
    items: state.items.map((item) => ({
      id: item.id,
      round: item.round,
      title: item.title,
      detail: item.detail,
      acceptance: item.acceptance,
      assignedTo: item.assignedTo,
      stageId: item.stageId,
      priority: item.priority,
      expectedArtifacts: item.expectedArtifacts,
      status: item.status,
      note: item.note,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      history: item.history,
    })),
  }
  return `${JSON.stringify(document, null, 2)}\n`
}

/** Read one workspace's assignment document, returning an empty document when absent. */
export async function readAssignments(root) {
  const workspace = assertRoot(root)
  const file = assignmentFile(workspace)
  await assertAssignmentFile(workspace)
  let info
  try {
    info = await fsp.stat(file)
  } catch (error) {
    if (error !== null && typeof error === 'object' && error.code === 'ENOENT') return emptyAssignments()
    throw error
  }
  if (info.size > ASSIGNMENT_MAX_BYTES) {
    throw new AssignmentError('too-large', '工作区指派文件超过 1 MiB，已拒绝读取')
  }
  let text
  try {
    text = await fsp.readFile(file, 'utf8')
  } catch (error) {
    if (error !== null && typeof error === 'object' && error.code === 'ENOENT') return emptyAssignments()
    throw error
  }
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new AssignmentError('corrupt', `工作区指派文件无法解析：${file}`)
  }
  return normalizeStoredState(parsed)
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

/** Write one document atomically (temp file + rename, preserving the old file on failure). */
async function writeAssignments(root, state) {
  const file = assignmentFile(root)
  const text = serializeAssignments(state)
  if (Buffer.byteLength(text, 'utf8') > ASSIGNMENT_MAX_BYTES) {
    throw new AssignmentError('too-large', '工作区指派文件超过 1 MiB；请删除一些终态记录后重试')
  }
  await ensureStateDirectory(root)
  await assertAssignmentFile(root)
  const temporary = path.join(
    stateDirectory(root),
    `.agent-assignments-${String(process.pid)}-${String(Date.now())}-${randomUUID()}.tmp`,
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

/** Current delivery round from `.dsh/pipeline.json`, 1 when unreadable/absent. */
async function currentRound(workspace) {
  try {
    const doc = await readPipeline(workspace)
    return Number.isInteger(doc?.round) && doc.round > 0 ? doc.round : 1
  } catch {
    return 1
  }
}

/** Newest-updated first, with deterministic tie-breaks. */
function compareItems(left, right) {
  const updated = right.updatedAt - left.updatedAt
  if (updated !== 0) return updated
  const created = right.createdAt - left.createdAt
  if (created !== 0) return created
  return right.id.localeCompare(left.id)
}

/** Copy one item for a browser response. */
function publicItem(item) {
  return {
    id: item.id,
    round: item.round,
    title: item.title,
    detail: item.detail,
    acceptance: [...item.acceptance],
    assignedTo: { ...item.assignedTo },
    stageId: item.stageId,
    priority: item.priority,
    expectedArtifacts: [...item.expectedArtifacts],
    status: item.status,
    note: item.note,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    history: item.history.map((entry) => ({ ...entry })),
  }
}

/** Count items per status. */
function statusCounts(items) {
  const counts = { dispatched: 0, running: 0, review: 0, done: 0, failed: 0, cancelled: 0 }
  for (const item of items) counts[item.status] += 1
  return counts
}

/** Build the snapshot returned by `assignmentList`. */
function snapshot(state, workspace) {
  const items = state.items.map(publicItem).sort(compareItems)
  const counts = statusCounts(items)
  return {
    items,
    total: items.length,
    counts,
    updatedAt: state.updatedAt,
    path: assignmentFile(workspace),
    limits: { maxItems: ASSIGNMENT_MAX_ITEMS, maxBytes: ASSIGNMENT_MAX_BYTES },
  }
}

/**
 * Read one workspace's assignments for the workbench card/status list.
 * @param root - absolute workspace root.
 * @returns `{ items, total, counts, updatedAt, path, limits }`, newest first.
 */
export async function listAssignments(root) {
  const workspace = assertRoot(root)
  const state = await readAssignments(workspace)
  return snapshot(state, workspace)
}

/**
 * Create one dispatched assignment.
 *
 * The current round is read from `.dsh/pipeline.json` (read-only) and at most
 * 100 records are kept per workspace; the new record starts in `dispatched`
 * with one initial history entry.
 *
 * @param root - absolute workspace root.
 * @param input - `{ title, detail, acceptance, assignedTo, stageId?, priority?, expectedArtifacts? }`.
 * @returns the new record.
 */
export async function saveAssignment(root, input) {
  const workspace = assertRoot(root)
  const title = validateAssignmentTitle(input?.title)
  const detail = validateAssignmentDetail(input?.detail)
  const acceptance = validateAssignmentAcceptance(input?.acceptance)
  const assignedTo = validateAssignmentTarget(input?.assignedTo)
  const stageId = validateAssignmentStageId(input?.stageId)
  const priority = validateAssignmentPriority(input?.priority)
  const expectedArtifacts = validateAssignmentArtifacts(input?.expectedArtifacts)
  return withMutationLock(workspace, async () => {
    const state = await readAssignments(workspace)
    if (state.items.length >= ASSIGNMENT_MAX_ITEMS) {
      throw new AssignmentError(
        'full',
        `每个工作区最多 ${String(ASSIGNMENT_MAX_ITEMS)} 条指派记录；请先清理终态记录`,
      )
    }
    const now = Date.now()
    const round = await currentRound(workspace)
    const item = {
      id: createAssignmentId(state.items),
      round,
      title,
      detail,
      acceptance,
      assignedTo,
      stageId,
      priority,
      expectedArtifacts,
      status: 'dispatched',
      note: '',
      createdAt: now,
      updatedAt: now,
      history: [{ at: now, status: 'dispatched', note: '', actor: ASSIGNMENT_HISTORY_ACTOR }],
    }
    state.items.push(item)
    state.updatedAt = now
    await writeAssignments(workspace, state)
    return publicItem(item)
  })
}

/** Resolve one stored item by id (throws not-found). */
function findItem(state, id) {
  const index = state.items.findIndex((item) => item.id === id)
  if (index < 0) throw new AssignmentError('not-found', `找不到指派记录：${id}`)
  return { index, item: state.items[index] }
}

/** Validate an assignment id argument. */
function validateAssignmentId(value) {
  if (typeof value !== 'string') throw new AssignmentError('bad-id', '缺少指派标识')
  const id = value.trim()
  if (id.length === 0 || id.length < ASSIGNMENT_MIN_ID || id.length > ASSIGNMENT_MAX_ID) {
    throw new AssignmentError('bad-id', '指派标识格式无效')
  }
  return id
}

/**
 * Update one assignment's status (and note). Content fields are immutable: a
 * changed task is a new assignment created through "reassign".
 *
 * - a status change must follow `ASSIGNMENT_TRANSITIONS` (`bad-transition`);
 * - `failed` requires a non-empty note (`bad-request`);
 * - a same-status update with a note is a nudge (催办) for `dispatched`/`running`;
 * - every update appends one history entry (max 50) with actor `owner`.
 *
 * @param root - absolute workspace root.
 * @param input - `{ id, status?, note? }`.
 * @returns the updated record.
 */
export async function updateAssignment(root, input) {
  const workspace = assertRoot(root)
  const id = validateAssignmentId(input?.id)
  const has = (key) => input !== null && typeof input === 'object' && Object.prototype.hasOwnProperty.call(input, key)
  if (!has('status') && !has('note')) {
    throw new AssignmentError('bad-request', '请至少提供 status 或 note')
  }
  const requestedStatus = has('status') ? input.status : undefined
  if (requestedStatus !== undefined && !ASSIGNMENT_STATUSES.includes(requestedStatus)) {
    throw new AssignmentError('bad-request', 'status 必须是 dispatched / running / review / done / failed / cancelled')
  }
  const note = has('note') ? validateNote(input.note) : ''
  return withMutationLock(workspace, async () => {
    const state = await readAssignments(workspace)
    const { item } = findItem(state, id)
    const currentStatus = item.status
    const targetStatus = requestedStatus === undefined ? currentStatus : requestedStatus
    if (targetStatus === currentStatus) {
      if (!ASSIGNMENT_NUDGE_STATUSES.includes(currentStatus)) {
        throw new AssignmentError('bad-transition', `状态 ${currentStatus} 不支持同状态更新（催办仅限 dispatched / running）`)
      }
    } else {
      const allowed = ASSIGNMENT_TRANSITIONS[currentStatus] ?? []
      if (!allowed.includes(targetStatus)) {
        throw new AssignmentError('bad-transition', `不允许从 ${currentStatus} 变为 ${targetStatus}`)
      }
    }
    if (targetStatus === 'failed' && note.length === 0) {
      throw new AssignmentError('bad-request', '打回必须填写原因（note）')
    }
    const now = Date.now()
    item.status = targetStatus
    if (targetStatus === 'failed') item.note = note
    else if (targetStatus !== currentStatus && note.length > 0) item.note = note
    item.updatedAt = now
    const entry = {
      at: now,
      status: targetStatus,
      note: note.length > 0 ? note : targetStatus === currentStatus ? '催办' : '',
      actor: ASSIGNMENT_HISTORY_ACTOR,
    }
    item.history = [...item.history, entry].slice(-ASSIGNMENT_MAX_HISTORY)
    state.updatedAt = now
    await writeAssignments(workspace, state)
    return publicItem(item)
  })
}

/**
 * Delete one terminal assignment record.
 *
 * Only `done` / `failed` / `cancelled` records may be deleted: removing an
 * in-flight assignment would erase its trail while the agent may still be
 * working. The client asks the Owner for confirmation first.
 *
 * @param root - absolute workspace root.
 * @param id - assignment id.
 * @returns `{ removed: id }`.
 */
export async function deleteAssignment(root, id) {
  const workspace = assertRoot(root)
  const assignmentId = validateAssignmentId(id)
  return withMutationLock(workspace, async () => {
    const state = await readAssignments(workspace)
    const { index, item } = findItem(state, assignmentId)
    if (!ASSIGNMENT_DELETABLE_STATUSES.includes(item.status)) {
      throw new AssignmentError('bad-status', '只有已完成 / 已打回 / 已取消的指派记录可以删除')
    }
    state.items.splice(index, 1)
    state.updatedAt = Date.now()
    await writeAssignments(workspace, state)
    return { removed: assignmentId }
  })
}
