/**
 * Session-group client selftest (v1.0).
 *
 * The group feature lives inside the browser client bundle, so this test does
 * not boot a DOM: it extracts the pure helper block and the reply-capture state
 * machine from `client.js`, runs them against stubs, and statically checks that
 * the page, tab, sidebar/palette entries and locale keys are wired.
 *
 * Run through `npm test` (after host-smoke.mjs) or directly:
 *   node scripts/selftest/groups-client-selftest.mjs
 */

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const clientPath = path.join(root, 'dsh-web-filebrowser-plugin', 'client.js')
const source = await readFile(clientPath, 'utf8')

let failures = 0
function check(name, condition, detail) {
  if (condition) {
    console.log(`ok   ${name}`)
    return
  }
  failures += 1
  console.log(`FAIL ${name}${detail === undefined ? '' : ` — ${String(detail)}`}`)
}

function sliceBetween(startMarker, endMarker, label) {
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker)
  if (start === -1 || end === -1 || end <= start) throw new Error(`cannot locate ${label}`)
  return source.slice(start, end)
}

/* ------------------------------------------------------------------ *
 * 1) Pure helpers
 * ------------------------------------------------------------------ */
const helpersBlock = sliceBetween(
  '    /* ------------------------------------------------------------------ *\n     * Session groups (v1.0): shared chat channel for existing sessions',
  '    function makeIdePage(ctx, t, store) {',
  'group helper block',
)
const helpers = new Function(
  `const h = (...args) => args
const icon = (size, ...args) => args
${helpersBlock}
return {
  emptyGroupsDoc, newGroupRecordId, normalizeGroupsDoc, normalizeGroupMessage, normalizeGroupTask,
  groupsPathWithin, groupMessageText, groupMarkerText, parseGroupMarker, truncateGroupText, groupMentionToken,
  groupClock, nextGroupSeq, lastGroupEventSeq, sanitizeGroupName, groupMemberLabelOf,
  buildGroupPromptFrame, groupTaskCardText, GROUP_MAX_MEMBERS,
  normalizeGroupTopic, normalizeGroupPlan, normalizeGroupPlanCard, normalizeGroupRound, normalizeGroupLogEntry,
  GROUP_FLOW_PHASES, GROUP_FLOW_STEPS, GROUP_FLOW_PHASE_STEP, GROUP_PLAN_STATUSES, GROUP_FLOW_UNDO_MS,
  GROUP_MAX_FLOW_ROUNDS, GROUP_MAX_TOPIC_TITLE, groupPhaseStep, groupPlanCardCount, groupHasActiveFlow, groupFlowWritable,
}`,
)()

check('empty document', helpers.emptyGroupsDoc().version === 1 && helpers.emptyGroupsDoc().groups.length === 0)
check('record ids', helpers.newGroupRecordId('grp_').startsWith('grp_') && helpers.newGroupRecordId('tsk_').startsWith('tsk_'))

const rawDocument = {
  version: 1,
  updatedAt: 1,
  groups: [
    {
      id: 'grp_1',
      name: '项目交付 A 组',
      goal: '登录页改版',
      status: 'paused',
      members: [{ sessionId: 'ses_1', label: '产品经理', joinedAt: 5 }],
      messages: [
        {
          id: 'msg_1',
          kind: 'owner',
          text: '需求',
          mentions: ['ses_1'],
          createdAt: 1,
          deliveries: [{ sessionId: 'ses_1', state: 'replied', replyMessageId: 'msg_2' }],
        },
        { id: 'msg_2', kind: 'member', text: '回复', memberSessionId: 'ses_1', createdAt: 2 },
      ],
      tasks: [{ id: 'tsk_1', title: '任务', acceptance: ['a', 'b'], assigneeSessionId: 'ses_1', state: 'review' }],
    },
  ],
}
const document = helpers.normalizeGroupsDoc(rawDocument)
const group = document.groups[0]
check('normalize document', document.groups.length === 1 && group.messages.length === 2 && group.tasks.length === 1)
check('normalize status and delivery', group.status === 'paused' && group.messages[0].deliveries[0].state === 'replied')
check('normalize rejects junk', helpers.normalizeGroupsDoc(null).groups.length === 0 && helpers.normalizeGroupsDoc({ groups: 'x' }).groups.length === 0)
check('path containment', helpers.groupsPathWithin('/a', '/a') && helpers.groupsPathWithin('/a/b/', '/a/') && !helpers.groupsPathWithin('/ab', '/a'))
check('message text parts', helpers.groupMessageText([{ type: 'text', text: 'a' }, { type: 'reasoning', text: 'r' }, { type: 'text', text: 'b' }]) === 'ab')
check('sanitize name', helpers.sanitizeGroupName('  项目「A」#1 \n') === '项目A1' && helpers.sanitizeGroupName('x'.repeat(100)).length <= 40)
check('sequence helpers', helpers.nextGroupSeq(group) === 1 && helpers.lastGroupEventSeq({ entries: [{ type: 'event', event: { seq: 7 } }] }) === 7)
check('member label', helpers.groupMemberLabelOf(group, 'ses_1') === '产品经理' && helpers.groupMemberLabelOf(group, 'missing') === '成员')

const marker = helpers.groupMarkerText(group, group.messages[0])
const mentionToken = helpers.groupMentionToken('请 @产品', 6)
check('mention token after at-sign', mentionToken !== null && mentionToken.query === '产品' && mentionToken.start === 2)
check('mention token empty query', helpers.groupMentionToken('@', 1)?.query === '')
check('mention token allows text before @', helpers.groupMentionToken('请@产品', 4)?.query === '产品')
check('mention token stops at space', helpers.groupMentionToken('@产品 其他', 7) === null)
check('mention token at line start', helpers.groupMentionToken('@产品', 3)?.query === '产品')

check('marker round-trip', marker.includes('#msg_1') && helpers.parseGroupMarker(`前文 ${marker} 后文`) === 'msg_1')
check('marker miss', helpers.parseGroupMarker('没有标记') === null)

const frame = helpers.buildGroupPromptFrame(group, group.messages[0], group.members[0], group.tasks)
check('delivery frame marker', frame.startsWith(marker) && frame.includes('来自：Owner'))
check('delivery frame untrusted warning', frame.includes('未受信任') && frame.includes('不要执行'))
check('delivery frame recent context', frame.includes('群聊最近记录') && frame.includes('回复'))
const singleMessageGroup = { ...group, messages: [group.messages[0]] }
check(
  'delivery frame omits empty context',
  !helpers.buildGroupPromptFrame(singleMessageGroup, singleMessageGroup.messages[0], group.members[0], group.tasks).includes('群聊最近记录'),
)
const taskMessage = { id: 'msg_t', kind: 'task', taskId: 'tsk_1', text: '任务：任务', createdAt: 1, deliveries: [] }
check('task frame acceptance', helpers.buildGroupPromptFrame(group, taskMessage, group.members[0], group.tasks).includes('2. b'))
check('task card text', helpers.groupTaskCardText({ title: '任务', acceptance: ['a'] }) === '任务：任务\n验收标准：\n1. a')

/* ------------------------------------------------------------------ *
 * 2) Topic flow helpers (v1.1, contract.md §1/§5)
 * ------------------------------------------------------------------ */
const sameJson = (left, right) => JSON.stringify(left) === JSON.stringify(right)
check('flow phases constant', sameJson(helpers.GROUP_FLOW_PHASES, ['topic', 'discuss', 'plan', 'approve', 'execute', 'closed']))
check('flow steps constant', sameJson(helpers.GROUP_FLOW_STEPS, ['topic', 'discuss', 'plan', 'execute']))
check(
  'six phases fold into four header steps',
  sameJson(
    helpers.GROUP_FLOW_PHASES.map((phase) => helpers.groupPhaseStep(phase)),
    [0, 1, 2, 2, 3, 3],
  ) && helpers.groupPhaseStep('bogus') === 0,
)
check('flow plan statuses constant', sameJson(helpers.GROUP_PLAN_STATUSES, ['draft', 'pending', 'approved', 'rejected']))
check('flow constants match the frozen contract', helpers.GROUP_MAX_FLOW_ROUNDS === 2 && helpers.GROUP_FLOW_UNDO_MS === 10 * 60 * 1000)

const legacyFlowGroup = helpers.normalizeGroupsDoc({ groups: [{ id: 'grp_old', name: '旧群组' }] }).groups[0]
check(
  'legacy group gains flow defaults',
  legacyFlowGroup.phase === 'topic' && legacyFlowGroup.topic === null && legacyFlowGroup.plan === null && legacyFlowGroup.rounds.length === 0 && legacyFlowGroup.log.length === 0,
)
check('unknown phase falls back to topic', helpers.normalizeGroupsDoc({ groups: [{ id: 'grp_x', name: 'x', phase: 'nope' }] }).groups[0].phase === 'topic')
check(
  'flow fields survive normalize',
  helpers.normalizeGroupsDoc({ groups: [{ id: 'grp_f', name: 'f', phase: 'approve', topic: { title: '议题' }, rounds: [{ id: 'r1' }], log: [{ action: 'topic', by: 'owner' }] }] }).groups[0].phase === 'approve',
)

const flowTopicGroup = helpers.normalizeGroupsDoc({
  groups: [{ id: 'grp_t', name: 't', phase: 'discuss', topic: { title: 'T'.repeat(120), detail: 'd', roundCount: 5, maxRounds: 2 } }],
}).groups[0]
check('topic never shows round 3/2', flowTopicGroup.topic.roundCount === 2 && flowTopicGroup.topic.maxRounds === 2)
check('topic title is capped', flowTopicGroup.topic.title.length === helpers.GROUP_MAX_TOPIC_TITLE)
const defaultTopic = helpers.normalizeGroupsDoc({ groups: [{ id: 'grp_t2', name: 't', topic: {} }] }).groups[0].topic
check('topic defaults to round 1 of 2', defaultTopic.roundCount === 1 && defaultTopic.maxRounds === 2)
check('topic maxRounds hard cap', helpers.normalizeGroupsDoc({ groups: [{ id: 'grp_t3', name: 't', topic: { maxRounds: 99 } }] }).groups[0].topic.maxRounds === 9)

const planRaw = {
  summary: '执行方案',
  status: 'approved',
  approvedAt: 42,
  approvedBy: 'owner',
  sections: Array.from({ length: 15 }, (_value, index) => ({ heading: `h${index}`, body: 'b' })),
  cards: Array.from({ length: 25 }, (_value, index) => ({ title: `c${index}`, acceptance: Array.from({ length: 12 }, () => 'a'), role: 'qa-engineer' })),
}
const flowPlanGroup = helpers.normalizeGroupsDoc({ groups: [{ id: 'grp_p', name: 'p', phase: 'execute', plan: planRaw }] }).groups[0]
check('plan sections capped at 12', flowPlanGroup.plan.sections.length === 12)
check('plan cards capped at 20', flowPlanGroup.plan.cards.length === 20)
check('plan card acceptance capped at 10', flowPlanGroup.plan.cards[0].acceptance.length === 10)
check('approved plan keeps status and timestamp', flowPlanGroup.plan.status === 'approved' && flowPlanGroup.plan.approvedAt === 42)
check('unknown plan status falls back to draft', helpers.normalizeGroupsDoc({ groups: [{ id: 'grp_p2', name: 'p', plan: { status: 'nope' } }] }).groups[0].plan.status === 'draft')
const defaultPlanCard = helpers.normalizeGroupPlanCard({ title: 't' })
check(
  'plan card defaults are additive',
  defaultPlanCard.id.startsWith('crd_') && defaultPlanCard.detail === '' && defaultPlanCard.acceptance.length === 0 && defaultPlanCard.role === null && defaultPlanCard.assigneeSessionId === null,
)
const rejectedPlan = helpers.normalizeGroupsDoc({ groups: [{ id: 'grp_p3', name: 'p', plan: { status: 'rejected', rejectedAt: 7, rejectNote: '补风险' } }] }).groups[0].plan
check('rejected plan keeps its note', rejectedPlan.status === 'rejected' && rejectedPlan.rejectedAt === 7 && rejectedPlan.rejectNote === '补风险')

check('plan card count', helpers.groupPlanCardCount({ plan: null }) === 0 && helpers.groupPlanCardCount({}) === 0 && helpers.groupPlanCardCount(flowPlanGroup) === 20)
check('active flow detection', helpers.groupHasActiveFlow({ topic: null }) === false && helpers.groupHasActiveFlow(flowTopicGroup) === true)
check(
  'flow is only writable before close',
  helpers.groupFlowWritable({ topic: null }) === false && helpers.groupFlowWritable(flowTopicGroup) === true && helpers.groupFlowWritable({ ...flowTopicGroup, phase: 'closed' }) === false,
)

const purposeDefault = helpers.normalizeGroupMessage({ id: 'm1' })
const purposeExecution = helpers.normalizeGroupMessage({ id: 'm2', purpose: 'execution', planId: 'pln_1' })
check('message purpose defaults to discussion', purposeDefault.purpose === 'discussion' && purposeDefault.planId === null)
check('execution purpose and plan id preserved', purposeExecution.purpose === 'execution' && purposeExecution.planId === 'pln_1')
const planTask = helpers.normalizeGroupTask({ id: 't1', title: 'x', planId: 'pln_1', cardId: 'crd_1' })
check('plan task provenance', planTask.planId === 'pln_1' && planTask.cardId === 'crd_1')
check('task without plan has null provenance', helpers.normalizeGroupTask({ id: 't2' }).planId === null)
check('round defaults to open', helpers.normalizeGroupRound({ id: 'r1' }).state === 'open' && helpers.normalizeGroupRound({ id: 'r2', state: 'closed' }).state === 'closed')
const badLog = helpers.normalizeGroupLogEntry({ action: 'nope', by: 'nope' })
check('log entry whitelists action and actor', badLog.action === 'plan' && badLog.by === 'owner')

/* ------------------------------------------------------------------ *
 * 3) Reply-capture state machine
 * ------------------------------------------------------------------ */
const captureBlock = sliceBetween(
  '        function processGroupCapture(capture) {',
  '        function openGroupSession(sessionId) {',
  'group capture block',
)
const captureApi = new Function(
  `const docRef = { current: null }
const groupsDocRef = { get current() { return docRef.current } }
const toasts = []
const h = (...args) => args
const icon = (size, ...args) => args
${helpersBlock}
function mutateGroups(mutator) {
  const draft = JSON.parse(JSON.stringify(docRef.current))
  mutator(draft)
  draft.updatedAt = Date.now()
  docRef.current = draft
}
function scheduleGroupsSave() {}
function showToast(message) { toasts.push(message) }
function t(key, vars) { return vars === undefined ? key : key + JSON.stringify(vars) }
${captureBlock}
return { docRef, toasts, processGroupCapture, groupMarkerText }`,
)()

function makeGroupDocument() {
  return {
    version: 1,
    updatedAt: 0,
    groups: [
      {
        id: 'grp_1',
        name: '项目交付 A 组',
        goal: '',
        status: 'active',
        mode: 'owner-led',
        settings: {},
        members: [{ sessionId: 'ses_1', label: '产品经理', role: 'member', joinedAt: 0 }],
        messages: [
          {
            id: 'msg_1',
            seq: 1,
            kind: 'owner',
            text: '需求',
            mentions: [],
            memberSessionId: null,
            taskId: null,
            createdAt: 1,
            deliveries: [
              { sessionId: 'ses_1', state: 'delivered', queuedAt: 1, deliveredAt: 1, repliedAt: 0, replyMessageId: null, error: null },
            ],
          },
        ],
        tasks: [],
        createdAt: 0,
        updatedAt: 0,
      },
    ],
  }
}
function feed(capture, events) {
  let seq = capture.lastSeq
  const entries = events.map((event) => ({ type: 'event', event: { ...event, seq: (seq += 1) } }))
  capture.eventSource = { getSnapshot: () => ({ entries }) }
  captureApi.processGroupCapture(capture)
  capture.lastSeq = seq
}
function markerOf(doc) {
  return captureApi.groupMarkerText(doc.groups[0], doc.groups[0].messages[0])
}

captureApi.docRef.current = makeGroupDocument()
const capture = { sessionId: 'ses_1', lastSeq: 0, currentTurn: null, active: null }
feed(capture, [
  { type: 'turn/start', data: { turn: 5 } },
  { type: 'user/message', data: { content: [{ type: 'text', text: `${markerOf(captureApi.docRef.current)} 正文` }], source: { kind: 'user' } } },
  { type: 'assistant/message', data: { turn: 5, message: { content: [{ type: 'text', text: '改好了，产物 docs/login.md' }] } } },
  { type: 'turn/end', data: { turn: 5, reason: 'completed' } },
])
const repliedGroup = captureApi.docRef.current.groups[0]
check('reply appended', repliedGroup.messages.length === 2 && repliedGroup.messages[1].kind === 'member')
check('reply text and delivery', repliedGroup.messages[1].text === '改好了，产物 docs/login.md' && repliedGroup.messages[0].deliveries[0].state === 'replied')
check('reply toast', captureApi.toasts.length === 1)

captureApi.docRef.current = makeGroupDocument()
const otherTurnCapture = { sessionId: 'ses_1', lastSeq: 0, currentTurn: null, active: null }
feed(otherTurnCapture, [
  { type: 'turn/start', data: { turn: 2 } },
  { type: 'user/message', data: { content: [{ type: 'text', text: markerOf(captureApi.docRef.current) }], source: { kind: 'user' } } },
  { type: 'assistant/message', data: { turn: 1, message: { content: [{ type: 'text', text: '旧 turn 文本' }] } } },
  { type: 'turn/end', data: { turn: 2, reason: 'completed' } },
])
check('other-turn text ignored', captureApi.docRef.current.groups[0].messages[1].text === 'groups.emptyReply')

captureApi.docRef.current = makeGroupDocument()
captureApi.docRef.current.groups[0].tasks.push({
  id: 'tsk_1',
  title: '任务',
  detail: '',
  acceptance: ['a'],
  assigneeSessionId: 'ses_1',
  priority: 'P1',
  state: 'delivered',
  messageId: 'msg_1',
  createdAt: 0,
  updatedAt: 0,
})
captureApi.docRef.current.groups[0].messages[0].taskId = 'tsk_1'
const taskCapture = { sessionId: 'ses_1', lastSeq: 0, currentTurn: null, active: null }
feed(taskCapture, [
  { type: 'turn/start', data: { turn: 7 } },
  { type: 'user/message', data: { content: [{ type: 'text', text: markerOf(captureApi.docRef.current) }], source: { kind: 'user' } } },
  { type: 'assistant/message', data: { turn: 7, message: { content: [{ type: 'text', text: '任务完成' }] } } },
  { type: 'turn/end', data: { turn: 7, reason: 'completed' } },
])
check('task reply moves task to review', captureApi.docRef.current.groups[0].tasks[0].state === 'review')

captureApi.docRef.current = makeGroupDocument()
captureApi.docRef.current.groups[0].messages[0].deliveries[0].state = 'replied'
const duplicateCapture = { sessionId: 'ses_1', lastSeq: 0, currentTurn: null, active: null }
feed(duplicateCapture, [{ type: 'user/message', data: { content: [{ type: 'text', text: markerOf(captureApi.docRef.current) }], source: { kind: 'user' } } }])
check('replied delivery not recaptured', captureApi.docRef.current.groups[0].messages.length === 1 && duplicateCapture.active === null)

/* ------------------------------------------------------------------ *
 * 4) Wiring + locale coverage
 * ------------------------------------------------------------------ */
check('groups page render branch', source.includes("activeTab.mode === 'groups'") && source.includes('? renderGroupsPage()'))
check('sidebar entry', source.includes("id: 'groups'") && source.includes("label: t('side.groups')") && source.includes('select: openGroupsPage'))
check('command palette entry', source.includes("{ id: 'groups', label: t('groups.title'), run: openGroupsPage }"))
check('group tab factory', source.includes("const path = 'groups:home'") && source.includes("mode: 'groups'"))
check('mention picker wiring', source.includes("className: 'ds-grp-mention-pop'") && source.includes('groupMentionToken(value, event.target.selectionStart') && source.includes('insertGroupMention(member)'))
check('workspace switch refreshes groups', source.includes('groupsLoadTokenRef.current += 1') && source.includes('function refreshGroupsSessions()') && source.includes('sessions.refresh()') && source.includes('setGroupsNewMembers([])'))
check('candidates follow the Harness Workspace', source.includes('workspace.sessionIds') && source.includes('archivedSessionIds') && source.includes('row.parentId !== undefined') && source.includes('row.blank === true'))
check('open Groups tab survives a workspace switch', source.includes('Keep an open Groups page across a workspace switch') && source.includes('tabs: groupsTab === null ? [] : [groupsTab]'))
check('discussion relay wiring', source.includes('relayGroupReply(group.id, message.id)') && source.includes("t('groups.relayDiscuss')"))
check('member instruct wiring', source.includes('commandGroupMember(member)') && source.includes("t('groups.commandMember')"))

/* Topic flow wiring (v1.1, contract.md §5). */
check(
  'stage bar folds six phases into four steps',
  source.includes("'data-state': index < step ? 'done' : index === step ? 'current' : 'locked'") &&
    source.includes("'aria-current': index === step ? 'step' : undefined") &&
    source.includes('disabled: index > step') &&
    source.includes('GROUP_FLOW_STEPS.map'),
)
check('stage bar labels come from locale keys', source.includes("t('groups.flow.step.' + id)") && source.includes("t('groups.flow.phase.' + phase)"))
check(
  'plan card renders status, version, cards and notes',
  source.includes("const planStatusText = (status) => t('groups.flow.planStatus.' + status)") &&
    source.includes("t('groups.flow.planVersion'") &&
    source.includes("t('groups.flow.planCards'") &&
    source.includes('plan.cards.slice(0, 6)') &&
    source.includes("plan.status === 'rejected'") &&
    source.includes("plan.status === 'approved'"),
)
check('approve phase renders confirm and reject actions', source.includes("currentGroup.phase === 'approve'") && source.includes('onClick: requestGroupsConfirm') && source.includes('onClick: openGroupsReject'))
check(
  'owner flow actions degrade in client mode',
  source.includes('disabled: groupsFlowBusy || !groupsHostMode') && source.includes("t('groups.flow.clientModeHint')") && source.includes('const canWrite = groupsHostMode'),
)
check('flow action bar covers confirm, close, reopen and undo', ['showConfirm', 'showClose', 'showReopen', 'showUndo'].every((name) => source.includes(`const ${name} =`)))
check(
  'seven flow route ops are forwarded to the Host',
  ['groupTopicSet', 'groupRoundOpen', 'groupPlanSubmit', 'groupPlanConfirm', 'groupPlanReject', 'groupFlowClose', 'groupFlowReopen'].every((op) => new RegExp(`runGroupsFlowOp\\(\\s*'${op}'`).test(source)),
)
check(
  'confirm and reject require explicit owner input',
  source.includes("t('groups.flow.confirmHint', { count: String(count) })") &&
    source.includes("'groupPlanConfirm'") &&
    source.includes("t('groups.flow.rejectNeedNote')") &&
    source.includes("'groupPlanReject'"),
)
check(
  'stable flow error codes map to readable copy',
  [
    "if (code === 'gate-blocked') return t('groups.flow.gateBlocked')",
    "if (code === 'bad-phase') return t('groups.flow.badPhase')",
    "if (code === 'round-limit') return t('groups.flow.roundLimit')",
    "if (code === 'topic-exists') return t('groups.flow.topicExists')",
    "if (code === 'plan-invalid') return t('groups.flow.planInvalid')",
    "if (code === 'flow-unsupported') return t('groups.flow.unsupported')",
  ].every((fragment) => source.includes(fragment)),
)
check(
  'client mode degrades with a restart hint',
  source.includes('if (!groupsHostRef.current)') &&
    source.includes("showToast(t('groups.flow.clientModeHint'))") &&
    source.includes('当前 Host 不支持议题流程，请重启 Harness') &&
    source.includes('当前为页面模式'),
)
check('D4 one-click team pick is wired', source.includes('function pickGroupsTeam()') && source.includes("t('groups.flow.pickTeam')") && source.includes("t('groups.flow.pickTeamDone'"))

const used = new Set([...source.matchAll(/t\('(groups\.[A-Za-z0-9_.]+)'/g)].map((match) => match[1]).filter((key) => !key.endsWith('.')))
for (const dynamic of ['queued', 'delivered', 'collecting', 'replied', 'failed']) used.add(`groups.state.${dynamic}`)
for (const dynamic of ['pending', 'delivered', 'in_progress', 'review', 'done', 'failed', 'cancelled']) used.add(`groups.taskState.${dynamic}`)
used.add('groups.status.active')
used.add('groups.status.paused')
used.add('side.groups')
for (const phase of helpers.GROUP_FLOW_PHASES) used.add(`groups.flow.phase.${phase}`)
for (const status of helpers.GROUP_PLAN_STATUSES) used.add(`groups.flow.planStatus.${status}`)
for (const step of helpers.GROUP_FLOW_STEPS) used.add(`groups.flow.step.${step}`)
const defined = new Set([...source.matchAll(/'(groups\.[A-Za-z0-9_.]+|side\.groups)':/g)].map((match) => match[1]))
const missing = [...used].filter((key) => !defined.has(key))
check('locale keys complete', missing.length === 0, missing.join(', '))

/* contract.md §5.3: every groups.flow.* key must exist in BOTH zh and en. */
function flowLocaleKeys(startMarker, endMarker) {
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker, start)
  if (start === -1 || end === -1 || end <= start) throw new Error(`cannot locate ${startMarker}`)
  const block = source.slice(start, end)
  const keys = new Map()
  for (const match of block.matchAll(/'((?:groups\.flow\.)[A-Za-z0-9_.]+)': '((?:[^'\\]|\\.)*)'/g)) keys.set(match[1], match[2])
  return keys
}
const zhFlow = flowLocaleKeys('const zh = {', 'const en = {')
const enFlow = flowLocaleKeys('const en = {', 'const HIGHLIGHTERS = {')
const zhOnly = [...zhFlow.keys()].filter((key) => !enFlow.has(key))
const enOnly = [...enFlow.keys()].filter((key) => !zhFlow.has(key))
check('flow locale keys are paired zh+en', zhFlow.size > 0 && zhOnly.length === 0 && enOnly.length === 0, `${zhOnly.join(',')}|${enOnly.join(',')}`)
check(
  'flow locale values are non-empty in zh and en',
  [...zhFlow.values()].every((value) => value.trim().length > 0) && [...enFlow.values()].every((value) => value.trim().length > 0),
)
const untranslated = [...enFlow.entries()].filter(([, value]) => /[\u4e00-\u9fff]/u.test(value)).map(([key]) => key)
check('flow en locale has no untranslated zh copy', untranslated.length === 0, untranslated.join(','))
const flowUsed = [...used].filter((key) => key.startsWith('groups.flow.'))
const flowMissing = flowUsed.filter((key) => !zhFlow.has(key) || !enFlow.has(key))
check('flow locale keys cover every used key in both locales', flowMissing.length === 0, flowMissing.join(', '))

if (failures > 0) {
  console.log(`\nFAIL: ${failures} group client check(s) failed`)
  process.exit(1)
}
console.log('\nPASS: session-group client selftest')
