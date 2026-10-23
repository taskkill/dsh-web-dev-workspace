# Changelog

All notable changes to this project are documented here.

## Unreleased

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
  - The client checks for a changed shell cwd every 20 seconds instead of every
    4, pauses while the page is hidden, and refreshes immediately only after
    `cd` / `pushd` / `popd` rather than after every command.
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
