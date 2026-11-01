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
