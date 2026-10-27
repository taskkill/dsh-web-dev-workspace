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

/** Maximum evidence attachments on one acceptance item. */
export const ACCEPTANCE_MAX_EVIDENCE = 10

/** Longest accepted evidence path or URL. */
export const ACCEPTANCE_MAX_EVIDENCE_PATH = 500

/** Longest accepted evidence label. */
export const ACCEPTANCE_MAX_EVIDENCE_LABEL = 200

/** Maximum history entries kept per acceptance item (oldest are dropped). */
export const ACCEPTANCE_MAX_HISTORY = 50

/** Evidence kinds accepted on one acceptance item. */
export const ACCEPTANCE_EVIDENCE_KINDS = ['screenshot', 'log', 'report', 'diff', 'url']

/** Actors recorded in an acceptance item's history. */
export const ACCEPTANCE_HISTORY_ACTORS = ['owner', 'agent', 'system']

/** Workspace-relative directory where uploaded evidence files live. */
export const ACCEPTANCE_EVIDENCE_DIRNAME = '.dsh/evidence'

/** We do not render an unbounded report from the model tool. */
const REPORT_TOOL_MAX_CHARS = 8000

/** Unknown item fields are preserved on write, but only up to this size. */
const ITEM_EXTRA_MAX_BYTES = 2048

/** Unknown document fields are preserved on write, but only up to this size. */
const DOC_EXTRA_MAX_BYTES = 8192

/** Prompt section name and ordering (right after the workspace-todo guide). */
const SECTION_NAME = 'dsh-web-filebrowser:workspace-acceptance-guide'
const SECTION_ORDER = 2386

/** Model-facing guidance folded into the system prompt for workspace sessions. */
export const ACCEPTANCE_SECTION = `## 工作区验收清单（持久化）

本工作区把交付验收项保存在 \`.dsh/acceptance.json\`，Dev Workspace 侧边栏与模型工具读写同一份清单。你的角色是产品经理：在交付前先把用户需求拆成可勾选、可验证的验收项，用 \`acceptance_add\` 写入（新项状态为 pending），每项用 title 写结论式的验收点、用 requirement 写清验收条件、用 category 标注所属模块；复测或回归后，用 \`acceptance_update\` 把结果回填为 pass 或 fail（因外部依赖无法验证时写 blocked），并在 note 中写清证据、复现步骤或失败原因。每次状态变化都会写入该验收项的复测历史，pass 与 fail 互转时复测轮次 +1。用 \`acceptance_evidence_add\` 为验收项附加证据（只接受工作区相对路径或 http(s) 链接；截图/日志/报告/diff 都可），用 \`acceptance_report\` 读取当前 Markdown 报告（含证据附录与“证据缺口”小节），用 \`evidence_list\` 查看工作区已上传的证据文件。用 \`acceptance_list\` 随时查看全部验收项，用 \`acceptance_clear_passed\` 清理已通过的项。验收清单、工作区待办（todo_list）和会话级 \`todo_write\` 执行计划是三个不同的概念：验收清单只回答“这次交付是否达标”，请在交付总结前逐项核对并修复 fail 项；验收清单只保存在本地工作区，SSH 远程工作区暂不支持。**触发条件**：验收清单属于交付流水线的一部分——只有从 Dev Workspace「工作台」发起的交付需求才维护它（或 Owner 明确要求时）；用户在对话框里直接提出、按默认 Harness 方式完成的对话不要创建验收项，避免为一次普通问答增加整套验收开销。`

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

/** Whether one string looks like an http(s) URL. */
function isHttpUrl(value) {
  if (typeof value !== 'string') return false
  const text = value.trim()
  if (!/^https?:\/\//iu.test(text)) return false
  try {
    const parsed = new URL(text)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/** Infer the evidence kind from a path or URL. */
export function inferEvidenceKind(value) {
  if (isHttpUrl(value)) return 'url'
  const text = String(value ?? '').toLowerCase()
  const dot = text.lastIndexOf('.')
  const extension = dot < 0 ? '' : text.slice(dot + 1)
  if (/^(?:png|jpe?g|gif|webp|avif|bmp|svg|heic|heif)$/u.test(extension)) return 'screenshot'
  if (/^(?:log|txt|out)$/u.test(extension)) return 'log'
  if (/^(?:diff|patch)$/u.test(extension)) return 'diff'
  return 'report'
}

/**
 * Validate one workspace-relative evidence path.
 *
 * Evidence may point at a file the owner uploaded (`.dsh/evidence/...`) or at
 * any other workspace file; absolute paths, drive letters, backslashes and
 * `..` segments are refused so a stored path can never escape the workspace.
 *
 * @param value - candidate path.
 * @returns the normalized workspace-relative path (POSIX separators).
 */
export function validateAcceptanceEvidencePath(value) {
  if (typeof value !== 'string') throw new AcceptanceError('bad-evidence', '证据路径必须是字符串')
  const text = value.trim()
  if (text.length === 0) throw new AcceptanceError('bad-evidence', '证据路径不能为空')
  if (text.length > ACCEPTANCE_MAX_EVIDENCE_PATH) {
    throw new AcceptanceError('bad-evidence', `证据路径最多 ${String(ACCEPTANCE_MAX_EVIDENCE_PATH)} 个字符`)
  }
  if (text.includes('\u0000')) throw new AcceptanceError('bad-evidence', '证据路径不能包含空字符')
  if (text.includes('\\')) throw new AcceptanceError('bad-evidence', `证据路径必须使用 / 分隔：${text}`)
  if (text.startsWith('/') || /^[A-Za-z]:\//u.test(text)) {
    throw new AcceptanceError('bad-evidence', `证据必须是工作区相对路径：${text}`)
  }
  const trimmed = text.replace(/^\.\//u, '')
  const segments = trimmed.split('/')
  for (const segment of segments) {
    if (segment.length === 0 || segment === '.' || segment === '..') {
      throw new AcceptanceError('bad-evidence', `证据路径包含非法片段：${text}`)
    }
  }
  return segments.join('/')
}

/** Validate one evidence URL (only http/https). */
export function validateAcceptanceEvidenceUrl(value) {
  if (typeof value !== 'string') throw new AcceptanceError('bad-evidence', '证据链接必须是字符串')
  const text = value.trim()
  if (text.length === 0) throw new AcceptanceError('bad-evidence', '证据链接不能为空')
  if (text.length > ACCEPTANCE_MAX_EVIDENCE_PATH) {
    throw new AcceptanceError('bad-evidence', `证据链接最多 ${String(ACCEPTANCE_MAX_EVIDENCE_PATH)} 个字符`)
  }
  if (!isHttpUrl(text)) throw new AcceptanceError('bad-evidence', `url 类型的证据必须是 http(s) 链接：${text}`)
  return text
}

/** Validate an optional evidence label. */
export function validateAcceptanceEvidenceLabel(value) {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') throw new AcceptanceError('bad-evidence', '证据说明必须是字符串')
  const label = value.trim()
  if (label.length > ACCEPTANCE_MAX_EVIDENCE_LABEL) {
    throw new AcceptanceError('bad-evidence', `证据说明最多 ${String(ACCEPTANCE_MAX_EVIDENCE_LABEL)} 个字符`)
  }
  return label
}

/** Validate one history actor. */
export function validateHistoryActor(value, fallback = 'owner') {
  if (value === undefined || value === null) return fallback
  if (typeof value !== 'string' || !ACCEPTANCE_HISTORY_ACTORS.includes(value.trim())) {
    throw new AcceptanceError('bad-actor', `历史记录的操作者必须是 ${ACCEPTANCE_HISTORY_ACTORS.join(' / ')} 之一`)
  }
  return value.trim()
}

/** Validate an optional round number recorded with one history entry. */
export function validateHistoryRound(value) {
  if (value === undefined || value === null) return 0
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new AcceptanceError('bad-round', '轮次必须是非负整数')
  }
  return value
}

/**
 * Validate one evidence input and normalize it to the stored shape.
 * @param input - `{ path, label?, kind? }`.
 * @param by - actor recorded as `addedBy`.
 * @param addedAt - timestamp recorded as `addedAt`.
 * @returns `{ path, label, kind, addedAt, addedBy }`.
 */
function normalizeEvidenceInput(input, by, addedAt) {
  const rawPath = input?.path
  if (typeof rawPath !== 'string' || rawPath.trim().length === 0) {
    throw new AcceptanceError('bad-evidence', '缺少证据路径或链接（path）')
  }
  const label = validateAcceptanceEvidenceLabel(input?.label)
  const declaredKind = input?.kind
  if (declaredKind !== undefined && declaredKind !== null) {
    if (typeof declaredKind !== 'string' || !ACCEPTANCE_EVIDENCE_KINDS.includes(declaredKind.trim())) {
      throw new AcceptanceError('bad-evidence', `证据类型必须是 ${ACCEPTANCE_EVIDENCE_KINDS.join(' / ')} 之一`)
    }
  }
  const kind = typeof declaredKind === 'string' ? declaredKind.trim() : undefined
  const isUrl = isHttpUrl(rawPath)
  let evidencePath
  let evidenceKind
  if (kind === 'url') {
    evidencePath = validateAcceptanceEvidenceUrl(rawPath)
    evidenceKind = 'url'
  } else if (isUrl) {
    if (kind !== undefined) {
      throw new AcceptanceError('bad-evidence', `链接证据的类型必须是 url：${rawPath.trim()}`)
    }
    evidencePath = validateAcceptanceEvidenceUrl(rawPath)
    evidenceKind = 'url'
  } else {
    evidencePath = validateAcceptanceEvidencePath(rawPath)
    evidenceKind = kind ?? inferEvidenceKind(evidencePath)
  }
  return { path: evidencePath, label, kind: evidenceKind, addedAt, addedBy: by }
}

/** Normalize one evidence entry read from disk; malformed entries are dropped. */
function normalizeStoredEvidence(value, fallbackAt) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  if (typeof value.path !== 'string') return null
  let evidencePath
  let evidenceKind
  try {
    if (isHttpUrl(value.path)) {
      evidencePath = validateAcceptanceEvidenceUrl(value.path)
      evidenceKind = 'url'
    } else {
      evidencePath = validateAcceptanceEvidencePath(value.path)
      evidenceKind = ACCEPTANCE_EVIDENCE_KINDS.includes(value.kind) ? value.kind : inferEvidenceKind(evidencePath)
    }
  } catch {
    return null
  }
  const label = typeof value.label === 'string' ? value.label.trim().slice(0, ACCEPTANCE_MAX_EVIDENCE_LABEL) : ''
  const addedAt = Number.isFinite(value.addedAt) && value.addedAt > 0 ? Math.floor(value.addedAt) : fallbackAt
  const addedBy =
    typeof value.addedBy === 'string' && value.addedBy.trim().length > 0 ? value.addedBy.trim().slice(0, 64) : 'owner'
  return { path: evidencePath, label, kind: evidenceKind, addedAt, addedBy }
}

/** Extract `证据：<path>` lines from a legacy note, in document order. */
export function extractAcceptanceNoteEvidence(note) {
  if (typeof note !== 'string' || note.length === 0) return []
  const found = []
  const pattern = /^\s*证据\s*[：:]\s*(.+?)\s*$/gmu
  for (const match of note.matchAll(pattern)) {
    const raw = match[1].replaceAll('`', '').trim()
    if (raw.length > 0) found.push(raw)
  }
  return found
}

/** Normalize the evidence array of one item, migrating `证据：` note lines. */
function normalizeItemEvidence(value, note, fallbackAt) {
  const seen = new Set()
  const evidence = []
  const push = (entry) => {
    if (entry === null || evidence.length >= ACCEPTANCE_MAX_EVIDENCE) return
    if (seen.has(entry.path)) return
    seen.add(entry.path)
    evidence.push(entry)
  }
  for (const candidate of Array.isArray(value) ? value : []) push(normalizeStoredEvidence(candidate, fallbackAt))
  for (const raw of extractAcceptanceNoteEvidence(note)) {
    push(normalizeStoredEvidence({ path: raw, addedAt: fallbackAt, addedBy: 'owner' }, fallbackAt))
  }
  return evidence
}

/** Normalize the append-only history of one item (oldest entries dropped). */
function normalizeStoredHistory(value, fallbackAt) {
  if (!Array.isArray(value)) return []
  const entries = []
  for (const candidate of value) {
    if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) continue
    entries.push({
      at: Number.isFinite(candidate.at) && candidate.at > 0 ? Math.floor(candidate.at) : fallbackAt,
      status: ACCEPTANCE_STATUSES.includes(candidate.status) ? candidate.status : 'pending',
      note: typeof candidate.note === 'string' ? candidate.note.trim().slice(0, ACCEPTANCE_MAX_NOTE) : '',
      round: Number.isSafeInteger(candidate.round) && candidate.round >= 0 ? candidate.round : 0,
      by: ACCEPTANCE_HISTORY_ACTORS.includes(candidate.by) ? candidate.by : 'owner',
    })
  }
  return entries.slice(-ACCEPTANCE_MAX_HISTORY)
}

/** Whether a status change is a pass↔fail retest transition. */
function isRetestTransition(from, to) {
  return (from === 'pass' && to === 'fail') || (from === 'fail' && to === 'pass')
}

/** Append one history entry, keeping the newest `ACCEPTANCE_MAX_HISTORY` only. */
function appendItemHistory(item, entry) {
  if (!Array.isArray(item.history)) item.history = []
  item.history.push(entry)
  if (item.history.length > ACCEPTANCE_MAX_HISTORY) {
    item.history = item.history.slice(-ACCEPTANCE_MAX_HISTORY)
    item.historyTruncated = true
  }
}

/** Collect unknown fields of one object so a write does not drop them. */
function collectUnknownFields(source, known, maxBytes) {
  const extra = {}
  let found = 0
  for (const [key, value] of Object.entries(source)) {
    if (known.has(key)) continue
    if (key.length === 0 || key === '__proto__' || key === 'constructor') continue
    extra[key] = value
    found += 1
  }
  if (found === 0) return null
  try {
    if (Buffer.byteLength(JSON.stringify(extra), 'utf8') > maxBytes) return null
  } catch {
    return null
  }
  return extra
}

/** Known stored item keys (everything else is preserved as an extra). */
const ITEM_KNOWN_FIELDS = new Set([
  'id',
  'title',
  'status',
  'note',
  'category',
  'requirement',
  'createdAt',
  'updatedAt',
  'checkedAt',
  'evidence',
  'history',
  'retestRound',
  'historyTruncated',
])

/** Known stored document keys. */
const DOCUMENT_KNOWN_FIELDS = new Set(['version', 'updatedAt', 'items'])

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
  const note = typeof value.note === 'string' ? value.note.trim().slice(0, ACCEPTANCE_MAX_NOTE) : ''
  const evidence = normalizeItemEvidence(value.evidence, note, updatedAt)
  const history = normalizeStoredHistory(value.history, updatedAt)
  const retestRound =
    Number.isSafeInteger(value.retestRound) && value.retestRound >= 0 ? value.retestRound : 0
  const extra = collectUnknownFields(value, ITEM_KNOWN_FIELDS, ITEM_EXTRA_MAX_BYTES)
  return {
    id,
    title: title.slice(0, ACCEPTANCE_MAX_TITLE),
    status,
    note,
    category: typeof value.category === 'string' ? value.category.trim().slice(0, ACCEPTANCE_MAX_CATEGORY) : '',
    requirement:
      typeof value.requirement === 'string' ? value.requirement.trim().slice(0, ACCEPTANCE_MAX_REQUIREMENT) : '',
    evidence,
    history,
    retestRound,
    ...(value.historyTruncated === true ? { historyTruncated: true } : {}),
    createdAt,
    updatedAt,
    ...(checkedAt === undefined ? {} : { checkedAt }),
    ...(extra === null ? {} : { __extra: extra }),
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
  const extra = collectUnknownFields(source, DOCUMENT_KNOWN_FIELDS, DOC_EXTRA_MAX_BYTES)
  return { version: ACCEPTANCE_VERSION, updatedAt, items, ...(extra === null ? {} : { __extra: extra }) }
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

/** Serialize one stored item, preserving unknown fields underneath known ones. */
function serializeStoredItem(item) {
  const { __extra, ...known } = item
  const evidence = Array.isArray(known.evidence) ? known.evidence : []
  const history = Array.isArray(known.history) ? known.history : []
  const retestRound = Number.isSafeInteger(known.retestRound) ? known.retestRound : 0
  const document = {
    ...(__extra ?? {}),
    id: known.id,
    title: known.title,
    status: known.status,
    note: known.note,
    category: known.category,
    requirement: known.requirement,
    ...(evidence.length === 0 ? {} : { evidence }),
    ...(history.length === 0 ? {} : { history }),
    ...(retestRound === 0 ? {} : { retestRound }),
    ...(known.historyTruncated === true ? { historyTruncated: true } : {}),
    createdAt: known.createdAt,
    updatedAt: known.updatedAt,
    ...(known.checkedAt === undefined ? {} : { checkedAt: known.checkedAt }),
  }
  return document
}

/** Serialize one document with a trailing newline. */
function serializeAcceptance(state) {
  const document = {
    version: ACCEPTANCE_VERSION,
    updatedAt: state.updatedAt,
    ...(state.__extra ?? {}),
    items: state.items.map(serializeStoredItem),
  }
  return `${JSON.stringify(document, null, 2)}\n`
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

/**
 * Copy one item for a browser/tool response.
 *
 * @param item - stored item.
 * @param historyLimit - keep only the newest N history entries (0 = all). The
 *   panel list passes a small limit so a long-lived checklist cannot bloat the
 *   3-second workbench poll; the JSON file and the report keep the full trail.
 */
function publicItem(item, historyLimit = 0) {
  const history = (Array.isArray(item.history) ? item.history : []).map((entry) => ({
    at: entry.at,
    status: entry.status,
    note: entry.note,
    round: entry.round,
    by: entry.by,
  }))
  const keptHistory = Number.isSafeInteger(historyLimit) && historyLimit > 0 ? history.slice(-historyLimit) : history
  return {
    id: item.id,
    title: item.title,
    status: item.status,
    note: item.note,
    category: item.category,
    requirement: item.requirement,
    evidence: (Array.isArray(item.evidence) ? item.evidence : []).map((entry) => ({
      path: entry.path,
      label: entry.label,
      kind: entry.kind,
      addedAt: entry.addedAt,
      addedBy: entry.addedBy,
    })),
    history: keptHistory,
    retestRound: Number.isSafeInteger(item.retestRound) && item.retestRound >= 0 ? item.retestRound : 0,
    ...(item.historyTruncated === true ? { historyTruncated: true } : {}),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    ...(item.checkedAt === undefined ? {} : { checkedAt: item.checkedAt }),
  }
}

/** Convert one item to the tool output shape (no null values, no store-only fields). */
function toolItem(item, historyLimit = 3) {
  const base = publicItem(item)
  const limit = Number.isSafeInteger(historyLimit) && historyLimit > 0 ? historyLimit : 3
  return {
    ...base,
    history: base.history.slice(-limit),
    checkedAt: item.checkedAt ?? 0,
  }
}

/** Panel list payload keeps only the newest transitions per item. */
const PANEL_HISTORY_LIMIT = 10

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
  const items = state.items.map((item) => publicItem(item, PANEL_HISTORY_LIMIT)).sort(compareItems)
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
 * @param input - `{ title, note?, category?, requirement?, by? }`.
 * @returns the new item, with status `pending` and one initial history entry.
 */
export async function addAcceptance(root, input) {
  const workspace = assertRoot(root)
  const title = validateAcceptanceTitle(input?.title)
  const note = validateAcceptanceNote(input?.note)
  const category = validateAcceptanceCategory(input?.category)
  const requirement = validateAcceptanceRequirement(input?.requirement)
  const by = validateHistoryActor(input?.by ?? 'owner')
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
      evidence: [],
      history: [{ at: now, status: 'pending', note, round: 0, by }],
      retestRound: 0,
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
 * when the new verdict is pass/fail/blocked, clears it when the item goes back
 * to pending, appends one history entry and bumps `retestRound` on every
 * pass↔fail transition. A note-only edit also appends a history entry (same
 * status) so the re-test trail is complete.
 *
 * @param root - absolute workspace root.
 * @param input - `{ id, title?, note?, status?, category?, requirement?, by?, round? }`.
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
  const by = has('by') ? validateHistoryActor(input.by) : 'owner'
  const round = has('round') ? validateHistoryRound(input.round) : 0
  return withMutationLock(workspace, async () => {
    const state = await readAcceptance(workspace)
    const item = state.items.find((candidate) => candidate.id === id)
    if (item === undefined) throw new AcceptanceError('not-found', `没有找到验收项 ${id}`)
    const previousStatus = item.status
    const previousNote = item.note
    if (title !== undefined) item.title = title
    if (note !== undefined) item.note = note
    if (category !== undefined) item.category = category
    if (requirement !== undefined) item.requirement = requirement
    const now = Date.now()
    const statusChanged = status !== undefined && status !== previousStatus
    if (statusChanged) {
      item.status = status
      if (status === 'pending') delete item.checkedAt
      else item.checkedAt = now
      if (isRetestTransition(previousStatus, status)) {
        item.retestRound = (Number.isSafeInteger(item.retestRound) ? item.retestRound : 0) + 1
      }
      appendItemHistory(item, { at: now, status, note: item.note, round, by })
    } else if (note !== undefined && note !== previousNote) {
      appendItemHistory(item, { at: now, status: item.status, note: item.note, round, by })
    }
    item.updatedAt = now
    state.updatedAt = now
    await writeAcceptance(workspace, state)
    return publicItem(item)
  })
}

/**
 * Attach one evidence entry (file path or http(s) link) to an acceptance item.
 *
 * The path is stored in `.dsh/acceptance.json`; no file is read here, so the
 * owner/agent may attach evidence before uploading the screenshot. Duplicate
 * paths are merged (label/kind refreshed) instead of appended twice.
 *
 * @param root - absolute workspace root.
 * @param input - `{ id, path, label?, kind?, by? }`.
 * @returns the updated item (with its evidence list).
 */
export async function addAcceptanceEvidence(root, input) {
  const workspace = assertRoot(root)
  const id = typeof input?.id === 'string' ? input.id.trim() : ''
  if (id.length === 0) throw new AcceptanceError('bad-id', '缺少验收项标识')
  const by = validateHistoryActor(input?.by ?? 'owner')
  const now = Date.now()
  const normalized = normalizeEvidenceInput(input, by, now)
  return withMutationLock(workspace, async () => {
    const state = await readAcceptance(workspace)
    const item = state.items.find((candidate) => candidate.id === id)
    if (item === undefined) throw new AcceptanceError('not-found', `没有找到验收项 ${id}`)
    if (!Array.isArray(item.evidence)) item.evidence = []
    const existing = item.evidence.find((entry) => entry.path === normalized.path)
    if (existing !== undefined) {
      if (normalized.label.length > 0) existing.label = normalized.label
      existing.kind = normalized.kind
    } else {
      if (item.evidence.length >= ACCEPTANCE_MAX_EVIDENCE) {
        throw new AcceptanceError(
          'full',
          `每个验收项最多 ${String(ACCEPTANCE_MAX_EVIDENCE)} 条证据；请先移除旧证据`,
        )
      }
      item.evidence.push(normalized)
    }
    item.updatedAt = now
    state.updatedAt = now
    await writeAcceptance(workspace, state)
    return publicItem(item)
  })
}

/**
 * Remove one evidence entry from an acceptance item, by path or by index.
 * @param root - absolute workspace root.
 * @param input - `{ id, path? | index?, by? }`.
 * @returns the updated item; `not-found` when the item or the evidence is absent.
 */
export async function removeAcceptanceEvidence(root, input) {
  const workspace = assertRoot(root)
  const id = typeof input?.id === 'string' ? input.id.trim() : ''
  if (id.length === 0) throw new AcceptanceError('bad-id', '缺少验收项标识')
  const hasPath = typeof input?.path === 'string'
  const hasIndex = Number.isSafeInteger(input?.index)
  if (hasPath === hasIndex) {
    throw new AcceptanceError('bad-request', '请提供 path 或 index（二选一）来删除证据')
  }
  let rawPath = ''
  if (hasPath) {
    rawPath = input.path.trim()
    if (rawPath.length === 0) throw new AcceptanceError('bad-evidence', '证据路径不能为空')
    if (rawPath.length > ACCEPTANCE_MAX_EVIDENCE_PATH) {
      throw new AcceptanceError('bad-evidence', `证据路径最多 ${String(ACCEPTANCE_MAX_EVIDENCE_PATH)} 个字符`)
    }
  }
  return withMutationLock(workspace, async () => {
    const state = await readAcceptance(workspace)
    const item = state.items.find((candidate) => candidate.id === id)
    if (item === undefined) throw new AcceptanceError('not-found', `没有找到验收项 ${id}`)
    const evidence = Array.isArray(item.evidence) ? item.evidence : []
    const index = hasIndex ? input.index : evidence.findIndex((entry) => entry.path === rawPath)
    if (index < 0 || index >= evidence.length) {
      throw new AcceptanceError('not-found', '该项没有匹配的证据')
    }
    evidence.splice(index, 1)
    item.evidence = evidence
    const now = Date.now()
    item.updatedAt = now
    state.updatedAt = now
    await writeAcceptance(workspace, state)
    return publicItem(item)
  })
}

/**
 * List files uploaded to the workspace evidence folder `.dsh/evidence`.
 *
 * Only regular files directly inside that folder are returned; symlinks and
 * sub-directories are skipped, and an evidence folder that resolves outside the
 * workspace is refused. Missing folder reads as an empty list.
 *
 * @param root - absolute workspace root.
 * @param options - `{ limit? }` newest-first cap (default 50, max 200).
 * @returns `{ files: [{ path, name, bytes, at }], total }`.
 */
export async function listEvidenceFiles(root, options = {}) {
  const workspace = assertRoot(root)
  const limit = readEvidenceLimit(options?.limit)
  const directory = path.join(workspace, ACCEPTANCE_DIRNAME, 'evidence')
  let real
  try {
    real = await fsp.realpath(directory)
  } catch (error) {
    if (error !== null && typeof error === 'object' && error.code === 'ENOENT') return { files: [], total: 0 }
    throw error
  }
  if (!isInsideRoot(workspace, real)) {
    throw new AcceptanceError('outside-root', '工作区证据目录指向工作区之外，已拒绝访问')
  }
  let entries
  try {
    entries = await fsp.readdir(real, { withFileTypes: true })
  } catch (error) {
    if (error !== null && typeof error === 'object' && error.code === 'ENOENT') return { files: [], total: 0 }
    throw error
  }
  const files = []
  for (const entry of entries) {
    if (!entry.isFile()) continue
    const absolute = path.join(real, entry.name)
    let info
    try {
      info = await fsp.lstat(absolute)
    } catch {
      continue
    }
    if (!info.isFile()) continue
    files.push({
      path: `${ACCEPTANCE_EVIDENCE_DIRNAME}/${entry.name}`,
      name: entry.name,
      bytes: info.size,
      at: Math.floor(info.mtimeMs),
    })
  }
  files.sort((left, right) => right.at - left.at || left.name.localeCompare(right.name))
  return { files: files.slice(0, limit), total: files.length }
}

/** Read one `limit` option for the evidence listing tool. */
function readEvidenceLimit(value) {
  if (value === undefined || value === null) return 50
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new AcceptanceError('bad-request', 'limit 必须是正整数')
  }
  return Math.min(value, 200)
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
  const note = typeof candidate.note === 'string' ? candidate.note : ''
  const updatedAt = Number.isFinite(candidate.updatedAt) ? candidate.updatedAt : 0
  const createdAt = Number.isFinite(candidate.createdAt) ? candidate.createdAt : 0
  const fallbackAt = updatedAt > 0 ? Math.floor(updatedAt) : createdAt > 0 ? Math.floor(createdAt) : Date.now()
  return {
    id: typeof candidate.id === 'string' ? candidate.id : '',
    title:
      typeof candidate.title === 'string' && candidate.title.trim().length > 0
        ? candidate.title.trim()
        : '（未命名验收项）',
    status: ACCEPTANCE_STATUSES.includes(candidate.status) ? candidate.status : 'pending',
    note,
    category: typeof candidate.category === 'string' ? candidate.category : '',
    requirement: typeof candidate.requirement === 'string' ? candidate.requirement : '',
    evidence: normalizeItemEvidence(candidate.evidence, note, fallbackAt),
    retestRound: Number.isSafeInteger(candidate.retestRound) && candidate.retestRound >= 0 ? candidate.retestRound : 0,
    historyTruncated: candidate.historyTruncated === true,
    createdAt,
    updatedAt,
    checkedAt: Number.isFinite(candidate.checkedAt) ? candidate.checkedAt : 0,
  }
}

/**
 * Resolve the link target used for one evidence entry in the report.
 *
 * The delivery bundle stores evidence under `evidence/<basename>` (see
 * `collectEvidenceEntries` + the index.js bundle wiring), and the report is
 * embedded at the archive root, so the appendix links to the archive path while
 * the label keeps the workspace path for reference. `url` evidence keeps its
 * absolute link.
 */
function reportEvidenceTarget(entry) {
  if (entry.kind === 'url') return /[()<>\s]/u.test(entry.path) ? `<${entry.path}>` : entry.path
  const basename = entry.path.split('/').at(-1) ?? entry.path
  const archived = `evidence/${basename}`
  return /[()<>\s]/u.test(archived) ? `<${archived}>` : archived
}

/** Render one evidence link for the Markdown report appendix. */
function renderEvidenceLink(entry) {
  const label = entry.label.length > 0 ? entry.label : entry.path
  const kind = entry.kind === 'url' ? '链接' : entry.kind
  const meta = [kind, entry.addedBy, formatTimestamp(entry.addedAt)].filter((part) => part.length > 0).join(' · ')
  const safeLabel = label.replaceAll('[', '\\[').replaceAll(']', '\\]')
  return `- [${safeLabel}](${reportEvidenceTarget(entry)}) — ${meta}`
}

/** Build one status-count table row. */
function countRow(label, count) {
  return `| ${label} | ${String(count)} |`
}

/**
 * Build the Chinese Markdown acceptance report for one document.
 *
 * The report carries the generation time, per-status counts, a statistical
 * table, a category roll-up, one table of every item (序号|状态|条目|备注|时间,
 * where the item cell also shows category, acceptance requirement, evidence
 * count and retest round), a per-item evidence appendix (up to three links),
 * a "证据缺口" section for passed items without evidence, and a separate
 * "未通过项" list so failing items are impossible to miss.
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
  const evidenceCount = items.reduce((sum, item) => sum + item.evidence.length, 0)
  const gaps = items.filter((item) => item.status === 'pass' && item.evidence.length === 0)
  const lines = [
    '# 验收报告',
    '',
    `- 生成时间：${formatTimestamp(Date.now())}`,
    `- 数据更新时间：${formatTimestamp(doc?.updatedAt)}`,
    `- 共 ${String(items.length)} 项：通过 ${String(counts.pass)} · 未通过 ${String(counts.fail)} · 待验收 ${String(counts.pending)} · 受阻 ${String(counts.blocked)}`,
    `- 证据：${String(evidenceCount)} 条 · 证据缺口：${String(gaps.length)} 项（通过但未附证据）`,
    '',
    '## 统计',
    '',
    '| 状态 | 数量 |',
    '| --- | --- |',
    countRow('通过', counts.pass),
    countRow('未通过', counts.fail),
    countRow('待验收', counts.pending),
    countRow('受阻', counts.blocked),
    countRow('证据缺口', gaps.length),
    '',
  ]
  if (items.length === 0) {
    lines.push('## 验收项', '', '（暂无验收项）')
  } else {
    const categories = new Map()
    for (const item of items) {
      const key = item.category.length === 0 ? '（未分类）' : item.category
      const bucket = categories.get(key) ?? { total: 0, pass: 0, fail: 0, pending: 0, blocked: 0, gaps: 0 }
      bucket.total += 1
      bucket[item.status] += 1
      if (item.status === 'pass' && item.evidence.length === 0) bucket.gaps += 1
      categories.set(key, bucket)
    }
    lines.push('## 分类汇总', '', '| 分类 | 总数 | 通过 | 未通过 | 待验收 | 受阻 | 证据缺口 |', '| --- | --- | --- | --- | --- | --- | --- |')
    for (const [category, bucket] of [...categories.entries()].sort((left, right) => left[0].localeCompare(right[0]))) {
      lines.push(
        `| ${escapeCell(category)} | ${String(bucket.total)} | ${String(bucket.pass)} | ${String(bucket.fail)} | ${String(bucket.pending)} | ${String(bucket.blocked)} | ${String(bucket.gaps)} |`,
      )
    }
    lines.push('', '## 验收项', '', '| 序号 | 状态 | 条目 | 备注 | 时间 |', '| --- | --- | --- | --- | --- |')
    items.forEach((item, index) => {
      const details = []
      if (item.category.length > 0) details.push(`分类：${item.category}`)
      if (item.requirement.length > 0) details.push(`验收条件：${item.requirement}`)
      details.push(`证据：${String(item.evidence.length)} 条`)
      details.push(`复测轮次：${String(item.retestRound)}`)
      const requirementCell = details.length === 0 ? escapeCell(item.title) : `${escapeCell(item.title)}<br>${escapeCell(details.join('；'))}`
      const note = item.note.length === 0 ? '—' : escapeCell(item.note)
      const time = item.checkedAt > 0 ? item.checkedAt : item.updatedAt
      lines.push(
        `| ${String(index + 1)} | ${STATUS_LABELS[item.status]} | ${requirementCell} | ${note} | ${formatTimestamp(time)} |`,
      )
    })
  }
  const withEvidence = items.filter((item) => item.evidence.length > 0)
  if (withEvidence.length > 0) {
    lines.push('', '## 证据附录', '')
    withEvidence.forEach((item) => {
      const category = item.category.length === 0 ? '' : `（${item.category}）`
      lines.push(`### ${item.title}${category}`)
      const shown = item.evidence.slice(0, 3)
      for (const entry of shown) lines.push(renderEvidenceLink(entry))
      if (item.evidence.length > shown.length) {
        lines.push(`- 另有 ${String(item.evidence.length - shown.length)} 条证据未在报告中列出。`)
      }
      lines.push('')
    })
    lines.push('> 交付包内的证据位于 `evidence/` 目录（与上述链接一致）；工作区内原始路径见链接文字或验收台。', '')
  }
  lines.push('## 证据缺口', '')
  if (gaps.length === 0) {
    lines.push('（无：所有通过项都已附证据。）')
  } else {
    for (const item of gaps) {
      const category = item.category.length === 0 ? '' : `（${item.category}）`
      const requirement = item.requirement.length === 0 ? '' : ` — 验收条件：${escapeCell(item.requirement)}`
      lines.push(`- **${item.title}**${category}${requirement}`)
    }
    lines.push('', '> 这些验收项状态为“通过”但没有关联证据；请补截图/日志/报告后重新导出报告。')
  }
  const failed = items.filter((item) => item.status === 'fail')
  if (failed.length > 0) {
    lines.push('', '## 未通过项', '')
    for (const item of failed) {
      const category = item.category.length === 0 ? '' : `（${item.category}）`
      lines.push(`- **${item.title}**${category}`)
      if (item.requirement.length > 0) lines.push(`  - 验收条件：${escapeCell(item.requirement)}`)
      lines.push(`  - 备注：${item.note.length === 0 ? '（无）' : item.note.replaceAll(/\r?\n/gu, ' ')}`)
      lines.push(`  - 证据：${String(item.evidence.length)} 条 · 复测轮次：${String(item.retestRound)}`)
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

/** Registry-ready schema for one evidence attachment. */
const EVIDENCE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    path: { type: 'string', description: 'Workspace-relative file path or http(s) URL.' },
    label: { type: 'string' },
    kind: { type: 'string', description: 'One of screenshot, log, report, diff or url.' },
    addedAt: { type: 'integer' },
    addedBy: { type: 'string' },
  },
  required: ['path', 'label', 'kind', 'addedAt', 'addedBy'],
}

/** Registry-ready schema for one history transition. */
const HISTORY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    at: { type: 'integer' },
    status: { type: 'string', description: 'One of pending, pass, fail or blocked.' },
    note: { type: 'string' },
    round: { type: 'integer' },
    by: { type: 'string', description: 'One of owner, agent or system.' },
  },
  required: ['at', 'status', 'note', 'round', 'by'],
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
    evidence: { type: 'array', items: EVIDENCE_SCHEMA, description: 'Evidence attached to this item.' },
    history: {
      type: 'array',
      items: HISTORY_SCHEMA,
      description: 'Newest transitions (the tool response keeps at most the last three).',
    },
    retestRound: { type: 'integer', description: 'pass↔fail transition count.' },
    historyTruncated: { type: 'boolean' },
    createdAt: { type: 'integer' },
    updatedAt: { type: 'integer' },
    checkedAt: { type: 'integer', description: '0 while the item is still pending.' },
  },
  required: ['id', 'title', 'status', 'note', 'category', 'requirement', 'createdAt', 'updatedAt', 'checkedAt'],
}

/** Registry-ready schema for one evidence file in `.dsh/evidence`. */
const EVIDENCE_FILE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    path: { type: 'string' },
    name: { type: 'string' },
    bytes: { type: 'integer' },
    at: { type: 'integer' },
  },
  required: ['path', 'bytes', 'at'],
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

/** Read an optional positive integer tool argument. */
function optionalLimit(value, name, fallback, maximum) {
  if (value === undefined) return fallback
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`)
  return Math.min(value, maximum)
}

/** Find one acceptance item by id, or by a unique (case-insensitive) title. */
function findAcceptanceItem(items, args) {
  const id = typeof args?.id === 'string' ? args.id.trim() : ''
  if (id.length > 0) {
    const found = items.find((item) => item.id === id)
    if (found === undefined) throw new AcceptanceError('not-found', `没有找到验收项 ${id}`)
    return found
  }
  const title = typeof args?.title === 'string' ? args.title.trim() : ''
  if (title.length === 0) throw new Error('Provide id or title to locate the acceptance item.')
  const exact = items.filter((item) => item.title === title)
  if (exact.length === 1) return exact[0]
  if (exact.length > 1) throw new AcceptanceError('ambiguous', `有 ${String(exact.length)} 个同名验收项「${title}」，请改用 id`)
  const lowered = title.toLowerCase()
  const caseless = items.filter((item) => item.title.toLowerCase() === lowered)
  if (caseless.length === 1) return caseless[0]
  if (caseless.length > 1) throw new AcceptanceError('ambiguous', `有 ${String(caseless.length)} 个同名验收项「${title}」，请改用 id`)
  throw new AcceptanceError('not-found', `没有找到标题为「${title}」的验收项`)
}

/** Render the evidence-file listing for one tool result. */
function renderEvidenceFiles(value) {
  if (value.total === 0) return `No evidence files under .dsh/evidence in ${value.scope}.`
  const lines = value.files.map(
    (file) => `- ${file.path} — ${String(file.bytes)} bytes · ${formatTimestamp(file.at)}`,
  )
  const omitted = value.total - value.files.length
  const suffix = omitted > 0 ? `\n(${String(omitted)} more files are not shown; raise limit to list more.)` : ''
  return `Evidence files under .dsh/evidence in ${value.scope}: ${String(value.total)} total\n${lines.join('\n')}${suffix}`
}

/**
 * Register the eight model-facing acceptance tools. Registration is skipped per
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
        items: result.items.map((item) => toolItem(item, 3)),
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
        by: 'agent',
      })
      exec.signal.throwIfAborted()
      return { item: toolItem(item, 3), scope: root }
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
      patch.by = 'agent'
      const item = await updateAcceptance(root, patch)
      exec.signal.throwIfAborted()
      return { item: toolItem(item, 3), scope: root }
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

  register({
    name: 'acceptance_evidence_add',
    description:
      'Attach one evidence entry (a workspace-relative file path such as .dsh/evidence/shot.png, or an http(s) URL) to one acceptance item, located by id or by a unique title. Evidence kinds: screenshot, log, report, diff, url. Paths are workspace-relative only (no absolute paths, no ..); up to 10 entries per item. Use acceptance_report to read the report with the evidence appendix.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        id: { type: 'string', description: 'Item id from acceptance_list (preferred).' },
        title: { type: 'string', description: 'Unique item title, used when id is omitted.' },
        path: { type: 'string', description: 'Workspace-relative file path or http(s) URL.' },
        label: { type: 'string', description: 'Optional human-readable label (at most 200 characters).' },
        kind: {
          type: 'string',
          enum: ACCEPTANCE_EVIDENCE_KINDS,
          description: 'Optional evidence kind; inferred from the extension/URL when omitted.',
        },
      },
      required: ['path'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          item: ITEM_SCHEMA,
          evidence: { type: 'array', items: EVIDENCE_SCHEMA },
          scope: { type: 'string' },
        },
        required: ['item', 'evidence', 'scope'],
      },
      render: (_args, value) => [
        {
          type: 'text',
          text: `Evidence for ${value.item.id}: ${value.item.title} — ${String(value.evidence.length)} entr${
            value.evidence.length === 1 ? 'y' : 'ies'
          }.\n${value.evidence.map((entry) => `- ${entry.kind}: ${entry.path}`).join('\n')}`,
        },
      ],
    },
    async execute(args, exec) {
      exec.signal.throwIfAborted()
      const root = toolWorkspace(ctx, exec)
      const doc = await readAcceptance(root)
      const located = findAcceptanceItem(doc.items, args)
      const item = await addAcceptanceEvidence(root, {
        id: located.id,
        path: requiredString(args?.path, 'path'),
        label: optionalString(args?.label, 'label'),
        kind: args?.kind === undefined ? undefined : String(args.kind),
        by: 'agent',
      })
      exec.signal.throwIfAborted()
      return { item: toolItem(item, 3), evidence: item.evidence, scope: root }
    },
  })

  register({
    name: 'acceptance_report',
    description:
      'Render the current workspace acceptance report as Markdown (statistics, category roll-up, per-item evidence count and retest round, evidence appendix, evidence-gap section and failed items). The response is capped at 8 KB; when truncated is true, open the acceptance panel to export the full report.',
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
          markdown: { type: 'string' },
          truncated: { type: 'boolean' },
          scope: { type: 'string' },
        },
        required: ['markdown', 'truncated', 'scope'],
      },
      render: (_args, value) => [{ type: 'text', text: value.markdown }],
    },
    async execute(args, exec) {
      exec.signal.throwIfAborted()
      const root = toolWorkspace(ctx, exec)
      const markdown = await buildAcceptanceMarkdown(root)
      exec.signal.throwIfAborted()
      const truncated = markdown.length > REPORT_TOOL_MAX_CHARS
      return {
        markdown: truncated
          ? `${markdown.slice(0, REPORT_TOOL_MAX_CHARS)}\n…（报告过长已截断，共 ${String(markdown.length)} 字符；导出完整报告请用验收面板）\n`
          : markdown,
        truncated,
        scope: root,
      }
    },
  })

  register({
    name: 'evidence_list',
    description:
      'List screenshots, logs and other evidence files uploaded under .dsh/evidence in the workspace (newest first). Read-only: use it to find the path to pass to acceptance_evidence_add.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        limit: { type: 'integer', description: 'Newest files to return (default 50, maximum 200).' },
      },
      required: [],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          files: { type: 'array', items: EVIDENCE_FILE_SCHEMA },
          total: { type: 'integer' },
          scope: { type: 'string' },
        },
        required: ['files', 'total', 'scope'],
      },
      render: (_args, value) => [{ type: 'text', text: renderEvidenceFiles(value) }],
    },
    async execute(args, exec) {
      exec.signal.throwIfAborted()
      const root = toolWorkspace(ctx, exec)
      const limit = optionalLimit(args?.limit, 'limit', 50, 200)
      const listed = await listEvidenceFiles(root, { limit })
      exec.signal.throwIfAborted()
      return { files: listed.files, total: listed.total, scope: root }
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
