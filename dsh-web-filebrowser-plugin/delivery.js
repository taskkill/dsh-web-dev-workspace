/**
 * Delivery packaging for the file browser.
 *
 * The owner hands a customer the build output together with an acceptance
 * report. This module zips a workspace's build output (plus an optional
 * `ACCEPTANCE.md`) without adding a single dependency: ZIP writing is done with
 * Node's built-in `zlib` raw DEFLATE only.
 *
 * Archive layout follows the classic ZIP format:
 * - local file header with the final CRC-32, sizes and method (no data
 *   descriptor, so every header is complete before its data);
 * - central directory entries carrying the Unix mode in the external
 *   attributes field;
 * - end of central directory record.
 * File names are UTF-8 and set general purpose flag bit 11; directory entries
 * end with `/`. ZIP64 is deliberately unsupported: the archive is rejected
 * when it would need more than 65535 entries or offsets above 4 GiB.
 *
 * Memory stays bounded: each entry is streamed twice — a measuring pass
 * (CRC-32 and deflated size) and a writing pass — so only one entry's chunk
 * buffers are in flight at a time and the archive itself is never buffered in
 * memory. A file that changes between the two passes aborts the stream instead
 * of producing a silently corrupt archive.
 *
 * Confinement: the root is canonicalised with `realpath`, every target must be
 * a workspace-relative path (no absolute paths and no `..`), directory symlinks
 * are never followed, and every collected file is `realpath`-checked to live
 * inside the root. `node_modules`, `.git` and `.dsh` are skipped while walking.
 *
 * `include` / `exclude` accept a simple glob subset: `*` matches inside one
 * path segment, `**` crosses segments, `?` matches one non-separator
 * character. Patterns are matched against the root-relative `/`-separated path;
 * a pattern without `/` is also matched against the file basename. An empty
 * `include` means "everything", `exclude` wins over `include`, and files
 * filtered out by these patterns are not listed in the returned `skipped`
 * array (so the report stays bounded).
 */

import { createHash } from 'node:crypto'
import { once } from 'node:events'
import { createReadStream, createWriteStream, promises as fsp } from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createDeflateRaw } from 'node:zlib'
import { resolveAgentWorkspace } from './memory.js'
import { isSshRoot } from './ssh.js'

/** Build-output directories packaged by default, in preference order. */
export const DELIVERY_DEFAULT_TARGETS = ['dist', 'build', 'out', '.output', 'public']

/** Directories never walked while collecting delivery files. */
const SKIP_DIRECTORIES = new Set(['node_modules', '.git', '.dsh'])

/** Plugin-owned state directory; delivery bundles live below it. */
const DELIVERY_DIRNAME = '.dsh'

/** Sub-directory of the plugin state directory used for exported bundles. */
const DELIVERY_BUNDLE_DIRNAME = 'deliveries'

/** Report file name used when an acceptance report is supplied. */
const REPORT_FILENAME = 'ACCEPTANCE.md'

/** Delivery history file written by the acceptance panel (index.js). */
const DELIVERY_HISTORY_FILENAME = 'deliveries.json'

/** Newest delivery records kept by the panel and the read-only tool. */
const DELIVERY_HISTORY_MAX = 100

/** Workspace-relative evidence directory used by acceptance items. */
export const EVIDENCE_DIR_RELATIVE = '.dsh/evidence'

/** Largest single evidence file packaged into a delivery bundle. */
export const EVIDENCE_FILE_MAX_BYTES = 20 * 1024 * 1024

/** Largest total evidence payload packaged into a delivery bundle. */
export const EVIDENCE_TOTAL_MAX_BYTES = 200 * 1024 * 1024

/** Largest single in-memory extra file accepted by `writeDeliveryBundle`. */
const MAX_EXTRA_FILE_BYTES = 128 * 1024 * 1024

/** Largest total in-memory extra payload accepted by `writeDeliveryBundle`. */
const MAX_EXTRA_TOTAL_BYTES = 256 * 1024 * 1024

/** File count cap (ZIP64 would be needed above the classic limits). */
const DEFAULT_MAX_FILES = 50000

/** Total uncompressed size cap: 2 GiB. */
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024 * 1024

/** Maximum number of skip records returned to the caller. */
const SKIP_REPORT_LIMIT = 2000

/** Maximum directory nesting accepted while walking; guards run-away trees. */
const MAX_WALK_DEPTH = 64

/** Read chunk size shared by the measuring and writing passes. */
const FILE_CHUNK_SIZE = 64 * 1024

/** DEFLATE level used for every entry. */
const DEFLATE_LEVEL = 6

/** ZIP signatures. */
const ZIP_LOCAL_SIGNATURE = 0x04034b50
const ZIP_CENTRAL_SIGNATURE = 0x02014b50
const ZIP_END_SIGNATURE = 0x06054b50

/** Extract version 2.0, made on Unix. */
const ZIP_VERSION_NEEDED = 20
const ZIP_VERSION_MADE_BY = 0x0314

/** General purpose flag bit 11: file name is UTF-8. */
const ZIP_FLAG_UTF8 = 0x0800

/** Compression methods. */
const ZIP_METHOD_STORE = 0
const ZIP_METHOD_DEFLATE = 8

/** Unix mode bits stored in the central directory external attributes. */
const ZIP_UNIX_FILE_MODE = 0o100644
const ZIP_UNIX_DIRECTORY_MODE = 0o040755

/** MS-DOS "directory" attribute bit. */
const DOS_DIRECTORY_ATTRIBUTE = 0x10

/** Largest value ZIP (without ZIP64) can store in a 32-bit offset/size field. */
const UINT32_MAX = 0xffffffff

/** Largest entry count the classic end of central directory can store. */
const UINT16_MAX = 0xffff

/** `/`-separator path of a POSIX-style relative path. */
const POSIX_SEPARATOR = '/'

/** Characters escaped when a glob literal becomes a regular expression. */
const REGEXP_SPECIAL = /[\\^$.*+?()[\]{}|]/u

/** A structured, caller-facing failure with a stable machine code. */
export class DeliveryError extends Error {
  /**
   * @param code - stable machine-readable code.
   * @param message - human-readable explanation.
   */
  constructor(code, message) {
    super(message)
    this.name = 'DeliveryError'
    this.code = code
    // The Host request handler maps this field onto the API error envelope.
    this.sideCode = code
  }
}

/** Pre-computed CRC-32 lookup table (polynomial 0xEDB88320). */
const CRC_TABLE = buildCrcTable()

/**
 * One record returned in a `skipped` list.
 * @typedef {{ path: string, reason: string }} DeliverySkip
 */

/**
 * Collect the files that make up one workspace's delivery archive.
 *
 * Without explicit `targets`, the existing entries of
 * `DELIVERY_DEFAULT_TARGETS` are used; when none of them exist the call fails
 * with code `no-output`. Explicit targets that are missing, symlinked, or not
 * regular files are reported in `skipped` instead of failing the whole export.
 * The call also fails with `no-output` when the walk ends without any file, so
 * an empty archive is never returned. `skipped` holds `{ path, reason }`
 * records, capped at `SKIP_REPORT_LIMIT`; files filtered out by `include` /
 * `exclude` are not listed there.
 *
 * @param root - absolute workspace root.
 * @param options - `{ targets, include, exclude, maxFiles, maxBytes }`.
 * @returns `{ entries, totalBytes, skipped }`; entries are sorted by path.
 */
export async function collectDeliveryEntries(root, options = {}) {
  const workspace = await assertRoot(root)
  const settings = options ?? {}
  const maxFiles = readPositiveInteger(settings.maxFiles, DEFAULT_MAX_FILES, 'maxFiles')
  const maxBytes = readPositiveInteger(settings.maxBytes, DEFAULT_MAX_BYTES, 'maxBytes')
  const includeRules = compileRules(settings.include, 'include')
  const excludeRules = compileRules(settings.exclude, 'exclude')
  const skipped = []
  const entries = []
  const seen = new Set()
  let totalBytes = 0

  /** Stat one explicit target without following symlinks. */
  const describeTarget = async (relativePath) => {
    const segments = relativePath.split(POSIX_SEPARATOR)
    if (segments.some((segment) => SKIP_DIRECTORIES.has(segment))) {
      addSkip(skipped, relativePath, 'excluded-directory')
      return null
    }
    const absolute = path.join(workspace, ...segments)
    if (!isInside(workspace, absolute)) throw new DeliveryError('bad-target', `Target escapes the workspace: ${relativePath}`)
    let info
    try {
      info = await fsp.lstat(absolute)
    } catch (error) {
      if (error?.code === 'ENOENT') {
        addSkip(skipped, relativePath, 'missing')
        return null
      }
      addSkip(skipped, relativePath, 'unreadable')
      return null
    }
    if (info.isSymbolicLink()) {
      addSkip(skipped, relativePath, 'symlink')
      return null
    }
    if (!info.isDirectory() && !info.isFile()) {
      addSkip(skipped, relativePath, 'not-file')
      return null
    }
    return { absolute, info }
  }

  /** Add one regular file after glob filtering and root confinement checks. */
  const addFile = async (relativePath, absolutePath) => {
    if (seen.has(relativePath)) return
    if (includeRules.length > 0 && !matchesAnyRule(includeRules, relativePath)) return
    if (matchesAnyRule(excludeRules, relativePath)) return
    let real
    try {
      real = await fsp.realpath(absolutePath)
    } catch {
      addSkip(skipped, relativePath, 'unreadable')
      return
    }
    if (!isInside(workspace, real)) {
      addSkip(skipped, relativePath, 'outside-root')
      return
    }
    let info
    try {
      info = await fsp.stat(real)
    } catch {
      addSkip(skipped, relativePath, 'unreadable')
      return
    }
    if (!info.isFile()) {
      addSkip(skipped, relativePath, 'not-file')
      return
    }
    if (Buffer.byteLength(relativePath, 'utf8') > UINT16_MAX) {
      addSkip(skipped, relativePath, 'name-too-long')
      return
    }
    if (entries.length >= maxFiles) {
      throw new DeliveryError('too-many-files', `Delivery contains more than ${maxFiles} files; reduce targets or raise maxFiles`)
    }
    if (totalBytes + info.size > maxBytes) {
      throw new DeliveryError('too-large', `Delivery exceeds ${maxBytes} bytes; reduce targets or raise maxBytes`)
    }
    seen.add(relativePath)
    entries.push({ path: relativePath, absPath: real, size: info.size, mtime: info.mtime })
    totalBytes += info.size
  }

  /** Walk one real directory without following symlinks. */
  const walk = async (relativeDir, absoluteDir, depth) => {
    let children
    try {
      children = await fsp.readdir(absoluteDir, { withFileTypes: true })
    } catch {
      addSkip(skipped, relativeDir, 'unreadable')
      return
    }
    children.sort((left, right) => compareNames(left.name, right.name))
    for (const child of children) {
      const relativePath = relativeDir.length > 0 ? `${relativeDir}${POSIX_SEPARATOR}${child.name}` : child.name
      const absolutePath = path.join(absoluteDir, child.name)
      if (child.isSymbolicLink()) {
        addSkip(skipped, relativePath, 'symlink')
        continue
      }
      if (child.isDirectory()) {
        if (SKIP_DIRECTORIES.has(child.name)) {
          addSkip(skipped, relativePath, 'excluded-directory')
          continue
        }
        if (depth >= MAX_WALK_DEPTH) {
          addSkip(skipped, relativePath, 'too-deep')
          continue
        }
        await walk(relativePath, absolutePath, depth + 1)
        continue
      }
      if (child.isFile()) {
        await addFile(relativePath, absolutePath)
        continue
      }
      addSkip(skipped, relativePath, 'not-file')
    }
  }

  let targets
  const noExplicitTargets =
    settings.targets === undefined ||
    settings.targets === null ||
    (Array.isArray(settings.targets) && settings.targets.length === 0)
  if (noExplicitTargets) {
    const present = []
    for (const name of DELIVERY_DEFAULT_TARGETS) {
      const absolute = path.join(workspace, name)
      let info
      try {
        info = await fsp.lstat(absolute)
      } catch {
        continue
      }
      if (info.isSymbolicLink()) {
        addSkip(skipped, name, 'symlink')
        continue
      }
      if (info.isFile() || info.isDirectory()) present.push({ name, info })
    }
    if (present.length === 0) {
      throw new DeliveryError('no-output', `No build output found; expected one of ${DELIVERY_DEFAULT_TARGETS.join(', ')}`)
    }
    targets = present.map((item) => item.name)
    for (const target of present) {
      if (target.info.isDirectory()) await walk(target.name, path.join(workspace, target.name), 1)
      else await addFile(target.name, path.join(workspace, target.name))
    }
  } else {
    targets = normalizeTargets(settings.targets)
    for (const target of targets) {
      const described = await describeTarget(target)
      if (described === null) continue
      if (described.info.isDirectory()) await walk(target, described.absolute, 1)
      else await addFile(target, described.absolute)
    }
  }

  if (entries.length === 0) {
    throw new DeliveryError('no-output', `No delivery files found under ${targets.join(', ')}`)
  }
  entries.sort((left, right) => compareNames(left.path, right.path))
  return { entries, totalBytes, skipped }
}

/**
 * Build a ZIP stream for already collected entries.
 *
 * Directory entries are synthesised for every parent path, file names are
 * validated and de-duplicated, and entries are emitted in sorted order.
 * In-memory entries (`{ path, data }`) are supported for small extra files such
 * as the acceptance report; file entries use `absPath`.
 *
 * Each file is read twice (measure, then write) so the local header can carry
 * the final sizes and CRC-32 without a data descriptor. Entries that cannot be
 * opened or read during the measuring pass are skipped and appended to
 * `stream.skipped` (same `{ path, reason }` shape as the collector); an entry
 * that fails during the writing pass destroys the stream because the archive
 * can no longer be completed correctly.
 *
 * @param entries - collected delivery entries.
 * @returns Readable stream of ZIP bytes with an extra `skipped` array.
 */
export function createZipStream(entries) {
  const skipped = []
  const items = buildArchiveItems(entries, skipped)
  const stream = Readable.from(generateArchive(items, skipped), { objectMode: false })
  stream.skipped = skipped
  return stream
}

/**
 * Collect the default delivery files and return a ZIP stream for them.
 *
 * `fileCount` and `totalBytes` describe the collected entries; a file that
 * disappears before the write pass is added to `skipped` and left out of the
 * archive.
 *
 * @param root - absolute workspace root.
 * @param options - `{ targets, include, exclude, maxFiles, maxBytes }`.
 * @returns `{ readStream, filename, fileCount, totalBytes, skipped }`.
 */
export async function buildDeliveryZip(root, options = {}) {
  const workspace = await assertRoot(root)
  const collected = await collectDeliveryEntries(workspace, options ?? {})
  const readStream = createZipStream(collected.entries)
  const skipped = readStream.skipped
  skipped.unshift(...collected.skipped)
  return {
    readStream,
    filename: deliveryFilename(workspace),
    fileCount: collected.entries.length,
    totalBytes: collected.totalBytes,
    skipped,
  }
}

/**
 * Write a downloadable delivery bundle to disk.
 *
 * The optional `reportMarkdown` becomes `ACCEPTANCE.md` at the archive root.
 * `extraFiles` appends in-memory files (for example acceptance evidence read by
 * the caller) at their workspace-relative archive paths; the acceptance report
 * can therefore link `.dsh/evidence/<name>` and the same path exists inside the
 * archive. Without `outputPath` the bundle is written to
 * `<root>/.dsh/deliveries/<basename>-delivery-<yyyyMMdd-HHmm>.zip`; an explicit
 * `outputPath` may name the deliveries directory or a file inside it (a
 * directory gets an automatic file name), and it can never escape that
 * directory so an export cannot overwrite workspace sources.
 *
 * @param root - absolute workspace root.
 * @param options - `{ outputPath, reportMarkdown, extraFiles, targets, include,
 *   exclude, maxFiles, maxBytes }`.
 * @returns `{ path, bytes, fileCount }`.
 */
export async function writeDeliveryBundle(root, options = {}) {
  const workspace = await assertRoot(root)
  const settings = options ?? {}
  const hasReport = typeof settings.reportMarkdown === 'string' && settings.reportMarkdown.length > 0
  let collected = { entries: [], totalBytes: 0, skipped: [] }
  try {
    collected = await collectDeliveryEntries(workspace, {
      targets: settings.targets,
      include: settings.include,
      exclude: settings.exclude,
      maxFiles: settings.maxFiles,
      maxBytes: settings.maxBytes,
    })
  } catch (error) {
    // A report-only delivery is still useful when no build output exists.
    if (!(hasReport && error instanceof DeliveryError && error.code === 'no-output')) throw error
  }
  const entries = collected.entries.slice()
  if (hasReport) {
    const report = Buffer.from(settings.reportMarkdown, 'utf8')
    entries.push({ path: REPORT_FILENAME, data: report, size: report.length, mtime: new Date() })
  }
  for (const extra of normalizeExtraFiles(settings.extraFiles)) {
    if (extra.path === REPORT_FILENAME) {
      throw new DeliveryError('bad-entries', `extraFiles may not override ${REPORT_FILENAME}`)
    }
    entries.push(extra)
  }
  const target = await resolveBundlePath(workspace, settings.outputPath)
  try {
    await fsp.mkdir(path.dirname(target), { recursive: true })
  } catch {
    throw new DeliveryError('write-failed', `Cannot create the delivery directory: ${path.dirname(target)}`)
  }
  const realParent = await fsp.realpath(path.dirname(target))
  if (!isInside(workspace, realParent)) {
    throw new DeliveryError('outside-root', 'Delivery bundle destination escapes the workspace')
  }
  const finalPath = path.join(realParent, path.basename(target))
  try {
    const existing = await fsp.lstat(finalPath)
    if (existing.isSymbolicLink()) {
      throw new DeliveryError('bad-output', 'Delivery bundle destination must not be a symbolic link')
    }
  } catch (error) {
    if (error instanceof DeliveryError) throw error
    if (error?.code !== 'ENOENT') throw error
  }
  const readStream = createZipStream(entries)
  try {
    await pipeline(readStream, createWriteStream(finalPath))
  } catch (error) {
    await fsp.rm(finalPath, { force: true }).catch(() => {})
    throw error
  }
  const info = await fsp.stat(finalPath).catch(() => {
    throw new DeliveryError('write-failed', `Delivery bundle was not written: ${finalPath}`)
  })
  return { path: finalPath, bytes: info.size, fileCount: entries.length }
}

/**
 * Hash one file with SHA-256, e.g. to publish a delivery checksum.
 *
 * @param filename - absolute path of the file to hash.
 * @returns hexadecimal digest.
 */
export async function sha256File(filename) {
  if (typeof filename !== 'string' || filename.length === 0 || filename.includes('\u0000')) {
    throw new DeliveryError('bad-path', 'File path must be a non-empty string')
  }
  const hash = createHash('sha256')
  await pipeline(createReadStream(filename), hash)
  return hash.digest('hex')
}

/** Normalise one in-memory archive entry appended by `writeDeliveryBundle`. */
function normalizeExtraFiles(value) {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) throw new DeliveryError('bad-option', 'extraFiles must be an array')
  const files = []
  const seen = new Set()
  let totalBytes = 0
  for (const item of value) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      throw new DeliveryError('bad-entries', 'Every extra file must be an object')
    }
    const name = normalizeZipName(item.path)
    if (name.endsWith(POSIX_SEPARATOR)) {
      throw new DeliveryError('bad-entries', `extraFiles entries must name files: ${name}`)
    }
    if (seen.has(name)) continue
    let data
    if (Buffer.isBuffer(item.data)) data = item.data
    else if (item.data instanceof Uint8Array) data = Buffer.from(item.data)
    else throw new DeliveryError('bad-entries', `extraFiles entry needs a Buffer: ${name}`)
    if (data.length > MAX_EXTRA_FILE_BYTES) {
      throw new DeliveryError('too-large', `Extra file exceeds ${MAX_EXTRA_FILE_BYTES} bytes: ${name}`)
    }
    totalBytes += data.length
    if (totalBytes > MAX_EXTRA_TOTAL_BYTES) {
      throw new DeliveryError('too-large', `Extra files exceed ${MAX_EXTRA_TOTAL_BYTES} bytes in total`)
    }
    seen.add(name)
    files.push({ path: name, data, size: data.length, mtime: item.mtime instanceof Date ? item.mtime : new Date() })
  }
  return files
}

/** Normalise one evidence path stored on an acceptance item, refusing escapes. */
function normalizeEvidenceRelativePath(value) {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (text.length === 0 || text.length > 500 || text.includes('\u0000') || text.includes('\\')) return null
  if (text.startsWith('/') || /^[A-Za-z]:\//u.test(text)) return null
  const segments = text.replace(/^\.\//u, '').split(POSIX_SEPARATOR)
  for (const segment of segments) {
    if (segment.length === 0 || segment === '.' || segment === '..') return null
  }
  return segments.join(POSIX_SEPARATOR)
}

/** Extract the evidence array from one acceptance item or document. */
function evidenceItemsFrom(value) {
  const source = Array.isArray(value) ? value : Array.isArray(value?.items) ? value.items : []
  const items = []
  for (const item of source) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) continue
    if (!Array.isArray(item.evidence)) continue
    items.push(item)
  }
  return items
}

/**
 * Read the evidence files referenced by acceptance items so they can be passed
 * to `writeDeliveryBundle({ extraFiles })`.
 *
 * Evidence entries whose kind is `url` (or whose path is an http(s) URL) are
 * skipped; workspace paths are confined to the root, symlinks and missing files
 * are reported in `skipped`, and per-file / total byte caps protect the archive.
 * Entries are flattened into the bundle `evidence/` directory, so the returned
 * `path` is archive-ready and matches the links in the generated acceptance
 * report (`evidence/<name>`); two sources with the same base name are reported
 * as `duplicate` instead of overwriting each other.
 *
 * @param root - absolute workspace root.
 * @param items - acceptance items or the acceptance document.
 * @param options - `{ maxFileBytes?, maxTotalBytes? }`.
 * @returns `{ entries, skipped, totalBytes }` where entries are extra-file
 *   records ready for `writeDeliveryBundle`.
 */
export async function collectEvidenceEntries(root, items, options = {}) {
  const workspace = await assertRoot(root)
  const settings = options ?? {}
  const maxFileBytes = readPositiveInteger(settings.maxFileBytes, EVIDENCE_FILE_MAX_BYTES, 'maxFileBytes')
  const maxTotalBytes = readPositiveInteger(settings.maxTotalBytes, EVIDENCE_TOTAL_MAX_BYTES, 'maxTotalBytes')
  const entries = []
  const skipped = []
  const seen = new Set()
  let totalBytes = 0
  for (const item of evidenceItemsFrom(items)) {
    for (const candidate of item.evidence) {
      if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) continue
      if (candidate.kind === 'url') continue
      if (typeof candidate.path !== 'string' || /^https?:\/\//iu.test(candidate.path.trim())) continue
      const relativePath = normalizeEvidenceRelativePath(candidate.path)
      if (relativePath === null) {
        addSkip(skipped, typeof candidate.path === 'string' ? candidate.path : '?', 'bad-path')
        continue
      }
      const archivePath = `evidence/${relativePath.split(POSIX_SEPARATOR).at(-1) ?? relativePath}`
      if (seen.has(archivePath)) {
        addSkip(skipped, relativePath, 'duplicate')
        continue
      }
      const absolute = path.join(workspace, ...relativePath.split(POSIX_SEPARATOR))
      if (!isInside(workspace, absolute)) {
        addSkip(skipped, relativePath, 'outside-root')
        continue
      }
      let info
      try {
        info = await fsp.lstat(absolute)
      } catch (error) {
        addSkip(skipped, relativePath, error?.code === 'ENOENT' ? 'missing' : 'unreadable')
        continue
      }
      if (info.isSymbolicLink()) {
        addSkip(skipped, relativePath, 'symlink')
        continue
      }
      if (!info.isFile()) {
        addSkip(skipped, relativePath, 'not-file')
        continue
      }
      let real
      try {
        real = await fsp.realpath(absolute)
      } catch {
        addSkip(skipped, relativePath, 'unreadable')
        continue
      }
      if (!isInside(workspace, real)) {
        addSkip(skipped, relativePath, 'outside-root')
        continue
      }
      let stat
      try {
        stat = await fsp.stat(real)
      } catch {
        addSkip(skipped, relativePath, 'unreadable')
        continue
      }
      if (stat.size > maxFileBytes) {
        addSkip(skipped, relativePath, 'too-large')
        continue
      }
      if (totalBytes + stat.size > maxTotalBytes) {
        addSkip(skipped, relativePath, 'total-too-large')
        continue
      }
      let data
      try {
        data = await fsp.readFile(real)
      } catch {
        addSkip(skipped, relativePath, 'unreadable')
        continue
      }
      entries.push({ path: archivePath, data, size: data.length, mtime: stat.mtime })
      seen.add(archivePath)
      totalBytes += data.length
    }
  }
  return { entries, skipped, totalBytes }
}

/** Normalise one delivery history record read from `.dsh/deliveries.json`. */
function normalizeDeliveryRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const name = typeof value.name === 'string' ? value.name.trim() : ''
  if (name.length === 0) return null
  return {
    id: typeof value.id === 'string' ? value.id : '',
    name,
    relative: typeof value.relative === 'string' ? value.relative : '',
    bytes: Number.isFinite(value.bytes) ? Math.floor(value.bytes) : 0,
    fileCount: Number.isFinite(value.fileCount) ? Math.floor(value.fileCount) : 0,
    createdAt: Number.isFinite(value.createdAt) ? Math.floor(value.createdAt) : 0,
    hasReport: value.hasReport === true,
  }
}

/**
 * Read the workspace delivery history (newest first), tolerating a missing or
 * corrupt `.dsh/deliveries.json` by returning an empty list.
 *
 * @param root - absolute workspace root.
 * @param options - `{ limit? }` newest records to return (default 20, max 100).
 * @returns `{ deliveries, total }`.
 */
export async function listDeliveryHistory(root, options = {}) {
  const workspace = await assertRoot(root)
  const limit = readHistoryLimit(options?.limit)
  const file = path.join(workspace, DELIVERY_DIRNAME, DELIVERY_HISTORY_FILENAME)
  let parsed
  try {
    parsed = JSON.parse(await fsp.readFile(file, 'utf8'))
  } catch {
    return { deliveries: [], total: 0 }
  }
  const source = Array.isArray(parsed?.deliveries) ? parsed.deliveries : []
  const deliveries = []
  for (const candidate of source) {
    const record = normalizeDeliveryRecord(candidate)
    if (record !== null) deliveries.push(record)
  }
  return { deliveries: deliveries.slice(0, limit), total: deliveries.length }
}

/** Read one history `limit` option for the read-only tool. */
function readHistoryLimit(value) {
  if (value === undefined || value === null) return 20
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new DeliveryError('bad-option', 'limit must be a positive integer')
  }
  return Math.min(value, DELIVERY_HISTORY_MAX)
}

/** Resolve the workspace for a delivery tool call, with SSH/no-workspace errors. */
function deliveryToolWorkspace(ctx, exec) {
  const root = resolveAgentWorkspace(ctx, exec.agent)
  if (root === null) {
    throw new Error('The workspace delivery history is unavailable because this session has no workspace directory.')
  }
  if (isSshRoot(root) || isSshRoot(exec.agent?.session?.meta?.cwd)) {
    throw new DeliveryError(
      'ssh-unsupported',
      'SSH remote workspaces have no local delivery history (.dsh/deliveries.json); use a local workspace instead.',
    )
  }
  return root
}

/** Render the delivery history for one tool result. */
function renderDeliveryHistory(value) {
  if (value.total === 0) return `No delivery bundles recorded for ${value.scope}.`
  const lines = value.deliveries.map((record) => {
    const when = record.createdAt > 0 ? new Date(record.createdAt).toISOString() : '—'
    const report = record.hasReport ? 'with report' : 'no report'
    return `- ${record.name} · ${String(record.bytes)} bytes · ${String(record.fileCount)} files · ${when} · ${report}`
  })
  const omitted = value.total - value.deliveries.length
  const suffix = omitted > 0 ? `\n(${String(omitted)} older records are not shown; raise limit to list more.)` : ''
  return `Delivery bundles recorded for ${value.scope}: ${String(value.total)} total\n${lines.join('\n')}${suffix}`
}

/** Registry-ready schema for one delivery history record. */
const DELIVERY_RECORD_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    relative: { type: 'string' },
    bytes: { type: 'integer' },
    fileCount: { type: 'integer' },
    createdAt: { type: 'integer' },
    hasReport: { type: 'boolean' },
  },
  required: ['name', 'bytes', 'fileCount', 'createdAt', 'hasReport'],
}

/**
 * Register the read-only delivery tool. Registration is skipped when the Host
 * context has no tool registry, so the module still works for plain bundling.
 *
 * @param ctx - context providing `tools`.
 * @returns disposer for the registered tool.
 */
export function registerDeliveryTools(ctx) {
  const disposers = []
  const register = (definition) => {
    try {
      const dispose = ctx.tools.register(definition)
      if (typeof dispose === 'function') disposers.push(dispose)
    } catch (error) {
      ctx.logger?.warn?.('dsh-web-filebrowser: failed to register a delivery tool', error)
    }
  }

  register({
    name: 'delivery_history',
    description:
      'List the delivery bundles recorded for this workspace in .dsh/deliveries.json (newest first) — name, size, file count, timestamp and whether the acceptance report was included. Read-only: use it before re-sending a client hand-off, not to create a bundle.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        limit: { type: 'integer', description: 'Newest records to return (default 20, maximum 100).' },
      },
      required: [],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          deliveries: { type: 'array', items: DELIVERY_RECORD_SCHEMA },
          total: { type: 'integer' },
          scope: { type: 'string' },
        },
        required: ['deliveries', 'total', 'scope'],
      },
      render: (_args, value) => [{ type: 'text', text: renderDeliveryHistory(value) }],
    },
    async execute(args, exec) {
      exec.signal.throwIfAborted()
      const root = deliveryToolWorkspace(ctx, exec)
      const limit = readHistoryLimit(args?.limit)
      const result = await listDeliveryHistory(root, { limit })
      exec.signal.throwIfAborted()
      return { deliveries: result.deliveries, total: result.total, scope: root }
    },
  })

  return () => {
    for (const dispose of disposers.splice(0)) dispose()
  }
}

/** Canonicalise and validate one absolute workspace root. */
async function assertRoot(root) {
  if (typeof root !== 'string' || root.length === 0 || root.includes('\u0000')) {
    throw new DeliveryError('bad-root', 'Workspace root must be a non-empty absolute path')
  }
  if (!path.isAbsolute(root)) throw new DeliveryError('bad-root', `Workspace root must be absolute: ${root}`)
  let real
  try {
    real = await fsp.realpath(root)
  } catch {
    throw new DeliveryError('bad-root', `Workspace root does not exist: ${root}`)
  }
  let info
  try {
    info = await fsp.stat(real)
  } catch {
    throw new DeliveryError('bad-root', `Workspace root is not accessible: ${root}`)
  }
  if (!info.isDirectory()) throw new DeliveryError('bad-root', `Workspace root is not a directory: ${root}`)
  return real
}

/** Normalise explicit delivery targets into safe `/`-separated paths. */
function normalizeTargets(targets) {
  const list = Array.isArray(targets) ? targets : [targets]
  if (list.length === 0) {
    throw new DeliveryError('bad-target', 'targets must be a non-empty array of workspace-relative paths')
  }
  const normalized = []
  const seen = new Set()
  for (const value of list) {
    if (typeof value !== 'string') throw new DeliveryError('bad-target', 'Every target must be a string')
    if (value.includes('\u0000')) throw new DeliveryError('bad-target', 'Target contains a NUL byte')
    if (path.isAbsolute(value) || /^[A-Za-z]:[\\/]/u.test(value)) {
      throw new DeliveryError('bad-target', `Target must be workspace-relative: ${value}`)
    }
    const trimmed = value.replace(/^\.\//u, '').replace(/\/+$/u, '')
    if (trimmed.length === 0) throw new DeliveryError('bad-target', 'Target must name a directory or file inside the workspace')
    const segments = trimmed.split(POSIX_SEPARATOR)
    for (const segment of segments) {
      if (segment.length === 0 || segment === '.' || segment === '..' || segment.includes('\\')) {
        throw new DeliveryError('bad-target', `Invalid target path: ${value}`)
      }
    }
    const cleaned = segments.join(POSIX_SEPARATOR)
    if (seen.has(cleaned)) continue
    seen.add(cleaned)
    normalized.push(cleaned)
  }
  return normalized
}

/** Read an optional positive integer cap. */
function readPositiveInteger(value, fallback, name) {
  if (value === undefined || value === null) return fallback
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new DeliveryError('bad-option', `${name} must be a positive integer`)
  }
  return value
}

/** Append one bounded skip record. */
function addSkip(skipped, relativePath, reason) {
  if (skipped.length >= SKIP_REPORT_LIMIT) return
  skipped.push({ path: relativePath, reason })
}

/** Normalise `include` / `exclude` options into compiled rules. */
function compileRules(value, name) {
  if (value === undefined || value === null || value === '') return []
  const list = Array.isArray(value) ? value : [value]
  const rules = []
  for (const item of list) {
    if (typeof item !== 'string') throw new DeliveryError('bad-option', `${name} must contain glob strings`)
    const pattern = item.trim().replaceAll('\\', '/').replace(/^\.\//u, '')
    if (pattern.length === 0) continue
    rules.push({ hasSeparator: pattern.includes(POSIX_SEPARATOR), regex: globToRegExp(pattern) })
  }
  return rules
}

/** Convert the supported glob subset into an anchored regular expression. */
function globToRegExp(pattern) {
  let source = ''
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index]
    if (char === '*') {
      if (pattern[index + 1] === '*') {
        // `**/` matches any number of leading directories, plain `**` crosses separators.
        if (pattern[index + 2] === POSIX_SEPARATOR) {
          source += '(?:.*/)?'
          index += 2
          continue
        }
        source += '.*'
        index += 1
        continue
      }
      source += '[^/]*'
      continue
    }
    if (char === '?') {
      source += '[^/]'
      continue
    }
    source += REGEXP_SPECIAL.test(char) ? `\\${char}` : char
  }
  return new RegExp(`^${source}$`, 'u')
}

/** Whether one root-relative path matches any compiled rule. */
function matchesAnyRule(rules, relativePath) {
  if (rules.length === 0) return false
  const base = path.posix.basename(relativePath)
  return rules.some((rule) => rule.regex.test(relativePath) || (!rule.hasSeparator && rule.regex.test(base)))
}

/** Compare two `/`-separated names by code point for a stable archive order. */
function compareNames(left, right) {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

/** Whether `candidate` is `root` or one of its descendants. */
function isInside(root, candidate) {
  return candidate === root || candidate.startsWith(root.endsWith(path.sep) ? root : `${root}${path.sep}`)
}

/** Flatten collected entries into sorted archive items, adding directories. */
function buildArchiveItems(entries, skipped) {
  if (!Array.isArray(entries)) throw new DeliveryError('bad-entries', 'entries must be an array')
  const files = []
  const filePaths = new Set()
  const directories = new Map()
  for (const entry of entries) {
    if (entry === null || typeof entry !== 'object') throw new DeliveryError('bad-entries', 'Every entry must be an object')
    const name = normalizeZipName(entry.path)
    const mtime = entry.mtime ?? new Date()
    if (name.endsWith(POSIX_SEPARATOR)) {
      directories.set(name.slice(0, -1), mtime)
      continue
    }
    const hasData = Buffer.isBuffer(entry.data) || entry.data instanceof Uint8Array
    if (!hasData && (typeof entry.absPath !== 'string' || !path.isAbsolute(entry.absPath))) {
      throw new DeliveryError('bad-entries', `Entry needs an absolute absPath or a data buffer: ${name}`)
    }
    if (filePaths.has(name)) {
      addSkip(skipped, name, 'duplicate')
      continue
    }
    filePaths.add(name)
    files.push({ name, entry, mtime })
    const segments = name.split(POSIX_SEPARATOR)
    for (let index = 1; index < segments.length; index += 1) {
      const directory = segments.slice(0, index).join(POSIX_SEPARATOR)
      if (!directories.has(directory)) directories.set(directory, mtime)
    }
  }
  const items = []
  for (const [name, mtime] of directories) {
    items.push({ name: `${name}${POSIX_SEPARATOR}`, directory: true, mtime })
  }
  for (const file of files) items.push({ name: file.name, directory: false, entry: file.entry, mtime: file.mtime })
  items.sort((left, right) => compareNames(left.name, right.name))
  if (items.length > UINT16_MAX) {
    throw new DeliveryError('too-many-files', `ZIP without ZIP64 supports at most ${UINT16_MAX} entries; reduce the delivery file count`)
  }
  return items
}

/** Validate one archive entry name and return its `/`-separated form. */
function normalizeZipName(value) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new DeliveryError('bad-entries', 'Every entry needs a non-empty path')
  }
  if (value.includes('\u0000')) throw new DeliveryError('bad-entries', 'Archive entry path contains a NUL byte')
  const name = value.replaceAll('\\', '/')
  if (name.startsWith(POSIX_SEPARATOR) || /^[A-Za-z]:\//u.test(name)) {
    throw new DeliveryError('bad-entries', `Archive entry path must be relative: ${value}`)
  }
  const isDirectory = name.endsWith(POSIX_SEPARATOR)
  const trimmed = isDirectory ? name.slice(0, -1) : name
  const segments = trimmed.split(POSIX_SEPARATOR)
  for (const segment of segments) {
    if (segment.length === 0 || segment === '.' || segment === '..') {
      throw new DeliveryError('bad-entries', `Invalid archive entry path: ${value}`)
    }
  }
  const normalized = segments.join(POSIX_SEPARATOR)
  if (Buffer.byteLength(normalized, 'utf8') + (isDirectory ? 1 : 0) > UINT16_MAX) {
    throw new DeliveryError('bad-entries', `Archive entry path is too long: ${value}`)
  }
  return isDirectory ? `${normalized}${POSIX_SEPARATOR}` : normalized
}

/**
 * Async generator that writes the archive body, central directory and EOCD.
 * @param items - sorted archive items from `buildArchiveItems`.
 * @param skipped - skip report for entries that could not be measured.
 */
async function* generateArchive(items, skipped) {
  const central = []
  let offset = 0
  for (const item of items) {
    const nameBytes = Buffer.from(item.name, 'utf8')
    if (item.directory) {
      const start = offset
      const header = localFileHeader(nameBytes, ZIP_METHOD_STORE, 0, 0, 0, item.mtime)
      ensureArchiveRoom(offset, header.length)
      yield header
      offset += header.length
      central.push({
        nameBytes,
        directory: true,
        method: ZIP_METHOD_STORE,
        crc: 0,
        size: 0,
        compressedSize: 0,
        offset: start,
        mtime: item.mtime,
      })
      continue
    }
    let measured
    try {
      measured = await measureEntry(item)
    } catch (error) {
      addSkip(skipped, item.name, skipReason(error))
      continue
    }
    const start = offset
    try {
      const header = localFileHeader(nameBytes, measured.method, measured.crc, measured.size, measured.compressedSize, item.mtime)
      ensureArchiveRoom(offset, header.length)
      yield header
      offset += header.length
      let written = 0
      for await (const chunk of readEntryData(item, measured)) {
        ensureArchiveRoom(offset, chunk.length)
        written += chunk.length
        offset += chunk.length
        yield chunk
      }
      if (written !== measured.compressedSize) {
        throw new DeliveryError('archive-changed', `Entry changed while packaging: ${item.name}`)
      }
      central.push({
        nameBytes,
        directory: false,
        method: measured.method,
        crc: measured.crc,
        size: measured.size,
        compressedSize: measured.compressedSize,
        offset: start,
        mtime: item.mtime,
      })
    } finally {
      await closeMeasuredEntry(measured)
    }
  }
  const centralOffset = offset
  let centralSize = 0
  for (const record of central) {
    const header = centralDirectoryHeader(record)
    ensureArchiveRoom(offset, header.length)
    yield header
    offset += header.length
    centralSize += header.length
  }
  if (centralSize > UINT32_MAX) {
    throw new DeliveryError('too-large', 'ZIP central directory exceeds the 4 GiB limit; ZIP64 is not supported')
  }
  yield endOfCentralDirectory(central.length, centralSize, centralOffset)
}

/** Measure one entry with CRC-32 and deflated size, returning data or a handle. */
async function measureEntry(item) {
  const entry = item.entry
  if (Buffer.isBuffer(entry.data) || entry.data instanceof Uint8Array) {
    return measureBuffer(Buffer.from(entry.data))
  }
  const handle = await fsp.open(entry.absPath, 'r')
  try {
    const measured = await measureHandle(handle)
    return { ...measured, handle }
  } catch (error) {
    await handle.close().catch(() => {})
    throw error
  }
}

/** First streaming pass over an open file: CRC-32, size, compressed size. */
async function measureHandle(handle) {
  const state = { crc: 0 }
  let inputBytes = 0
  let compressedBytes = 0
  const source = handle.createReadStream({ start: 0, autoClose: false, highWaterMark: FILE_CHUNK_SIZE })
  const deflate = createDeflateRaw({ level: DEFLATE_LEVEL })
  deflate.on('data', (chunk) => {
    compressedBytes += chunk.length
  })
  const finished = new Promise((resolve, reject) => {
    deflate.once('end', resolve)
    deflate.once('error', reject)
  })
  finished.catch(() => {})
  try {
    for await (const chunk of source) {
      inputBytes += chunk.length
      crc32Update(state, chunk)
      if (!deflate.write(chunk)) await once(deflate, 'drain')
    }
    deflate.end()
    await finished
  } catch (error) {
    source.destroy()
    deflate.destroy()
    throw error
  }
  if (compressedBytes >= inputBytes) {
    return { method: ZIP_METHOD_STORE, crc: state.crc, size: inputBytes, compressedSize: inputBytes }
  }
  return { method: ZIP_METHOD_DEFLATE, crc: state.crc, size: inputBytes, compressedSize: compressedBytes }
}

/** Measure a small in-memory entry; report is tiny so buffering it is fine. */
async function measureBuffer(data) {
  const state = { crc: 0 }
  crc32Update(state, data)
  const deflate = createDeflateRaw({ level: DEFLATE_LEVEL })
  const chunks = []
  deflate.on('data', (chunk) => chunks.push(chunk))
  const finished = new Promise((resolve, reject) => {
    deflate.once('end', resolve)
    deflate.once('error', reject)
  })
  finished.catch(() => {})
  try {
    deflate.end(data)
    await finished
  } finally {
    deflate.destroy()
  }
  const compressed = Buffer.concat(chunks)
  if (compressed.length >= data.length) {
    return { method: ZIP_METHOD_STORE, crc: state.crc, size: data.length, compressedSize: data.length, payload: data }
  }
  return { method: ZIP_METHOD_DEFLATE, crc: state.crc, size: data.length, compressedSize: compressed.length, payload: compressed }
}

/**
 * Second streaming pass: yield the stored bytes or the deflated bytes.
 * Verifies CRC-32 and size so a file changed after measuring fails loudly.
 */
async function* readEntryData(item, measured) {
  if (measured.payload !== undefined) {
    if (measured.payload.length !== measured.compressedSize) {
      throw new DeliveryError('archive-changed', `In-memory entry changed while packaging: ${item.name}`)
    }
    yield measured.payload
    return
  }
  const handle = measured.handle
  const source = handle.createReadStream({ start: 0, autoClose: false, highWaterMark: FILE_CHUNK_SIZE })
  if (measured.method === ZIP_METHOD_STORE) {
    const state = { crc: 0 }
    let bytes = 0
    try {
      for await (const chunk of source) {
        bytes += chunk.length
        crc32Update(state, chunk)
        yield chunk
      }
    } finally {
      source.destroy()
    }
    verifyMeasured(item, measured, state.crc, bytes)
    return
  }
  const deflate = createDeflateRaw({ level: DEFLATE_LEVEL })
  const state = { crc: 0 }
  let bytes = 0
  const feed = (async () => {
    try {
      for await (const chunk of source) {
        bytes += chunk.length
        crc32Update(state, chunk)
        if (!deflate.write(chunk)) await once(deflate, 'drain')
      }
      deflate.end()
    } catch (error) {
      source.destroy()
      deflate.destroy(error)
      throw error
    }
  })()
  // A consumer can abort mid-entry; keep the feed rejection handled even then.
  feed.catch(() => {})
  try {
    for await (const chunk of deflate) yield chunk
    await feed
  } catch (error) {
    source.destroy()
    deflate.destroy()
    throw error
  } finally {
    source.destroy()
    deflate.destroy()
  }
  verifyMeasured(item, measured, state.crc, bytes)
}

/** Fail when the second pass disagrees with the measuring pass. */
function verifyMeasured(item, measured, crc, bytes) {
  if (bytes !== measured.size || crc !== measured.crc) {
    throw new DeliveryError('archive-changed', `Entry changed while packaging: ${item.name}`)
  }
}

/** Close the file handle of a measured entry, if it still has one. */
async function closeMeasuredEntry(measured) {
  if (measured.handle === undefined) return
  await measured.handle.close().catch(() => {})
}

/** Map a measuring-pass error onto a bounded skip reason. */
function skipReason(error) {
  const code = error?.code
  if (code === 'ENOENT') return 'missing'
  if (code === 'EACCES' || code === 'EPERM' || code === 'EISDIR') return 'unreadable'
  return 'read-failed'
}

/** Guard one write against the classic ZIP 32-bit offset limit. */
function ensureArchiveRoom(offset, length) {
  if (offset > UINT32_MAX - length) {
    throw new DeliveryError('too-large', 'ZIP archive would exceed the 4 GiB limit; ZIP64 is not supported')
  }
}

/** Build one local file header (30 bytes plus the UTF-8 name). */
function localFileHeader(nameBytes, method, crc, size, compressedSize, mtime) {
  const timestamp = dosDateTime(mtime)
  const header = Buffer.alloc(30)
  header.writeUInt32LE(ZIP_LOCAL_SIGNATURE, 0)
  header.writeUInt16LE(ZIP_VERSION_NEEDED, 4)
  header.writeUInt16LE(ZIP_FLAG_UTF8, 6)
  header.writeUInt16LE(method, 8)
  header.writeUInt16LE(timestamp.time, 10)
  header.writeUInt16LE(timestamp.date, 12)
  header.writeUInt32LE(crc >>> 0, 14)
  header.writeUInt32LE(compressedSize >>> 0, 18)
  header.writeUInt32LE(size >>> 0, 22)
  header.writeUInt16LE(nameBytes.length, 26)
  header.writeUInt16LE(0, 28)
  return Buffer.concat([header, nameBytes])
}

/** Build one central directory header (46 bytes plus the UTF-8 name). */
function centralDirectoryHeader(record) {
  const timestamp = dosDateTime(record.mtime)
  const mode = record.directory ? ZIP_UNIX_DIRECTORY_MODE : ZIP_UNIX_FILE_MODE
  const attributes = record.directory ? ((mode << 16) | DOS_DIRECTORY_ATTRIBUTE) >>> 0 : (mode << 16) >>> 0
  const header = Buffer.alloc(46)
  header.writeUInt32LE(ZIP_CENTRAL_SIGNATURE, 0)
  header.writeUInt16LE(ZIP_VERSION_MADE_BY, 4)
  header.writeUInt16LE(ZIP_VERSION_NEEDED, 6)
  header.writeUInt16LE(ZIP_FLAG_UTF8, 8)
  header.writeUInt16LE(record.method, 10)
  header.writeUInt16LE(timestamp.time, 12)
  header.writeUInt16LE(timestamp.date, 14)
  header.writeUInt32LE(record.crc >>> 0, 16)
  header.writeUInt32LE(record.compressedSize >>> 0, 20)
  header.writeUInt32LE(record.size >>> 0, 24)
  header.writeUInt16LE(record.nameBytes.length, 28)
  header.writeUInt16LE(0, 30)
  header.writeUInt16LE(0, 32)
  header.writeUInt16LE(0, 34)
  header.writeUInt16LE(0, 36)
  header.writeUInt32LE(attributes, 38)
  header.writeUInt32LE(record.offset >>> 0, 42)
  return Buffer.concat([header, record.nameBytes])
}

/** Build the end of central directory record (no archive comment). */
function endOfCentralDirectory(count, size, offset) {
  const header = Buffer.alloc(22)
  header.writeUInt32LE(ZIP_END_SIGNATURE, 0)
  header.writeUInt16LE(0, 4)
  header.writeUInt16LE(0, 6)
  header.writeUInt16LE(count, 8)
  header.writeUInt16LE(count, 10)
  header.writeUInt32LE(size >>> 0, 12)
  header.writeUInt32LE(offset >>> 0, 16)
  header.writeUInt16LE(0, 20)
  return header
}

/** Convert a Date (or millisecond timestamp) into MS-DOS date/time fields. */
function dosDateTime(value) {
  const source = value instanceof Date ? value : new Date(typeof value === 'number' ? value : Date.now())
  const date = Number.isFinite(source.getTime()) ? source : new Date()
  const year = Math.min(2107, Math.max(1980, date.getFullYear()))
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const seconds = Math.floor(date.getSeconds() / 2)
  return {
    date: ((year - 1980) << 9) | (month << 5) | day,
    time: (hours << 11) | (minutes << 5) | seconds,
  }
}

/** Build the CRC-32 lookup table once. */
function buildCrcTable() {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[index] = value >>> 0
  }
  return table
}

/** Update a running CRC-32 state with one chunk. */
function crc32Update(state, chunk) {
  let crc = state.crc ^ 0xffffffff
  for (let index = 0; index < chunk.length; index += 1) {
    crc = CRC_TABLE[(crc ^ chunk[index]) & 0xff] ^ (crc >>> 8)
  }
  state.crc = (crc ^ 0xffffffff) >>> 0
}

/** Default file name for a new delivery archive. */
function deliveryFilename(workspace) {
  const base = sanitizeFilename(path.basename(workspace)) || 'workspace'
  return `${base}-delivery-${formatTimestamp(new Date())}.zip`
}

/** `yyyyMMdd-HHmm` local timestamp used in delivery file names. */
function formatTimestamp(value) {
  const pad = (number) => String(number).padStart(2, '0')
  return `${value.getFullYear()}${pad(value.getMonth() + 1)}${pad(value.getDate())}-${pad(value.getHours())}${pad(value.getMinutes())}`
}

/** Keep a workspace basename safe for use in a file name. */
function sanitizeFilename(value) {
  return value.replace(/[\u0000-\u001f<>:"/\\|?*]/gu, '-').trim()
}

/** Resolve the destination of one exported bundle inside `.dsh/deliveries`. */
async function resolveBundlePath(workspace, outputPath) {
  const directory = path.join(workspace, DELIVERY_DIRNAME, DELIVERY_BUNDLE_DIRNAME)
  const fallback = () => uniqueBundlePath(directory, deliveryFilename(workspace))
  if (outputPath === undefined || outputPath === null || outputPath === '') return fallback()
  if (typeof outputPath !== 'string' || outputPath.length === 0 || outputPath.includes('\u0000')) {
    throw new DeliveryError('bad-output', 'outputPath must be a non-empty path')
  }
  const absolute = path.isAbsolute(outputPath) ? path.resolve(outputPath) : path.resolve(workspace, outputPath)
  const relative = path.relative(directory, absolute)
  const escapes = relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)
  if (escapes) {
    throw new DeliveryError('bad-output', `outputPath must be a file inside ${path.join(DELIVERY_DIRNAME, DELIVERY_BUNDLE_DIRNAME)}`)
  }
  // A leading slash or the directory itself means "pick a file name here".
  if (relative.length === 0 || outputPath.endsWith('/') || outputPath.endsWith(path.sep)) return fallback()
  try {
    const info = await fsp.lstat(absolute)
    if (info.isDirectory()) return uniqueBundlePath(absolute, deliveryFilename(workspace))
  } catch {
    /* a missing parent directory is created below */
  }
  return absolute
}

/** Pick a file name that does not overwrite an earlier bundle of the same minute. */
async function uniqueBundlePath(directory, filename) {
  const extension = path.extname(filename)
  const stem = filename.slice(0, filename.length - extension.length)
  for (let attempt = 1; attempt <= 100; attempt += 1) {
    const candidate = path.join(directory, attempt === 1 ? filename : `${stem}-${attempt}${extension}`)
    try {
      await fsp.access(candidate)
    } catch {
      return candidate
    }
  }
  throw new DeliveryError('write-failed', 'Could not allocate a unique delivery file name')
}
