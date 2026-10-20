/**
 * Host half of the Workspace Files IO companion bundle.
 *
 * The main Workspace Files plugin registers JSON and raw-read routes, and its
 * module is already loaded in this Harness process. Binary upload needs a host
 * write path; this separate bundle adds one without replacing the loaded main
 * plugin, so activation can happen through the normal new-bundle path.
 *
 * The route below `/api` is owner-authenticated by the shared connection
 * channel. Every target stays inside a registered workspace root (or the
 * deployment default directory), and uploads use `wx` so two concurrent
 * same-name uploads cannot silently overwrite each other.
 */

import { createReadStream, promises as fsp } from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'

const ROUTE = '/api/dsh-web-filebrowser-io'

/** Deprecated alias for tabs opened before the rename. */
const LEGACY_ROUTE = '/api/dsh-side-io'

/** Largest single upload accepted by this bridge. */
const MAX_UPLOAD_BYTES = 128 * 1024 * 1024

const CONTENT_TYPES = new Map([
  ['.pdf', 'application/pdf'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.avif', 'image/avif'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.zip', 'application/zip'],
])

class IoError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'IoError'
    this.code = code
  }
}

export const inject = ['connection']

/**
 * Register the authenticated upload/download route for this plugin's lifetime.
 * @param ctx - Host context carrying the connection service.
 */
export function apply(ctx) {
  ctx.effect(() => {
    let disposed = false
    const disposers = []
    for (const route of [ROUTE, LEGACY_ROUTE]) {
      const registration = ctx.connection.fetch.register({
        path: route,
        methods: ['GET', 'POST'],
        requestBody: 'buffered',
        fetch: (request) => handleRequest(ctx, request),
      })
      registration.then(
        (dispose) => {
          if (disposed) dispose()
          else disposers.push(dispose)
        },
        (error) => console.error(`dsh-web-filebrowser-io: failed to register ${route}`, error),
      )
    }
    return () => {
      disposed = true
      for (const dispose of disposers) dispose()
    }
  }, 'dsh-web-filebrowser-io: upload/download API')
}

async function handleRequest(ctx, request) {
  try {
    const url = new URL(request.url)
    const op = url.searchParams.get('op')
    if (request.method === 'GET' && op === 'download') return await download(ctx, url)
    if (request.method === 'POST' && op === 'upload') return await upload(ctx, url, request)
    return json({ ok: false, error: { code: 'bad-op', message: '未知操作' } }, 400)
  } catch (error) {
    if (error instanceof IoError) {
      return json({ ok: false, error: { code: error.code, message: error.message } }, 200)
    }
    console.error('dsh-web-filebrowser-io: request failed', error)
    return json({ ok: false, error: { code: 'internal', message: error instanceof Error ? error.message : String(error) } }, 200)
  }
}

/** Registered workspaces plus the deployment default directory. */
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
  if (roots.length === 0) throw new IoError('no-root', '没有可用的工作区目录')
  const wanted = typeof requested === 'string' && requested.length > 0 ? requested : roots[0]
  let real
  try {
    real = await fsp.realpath(wanted)
  } catch {
    throw new IoError('root-unknown', `目录不存在：${wanted}`)
  }
  if (!roots.includes(real)) throw new IoError('outside-root', '只能访问已注册的工作区目录')
  return real
}

function childPath(root, rel) {
  if (typeof rel !== 'string' || rel.length === 0) throw new IoError('bad-path', '缺少文件路径')
  if (rel.includes('\u0000') || path.isAbsolute(rel) || /^[A-Za-z]:[\\/]/u.test(rel)) {
    throw new IoError('bad-path', '路径必须是工作区内的相对路径')
  }
  for (const segment of rel.split('/')) {
    if (segment.length === 0 || segment === '.' || segment === '..' || segment.includes('\\') || segment.includes('\u0000')) {
      throw new IoError('bad-path', `路径片段无效：${segment}`)
    }
  }
  const absolute = path.resolve(root, rel)
  if (!isInside(root, absolute)) throw new IoError('outside-root', '路径超出工作区范围')
  return absolute
}

function isInside(root, candidate) {
  return candidate === root || candidate.startsWith(root.endsWith(path.sep) ? root : root + path.sep)
}

async function ensureParentInside(root, absolute) {
  let realParent
  try {
    realParent = await fsp.realpath(path.dirname(absolute))
  } catch {
    throw new IoError('not-found', '上级目录不存在')
  }
  if (!isInside(root, realParent)) throw new IoError('outside-root', '路径超出工作区范围')
  const info = await fsp.stat(realParent)
  if (!info.isDirectory()) throw new IoError('not-directory', '目标不是目录')
  return realParent
}

function withSuffix(target, index) {
  const directory = path.dirname(target)
  const extension = path.extname(target)
  const base = path.basename(target, extension)
  return path.join(directory, `${base} (${String(index)})${extension}`)
}

async function writeUnique(target, bytes) {
  let candidate = target
  for (let index = 0; index < 1000; index += 1) {
    try {
      const handle = await fsp.open(candidate, 'wx')
      try {
        await handle.writeFile(bytes)
      } finally {
        await handle.close()
      }
      return candidate
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error
      candidate = withSuffix(target, index + 1)
    }
  }
  throw new IoError('exists', '同名文件太多，无法生成可用文件名')
}

async function upload(ctx, url, request) {
  const root = await resolveRoot(ctx, url.searchParams.get('root') ?? '')
  const relative = url.searchParams.get('path') ?? ''
  const absolute = childPath(root, relative)
  const realParent = await ensureParentInside(root, absolute)
  const declared = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(declared) && declared > MAX_UPLOAD_BYTES) {
    throw new IoError('too-large', `文件超过 ${String(Math.round(MAX_UPLOAD_BYTES / 1024 / 1024))} MB 上限`)
  }
  const bytes = new Uint8Array(await request.arrayBuffer())
  if (bytes.byteLength === 0) throw new IoError('empty', '文件内容为空')
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new IoError('too-large', `文件超过 ${String(Math.round(MAX_UPLOAD_BYTES / 1024 / 1024))} MB 上限`)
  }
  const requested = path.join(realParent, path.basename(absolute))
  const overwrite = url.searchParams.get('overwrite') === '1'
  let target
  if (overwrite) {
    target = requested
    await fsp.writeFile(target, bytes)
  } else {
    target = await writeUnique(requested, bytes)
  }
  const finalRelative = path.relative(root, target).split(path.sep).join('/')
  return json({ ok: true, value: { path: finalRelative, name: path.basename(target), bytes: bytes.byteLength } })
}

async function download(ctx, url) {
  try {
    const root = await resolveRoot(ctx, url.searchParams.get('root') ?? '')
    const relative = url.searchParams.get('path') ?? ''
    const absolute = childPath(root, relative)
    const real = await fsp.realpath(absolute)
    if (!isInside(root, real)) throw new IoError('outside-root', '路径超出工作区范围')
    const info = await fsp.stat(real)
    if (!info.isFile()) throw new IoError('not-file', '这不是普通文件')
    const name = path.basename(real)
    const type = CONTENT_TYPES.get(path.extname(real).toLowerCase()) ?? 'application/octet-stream'
    return new Response(Readable.toWeb(createReadStream(real)), {
      status: 200,
      headers: {
        'content-type': type,
        'content-length': String(info.size),
        'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
      },
    })
  } catch (error) {
    if (error instanceof IoError) {
      return json({ ok: false, error: { code: error.code, message: error.message } }, error.code === 'not-found' ? 404 : 400)
    }
    throw error
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}
