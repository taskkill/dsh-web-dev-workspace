/**
 * Host half of the Workspace Git bundle.
 *
 * The file explorer already owns file mutations; this companion adds local Git
 * operations and explicit remote synchronization for the selected workspace.
 * Credentials are never collected or stored: network commands run with
 * `GIT_TERMINAL_PROMPT=0`, so the Host's own SSH key or credential helper stays
 * the only authentication path.
 *
 * Safety rules:
 * - The requested root must be a registered workspace (or the deployment
 *   default) and must also be the repository top level. Refusing repositories
 *   whose root is a parent keeps every mutation inside the workspace the user
 *   opened.
 * - Git is invoked with `execFile` and argument arrays, never through a shell.
 *   Paths, refs and remotes are validated before use.
 * - Pulls are fast-forward only unless the caller explicitly asks for rebase or
 *   merge; pushes never force. Interactive editors and prompts are disabled.
 * - Output is bounded; diffs are capped separately.
 */

import { execFile } from 'node:child_process'
import { promises as fsp } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

const ROUTE = '/api/dsh-side-git'

/** Captured stdout/stderr upper bound for one Git command. */
const MAX_BUFFER = 8 * 1024 * 1024

/** Largest tracked-file diff returned to the browser. */
const MAX_DIFF_BYTES = 2 * 1024 * 1024

/** Largest generated diff for an untracked text file. */
const MAX_UNTRACKED_BYTES = 512 * 1024

/** Maximum number of status entries returned. */
const MAX_ENTRIES = 2000

/** Maximum number of commits returned by one compare side. */
const MAX_COMMITS = 100

/** Maximum number of files returned by one compare. */
const MAX_COMPARE_FILES = 2000

/** One local Git command may not run forever. */
const TIMEOUT_MS = 15000

/** Network commands get a larger budget: a slow remote is not a hung process. */
const NETWORK_TIMEOUT_MS = 120000

const execFileAsync = promisify(execFile)

class GitError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'GitError'
    this.code = code
  }
}

export const inject = ['connection']

/**
 * Register the authenticated Git route for this plugin's lifetime.
 * @param ctx - Host context carrying the connection service.
 */
export function apply(ctx) {
  ctx.effect(() => {
    let disposed = false
    let disposeRoute = () => {}
    const registration = ctx.connection.fetch.register({
      path: ROUTE,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: (request) => handleRequest(ctx, request),
    })
    registration.then(
      (dispose) => {
        if (disposed) dispose()
        else disposeRoute = dispose
      },
      (error) => console.error('dsh-side-git: failed to register its API route', error),
    )
    return () => {
      disposed = true
      disposeRoute()
    }
  }, 'dsh-side-git: authenticated Git API')
}

async function handleRequest(ctx, request) {
  try {
    if (request.method !== 'POST') return json({ ok: false, error: { code: 'bad-method', message: '仅支持 POST' } }, 405)
    let body
    try {
      body = await request.json()
    } catch {
      return json({ ok: false, error: { code: 'bad-request', message: '请求体不是有效的 JSON' } }, 400)
    }
    if (body === null || typeof body !== 'object' || typeof body.op !== 'string') {
      return json({ ok: false, error: { code: 'bad-request', message: '缺少操作名 op' } }, 400)
    }
    const root = await resolveRoot(ctx, body.root)
    const value = await dispatch(root, body)
    return json({ ok: true, value })
  } catch (error) {
    if (error instanceof GitError) {
      return json({ ok: false, error: { code: error.code, message: error.message } }, 200)
    }
    console.error('dsh-side-git: request failed', error)
    return json(
      { ok: false, error: { code: 'internal', message: error instanceof Error ? error.message : String(error) } },
      200,
    )
  }
}

async function dispatch(root, body) {
  switch (body.op) {
    case 'status':
      return status(root)
    case 'init':
      return initRepository(root)
    case 'diff':
      return diff(root, body)
    case 'stage':
      return stage(root, body)
    case 'unstage':
      return unstage(root, body)
    case 'commit':
      return commit(root, body)
    case 'branches':
      return branches(root)
    case 'checkout':
      return checkout(root, body)
    case 'refs':
      return refs(root)
    case 'compare':
      return compare(root, body)
    case 'compare-diff':
      return compareDiff(root, body)
    case 'fetch':
      return fetchRemote(root)
    case 'pull':
      return pull(root, body)
    case 'push':
      return push(root, body)
    default:
      throw new GitError('bad-op', `未知的 Git 操作：${body.op}`)
  }
}

/* -------------------------------------------------------------------------- */
/* Workspace roots                                                            */
/* -------------------------------------------------------------------------- */

/** Registered workspaces plus the deployment default directory, canonicalized. */
async function listRoots(ctx) {
  const candidates = []
  const registry = ctx.get('workspaceRegistry')
  if (registry !== undefined) {
    try {
      for (const workspace of registry.list()) candidates.push(workspace.path)
    } catch {
      /* fall through to the default root */
    }
  }
  const working = ctx.get('workingDirectory')
  if (working?.defaultDirectory) candidates.push(working.defaultDirectory)
  const seen = new Set()
  const roots = []
  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || candidate.length === 0) continue
    try {
      const real = await fsp.realpath(candidate)
      const info = await fsp.stat(real)
      if (!info.isDirectory() || seen.has(real)) continue
      seen.add(real)
      roots.push(real)
    } catch {
      /* skip a root that disappeared */
    }
  }
  return roots
}

async function resolveRoot(ctx, requested) {
  const roots = await listRoots(ctx)
  if (roots.length === 0) throw new GitError('no-root', '没有可用的工作区目录')
  const wanted = typeof requested === 'string' && requested.length > 0 ? requested : roots[0]
  let real
  try {
    real = await fsp.realpath(wanted)
  } catch {
    throw new GitError('root-unknown', `目录不存在：${wanted}`)
  }
  if (!roots.includes(real)) throw new GitError('outside-root', '只能访问已注册的工作区目录')
  return real
}

/* -------------------------------------------------------------------------- */
/* Git execution                                                              */
/* -------------------------------------------------------------------------- */

async function execGit(root, args, options = {}) {
  const env = {
    ...process.env,
    GIT_TERMINAL_PROMPT: '0',
    GIT_PAGER: 'cat',
    GIT_OPTIONAL_LOCKS: '0',
    GIT_EDITOR: 'true',
    GIT_SEQUENCE_EDITOR: 'true',
    GIT_ASKPASS: 'true',
    GIT_MERGE_AUTOEDIT: 'no',
    // Keep diagnostics and error classification predictable across locales.
    LC_ALL: 'C',
  }
  // Never let an inherited Git environment redirect operations away from root.
  for (const key of [
    'GIT_DIR',
    'GIT_WORK_TREE',
    'GIT_INDEX_FILE',
    'GIT_OBJECT_DIRECTORY',
    'GIT_ALTERNATE_OBJECT_DIRECTORIES',
    'GIT_COMMON_DIR',
    'GIT_NAMESPACE',
  ]) {
    delete env[key]
  }
  try {
    const result = await execFileAsync('git', args, {
      cwd: root,
      timeout: options.timeout ?? TIMEOUT_MS,
      maxBuffer: MAX_BUFFER,
      windowsHide: true,
      env,
    })
    return { stdout: result.stdout, stderr: result.stderr }
  } catch (error) {
    if (error !== null && typeof error === 'object' && error.code === 'ENOENT') {
      throw new GitError('git-missing', '未找到 git 可执行文件，请先在系统中安装 Git')
    }
    if (error !== null && typeof error === 'object' && error.killed === true) {
      throw new GitError('git-timeout', 'Git 命令执行超时')
    }
    const stderr = error !== null && typeof error === 'object' && typeof error.stderr === 'string' ? error.stderr.trim() : ''
    const stdout = error !== null && typeof error === 'object' && typeof error.stdout === 'string' ? error.stdout.trim() : ''
    const message = (stderr || stdout || (error instanceof Error ? error.message : String(error))).slice(0, 4000)
    throw new GitError('git-failed', message)
  }
}

async function runGit(root, args) {
  return (await execGit(root, args)).stdout
}

/** Run a command that talks to a remote, with the network budget. */
async function runRemoteGit(root, args) {
  return execGit(root, args, { timeout: NETWORK_TIMEOUT_MS })
}

async function hasHead(root) {
  try {
    await execGit(root, ['rev-parse', '--verify', '--quiet', 'HEAD'])
    return true
  } catch {
    return false
  }
}

/** Whether a repository exists and its top level is exactly the workspace root. */
async function inspectRepo(root) {
  let top
  try {
    top = (await runGit(root, ['rev-parse', '--show-toplevel'])).trim()
  } catch (error) {
    if (error instanceof GitError && (error.code === 'git-missing' || error.code === 'git-timeout')) throw error
    return { repo: false, reason: 'no-repo' }
  }
  if (top.length === 0) return { repo: false, reason: 'no-repo' }
  let real
  try {
    real = await fsp.realpath(top)
  } catch {
    return { repo: false, reason: 'no-repo' }
  }
  if (!samePath(real, root)) return { repo: false, reason: 'not-root' }
  return { repo: true }
}

function samePath(a, b) {
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b
}

async function requireRepo(root) {
  const info = await inspectRepo(root)
  if (info.repo) return
  if (info.reason === 'not-root') {
    throw new GitError('not-root', '当前工作区不是 Git 仓库根目录；请直接打开仓库根目录后再使用 Git')
  }
  throw new GitError('not-repo', '当前工作区不是 Git 仓库')
}

/* -------------------------------------------------------------------------- */
/* Status                                                                     */
/* -------------------------------------------------------------------------- */

async function status(root) {
  const info = await inspectRepo(root)
  if (!info.repo) return { repo: false, reason: info.reason }
  const [raw, remotes] = await Promise.all([
    runGit(root, ['status', '--porcelain=v1', '-z', '--branch', '--untracked-files=all']),
    listRemotes(root),
  ])
  return { ...parseStatus(raw), remotes }
}

function parseStatus(raw) {
  const records = raw.split('\u0000')
  let header = null
  if (records[0] !== undefined && records[0].startsWith('## ')) header = records.shift()
  const entries = []
  let truncated = false
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]
    if (record.length === 0) continue
    if (record.startsWith('## ')) {
      if (header === null) header = record
      continue
    }
    if (record.length < 3) continue
    const x = record[0]
    const y = record[1]
    if (x === '!' && y === '!') continue
    const untracked = x === '?' && y === '?'
    const file = record.slice(3)
    if (file.length === 0) continue
    let oldPath = null
    if (!untracked && (x === 'R' || x === 'C' || y === 'R' || y === 'C')) {
      oldPath = records[index + 1] ?? null
      index += 1
    }
    const staged = !untracked && x !== ' '
    const unstaged = !untracked && y !== ' '
    const conflict = x === 'U' || y === 'U' || (x === 'A' && y === 'A') || (x === 'D' && y === 'D')
    const letter = untracked ? 'U' : conflict ? '!' : x !== ' ' ? x : y
    entries.push({ path: file, oldPath, status: letter, staged, unstaged, untracked, conflict, indexStatus: x, worktreeStatus: y })
    if (entries.length >= MAX_ENTRIES) {
      truncated = true
      break
    }
  }
  const staged = entries.filter((entry) => entry.staged)
  const changes = entries.filter((entry) => entry.unstaged || entry.untracked)
  return {
    repo: true,
    ...parseBranchHeader(header),
    staged,
    changes,
    counts: { staged: staged.length, changes: changes.length },
    truncated,
  }
}

function parseBranchHeader(header) {
  const empty = {
    branch: null,
    upstream: null,
    ahead: 0,
    behind: 0,
    detached: false,
    unborn: false,
    gone: false,
  }
  if (typeof header !== 'string' || !header.startsWith('## ')) return empty
  const text = header.slice(3).trim()
  if (text.startsWith('No commits yet on ')) {
    return { ...empty, branch: text.slice('No commits yet on '.length), unborn: true }
  }
  if (text === 'HEAD (no branch)') return { ...empty, branch: 'HEAD', detached: true }
  const parts = text.split('...')
  const branch = parts[0]?.trim() || null
  if (parts.length < 2) return { ...empty, branch }
  const rest = parts.slice(1).join('...')
  const upstream = rest.split(' [')[0]?.trim() || null
  const gone = rest.includes('[gone]')
  const match = rest.match(/\[(?:ahead (\d+)(?:, behind (\d+))?|behind (\d+)(?:, ahead (\d+))?)\]/)
  const ahead = match === null ? 0 : Number(match[1] ?? match[4] ?? 0)
  const behind = match === null ? 0 : Number(match[2] ?? match[3] ?? 0)
  return { ...empty, branch, upstream, ahead, behind, gone }
}

/* -------------------------------------------------------------------------- */
/* Diff                                                                       */
/* -------------------------------------------------------------------------- */

async function diff(root, body) {
  await requireRepo(root)
  const relative = normalizeRepoPath(root, body.path)
  const staged = body.staged === true
  const untracked = body.untracked === true
  if (untracked && !staged) {
    return untrackedDiff(root, relative)
  }
  const args = ['diff', '--no-ext-diff', '--no-color', '--unified=3']
  if (staged) args.push('--cached')
  args.push('--', relative)
  const text = await runGit(root, args)
  if (Buffer.byteLength(text, 'utf8') > MAX_DIFF_BYTES) {
    throw new GitError('diff-too-large', '差异内容过大，无法在面板中显示')
  }
  return { path: relative, staged, untracked: false, diff: text }
}

async function untrackedDiff(root, relative) {
  const absolute = path.resolve(root, ...relative.split('/'))
  if (!isInside(root, absolute)) throw new GitError('outside-root', '路径超出工作区范围')
  let linkInfo
  try {
    linkInfo = await fsp.lstat(absolute)
  } catch {
    throw new GitError('not-found', '文件不存在')
  }
  if (linkInfo.isSymbolicLink()) {
    throw new GitError('symlink', '符号链接不支持未跟踪文件差异预览')
  }
  let real
  try {
    real = await fsp.realpath(absolute)
  } catch {
    throw new GitError('not-found', '文件不存在')
  }
  if (!isInside(root, real)) throw new GitError('outside-root', '路径超出工作区范围')
  const info = await fsp.stat(real)
  if (!info.isFile()) throw new GitError('not-file', '目标不是文件')
  if (info.size > MAX_UNTRACKED_BYTES) {
    throw new GitError('diff-too-large', '文件过大，无法生成差异')
  }
  const bytes = await fsp.readFile(real)
  if (bytes.includes(0)) throw new GitError('binary', '二进制文件不支持文本差异')
  const text = bytes.toString('utf8')
  const lines = text.split('\n')
  const label = relative.replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll('\r', '\\r')
  const added = lines.map((line) => `+${line}`).join('\n')
  return {
    path: relative,
    staged: false,
    untracked: true,
    diff: `diff --git a/${label} b/${label}\nnew file mode 100644\n--- /dev/null\n+++ b/${label}\n@@ -0,0 +1,${lines.length} @@\n${added}\n`,
  }
}

/* -------------------------------------------------------------------------- */
/* Staging                                                                    */
/* -------------------------------------------------------------------------- */

async function stage(root, body) {
  await requireRepo(root)
  const paths = normalizePathList(root, body.paths)
  const args = ['add', '-A']
  if (paths.length > 0) args.push('--', ...paths)
  await runGit(root, args)
  return { ok: true }
}

async function unstage(root, body) {
  await requireRepo(root)
  const paths = normalizePathList(root, body.paths)
  const head = await hasHead(root)
  if (paths.length === 0) {
    if (!head) {
      const current = await status(root)
      if (!current.repo || current.staged.length === 0) return { ok: true }
      await runGit(root, ['rm', '--cached', '-r', '-q', '--', '.'])
    } else {
      await runGit(root, ['reset', '-q', '--', '.'])
    }
    return { ok: true }
  }
  if (head) {
    await runGit(root, ['reset', '-q', '--', ...paths])
  } else {
    await runGit(root, ['rm', '--cached', '-r', '-q', '--', ...paths])
  }
  return { ok: true }
}

async function commit(root, body) {
  await requireRepo(root)
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (message.length === 0) throw new GitError('empty-message', '请输入提交信息')
  if (message.length > 5000) throw new GitError('message-too-long', '提交信息过长')
  try {
    await runGit(root, ['commit', '-m', message])
  } catch (error) {
    if (error instanceof GitError && /author identity unknown|please tell me who you are|unable to auto-detect email/iu.test(error.message)) {
      throw new GitError('identity', 'Git 还没有配置提交身份，请先在终端设置 user.name 和 user.email')
    }
    throw error
  }
  return { ok: true }
}

async function initRepository(root) {
  const info = await inspectRepo(root)
  if (info.repo) return status(root)
  if (info.reason === 'not-root') {
    throw new GitError('not-root', '当前目录位于另一个 Git 仓库内部；请打开该仓库的根目录')
  }
  await runGit(root, ['init'])
  return status(root)
}

/* -------------------------------------------------------------------------- */
/* Branches                                                                   */
/* -------------------------------------------------------------------------- */

async function branches(root) {
  await requireRepo(root)
  const raw = await runGit(root, ['for-each-ref', '--format=%(refname:short)', 'refs/heads'])
  const names = raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  let current = null
  try {
    current = (await runGit(root, ['symbolic-ref', '--short', '-q', 'HEAD'])).trim() || null
  } catch {
    current = null
  }
  return { branches: [...new Set(names)].slice(0, 500), current }
}

async function checkout(root, body) {
  await requireRepo(root)
  const name = normalizeBranchName(body.branch)
  try {
    await runGit(root, ['check-ref-format', '--branch', name])
  } catch {
    throw new GitError('bad-branch', '分支名无效')
  }
  try {
    await runGit(root, ['switch', name])
  } catch (error) {
    if (error instanceof GitError && /is not a git command/iu.test(error.message)) {
      await runGit(root, ['checkout', name])
    } else {
      throw error
    }
  }
  return { ok: true }
}

/* -------------------------------------------------------------------------- */
/* Refs and comparison                                                        */
/* -------------------------------------------------------------------------- */

async function refs(root) {
  await requireRepo(root)
  const [localRaw, remoteRaw, current, upstream] = await Promise.all([
    runGit(root, ['for-each-ref', '--format=%(refname:short)', 'refs/heads']),
    runGit(root, ['for-each-ref', '--format=%(refname:short)', 'refs/remotes']),
    currentBranchName(root),
    upstreamRef(root),
  ])
  return {
    local: uniqueLines(localRaw).slice(0, 500),
    remote: uniqueLines(remoteRaw)
      .filter((name) => !name.endsWith('/HEAD'))
      .slice(0, 500),
    current,
    upstream,
    detached: current === null,
  }
}

/**
 * Compare HEAD with one base ref: commits only on each side, plus the files
 * changed on our side since the merge base (the familiar compare view).
 */
async function compare(root, body) {
  await requireRepo(root)
  if (!(await hasHead(root))) throw new GitError('no-commits', '还没有提交，无法比较')
  const base = normalizeRef(body.base)
  await verifyRef(root, base)
  const [headRaw, mergeBaseRaw, aheadCountRaw, behindCountRaw, aheadCommits, behindCommits, filesRaw] =
    await Promise.all([
      runGit(root, ['rev-parse', '--short', 'HEAD']),
      runGit(root, ['merge-base', 'HEAD', base]),
      runGit(root, ['rev-list', '--count', `${base}..HEAD`]),
      runGit(root, ['rev-list', '--count', `HEAD..${base}`]),
      logCommits(root, `${base}..HEAD`),
      logCommits(root, `HEAD..${base}`),
      runGit(root, ['diff', '--name-status', '-z', '--find-renames', `${base}...HEAD`, '--']),
    ])
  const mergeBase = mergeBaseRaw.trim()
  if (mergeBase.length === 0) throw new GitError('unrelated', '当前分支与所选基准没有共同历史')
  const files = parseNameStatus(filesRaw)
  const aheadCount = Number.parseInt(aheadCountRaw.trim(), 10) || 0
  const behindCount = Number.parseInt(behindCountRaw.trim(), 10) || 0
  return {
    base,
    head: headRaw.trim(),
    mergeBase: mergeBase.slice(0, 12),
    ahead: { count: aheadCount, commits: aheadCommits },
    behind: { count: behindCount, commits: behindCommits },
    files,
    truncated:
      aheadCount > aheadCommits.length || behindCount > behindCommits.length || files.length >= MAX_COMPARE_FILES,
  }
}

/** Unified diff of one file between the merge base and HEAD. */
async function compareDiff(root, body) {
  await requireRepo(root)
  const base = normalizeRef(body.base)
  await verifyRef(root, base)
  const relative = normalizeRepoPath(root, body.path)
  const text = await runGit(root, [
    'diff',
    '--no-ext-diff',
    '--no-color',
    '--unified=3',
    `${base}...HEAD`,
    '--',
    relative,
  ])
  if (Buffer.byteLength(text, 'utf8') > MAX_DIFF_BYTES) {
    throw new GitError('diff-too-large', '差异内容过大，无法在面板中显示')
  }
  return { base, path: relative, diff: text }
}

/* -------------------------------------------------------------------------- */
/* Remote synchronization                                                     */
/* -------------------------------------------------------------------------- */

async function fetchRemote(root) {
  await requireRepo(root)
  const remotes = await listRemotes(root)
  if (remotes.length === 0) throw new GitError('no-remote', '当前仓库没有配置远程仓库')
  try {
    const result = await runRemoteGit(root, ['fetch', '--prune', '--no-recurse-submodules'])
    const summary = summarize(result.stderr || result.stdout)
    const fetched = summary.split('\n').filter((line) => line.includes('->')).length
    return { ok: true, remotes, fetched, summary }
  } catch (error) {
    throw mapRemoteFailure(error)
  }
}

async function pull(root, body) {
  await requireRepo(root)
  const mode = body.mode === 'rebase' ? 'rebase' : body.mode === 'merge' ? 'merge' : 'ff-only'
  const upstream = await upstreamRef(root)
  if (upstream === null) throw new GitError('no-upstream', '当前分支没有上游分支，无法拉取')
  const args = ['pull']
  if (mode === 'ff-only') args.push('--ff-only', '--no-rebase')
  else if (mode === 'rebase') args.push('--rebase', '--no-autostash')
  else args.push('--no-rebase', '--no-edit')
  try {
    const result = await runRemoteGit(root, args)
    const summary = summarize(result.stdout || result.stderr)
    return { ok: true, mode, upstream, summary, updated: !/already up.to.date/iu.test(summary) }
  } catch (error) {
    throw mapPullFailure(error)
  }
}

async function push(root, body) {
  await requireRepo(root)
  if (!(await hasHead(root))) throw new GitError('no-commits', '还没有提交，无法推送')
  const branch = await currentBranchName(root)
  if (branch === null) throw new GitError('detached', 'HEAD 处于分离状态，无法推送；请先切换到一个分支')
  const remotes = await listRemotes(root)
  if (remotes.length === 0) throw new GitError('no-remote', '当前仓库没有配置远程仓库')
  const upstream = await upstreamRef(root)
  const args = ['push']
  let remote = null
  if (upstream === null) {
    remote = typeof body.remote === 'string' && body.remote.length > 0 ? normalizeRemoteName(body.remote, remotes) : pickRemote(remotes)
    args.push('--set-upstream', remote, branch)
  }
  try {
    const result = await runRemoteGit(root, args)
    return {
      ok: true,
      branch,
      upstream: upstream ?? `${remote}/${branch}`,
      setUpstream: upstream === null,
      summary: summarize(result.stderr || result.stdout),
    }
  } catch (error) {
    throw mapPushFailure(error)
  }
}

async function listRemotes(root) {
  try {
    const raw = await runGit(root, ['remote'])
    return uniqueLines(raw)
  } catch {
    return []
  }
}

async function currentBranchName(root) {
  try {
    return (await runGit(root, ['symbolic-ref', '--short', '-q', 'HEAD'])).trim() || null
  } catch {
    return null
  }
}

async function upstreamRef(root) {
  try {
    const value = (await runGit(root, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'])).trim()
    return value.length > 0 ? value : null
  } catch {
    return null
  }
}

function pickRemote(remotes) {
  if (remotes.includes('origin')) return 'origin'
  if (remotes.length === 1) return remotes[0]
  throw new GitError('ambiguous-remote', '仓库有多个远程且没有 origin；请先在终端为当前分支设置上游')
}

function normalizeRemoteName(input, remotes) {
  const name = typeof input === 'string' ? input.trim() : ''
  if (name.length === 0 || name.startsWith('-') || !remotes.includes(name)) {
    throw new GitError('bad-remote', '远程仓库名称无效')
  }
  return name
}

function normalizeRef(input) {
  const ref = typeof input === 'string' ? input.trim() : ''
  if (ref.length === 0 || ref.length > 200 || ref.startsWith('-') || /[\u0000-\u0020\u007f]/u.test(ref)) {
    throw new GitError('bad-ref', '分支或提交名称无效')
  }
  return ref
}

async function verifyRef(root, ref) {
  try {
    await runGit(root, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`])
  } catch {
    throw new GitError('bad-ref', `找不到分支或提交：${ref}`)
  }
}

async function logCommits(root, range) {
  const format = ['%H', '%h', '%an', '%ad', '%s'].join('%x1f') + '%x1e'
  const raw = await runGit(root, ['log', `--max-count=${MAX_COMMITS}`, '--date=short', `--format=${format}`, range, '--'])
  const commits = []
  for (const record of raw.split('\u001e')) {
    const line = record.trim()
    if (line.length === 0) continue
    const fields = line.split('\u001f')
    if (fields.length < 5) continue
    commits.push({
      hash: fields[0],
      short: fields[1],
      author: fields[2],
      date: fields[3],
      subject: fields.slice(4).join('\u001f'),
    })
  }
  return commits
}

function parseNameStatus(raw) {
  const parts = raw.split('\u0000')
  const files = []
  for (let index = 0; index < parts.length; ) {
    const status = parts[index]
    index += 1
    if (status === undefined || status.length === 0) continue
    const letter = status[0]
    if (letter === 'R' || letter === 'C') {
      const from = parts[index] ?? ''
      const to = parts[index + 1] ?? ''
      index += 2
      if (to.length > 0) files.push({ path: to, oldPath: from.length > 0 ? from : null, status: letter })
    } else {
      const file = parts[index] ?? ''
      index += 1
      if (file.length > 0) files.push({ path: file, oldPath: null, status: letter })
    }
    if (files.length >= MAX_COMPARE_FILES) break
  }
  return files
}

function mapRemoteFailure(error) {
  if (!(error instanceof GitError)) return error
  const text = error.message
  if (
    /authentication failed|could not read (username|password)|terminal prompts disabled|permission denied \(publickey\)|support for password authentication|repository not found|access denied|not authorized|invalid username or password/iu.test(
      text,
    )
  ) {
    return new GitError('auth-required', '远程仓库要求认证；DSH 不保存凭据，请在 Host 上配置 SSH 密钥或 Git 凭据助手')
  }
  if (
    /could not resolve host|unable to access|connection timed out|connection refused|network is unreachable|failed to connect|operation timed out|temporary failure in name resolution|rpc failed|http2|expected flush|early eof|transfer closed|ssl|tls/iu.test(
      text,
    )
  ) {
    return new GitError('network', `无法连接远程仓库：${text}`)
  }
  return error
}

function mapPullFailure(error) {
  if (!(error instanceof GitError)) return error
  const text = error.message
  if (/not possible to fast-forward|diverging branches|need to specify how to reconcile/iu.test(text)) {
    return new GitError('diverged', '本地分支与上游已分叉，无法快进合并。请先在终端变基或合并后再拉取。')
  }
  if (/no tracking information|there is no tracking|no upstream/iu.test(text)) {
    return new GitError('no-upstream', '当前分支没有上游分支，无法拉取')
  }
  if (/would be overwritten|please commit your changes|please stash|local changes/iu.test(text)) {
    return new GitError('dirty', '工作区有未提交的更改，无法拉取；请先提交或暂存这些更改。')
  }
  if (/conflict/iu.test(text)) return new GitError('conflict', '拉取产生冲突，请先在终端解决冲突')
  return mapRemoteFailure(error)
}

function mapPushFailure(error) {
  if (!(error instanceof GitError)) return error
  const text = error.message
  if (/non-fast-forward|fetch first|\[rejected\]|updates were rejected/iu.test(text)) {
    return new GitError('non-fast-forward', '远程分支有新提交，推送被拒绝。请先拉取或合并后再推送。')
  }
  if (/remote rejected|pre-receive hook declined|protected branch/iu.test(text)) {
    return new GitError('rejected', `远程仓库拒绝了这次推送：${text}`)
  }
  return mapRemoteFailure(error)
}

function uniqueLines(raw) {
  const seen = new Set()
  const values = []
  for (const line of raw.split('\n')) {
    const value = line.trim()
    if (value.length === 0 || seen.has(value)) continue
    seen.add(value)
    values.push(value)
  }
  return values
}

function summarize(text) {
  return text
    .split(/\r?\n|\r/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
    .slice(-12)
    .join('\n')
    .slice(0, 4000)
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

function normalizeRepoPath(root, input) {
  if (typeof input !== 'string' || input.length === 0 || input.length > 4096) {
    throw new GitError('bad-path', '文件路径无效')
  }
  if (input.includes('\u0000') || input.includes('\\') || path.isAbsolute(input) || /^[A-Za-z]:[\\/]/u.test(input)) {
    throw new GitError('bad-path', '文件路径必须是仓库内的相对路径')
  }
  const segments = input.split('/')
  for (const segment of segments) {
    if (segment.length === 0 || segment === '.' || segment === '..') {
      throw new GitError('bad-path', '文件路径包含无效片段')
    }
  }
  const absolute = path.resolve(root, ...segments)
  if (!isInside(root, absolute)) throw new GitError('outside-root', '路径超出工作区范围')
  return segments.join('/')
}

function normalizePathList(root, input) {
  if (input === undefined || input === null) return []
  if (!Array.isArray(input) || input.length > 1000) throw new GitError('bad-path', '文件列表无效')
  const seen = new Set()
  const paths = []
  for (const item of input) {
    const relative = normalizeRepoPath(root, item)
    if (seen.has(relative)) continue
    seen.add(relative)
    paths.push(relative)
  }
  return paths
}

function normalizeBranchName(input) {
  if (typeof input !== 'string' || input.length === 0 || input.length > 200) {
    throw new GitError('bad-branch', '分支名无效')
  }
  if (
    input.startsWith('-') ||
    input.includes('..') ||
    input.includes('@{') ||
    /[\u0000-\u0020~^:?*\[\]\\]/u.test(input) ||
    input.endsWith('/') ||
    input.endsWith('.') ||
    input.endsWith('.lock')
  ) {
    throw new GitError('bad-branch', '分支名无效')
  }
  return input
}

function isInside(root, candidate) {
  return candidate === root || candidate.startsWith(root.endsWith(path.sep) ? root : root + path.sep)
}

function json(body, statusCode = 200) {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}
