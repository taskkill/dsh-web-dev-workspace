/**
 * Optional SSH/SFTP backend for workspace roots shaped like
 * `ssh://user@host:port/absolute/path`.
 *
 * `ssh2` is loaded lazily so the bundle keeps working when the optional
 * dependency is absent; SSH operations then fail with an actionable message
 * instead of preventing the plugin from loading.
 *
 * Authentication uses the SSH agent and the identity files named by
 * `~/.ssh/config` (falling back to the usual `id_ed25519` / `id_rsa` /
 * `id_ecdsa`). Passwords are never collected or stored. Host keys are accepted
 * as presented by `ssh2`; configure the network path accordingly.
 */

import { promises as fsp } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const DEFAULT_PORT = 22
const READY_TIMEOUT = 15000
const MAX_TEXT_BYTES = 8 * 1024 * 1024
const MAX_RAW_BYTES = 128 * 1024 * 1024

/** Stable error carrying the same `code` vocabulary the local API uses. */
export class SshError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'SshError'
    this.sideCode = code
  }
}

export function isSshRoot(value) {
  return typeof value === 'string' && /^ssh:\/\//iu.test(value)
}

/** Parse and validate one `ssh://user@host:port/absolute/path` root. */
export function parseSshRoot(spec) {
  let url
  try {
    url = new URL(spec)
  } catch {
    throw new SshError('bad-spec', 'SSH 目录地址无效')
  }
  if (url.protocol !== 'ssh:' || url.hostname.length === 0) {
    throw new SshError('bad-spec', 'SSH 目录地址应为 ssh://user@host:port/absolute/path')
  }
  const username = decodeURIComponent(url.username) || null
  const host = url.hostname.replace(/^\[/u, '').replace(/\]$/u, '')
  const port = url.port.length > 0 ? Number(url.port) : DEFAULT_PORT
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new SshError('bad-spec', 'SSH 端口无效')
  }
  const rootPath = decodeURIComponent(url.pathname)
  if (!rootPath.startsWith('/')) throw new SshError('bad-spec', 'SSH 目录必须是绝对路径')
  return {
    spec,
    username,
    host,
    port,
    path: path.posix.normalize(rootPath),
    key: `${username ?? ''}@${host}:${String(port)}`,
  }
}

/** Resolve a root-relative path without allowing it to leave the remote root. */
export function remotePath(parsed, relative) {
  if (typeof relative !== 'string' || relative.includes('\u0000') || relative.startsWith('/')) {
    if (typeof relative === 'string' && relative.length === 0) return parsed.path
    throw new SshError('bad-path', '远程路径无效')
  }
  const segments = relative.split('/').filter((segment) => segment.length > 0 && segment !== '.')
  if (segments.some((segment) => segment === '..')) throw new SshError('bad-path', '远程路径无效')
  const joined = path.posix.join(parsed.path, ...segments)
  const prefix = parsed.path.endsWith('/') ? parsed.path : `${parsed.path}/`
  if (joined !== parsed.path && !joined.startsWith(prefix)) throw new SshError('outside-root', '路径超出远程目录')
  return joined
}

/** Version string shared with the local backend: millisecond mtime + size. */
export function remoteVersion(attrs) {
  return `${String(Math.round(Number(attrs.mtime ?? 0) * 1000))}:${String(attrs.size ?? 0)}`
}

function mapError(error) {
  if (error instanceof SshError) return error
  const code = error !== null && typeof error === 'object' ? error.code : undefined
  const message = error instanceof Error ? error.message : String(error)
  if (code === 2 || /no such file|not found/iu.test(message)) return new SshError('not-found', '远程文件或目录不存在')
  if (code === 3 || /permission denied/iu.test(message)) return new SshError('permission', '没有权限访问远程文件')
  if (/all configured authentication methods failed|authentication/iu.test(message)) {
    return new SshError('ssh-auth', 'SSH 认证失败；请配置 SSH agent 或 ~/.ssh 下的私钥')
  }
  if (/timed out|timeout|ETIMEDOUT/iu.test(message)) return new SshError('ssh-timeout', '连接 SSH 主机超时')
  if (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|EHOSTUNREACH|ENETUNREACH/iu.test(message)) {
    return new SshError('ssh-network', `无法连接 SSH 主机：${message}`)
  }
  return new SshError('ssh-failed', message)
}

async function guard(operation) {
  try {
    return await operation()
  } catch (error) {
    throw mapError(error)
  }
}

let ssh2Promise
async function loadSsh2() {
  ssh2Promise ??= import('ssh2')
    .then((module) => module.default ?? module)
    .catch(() => {
      throw new SshError('ssh-unavailable', 'SSH 支持需要安装 ssh2：请在插件目录运行 npm install')
    })
  return ssh2Promise
}

/* -------------------------------------------------------------------------- */
/* Authentication                                                             */
/* -------------------------------------------------------------------------- */

let configPromise
async function readConfigFile() {
  const filename = path.join(os.homedir(), '.ssh', 'config')
  let text
  try {
    text = await fsp.readFile(filename, 'utf8')
  } catch {
    return new Map()
  }
  const hosts = new Map()
  let patterns = []
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (line.length === 0 || line.startsWith('#')) continue
    const match = /^(\S+)\s+(.+)$/u.exec(line)
    if (match === null) continue
    const key = match[1].toLowerCase()
    const value = match[2].trim().replace(/^"(.*)"$/u, '$1')
    if (key === 'host') {
      patterns = value.split(/\s+/u).filter((name) => name.length > 0)
      for (const pattern of patterns) {
        if (pattern.includes('*') || pattern.includes('?')) continue
        if (!hosts.has(pattern)) hosts.set(pattern, { identityFile: [] })
      }
      continue
    }
    if (patterns.length === 0) continue
    for (const pattern of patterns) {
      if (pattern.includes('*') || pattern.includes('?')) continue
      const entry = hosts.get(pattern) ?? { identityFile: [] }
      if (key === 'hostname') entry.hostName = value
      else if (key === 'user') entry.user = value
      else if (key === 'port') entry.port = Number(value)
      else if (key === 'identityfile') entry.identityFile.push(value)
      hosts.set(pattern, entry)
    }
  }
  return hosts
}

function sshConfig() {
  configPromise ??= readConfigFile()
  return configPromise
}

function expandHome(value) {
  if (value === '~') return os.homedir()
  if (value.startsWith('~/')) return path.join(os.homedir(), value.slice(2))
  return value
}

async function authentication(parsed) {
  const config = await sshConfig()
  const entry = config.get(parsed.host) ?? config.get('*') ?? {}
  const host = entry.hostName ?? parsed.host
  const port = parsed.port === DEFAULT_PORT && Number.isInteger(entry.port) ? entry.port : parsed.port
  const username = parsed.username ?? entry.user ?? os.userInfo().username
  const attempts = []
  if (typeof process.env.SSH_AUTH_SOCK === 'string' && process.env.SSH_AUTH_SOCK.length > 0) {
    attempts.push({ agent: process.env.SSH_AUTH_SOCK })
  }
  const candidates = [...(Array.isArray(entry.identityFile) ? entry.identityFile : []), '~/.ssh/id_ed25519', '~/.ssh/id_rsa', '~/.ssh/id_ecdsa']
  const seen = new Set()
  for (const candidate of candidates) {
    const filename = expandHome(candidate)
    if (seen.has(filename)) continue
    seen.add(filename)
    try {
      const key = await fsp.readFile(filename)
      attempts.push({ privateKey: key })
    } catch {
      /* missing or unreadable key: try the next one */
    }
  }
  if (attempts.length === 0) {
    throw new SshError('ssh-auth', '没有可用的 SSH 凭据；请启动 ssh-agent 或配置 ~/.ssh 私钥')
  }
  return { host, port, username, attempts, key: `${username}@${host}:${String(port)}` }
}

/* -------------------------------------------------------------------------- */
/* Connection pool                                                            */
/* -------------------------------------------------------------------------- */

const pool = new Map()

async function connect({ host, port, username, attempts, key }) {
  const ssh2 = await loadSsh2()
  let lastError
  for (const attempt of attempts) {
    try {
      const client = await new Promise((resolve, reject) => {
        const connection = new ssh2.Client()
        connection.once('ready', () => resolve(connection))
        connection.once('error', reject)
        connection.connect({
          host,
          port,
          username,
          readyTimeout: READY_TIMEOUT,
          keepaliveInterval: 30000,
          ...attempt,
        })
      })
      client.on('close', () => pool.delete(key))
      client.on('error', () => pool.delete(key))
      return client
    } catch (error) {
      lastError = error
      if (!/authentication|All configured authentication methods failed/iu.test(String(error?.message ?? error))) {
        throw error
      }
    }
  }
  throw lastError ?? new SshError('ssh-auth', 'SSH 认证失败')
}

async function clientFor(parsed) {
  const auth = await authentication(parsed)
  let pending = pool.get(auth.key)
  if (pending === undefined) {
    pending = guard(() => connect(auth))
    pool.set(auth.key, pending)
    pending.catch(() => pool.delete(auth.key))
  }
  return pending
}

async function openSftp(parsed) {
  const client = await clientFor(parsed)
  return new Promise((resolve, reject) => {
    client.sftp((error, sftp) => (error ? reject(error) : resolve(sftp)))
  })
}

function call(sftp, method, ...args) {
  return new Promise((resolve, reject) => {
    sftp[method](...args, (error, value) => (error ? reject(error) : resolve(value)))
  })
}

async function withSftp(parsed, operation) {
  return guard(async () => {
    const sftp = await openSftp(parsed)
    try {
      return await operation(sftp)
    } finally {
      try {
        sftp.end()
      } catch {
        /* already closed */
      }
    }
  })
}

async function statOrNull(sftp, target) {
  try {
    return await call(sftp, 'lstat', target)
  } catch (error) {
    if (error?.code === 2) return null
    throw error
  }
}

/* -------------------------------------------------------------------------- */
/* Operations                                                                 */
/* -------------------------------------------------------------------------- */

export async function test(spec) {
  const parsed = parseSshRoot(spec)
  return withSftp(parsed, async (sftp) => {
    const attrs = await call(sftp, 'lstat', parsed.path)
    return {
      root: spec,
      name: path.posix.basename(parsed.path) || parsed.path,
      type: attrs.isDirectory() ? 'directory' : 'file',
    }
  })
}

export async function list(spec, body) {
  const parsed = parseSshRoot(spec)
  const target = remotePath(parsed, typeof body.path === 'string' ? body.path : '')
  return withSftp(parsed, async (sftp) => {
    const attrs = await call(sftp, 'lstat', target)
    if (!attrs.isDirectory()) throw new SshError('not-directory', '这不是远程目录')
    const dirents = await call(sftp, 'readdir', target)
    const entries = dirents
      .filter((entry) => entry.filename !== '.' && entry.filename !== '..')
      .map((entry) => ({
      name: entry.filename,
      type: entry.attrs.isDirectory() ? 'directory' : entry.attrs.isFile() ? 'file' : 'other',
    }))
    entries.sort((left, right) => {
      if (left.type !== right.type) {
        if (left.type === 'directory') return -1
        if (right.type === 'directory') return 1
      }
      return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' })
    })
    return { root: spec, path: typeof body.path === 'string' ? body.path : '', entries }
  })
}

export async function stat(spec, body) {
  const parsed = parseSshRoot(spec)
  const target = remotePath(parsed, body.path)
  return withSftp(parsed, async (sftp) => {
    const attrs = await call(sftp, 'lstat', target)
    return {
      root: spec,
      path: body.path,
      type: attrs.isDirectory() ? 'directory' : attrs.isFile() ? 'file' : 'other',
      bytes: attrs.size,
      version: remoteVersion(attrs),
    }
  })
}

export async function readText(spec, body) {
  const parsed = parseSshRoot(spec)
  const target = remotePath(parsed, body.path)
  return withSftp(parsed, async (sftp) => {
    const attrs = await call(sftp, 'lstat', target)
    if (attrs.isDirectory()) throw new SshError('is-directory', '这是一个目录')
    if (!attrs.isFile()) throw new SshError('not-file', '这不是普通文件')
    if (attrs.size > MAX_TEXT_BYTES) {
      throw new SshError('too-large', `文件超过 ${String(Math.round(MAX_TEXT_BYTES / 1024 / 1024))} MB，无法在编辑器中打开`)
    }
    const buffer = await call(sftp, 'readFile', target)
    if (buffer.includes(0)) throw new SshError('binary', '这是二进制文件，无法作为文本编辑')
    return { content: buffer.toString('utf8'), version: remoteVersion(attrs), bytes: attrs.size }
  })
}

export async function writeText(spec, body) {
  const parsed = parseSshRoot(spec)
  const target = remotePath(parsed, body.path)
  if (typeof body.content !== 'string') throw new SshError('bad-content', '文件内容必须是字符串')
  const bytes = Buffer.from(body.content, 'utf8')
  if (bytes.length > MAX_TEXT_BYTES) throw new SshError('too-large', '内容超过编辑器的大小上限')
  return withSftp(parsed, async (sftp) => {
    const attrs = await statOrNull(sftp, target)
    if (attrs !== null && attrs.isDirectory()) throw new SshError('is-directory', '这是一个目录')
    const expected = typeof body.expectedVersion === 'string' ? body.expectedVersion : null
    if (attrs !== null && expected !== null && remoteVersion(attrs) !== expected) {
      throw new SshError('stale', '远程文件已被修改')
    }
    await call(sftp, 'writeFile', target, bytes)
    const next = await call(sftp, 'lstat', target)
    return { version: remoteVersion(next), bytes: bytes.length, path: body.path }
  })
}

export async function create(spec, body) {
  const parsed = parseSshRoot(spec)
  const target = remotePath(parsed, body.path)
  return withSftp(parsed, async (sftp) => {
    if ((await statOrNull(sftp, target)) !== null) throw new SshError('exists', '同名文件或目录已存在')
    if (body.type === 'directory') await call(sftp, 'mkdir', target)
    else await call(sftp, 'writeFile', target, Buffer.alloc(0))
    return { path: body.path }
  })
}

export async function rename(spec, body) {
  const parsed = parseSshRoot(spec)
  const from = remotePath(parsed, body.from)
  const to = remotePath(parsed, body.to)
  if (from === parsed.path) throw new SshError('protected', '不能重命名远程根目录')
  if (from === to) throw new SshError('same-path', '源和目标位置相同')
  const fromAttrs = await statOrNullPath(parsed, from)
  if (fromAttrs === null) throw new SshError('not-found', '源文件或目录不存在')
  if (fromAttrs.isDirectory()) {
    const relative = path.posix.relative(from, to)
    if (relative.length > 0 && !relative.startsWith('..') && !path.posix.isAbsolute(relative)) {
      throw new SshError('into-itself', '不能把目录移动到它自身内部')
    }
  }
  return withSftp(parsed, async (sftp) => {
    if ((await statOrNull(sftp, to)) !== null) throw new SshError('exists', '目标位置已有同名文件或目录')
    await call(sftp, 'rename', from, to)
    return { from: body.from, to: body.to, type: fromAttrs.isDirectory() ? 'directory' : 'file' }
  })
}

export async function remove(spec, body) {
  const parsed = parseSshRoot(spec)
  const target = remotePath(parsed, body.path)
  if (target === parsed.path) throw new SshError('protected', '不能删除远程根目录')
  return withSftp(parsed, async (sftp) => {
    await removeEntry(sftp, target)
    return { path: body.path }
  })
}

export async function copy(spec, body) {
  const parsed = parseSshRoot(spec)
  const from = remotePath(parsed, body.from)
  const initial = remotePath(parsed, body.to)
  if (from === parsed.path) throw new SshError('protected', '不能复制远程根目录')
  const attrs = await statOrNullPath(parsed, from)
  if (attrs === null) throw new SshError('not-found', '源文件或目录不存在')
  const same = from === initial
  if (same && body.rename !== true) throw new SshError('same-path', '源和目标位置相同')
  if (attrs.isDirectory() && !same) {
    const relative = path.posix.relative(from, initial)
    if (relative.length > 0 && !relative.startsWith('..') && !path.posix.isAbsolute(relative)) {
      throw new SshError('into-itself', '不能把目录复制到它自身内部')
    }
  }
  return withSftp(parsed, async (sftp) => {
    let to = initial
    let renamed = false
    if (same || (await statOrNull(sftp, to)) !== null) {
      if (body.rename !== true) throw new SshError('exists', '目标位置已有同名文件或目录')
      to = await uniquePath(sftp, to)
      renamed = true
    }
    await copyEntry(sftp, from, to)
    return {
      from: body.from,
      to: path.posix.relative(parsed.path, to),
      type: attrs.isDirectory() ? 'directory' : 'file',
      renamed,
    }
  })
}

export async function upload(spec, relative, bytes) {
  const parsed = parseSshRoot(spec)
  const initial = remotePath(parsed, relative)
  return withSftp(parsed, async (sftp) => {
    let target = initial
    if ((await statOrNull(sftp, target)) !== null) target = await uniquePath(sftp, target)
    await call(sftp, 'writeFile', target, bytes)
    return {
      path: path.posix.relative(parsed.path, target),
      name: path.posix.basename(target),
      bytes: bytes.length,
    }
  })
}

/** Open a read stream for previews and downloads. */
export async function openRead(spec, relative) {
  const parsed = parseSshRoot(spec)
  const target = remotePath(parsed, relative)
  const sftp = await openSftp(parsed).catch((error) => {
    throw mapError(error)
  })
  try {
    const attrs = await call(sftp, 'lstat', target)
    if (attrs.isDirectory()) throw new SshError('not-file', '这是一个目录')
    if (attrs.size > MAX_RAW_BYTES) throw new SshError('too-large', '文件过大，无法预览')
    const stream = sftp.createReadStream(target)
    stream.once('close', () => {
      try {
        sftp.end()
      } catch {
        /* channel already gone */
      }
    })
    return { stream, size: attrs.size, name: path.posix.basename(target) }
  } catch (error) {
    try {
      sftp.end()
    } catch {
      /* ignore */
    }
    throw mapError(error)
  }
}

export async function closeAll() {
  for (const pending of pool.values()) {
    try {
      const client = await pending
      client.end()
    } catch {
      /* connection already failed */
    }
  }
  pool.clear()
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

async function statOrNullPath(parsed, target) {
  return withSftp(parsed, (sftp) => statOrNull(sftp, target))
}

async function removeEntry(sftp, target) {
  const attrs = await call(sftp, 'lstat', target)
  if (!attrs.isDirectory()) {
    await call(sftp, 'unlink', target)
    return
  }
  const entries = await call(sftp, 'readdir', target)
  for (const entry of entries) {
    await removeEntry(sftp, path.posix.join(target, entry.filename))
  }
  await call(sftp, 'rmdir', target)
}

async function copyEntry(sftp, from, to) {
  const attrs = await call(sftp, 'lstat', from)
  if (attrs.isSymbolicLink()) {
    const link = await call(sftp, 'readlink', from)
    await call(sftp, 'symlink', link, to)
    return
  }
  if (!attrs.isDirectory()) {
    const buffer = await call(sftp, 'readFile', from)
    await call(sftp, 'writeFile', to, buffer)
    return
  }
  await call(sftp, 'mkdir', to)
  const entries = await call(sftp, 'readdir', from)
  for (const entry of entries) {
    await copyEntry(sftp, path.posix.join(from, entry.filename), path.posix.join(to, entry.filename))
  }
}

async function uniquePath(sftp, target) {
  const directory = path.posix.dirname(target)
  const extension = path.posix.extname(target)
  const base = path.posix.basename(target, extension)
  for (let index = 1; index < 1000; index += 1) {
    const candidate = path.posix.join(directory, `${base} (${String(index)})${extension}`)
    if ((await statOrNull(sftp, candidate)) === null) return candidate
  }
  throw new SshError('exists', '同名副本过多，无法生成新名称')
}
