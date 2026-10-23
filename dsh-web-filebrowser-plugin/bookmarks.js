/**
 * Per-workspace built-in browser state: bookmarks and start-page settings.
 *
 * The browser UI keeps its favourite preview addresses and the start page's
 * protocol/host in `<workspace>/.dsh/browser-bookmarks.json`, so they stay with
 * the project instead of one machine's localStorage. A generated
 * `.dsh/.gitignore` (`*`) keeps the document out of Git, matching workspace
 * memory and the todo board.
 *
 * Writes are serialized per root and use a temp-file rename, so two plugin
 * mounts (main panel and sidebar) cannot interleave a read-modify-write.
 */

import { randomUUID } from 'node:crypto'
import { promises as fsp } from 'node:fs'
import path from 'node:path'

/** Directory created inside a workspace for plugin-owned state. */
export const BOOKMARKS_DIRNAME = '.dsh'

/** File name holding one workspace's browser bookmarks. */
export const BOOKMARKS_FILENAME = 'browser-bookmarks.json'

/** Document format version. */
export const BOOKMARKS_VERSION = 1

/** Hard limits mirrored by the browser UI. */
export const BOOKMARKS_MAX_ENTRIES = 50
export const BOOKMARKS_MAX_TITLE = 200
export const BOOKMARKS_MAX_URL = 4096
export const BOOKMARKS_MAX_BYTES = 256 * 1024

/** Accepted viewport values. */
export const BOOKMARK_DEVICES = ['pc', 'mobile']
export const BOOKMARK_PRESETS = ['iphone14', 'iphoneSE', 'pixel7', 'ipad']
export const BOOKMARK_ORIENTATIONS = ['portrait', 'landscape']

/** Accepted start-page protocol values and host bound. */
export const BOOKMARK_SCHEMES = ['auto', 'http', 'https']
export const BOOKMARKS_MAX_HOST = 255

/** A structured, caller-facing failure with a stable machine code. */
export class BookmarksError extends Error {
  /**
   * @param code - stable machine-readable code.
   * @param message - human-readable explanation.
   */
  constructor(code, message) {
    super(message)
    this.name = 'BookmarksError'
    this.code = code
    // The Host request handler maps this field onto the API error envelope.
    this.sideCode = code
  }
}

/** Absolute path of one workspace's bookmark document. */
export function bookmarksFile(root) {
  return path.join(path.resolve(root), BOOKMARKS_DIRNAME, BOOKMARKS_FILENAME)
}

/** Absolute path of the plugin state directory inside one workspace. */
function stateDirectory(root) {
  return path.join(path.resolve(root), BOOKMARKS_DIRNAME)
}

/** Reject a root that could escape the caller's workspace containment. */
function assertRoot(root) {
  if (typeof root !== 'string' || root.length === 0 || !path.isAbsolute(root)) {
    throw new BookmarksError('bad-root', '工作区根目录必须是绝对路径')
  }
  return path.resolve(root)
}

/** Whether `candidate` is the root itself or one of its descendants. */
function isInsideRoot(root, candidate) {
  const relative = path.relative(path.resolve(root), candidate)
  if (relative === '') return true
  if (path.isAbsolute(relative)) return false
  return relative !== '..' && !relative.startsWith(`..${path.sep}`)
}

/** Refuse a real `.dsh` directory that points outside the workspace. */
async function assertStateDirectory(root) {
  let real
  try {
    real = await fsp.realpath(stateDirectory(root))
  } catch (error) {
    if (error !== null && typeof error === 'object' && error.code === 'ENOENT') return
    throw error
  }
  if (!isInsideRoot(root, real)) {
    throw new BookmarksError('outside-root', '工作区收藏目录指向工作区之外，已拒绝访问')
  }
}

/** Refuse a bookmark file that is a symlink or resolves outside the workspace. */
async function assertBookmarksFile(root) {
  await assertStateDirectory(root)
  const file = bookmarksFile(root)
  let info
  try {
    info = await fsp.lstat(file)
  } catch (error) {
    if (error !== null && typeof error === 'object' && error.code === 'ENOENT') return
    throw error
  }
  if (info.isSymbolicLink()) {
    throw new BookmarksError('unsafe', '工作区收藏文件是符号链接，已拒绝访问')
  }
  let real
  try {
    real = await fsp.realpath(file)
  } catch (error) {
    if (error !== null && typeof error === 'object' && error.code === 'ENOENT') return
    throw error
  }
  if (!isInsideRoot(root, real)) {
    throw new BookmarksError('outside-root', '工作区收藏文件指向工作区之外，已拒绝访问')
  }
}

/** Normalize one address; only http(s) URLs can be previewed and bookmarked. */
function normalizeUrl(value) {
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (raw.length === 0 || raw.length > BOOKMARKS_MAX_URL) return null
  try {
    const parsed = new URL(raw)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null
  } catch {
    return null
  }
}

/** Normalize a title, falling back to the address. */
function normalizeTitle(value, url) {
  if (typeof value !== 'string') return url
  const title = value.trim().slice(0, BOOKMARKS_MAX_TITLE)
  return title.length > 0 ? title : url
}

/** Normalize the start page's host field; an invalid value falls back to localhost. */
function normalizeHost(value) {
  let host = typeof value === 'string' ? value.trim() : ''
  if (host.length === 0) return 'localhost'
  if (/^[a-z][a-z0-9+.-]*:\/\//iu.test(host)) {
    try {
      host = new URL(host).hostname
    } catch {
      return 'localhost'
    }
  }
  if (host.startsWith('[')) {
    const end = host.indexOf(']')
    host = end > 0 ? host.slice(0, end + 1) : 'localhost'
  }
  const slash = host.indexOf('/')
  if (slash >= 0) host = host.slice(0, slash)
  if (/^[^:]+:\d+$/u.test(host)) host = host.slice(0, host.lastIndexOf(':'))
  host = host.trim()
  if (host.length === 0) return 'localhost'
  return host.slice(0, BOOKMARKS_MAX_HOST)
}

/** Normalize the start page's protocol/host preferences. */
function normalizeSettings(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  return {
    scheme: BOOKMARK_SCHEMES.includes(value.scheme) ? value.scheme : 'auto',
    host: normalizeHost(value.host),
  }
}

/** Normalize a stored or submitted bookmark; `null` means "drop it". */
function normalizeBookmark(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const url = normalizeUrl(value.url)
  if (url === null) return null
  const id = typeof value.id === 'string' && value.id.trim().length > 0 ? value.id.trim().slice(0, 80) : `bookmark:${url}`
  return {
    id,
    url,
    title: normalizeTitle(value.title, url),
    device: BOOKMARK_DEVICES.includes(value.device) ? value.device : 'pc',
    preset: BOOKMARK_PRESETS.includes(value.preset) ? value.preset : 'iphone14',
    orientation: BOOKMARK_ORIENTATIONS.includes(value.orientation) ? value.orientation : 'portrait',
    addedAt: Number.isFinite(value.addedAt) && value.addedAt > 0 ? Math.floor(value.addedAt) : 0,
  }
}

/** Normalize one list, de-duplicating by URL and bounding the entry count. */
function normalizeList(value) {
  if (!Array.isArray(value)) return []
  const seen = new Set()
  const result = []
  for (const item of value) {
    const bookmark = normalizeBookmark(item)
    if (bookmark === null || seen.has(bookmark.url)) continue
    seen.add(bookmark.url)
    result.push(bookmark)
    if (result.length >= BOOKMARKS_MAX_ENTRIES) break
  }
  return result
}

/** An empty browser-state document. */
function emptyDocument() {
  return { version: BOOKMARKS_VERSION, updatedAt: 0, settings: null, bookmarks: [] }
}

/** Parse one document, accepting a bare bookmark array for hand edits. */
function parseDocument(text, file) {
  let value
  try {
    value = JSON.parse(text)
  } catch (error) {
    throw new BookmarksError('corrupt', `工作区收藏文件无法解析：${file}`)
  }
  const source = Array.isArray(value) ? { bookmarks: value } : value
  if (source === null || typeof source !== 'object') {
    throw new BookmarksError('corrupt', `工作区收藏文件格式无效：${file}`)
  }
  return {
    version: BOOKMARKS_VERSION,
    updatedAt: Number.isFinite(source.updatedAt) && source.updatedAt > 0 ? Math.floor(source.updatedAt) : 0,
    settings: normalizeSettings(source.settings),
    bookmarks: normalizeList(source.bookmarks),
  }
}

/** Read one workspace's bookmark document, returning an empty document when absent. */
export async function readBookmarks(root) {
  const workspace = assertRoot(root)
  const file = bookmarksFile(workspace)
  await assertBookmarksFile(workspace)
  let text
  try {
    text = await fsp.readFile(file, 'utf8')
  } catch (error) {
    if (error !== null && typeof error === 'object' && error.code === 'ENOENT') return emptyDocument()
    throw error
  }
  return parseDocument(text, file)
}

/** Create `.dsh/.gitignore` so plugin state does not dirty the repository. */
async function ensureStateDirectory(root) {
  const directory = stateDirectory(root)
  await fsp.mkdir(directory, { recursive: true })
  await assertStateDirectory(root)
  try {
    await fsp.writeFile(path.join(directory, '.gitignore'), '*\n', { encoding: 'utf8', flag: 'wx', mode: 0o600 })
  } catch (error) {
    if (error === null || typeof error !== 'object' || error.code !== 'EEXIST') throw error
  }
}

/** Write one document atomically. */
async function writeBookmarks(root, state) {
  const file = bookmarksFile(root)
  const text = `${JSON.stringify(state, null, 2)}\n`
  if (Buffer.byteLength(text, 'utf8') > BOOKMARKS_MAX_BYTES) {
    throw new BookmarksError('full', '工作区收藏文件过大；请删除一些收藏后重试')
  }
  await ensureStateDirectory(root)
  await assertBookmarksFile(root)
  const temporary = path.join(
    stateDirectory(root),
    `.bookmarks-${String(process.pid)}-${String(Date.now())}-${randomUUID()}.tmp`,
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

/** Per-root mutation queue: read-modify-write runs one at a time. */
const mutationQueues = new Map()

/**
 * Run one mutation under the root's queue.
 * @param root - absolute workspace root.
 * @param operation - read-modify-write body.
 * @returns operation result.
 */
function withMutationLock(root, operation) {
  const key = path.resolve(root)
  const previous = mutationQueues.get(key) ?? Promise.resolve()
  const current = previous.catch(() => {}).then(operation)
  mutationQueues.set(key, current)
  return current.finally(() => {
    if (mutationQueues.get(key) === current) mutationQueues.delete(key)
  })
}

/** Build the snapshot returned by every read and mutation. */
function snapshot(state) {
  return {
    version: BOOKMARKS_VERSION,
    settings: state.settings,
    bookmarks: state.bookmarks,
    total: state.bookmarks.length,
    updatedAt: state.updatedAt,
  }
}

/**
 * Read one workspace's browser bookmarks and start-page settings.
 * @param root - absolute workspace root.
 * @returns `{ settings, bookmarks, total, updatedAt, path }`.
 */
export async function listBookmarks(root) {
  const workspace = assertRoot(root)
  const state = await readBookmarks(workspace)
  return { ...snapshot(state), path: bookmarksFile(workspace) }
}

/**
 * Add (or refresh) one bookmark.
 *
 * Re-adding an existing URL updates its title/viewport and keeps its position,
 * so a client that missed a cross-panel update cannot create duplicates.
 *
 * @param root - absolute workspace root.
 * @param input - `{ url, title?, device?, preset?, orientation? }`.
 * @returns the refreshed snapshot plus `created`.
 */
export async function addBookmark(root, input) {
  const workspace = assertRoot(root)
  const incoming = normalizeBookmark(input)
  if (incoming === null) throw new BookmarksError('bad-url', '收藏地址必须是 http/https 链接')
  return withMutationLock(workspace, async () => {
    const state = await readBookmarks(workspace)
    const index = state.bookmarks.findIndex((item) => item.url === incoming.url)
    let created = false
    if (index >= 0) {
      const existing = state.bookmarks[index]
      state.bookmarks[index] = {
        ...incoming,
        id: existing.id,
        addedAt: existing.addedAt > 0 ? existing.addedAt : Date.now(),
      }
    } else {
      if (state.bookmarks.length >= BOOKMARKS_MAX_ENTRIES) {
        throw new BookmarksError('full', `最多只能收藏 ${String(BOOKMARKS_MAX_ENTRIES)} 个地址；请先删除一些收藏`)
      }
      state.bookmarks.unshift({ ...incoming, id: createId(state.bookmarks), addedAt: Date.now() })
      created = true
    }
    state.updatedAt = Date.now()
    await writeBookmarks(workspace, state)
    return { ...snapshot(state), path: bookmarksFile(workspace), created }
  })
}

/**
 * Remove one bookmark by id. Removing an unknown id is a no-op so two panels
 * deleting the same row stay consistent.
 *
 * @param root - absolute workspace root.
 * @param id - bookmark id.
 * @returns the refreshed snapshot plus `removed`.
 */
export async function removeBookmark(root, id) {
  const workspace = assertRoot(root)
  if (typeof id !== 'string' || id.length === 0) {
    throw new BookmarksError('bad-id', '收藏标识无效')
  }
  return withMutationLock(workspace, async () => {
    const state = await readBookmarks(workspace)
    const next = state.bookmarks.filter((item) => item.id !== id)
    const removed = next.length !== state.bookmarks.length
    state.bookmarks = next
    if (removed) {
      state.updatedAt = Date.now()
      await writeBookmarks(workspace, state)
    }
    return { ...snapshot(state), path: bookmarksFile(workspace), removed }
  })
}

/**
 * Save the start page's protocol/host preferences.
 *
 * These live in the same workspace document as the bookmarks so the port
 * shortcuts survive a browser-data wipe or an origin change.
 *
 * @param root - absolute workspace root.
 * @param input - `{ scheme?, host? }`.
 * @returns the refreshed snapshot.
 */
export async function saveSettings(root, input) {
  const workspace = assertRoot(root)
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new BookmarksError('bad-settings', '协议/主机设置无效')
  }
  const settings = normalizeSettings(input)
  return withMutationLock(workspace, async () => {
    const state = await readBookmarks(workspace)
    state.settings = settings
    state.updatedAt = Date.now()
    await writeBookmarks(workspace, state)
    return { ...snapshot(state), path: bookmarksFile(workspace) }
  })
}

/** Generate a short id that is unique within one document. */
function createId(bookmarks) {
  const used = new Set(bookmarks.map((item) => item.id))
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const id = randomUUID().replaceAll('-', '').slice(0, 12)
    if (!used.has(id)) return id
  }
  throw new BookmarksError('full', '无法生成新的收藏标识，请稍后重试')
}
