/**
 * Host half of the dsh-side bundle.
 *
 * The browser editor needs file mutations (create, rename, delete, save), which
 * the shipped read-only `workspaceFiles` Remote namespace does not expose. This
 * host plugin registers one exact Fetch route on the authenticated shared API
 * channel (`/api/dsh-side`). Only owner Peers reach an exact route, so the
 * browser's signed session cookie is the authentication input; no additional
 * token is invented here.
 *
 * Every path is confined to a directory the Harness already knows as a
 * workspace root (the durable registry plus the deployment default directory).
 * Symlinks are resolved before containment is checked so a link cannot escape
 * its root.
 */

import { createReadStream, promises as fsp } from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'

/** Exact URL below `/api` that this plugin owns. */
const ROUTE = '/api/dsh-side'

/** Largest file the editor will open as UTF-8 text. */
const MAX_TEXT_BYTES = 8 * 1024 * 1024

/** Largest file the raw passthrough will stream (PDF, images, downloads). */
const MAX_RAW_BYTES = 128 * 1024 * 1024

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
  ctx.effect(() => {
    let disposed = false
    let disposeRoute = () => {}
    const registration = ctx.connection.fetch.register({
      path: ROUTE,
      methods: ['GET', 'POST'],
      requestBody: 'buffered',
      fetch: (request) => handleRequest(ctx, request),
    })
    registration.then(
      (dispose) => {
        if (disposed) dispose()
        else disposeRoute = dispose
      },
      (error) => {
        console.error('dsh-side: failed to register its API route', error)
      },
    )
    return () => {
      disposed = true
      disposeRoute()
    }
  }, 'dsh-side: authenticated file API')
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
    const value = await dispatch(ctx, body.op, body)
    return json({ ok: true, value })
  } catch (error) {
    if (error instanceof SideError) {
      return json({ ok: false, error: { code: error.code, message: error.message, details: error.details } }, 200)
    }
    console.error('dsh-side: file API failed', error)
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
    default:
      throw new SideError('bad-op', `未知操作：${op}`)
  }
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
 * Resolve the requested root against the currently registered workspace roots.
 * The address bar registers a typed directory as a workspace before using it,
 * so every file operation still lands inside a registered root.
 * @param ctx - Host context.
 * @param requested - absolute root path sent by the browser.
 * @returns canonical root path.
 */
async function resolveRoot(ctx, requested) {
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
  const absolute = childPath(root, body.path)
  const target = await inspectTarget(root, absolute)
  if (!target.exists) throw new SideError('not-found', '文件不存在')
  const kind = target.info.isDirectory() ? 'directory' : target.info.isFile() ? 'file' : 'other'
  return { root, path: body.path, type: kind, bytes: target.info.size, version: versionOf(target.info) }
}

/** Read one UTF-8 text file. */
async function readText(ctx, body) {
  const root = await resolveRoot(ctx, body.root)
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
  const absolute = childPath(root, body.path)
  const target = await inspectTarget(root, absolute)
  if (target.exists) throw new SideError('exists', '同名文件或目录已存在')
  await fsp.mkdir(target.path)
  return { path: body.path }
}

/** Rename or move one entry inside the root. */
async function renamePath(ctx, body) {
  const root = await resolveRoot(ctx, body.root)
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

/** Serve one file's bytes for PDF/image preview and browser handoff. */
async function handleGet(ctx, request) {
  try {
    const url = new URL(request.url)
    if (url.searchParams.get('op') !== 'raw') {
      return json({ ok: false, error: failure('bad-op', 'GET 仅支持 op=raw') }, 400)
    }
    const root = await resolveRoot(ctx, url.searchParams.get('root') ?? '')
    const relative = url.searchParams.get('path') ?? ''
    const absolute = childPath(root, relative)
    const target = await inspectTarget(root, absolute)
    if (!target.exists) return json({ ok: false, error: failure('not-found', '文件不存在') }, 404)
    if (!target.info.isFile()) return json({ ok: false, error: failure('not-file', '这不是普通文件') }, 400)
    if (target.info.size > MAX_RAW_BYTES) return json({ ok: false, error: failure('too-large', '文件过大，无法预览') }, 413)
    const name = path.basename(target.path)
    const type = CONTENT_TYPES.get(path.extname(target.path).toLowerCase()) ?? 'application/octet-stream'
    const stream = Readable.toWeb(createReadStream(target.path))
    return new Response(stream, {
      status: 200,
      headers: {
        'content-type': type,
        'content-length': String(target.info.size),
        'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(name)}`,
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
      },
    })
  } catch (error) {
    if (error instanceof SideError) return json({ ok: false, error: { code: error.code, message: error.message } }, 400)
    console.error('dsh-side: raw read failed', error)
    return json({ ok: false, error: failure('internal', error instanceof Error ? error.message : String(error)) }, 500)
  }
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
