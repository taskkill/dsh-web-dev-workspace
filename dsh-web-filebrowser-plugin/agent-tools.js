/**
 * Agent-facing execution/environment tools for the Dev Workspace plugin.
 *
 * This module is the Host half of P2/P3: it turns the existing task runner and
 * preview share manager into model tools, and adds a loopback HTTP probe. It is
 * deliberately a separate module so `index.js` only has to call
 * `registerAgentTools(ctx, services)` once the managers exist.
 *
 * Safety rules baked in here:
 * - every tool resolves the session workspace with `resolveAgentWorkspace` and
 *   rejects SSH roots (the task runner runs on the local Host);
 * - `task_run` only accepts commands that `task_detect` reported, so the model
 *   cannot use the Host route as an unapproved arbitrary shell;
 * - `http_probe` only accepts loopback hosts and bounded responses.
 *
 * Services contract (wire these from `index.js`):
 *   services.tasks      createTaskManager(...) result
 *   services.previews   createPreviewManager(...) result
 *   services.listPorts  async () => ({ supported: boolean, ports: [{port,url}] })
 */

import { resolveAgentWorkspace } from './memory.js'
import { parseProblems } from './problems.js'
import { isSshRoot } from './ssh.js'

/** Longest output tail returned by task_run. */
const MAX_OUTPUT_TAIL = 3 * 1024
/** Default and maximum chunk returned by task_output. */
const DEFAULT_OUTPUT_CHUNK = 4 * 1024
const MAX_OUTPUT_CHUNK = 8 * 1024
/** Problems returned inline by task_run (the count can be larger). */
const MAX_INLINE_PROBLEMS = 25
/** task_run waits this long by default and never longer than the cap. */
const DEFAULT_WAIT_MS = 15_000
const MAX_WAIT_MS = 60_000
/** One long-poll slice while waiting for a task to settle. */
const WAIT_SLICE_MS = 250
/** task_list row cap. */
const MAX_TASK_ROWS = 20
/** env_ports row cap. */
const MAX_PORT_ROWS = 200
/** http_probe bounds. */
const PROBE_TIMEOUT_MS = 5_000
const PROBE_MAX_BYTES = 256 * 1024
const PROBE_MAX_TITLE = 200

/** Structured tool failure carrying a stable machine code. */
export class AgentToolError extends Error {
  /**
   * @param code - stable machine-readable code.
   * @param message - human-readable explanation.
   */
  constructor(code, message) {
    super(`[${code}] ${message}`)
    this.name = 'AgentToolError'
    this.code = code
    // Existing Host route failures use sideCode; mirror it for mixed callers.
    this.sideCode = code
  }
}

/** Nullable integer schema (exit codes and signals are absent while running). */
const NULLABLE_INTEGER = { oneOf: [{ type: 'integer' }, { type: 'null' }] }
/** Nullable string schema. */
const NULLABLE_STRING = { oneOf: [{ type: 'string' }, { type: 'null' }] }

const PROBLEM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    file: { type: 'string', description: 'Workspace-relative or absolute file path.' },
    line: { type: 'integer', description: '1-based line number.' },
    column: { type: 'integer', description: '1-based column number.' },
    severity: { type: 'string', description: 'error or warning.' },
    message: { type: 'string', description: 'Tool/report message.' },
  },
  required: ['file', 'line', 'column', 'severity', 'message'],
}

const TASK_ROW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    command: { type: 'string' },
    cwd: { type: 'string' },
    running: { type: 'boolean' },
    exitCode: NULLABLE_INTEGER,
    signal: NULLABLE_STRING,
    source: { type: 'string', description: 'tool or panel.' },
    startedAt: { type: 'integer' },
    endedAt: NULLABLE_INTEGER,
    durationMs: { type: 'integer' },
    persisted: { type: 'boolean', description: 'True when the run is in .dsh/runs.json.' },
  },
  required: [
    'id',
    'name',
    'command',
    'cwd',
    'running',
    'exitCode',
    'signal',
    'source',
    'startedAt',
    'endedAt',
    'durationMs',
    'persisted',
  ],
}

const PREVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    url: { type: 'string', description: 'Token-prefixed relative URL on the preview listener.' },
    localUrl: { type: 'string', description: 'Absolute loopback URL of the preview listener.' },
    port: { type: 'integer', description: 'Preview listener port (not the target port).' },
    target: { type: 'string', description: 'Proxied target origin.' },
    targetPort: { type: 'integer', description: 'Proxied dev-server port.' },
    createdAt: { type: 'integer' },
    note: { type: 'string', description: 'How to reach the preview from another device.' },
  },
  required: ['id', 'url', 'localUrl', 'port', 'target', 'targetPort', 'createdAt', 'note'],
}

/**
 * Register every agent execution/environment tool on the Host context.
 *
 * @param ctx - Host context providing `tools` and, optionally, `logger`.
 * @param services - `{ tasks, previews, listPorts }` manager references.
 * @returns disposer that unregisters every tool.
 */
export function registerAgentTools(ctx, services = {}) {
  const disposers = []
  const register = (definition) => {
    try {
      const dispose = ctx.tools.register(definition)
      if (typeof dispose === 'function') disposers.push(dispose)
    } catch (error) {
      ctx.logger?.warn?.('dsh-web-filebrowser: failed to register an agent tool', error)
    }
  }

  const tasks = services.tasks ?? null
  const previews = services.previews ?? null
  const listPorts = typeof services.listPorts === 'function' ? services.listPorts : null

  register({
    name: 'task_detect',
    description:
      'List the runnable project commands detected in this workspace (.dsh task runner): package scripts, Makefile targets, Cargo/Go/Python/Compose commands, with an id, label and group (dev/build/test/lint/other). Use it before task_run: task_run only accepts one of these commands. This does not run anything.',
    parameters: { type: 'object', additionalProperties: false, properties: {}, required: [] },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          commands: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string', description: 'Stable command id (currently the command itself).' },
                label: { type: 'string' },
                command: { type: 'string' },
                group: { type: 'string', description: 'dev, build, test, lint or other.' },
              },
              required: ['id', 'label', 'command', 'group'],
            },
          },
          count: { type: 'integer' },
        },
        required: ['commands', 'count'],
      },
      render: (_args, value) => [
        {
          type: 'text',
          text:
            value.count === 0
              ? 'No project commands were detected in this workspace.'
              : `Detected ${String(value.count)} commands: ${value.commands.map((item) => item.command).slice(0, 10).join(' | ')}`,
        },
      ],
    },
    async execute(args, exec) {
      abortIfNeeded(exec)
      const root = workspaceRoot(ctx, exec)
      const runner = requireTasks(tasks)
      const commands = await detectCommands(runner, root)
      return {
        commands: commands.map((item) => ({
          id: item.id,
          label: item.label,
          command: item.command,
          group: item.group,
        })),
        count: commands.length,
      }
    },
  })

  register({
    name: 'task_run',
    description:
      'Run one project command detected by task_detect in this workspace (build/test/lint/dev). Waits up to waitMs (default 15s, max 60s) and returns a structured result: status, exit code, duration, parsed problems (tsc/eslint/generic) and an output tail, instead of a wall of log text. When the command is still running, it returns status="running" plus a taskId; use task_output / task_stop with that id. Only commands reported by task_detect are accepted. The run is recorded in .dsh/runs.json and visible in the Dev Workspace Tasks panel.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        commandId: { type: 'string', description: 'A command id or command string from task_detect.' },
        command: { type: 'string', description: 'A command string from task_detect (alternative to commandId).' },
        name: { type: 'string', description: 'Optional display name for the run.' },
        cwd: { type: 'string', description: 'Optional absolute directory inside the workspace.' },
        waitMs: {
          type: 'integer',
          description: `Milliseconds to wait for the run (default ${String(DEFAULT_WAIT_MS)}, max ${String(MAX_WAIT_MS)}).`,
        },
      },
      required: [],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          taskId: { type: 'string' },
          status: { type: 'string', description: 'running, passed or failed.' },
          command: { type: 'string' },
          name: { type: 'string' },
          cwd: { type: 'string' },
          exitCode: NULLABLE_INTEGER,
          signal: NULLABLE_STRING,
          durationMs: { type: 'integer' },
          problemCount: { type: 'integer' },
          problems: { type: 'array', items: PROBLEM_SCHEMA },
          outputTail: { type: 'string' },
          truncated: { type: 'boolean' },
          note: { type: 'string' },
        },
        required: [
          'taskId',
          'status',
          'command',
          'name',
          'cwd',
          'exitCode',
          'signal',
          'durationMs',
          'problemCount',
          'problems',
          'outputTail',
          'truncated',
          'note',
        ],
      },
      render: (_args, value) => [
        {
          type: 'text',
          text:
            value.status === 'running'
              ? `Task ${value.taskId} is still running (${String(value.durationMs)}ms): ${value.outputTail.slice(-400)}`
              : `${value.status.toUpperCase()} ${value.command} (exit ${String(value.exitCode)}, ${String(value.durationMs)}ms, ${String(value.problemCount)} problem(s), id ${value.taskId})${value.note.length > 0 ? ` — ${value.note}` : ''}`,
        },
      ],
    },
    async execute(args, exec) {
      abortIfNeeded(exec)
      const root = workspaceRoot(ctx, exec)
      const runner = requireTasks(tasks)
      const wantedId = typeof args?.commandId === 'string' ? args.commandId.trim() : ''
      const wantedCommand = typeof args?.command === 'string' ? args.command.trim() : ''
      if (wantedId.length === 0 && wantedCommand.length === 0) {
        throw new AgentToolError('bad-command', 'Provide commandId or command from task_detect.')
      }
      const detected = await detectCommands(runner, root)
      const candidate = findDetectedCommand(detected, wantedId, wantedCommand)
      if (candidate === null) {
        throw new AgentToolError(
          'bad-command',
          'Only commands reported by task_detect may run; call task_detect first and pass one of its (id) values.',
        )
      }
      const waitMs = clampInteger(args?.waitMs, DEFAULT_WAIT_MS, 0, MAX_WAIT_MS)
      let started
      try {
        started = await runner.start({
          root,
          command: candidate.command,
          name: typeof args?.name === 'string' && args.name.trim().length > 0 ? args.name.trim() : undefined,
          cwd: typeof args?.cwd === 'string' && args.cwd.trim().length > 0 ? args.cwd.trim() : undefined,
          source: 'tool',
        })
      } catch (error) {
        throw wrapHostError(error, 'task-failed')
      }
      const finished = await waitForTask(runner, started.id, waitMs)
      const snapshot = finished ? runner.read(started.id, { since: 0 }) : runner.read(started.id, { tail: 1024 })
      const running = snapshot.closed !== true
      if (running) {
        return {
          taskId: started.id,
          status: 'running',
          command: started.command,
          name: started.name,
          cwd: started.cwd,
          exitCode: null,
          signal: null,
          durationMs: snapshot.durationMs,
          problemCount: 0,
          problems: [],
          outputTail: snapshot.data.slice(-1024),
          truncated: snapshot.truncated,
          note: 'Still running; use task_output({id}) for more output or task_stop({id}) to stop it.',
        }
      }
      return buildFinishedTaskValue(runner, started, snapshot)
    },
  })

  register({
    name: 'task_output',
    description:
      'Read buffered output from a task started by task_run (or by the Dev Workspace Tasks panel). Use tail to get the last N characters or since to continue from a previous next offset. Returns at most 8 KB per call plus closed/exit metadata, so a long log does not flood the context.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        id: { type: 'string', description: 'Task id from task_run / task_list.' },
        tail: { type: 'integer', description: `Last N characters (default ${String(DEFAULT_OUTPUT_CHUNK)}, max ${String(MAX_OUTPUT_CHUNK)}).` },
        since: { type: 'integer', description: 'Absolute output offset from a previous next value.' },
      },
      required: ['id'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          taskId: { type: 'string' },
          status: { type: 'string' },
          data: { type: 'string' },
          next: { type: 'integer' },
          closed: { type: 'boolean' },
          exitCode: NULLABLE_INTEGER,
          signal: NULLABLE_STRING,
          durationMs: { type: 'integer' },
          truncated: { type: 'boolean' },
          reset: { type: 'boolean' },
        },
        required: [
          'taskId',
          'status',
          'data',
          'next',
          'closed',
          'exitCode',
          'signal',
          'durationMs',
          'truncated',
          'reset',
        ],
      },
      render: (_args, value) => [
        {
          type: 'text',
          text: `Task ${value.taskId} ${value.status}: ${value.data.length === 0 ? '(no new output)' : value.data}`,
        },
      ],
    },
    async execute(args, exec) {
      abortIfNeeded(exec)
      workspaceRoot(ctx, exec)
      const runner = requireTasks(tasks)
      const id = requireString(args?.id, 'id')
      const tail = clampInteger(args?.tail, DEFAULT_OUTPUT_CHUNK, 1, MAX_OUTPUT_CHUNK)
      const since = Number.isInteger(args?.since) ? Math.max(0, args.since) : undefined
      let snapshot
      try {
        snapshot = runner.read(id, since === undefined ? { tail } : { tail, since })
      } catch (error) {
        throw wrapLookupError(error, 'task-not-found')
      }
      return {
        taskId: id,
        status: snapshot.closed === false ? 'running' : snapshot.exitCode === 0 ? 'passed' : 'failed',
        data: snapshot.data,
        next: snapshot.next,
        closed: snapshot.closed,
        exitCode: snapshot.exitCode,
        signal: snapshot.signal,
        durationMs: snapshot.durationMs,
        truncated: snapshot.truncated,
        reset: snapshot.reset === true,
      }
    },
  })

  register({
    name: 'task_stop',
    description:
      'Stop one task by id (SIGTERM, then SIGKILL after a grace period). Use it for a dev server or a test run that is no longer needed. Killing your own task does not change its recorded run history.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: { id: { type: 'string', description: 'Task id from task_run / task_list.' } },
      required: ['id'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: { taskId: { type: 'string' }, stopped: { type: 'boolean' } },
        required: ['taskId', 'stopped'],
      },
      render: (_args, value) => [{ type: 'text', text: `Stopped task ${value.taskId}.` }],
    },
    async execute(args, exec) {
      abortIfNeeded(exec)
      workspaceRoot(ctx, exec)
      const runner = requireTasks(tasks)
      const id = requireString(args?.id, 'id')
      try {
        await runner.kill({ id })
      } catch (error) {
        throw wrapLookupError(error, 'task-not-found')
      }
      return { taskId: id, stopped: true }
    },
  })

  register({
    name: 'task_list',
    description:
      'List running tasks and recent finished runs for this workspace, newest first (max 20). Includes runs restored from .dsh/runs.json after a Host restart, with source=tool (started by a model tool) or source=panel (started in the Dev Workspace Tasks panel).',
    parameters: { type: 'object', additionalProperties: false, properties: {}, required: [] },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          tasks: { type: 'array', items: TASK_ROW_SCHEMA },
          count: { type: 'integer' },
        },
        required: ['tasks', 'count'],
      },
      render: (_args, value) => [
        {
          type: 'text',
          text:
            value.count === 0
              ? 'No tasks recorded for this workspace.'
              : value.tasks
                  .slice(0, 10)
                  .map(
                    (row) =>
                      `${row.running ? 'RUNNING' : row.exitCode === 0 ? 'PASS' : 'FAIL'} ${row.command} (${String(row.durationMs)}ms${row.persisted ? ', persisted' : ''})`,
                  )
                  .join('\n'),
        },
      ],
    },
    async execute(args, exec) {
      abortIfNeeded(exec)
      const root = workspaceRoot(ctx, exec)
      const runner = requireTasks(tasks)
      const live = typeof runner.list === 'function' ? await runner.list({ root }) : []
      const runs = typeof runner.listRuns === 'function' ? await runner.listRuns(root) : []
      const rows = mergeTaskRows(live, runs)
      return { tasks: rows, count: rows.length }
    },
  })

  register({
    name: 'env_ports',
    description:
      'List TCP ports currently listening on the Host (Linux /proc/net/tcp) so a dev server started by a task can be discovered. Returns {port,url} rows only, not process names. Use the port with preview_share or http_probe.',
    parameters: { type: 'object', additionalProperties: false, properties: {}, required: [] },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          supported: { type: 'boolean', description: 'False when this platform cannot scan listening ports.' },
          ports: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: { port: { type: 'integer' }, url: { type: 'string' } },
              required: ['port', 'url'],
            },
          },
          count: { type: 'integer' },
        },
        required: ['supported', 'ports', 'count'],
      },
      render: (_args, value) => [
        {
          type: 'text',
          text: value.supported
            ? `Listening ports: ${value.ports.map((row) => String(row.port)).join(', ') || '(none)'}`
            : 'Port scanning is not supported on this Host platform.',
        },
      ],
    },
    async execute(args, exec) {
      abortIfNeeded(exec)
      workspaceRoot(ctx, exec)
      if (listPorts === null) {
        throw new AgentToolError('unavailable', 'Port discovery is not wired on this Host; restart Harness after upgrading the plugin.')
      }
      let value
      try {
        value = await listPorts()
      } catch (error) {
        throw wrapHostError(error, 'ports-unavailable')
      }
      const ports = Array.isArray(value?.ports)
        ? value.ports
            .filter((row) => row !== null && typeof row === 'object' && Number.isInteger(row.port))
            .slice(0, MAX_PORT_ROWS)
            .map((row) => ({
              port: row.port,
              url: typeof row.url === 'string' && row.url.length > 0 ? row.url : `http://localhost:${String(row.port)}`,
            }))
        : []
      return { supported: value?.supported === true, ports, count: ports.length }
    },
  })

  register({
    name: 'preview_share',
    description:
      'Expose one loopback dev server (for example the port found by env_ports) through the Dev Workspace share proxy and return its token URL, so a phone, another machine on the LAN, or the owner can open it. The returned URL is a weak credential: only share it with people who should see the dev server, and never paste it into workspace memory or a delivery report. Shares live in the Host process and disappear on restart.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        port: { type: 'integer', description: 'Loopback dev-server port (1-65535).' },
        host: { type: 'string', description: 'Optional loopback target host: 127.0.0.1, localhost or ::1.' },
      },
      required: ['port'],
    },
    output: { schema: PREVIEW_SCHEMA, render: (_args, value) => [{ type: 'text', text: `Preview ready: ${value.localUrl} (target port ${String(value.targetPort)})` }] },
    async execute(args, exec) {
      abortIfNeeded(exec)
      workspaceRoot(ctx, exec)
      const manager = requirePreviews(previews)
      const port = Number(args?.port)
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new AgentToolError('bad-port', 'port must be an integer between 1 and 65535.')
      }
      let value
      try {
        value = await manager.open({
          port,
          host: typeof args?.host === 'string' && args.host.length > 0 ? args.host : undefined,
        })
      } catch (error) {
        throw wrapHostError(error, 'preview-failed')
      }
      return mapPreview(value)
    },
  })

  register({
    name: 'preview_list',
    description:
      'List the preview shares currently open on this Host (id, token URL, target port, creation time). Use preview_close to remove one.',
    parameters: { type: 'object', additionalProperties: false, properties: {}, required: [] },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          previews: { type: 'array', items: PREVIEW_SCHEMA },
          count: { type: 'integer' },
        },
        required: ['previews', 'count'],
      },
      render: (_args, value) => [
        {
          type: 'text',
          text:
            value.count === 0
              ? 'No preview shares are open.'
              : value.previews.map((row) => `${row.localUrl} -> port ${String(row.targetPort)}`).join('\n'),
        },
      ],
    },
    async execute(args, exec) {
      abortIfNeeded(exec)
      workspaceRoot(ctx, exec)
      const manager = requirePreviews(previews)
      const entries = manager.list()
      const rows = (Array.isArray(entries) ? entries : []).slice(0, 16).map((entry) => mapPreview(entry))
      return { previews: rows, count: rows.length }
    },
  })

  register({
    name: 'preview_close',
    description: 'Close one preview share by id; its token URL stops working and the listener port is released.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: { id: { type: 'string', description: 'Preview id from preview_share / preview_list.' } },
      required: ['id'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: { id: { type: 'string' }, closed: { type: 'boolean' } },
        required: ['id', 'closed'],
      },
      render: (_args, value) => [{ type: 'text', text: `Closed preview ${value.id}.` }],
    },
    async execute(args, exec) {
      abortIfNeeded(exec)
      workspaceRoot(ctx, exec)
      const manager = requirePreviews(previews)
      const id = requireString(args?.id, 'id')
      try {
        manager.close(id)
      } catch (error) {
        throw wrapLookupError(error, 'preview-not-found')
      }
      return { id, closed: true }
    },
  })

  register({
    name: 'http_probe',
    description:
      'Send one bounded HTTP GET to a loopback URL (127.0.0.1 / localhost / ::1 only, 5s timeout, 256 KB cap) and return the status, content type, HTML <title>, response bytes and duration. Use it to verify that a dev server just started by a task actually answers, before telling the owner or creating a preview share.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        url: { type: 'string', description: 'http:// or https:// loopback URL, for example http://127.0.0.1:5173/.' },
      },
      required: ['url'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          url: { type: 'string' },
          status: { type: 'integer' },
          contentType: { type: 'string' },
          title: { type: 'string' },
          bytes: { type: 'integer' },
          truncated: { type: 'boolean' },
          ok: { type: 'boolean' },
          durationMs: { type: 'integer' },
        },
        required: ['url', 'status', 'contentType', 'title', 'bytes', 'truncated', 'ok', 'durationMs'],
      },
      render: (_args, value) => [
        {
          type: 'text',
          text: `HTTP ${String(value.status)} ${value.contentType} (${String(value.bytes)} bytes, ${String(value.durationMs)}ms)${value.title.length > 0 ? ` — ${value.title}` : ''}`,
        },
      ],
    },
    async execute(args, exec) {
      abortIfNeeded(exec)
      workspaceRoot(ctx, exec)
      const url = requireString(args?.url, 'url')
      return probeLoopback(url)
    },
  })

  return () => {
    for (const dispose of disposers.splice(0)) dispose()
  }
}

/** Resolve the session workspace for one tool call, rejecting SSH roots. */
function workspaceRoot(ctx, exec) {
  const agent = exec?.agent ?? null
  const root = resolveAgentWorkspace(ctx, agent)
  const cwd = agent?.session?.meta?.cwd
  if (root === null || (typeof root === 'string' && root.length === 0)) {
    throw new AgentToolError(
      'workspace-missing',
      'This session has no local workspace; open a Dev Workspace folder (SSH roots are not supported by this tool).',
    )
  }
  if (typeof root === 'string' && (isSshRoot(root) || isSshRoot(cwd))) {
    throw new AgentToolError('ssh-unsupported', 'This tool runs on the local Host and does not support SSH remote workspaces.')
  }
  return root
}

/** Throw when the caller aborted; tools must not keep doing work. */
function abortIfNeeded(exec) {
  if (exec !== null && typeof exec === 'object' && exec.signal !== null && typeof exec.signal === 'object') {
    exec.signal.throwIfAborted?.()
  }
}

/** Read a required non-empty string tool argument. */
function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgentToolError('bad-request', `${name} must be a non-empty string.`)
  }
  return value.trim()
}

/** Clamp an optional integer argument into [min, max]. */
function clampInteger(value, fallback, min, max) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, Math.floor(number)))
}

/** Require the task manager service. */
function requireTasks(tasks) {
  if (
    tasks === null ||
    tasks === undefined ||
    typeof tasks.detect !== 'function' ||
    typeof tasks.start !== 'function' ||
    typeof tasks.read !== 'function'
  ) {
    throw new AgentToolError('unavailable', 'The task runner is not wired on this Host; restart Harness after upgrading the plugin.')
  }
  return tasks
}

/** Require the preview manager service. */
function requirePreviews(previews) {
  if (previews === null || previews === undefined || typeof previews.open !== 'function') {
    throw new AgentToolError('unavailable', 'Preview sharing is not wired on this Host; restart Harness after upgrading the plugin.')
  }
  return previews
}

/** Detect project commands, normalizing a missing/failed service result. */
async function detectCommands(runner, root) {
  let items
  try {
    items = await runner.detect({ root })
  } catch (error) {
    throw wrapHostError(error, 'detect-failed')
  }
  if (!Array.isArray(items)) return []
  return items.filter(
    (item) =>
      item !== null &&
      typeof item === 'object' &&
      typeof item.command === 'string' &&
      typeof item.id === 'string' &&
      typeof item.label === 'string' &&
      typeof item.group === 'string',
  )
}

/** Find one detected command by id or command string. */
function findDetectedCommand(commands, wantedId, wantedCommand) {
  const wants = [wantedId, wantedCommand].filter((value) => value.length > 0)
  for (const wanted of wants) {
    const match = commands.find((item) => item.id === wanted || item.command === wanted)
    if (match !== undefined) return match
  }
  return null
}

/** Wait until a task settles or the deadline passes. */
async function waitForTask(runner, id, waitMs) {
  const deadline = Date.now() + Math.max(0, waitMs)
  let since = 0
  while (Date.now() < deadline) {
    const remaining = deadline - Date.now()
    let snapshot
    try {
      snapshot = await runner.poll({ id, since, wait: Math.max(0, Math.min(WAIT_SLICE_MS, remaining)) })
    } catch (error) {
      throw wrapLookupError(error, 'task-not-found')
    }
    if (snapshot !== null && typeof snapshot === 'object' && Number.isFinite(snapshot.next)) since = snapshot.next
    if (snapshot?.closed === true) return true
  }
  const final = runner.read(id, { tail: 0 })
  return final.closed === true
}

/** Build the finished task_run value (status, problems, output tail). */
function buildFinishedTaskValue(runner, started, snapshot) {
  const problems = parseProblems(snapshot.data, { limit: 200, root: started.cwd ?? '' })
  const outputTail = snapshot.data.length > MAX_OUTPUT_TAIL ? snapshot.data.slice(-MAX_OUTPUT_TAIL) : snapshot.data
  const truncated = snapshot.truncated === true || snapshot.data.length > MAX_OUTPUT_TAIL || problems.length >= 200
  return {
    taskId: started.id,
    status: snapshot.exitCode === 0 ? 'passed' : 'failed',
    command: started.command,
    name: started.name,
    cwd: started.cwd,
    exitCode: snapshot.exitCode,
    signal: snapshot.signal,
    durationMs: snapshot.durationMs,
    problemCount: problems.length,
    problems: problems.slice(0, MAX_INLINE_PROBLEMS),
    outputTail,
    truncated,
    note: '',
  }
}

/** Merge live task rows with persisted run records, newest first. */
function mergeTaskRows(live, runs) {
  const rows = []
  const liveIds = new Set()
  const persistedIds = new Set((Array.isArray(runs) ? runs : []).map((run) => run.id))
  for (const row of Array.isArray(live) ? live : []) {
    if (row === null || typeof row !== 'object' || typeof row.id !== 'string') continue
    liveIds.add(row.id)
    rows.push({
      id: row.id,
      name: typeof row.name === 'string' ? row.name : '',
      command: typeof row.command === 'string' ? row.command : '',
      cwd: typeof row.cwd === 'string' ? row.cwd : '',
      running: row.running === true,
      exitCode: Number.isInteger(row.exitCode) ? row.exitCode : null,
      signal: typeof row.signal === 'string' ? row.signal : null,
      source: row.source === 'tool' ? 'tool' : 'panel',
      startedAt: Number.isFinite(row.startedAt) ? row.startedAt : 0,
      endedAt: Number.isFinite(row.endedAt) ? row.endedAt : null,
      durationMs: Number.isFinite(row.durationMs) ? Math.max(0, Math.floor(row.durationMs)) : 0,
      persisted: persistedIds.has(row.id),
    })
  }
  for (const run of Array.isArray(runs) ? runs : []) {
    if (run === null || typeof run !== 'object' || typeof run.id !== 'string' || liveIds.has(run.id)) continue
    rows.push({
      id: run.id,
      name: typeof run.name === 'string' ? run.name : '',
      command: typeof run.command === 'string' ? run.command : '',
      cwd: typeof run.cwd === 'string' ? run.cwd : '',
      running: false,
      exitCode: Number.isInteger(run.exitCode) ? run.exitCode : null,
      signal: typeof run.signal === 'string' ? run.signal : null,
      source: run.source === 'tool' ? 'tool' : 'panel',
      startedAt: Number.isFinite(run.startedAt) ? run.startedAt : 0,
      endedAt: Number.isFinite(run.endedAt) ? run.endedAt : null,
      durationMs: Number.isFinite(run.durationMs) ? Math.max(0, Math.floor(run.durationMs)) : 0,
      persisted: true,
    })
  }
  rows.sort((left, right) => right.startedAt - left.startedAt)
  return rows.slice(0, MAX_TASK_ROWS)
}

/** Map a preview manager response to the tool schema. */
function mapPreview(value) {
  const source = value !== null && typeof value === 'object' ? value : {}
  return {
    id: typeof source.id === 'string' ? source.id : '',
    url: typeof source.url === 'string' ? source.url : '',
    localUrl: typeof source.localUrl === 'string' ? source.localUrl : '',
    port: Number.isInteger(source.port) ? source.port : 0,
    target: typeof source.target === 'string' ? source.target : '',
    targetPort: Number.isInteger(source.targetPort) ? source.targetPort : 0,
    createdAt: Number.isFinite(source.createdAt) ? Math.floor(source.createdAt) : Date.now(),
    note: typeof source.note === 'string' ? source.note : '',
  }
}

/** Map a host `not-found` onto a stable tool code, otherwise keep its code. */
function wrapLookupError(error, missingCode) {
  const message = error instanceof Error ? error.message : String(error)
  if (error !== null && typeof error === 'object' && error.code === 'not-found') {
    return new AgentToolError(missingCode, message)
  }
  return wrapHostError(error, missingCode)
}

/** Preserve a Host manager's error code while adding a fallback code. */
function wrapHostError(error, fallbackCode) {
  if (error instanceof AgentToolError) return error
  const code =
    error !== null &&
    typeof error === 'object' &&
    typeof error.code === 'string' &&
    error.code.length > 0 &&
    /^[a-z][a-z0-9-]*$/u.test(error.code)
      ? error.code
      : fallbackCode
  const message = error instanceof Error ? error.message : String(error)
  return new AgentToolError(code, message)
}

/**
 * Probe one loopback URL. Redirects are not followed (a redirect is reported as
 * its 3xx status); the body is read up to PROBE_MAX_BYTES.
 */
async function probeLoopback(rawUrl) {
  let parsed
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new AgentToolError('bad-url', 'url must be an absolute http:// or https:// URL.')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new AgentToolError('bad-url', 'url must use http: or https:.')
  }
  if (parsed.username.length > 0 || parsed.password.length > 0) {
    throw new AgentToolError('bad-url', 'url must not carry credentials.')
  }
  const hostname = parsed.hostname.toLowerCase().replace(/^\[/u, '').replace(/\]$/u, '')
  if (hostname !== '127.0.0.1' && hostname !== 'localhost' && hostname !== '::1') {
    throw new AgentToolError('forbidden-host', 'http_probe only accepts loopback hosts: 127.0.0.1, localhost or ::1.')
  }
  const startedAt = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
  timer.unref?.()
  let response
  try {
    response = await fetch(parsed, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: { accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8' },
    })
  } catch (error) {
    if (controller.signal.aborted) {
      throw new AgentToolError('timeout', `No response within ${String(PROBE_TIMEOUT_MS)}ms.`)
    }
    throw new AgentToolError('probe-failed', error instanceof Error ? error.message : String(error))
  } finally {
    clearTimeout(timer)
  }
  let bytes = 0
  let truncated = false
  const chunks = []
  if (response.body !== null && typeof response.body === 'object' && typeof response.body.getReader === 'function') {
    const reader = response.body.getReader()
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value === undefined) continue
        const room = PROBE_MAX_BYTES - bytes
        if (room <= 0) {
          truncated = true
          break
        }
        const chunk = value.byteLength > room ? value.slice(0, room) : value
        chunks.push(chunk)
        bytes += chunk.byteLength
        if (chunk.byteLength < value.byteLength) {
          truncated = true
          break
        }
      }
    } finally {
      try {
        await reader.cancel()
      } catch {
        /* already finished */
      }
    }
  }
  const body = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))
  const contentType = response.headers.get('content-type') ?? ''
  const text = decodeProbeBody(body, contentType)
  return {
    url: parsed.href,
    status: response.status,
    contentType,
    title: extractTitle(text),
    bytes,
    truncated,
    ok: response.status >= 200 && response.status < 300,
    durationMs: Date.now() - startedAt,
  }
}

/** Decode a probe body as UTF-8 (the loopback dev-server case). */
function decodeProbeBody(buffer, contentType) {
  try {
    return new TextDecoder('utf-8').decode(buffer)
  } catch {
    return buffer.toString('latin1')
  }
}

/** Extract and clean the HTML title for the probe result. */
function extractTitle(text) {
  if (typeof text !== 'string' || text.length === 0) return ''
  const match = /<title[^>]*>([\s\S]*?)<\/title>/iu.exec(text)
  if (match === null) return ''
  return decodeEntities(match[1]).replace(/\s+/gu, ' ').trim().slice(0, PROBE_MAX_TITLE)
}

/** Decode the handful of entities that appear in titles. */
function decodeEntities(text) {
  return String(text)
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&nbsp;', ' ')
}
