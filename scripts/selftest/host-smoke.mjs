/**
 * Host smoke tests for the v1.2.75 agent-assignment batch (on top of the
 * v1.2.72 dual-review pipeline).
 *
 * Run with: `npm test`
 *
 * These tests are intentionally dependency-free (no test framework, no build)
 * and cover the seams the deeper module selftests in `.dsh/tmp/team/` cannot:
 * the plugin `apply()` wiring (model tools + routes), the acceptance evidence
 * chain, the pipeline review baseline, delivery evidence bundling and the
 * v1.2.75 workbench assignment board (`.dsh/agent-assignments.json`: 4 owner-only
 * host ops, state machine, bounds, atomic writes, SSH degradation and the
 * invariant that assigning never writes `.dsh/pipeline.json`).
 */

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { promises as fsp } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import * as acceptance from '../../dsh-web-filebrowser-plugin/acceptance.js'
import * as agentTools from '../../dsh-web-filebrowser-plugin/agent-tools.js'
import * as assignments from '../../dsh-web-filebrowser-plugin/assignments.js'
import * as delivery from '../../dsh-web-filebrowser-plugin/delivery.js'
import * as pipeline from '../../dsh-web-filebrowser-plugin/pipeline.js'
import * as review from '../../dsh-web-filebrowser-plugin/review.js'
import * as workspaceState from '../../dsh-web-filebrowser-plugin/workspace-state.js'
import { apply, resetWorkspaceDataAt } from '../../dsh-web-filebrowser-plugin/index.js'

const results = []
const roots = []

/** The fixed seven-stage order of v1.2.72. */
const STAGE_ORDER = ['product', 'design', 'development', 'testing', 'acceptance', 'approval', 'release']

/** The six stages written by documents before v1.2.72 (no acceptance). */
const LEGACY_STAGE_IDS = STAGE_ORDER.filter((stageId) => stageId !== 'acceptance')

/** Migration note the Host writes on a legacy completed document. */
const MIGRATION_NOTE = '升级迁移：验收复核为更新新增，旧流程已完成'

/** Minimal valid input for `saveAssignment`. */
function assignmentInput(overrides = {}) {
  return {
    title: '实现工作台指派器',
    detail: '背景/期望：新增工作台团队与指派卡片与 4 个 host op；不做流水线写操作。',
    acceptance: ['产物落盘 + 自测通过'],
    assignedTo: { role: 'qa-engineer' },
    ...overrides,
  }
}

/** Write one raw assignment document (for limit/corruption coverage). */
async function writeRawAssignments(root, value) {
  const file = assignments.assignmentFile(root)
  await fsp.mkdir(path.dirname(file), { recursive: true })
  await fsp.writeFile(file, typeof value === 'string' ? value : JSON.stringify(value), 'utf8')
}

/** SHA-256 of one file, or an empty string when it does not exist. */
async function sha256File(file) {
  try {
    return createHash('sha256').update(await fsp.readFile(file)).digest('hex')
  } catch (error) {
    if (error !== null && typeof error === 'object' && error.code === 'ENOENT') return ''
    throw error
  }
}

/** Assert one promise rejects with the given stable code. */
function rejectsWithCode(promise, code) {
  return assert.rejects(promise, (error) => {
    assert.equal(error.code, code)
    return true
  })
}


async function test(name, body) {
  try {
    await body()
    results.push(true)
    console.log(`ok   ${name}`)
  } catch (error) {
    results.push(false)
    console.log(`FAIL ${name}\n     ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function workspace(label) {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), `dshwfb-smoke-${label}-`))
  roots.push(root)
  return root
}

/** Fake Host context recording tools, prompt sections, contexts and routes. */
function makeHost() {
  const tools = []
  const sections = []
  const contexts = []
  const routes = []
  const disposers = []
  const ctx = {
    inject(deps, callback) {
      if (deps.includes('tools') || deps.includes('systemPrompt')) callback(ctx)
    },
    effect(factory) {
      const dispose = factory()
      if (typeof dispose === 'function') disposers.push(dispose)
      return dispose
    },
    get() {
      return undefined
    },
    logger: { warn() {} },
    connection: {
      fetch: {
        register(options) {
          routes.push(options)
          return Promise.resolve(() => {})
        },
      },
    },
    tools: {
      register(definition) {
        tools.push(definition)
        return () => {}
      },
    },
    systemPrompt: {
      section(options) {
        sections.push(options)
        return () => {}
      },
      context(options) {
        contexts.push(options)
        return () => {}
      },
    },
  }
  return { ctx, tools, sections, contexts, routes, disposers }
}

function execFor(agent, signal) {
  return { agent, signal }
}

const signal = AbortSignal.timeout(20000)

/** Write one raw `.dsh/pipeline.json` sample (used for migration/scope cases). */
async function writeRawPipeline(root, value) {
  const file = pipeline.pipelineFile(root)
  await fsp.mkdir(path.dirname(file), { recursive: true })
  await fsp.writeFile(file, typeof value === 'string' ? value : JSON.stringify(value), 'utf8')
}

/** Build a raw pipeline document with the given stage ids and statuses. */
function rawPipelineDocument(stageIds, statuses = {}, options = {}) {
  const now = options.now ?? 1_000_000
  return {
    version: 1,
    updatedAt: now,
    requirement: {
      title: options.title ?? '流水线迁移样本',
      detail: options.detail ?? '七阶段双复核迁移与变更轮 scope 样本',
      updatedAt: now,
    },
    stages: stageIds.map((id) => ({
      id,
      status: statuses[id] ?? 'pending',
      startedAt: statuses[id] === undefined || statuses[id] === 'pending' ? 0 : now,
      submittedAt: 0,
      reviewedAt: statuses[id] === 'approved' ? now : 0,
      summary: '',
      note: '',
      artifacts: [],
      reviews: [],
    })),
    releases: [],
    settings: { gateMode: options.gateMode ?? 'normal' },
    round: options.round ?? 1,
    changes: [],
    history: [],
    requirementLog: [],
    roundScope: 'full',
  }
}

/** Start → submit → approve one regular stage (`approval` is reviewed directly). */
async function approveStage(root, stageId) {
  await pipeline.startStage(root, stageId)
  if (stageId === 'approval') {
    return pipeline.reviewStage(root, { stageId, decision: 'approve', note: `${stageId} 通过` })
  }
  await pipeline.submitStage(root, { stageId, summary: `${stageId} 阶段完成` })
  return pipeline.reviewStage(root, { stageId, decision: 'approve', note: `${stageId} 通过` })
}

/** Approve every one of the seven stages through the normal (manual) flow. */
async function completeAllStages(root) {
  for (const stageId of STAGE_ORDER) await approveStage(root, stageId)
}

try {
  await test('apply() registers every model tool and route', async () => {
    const host = makeHost()
    apply(host.ctx)
    // Route registration is asynchronous (Promise.then), give it a turn.
    await new Promise((resolve) => setTimeout(resolve, 0))
    const names = host.tools.map((definition) => definition.name)
    assert.equal(host.tools.length, 36, `expected 36 tools, got ${String(host.tools.length)}: ${names.join(',')}`)
    for (const name of [
      'task_detect',
      'task_run',
      'env_ports',
      'preview_share',
      'http_probe',
      'workspace_status',
      'acceptance_evidence_add',
      'acceptance_report',
      'evidence_list',
      'delivery_history',
      'pipeline_update_requirement',
      'pipeline_dispatch',
    ]) {
      assert.ok(names.includes(name), `missing tool ${name}`)
    }
    assert.equal(host.routes.length, 10, `expected 10 routes, got ${String(host.routes.length)}`)
    const paths = host.routes.map((route) => route.path)
    for (const routePath of [
      '/api/dsh-web-filebrowser',
      '/api/dsh-web-filebrowser-ssh',
      '/api/dsh-web-filebrowser-proxy',
      '/api/dsh-web-filebrowser-terminal',
      '/api/dsh-web-filebrowser-tasks',
      '/api/dsh-web-filebrowser-watch',
      '/api/dsh-web-filebrowser-preview',
      '/api/dsh-web-filebrowser-delivery',
    ]) {
      assert.ok(paths.includes(routePath), `missing route ${routePath}`)
    }
    assert.ok(host.contexts.some((context) => context.name === 'dsh-web-filebrowser:workspace-state'))
    for (const dispose of host.disposers.reverse()) dispose()
  })

  await test('sub-registration helpers expose the expected tool sets', async () => {
    const cases = [
      [acceptance.registerAcceptanceTools, 8],
      [pipeline.registerPipelineTools, 8],
      [(ctx) => agentTools.registerAgentTools(ctx, {}), 10],
      [(ctx) => workspaceState.registerWorkspaceStateTools(ctx, {}), 1],
      [(ctx) => delivery.registerDeliveryTools(ctx), 1],
    ]
    for (const [register, expected] of cases) {
      const host = makeHost()
      const dispose = register(host.ctx)
      assert.equal(host.tools.length, expected)
      assert.equal(typeof dispose, 'function')
      if (typeof dispose === 'function') dispose()
    }
  })

  await test('acceptance evidence chain: add, history, retestRound, report, remove', async () => {
    const root = await workspace('acceptance')
    const item = await acceptance.addAcceptance(root, { title: '首页可打开', category: 'web' })
    const withEvidence = await acceptance.addAcceptanceEvidence(root, {
      id: item.id,
      path: '.dsh/evidence/home.png',
      kind: 'screenshot',
      by: 'owner',
    })
    assert.equal(withEvidence.evidence.length, 1)
    assert.equal(withEvidence.evidence[0].kind, 'screenshot')
    const failed = await acceptance.updateAcceptance(root, { id: item.id, status: 'fail', note: '白屏', by: 'owner', round: 1 })
    assert.equal(failed.history.length, 2)
    const passed = await acceptance.updateAcceptance(root, { id: item.id, status: 'pass', note: '已修复', by: 'owner', round: 1 })
    assert.equal(passed.retestRound, 1)
    assert.ok(passed.history.length >= 3)
    const markdown = await acceptance.buildAcceptanceMarkdown(root)
    assert.ok(markdown.includes('证据'))
    assert.ok(markdown.includes('复测'))
    const removed = await acceptance.removeAcceptanceEvidence(root, { id: item.id, path: '.dsh/evidence/home.png' })
    assert.equal(removed.evidence.length, 0)
  })

  await test('review module degrades outside git and captures a baseline inside git', async () => {
    const plain = await workspace('review-plain')
    const notGit = await review.readReviewState(plain)
    assert.equal(notGit.available, false)
    const captured = await review.captureStageBaseline(plain, { stageId: 'development', round: 1 })
    assert.equal(captured.supported, false)
    const gitRoot = await workspace('review-git')
    await fsp.writeFile(path.join(gitRoot, 'a.txt'), 'one\n')
    const { execFile } = await import('node:child_process')
    const run = (args) =>
      new Promise((resolve, reject) => {
        execFile('git', args, { cwd: gitRoot }, (error, stdout) => (error ? reject(error) : resolve(stdout)))
      })
    await run(['init', '-q'])
    await run(['config', 'user.email', 'smoke@example.com'])
    await run(['config', 'user.name', 'smoke'])
    await run(['add', '.'])
    await run(['commit', '-qm', 'init'])
    await review.captureStageBaseline(gitRoot, { stageId: 'development', round: 1 })
    await fsp.writeFile(path.join(gitRoot, 'a.txt'), 'two\n')
    const state = await review.readReviewState(gitRoot, { stageId: 'development', round: 1 })
    assert.equal(state.available, true)
    assert.equal(state.total, 1)
    assert.equal(state.files[0].reviewed, false)
    const marked = await review.markReviewed(gitRoot, { path: 'a.txt' })
    assert.equal(marked.state.reviewed, 1)
    const cleared = await review.clearReviewed(gitRoot, { path: 'a.txt' })
    assert.equal(cleared.state.reviewed, 0)
  })

  await test('delivery bundle carries referenced acceptance evidence', async () => {
    const root = await workspace('delivery')
    await fsp.mkdir(path.join(root, 'dist'), { recursive: true })
    await fsp.writeFile(path.join(root, 'dist', 'index.html'), '<h1>ok</h1>')
    await fsp.mkdir(path.join(root, '.dsh', 'evidence'), { recursive: true })
    await fsp.writeFile(path.join(root, '.dsh', 'evidence', 'home.png'), Buffer.from('fake-png'))
    const item = await acceptance.addAcceptance(root, { title: '首页可打开' })
    await acceptance.addAcceptanceEvidence(root, { id: item.id, path: '.dsh/evidence/home.png', kind: 'screenshot' })
    const doc = await acceptance.readAcceptance(root)
    const collected = await delivery.collectEvidenceEntries(root, doc.items)
    const extraFiles = collected.entries.map((entry) => ({
      path: `evidence/${path.posix.basename(entry.path)}`,
      data: entry.data,
      size: entry.size,
      mtime: entry.mtime,
    }))
    const bundle = await delivery.writeDeliveryBundle(root, { reportMarkdown: '# report', extraFiles })
    assert.ok(bundle.fileCount >= 2)
    const bytes = await fsp.readFile(bundle.path)
    assert.ok(bytes.includes(Buffer.from('evidence/home.png')))
    assert.ok(bytes.includes(Buffer.from('ACCEPTANCE.md')))
  })

  await test('pipeline tools validate artefacts without blocking submission', async () => {
    const root = await workspace('pipeline')
    await pipeline.setRequirement(root, { title: 'Smoke', detail: 'A requirement detail' })
    await pipeline.startStage(root, 'product')
    const submitted = await pipeline.submitStage(root, {
      stageId: 'product',
      summary: 'done',
      artifacts: [{ path: 'missing-notes.md', label: 'notes' }],
    })
    assert.ok(Array.isArray(submitted.warnings))
    assert.ok(submitted.warnings.some((warning) => warning.code === 'missing'))
    assert.equal(submitted.status, 'review')
    const host = makeHost()
    pipeline.registerPipelineTools(host.ctx)
    const tool = host.tools.find((definition) => definition.name === 'pipeline_dispatch')
    assert.ok(tool !== undefined)
    const result = await tool.execute({ stageId: 'design' }, execFor({ id: 'a', session: { meta: { cwd: root } } }, signal))
    assert.equal(typeof result.spawn.name, 'string')
    assert.ok(result.prompt.includes('UI'))
  })

  await test('pipeline constants expose seven stages in dual-review order', async () => {
    assert.deepEqual(
      pipeline.PIPELINE_STAGES.map((stage) => stage.id),
      STAGE_ORDER,
    )
    assert.equal(pipeline.PIPELINE_STAGES.length, 7)
    const acceptanceStage = pipeline.PIPELINE_STAGES.find((stage) => stage.id === 'acceptance')
    assert.deepEqual(acceptanceStage, {
      id: 'acceptance',
      role: 'project-manager-agent',
      roleTitle: '项目经理 Agent',
      title: '验收复核',
    })
    const approvalStage = pipeline.PIPELINE_STAGES.find((stage) => stage.id === 'approval')
    assert.equal(approvalStage.roleTitle, '项目经理（你）')
    assert.equal(approvalStage.title, '人工确认')
    const empty = pipeline.emptyPipeline()
    assert.equal(empty.stages.length, 7)
    assert.deepEqual(
      empty.stages.map((stage) => stage.status),
      Array.from({ length: 7 }, () => 'pending'),
    )
    const root = await workspace('seven-stages')
    const listed = await pipeline.listPipeline(root)
    assert.equal(listed.total, 7)
    assert.equal(listed.stages.length, 7)
    assert.equal(listed.counts.pending, 7)
    assert.equal(listed.currentStageId, 'product')
    assert.equal(listed.stages[4].id, 'acceptance')
    assert.equal(listed.stages[4].roleTitle, '项目经理 Agent')
    assert.equal(listed.stages[5].roleTitle, '项目经理（你）')
  })

  await test('stage order gate rejects skipping into acceptance/approval/release', async () => {
    const root = await workspace('skip-order')
    await pipeline.setRequirement(root, { title: '七阶段跳关', detail: '跳关必须被 bad-order 拒绝' })
    const badOrder = (promise) =>
      assert.rejects(promise, (error) => {
        assert.equal(error.code, 'bad-order')
        return true
      })
    // testing 未通过 → 不能启动 acceptance
    await badOrder(pipeline.startStage(root, 'acceptance'))
    for (const stageId of ['product', 'design', 'development', 'testing']) await approveStage(root, stageId)
    // acceptance 未通过 → 不能启动 approval
    await badOrder(pipeline.startStage(root, 'approval'))
    // testing 已通过 → acceptance 可以启动并提交
    const startedAcceptance = await pipeline.startStage(root, 'acceptance')
    assert.equal(startedAcceptance.status, 'active')
    const submitted = await pipeline.submitStage(root, {
      stageId: 'acceptance',
      summary: '建议放行 · 阻断项 0 · 复测 3/3 通过',
    })
    assert.equal(submitted.status, 'review')
    // acceptance 还在 review（未 approved）→ approval 仍被拒
    await badOrder(pipeline.startStage(root, 'approval'))
    await pipeline.reviewStage(root, { stageId: 'acceptance', decision: 'approve', note: '复核通过' })
    // approval 未通过 → release 不能启动
    await badOrder(pipeline.startStage(root, 'release'))
    const startedApproval = await pipeline.startStage(root, 'approval')
    assert.equal(startedApproval.status, 'active')
    await badOrder(pipeline.startStage(root, 'release'))
    // 即使伪造 release 进入 review，approval 未 approved 也不能 approve release
    const doc = await pipeline.readPipeline(root)
    const raw = JSON.parse(JSON.stringify(doc))
    raw.stages.find((stage) => stage.id === 'approval').status = 'pending'
    raw.stages.find((stage) => stage.id === 'release').status = 'review'
    await writeRawPipeline(root, raw)
    await badOrder(pipeline.reviewStage(root, { stageId: 'release', decision: 'approve' }))
  })

  await test('normal mode acceptance review moves to review then approves and unlocks approval', async () => {
    const root = await workspace('normal-acceptance')
    await pipeline.setRequirement(root, { title: '双复核 normal', detail: 'acceptance 提交评审由 Owner 通过' })
    for (const stageId of ['product', 'design', 'development', 'testing']) await approveStage(root, stageId)
    const acceptanceStarted = await pipeline.startStage(root, 'acceptance')
    assert.equal(acceptanceStarted.status, 'active')
    const submitted = await pipeline.submitStage(root, {
      stageId: 'acceptance',
      summary: '建议放行 · 阻断项 0 · 复测 3/3 通过',
      artifacts: [{ path: 'docs/pipeline/acceptance-review.md', label: '验收复核报告' }],
    })
    assert.equal(submitted.status, 'review')
    assert.equal(submitted.autoApproved, undefined)
    let listed = await pipeline.listPipeline(root)
    assert.equal(listed.currentStageId, 'acceptance')
    assert.equal(listed.counts.review, 1)
    const approved = await pipeline.reviewStage(root, { stageId: 'acceptance', decision: 'approve', note: '接受建议放行' })
    assert.equal(approved.status, 'approved')
    listed = await pipeline.listPipeline(root)
    assert.equal(listed.currentStageId, 'approval')
    assert.equal(listed.counts.approved, 5)
    const approvalStarted = await pipeline.startStage(root, 'approval')
    assert.equal(approvalStarted.status, 'active')
    await pipeline.reviewStage(root, { stageId: 'approval', decision: 'approve', note: 'Owner 最终确认' })
    const releaseStarted = await pipeline.startStage(root, 'release')
    assert.equal(releaseStarted.status, 'active')
  })

  await test('acceptance rejection fails the gate and keeps approval/release locked', async () => {
    const root = await workspace('reject-acceptance')
    await pipeline.setRequirement(root, { title: '双复核打回', detail: 'acceptance 打回后回退修复' })
    for (const stageId of ['product', 'design', 'development', 'testing']) await approveStage(root, stageId)
    await pipeline.startStage(root, 'acceptance')
    await pipeline.submitStage(root, { stageId: 'acceptance', summary: '建议打回 · 阻断项 2 项' })
    const rejected = await pipeline.reviewStage(root, {
      stageId: 'acceptance',
      decision: 'reject',
      note: '验收项 2 项证据缺失，建议回退 development',
    })
    assert.equal(rejected.status, 'failed')
    assert.equal(rejected.note, '验收项 2 项证据缺失，建议回退 development')
    const listed = await pipeline.listPipeline(root)
    assert.equal(listed.currentStageId, 'acceptance')
    assert.equal(listed.counts.failed, 1)
    await assert.rejects(pipeline.startStage(root, 'approval'), (error) => error.code === 'bad-order')
    const restarted = await pipeline.startStage(root, 'acceptance')
    assert.equal(restarted.status, 'active')
    assert.equal(restarted.note, '验收项 2 项证据缺失，建议回退 development')
    await pipeline.submitStage(root, { stageId: 'acceptance', summary: '建议放行 · 阻断项 0' })
    const approved = await pipeline.reviewStage(root, { stageId: 'acceptance', decision: 'approve' })
    assert.equal(approved.status, 'approved')
    const approvalStarted = await pipeline.startStage(root, 'approval')
    assert.equal(approvalStarted.status, 'active')
  })

  await test('fast mode auto-approves four intermediate stages and keeps the design review gate manual', async () => {
    const root = await workspace('fast-mode')
    await pipeline.setRequirement(root, { title: '快速模式双复核', detail: '四个中间阶段自动；design/approval/release 人工' })
    await pipeline.setGateMode(root, 'fast')
    // product / development / testing / acceptance keep auto-approving.
    await pipeline.startStage(root, 'product')
    const productSubmitted = await pipeline.submitStage(root, { stageId: 'product', summary: 'product 完成' })
    assert.equal(productSubmitted.autoApproved, true)
    assert.equal(productSubmitted.nextStageId, 'design')
    // design is an owner review gate: submitting it must return review, not an
    // auto-approval, and development must stay locked until the owner approves.
    await pipeline.startStage(root, 'design')
    const designSubmitted = await pipeline.submitStage(root, { stageId: 'design', summary: 'design 完成' })
    assert.equal(designSubmitted.autoApproved, undefined)
    assert.equal(designSubmitted.status, 'review')
    assert.equal(designSubmitted.nextStageId, undefined)
    assert.ok(designSubmitted.note.includes('设计确认闸门'), `design note should mention the gate, got: ${designSubmitted.note}`)
    await assert.rejects(pipeline.startStage(root, 'development'), (error) => {
      assert.equal(error.code, 'bad-order')
      assert.ok(error.message.includes('上一阶段'), `message should name the previous stage: ${error.message}`)
      assert.ok(error.message.includes('设计'), `message should mention design confirmation: ${error.message}`)
      return true
    })
    await pipeline.reviewStage(root, { stageId: 'design', decision: 'approve', note: 'Owner 确认设计稿' })
    // development / testing / acceptance still auto-approve in fast mode.
    for (const [stageId, nextStageId] of [
      ['development', 'testing'],
      ['testing', 'acceptance'],
      ['acceptance', 'approval'],
    ]) {
      await pipeline.startStage(root, stageId)
      const submitted = await pipeline.submitStage(root, { stageId, summary: `${stageId} 完成` })
      assert.equal(submitted.autoApproved, true, `${stageId} should be auto-approved in fast mode`)
      assert.equal(submitted.stage.status, 'approved')
      assert.equal(submitted.nextStageId, nextStageId, `${stageId} next stage should be ${nextStageId}`)
    }
    const acceptanceList = await pipeline.listPipeline(root)
    const acceptanceStage = acceptanceList.stages.find((stage) => stage.id === 'acceptance')
    assert.equal(acceptanceStage.status, 'approved')
    assert.ok(acceptanceStage.note.includes('快速模式'))
    // approval / release never auto-approve: the release stays locked until the
    // owner approves the human gate.
    await assert.rejects(pipeline.startStage(root, 'release'), (error) => error.code === 'bad-order')
    const approvalStarted = await pipeline.startStage(root, 'approval')
    assert.equal(approvalStarted.status, 'active')
    await pipeline.reviewStage(root, { stageId: 'approval', decision: 'approve', note: 'Owner 人工确认' })
    await pipeline.startStage(root, 'release')
    const releaseSubmitted = await pipeline.submitStage(root, { stageId: 'release', summary: '已发布到 production' })
    assert.equal(releaseSubmitted.autoApproved, undefined)
    assert.equal(releaseSubmitted.status, 'review')
  })

  await test('manual gate stages are design, approval and release', async () => {
    assert.deepEqual(pipeline.PIPELINE_MANUAL_GATE_STAGES, ['design', 'approval', 'release'])
  })

  await test('design without a screenshot warns with the design-no-image code and no misleading HTML wording', async () => {
    const root = await workspace('design-warning')
    await pipeline.setRequirement(root, { title: '设计截图提醒', detail: 'HTML 不能替代截图' })
    await pipeline.setGateMode(root, 'fast')
    await pipeline.startStage(root, 'product')
    await pipeline.submitStage(root, { stageId: 'product', summary: '需求完成' })
    await pipeline.startStage(root, 'design')
    await fsp.mkdir(path.join(root, 'docs/pipeline/design'), { recursive: true })
    await fsp.writeFile(path.join(root, 'docs/pipeline/design/mockup.html'), '<!doctype html><title>mock</title>', 'utf8')
    const submitted = await pipeline.submitStage(root, {
      stageId: 'design',
      summary: '只提交 HTML',
      artifacts: [{ path: 'docs/pipeline/design/mockup.html', label: 'HTML 高保真稿' }],
    })
    const warning = submitted.warnings.find((entry) => entry.code === 'design-no-image')
    assert.ok(warning, 'a design submission without images must warn')
    assert.ok(warning.message.includes('截图'), `warning should mention 截图: ${warning.message}`)
    assert.ok(warning.message.includes('HTML') && warning.message.includes('不能替代截图'), `warning should say HTML cannot replace a screenshot: ${warning.message}`)
    assert.equal(warning.message.includes('HTML 截图'), false, 'the warning must not call HTML a screenshot')
  })

  await test('legacy six-stage document with all stages pending migrates acceptance to pending', async () => {
    const root = await workspace('migrate-pending')
    await writeRawPipeline(root, rawPipelineDocument(LEGACY_STAGE_IDS))
    const doc = await pipeline.readPipeline(root)
    assert.deepEqual(
      doc.stages.map((stage) => stage.id),
      STAGE_ORDER,
    )
    const acceptanceStage = doc.stages.find((stage) => stage.id === 'acceptance')
    assert.equal(acceptanceStage.status, 'pending')
    assert.equal(acceptanceStage.note, '')
    const listed = await pipeline.listPipeline(root)
    assert.equal(listed.total, 7)
    assert.equal(listed.currentStageId, 'product')
    assert.equal(listed.counts.pending, 7)
    // migration is idempotent: a second read keeps one acceptance stage
    const again = await pipeline.readPipeline(root)
    assert.equal(again.stages.filter((stage) => stage.id === 'acceptance').length, 1)
    assert.equal(again.stages.length, 7)
  })

  await test('legacy in-progress document keeps acceptance pending and blocks bypassing it', async () => {
    const root = await workspace('migrate-progress')
    await writeRawPipeline(
      root,
      rawPipelineDocument(LEGACY_STAGE_IDS, {
        product: 'approved',
        design: 'approved',
        development: 'approved',
        testing: 'approved',
      }),
    )
    const listed = await pipeline.listPipeline(root)
    assert.equal(listed.total, 7)
    assert.equal(listed.currentStageId, 'acceptance')
    assert.equal(listed.counts.pending, 3)
    const acceptanceStage = listed.stages.find((stage) => stage.id === 'acceptance')
    assert.equal(acceptanceStage.status, 'pending')
    // The old document cannot skip the new review gate: approval stays locked.
    await assert.rejects(pipeline.startStage(root, 'approval'), (error) => error.code === 'bad-order')
    // testing is already approved, so the new gate can run.
    const started = await pipeline.startStage(root, 'acceptance')
    assert.equal(started.status, 'active')
    await assert.rejects(pipeline.startStage(root, 'approval'), (error) => error.code === 'bad-order')
  })

  await test('legacy completed document migrates acceptance to approved with the migration note', async () => {
    const root = await workspace('migrate-completed')
    const statuses = Object.fromEntries(LEGACY_STAGE_IDS.map((stageId) => [stageId, 'approved']))
    await writeRawPipeline(
      root,
      rawPipelineDocument(LEGACY_STAGE_IDS, statuses, { title: '旧流程已完成项目', detail: '旧六关全部通过' }),
    )
    const listed = await pipeline.listPipeline(root)
    assert.equal(listed.complete, true)
    assert.equal(listed.currentStageId, null)
    assert.equal(listed.counts.approved, 7)
    const acceptanceStage = listed.stages.find((stage) => stage.id === 'acceptance')
    assert.equal(acceptanceStage.status, 'approved')
    assert.ok(
      acceptanceStage.note.includes(MIGRATION_NOTE),
      `migration note should contain "${MIGRATION_NOTE}", got: ${acceptanceStage.note}`,
    )
    // A finished old project must still allow the change-round entry point.
    const change = await pipeline.startChangeRound(root, {
      title: '迁移后新一轮',
      detail: '旧项目迁移后仍可发起变更轮',
      scope: 'full',
    })
    assert.equal(change.round, 2)
    assert.equal(change.nextStageId, 'product')
    assert.deepEqual(change.skippedStages, [])
    const after = await pipeline.readPipeline(root)
    assert.equal(after.stages.find((stage) => stage.id === 'acceptance').status, 'pending')
    assert.equal(after.history.length, 1)
  })

  await test('change round scopes include or skip acceptance correctly', async () => {
    const root = await workspace('change-scope')
    const approvedAll = Object.fromEntries(STAGE_ORDER.map((stageId) => [stageId, 'approved']))
    const runScope = async (scope) => {
      await writeRawPipeline(
        root,
        rawPipelineDocument(STAGE_ORDER, approvedAll, { title: `变更 ${scope}`, detail: '变更轮 scope 样本' }),
      )
      const result = await pipeline.startChangeRound(root, {
        title: `变更轮 ${scope}`,
        detail: '变更轮 scope 样本',
        scope,
      })
      const doc = await pipeline.readPipeline(root)
      return { result, acceptance: doc.stages.find((stage) => stage.id === 'acceptance') }
    }
    const full = await runScope('full')
    assert.ok(!full.result.skippedStages.includes('acceptance'))
    assert.equal(full.acceptance.status, 'pending')
    const development = await runScope('development')
    assert.ok(!development.result.skippedStages.includes('acceptance'))
    assert.deepEqual([...development.result.skippedStages].sort(), ['design', 'product'])
    assert.equal(development.acceptance.status, 'pending')
    for (const scope of ['release', 'product', 'design', 'product-design']) {
      const outcome = await runScope(scope)
      assert.ok(
        outcome.result.skippedStages.includes('acceptance'),
        `scope ${scope} should skip acceptance, got ${outcome.result.skippedStages.join(',')}`,
      )
      assert.equal(outcome.acceptance.status, 'approved', `scope ${scope} should mark acceptance approved`)
      assert.ok(outcome.acceptance.note.includes('跳过'), `scope ${scope} should record the skip note`)
    }
    const release = await runScope('release')
    assert.equal(release.result.nextStageId, 'approval')
    assert.ok(release.result.skippedStages.includes('acceptance'))
  })

  await test('acceptance dispatch and prompt wording describe the seven-stage dual review', async () => {
    const root = await workspace('acceptance-dispatch')
    await pipeline.setRequirement(root, { title: '七阶段双复核派发', detail: 'acceptance dispatch 检查' })
    const host = makeHost()
    pipeline.registerPipelineTools(host.ctx)
    const exec = execFor({ id: 'qa', session: { meta: { cwd: root } } }, signal)
    const dispatch = host.tools.find((definition) => definition.name === 'pipeline_dispatch')
    assert.ok(dispatch !== undefined)
    const result = await dispatch.execute({ stageId: 'acceptance' }, exec)
    assert.equal(result.stageId, 'acceptance')
    assert.equal(result.role, 'project-manager-agent')
    assert.equal(result.roleTitle, '项目经理 Agent')
    assert.equal(result.title, '验收复核')
    assert.ok(result.handbooks.includes('docs/opc/05-review.md'), `handbooks: ${result.handbooks.join(',')}`)
    assert.ok(result.handbooks.includes('docs/opc/00-charter.md'))
    assert.ok(result.prompt.includes('项目经理 Agent'))
    assert.ok(result.prompt.includes('验收复核'))
    assert.ok(result.prompt.includes('acceptance-review.md'))
    assert.ok(result.prompt.includes('只做什么'))
    assert.ok(result.prompt.includes('不做什么'))
    assert.ok(result.prompt.includes('不能自己审批'))
    assert.ok(result.prompt.includes('docs/opc/05-review.md'))
    const releaseDispatch = await dispatch.execute({ stageId: 'release' }, exec)
    assert.ok(releaseDispatch.handbooks.includes('docs/opc/06-ops.md'), `release handbooks: ${releaseDispatch.handbooks.join(',')}`)
    assert.ok(!releaseDispatch.handbooks.includes('docs/opc/05-ops.md'))
    // Build the acceptance stage prompt directly too: the review report is fixed.
    const doc = await pipeline.readPipeline(root)
    const acceptancePrompt = pipeline.buildStagePrompt(doc, 'acceptance')
    assert.ok(acceptancePrompt.includes('5/7'))
    assert.ok(acceptancePrompt.includes('验收复核'))
    assert.ok(acceptancePrompt.includes('项目经理 Agent'))
    assert.ok(acceptancePrompt.includes('acceptance-review.md'))
    // system prompt / tool descriptions: seven-stage dual review, no stale wording.
    assert.ok(pipeline.PIPELINE_SECTION.includes('双复核'))
    assert.ok(pipeline.PIPELINE_SECTION.includes('acceptance'))
    assert.ok(!pipeline.PIPELINE_SECTION.includes('六阶段'))
    assert.match(pipeline.PIPELINE_SECTION, /七阶段|七个阶段|七关|7 阶段/u)
    assert.match(pipeline.PIPELINE_SECTION, /四个中间阶段/u)
    assert.ok(pipeline.PIPELINE_SECTION.includes('设计确认（design）'))
    assert.ok(pipeline.PIPELINE_SECTION.includes('永远是人工闸门'))
    assert.equal(pipeline.PIPELINE_SECTION.includes('五个中间阶段'), false, 'PIPELINE_SECTION still says five intermediate stages')
    const descriptions = host.tools.map((definition) => `${definition.name} ${definition.description}`).join('\n')
    assert.ok(!/六阶段|六个阶段|six-stage|six stages/iu.test(descriptions), 'tool descriptions still mention the old six stages')
    assert.ok(!/five intermediate|五个中间/iu.test(descriptions), 'tool descriptions still say five intermediate stages')
    const statusDescription = host.tools.find((definition) => definition.name === 'pipeline_status').description
    assert.match(statusDescription, /seven-stage|七阶段|7 阶段/u)
    assert.ok(statusDescription.includes('acceptance'))
    assert.ok(statusDescription.includes('design'), 'pipeline_status should mention the design review gate')
    for (const name of ['pipeline_start_stage', 'pipeline_stage_prompt', 'pipeline_submit_stage', 'pipeline_dispatch']) {
      const definition = host.tools.find((candidate) => candidate.name === name)
      const enumValues = definition.parameters.properties.stageId.enum
      assert.ok(enumValues.includes('acceptance'), `${name} stageId enum must include acceptance`)
    }
    const submitDescription = host.tools.find((definition) => definition.name === 'pipeline_submit_stage').description
    assert.match(submitDescription, /four intermediate|四个中间/u)
    assert.ok(submitDescription.includes('design'))
    assert.ok(submitDescription.includes('acceptance'))
    assert.ok(submitDescription.includes('approval'))
    assert.ok(submitDescription.includes('release'))
  })

  await test('v1.2.85 pipeline trigger policy: workbench requests only, chat stays in the default flow', async () => {
    // The injected system-prompt section states the trigger rule up front.
    assert.ok(pipeline.PIPELINE_SECTION.includes('触发条件'))
    assert.match(pipeline.PIPELINE_SECTION, /工作台/u)
    assert.match(pipeline.PIPELINE_SECTION, /对话框（聊天）/u)
    assert.ok(pipeline.PIPELINE_SECTION.includes('默认方式直接完成'))
    assert.ok(pipeline.PIPELINE_SECTION.includes('不调用 pipeline_* 工具'))
    // The acceptance guide repeats the same scope so chat sessions skip the checklist.
    assert.ok(acceptance.ACCEPTANCE_SECTION.includes('触发条件'))
    assert.match(acceptance.ACCEPTANCE_SECTION, /对话框/u)
    // The entry tools carry the routing rule in their descriptions.
    const routeHost = makeHost()
    const disposeRoute = pipeline.registerPipelineTools(routeHost.ctx)
    for (const name of ['pipeline_set_requirement', 'pipeline_update_requirement', 'pipeline_start_stage', 'pipeline_dispatch']) {
      const description = routeHost.tools.find((definition) => definition.name === name).description
      assert.match(description, /workbench/iu, `${name} must scope the pipeline to workbench requests`)
      assert.match(description, /chat/iu, `${name} must scope the pipeline away from chat requests`)
    }
    disposeRoute()
    // The dynamic workspace briefing carries the routing line even when a project
    // already exists (a resumed chat session must not default to the full flow).
    const root = await workspace('pipeline-trigger')
    await writeRawPipeline(root, rawPipelineDocument(STAGE_ORDER, { product: 'approved' }, { title: '工作台需求' }))
    const briefingHost = makeHost()
    const disposeBriefing = workspaceState.registerWorkspaceStatePrompt(briefingHost.ctx, {})
    const briefing = briefingHost.contexts.find((context) => context.name === 'dsh-web-filebrowser:workspace-state')
    assert.ok(briefing !== undefined)
    const briefingText = briefing.text({ agent: { id: 'qa', session: { meta: { cwd: root } } } })
    assert.ok(briefingText.includes('流程约定'), 'workspace briefing must carry the pipeline trigger rule')
    assert.ok(briefingText.includes('对话框'), 'workspace briefing must mention chat requests')
    disposeBriefing()
  })

  await test('v1.2.88 session hygiene: one requirement per conversation, shipped in the prompt and briefing', async () => {
    // The injected section states the conversation rule, so a fresh install has it
    // without a per-workspace memory entry.
    assert.ok(pipeline.PIPELINE_SECTION.includes('会话与成本'))
    assert.ok(pipeline.PIPELINE_SECTION.includes('新建对话'))
    assert.ok(pipeline.PIPELINE_SECTION.includes('当前对话'))
    assert.ok(pipeline.PIPELINE_SECTION.includes('subagent'))
    assert.ok(pipeline.PIPELINE_SECTION.includes('/compact'))
    // A completed project's briefing suggests starting a new conversation.
    const root = await workspace('session-hygiene')
    const statuses = {}
    for (const id of STAGE_ORDER) statuses[id] = 'approved'
    await writeRawPipeline(root, rawPipelineDocument(STAGE_ORDER, statuses, { title: '已完成需求' }))
    const host = makeHost()
    const dispose = workspaceState.registerWorkspaceStatePrompt(host.ctx, {})
    const briefing = host.contexts.find((context) => context.name === 'dsh-web-filebrowser:workspace-state')
    assert.ok(briefing !== undefined)
    const text = briefing.text({ agent: { id: 'qa', session: { meta: { cwd: root } } } })
    assert.ok(text.includes('新建对话'), 'completed-project briefing must suggest a new conversation')
    dispose()
  })

  await test('v1.2.89 workspace reset only removes the plugin data allow-list', async () => {
    const root = await workspace('reset')
    const dsh = path.join(root, '.dsh')
    await fsp.mkdir(path.join(dsh, 'evidence'), { recursive: true })
    await fsp.mkdir(path.join(dsh, 'verifications'), { recursive: true })
    await fsp.mkdir(path.join(dsh, 'tmp'), { recursive: true })
    await fsp.writeFile(path.join(dsh, 'pipeline.json'), '{"version":1}')
    await fsp.writeFile(path.join(dsh, 'acceptance.json'), '{"version":1}')
    await fsp.writeFile(path.join(dsh, 'todos.json'), '{"items":[]}')
    await fsp.writeFile(path.join(dsh, 'memory.json'), '{"memories":[]}')
    await fsp.writeFile(path.join(dsh, 'evidence', 'shot.png'), 'png')
    await fsp.writeFile(path.join(dsh, 'tmp', 'cache.bin'), 'cache')
    // Unknown files in `.dsh` are not plugin data and must survive a reset.
    await fsp.writeFile(path.join(dsh, 'notes.txt'), 'keep me')
    const result = await resetWorkspaceDataAt(root)
    assert.deepEqual(result.failed, [], 'reset must not fail on the allow-list')
    for (const name of ['pipeline.json', 'acceptance.json', 'todos.json', 'memory.json', 'evidence', 'tmp']) {
      await assert.rejects(fsp.access(path.join(dsh, name)), `${name} must be removed by default`)
    }
    assert.ok((await fsp.stat(dsh)).isDirectory(), '.dsh itself must stay')
    assert.equal(await fsp.readFile(path.join(dsh, 'notes.txt'), 'utf8'), 'keep me', 'unknown files must stay')
    // keepMemory / keepTmp preserve exactly those entries.
    await fsp.writeFile(path.join(dsh, 'memory.json'), '{"memories":[]}')
    await fsp.mkdir(path.join(dsh, 'tmp'), { recursive: true })
    await fsp.writeFile(path.join(dsh, 'tmp', 'cache.bin'), 'cache')
    await resetWorkspaceDataAt(root, { keepMemory: true, keepTmp: true })
    assert.ok((await fsp.stat(path.join(dsh, 'memory.json'))).isFile(), 'keepMemory keeps memory.json')
    assert.ok((await fsp.stat(path.join(dsh, 'tmp'))).isDirectory(), 'keepTmp keeps .dsh/tmp')
    // A symlinked `.dsh` is refused rather than followed out of the workspace.
    const external = await workspace('reset-external')
    const linkRoot = await workspace('reset-link')
    await fsp.writeFile(path.join(external, 'pipeline.json'), '{}')
    await fsp.symlink(external, path.join(linkRoot, '.dsh'))
    await assert.rejects(resetWorkspaceDataAt(linkRoot), (error) => error?.code === 'unsafe')
    assert.ok((await fsp.stat(path.join(external, 'pipeline.json'))).isFile(), 'symlink target must be untouched')
    // A workspace without `.dsh` is a no-op instead of an error.
    const empty = await resetWorkspaceDataAt(await workspace('reset-empty'))
    assert.deepEqual(empty.removed, [])
  })

  await test('v1.2.73 stage prompts carry research/quality/license/security requirements', async () => {
    const doc = pipeline.emptyPipeline()
    const prompts = {}
    for (const stageId of ['product', 'design', 'development', 'acceptance']) {
      prompts[stageId] = pipeline.buildStagePrompt(doc, stageId)
    }
    const missing = (text, keys) => keys.filter((key) => !text.includes(key))
    const assertKeys = (stageId, keys) => {
      assert.deepEqual(missing(prompts[stageId], keys), [], `${stageId} prompt missing: ${missing(prompts[stageId], keys).join(', ')}`)
    }
    // Product manager: research ≥3 sources + borrow decision table + no fabrication.
    assertKeys('product', [
      '调研',
      '借鉴',
      'web_search',
      'web_fetch',
      '来源',
      '借鉴决策表',
      '已验证模式',
      '创新假设',
      '反抄袭',
      'blocked',
      '验收标准',
    ])
    // UI designer: research + the hard design standards + self-review/iteration.
    assertKeys('design', [
      '调研',
      '借鉴',
      'web_search',
      '4/8px',
      '字号阶梯',
      '行高',
      '对比度',
      '4.5:1',
      '3:1',
      '44×44',
      '状态矩阵',
      '360',
      '768',
      '1280',
      '150–300ms',
      'prefers-reduced-motion',
      'ARIA',
      '自检评分',
      '渲染→检查→修正',
      '迭代',
    ])
    // The literal term "rubric" lives in the designer handbook; the stage prompt
    // uses the equivalent 五维自检评分 wording (requirement §5.1 design row).
    assert.match(prompts.design, /自检评分|rubric/u)
    // Full-stack developer: candidate research, license matrix, security/performance.
    assertKeys('development', [
      '调研',
      '借鉴',
      'web_search',
      'web_fetch',
      'GitHub',
      '活跃',
      '许可证',
      'SPDX',
      'MIT',
      'Apache',
      'GPL',
      'AGPL',
      '无许可证',
      'engineering-research.md',
      'npm audit',
      'OSV',
      'CVE',
      '安全',
      '性能',
    ])
    // Acceptance review: the three new professional-quality checks.
    assertKeys('acceptance', [
      '调研',
      '借鉴',
      '来源',
      '借鉴决策表',
      '设计质量',
      '自检评分',
      '状态矩阵',
      '对比度',
      '44×44',
      'engineering-research.md',
      '许可证',
      'N/A',
      '专业质量',
      '建议打回',
    ])
    for (const marker of ['复核调研与借鉴', '复核设计质量', '复核工程调研与许可证']) {
      assert.ok(prompts.acceptance.includes(marker), `acceptance prompt missing ${marker}`)
    }
    // Injected system-prompt section: the team capability discipline is searchable.
    const sectionKeys = [
      '调研与借鉴纪律',
      '调研',
      '借鉴',
      'web_search',
      'web_fetch',
      '许可证',
      '安全',
      '对比度',
      '状态矩阵',
      '44×44',
      'engineering-research.md',
    ]
    const sectionMissing = sectionKeys.filter((key) => !pipeline.PIPELINE_SECTION.includes(key))
    assert.deepEqual(sectionMissing, [], `PIPELINE_SECTION missing: ${sectionMissing.join(', ')}`)
  })

  await test('change scopes can redo requirement/design only across seven stages', async () => {
    const root = await workspace('scopes')
    await pipeline.setRequirement(root, { title: 'Scope smoke', detail: 'A requirement detail' })
    await completeAllStages(root)
    const productChange = await pipeline.startChangeRound(root, {
      title: 'Requirement only',
      detail: 'new requirement detail',
      scope: 'product',
    })
    assert.equal(productChange.nextStageId, 'product')
    assert.deepEqual(
      [...productChange.skippedStages].sort(),
      ['acceptance', 'approval', 'design', 'development', 'release', 'testing'],
    )
    await approveStage(root, 'product')
    const designChange = await pipeline.startChangeRound(root, {
      title: 'Design only',
      detail: 'new design detail',
      scope: 'design',
    })
    assert.equal(designChange.nextStageId, 'design')
    assert.ok(designChange.skippedStages.includes('product'))
    assert.ok(designChange.skippedStages.includes('acceptance'))
    await approveStage(root, 'design')
    const bothChange = await pipeline.startChangeRound(root, {
      title: 'Requirement + design',
      detail: 'both detail',
      scope: 'product-design',
    })
    assert.equal(bothChange.nextStageId, 'product')
    assert.deepEqual(
      [...bothChange.skippedStages].sort(),
      ['acceptance', 'approval', 'development', 'release', 'testing'],
    )
    await approveStage(root, 'product')
    await approveStage(root, 'design')
    const finalDoc = await pipeline.readPipeline(root)
    assert.ok(finalDoc.stages.every((stage) => stage.status === 'approved'))
    assert.equal(finalDoc.stages.filter((stage) => stage.id === 'acceptance').length, 1)
  })
  /* ------------------------------------------------------------------ *
   * v1.2.75 workbench agent assignments (owner-only host ops)
   * ------------------------------------------------------------------ */

  await test('assignments expose the documented constants and empty board', async () => {
    assert.equal(assignments.ASSIGNMENTS_DIRNAME, '.dsh')
    assert.equal(assignments.ASSIGNMENTS_FILENAME, 'agent-assignments.json')
    assert.equal(assignments.ASSIGNMENTS_VERSION, 1)
    assert.equal(assignments.ASSIGNMENT_MAX_ITEMS, 100)
    assert.equal(assignments.ASSIGNMENT_MAX_BYTES, 1024 * 1024)
    assert.equal(assignments.ASSIGNMENT_MAX_TITLE, 120)
    assert.equal(assignments.ASSIGNMENT_MAX_DETAIL, 4000)
    assert.equal(assignments.ASSIGNMENT_MAX_ACCEPTANCE, 10)
    assert.deepEqual(assignments.ASSIGNMENT_STATUSES, ['dispatched', 'running', 'review', 'done', 'failed', 'cancelled'])
    assert.deepEqual(assignments.ASSIGNMENT_TERMINAL_STATUSES, ['done', 'failed', 'cancelled'])
    assert.deepEqual(assignments.ASSIGNMENT_ROLES, [
      'product-manager',
      'ui-designer',
      'fullstack-developer',
      'qa-engineer',
      'project-manager-agent',
      'devops',
    ])
    assert.deepEqual(assignments.ASSIGNMENT_STAGE_IDS, ['product', 'design', 'development', 'testing', 'acceptance'])
    assert.deepEqual(assignments.ASSIGNMENT_LOCKED_STAGE_IDS, ['approval', 'release'])
    assert.deepEqual(assignments.ASSIGNMENT_PRIORITIES, ['P0', 'P1', 'P2'])
    assert.deepEqual(assignments.emptyAssignments(), { version: 1, updatedAt: 0, items: [] })
    const root = await workspace('assign-empty')
    assert.equal(assignments.assignmentFile(root), path.join(root, '.dsh', 'agent-assignments.json'))
    const listed = await assignments.listAssignments(root)
    assert.deepEqual(listed.items, [])
    assert.equal(listed.total, 0)
    assert.deepEqual(listed.counts, { dispatched: 0, running: 0, review: 0, done: 0, failed: 0, cancelled: 0 })
    assert.deepEqual(listed.limits, { maxItems: 100, maxBytes: 1024 * 1024 })
    await assert.rejects(fsp.access(path.join(root, '.dsh')))
  })

  await test('assignmentSave persists a dispatched record and list returns newest first', async () => {
    const root = await workspace('assign-save')
    const pipelineDoc = pipeline.emptyPipeline()
    pipelineDoc.round = 4
    const pipelineFile = pipeline.pipelineFile(root)
    await fsp.mkdir(path.dirname(pipelineFile), { recursive: true })
    await fsp.writeFile(pipelineFile, `${JSON.stringify(pipelineDoc, null, 2)}\n`, 'utf8')

    const first = await assignments.saveAssignment(root, assignmentInput())
    assert.match(first.id, /^[0-9a-f]{10}$/u)
    assert.equal(first.round, 4, 'round is read from .dsh/pipeline.json')
    assert.equal(first.status, 'dispatched')
    assert.equal(first.title, '实现工作台指派器')
    assert.equal(first.detail.length > 0, true)
    assert.deepEqual(first.acceptance, ['产物落盘 + 自测通过'])
    assert.deepEqual(first.assignedTo, { role: 'qa-engineer' })
    assert.equal(first.stageId, '')
    assert.equal(first.priority, 'P1')
    assert.deepEqual(first.expectedArtifacts, [])
    assert.equal(first.note, '')
    assert.equal(first.createdAt > 0, true)
    assert.equal(first.updatedAt, first.createdAt)
    assert.equal(first.history.length, 1)
    assert.deepEqual(
      { status: first.history[0].status, actor: first.history[0].actor, note: first.history[0].note },
      { status: 'dispatched', actor: 'owner', note: '' },
    )

    await new Promise((resolve) => setTimeout(resolve, 5))
    const second = await assignments.saveAssignment(
      root,
      assignmentInput({
        title: '修复验收台筛选',
        acceptance: ['筛选结果正确', '刷新后仍保留'],
        assignedTo: { member: 'opc-dev' },
        stageId: 'testing',
        priority: 'P0',
        expectedArtifacts: ['docs/pipeline/test-report.md'],
      }),
    )
    const listed = await assignments.listAssignments(root)
    assert.equal(listed.total, 2)
    assert.equal(listed.items[0].id, second.id, 'newest updatedAt first')
    assert.equal(listed.items[1].id, first.id)
    assert.equal(listed.counts.dispatched, 2)
    assert.equal(listed.path, assignments.assignmentFile(root))
    assert.deepEqual(listed.items[0].assignedTo, { member: 'opc-dev' })
    assert.equal(listed.items[0].stageId, 'testing')
    assert.deepEqual(listed.items[0].expectedArtifacts, ['docs/pipeline/test-report.md'])

    const raw = JSON.parse(await fsp.readFile(assignments.assignmentFile(root), 'utf8'))
    assert.equal(raw.version, 1)
    assert.equal(raw.items.length, 2)
    assert.equal((await fsp.readFile(assignments.assignmentFile(root), 'utf8')).endsWith('\n'), true)
    assert.equal((await fsp.stat(assignments.assignmentFile(root))).mode & 0o777, 0o600)
    assert.equal(await fsp.readFile(path.join(root, '.dsh', '.gitignore'), 'utf8'), '*\n')
  })

  await test('assignmentSave enforces required fields, bounds, target exclusivity and role/stage/priority whitelists', async () => {
    const root = await workspace('assign-validate')
    const bad = (input, code) => rejectsWithCode(assignments.saveAssignment(root, input), code)
    await bad({}, 'bad-request')
    await bad(assignmentInput({ title: '' }), 'bad-request')
    await bad(assignmentInput({ title: 'x'.repeat(121) }), 'too-large')
    await bad(assignmentInput({ detail: '' }), 'bad-request')
    await bad(assignmentInput({ detail: 'x'.repeat(4001) }), 'too-large')
    await bad(assignmentInput({ acceptance: [] }), 'bad-request')
    await bad(assignmentInput({ acceptance: Array.from({ length: 11 }, (_value, index) => `c${String(index)}`) }), 'too-large')
    await bad(assignmentInput({ acceptance: ['x'.repeat(501)] }), 'too-large')
    await bad(assignmentInput({ acceptance: [''] }), 'bad-request')
    await bad(assignmentInput({ assignedTo: {} }), 'bad-request')
    await bad(assignmentInput({ assignedTo: { role: 'qa-engineer', member: 'opc-dev' } }), 'bad-request')
    await bad(assignmentInput({ assignedTo: { role: 'qa-engineer', newAgent: { name: 'opc-x', role: 'qa-engineer' } } }), 'bad-request')
    await bad(assignmentInput({ assignedTo: { role: 'unknown-role' } }), 'bad-request')
    await bad(assignmentInput({ assignedTo: { newAgent: { name: 'opc-x', role: 'nope' } } }), 'bad-request')
    await bad(assignmentInput({ stageId: 'approval' }), 'bad-request')
    await bad(assignmentInput({ stageId: 'release' }), 'bad-request')
    await bad(assignmentInput({ stageId: 'nope' }), 'bad-request')
    await bad(assignmentInput({ priority: 'P9' }), 'bad-request')
    await bad(
      assignmentInput({ expectedArtifacts: Array.from({ length: 11 }, (_value, index) => `docs/${String(index)}.md`) }),
      'too-large',
    )
    // Failed validations never create the board file.
    await assert.rejects(fsp.access(assignments.assignmentFile(root)))

    const role = await assignments.saveAssignment(root, assignmentInput())
    assert.deepEqual(role.assignedTo, { role: 'qa-engineer' })
    const member = await assignments.saveAssignment(root, assignmentInput({ assignedTo: { member: 'opc-dev' } }))
    assert.deepEqual(member.assignedTo, { member: 'opc-dev' })
    const newAgent = await assignments.saveAssignment(
      root,
      assignmentInput({ assignedTo: { newAgent: { name: 'opc-qa-2', role: 'qa-engineer' } } }),
    )
    assert.deepEqual(newAgent.assignedTo, { newAgent: { name: 'opc-qa-2', role: 'qa-engineer' } })
    const auto = await assignments.saveAssignment(root, assignmentInput({ stageId: 'auto', priority: 'P0' }))
    assert.equal(auto.stageId, 'auto')
    assert.equal(auto.priority, 'P0')
  })

  await test('assignmentUpdate follows the state machine and records history', async () => {
    const root = await workspace('assign-state')
    const created = await assignments.saveAssignment(root, assignmentInput())
    const running = await assignments.updateAssignment(root, { id: created.id, status: 'running', note: 'Lead 已接单' })
    assert.equal(running.status, 'running')
    assert.equal(running.updatedAt >= created.updatedAt, true)
    assert.equal(running.history.length, 2)
    assert.deepEqual(
      { status: running.history[1].status, note: running.history[1].note, actor: running.history[1].actor },
      { status: 'running', note: 'Lead 已接单', actor: 'owner' },
    )
    const review = await assignments.updateAssignment(root, { id: created.id, status: 'review', note: '产物已就绪' })
    assert.equal(review.status, 'review')
    const done = await assignments.updateAssignment(root, { id: created.id, status: 'done', note: 'Owner 通过并完成' })
    assert.equal(done.status, 'done')
    assert.equal(done.history.length, 4)

    const second = await assignments.saveAssignment(root, assignmentInput({ title: '催办样例' }))
    const nudged = await assignments.updateAssignment(root, { id: second.id, note: '请尽快接单' })
    assert.equal(nudged.status, 'dispatched', 'nudge keeps the status')
    assert.equal(nudged.history.length, 2)
    assert.equal(nudged.history[1].note, '请尽快接单')
  })

  await test('assignmentUpdate rejects illegal transitions and leaves the file unchanged', async () => {
    const root = await workspace('assign-transition')
    const item = await assignments.saveAssignment(root, assignmentInput())
    const file = assignments.assignmentFile(root)
    const before = await fsp.readFile(file, 'utf8')
    await rejectsWithCode(assignments.updateAssignment(root, { id: item.id, status: 'done' }), 'bad-transition')
    await rejectsWithCode(assignments.updateAssignment(root, { id: item.id, status: 'review' }), 'bad-transition')
    assert.equal(await fsp.readFile(file, 'utf8'), before)
    await assignments.updateAssignment(root, { id: item.id, status: 'cancelled', note: '范围调整' })
    await rejectsWithCode(assignments.updateAssignment(root, { id: item.id, status: 'running' }), 'bad-transition')
    await rejectsWithCode(assignments.updateAssignment(root, { id: item.id, note: '迟到催办' }), 'bad-transition')
    await rejectsWithCode(
      assignments.updateAssignment(root, { id: item.id, status: 'failed', note: 'x' }),
      'bad-transition',
    )
  })

  await test('assignmentUpdate requires a note when failing and supports cancel', async () => {
    const root = await workspace('assign-fail')
    const item = await assignments.saveAssignment(root, assignmentInput())
    await rejectsWithCode(assignments.updateAssignment(root, { id: item.id, status: 'failed' }), 'bad-request')
    await rejectsWithCode(assignments.updateAssignment(root, { id: item.id, status: 'failed', note: '   ' }), 'bad-request')
    const failed = await assignments.updateAssignment(root, { id: item.id, status: 'failed', note: '缺少截图与复测' })
    assert.equal(failed.status, 'failed')
    assert.equal(failed.note, '缺少截图与复测')
    assert.equal(failed.history.at(-1).status, 'failed')
    assert.equal(failed.history.at(-1).note, '缺少截图与复测')
    await rejectsWithCode(assignments.updateAssignment(root, { id: item.id, status: 'running' }), 'bad-transition')

    const second = await assignments.saveAssignment(root, assignmentInput({ title: '取消样例' }))
    const cancelled = await assignments.updateAssignment(root, { id: second.id, status: 'cancelled' })
    assert.equal(cancelled.status, 'cancelled')
    assert.equal(cancelled.history.at(-1).status, 'cancelled')
  })

  await test('assignmentDelete only removes terminal records and validates ids', async () => {
    const root = await workspace('assign-delete')
    const item = await assignments.saveAssignment(root, assignmentInput())
    await rejectsWithCode(assignments.deleteAssignment(root, item.id), 'bad-status')
    await rejectsWithCode(assignments.deleteAssignment(root, 'short'), 'bad-id')
    await rejectsWithCode(assignments.deleteAssignment(root, 'aaaaaaaaaa'), 'not-found')
    await assignments.updateAssignment(root, { id: item.id, status: 'cancelled' })
    const removed = await assignments.deleteAssignment(root, item.id)
    assert.deepEqual(removed, { removed: item.id })
    assert.equal((await assignments.listAssignments(root)).total, 0)
    await rejectsWithCode(assignments.deleteAssignment(root, item.id), 'not-found')
  })

  await test('assignment board is capped at 100 records with the full error code', async () => {
    const root = await workspace('assign-full')
    const items = Array.from({ length: 100 }, (_value, index) => ({
      id: `id${String(index).padStart(8, '0')}`,
      title: `历史记录 ${String(index)}`,
      assignedTo: { role: 'qa-engineer' },
      status: 'dispatched',
      createdAt: 1000 + index,
      updatedAt: 1000 + index,
      history: [],
    }))
    await writeRawAssignments(root, { version: 1, updatedAt: 1, items })
    await rejectsWithCode(assignments.saveAssignment(root, assignmentInput()), 'full')
    assert.equal((await assignments.listAssignments(root)).total, 100)
  })

  await test('assignment board rejects corrupt and oversized documents without clearing them', async () => {
    const corruptRoot = await workspace('assign-corrupt')
    await writeRawAssignments(corruptRoot, '{not json')
    const corruptError = await assignments.readAssignments(corruptRoot).catch((error) => error)
    assert.equal(corruptError.code, 'corrupt')
    assert.ok(String(corruptError.message).includes(assignments.assignmentFile(corruptRoot)))
    assert.equal(await fsp.readFile(assignments.assignmentFile(corruptRoot), 'utf8'), '{not json')
    await writeRawAssignments(corruptRoot, JSON.stringify(assignments.emptyAssignments()))
    assert.equal((await assignments.listAssignments(corruptRoot)).total, 0)

    const largeRoot = await workspace('assign-large')
    const largeFile = assignments.assignmentFile(largeRoot)
    await fsp.mkdir(path.dirname(largeFile), { recursive: true })
    await fsp.writeFile(largeFile, `{"items": "${'x'.repeat(1024 * 1024)}"}`, 'utf8')
    await rejectsWithCode(assignments.readAssignments(largeRoot), 'too-large')
  })

  await test('assignment ops reject SSH roots and relative roots consistently', async () => {
    const sshRoot = 'ssh://user@host:22/srv/app'
    await rejectsWithCode(assignments.listAssignments(sshRoot), 'ssh-unsupported')
    await rejectsWithCode(assignments.readAssignments(sshRoot), 'ssh-unsupported')
    await rejectsWithCode(assignments.saveAssignment(sshRoot, assignmentInput()), 'ssh-unsupported')
    await rejectsWithCode(
      assignments.updateAssignment(sshRoot, { id: 'aaaaaaaaaa', status: 'running' }),
      'ssh-unsupported',
    )
    await rejectsWithCode(assignments.deleteAssignment(sshRoot, 'aaaaaaaaaa'), 'ssh-unsupported')
    await rejectsWithCode(assignments.listAssignments('relative/workspace'), 'bad-root')
  })

  await test('assigning never writes .dsh/pipeline.json (hash unchanged across the full lifecycle)', async () => {
    const root = await workspace('assign-pipeline')
    await pipeline.setRequirement(root, { title: '指派不改流水线', detail: '关联阶段任务只读 round' })
    await pipeline.startStage(root, 'product')
    const pipelineFile = pipeline.pipelineFile(root)
    const beforeHash = await sha256File(pipelineFile)
    const item = await assignments.saveAssignment(root, assignmentInput({ stageId: 'testing' }))
    assert.equal(item.status, 'dispatched')
    await assignments.updateAssignment(root, { id: item.id, status: 'running' })
    await assignments.updateAssignment(root, { id: item.id, status: 'review' })
    await assignments.updateAssignment(root, { id: item.id, status: 'done' })
    const temp = await assignments.saveAssignment(root, assignmentInput({ title: '临时任务', stageId: '' }))
    await assignments.updateAssignment(root, { id: temp.id, status: 'failed', note: '不达标' })
    await assignments.deleteAssignment(root, temp.id)
    const afterHash = await sha256File(pipelineFile)
    assert.equal(afterHash, beforeHash, 'pipeline.json bytes must not change')
    await rejectsWithCode(assignments.saveAssignment(root, assignmentInput({ stageId: 'approval' })), 'bad-request')
    await rejectsWithCode(assignments.saveAssignment(root, assignmentInput({ stageId: 'release' })), 'bad-request')
  })

  await test('ten concurrent assignment saves all persist without corruption', async () => {
    const root = await workspace('assign-concurrent')
    await Promise.all(
      Array.from({ length: 10 }, (_value, index) =>
        assignments.saveAssignment(root, assignmentInput({ title: `并发任务 ${String(index)}` })),
      ),
    )
    const listed = await assignments.listAssignments(root)
    assert.equal(listed.total, 10)
    assert.equal(new Set(listed.items.map((item) => item.id)).size, 10)
    const raw = JSON.parse(await fsp.readFile(assignments.assignmentFile(root), 'utf8'))
    assert.equal(raw.items.length, 10)
    const leftovers = (await fsp.readdir(path.join(root, '.dsh'))).filter((name) => name.endsWith('.tmp'))
    assert.deepEqual(leftovers, [], 'atomic writes leave no temp files behind')
  })

  await test('no assignment model tools are registered and index.js wires the four owner-only ops', async () => {
    const host = makeHost()
    apply(host.ctx)
    await new Promise((resolve) => setTimeout(resolve, 0))
    const names = host.tools.map((definition) => definition.name)
    assert.equal(names.filter((name) => /assignment/iu.test(name)).length, 0, 'assignments must stay owner-only')
    assert.equal(host.tools.length, 36)
    assert.equal(host.routes.length, 10)
    const indexSource = await fsp.readFile(new URL('../../dsh-web-filebrowser-plugin/index.js', import.meta.url), 'utf8')
    for (const op of ['assignmentList', 'assignmentSave', 'assignmentUpdate', 'assignmentDelete']) {
      assert.ok(indexSource.includes(`case '${op}':`), `index.js must wire ${op}`)
    }
  })

  await test('packaging keeps the pipeline snapshot so the workbench does not collapse to the intake view', async () => {
    // Regression: runPackDelivery() used to clear pipelineDoc/pipelineError right
    // before packaging. The workbench derives `hasProject` from
    // pipelineDoc.requirement.title, so the page collapsed to the "需求录入"
    // intake card and its scroll position jumped to the top until the next poll.
    const clientSource = await fsp.readFile(new URL('../../dsh-web-filebrowser-plugin/client.js', import.meta.url), 'utf8')
    const start = clientSource.indexOf('async function runPackDelivery()')
    assert.ok(start > 0, 'client.js must define runPackDelivery()')
    const end = clientSource.indexOf('/** Download a previously written delivery bundle', start)
    assert.ok(end > start, 'runPackDelivery() body end must be found')
    const body = clientSource.slice(start, end)
    assert.equal(body.includes('setPipelineDoc('), false, 'packaging must not clear pipelineDoc')
    assert.equal(body.includes('setPipelineError('), false, 'packaging must not clear the pipeline error state')
    assert.equal(body.includes('setPipelineEditing('), false, 'packaging must not reset the pipeline editor')
    assert.ok(body.includes('setDeliveryBusy(true)'), 'packaging must expose its busy state')
    assert.ok(body.includes('loadDeliveryHistory()'), 'packaging must refresh the delivery history')
    // The busy indicator must say "packing", not the generic "saving".
    assert.ok(clientSource.includes("'acceptance.packing': '打包中…'"))
    assert.ok(clientSource.includes("'acceptance.packing': 'Packing…'"))
    assert.ok(clientSource.split("t('acceptance.packing')").length - 1 >= 2, 'both pack buttons use the packing label')
    assert.equal(clientSource.includes("deliveryBusy ? t('acceptance.saving')"), false, 'no pack button falls back to the saving label')
  })

} finally {
  for (const root of roots) {
    await fsp.rm(root, { recursive: true, force: true }).catch(() => {})
  }
  const failed = results.filter((ok) => !ok).length
  console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'}: ${String(results.length - failed)}/${String(results.length)} host smoke checks`)
  if (failed > 0) process.exitCode = 1
}
