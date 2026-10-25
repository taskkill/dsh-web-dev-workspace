# Changelog

All notable changes to this project are documented here.

## Unreleased

### Follow-up fix: complete the real-tab workbench refactor

- The previous build removed the synthetic `workbenchOpen` state but left the old
  open/close helpers referencing `setWorkbenchOpen`, which would crash at runtime.
  The helpers were replaced by `ensureWorkbenchTab` / tab close via `closeNow`,
  the tab icon branch for `mode: 'workbench'` was added, and a grep for the old
  identifier comes back empty.

### Workbench is now a real editor tab (like the browser tab)

- The Workbench stopped being a synthetic overlay: it is created as a normal tab
  (`mode: 'workbench'`, path `workbench:home`) in the same tab store as files,
  browser pages and terminals. It therefore participates in the regular tab strip,
  active state, neighbour selection on close, session landing and the sidebar
  groups exactly like the built-in browser tab.
- Opening the Workbench creates/focuses that tab; closing it (tab × or the page
  header ×) uses the normal close path; clicking it in the sidebar/menu focuses the
  tab. Opening a file simply switches the active tab and keeps the Workbench tab
  available. The page header keeps its title + close button, compact layouts keep
  the back button.
- Removed the synthetic `workbenchOpen` state, the special main-area branch and the
  hand-rolled tab renderer; the workbench page renders from `activeTab.mode`.

### Make the team actually redo the flow after a requirement change

- After an append/edit the Workbench now asks **which stage should be redone with
  the new requirement** instead of only offering the current stage. Choosing a
  stage resets that stage and every later stage (earlier approved stages stay) and
  immediately dispatches the stage's role prompt — so picking “Requirement” makes
  the product manager re-run the whole flow against the new requirement, while
  “Development” redoes development onward.
- `pipeline.restartStage` now supports this cascade (any stage, guard: all earlier
  stages must be approved) and returns the list of reset stage ids. The mode hints
  state that append/edit alone only update documents and do not run the team.
- Pipeline selftest updated to 29/29 for the cascade and the bad-order guard.

### Requirement adjustments: visible feedback and an explicit “redo this stage”

- Appending or editing a requirement now shows its result **inside the requirement
  card** (not only below in the status card) and, when a stage is running or
  awaiting review, offers a clear follow-up: **Redo this stage with the new
  requirement** or “record only, do not redo”. The stage is reset by a new host op
  (`pipelineRestartStage` → `restartStage`) and its role prompt is dispatched
  again, so the adjustment has a visible effect on the flow.
- The mode hints now state plainly that append/edit only update the requirement and
  notify the product manager and do **not** rerun stages automatically. The
  revision log keeps the history entry for every adjustment.
- Pipeline selftest extended to 29/29 (restart resets running and reviewed stages,
  rejects other statuses).

### Workbench behaves like a normal editor tab

- The dashboard no longer takes over the window: on desktop the file sidebar
  stays visible while the Workbench tab is active, the splitter works, and the
  page has a header with its title and an explicit **close (×)** button. The tab
  itself still has a close button, so both routes work.
- Compact layouts keep the back button (return to the file tree) plus the close
  button; the sidebar-only full-width behaviour is limited to phones.
- Opening a file from the tree swaps the editor content while keeping the
  Workbench tab in the strip; clicking the tab returns to the dashboard.

### Fix: “Cannot access 'activeTab' before initialization” on load

- The workbench-tab navigation effect referenced the `activeTab` const from its
  dependency array, but the effect is defined earlier in the component than that
  const (temporal dead zone), crashing the whole workspace on first render. The
  effect now reads `store.get().active` instead and no longer depends on the
  const. A static scan confirms no source line before `const activeTab` still
  references it.

### Workbench as an editor tab, and no more misleading “Start” on finished projects

- The Workbench is now a proper **editor tab**: opening a file keeps the tab in the
  strip (inactive) and clicking it returns to the dashboard; the tab can be closed
  with ×. When only the Workbench tab exists the strip still shows it, and the
  dashboard no longer hides the tab strip. Opening a file no longer closes the
  Workbench tab; navigating from the dashboard to a sidebar view still closes it so
  the pipeline/acceptance panels are visible. Compact layouts keep a back button
  in the page header.
- The pipeline requirement form no longer offers “Start and dispatch” on a
  **completed** project (which produced the confusing “该阶段已完成” toast): it
  shows **Open the Workbench to adjust** instead, and `kickoffPipeline` guards
  completed rounds by routing the owner to the requirement/adjustment card. The
  “already done” message now points at the change flow.

### Fix: “round is not defined” when appending a requirement

- `submitRequirementChange` referenced the render-scoped `round` variable, which
  only existed inside the change-round branch; appending or editing a requirement
  threw a ReferenceError and surfaced as “需求更新失败：round is not defined”.
  The handler now reads the current round from the loaded pipeline document
  (`currentRound`) and uses it for the prompt and notice. A quick scan of the
  requirement/dashboard handlers for other render-scope references came back
  clean.

### Fix: “error is not defined” crash on the dashboard

- The problem-aggregation effect referenced the file-operation `error` state that
  only exists inside the Git panel component, so the whole Dev Workspace crashed
  into the error boundary. The entry was removed; the aggregated sources are the
  states that actually live in the IDE component (pipeline, workbench,
  acceptance, preview, tasks, connection banner).

### Workbench: one “Problems & status” card for every panel

- The Workbench now starts with a full-width **Problems & status** card. Panel
  errors from the pipeline, acceptance, preview, tasks, file operations and the
  connection banner are collected into one list (source chip, message, timestamp,
  “Open” jump button, per-item restart for rejected stages, clear-all) instead of
  staying hidden inside their own panels. The card also shows when the dashboard
  last refreshed.
- **Rejected stages** appear at the top of that card with their review note and a
  **Restart stage** button (which uses the graceful start path and reconciles
  stale state).
- The requirement card shows the **current change round** line (round, title and
  scope) so a change that cannot proceed is visible on the dashboard; starting a
  change or requirement update now surfaces its failure as an issue rather than
  only in the pipeline panel.
- Errors remain session-local: they disappear on reload; the durable record stays
  in the pipeline history and revision logs.

### Stage start reconciles stale status instead of failing

- Clicking “Start and dispatch” on a stage that had already moved on (for example
  auto-approved by fast mode between two refreshes) used to fail with a raw
  “only pending or failed stages can start” error. The client now reconciles on
  `bad-status`: it reloads the pipeline and either **resends the role prompt**
  when the stage is already active, **advances to the next startable stage** when
  the clicked stage is done, or reports “already completed, nothing to start”.
  The reconciliation is recursive, so a chain of already-approved stages lands on
  the real next step.
- Start errors are now surfaced as toasts whenever the pipeline panel is not the
  visible view, so a failure on the Workbench is no longer silent. The Workbench
  refresh interval dropped from five to three seconds to narrow the stale window.
- New strings: already-running, auto-advanced and already-done messages (zh/en).

### File and folder properties from the explorer context menu

- The explorer context menu (files, folders and the workspace root) gained
  **Properties…**: a dialog showing type, absolute location, size, modified /
  created / accessed times, permission mode, read-only flag, symlink target and,
  for folders, a recursive size with file/folder counts plus the number of direct
  children.
- Host op `properties` walks directories with hard caps (20 000 entries or
  1.5 s) and reports truncation/permission-skipped counts instead of hanging; the
  dialog shows those notes when present. SSH roots fall back to the remote stat
  response.
- The menu item uses a new info icon; the dialog reuses the modal shell and adds
  a properties row layout.

### Prominent requirement card and scoped change rounds

- The revision entry moved out of the status card's link row into a dedicated
  full-width **Requirement & adjustments** card: requirement title, a three-line
  detail preview, the round badge, three prominent buttons (append / edit /
  start change) and the last four revisions. Edit and change prefill the current
  title; change is disabled until all six stages are approved with a tooltip
  explaining why.
- Change rounds now take a **scope**: `full`, `development` (skip product and
  design: development → testing → sign-off → release) or `release` (skip the
  first four stages: sign-off → release only). Skipped stages are stored as
  approved with a “跳过 / skipped” reason, the flow shows them in italic-ish
  “Skipped” state, and the round starts from the first applicable stage — a
  release-only round stops at the sign-off gate for the owner. The scope is
  recorded on the change entry and shown in the pipeline change log; the workbench
  status card was trimmed to progress and stage actions.
- Pipeline selftest extended to 28/28 (development scope skips product/design and
  starts at development; release scope skips four stages and starts at approval).

### Requirement revision centre: append, edit, refine with history

- `.dsh/pipeline.json` gained `requirementLog`: every append/edit/change records
  an entry with id, type (append / refine / edit / change / initial), title,
  detail and timestamp. `pipeline.updateRequirement` (exposed as
  `pipelineUpdateRequirement`) supports `mode: 'append' | 'replace'` with an
  optional type, and `startChangeRound` also appends a change entry.
- The Workbench project card now offers **Revise requirement** with three modes —
  **Append notes** (no scope change), **Edit requirement** (rewrite; may require
  sending the running stage back) and **New change round** (only once complete) —
  each with an explanation, prefilled title when relevant, and a mode-specific
  primary button. Submitting an append/edit dispatches an “absorb this revision”
  prompt to the product manager (update requirements.md and acceptance items,
  flag conflicts with the running stage); a change round still dispatches the
  product manager automatically.
- Revisions surface as a compact **Requirement revisions** list on the project
  card (last 3) and in the Pipeline view (last 6), with type chips and titles.
- Pipeline selftest extended to 27/27 (append, replace, log types and ordering,
  empty-input rejection).

### Change rounds: adjust a delivered project without losing history

- `.dsh/pipeline.json` now tracks a **round counter**, a **change log** and up to
  ten **round snapshots**. `pipeline.startChangeRound` (exposed as
  `pipelineStartChange`) is only allowed once all six stages are approved: it
  archives the completed round (requirement title/detail, stage summaries and
  review times), increments the round, replaces the requirement with the change
  request, resets the six stages to pending and keeps acceptance items, fast-mode
  settings and the release history.
- The Workbench project card shows the round, and once the project is complete it
  offers **Start a change** with title/detail fields; submitting archives the old
  round, starts the new one and dispatches the product manager automatically. The
  flow card labels the round and the flow log gains round-start events. The
  Pipeline view shows the round badge plus a change log and previous rounds.
- Pipeline selftest extended (26/26): a full six-stage project, the change round,
  reset stages, archived history, change list, new requirement and the guard that
  incomplete projects cannot start a change.

### Workbench: full project flow view

- The Workbench gained a **Project flow** card (full grid width, shown whenever a
  requirement exists): the six stages render as connected step cards with the
  stage name, responsible role, status, elapsed time for the running stage and a
  truncation of a rejection note — every card is clickable to open the pipeline.
- Under the step strip, a “now” line reports the current stage, its status,
  elapsed time and owner; a compact **flow log** lists the last eight events
  (stage started / submitted / approved / sent back / release recorded) with
  local times, newest first.
- The duplicate anonymous stage chips on the project card were removed so the
  flow card is the single place that describes the pipeline; the project card
  keeps the requirement title, completed count and stage actions.

### Workbench clarity: working navigation and honest stage actions

- **“Open pipeline / acceptance / tasks” from the dashboard now works.** The
  workbench hides the sidebar to use the full width, but those buttons only
  switched the sidebar view — so nothing visible happened. Navigating to any
  sidebar view (pipeline, acceptance, tasks, todo, Git, search, memory) now
  closes the dashboard first so the sidebar appears.
- **“Start and dispatch” is only offered for a pending or failed stage.** It
  starts the stage and sends the role prompt to the team; a stage that is
  already running now shows an **In progress** pill and a **resend role prompt**
  link instead (clicking start on a running stage used to fail silently because
  the error was only rendered in the pipeline view). An awaiting-review stage
  shows **Awaiting review**. A short hint explains what the action does.
- The stage progress strip is now **labelled chips** (✓ requirement, ✓ design,
  ● development, ○ testing, ○ sign-off, ○ release) instead of anonymous bars,
  clickable to open the pipeline; the caption reads **“Completed 2/6 ·
  current: development”**. Fast mode stays on the project card.

### Tasks panel: run history and results instead of a bare detector list

- The Tasks / retest panel was rebuilt around outcomes: the toolbar now shows the
  **latest run** (status dot, command, pass/fail or exit code, duration) with a
  compact “detect again” link, detected project commands appear as **quick-run
  chips** grouped by kind, and a **run history** lists every run with duration,
  status and stop/remove actions (newest first, selectable).
- The selected run gets a detail header (command, problem count, failure badge),
  the existing clickable Problems list (jumps to file:line), a “send failure to
  agent” action, and the output console. Empty states explain how to start, and
  the old always-on hint text was dropped now that the summary carries the
  context.

### Fix: welcome screen showed raw locale keys

- The welcome redesign added `welcome.save`, `welcome.rename`,
  `welcome.delete`, `welcome.workbenchDesc`, `welcome.browserDesc`,
  `welcome.quickOpen`, `welcome.quickOpenDesc` and `welcome.terminalDesc`
  to the markup but not to the zh/en dictionaries (the dictionary uses bare
  identifiers for the neighbouring keys), so the screen rendered the key names.
  The keys are now registered flat ('welcome.save': …) in both dictionaries, and
  an audit confirms every `t('…')` key used in the client resolves in both
  languages (705 keys, 0 missing).

### Welcome screen redesign

- The empty-workspace screen was rebuilt as a small landing page: framed hero
  icon, title, one-line hint, keyboard keycaps (⌘/Ctrl+S · F2 · Delete), a
  full-width primary “new file” action and a 2×2 grid of action cards with icons
  and one-line descriptions — Workbench (project progress / intake /
  acceptance), built-in browser, quick open (⌘/Ctrl+P) and terminal. Cards have
  hover and press feedback; the grid collapses to one column on narrow layouts.
  The old vertical button stack and its shortcut line are gone.

### Sidebar: Git is a first-class tab again

- The visible sidebar strip is now **Files / Search / Git / More** on local
  workspaces (Git hides itself on SSH roots, which keeps the three-slot layout
  there). The overflow menu keeps the Home, Project and Development groups;
  Git no longer appears twice.

### Requirement intake: from screenshots and text to a running delivery

- The Workbench intake card now accepts a pasted requirement plus **screenshots
  and requirement documents** (drag-and-drop or file picker, up to 8 files,
  25 MB each). Submitting creates a local intake record under
  `.dsh/intake/<timestamp>/` (text, attachment list and copied files), optionally
  switches the pipeline to fast mode, and sends an orchestration prompt to the
  conversation: the product manager turns the intake into
  `docs/pipeline/requirements.md` + acceptance items, sets the pipeline
  requirement and starts the product stage, then the Lead keeps dispatching
  design/development/testing (auto-approved in fast mode) and stops at the
  approval gate.
- The intake UI is full-width (spanning the grid), with a dashed drop zone,
  attachment chips with sizes and removal, an “auto-advance” checkbox (on by
  default) and a submission notice pointing at the intake folder.
- Workbench polish: card hover transitions, larger project actions, and clearer
  primary/secondary button emphasis. The inline fast-mode toggle stays on the
  project card once a project exists.

### Workbench moved to a full-width main-area page

- The Workbench is no longer a sidebar pane: it now occupies the main content
  area as a full-width dashboard (max 980 px, responsive card grid, single
  column on narrow screens) with a compact header and a close button. Opening a
  workspace with an issued requirement lands there by default; the sidebar keeps
  Files / Search / More (with a Home group containing Workbench in the overflow
  menu, plus a Welcome button and the command palette entry).
- Opening any file from the explorer leaves the Workbench for the editor; closing
  the Workbench (×) returns to the open tabs or the welcome page. On compact
  layouts the page takes the whole width and the back button returns to the file
  tree.
- The page keeps the direct actions added earlier (fast-mode toggle, rerun failed
  task, export report, pack delivery, download latest bundle, preview copy/open)
  and the five-second auto refresh; cards are larger and the attention card spans
  the full grid row when something needs the owner.

### Workbench direct actions and touch polish (P3/P4)

- The Workbench now carries the actions the owner needs most: a **fast-mode**
  toggle, a **rerun failed task** button, export report / pack delivery / download
  the latest bundle, and copy/open the first preview link — no need to hop to
  Pipeline, Acceptance or Tasks for routine work.
- Workbench layout prioritises what needs the owner: the attention card (pending
  gate, failed acceptance items) moves to the top when non-empty; the project
  card gains a six-segment progress strip, and acceptance/delivery are merged
  into one compact card. The panel refreshes itself every five seconds and only
  loads the task run list (no project scan) while open.
- Mobile polish: the grouped "more" menu becomes a bottom sheet with a dimmed
  backdrop, taller 42 px rows, larger group headings and a 38 px bottom bar;
  workbench buttons and links grow to touch-sized targets on compact layouts.
- Loading the workbench no longer triggers task detection scans; the Tasks view
  still detects on demand.

### Owner workbench and sidebar consolidation

- New **Workbench** sidebar view and landing page: one screen shows the current
  project (requirement, stage progress, continue/start/approve actions), what
  needs the owner now (pending gates with pass/request-changes and an optional
  note, failed acceptance items with a “send to agent” action), acceptance
  counts and the top failed items, delivery actions (export report, pack
  bundle, copy preview link) and running/finished tasks.
- The sidebar top level is reduced to **Workbench / Files / Search / More**. The
  “More” menu groups the other views into **Project** (pipeline, acceptance,
  todo) and **Development** (tasks, Git, memory), keeps the running/failed
  badges on the More button, and marks it active when a grouped view is open.
- Landing rule: a workspace with an issued requirement opens on the Workbench;
  otherwise the last view used in that workspace is restored (per-workspace
  localStorage), and the explorer is the final fallback. The workbench refreshes
  pipeline/acceptance/tasks/delivery data on open.
- PLAYBOOK, the OPC README and the IA plan document are updated to match the new
  navigation; the command palette still reaches every view directly.

### Planned: owner workbench and sidebar consolidation

- Added `docs/UI_IA_PLAN.md`, a planning document (no behaviour change yet) for
  the sidebar: it inventories the current eight views, compares a two-mode
  switch, a flat reorder and a workbench-plus-grouped-overflow approach, and
  recommends a **Workbench** landing view plus a four-slot top level
  (Workbench / Files / Search / More) with the overflow menu grouped into
  **Project** (pipeline, acceptance, todo) and **Development** (tasks, Git,
  memory). It includes a workbench wireframe with sections for the current
  project, what needs the owner now, acceptance summary, deliverables and
  running builds, plus default-landing rules, a six-phase cost estimate and
  acceptance criteria. Three owner decisions are left open at the end.

### Fast mode: the owner only handles the two real gates

- The pipeline gained an owner setting `.dsh/pipeline.json → settings.gateMode`
  (`normal` | `fast`): the panel exposes it as a **Fast mode** checkbox.
- In fast mode, the four intermediate stages (product, design, development,
  testing) are **auto-approved when submitted**: the summary and artifacts are
  recorded with a “owner pre-authorized (fast mode)” note, and the submit tool
  result reports `autoApproved: true` plus the next stage id so the agent keeps
  going without a human round-trip. The approval and release gates always stay
  manual — fast mode never auto-approves them.
- The pipeline panel now treats an active `approval` stage as an owner gate (pass /
  request-changes in the top banner), keeps the stage cards as detail, and
  refreshes itself every five seconds while visible so agent-driven advances show
  up without pressing refresh. The system-prompt guide explains the fast-mode
  behaviour to the model.
- PLAYBOOK’s three-step minimal usage and the OPC README now recommend fast mode:
  the owner writes the requirement, approves the final sign-off and release, and
  collects the delivery package.

### Simpler owner flow: one-click kickoff, auto-advance, action banner

- The pipeline panel now has a single primary action for the owner: **“Kick off:
  save and dispatch”** saves the requirement and starts the product stage in one
  click (the separate “save only” stays for later edits).
- Approving a stage now **auto-starts the next stage and dispatches its role
  prompt**, so the owner only clicks pass / request-changes instead of also
  starting every stage by hand. The human approval stage is started without a
  role prompt (it is the owner's gate), and release dispatches the ops prompt
  after sign-off.
- A single **“what needs you now”** banner sits at the top of the pipeline panel:
  a pending review with pass/request-changes buttons and an optional note field,
  an in-progress notice, or a next-step start button — the stage cards below stay
  as advanced detail. The review note field only appears while a review is
  pending.
- PLAYBOOK gained a three-step “minimal usage” section, and the OPC README now
  leads with the shortest path so the owner does not need to learn stages, tools
  or prompts.

### OPC (one-person company) team charter and role handbooks

- New `docs/opc/` team workspace: a company charter (`00-charter.md`) defining
  mission, the five standing roles plus Lead and Owner, decision rights
  (RACI), the six-stage cadence, definition of done, escalation paths and data
  boundaries, and one role handbook per role — product manager, UI designer,
  full-stack engineer, QA and ops — each with boundaries (what the role must and
  must not do), inputs, artefact templates, pipeline SOP, quality checklists,
  hand-off notes and failure modes.
- `docs/opc/README.md` is the team index: it maps the standing roles to the
  session's durable teammates, documents the Lead's orchestration rules
  (task board, dependencies, dispatching stage prompts, waiting, gate handling)
  and gives the Owner a copy-paste kickoff message for a new project.
- The five handbooks were written and cross-checked by the five standing role
  members themselves, so the boundaries and the pipeline they run match the
  implementation. README and PLAYBOOK link the new workspace.

### Requirement-to-delivery playbook

- `docs/PLAYBOOK.md` walks a project manager through one full delivery with the
  plugin: preparation and cleanup, issuing the requirement, all six pipeline
  stages (who executes, what to produce, which panel/tool to use), both human
  gates, the release record, and the client hand-off (report, evidence, delivery
  zip, preview share link, delivery history). It includes a copy-paste prompt
  template for dispatching a stage to the Lead/agent team, a per-stage checklist
  for the owner, the client deliverable list, and the common pitfalls (restart,
  no stage skipping, no model approvals, SSH limits, reusing a workspace).
  README and AGENT_TEAM link it.

### Delivery pipeline with role-bounded agent team

- New **Pipeline** sidebar view on top of `.dsh/pipeline.json`: a requirement moves
  through six stages — product manager (requirements), UI designer (design),
  full-stack development, QA testing, project-manager sign-off, ops release. Each
  stage has a fixed role and can only start after the previous stage is approved;
  the product stage needs a saved requirement (title + detail).
- Dispatching a stage marks it active and sends that role's prompt to the
  conversation: requirement, upstream summaries/artefacts, what the role does and
  does not do, the deliverables to produce, and the rule that the model must call
  `pipeline_submit_stage` and must never approve its own work. The Lead is expected
  to organize the real multi-role execution with the native Harness team tools
  (`spawn_teammate`, `team_task_*`, `send_message`), which the plugin neither
  duplicates nor replaces.
- Owner gates: every submitted stage waits in **review** for the project manager
  to approve or send back with a note; a rejection becomes `failed` and can be
  reopened. The human approval stage is the only way to unlock release, and the
  ops stage records releases (environment, URL, notes) in the pipeline document
  and the panel.
- Host side: new `pipeline.js` store with per-root locking, atomic writes, symlink
  guards and the same safety limits as the acceptance board; five model tools
  (`pipeline_status`, `pipeline_stage_prompt`, `pipeline_set_requirement`,
  `pipeline_start_stage`, `pipeline_submit_stage`) plus
  `pipeline_record_release` for ops, and a system-prompt guide. Approval has no
  model tool on purpose.
- `docs/AGENT_TEAM.md` documents the six roles, boundaries, gates, the end-to-end
  runbook and how the pipeline composes with Harness Agent Teams.

### Acceptance runbook and task-failure hand-off

- `docs/ACCEPTANCE.md` now walks a project manager through retesting batches
  0–3 (stability, tasks/retest, acceptance/review, evidence/delivery/share links),
  including the one-time Harness restart, known limits and rollback notes. Both
  READMEs link it.
- A failed task in the Tasks panel can send its parsed problems plus the output
  tail straight to the conversation, closing the retest loop without copying logs.

### Preview sharing for client hand-off

- The Acceptance panel can **share a running dev server**: enter the local port,
  the Host starts a small reverse proxy on its own random port with a 32-hex token
  path and returns a link like `http://<harness-host>:<preview-port>/<token>/`.
  LAN phones and remote reviewers open that link directly; the panel can copy it,
  open it, or close the share. The proxy streams HTTP responses, rewrites HTML
  (injects `<base>`, prefixes absolute `src`/`href`/`srcset`/`url()` values,
  rewrites redirects) and proxies WebSocket upgrades so Vite HMR keeps working.
  Eight shares per Host, 30-minute idle shutdown, loopback targets only, token
  compared in constant time, no request query values logged. Only HTML is
  rewritten: front-end code that builds absolute URLs in JavaScript needs the dev
  server's `base` configured accordingly, and public access requires the preview
  port itself to be reachable.

### Delivery history

- Every packed delivery bundle is now recorded in `.dsh/deliveries.json`
  (name, relative path, size, file count, timestamp, whether the acceptance
  report was included; newest 100 kept, atomic rename). The Acceptance panel
  lists the latest bundles with a download link, so a client hand-off can be
  repeated or audited later without hunting the filesystem.

### Acceptance evidence

- The Acceptance panel can now store **evidence** per workspace: pick screenshots
  (or PDFs/logs) and they are uploaded to `.dsh/evidence/`, shown as thumbnails in
  the panel, and the selected acceptance item gets a `证据：<path>` line appended to
  its note automatically. Clicking a thumbnail opens the file in the editor's
  image/PDF preview. Uploads reuse the IO bundle (128 MB cap, unique names) so
  nothing new is exposed on the Host. Generated evidence files live under
  `.dsh/`, which the plugin already keeps out of Git.

### Event-driven workspace sync

- The file tree no longer re-lists every expanded directory on a five-second timer.
  A new Host watcher (`/api/dsh-web-filebrowser-watch`) keeps non-recursive
  `fs.watch` handles for the workspace root and the expanded directories the
  browser names, coalesces bursts and parks the request until something changes
  (up to 10 s per poll), so changes made by the agent or the terminal show up
  almost immediately. It is bounded (96 directories, 128 queued paths), idle
  roots are reaped after five minutes, SSH roots are not watched, and a Host
  without the route makes the client fall back to the old five-second pass. Open
  file contents keep their own five-second check.

### Acceptance board, review marks and client delivery

- New **Acceptance** sidebar view on top of `.dsh/acceptance.json`: items can be
  pending / pass / fail / blocked, carry a note, be added inline, edited and
  removed; the header shows live counts and the tab badge warns about failed
  items. Mutations go through the Host and the same document is exposed to the
  model through the `acceptance_*` tools, so the agent can write acceptance
  criteria and back-fill results.
- **Export and hand-off**: one button exports the checklist as a Markdown
  acceptance report; another sends every failed item (with notes) back to the
  current conversation; a third downloads the build output as a ZIP; a fourth
  packs the report plus build output into `.dsh/deliveries/` and offers the
  download. The panel shows the exact bundle path.
- **Review marks**: every row in the Git changes list gains a **reviewed** toggle.
  Marks are stored per workspace, survive reloads, and lapse automatically when
  the file's status changes again; the section title shows `Reviewed n/total`.
  Per-file rollback stays on the existing discard button, so an agent change can
  be reviewed and reverted without leaving the panel.

### Tasks and retest panel

- New **Tasks** sidebar view (between Todo and Git) on top of the Host task
  runner: it detects project commands (package.json scripts, Makefile targets,
  Cargo, Go, pytest/Django, docker compose), runs them, streams the output with a
  long poll, shows running/finished state and the exit code, and can stop a task.
- Output from `tsc` (both `file(line,col): error TSxxxx:` and
  `file:line:col - error` styles), eslint stylish output and generic
  `file:line:col: error:` lines is parsed into clickable problems; clicking one
  opens the file at that line/column. The tab shows the number of running tasks,
  and tasks still running when the page reloads are re-attached to their output.
- The panel reuses the task runner's project detection cache and hides the
  explorer-only pane actions; the view is also reachable from the command
  palette.

### Stability pass and Host groundwork for the acceptance workflow

- **Session restore**: open text tabs, their unsaved buffers (up to 24 tabs /
  512 KiB, active tab's line) are snapshotted to localStorage and reopened after
  a reload in the same workspace, so a refresh no longer loses the editor state.
- **Terminals survive reloads**: the browser no longer closes every Host PTY on
  `beforeunload`. A new `list` terminal op lets the client re-attach to the live
  sessions of the current workspace after a reload (buffered output is replayed),
  a dev server started before the refresh keeps running, and the Host reaps
  sessions no browser touched for 12 hours instead of leaking all 8 slots.
- **Render safety**: the workspace panel is wrapped in an error boundary, so a
  failing sub-panel cannot blank the Harness page; a retry remounts it. Losing
  the network now shows a banner and refreshes the workspace automatically once
  the browser is back online.
- **Quick Open honesty**: when the Host file index hits its 5000-file cap, the
  palette now says so instead of silently hiding files.
- **Host modules for the next batches** (routes registered, UI follows):
  `tasks.js` — project task runner (`start` / `poll` / `kill` / `list` /
  `detect`) with a 1 MB output ring and long-poll delivery, per-root concurrency
  and process-group kill; `acceptance.js` — the workspace acceptance checklist
  (`.dsh/acceptance.json`, four states, checked timestamps, Markdown report) with
  five model tools and a prompt section, so the agent can write acceptance items
  and the owner can check them; `delivery.js` — a zero-dependency streaming ZIP
  writer that packages `dist`/`build`/`out`/`.output`/`public` (or explicit
  targets) for client hand-off and can bundle the acceptance report.
- New Host routes: `/api/dsh-web-filebrowser-tasks` and
  `/api/dsh-web-filebrowser-delivery`, plus `acceptance*` operations on the main
  route. **These are Host-side changes: restart Harness once to load them**
  (browser refresh covers the client half).

### Full-project development roadmap

- Added **`docs/ROADMAP.md`**: a prioritized plan (P0–P3) for developing complete
  projects with the Harness chat plus this workspace. It covers the run/diagnose/
  test loop (task center, Problems panel, test runner, global status bar), agent
  change review and rollback, session and terminal recovery, Git completion
  (hunk staging, conflicts, clone), workspace-wide search/replace, a CodeMirror 6
  editor foundation, a lightweight LSP bridge, agent-driven browser verification,
  preview reverse proxying, and secrets/deploy work — with Harness integration
  points (jobs, terminal, deliverables, settings, shortcuts, document actions),
  costs, risks and an acceptance checklist. Both READMEs link the roadmap. No
  runtime behaviour changed in this entry.

### Harness panel moved to a header icon

- The low-frequency **Harness** info panel no longer takes a permanent slot in the
  sidebar view strip. A small icon in the header action cluster (between the
  browser and maximize buttons) opens and closes it, so File / Search / Todo / Git
  / Memory keep the primary strip and narrow-screen bottom bar to themselves.
  Clicking the icon again, or the × in the panel's title bar, restores the sidebar
  view Harness was opened from; opening it while the editor is maximized first
  restores the sidebar. The button shows the brand tint while the panel is open,
  and the pane title still reads **Harness**.
- Because the panel is no longer a sidebar tab, the strip no longer needs a
  permanent **More views** button: it returns to appearing only when the tabs do
  not fit. The command palette entry is renamed to **Harness info**, matching the
  button tooltip.

### SSH terminals

- A terminal opened in an `ssh://user@host:port/path` workspace now runs on the
  remote host: the Host requests a PTY and execs the login shell through the
  ssh2 connection the file panel already pooled, starting in the remote
  workspace root. Input, output, `Ctrl+C`, resizing (mapped to
  `window-change`) and close follow the same path as the local PTY, and the
  tab/status bar label the session as SSH.
- The shell shares the pooled SSH connection with file operations, so a
  password entered in the SSH connect dialog is reused without being stored.
  When the connection drops or DSH restarts, reconnect the SSH workspace in the
  file panel (or use ssh-agent / `~/.ssh` keys); an auth failure explains this
  in the terminal.
- SSH terminals skip quick-command detection because the project files live on
  the remote host. The quick-command area shows an **SSH terminal** label
  instead of the picker, while the command input still sends commands.

### Terminal output latency and manual command refresh

- Terminal output is no longer delivered by a fixed 140 ms poll. The Host now
  holds the poll for up to one second and answers the moment the shell writes
  anything, so keystroke echo and command output reach xterm.js immediately; an
  idle terminal costs about one request per second instead of seven. A Host
  that does not support the hold (an older build after a browser-only reload)
  is detected through the `longPoll` flag and the client falls back to the old
  interval without spinning.
- The browser asks for output as soon as it has finished writing input, so a
  keystroke echo does not wait out the idle interval even against a Host that
  predates the long poll. Output that arrives in many tiny chunks is coalesced
  with a 12 ms gap before the next poll, so a chatty command produces fewer,
  larger terminal writes instead of one round trip per chunk.
- A full 1 MB output buffer is now trimmed in one slice only after it grows a
  little past the cap, instead of copying the whole buffer on every incoming
  chunk. Heavy output (builds, `yes`, progress bars) no longer makes the
  terminal sluggish.
- The quick-command bar is filled only by two triggers: its refresh button
  (manual, forces a rescan) and the one-off follow-up after `cd` / `pushd` /
  `popd`. Nothing is detected when a terminal opens, and the 20-second timer,
  window-focus and tab-visibility refreshes are gone. The empty hint now says
  that detection is manual. A list detected once is remembered for that live
  session, so moving the terminal or switching panel tabs does not blank it
  (restoring it does not scan the Host). The Host-side 30-second cache still
  applies.
- The quick-command refresh button now sits right beside the command picker
  instead of at the far right of the bar, past the free-width input. On narrow
  layouts the picker and its button share the first row, and the input and
  **Run** share the next one.

### Bookmark delete confirmation

- Deleting a bookmark from the browser start page now opens a confirmation
  dialog showing its alias, with a red **Delete** button. Cancel, Esc or clicking
  the backdrop aborts; the address itself is never affected.

### Workspace fullscreen mode

- The panel header has a new fullscreen toggle for the whole workspace: it fills
  the real browser viewport while keeping the explorer, tabs, browser/editor,
  terminal and status bar available. It uses the native Fullscreen API when
  available and a fixed-position CSS fallback for iOS Safari and embedded
  webviews, so it also works on phones and tablets (safe-area insets are
  respected). Press Esc or the exit-fullscreen button to leave. This is separate
  from the Maximize editor button, which only hides the explorer inside the
  component.

### Bookmark aliases

- Each saved address on the browser start page now has a pencil button. Edit the
  display name inline: Enter or the save button persists it, Escape cancels, and
  an empty alias restores the automatic `host+path` name. The URL, viewport and
  position in the list are unchanged.

### Mixed-content note auto-closes

- The built-in browser's HTTPS/HTTP mixed-content note now hides itself after
  three seconds. The × button still dismisses it immediately, and it reappears on
  reload, navigation or a Direct/Proxy switch as before.

### Browser bookmarks and start-page settings

- The built-in browser can now keep **bookmarked addresses**: click the star in
  the browser toolbar to save the current page, and the active **PC / Mobile**
  mode (device preset and orientation) is stored with it. Clicking the filled
  star again removes the bookmark.
- The browser start page lists saved addresses; one click reopens the page in its
  saved viewport, and each row has a remove button. Removing or adding a bookmark
  updates the list immediately.
- The start page's **Protocol / Host** fields are saved with the workspace too
  (debounced while typing, flushed on blur/tab switch), so port shortcuts keep
  working after a reload, a browser-data wipe or accessing Harness from a
  different origin. They continue to be mirrored to `localStorage` as a fallback.
- Bookmarks and settings are stored **per workspace** in
  `.dsh/browser-bookmarks.json` instead of `localStorage`, so they travel with the
  project. The generated `.dsh/.gitignore` (`*`) keeps the file out of Git; SSH
  remote workspaces cannot store them. The list is capped at 50 entries, and both
  the file and its directory are checked so a symlink cannot escape the workspace.
  Bookmarks saved by the earlier localStorage build are imported once into the
  first workspace whose list is empty, then the legacy key is removed.

### Fix editor Agent send

- The editor **Agent** actions failed with “当前会话不支持发送消息” on DSH
  0.2.1: the plugin looked the live Session up through `sessions.get()`, an
  API `ClientSessions` no longer exposes, so every send aborted before the
  prompt left the browser. The live Session is now resolved through the
  retained binding (`sessions.binding(id).session`), the same path the
  built-in composer uses.

### Update prompt repository

- Point the version check, the GitHub link and the plugin-manager install command
  at the canonical repository **`taskkill/dsh-web-dev-workspace`** (the old
  `taskkill/dsh-web-filebrowser` URL only redirects). The update dialog now
  interpolates the repository URL from one constant, and both package manifests
  carry the same `repository`, `homepage` and `bugs` metadata.

### Terminal quick-command performance

- Reduce the cost of terminal quick-command detection, which could make terminal
  output feel sluggish in large workspaces:
  - The Host caches a detected command list for 30 seconds instead of 5; the
    refresh button sends a forced rescan, while background polls reuse the cache.
  - Recursive `.jar` / `.dll` discovery now runs only when the root looks like a
    Java or .NET project (or contains a root-level artifact), instead of walking
    up to 4,000 files on every refresh in a normal JS/Python project.
  - The client stopped rescanning after every command and only follows a
    directory change (`cd` / `pushd` / `popd`); the later timer removal is
    described under **Terminal output latency and manual command refresh**.
  - The panel now updates its command list only when the detected commands or
    root actually change, so polling no longer re-renders the terminal every few
    seconds.

### Workspace todo list

- Add a **Todo** sidebar tab backed by `.dsh/todos.json` in the current local
  workspace. Quick-add tasks with priority, due date and tags; edit title, note,
  priority, deadline and tags inline; check tasks off, reopen them, delete one or
  clear every completed task in one step.
- The panel shows open/done counts, a completion bar, overdue counts and due-date
  states (overdue/today/tomorrow). Filter by open/done/all, search titles, notes
  and tags, and sort by priority, due date, last update or creation time; the
  filter and sort choices persist in localStorage.
- Add model tools `todo_list`, `todo_add`, `todo_update` and `todo_delete` plus a
  short system-prompt guide. They are deliberately separate from the built-in
  session `todo_write` plan tool: these tools curate the user's persistent
  workspace board.
- Every mutation returns the refreshed board so the panel stays consistent even
  when the model edits tasks at the same time. The panel re-reads the document
  every eight seconds and on window focus while it is visible (never while an
  inline edit is open); writes use a temp-file rename under a per-root lock.
- Todo state is confined to the workspace: a `.dsh` directory or `todos.json`
  that is a symlink (or resolves outside the root) is refused, and SSH remote
  roots keep the panel read-only with an explicit explanation. The first write
  creates `.dsh/.gitignore` (`*`) when absent.

### Git change badge

- The **Git** sidebar tab now shows an amber count badge when the workspace has
  uncommitted changes. The count is the number of distinct changed paths across
  staged, working-tree and untracked entries, capped at `99+` on the tab.
- The hidden Git panel refreshes its status every thirty seconds (and on window
  focus) while the workspace is a repository, so the badge also reacts to editor
  saves and external changes. It updates immediately after Git actions and
  disappears when the workspace is clean or is not a repository.

### Responsive sidebar view switcher

- The sidebar's bottom view tabs now adapt to the available width instead of
  squeezing every label into one row: full labels when they fit, icon-only tabs
  with tooltips when the sidebar narrows, and icon tabs plus a **More views**
  menu when even the icons no longer fit.
- The active view always stays in the visible strip (it is swapped into the last
  slot if necessary), the Todo icon keeps its open-task badge, and the overflow
  menu lists every view with icons, labels and the same badge. The menu closes on
  selection, Escape, a change of view or a resize.

### Open-file change detection

- Open local text files are now checked every five seconds and whenever the window
  regains focus. A clean tab reloads automatically when the file changes on disk
  (with a toast for the active tab); a tab with unsaved edits shows a warning with
  **Reload** and **Keep my changes** instead of silently applying the external
  change. SSH roots follow the existing local-only auto-refresh policy.
- Saving and reloading mark the tab as busy so the watcher cannot race an
  in-flight write or read.

### Renamed to Development Workspace

- The plugin is now **Dev Workspace** (开发工作区) instead of "Workspace Files".
  Package names and loader ids move to `@local/dsh-web-dev-workspace`,
  `@local/dsh-web-dev-workspace-io` and `@local/dsh-web-dev-workspace-git`; the
  panel title, sidebar tooltip, welcome page, guide card and plugin-list titles
  use the new name.
- API routes (`/api/dsh-web-filebrowser*`), locale keys, browser storage keys and
  the saved right-sidebar tab kind are unchanged, so existing installs keep their
  preferences and layouts after the rename. Restart the Host and refresh the page
  to load the new module id; plugin-manager installs must be reinstalled under the
  new package name.

### Cross-session workspace memory

- Add **workspace memory**: durable notes stored per local workspace in
  `.dsh/memory.json` and shared by every chat session that runs in that
  workspace. Memory never crosses workspace boundaries; an ungrouped session
  falls back to its recorded working directory.
- The model gets four tools — `memory_save`, `memory_search`, `memory_update`
  and `memory_delete` — and a short system-prompt guide. Existing notes are
  injected automatically as bounded `workspace-memory` context on every request,
  so a new session starts with the facts earlier sessions saved.
- Add a **Memory** sidebar tab: review, add, edit and delete entries (with tag
  chips) without leaving the file workspace. A generated `.dsh/.gitignore`
  keeps plugin state out of Git; the JSON document can also be edited by hand.
- The feature is optional: profiles without the `tools` or `systemPrompt`
  services keep the file browser fully usable, and SSH remote roots have no
  local memory.
- Memory state is confined to the workspace: a `.dsh` directory or
  `memory.json` that is a symlink (or resolves outside the root) is refused,
  and writes use a temp-file rename under a per-root lock.

### Unreadable file downloads

- Binary, too-large and read-error tabs now offer a **Download** action directly in
  the empty state, alongside reload/browser actions.

### Workspace-aware opening

- When the code workspace is opened from a workspace session, it now selects that
  session's workspace as the root (or follows a later session workspace change while
  the current root is still the auto-selected one). A manual workspace switch stops
  the automatic following.

### One-click update and terminal cwd refresh

- The update dialog now has **Update now** for clean local git checkouts: it runs
  only `git pull --ff-only`, refuses a dirty tree, shows the command output, and
  asks for a DSH restart instead of restarting the Host silently.
- Terminal quick commands follow the shell's live cwd on Linux (via `/proc`),
  refresh every few seconds and expose a manual refresh button, so switching to
  another project updates the detected commands.

### Responsive layout

- The floating conversation becomes a full-screen sheet only in mobile/tablet
  browsers (UA-detected); a narrow desktop window keeps the floating panel.
- Adapt the workspace for phones and tablets: compact single-column explorer/editor
  below 900px, a wrapping header with a full-width address row, larger touch targets,
  a clamped sidebar width on tablets, stacked Markdown split view, and narrow-screen
  fixes for the terminal quick commands, search, Harness panel, dialogs and palette.

### Markdown split view

- Markdown tabs now offer **Preview / Edit / Split**. Split shows the editor on the
  left and live preview on the right, with a draggable divider (double-click to
  reset), automatic vertical stacking on narrow panels, and independent scrolling.

### Terminal quick commands

- Add a quick-command bar to every terminal. The Host detects package scripts,
  Maven/Gradle, Java jars, .NET projects/DLLs, Django, Go, Cargo and Docker Compose
  commands for the workspace; pick one, edit if needed, and run it. Arbitrary
  commands can still be typed directly.

### Explorer

- Match VS Code Explorer behavior: chains of single-child folders collapse into one
  `parent/child/grandchild` row, and expanded empty folders render no placeholder.

### Agent collaboration

- Add an **Agent** action to the editor toolbar: send the selected code (or the
  whole file) to the current floating conversation with prompts to explain, fix or
  write tests. The action opens the chat when needed and never applies changes
  automatically.
- Agent requests are explicit; browsing, search and auto refresh do not send file
  content to the model.

### Search, navigation and Harness panel

- Add a Search sidebar tab with workspace-wide content search, case sensitivity,
  regular expressions, grouped results and jump-to-line. Local workspaces only;
  dependency/build directories are skipped and files are capped at 2 MiB.
- Add `Ctrl/⌘+P` Quick Open and `Ctrl/⌘+Shift+P` command palette.
- Add `Ctrl/⌘+F` find/replace inside the editor, including replace all and case
  sensitivity.
- Poll expanded local directories every five seconds so external changes appear
  without a manual refresh.
- Add a Harness sidebar tab showing the active profile, plugin version, bundles,
  dependencies and whitelisted profile config files, with `npm run check` output.

### Version and update hints

- The update dialog now shows the GitHub repository URL plus copyable `git pull`
  and `dsh plugin --profile web add github:taskkill/dsh-web-dev-workspace` commands.
- Show the bundle version in the workspace header. Clicking the badge checks the
  public `package.json` in `taskkill/dsh-web-dev-workspace` on GitHub (cached for six
  hours), highlights a newer version, and explains how to update a local checkout
  or a plugin-manager install. The hint compares the manifest `version`, so each
  release must bump it.

### SSH

- Add optional one-time password authentication for SSH roots. A password is used
  only to establish the current connection, is kept in memory for that attempt,
  is never written to disk, and must be re-entered after the connection drops.
  When an SSH root cannot authenticate, the tree offers an **Enter password**
  action instead of only a retry.
- Fix the blank panel when opening **Add SSH remote…**: the dialog referenced an
  undefined `tab` variable while choosing its autofocus target.

### Terminal

- Fix `spawn script ENOENT` on Windows: the local terminal now uses `cmd.exe`
  with UTF-8 output, local line echo, process-tree cleanup and a no-PTY resize
  fallback instead of the POSIX-only `script(1)` command.

### Floating chat

- Add a header **chat** button that opens the current DeepSeek conversation as a
  movable, resizable floating panel in both main-panel and right-Sidebar
  placements. The panel shares the Session's real Conversation surface, including
  messages, streaming, drafts and attachments, and stays usable while the file
  workspace is maximized.
- Allow collapsing the floating conversation to its title bar and expanding it
  again, so the panel can stay out of the way without losing the conversation.
- Add a **+** action to create a new Session in the current workspace and show it
  in the floating panel without leaving the file workspace. SSH workspaces report
  that new conversations are unavailable there.
- Add a conversation selector to the floating panel header: pick another Session
  from the same workspace to bind the panel to it, or return to the Session
  selected in the main UI.

### Explorer layout

- Add a left/right switch for the explorer; the position is persisted and the
  resize splitter follows the chosen side.
- Move **Collapse all**, **Show/hide hidden files** and **Go to workspace root**
  out of the “…” menu and onto the always-visible explorer header, next to the
  refresh action. The redundant menu is removed.
- Add **Copy absolute path** to the file/folder context menu, alongside
  **Copy relative path**.

### Git

- Put working-tree changes above the staged section in the Changes view, matching
  the usual stage-from-top workflow.
- Add **Restore** actions for individual changed/staged files and for all
  working-tree changes. Tracked files are restored from the index or `HEAD`,
  untracked files are deleted from disk, and every destructive action asks for
  confirmation first.
- Add a **Stash** toolbar button and dialog: save changes with an optional message
  and optional untracked files, then apply, pop or drop entries. Conflicts keep
  the stash and surface a readable error. The toolbar badge shows the stash count.

### Sidebar tabs

- Explorer and Git are now switched by two tabs at the bottom of the sidebar;
  the Git panel stays mounted so a draft commit message survives tab switches.
  The Git tab is hidden for SSH roots. Tabs are compact (26 px) to leave room for
  future sidebar views.

### Terminal

- Add a local interactive terminal with vendored xterm.js and a Host-side PTY.
  Sessions can live in editor tabs or a resizable bottom panel and can be moved
  between them; output is buffered while hidden. The welcome page also has an
  **Open terminal** shortcut. Local workspaces only, max 8.

### Built-in browser

- Add browser tabs with an address bar, history, reload and external open, so a
  running dev server can be previewed next to the code.
- Make the HTTPS mixed-content warning dismissible; it returns on reload,
  navigation or Direct/Proxy changes.
- Add a Maximize editor/Restore layout button that hides the explorer and lets
  the editor or browser fill the file-workspace component without browser
  fullscreen.
- Add persisted Protocol (Auto/HTTP/HTTPS) and Host fields on the browser start
  page so all detected/common port shortcuts can use one scheme and host.
- Add PC/Mobile viewport switching with iPhone/Pixel/iPad presets, landscape
  rotation and automatic scaling to the panel.
- The start page detects listening local TCP ports (Linux `/proc/net/tcp`) and
  offers one-click links, with common-port fallbacks elsewhere.
- Preview uses a sandboxed iframe limited to http/https; the Harness origin and
  loopback same-port pages are refused. Public pages load directly by default;
  a Direct/Proxy toolbar toggle switches to a Host-side proxy (public IPs only,
  no cookies, 8 MB cap) that strips frame headers and injects a base/link bridge.
  Complex or authenticated sites may still render incompletely, with an
  external-browser fallback.

### Packaging

- Rename the project and package identity from `dsh-side` to
  `dsh-web-filebrowser`: the combined bundle is `@local/dsh-web-filebrowser`,
  routes are under `/api/dsh-web-filebrowser*`, and browser preferences saved
  under `dsh-side:` are copied to the new keys on first load. The old
  `/api/dsh-side*` routes remain as deprecated aliases so a tab opened before
  the rename keeps working until Harness is restarted.
- The three components are now one combined bundle at the repository root
  (`@local/dsh-web-filebrowser`, `index.js` + `cordis.patch.yml`). Install the root once;
  the bundle starts the explorer/editor, binary I/O and Git components together.
  Subdirectory installs remain possible for development only.

### Git

- Add a commit graph inside the Git view (Changes / Commit graph tabs). It shows
  Git lanes for all refs, ref labels and merge parents; clicking a commit expands
  its changed files and clicking a file opens that commit's diff in the editor.
- Fetch, pull and push from the Git panel, with ahead/behind badges on the
  toolbar; the first push sets `origin/<branch>` as the upstream.
- Pull is fast-forward only by default and explains a diverged branch instead of
  merging or rebasing automatically; pushes never force.
- Commit & push action that commits staged changes and pushes in one step.
- Compare modal: pick upstream, a local branch or a remote branch, then review
  commits unique to each side, ahead/behind counts and files changed since the
  merge base, with a per-file diff against the base.
- Status now reports configured remotes; network actions are disabled when the
  workspace has no remote.
- Network failures (missing auth, unreachable remote, rejected non-fast-forward
  push, divergence) map to actionable messages; credentials are never collected
  or stored and interactive prompts are disabled.

### Diff viewer

- File diffs open as read-only tabs in the editor area (not a modal), in a
  side-by-side split view with aligned old/new line numbers, subtle color for
  added/removed lines and emphasized changed spans. The divider stays centered;
  one horizontal scrollbar at the bottom pans both sides together, and the split
  can switch to Unified from the diff toolbar. Large diffs are capped with a
  notice that points at the unified view.

### Explorer

- Move and copy files/folders with context-menu copy/cut/paste and `Ctrl/⌘+C`,
  `X`, `V`; same-folder copies get `name (n)` automatically. Drag a tree entry
  onto a folder to move it.
- Drop files from the OS onto the tree or a folder to upload them into that
  directory, with the existing 128 MiB and auto-rename rules.
- Copy/move runs on the Host with the same workspace-root and symlink
  containment checks as the other file operations; open tabs, favorites and
  expanded folders follow a move.

### SSH remote folders

- Add remote workspaces with `ssh://user@host:port/absolute/path` from the
  workspace picker or the address bar, and browse/edit/save, create, rename,
  delete, copy/move, upload and download over SFTP.
- Authentication uses the SSH agent or `~/.ssh` keys/config; passwords are never
  collected or stored. The optional `ssh2` dependency is loaded lazily, so the
  rest of the plugin works without it.
- Remote roots are confined to their absolute path, Git is hidden for them, and
  host keys are not pinned (documented trade-off).

## 1.0.0 — 2026-10-20

Initial open-source release.

### Explorer and workspaces

- Browse, create, rename and delete files and folders in every registered
  Harness workspace.
- Single-click file opening; folder expansion by chevron or double-click.
- Collapse-all, show/hide hidden files, and go-to-root under the labeled **More**
  menu; `Alt+Home` jumps to the current workspace root. The menu is wide enough
  for the shortcut and never wraps its labels.
- Per-workspace favorites with single-click open/jump, following renames and
  deletions.
- Header workspace picker with per-entry removal (registered workspaces are
  removed from the Harness registry; default-only directories are hidden
  locally).
- Path address bar for relative/absolute jumps and for registering new
  workspace directories.
- Explorer width persistence and a compact explorer/editor layout in narrow
  sidebars.

### Editor and previews

- Multi-tab editor with syntax highlighting (including C# `.cs`/`.csx`), line
  numbers, auto-indent, a remembered word-wrap toggle and copy-all.
- Distinct, theme-adaptive syntax colors for keywords, types, functions, strings,
  numbers, properties and comments, instead of near-body-text accents.
- Expanded language coverage: Kotlin, Scala, Swift, Dart, Groovy, R, Perl,
  PowerShell, F#, VB.NET, Objective-C, Protocol Buffers, GraphQL, Terraform,
  CMake, Dockerfile, Makefile and Razor (plus filename detection for Dockerfile,
  Makefile and CMakeLists.txt variants).
- Save, reload and stale-file protection with reload/overwrite choices.
- Markdown files share the full text-editing path: initial read, save, reload,
  copy-all and word wrap, alongside the rendered preview.
- Embedded PDF viewer, inline image preview, browser handoff for binaries.

### Transfer

- Multi-file upload with auto-rename on conflict and a 128 MiB per-file limit.
- Forced-download route for any file, including PDFs and images.
- Host-only companion bundle `@local/dsh-web-filebrowser-io` for binary I/O.

### Git

- Git view in the explorer header with branch, upstream and ahead/behind status.
- Staged, unstaged and untracked file lists; per-file and bulk stage/unstage.
- Commit message box with `Ctrl/⌘+Enter`; read-only unified diff modal.
- Repository initialization and local branch switching.
- Host-only companion bundle `@local/dsh-web-filebrowser-git` for safe local Git
  operations; no fetch/pull/push and no credential storage.

### Integration

- Left-sidebar panel entry, right-sidebar Start card and tab body/title seats.
- English and Chinese UI; theme-token styling; no Harness Client imports.
- Fixed the SVG icon renderer so multi-path icons (new file/folder, upload and
  download, wrap, More, Git, hidden files, copy, save and collapse) render every
  stroke; key toolbar/editor icons use a crisp 16px size.
- No model-facing tools, prompts or session events.
