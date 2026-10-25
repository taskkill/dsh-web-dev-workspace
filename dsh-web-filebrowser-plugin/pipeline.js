/**
 * Per-workspace delivery pipeline state.
 *
 * The delivery flow is: 产品经理（product）→ UI 设计师（design）→ 全栈开发
 * （development）→ 测试工程师（testing）→ 项目经理人工确认（approval）→
 * 运维发布（release）. This module owns one small JSON document inside each
 * workspace root (`.dsh/pipeline.json`) so the browser panel, the generated
 * delivery report and the model tools all read the same state — and no
 * workspace can see another workspace's pipeline.
 *
 * Two consumers share the store:
 * - Host tools (`pipeline_status` / `pipeline_stage_prompt` /
 *   `pipeline_set_requirement` / `pipeline_start_stage` /
 *   `pipeline_submit_stage`) let the model act inside one stage: read the
 *   current state, learn the role boundaries, write the requirement, start a
 *   stage and submit it for review.
 * - The Host file API exposes the same document to the browser panel, which
 *   performs the human approval gate (`reviewStage`) and records releases
 *   (`recordRelease`). The model deliberately has no review tool: it must not
 *   approve its own work.
 *
 * Multi-agent execution itself is not implemented here. The Lead uses the
 * Harness native team tools (`spawn_teammate` / `team_task_*`) to run the roles;
 * this module only stores stage state and enforces the approval gates.
 *
 * Files are written with a temp-file rename under a per-root in-process lock so
 * a tool call and a panel action cannot clobber each other. A generated
 * `.dsh/.gitignore` keeps the state out of Git by default.
 */

import { randomUUID } from 'node:crypto'
import { promises as fsp } from 'node:fs'
import path from 'node:path'
import { resolveAgentWorkspace } from './memory.js'
import { isSshRoot } from './ssh.js'

/** Directory created inside a workspace for plugin-owned state. */
export const PIPELINE_DIRNAME = '.dsh'

/** File name holding one workspace's delivery pipeline document. */
export const PIPELINE_FILENAME = 'pipeline.json'

/** Document format version. */
export const PIPELINE_VERSION = 1

/**
 * The fixed delivery stages, in execution order. `role` is the machine role
 * key, `roleTitle` the Chinese role name shown to the owner and `title` the
 * stage name.
 */
export const PIPELINE_STAGES = [
  { id: 'product', role: 'product-manager', roleTitle: '产品经理', title: '需求分析' },
  { id: 'design', role: 'ui-designer', roleTitle: 'UI 设计师', title: 'UI 设计' },
  { id: 'development', role: 'fullstack-developer', roleTitle: '全栈开发', title: '开发实现' },
  { id: 'testing', role: 'qa-engineer', roleTitle: '测试工程师', title: '测试验收' },
  { id: 'approval', role: 'project-manager', roleTitle: '项目经理', title: '人工确认' },
  { id: 'release', role: 'devops', roleTitle: '运维', title: '发布上线' },
]

/** Accepted stage statuses; only `pending` and `failed` can be started. */
export const PIPELINE_STATUSES = ['pending', 'active', 'review', 'approved', 'failed']

/** Gate modes: normal asks the owner for every stage; fast auto-approves intermediate ones. */
export const PIPELINE_GATE_MODES = ['normal', 'fast']

/** Scope of a change round: full pipeline, code/config only, or release only. */
export const PIPELINE_CHANGE_SCOPES = ['full', 'development', 'release']

/** Stages skipped by each change scope. */
const CHANGE_SKIP_STAGES = {
  full: [],
  development: ['product', 'design'],
  release: ['product', 'design', 'development', 'testing'],
}

/** Human note written on skipped stages. */
function skipNote(scope) {
  if (scope === 'development') return '跳过：本次变更仅涉及代码/配置调整'
  if (scope === 'release') return '跳过：本次变更仅调整发布物'
  return ''
}

/** Hard bounds; the model receives them in validation errors and stage prompts. */
export const PIPELINE_MAX_ARTIFACTS = 20
export const PIPELINE_MAX_SUMMARY = 4_000
export const PIPELINE_MAX_NOTE = 4_000
export const PIPELINE_MAX_PATH = 500
export const PIPELINE_MAX_RELEASES = 100
export const PIPELINE_MAX_BYTES = 1_024 * 1_024
export const PIPELINE_MAX_TITLE = 500
export const PIPELINE_MAX_DETAIL = 20_000

/** Optional artifact label bound (kept small: labels are one-line captions). */
const PIPELINE_MAX_LABEL = 200

/** Release environment name bound. */
const PIPELINE_MAX_ENVIRONMENT = 200

/** Prompt section name and ordering (right after the workspace-acceptance guide). */
const SECTION_NAME = 'dsh-web-filebrowser:delivery-pipeline-guide'
const SECTION_ORDER = 2387

/** Machine stage ids in execution order. */
const PIPELINE_STAGE_IDS = PIPELINE_STAGES.map((stage) => stage.id)

/** Lookup from stage id to its definition plus fixed position. */
const STAGE_INDEX = new Map(PIPELINE_STAGES.map((stage, index) => [stage.id, { ...stage, index }]))

/** Chinese label for each stage status, used by prompts and reports. */
const STAGE_STATUS_LABELS = {
  pending: '待开始',
  active: '进行中',
  review: '待项目经理审批',
  approved: '已通过',
  failed: '已驳回，修复后需重新开始',
}

/** Compact upper-case mark for model-facing tool text. */
const STAGE_STATUS_MARKS = {
  pending: 'PENDING',
  active: 'ACTIVE',
  review: 'REVIEW',
  approved: 'APPROVED',
  failed: 'FAILED',
}

/** Model-facing guidance folded into the system prompt for workspace sessions. */
export const PIPELINE_SECTION = `## 交付流水线（六阶段 + 人工闸门）

本工作区把交付过程保存在 \`.dsh/pipeline.json\`，阶段顺序固定为：产品经理（需求分析）→ UI 设计师（UI 设计）→ 全栈开发（开发实现）→ 测试工程师（测试验收）→ 项目经理（人工确认）→ 运维（发布上线）。阶段状态为 pending / active / review / approved / failed。product 阶段开始前必须先有需求标题与详情；除 product 外，每个阶段开始前要求上一阶段 approved；提交评审后阶段通常变为 review，只有项目经理（owner）在 Dev Workspace 面板上 approve 后下一阶段才能开始，被 reject 会变成 failed，可修复后用 pipeline_start_stage 重新开始。如果 Owner 开启了「快速模式」（gateMode=fast），product/design/development/testing 四个中间阶段提交后会被自动通过：pipeline_submit_stage 的结果会带 autoApproved=true 与 nextStageId，此时不要等待人工审批，直接对 nextStageId 取 pipeline_stage_prompt、pipeline_start_stage 并继续工作；approval 与 release 永远保持人工闸门，快速模式也不会自动通过它们。approval 是人工闸门：模型只负责启动它，绝不允许自己审批；release 阶段必须在 approval approved 之后才能开始。

工具用法：用 \`pipeline_status\` 查看需求、六个阶段、当前阶段与发布记录；进入某个阶段前先用 \`pipeline_stage_prompt\` 取该角色的中文提示词（需求、上游摘要与产物、本角色只做什么/不做什么、交付物要求、闸门规则），按提示词工作；用 \`pipeline_set_requirement\` 写入需求；用 \`pipeline_start_stage\` 开始阶段；完成后用 \`pipeline_submit_stage\` 提交 summary 与 artifacts 等待项目经理审批。不要编造审批结果，也不要在闸门未通过时开始下一阶段。验收标准请配合 \`acceptance_add\` / \`acceptance_update\` 维护，交付前逐项核对。

真正的多角色执行由 Lead 用 Harness 原生团队工具（\`spawn_teammate\` / \`team_task_*\`）组织：本插件只负责流水线状态与人工验收闸门，不替代团队通信。流水线状态只保存在本地工作区，SSH 远程工作区暂不支持。`

/** A structured, caller-facing failure with a stable machine code. */
export class PipelineError extends Error {
  /**
   * @param code - stable machine-readable code.
   * @param message - human-readable explanation.
   */
  constructor(code, message) {
    super(message)
    this.name = 'PipelineError'
    this.code = code
    // The Host request handler maps this field onto the API error envelope.
    this.sideCode = code
  }
}

/** An empty delivery pipeline document with all six stages pending. */
export function emptyPipeline() {
  return {
    version: PIPELINE_VERSION,
    updatedAt: 0,
    requirement: { title: '', detail: '', updatedAt: 0 },
    stages: PIPELINE_STAGES.map((stage) => ({
      id: stage.id,
      status: 'pending',
      startedAt: 0,
      submittedAt: 0,
      reviewedAt: 0,
      summary: '',
      note: '',
      artifacts: [],
    })),
    releases: [],
    settings: { gateMode: 'normal' },
    round: 1,
    changes: [],
    history: [],
    requirementLog: [],
    roundScope: 'full',
  }
}

/** Absolute path of one workspace's delivery pipeline document. */
export function pipelineFile(root) {
  return path.join(path.resolve(root), PIPELINE_DIRNAME, PIPELINE_FILENAME)
}

/** Absolute path of the plugin state directory inside one workspace. */
function stateDirectory(root) {
  return path.join(path.resolve(root), PIPELINE_DIRNAME)
}

/** Reject a root that could escape the caller's workspace containment. */
function assertRoot(root) {
  if (typeof root !== 'string' || root.length === 0) {
    throw new PipelineError('bad-root', '工作区根目录必须是绝对路径')
  }
  if (isSshRoot(root)) {
    throw new PipelineError('ssh-unsupported', 'SSH 远程工作区暂不支持本地交付流水线')
  }
  if (!path.isAbsolute(root)) {
    throw new PipelineError('bad-root', '工作区根目录必须是绝对路径')
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
    throw new PipelineError('outside-root', '工作区流水线目录指向工作区之外，已拒绝访问')
  }
}

/** Refuse a pipeline file that is a symlink or resolves outside the workspace. */
async function assertPipelineFile(root) {
  await assertStateDirectory(root)
  const file = pipelineFile(root)
  let info
  try {
    info = await fsp.lstat(file)
  } catch (error) {
    if (error !== null && typeof error === 'object' && error.code === 'ENOENT') return
    throw error
  }
  if (info.isSymbolicLink()) {
    throw new PipelineError('unsafe', '工作区流水线文件是符号链接，已拒绝访问')
  }
  let real
  try {
    real = await fsp.realpath(file)
  } catch (error) {
    if (error !== null && typeof error === 'object' && error.code === 'ENOENT') return
    throw error
  }
  if (!isInsideRoot(root, real)) {
    throw new PipelineError('outside-root', '工作区流水线文件指向工作区之外，已拒绝访问')
  }
}

/** Resolve one stage definition by id, rejecting unknown ids. */
function stageDefinition(value) {
  const id = typeof value === 'string' ? value.trim() : ''
  const definition = STAGE_INDEX.get(id)
  if (definition === undefined) {
    throw new PipelineError('bad-stage', `未知的阶段标识，必须是 ${PIPELINE_STAGE_IDS.join(' / ')} 之一`)
  }
  return definition
}

/**
 * Find one normalized stage in a document; normalization guarantees it exists.
 * @param doc - normalized pipeline document.
 * @param definition - stage definition returned by `stageDefinition`.
 * @returns the stage record.
 */
function documentStage(doc, definition) {
  const stage = doc.stages[definition.index]
  if (stage === undefined || stage.id !== definition.id) {
    throw new PipelineError('not-found', `交付流水线文档缺少阶段 ${definition.id}`)
  }
  return stage
}

/** Coerce a stored timestamp to a safe epoch-millisecond number. */
function timestampValue(value) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}

/** Normalize one stored artifact; malformed entries are dropped. */
function normalizeStoredArtifact(value) {
  if (typeof value === 'string') {
    const artifactPath = value.trim().slice(0, PIPELINE_MAX_PATH)
    return artifactPath.length === 0 ? null : { path: artifactPath, label: '' }
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const artifactPath = typeof value.path === 'string' ? value.path.trim().slice(0, PIPELINE_MAX_PATH) : ''
  if (artifactPath.length === 0) return null
  const label = typeof value.label === 'string' ? value.label.trim().slice(0, PIPELINE_MAX_LABEL) : ''
  return { path: artifactPath, label }
}

/** Normalize a stored artifact array, capping the count. */
function normalizeStoredArtifacts(value) {
  if (!Array.isArray(value)) return []
  const artifacts = []
  for (const candidate of value) {
    if (artifacts.length >= PIPELINE_MAX_ARTIFACTS) break
    const artifact = normalizeStoredArtifact(candidate)
    if (artifact !== null) artifacts.push(artifact)
  }
  return artifacts
}

/** Normalize one stored stage, falling back to an empty pending stage. */
function normalizeStoredStage(value, definition) {
  const source = value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {}
  return {
    id: definition.id,
    status: PIPELINE_STATUSES.includes(source.status) ? source.status : 'pending',
    startedAt: timestampValue(source.startedAt),
    submittedAt: timestampValue(source.submittedAt),
    reviewedAt: timestampValue(source.reviewedAt),
    summary: typeof source.summary === 'string' ? source.summary.trim().slice(0, PIPELINE_MAX_SUMMARY) : '',
    note: typeof source.note === 'string' ? source.note.trim().slice(0, PIPELINE_MAX_NOTE) : '',
    artifacts: normalizeStoredArtifacts(source.artifacts),
  }
}

/** Normalize one stored release record; malformed entries are dropped. */
function normalizeStoredRelease(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const environment = typeof value.environment === 'string' ? value.environment.trim().slice(0, PIPELINE_MAX_ENVIRONMENT) : ''
  if (environment.length === 0) return null
  return {
    environment,
    url: typeof value.url === 'string' ? value.url.trim().slice(0, PIPELINE_MAX_PATH) : '',
    notes: typeof value.notes === 'string' ? value.notes.trim().slice(0, PIPELINE_MAX_NOTE) : '',
    createdAt: timestampValue(value.createdAt),
  }
}

/** Newest release first; records created in the same millisecond keep insertion order. */
function compareReleases(left, right) {
  return right.createdAt - left.createdAt
}

/** Normalize a parsed document into the canonical pipeline shape. */
function normalizeStoredState(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new PipelineError('corrupt', '工作区交付流水线文件格式无效')
  }
  const requirementSource =
    value.requirement !== null && typeof value.requirement === 'object' && !Array.isArray(value.requirement)
      ? value.requirement
      : {}
  const requirement = {
    title:
      typeof requirementSource.title === 'string'
        ? requirementSource.title.trim().slice(0, PIPELINE_MAX_TITLE)
        : '',
    detail:
      typeof requirementSource.detail === 'string'
        ? requirementSource.detail.trim().slice(0, PIPELINE_MAX_DETAIL)
        : '',
    updatedAt: timestampValue(requirementSource.updatedAt),
  }
  const storedStages = Array.isArray(value.stages) ? value.stages : []
  const byId = new Map()
  for (const candidate of storedStages) {
    if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) continue
    if (!STAGE_INDEX.has(candidate.id) || byId.has(candidate.id)) continue
    byId.set(candidate.id, candidate)
  }
  const stages = PIPELINE_STAGES.map((definition) => normalizeStoredStage(byId.get(definition.id), definition))
  const releases = []
  for (const candidate of Array.isArray(value.releases) ? value.releases : []) {
    const release = normalizeStoredRelease(candidate)
    if (release !== null) releases.push(release)
  }
  releases.sort(compareReleases)
  const settingsSource =
    value.settings !== null && typeof value.settings === 'object' && !Array.isArray(value.settings) ? value.settings : {}
  const settings = {
    gateMode: PIPELINE_GATE_MODES.includes(settingsSource.gateMode) ? settingsSource.gateMode : 'normal',
  }
  const round = Number.isInteger(value.round) && value.round > 0 ? value.round : 1
  const changes = []
  for (const candidate of Array.isArray(value.changes) ? value.changes : []) {
    if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) continue
    const title = typeof candidate.title === 'string' ? candidate.title.trim().slice(0, PIPELINE_MAX_TITLE) : ''
    if (title.length === 0) continue
    changes.push({
      round: Number.isInteger(candidate.round) && candidate.round > 0 ? candidate.round : round,
      title,
      detail: typeof candidate.detail === 'string' ? candidate.detail.trim().slice(0, PIPELINE_MAX_DETAIL) : '',
      scope: PIPELINE_CHANGE_SCOPES.includes(candidate.scope) ? candidate.scope : 'full',
      createdAt: timestampValue(candidate.createdAt),
    })
  }
  const history = []
  for (const candidate of Array.isArray(value.history) ? value.history : []) {
    if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) continue
    const snapshotRequirement =
      candidate.requirement !== null && typeof candidate.requirement === 'object' && !Array.isArray(candidate.requirement)
        ? candidate.requirement
        : {}
    const snapshotTitle =
      typeof snapshotRequirement.title === 'string' ? snapshotRequirement.title.trim().slice(0, PIPELINE_MAX_TITLE) : ''
    if (snapshotTitle.length === 0) continue
    history.push({
      round: Number.isInteger(candidate.round) && candidate.round > 0 ? candidate.round : round,
      title: snapshotTitle,
      detail: typeof snapshotRequirement.detail === 'string' ? snapshotRequirement.detail.trim().slice(0, PIPELINE_MAX_DETAIL) : '',
      completedAt: timestampValue(candidate.completedAt),
      stages: (Array.isArray(candidate.stages) ? candidate.stages : [])
        .filter((stage) => stage !== null && typeof stage === 'object' && STAGE_INDEX.has(stage.id))
        .map((stage) => ({
          id: stage.id,
          status: typeof stage.status === 'string' ? stage.status : 'approved',
          summary: typeof stage.summary === 'string' ? stage.summary.slice(0, PIPELINE_MAX_SUMMARY) : '',
          reviewedAt: timestampValue(stage.reviewedAt),
        })),
    })
  }
  const roundScope = PIPELINE_CHANGE_SCOPES.includes(value.roundScope) ? value.roundScope : 'full'
  const requirementLog = []
  for (const candidate of Array.isArray(value.requirementLog) ? value.requirementLog : []) {
    if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) continue
    const text = typeof candidate.detail === 'string' ? candidate.detail.trim().slice(0, PIPELINE_MAX_DETAIL) : ''
    const title = typeof candidate.title === 'string' ? candidate.title.trim().slice(0, PIPELINE_MAX_TITLE) : ''
    const type = ['initial', 'append', 'refine', 'change', 'edit'].includes(candidate.type) ? candidate.type : 'refine'
    if (text.length === 0 && title.length === 0) continue
    requirementLog.push({
      id: typeof candidate.id === 'string' && candidate.id.length > 0 ? candidate.id : randomUUID(),
      type,
      title,
      detail: text,
      createdAt: timestampValue(candidate.createdAt),
    })
  }
  return {
    version: PIPELINE_VERSION,
    updatedAt: timestampValue(value.updatedAt),
    requirement,
    stages,
    releases: releases.slice(0, PIPELINE_MAX_RELEASES),
    settings,
    round,
    changes: changes.slice(0, 50),
    history: history.slice(0, 10),
    requirementLog: requirementLog.slice(0, 50),
    roundScope,
  }
}

/** Parse one document and normalize it. */
function parsePipeline(text, file) {
  let value
  try {
    value = JSON.parse(text)
  } catch {
    throw new PipelineError('corrupt', `工作区交付流水线文件无法解析：${file}`)
  }
  return normalizeStoredState(value)
}

/** Serialize one document with a trailing newline. */
function serializePipeline(doc) {
  return `${JSON.stringify(
    {
      version: PIPELINE_VERSION,
      updatedAt: doc.updatedAt,
      requirement: doc.requirement,
      stages: doc.stages,
      releases: doc.releases,
      settings: doc.settings,
      round: doc.round ?? 1,
      changes: doc.changes ?? [],
      history: doc.history ?? [],
      requirementLog: doc.requirementLog ?? [],
      roundScope: doc.roundScope ?? 'full',
    },
    null,
    2,
  )}\n`
}

/** Read one workspace's pipeline document, returning an empty document when absent. */
export async function readPipeline(root) {
  const workspace = assertRoot(root)
  const file = pipelineFile(workspace)
  await assertPipelineFile(workspace)
  let info
  try {
    info = await fsp.stat(file)
  } catch (error) {
    if (error !== null && typeof error === 'object' && error.code === 'ENOENT') return emptyPipeline()
    throw error
  }
  if (info.size > PIPELINE_MAX_BYTES) {
    throw new PipelineError('too-large', '工作区交付流水线文件超过 1 MiB，已拒绝读取')
  }
  const text = await fsp.readFile(file, 'utf8')
  return parsePipeline(text, file)
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
async function writePipeline(root, doc) {
  const file = pipelineFile(root)
  const text = serializePipeline(doc)
  if (Buffer.byteLength(text, 'utf8') > PIPELINE_MAX_BYTES) {
    throw new PipelineError('too-large', '交付流水线文件超过 1 MiB；请精简摘要、产物或发布记录后重试')
  }
  await ensureStateDirectory(root)
  await assertPipelineFile(root)
  const temporary = path.join(
    stateDirectory(root),
    `.pipeline-${String(process.pid)}-${String(Date.now())}-${randomUUID()}.tmp`,
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

/** Validate one requirement title. */
function validateRequirementTitle(value) {
  if (typeof value !== 'string') {
    throw new PipelineError('bad-request', '需求标题必须是字符串')
  }
  const title = value.trim()
  if (title.length === 0) throw new PipelineError('bad-request', '需求标题不能为空')
  if (title.length > PIPELINE_MAX_TITLE) {
    throw new PipelineError('too-large', `需求标题最多 ${String(PIPELINE_MAX_TITLE)} 个字符`)
  }
  return title
}

/** Validate one requirement detail. */
function validateRequirementDetail(value) {
  if (typeof value !== 'string') {
    throw new PipelineError('bad-request', '需求详情必须是字符串')
  }
  const detail = value.trim()
  if (detail.length === 0) throw new PipelineError('bad-request', '需求详情不能为空')
  if (detail.length > PIPELINE_MAX_DETAIL) {
    throw new PipelineError('too-large', `需求详情最多 ${String(PIPELINE_MAX_DETAIL)} 个字符`)
  }
  return detail
}

/** Validate a stage submission summary. */
function validateSummary(value) {
  if (typeof value !== 'string') {
    throw new PipelineError('bad-request', '提交评审时必须提供 summary 字符串')
  }
  const summary = value.trim()
  if (summary.length === 0) {
    throw new PipelineError('bad-request', '提交评审时 summary 不能为空')
  }
  if (summary.length > PIPELINE_MAX_SUMMARY) {
    throw new PipelineError('too-large', `summary 最多 ${String(PIPELINE_MAX_SUMMARY)} 个字符`)
  }
  return summary
}

/** Append one line to an existing stage note, keeping it within the limit. */
function appendStageNote(existing, extra) {
  const base = typeof existing === 'string' ? existing.trim() : ''
  const text = typeof extra === 'string' ? extra.trim() : ''
  const combined = text.length === 0 ? base : base.length === 0 ? text : base + '\n' + text
  return combined.slice(0, PIPELINE_MAX_NOTE)
}

/** Validate an optional review note. */
function validateNote(value) {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') throw new PipelineError('bad-request', '备注必须是字符串')
  const note = value.trim()
  if (note.length > PIPELINE_MAX_NOTE) {
    throw new PipelineError('too-large', `备注最多 ${String(PIPELINE_MAX_NOTE)} 个字符`)
  }
  return note
}

/** Validate one artifact (object or bare path string). */
function validateArtifact(value, index) {
  if (typeof value === 'string') {
    const artifactPath = value.trim()
    if (artifactPath.length === 0) {
      throw new PipelineError('bad-request', `第 ${String(index + 1)} 个产物路径不能为空`)
    }
    if (artifactPath.length > PIPELINE_MAX_PATH) {
      throw new PipelineError('too-large', `第 ${String(index + 1)} 个产物路径最多 ${String(PIPELINE_MAX_PATH)} 个字符`)
    }
    return { path: artifactPath, label: '' }
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new PipelineError('bad-request', `第 ${String(index + 1)} 个产物必须是 { path, label } 对象或路径字符串`)
  }
  const artifactPath = typeof value.path === 'string' ? value.path.trim() : ''
  if (artifactPath.length === 0) {
    throw new PipelineError('bad-request', `第 ${String(index + 1)} 个产物缺少 path`)
  }
  if (artifactPath.length > PIPELINE_MAX_PATH) {
    throw new PipelineError('too-large', `第 ${String(index + 1)} 个产物路径最多 ${String(PIPELINE_MAX_PATH)} 个字符`)
  }
  const label = value.label === undefined || value.label === null ? '' : value.label
  if (typeof label !== 'string') {
    throw new PipelineError('bad-request', `第 ${String(index + 1)} 个产物 label 必须是字符串`)
  }
  const trimmed = label.trim()
  if (trimmed.length > PIPELINE_MAX_LABEL) {
    throw new PipelineError('too-large', `第 ${String(index + 1)} 个产物 label 最多 ${String(PIPELINE_MAX_LABEL)} 个字符`)
  }
  return { path: artifactPath, label: trimmed }
}

/** Validate an optional artifact list. */
function validateArtifacts(value) {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) {
    throw new PipelineError('bad-request', 'artifacts 必须是数组')
  }
  if (value.length > PIPELINE_MAX_ARTIFACTS) {
    throw new PipelineError('too-large', `artifacts 最多 ${String(PIPELINE_MAX_ARTIFACTS)} 个`)
  }
  return value.map((candidate, index) => validateArtifact(candidate, index))
}

/** Validate the shape of one release record. */
function validateReleaseInput(input) {
  const source = input !== null && typeof input === 'object' ? input : {}
  const environment = typeof source.environment === 'string' ? source.environment.trim() : ''
  if (environment.length === 0) throw new PipelineError('bad-request', '发布记录缺少 environment（发布环境）')
  if (environment.length > PIPELINE_MAX_ENVIRONMENT) {
    throw new PipelineError('too-large', `environment 最多 ${String(PIPELINE_MAX_ENVIRONMENT)} 个字符`)
  }
  let url = ''
  if (source.url !== undefined && source.url !== null) {
    if (typeof source.url !== 'string') throw new PipelineError('bad-request', '发布链接 url 必须是字符串')
    url = source.url.trim()
    if (url.length > PIPELINE_MAX_PATH) {
      throw new PipelineError('too-large', `发布链接最多 ${String(PIPELINE_MAX_PATH)} 个字符`)
    }
  }
  const notes = validateNote(source.notes)
  return { environment, url, notes }
}

/** Copy one requirement for a browser/tool response. */
function publicRequirement(requirement) {
  return { title: requirement.title, detail: requirement.detail, updatedAt: requirement.updatedAt }
}

/** Copy one release record for a browser/tool response. */
function publicRelease(release) {
  return {
    environment: release.environment,
    url: release.url,
    notes: release.notes,
    createdAt: release.createdAt,
  }
}

/** Copy one stage for a browser/tool response, enriched with its role labels. */
function publicStage(stage, definition) {
  return {
    id: definition.id,
    role: definition.role,
    roleTitle: definition.roleTitle,
    title: definition.title,
    status: stage.status,
    startedAt: stage.startedAt,
    submittedAt: stage.submittedAt,
    reviewedAt: stage.reviewedAt,
    summary: stage.summary,
    note: stage.note,
    artifacts: stage.artifacts.map((artifact) => ({ path: artifact.path, label: artifact.label })),
  }
}

/** Count stages per status. */
function stageCounts(stages) {
  const counts = { pending: 0, active: 0, review: 0, approved: 0, failed: 0 }
  for (const stage of stages) counts[stage.status] += 1
  return counts
}

/** First stage that is not approved yet, or null when every stage is done. */
function currentStageId(stages) {
  for (let index = 0; index < stages.length; index += 1) {
    if (stages[index].status !== 'approved') return PIPELINE_STAGES[index].id
  }
  return null
}

/**
 * Read one workspace's whole pipeline for the browser panel and tools.
 * @param root - absolute workspace root.
 * @returns `{ doc, stages, currentStageId, currentStage, counts, total, approved,
 *   complete, releases, updatedAt, path }`.
 */
export async function listPipeline(root) {
  const workspace = assertRoot(root)
  const doc = await readPipeline(workspace)
  return snapshotPipeline(workspace, doc)
}

/** Build the public snapshot returned by every read. */
function snapshotPipeline(workspace, doc) {
  const stages = doc.stages.map((stage, index) => publicStage(stage, STAGE_INDEX.get(PIPELINE_STAGES[index].id)))
  const counts = stageCounts(doc.stages)
  const currentId = currentStageId(doc.stages)
  return {
    doc,
    stages,
    currentStageId: currentId,
    currentStage: currentId === null ? null : stages[PIPELINE_STAGES.findIndex((stage) => stage.id === currentId)],
    counts,
    total: PIPELINE_STAGES.length,
    approved: counts.approved,
    complete: currentId === null,
    releases: doc.releases.map(publicRelease),
    round: doc.round ?? 1,
    changes: (doc.changes ?? []).map((change) => ({
      round: change.round,
      title: change.title,
      detail: change.detail,
      scope: change.scope ?? 'full',
      createdAt: change.createdAt,
    })),
    history: (doc.history ?? []).map((entry) => ({
      round: entry.round,
      title: entry.title,
      completedAt: entry.completedAt,
      stageCount: Array.isArray(entry.stages) ? entry.stages.length : 0,
    })),
    roundScope: doc.roundScope ?? 'full',
    requirementLog: (doc.requirementLog ?? []).map((entry) => ({
      id: entry.id,
      type: entry.type,
      title: entry.title,
      detail: entry.detail,
      createdAt: entry.createdAt,
    })),
    updatedAt: doc.updatedAt,
    path: pipelineFile(workspace),
  }
}

/**
 * Set or update the delivery requirement. `product` cannot start until both
 * `title` and `detail` are non-empty.
 *
 * @param root - absolute workspace root.
 * @param input - `{ title?, detail? }`; at least one field is required.
 * @returns the updated requirement.
 */
export async function setRequirement(root, input) {
  const workspace = assertRoot(root)
  const has = (key) => input !== null && typeof input === 'object' && Object.prototype.hasOwnProperty.call(input, key)
  if (!has('title') && !has('detail')) {
    throw new PipelineError('bad-request', '请至少提供需求标题 title 或详情 detail')
  }
  const title = has('title') ? validateRequirementTitle(input.title) : undefined
  const detail = has('detail') ? validateRequirementDetail(input.detail) : undefined
  return withMutationLock(workspace, async () => {
    const doc = await readPipeline(workspace)
    const now = Date.now()
    if (title !== undefined) doc.requirement.title = title
    if (detail !== undefined) doc.requirement.detail = detail
    doc.requirement.updatedAt = now
    doc.updatedAt = now
    await writePipeline(workspace, doc)
    return publicRequirement(doc.requirement)
  })
}

/**
 * Set the pipeline gate mode. `fast` lets the owner pre-authorize the four
 * intermediate stages (product/design/development/testing): submitting one of
 * them approves it automatically and reports the next stage id, so the agent can
 * continue without a human round-trip. The approval and release gates always
 * stay manual.
 *
 * @param root - absolute workspace root.
 * @param mode - 'normal' | 'fast'.
 * @returns the stored settings.
 */
export async function setGateMode(root, mode) {
  if (!PIPELINE_GATE_MODES.includes(mode)) {
    throw new PipelineError('bad-request', 'gateMode 必须是 normal 或 fast')
  }
  const workspace = assertRoot(root)
  return withMutationLock(workspace, async () => {
    const doc = await readPipeline(workspace)
    doc.settings = { gateMode: mode }
    doc.updatedAt = Date.now()
    await writePipeline(workspace, doc)
    return doc.settings
  })
}

/**
 * Start one delivery stage.
 *
 * `product` requires a non-empty requirement title and detail; every other
 * stage requires the previous stage to be `approved`. Only `pending` stages and
 * `failed` stages (restart after a rejection) can be started. Restarting a
 * failed stage clears its submission but keeps the rejection note as context.
 *
 * @param root - absolute workspace root.
 * @param stageId - one of `PIPELINE_STAGES[].id`.
 * @returns the started stage.
 */
export async function startStage(root, stageId) {
  const workspace = assertRoot(root)
  const definition = stageDefinition(stageId)
  return withMutationLock(workspace, async () => {
    const doc = await readPipeline(workspace)
    const stage = documentStage(doc, definition)
    if (stage.status !== 'pending' && stage.status !== 'failed') {
      throw new PipelineError(
        'bad-status',
        `阶段「${definition.title}」当前状态是 ${stage.status}，只有 pending 或 failed 的阶段可以开始`,
      )
    }
    if (definition.index === 0) {
      if (doc.requirement.title.trim().length === 0 || doc.requirement.detail.trim().length === 0) {
        throw new PipelineError(
          'missing-requirement',
          '产品经理阶段开始前必须先设置需求标题与详情（pipeline_set_requirement）',
        )
      }
    } else {
      const previousDefinition = PIPELINE_STAGES[definition.index - 1]
      const previous = doc.stages[definition.index - 1]
      if (previous.status !== 'approved') {
        throw new PipelineError(
          'bad-order',
          `阶段「${definition.title}」开始前必须等上一阶段「${previousDefinition.title}」approved；当前状态是 ${previous.status}`,
        )
      }
    }
    const now = Date.now()
    const note = stage.status === 'failed' ? stage.note : ''
    stage.status = 'active'
    stage.startedAt = now
    stage.submittedAt = 0
    stage.reviewedAt = 0
    stage.summary = ''
    stage.note = note
    stage.artifacts = []
    doc.updatedAt = now
    await writePipeline(workspace, doc)
    return publicStage(stage, definition)
  })
}

/**
 * Submit one active stage for review. The stage moves to `review` and waits for
 * the project manager (owner) to approve or reject it in the browser panel.
 *
 * @param root - absolute workspace root.
 * @param input - `{ stageId, summary, artifacts? }`.
 * @returns the submitted stage.
 */
export async function submitStage(root, input) {
  const workspace = assertRoot(root)
  const definition = stageDefinition(input?.stageId)
  const summary = validateSummary(input?.summary)
  const artifacts = validateArtifacts(input?.artifacts)
  return withMutationLock(workspace, async () => {
    const doc = await readPipeline(workspace)
    const stage = documentStage(doc, definition)
    if (stage.status !== 'active') {
      throw new PipelineError(
        'bad-status',
        `阶段「${definition.title}」当前状态是 ${stage.status}，只有 active 状态才能提交评审`,
      )
    }
    const now = Date.now()
    const fastApproval =
      doc.settings?.gateMode === 'fast' && definition.id !== 'approval' && definition.id !== 'release'
    if (fastApproval) {
      // The owner pre-authorized intermediate stages in fast mode: record the
      // summary and approve, then tell the caller which stage comes next so the
      // agent can continue without a human round-trip.
      stage.status = 'approved'
      stage.summary = summary
      stage.artifacts = artifacts
      stage.submittedAt = now
      stage.reviewedAt = now
      stage.note = appendStageNote(stage.note, '快速模式：Owner 预授权自动通过')
      doc.updatedAt = now
      await writePipeline(workspace, doc)
      const index = PIPELINE_STAGES.findIndex((candidate) => candidate.id === definition.id)
      const next = index >= 0 ? PIPELINE_STAGES[index + 1] : null
      return { stage: publicStage(stage, definition), autoApproved: true, nextStageId: next === null ? '' : next.id }
    }
    stage.status = 'review'
    stage.summary = summary
    stage.artifacts = artifacts
    stage.submittedAt = now
    stage.reviewedAt = 0
    doc.updatedAt = now
    await writePipeline(workspace, doc)
    return publicStage(stage, definition)
  })
}

/**
 * Approve or reject one submitted stage. This is the human gate: only the
 * browser panel (owner) calls it, and the model has no tool for it. The
 * `approval` stage may be reviewed directly while active — it is the owner's
 * confirmation step, not a work product to submit.
 *
 * @param root - absolute workspace root.
 * @param input - `{ stageId, decision: 'approve' | 'reject', note? }`.
 * @returns the reviewed stage.
 */
export async function reviewStage(root, input) {
  const workspace = assertRoot(root)
  const definition = stageDefinition(input?.stageId)
  const decision = input?.decision
  if (decision !== 'approve' && decision !== 'reject') {
    throw new PipelineError('bad-request', 'decision 必须是 approve 或 reject（小写）')
  }
  const note = validateNote(input?.note)
  return withMutationLock(workspace, async () => {
    const doc = await readPipeline(workspace)
    const stage = documentStage(doc, definition)
    const directApproval = definition.id === 'approval' && stage.status === 'active'
    if (stage.status !== 'review' && !directApproval) {
      throw new PipelineError(
        'bad-status',
        `阶段「${definition.title}」当前状态是 ${stage.status}，只有 review 状态才能审批（approval 阶段可在 active 时由项目经理直接审批）`,
      )
    }
    if (decision === 'approve' && definition.id === 'release') {
      const approvalStage = doc.stages[PIPELINE_STAGES.findIndex((candidate) => candidate.id === 'approval')]
      if (approvalStage.status !== 'approved') {
        throw new PipelineError('bad-order', '项目经理尚未通过 approval 阶段，不能批准发布')
      }
    }
    const now = Date.now()
    stage.reviewedAt = now
    if (decision === 'approve') {
      stage.status = 'approved'
      if (note.length > 0) stage.note = note
    } else {
      stage.status = 'failed'
      stage.note = note
    }
    doc.updatedAt = now
    await writePipeline(workspace, doc)
    return publicStage(stage, definition)
  })
}

/**
 * Append to or replace the delivery requirement without touching the stage
 * state. Every call records an entry in `requirementLog` so the owner can see
 * what changed and when. The caller/agent is responsible for telling the
 * product manager to absorb the update into `requirements.md` and the
 * acceptance items; this function only persists the requirement.
 *
 * @param root - absolute workspace root.
 * @param input - `{ mode?: 'append' | 'replace', type?, title?, detail? }`.
 * @returns `{ requirement, entry }`.
 */
export async function updateRequirement(root, input) {
  const workspace = assertRoot(root)
  const mode = input?.mode === 'replace' ? 'replace' : 'append'
  const type = ['append', 'refine', 'change', 'edit'].includes(input?.type) ? input.type : mode === 'replace' ? 'edit' : 'append'
  const hasTitle = typeof input?.title === 'string' && input.title.trim().length > 0
  const hasDetail = typeof input?.detail === 'string' && input.detail.trim().length > 0
  if (!hasTitle && !hasDetail) {
    throw new PipelineError('bad-request', '请至少提供需求标题或需求内容')
  }
  const title = hasTitle ? validateRequirementTitle(input.title) : ''
  const detail = hasDetail ? validateRequirementDetail(input.detail) : ''
  return withMutationLock(workspace, async () => {
    const doc = await readPipeline(workspace)
    const now = Date.now()
    if (mode === 'replace') {
      if (title.length > 0) doc.requirement.title = title
      if (detail.length > 0) doc.requirement.detail = detail
    } else {
      if (title.length > 0 && doc.requirement.title.trim().length === 0) doc.requirement.title = title
      if (detail.length > 0) {
        const separator = doc.requirement.detail.trim().length === 0 ? '' : '\n\n'
        doc.requirement.detail = (doc.requirement.detail + separator + detail).slice(0, PIPELINE_MAX_DETAIL)
      }
    }
    doc.requirement.updatedAt = now
    const entry = {
      id: randomUUID(),
      type,
      title: mode === 'replace' && title.length === 0 ? doc.requirement.title : title,
      detail: mode === 'replace' && detail.length === 0 ? doc.requirement.detail : detail,
      createdAt: now,
    }
    doc.requirementLog = [entry, ...(doc.requirementLog ?? [])].slice(0, 50)
    doc.updatedAt = now
    await writePipeline(workspace, doc)
    return { requirement: publicRequirement(doc.requirement), entry }
  })
}

/**
 * Start a new change round on a completed project. Only allowed once every
 * stage is approved: the current round is archived into `history` (last ten
 * kept), the round counter increments, the requirement is replaced with the
 * change request, and all six stages return to pending so the team can run the
 * change through requirement → design → development → testing → sign-off →
 * release. Acceptance items and the release history are kept for traceability.
 *
 * @param root - absolute workspace root.
 * @param input - `{ title, detail, note? }`.
 * @returns the new round snapshot.
 */
export async function startChangeRound(root, input) {
  const workspace = assertRoot(root)
  const title = validateRequirementTitle(input?.title)
  const detail = validateRequirementDetail(input?.detail)
  const note = validateNote(input?.note)
  const scope = PIPELINE_CHANGE_SCOPES.includes(input?.scope) ? input.scope : 'full'
  return withMutationLock(workspace, async () => {
    const doc = await readPipeline(workspace)
    const complete = doc.stages.every((stage) => stage.status === 'approved')
    if (!complete) {
      throw new PipelineError('bad-status', '只有全部六个阶段都通过后才能发起变更；请先完成当前项目')
    }
    const now = Date.now()
    const snapshot = {
      round: doc.round ?? 1,
      requirement: { ...doc.requirement },
      completedAt: now,
      stages: doc.stages.map((stage) => ({
        id: stage.id,
        status: stage.status,
        summary: stage.summary,
        note: stage.note,
        reviewedAt: stage.reviewedAt,
      })),
    }
    doc.history = [snapshot, ...(doc.history ?? [])].slice(0, 10)
    doc.round = (doc.round ?? 1) + 1
    doc.roundScope = scope
    doc.requirement = { title, detail, updatedAt: now }
    const change = {
      round: doc.round,
      title,
      detail,
      note,
      scope,
      createdAt: now,
    }
    doc.changes = [change, ...(doc.changes ?? [])].slice(0, 50)
    doc.requirementLog = [
      {
        id: randomUUID(),
        type: 'change',
        title,
        detail,
        createdAt: now,
      },
      ...(doc.requirementLog ?? []),
    ].slice(0, 50)
    const skipped = new Set(CHANGE_SKIP_STAGES[scope] ?? [])
    const skipText = skipNote(scope)
    doc.stages = doc.stages.map((stage) => ({
      id: stage.id,
      status: skipped.has(stage.id) ? 'approved' : 'pending',
      startedAt: 0,
      submittedAt: 0,
      reviewedAt: skipped.has(stage.id) ? now : 0,
      summary: skipped.has(stage.id) ? skipText : '',
      note: skipped.has(stage.id) ? skipText : '',
      artifacts: [],
    }))
    doc.updatedAt = now
    await writePipeline(workspace, doc)
    const nextStage = doc.stages.find((stage) => stage.status === 'pending' || stage.status === 'failed') ?? null
    return {
      round: doc.round,
      requirement: publicRequirement(doc.requirement),
      change: { round: change.round, title: change.title, detail: change.detail, scope, createdAt: change.createdAt },
      nextStageId: nextStage === null ? '' : nextStage.id,
      skippedStages: [...skipped],
    }
  })
}

/**
 * Reset one running or submitted stage back to pending so it can be redone
 * against an updated requirement. The owner triggers this from the workbench;
 * the note records why the stage was reset.
 *
 * @param root - absolute workspace root.
 * @param input - `{ stageId, note? }`.
 * @returns the reset stage.
 */
export async function restartStage(root, input) {
  const workspace = assertRoot(root)
  const definition = stageDefinition(input?.stageId)
  const note = validateNote(input?.note) || '需求更新后重做'
  return withMutationLock(workspace, async () => {
    const doc = await readPipeline(workspace)
    const stage = documentStage(doc, definition)
    if (stage.status !== 'active' && stage.status !== 'review') {
      throw new PipelineError('bad-status', `阶段「${definition.title}」当前状态是 ${stage.status}，只有进行中或待评审的阶段可以重做`)
    }
    const now = Date.now()
    stage.status = 'pending'
    stage.startedAt = 0
    stage.submittedAt = 0
    stage.reviewedAt = 0
    stage.summary = ''
    stage.artifacts = []
    stage.note = note
    doc.updatedAt = now
    await writePipeline(workspace, doc)
    return publicStage(stage, definition)
  })
}

/**
 * Append one release record (newest first, newest 100 kept).
 *
 * The caller decides how the record relates to the release stage: it can be
 * passed as an artifact or summarized with `submitStage`, and approving the
 * release stage keeps the release history intact.
 *
 * @param root - absolute workspace root.
 * @param input - `{ environment, url?, notes? }`.
 * @returns the appended release record.
 */
export async function recordRelease(root, input) {
  const workspace = assertRoot(root)
  const entry = validateReleaseInput(input)
  return withMutationLock(workspace, async () => {
    const doc = await readPipeline(workspace)
    const now = Date.now()
    const release = { environment: entry.environment, url: entry.url, notes: entry.notes, createdAt: now }
    doc.releases = [release, ...doc.releases].slice(0, PIPELINE_MAX_RELEASES)
    doc.updatedAt = now
    await writePipeline(workspace, doc)
    return publicRelease(release)
  })
}

/** Format one epoch millisecond value for a stage prompt, in UTC. */
function formatTimestamp(value) {
  if (!Number.isFinite(value) || value <= 0) return '—'
  const date = new Date(Math.floor(value))
  const pad = (part) => String(part).padStart(2, '0')
  return `${String(date.getUTCFullYear())}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`
}

/** Normalize one stage state for prompt rendering (tolerates hand-edited docs). */
function promptStageState(doc, definition) {
  const stages = Array.isArray(doc.stages) ? doc.stages : []
  const source = stages.find(
    (candidate) => candidate !== null && typeof candidate === 'object' && candidate.id === definition.id,
  )
  const value = source !== null && typeof source === 'object' ? source : {}
  return {
    status: PIPELINE_STATUSES.includes(value.status) ? value.status : 'pending',
    summary: typeof value.summary === 'string' ? value.summary.trim().slice(0, PIPELINE_MAX_SUMMARY) : '',
    note: typeof value.note === 'string' ? value.note.trim().slice(0, PIPELINE_MAX_NOTE) : '',
    artifacts: normalizeStoredArtifacts(value.artifacts),
  }
}

/** Role missions and boundaries injected into every stage prompt. */
const STAGE_GUIDES = {
  product: {
    mission: '把用户需求整理成可交付、可验收的需求说明，并为本次交付建立验收清单。',
    does: [
      '分析需求：明确目标用户、使用场景、范围（做什么 / 不做什么）、约束与优先级。',
      '写出可验证的验收标准，并用 acceptance_add 拆成可勾选的验收项：title 写结论式验收点，requirement 写验收条件，category 标注所属模块。',
      '产出需求分析文档（例如 docs/requirements.md），提交评审时在 artifacts 中列出路径。',
    ],
    doesNot: [
      '不做 UI 视觉设计、不写业务代码、不运行实现。',
      '不代替项目经理审批本阶段，也不发布上线。',
    ],
    deliverables: [
      '需求分析：背景、目标、用户故事、范围与验收标准。',
      '验收项：用 acceptance_add 写入，覆盖核心流程、异常与边界场景。',
      '需求文档路径：作为 artifacts 提交（如 docs/requirements.md）。',
    ],
  },
  design: {
    mission: '把已通过的需求转成可实现、可评审的 UI 设计说明与设计资源。',
    does: [
      '基于已通过的需求，产出信息架构、关键页面 / 组件清单、交互流程与视觉规范（颜色、字号、间距、状态）。',
      '把设计资源写入工作区（例如 docs/design/ 下的设计说明、HTML/CSS 预览、图标或截图），提交评审时在 artifacts 中列出。',
      '标注实现注意点、响应式与无障碍要求，让全栈开发可以直接落地。',
    ],
    doesNot: [
      '不写后端接口与业务逻辑，不修改实现代码。',
      '不扩大或删减需求范围（范围变更交产品经理），不审批阶段，不发布。',
    ],
    deliverables: [
      '设计说明：页面 / 组件清单、交互流程、视觉规范与实现提示。',
      '设计资源：设计稿或可预览资源的路径（artifacts）。',
    ],
  },
  development: {
    mission: '按已通过的需求与设计完成可运行的实现，并通过构建与自测。',
    does: [
      '实现代码：前端页面与交互、后端接口与数据、错误处理与空状态。',
      '在 Dev Workspace 的「任务」面板里运行 build / test（或项目等价的类型检查、lint）并确认通过，失败要修复后重跑。',
      '用工作区待办（todo_add / todo_update）推进实现；提交评审时在 summary 说明已完成内容、验证方式与遗留风险，在 artifacts 列出变更文件与构建产物。',
    ],
    doesNot: [
      '不自行变更需求范围与验收标准（需要变更时回报产品经理）。',
      '不代替测试出测试报告、不审批本阶段、不发布上线。',
    ],
    deliverables: [
      '可运行实现：代码变更与构建产物（artifacts 列路径）。',
      '构建 / 测试证据：任务面板执行的命令与通过结论写进 summary。',
      '自测说明：覆盖场景、已知限制与遗留风险。',
    ],
  },
  testing: {
    mission: '独立验证实现是否满足需求与验收标准，并回填验收结果。',
    does: [
      '基于需求与验收项编写测试用例（正常、异常、边界、回归），并在任务面板执行测试命令完成验证。',
      '用 acceptance_update 把每项验收结果回填为 pass / fail / blocked，note 写证据或失败原因；失败项必须给出可复现步骤。',
      '产出测试报告（例如 docs/test-report.md）；提交评审时在 summary 写结论（通过数 / 失败数 / 阻塞项），在 artifacts 列出报告与用例路径。',
    ],
    doesNot: [
      '不直接修改业务代码（bug 交全栈开发修复后复测），不改需求与设计。',
      '不审批本阶段、不发布上线。',
    ],
    deliverables: [
      '测试用例与测试报告（artifacts）。',
      '验收项回填：acceptance_update 的 pass / fail / blocked 结果。',
    ],
  },
  approval: {
    mission: '这是人工闸门：由项目经理核对需求、验收清单与测试结论后给出确认结论。',
    does: [
      '项目经理（owner）在 Dev Workspace 面板上审阅需求、验收清单与测试报告，并 approve 或 reject 本阶段。',
      '模型只负责用 pipeline_start_stage 启动本阶段并提醒 owner 审批；若需补充说明，用 summary 写清待确认点。',
    ],
    doesNot: [
      '模型不能自己审批本阶段，也不能用任何工具代替 owner 的确认。',
      '不写代码、不做设计、不修改验收结论。',
    ],
    deliverables: [
      '项目经理的人工确认结论（approve 或 reject + 备注）。',
      '若 reject，按备注回到对应阶段修复后重新走闸门。',
    ],
  },
  release: {
    mission: '在项目经理确认通过后把交付发布到目标环境，并留下可追溯的发布记录。',
    does: [
      '仅在 approval 阶段已由项目经理通过后，按发布方案部署到目标环境并做发布后 smoke 验证。',
      '产出发布记录：环境、访问链接、发布时间、发布内容与回滚方案；用 recordRelease / summary / artifacts 记录，并附上发布后的验证链接。',
      '发布失败要回滚并说明原因，修复后重新走本阶段。',
    ],
    doesNot: [
      '不做产品决策、设计与代码变更；不修改测试结论与验收清单。',
      '不能在 approval 未通过时发布。',
    ],
    deliverables: [
      '发布记录：环境、URL、版本 / 内容与回滚方案（releases / artifacts）。',
      '发布后验证结果与链接。',
    ],
  },
}

/** Render one upstream stage block for the prompt. */
function promptUpstreamBlock(definition, state, position) {
  const lines = [`- ${String(position)}. ${definition.title}（${definition.roleTitle}）：${STAGE_STATUS_LABELS[state.status]}`]
  lines.push(`  - 摘要：${state.summary.length === 0 ? '（无摘要）' : state.summary.replaceAll(/\r?\n/gu, ' ')}`)
  if (state.artifacts.length === 0) {
    lines.push('  - 产物：（未登记）')
  } else {
    for (const artifact of state.artifacts) {
      lines.push(`  - 产物：${artifact.path}${artifact.label.length === 0 ? '' : `（${artifact.label}）`}`)
    }
  }
  return lines
}

/**
 * Build the Chinese role prompt for one delivery stage.
 *
 * The prompt carries the requirement, every upstream summary and artifact, the
 * role's "only do / never do" boundaries, the deliverables this role owes, the
 * gate rules (the next stage needs approval) and the reminder that only the
 * project manager can approve. The `release` prompt additionally states whether
 * the approval stage has already passed.
 *
 * @param doc - pipeline document (as returned by `readPipeline`).
 * @param stageId - one of `PIPELINE_STAGES[].id`.
 * @returns Chinese Markdown prompt text.
 */
export function buildStagePrompt(doc, stageId) {
  const definition = stageDefinition(stageId)
  const guide = STAGE_GUIDES[definition.id]
  const source = doc !== null && typeof doc === 'object' ? doc : {}
  const requirementSource =
    source.requirement !== null && typeof source.requirement === 'object' ? source.requirement : {}
  const requirement = {
    title: typeof requirementSource.title === 'string' ? requirementSource.title.trim() : '',
    detail: typeof requirementSource.detail === 'string' ? requirementSource.detail.trim() : '',
  }
  const stage = promptStageState(source, definition)
  const lines = [
    `## 交付流水线 · 第 ${String(definition.index + 1)}/${String(PIPELINE_STAGES.length)} 阶段：${definition.title}（${definition.roleTitle}）`,
    '',
    `你在本次交付中负责「${definition.roleTitle}」环节。当前阶段状态：${STAGE_STATUS_LABELS[stage.status]}。`,
    `本阶段使命：${guide.mission}`,
    '',
    '### 需求',
    `- 标题：${requirement.title.length === 0 ? '（尚未设置）' : requirement.title}`,
  ]
  if (requirement.detail.length === 0) {
    lines.push('- 详情：（尚未设置）')
  } else {
    lines.push('- 详情：')
    for (const detailLine of requirement.detail.split(/\r?\n/u)) {
      lines.push(`  ${detailLine}`)
    }
  }
  lines.push('', '### 开始条件')
  if (definition.index === 0) {
    lines.push('- 需求标题与详情不能为空；开始前先调用 `pipeline_set_requirement` 写入需求。')
  } else {
    const previousDefinition = PIPELINE_STAGES[definition.index - 1]
    const previous = promptStageState(source, PIPELINE_STAGES[definition.index - 1])
    lines.push(
      `- 上一阶段「${previousDefinition.title}」（${previousDefinition.roleTitle}）必须已经 approved；当前状态：${STAGE_STATUS_LABELS[previous.status]}。`,
    )
  }
  lines.push('- 阶段开始后状态为 active；提交评审后变为 review；只有项目经理在面板上 approve，下一阶段才能开始。')
  lines.push('', '### 上游阶段（摘要与产物）')
  if (definition.index === 0) {
    lines.push('- 本阶段是流水线起点，没有上游阶段。')
  } else {
    for (let position = 0; position < definition.index; position += 1) {
      const upstreamDefinition = PIPELINE_STAGES[position]
      const upstreamState = promptStageState(source, PIPELINE_STAGES[position])
      lines.push(...promptUpstreamBlock(upstreamDefinition, upstreamState, position + 1))
    }
  }
  lines.push('', '### 本阶段只做什么', ...guide.does.map((entry) => `- ${entry}`))
  lines.push('', '### 本阶段不做什么', ...guide.doesNot.map((entry) => `- ${entry}`))
  lines.push('', '### 交付物要求', ...guide.deliverables.map((entry) => `- ${entry}`))
  if (definition.id === 'release') {
    const approvalPosition = PIPELINE_STAGES.findIndex((candidate) => candidate.id === 'approval')
    const approval = promptStageState(source, PIPELINE_STAGES[approvalPosition])
    lines.push('', '### 发布前提')
    if (approval.status === 'approved') {
      lines.push(
        `- approval 阶段（项目经理人工闸门）已通过（approved，审批时间：${formatTimestamp(promptReviewedAt(source, 'approval'))}），可以发布。`,
      )
    } else {
      lines.push(`- approval 阶段尚未通过（当前：${STAGE_STATUS_LABELS[approval.status]}），禁止发布；请先完成 approval 阶段。`)
    }
    const releases = Array.isArray(source.releases) ? source.releases : []
    const recent = []
    for (const candidate of releases) {
      const release = normalizeStoredRelease(candidate)
      if (release !== null) recent.push(release)
      if (recent.length >= 5) break
    }
    if (recent.length > 0) {
      lines.push('', '### 已有发布记录（最新在前）')
      for (const release of recent) {
        const link = release.url.length === 0 ? '（无链接）' : release.url
        const notes = release.notes.length === 0 ? '' : `；备注：${release.notes.replaceAll(/\r?\n/gu, ' ')}`
        lines.push(`- ${release.environment} · ${link} · ${formatTimestamp(release.createdAt)}${notes}`)
      }
    }
  }
  lines.push('', '### 提交与闸门（必须遵守）')
  lines.push('1. 先用 `pipeline_stage_prompt` 读取本阶段提示（也就是本段文字），按角色边界执行。')
  if (definition.id === 'approval') {
    lines.push(
      '2. approval 是人工闸门：用 `pipeline_start_stage` 启动后，由项目经理直接在 Dev Workspace 面板上 approve 或 reject；其余阶段的完成必须调用 `pipeline_submit_stage` 提交评审，而本阶段不需要（也不允许）模型代替提交或审批。',
    )
  } else {
    lines.push(
      `2. 完成后必须调用 \`pipeline_submit_stage({ stageId: "${definition.id}", summary: "<本阶段结论：做了什么、验证方式、遗留风险>", artifacts: [{ path: "<工作区相对路径>", label: "<说明>" }] })\` 提交评审。summary 最多 ${String(PIPELINE_MAX_SUMMARY)} 字符；artifacts 最多 ${String(PIPELINE_MAX_ARTIFACTS)} 个，每个 path 最多 ${String(PIPELINE_MAX_PATH)} 字符。`,
    )
  }
  lines.push(
    '3. 提交后阶段进入 review（待审批）；你必须等待项目经理在 Dev Workspace 面板上 approve。**你不能自己审批，必须等项目经理在面板上通过**，也不要跳过闸门直接开始下一阶段。',
  )
  lines.push(
    '4. 阶段被 reject 会变成 failed：按驳回备注修复，再用 `pipeline_start_stage` 重新开始本阶段，并重新提交评审。',
  )
  if (stage.status === 'review') {
    lines.push('', '### 当前状态提示', '- 本阶段已提交评审，正在等待项目经理审批；不要重复提交，也不要开始下一阶段。')
  } else if (stage.status === 'approved') {
    lines.push('', '### 当前状态提示', '- 本阶段已通过；不要重复提交，继续推进下一阶段即可。')
  } else if (stage.status === 'failed') {
    lines.push(
      '',
      '### 当前状态提示',
      `- 本阶段已被驳回${stage.note.length === 0 ? '' : `，驳回备注：${stage.note}`}；修复后重新开始本阶段。`,
    )
  } else if (stage.status === 'active') {
    lines.push('', '### 当前状态提示', '- 本阶段进行中；完成后按上面的要求提交评审。')
  }
  return `${lines.join('\n').trimEnd()}\n`
}

/** Read one stored stage's reviewedAt timestamp for prompt text. */
function promptReviewedAt(doc, stageId) {
  const stages = Array.isArray(doc.stages) ? doc.stages : []
  const source = stages.find((candidate) => candidate !== null && typeof candidate === 'object' && candidate.id === stageId)
  return source !== null && typeof source === 'object' ? timestampValue(source.reviewedAt) : 0
}

/** A registry-ready output schema for one artifact. */
const ARTIFACT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    path: { type: 'string' },
    label: { type: 'string' },
  },
  required: ['path', 'label'],
}

/** A registry-ready output schema for one stage. */
const STAGE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    role: { type: 'string' },
    roleTitle: { type: 'string' },
    title: { type: 'string' },
    status: { type: 'string', enum: PIPELINE_STATUSES },
    startedAt: { type: 'integer', description: '0 while the stage has not started.' },
    submittedAt: { type: 'integer', description: '0 until the stage is submitted for review.' },
    reviewedAt: { type: 'integer', description: '0 until the project manager approves or rejects.' },
    summary: { type: 'string' },
    note: { type: 'string' },
    artifacts: { type: 'array', items: ARTIFACT_SCHEMA },
  },
  required: [
    'id',
    'role',
    'roleTitle',
    'title',
    'status',
    'startedAt',
    'submittedAt',
    'reviewedAt',
    'summary',
    'note',
    'artifacts',
  ],
}

/** A registry-ready output schema for one requirement. */
const REQUIREMENT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    detail: { type: 'string' },
    updatedAt: { type: 'integer' },
  },
  required: ['title', 'detail', 'updatedAt'],
}

/** A registry-ready output schema for one release record. */
const RELEASE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    environment: { type: 'string' },
    url: { type: 'string' },
    notes: { type: 'string' },
    createdAt: { type: 'integer' },
  },
  required: ['environment', 'url', 'notes', 'createdAt'],
}

/** Cap the rendered status response even when summaries are long. */
const STATUS_RENDER_MAX_CHARS = 8_000
const STATUS_SUMMARY_EXCERPT_CHARS = 400

/** Render a bounded pipeline status for one tool result. */
function renderPipelineStatus(value) {
  const lines = [
    `Delivery pipeline (${value.scope}): ${String(value.approved)}/${String(value.total)} stages approved — ${value.complete ? 'complete' : `current stage: ${value.currentStageId}`}.`,
  ]
  if (value.requirement.title.length === 0) {
    lines.push('Requirement: (not set — call pipeline_set_requirement before starting product)')
  } else {
    lines.push(`Requirement: ${value.requirement.title}`)
  }
  let used = 0
  for (let position = 0; position < value.stages.length; position += 1) {
    const stage = value.stages[position]
    const summary =
      stage.summary.length === 0
        ? ''
        : ` — ${stage.summary.slice(0, STATUS_SUMMARY_EXCERPT_CHARS).replaceAll(/\r?\n/gu, ' ')}${stage.summary.length > STATUS_SUMMARY_EXCERPT_CHARS ? '…' : ''}`
    const artifacts = stage.artifacts.length === 0 ? '' : ` [${String(stage.artifacts.length)} artifact(s)]`
    const line = `- ${String(position + 1)}. ${stage.title} (${stage.roleTitle}): ${STAGE_STATUS_MARKS[stage.status]}${summary}${artifacts}`
    if (lines.length > 2 && used + line.length > STATUS_RENDER_MAX_CHARS) break
    lines.push(line)
    used += line.length + 1
  }
  lines.push(
    value.releases.length === 0
      ? 'Releases: none recorded.'
      : `Releases: ${String(value.releases.length)} recorded; latest: ${value.releases[0].environment}${value.releases[0].url.length === 0 ? '' : ` (${value.releases[0].url})`}.`,
  )
  return lines.join('\n')
}

/** Throw when a tool call has no agent/workspace, or has an SSH workspace. */
function toolWorkspace(ctx, exec) {
  const root = resolveAgentWorkspace(ctx, exec.agent)
  if (root === null) {
    throw new Error('The delivery pipeline is unavailable because this session has no workspace directory.')
  }
  if (isSshRoot(root) || isSshRoot(exec.agent?.session?.meta?.cwd)) {
    throw new PipelineError(
      'ssh-unsupported',
      'SSH remote workspaces have no local delivery pipeline (.dsh/pipeline.json); use a local workspace instead.',
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

/**
 * Register the five model-facing pipeline tools. Registration is skipped per
 * tool on failure so one schema problem cannot remove the rest.
 * @param ctx - context providing `tools`.
 * @returns disposer for every registered tool.
 */
export function registerPipelineTools(ctx) {
  const disposers = []
  const register = (definition) => {
    try {
      const dispose = ctx.tools.register(definition)
      if (typeof dispose === 'function') disposers.push(dispose)
    } catch (error) {
      ctx.logger?.warn?.('dsh-web-filebrowser: failed to register a pipeline tool', error)
    }
  }

  register({
    name: 'pipeline_status',
    description:
      'Read the six-stage delivery pipeline stored in .dsh/pipeline.json: the requirement, every stage (status, summary, artifacts), the current stage and the recorded releases. Use it before deciding which role should act next. This module only owns pipeline state and the human approval gates; multi-role execution is organized by the Lead with the Harness team tools (spawn_teammate / team_task_*).',
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
          requirement: REQUIREMENT_SCHEMA,
          stages: { type: 'array', items: STAGE_SCHEMA },
          currentStageId: { type: 'string', description: 'Empty string when every stage is approved.' },
          counts: {
            type: 'object',
            additionalProperties: false,
            properties: {
              pending: { type: 'integer' },
              active: { type: 'integer' },
              review: { type: 'integer' },
              approved: { type: 'integer' },
              failed: { type: 'integer' },
            },
            required: ['pending', 'active', 'review', 'approved', 'failed'],
          },
          total: { type: 'integer' },
          approved: { type: 'integer' },
          complete: { type: 'boolean' },
          releases: { type: 'array', items: RELEASE_SCHEMA },
          scope: { type: 'string' },
        },
        required: [
          'requirement',
          'stages',
          'currentStageId',
          'counts',
          'total',
          'approved',
          'complete',
          'releases',
          'scope',
        ],
      },
      render: (_args, value) => [{ type: 'text', text: renderPipelineStatus(value) }],
    },
    async execute(args, exec) {
      exec.signal.throwIfAborted()
      const root = toolWorkspace(ctx, exec)
      const result = await listPipeline(root)
      exec.signal.throwIfAborted()
      return {
        requirement: result.doc.requirement,
        stages: result.stages,
        currentStageId: result.currentStageId ?? '',
        counts: result.counts,
        total: result.total,
        approved: result.approved,
        complete: result.complete,
        releases: result.releases,
        scope: root,
      }
    },
  })

  register({
    name: 'pipeline_stage_prompt',
    description:
      'Return the Chinese role prompt for one delivery stage: the requirement, upstream summaries and artifacts, what this role must do and must not do, the deliverables it owes, and the review gate rules. Fetch it before taking over a stage (or handing it to a teammate). The stage id comes from pipeline_status.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        stageId: {
          type: 'string',
          enum: PIPELINE_STAGE_IDS,
          description: 'Stage id: product, design, development, testing, approval or release.',
        },
      },
      required: ['stageId'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          stageId: { type: 'string' },
          role: { type: 'string' },
          roleTitle: { type: 'string' },
          title: { type: 'string' },
          prompt: { type: 'string' },
          scope: { type: 'string' },
        },
        required: ['stageId', 'role', 'roleTitle', 'title', 'prompt', 'scope'],
      },
      render: (_args, value) => [{ type: 'text', text: value.prompt }],
    },
    async execute(args, exec) {
      exec.signal.throwIfAborted()
      const root = toolWorkspace(ctx, exec)
      const definition = stageDefinition(requiredString(args?.stageId, 'stageId'))
      const doc = await readPipeline(root)
      exec.signal.throwIfAborted()
      return {
        stageId: definition.id,
        role: definition.role,
        roleTitle: definition.roleTitle,
        title: definition.title,
        prompt: buildStagePrompt(doc, definition.id),
        scope: root,
      }
    },
  })

  register({
    name: 'pipeline_set_requirement',
    description:
      'Set the delivery requirement (title and detail) stored in .dsh/pipeline.json. The product stage cannot start until both are non-empty; write a requirement that the six roles can work from and that acceptance_add can turn into checkable acceptance items.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        title: { type: 'string', description: `Short delivery title (at most ${String(PIPELINE_MAX_TITLE)} characters).` },
        detail: {
          type: 'string',
          description: `Full requirement detail: users, scenarios, scope, constraints and acceptance criteria (at most ${String(PIPELINE_MAX_DETAIL)} characters).`,
        },
      },
      required: ['title', 'detail'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          requirement: REQUIREMENT_SCHEMA,
          scope: { type: 'string' },
        },
        required: ['requirement', 'scope'],
      },
      render: (_args, value) => [
        { type: 'text', text: `Requirement saved: ${value.requirement.title}` },
      ],
    },
    async execute(args, exec) {
      exec.signal.throwIfAborted()
      const root = toolWorkspace(ctx, exec)
      const requirement = await setRequirement(root, {
        title: requiredString(args?.title, 'title'),
        detail: requiredString(args?.detail, 'detail'),
      })
      exec.signal.throwIfAborted()
      return { requirement, scope: root }
    },
  })

  register({
    name: 'pipeline_start_stage',
    description:
      'Start one delivery stage (status becomes active). The product stage needs a requirement title and detail; every other stage needs the previous stage approved. A failed stage can be restarted after fixing the rejection note. Starting a stage does not approve it: only the project manager approves in the browser panel.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        stageId: {
          type: 'string',
          enum: PIPELINE_STAGE_IDS,
          description: 'Stage id: product, design, development, testing, approval or release.',
        },
      },
      required: ['stageId'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          stage: STAGE_SCHEMA,
          nextTool: { type: 'string' },
          scope: { type: 'string' },
        },
        required: ['stage', 'nextTool', 'scope'],
      },
      render: (_args, value) => [
        { type: 'text', text: `Started stage "${value.stage.id}" (${value.stage.status}). ${value.nextTool}` },
      ],
    },
    async execute(args, exec) {
      exec.signal.throwIfAborted()
      const root = toolWorkspace(ctx, exec)
      const stage = await startStage(root, requiredString(args?.stageId, 'stageId'))
      exec.signal.throwIfAborted()
      const nextTool =
        stage.id === 'approval'
          ? 'Ask the project manager to approve this human gate in the Dev Workspace panel; the model must not approve it.'
          : 'Do the stage work, then call pipeline_submit_stage to request review.'
      return { stage, nextTool, scope: root }
    },
  })

  register({
    name: 'pipeline_submit_stage',
    description:
      'Submit the active stage for review with a summary and artifacts. Normally the stage moves to review and waits for the project manager (owner) to approve or reject it in the Dev Workspace panel — the model cannot approve its own work. In fast mode the four intermediate stages (product/design/development/testing) are auto-approved by the owner\'s pre-authorization; the result then reports autoApproved and nextStageId and you should continue with that stage. Artifacts are workspace-relative paths with optional labels.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        stageId: {
          type: 'string',
          enum: PIPELINE_STAGE_IDS,
          description: 'Stage id: product, design, development, testing, approval or release.',
        },
        summary: {
          type: 'string',
          description: `Stage conclusion: what was done, how it was verified, remaining risks (at most ${String(PIPELINE_MAX_SUMMARY)} characters).`,
        },
        artifacts: {
          type: 'array',
          description: `Workspace-relative deliverables with optional labels (at most ${String(PIPELINE_MAX_ARTIFACTS)}).`,
          items: ARTIFACT_SCHEMA,
        },
      },
      required: ['stageId', 'summary'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          stage: STAGE_SCHEMA,
          autoApproved: { type: 'boolean' },
          nextStageId: { type: 'string' },
          scope: { type: 'string' },
        },
        required: ['stage', 'autoApproved', 'nextStageId', 'scope'],
      },
      render: (_args, value) => [
        {
          type: 'text',
          text: value.autoApproved === true
            ? `Stage "${value.stage.id}" was auto-approved by the owner's fast mode (summary and artifacts recorded). Continue with the next stage "${value.nextStageId}": call pipeline_stage_prompt({stageId:"${value.nextStageId}"}), then pipeline_start_stage({stageId:"${value.nextStageId}"}) and do the work. The human approval and release gates remain manual.`
            : `Submitted stage "${value.stage.id}" for review (${String(value.stage.artifacts.length)} artifact(s)). Waiting for the project manager to approve it in the Dev Workspace panel; the model must not approve its own work.`,
        },
      ],
    },
    async execute(args, exec) {
      exec.signal.throwIfAborted()
      const root = toolWorkspace(ctx, exec)
      const result = await submitStage(root, {
        stageId: requiredString(args?.stageId, 'stageId'),
        summary: args?.summary,
        artifacts: args?.artifacts,
      })
      exec.signal.throwIfAborted()
      if (result !== null && typeof result === 'object' && result.autoApproved === true) {
        return { stage: result.stage, autoApproved: true, nextStageId: result.nextStageId, scope: root }
      }
      return { stage: result, autoApproved: false, nextStageId: '', scope: root }
    },
  })

  register({
    name: 'pipeline_record_release',
    description:
      'Record one release you actually performed (environment, public URL and notes) on the release stage. Only use it after the project manager has approved the human approval gate; it appends to the pipeline release history and is shown in the Dev Workspace pipeline panel. It never publishes anything by itself.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        environment: {
          type: 'string',
          description: 'Release environment, for example production, staging or a client-specific target (at most 200 characters).',
        },
        url: {
          type: 'string',
          description: 'Public or client-visible URL of the release, empty when it has none (at most 2000 characters).',
        },
        notes: {
          type: 'string',
          description: `What was published, the version/commit and any rollback note (at most ${String(PIPELINE_MAX_NOTE)} characters).`,
        },
      },
      required: ['environment'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          release: RELEASE_SCHEMA,
          scope: { type: 'string' },
        },
        required: ['release', 'scope'],
      },
      render: (_args, value) => [
        {
          type: 'text',
          text: `Recorded release to "${value.release.environment}"${value.release.url.length > 0 ? ` at ${value.release.url}` : ''}.`,
        },
      ],
    },
    async execute(args, exec) {
      exec.signal.throwIfAborted()
      const root = toolWorkspace(ctx, exec)
      const release = await recordRelease(root, {
        environment: args?.environment,
        url: args?.url,
        notes: args?.notes,
      })
      exec.signal.throwIfAborted()
      return { release, scope: root }
    },
  })

  return () => {
    for (const dispose of disposers.splice(0)) dispose()
  }
}

/**
 * Register the delivery-pipeline guidance section (immediately after the
 * workspace-acceptance guide). The pipeline document itself is not injected
 * into the prompt; the model reads it on demand with `pipeline_status` /
 * `pipeline_stage_prompt` so a long pipeline cannot crowd the context.
 * @param ctx - context providing `systemPrompt`.
 * @returns disposer for the section registration.
 */
export function registerPipelinePrompt(ctx) {
  const disposers = []
  try {
    const section = ctx.systemPrompt.section({
      name: SECTION_NAME,
      order: SECTION_ORDER,
      text: (assembly) =>
        resolveAgentWorkspace(ctx, assembly?.agent ?? assembly?.scope) === null ? '' : PIPELINE_SECTION,
    })
    if (typeof section === 'function') disposers.push(section)
  } catch (error) {
    ctx.logger?.warn?.('dsh-web-filebrowser: failed to register the delivery pipeline guide', error)
  }
  return () => {
    for (const dispose of disposers.splice(0)) dispose()
  }
}
