/**
 * Host-side task output problem parser.
 *
 * The browser panel used to be the only consumer of task output parsing (it
 * turned raw build/lint output into clickable `file:line` rows). Model tools now
 * need the same data without a browser, so the regexes live here and are shared
 * by the Host task tools (and, later, by the panel).
 *
 * Supported formats:
 * - tsc `src/app.ts:12:5 - error TS2322: message` and `src/app.ts(12,5): error ...`
 * - eslint `stylish` (`/src/app.js` header followed by `  12:5  error  message`)
 * - generic `path/to/file.ext:12[:5]: error: message` (many compilers/tools)
 *
 * Parsing is best-effort and bounded: a malformed line is ignored, a caller
 * limit stops the scan, and no filesystem access happens here.
 */

/** Default and absolute cap on parsed problems per call. */
export const MAX_PROBLEMS = 200

/** Hard cap accepted from callers; keeps a single output from exploding. */
const HARD_LIMIT = 1000

/** tsc colon form: `path:line:col - error TS1234: message`. */
const TSC_COLON = /^(\S.*?):(\d+):(\d+)\s*[-–—]?\s*(error|warning)\s+(?:TS\d+:\s*)?(.+)$/iu

/** tsc pretty form: `path(line,col): error TS1234: message`. */
const TSC_PRETTY = /^(\S.*?)\((\d+),(\d+)\):\s*(error|warning)\s+(?:TS\d+:\s*)?(.+)$/iu

/** eslint/file header line (a bare path), usually followed by stylish rows. */
const FILE_HEADER =
  /^\s*(\S.*\.(?:[cm]?[jt]sx?|css|scss|less|json|vue|svelte|py|go|rs|java|kt|kts|rb|php|ya?ml|html))$/u

/** eslint stylish row: indented `line:col  severity  message`. */
const STYLISH = /^\s+(\d+):(\d+)\s+(error|warning)\s+(.+)$/u

/** Generic `path:line[:col] error|warning message` form. */
const GENERIC = /^(\S.*?\.[A-Za-z0-9]+):(\d+)(?::(\d+))?\s*[-–—:]?\s*(error|warning)\s*:?\s*(.+)$/iu

/**
 * Package-manager script banners (`> vite build`, `> pkg@1.0.0 test`) echo the
 * command itself. A command string can contain a compiler-looking fragment, so
 * banner lines are skipped instead of being parsed as diagnostics.
 */
const SCRIPT_BANNER = /^\s*>\s/u

/** A believable source path does not contain shell quoting characters. */
const UNPLAUSIBLE_FILE = /["'`]/u

/** True when a parsed path looks like a real file rather than a quoted command. */
function isPlausibleFile(file) {
  return file.length > 0 && !UNPLAUSIBLE_FILE.test(file)
}

/**
 * Normalize one reported path for display: trim, strip the workspace root when
 * known, then strip leading separators and a `./` prefix.
 * @param value - raw path text from a log line.
 * @param root - optional absolute workspace root to strip.
 * @returns the display path.
 */
function normalizeFile(value, root) {
  let candidate = String(value ?? '').trim()
  if (root.length > 0 && candidate.startsWith(root)) candidate = candidate.slice(root.length)
  candidate = candidate.replace(/^[\\/]+/u, '')
  if (candidate.startsWith('./')) candidate = candidate.slice(2)
  return candidate
}

/**
 * Parse build/lint output into structured problems.
 *
 * @param text - raw merged task output.
 * @param options - `{ limit?, root? }`; limit defaults to {@link MAX_PROBLEMS}
 *   and is clamped to [1, 1000], root is stripped from reported paths.
 * @returns `[{ file, line, column, severity, message }]` in log order.
 */
export function parseProblems(text, options = {}) {
  const requested = Number.isFinite(Number(options.limit)) ? Math.floor(Number(options.limit)) : MAX_PROBLEMS
  const limit = Math.min(HARD_LIMIT, Math.max(1, requested))
  const root = typeof options.root === 'string' ? options.root.replace(/[\\/]+$/u, '') : ''
  const problems = []
  let currentFile = null
  for (const line of String(text ?? '').split(/\r?\n/u)) {
    if (problems.length >= limit) break
    // Package-manager script banners echo the command; never parse them.
    if (SCRIPT_BANNER.test(line)) continue
    const tsc = TSC_COLON.exec(line)
    if (tsc !== null) {
      const file = normalizeFile(tsc[1], root)
      if (!isPlausibleFile(file)) continue
      problems.push({
        file,
        line: Number(tsc[2]),
        column: Number(tsc[3]),
        severity: tsc[4].toLowerCase(),
        message: tsc[5].trim(),
      })
      continue
    }
    const pretty = TSC_PRETTY.exec(line)
    if (pretty !== null) {
      const file = normalizeFile(pretty[1], root)
      if (!isPlausibleFile(file)) continue
      problems.push({
        file,
        line: Number(pretty[2]),
        column: Number(pretty[3]),
        severity: pretty[4].toLowerCase(),
        message: pretty[5].trim(),
      })
      continue
    }
    const header = FILE_HEADER.exec(line)
    if (header !== null && !/^\s+\d+:/u.test(line)) {
      const file = normalizeFile(header[1], root)
      currentFile = isPlausibleFile(file) ? file : null
      continue
    }
    const stylish = STYLISH.exec(line)
    if (stylish !== null && currentFile !== null) {
      problems.push({
        file: currentFile,
        line: Number(stylish[1]),
        column: Number(stylish[2]),
        severity: stylish[3].toLowerCase(),
        message: stylish[4].trim(),
      })
      continue
    }
    const generic = GENERIC.exec(line)
    if (generic !== null) {
      const file = normalizeFile(generic[1], root)
      if (!isPlausibleFile(file)) continue
      problems.push({
        file,
        line: Number(generic[2]),
        column: generic[3] === undefined ? 1 : Number(generic[3]),
        severity: generic[4].toLowerCase(),
        message: generic[5].trim(),
      })
    }
  }
  return problems
}

/**
 * Count problems without keeping the parsed rows beyond the limit.
 * @param text - raw task output.
 * @param options - `{ limit?, root? }` forwarded to {@link parseProblems}.
 * @returns the number of parsed problems.
 */
export function countProblems(text, options = {}) {
  return parseProblems(text, options).length
}
