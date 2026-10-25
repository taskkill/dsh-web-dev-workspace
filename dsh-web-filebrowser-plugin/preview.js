/**
 * Shareable preview proxy: exposes one loopback dev server under a random
 * token prefix on an extra HTTP port, so a phone or another machine on the
 * LAN can open the running app through the Harness host.
 *
 * `open()` starts a small HTTP server bound to 0.0.0.0 (configurable) with an
 * unguessable 32 hex token in the path. Requests below `/<token>/` are
 * streamed to `http://127.0.0.1:<port>`, HTML documents get a `<base>` and
 * prefix-rewritten absolute paths, and `Location` redirects are adjusted the
 * same way. A WebSocket upgrade is proxied as raw TCP, which is what Vite
 * HMR, webpack HMR and most dev overlays need. Only loopback targets are
 * accepted, so this endpoint cannot become an open proxy.
 *
 * Known limitation: only HTML bodies are rewritten. A dev server whose
 * JavaScript/CSS bodies hard-code absolute paths (as Vite does for module
 * imports) still needs `base: './'` (or an equivalent) on that server; the
 * token prefix cannot be inferred from arbitrary JS.
 */

import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { createServer as createHttpServer, request as httpRequest } from 'node:http'
import { connect as netConnect } from 'node:net'

const MAX_PREVIEWS = 8
/** Close a preview no request (HTTP or WebSocket) has touched for this long. */
const IDLE_PREVIEW_MS = 30 * 60 * 1000
const SWEEP_MS = 30_000
/** Largest request body streamed to the target; bigger uploads are refused. */
const MAX_BODY_BYTES = 10 * 1024 * 1024
/** Largest HTML document buffered for rewriting; larger documents are refused. */
const MAX_HTML_BYTES = 8 * 1024 * 1024
const TOKEN_BYTES = 16
const TOKEN_PATTERN = /^[0-9a-f]{32}$/u
const DEFAULT_LISTEN_HOST = '0.0.0.0'
const DEFAULT_TARGET_HOST = '127.0.0.1'
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])
/** Headers that may not be forwarded across a proxy hop. */
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

class PreviewError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'PreviewError'
    this.code = code
  }
}

/**
 * Create the preview manager bound to one Host context.
 * @param options.listenHost - interface the preview servers bind to (default `0.0.0.0`).
 * @param options.idleMs - override the idle timeout, mainly for tests.
 * @param options.sweepMs - override the sweeper interval, mainly for tests.
 */
export function createPreviewManager(options = {}) {
  const listenHost = typeof options.listenHost === 'string' && options.listenHost.length > 0 ? options.listenHost : DEFAULT_LISTEN_HOST
  const idleMs = Number.isFinite(options.idleMs) ? Math.max(1, options.idleMs) : IDLE_PREVIEW_MS
  const sweepMs = Number.isFinite(options.sweepMs) ? Math.max(1, options.sweepMs) : SWEEP_MS
  /** id -> preview */
  const previews = new Map()
  /** `host:port` -> preview, so the same dev server is shared by all callers. */
  const targets = new Map()
  const sweeper = setInterval(() => sweep(), sweepMs)
  sweeper.unref?.()

  /**
   * Fetch-shaped management endpoint used by the Host route.
   *
   * Only POST JSON with `op` open/list/close is accepted. Malformed transport
   * (wrong method, bad JSON, missing or unknown op) answers 400/405; refused
   * business operations answer HTTP 200 with `{ ok:false, error }`, matching
   * the other managers in this plugin.
   */
  async function handle(request) {
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
      switch (body.op) {
        case 'open':
          return success(await open(body))
        case 'list':
          return success(list())
        case 'close':
          return success(close(typeof body.id === 'string' ? body.id : ''))
        default:
          return json({ ok: false, error: { code: 'bad-op', message: `未知的预览操作：${body.op}` } }, 400)
      }
    } catch (error) {
      if (error instanceof PreviewError) return successError(error.code, error.message)
      console.error('dsh-web-filebrowser-preview: request failed', error)
      return successError('internal', error instanceof Error ? error.message : String(error))
    }
  }

  /**
   * Share one loopback dev server.
   * @param body.port - target TCP port, 1..65535.
   * @param body.host - target host, one of 127.0.0.1 / localhost / ::1.
   * @returns `{ id, token, port, url, localUrl, target, ... }` where `port` is
   *   the preview listener port and `url` is the relative `/<token>/` prefix.
   */
  async function open(body = {}) {
    const port = parseTargetPort(body.port)
    const host = parseTargetHost(body.host)
    const key = `${host}:${String(port)}`
    const existing = targets.get(key)
    if (existing !== undefined) {
      existing.lastTouchAt = Date.now()
      return describe(existing)
    }
    if (previews.size >= MAX_PREVIEWS) throw new PreviewError('too-many', `最多同时分享 ${String(MAX_PREVIEWS)} 个预览`)
    const preview = {
      id: randomUUID(),
      token: randomBytes(TOKEN_BYTES).toString('hex'),
      key,
      host,
      port,
      target: targetOrigin(host, port),
      server: null,
      listenHost,
      boundHost: DEFAULT_LISTEN_HOST,
      listenPort: 0,
      sockets: new Set(),
      pendingRequests: 0,
      createdAt: Date.now(),
      lastTouchAt: Date.now(),
      closing: false,
    }
    const server = createHttpServer((request, response) => routeRequest(preview, request, response))
    preview.server = server
    server.on('connection', (socket) => {
      preview.sockets.add(socket)
      socket.on('close', () => {
        preview.sockets.delete(socket)
      })
      // A browser that vanishes mid-request must not crash the preview server.
      socket.on('error', () => {
        socket.destroy()
      })
    })
    server.on('upgrade', (request, socket, head) => proxyUpgrade(preview, request, socket, head))
    server.on('clientError', (error, socket) => {
      if (socket.writable && !socket.destroyed) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n')
      else socket.destroy()
    })
    try {
      await listen(server, listenHost)
    } catch (error) {
      try {
        server.close()
      } catch {
        /* the listener never came up */
      }
      throw error
    }
    const address = server.address()
    preview.listenPort = address !== null && typeof address === 'object' ? address.port : 0
    preview.boundHost = address !== null && typeof address === 'object' ? address.address : listenHost
    server.on('error', (error) => {
      console.error('dsh-web-filebrowser-preview: preview server error', error)
    })
    previews.set(preview.id, preview)
    targets.set(key, preview)
    return describe(preview)
  }

  /** Stop one preview by id; unknown ids are an error like the terminal manager. */
  function close(id) {
    const preview = previews.get(typeof id === 'string' ? id : '')
    if (preview === undefined) throw new PreviewError('not-found', '预览不存在或已关闭')
    closePreview(preview)
    return { id: preview.id, closed: true }
  }

  /** Summarize live previews for the client. `port` is the preview listener port. */
  function list() {
    const entries = []
    for (const preview of previews.values()) {
      const url = urlFor(preview)
      entries.push({
        id: preview.id,
        token: preview.token,
        port: preview.listenPort,
        url,
        localUrl: localUrlFor(preview, url),
        target: preview.target,
        targetPort: preview.port,
        createdAt: preview.createdAt,
        lastTouchAt: preview.lastTouchAt,
        activeSockets: preview.sockets.size,
      })
    }
    entries.sort((left, right) => left.createdAt - right.createdAt)
    return entries
  }

  function closeAll() {
    clearInterval(sweeper)
    for (const preview of [...previews.values()]) closePreview(preview)
    previews.clear()
    targets.clear()
  }

  function sweep() {
    const now = Date.now()
    for (const preview of [...previews.values()]) {
      if (preview.closing) continue
      // A streaming/long-poll response in flight still counts as activity.
      if (preview.pendingRequests > 0) continue
      if (now - preview.lastTouchAt <= idleMs) continue
      closePreview(preview)
    }
  }

  function closePreview(preview) {
    if (preview.closing) return
    preview.closing = true
    previews.delete(preview.id)
    if (targets.get(preview.key)?.id === preview.id) targets.delete(preview.key)
    for (const socket of preview.sockets) socket.destroy()
    preview.sockets.clear()
    try {
      preview.server.close()
    } catch {
      /* already closed */
    }
  }

  return { handle, open, close, list, closeAll }
}

/**
 * Dispatch one proxied HTTP request: validate the token prefix, then stream the
 * request upstream and the response back down.
 */
function routeRequest(preview, request, response) {
  preview.lastTouchAt = Date.now()
  preview.pendingRequests += 1
  let released = false
  const release = () => {
    if (released) return
    released = true
    preview.pendingRequests = Math.max(0, preview.pendingRequests - 1)
  }
  response.once('finish', release)
  response.once('close', release)

  const incoming = parseRequestPath(request.url)
  const split = splitTokenPath(incoming.pathname)
  if (split === null || !tokenEquals(split.token, preview.token)) {
    sendNotFound(response)
    return
  }
  if (split.rest.length === 0) {
    // `/token` without the trailing slash would resolve relative links one
    // level too high; send the browser to the canonical prefix.
    response.writeHead(302, { location: `/${preview.token}/${incoming.search}`, 'cache-control': 'no-store' })
    response.end()
    return
  }
  proxyRequest(preview, request, response, `${split.rest}${incoming.search}`)
}

/** Forward one HTTP request to the target, streaming bodies in both directions. */
function proxyRequest(preview, request, response, upstreamPath) {
  const declared = Number(request.headers['content-length'] ?? '0')
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    request.resume()
    sendText(response, 413, '请求体超过 10 MB 上限')
    return
  }
  const upstream = httpRequest(
    {
      host: preview.host,
      port: preview.port,
      method: request.method ?? 'GET',
      path: upstreamPath,
      headers: forwardRequestHeaders(request.headers, preview),
      // A fresh socket per proxied request keeps the target's HMR/SSE streams
      // from sharing a pooled connection and makes shutdown deterministic.
      agent: false,
    },
    (upstreamResponse) => {
      forwardResponse(preview, response, upstreamResponse)
    },
  )
  let failed = false
  upstream.on('error', (error) => {
    if (failed) return
    failed = true
    if (response.headersSent) {
      response.destroy()
      return
    }
    console.error(`dsh-web-filebrowser-preview: ${preview.target} request failed`, error instanceof Error ? error.message : String(error))
    sendText(response, 502, `无法连接预览目标 ${preview.target}，请确认本地服务仍在运行。`)
  })
  let received = 0
  request.on('data', (chunk) => {
    if (failed) return
    received += chunk.length
    if (received > MAX_BODY_BYTES) {
      failed = true
      upstream.destroy()
      if (!response.headersSent) sendText(response, 413, '请求体超过 10 MB 上限')
      else response.destroy()
      return
    }
    if (!upstream.write(chunk)) request.pause()
  })
  request.on('end', () => {
    if (!failed) upstream.end()
  })
  request.on('aborted', () => {
    failed = true
    upstream.destroy()
  })
  request.on('error', () => {
    failed = true
    upstream.destroy()
  })
  request.on('close', () => {
    // A client that disconnects mid-upload must not leave the target reading.
    if (request.complete || failed) return
    failed = true
    upstream.destroy()
  })
  // A browser that navigates away mid-stream must release the target socket.
  response.once('close', () => {
    if (response.writableEnded) return
    failed = true
    upstream.destroy()
  })
  upstream.on('drain', () => {
    if (!failed) request.resume()
  })
}

/** Stream an upstream response, buffering only HTML documents for rewriting. */
function forwardResponse(preview, response, upstreamResponse) {
  preview.lastTouchAt = Date.now()
  upstreamResponse.on('data', () => {
    preview.lastTouchAt = Date.now()
  })
  upstreamResponse.on('error', () => {
    if (!response.writableEnded) response.destroy()
  })
  response.once('close', () => {
    if (response.writableEnded) return
    upstreamResponse.destroy()
  })
  if (response.destroyed) {
    upstreamResponse.destroy()
    return
  }
  const status = upstreamResponse.statusCode ?? 502
  const type = String(upstreamResponse.headers['content-type'] ?? '')
  const encoding = String(upstreamResponse.headers['content-encoding'] ?? '').toLowerCase()
  const mime = type.split(';')[0].trim().toLowerCase()
  const rewrite = (mime === 'text/html' || mime === 'application/xhtml+xml') && (encoding.length === 0 || encoding === 'identity')
  if (rewrite) {
    collectHtml(preview, response, upstreamResponse, status, type)
    return
  }
  const headers = copyResponseHeaders(upstreamResponse.headers)
  const location = headers.location
  if (location !== undefined) headers.location = rewriteLocation(String(location), preview)
  response.writeHead(status, headers)
  upstreamResponse.pipe(response)
}

/**
 * Buffer a small HTML document, rewrite it and answer.
 *
 * The body is bounded by MAX_HTML_BYTES so a huge page cannot pin Host memory;
 * anything larger is refused rather than passed through without the prefix.
 */
function collectHtml(preview, response, upstreamResponse, status, type) {
  const chunks = []
  let size = 0
  let finished = false
  const fail = (code, message) => {
    if (finished) return
    finished = true
    upstreamResponse.destroy()
    sendText(response, code, message)
  }
  upstreamResponse.on('data', (chunk) => {
    if (finished) return
    size += chunk.length
    if (size > MAX_HTML_BYTES) {
      fail(413, '预览页面超过 8 MB，无法改写')
      return
    }
    chunks.push(chunk)
  })
  upstreamResponse.on('end', () => {
    if (finished) return
    finished = true
    if (response.destroyed || response.writableEnded) return
    const html = rewriteHtml(decodeText(Buffer.concat(chunks), type), preview.token)
    const headers = copyResponseHeaders(upstreamResponse.headers, { dropLength: true, contentType: 'text/html; charset=utf-8' })
    const location = headers.location
    if (location !== undefined) headers.location = rewriteLocation(String(location), preview)
    response.writeHead(status, headers)
    response.end(html)
  })
}

/** Upgrade the browser socket to a raw TCP tunnel into the target's port. */
function proxyUpgrade(preview, request, socket, head) {
  preview.lastTouchAt = Date.now()
  if (socket.destroyed) return
  const targetSocket = netConnect({ host: preview.host, port: preview.port })
  let forwarding = false
  let failed = false
  const failUpgrade = () => {
    if (forwarding || failed) return
    failed = true
    if (socket.writable && !socket.destroyed) {
      socket.end('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\nContent-Length: 0\r\n\r\n')
    } else {
      socket.destroy()
    }
    targetSocket.destroy()
  }
  targetSocket.on('connect', () => {
    forwarding = true
    // Preserve the original handshake headers but point Host at the target, so
    // dev servers that validate Origin/Host still accept the HMR socket.
    const lines = [`GET ${upgradePath(request.url, preview.token)} HTTP/1.1`, `Host: ${hostHeader(preview.host, preview.port)}`]
    for (let index = 0; index < request.rawHeaders.length; index += 2) {
      const name = request.rawHeaders[index]
      if (name.toLowerCase() === 'host') continue
      lines.push(`${name}: ${request.rawHeaders[index + 1]}`)
    }
    targetSocket.write(`${lines.join('\r\n')}\r\n\r\n`)
    if (head.length > 0) targetSocket.write(head)
    targetSocket.pipe(socket)
    socket.pipe(targetSocket)
    targetSocket.on('data', () => {
      preview.lastTouchAt = Date.now()
    })
    socket.on('data', () => {
      preview.lastTouchAt = Date.now()
    })
  })
  targetSocket.on('error', () => {
    if (!forwarding) failUpgrade()
    else socket.destroy()
  })
  targetSocket.on('close', () => {
    if (!forwarding) failUpgrade()
    else socket.end()
  })
  socket.on('close', () => {
    targetSocket.destroy()
  })
  socket.on('error', () => {
    targetSocket.destroy()
    socket.destroy()
  })
}

/** Build the management response describing one preview. */
function describe(preview) {
  const url = urlFor(preview)
  return {
    id: preview.id,
    token: preview.token,
    port: preview.listenPort,
    url,
    localUrl: localUrlFor(preview, url),
    target: preview.target,
    targetHost: preview.host,
    targetPort: preview.port,
    listenHost: preview.boundHost,
    note: listenNote(preview, url),
  }
}

function urlFor(preview) {
  return `/${preview.token}/`
}

function localUrlFor(preview, url) {
  return `http://127.0.0.1:${String(preview.listenPort)}${url}`
}

function listenNote(preview, url) {
  if (preview.boundHost === '127.0.0.1' || preview.boundHost === '::1') return `仅监听 ${preview.boundHost}，只能在本机访问`
  return `监听 ${preview.boundHost}，手机/局域网请用 http://<Harness 主机 IP>:${String(preview.listenPort)}${url} 访问`
}

/** Normalize a requested loopback target host. */
function parseTargetHost(value) {
  if (value === undefined || value === null || value === '') return DEFAULT_TARGET_HOST
  if (typeof value !== 'string') throw new PreviewError('bad-host', '预览目标主机必须是字符串')
  const host = value
    .trim()
    .toLowerCase()
    .replace(/^\[/u, '')
    .replace(/\]$/u, '')
  if (!LOOPBACK_HOSTS.has(host)) {
    throw new PreviewError('bad-host', '只能预览本机回环地址（127.0.0.1 / localhost / ::1），不支持远程主机')
  }
  return host === 'localhost' ? DEFAULT_TARGET_HOST : host
}

/** Validate the requested target port. */
function parseTargetPort(value) {
  if (typeof value !== 'number' && typeof value !== 'string') throw new PreviewError('bad-port', '预览目标端口必须是 1-65535 的整数')
  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new PreviewError('bad-port', '预览目标端口必须是 1-65535 的整数')
  return port
}

/** Origin string for the loopback target, with IPv6 brackets when needed. */
function targetOrigin(host, port) {
  return `http://${hostHeader(host, port)}`
}

/** `Host:` value for a loopback target. */
function hostHeader(host, port) {
  return host.includes(':') ? `[${host}]:${String(port)}` : `${host}:${String(port)}`
}

/** Parse the origin-form request target of a proxied request. */
function parseRequestPath(rawUrl) {
  try {
    const parsed = new URL(typeof rawUrl === 'string' && rawUrl.length > 0 ? rawUrl : '/', 'http://preview.invalid')
    return { pathname: parsed.pathname, search: parsed.search }
  } catch {
    return { pathname: '/', search: '' }
  }
}

/**
 * Split `/token/rest` into its token segment and the rest, or null when the
 * path does not even look like a token URL. The token itself is checked
 * separately with a length-safe comparison.
 */
function splitTokenPath(pathname) {
  if (!pathname.startsWith('/')) return null
  const end = pathname.indexOf('/', 1)
  if (end === -1) return { token: pathname.slice(1), rest: '' }
  return { token: pathname.slice(1, end), rest: pathname.slice(end) }
}

/** Compare a path token with the preview token without an early-out scan. */
function tokenEquals(candidate, expected) {
  if (!TOKEN_PATTERN.test(candidate) || candidate.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(candidate, 'latin1'), Buffer.from(expected, 'latin1'))
}

/** Copy request headers across the hop, normalizing Host and asking for identity encoding. */
function forwardRequestHeaders(headers, preview) {
  const forwarded = {}
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) continue
    const lower = name.toLowerCase()
    if (HOP_BY_HOP.has(lower)) continue
    // Host belongs to the target; identity keeps HTML readable for rewriting.
    if (lower === 'host' || lower === 'accept-encoding' || lower === 'expect') continue
    forwarded[lower] = value
  }
  forwarded.host = hostHeader(preview.host, preview.port)
  forwarded['accept-encoding'] = 'identity'
  return forwarded
}

/** Copy response headers, optionally dropping the length/encoding a rewrite invalidates. */
function copyResponseHeaders(headers, options = {}) {
  const copied = {}
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) continue
    const lower = name.toLowerCase()
    if (HOP_BY_HOP.has(lower)) continue
    if (options.dropLength === true && (lower === 'content-length' || lower === 'content-encoding')) continue
    copied[lower] = value
  }
  if (options.contentType !== undefined) copied['content-type'] = options.contentType
  return copied
}

/** Turn a target redirect into one that stays inside the token prefix. */
function rewriteLocation(location, preview) {
  if (location.length === 0 || location.startsWith('//')) return location
  if (location.startsWith('/')) return `/${preview.token}${location}`
  let parsed
  try {
    parsed = new URL(location)
  } catch {
    return location
  }
  if (!isTargetOrigin(parsed, preview)) return location
  return `/${preview.token}${parsed.pathname}${parsed.search}${parsed.hash}`
}

/** True when an absolute redirect URL points at the same loopback dev server. */
function isTargetOrigin(url, preview) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
  const host = url.hostname
    .replace(/^\[/u, '')
    .replace(/\]$/u, '')
    .toLowerCase()
  const port = url.port.length > 0 ? Number(url.port) : url.protocol === 'https:' ? 443 : 80
  if (port !== preview.port) return false
  return host === preview.host || LOOPBACK_HOSTS.has(host)
}

/**
 * Rewrite one HTML document: inject a `<base>` and prefix absolute paths in
 * common attributes and CSS `url()`. Protocol-relative (`//cdn`) and external
 * URLs are deliberately left untouched.
 */
function rewriteHtml(html, token) {
  const prefix = `/${token}/`
  // Quoted absolute paths first, then bare (unquoted) attribute values.
  let output = html.replace(/(\b(?:src|href|poster|action)\s*=\s*)(["'])\/(?!\/)/giu, `$1$2${prefix}`)
  output = output.replace(/(\b(?:src|href|poster|action)\s*=\s*)\/(?!\/)/giu, `$1${prefix}`)
  output = output.replace(/(\bsrcset\s*=\s*)(["'])([^"']*)\2/giu, (match, head, quote, value) => `${head}${quote}${rewriteSrcset(value, prefix)}${quote}`)
  output = output.replace(/(url\(\s*)(["']?)\/(?!\/)/giu, `$1$2${prefix}`)
  const base = `<base href="${prefix}">`
  const head = /<head\b[^>]*>/iu.exec(output)
  if (head !== null) {
    const index = head.index + head[0].length
    return output.slice(0, index) + base + output.slice(index)
  }
  const htmlTag = /<html\b[^>]*>/iu.exec(output)
  if (htmlTag !== null) {
    const index = htmlTag.index + htmlTag[0].length
    return output.slice(0, index) + base + output.slice(index)
  }
  return base + output
}

/** Prefix every absolute-path candidate in one `srcset` attribute value. */
function rewriteSrcset(value, prefix) {
  return value
    .split(',')
    .map((entry) => entry.replace(/^(\s*)\/(?!\/)/u, `$1${prefix}`))
    .join(',')
}

/** Decode an HTML body using the charset advertised by the target. */
function decodeText(buffer, contentType) {
  const charset = /charset\s*=\s*["']?([^;"'\s]+)/iu.exec(contentType)?.[1] ?? 'utf-8'
  try {
    return new TextDecoder(charset).decode(buffer)
  } catch {
    return buffer.toString('utf8')
  }
}

/** Path to send upstream for an upgrade request, with the token prefix stripped. */
function upgradePath(rawUrl, token) {
  const { pathname, search } = parseRequestPath(rawUrl)
  const prefix = `/${token}/`
  if (pathname === `/${token}`) return `/${search}`
  if (pathname.startsWith(prefix)) return `/${pathname.slice(prefix.length)}${search}`
  return `${pathname}${search}`
}

function sendNotFound(response) {
  sendText(response, 404, '此预览需要分享链接：请从文件浏览器复制带令牌的预览地址后重新打开。')
}

/** Small plain-text answer used for 4xx/5xx proxy failures. */
function sendText(response, status, message) {
  if (response.headersSent || response.writableEnded || response.destroyed) {
    response.destroy()
    return
  }
  response.writeHead(status, {
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    connection: 'close',
  })
  response.end(`${message}\n`)
}

/** Resolve once the preview server is bound. */
function listen(server, host) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.removeListener('listening', onListening)
      reject(new PreviewError('listen-failed', `预览端口监听失败：${error instanceof Error ? error.message : String(error)}`))
    }
    const onListening = () => {
      server.removeListener('error', onError)
      resolve()
    }
    server.once('error', onError)
    server.once('listening', onListening)
    try {
      server.listen(0, host)
    } catch (error) {
      onError(error)
    }
  })
}

function success(value) {
  return json({ ok: true, value })
}

function successError(code, message) {
  return json({ ok: false, error: { code, message } })
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}
