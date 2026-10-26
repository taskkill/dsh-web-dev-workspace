/**
 * Host smoke tests for the v1.2.68 agent-first feature batch.
 *
 * Run with: `npm test`
 *
 * These tests are intentionally dependency-free (no test framework, no build)
 * and cover the seams the deeper module selftests in `.dsh/tmp/team/` cannot:
 * the plugin `apply()` wiring (model tools + routes), the acceptance evidence
 * chain, the pipeline review baseline and delivery evidence bundling.
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
} finally {
  for (const root of roots) {
    await fsp.rm(root, { recursive: true, force: true }).catch(() => {})
  }
  const failed = results.filter((ok) => !ok).length
  console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'}: ${String(results.length - failed)}/${String(results.length)} host smoke checks`)
  if (failed > 0) process.exitCode = 1
}
