/**
 * Workspace change watcher: a bounded, owner-authenticated long poll that tells
 * the browser which expanded directories changed.
 *
 * The file tree used to re-list every expanded directory on a five-second timer.
 * This manager keeps one `fs.watch` handle per requested directory (the client
 * sends its expanded set), coalesces bursts, and answers a waiting request as
 * soon as anything changes. It is deliberately not recursive: watching a whole
 * repository (including `node_modules`) would exhaust inotify watches, so the
 * client's expanded directories and the root are the only watched paths.
 *
 * SSH roots are not watched (the files are on another host); they answer an
 * empty change set and the client keeps its polling fallback.
 */

import { watch as fsWatch } from 'node:fs'
import path from 'node:path'

const MAX_DIRS = 96
const MAX_WAIT = 10_000
const IDLE_MS = 5 * 60 * 1000

class WatchError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'WatchError'
    this.code = code
  }
}

/**
 * Create the watcher manager bound to one Host context.
 * @param options.resolveRoot - validates and canonicalizes a workspace root.
 */
export function createWatchManager({ resolveRoot }) {
  /** root -> { watchers: Map<absDir, {watcher, rel}>, changed: Set<rel>, waiters: Set, lastTouch: number } */
  const roots = new Map()
  const sweeper = setInterval(() => {
    const now = Date.now()
    for (const [root, state] of roots) {
      if (now - state.lastTouch <= IDLE_MS) continue
      closeRoot(state)
      roots.delete(root)
    }
  }, 60_000)
  sweeper.unref?.()

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
      if (body.op !== 'wait') throw new WatchError('bad-op', `未知的监听操作：${body.op}`)
      return json({ ok: true, value: await wait(body) })
    } catch (error) {
      if (error instanceof WatchError) return json({ ok: false, error: { code: error.code, message: error.message } })
      if (error !== null && typeof error === 'object' && typeof error.sideCode === 'string') {
        return json({ ok: false, error: { code: error.sideCode, message: error.message } })
      }
      console.error('dsh-web-filebrowser-watch: request failed', error)
      return json({ ok: false, error: { code: 'internal', message: error instanceof Error ? error.message : String(error) } })
    }
  }

  /**
   * Watch the requested directories and answer when something changes.
   * @param body - `{ root, dirs?: string[], wait?: number }`.
   * @returns `{ paths: string[], next: number }` where paths are changed dirs.
   */
  async function wait(body) {
    const root = await resolveRoot(typeof body.root === 'string' ? body.root : '')
    if (typeof root !== 'string' || root.startsWith('ssh://')) return { paths: [], next: Date.now(), ssh: true }
    const state = ensureRoot(root)
    state.lastTouch = Date.now()
    const requested = Array.isArray(body.dirs) ? body.dirs.filter((entry) => typeof entry === 'string') : []
    syncWatchers(root, state, ['', ...requested])
    if (state.changed.size > 0) return takeChanges(root, state)
    const requestedWait = Number(body.wait)
    const waitMs = Number.isFinite(requestedWait) ? Math.min(MAX_WAIT, Math.max(0, Math.floor(requestedWait))) : 0
    if (waitMs <= 0) return takeChanges(root, state)
    await new Promise((resolve) => {
      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        state.waiters.delete(finish)
        resolve()
      }
      const timer = setTimeout(finish, waitMs)
      timer.unref?.()
      state.waiters.add(finish)
    })
    state.lastTouch = Date.now()
    return takeChanges(root, state)
  }

  /** Create or fetch the watcher state for one workspace root. */
  function ensureRoot(root) {
    let state = roots.get(root)
    if (state !== undefined) return state
    state = { watchers: new Map(), changed: new Set(), waiters: new Set(), lastTouch: Date.now() }
    roots.set(root, state)
    return state
  }

  /** Add watchers for every requested dir that is not watched yet. */
  function syncWatchers(root, state, requested) {
    const seen = new Set()
    for (const rel of requested) {
      if (seen.size >= MAX_DIRS) break
      const key = rel === '' ? '' : path.normalize(rel)
      if (key.startsWith('..') || path.isAbsolute(key)) continue
      if (seen.has(key)) continue
      seen.add(key)
      const abs = key === '' ? root : path.join(root, key)
      if (state.watchers.has(abs)) continue
      try {
        const watcher = fsWatch(abs, { persistent: false }, () => markChanged(state, abs, root))
        watcher.on('error', () => {
          try {
            watcher.close()
          } catch {
            /* already closed */
          }
          state.watchers.delete(abs)
        })
        state.watchers.set(abs, { watcher, rel: key })
      } catch {
        /* a directory that disappeared or cannot be watched is skipped */
      }
    }
  }

  /** Record one changed directory (its owning relative path) and wake waiters. */
  function markChanged(state, abs, root) {
    const entry = state.watchers.get(abs)
    const rel = entry === undefined ? '' : entry.rel
    state.changed.add(rel)
    if (state.changed.size > 128) state.changed.delete(state.changed.values().next().value)
    for (const finish of [...state.waiters]) finish()
  }

  /** Drain and return the changed relative paths for one root. */
  function takeChanges(root, state) {
    const paths = [...state.changed]
    state.changed.clear()
    return { paths, next: Date.now(), ssh: false }
  }

  /** Close every watcher for one root. */
  function closeRoot(state) {
    for (const { watcher } of state.watchers.values()) {
      try {
        watcher.close()
      } catch {
        /* best effort */
      }
    }
    state.watchers.clear()
    for (const finish of [...state.waiters]) finish()
  }

  /** Stop every watcher and the idle sweeper. */
  function closeAll() {
    clearInterval(sweeper)
    for (const state of roots.values()) closeRoot(state)
    roots.clear()
  }

  return { handle, closeAll }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}
