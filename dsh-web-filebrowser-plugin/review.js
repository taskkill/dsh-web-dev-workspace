/**
 * Per-workspace change review state (P13 Host half).
 *
 * The Dev Workspace editor and the agent both change files. Git shows the
 * workspace's *current* state, but the owner needs a narrower question —
 * "which files changed since this pipeline stage started, and which of them have
 * I already reviewed?" This module answers it without touching client state:
 *
 * - a stage baseline is captured when a stage starts (`captureStageBaseline`):
 *   the git `HEAD` and `git status --porcelain -z` snapshot at that moment;
 * - `readReviewState` compares the current status with that baseline and returns
 *   the changed files plus the persisted review marks;
 * - `markReviewed` / `clearReviewed` persist per-file marks keyed by the change
 *   signature (status + staged/unstaged/untracked), so a further edit lapses the
 *   mark — the same semantics the Git panel already uses in
 *   `client.js:3554-3576`/`reviewSignature`.
 *
 * Everything lives in `.dsh/review.json`, next to memory/todos/pipeline, and is
 * written with a temp-file rename under a per-root in-process lock so a panel
 * action and a model call cannot clobber each other. A generated
 * `.dsh/.gitignore` keeps the document out of Git.
 *
 * Boundaries:
 * - non-git workspaces degrade to `available:false, reason:'not-git'` (nothing
 *   throws, nothing is written for reads);
 * - SSH remote workspaces return `reason:'ssh-unsupported'` — the files are on
 *   another host, so there is no local `.dsh` document to persist;
 * - a workspace that is inside a repository but not the repository root is
 *   treated as `not-repo-root`, because porcelain paths would not be relative
 *   to the workspace.
 *
 * This module registers no model tools; the Host file API exposes the three
 * operations (see `registerReviewOps` wiring in the Host plugin).
 */

import { randomUUID } from 'node:crypto'
import { promises as fsp } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import { execFile } from 'node:child_process'
import { isSshRoot } from './ssh.js'

const execFileAsync = promisify(execFile)

/** Directory created inside a workspace for plugin-owned state. */
export const REVIEW_DIRNAME = '.dsh'

/** File name holding one workspace's review document. */
export const REVIEW_FILENAME = 'review.json'

/** Document format version. */
export const REVIEW_VERSION = 1

/** Hard bounds; the caller receives them in validation errors. */
export const REVIEW_MAX_BASELINES = 60
export const REVIEW_MAX_MARKS = 2000
export const REVIEW_MAX_COMMENTS = 200
export const REVIEW_MAX_FILES = 2000
export const REVIEW_MAX_PATH = 500
export const REVIEW_MAX_SIG = 200
export const REVIEW_MAX_BYTES = 1024 * 1024

/**
 * Gate stages accepted by the review baseline. Must mirror `PIPELINE_STAGES` in
 * pipeline.js (including the v1.2.72 acceptance / AI-review gate): the review
 * view is only meaningful when every stage start can capture a baseline.
 */
export const REVIEW_STAGE_IDS = ['product', 'design', 'development', 'testing', 'acceptance', 'approval', 'release']

/** Bound on the git status snapshot taken at stage start (and on reads). */
const MAX_STATUS_ENTRIES = 2000
const MAX_STATUS_BYTES = 8 * 1024 * 1024
const GIT_TIMEOUT_MS = 15_000
const GIT_MAX_BUFFER = 8 * 1024 * 1024

/** Untracked files get a best-effort line count from the first bytes only. */
const MAX_UNTRACKED_STATS = 100
const MAX_UNTRACKED_BYTES = 256 * 1024

/** A structured, caller-facing failure with a stable machine code. */
export class ReviewError extends Error {
  /**
   * @param code - stable machine-readable code.
   * @param message - human-readable explanation.
   */
  constructor(code, message) {
    super(message)
    this.name = 'ReviewError'
    this.code = code
    // The Host request handler maps this field onto the API error envelope.
    this.sideCode = code
  }
}

/** An empty review document. */
export function emptyReview() {
  return { version: REVIEW_VERSION, updatedAt: 0, baselines: {}, marks: {}, comments: [] }
}

/** Absolute path of one workspace's review document. */
export function reviewFile(root) {
  return path.join(path.resolve(root), REVIEW_DIRNAME, REVIEW_FILENAME)
}

/** Absolute path of the plugin state directory inside one workspace. */
function stateDirectory(root) {
  return path.join(path.resolve(root), REVIEW_DIRNAME)
}

/** Coerce a stored timestamp to a safe epoch-millisecond number. */
function timestampValue(value) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}

/** Resolve a local workspace root; SSH roots are handled by the callers. */
function localRoot(root) {
  if (typeof root !== 'string' || root.trim().length === 0) {
    throw new ReviewError('bad-root', '工作区根目录不能为空')
  }
  if (isSshRoot(root)) throw new ReviewError('ssh-unsupported', 'SSH 远程工作区没有本地审阅状态')
  if (!path.isAbsolute(root)) throw new ReviewError('bad-root', '工作区根目录必须是绝对路径')
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
    throw new ReviewError('outside-root', '工作区审阅目录指向工作区之外，已拒绝访问')
  }
}

/** Refuse a review file that is a symlink or resolves outside the workspace. */
async function assertReviewFile(root) {
  await assertStateDirectory(root)
  const file = reviewFile(root)
  let info
  try {
    info = await fsp.lstat(file)
  } catch (error) {
    if (error !== null && typeof error === 'object' && error.code === 'ENOENT') return
    throw error
  }
  if (info.isSymbolicLink()) {
    throw new ReviewError('unsafe', '工作区审阅文件是符号链接，已拒绝访问')
  }
  let real
  try {
    real = await fsp.realpath(file)
  } catch (error) {
    if (error !== null && typeof error === 'object' && error.code === 'ENOENT') return
    throw error
  }
  if (!isInsideRoot(root, real)) {
    throw new ReviewError('outside-root', '工作区审阅文件指向工作区之外，已拒绝访问')
  }
}

/** Normalize one stored status entry; malformed entries are dropped. */
function normalizeStoredStatusEntry(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const entryPath = typeof value.path === 'string' ? value.path.trim().slice(0, REVIEW_MAX_PATH) : ''
  if (entryPath.length === 0) return null
  const status = typeof value.status === 'string' && value.status.length > 0 ? value.status.slice(0, 3) : 'M'
  return {
    path: entryPath,
    status,
    staged: value.staged === true,
    unstaged: value.unstaged === true,
    untracked: value.untracked === true,
    ...(typeof value.oldPath === 'string' && value.oldPath.length > 0
      ? { oldPath: value.oldPath.slice(0, REVIEW_MAX_PATH) }
      : {}),
  }
}

/** Normalize one stored baseline for a `round:stage` key. */
function normalizeStoredBaseline(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const stageId = REVIEW_STAGE_IDS.includes(value.stageId) ? value.stageId : null
  if (stageId === null) return null
  const round = Number.isInteger(value.round) && value.round > 0 ? value.round : 1
  const status = []
  for (const candidate of Array.isArray(value.status) ? value.status : []) {
    if (status.length >= MAX_STATUS_ENTRIES) break
    const entry = normalizeStoredStatusEntry(candidate)
    if (entry !== null) status.push(entry)
  }
  return {
    at: timestampValue(value.at),
    stageId,
    round,
    supported: value.supported === true,
    head: typeof value.head === 'string' ? value.head.trim().slice(0, 100) : '',
    status,
  }
}

/** Normalize one stored review mark (`<path>` -> `{sig, at, stageId?, round?}`). */
function normalizeStoredMark(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const sig = typeof value.sig === 'string' ? value.sig.trim().slice(0, REVIEW_MAX_SIG) : ''
  if (sig.length === 0) return null
  const stageId = REVIEW_STAGE_IDS.includes(value.stageId) ? value.stageId : ''
  const round = Number.isInteger(value.round) && value.round > 0 ? value.round : 0
  return {
    sig,
    at: timestampValue(value.at),
    stageId,
    round,
  }
}

/** Normalize a path key: workspace-relative, no absolute path, no `..`. */
function normalizeMarkPath(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > REVIEW_MAX_PATH) return null
  if (path.posix.isAbsolute(trimmed) || /^[A-Za-z]:\//u.test(trimmed)) return null
  const segments = trimmed.replaceAll('\\', '/').split('/')
  if (segments.some((segment) => segment === '..')) return null
  return trimmed.replaceAll('\\', '/')
}

/** Normalize one stored baseline key; only `round:stageId` keys are accepted. */
function normalizeBaselineKey(key, baseline) {
  return `${String(baseline.round)}:${baseline.stageId}`
}

/** Normalize a parsed document into the canonical review shape. */
function normalizeStoredState(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ReviewError('corrupt', '工作区审阅文件格式无效')
  }
  const baselines = {}
  const storedBaselines = value.baselines !== null && typeof value.baselines === 'object' ? value.baselines : {}
  for (const candidate of Object.values(storedBaselines)) {
    if (Object.keys(baselines).length >= REVIEW_MAX_BASELINES) break
    const baseline = normalizeStoredBaseline(candidate)
    if (baseline !== null) baselines[normalizeBaselineKey(null, baseline)] = baseline
  }
  const marks = {}
  const storedMarks = value.marks !== null && typeof value.marks === 'object' ? value.marks : {}
  const markEntries = []
  for (const [key, candidate] of Object.entries(storedMarks)) {
    const markPath = normalizeMarkPath(key)
    const mark = normalizeStoredMark(candidate)
    if (markPath !== null && mark !== null) markEntries.push({ path: markPath, mark })
  }
  markEntries.sort((left, right) => right.mark.at - left.mark.at)
  for (const { path: markPath, mark } of markEntries.slice(0, REVIEW_MAX_MARKS)) marks[markPath] = mark
  const comments = []
  for (const candidate of Array.isArray(value.comments) ? value.comments : []) {
    if (comments.length >= REVIEW_MAX_COMMENTS) break
    if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) continue
    const text = typeof candidate.text === 'string' ? candidate.text.trim().slice(0, 4000) : ''
    if (text.length === 0) continue
    comments.push({
      id: typeof candidate.id === 'string' && candidate.id.length > 0 ? candidate.id : randomUUID(),
      at: timestampValue(candidate.at),
      path: normalizeMarkPath(candidate.path) ?? '',
      stageId: REVIEW_STAGE_IDS.includes(candidate.stageId) ? candidate.stageId : '',
      round: Number.isInteger(candidate.round) && candidate.round > 0 ? candidate.round : 0,
      text,
      resolved: candidate.resolved === true,
    })
  }
  return {
    version: REVIEW_VERSION,
    updatedAt: timestampValue(value.updatedAt),
    baselines,
    marks,
    comments,
  }
}

/** Serialize one document with a trailing newline. */
function serializeReview(state) {
  return `${JSON.stringify(
    {
      version: REVIEW_VERSION,
      updatedAt: state.updatedAt,
      baselines: state.baselines,
      marks: state.marks,
      comments: state.comments,
    },
    null,
    2,
  )}\n`
}

/** Read one workspace's review document, returning an empty one when absent. */
export async function readReview(root) {
  const workspace = localRoot(root)
  const file = reviewFile(workspace)
  await assertReviewFile(workspace)
  let info
  try {
    info = await fsp.stat(file)
  } catch (error) {
    if (error !== null && typeof error === 'object' && error.code === 'ENOENT') return emptyReview()
    throw error
  }
  if (info.size > REVIEW_MAX_BYTES) {
    throw new ReviewError('too-large', '工作区审阅文件超过 1 MiB，已拒绝读取')
  }
  let parsed
  try {
    parsed = JSON.parse(await fsp.readFile(file, 'utf8'))
  } catch (error) {
    if (error instanceof SyntaxError) throw new ReviewError('corrupt', '工作区审阅文件无法解析')
    throw error
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

/** Write one document atomically. */
async function writeReview(root, state) {
  const file = reviewFile(root)
  const text = serializeReview(state)
  if (Buffer.byteLength(text, 'utf8') > REVIEW_MAX_BYTES) {
    throw new ReviewError('too-large', '审阅状态超过 1 MiB；请清理旧的基线或已审标记后重试')
  }
  await ensureStateDirectory(root)
  await assertReviewFile(root)
  const temporary = path.join(
    stateDirectory(root),
    `.review-${String(process.pid)}-${String(Date.now())}-${randomUUID()}.tmp`,
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

/** Environment shared by every git call: no prompts, no pager, inherited GIT_* removed. */
function gitEnvironment() {
  const env = {
    ...process.env,
    GIT_TERMINAL_PROMPT: '0',
    GIT_PAGER: 'cat',
    GIT_OPTIONAL_LOCKS: '0',
    GIT_EDITOR: 'true',
    GIT_SEQUENCE_EDITOR: 'true',
    GIT_ASKPASS: 'true',
    GIT_MERGE_AUTOEDIT: 'no',
    LC_ALL: 'C',
  }
  for (const key of [
    'GIT_DIR',
    'GIT_WORK_TREE',
    'GIT_INDEX_FILE',
    'GIT_OBJECT_DIRECTORY',
    'GIT_ALTERNATE_OBJECT_DIRECTORIES',
    'GIT_COMMON_DIR',
    'GIT_NAMESPACE',
  ]) {
    delete env[key]
  }
  return env
}

/**
 * Run one git command in the workspace root without throwing.
 * @param root - absolute workspace root.
 * @param args - git arguments (`--no-optional-locks` included by each caller).
 * @returns `{ ok, stdout, stderr, code }`; `code` is `'git-missing'` when git is absent.
 */
async function runGit(root, args) {
  try {
    const result = await execFileAsync('git', args, {
      cwd: root,
      timeout: GIT_TIMEOUT_MS,
      maxBuffer: GIT_MAX_BUFFER,
      windowsHide: true,
      env: gitEnvironment(),
    })
    return { ok: true, stdout: result.stdout, stderr: result.stderr, code: '' }
  } catch (error) {
    if (error !== null && typeof error === 'object' && error.code === 'ENOENT') {
      return { ok: false, stdout: '', stderr: 'git executable not found', code: 'git-missing' }
    }
    if (error !== null && typeof error === 'object' && error.killed === true) {
      return { ok: false, stdout: '', stderr: 'git command timed out', code: 'git-timeout' }
    }
    const stdout = error !== null && typeof error === 'object' && typeof error.stdout === 'string' ? error.stdout : ''
    const stderr = error !== null && typeof error === 'object' && typeof error.stderr === 'string' ? error.stderr : ''
    return { ok: false, stdout, stderr: (stderr || stdout).slice(0, 4000), code: 'git-failed' }
  }
}

/**
 * Whether the workspace is a git checkout whose root is the workspace itself.
 * A workspace inside a larger repository is rejected (`not-repo-root`) because
 * porcelain paths would be relative to the repository root, not to the
 * workspace.
 */
async function inspectRepo(root) {
  const result = await runGit(root, ['--no-optional-locks', 'rev-parse', '--show-toplevel'])
  if (!result.ok) {
    return { repo: false, reason: result.code === 'git-missing' ? 'git-missing' : 'not-git' }
  }
  const top = result.stdout.trim()
  if (top.length === 0) return { repo: false, reason: 'not-git' }
  let realTop
  let realRoot
  try {
    realTop = await fsp.realpath(top)
    realRoot = await fsp.realpath(root)
  } catch {
    return { repo: false, reason: 'not-git' }
  }
  if (realTop !== realRoot) return { repo: false, reason: 'not-repo-root' }
  return { repo: true, reason: '' }
}

/** Read the current HEAD commit, or an empty string for an unborn branch. */
async function readHead(root) {
  const result = await runGit(root, ['--no-optional-locks', 'rev-parse', 'HEAD'])
  return result.ok ? result.stdout.trim().slice(0, 100) : ''
}

/**
 * Parse `git status --porcelain=v1 -z` output into entries. The shape mirrors
 * the Git component (`dsh-web-filebrowser-git/index.js:parseStatus`) so the
 * change signature matches what the Git panel computes in the browser.
 */
function parseStatus(raw) {
  const records = String(raw ?? '').split('\u0000')
  const entries = []
  let truncated = false
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]
    if (record.length === 0) continue
    if (record.startsWith('## ')) continue
    if (record.length < 3) continue
    const x = record[0]
    const y = record[1]
    if (x === '!' && y === '!') continue
    const untracked = x === '?' && y === '?'
    const file = record.slice(3)
    if (file.length === 0) continue
    let oldPath = null
    if (!untracked && (x === 'R' || x === 'C' || y === 'R' || y === 'C')) {
      oldPath = records[index + 1] ?? null
      index += 1
    }
    const staged = !untracked && x !== ' '
    const unstaged = !untracked && y !== ' '
    const conflict = x === 'U' || y === 'U' || (x === 'A' && y === 'A') || (x === 'D' && y === 'D')
    const status = untracked ? 'U' : conflict ? '!' : x !== ' ' ? x : y
    entries.push({ path: file, status, staged, unstaged, untracked, ...(oldPath === null ? {} : { oldPath }) })
    if (entries.length >= MAX_STATUS_ENTRIES) {
      truncated = true
      break
    }
  }
  return { entries, truncated }
}

/** Read the current git status; a failed call yields an empty snapshot. */
async function readStatus(root) {
  const result = await runGit(root, [
    '--no-optional-locks',
    'status',
    '--porcelain=v1',
    '-z',
    '--untracked-files=all',
  ])
  if (!result.ok || result.stdout.length > MAX_STATUS_BYTES) return { entries: [], truncated: true, ok: false }
  return { ...parseStatus(result.stdout), ok: true }
}

/**
 * The review signature of one status entry. Kept byte-compatible with the
 * browser's `reviewSignature(entry)` (`client.js:3574-3576`) so a mark made in
 * either half lapses under exactly the same conditions.
 */
export function reviewSignature(entry) {
  const source = entry !== null && typeof entry === 'object' ? entry : {}
  return `${source.status ?? ''}|${source.staged === true ? '1' : '0'}|${source.unstaged === true ? '1' : '0'}|${source.untracked === true ? '1' : '0'}`
}

/** Build a map path -> signature for a status snapshot. */
function signatureMap(entries) {
  const map = new Map()
  for (const entry of entries) map.set(entry.path, reviewSignature(entry))
  return map
}

/** Read one `git diff --numstat` call into a path -> `{added, deleted}` map. */
async function numstatMap(root, extraArgs) {
  const result = await runGit(root, ['--no-optional-locks', 'diff', ...extraArgs, '--numstat', '--no-renames', '--'])
  const map = new Map()
  if (!result.ok) return map
  for (const line of result.stdout.split('\n')) {
    if (line.length === 0) continue
    const parts = line.split('\t')
    if (parts.length < 3) continue
    const added = parts[0] === '-' ? null : Number(parts[0])
    const deleted = parts[1] === '-' ? null : Number(parts[1])
    if (!Number.isFinite(added) && !Number.isFinite(deleted)) continue
    const file = parts.slice(2).join('\t')
    const previous = map.get(file) ?? { added: 0, deleted: 0 }
    if (Number.isFinite(added)) previous.added += added
    if (Number.isFinite(deleted)) previous.deleted += deleted
    map.set(file, previous)
  }
  return map
}

/** Combined staged + unstaged line counts for every tracked changed file. */
async function diffStats(root) {
  const [unstaged, staged] = await Promise.all([
    numstatMap(root, []),
    numstatMap(root, ['--cached']),
  ])
  const merged = new Map()
  for (const source of [unstaged, staged]) {
    for (const [file, stat] of source) {
      const previous = merged.get(file) ?? { added: 0, deleted: 0 }
      previous.added += stat.added
      previous.deleted += stat.deleted
      merged.set(file, previous)
    }
  }
  return merged
}

/** Best-effort line count for one untracked file (bounded read). */
async function untrackedLineCount(root, relative) {
  try {
    const absolute = path.resolve(root, ...relative.replaceAll('\\', '/').split('/'))
    if (!isInsideRoot(root, absolute)) return null
    const info = await fsp.stat(absolute)
    if (!info.isFile() || info.size > MAX_UNTRACKED_BYTES) return null
    const text = await fsp.readFile(absolute, 'utf8')
    if (text.length === 0) return { added: 0, deleted: 0 }
    const lines = text.split('\n')
    const added = text.endsWith('\n') ? lines.length - 1 : lines.length
    return { added, deleted: 0 }
  } catch {
    return null
  }
}

/** Normalize an optional stage id argument. */
function stageIdValue(value) {
  if (value === undefined || value === null || value === '') return ''
  if (!REVIEW_STAGE_IDS.includes(value)) {
    throw new ReviewError('bad-stage', `未知的阶段标识，必须是 ${REVIEW_STAGE_IDS.join(' / ')} 之一`)
  }
  return value
}

/** Normalize an optional round argument (0 means "no explicit round"). */
function roundValue(value, fallback = 0) {
  if (value === undefined || value === null || value === 0) return fallback
  if (!Number.isInteger(value) || value < 0) {
    throw new ReviewError('bad-round', 'round 必须是正整数')
  }
  return value
}

/** Find the stored baseline for one stage/round (latest round when round is 0). */
function resolveBaseline(state, stageId, round) {
  if (stageId.length === 0) return null
  if (round > 0) {
    const baseline = state.baselines[`${String(round)}:${stageId}`]
    return baseline === undefined ? null : baseline
  }
  let best = null
  for (const baseline of Object.values(state.baselines)) {
    if (baseline.stageId !== stageId) continue
    if (best === null || baseline.round > best.round) best = baseline
  }
  return best
}

/** Public baseline metadata (the stored status list stays on the Host). */
function publicBaseline(baseline) {
  if (baseline === null) return null
  return {
    at: baseline.at,
    stageId: baseline.stageId,
    round: baseline.round,
    supported: baseline.supported,
    head: baseline.head,
    statusCount: baseline.status.length,
  }
}

/** Map one status entry to the public file row. */
function publicFile(entry, mark, stat) {
  const sig = reviewSignature(entry)
  return {
    path: entry.path,
    status: entry.status,
    sig,
    reviewed: mark !== undefined && mark.sig === sig,
    ...(stat === null || stat === undefined ? {} : { added: stat.added, deleted: stat.deleted }),
  }
}

/**
 * Compute the review snapshot for one workspace against one state document.
 *
 * @param workspace - absolute local workspace root.
 * @param state - normalized review document.
 * @param options - `{ stageId, round }`.
 * @returns the snapshot returned by `readReviewState` (and by the write ops).
 */
async function buildReviewState(workspace, state, options) {
  const stageId = stageIdValue(options?.stageId)
  const round = roundValue(options?.round, 0)
  const repo = await inspectRepo(workspace)
  if (!repo.repo) {
    return {
      available: false,
      supported: false,
      reason: repo.reason,
      stageId,
      round,
      baseline: null,
      files: [],
      reviewed: 0,
      total: 0,
      marks: Object.keys(state.marks).length,
      truncated: false,
    }
  }
  const status = await readStatus(workspace)
  const baseline = resolveBaseline(state, stageId, round)
  const useBaseline = baseline !== null && baseline.supported === true
  const baselineMap = useBaseline ? signatureMap(baseline.status) : null
  const changes = []
  for (const entry of status.entries) {
    if (baselineMap === null) {
      changes.push(entry)
      continue
    }
    if (baselineMap.get(entry.path) !== reviewSignature(entry)) changes.push(entry)
  }
  const stats = await diffStats(workspace)
  let untrackedBudget = MAX_UNTRACKED_STATS
  const files = []
  for (const entry of changes.slice(0, REVIEW_MAX_FILES)) {
    let stat = stats.get(entry.path) ?? null
    if (stat === null && entry.untracked && untrackedBudget > 0) {
      untrackedBudget -= 1
      stat = await untrackedLineCount(workspace, entry.path)
    }
    files.push(publicFile(entry, state.marks[entry.path], stat))
  }
  files.sort((left, right) => left.path.localeCompare(right.path))
  const reviewed = files.reduce((count, file) => count + (file.reviewed ? 1 : 0), 0)
  return {
    available: true,
    supported: true,
    reason: '',
    stageId: baseline === null ? stageId : baseline.stageId,
    round: baseline === null ? round : baseline.round,
    baseline: publicBaseline(baseline),
    files,
    reviewed,
    total: files.length,
    marks: Object.keys(state.marks).length,
    truncated: status.truncated === true || changes.length > REVIEW_MAX_FILES,
  }
}

/**
 * Capture the change baseline for one pipeline stage.
 *
 * A git workspace stores `HEAD` plus the porcelain status snapshot; a local
 * non-git workspace stores `{supported:false}` so the reader can report the
 * reason instead of failing. SSH roots return `ssh-unsupported` and write
 * nothing (there is no local `.dsh`).
 *
 * @param root - workspace root (local absolute path or `ssh://…`).
 * @param input - `{ stageId, round? }`.
 * @returns `{ available, supported, reason, stageId, round, baseline }`.
 */
export async function captureStageBaseline(root, input) {
  if (isSshRoot(root)) {
    return {
      available: false,
      supported: false,
      reason: 'ssh-unsupported',
      stageId: typeof input?.stageId === 'string' ? input.stageId : '',
      round: Number.isInteger(input?.round) && input.round > 0 ? input.round : 1,
      baseline: null,
    }
  }
  const workspace = localRoot(root)
  const stageId = stageIdValue(input?.stageId)
  if (stageId.length === 0) throw new ReviewError('bad-stage', 'captureStageBaseline 需要 stageId')
  const round = roundValue(input?.round, 1)
  const repo = await inspectRepo(workspace)
  const at = Date.now()
  const baseline = repo.repo
    ? {
        at,
        stageId,
        round,
        supported: true,
        head: await readHead(workspace),
        status: (await readStatus(workspace)).entries,
      }
    : { at, stageId, round, supported: false, head: '', status: [] }
  const key = `${String(round)}:${stageId}`
  await withMutationLock(workspace, async () => {
    const state = await readReview(workspace)
    state.baselines[key] = baseline
    const keys = Object.keys(state.baselines)
    if (keys.length > REVIEW_MAX_BASELINES) {
      const ordered = keys
        .map((candidate) => ({ key: candidate, at: state.baselines[candidate].at }))
        .sort((left, right) => left.at - right.at)
      for (const stale of ordered.slice(0, ordered.length - REVIEW_MAX_BASELINES)) delete state.baselines[stale.key]
    }
    state.updatedAt = at
    await writeReview(workspace, state)
  })
  return {
    available: repo.repo,
    supported: repo.repo,
    reason: repo.reason,
    stageId,
    round,
    baseline: publicBaseline(baseline),
  }
}

/**
 * Read the review state for one workspace.
 *
 * Without a baseline the whole current status is returned (so the caller can
 * still review the worktree); with a baseline the list only contains files that
 * were added or whose signature changed since the stage started. Non-git and
 * SSH roots degrade to `available:false` instead of throwing.
 *
 * @param root - workspace root.
 * @param options - `{ stageId?, round? }`; omit both to read the full status.
 * @returns `{ available, supported, reason, stageId, round, baseline, files,
 *   reviewed, total, marks, truncated }`.
 */
export async function readReviewState(root, options = {}) {
  if (isSshRoot(root)) {
    return {
      available: false,
      supported: false,
      reason: 'ssh-unsupported',
      stageId: '',
      round: 0,
      baseline: null,
      files: [],
      reviewed: 0,
      total: 0,
      marks: 0,
      truncated: false,
    }
  }
  const workspace = localRoot(root)
  const state = await readReview(workspace)
  return buildReviewState(workspace, state, options)
}

/**
 * Mark one changed file as reviewed.
 *
 * The signature defaults to the file's current status; an explicit `sig` lets a
 * caller persist the exact change it reviewed. A further edit changes the
 * signature and the mark lapses. Non-git and SSH roots return
 * `available:false` without writing.
 *
 * @param root - workspace root.
 * @param input - `{ path, sig?, stageId?, round? }`.
 * @returns `{ available, reason, mark, cleared?, marks, state }`.
 */
export async function markReviewed(root, input) {
  if (isSshRoot(root)) {
    return {
      available: false,
      supported: false,
      reason: 'ssh-unsupported',
      mark: null,
      marks: 0,
      state: await readReviewState(root, input),
    }
  }
  const workspace = localRoot(root)
  const markPath = normalizeMarkPath(input?.path)
  if (markPath === null) {
    throw new ReviewError('bad-path', 'path 必须是工作区内的相对路径')
  }
  const stageId = stageIdValue(input?.stageId)
  const round = roundValue(input?.round, 0)
  const repo = await inspectRepo(workspace)
  if (!repo.repo) {
    return {
      available: false,
      supported: false,
      reason: repo.reason,
      mark: null,
      marks: 0,
      state: await buildReviewState(workspace, await readReview(workspace), { stageId, round }),
    }
  }
  const status = await readStatus(workspace)
  const entry = status.entries.find((candidate) => candidate.path === markPath)
  const currentSig = entry === undefined ? '' : reviewSignature(entry)
  const provided = typeof input?.sig === 'string' ? input.sig.trim().slice(0, REVIEW_MAX_SIG) : ''
  if (provided.length === 0 && currentSig.length === 0) {
    throw new ReviewError(
      'not-dirty',
      '该文件当前没有未提交变更，无法标记已审；请刷新 Git 状态后再试',
    )
  }
  const mark = {
    sig: provided.length > 0 ? provided : currentSig,
    at: Date.now(),
    stageId,
    round,
  }
  let state
  await withMutationLock(workspace, async () => {
    const current = await readReview(workspace)
    current.marks[markPath] = mark
    const entries = Object.entries(current.marks)
    if (entries.length > REVIEW_MAX_MARKS) {
      const ordered = entries.sort((left, right) => right[1].at - left[1].at)
      current.marks = Object.fromEntries(ordered.slice(0, REVIEW_MAX_MARKS))
    }
    current.updatedAt = mark.at
    await writeReview(workspace, current)
    state = current
  })
  return {
    available: true,
    supported: true,
    reason: '',
    mark: { path: markPath, ...mark },
    marks: Object.keys(state.marks).length,
    state: await buildReviewState(workspace, state, { stageId, round }),
  }
}

/**
 * Clear one review mark, or every mark when `path` is omitted.
 *
 * @param root - workspace root.
 * @param input - `{ path? }`.
 * @returns `{ available, supported, reason, cleared, marks, state }`.
 */
export async function clearReviewed(root, input = {}) {
  if (isSshRoot(root)) {
    return {
      available: false,
      supported: false,
      reason: 'ssh-unsupported',
      cleared: [],
      marks: 0,
      state: await readReviewState(root, input),
    }
  }
  const workspace = localRoot(root)
  const stageId = stageIdValue(input?.stageId)
  const round = roundValue(input?.round, 0)
  let target = null
  if (input?.path !== undefined && input?.path !== null) {
    target = normalizeMarkPath(input.path)
    if (target === null) throw new ReviewError('bad-path', 'path 必须是工作区内的相对路径')
  }
  let state
  let cleared = []
  await withMutationLock(workspace, async () => {
    const current = await readReview(workspace)
    if (target === null) {
      cleared = Object.keys(current.marks)
      current.marks = {}
    } else if (Object.prototype.hasOwnProperty.call(current.marks, target)) {
      cleared = [target]
      delete current.marks[target]
    }
    current.updatedAt = Date.now()
    if (cleared.length > 0) await writeReview(workspace, current)
    state = current
  })
  const repo = await inspectRepo(workspace)
  return {
    available: repo.repo,
    supported: repo.repo,
    reason: repo.reason,
    cleared,
    marks: Object.keys(state.marks).length,
    state: await buildReviewState(workspace, state, { stageId, round }),
  }
}
