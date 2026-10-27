/**
 * Workspace status bus (P1): one read-only model tool plus a bounded dynamic
 * system-prompt briefing.
 *
 * The tool aggregates the pieces an agent normally has to collect with several
 * calls — pipeline stage, acceptance counters, running tasks, recent run,
 * project documents — into one compact object. The prompt context injects only
 * low-frequency facts (requirement title, current stage, acceptance pass/fail,
 * running task count) so an approval performed by the owner is visible on the
 * next request without another tool call.
 *
 * Both halves degrade gracefully: a missing or corrupt `.dsh` document yields a
 * warning/empty briefing rather than failing the tool or prompt assembly.
 */

import { promises as fsp, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { listAcceptance } from './acceptance.js'
import { resolveAgentWorkspace } from './memory.js'
import { listPipeline } from './pipeline.js'
import { isSshRoot } from './ssh.js'

/** Hard cap for the workspace_status tool value (bytes of JSON). */
const MAX_STATUS_BYTES = 4096
/** Hard cap for the injected prompt briefing (characters). */
const MAX_PROMPT_CHARS = 600
/** Largest `.dsh` document the synchronous prompt reader will parse. */
const MAX_STATE_FILE_BYTES = 1024 * 1024
/** Failing acceptance items carried inline (full list stays in acceptance_list). */
const MAX_FAILING_ITEMS = 5
/** Prompt context placement: right after the workspace-memory context (150). */
const CONTEXT_NAME = 'dsh-web-filebrowser:workspace-state'
const CONTEXT_ORDER = 151

/** Project documents checked for presence (AGENT_TEAM.md deliverables). */
const DOC_FILES = {
  requirements: 'docs/pipeline/requirements.md',
  design: 'docs/pipeline/design.md',
  testReport: 'docs/pipeline/test-report.md',
  release: 'docs/pipeline/release.md',
}

const STAGE_COUNTS_SCHEMA = {
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
}

const STAGE_ROW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    status: { type: 'string' },
    role: { type: 'string' },
  },
  required: ['id', 'title', 'status', 'role'],
}

const FAILING_ITEM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    note: { type: 'string' },
  },
  required: ['id', 'title', 'note'],
}

const RUNNING_ROW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    command: { type: 'string' },
    durationMs: { type: 'integer' },
  },
  required: ['id', 'name', 'command', 'durationMs'],
}

const LAST_RUN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    command: { type: 'string' },
    exitCode: { oneOf: [{ type: 'integer' }, { type: 'null' }] },
    signal: { oneOf: [{ type: 'string' }, { type: 'null' }] },
    durationMs: { type: 'integer' },
    endedAt: { type: 'integer' },
    source: { type: 'string' },
  },
  required: ['name', 'command', 'exitCode', 'signal', 'durationMs', 'endedAt', 'source'],
}

const DOCS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    requirements: { type: 'boolean' },
    design: { type: 'boolean' },
    testReport: { type: 'boolean' },
    release: { type: 'boolean' },
  },
  required: ['requirements', 'design', 'testReport', 'release'],
}

/**
 * Register the workspace_status tool.
 * @param ctx - Host context providing `tools`.
 * @param services - `{ tasks }` task manager (read for running/recent runs).
 * @returns disposer that unregisters the tool.
 */
export function registerWorkspaceStateTools(ctx, services = {}) {
  const disposers = []
  try {
    const dispose = ctx.tools.register({
      name: 'workspace_status',
      description:
        'One-call snapshot of the Dev Workspace project state: requirement title, delivery pipeline stage/status/counts/gate mode/round, acceptance counters and up to five failing items, running tasks and the most recent run, and which pipeline documents exist. Use it at the start of a turn (or after the owner approves/rejects a stage) instead of calling pipeline_status, acceptance_list and task_list separately. Read-only, bounded to 4 KB.',
      parameters: { type: 'object', additionalProperties: false, properties: {}, required: [] },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            workspace: { type: 'string' },
            requirement: {
              type: 'object',
              additionalProperties: false,
              properties: {
                title: { type: 'string' },
                hasDetail: { type: 'boolean' },
              },
              required: ['title', 'hasDetail'],
            },
            pipeline: {
              type: 'object',
              additionalProperties: false,
              properties: {
                currentStageId: { type: 'string' },
                status: { type: 'string', description: 'Current stage status, or unknown when unreadable.' },
                counts: STAGE_COUNTS_SCHEMA,
                gateMode: { type: 'string', description: 'normal or fast.' },
                round: { type: 'integer' },
                stages: { type: 'array', items: STAGE_ROW_SCHEMA },
              },
              required: ['currentStageId', 'status', 'counts', 'gateMode', 'round', 'stages'],
            },
            acceptance: {
              type: 'object',
              additionalProperties: false,
              properties: {
                total: { type: 'integer' },
                pending: { type: 'integer' },
                pass: { type: 'integer' },
                fail: { type: 'integer' },
                blocked: { type: 'integer' },
                failing: { type: 'array', items: FAILING_ITEM_SCHEMA },
              },
              required: ['total', 'pending', 'pass', 'fail', 'blocked', 'failing'],
            },
            tasks: {
              type: 'object',
              additionalProperties: false,
              properties: {
                running: { type: 'array', items: RUNNING_ROW_SCHEMA },
                lastRun: { oneOf: [LAST_RUN_SCHEMA, { type: 'null' }] },
              },
              required: ['running', 'lastRun'],
            },
            docs: DOCS_SCHEMA,
            generatedAt: { type: 'integer' },
            truncated: { type: 'boolean' },
            warnings: { type: 'array', items: { type: 'string' } },
          },
          required: [
            'workspace',
            'requirement',
            'pipeline',
            'acceptance',
            'tasks',
            'docs',
            'generatedAt',
            'truncated',
            'warnings',
          ],
        },
        render: (_args, value) => [
          {
            type: 'text',
            text: [
              `Workspace: ${value.workspace}`,
              `Requirement: ${value.requirement.title || '(none)'}`,
              `Stage: ${value.pipeline.currentStageId || 'complete'} (${value.pipeline.status}), ${String(value.pipeline.counts.approved)}/6 approved, gate=${value.pipeline.gateMode}`,
              `Acceptance: pass ${String(value.acceptance.pass)}, fail ${String(value.acceptance.fail)}, pending ${String(value.acceptance.pending)}, blocked ${String(value.acceptance.blocked)}`,
              `Tasks: ${String(value.tasks.running.length)} running${value.tasks.lastRun === null ? '' : `; last ${value.tasks.lastRun.command} (exit ${String(value.tasks.lastRun.exitCode)})`}`,
              ...(value.warnings.length > 0 ? [`Warnings: ${value.warnings.join('; ')}`] : []),
            ].join('\n'),
          },
        ],
      },
      async execute(args, exec) {
        abortIfNeeded(exec)
        const root = workspaceRoot(ctx, exec)
        const value = await buildStatus(root, services)
        return compactStatus(value)
      },
    })
    if (typeof dispose === 'function') disposers.push(dispose)
  } catch (error) {
    ctx.logger?.warn?.('dsh-web-filebrowser: failed to register workspace_status', error)
  }
  return () => {
    for (const dispose of disposers.splice(0)) dispose()
  }
}

/**
 * Register the bounded dynamic workspace briefing.
 *
 * The text provider is synchronous (systemPrompt contract), so it reads the two
 * small `.dsh` documents directly instead of awaiting the async stores. Missing
 * or corrupt files, and sessions without a local workspace, contribute nothing.
 *
 * @param ctx - Host context providing `systemPrompt`.
 * @param services - optional `{ tasks }`; when present its synchronous
 *   `runningCount(root)` feeds the "running tasks" line.
 * @returns disposer that removes the context registration.
 */
export function registerWorkspaceStatePrompt(ctx, services = {}) {
  const disposers = []
  try {
    const context = ctx.systemPrompt.context({
      name: CONTEXT_NAME,
      order: CONTEXT_ORDER,
      required: false,
      text: (assembly) => {
        try {
          return buildPromptBriefing(ctx, assembly, services)
        } catch {
          // A corrupt document or an unexpected provider failure must never
          // break prompt assembly; the tool still reports precise state.
          return ''
        }
      },
    })
    if (typeof context === 'function') disposers.push(context)
  } catch (error) {
    ctx.logger?.warn?.('dsh-web-filebrowser: failed to register the workspace-state context', error)
  }
  return () => {
    for (const dispose of disposers.splice(0)) dispose()
  }
}

/** Resolve the tool workspace, rejecting SSH and workspace-less sessions. */
function workspaceRoot(ctx, exec) {
  const agent = exec?.agent ?? null
  const root = resolveAgentWorkspace(ctx, agent)
  const cwd = agent?.session?.meta?.cwd
  if (root === null || (typeof root === 'string' && root.length === 0)) {
    throw workspaceStateError(
      'workspace-missing',
      'This session has no local workspace; workspace_status needs a Dev Workspace root.',
    )
  }
  if (typeof root === 'string' && (isSshRoot(root) || isSshRoot(cwd))) {
    throw workspaceStateError(
      'ssh-unsupported',
      'workspace_status only supports local workspaces (pipeline and acceptance are local).',
    )
  }
  return root
}

/** Build a structured workspace_status failure with a stable code. */
function workspaceStateError(code, message) {
  const error = new Error(`[${code}] ${message}`)
  error.name = 'WorkspaceStateError'
  error.code = code
  error.sideCode = code
  return error
}

/** Throw when the caller aborted. */
function abortIfNeeded(exec) {
  if (exec !== null && typeof exec === 'object' && exec.signal !== null && typeof exec.signal === 'object') {
    exec.signal.throwIfAborted?.()
  }
}

/** Read the state document synchronously for the prompt provider. */
function readStateJsonSync(file) {
  try {
    const info = statSync(file)
    if (!info.isFile() || info.size > MAX_STATE_FILE_BYTES) return null
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

/** Tolerant synchronous pipeline summary used by the prompt provider. */
function readPipelineSummarySync(root) {
  const doc = readStateJsonSync(path.join(root, '.dsh', 'pipeline.json'))
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) return null
  const requirement = doc.requirement !== null && typeof doc.requirement === 'object' ? doc.requirement : {}
  const title = typeof requirement.title === 'string' ? requirement.title.trim().slice(0, 200) : ''
  const stages = Array.isArray(doc.stages) ? doc.stages : []
  let approved = 0
  let current = null
  for (const stage of stages) {
    if (stage === null || typeof stage !== 'object') continue
    const status = typeof stage.status === 'string' ? stage.status : 'pending'
    if (status === 'approved') approved += 1
    else if (current === null) current = { id: typeof stage.id === 'string' ? stage.id : '', status }
  }
  const settings = doc.settings !== null && typeof doc.settings === 'object' ? doc.settings : {}
  return {
    title,
    hasDetail: typeof requirement.detail === 'string' && requirement.detail.trim().length > 0,
    current: current ?? { id: '', status: stages.length > 0 ? 'complete' : 'pending' },
    approved,
    total: stages.length > 0 ? stages.length : 6,
    gateMode: settings.gateMode === 'fast' ? 'fast' : 'normal',
    round: Number.isInteger(doc.round) && doc.round > 0 ? doc.round : 1,
  }
}

/** Tolerant synchronous acceptance summary used by the prompt provider. */
function readAcceptanceSummarySync(root) {
  const doc = readStateJsonSync(path.join(root, '.dsh', 'acceptance.json'))
  if (doc === null) return null
  const items = Array.isArray(doc) ? doc : Array.isArray(doc.items) ? doc.items : []
  const counts = { total: 0, pending: 0, pass: 0, fail: 0, blocked: 0 }
  for (const item of items) {
    if (item === null || typeof item !== 'object') continue
    counts.total += 1
    const status = item.status === 'pass' || item.status === 'fail' || item.status === 'blocked' ? item.status : 'pending'
    counts[status] += 1
  }
  return counts
}

/** Build the ≤600 character prompt briefing for one assembly. */
function buildPromptBriefing(ctx, assembly, services) {
  const agent = assembly?.agent ?? assembly?.scope
  const root = resolveAgentWorkspace(ctx, agent)
  const cwd = agent?.session?.meta?.cwd
  if (root === null || (typeof root === 'string' && root.length === 0)) return ''
  if (typeof root === 'string' && (isSshRoot(root) || isSshRoot(cwd))) return ''

  const pipelineState = readPipelineSummarySync(root)
  const acceptanceState = readAcceptanceSummarySync(root)
  let running = 0
  if (services !== null && typeof services === 'object' && typeof services.tasks?.runningCount === 'function') {
    try {
      running = Math.max(0, Math.floor(services.tasks.runningCount(root)))
    } catch {
      running = 0
    }
  }

  const hasProject =
    (pipelineState !== null && pipelineState.title.length > 0) ||
    (acceptanceState !== null && acceptanceState.total > 0) ||
    running > 0
  if (!hasProject) return ''

  const lines = ['## 工作区状态']
  lines.push('- 流程约定：只有工作台发起的交付需求走七阶段流水线；对话框直接提出的需求按默认 Harness 方式直接完成（除非 Owner 明确要求走流水线）。')
  if (pipelineState !== null && pipelineState.title.length > 0) {
    lines.push(`- 需求：${pipelineState.title}（第 ${String(pipelineState.round)} 轮）`)
  }
  if (pipelineState !== null) {
    const current = pipelineState.current
    lines.push(
      `- 阶段：${current.id.length > 0 ? current.id : '全部完成'}（${current.status}）；已通过 ${String(pipelineState.approved)}/${String(pipelineState.total)}；门模式：${pipelineState.gateMode}`,
    )
  }
  if (acceptanceState !== null) {
    lines.push(
      `- 验收：通过 ${String(acceptanceState.pass)} / 未通过 ${String(acceptanceState.fail)} / 待验收 ${String(acceptanceState.pending)}（共 ${String(acceptanceState.total)}）`,
    )
  }
  lines.push(`- 运行中任务：${String(running)}`)
  lines.push('完整状态请调用 workspace_status。')
  const text = lines.join('\n')
  return text.length > MAX_PROMPT_CHARS ? `${text.slice(0, MAX_PROMPT_CHARS - 1)}…` : text
}

/** Build the full status value before size compaction. */
async function buildStatus(root, services) {
  const warnings = []
  let requirementValue = { title: '', hasDetail: false }
  let pipelineValue = {
    currentStageId: '',
    status: 'unknown',
    counts: { pending: 0, active: 0, review: 0, approved: 0, failed: 0 },
    gateMode: 'normal',
    round: 1,
    stages: [],
  }

  try {
    const snapshot = await listPipeline(root)
    const requirement = snapshot.doc.requirement
    requirementValue = {
      title: typeof requirement.title === 'string' ? requirement.title.slice(0, 200) : '',
      hasDetail: typeof requirement.detail === 'string' && requirement.detail.trim().length > 0,
    }
    pipelineValue = {
      currentStageId: snapshot.currentStageId ?? '',
      status: snapshot.currentStage === null ? 'complete' : snapshot.currentStage.status,
      counts: snapshot.counts,
      gateMode: snapshot.doc.settings?.gateMode === 'fast' ? 'fast' : 'normal',
      round: snapshot.round ?? 1,
      stages: snapshot.stages.map((stage) => ({
        id: stage.id,
        title: stage.title,
        status: stage.status,
        role: stage.role,
      })),
    }
  } catch (error) {
    warnings.push(`pipeline unavailable: ${errorMessage(error)}`)
  }

  let acceptanceValue = { total: 0, pending: 0, pass: 0, fail: 0, blocked: 0, failing: [] }
  try {
    const snapshot = await listAcceptance(root)
    acceptanceValue = {
      total: snapshot.total,
      pending: snapshot.pending,
      pass: snapshot.pass,
      fail: snapshot.fail,
      blocked: snapshot.blocked,
      failing: snapshot.items
        .filter((item) => item.status === 'fail')
        .slice(0, MAX_FAILING_ITEMS)
        .map((item) => ({
          id: item.id,
          title: item.title.slice(0, 200),
          note: typeof item.note === 'string' ? item.note.slice(0, 200) : '',
        })),
    }
  } catch (error) {
    warnings.push(`acceptance unavailable: ${errorMessage(error)}`)
  }

  const tasksValue = { running: [], lastRun: null }
  const tasks = services?.tasks ?? null
  if (tasks !== null && typeof tasks === 'object') {
    try {
      if (typeof tasks.list === 'function') {
        const live = await tasks.list({ root })
        tasksValue.running = (Array.isArray(live) ? live : [])
          .filter((row) => row !== null && typeof row === 'object' && row.running === true)
          .slice(0, 5)
          .map((row) => ({
            id: typeof row.id === 'string' ? row.id : '',
            name: typeof row.name === 'string' ? row.name.slice(0, 200) : '',
            command: typeof row.command === 'string' ? row.command.slice(0, 400) : '',
            durationMs: Number.isFinite(row.durationMs) ? Math.max(0, Math.floor(row.durationMs)) : 0,
          }))
        if (tasksValue.lastRun === null) {
          const finished = (Array.isArray(live) ? live : [])
            .filter((row) => row !== null && typeof row === 'object' && row.running !== true)
            .sort((left, right) => (right.startedAt ?? 0) - (left.startedAt ?? 0))[0]
          if (finished !== undefined) tasksValue.lastRun = mapLastRun(finished)
        }
      }
      if (typeof tasks.listRuns === 'function') {
        const runs = await tasks.listRuns(root)
        if (Array.isArray(runs) && runs.length > 0) tasksValue.lastRun = mapLastRun(runs[0])
      }
    } catch (error) {
      warnings.push(`tasks unavailable: ${errorMessage(error)}`)
    }
  }

  const docs = { requirements: false, design: false, testReport: false, release: false }
  for (const [key, relative] of Object.entries(DOC_FILES)) {
    docs[key] = await fileExists(path.join(root, relative))
  }

  return {
    workspace: root,
    requirement: requirementValue,
    pipeline: pipelineValue,
    acceptance: acceptanceValue,
    tasks: tasksValue,
    docs,
    generatedAt: Date.now(),
    truncated: false,
    warnings,
  }
}

/** Map one live/listRuns row to the compact lastRun schema. */
function mapLastRun(row) {
  return {
    name: typeof row.name === 'string' ? row.name.slice(0, 200) : '',
    command: typeof row.command === 'string' ? row.command.slice(0, 400) : '',
    exitCode: Number.isInteger(row.exitCode) ? row.exitCode : null,
    signal: typeof row.signal === 'string' ? row.signal : null,
    durationMs: Number.isFinite(row.durationMs) ? Math.max(0, Math.floor(row.durationMs)) : 0,
    endedAt: Number.isFinite(row.endedAt) ? Math.floor(row.endedAt) : 0,
    source: row.source === 'tool' ? 'tool' : 'panel',
  }
}

/** True when `file` exists as a regular file. */
async function fileExists(file) {
  try {
    return (await fsp.stat(file)).isFile()
  } catch {
    return false
  }
}

/** One-line error text for warnings. */
function errorMessage(error) {
  const message = error instanceof Error ? error.message : String(error)
  return message.slice(0, 200)
}

/**
 * Keep the tool value under the 4 KB budget by dropping the least important
 * fields first, and mark the result truncated.
 */
function compactStatus(value) {
  const size = () => Buffer.byteLength(JSON.stringify(value), 'utf8')
  if (size() <= MAX_STATUS_BYTES) return value
  value.truncated = true
  value.requirement.title = value.requirement.title.slice(0, 120)
  for (const item of value.acceptance.failing) item.note = item.note.slice(0, 80)
  for (const row of value.tasks.running) {
    row.name = row.name.slice(0, 80)
    row.command = row.command.slice(0, 80)
  }
  if (size() <= MAX_STATUS_BYTES) return value
  value.pipeline.stages = []
  if (size() <= MAX_STATUS_BYTES) return value
  value.acceptance.failing = []
  if (size() <= MAX_STATUS_BYTES) return value
  value.tasks.running = []
  if (size() <= MAX_STATUS_BYTES) return value
  value.tasks.lastRun = null
  if (size() <= MAX_STATUS_BYTES) return value
  value.docs = { requirements: false, design: false, testReport: false, release: false }
  value.requirement.title = ''
  return value
}
