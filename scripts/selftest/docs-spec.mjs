/**
 * Docs spec: keep the agent-facing contract in `docs/AGENT_TEAM.md` in sync with
 * the model tools the plugin actually registers, and keep the injected prompt
 * sections inside their token budget.
 *
 * Run with `npm test` (wired after the host/client/group selftests).
 *
 * Why this exists: the tool table and the stage list in `docs/AGENT_TEAM.md` are
 * what the Owner and the dispatched roles read before a delivery. When a tool is
 * renamed or a prompt section grows, nothing else fails — the doc just drifts
 * silently. Borrowed from the dsh-superagent-prototype `tests/docs.spec.ts`
 * discipline (see `docs/proposals/SUPERAGENT_BORROWING.md`), reduced to the two
 * checks that cost nothing at runtime.
 */

import assert from 'node:assert/strict'
import { promises as fsp } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as pipeline from '../../dsh-web-filebrowser-plugin/pipeline.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const pluginDir = path.join(root, 'dsh-web-filebrowser-plugin')
const teamDoc = path.join(root, 'docs/AGENT_TEAM.md')

/** Token budgets for the two injected system-prompt sections (characters). */
const SECTION_BUDGETS = [
  ['pipeline system section', () => pipeline.PIPELINE_SECTION, 1400],
]

/**
 * Quality anchors: the discipline that used to be duplicated inside the injected
 * system-prompt section now lives only in the per-stage role prompt (v1.2.105
 * moved it there to stop paying for it on every request). These keyword sets make
 * that move safe: if a later edit drops the research / design / license / evidence
 * discipline from a role prompt, this check fails instead of the quality silently
 * degrading. Do not "fix" a failure by deleting an anchor — restore the text.
 */
const QUALITY_ANCHORS = {
  product: ['调研', '借鉴', 'web_search', 'web_fetch', '≥3', '借鉴决策表', '反抄袭', '验收标准'],
  design: ['调研', 'web_search', '4.5:1', '3:1', '44×44', '状态矩阵', '360/768/1280', '150–300ms', 'ARIA', '自检评分', 'before / after'],
  development: ['GitHub', '许可证', 'SPDX', 'GPL', 'AGPL', '无许可证', 'engineering-research.md', 'npm audit', 'CVE'],
  testing: ['正常、异常、边界、回归', '复现步骤', 'acceptance_update', 'before / after'],
  acceptance: ['复核调研与借鉴', '复核设计质量', '复核工程调研与许可证', '复核 UI 变更证据', '建议打回', '重跑'],
}

const results = []

/**
 * Run one check.
 * @param name - short check name.
 * @param body - sync or async assertion body.
 */
async function check(name, body) {
  try {
    await body()
    results.push(true)
    console.log(`ok   ${name}`)
  } catch (error) {
    results.push(false)
    console.log(`FAIL ${name}\n     ${error instanceof Error ? error.message : String(error)}`)
  }
}

/** Every tool name the plugin registers, matched by its `name: '...'` literal. */
async function registeredToolNames() {
  const names = new Set()
  const files = (await fsp.readdir(pluginDir)).filter((file) => file.endsWith('.js'))
  for (const file of files) {
    const text = await fsp.readFile(path.join(pluginDir, file), 'utf8')
    for (const match of text.matchAll(/\bname: '([a-z][a-z0-9_]*)'/gu)) names.add(match[1])
  }
  return names
}

const doc = await fsp.readFile(teamDoc, 'utf8')

await check('docs/AGENT_TEAM.md documents every pipeline/acceptance tool', async () => {
  const names = await registeredToolNames()
  const expected = [...names].filter((name) => /^(pipeline|acceptance|evidence|delivery|workspace)_/u.test(name))
  assert.ok(expected.length >= 10, `expected at least 10 agent-facing tools, found ${String(expected.length)}`)
  const missing = expected.filter((name) => !doc.includes(name))
  assert.deepEqual(missing, [], `docs/AGENT_TEAM.md is missing: ${missing.join(', ')}`)
})

await check('docs/AGENT_TEAM.md lists all seven stages and the manual gates', async () => {
  for (const stage of pipeline.PIPELINE_STAGES) {
    assert.ok(doc.includes(stage.id), `docs/AGENT_TEAM.md is missing stage id ${stage.id}`)
    assert.ok(doc.includes(stage.title), `docs/AGENT_TEAM.md is missing stage title ${stage.title}`)
  }
  for (const stageId of pipeline.PIPELINE_MANUAL_GATE_STAGES) {
    assert.ok(doc.includes(stageId), `docs/AGENT_TEAM.md is missing manual gate ${stageId}`)
  }
})

await check('every role handbook path in STAGE_HANDBOOKS exists', async () => {
  const entries = Object.entries(pipeline.STAGE_HANDBOOKS)
  assert.equal(entries.length, pipeline.PIPELINE_STAGES.length)
  for (const [stageId, handbooks] of entries) {
    assert.ok(handbooks.length > 0, `${stageId} has no handbook`)
    for (const handbook of handbooks) {
      const absolute = path.join(root, handbook)
      const info = await fsp.stat(absolute).catch(() => null)
      assert.ok(info !== null && info.isFile(), `${stageId} handbook missing: ${handbook}`)
    }
  }
})

await check('docs/AGENT_TEAM.md keeps a Rejected concepts section', async () => {
  assert.match(doc, /Rejected concepts|不采纳/iu, 'docs/AGENT_TEAM.md must record what the design refuses to add')
})

await check('injected prompt sections stay inside the token budget', async () => {
  for (const [label, read, budget] of SECTION_BUDGETS) {
    const text = read()
    assert.ok(
      text.length <= budget,
      `${label} is ${String(text.length)} chars, budget is ${String(budget)}: move detail into the stage handbooks instead of the system prompt`,
    )
  }
  // The small section must still point at where the detail lives.
  assert.ok(
    pipeline.PIPELINE_SECTION.includes('pipeline_stage_prompt'),
    'the trimmed pipeline section must point at pipeline_stage_prompt',
  )
})

await check('role prompts keep the research/design/license/evidence quality anchors', async () => {
  const doc = pipeline.emptyPipeline()
  const missing = []
  for (const [stageId, keys] of Object.entries(QUALITY_ANCHORS)) {
    const prompt = pipeline.buildStagePrompt(doc, stageId)
    for (const key of keys) {
      if (!prompt.includes(key)) missing.push(`${stageId}:${key}`)
    }
  }
  assert.deepEqual(missing, [], `role prompt lost quality anchors: ${missing.join(', ')}`)
})

await check('starting a stage points at pipeline_stage_prompt', async () => {
  const source = await fsp.readFile(path.join(pluginDir, 'pipeline.js'), 'utf8')
  assert.ok(
    /Call pipeline_stage_prompt for this stage before doing any work/u.test(source),
    'pipeline_start_stage must tell the agent to fetch the role prompt before working',
  )
})

const failed = results.filter((result) => result !== true).length
console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'}: docs spec ${String(results.length - failed)}/${String(results.length)} checks`)
if (failed > 0) process.exitCode = 1
