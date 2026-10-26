/**
 * Host smoke tests for the v1.2.72 seven-stage dual-review feature batch.
 *
 * Run with: `npm test`
 *
 * These tests are intentionally dependency-free (no test framework, no build)
 * and cover the seams the deeper module selftests in `.dsh/tmp/team/` cannot:
 * the plugin `apply()` wiring (model tools + routes), the acceptance evidence
 * chain, the pipeline review baseline and delivery evidence bundling. The
 * v1.2.72 additions cover the seven-stage constant (product → design →
 * development → testing → acceptance → approval → release), the new AI
 * acceptance-review gate, the fast-mode five-intermediate auto-approval, the
 * six-stage legacy migration and the change-round scope.
 */

import assert from 'node:assert/strict'
import { promises as fsp } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import * as acceptance from '../../dsh-web-filebrowser-plugin/acceptance.js'
import * as agentTools from '../../dsh-web-filebrowser-plugin/agent-tools.js'
import * as delivery from '../../dsh-web-filebrowser-plugin/delivery.js'
import * as pipeline from '../../dsh-web-filebrowser-plugin/pipeline.js'
import * as review from '../../dsh-web-filebrowser-plugin/review.js'
import * as workspaceState from '../../dsh-web-filebrowser-plugin/workspace-state.js'
import { apply } from '../../dsh-web-filebrowser-plugin/index.js'

const results = []
const roots = []

/** The fixed seven-stage order of v1.2.72. */
const STAGE_ORDER = ['product', 'design', 'development', 'testing', 'acceptance', 'approval', 'release']

/** The six stages written by documents before v1.2.72 (no acceptance). */
const LEGACY_STAGE_IDS = STAGE_ORDER.filter((stageId) => stageId !== 'acceptance')

/** Migration note the Host writes on a legacy completed document. */
const MIGRATION_NOTE = '升级迁移：验收复核为更新新增，旧流程已完成'

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

  await test('fast mode auto-approves five intermediate stages, acceptance next is approval', async () => {
    const root = await workspace('fast-mode')
    await pipeline.setRequirement(root, { title: '快速模式双复核', detail: '五中间阶段自动，approval/release 人工' })
    await pipeline.setGateMode(root, 'fast')
    const chain = [
      ['product', 'design'],
      ['design', 'development'],
      ['development', 'testing'],
      ['testing', 'acceptance'],
      ['acceptance', 'approval'],
    ]
    for (const [stageId, nextStageId] of chain) {
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
    assert.match(pipeline.PIPELINE_SECTION, /五(?:个)?中间阶段/u)
    const descriptions = host.tools.map((definition) => `${definition.name} ${definition.description}`).join('\n')
    assert.ok(!/六阶段|六个阶段|six-stage|six stages/iu.test(descriptions), 'tool descriptions still mention the old six stages')
    const statusDescription = host.tools.find((definition) => definition.name === 'pipeline_status').description
    assert.match(statusDescription, /seven-stage|七阶段|7 阶段/u)
    assert.ok(statusDescription.includes('acceptance'))
    for (const name of ['pipeline_start_stage', 'pipeline_stage_prompt', 'pipeline_submit_stage', 'pipeline_dispatch']) {
      const definition = host.tools.find((candidate) => candidate.name === name)
      const enumValues = definition.parameters.properties.stageId.enum
      assert.ok(enumValues.includes('acceptance'), `${name} stageId enum must include acceptance`)
    }
    const submitDescription = host.tools.find((definition) => definition.name === 'pipeline_submit_stage').description
    assert.match(submitDescription, /five intermediate|五个中间/u)
    assert.ok(submitDescription.includes('acceptance'))
    assert.ok(submitDescription.includes('approval'))
    assert.ok(submitDescription.includes('release'))
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
} finally {
  for (const root of roots) {
    await fsp.rm(root, { recursive: true, force: true }).catch(() => {})
  }
  const failed = results.filter((ok) => !ok).length
  console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'}: ${String(results.length - failed)}/${String(results.length)} host smoke checks`)
  if (failed > 0) process.exitCode = 1
}
