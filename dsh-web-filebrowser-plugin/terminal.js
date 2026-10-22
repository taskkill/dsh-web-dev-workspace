/**
 * Minimal local terminal backend for the file browser.
 *
 * On POSIX, a `script(1)` pseudo-terminal keeps the shell interactive
 * (prompt, colours, line editing, full-screen programs) without a native
 * node-pty dependency. Windows has no `script`, so it uses the system command
 * processor over pipes; that fallback is line-buffered and does not provide a
 * real PTY. The browser half uses a vendored xterm.js and polls a bounded
 * output buffer.
 *
 * Terminals run as the Harness host user inside a registered local workspace.
 * They are owner-authenticated like every other route; no shell command is
 * sandboxed beyond that. SSH workspaces are rejected (the shell is local).
 */

import { execFile, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { promises as fsp } from 'node:fs'
import { StringDecoder } from 'node:string_decoder'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const IS_WINDOWS = process.platform === 'win32'
const MAX_SESSIONS = 8
const MAX_BUFFER = 1_000_000
const MAX_WRITE = 64 * 1024
const MAX_ASSET = 2 * 1024 * 1024
const TITLE_PREFIX = 'Terminal'
const MAX_COMMANDS = 40
const COMMAND_SCAN_DEPTH = 4
const COMMAND_SCAN_FILES = 2000

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
 */
export function createTerminalManager({ resolveRoot, vendorDir }) {
  const sessions = new Map()
  let counter = 0

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
          return success(poll(body))
        case 'resize':
          return success(await resize(body))
        case 'close':
          return success(close(body))
        case 'commands':
          return success(await listCommands(body))
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
    if (typeof root === 'string' && root.startsWith('ssh://')) {
      throw new TerminalError('ssh-unsupported', 'SSH 远程工作区暂不支持本地终端')
    }
    const cols = clampDimension(body.cols, 20, 300, 100)
    const rows = clampDimension(body.rows, 10, 100, 28)
    counter += 1
    const id = randomUUID()
    let ptsFile = null
    let child
    if (IS_WINDOWS) {
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
      title: `${TITLE_PREFIX} ${String(counter)}`,
      cwd: root,
      child,
      ptsFile,
      cols,
      rows,
      pty: !IS_WINDOWS,
      buffer: '',
      base: 0,
      closed: false,
      exitCode: null,
      decoder: new StringDecoder('utf8'),
    }
    sessions.set(id, session)
    const append = (chunk) => {
      if (session.closed) return
      session.buffer += session.decoder.write(chunk)
      if (session.buffer.length > MAX_BUFFER) {
        const drop = session.buffer.length - MAX_BUFFER
        session.buffer = session.buffer.slice(drop)
        session.base += drop
      }
    }
    child.stdout?.on('data', append)
    child.stderr?.on('data', append)
    child.once('error', (error) => {
      append(`\r\n[terminal error: ${error.message}]\r\n`)
      session.closed = true
      session.exitCode = null
    })
    child.once('exit', (code, signal) => {
      append(session.decoder.end())
      append(`\r\n[process exited${code === null ? '' : `: ${String(code)}`}${signal ? ` (${signal})` : ''}]\r\n`)
      session.closed = true
      session.exitCode = code
    })
    return { id, title: session.title, cwd: root, cols, rows, pty: session.pty }
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

  /** Detect runnable commands for the workspace at the terminal's root. */
  async function listCommands(body) {
    const root = await resolveRoot(typeof body.root === 'string' ? body.root : '')
    if (typeof root === 'string' && root.startsWith('ssh://')) {
      throw new TerminalError('ssh-unsupported', 'SSH 远程工作区暂不支持本地终端')
    }
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
    const isDirectory = async (name) => {
      try {
        return (await fsp.stat(path.join(root, name))).isDirectory()
      } catch {
        return false
      }
    }

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
      add('Maven Spring Boot', `${(await isFile('mvnw')) ? './mvnw' : 'mvn'} spring-boot:run`)
    }
    if ((await isFile('build.gradle')) || (await isFile('build.gradle.kts'))) {
      add('Gradle Boot Run', `${(await isFile('gradlew')) ? './gradlew' : 'gradle'} bootRun`)
    }
    if (await isFile('manage.py')) add('Django runserver', 'python manage.py runserver')
    if (await isFile('requirements.txt')) add('pip install', 'pip install -r requirements.txt')
    if (await isFile('go.mod')) add('Go run', 'go run .')
    if (await isFile('Cargo.toml')) add('Cargo run', 'cargo run')
    if ((await isFile('docker-compose.yml')) || (await isFile('docker-compose.yaml')) || (await isFile('compose.yaml'))) {
      add('Docker Compose', 'docker compose up')
    }
    if ((await isFile('build.sbt'))) add('sbt run', 'sbt run')
    if ((await isFile('mix.exs'))) add('mix phx.server', 'mix phx.server')

    const csproj = []
    try {
      for (const entry of await fsp.readdir(root, { withFileTypes: true })) {
        if (entry.isFile() && entry.name.toLowerCase().endsWith('.csproj')) csproj.push(entry.name)
        if (entry.isFile() && entry.name.toLowerCase().endsWith('.sln')) add('dotnet build', `dotnet build ${quotePath(entry.name)}`)
      }
    } catch {
      /* unreadable root: other detectors already ran */
    }
    if (csproj.length > 0) add('dotnet run', csproj.length === 1 ? `dotnet run --project ${quotePath(csproj[0])}` : 'dotnet run')

    const jars = { path: [], files: 0, results: [] }
    await scanFiles(root, ['.jar'], jars)
    for (const jar of jars.results) add(`java -jar ${jar}`, `java -jar ${quotePath(jar)}`)
    const dlls = { path: [], files: 0, results: [] }
    await scanFiles(root, ['.dll'], dlls)
    for (const dll of dlls.results) add(`dotnet ${dll}`, `dotnet ${quotePath(dll)}`)

    return { root, commands }
  }

  async function write(body) {
    const session = requireSession(body.id)
    if (session.closed) throw new TerminalError('closed', '终端进程已退出')
    const data = typeof body.data === 'string' ? body.data : ''
    if (data.length === 0) return { ok: true }
    if (data.length > MAX_WRITE) throw new TerminalError('too-large', '单次输入过大')
    await new Promise((resolve, reject) => {
      session.child.stdin.write(data, (error) => (error ? reject(error) : resolve()))
    })
    return { ok: true }
  }

  function poll(body) {
    const session = requireSession(body.id)
    const since = Number.isFinite(Number(body.since)) ? Math.max(0, Math.floor(Number(body.since))) : 0
    if (since < session.base) {
      return {
        data: session.buffer,
        next: session.base + session.buffer.length,
        reset: true,
        closed: session.closed,
        exitCode: session.exitCode,
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
    }
  }

  async function resize(body) {
    const session = requireSession(body.id)
    const cols = clampDimension(body.cols, 20, 300, session.cols)
    const rows = clampDimension(body.rows, 10, 100, session.rows)
    session.cols = cols
    session.rows = rows
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
    for (const session of sessions.values()) terminate(session)
    sessions.clear()
  }

  return { handle, closeAll }
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
