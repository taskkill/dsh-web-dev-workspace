/**
 * Terminal backend for the file browser: local workspaces and SSH remotes.
 *
 * On POSIX, a `script(1)` pseudo-terminal keeps the local shell interactive
 * (prompt, colours, line editing, full-screen programs) without a native
 * node-pty dependency. Windows has no `script`, so it uses the system command
 * processor over pipes; that fallback is line-buffered and does not provide a
 * real PTY. A workspace rooted at `ssh://user@host:port/path` instead opens a
 * shell channel through the host's ssh2 connection pool, with a remote PTY and
 * the remote root as the start directory. The browser half uses a vendored
 * xterm.js and holds a long poll on a bounded output buffer, so bytes are
 * delivered as soon as they arrive instead of on a fixed timer.
 *
 * Terminals run as the Harness host user (local) or as the SSH login user, and
 * are owner-authenticated like every other route; no shell command is
 * sandboxed beyond that.
 */

import { execFile, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { promises as fsp } from 'node:fs'
import { StringDecoder } from 'node:string_decoder'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const IS_WINDOWS = process.platform === 'win32'
const MAX_SESSIONS = 8
const MAX_BUFFER = 1_000_000
/** Trim a full buffer down to MAX_BUFFER only after this much extra output. */
const TRIM_SLACK = 256 * 1024
/** Longest an idle poll waits for output before answering empty. */
const MAX_POLL_WAIT = 1000
const MAX_WRITE = 64 * 1024
const MAX_ASSET = 2 * 1024 * 1024
const TITLE_PREFIX = 'Terminal'
const MAX_COMMANDS = 40
const COMMAND_SCAN_DEPTH = 4
const COMMAND_SCAN_FILES = 2000
/** Reuse a detected command list for this long unless the client forces a refresh. */
const COMMAND_CACHE_MS = 30_000
/**
 * Close a terminal no browser has touched for this long. Sessions now survive a
 * page reload so a running dev server keeps living; this only reaps abandoned
 * ones instead of leaking all MAX_SESSIONS slots.
 */
const IDLE_TERMINAL_MS = 12 * 60 * 60 * 1000

const ASSETS = new Map([
  ['xterm.js', 'text/javascript; charset=utf-8'],
  ['xterm.css', 'text/css; charset=utf-8'],
  ['addon-fit.js', 'text/javascript; charset=utf-8'],
  ['LICENSE.xterm', 'text/plain; charset=utf-8'],
])

class TerminalError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'TerminalError'
    this.code = code
  }
}

/**
 * Create the terminal manager bound to one host context.
 * @param options.resolveRoot - validates and canonicalizes a workspace root.
 * @param options.vendorDir - absolute directory containing xterm assets.
 * @param options.openSshShell - opens a shell channel for an `ssh://` root.
 */
export function createTerminalManager({ resolveRoot, vendorDir, openSshShell }) {
  const sessions = new Map()
  const commandCache = new Map()
  let counter = 0
  // Reap sessions a reload never re-attached to; unref keeps the Host free to exit.
  const sweeper = setInterval(() => {
    const now = Date.now()
    for (const [id, session] of sessions) {
      if (now - session.lastTouch <= IDLE_TERMINAL_MS) continue
      sessions.delete(id)
      terminate(session)
    }
  }, 60_000)
  sweeper.unref?.()

  async function handle(request) {
    try {
      if (request.method === 'GET') return await handleAsset(request)
      if (request.method !== 'POST') return failure(405, 'bad-method', '仅支持 GET 与 POST')
      let body
      try {
        body = await request.json()
      } catch {
        return failure(400, 'bad-request', '请求体不是有效的 JSON')
      }
      if (body === null || typeof body !== 'object' || typeof body.op !== 'string') {
        return failure(400, 'bad-request', '缺少操作名 op')
      }
      switch (body.op) {
        case 'open':
          return success(await open(body))
        case 'write':
          return success(await write(body))
        case 'poll':
          return success(await poll(body))
        case 'resize':
          return success(await resize(body))
        case 'close':
          return success(close(body))
        case 'commands':
          return success(await listCommands(body))
        case 'list':
          return success(list(body))
        default:
          return failure(400, 'bad-op', `未知的终端操作：${body.op}`)
      }
    } catch (error) {
      if (error instanceof TerminalError) return successError(error.code, error.message)
      console.error('dsh-web-filebrowser-terminal: request failed', error)
      return successError('internal', error instanceof Error ? error.message : String(error))
    }
  }

  async function open(body) {
    if (sessions.size >= MAX_SESSIONS) throw new TerminalError('too-many', `最多同时打开 ${String(MAX_SESSIONS)} 个终端`)
    const root = await resolveRoot(typeof body.root === 'string' ? body.root : '')
    const sshRoot = typeof root === 'string' && root.startsWith('ssh://')
    const cols = clampDimension(body.cols, 20, 300, 100)
    const rows = clampDimension(body.rows, 10, 100, 28)
    counter += 1
    const id = randomUUID()
    let ptsFile = null
    let child
    let channel = null
    let sshInfo = null
    if (sshRoot) {
      if (typeof openSshShell !== 'function') {
        throw new TerminalError('ssh-unsupported', '当前 Host 没有加载 SSH 终端支持')
      }
      try {
        const opened = await openSshShell(root, { cols, rows })
        channel = opened.channel
        sshInfo = opened.parsed ?? null
        child = sshChild(channel)
      } catch (error) {
        const code = typeof error?.sideCode === 'string' ? error.sideCode : 'ssh-failed'
        throw new TerminalError(code, error instanceof Error ? error.message : String(error))
      }
    } else if (IS_WINDOWS) {
      // Windows has no script(1) or /dev/pts. Keep the command processor alive
      // over pipes and switch its code page to UTF-8 so output matches xterm.
      const shell = process.env.ComSpec || process.env.COMSPEC || 'cmd.exe'
      child = spawn(shell, ['/D', '/Q', '/K', 'chcp 65001>nul'], {
        cwd: root,
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
        },
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      })
    } else {
      ptsFile = path.join(os.tmpdir(), `dsh-web-filebrowser-term-${id}.tty`)
      const command = [
        `stty cols ${String(cols)} rows ${String(rows)} 2>/dev/null`,
        `tty > ${shellQuote(ptsFile)} 2>/dev/null`,
        `export PS1='\\u@\\h:\\w\\$ '`,
        `exec /bin/bash --noprofile --norc`,
      ].join('; ')
      child = spawn('script', ['-qfc', command, '/dev/null'], {
        cwd: root,
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
          LANG: process.env.LANG || 'C.UTF-8',
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      })
    }
    const session = {
      id,
      title: sshInfo === null ? `${TITLE_PREFIX} ${String(counter)}` : sshTitle(sshInfo),
      cwd: sshInfo === null ? root : sshInfo.path,
      child,
      channel,
      ssh: sshRoot,
      ptsFile,
      cols,
      rows,
      pty: sshRoot || !IS_WINDOWS,
      root,
      startedAt: Date.now(),
      lastTouch: Date.now(),
      buffer: '',
      base: 0,
      closed: false,
      exitCode: null,
      decoder: new StringDecoder('utf8'),
      waiters: new Set(),
    }
    sessions.set(id, session)
    const append = (chunk) => {
      if (session.closed) return
      const text = session.decoder.write(chunk)
      if (text.length === 0) return
      session.buffer += text
      // Trimming on every chunk once the buffer is full copies the whole
      // buffer per write, which is what made heavy output feel sluggish.
      // Let it grow a little past the cap and drop the excess in one slice.
      if (session.buffer.length > MAX_BUFFER + TRIM_SLACK) {
        const drop = session.buffer.length - MAX_BUFFER
        session.buffer = session.buffer.slice(drop)
        session.base += drop
      }
      wake(session)
    }
    child.stdout?.on('data', append)
    child.stderr?.on('data', append)
    child.once('error', (error) => {
      append(`\r\n[terminal error: ${error.message}]\r\n`)
      session.closed = true
      session.exitCode = null
      wake(session)
    })
    child.once('exit', (code, signal) => {
      append(session.decoder.end())
      append(`\r\n[process exited${code === null ? '' : `: ${String(code)}`}${signal ? ` (${signal})` : ''}]\r\n`)
      session.closed = true
      session.exitCode = code
      wake(session)
    })
    return { id, title: session.title, cwd: session.cwd, cols, rows, pty: session.pty, ssh: session.ssh }
  }

  /** Quote one relative file path for the shell that owns this terminal. */
  function quotePath(value) {
    const text = String(value)
    if (/^[A-Za-z0-9_./:@+-]+$/u.test(text)) return text
    if (IS_WINDOWS) return `"${text.replaceAll('"', '""')}"`
    return shellQuote(text)
  }

  /** Recursively collect a bounded number of files with the given extensions. */
  async function scanFiles(root, extensions, state, depth = 0) {
    if (depth > COMMAND_SCAN_DEPTH || state.files >= COMMAND_SCAN_FILES || state.results.length >= 20) return
    let entries
    try {
      entries = await fsp.readdir(depth === 0 ? root : path.join(root, ...state.path), { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (state.files >= COMMAND_SCAN_FILES || state.results.length >= 20) return
      if (entry.isSymbolicLink()) continue
      if (entry.isDirectory()) {
        if (['node_modules', '.git', '.venv', 'venv', '__pycache__', 'obj'].includes(entry.name)) continue
        state.path.push(entry.name)
        await scanFiles(root, extensions, state, depth + 1)
        state.path.pop()
        continue
      }
      if (!entry.isFile()) continue
      state.files += 1
      const lower = entry.name.toLowerCase()
      if (!extensions.some((extension) => lower.endsWith(extension))) continue
      state.results.push([...state.path, entry.name].join('/'))
    }
  }

  /** Resolve the deepest child process cwd for a POSIX terminal, when /proc exists. */
  async function deepestCwd(pid, depth = 0) {
    if (!Number.isInteger(pid) || pid <= 0 || depth > 6) return null
    let children = []
    try {
      const text = await fsp.readFile(`/proc/${String(pid)}/task/${String(pid)}/children`, 'utf8')
      children = text.trim().split(/\s+/u).filter(Boolean).map(Number).filter(Number.isInteger)
    } catch {
      /* not Linux or process exited */
    }
    for (const child of children) {
      const nested = await deepestCwd(child, depth + 1)
      if (nested !== null) return nested
    }
    try {
      return await fsp.readlink(`/proc/${String(pid)}/cwd`)
    } catch {
      return null
    }
  }

  /** Read the shell's live cwd, falling back to the directory the terminal opened in. */
  async function sessionCwd(session) {
    if (process.platform === 'linux' && Number.isInteger(session.child?.pid)) {
      const cwd = await deepestCwd(session.child.pid)
      if (typeof cwd === 'string' && cwd.length > 0) {
        try {
          if ((await fsp.stat(cwd)).isDirectory()) return cwd
        } catch {
          /* shell cwd disappeared */
        }
      }
    }
    return session.cwd
  }

  /** Detect runnable commands for the terminal's current directory. */
  async function listCommands(body) {
    let root
    let session = null
    if (typeof body.id === 'string' && body.id.length > 0) {
      session = requireSession(body.id)
      root = await sessionCwd(session)
    } else {
      root = await resolveRoot(typeof body.root === 'string' ? body.root : '')
    }
    // Project files live on the remote host; the local scanner would look at
    // an unrelated (or nonexistent) path. SSH terminals type commands instead.
    if (session !== null && session.ssh) return { root, commands: [] }
    if (typeof root === 'string' && root.startsWith('ssh://')) return { root, commands: [] }
    const cached = commandCache.get(root)
    const force = body.refresh === true
    if (!force && cached !== undefined && Date.now() - cached.at < COMMAND_CACHE_MS) return cached.value
    const commands = []
    const seen = new Set()
    const add = (label, command) => {
      if (command.length === 0 || seen.has(command) || commands.length >= MAX_COMMANDS) return
      seen.add(command)
      commands.push({ id: command, label, command })
    }
    const isFile = async (name) => {
      try {
        return (await fsp.stat(path.join(root, name))).isFile()
      } catch {
        return false
      }
    }

    let hasJava = false
    let hasDotnet = false

    if (await isFile('package.json')) {
      let scripts = {}
      try {
        const parsed = JSON.parse(await fsp.readFile(path.join(root, 'package.json'), 'utf8'))
        if (parsed?.scripts !== null && typeof parsed?.scripts === 'object') scripts = parsed.scripts
      } catch {
        /* malformed package.json: keep project-level commands */
      }
      const manager = (await isFile('pnpm-lock.yaml')) ? 'pnpm' : (await isFile('yarn.lock')) ? 'yarn' : 'npm'
      const preferred = ['dev', 'start', 'serve', 'build', 'test', 'check', 'lint', 'typecheck']
      const names = [...new Set([...preferred.filter((name) => name in scripts), ...Object.keys(scripts)])].slice(0, 12)
      for (const name of names) {
        if (typeof scripts[name] !== 'string') continue
        add(`${manager} run ${name}`, `${manager} run ${name}`)
      }
      add(`${manager} install`, `${manager} install`)
    }
    if (await isFile('pom.xml')) {
      hasJava = true
      add('Maven Spring Boot', `${(await isFile('mvnw')) ? './mvnw' : 'mvn'} spring-boot:run`)
    }
    if ((await isFile('build.gradle')) || (await isFile('build.gradle.kts'))) {
      hasJava = true
      add('Gradle Boot Run', `${(await isFile('gradlew')) ? './gradlew' : 'gradle'} bootRun`)
    }
    if (await isFile('manage.py')) add('Django runserver', 'python manage.py runserver')
    if (await isFile('requirements.txt')) add('pip install', 'pip install -r requirements.txt')
    if (await isFile('go.mod')) add('Go run', 'go run .')
    if (await isFile('Cargo.toml')) add('Cargo run', 'cargo run')
    if ((await isFile('docker-compose.yml')) || (await isFile('docker-compose.yaml')) || (await isFile('compose.yaml'))) {
      add('Docker Compose', 'docker compose up')
    }
    if (await isFile('build.sbt')) {
      hasJava = true
      add('sbt run', 'sbt run')
    }
    if (await isFile('mix.exs')) add('mix phx.server', 'mix phx.server')

    const csproj = []
    try {
      for (const entry of await fsp.readdir(root, { withFileTypes: true })) {
        if (!entry.isFile()) continue
        const lower = entry.name.toLowerCase()
        if (lower.endsWith('.csproj')) {
          hasDotnet = true
          csproj.push(entry.name)
        }
        if (lower.endsWith('.sln') || lower.endsWith('.fsproj') || lower.endsWith('.vbproj')) hasDotnet = true
        if (lower.endsWith('.sln')) add('dotnet build', `dotnet build ${quotePath(entry.name)}`)
        // A root-level artifact is enough to justify a recursive scan even
        // without a build file.
        if (lower.endsWith('.jar')) hasJava = true
        if (lower.endsWith('.dll')) hasDotnet = true
      }
    } catch {
      /* unreadable root: other detectors already ran */
    }
    if (csproj.length > 0) add('dotnet run', csproj.length === 1 ? `dotnet run --project ${quotePath(csproj[0])}` : 'dotnet run')

    // Recursive .jar/.dll discovery is expensive. Only run it when the root
    // actually looks like a Java or .NET project; otherwise a normal JS/Python
    // workspace would be walked on every refresh for no commands.
    if (hasJava) {
      const jars = { path: [], files: 0, results: [] }
      await scanFiles(root, ['.jar'], jars)
      for (const jar of jars.results) add(`java -jar ${jar}`, `java -jar ${quotePath(jar)}`)
    }
    if (hasDotnet) {
      const dlls = { path: [], files: 0, results: [] }
      await scanFiles(root, ['.dll'], dlls)
      for (const dll of dlls.results) add(`dotnet ${dll}`, `dotnet ${quotePath(dll)}`)
    }

    const value = { root, commands }
    commandCache.set(root, { at: Date.now(), value })
    if (commandCache.size > 20) commandCache.delete(commandCache.keys().next().value)
    return value
  }

  async function write(body) {
    const session = requireSession(body.id)
    touch(session)
    if (session.closed) throw new TerminalError('closed', '终端进程已退出')
    const data = typeof body.data === 'string' ? body.data : ''
    if (data.length === 0) return { ok: true }
    if (data.length > MAX_WRITE) throw new TerminalError('too-large', '单次输入过大')
    await new Promise((resolve, reject) => {
      session.child.stdin.write(data, (error) => (error ? reject(error) : resolve()))
    })
    return { ok: true }
  }

  /** Answer one poll from the session buffer without waiting. */
  function pollSnapshot(session, since) {
    if (since < session.base) {
      return {
        data: session.buffer,
        next: session.base + session.buffer.length,
        reset: true,
        closed: session.closed,
        exitCode: session.exitCode,
        longPoll: true,
      }
    }
    const offset = since - session.base
    const data = offset >= session.buffer.length ? '' : session.buffer.slice(offset)
    return {
      data,
      next: session.base + session.buffer.length,
      reset: false,
      closed: session.closed,
      exitCode: session.exitCode,
      longPoll: true,
    }
  }

  /**
   * Return what the client is missing right now, or hold the request until the
   * terminal produces output (bounded by `wait`). Holding the request is what
   * removes the fixed polling delay from keystroke echo and command output,
   * while an idle terminal costs one request per wait window instead of seven.
   */
  async function poll(body) {
    const session = requireSession(body.id)
    touch(session)
    const since = Number.isFinite(Number(body.since)) ? Math.max(0, Math.floor(Number(body.since))) : 0
    const snapshot = pollSnapshot(session, since)
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
        session.waiters.delete(finish)
        resolve()
      }
      const timer = setTimeout(finish, wait)
      timer.unref?.()
      session.waiters.add(finish)
    })
    return pollSnapshot(session, since)
  }

  /** Record that a browser is still attached to this session. */
  function touch(session) {
    session.lastTouch = Date.now()
  }

  /**
   * Summarize the live sessions for one workspace root.
   *
   * A browser reload re-creates its terminal tabs from this list and then polls
   * each session from offset zero, so the Host replays the buffered output and
   * a dev server that was started before the reload keeps running.
   */
  function list(body) {
    const root = typeof body.root === 'string' ? body.root : ''
    const entries = []
    for (const session of sessions.values()) {
      if (session.closed) continue
      if (root.length > 0 && session.root !== root) continue
      touch(session)
      entries.push({
        id: session.id,
        title: session.title,
        cwd: session.cwd,
        root: session.root,
        cols: session.cols,
        rows: session.rows,
        ssh: session.ssh,
        pty: session.pty,
        startedAt: session.startedAt,
        bytes: session.buffer.length,
      })
    }
    entries.sort((left, right) => left.startedAt - right.startedAt)
    return { root, sessions: entries }
  }

  /** Release every poll waiting on this session (new output or a close). */
  function wake(session) {
    if (session.waiters.size === 0) return
    for (const finish of [...session.waiters]) finish()
  }

  async function resize(body) {
    const session = requireSession(body.id)
    touch(session)
    const cols = clampDimension(body.cols, 20, 300, session.cols)
    const rows = clampDimension(body.rows, 10, 100, session.rows)
    session.cols = cols
    session.rows = rows
    if (session.ssh) {
      if (session.channel === null) return { ok: false }
      try {
        session.channel.setWindow(rows, cols, 0, 0)
        return { ok: true, pty: true }
      } catch {
        return { ok: false }
      }
    }
    if (!session.pty || session.ptsFile === null) return { ok: false, pty: false }
    let pts = ''
    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        pts = (await fsp.readFile(session.ptsFile, 'utf8')).trim()
      } catch {
        pts = ''
      }
      if (pts.startsWith('/dev/pts/')) break
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    if (!pts.startsWith('/dev/pts/')) return { ok: false }
    try {
      await execFileAsync('stty', ['-F', pts, 'cols', String(cols), 'rows', String(rows)])
      session.child.kill('SIGWINCH')
      return { ok: true }
    } catch {
      return { ok: false }
    }
  }

  function close(body) {
    const session = requireSession(body.id)
    terminate(session)
    sessions.delete(session.id)
    return { ok: true }
  }

  function terminate(session) {
    session.closed = true
    wake(session)
    let treeKill = false
    if (IS_WINDOWS && Number.isInteger(session.child.pid) && session.child.exitCode === null) {
      // cmd.exe alone can leave child processes alive; terminate the tree while
      // the parent is still alive so /T can find its descendants.
      treeKill = true
      try {
        execFile('taskkill.exe', ['/PID', String(session.child.pid), '/T', '/F'], { windowsHide: true }, (error) => {
          if (error === null) return
          try {
            session.child.kill('SIGKILL')
          } catch {
            /* already exited */
          }
        })
      } catch {
        treeKill = false
      }
    }
    if (!treeKill) {
      try {
        session.child.stdin.end()
      } catch {
        /* already closed */
      }
      try {
        session.child.kill('SIGTERM')
      } catch {
        /* already exited */
      }
      setTimeout(() => {
        try {
          session.child.kill('SIGKILL')
        } catch {
          /* already exited */
        }
      }, 1000).unref?.()
    }
    if (session.ptsFile !== null) void fsp.unlink(session.ptsFile).catch(() => {})
  }

  function requireSession(id) {
    const session = sessions.get(typeof id === 'string' ? id : '')
    if (session === undefined) throw new TerminalError('not-found', '终端会话不存在或已关闭')
    return session
  }

  async function handleAsset(request) {
    const url = new URL(request.url)
    if (url.searchParams.get('op') !== 'asset') return failure(400, 'bad-op', '未知的静态资源操作')
    const name = url.searchParams.get('name') ?? ''
    const type = ASSETS.get(name)
    if (type === undefined) return failure(404, 'not-found', '资源不存在')
    let bytes
    try {
      bytes = await fsp.readFile(path.join(vendorDir, name))
    } catch {
      return failure(404, 'not-found', '资源不存在')
    }
    if (bytes.length > MAX_ASSET) return failure(413, 'too-large', '资源过大')
    return new Response(bytes, {
      status: 200,
      headers: {
        'content-type': type,
        'cache-control': 'public, max-age=86400',
        'x-content-type-options': 'nosniff',
      },
    })
  }

  function closeAll() {
    clearInterval(sweeper)
    for (const session of sessions.values()) terminate(session)
    sessions.clear()
  }

  return { handle, closeAll }
}

/** Human label for an SSH terminal tab: `user@host: directory`. */
function sshTitle(parsed) {
  const base = path.posix.basename(parsed.path) || '/'
  const user = parsed.username === null || parsed.username === undefined ? '' : `${parsed.username}@`
  return `${user}${parsed.host}: ${base}`
}

/**
 * Wrap an SSH shell channel with the small ChildProcess surface the session
 * code uses: stdout/stderr data events, stdin.write/end, kill, pid and the
 * error/exit events. The channel is duplex, so stdout is the channel itself
 * and stderr is its extended-data stream. Resizing goes through setWindow
 * directly instead of a local `stty`.
 */
function sshChild(channel) {
  const child = new EventEmitter()
  child.pid = null
  child.exitCode = null
  child.stdout = channel
  child.stderr = channel.stderr ?? null
  child.stdin = {
    write(data, callback) {
      try {
        channel.write(data, (error) => {
          if (typeof callback !== 'function') return
          if (error === null || error === undefined) callback()
          else callback(error)
        })
      } catch (error) {
        if (typeof callback === 'function') callback(error)
      }
    },
    end() {
      try {
        channel.end()
      } catch {
        /* channel already gone */
      }
    },
  }
  let finished = false
  const finish = (code) => {
    if (finished) return
    finished = true
    child.exitCode = code
    child.emit('exit', code, null)
  }
  child.kill = (signal) => {
    try {
      if (signal === 'SIGKILL') channel.close()
      else channel.signal('TERM')
    } catch {
      /* channel already gone */
    }
    try {
      channel.end()
    } catch {
      /* channel already gone */
    }
  }
  channel.once('exit', (code) => finish(typeof code === 'number' ? code : null))
  channel.once('close', (code) => {
    if (!finished) finish(typeof code === 'number' ? code : null)
  })
  // A channel can report more than one error while it tears down; forward only
  // the first one so the session's `once` listener always owns it.
  let errored = false
  channel.on('error', (error) => {
    if (errored) return
    errored = true
    child.emit('error', error)
  })
  return child
}

function clampDimension(value, min, max, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, Math.floor(number)))
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`
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
