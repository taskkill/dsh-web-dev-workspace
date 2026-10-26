/**
 * Host half of the dsh-web-filebrowser bundle.
 *
 * The browser editor needs file mutations (create, rename, delete, save), which
 * the shipped read-only `workspaceFiles` Remote namespace does not expose. This
 * host plugin registers one exact Fetch route on the authenticated shared API
 * channel (`/api/dsh-web-filebrowser`). Only owner Peers reach an exact route, so the
 * browser's signed session cookie is the authentication input; no additional
 * token is invented here.
 *
 * Every path is confined to a directory the Harness already knows as a
 * workspace root (the durable registry plus the deployment default directory).
 * Symlinks are resolved before containment is checked so a link cannot escape
 * its root.
 */

import { execFile } from 'node:child_process'
import { createReadStream, promises as fsp } from 'node:fs'
import { lookup as dnsLookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import * as bookmarks from './bookmarks.js'
import * as acceptance from './acceptance.js'
import * as agentTools from './agent-tools.js'
import * as delivery from './delivery.js'
import * as memory from './memory.js'
import * as pipeline from './pipeline.js'
import * as review from './review.js'
import * as ssh from './ssh.js'
import { createTaskManager } from './tasks.js'
import { createPreviewManager } from './preview.js'
import { createWatchManager } from './watcher.js'
import { createTerminalManager } from './terminal.js'
import * as todo from './todo.js'
import * as workspaceState from './workspace-state.js'

/** Exact URL below `/api` that this plugin owns. */
const ROUTE = '/api/dsh-web-filebrowser'

/** Binary upload route for SSH workspaces. */
const ROUTE_SSH_UPLOAD = '/api/dsh-web-filebrowser-ssh'

/** Same-origin proxy used by the built-in browser for public pages. */
const PROXY_ROUTE = '/api/dsh-web-filebrowser-proxy'

/** Local terminal session/asset route. */
const TERMINAL_ROUTE = '/api/dsh-web-filebrowser-terminal'

/** Project task runner route (build/test/lint/dev output streams). */
const TASKS_ROUTE = '/api/dsh-web-filebrowser-tasks'

/** Workspace change long-poll route. */
const WATCH_ROUTE = '/api/dsh-web-filebrowser-watch'

/** Preview share-server management route. */
const PREVIEW_ROUTE = '/api/dsh-web-filebrowser-preview'

/** Delivery packaging route: build-output ZIP and report bundle. */
const DELIVERY_ROUTE = '/api/dsh-web-filebrowser-delivery'

const VENDOR_DIR = fileURLToPath(new URL('./vendor/', import.meta.url))

/** Largest response the preview proxy will read. */
const MAX_PROXY_BYTES = 8 * 1024 * 1024

/** Time budget for one proxied request, including its body. */
const PROXY_TIMEOUT_MS = 20000

/**
 * Deprecated aliases for tabs opened before the rename. They keep the old
 * client functional until it is refreshed or Harness is restarted.
 */
const LEGACY_ROUTE = '/api/dsh-side'
const LEGACY_ROUTE_SSH_UPLOAD = '/api/dsh-side-ssh'

/** Largest file the editor will open as UTF-8 text. */
const MAX_TEXT_BYTES = 8 * 1024 * 1024

/** Largest file the raw passthrough will stream (PDF, images, downloads). */
const MAX_RAW_BYTES = 128 * 1024 * 1024

/** Largest binary upload accepted for an SSH workspace. */
const MAX_SSH_UPLOAD_BYTES = 128 * 1024 * 1024

/** Local manifests that can carry the combined bundle version. */
const VERSION_FILES = [
  fileURLToPath(new URL('../package.json', import.meta.url)),
  fileURLToPath(new URL('./package.json', import.meta.url)),
]

/** GitHub repository that publishes the manifest and version history. */
const VERSION_REPO = 'taskkill/dsh-web-dev-workspace'

/** Public manifest used to discover the latest published version. */
const VERSION_SOURCE = `https://api.github.com/repos/${VERSION_REPO}/contents/package.json?ref=main`

/** Reuse a successful update check for six hours. */
const VERSION_CACHE_MS = 6 * 60 * 60 * 1000

/** Latest successful version check, keyed by the local version it compared. */
let versionCheckCache = null

/** Directories skipped by workspace-wide search and quick-open indexing. */
const SEARCH_SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.next', '.cache', 'out', 'target'])

/** Bounds for one workspace-wide search. */
const MAX_SEARCH_FILES = 5000
const MAX_SEARCH_RESULTS = 500
const MAX_SEARCH_FILE_BYTES = 2 * 1024 * 1024
const MAX_SEARCH_DEPTH = 24
const MAX_QUICK_OPEN_FILES = 5000

/** Profile files the Harness panel may read. */
const HARNESS_FILES = ['cordis.yml', 'cordis.patch.yml', 'package.json', 'pnpm-workspace.yaml']

/** Harness check command timeout. */
const HARNESS_CHECK_TIMEOUT_MS = 120000

/** Repository checkout used by the one-click updater. */
const PLUGIN_ROOT = fileURLToPath(new URL('../', import.meta.url))
const UPDATE_TIMEOUT_MS = 60000

/** Stable, descriptive failure carrying a machine-readable code. */
class SideError extends Error {
  constructor(code, message, details) {
    super(message)
    this.name = 'SideError'
    this.code = code
    this.details = details
  }
}

/** Content types served by the raw passthrough. */
const CONTENT_TYPES = new Map([
  ['.pdf', 'application/pdf'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.avif', 'image/avif'],
  ['.bmp', 'image/bmp'],
  ['.ico', 'image/x-icon'],
  ['.svg', 'image/svg+xml'],
  ['.mp4', 'video/mp4'],
  ['.webm', 'video/webm'],
  ['.mp3', 'audio/mpeg'],
  ['.wav', 'audio/wav'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.htm', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.xml', 'application/xml; charset=utf-8'],
])

/**
 * Register the authenticated file API for this plugin's lifetime.
 * @param ctx - Host context carrying the connection service.
 */
export function apply(ctx) {
  // Long-lived managers are created before the browser route effect so the
  // model tools (task runner, preview shares, workspace status) and the
  // browser routes share exactly one instance per plugin lifetime.
  const services = {
    ctx,
    resolveRoot: (requested) => resolveRoot(ctx, requested),
    terminals: createTerminalManager({
      resolveRoot: (requested) => resolveRoot(ctx, requested),
      vendorDir: VENDOR_DIR,
      openSshShell: (spec, options) => ssh.openShell(spec, options),
    }),
    tasks: createTaskManager({ resolveRoot: (requested) => resolveRoot(ctx, requested) }),
    watcher: createWatchManager({ resolveRoot: (requested) => resolveRoot(ctx, requested) }),
    previews: createPreviewManager({}),
    listPorts: () => listListeningPorts(),
  }
  // Cross-session memory is optional: a deployment without the tools and
  // system-prompt services keeps the file browser fully usable.
  ctx.inject(['tools', 'systemPrompt'], (toolsCtx) => {
    toolsCtx.effect(() => memory.registerMemoryTools(toolsCtx), 'dsh-web-filebrowser: workspace memory tools')
    toolsCtx.effect(() => memory.registerMemoryPrompt(toolsCtx), 'dsh-web-filebrowser: workspace memory prompt')
    toolsCtx.effect(() => todo.registerTodoTools(toolsCtx), 'dsh-web-filebrowser: workspace todo tools')
    toolsCtx.effect(() => todo.registerTodoPrompt(toolsCtx), 'dsh-web-filebrowser: workspace todo prompt')
    toolsCtx.effect(() => acceptance.registerAcceptanceTools(toolsCtx), 'dsh-web-filebrowser: workspace acceptance tools')
    toolsCtx.effect(() => acceptance.registerAcceptancePrompt(toolsCtx), 'dsh-web-filebrowser: workspace acceptance prompt')
    toolsCtx.effect(() => pipeline.registerPipelineTools(toolsCtx), 'dsh-web-filebrowser: delivery pipeline tools')
    toolsCtx.effect(() => pipeline.registerPipelinePrompt(toolsCtx), 'dsh-web-filebrowser: delivery pipeline prompt')
    toolsCtx.effect(() => agentTools.registerAgentTools(toolsCtx, services), 'dsh-web-filebrowser: agent execution tools')
    toolsCtx.effect(() => workspaceState.registerWorkspaceStateTools(toolsCtx, services), 'dsh-web-filebrowser: workspace status tool')
    toolsCtx.effect(() => workspaceState.registerWorkspaceStatePrompt(toolsCtx, services), 'dsh-web-filebrowser: workspace status prompt')
    toolsCtx.effect(() => delivery.registerDeliveryTools(toolsCtx), 'dsh-web-filebrowser: delivery tools')
  })
  ctx.effect(() => {
    let disposed = false
    const disposers = []
    const terminals = services.terminals
    const tasks = services.tasks
    const watcher = services.watcher
    const previews = services.previews
    const register = (route, methods, handler, label) => {
      const registration = ctx.connection.fetch.register({
        path: route,
        methods,
        requestBody: 'buffered',
        fetch: handler,
      })
      registration.then(
        (dispose) => {
          if (disposed) dispose()
          else disposers.push(dispose)
        },
        (error) => {
          console.error(`dsh-web-filebrowser: failed to register ${label}`, error)
        },
      )
    }
    register(ROUTE, ['GET', 'POST'], (request) => handleRequest(ctx, request), 'its API route')
    register(LEGACY_ROUTE, ['GET', 'POST'], (request) => handleRequest(ctx, request), 'its legacy API route')
    register(ROUTE_SSH_UPLOAD, ['POST'], (request) => handleSshUpload(request), 'the SSH upload route')
    register(LEGACY_ROUTE_SSH_UPLOAD, ['POST'], (request) => handleSshUpload(request), 'the legacy SSH upload route')
    register(PROXY_ROUTE, ['GET'], (request) => handleProxy(request), 'the external preview proxy')
    register(TERMINAL_ROUTE, ['GET', 'POST'], (request) => terminals.handle(request), 'the terminal route')
    register(TASKS_ROUTE, ['POST'], (request) => tasks.handle(request), 'the task runner route')
    register(WATCH_ROUTE, ['POST'], (request) => watcher.handle(request), 'the workspace watcher route')
    register(PREVIEW_ROUTE, ['POST'], (request) => previews.handle(request), 'the preview share route')
    register(DELIVERY_ROUTE, ['GET', 'POST'], (request) => handleDelivery(ctx, request), 'the delivery route')
    return () => {
      disposed = true
      for (const dispose of disposers) dispose()
      terminals.closeAll()
      tasks.closeAll()
      watcher.closeAll()
      previews.closeAll()
      void ssh.closeAll()
    }
  }, 'dsh-web-filebrowser: authenticated file API')
}

/** Host dependency: the shared API channel authenticates the route. */
export const inject = ['connection']

/**
 * One Fetch-shaped request.
 * @param ctx - Host context.
 * @param request - incoming request.
 * @returns JSON or binary response.
 */
async function handleRequest(ctx, request) {
  try {
    if (request.method === 'GET') return await handleGet(ctx, request)
    if (request.method !== 'POST') return json({ ok: false, error: failure('bad-method', '仅支持 GET 与 POST') }, 405)
    let body
    try {
      body = await request.json()
    } catch {
      return json({ ok: false, error: failure('bad-request', '请求体不是有效的 JSON') }, 400)
    }
    if (body === null || typeof body !== 'object' || typeof body.op !== 'string') {
      return json({ ok: false, error: failure('bad-request', '缺少操作名 op') }, 400)
    }
    if (body.op === 'sshTest') {
      const password = typeof body.password === 'string' && body.password.length > 0 ? body.password : undefined
      return json({ ok: true, value: await ssh.test(typeof body.spec === 'string' ? body.spec : '', password) })
    }
    const value = await dispatch(ctx, body.op, body)
    return json({ ok: true, value })
  } catch (error) {
    if (error instanceof SideError) {
      return json({ ok: false, error: { code: error.code, message: error.message, details: error.details } }, 200)
    }
    if (error !== null && typeof error === 'object' && typeof error.sideCode === 'string') {
      return json({ ok: false, error: { code: error.sideCode, message: error.message } }, 200)
    }
    console.error('dsh-web-filebrowser: file API failed', error)
    return json({ ok: false, error: failure('internal', error instanceof Error ? error.message : String(error)) }, 200)
  }
}

/**
 * Dispatch one mutation/read operation.
 * @param ctx - Host context.
 * @param op - operation name.
 * @param body - request body.
 * @returns operation value.
 */
async function dispatch(ctx, op, body) {
  switch (op) {
    case 'roots':
      return listRoots(ctx)
    case 'ports':
      return listListeningPorts()
    case 'list':
      return listDirectory(ctx, body)
    case 'read':
      return readText(ctx, body)
    case 'write':
      return writeText(ctx, body)
    case 'createFile':
      return createFile(ctx, body)
    case 'createDir':
      return createDir(ctx, body)
    case 'rename':
      return renamePath(ctx, body)
    case 'move':
      return movePath(ctx, body)
    case 'copy':
      return copyPath(ctx, body)
    case 'delete':
      return deletePath(ctx, body)
    case 'stat':
      return statPath(ctx, body)
    case 'properties':
      return inspectProperties(ctx, body)
    case 'search':
      return searchWorkspace(ctx, body)
    case 'files':
      return listWorkspaceFiles(ctx, body)
    case 'harness':
      return harnessInfo()
    case 'harnessConfig':
      return readHarnessConfig(typeof body.name === 'string' ? body.name : '')
    case 'harnessCheck':
      return runHarnessCheck()
    case 'memoryList':
      return listMemory(ctx, body)
    case 'memorySave':
      return saveMemory(ctx, body)
    case 'memoryUpdate':
      return updateMemory(ctx, body)
    case 'memoryDelete':
      return deleteMemory(ctx, body)
    case 'todoList':
      return listTodo(ctx, body)
    case 'todoAdd':
      return addTodo(ctx, body)
    case 'todoUpdate':
      return updateTodo(ctx, body)
    case 'todoDelete':
      return deleteTodo(ctx, body)
    case 'todoClearCompleted':
      return clearCompletedTodos(ctx, body)
    case 'acceptanceList':
      return listAcceptance(ctx, body)
    case 'acceptanceAdd':
      return addAcceptance(ctx, body)
    case 'acceptanceUpdate':
      return updateAcceptance(ctx, body)
    case 'acceptanceDelete':
      return deleteAcceptance(ctx, body)
    case 'acceptanceClearPassed':
      return clearPassedAcceptance(ctx, body)
    case 'acceptanceReport':
      return acceptanceReport(ctx, body)
    case 'acceptanceEvidenceAdd':
      return acceptanceEvidenceAdd(ctx, body)
    case 'acceptanceEvidenceRemove':
      return acceptanceEvidenceRemove(ctx, body)
    case 'reviewState':
      return reviewState(ctx, body)
    case 'reviewMark':
      return reviewMark(ctx, body)
    case 'reviewClear':
      return reviewClear(ctx, body)
    case 'pipelineList':
      return pipelineList(ctx, body)
    case 'pipelineSetRequirement':
      return pipelineSetRequirement(ctx, body)
    case 'pipelineStart':
      return pipelineStart(ctx, body)
    case 'pipelineSubmit':
      return pipelineSubmit(ctx, body)
    case 'pipelineReview':
      return pipelineReview(ctx, body)
    case 'pipelinePrompt':
      return pipelinePrompt(ctx, body)
    case 'pipelineRecordRelease':
      return pipelineRecordRelease(ctx, body)
    case 'pipelineSetMode':
      return pipelineSetMode(ctx, body)
    case 'pipelineStartChange':
      return pipelineStartChange(ctx, body)
    case 'pipelineUpdateRequirement':
      return pipelineUpdateRequirement(ctx, body)
    case 'pipelineRestartStage':
      return pipelineRestartStage(ctx, body)
    case 'browserBookmarks':
      return listBrowserBookmarks(ctx, body)
    case 'browserBookmarkAdd':
      return addBrowserBookmark(ctx, body)
    case 'browserBookmarkRemove':
      return removeBrowserBookmark(ctx, body)
    case 'browserBookmarkRename':
      return renameBrowserBookmark(ctx, body)
    case 'browserSettingsSave':
      return saveBrowserSettings(ctx, body)
    case 'deliveryHistory':
      return listDeliveryHistory(ctx, body)
    case 'version':
      return { version: await readPackageVersion() }
    case 'versionCheck':
      return checkLatestVersion(body.force === true)
    case 'update':
      return updatePlugin()
    default:
      throw new SideError('bad-op', `未知操作：${op}`)
  }
}

/** Read the version from the combined bundle manifest, falling back to the component manifest. */
async function readPackageVersion() {
  for (const filename of VERSION_FILES) {
    try {
      const parsed = JSON.parse(await fsp.readFile(filename, 'utf8'))
      if (typeof parsed?.version === 'string' && parsed.version.length > 0) return parsed.version
    } catch {
      /* try the next manifest */
    }
  }
  return '0.0.0'
}

/** Compare dotted numeric versions, ignoring an optional `v` prefix and pre-release suffixes. */
function isNewerVersion(latest, current) {
  const parts = (value) => String(value).replace(/^v/iu, '').split(/[.+-]/u).slice(0, 3).map((part) => Number.parseInt(part, 10) || 0)
  const next = parts(latest)
  const now = parts(current)
  for (let index = 0; index < 3; index += 1) {
    if (next[index] !== now[index]) return next[index] > now[index]
  }
  return false
}

/**
 * Compare the local version with the public manifest on GitHub.
 *
 * The check is best-effort and cached after success so opening the panel does
 * not hammer the GitHub API. `force` bypasses the cache for the explicit
 * "check for updates" action.
 *
 * @param force - Ignore a cached successful result.
 * @returns `{ current, latest, updateAvailable, checkedAt, error? }`.
 */
async function checkLatestVersion(force) {
  const current = await readPackageVersion()
  const cached = versionCheckCache
  if (!force && cached !== null && cached.current === current && Date.now() - cached.checkedAt < VERSION_CACHE_MS) {
    return { ...cached, cached: true }
  }
  try {
    const response = await fetch(VERSION_SOURCE, {
      headers: { accept: 'application/vnd.github+json', 'user-agent': 'dsh-web-dev-workspace' },
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) throw new Error(`GitHub HTTP ${String(response.status)}`)
    const payload = await response.json()
    const manifest = JSON.parse(Buffer.from(payload?.content ?? '', 'base64').toString('utf8'))
    const latest = typeof manifest?.version === 'string' ? manifest.version : null
    if (latest === null) throw new Error('远程 package.json 缺少 version')
    const result = {
      current,
      latest,
      updateAvailable: isNewerVersion(latest, current),
      checkedAt: Date.now(),
      source: 'github',
    }
    versionCheckCache = result
    return result
  } catch (error) {
    return {
      current,
      latest: null,
      updateAvailable: false,
      checkedAt: Date.now(),
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/** Run one fixed git command in the plugin checkout. */
function runGit(args) {
  return new Promise((resolve) => {
    execFile(
      'git',
      args,
      {
        cwd: PLUGIN_ROOT,
        timeout: UPDATE_TIMEOUT_MS,
        maxBuffer: 1024 * 1024,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      },
      (error, stdout, stderr) => {
        resolve({
          code: error === null ? 0 : typeof error.code === 'number' ? error.code : 1,
          output: `${stdout ?? ''}${stderr ?? ''}`.trim(),
        })
      },
    )
  })
}

/**
 * One-click update for a local checkout: only a clean, fast-forward git pull.
 *
 * The Host half cannot reload itself, so success still asks the user to restart
 * DSH; this endpoint never spawns a replacement process.
 */
async function updatePlugin() {
  try {
    await fsp.stat(path.join(PLUGIN_ROOT, '.git'))
  } catch {
    throw new SideError('not-git', '当前插件不是 git 检出，无法一键更新；请使用弹窗中的插件管理器命令。')
  }
  const status = await runGit(['status', '--porcelain'])
  if (status.code !== 0) throw new SideError('update-failed', status.output || '无法读取 git 状态')
  if (status.output.length > 0) {
    throw new SideError('dirty', '工作区有未提交更改，无法自动更新。请先提交或储藏后再试。')
  }
  const before = await runGit(['rev-parse', 'HEAD'])
  if (before.code !== 0) throw new SideError('update-failed', before.output || '无法读取当前提交')
  const pull = await runGit(['pull', '--ff-only'])
  if (pull.code !== 0) throw new SideError('update-failed', pull.output || 'git pull 失败')
  const after = await runGit(['rev-parse', 'HEAD'])
  const changed = after.code === 0 && after.output.trim() !== before.output.trim()
  return {
    changed,
    output: pull.output.slice(-100000) || (changed ? 'Updated.' : 'Already up to date.'),
    restartRequired: changed,
  }
}

/** Convert a filesystem-relative path to the editor's `/`-separated form. */
function toPosixPath(value) {
  return value.split(path.sep).join('/')
}

/** Escape a literal string for use inside a RegExp. */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}

/**
 * Walk a local workspace without following symlinks or descending into
 * dependency/build directories.
 *
 * @param root - Canonical workspace root.
 * @param visit - Receives `(absolutePath, relativePath)`; return false to stop.
 * @returns Number of files visited.
 */
async function walkWorkspace(root, visit) {
  let visited = 0
  const walk = async (directory, depth) => {
    if (depth > MAX_SEARCH_DEPTH || visited >= MAX_SEARCH_FILES) return false
    let entries
    try {
      entries = await fsp.readdir(directory, { withFileTypes: true })
    } catch {
      return true
    }
    entries.sort((left, right) => left.name.localeCompare(right.name))
    for (const entry of entries) {
      if (visited >= MAX_SEARCH_FILES) return false
      if (entry.isSymbolicLink()) continue
      const filename = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        if (SEARCH_SKIP_DIRS.has(entry.name)) continue
        if (!(await walk(filename, depth + 1))) return false
        continue
      }
      if (!entry.isFile()) continue
      visited += 1
      if ((await visit(filename, toPosixPath(path.relative(root, filename)))) === false) return false
    }
    return true
  }
  await walk(root, 0)
  return visited
}

/** List local workspace files for quick open. */
async function listWorkspaceFiles(ctx, body) {
  const root = await resolveRoot(ctx, body.root)
  if (ssh.isSshRoot(root)) throw new SideError('ssh-unsupported', 'SSH 工作区暂不支持快速打开索引')
  const files = []
  await walkWorkspace(root, (filename, relative) => {
    files.push({ path: relative, name: path.posix.basename(relative) })
    return files.length < MAX_QUICK_OPEN_FILES
  })
  return { root, files, truncated: files.length >= MAX_QUICK_OPEN_FILES }
}

/** Search file contents under one local workspace root. */
async function searchWorkspace(ctx, body) {
  const root = await resolveRoot(ctx, body.root)
  if (ssh.isSshRoot(root)) throw new SideError('ssh-unsupported', 'SSH 工作区暂不支持全局搜索')
  const query = typeof body.query === 'string' ? body.query : ''
  if (query.length === 0) throw new SideError('bad-query', '请输入搜索内容')
  if (query.length > 200) throw new SideError('bad-query', '搜索内容过长')
  const maxResults = Math.min(Math.max(Number(body.maxResults) || 200, 1), MAX_SEARCH_RESULTS)
  let pattern
  try {
    pattern = new RegExp(body.regex === true ? query : escapeRegExp(query), body.caseSensitive === true ? 'gu' : 'giu')
  } catch {
    throw new SideError('bad-query', '正则表达式无效')
  }
  const matches = []
  let truncated = false
  let scanned = 0
  await walkWorkspace(root, async (filename, relative) => {
    if (matches.length >= maxResults) {
      truncated = true
      return false
    }
    let stat
    try {
      stat = await fsp.stat(filename)
    } catch {
      return true
    }
    if (stat.size > MAX_SEARCH_FILE_BYTES) return true
    let buffer
    try {
      buffer = await fsp.readFile(filename)
    } catch {
      return true
    }
    if (buffer.includes(0)) return true
    scanned += 1
    const lines = buffer.toString('utf8').split(/\r?\n/u)
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]
      pattern.lastIndex = 0
      let match
      while ((match = pattern.exec(line)) !== null) {
        if (match[0].length === 0) {
          pattern.lastIndex += 1
          continue
        }
        matches.push({
          path: relative,
          line: index + 1,
          column: match.index + 1,
          text: line.length > 300 ? `${line.slice(0, 300)}…` : line,
        })
        if (matches.length >= maxResults) {
          truncated = true
          break
        }
      }
      if (matches.length >= maxResults) break
    }
    return matches.length < maxResults
  })
  return { root, query, matches, truncated, filesScanned: scanned }
}

/** Active profile directory, preferring the launcher-provided environment. */
function profileDirectory() {
  if (typeof process.env.DSH_PROFILE_DIR === 'string' && process.env.DSH_PROFILE_DIR.length > 0) {
    return process.env.DSH_PROFILE_DIR
  }
  const profile = process.env.DSH_PROFILE ?? 'web'
  return path.join(process.env.DSH_HOME ?? path.join(os.homedir(), '.dsh'), 'profiles', profile)
}

/** Profile, bundle, version and config-file summary for the Harness panel. */
async function harnessInfo() {
  const dir = profileDirectory()
  let manifest = {}
  try {
    manifest = JSON.parse(await fsp.readFile(path.join(dir, 'package.json'), 'utf8'))
  } catch {
    /* a profile without a readable manifest still shows its directory */
  }
  const bundles = Array.isArray(manifest?.dsh?.profile?.bundles) ? manifest.dsh.profile.bundles : []
  const dependencies =
    manifest?.dependencies !== null && typeof manifest?.dependencies === 'object'
      ? Object.entries(manifest.dependencies).map(([name, version]) => ({ name, version: String(version) }))
      : []
  const files = []
  for (const name of HARNESS_FILES) {
    try {
      const stat = await fsp.stat(path.join(dir, name))
      files.push({ name, bytes: stat.size })
    } catch {
      /* optional profile file */
    }
  }
  return {
    profile: { name: process.env.DSH_PROFILE ?? path.basename(dir), dir },
    version: await readPackageVersion(),
    bundles,
    dependencies,
    files,
  }
}

/** Read one whitelisted profile file for the Harness panel. */
async function readHarnessConfig(name) {
  if (!HARNESS_FILES.includes(name)) throw new SideError('bad-file', '不允许读取该配置')
  const filename = path.join(profileDirectory(), name)
  let stat
  try {
    stat = await fsp.stat(filename)
  } catch {
    throw new SideError('not-found', `配置文件不存在：${name}`)
  }
  if (!stat.isFile()) throw new SideError('not-file', `不是配置文件：${name}`)
  if (stat.size > 1024 * 1024) throw new SideError('too-large', '配置文件超过 1 MB')
  return { name, content: await fsp.readFile(filename, 'utf8') }
}

/** Run the plugin's own fixed `npm run check` and return its output. */
function runHarnessCheck() {
  return new Promise((resolve) => {
    const started = Date.now()
    const command = process.platform === 'win32' ? 'npm.cmd' : 'npm'
    execFile(
      command,
      ['run', 'check'],
      {
        cwd: fileURLToPath(new URL('../', import.meta.url)),
        timeout: HARNESS_CHECK_TIMEOUT_MS,
        maxBuffer: 2 * 1024 * 1024,
        env: { ...process.env, NO_COLOR: '1', CI: '1' },
      },
      (error, stdout, stderr) => {
        const code = error === null ? 0 : typeof error.code === 'number' ? error.code : 1
        resolve({
          code,
          output: `${stdout ?? ''}${stderr ?? ''}`.trim().slice(-100000),
          durationMs: Date.now() - started,
          timedOut: error !== null && error.killed === true,
        })
      },
    )
  })
}

/**
 * Registered workspaces plus the deployment default directory, deduplicated by
 * canonical path. Missing or non-directory roots are skipped.
 * @param ctx - Host context.
 * @returns `{ roots, defaultRoot }`.
 */
async function listRoots(ctx) {
  const candidates = []
  const registry = ctx.get('workspaceRegistry')
  if (registry !== undefined) {
    try {
      for (const workspace of registry.list()) candidates.push({ path: workspace.path, title: workspace.title })
    } catch {
      /* a broken registry entry must not hide the default root */
    }
  }
  const working = ctx.get('workingDirectory')
  if (working?.defaultDirectory) {
    candidates.push({ path: working.defaultDirectory, title: path.basename(working.defaultDirectory) || working.defaultDirectory })
  }
  const seen = new Set()
  const roots = []
  for (const candidate of candidates) {
    if (typeof candidate.path !== 'string' || candidate.path.length === 0) continue
    try {
      const real = await fsp.realpath(candidate.path)
      const info = await fsp.stat(real)
      if (!info.isDirectory() || seen.has(real)) continue
      seen.add(real)
      roots.push({ path: real, title: candidate.title || path.basename(real) || real })
    } catch {
      /* skip a root that no longer exists */
    }
  }
  return { roots, defaultRoot: roots[0]?.path ?? null }
}

/**
 * List listening TCP ports so the built-in browser can suggest local dev
 * servers. Linux exposes this through /proc/net/tcp{,6}; other hosts simply
 * report that scanning is unsupported.
 * @returns port list with convenience localhost URLs.
 */
async function listListeningPorts() {
  const ports = new Set()
  let supported = false
  for (const file of ['/proc/net/tcp', '/proc/net/tcp6']) {
    let text
    try {
      text = await fsp.readFile(file, 'utf8')
      supported = true
    } catch {
      continue
    }
    for (const line of text.split('\n').slice(1)) {
      const fields = line.trim().split(/\s+/)
      if (fields.length < 4 || fields[3] !== '0A') continue
      const colon = fields[1].lastIndexOf(':')
      if (colon < 1) continue
      const port = Number.parseInt(fields[1].slice(colon + 1), 16)
      if (Number.isInteger(port) && port > 0 && port <= 65535) ports.add(port)
    }
  }
  return {
    supported,
    ports: [...ports].sort((left, right) => left - right).map((port) => ({ port, url: `http://localhost:${String(port)}` })),
  }
}

/**
 * Resolve the requested root against the currently registered workspace roots.
 * The address bar registers a typed directory as a workspace before using it,
 * so every file operation still lands inside a registered root.
 * @param ctx - Host context.
 * @param requested - absolute root path sent by the browser.
 * @returns canonical root path.
 */
async function resolveRoot(ctx, requested) {
  if (ssh.isSshRoot(requested)) {
    ssh.parseSshRoot(requested)
    return requested
  }
  const { roots } = await listRoots(ctx)
  if (roots.length === 0) throw new SideError('no-root', '没有可用的工作区目录')
  const wanted = typeof requested === 'string' && requested.length > 0 ? requested : roots[0].path
  let real
  try {
    real = await fsp.realpath(wanted)
  } catch {
    throw new SideError('root-unknown', `工作区目录不存在：${wanted}`)
  }
  const match = roots.find((root) => root.path === real || root.path === wanted)
  if (match === undefined) throw new SideError('outside-root', '只能访问已注册的工作区目录')
  return match.path
}

/**
 * Resolve a local workspace root for a memory operation. Memory is stored in
 * the workspace itself, so SSH remote roots have no local document.
 * @param ctx - Host context.
 * @param requested - root path sent by the browser.
 * @returns canonical local root.
 */
async function memoryRoot(ctx, requested) {
  const root = await resolveRoot(ctx, requested)
  if (ssh.isSshRoot(root)) throw new SideError('ssh-unsupported', 'SSH 远程工作区暂不支持本地记忆')
  return root
}

/**
 * Read one workspace's memory document for the Memory panel.
 * @param ctx - Host context.
 * @param body - `{ root }`.
 * @returns entries plus document metadata.
 */
async function listMemory(ctx, body) {
  const root = await memoryRoot(ctx, body.root)
  const state = await memory.readMemory(root)
  const entries = [...state.entries].sort(
    (left, right) => right.updatedAt - left.updatedAt || left.id.localeCompare(right.id),
  )
  return {
    entries,
    updatedAt: state.updatedAt,
    total: entries.length,
    path: memory.memoryFile(root),
  }
}

/**
 * Save one memory from the Memory panel.
 * @param ctx - Host context.
 * @param body - `{ root, text, tags? }`.
 * @returns `{ entry, duplicate, total }`.
 */
async function saveMemory(ctx, body) {
  const root = await memoryRoot(ctx, body.root)
  return memory.saveMemory(root, { text: body.text, tags: body.tags, source: 'memory-panel' })
}

/**
 * Update one memory from the Memory panel.
 * @param ctx - Host context.
 * @param body - `{ root, id, text?, tags? }`.
 * @returns `{ entry, total }`.
 */
async function updateMemory(ctx, body) {
  const root = await memoryRoot(ctx, body.root)
  return memory.updateMemory(root, { id: body.id, text: body.text, tags: body.tags })
}

/**
 * Delete one memory from the Memory panel.
 * @param ctx - Host context.
 * @param body - `{ root, id }`.
 * @returns `{ deleted, total }`.
 */
async function deleteMemory(ctx, body) {
  const root = await memoryRoot(ctx, body.root)
  return memory.deleteMemory(root, body.id)
}

/**
 * Resolve a local workspace root for a todo operation. SSH remote roots have no
 * local todo document.
 * @param ctx - Host context.
 * @param requested - root path sent by the browser.
 * @returns canonical local root.
 */
async function todoRoot(ctx, requested) {
  const root = await resolveRoot(ctx, requested)
  if (ssh.isSshRoot(root)) throw new SideError('ssh-unsupported', 'SSH 远程工作区暂不支持本地待办')
  return root
}

/**
 * Read one workspace's todo board for the Todo panel.
 * @param ctx - Host context.
 * @param body - `{ root }`.
 * @returns tasks plus document metadata.
 */
async function listTodo(ctx, body) {
  const root = await todoRoot(ctx, body.root)
  return todo.listTodos(root)
}

/**
 * Add one task from the Todo panel.
 * @param ctx - Host context.
 * @param body - `{ root, title, note?, priority?, due?, tags? }`.
 * @returns the new task plus the refreshed board.
 */
async function addTodo(ctx, body) {
  const root = await todoRoot(ctx, body.root)
  return todo.addTodo(root, {
    title: body.title,
    note: body.note,
    priority: body.priority,
    due: body.due,
    tags: body.tags,
    source: 'todo-panel',
  })
}

/**
 * Update one task from the Todo panel.
 * @param ctx - Host context.
 * @param body - `{ root, id, title?, note?, priority?, due?, tags?, status? }`.
 * @returns the updated task plus the refreshed board.
 */
async function updateTodo(ctx, body) {
  const root = await todoRoot(ctx, body.root)
  const patch = { id: body.id }
  for (const key of ['title', 'note', 'priority', 'due', 'tags', 'status']) {
    if (Object.prototype.hasOwnProperty.call(body, key)) patch[key] = body[key]
  }
  return todo.updateTodo(root, patch)
}

/**
 * Delete one task from the Todo panel.
 * @param ctx - Host context.
 * @param body - `{ root, id }`.
 * @returns `{ deleted, tasks, total, open, done, updatedAt }`.
 */
async function deleteTodo(ctx, body) {
  const root = await todoRoot(ctx, body.root)
  return todo.deleteTodo(root, body.id)
}

/**
 * Remove every completed task from the Todo panel.
 * @param ctx - Host context.
 * @param body - `{ root }`.
 * @returns `{ deleted, tasks, total, open, done, updatedAt }`.
 */
async function clearCompletedTodos(ctx, body) {
  const root = await todoRoot(ctx, body.root)
  return todo.clearCompletedTodos(root)
}

/**
 * Resolve a local workspace root for an acceptance-board operation. The board
 * lives in the workspace's `.dsh` directory, so SSH remote roots have none.
 * @param ctx - Host context.
 * @param requested - root path sent by the browser.
 * @returns canonical local root.
 */
async function acceptanceRoot(ctx, requested) {
  const root = await resolveRoot(ctx, requested)
  if (ssh.isSshRoot(root)) throw new SideError('ssh-unsupported', 'SSH 远程工作区暂不支持本地验收清单')
  return root
}

/**
 * Read one workspace's acceptance checklist for the Acceptance panel.
 * @param ctx - Host context.
 * @param body - `{ root }`.
 * @returns items plus document metadata.
 */
async function listAcceptance(ctx, body) {
  const root = await acceptanceRoot(ctx, body.root)
  return acceptance.listAcceptance(root)
}

/**
 * Add one acceptance item from the Acceptance panel.
 * @param ctx - Host context.
 * @param body - `{ root, title, note?, category?, requirement? }`.
 * @returns the new item.
 */
async function addAcceptance(ctx, body) {
  const root = await acceptanceRoot(ctx, body.root)
  return acceptance.addAcceptance(root, {
    title: body.title,
    note: body.note,
    category: body.category,
    requirement: body.requirement,
    by: 'owner',
  })
}

/**
 * Current delivery round for acceptance history, 1 when no pipeline exists.
 * @param root - absolute workspace root.
 * @returns positive round number.
 */
async function currentPipelineRound(root) {
  try {
    const doc = await pipeline.readPipeline(root)
    return Number.isInteger(doc?.round) && doc.round > 0 ? doc.round : 1
  } catch {
    return 1
  }
}

/**
 * Update one acceptance item from the Acceptance panel.
 * @param ctx - Host context.
 * @param body - `{ root, id, title?, note?, status?, category?, requirement? }`.
 * @returns the updated item.
 */
async function updateAcceptance(ctx, body) {
  const root = await acceptanceRoot(ctx, body.root)
  const patch = { id: body.id, by: 'owner', round: await currentPipelineRound(root) }
  for (const key of ['title', 'note', 'status', 'category', 'requirement']) {
    if (Object.prototype.hasOwnProperty.call(body, key)) patch[key] = body[key]
  }
  return acceptance.updateAcceptance(root, patch)
}

/**
 * Delete one acceptance item from the Acceptance panel.
 * @param ctx - Host context.
 * @param body - `{ root, id }`.
 * @returns `{ removed }`.
 */
async function deleteAcceptance(ctx, body) {
  const root = await acceptanceRoot(ctx, body.root)
  return acceptance.deleteAcceptance(root, body.id)
}

/**
 * Drop every passed acceptance item.
 * @param ctx - Host context.
 * @param body - `{ root }`.
 * @returns `{ removed }`.
 */
async function clearPassedAcceptance(ctx, body) {
  const root = await acceptanceRoot(ctx, body.root)
  return acceptance.clearPassedAcceptance(root)
}

/**
 * Render the workspace acceptance report as Markdown for export.
 * @param ctx - Host context.
 * @param body - `{ root }`.
 * @returns `{ markdown }`.
 */
async function acceptanceReport(ctx, body) {
  const root = await acceptanceRoot(ctx, body.root)
  return { markdown: await acceptance.buildAcceptanceMarkdown(root) }
}

/**
 * Attach one evidence file or URL to an acceptance item.
 * @param ctx - Host context.
 * @param body - `{ root, id, path, label?, kind?, by? }`.
 * @returns the updated item.
 */
async function acceptanceEvidenceAdd(ctx, body) {
  const root = await acceptanceRoot(ctx, body.root)
  return acceptance.addAcceptanceEvidence(root, {
    id: typeof body.id === 'string' ? body.id : '',
    path: body.path,
    label: body.label,
    kind: body.kind,
    by: 'owner',
  })
}

/**
 * Remove one evidence entry from an acceptance item.
 * @param ctx - Host context.
 * @param body - `{ root, id, path? | index? }`.
 * @returns the updated item.
 */
async function acceptanceEvidenceRemove(ctx, body) {
  const root = await acceptanceRoot(ctx, body.root)
  return acceptance.removeAcceptanceEvidence(root, {
    id: typeof body.id === 'string' ? body.id : '',
    path: body.path,
    index: body.index,
    by: 'owner',
  })
}

/**
 * Resolve a local workspace root for a review operation.
 * @param ctx - Host context.
 * @param requested - root path sent by the browser.
 * @returns canonical local root.
 */
async function reviewRoot(ctx, requested) {
  const root = await resolveRoot(ctx, requested)
  if (ssh.isSshRoot(root)) throw new SideError('ssh-unsupported', 'SSH 远程工作区暂不支持变更审阅')
  return root
}

/**
 * Read the persisted review state and current changed files.
 * @param ctx - Host context.
 * @param body - `{ root, stageId?, round? }`.
 * @returns review state with files and counters.
 */
async function reviewState(ctx, body) {
  const root = await reviewRoot(ctx, body.root)
  return review.readReviewState(root, {
    stageId: typeof body.stageId === 'string' ? body.stageId : undefined,
    round: Number.isInteger(body.round) ? body.round : undefined,
  })
}

/**
 * Mark one changed file reviewed (or forget a mark).
 * @param ctx - Host context.
 * @param body - `{ root, path, sig?, stageId?, round? }`.
 * @returns the updated review state.
 */
async function reviewMark(ctx, body) {
  const root = await reviewRoot(ctx, body.root)
  await review.markReviewed(root, {
    path: typeof body.path === 'string' ? body.path : '',
    sig: typeof body.sig === 'string' ? body.sig : undefined,
    stageId: typeof body.stageId === 'string' ? body.stageId : undefined,
    round: Number.isInteger(body.round) ? body.round : undefined,
  })
  return review.readReviewState(root, {
    stageId: typeof body.stageId === 'string' ? body.stageId : undefined,
    round: Number.isInteger(body.round) ? body.round : undefined,
  })
}

/**
 * Clear one reviewed mark, or every mark when no path is given.
 * @param ctx - Host context.
 * @param body - `{ root, path? }`.
 * @returns the updated review state.
 */
async function reviewClear(ctx, body) {
  const root = await reviewRoot(ctx, body.root)
  await review.clearReviewed(root, { path: typeof body.path === 'string' ? body.path : undefined })
  return review.readReviewState(root)
}

/**
 * Resolve a local workspace root for a delivery-pipeline operation.
 * @param ctx - Host context.
 * @param requested - root path sent by the browser.
 * @returns canonical local root.
 */
async function pipelineRoot(ctx, requested) {
  const root = await resolveRoot(ctx, requested)
  if (ssh.isSshRoot(root)) throw new SideError('ssh-unsupported', 'SSH 远程工作区暂不支持交付流水线')
  return root
}

/** Read the delivery pipeline snapshot for the panel. */
async function pipelineList(ctx, body) {
  return pipeline.listPipeline(await pipelineRoot(ctx, body.root))
}

/** Save the requirement header (owner or product-manager agent). */
async function pipelineSetRequirement(ctx, body) {
  const root = await pipelineRoot(ctx, body.root)
  return pipeline.setRequirement(root, {
    title: typeof body.title === 'string' ? body.title : undefined,
    detail: typeof body.detail === 'string' ? body.detail : undefined,
  })
}

/** Mark one stage as started. */
async function pipelineStart(ctx, body) {
  const root = await pipelineRoot(ctx, body.root)
  return pipeline.startStage(root, typeof body.stageId === 'string' ? body.stageId : '')
}

/** Submit one stage for owner review. */
async function pipelineSubmit(ctx, body) {
  const root = await pipelineRoot(ctx, body.root)
  return pipeline.submitStage(root, {
    stageId: typeof body.stageId === 'string' ? body.stageId : '',
    summary: typeof body.summary === 'string' ? body.summary : '',
    artifacts: Array.isArray(body.artifacts) ? body.artifacts : undefined,
  })
}

/** Owner gate: approve or send a stage back. */
async function pipelineReview(ctx, body) {
  const root = await pipelineRoot(ctx, body.root)
  return pipeline.reviewStage(root, {
    stageId: typeof body.stageId === 'string' ? body.stageId : '',
    decision: body.decision === 'approve' ? 'approve' : 'reject',
    note: typeof body.note === 'string' ? body.note : undefined,
  })
}

/** Build the role prompt of one stage so the panel can dispatch it. */
async function pipelinePrompt(ctx, body) {
  const root = await pipelineRoot(ctx, body.root)
  const doc = await pipeline.readPipeline(root)
  return { prompt: pipeline.buildStagePrompt(doc, typeof body.stageId === 'string' ? body.stageId : '') }
}

/** Append to or replace the requirement and record the revision. */
async function pipelineUpdateRequirement(ctx, body) {
  const root = await pipelineRoot(ctx, body.root)
  return pipeline.updateRequirement(root, {
    mode: body.mode === 'replace' ? 'replace' : 'append',
    type: body.type,
    title: body.title,
    detail: body.detail,
  })
}

/** Reset a running/review stage so it can be redone after a requirement update. */
async function pipelineRestartStage(ctx, body) {
  const root = await pipelineRoot(ctx, body.root)
  return pipeline.restartStage(root, { stageId: body.stageId, note: body.note })
}

/** Start a new change round on a completed project (owner action). */
async function pipelineStartChange(ctx, body) {
  const root = await pipelineRoot(ctx, body.root)
  return pipeline.startChangeRound(root, {
    title: body.title,
    detail: body.detail,
    note: body.note,
    scope: body.scope,
  })
}

/** Set the owner's gate mode for the delivery pipeline. */
async function pipelineSetMode(ctx, body) {
  const root = await pipelineRoot(ctx, body.root)
  return pipeline.setGateMode(root, body.mode === 'fast' ? 'fast' : 'normal')
}

/** Record a release performed by the ops agent or the owner. */
async function pipelineRecordRelease(ctx, body) {
  const root = await pipelineRoot(ctx, body.root)
  return pipeline.recordRelease(root, {
    environment: typeof body.environment === 'string' ? body.environment : '',
    url: typeof body.url === 'string' ? body.url : '',
    notes: typeof body.notes === 'string' ? body.notes : '',
  })
}

/**
 * Resolve a local workspace root for a browser-bookmark operation. Bookmarks
 * live in the workspace's `.dsh` directory, so SSH remote roots have none.
 * @param ctx - Host context.
 * @param requested - root path sent by the browser.
 * @returns canonical local root.
 */
async function browserBookmarkRoot(ctx, requested) {
  const root = await resolveRoot(ctx, requested)
  if (ssh.isSshRoot(root)) throw new SideError('ssh-unsupported', 'SSH 远程工作区不支持本地收藏')
  return root
}

/**
 * Read one workspace's built-in browser bookmarks and start-page settings.
 * @param ctx - Host context.
 * @param body - `{ root }`.
 * @returns `{ settings, bookmarks, total, updatedAt, path }`.
 */
async function listBrowserBookmarks(ctx, body) {
  const root = await browserBookmarkRoot(ctx, body.root)
  return bookmarks.listBookmarks(root)
}

/**
 * Add or refresh one bookmarked address, remembering its PC/Mobile viewport.
 * @param ctx - Host context.
 * @param body - `{ root, url, title?, device?, preset?, orientation? }`.
 * @returns the refreshed snapshot plus `created`.
 */
async function addBrowserBookmark(ctx, body) {
  const root = await browserBookmarkRoot(ctx, body.root)
  return bookmarks.addBookmark(root, {
    url: body.url,
    title: body.title,
    device: body.device,
    preset: body.preset,
    orientation: body.orientation,
  })
}

/**
 * Remove one bookmarked address.
 * @param ctx - Host context.
 * @param body - `{ root, id }`.
 * @returns the refreshed snapshot plus `removed`.
 */
async function removeBrowserBookmark(ctx, body) {
  const root = await browserBookmarkRoot(ctx, body.root)
  return bookmarks.removeBookmark(root, body.id)
}

/**
 * Rename one bookmarked address.
 * @param ctx - Host context.
 * @param body - `{ root, id, title }`.
 * @returns the refreshed snapshot plus `renamed`.
 */
async function renameBrowserBookmark(ctx, body) {
  const root = await browserBookmarkRoot(ctx, body.root)
  return bookmarks.renameBookmark(root, body.id, body.title)
}

/**
 * Save the built-in browser start page's protocol/host preferences for one
 * workspace.
 * @param ctx - Host context.
 * @param body - `{ root, scheme?, host? }`.
 * @returns the refreshed browser-state snapshot.
 */
async function saveBrowserSettings(ctx, body) {
  const root = await browserBookmarkRoot(ctx, body.root)
  return bookmarks.saveSettings(root, { scheme: body.scheme, host: body.host })
}

/**
 * Resolve one workspace-relative path and keep it inside the root.
 * @param root - canonical root path.
 * @param rel - `/`-separated relative path; empty means the root itself.
 * @returns absolute path.
 */
function childPath(root, rel) {
  if (typeof rel !== 'string') throw new SideError('bad-path', '路径无效')
  if (rel.length === 0) return root
  if (rel.includes('\u0000')) throw new SideError('bad-path', '路径包含空字符')
  if (path.isAbsolute(rel) || /^[A-Za-z]:[\\/]/u.test(rel)) throw new SideError('bad-path', '路径必须是工作区内的相对路径')
  const segments = rel.split('/')
  for (const segment of segments) {
    if (segment.length === 0 || segment === '.' || segment === '..' || segment.includes('\\') || segment.includes('\u0000')) {
      throw new SideError('bad-path', `路径片段无效：${segment}`)
    }
  }
  const absolute = path.resolve(root, ...segments)
  if (!isInside(root, absolute)) throw new SideError('outside-root', '路径超出工作区范围')
  return absolute
}

/** Whether `candidate` is `root` or one of its descendants. */
function isInside(root, candidate) {
  return candidate === root || candidate.startsWith(root.endsWith(path.sep) ? root : root + path.sep)
}

function samePath(a, b) {
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b
}

/**
 * Canonicalize an existing target and confirm it stays inside the root.
 * @returns `{ exists: boolean, path: string, info?: Stats }`.
 */
async function inspectTarget(root, absolute) {
  let real
  try {
    real = await fsp.realpath(absolute)
  } catch (error) {
    if (error?.code === 'ENOENT') {
      const parent = path.dirname(absolute)
      let realParent
      try {
        realParent = await fsp.realpath(parent)
      } catch {
        throw new SideError('not-found', '上级目录不存在')
      }
      if (!isInside(root, realParent)) throw new SideError('outside-root', '路径超出工作区范围')
      return { exists: false, path: path.join(realParent, path.basename(absolute)) }
    }
    throw error
  }
  if (!isInside(root, real)) throw new SideError('outside-root', '路径超出工作区范围')
  const info = await fsp.stat(real)
  return { exists: true, path: real, info }
}

/** Stable freshness token for one stat result. */
function versionOf(info) {
  return `${Math.trunc(info.mtimeMs)}:${info.size}`
}

/** Read an optional version expectation from a request body. */
function expectedVersion(body) {
  return typeof body.expectedVersion === 'string' && body.expectedVersion.length > 0 ? body.expectedVersion : null
}

/** List one directory. */
async function listDirectory(ctx, body) {
  const root = await resolveRoot(ctx, body.root)
  if (ssh.isSshRoot(root)) return ssh.list(root, body)
  const absolute = childPath(root, typeof body.path === 'string' ? body.path : '')
  const target = await inspectTarget(root, absolute)
  if (!target.exists) throw new SideError('not-found', '目录不存在')
  if (!target.info.isDirectory()) throw new SideError('not-directory', '这不是目录')
  const dirents = await fsp.readdir(target.path, { withFileTypes: true })
  const entries = dirents.map((dirent) => ({
    name: dirent.name,
    type: dirent.isDirectory() ? 'directory' : dirent.isFile() ? 'file' : 'other',
  }))
  entries.sort((left, right) => {
    if (left.type !== right.type) {
      if (left.type === 'directory') return -1
      if (right.type === 'directory') return 1
    }
    return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' })
  })
  return { root, path: body.path ?? '', entries }
}

/** One file's metadata. */
async function statPath(ctx, body) {
  const root = await resolveRoot(ctx, body.root)
  if (ssh.isSshRoot(root)) return ssh.stat(root, body)
  const absolute = childPath(root, body.path)
  const target = await inspectTarget(root, absolute)
  if (!target.exists) throw new SideError('not-found', '文件不存在')
  const kind = target.info.isDirectory() ? 'directory' : target.info.isFile() ? 'file' : 'other'
  return { root, path: body.path, type: kind, bytes: target.info.size, version: versionOf(target.info) }
}

/** Walk a directory tree with hard caps so the properties dialog stays responsive. */
async function measureDirectory(absolute) {
  const startedAt = Date.now()
  const MAX_ENTRIES = 20_000
  const MAX_MS = 1_500
  let files = 0
  let directories = 0
  let bytes = 0
  let skipped = 0
  let truncated = false
  const stack = [absolute]
  while (stack.length > 0) {
    if (files + directories >= MAX_ENTRIES || Date.now() - startedAt > MAX_MS) {
      truncated = true
      break
    }
    const directory = stack.pop()
    let entries
    try {
      entries = await fsp.readdir(directory, { withFileTypes: true })
    } catch {
      skipped += 1
      continue
    }
    for (const entry of entries) {
      const child = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        directories += 1
        stack.push(child)
        continue
      }
      files += 1
      if (entry.isFile()) {
        try {
          bytes += (await fsp.stat(child)).size
        } catch {
          skipped += 1
        }
      }
    }
  }
  return { bytes, files, directories, total: files + directories, skipped, truncated }
}

/** Read display-oriented properties of one file or directory. */
async function inspectProperties(ctx, body) {
  const root = await resolveRoot(ctx, body.root)
  if (ssh.isSshRoot(root)) return ssh.stat(root, body)
  const absolute = childPath(root, body.path)
  let info
  try {
    info = await fsp.lstat(absolute)
  } catch (error) {
    if (error !== null && typeof error === 'object' && error.code === 'ENOENT') {
      throw new SideError('not-found', '文件不存在')
    }
    throw error
  }
  const isDirectory = info.isDirectory()
  const isSymbolicLink = info.isSymbolicLink()
  const type = isDirectory ? 'directory' : isSymbolicLink ? 'symlink' : info.isFile() ? 'file' : 'other'
  const name = path.basename(absolute) || path.basename(path.resolve(root))
  let bytes = info.size
  let entries = null
  let truncated = false
  let skipped = 0
  let symlink = null
  let directChildren = null
  if (isDirectory) {
    const measured = await measureDirectory(absolute)
    bytes = measured.bytes
    truncated = measured.truncated
    skipped = measured.skipped
    try {
      directChildren = (await fsp.readdir(absolute)).length
    } catch {
      directChildren = null
    }
    entries = { files: measured.files, directories: measured.directories, total: measured.total, direct: directChildren }
  } else if (isSymbolicLink) {
    try {
      symlink = await fsp.readlink(absolute)
    } catch {
      symlink = null
    }
  }
  return {
    root,
    path: body.path,
    name,
    type,
    bytes,
    entries,
    truncated,
    skipped,
    symlink,
    directChildren,
    mtimeMs: info.mtimeMs,
    ctimeMs: info.ctimeMs,
    atimeMs: info.atimeMs,
    birthtimeMs: info.birthtimeMs,
    mode: (info.mode & 0o777).toString(8).padStart(3, '0'),
    readonly: (info.mode & 0o200) === 0,
  }
}

/** Read one UTF-8 text file. *//** Read one UTF-8 text file. */
async function readText(ctx, body) {
  const root = await resolveRoot(ctx, body.root)
  if (ssh.isSshRoot(root)) return ssh.readText(root, body)
  const absolute = childPath(root, body.path)
  const target = await inspectTarget(root, absolute)
  if (!target.exists) throw new SideError('not-found', '文件不存在')
  if (target.info.isDirectory()) throw new SideError('is-directory', '这是一个目录')
  if (!target.info.isFile()) throw new SideError('not-file', '这不是普通文件')
  if (target.info.size > MAX_TEXT_BYTES) {
    throw new SideError('too-large', `文件超过 ${Math.round(MAX_TEXT_BYTES / 1024 / 1024)} MB，无法在编辑器中打开`)
  }
  const content = await fsp.readFile(target.path, 'utf8')
  if (content.includes('\u0000')) throw new SideError('binary', '这是二进制文件，无法作为文本编辑')
  return { content, version: versionOf(target.info), bytes: target.info.size }
}

/** Create or replace one UTF-8 text file, optionally guarded by a version. */
async function writeText(ctx, body) {
  const root = await resolveRoot(ctx, body.root)
  if (ssh.isSshRoot(root)) return ssh.writeText(root, body)
  const absolute = childPath(root, body.path)
  if (typeof body.content !== 'string') throw new SideError('bad-content', '文件内容必须是字符串')
  const encoded = Buffer.byteLength(body.content, 'utf8')
  if (encoded > MAX_TEXT_BYTES) throw new SideError('too-large', '内容超过编辑器的大小上限')
  const target = await inspectTarget(root, absolute)
  const expected = expectedVersion(body)
  if (target.exists) {
    if (target.info.isDirectory()) throw new SideError('is-directory', '这是一个目录')
    if (expected !== null && versionOf(target.info) !== expected) {
      throw new SideError('stale', '磁盘上的文件已被修改', { currentVersion: versionOf(target.info) })
    }
    await fsp.writeFile(target.path, body.content, 'utf8')
  } else {
    await fsp.writeFile(target.path, body.content, { encoding: 'utf8', flag: 'wx' })
  }
  const info = await fsp.stat(target.path)
  return { version: versionOf(info), bytes: encoded, path: body.path }
}

/** Create one empty file; fails when the name is taken. */
async function createFile(ctx, body) {
  const root = await resolveRoot(ctx, body.root)
  if (ssh.isSshRoot(root)) return ssh.create(root, { ...body, type: 'file' })
  const absolute = childPath(root, body.path)
  const target = await inspectTarget(root, absolute)
  if (target.exists) throw new SideError('exists', '同名文件或目录已存在')
  const handle = await fsp.open(target.path, 'wx')
  await handle.close()
  return { path: body.path }
}

/** Create one directory; fails when the name is taken. */
async function createDir(ctx, body) {
  const root = await resolveRoot(ctx, body.root)
  if (ssh.isSshRoot(root)) return ssh.create(root, { ...body, type: 'directory' })
  const absolute = childPath(root, body.path)
  const target = await inspectTarget(root, absolute)
  if (target.exists) throw new SideError('exists', '同名文件或目录已存在')
  await fsp.mkdir(target.path)
  return { path: body.path }
}

/** Rename or move one entry inside the root. */
async function renamePath(ctx, body) {
  const root = await resolveRoot(ctx, body.root)
  if (ssh.isSshRoot(root)) return ssh.rename(root, body)
  const fromAbsolute = childPath(root, body.from)
  if (fromAbsolute === root) throw new SideError('protected', '不能重命名工作区根目录')
  let fromInfo
  try {
    fromInfo = await fsp.lstat(fromAbsolute)
  } catch {
    throw new SideError('not-found', '源文件或目录不存在')
  }
  await ensureParentInside(root, fromAbsolute)
  const toAbsolute = await destinationPath(root, childPath(root, body.to))
  let toExists = true
  try {
    await fsp.lstat(toAbsolute)
  } catch {
    toExists = false
  }
  if (toExists) throw new SideError('exists', '目标名称已被占用')
  await fsp.rename(fromAbsolute, toAbsolute)
  return { from: body.from, to: body.to, type: fromInfo.isDirectory() ? 'directory' : 'file' }
}

/** Move one entry to another directory inside the root. */
async function movePath(ctx, body) {
  const root = await resolveRoot(ctx, body.root)
  if (ssh.isSshRoot(root)) return ssh.rename(root, body)
  const fromAbsolute = childPath(root, body.from)
  if (fromAbsolute === root) throw new SideError('protected', '不能移动工作区根目录')
  let info
  try {
    info = await fsp.lstat(fromAbsolute)
  } catch {
    throw new SideError('not-found', '源文件或目录不存在')
  }
  await ensureParentInside(root, fromAbsolute)
  const toAbsolute = await resolveDestination(root, body.to)
  assertTransferable(fromAbsolute, toAbsolute, info.isDirectory())
  if (await pathExists(toAbsolute)) throw new SideError('exists', '目标位置已有同名文件或目录')
  try {
    await fsp.rename(fromAbsolute, toAbsolute)
  } catch (error) {
    if (error === null || typeof error !== 'object' || error.code !== 'EXDEV') throw error
    await copyEntry(fromAbsolute, toAbsolute)
    await fsp.rm(fromAbsolute, { recursive: true, force: false })
  }
  return {
    from: body.from,
    to: relativeOf(root, toAbsolute),
    type: info.isDirectory() ? 'directory' : 'file',
  }
}

/** Copy one entry; `rename: true` picks a free "name (n)" destination. */
async function copyPath(ctx, body) {
  const root = await resolveRoot(ctx, body.root)
  if (ssh.isSshRoot(root)) return ssh.copy(root, body)
  const fromAbsolute = childPath(root, body.from)
  if (fromAbsolute === root) throw new SideError('protected', '不能复制工作区根目录')
  let info
  try {
    info = await fsp.lstat(fromAbsolute)
  } catch {
    throw new SideError('not-found', '源文件或目录不存在')
  }
  await ensureParentInside(root, fromAbsolute)
  let toAbsolute = await resolveDestination(root, body.to)
  const same = samePath(fromAbsolute, toAbsolute)
  if (same && body.rename !== true) throw new SideError('same-path', '源和目标位置相同')
  if (!same) assertTransferable(fromAbsolute, toAbsolute, info.isDirectory())
  let renamed = false
  if (same) {
    toAbsolute = await uniqueCopyPath(toAbsolute)
    renamed = true
  } else if (await pathExists(toAbsolute)) {
    if (body.rename !== true) throw new SideError('exists', '目标位置已有同名文件或目录')
    toAbsolute = await uniqueCopyPath(toAbsolute)
    renamed = true
  }
  await copyEntry(fromAbsolute, toAbsolute)
  return {
    from: body.from,
    to: relativeOf(root, toAbsolute),
    type: info.isDirectory() ? 'directory' : 'file',
    renamed,
  }
}

/** Canonical destination inside the root; missing parents are reported as such. */
async function resolveDestination(root, relative) {
  try {
    return await destinationPath(root, childPath(root, relative))
  } catch (error) {
    if (error instanceof SideError) throw error
    throw new SideError('parent-missing', '目标目录不存在')
  }
}

/** Reject same-path transfers and moving/copying a directory into itself. */
function assertTransferable(fromAbsolute, toAbsolute, directory) {
  if (samePath(fromAbsolute, toAbsolute)) throw new SideError('same-path', '源和目标位置相同')
  if (!directory) return
  const relative = path.relative(fromAbsolute, toAbsolute)
  if (relative.length > 0 && !relative.startsWith('..') && !path.isAbsolute(relative)) {
    throw new SideError('into-itself', '不能把目录放入它自身内部')
  }
}

async function pathExists(absolute) {
  try {
    await fsp.lstat(absolute)
    return true
  } catch {
    return false
  }
}

/** Copy a file, symlink or directory tree without following symlinks. */
async function copyEntry(fromAbsolute, toAbsolute) {
  await fsp.cp(fromAbsolute, toAbsolute, {
    recursive: true,
    errorOnExist: true,
    force: false,
    dereference: false,
    preserveTimestamps: true,
  })
}

/** Next free "name (n).ext" beside an existing destination. */
async function uniqueCopyPath(target) {
  const directory = path.dirname(target)
  const extension = path.extname(target)
  const base = path.basename(target, extension)
  for (let index = 1; index < 1000; index += 1) {
    const candidate = path.join(directory, `${base} (${String(index)})${extension}`)
    if (!(await pathExists(candidate))) return candidate
  }
  throw new SideError('exists', '同名副本过多，无法生成新名称')
}

/** Root-relative path with forward slashes. */
function relativeOf(root, absolute) {
  return path.relative(root, absolute).split(path.sep).join('/')
}

/** Remove one file or directory recursively. */
async function deletePath(ctx, body) {
  const root = await resolveRoot(ctx, body.root)
  if (ssh.isSshRoot(root)) return ssh.remove(root, body)
  const absolute = childPath(root, body.path)
  if (absolute === root) throw new SideError('protected', '不能删除工作区根目录')
  let info
  try {
    info = await fsp.lstat(absolute)
  } catch {
    throw new SideError('not-found', '文件或目录不存在')
  }
  await ensureParentInside(root, absolute)
  if (info.isSymbolicLink()) await fsp.unlink(absolute)
  else await fsp.rm(absolute, { recursive: true, force: false })
  return { path: body.path }
}

/** Confirm the direct parent of a path is inside the root without following it. */
async function ensureParentInside(root, absolute) {
  const realParent = await fsp.realpath(path.dirname(absolute))
  if (!isInside(root, realParent)) throw new SideError('outside-root', '路径超出工作区范围')
  return realParent
}

/** Canonical destination path whose parent lives inside the root. */
async function destinationPath(root, absolute) {
  const realParent = await ensureParentInside(root, absolute)
  return path.join(realParent, path.basename(absolute))
}

/** Delivery history file inside the workspace .dsh directory. */
const DELIVERY_HISTORY_FILE = 'deliveries.json'
const DELIVERY_HISTORY_MAX = 100

/**
 * Read the delivery history of one workspace.
 * @param root - absolute local workspace root.
 * @returns array of delivery records, newest first.
 */
async function readDeliveryHistory(root) {
  try {
    const parsed = JSON.parse(await fsp.readFile(path.join(root, '.dsh', DELIVERY_HISTORY_FILE), 'utf8'))
    return Array.isArray(parsed?.deliveries) ? parsed.deliveries : []
  } catch {
    return []
  }
}

/**
 * Read the delivery history for the Delivery panel.
 * @param ctx - Host context.
 * @param body - `{ root }`.
 * @returns `{ deliveries }`.
 */
async function listDeliveryHistory(ctx, body) {
  const root = await resolveRoot(ctx, body.root)
  if (ssh.isSshRoot(root)) throw new SideError('ssh-unsupported', 'SSH 远程工作区暂不支持交付记录')
  return { deliveries: await readDeliveryHistory(root) }
}

/**
 * Append one delivery record, keeping the newest entries and writing atomically.
 * Failure to record history never fails the delivery itself.
 * @param root - absolute local workspace root.
 * @param record - delivery record to prepend.
 */
async function appendDeliveryHistory(root, record) {
  try {
    const directory = path.join(root, '.dsh')
    await fsp.mkdir(directory, { recursive: true })
    const deliveries = [record, ...(await readDeliveryHistory(root))].slice(0, DELIVERY_HISTORY_MAX)
    const file = path.join(directory, DELIVERY_HISTORY_FILE)
    const temp = `${file}.${String(process.pid)}-${String(Date.now())}.tmp`
    await fsp.writeFile(temp, JSON.stringify({ version: 1, updatedAt: Date.now(), deliveries }, null, 2))
    await fsp.rename(temp, file)
  } catch (error) {
    console.error('dsh-web-filebrowser: failed to record delivery history', error)
  }
}

/**
 * Package the workspace build output for client delivery.
 *
 * GET streams `dist` / `build` / `out` / `.output` / `public` (or the `targets`
 * query) as a ZIP attachment. POST op `bundle` writes the same archive plus an
 * acceptance report into `<root>/.dsh/deliveries` and returns its path, so the
 * normal raw download can fetch it afterwards.
 *
 * @param ctx - Host context.
 * @param request - incoming delivery request.
 * @returns a ZIP stream, a JSON answer, or an error response.
 */
async function handleDelivery(ctx, request) {
  try {
    if (request.method === 'POST') {
      let body
      try {
        body = await request.json()
      } catch {
        return json({ ok: false, error: failure('bad-request', '请求体不是有效的 JSON') }, 400)
      }
      if (body === null || typeof body !== 'object' || typeof body.op !== 'string') {
        return json({ ok: false, error: failure('bad-request', '缺少操作名 op') }, 400)
      }
      if (body.op !== 'bundle') throw new SideError('bad-op', `未知的交付操作：${body.op}`)
      const root = await resolveRoot(ctx, body.root)
      if (ssh.isSshRoot(root)) throw new SideError('ssh-unsupported', 'SSH 远程工作区暂不支持交付打包')
      // Referenced evidence travels with the bundle under `evidence/` so the
      // client receives a self-contained acceptance record.
      let extraFiles
      try {
        const acceptanceDoc = await acceptance.readAcceptance(root)
        const items = Array.isArray(acceptanceDoc?.items) ? acceptanceDoc.items : []
        const collected = await delivery.collectEvidenceEntries(root, items)
        extraFiles = collected.entries.map((entry) => ({
          path: `evidence/${path.posix.basename(entry.path)}`,
          data: entry.data,
          size: entry.size,
          mtime: entry.mtime,
        }))
      } catch (error) {
        console.error('dsh-web-filebrowser: failed to collect acceptance evidence', error)
      }
      const result = await delivery.writeDeliveryBundle(root, {
        reportMarkdown: typeof body.reportMarkdown === 'string' ? body.reportMarkdown : undefined,
        targets: Array.isArray(body.targets) ? body.targets : undefined,
        include: typeof body.include === 'string' ? body.include : undefined,
        exclude: typeof body.exclude === 'string' ? body.exclude : undefined,
        extraFiles,
      })
      await appendDeliveryHistory(root, {
        id: `${String(Date.now())}-${String(result.fileCount)}`,
        name: path.basename(result.path),
        relative: path.relative(root, result.path).split(path.sep).join('/'),
        bytes: result.bytes,
        fileCount: result.fileCount,
        createdAt: Date.now(),
        hasReport: typeof body.reportMarkdown === 'string' && body.reportMarkdown.length > 0,
      })
      return json({
        ok: true,
        value: {
          ...result,
          name: path.basename(result.path),
          relative: path.relative(root, result.path).split(path.sep).join('/'),
        },
      })
    }
    const url = new URL(request.url)
    const root = await resolveRoot(ctx, url.searchParams.get('root') ?? '')
    if (ssh.isSshRoot(root)) {
      return json({ ok: false, error: failure('ssh-unsupported', 'SSH 远程工作区暂不支持交付打包') }, 400)
    }
    const targets = (url.searchParams.get('targets') ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
    const built = await delivery.buildDeliveryZip(root, {
      targets: targets.length > 0 ? targets : undefined,
      include: url.searchParams.get('include') ?? undefined,
      exclude: url.searchParams.get('exclude') ?? undefined,
    })
    return new Response(Readable.toWeb(built.readStream), {
      status: 200,
      headers: {
        'content-type': 'application/zip',
        'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(built.filename)}`,
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      },
    })
  } catch (error) {
    if (error instanceof SideError) {
      return json({ ok: false, error: { code: error.code, message: error.message } }, 200)
    }
    if (error !== null && typeof error === 'object' && typeof error.sideCode === 'string') {
      return json({ ok: false, error: { code: error.sideCode, message: error.message } }, 200)
    }
    console.error('dsh-web-filebrowser: delivery request failed', error)
    return json({ ok: false, error: failure('internal', error instanceof Error ? error.message : String(error)) }, 200)
  }
}

/** Serve one file's bytes for PDF/image preview and browser handoff. */
async function handleGet(ctx, request) {
  try {
    const url = new URL(request.url)
    if (url.searchParams.get('op') !== 'raw') {
      return json({ ok: false, error: failure('bad-op', 'GET 仅支持 op=raw') }, 400)
    }
    const root = await resolveRoot(ctx, url.searchParams.get('root') ?? '')
    const relative = url.searchParams.get('path') ?? ''
    if (ssh.isSshRoot(root)) {
      const download = url.searchParams.get('download') === '1'
      const opened = await ssh.openRead(root, relative)
      const type = CONTENT_TYPES.get(path.posix.extname(opened.name).toLowerCase()) ?? 'application/octet-stream'
      return new Response(Readable.toWeb(opened.stream), {
        status: 200,
        headers: {
          'content-type': type,
          'content-length': String(opened.size),
          'content-disposition': `${download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(opened.name)}`,
          'cache-control': 'no-store',
          'x-content-type-options': 'nosniff',
          'referrer-policy': 'no-referrer',
        },
      })
    }
    const absolute = childPath(root, relative)
    const target = await inspectTarget(root, absolute)
    if (!target.exists) return json({ ok: false, error: failure('not-found', '文件不存在') }, 404)
    if (!target.info.isFile()) return json({ ok: false, error: failure('not-file', '这不是普通文件') }, 400)
    const download = url.searchParams.get('download') === '1'
    // Downloads always stream; only inline previews are capped so a huge binary
    // never gets loaded into the browser as a preview.
    if (!download && target.info.size > MAX_RAW_BYTES) {
      return json({ ok: false, error: failure('too-large', '文件过大，无法预览') }, 413)
    }
    const name = path.basename(target.path)
    const type = CONTENT_TYPES.get(path.extname(target.path).toLowerCase()) ?? 'application/octet-stream'
    const stream = Readable.toWeb(createReadStream(target.path))
    return new Response(stream, {
      status: 200,
      headers: {
        'content-type': type,
        'content-length': String(target.info.size),
        'content-disposition': `${download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(name)}`,
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
      },
    })
  } catch (error) {
    if (error instanceof SideError) return json({ ok: false, error: { code: error.code, message: error.message } }, 400)
    if (error !== null && typeof error === 'object' && typeof error.sideCode === 'string') {
      return json({ ok: false, error: { code: error.sideCode, message: error.message } }, 400)
    }
    console.error('dsh-web-filebrowser: raw read failed', error)
    return json({ ok: false, error: failure('internal', error instanceof Error ? error.message : String(error)) }, 500)
  }
}

/** Binary upload into one SSH workspace path. */
async function handleSshUpload(request) {
  try {
    if (request.method !== 'POST') return json({ ok: false, error: failure('bad-method', '仅支持 POST') }, 405)
    const url = new URL(request.url)
    const root = url.searchParams.get('root') ?? ''
    const relative = url.searchParams.get('path') ?? ''
    if (!ssh.isSshRoot(root)) throw new SideError('bad-root', '只支持 SSH 工作区')
    if (relative.length === 0) throw new SideError('bad-path', '缺少上传路径')
    ssh.parseSshRoot(root)
    const declared = Number(request.headers.get('content-length') ?? '0')
    if (Number.isFinite(declared) && declared > MAX_SSH_UPLOAD_BYTES) {
      throw new SideError('too-large', `文件超过 ${String(Math.round(MAX_SSH_UPLOAD_BYTES / 1024 / 1024))} MB 上限`)
    }
    const bytes = Buffer.from(await request.arrayBuffer())
    if (bytes.length === 0) throw new SideError('empty', '文件内容为空')
    if (bytes.length > MAX_SSH_UPLOAD_BYTES) {
      throw new SideError('too-large', `文件超过 ${String(Math.round(MAX_SSH_UPLOAD_BYTES / 1024 / 1024))} MB 上限`)
    }
    const value = await ssh.upload(root, relative, bytes)
    return json({ ok: true, value })
  } catch (error) {
    if (error instanceof SideError) return json({ ok: false, error: { code: error.code, message: error.message } }, 200)
    if (error !== null && typeof error === 'object' && typeof error.sideCode === 'string') {
      return json({ ok: false, error: { code: error.sideCode, message: error.message } }, 200)
    }
    console.error('dsh-web-filebrowser: SSH upload failed', error)
    return json({ ok: false, error: failure('internal', error instanceof Error ? error.message : String(error)) }, 200)
  }
}

/**
 * Proxy one public HTML page for the built-in browser.
 *
 * The target is fetched by the Host (not the browser), so a site that sends
 * X-Frame-Options/CSP cannot block the frame. Only public addresses are allowed
 * and the result is served into a sandboxed, opaque-origin iframe.
 * @param request - incoming GET request with the target in ?url=.
 * @returns injected HTML or a binary response.
 */
async function handleProxy(request) {
  let target
  try {
    target = new URL(new URL(request.url).searchParams.get('url') ?? '')
  } catch {
    return proxyError(400, '预览地址无效')
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return proxyError(400, '只支持 http/https 地址')
  }
  if (target.username.length > 0 || target.password.length > 0) {
    return proxyError(400, '预览地址不能包含用户名或密码')
  }
  try {
    const { response, finalUrl } = await fetchProxied(target)
    const declared = Number(response.headers.get('content-length') ?? '0')
    if (Number.isFinite(declared) && declared > MAX_PROXY_BYTES) {
      return proxyError(413, '目标页面超过 8 MB，无法预览')
    }
    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length > MAX_PROXY_BYTES) return proxyError(413, '目标页面超过 8 MB，无法预览')
    const type = (response.headers.get('content-type') ?? '').toLowerCase()
    if (!type.includes('text/html') && !type.includes('application/xhtml+xml')) {
      return new Response(buffer, {
        status: response.status,
        headers: {
          'content-type': type.length > 0 ? type : 'application/octet-stream',
          'cache-control': 'no-store',
          'x-content-type-options': 'nosniff',
        },
      })
    }
    const charset = /charset\s*=\s*["']?([^;"'\s]+)/iu.exec(type)?.[1] ?? 'utf-8'
    let html
    try {
      html = new TextDecoder(charset).decode(buffer)
    } catch {
      html = buffer.toString('utf8')
    }
    const body = injectProxyHtml(html, finalUrl.href)
    return new Response(body, {
      status: response.status === 204 ? 200 : response.status,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
      },
    })
  } catch (error) {
    return proxyError(502, `无法加载 ${target.host}：${error instanceof Error ? error.message : String(error)}`)
  }
}

/** Follow up to five redirects, validating every hop against the public-IP guard. */
async function fetchProxied(initial) {
  let current = initial
  for (let hop = 0; hop < 5; hop += 1) {
    await assertPublicTarget(current)
    const response = await fetch(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
    })
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location')
      try {
        await response.body?.cancel()
      } catch {
        /* redirect body already closed */
      }
      if (location === null || location.length === 0) return { response, finalUrl: current }
      current = new URL(location, current)
      continue
    }
    return { response, finalUrl: current }
  }
  throw new Error('重定向次数过多')
}

/** Reject loopback, private, link-local and reserved addresses (basic SSRF guard). */
async function assertPublicTarget(target) {
  if (target.protocol !== 'http:' && target.protocol !== 'https:') throw new Error('只支持 http/https 地址')
  if (target.username.length > 0 || target.password.length > 0) throw new Error('地址不能包含凭据')
  const host = target.hostname.replace(/^\[/u, '').replace(/\]$/u, '').toLowerCase()
  if (host.length === 0 || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('不允许访问本机或内网地址')
  }
  const addresses = isIP(host) !== 0 ? [host] : (await dnsLookup(host, { all: true, verbatim: true })).map((record) => record.address)
  if (addresses.length === 0) throw new Error('域名没有解析结果')
  if (addresses.some((address) => !isPublicAddress(address))) throw new Error('不允许访问内网地址')
}

function isPublicAddress(address) {
  const version = isIP(address)
  if (version === 4) {
    const parts = address.split('.').map(Number)
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false
    const [a, b, c] = parts
    if (a === 0 || a === 10 || a === 127) return false
    if (a === 100 && b >= 64 && b <= 127) return false
    if (a === 169 && b === 254) return false
    if (a === 172 && b >= 16 && b <= 31) return false
    if (a === 192 && b === 168) return false
    if (a === 192 && b === 0 && c === 0) return false
    if (a === 192 && b === 0 && c === 2) return false
    if (a === 198 && (b === 18 || b === 19)) return false
    if (a === 198 && b === 51 && c === 100) return false
    if (a === 203 && b === 0 && c === 113) return false
    if (a >= 224) return false
    return true
  }
  if (version === 6) {
    const value = address.toLowerCase()
    if (value === '::' || value === '::1') return false
    if (value.startsWith('fc') || value.startsWith('fd')) return false
    if (/^fe[89ab]/u.test(value)) return false
    if (value.startsWith('ff')) return false
    if (value.startsWith('2001:db8')) return false
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/u.exec(value)
    if (mapped !== null) return isPublicAddress(mapped[1])
    const mappedHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/u.exec(value)
    if (mappedHex !== null) {
      const high = Number.parseInt(mappedHex[1], 16)
      const low = Number.parseInt(mappedHex[2], 16)
      const ipv4 = [high >> 8, high & 255, low >> 8, low & 255].join('.')
      return isPublicAddress(ipv4)
    }
    return true
  }
  return false
}

/** Inject a <base>, strip document-level frame restrictions and install the link bridge. */
function injectProxyHtml(html, target) {
  const cleaned = html
    .replace(/<meta\b[^>]*http-equiv\s*=\s*["']?content-security-policy["']?[^>]*>/giu, '')
    .replace(/<meta\b[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*>/giu, '')
  const base = `<base href="${escapeHtml(target)}">`
  const bridge = `<script>${proxyBridgeScript(target)}</script>`
  const head = /<head[^>]*>/iu.exec(cleaned)
  if (head !== null) {
    const index = head.index + head[0].length
    return cleaned.slice(0, index) + base + bridge + cleaned.slice(index)
  }
  return base + bridge + cleaned
}

/** Small page script that forwards link/form navigation back to the parent tab. */
function proxyBridgeScript(target) {
  const encoded = JSON.stringify(target).replace(/</gu, '\\u003c')
  return `(function(){var T=${encoded};function send(type,url){try{parent.postMessage({type:type,url:url},'*')}catch(e){}}document.addEventListener('click',function(event){if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;var node=event.target;var anchor=node&&node.closest?node.closest('a[href]'):null;if(!anchor||anchor.hasAttribute('download'))return;var kind=anchor.getAttribute('target');if(kind&&kind!=='_self'&&kind!=='_top')return;var raw=anchor.getAttribute('href');if(raw&&raw.charAt(0)==='#')return;var href=anchor.href;if(!/^https?:/i.test(href))return;if(href.indexOf(location.origin)===0)return;if(href.indexOf('#')>=0&&href.split('#')[0]===T.split('#')[0])return;event.preventDefault();send('dsh-browser-navigate',href);},true);document.addEventListener('submit',function(event){var form=event.target;if(!form||form.tagName!=='FORM')return;var method=(form.getAttribute('method')||'get').toLowerCase();var action;try{action=new URL(form.getAttribute('action')||T,T).href}catch(e){return}if(method!=='get'){event.preventDefault();send('dsh-browser-external',action);return}event.preventDefault();var url;try{url=new URL(action)}catch(e){return}var data;try{data=new FormData(form)}catch(e){return}data.forEach(function(value,key){if(typeof value==='string')url.searchParams.append(key,value)});send('dsh-browser-navigate',url.href);},true);})();`
}

function proxyError(status, message) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>预览失败</title><style>body{font:14px system-ui,sans-serif;margin:40px;color:#333}h1{font-size:18px}p{line-height:1.6;color:#666}</style></head><body><h1>无法预览此页面</h1><p>${escapeHtml(message)}</p><p>请用工具栏的外部浏览器按钮打开。</p></body></html>`,
    {
      status,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      },
    },
  )
}

function escapeHtml(value) {
  return String(value).replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;').replace(/"/gu, '&quot;')
}

/** JSON response helper. */
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

/** Failure body helper. */
function failure(code, message) {
  return { code, message }
}
