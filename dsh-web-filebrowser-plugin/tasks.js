/**
 * Task runner backend for the file browser: run one shell command in a
 * workspace, stream its merged output through a bounded ring buffer, and stop
 * it on request. The browser half uses the same long-poll protocol as the
 * terminal, so build/test/lint output is delivered as soon as it is produced
 * instead of on a fixed timer.
 *
 * Tasks are non-interactive: stdout and stderr share one pipe, CI and NO_COLOR
 * are forced, and stdin is closed immediately. They run as the Harness host
 * user and are owner-authenticated like every other route; no command is
 * sandboxed beyond that.
 */

import { execFile, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { promises as fsp } from 'node:fs'
import { StringDecoder } from 'node:string_decoder'
import path from 'node:path'
import { parseProblems } from './problems.js'

const IS_WINDOWS = process.platform === 'win32'
/** Most tasks allowed to run at the same time inside one workspace. */
const MAX_RUNNING = 8
/** Longest accepted command line. */
const MAX_COMMAND = 4000
const MAX_NAME = 200
const MAX_BUFFER = 1_000_000
/** Trim a full buffer down to MAX_BUFFER only after this much extra output. */
const TRIM_SLACK = 256 * 1024
/** Longest an idle poll waits for more output before answering empty. */
const MAX_POLL_WAIT = 1000
/** Finished tasks stay pollable and listable for this long after they exit. */
const TASK_RETENTION_MS = 5 * 60_000
/** File (inside `<root>/.dsh/`) that keeps the durable run ledger. */
const RUNS_FILENAME = 'runs.json'
/** Most run records kept per workspace, newest first. */
const MAX_RUNS = 100
/** A runs file larger than this is ignored instead of parsed. */
const MAX_RUNS_BYTES = 2 * 1024 * 1024
/** Longest error text logged when a run-record write fails. */
const MAX_RUN_WRITE_ERROR = 400
/** Most tasks a single list call returns (running first by start time). */
const MAX_LIST = 32
/** Grace period between the polite signal and SIGKILL. */
const KILL_GRACE_MS = 3000
/** Reuse a detected command list for this long unless the cache is dropped. */
const DETECT_CACHE_MS = 30_000
/** Detection looks at most this many directory levels below the root. */
const DETECT_MAX_DEPTH = 2
/** Detection never reads more than this many files while scanning. */
const DETECT_MAX_FILES = 500
/** Bounds work on huge monorepos; root and the shallowest projects come first. */
const DETECT_MAX_DIRS = 8
const MAX_SUGGESTIONS = 40
const MAX_SCRIPTS = 12
const MAX_MAKE_TARGETS = 10

/** Directories that never contain the project files we generate commands for. */
const IGNORED_DIRS = new Set([
  'node_modules',
  'bower_components',
  'vendor',
  'obj',
  'target',
  'dist',
  'build',
  'out',
  '.output',
  'coverage',
  '__pycache__',
])

/** File names that mark a directory as a project (lowercased). */
const PROJECT_MARKERS = new Set([
  'package.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'package-lock.json',
  'npm-shrinkwrap.json',
  'makefile',
  'gnumakefile',
  'cargo.toml',
  'go.mod',
  'pyproject.toml',
  'requirements.txt',
  'manage.py',
  'docker-compose.yml',
  'docker-compose.yaml',
  'compose.yml',
  'compose.yaml',
])

const PREFERRED_SCRIPTS = ['dev', 'start', 'serve', 'build', 'test', 'lint', 'typecheck', 'check']

const GROUP_BY_NAME = {
  dev: 'dev',
  start: 'dev',
  serve: 'dev',
  preview: 'dev',
  watch: 'dev',
  build: 'build',
  compile: 'build',
  bundle: 'build',
  test: 'test',
  tests: 'test',
  e2e: 'test',
  coverage: 'test',
  lint: 'lint',
  run: 'dev',
  format: 'lint',
  fmt: 'lint',
  typecheck: 'lint',
  check: 'lint',
  tsc: 'lint',
}

/** Fallback grouping for compound script/target names such as `test:unit`. */
const GROUP_PATTERNS = [
  ['test', /(^|[^a-z0-9])(test|tests|spec|e2e|coverage)([^a-z0-9]|$)/u],
  ['lint', /(^|[^a-z0-9])(lint|format|fmt|typecheck|check|tsc)([^a-z0-9]|$)/u],
  ['build', /(^|[^a-z0-9])(build|compile|bundle|dist|release)([^a-z0-9]|$)/u],
  ['dev', /(^|[^a-z0-9])(dev|start|serve|watch|preview|runserver|up)([^a-z0-9]|$)/u],
]

const COMPOSE_FILES = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml']

class TaskError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'TaskError'
    this.code = code
  }
}

/**
 * Create the task manager bound to one host context.
 * @param options.resolveRoot - validates and canonicalizes a workspace root.
 */
export function createTaskManager({ resolveRoot }) {
  const tasks = new Map()
  const detectCache = new Map()
  /** root -> { loaded, runs } durable ledger cache (records newest first). */
  const runLedgers = new Map()
  /** root -> serialized write chain, so concurrent settles cannot clobber. */
  const runsChains = new Map()

  async function handle(request) {
    try {
      if (request.method !== 'POST') return failure(405, 'bad-method', '仅支持 POST')
      let body
      try {
        body = await request.json()
      } catch {
        return failure(400, 'bad-request', '请求体不是有效的 JSON')
      }
      if (body === null || typeof body !== 'object' || typeof body.op !== 'string') {
        return failure(400, 'bad-request', '缺少操作名 op')
      }
      prune()
      switch (body.op) {
        case 'start':
          return success(await start(body))
        case 'poll':
          return success(await poll(body))
        case 'list':
          return success(await list(body))
        case 'kill':
          return success(kill(body))
        case 'detect':
          return success(await detect(body))
        default:
          return failure(400, 'bad-op', `未知的任务操作：${body.op}`)
      }
    } catch (error) {
      if (error instanceof TaskError) return successError(error.code, error.message)
      console.error('dsh-web-filebrowser-tasks: request failed', error)
      return successError('internal', error instanceof Error ? error.message : String(error))
    }
  }

  /** Spawn one shell command and start buffering its merged output. */
  async function start(body) {
    if (typeof body.command !== 'string' || body.command.trim().length === 0) {
      throw new TaskError('bad-command', 'command 必须是非空字符串')
    }
    if (body.command.length > MAX_COMMAND) {
      throw new TaskError('too-large', `命令不能超过 ${String(MAX_COMMAND)} 个字符`)
    }
    const root = await resolveRoot(typeof body.root === 'string' ? body.root : '')
    assertLocalRoot(root)
    if (countRunning(root) >= MAX_RUNNING) {
      throw new TaskError('too-many', `同一工作区最多同时运行 ${String(MAX_RUNNING)} 个任务`)
    }
    const cwd = await resolveCwd(root, body.cwd)
    const command = body.command
    const name = normalizeName(body.name, command)
    const startedAt = Date.now()
    const id = randomUUID()
    const shell = IS_WINDOWS
      ? spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', command], {
          cwd,
          env: taskEnv(),
          windowsHide: true,
          stdio: ['pipe', 'pipe', 'pipe'],
        })
      : spawn('/bin/bash', ['-lc', command], {
          cwd,
          env: taskEnv(),
          windowsHide: true,
          stdio: ['pipe', 'pipe', 'pipe'],
          // A leading process group lets kill() signal the shell and every
          // command it forked (dev servers, watchers) instead of only bash.
          detached: true,
        })
    const task = {
      id,
      root,
      name,
      command,
      cwd,
      source: body.source === 'tool' ? 'tool' : 'panel',
      child: shell,
      pid: Number.isInteger(shell.pid) ? shell.pid : null,
      startedAt,
      endedAt: null,
      exitCode: null,
      signal: null,
      durationMs: null,
      buffer: '',
      base: 0,
      closed: false,
      decoder: new StringDecoder('utf8'),
      waiters: new Set(),
      killTimer: null,
      killRequested: false,
      detached: !IS_WINDOWS,
    }
    tasks.set(id, task)
    const append = (chunk) => appendOutput(task, chunk)
    shell.stdout?.on('data', append)
    shell.stderr?.on('data', append)
    shell.stdout?.on('error', () => {})
    shell.stderr?.on('error', () => {})
    shell.once('error', (error) => {
      if (task.closed) return
      append(`\n[task error: ${error.message}]\n`)
      settle(task, null, null)
    })
    shell.once('exit', (code, signal) => settle(task, code, signal))
    // Tasks do not accept input. Closing the pipe gives commands that read
    // stdin an immediate EOF instead of waiting for the browser to type.
    shell.stdin?.on('error', () => {})
    try {
      shell.stdin?.end()
    } catch {
      /* stdin already closed */
    }
    return { id, name, command, cwd, pid: task.pid, startedAt }
  }

  /** Answer one poll from the task buffer without waiting. */
  function pollSnapshot(task, since) {
    const durationMs = (task.endedAt ?? Date.now()) - task.startedAt
    if (since < task.base) {
      return {
        data: task.buffer,
        next: task.base + task.buffer.length,
        reset: true,
        closed: task.closed,
        exitCode: task.exitCode,
        signal: task.signal,
        durationMs,
        longPoll: true,
      }
    }
    const offset = since - task.base
    const data = offset >= task.buffer.length ? '' : task.buffer.slice(offset)
    return {
      data,
      next: task.base + task.buffer.length,
      reset: false,
      closed: task.closed,
      exitCode: task.exitCode,
      signal: task.signal,
      durationMs,
      longPoll: true,
    }
  }

  /** Return what the client is missing, or hold the request until output arrives. */
  async function poll(body) {
    const task = requireTask(body.id)
    const since = Number.isFinite(Number(body.since)) ? Math.max(0, Math.floor(Number(body.since))) : 0
    const snapshot = pollSnapshot(task, since)
    if (snapshot.data.length > 0 || snapshot.reset || snapshot.closed) return snapshot
    const requested = Number(body.wait)
    const wait = Number.isFinite(requested) ? Math.min(MAX_POLL_WAIT, Math.max(0, Math.floor(requested))) : 0
    if (wait <= 0) return snapshot
    await new Promise((resolve) => {
      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        task.waiters.delete(finish)
        resolve()
      }
      const timer = setTimeout(finish, wait)
      timer.unref?.()
      task.waiters.add(finish)
    })
    return pollSnapshot(task, since)
  }

  /** List running tasks plus tasks finished within the retention window. */
  async function list(body) {
    const requested = typeof body.root === 'string' ? body.root.trim() : ''
    // An omitted root lists every workspace; that keeps a global tasks panel
    // possible while a panel bound to one workspace passes its root explicitly.
    const root = requested.length > 0 ? await resolveRoot(requested) : null
    const now = Date.now()
    const rows = []
    for (const task of tasks.values()) {
      if (root !== null && task.root !== root) continue
      rows.push({
        id: task.id,
        name: task.name,
        command: task.command,
        cwd: task.cwd,
        source: task.source,
        running: !task.closed,
        exitCode: task.exitCode,
        signal: task.signal,
        startedAt: task.startedAt,
        endedAt: task.endedAt,
        bytes: task.base + task.buffer.length,
        durationMs: (task.endedAt ?? now) - task.startedAt,
      })
    }
    rows.sort((left, right) => right.startedAt - left.startedAt)
    return rows.slice(0, MAX_LIST)
  }

  /** Ask one task to stop: SIGTERM now, SIGKILL when it ignores the grace period. */
  function kill(body) {
    const task = requireTask(body.id)
    if (task.closed) return { ok: true }
    requestKill(task)
    return { ok: true }
  }

  /** Suggest runnable commands detected from the workspace's project files. */
  async function detect(body) {
    const root = await resolveRoot(typeof body.root === 'string' ? body.root : '')
    // Project files live on the remote host, so a local scan would be wrong.
    if (typeof root !== 'string' || root.startsWith('ssh://')) return []
    const cached = detectCache.get(root)
    if (cached !== undefined && Date.now() - cached.at < DETECT_CACHE_MS) return cached.value
    const value = await detectTasks(root)
    detectCache.set(root, { at: Date.now(), value })
    if (detectCache.size > 20) detectCache.delete(detectCache.keys().next().value)
    return value
  }

  /** Scan the workspace and turn project files into runnable command suggestions. */
  async function detectTasks(root) {
    const projects = groupProjects(await scanProject(root))
    const suggestions = []
    const seen = new Set()
    const add = (label, command, group) => {
      if (command.length === 0 || seen.has(command) || suggestions.length >= MAX_SUGGESTIONS) return
      seen.add(command)
      suggestions.push({ id: command, label, command, group })
    }
    for (const project of projects) {
      const prefix = project.dir === '' ? '' : `cd ${quoteArg(project.dir)} && `
      await collectProject(root, project, prefix, add)
    }
    return suggestions
  }

  /** Append decoded output, trimming the ring buffer in one slice when needed. */
  function appendOutput(task, chunk) {
    if (task.closed) return
    const text = task.decoder.write(chunk)
    if (text.length === 0) return
    task.buffer += text
    // Trimming on every chunk once the buffer is full copies the whole buffer
    // per write; let it grow a little past the cap, then drop the excess once.
    if (task.buffer.length > MAX_BUFFER + TRIM_SLACK) {
      const drop = task.buffer.length - MAX_BUFFER
      task.buffer = task.buffer.slice(drop)
      task.base += drop
    }
    wake(task)
  }

  /** Record the final state of a task, write the exit notice and wake pollers. */
  function settle(task, code, signal) {
    if (task.closed) return
    appendOutput(task, task.decoder.end())
    appendOutput(
      task,
      `\n[process exited${code === null ? '' : `: ${String(code)}`}${signal === null ? '' : ` (${signal})`}]\n`,
    )
    task.closed = true
    task.exitCode = typeof code === 'number' ? code : null
    task.signal = typeof signal === 'string' ? signal : null
    task.endedAt = Date.now()
    task.durationMs = task.endedAt - task.startedAt
    if (task.killTimer !== null) {
      clearTimeout(task.killTimer)
      task.killTimer = null
    }
    wake(task)
    // Persist the finished run for the model/panel ledger. A failed write must
    // never fail or delay the task itself, so the record path is best-effort.
    try {
      recordRun(task)
    } catch (error) {
      reportRunWriteError(task.root, error)
    }
  }

  /** Release every poll waiting on this task (new output, exit or error). */
  function wake(task) {
    if (task.waiters.size === 0) return
    for (const finish of [...task.waiters]) finish()
  }

  function requestKill(task) {
    if (task.killRequested) return
    task.killRequested = true
    signalTask(task, 'SIGTERM')
    task.killTimer = setTimeout(() => {
      task.killTimer = null
      if (task.closed) return
      signalTask(task, 'SIGKILL')
    }, KILL_GRACE_MS)
    task.killTimer.unref?.()
  }

  /** Deliver one signal to a task's process tree, falling back as needed. */
  function signalTask(task, signal) {
    if (IS_WINDOWS) {
      const pid = task.pid
      if (!Number.isInteger(pid)) return
      // cmd.exe leaves grandchildren behind, so taskkill walks the tree. The
      // polite pass is retried as a forced one by the grace timer if needed.
      const args = signal === 'SIGKILL' ? ['/PID', String(pid), '/T', '/F'] : ['/PID', String(pid), '/T']
      try {
        execFile('taskkill.exe', args, { windowsHide: true }, () => {})
      } catch {
        /* taskkill missing: the grace timer still tries the forced pass */
      }
      return
    }
    if (task.detached && Number.isInteger(task.pid) && task.pid > 0) {
      try {
        process.kill(-task.pid, signal)
        return
      } catch {
        /* process group already gone: fall through to the direct child */
      }
    }
    try {
      task.child.kill(signal)
    } catch {
      /* already exited */
    }
  }

  function requireTask(id) {
    const task = tasks.get(typeof id === 'string' ? id : '')
    if (task === undefined) throw new TaskError('not-found', '任务不存在或已超过保留时间')
    return task
  }

  function countRunning(root) {
    let count = 0
    for (const task of tasks.values()) {
      if (!task.closed && task.root === root) count += 1
    }
    return count
  }

  /** Drop tasks past the retention window and finished rows the list cannot show. */
  function prune(now = Date.now()) {
    const finished = []
    for (const [id, task] of tasks) {
      if (!task.closed || task.endedAt === null) continue
      if (now - task.endedAt > TASK_RETENTION_MS) {
        tasks.delete(id)
        continue
      }
      finished.push(task)
    }
    // Running tasks are always listed; older finished ones fall outside the
    // 32-row window anyway, so keeping them pinned only wastes memory.
    if (finished.length <= MAX_LIST) return
    finished.sort((left, right) => left.startedAt - right.startedAt)
    for (const task of finished.slice(0, finished.length - MAX_LIST)) tasks.delete(task.id)
  }

  /**
   * Read a task's buffered output without long-polling.
   *
   * `since` returns the stream after that offset (a reset marker when the
   * offset predates the trimmed ring); `tail` keeps only the last N characters.
   * Both may be combined. The returned `truncated` flag says whether bytes were
   * dropped from the front, so a tool can tell the model the tail is partial.
   */
  function read(id, options = {}) {
    const task = requireTask(id)
    const total = task.base + task.buffer.length
    const tail = Number.isFinite(Number(options.tail)) ? Math.max(0, Math.floor(Number(options.tail))) : null
    const since = Number.isFinite(Number(options.since)) ? Math.max(0, Math.floor(Number(options.since))) : null
    let data = ''
    let truncated = false
    let reset = false
    if (since !== null) {
      const offset = since - task.base
      if (offset < 0) {
        reset = true
        data = task.buffer
      } else if (offset < task.buffer.length) {
        data = task.buffer.slice(offset)
      }
      if (tail !== null && data.length > tail) {
        data = data.slice(-tail)
        truncated = true
      }
      if (reset && task.base > 0) truncated = true
    } else {
      const wanted = tail === null ? task.buffer.length : Math.min(tail, task.buffer.length)
      data = wanted === task.buffer.length ? task.buffer : task.buffer.slice(-wanted)
      truncated = task.base > 0 || wanted < total
    }
    return {
      id: task.id,
      name: task.name,
      command: task.command,
      cwd: task.cwd,
      source: task.source,
      data,
      next: total,
      reset,
      closed: task.closed,
      exitCode: task.exitCode,
      signal: task.signal,
      durationMs: (task.endedAt ?? Date.now()) - task.startedAt,
      truncated,
    }
  }

  /** Number of live tasks in one workspace (synchronous: used by prompt context). */
  function runningCount(root) {
    if (typeof root !== 'string' || root.length === 0) return 0
    const key = path.resolve(root)
    let count = 0
    for (const task of tasks.values()) {
      if (!task.closed && task.root === key) count += 1
    }
    return count
  }

  /** Persisted run records for one workspace, newest first. */
  async function listRuns(root) {
    if (!isDurableRoot(root)) return []
    const key = path.resolve(root)
    const pending = runsChains.get(key)
    if (pending !== undefined) await pending
    const runs = await loadLedger(key)
    return runs.map((record) => ({ ...record }))
  }

  /** Record one settled task and queue a best-effort ledger write. */
  function recordRun(task) {
    const record = {
      id: task.id,
      name: task.name,
      command: task.command,
      cwd: task.cwd,
      startedAt: task.startedAt,
      endedAt: task.endedAt ?? Date.now(),
      exitCode: typeof task.exitCode === 'number' ? task.exitCode : null,
      signal: typeof task.signal === 'string' ? task.signal : null,
      durationMs: typeof task.durationMs === 'number' ? Math.max(0, task.durationMs) : 0,
      source: task.source === 'tool' ? 'tool' : 'panel',
      problemCount: parseProblems(task.buffer, { limit: 500, root: task.root }).length,
    }
    const key = path.resolve(task.root)
    const ledger = runLedgers.get(key) ?? { loaded: false, runs: [] }
    ledger.runs = mergeRuns([record, ...ledger.runs])
    runLedgers.set(key, ledger)
    queueRunsWrite(key)
  }

  /** Load (once) and return the ledger for one workspace root. */
  async function loadLedger(key) {
    const ledger = runLedgers.get(key) ?? { loaded: false, runs: [] }
    if (!ledger.loaded) {
      const fromDisk = await readRunsFile(key)
      ledger.runs = mergeRuns([...ledger.runs, ...fromDisk])
      ledger.loaded = true
      runLedgers.set(key, ledger)
    }
    return ledger.runs
  }

  /**
   * Serialize ledger writes per workspace. Records appended before the first
   * disk read survive because the write merges memory with the file.
   */
  function queueRunsWrite(key) {
    const previous = runsChains.get(key) ?? Promise.resolve()
    const current = previous
      .catch(() => {})
      .then(async () => {
        const runs = await loadLedger(key)
        await writeRunsFile(key, runs)
      })
      .catch((error) => {
        reportRunWriteError(key, error)
      })
    runsChains.set(key, current)
    current.finally(() => {
      if (runsChains.get(key) === current) runsChains.delete(key)
    })
    return current
  }

  function closeAll() {
    for (const task of tasks.values()) {
      if (!task.closed) requestKill(task)
    }
    tasks.clear()
    detectCache.clear()
    runLedgers.clear()
    runsChains.clear()
  }

  return { handle, closeAll, start, poll, list, kill, detect, read, listRuns, runningCount }
}

/** True when a root can carry a local `.dsh/runs.json` ledger. */
function isDurableRoot(value) {
  return typeof value === 'string' && value.length > 0 && !/^ssh:\/\//iu.test(value) && path.isAbsolute(value)
}

/** Absolute path of one workspace's durable run ledger. */
function runsFile(root) {
  return path.join(path.resolve(root), '.dsh', RUNS_FILENAME)
}

/** Read and normalize one runs file; missing or corrupt files read as empty. */
async function readRunsFile(root) {
  const file = runsFile(root)
  let info
  try {
    info = await fsp.stat(file)
  } catch (error) {
    if (error !== null && typeof error === 'object' && error.code === 'ENOENT') return []
    throw error
  }
  if (!info.isFile() || info.size > MAX_RUNS_BYTES) return []
  let parsed
  try {
    parsed = JSON.parse(await fsp.readFile(file, 'utf8'))
  } catch {
    return []
  }
  const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.runs) ? parsed.runs : []
  return mergeRuns(list)
}

/** Write one runs file atomically, creating `.dsh` and its ignore file. */
async function writeRunsFile(root, runs) {
  const directory = path.join(path.resolve(root), '.dsh')
  await fsp.mkdir(directory, { recursive: true })
  try {
    await fsp.writeFile(path.join(directory, '.gitignore'), '*\n', { encoding: 'utf8', flag: 'wx', mode: 0o600 })
  } catch (error) {
    if (error === null || typeof error !== 'object' || error.code !== 'EEXIST') throw error
  }
  const file = path.join(directory, RUNS_FILENAME)
  const text = `${JSON.stringify({ version: 1, updatedAt: Date.now(), runs }, null, 2)}\n`
  const temporary = path.join(
    directory,
    `.runs-${String(process.pid)}-${String(Date.now())}-${randomUUID()}.tmp`,
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

/** Normalize one stored/incoming run record; malformed entries are dropped. */
function normalizeRunRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const id = typeof value.id === 'string' ? value.id : ''
  if (id.length === 0) return null
  const startedAt = Number.isFinite(value.startedAt) ? Math.max(0, Math.floor(value.startedAt)) : 0
  const endedAt = Number.isFinite(value.endedAt) ? Math.max(startedAt, Math.floor(value.endedAt)) : startedAt
  const record = {
    id,
    name: typeof value.name === 'string' ? value.name.slice(0, MAX_NAME) : '',
    command: typeof value.command === 'string' ? value.command.slice(0, MAX_COMMAND) : '',
    cwd: typeof value.cwd === 'string' ? value.cwd : '',
    startedAt,
    endedAt,
    exitCode: Number.isInteger(value.exitCode) ? value.exitCode : null,
    signal: typeof value.signal === 'string' ? value.signal : null,
    durationMs: Number.isFinite(value.durationMs)
      ? Math.max(0, Math.floor(value.durationMs))
      : Math.max(0, endedAt - startedAt),
    source: value.source === 'tool' ? 'tool' : 'panel',
  }
  if (Number.isInteger(value.problemCount) && value.problemCount >= 0) record.problemCount = value.problemCount
  return record
}

/** Deduplicate by id, newest first, capped to MAX_RUNS. */
function mergeRuns(candidates) {
  const seen = new Set()
  const rows = []
  for (const candidate of Array.isArray(candidates) ? candidates : []) {
    const record = normalizeRunRecord(candidate)
    if (record === null || seen.has(record.id)) continue
    seen.add(record.id)
    rows.push(record)
  }
  rows.sort((left, right) => right.startedAt - left.startedAt || right.endedAt - left.endedAt)
  return rows.slice(0, MAX_RUNS)
}

/** Log one best-effort ledger failure without disrupting task settlement. */
function reportRunWriteError(root, error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`dsh-web-filebrowser-tasks: failed to persist runs for ${root}: ${message.slice(0, MAX_RUN_WRITE_ERROR)}`)
}

/** Reject roots this local process cannot run commands in (SSH remotes). */
function assertLocalRoot(root) {
  if (typeof root !== 'string' || root.length === 0) throw new TaskError('root-unknown', '工作区目录无效')
  if (root.startsWith('ssh://')) throw new TaskError('ssh-unsupported', '任务运行器暂不支持 SSH 远程工作区')
}

/**
 * Resolve the start directory for a task. Relative paths are rejected on
 * purpose: the browser always knows the workspace root, and allowing relative
 * cwd would mean re-implementing root escaping rules here.
 */
async function resolveCwd(root, requested) {
  if (requested === undefined || requested === null) return root
  if (typeof requested !== 'string') throw new TaskError('bad-cwd', 'cwd 必须是工作区内的绝对路径')
  const wanted = requested.trim()
  if (wanted.length === 0) return root
  if (!path.isAbsolute(wanted)) throw new TaskError('bad-cwd', 'cwd 必须是工作区内的绝对路径')
  let real
  try {
    real = await fsp.realpath(wanted)
  } catch {
    throw new TaskError('cwd-unknown', `工作目录不存在：${wanted}`)
  }
  if (!isInside(root, real)) throw new TaskError('outside-root', 'cwd 必须位于工作区内')
  try {
    if (!(await fsp.stat(real)).isDirectory()) throw new TaskError('bad-cwd', `cwd 不是目录：${wanted}`)
  } catch (error) {
    if (error instanceof TaskError) throw error
    throw new TaskError('cwd-unknown', `无法访问工作目录：${wanted}`)
  }
  return real
}

function normalizeName(value, command) {
  if (typeof value === 'string' && value.trim().length > 0) {
    const name = value.trim()
    return name.length > MAX_NAME ? name.slice(0, MAX_NAME) : name
  }
  const firstLine = command.split(/\r?\n/u)[0].trim()
  return firstLine.length > 60 ? `${firstLine.slice(0, 57)}...` : firstLine
}

/** Environment for every task: predictable, non-interactive and colourless. */
function taskEnv() {
  return { ...process.env, CI: '1', NO_COLOR: '1', FORCE_COLOR: '0', TERM: 'dumb' }
}

/** True when `candidate` is `root` or lives below it. */
function isInside(root, candidate) {
  const relative = path.relative(root, candidate)
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
}

/** Scan the workspace's first two levels, skipping dependency/build folders. */
async function scanProject(root) {
  const files = []
  const queue = ['']
  let count = 0
  while (queue.length > 0 && count < DETECT_MAX_FILES) {
    const dir = queue.shift()
    const absolute = dir === '' ? root : path.join(root, ...dir.split('/'))
    let entries
    try {
      entries = await fsp.readdir(absolute, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (count >= DETECT_MAX_FILES) break
      if (entry.isSymbolicLink()) continue
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') || IGNORED_DIRS.has(entry.name.toLowerCase())) continue
        const relative = dir === '' ? entry.name : `${dir}/${entry.name}`
        if (relative.split('/').length < DETECT_MAX_DEPTH) queue.push(relative)
        continue
      }
      if (!entry.isFile()) continue
      count += 1
      files.push(dir === '' ? entry.name : `${dir}/${entry.name}`)
    }
  }
  return files
}

/** Arrange scanned files into project directories, shallowest first. */
function groupProjects(files) {
  const groups = new Map()
  for (const relative of files) {
    const basename = path.posix.basename(relative).toLowerCase()
    if (!PROJECT_MARKERS.has(basename)) continue
    const dir = path.posix.dirname(relative)
    const normalized = dir === '.' ? '' : dir
    let entry = groups.get(normalized)
    if (entry === undefined) {
      entry = new Map()
      groups.set(normalized, entry)
    }
    entry.set(basename, relative)
  }
  return [...groups.entries()]
    .map(([dir, markers]) => ({ dir, markers }))
    .sort((left, right) => depth(left.dir) - depth(right.dir) || left.dir.localeCompare(right.dir))
    .slice(0, DETECT_MAX_DIRS)
}

function depth(dir) {
  return dir === '' ? 0 : dir.split('/').length
}

/** Add the commands a single project directory supports. */
async function collectProject(root, project, prefix, add) {
  const dir = project.dir === '' ? root : path.join(root, ...project.dir.split('/'))
  const markers = project.markers
  if (markers.has('package.json')) {
    const manager = markers.has('pnpm-lock.yaml') ? 'pnpm' : markers.has('yarn.lock') ? 'yarn' : 'npm'
    let scripts = {}
    try {
      const parsed = JSON.parse(await fsp.readFile(path.join(dir, 'package.json'), 'utf8'))
      if (parsed?.scripts !== null && typeof parsed?.scripts === 'object') scripts = parsed.scripts
    } catch {
      /* malformed package.json: fall through to the other project markers */
    }
    const names = [
      ...new Set([...PREFERRED_SCRIPTS.filter((name) => name in scripts), ...Object.keys(scripts)]),
    ].slice(0, MAX_SCRIPTS)
    for (const name of names) {
      if (typeof scripts[name] !== 'string') continue
      add(`${manager} run ${name}`, `${prefix}${manager} run ${quoteArg(name)}`, groupFor(name))
    }
  }
  const makefile = ['makefile', 'gnumakefile'].find((name) => markers.has(name))
  if (makefile !== undefined) {
    for (const target of await makeTargets(path.join(root, ...markers.get(makefile).split('/')))) {
      add(`make ${target}`, `${prefix}make ${quoteArg(target)}`, groupFor(target))
    }
  }
  if (markers.has('cargo.toml')) {
    add('cargo run', `${prefix}cargo run`, 'dev')
    add('cargo build', `${prefix}cargo build`, 'build')
    add('cargo test', `${prefix}cargo test`, 'test')
  }
  if (markers.has('go.mod')) {
    add('go run ./...', `${prefix}go run ./...`, 'dev')
    add('go test ./...', `${prefix}go test ./...`, 'test')
  }
  if (markers.has('pyproject.toml') || markers.has('requirements.txt')) {
    add('pytest', `${prefix}pytest`, 'test')
  }
  if (markers.has('manage.py')) {
    add('python manage.py runserver', `${prefix}python manage.py runserver`, 'dev')
  }
  const compose = COMPOSE_FILES.find((name) => markers.has(name))
  if (compose !== undefined) add('docker compose up', `${prefix}docker compose up`, 'dev')
}

/** Read top-level make targets (`^[A-Za-z0-9_.-]+:`) from a Makefile. */
async function makeTargets(file) {
  let text
  try {
    text = await fsp.readFile(file, 'utf8')
  } catch {
    return []
  }
  const targets = []
  const seen = new Set()
  for (const line of text.split(/\r?\n/u)) {
    if (targets.length >= MAX_MAKE_TARGETS) break
    const match = /^([A-Za-z0-9_.-]+):/u.exec(line)
    if (match === null) continue
    const name = match[1]
    // Skip special targets (.PHONY, .DEFAULT, ...) and `NAME:=value` assignments.
    if (name.startsWith('.') || line[match[1].length + 1] === '=' || seen.has(name)) continue
    seen.add(name)
    targets.push(name)
  }
  return targets
}

/** Pick the group of a script or make target name. */
function groupFor(name) {
  const lower = String(name).toLowerCase()
  const direct = GROUP_BY_NAME[lower]
  if (direct !== undefined) return direct
  for (const [group, pattern] of GROUP_PATTERNS) {
    if (pattern.test(lower)) return group
  }
  return 'other'
}

/** Quote one path/name for the shell that executes tasks. */
function quoteArg(value) {
  const text = String(value)
  if (/^[A-Za-z0-9_./:@+-]+$/u.test(text)) return text
  return IS_WINDOWS ? `"${text.replaceAll('"', '""')}"` : `'${text.replaceAll("'", "'\\''")}'`
}

function success(value) {
  return json({ ok: true, value })
}

function successError(code, message) {
  return json({ ok: false, error: { code, message } })
}

function failure(status, code, message) {
  return json({ ok: false, error: { code, message } }, status)
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}
