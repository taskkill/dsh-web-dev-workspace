/**
 * Session-group Host selftest (v1.1).
 *
 * Exercises the Host half without a running Harness: a fake Cordis context
 * provides the Session controller/services, the workspace registry, the Session
 * event feed and the tool registry. The test covers the owner route surface,
 * delivery framing, reply capture, member tools and permissions, reconcile and
 * corrupt-file handling.
 *
 * Run through `npm test` or directly:
 *   node scripts/selftest/groups-host-selftest.mjs
 */

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createGroupManager, GROUP_ROUTE_OPS } from '../../dsh-web-filebrowser-plugin/groups.js'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const workspace = await mkdtemp(path.join(os.tmpdir(), 'dsh-groups-host-'))
const groupFile = path.join(workspace, '.dsh', 'groups.json')

let failures = 0
function check(name, condition, detail) {
  if (condition) {
    console.log(`ok   ${name}`)
    return
  }
  failures += 1
  console.log(`FAIL ${name}${detail === undefined ? '' : ` — ${String(detail)}`}`)
}

async function waitFor(predicate, timeoutMs = 3000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) return true
    await new Promise((resolve) => setTimeout(resolve, 15))
  }
  return false
}

const agents = new Map()
const followups = []
const listeners = []
const liveEvents = new Map()
function makeAgent(id) {
  return {
    id,
    session: { id, meta: { cwd: workspace } },
    followup(message) {
      followups.push({ sessionId: id, message })
    },
  }
}
for (const id of ['ses_a', 'ses_b', 'ses_c']) agents.set(id, makeAgent(id))

const ctx = {
  get(name) {
    if (name === 'sessionController') {
      return {
        async resolveAgent(sessionId) {
          const agent = agents.get(sessionId)
          return agent ?? { error: { code: 'session/not-found', message: 'missing' } }
        },
      }
    }
    if (name === 'sessions') return { async flush() { return true } }
    if (name === 'sessionQuery') {
      return {
        async readSession(sessionId) {
          return { events: liveEvents.get(sessionId) ?? [] }
        },
      }
    }
    if (name === 'workspaceRegistry') {
      return { list() { return [{ path: workspace, sessionIds: [...agents.keys()] }] } }
    }
    return undefined
  },
  on(event, handler) {
    if (event !== 'session/event') return () => {}
    listeners.push(handler)
    return () => {
      const index = listeners.indexOf(handler)
      if (index >= 0) listeners.splice(index, 1)
    }
  },
}

const manager = createGroupManager({
  ctx,
  resolveRoot: async (_ctx, requested) => requested ?? workspace,
  logger: { warn() {}, info() {} },
})
const disposeCapture = manager.listenSessionEvents()
const emit = (sessionId, event) => {
  for (const listener of listeners) listener({ id: sessionId, meta: { cwd: workspace } }, event)
}

function route(op, body) {
  return manager.handleRoute(op, { root: workspace, ...body })
}
function toolDefinitions() {
  const definitions = new Map()
  manager.registerTools({
    tools: {
      register(definition) {
        definitions.set(definition.name, definition)
        return () => {}
      },
    },
  })
  return definitions
}

const created = await route('groupCreate', {
  name: '项目交付 A 组',
  goal: '登录页改版',
  members: [
    { sessionId: 'ses_a', label: '产品' },
    { sessionId: 'ses_b', label: '开发' },
  ],
})
check('groupCreate returns id', typeof created.groupId === 'string' && created.groupId.startsWith('grp_'))
check('groupCreate normalizes members', created.group.members.length === 2)

const listed = await route('groupList')
check('groupList returns document', listed.groups.length === 1 && listed.groups[0].members.length === 2)
check('group file and gitignore created', (await readFile(groupFile, 'utf8')).includes('项目交付 A 组'))

const sent = await route('groupSend', { groupId: created.groupId, text: '请一起看登录页' })
check('groupSend returns message id', typeof sent.messageId === 'string')
check('groupSend delivered to both members', sent.deliveries.length === 2 && sent.deliveries.every((entry) => entry.state === 'delivered'))
check('delivery woke both agents', followups.length === 2)
const frameA = followups.find((entry) => entry.sessionId === 'ses_a').message
check('delivery frame has marker', String(frameA.content?.[0]?.text).includes(`#${sent.messageId}】`))
check('delivery frame has untrusted warning', String(frameA.content?.[0]?.text).includes('未受信任'))
check('delivery frame user-role source', frameA.role === 'user' && typeof frameA.source?.kind === 'string')

const markerA = String(followups.find((entry) => entry.sessionId === 'ses_a').message.content[0].text)
emit('ses_a', { type: 'turn/start', seq: 1, data: { turn: 1 } })
emit('ses_a', { type: 'user/message', seq: 2, data: { content: [{ type: 'text', text: markerA }], source: { kind: 'user' } } })
emit('ses_a', { type: 'assistant/message', seq: 3, data: { turn: 1, message: { content: [{ type: 'text', text: '收到，我先看兼容范围' }] } } })
emit('ses_a', { type: 'turn/end', seq: 4, data: { turn: 1, reason: 'completed' } })
check(
  'reply captured into the group',
  await waitFor(async () => {
    const doc = await route('groupList')
    return doc.groups[0].messages.length >= 2
  }, 4000),
)
let document = await route('groupList')
check('reply message is member-authored', document.groups[0].messages[1].kind === 'member' && document.groups[0].messages[1].memberSessionId === 'ses_a')
check('reply text captured', document.groups[0].messages[1].text === '收到，我先看兼容范围')
check('delivery marked replied', document.groups[0].messages[0].deliveries[0].state === 'replied')

const tools = toolDefinitions()
check('six group tools registered', ['group_list', 'group_inbox', 'group_send', 'group_handoff', 'group_task_update', 'group_task_claim'].every((name) => tools.has(name)))

const execA = { agent: agents.get('ses_a') }
const toolList = await tools.get('group_list').execute({}, execA)
check('group_list returns member groups', toolList.result.groups.length === 1 && toolList.result.groups[0].members.some((member) => member.isMe))
const inbox = await tools.get('group_inbox').execute({ group: '项目交付 A 组' }, execA)
check('group_inbox returns messages', inbox.result.messages.length >= 2 && inbox.result.group.id === created.groupId)

const pendingHandoff = await tools.get('group_handoff').execute(
  { group: created.groupId, to: '产品', title: '补范围清单', acceptance: ['列出旧会话'] },
  { agent: agents.get('ses_b') },
)
check('group_handoff creates a task', pendingHandoff.result.taskId !== undefined && pendingHandoff.result.deliveries[0]?.state === 'delivered')
const taskId = pendingHandoff.result.taskId
const handoffDocument = await route('groupList')
const handoffTask = handoffDocument.groups[0].tasks.find((task) => task.id === taskId)
check('handoff task assigned to target', handoffTask?.assigneeSessionId === 'ses_a' && handoffTask?.state === 'delivered')
const review = await tools.get('group_task_update').execute({ group: created.groupId, taskId, state: 'review', note: '初稿完成' }, execA)
check('assignee can move task to review', review.result.task.state === 'review')
let forbidden = null
try {
  await tools.get('group_task_update').execute({ group: created.groupId, taskId, state: 'failed' }, { agent: agents.get('ses_b') })
} catch (error) {
  forbidden = error
}
check('only the assignee can update a task', forbidden !== null && forbidden.code === 'forbidden')
let notMember = null
try {
  await tools.get('group_send').execute({ group: created.groupId, text: '外面的人' }, { agent: { id: 'ses_x', session: { id: 'ses_x', meta: { cwd: workspace } } } })
} catch (error) {
  notMember = error
}
check('non-member cannot speak in the group', notMember !== null && notMember.code === 'not-member')

const memberMessage = await tools.get('group_send').execute({ group: created.groupId, text: '我补充一点', notify: 'none' }, { agent: agents.get('ses_b') })
check('member message recorded without waking', typeof memberMessage.result.messageId === 'string' && memberMessage.result.delivered === 0)
const afterMemberMessage = await route('groupList')
check('member message appears in the timeline', afterMemberMessage.groups[0].messages.some((message) => message.id === memberMessage.result.messageId && message.kind === 'member'))

// Reconcile: ses_b never emitted live events, so seed its durable log.
const frameB = String(followups.find((entry) => entry.sessionId === 'ses_b').message.content[0].text)
liveEvents.set('ses_b', [
  { type: 'turn/start', seq: 1, data: { turn: 2 } },
  { type: 'user/message', seq: 2, data: { content: [{ type: 'text', text: frameB }], source: { kind: 'user' } } },
  { type: 'assistant/message', seq: 3, data: { turn: 2, message: { content: [{ type: 'text', text: '开发也看完了' }] } } },
  { type: 'turn/end', seq: 4, data: { turn: 2, reason: 'completed' } },
])
const reconciled = await route('groupReconcile')
check('reconcile recovers a missed reply', reconciled.recovered >= 1)
const afterReconcile = await route('groupList')
check(
  'recovered reply is in the timeline',
  afterReconcile.groups[0].messages.some((message) => message.memberSessionId === 'ses_b' && message.text === '开发也看完了'),
)

// ------------------------------------------------------------------
// Topic flow v1 (contract: docs/proposals/group-topic/contract.md)
// ------------------------------------------------------------------
const flowCreated = await route('groupCreate', {
  name: '议题演示组',
  members: [
    { sessionId: 'ses_a', label: '产品经理' },
    { sessionId: 'ses_b', label: '开发' },
  ],
})
const flowGroupId = flowCreated.groupId
check('flow: new group starts in topic phase', flowCreated.group.phase === 'topic' && flowCreated.group.topic === null)
check('flow: flow fields normalized', Array.isArray(flowCreated.group.rounds) && Array.isArray(flowCreated.group.log) && flowCreated.group.plan === null)

const legacyTask = await route('groupTaskCreate', { groupId: flowGroupId, title: '无议题时的旧行为任务', assigneeSessionId: 'ses_a' })
check('flow: task creation without a topic keeps legacy behaviour', typeof legacyTask.taskId === 'string')

const topic = await route('groupTopicSet', { groupId: flowGroupId, title: '群组议题流程', detail: '讨论→方案→确认→执行', maxRounds: 2 })
check('flow: topicSet opens discuss with round 1', topic.phase === 'discuss' && topic.topic.roundCount === 1 && topic.topic.maxRounds === 2)
check('flow: topicSet records the round', (await route('groupList')).groups.find((group) => group.id === flowGroupId).rounds.length === 1)

const topicRead = await tools.get('group_topic_read').execute({ group: flowGroupId }, execA)
check('flow: group_topic_read returns the flow summary', topicRead.result.flow.phase === 'discuss' && topicRead.result.flow.topic.title === '群组议题流程')
check('flow: owner-only ops are not member tools', !tools.has('group_plan_confirm') && !tools.has('group_plan_reject') && !tools.has('group_flow_close'))

const discussion = await route('groupSend', { groupId: flowGroupId, text: '请各角色讨论', purpose: 'discussion' })
check('flow: discussion delivery is allowed during discuss', discussion.deliveries.length === 2 && discussion.deliveries.every((entry) => entry.state === 'delivered'))

const beforeBlocked = (await route('groupList')).groups.find((group) => group.id === flowGroupId)
const wakeBeforeBlocked = followups.length
let gateError = null
try {
  await route('groupSend', { groupId: flowGroupId, text: '未确认就执行', purpose: 'execution' })
} catch (error) {
  gateError = error
}
check('flow: execution delivery blocked before approval', gateError !== null && gateError.code === 'gate-blocked')
let taskGate = null
try {
  await route('groupTaskCreate', { groupId: flowGroupId, title: '提前建卡', assigneeSessionId: 'ses_a' })
} catch (error) {
  taskGate = error
}
check('flow: task creation blocked before approval', taskGate !== null && taskGate.code === 'gate-blocked')
let handoffGate = null
try {
  await tools.get('group_handoff').execute({ group: flowGroupId, to: '开发', title: '提前交接' }, execA)
} catch (error) {
  handoffGate = error
}
check('flow: handoff blocked before approval', handoffGate !== null && handoffGate.code === 'gate-blocked')
let toolExecGate = null
try {
  await tools.get('group_send').execute({ group: flowGroupId, text: '工具侧执行', purpose: 'execution', notify: 'all' }, execA)
} catch (error) {
  toolExecGate = error
}
check('flow: member execution speech blocked before approval', toolExecGate !== null && toolExecGate.code === 'gate-blocked')
const afterBlocked = (await route('groupList')).groups.find((group) => group.id === flowGroupId)
check(
  'flow: blocked attempts write nothing and wake nobody',
  afterBlocked.messages.length === beforeBlocked.messages.length && afterBlocked.tasks.length === beforeBlocked.tasks.length && followups.length === wakeBeforeBlocked,
)

const round2 = await route('groupRoundOpen', { groupId: flowGroupId })
check('flow: second discussion round allowed', round2.roundCount === 2)
let roundError = null
try {
  await route('groupRoundOpen', { groupId: flowGroupId })
} catch (error) {
  roundError = error
}
check('flow: third round rejected with round-limit', roundError !== null && roundError.code === 'round-limit')

let jumpError = null
try {
  await route('groupPlanConfirm', { groupId: flowGroupId })
} catch (error) {
  jumpError = error
}
check('flow: illegal jump to confirm rejected', jumpError !== null && jumpError.code === 'bad-phase')

const toolDraft = await tools.get('group_plan_write').execute({ group: flowGroupId, summary: '成员草稿' }, execA)
check('flow: member can save a plan draft', toolDraft.result.plan.status === 'draft' && toolDraft.result.phase === 'plan')

let invalidPlan = null
try {
  await route('groupPlanSubmit', { groupId: flowGroupId, submit: true, plan: { summary: '缺指派', cards: [{ title: '没有指派' }] } })
} catch (error) {
  invalidPlan = error
}
check('flow: pending plan requires assigned cards', invalidPlan !== null && invalidPlan.code === 'plan-invalid')

const pending = await route('groupPlanSubmit', {
  groupId: flowGroupId,
  submit: true,
  plan: {
    summary: '执行方案',
    sections: [{ heading: '任务', body: '两张卡' }],
    cards: [
      { title: '实现硬闸门', detail: 'Host 侧', acceptance: ['负向用例通过'], role: 'fullstack-developer', assigneeSessionId: 'ses_b' },
      { title: '写自动化测试', detail: 'QA 侧', acceptance: ['npm test 全绿'], role: 'qa-engineer', assigneeSessionId: 'ses_a' },
    ],
  },
})
check('flow: pending plan moves to approve', pending.phase === 'approve' && pending.plan.status === 'pending' && pending.plan.cards.length === 2)

let rejectNote = null
try {
  await route('groupPlanReject', { groupId: flowGroupId })
} catch (error) {
  rejectNote = error
}
check('flow: reject requires a note', rejectNote !== null && rejectNote.code === 'bad-request')
const rejected = await route('groupPlanReject', { groupId: flowGroupId, note: '请补风险说明' })
check('flow: reject returns to discuss', rejected.phase === 'discuss' && rejected.plan.status === 'rejected' && rejected.plan.rejectNote === '请补风险说明')

const resubmit = await route('groupPlanSubmit', {
  groupId: flowGroupId,
  submit: true,
  plan: {
    summary: '执行方案 v2（已补风险）',
    cards: [
      { title: '实现硬闸门', assigneeSessionId: 'ses_b', acceptance: [] },
      { title: '写自动化测试', assigneeSessionId: 'ses_a', acceptance: [] },
    ],
  },
})
check('flow: resubmitted plan bumps the version', resubmit.plan.version > pending.plan.version && resubmit.phase === 'approve')

const wakeBeforeConfirm = followups.length
const confirmed = await route('groupPlanConfirm', { groupId: flowGroupId })
check('flow: confirm approves and enters execute', confirmed.phase === 'execute' && confirmed.planId.startsWith('pln_'))
check('flow: confirm creates one task per card', confirmed.tasks.length === 2 && confirmed.failures.length === 0)
check('flow: confirm delivers execution tasks', confirmed.deliveries.length === 2 && confirmed.deliveries.every((entry) => entry.state === 'delivered') && followups.length === wakeBeforeConfirm + 2)
const flowDocument = (await route('groupList')).groups.find((group) => group.id === flowGroupId)
const planTasks = flowDocument.tasks.filter((task) => task.planId === confirmed.planId)
check('flow: plan tasks trace back to the plan', planTasks.length === 2 && planTasks.every((task) => typeof task.cardId === 'string'))
check('flow: approval is recorded in the flow log', flowDocument.log.some((entry) => entry.action === 'approve' && entry.by === 'owner'))

const execAllowed = await route('groupSend', { groupId: flowGroupId, text: '开始执行', purpose: 'execution' })
check('flow: execution delivery allowed after approval', execAllowed.deliveries.length === 2 && execAllowed.deliveries.every((entry) => entry.state === 'delivered'))

const closed = await route('groupFlowClose', { groupId: flowGroupId })
check('flow: close moves to closed', closed.phase === 'closed')
let closedGate = null
try {
  await route('groupSend', { groupId: flowGroupId, text: '关闭后执行', purpose: 'execution' })
} catch (error) {
  closedGate = error
}
check('flow: closed topic blocks execution deliveries', closedGate !== null && closedGate.code === 'gate-blocked')
const reopened = await route('groupFlowReopen', { groupId: flowGroupId })
check('flow: reopen clears the topic', reopened.phase === 'topic')

// Legacy documents (no flow fields) must read with defaults and keep version 1.
await writeFile(
  groupFile,
  JSON.stringify({
    version: 1,
    updatedAt: Date.now(),
    groups: [
      {
        id: 'grp_legacy',
        name: '旧群组',
        members: [{ sessionId: 'ses_a', label: '旧成员', joinedAt: 0 }],
        messages: [],
        tasks: [],
        createdAt: 0,
        updatedAt: 0,
      },
    ],
  }),
  'utf8',
)
const legacyDocument = await route('groupList')
const legacyGroup = legacyDocument.groups.find((group) => group.id === 'grp_legacy')
check('flow: legacy document reads with default flow fields', legacyGroup.phase === 'topic' && legacyGroup.topic === null && legacyGroup.plan === null && legacyGroup.rounds.length === 0 && legacyGroup.log.length === 0)
check('flow: legacy document keeps version 1', legacyDocument.version === 1)

// Corrupt file is reported and left untouched.
const brokenText = '{ not valid json'
await writeFile(groupFile, brokenText, 'utf8')
let corrupt = null
try {
  await route('groupList')
} catch (error) {
  corrupt = error
}
check('corrupt document reports a stable code', corrupt !== null && corrupt.code === 'corrupt')
check('corrupt document is not cleared', (await readFile(groupFile, 'utf8')) === brokenText)

// Static wiring checks.
const indexSource = await readFile(path.join(rootDir, 'dsh-web-filebrowser-plugin/index.js'), 'utf8')
const clientSource = await readFile(path.join(rootDir, 'dsh-web-filebrowser-plugin/client.js'), 'utf8')
const manifest = JSON.parse(await readFile(path.join(rootDir, 'dsh-web-filebrowser-plugin/package.json'), 'utf8'))
check('index wires the group manager', indexSource.includes('createGroupManager(') && indexSource.includes('listenSessionEvents()') && indexSource.includes('registerTools(toolsCtx)'))
check('index routes group ops', indexSource.includes('GROUP_ROUTE_OPS'))
check('client prefers the Host route', clientSource.includes("call('groupList'") && clientSource.includes('hostGroupsOp(') && clientSource.includes('groupsHostMode'))
check('client keeps the legacy fallback', clientSource.includes("errorCode(error) !== 'bad-op'") && clientSource.includes("call('read', { root, path: GROUPS_FILE })"))
check('manifest ships groups.js', Array.isArray(manifest.files) && manifest.files.includes('groups.js'))
check('route op set covers the client contract', ['groupCreate', 'groupList', 'groupSend', 'groupTaskCreate', 'groupReconcile'].every((op) => GROUP_ROUTE_OPS.has(op)))

disposeCapture()
await rm(workspace, { recursive: true, force: true })

if (failures > 0) {
  console.log(`\nFAIL: ${failures} group host check(s) failed`)
  process.exit(1)
}
console.log('\nPASS: session-group host selftest')
