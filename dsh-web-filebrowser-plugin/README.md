# Dev Workspace (`@local/dsh-web-dev-workspace`)

Part of **[Dev Workspace](../README.md)** — a VS Code-style development workspace for the
DeepSeek Harness Web UI. This package is the main bundle: it provides the Host
file API and the browser explorer/editor. Upload and forced download are provided
by the companion host-only bundle [`@local/dsh-web-dev-workspace-io`](../dsh-web-filebrowser-io); the Git
view is provided by [`@local/dsh-web-dev-workspace-git`](../dsh-web-filebrowser-git).

Chinese overview: [`README.zh.md`](../README.zh.md).

## Install

The plugin is a **local bundle**, not an npm package. Normally install the combined
bundle from the repository root once; it starts this component together with the
IO and Git components:

```text
/absolute/path/to/dsh-web-filebrowser
```

Installing this directory alone is supported for development, but binary I/O and
the Git view then need their own installs. To install just this component:

1. Clone the repository:

   ```bash
   git clone <repository-url> dsh-web-filebrowser
   ```

2. In the Harness Web UI, open **Plugins → Add plugin → Install a third-party
   plugin** and enter the absolute path to this directory:

   ```text
   /absolute/path/to/dsh-web-filebrowser/dsh-web-filebrowser-plugin
   ```

3. Install and enable it. For the full feature set install the combined bundle
   at the repository root instead.

4. Refresh the page if the new entries are not visible.

You can also ask the Harness agent to install the combined bundle at the repository root. The
full installation, update, uninstall and troubleshooting notes live in the
[root README](../README.md#installation).

Tested with DeepSeek Harness `0.2.1-rc.2` (Web profile). No build step and no
third-party runtime dependencies.

## Entry points

- **Left Sidebar** panel icon (`sidebar.panellist`, id `files`) opens the full
  workspace in the centre column.
- A **Git** tab at the bottom of the sidebar switches to the source-control view; the Explorer tab returns to the tree. It shows an amber badge with the number of distinct changed files while the worktree is dirty.
- A **Memory** tab (local workspaces only) edits the same per-workspace memory
  the model uses across sessions; the refresh button re-reads the file.
- A **Todo** tab (local workspaces only) is a per-workspace task board with
  quick add, priorities, due dates, tags, notes, filters and sorting; it shows the
  open-task count on the tab.
- The bottom view strip adapts to the sidebar width: full labels when they fit,
  icon-only tabs with tooltips when they do not, and a **More views** menu once
  even the icons no longer fit. The active view stays visible.
- **Right Sidebar Start / guide page** lists a third card, "Dev Workspace", next
  to "Workspace files" and "New terminal". Picking it opens the same workspace as
  a right-sidebar tab. In a narrow sidebar the page switches to a compact
  single-column layout: the explorer fills the tab first, and opening a file
  replaces it with the editor, with a back button in the breadcrumb. Widen or
  fullscreen the right Sidebar for the two-column layout.

## Features

### Explorer

- Browse every registered Harness workspace (switchable from the header).
- One-click **collapse all** under the Explorer toolbar's labeled **More** menu,
  together with **show/hide hidden files**, **go to workspace root**, and refresh.
  Dotfiles are hidden by default; the choice persists in localStorage, and typing
  or creating a dot path switches it on automatically.
- **Upload** files into the selected directory (Explorer toolbar upload button, or
  right-click "Upload files here"). Multiple files are accepted; same-name
  uploads are auto-renamed with ` (1)`, ` (2)`, ...; a single uploaded file opens
  automatically, while multiple files are selected in the tree. Limit: 128 MiB per
  file. Binary transfer is handled by the
  companion bundle.
- **Download** any open file (editor toolbar download button, or right-click
  "Download file"). The companion route sends `Content-Disposition: attachment`,
  so PDFs and images save instead of opening.
- **Favorites** for files and directories. Right-click an entry (or use the star
  in the Favorites header for the selected entry) to add/remove it. A single click
  on a favorite opens the file or reveals and expands the directory. Favorites are
  stored per workspace root in localStorage, appear with a star in the tree, and
  follow renames and deletions.
- **Workspace picker and cleanup**: the header picker lists every registered
  workspace with its title and path. Use a row's trash button to remove one
  record. Registered workspaces are removed through the Harness Workspace
  Controller; a directory that is only the deployment default is hidden locally.
  The Home button (or `Alt+Home` inside the page) jumps back to the current
  workspace root, clears the selection, and scrolls the explorer to the top.
- **Path address bar** in the header. Enter a relative path (`src/lib`,
  `./README.md`) to reveal and open it inside the current workspace; enter an
  absolute directory (`/data/projects/app`) to open it. An absolute path inside
  the current root is located in the tree; anything else is registered/resolved
  as a Harness workspace through the existing Workspace Controller and then
  opened, so the Host's registered-root confinement stays intact. `Enter`
  locates, `Escape` clears.
- Create files/folders, rename (inline, F2), delete (with confirmation), refresh.
- Copy/cut/paste entries between folders from the context menu (or `Ctrl/⌘+C`,
  `X`, `V`), drag a tree entry onto a folder to move it, and drop OS files onto the
  tree or a folder to upload them.
- Click a file to open it; click a folder to select it, and double-click a folder
  (or use its chevron) to expand or collapse it. Context menu offers open, open in
  browser, favorite, new file/folder, upload, copy, cut, paste, rename, delete,
  download, copy relative path.

### Built-in terminal

- xterm.js (vendored) terminal views. Linux uses a Host-side `script(1)` PTY
  (util-linux `script` is required); Windows uses `cmd.exe` over pipes with local
  line echo because `script(1)`/`/dev/pts` are unavailable, so full-screen programs,
  resizing and signal keys such as `Ctrl+C` are limited. Open from the header terminal button or
  `Ctrl/⌘ + backtick`; the panel has tabs for multiple sessions.
- Terminals can be moved between the bottom panel and editor tabs; the Host keeps
  the shell alive and buffers output (about 1 MB) while the view is detached.
- Output uses a long poll: `poll` accepts a `wait` window (up to 1 s) and
  answers as soon as the shell writes, so the browser does not wait for a fixed
  interval. Responses carry `longPoll: true`; a Host without it is detected and
  polled at the old interval.
- The quick-command bar is filled only by its refresh button (manual) or the
  one-off check after `cd` / `pushd` / `popd`; opening a terminal detects
  nothing, and there is no timer, focus or visibility refresh.
- An `ssh://` root opens a remote shell instead of a local PTY: `ssh.js`
  requests a PTY on the pooled ssh2 connection, execs `$SHELL -l` in the remote
  root, and the manager drives the resulting channel through the same
  write/poll/resize/close path (`resize` maps to `window-change`). SSH terminals
  skip quick-command detection because the project files are remote.
- `POST /api/dsh-web-filebrowser-terminal` supports `open`, `write`, `poll`,
  `resize` and `close`; `GET ?op=asset&name=…` serves the vendored xterm assets.
  Root is a registered local workspace or an `ssh://` workspace root.

### Workspace layout

- The header's Maximize editor/Restore button hides the explorer so the editor or
  built-in browser fills the component.
- The adjacent **fullscreen** toggle makes the whole workspace fill the real
  browser viewport. It uses the native Fullscreen API when available and a
  fixed-position fallback otherwise (iOS Safari and embedded webviews), keeping the
  explorer, tabs, browser/editor and terminal available; safe-area insets are
  respected. Esc or the exit-fullscreen button leaves it.

### Built-in browser

- Browser tabs (globe button, welcome action or `Alt+B`) preview a running dev
  server beside the code, with an address bar, history, reload and external open.
- PC/Mobile viewport switching includes iPhone 14, iPhone SE, Pixel 7 and iPad
  presets, portrait/landscape rotation and fit-to-panel scaling. It emulates the
  CSS viewport only, not touch events or the User-Agent.
- The toolbar star bookmarks the current address and records the active PC/Mobile
  viewport (preset and orientation). The start page lists bookmarks; clicking one
  reopens it in that viewport, each row can be removed after a confirmation, and its pencil button
  edits an **alias** (empty restores the automatic name). Bookmarks and the
  start page's Protocol/Host fields are stored per workspace in
  `.dsh/browser-bookmarks.json` (max 50) and ignored by the generated
  `.dsh/.gitignore`; SSH remote workspaces cannot store them.
- The start page detects listening local TCP ports on Linux (`ports` op); other
  platforms fall back to common ports.
- Local/private and public pages are embedded directly by default. When a public
  site refuses framing, the toolbar's **Proxy** mode uses
  `/api/dsh-web-filebrowser-proxy`: it fetches public addresses only, strips frame
  headers, injects a base/link bridge and serves the HTML into an opaque-origin
  sandbox (no cookies/login state). Complex or authenticated public sites may
  still render incompletely; use the external browser for full navigation.

### SSH remote folders

- Add `ssh://user@host:port/absolute/path` from the workspace picker or the address
  bar. The Host connects over SFTP using the SSH agent or keys under `~/.ssh`
  (`~/.ssh/config` HostName/User/Port/IdentityFile are honored). A password can be
  entered for one connection; it is not written to disk and must be re-entered
  after the connection drops.
- Browse, edit/save, create, rename, delete, copy/move and upload/download on the
  remote root; drag-and-drop upload and the context menu use the same paths as
  local workspaces. Git is local-only and its bottom tab is hidden for SSH roots.
- Requires the optional `ssh2` dependency: run `npm install` at the repository root (or in this directory when installing the component standalone).
  Without it the plugin still loads; SSH operations report the missing dependency.
- Host keys are not pinned; connect only to trusted hosts.

### Cross-session workspace memory

- A local workspace owns `.dsh/memory.json`, shared by every chat session whose
  workspace is that directory. Memory is isolated per workspace; no document is
  read across roots. An ungrouped session uses its recorded cwd.
- Host tools `memory_save`, `memory_search`, `memory_update` and `memory_delete`
  let the model curate notes with stable ids and optional tags. A bounded
  `workspace-memory` runtime context is injected into requests automatically, and
  changes are picked up on the next step.
- The **Memory** sidebar tab reads and writes the same document: list, add, edit,
  delete, refresh, with tag chips and timestamps. It is hidden for SSH roots.
- `.dsh/.gitignore` (`*`) is created on first write when absent so the state stays local;
  limits are 200 entries / 4,000 characters / 8 tags per entry.
- Requires the `tools` and `systemPrompt` services; without them the file browser
  loads normally and memory support stays off.

### Workspace todo list

- A local workspace owns `.dsh/todos.json`; the **Todo** sidebar tab and the model
  tools share that document, and switching workspaces switches the board.
- Quick-add with an optional priority, due date and tags. Tasks support inline
  editing of title, note, priority, due date and tags; check, reopen, delete and
  clear-completed actions are one click each.
- The panel shows open/done counts, a completion bar and overdue counts, labels
  due dates as overdue/today/tomorrow, filters by open/done/all, searches titles,
  notes and tags, and sorts by priority, due date, last update or creation time.
  Filter/sort choices persist in localStorage.
- Host tools `todo_list`, `todo_add`, `todo_update` and `todo_delete` manage the
  same board. They are separate from the built-in session `todo_write` plan tool.
- Every mutation returns the refreshed board. Writes use a temp-file rename under a
  per-root lock, and the panel refreshes every eight seconds (and on focus) while
  visible, pausing during an inline edit.
- `.dsh/.gitignore` (`*`) is created on first write when absent; limits are 500
  tasks / 500 title characters / 4,000 note characters / 8 tags per task.
- Requires the `tools` and `systemPrompt` services for the model half; the panel
  works without them. SSH roots show a read-only explanation.

### Editor

- Multi-tab editing: dirty indicators, save (button or `⌘/Ctrl+S`), reload,
  stale-file protection, drag-to-resize explorer width, a remembered and visibly
  labeled word-wrap toggle, and one-click **copy all** of the active buffer.
- Open local files are checked every five seconds and on window focus: a clean tab
  reloads automatically when the file changes on disk, while a dirty tab shows a
  warning to **Reload** or **Keep my changes**.
- Syntax highlighting for JavaScript/TypeScript, JSON, CSS, HTML/XML, Python,
  Shell, YAML, SQL, Markdown, Rust, Go, Java, Kotlin, Scala, Swift, Dart, Groovy, C#,
  C/C++, Objective-C, Ruby, PHP, Lua, R, Perl, PowerShell, F#, VB.NET, Razor,
  Protocol Buffers, GraphQL, Terraform, CMake, Dockerfile, Makefile, config files,
  and diffs.
- Line numbers (kept aligned when word wrap is on), `Tab` indentation, basic
  auto-indent.
- Markdown preview with headings, lists, tables, code fences, links, and images.
  Relative links open inside the workspace; relative images load through the Host.
- PDF files render in an embedded viewer and can be opened in a new browser tab.
  Images preview inline. Binary files offer a browser handoff.
- Open tabs, tree expansion, and unsaved buffers survive switching between the
  conversation, the right Sidebar, and this panel for the lifetime of the page.

### Git

- Branch, upstream and ahead/behind status; staged, unstaged and untracked files.
- The bottom **Git** tab shows an amber badge with the number of distinct changed
  files. A hidden Git panel refreshes status every thirty seconds and on focus, so
  the badge also reflects editor saves and external changes; it disappears when
  the workspace is clean or is not a repository.
- Stage/unstage a file or everything, commit with a message (`Ctrl/⌘+Enter`), view a
  read-only diff in the editor (side-by-side by default, unified on demand), initialize a repository and switch local branches.
- Fetch, pull and push from the Git toolbar; **Commit & push** commits and pushes
  in one step. The first push sets `origin/<branch>` as upstream.
- Compare the current branch with upstream, a local branch or a remote branch:
  commits unique to each side, ahead/behind counts and files changed since the
  merge base, each with a diff against the base.
- Requires the [`@local/dsh-web-dev-workspace-git`](../dsh-web-filebrowser-git) host companion; if it is not
  installed, the Git view shows an install hint.
- Pull is fast-forward only and push never forces; conflicts must be resolved in a
  terminal. Network commands use the Host's SSH key or credential helper and never
  store credentials. The workspace must be the repository root; commit and push run
  the repository's configured Git hooks.

### Delivery pipeline and agent team

- The Pipeline sidebar view runs a requirement through seven stages — product →
  design → development → testing → **acceptance (AI project-manager review)** →
  **approval (owner sign-off)** → release — with a dual-review gate before release
  and fast mode that only auto-approves the five intermediate stages.
- Since v1.2.73 each executing role has an explicit research-and-borrow discipline
  in its stage prompt and handbook: the product manager researches comparable
  requirements/standards (≥3 sources, decision table), the UI designer follows nine
  hard design standards plus a scored self-review and render/inspect/refine loop,
  and the full-stack engineer researches actively maintained, clearly licensed
  GitHub projects before borrowing or implementing from scratch, with license,
  security and performance checks. The acceptance review verifies these artefacts.

## Shortcuts

| Shortcut | Action |
| --- | --- |
| `⌘/Ctrl + S` | Save the active file |
| `F2` | Rename the selected file/folder |
| `Ctrl/⌘ + C` | Copy the selected entry |
| `Ctrl/⌘ + X` | Cut the selected entry |
| `Ctrl/⌘ + V` | Paste into the selected folder (or its parent) |
| `Delete` | Delete the selected file/folder |
| `Enter` | Open the selected file / toggle the selected folder |
| `Alt + Home` | Go to the current workspace root |
| `Ctrl/⌘ + Enter` | Commit staged changes from the Git message box |
| `Escape` | Close a menu/modal or clear the address input |

## How it works

- The Host half (`index.js`) registers exact Fetch routes on the authenticated
  shared API channel: `/api/dsh-web-filebrowser` for file operations and `/api/dsh-web-filebrowser-ssh`
  for binary uploads into SSH roots. Only owner peers reach exact routes, so the
  browser's signed Harness cookie authenticates every request; no extra token is
  introduced. Local paths are confined to a registered workspace root, symlinks
  are resolved before containment is checked, and the workspace root itself
  cannot be renamed or deleted. SSH roots are confined to their absolute remote
  path by the SFTP backend (`ssh.js`).

  | Method | Operation |
  | --- | --- |
  | `POST` | JSON operations: `roots`, `list`, `read`, `write`, `createFile`, `createDir`, `rename`, `move`, `copy`, `delete`, `stat`, `sshTest`, `ports` |
  | `GET` | `?op=raw&root=…&path=…` streams a file for preview/download links |
  | `GET` | `/api/dsh-web-filebrowser-proxy?url=…` fetches a public HTML page for the built-in browser |

- The Client half (`client.js`) registers the `files` key in the `main` slot and a
  matching entry in `sidebar.panellist`, so the sidebar icon opens this page. It
  also registers `ctx.sidebarRightTabs` (kind `dsh-web-filebrowser`, guide card order 30) with
  a `sidebar.right.pane.tab` body and title, so the right Sidebar's Start page gets
  a card. Styling uses only Harness theme tokens (`--dsw-*`); no Harness Client package
  is imported.
- File mutations use Node's filesystem API on the Host because the shipped
  `workspaceFiles` Remote namespace is read-only. Editor text reads are capped at
  8 MiB; raw preview passthrough at 128 MiB.
- Binary upload/download lives in the separate host-only bundle
  [`@local/dsh-web-dev-workspace-io`](../dsh-web-filebrowser-io) at `/api/dsh-web-filebrowser-io`. It accepts raw
  octet-stream uploads, writes with `wx` so concurrent same-name uploads never
  overwrite each other, and confines every target to a registered workspace root
  (or the deployment default directory). Downloads are streamed with
  `Content-Disposition: attachment`.
- Git status/stage/commit/diff/branch/compare and explicit fetch/pull/push
  operations live in the separate host-only bundle
  [`@local/dsh-web-dev-workspace-git`](../dsh-web-filebrowser-git) at `/api/dsh-web-filebrowser-git`. It invokes `git`
  with `execFile`, requires the workspace to be the repository root, disables
  interactive prompts and never stores credentials.
- Registers workspace-scoped model tools for memory, todos, the acceptance
  board, the delivery pipeline, agent execution (task runner, ports, preview
  shares, loopback HTTP probe), workspace status and change review. The tools
  never approve a gate, never write Harness session records and never bypass the
  owner-authenticated routes.

## Local data

View preferences and file favorites are stored in the browser's `localStorage`:

| Key | Contents |
| --- | --- |
| `dsh-web-filebrowser:root` | Last opened workspace path |
| `dsh-web-filebrowser:tree-width` | Explorer width in px |
| `dsh-web-filebrowser:show-hidden` | Show dotfiles (`1`/`0`) |
| `dsh-web-filebrowser:favorites` | Per-root favorites map |
| `dsh-web-filebrowser:favorites-open` | Favorites section open state |
| `dsh-web-filebrowser:word-wrap` | Word-wrap toggle |
| `dsh-web-filebrowser:hidden-roots` | Locally hidden directory paths |
| `dsh-web-filebrowser:todo-filter` | Last Todo filter (`open`/`done`/`all`) |
| `dsh-web-filebrowser:todo-sort` | Last Todo sort order |

Built-in browser bookmarks and the start page's Protocol/Host fields are **not** in
localStorage: each local workspace keeps them in `.dsh/browser-bookmarks.json`,
next to memory and todos, and the generated `.dsh/.gitignore` (`*`) keeps the file
out of Git. SSH remote workspaces cannot store them.

Workspace memory is **not** stored in localStorage: each local root owns
`.dsh/memory.json` and a generated `.dsh/.gitignore` (`*`). Deleting that JSON
file clears the workspace's memory; nothing is shared with another root.

Todos are stored per workspace at `.dsh/todos.json` and are not in localStorage
either. The same generated `.dsh/.gitignore` keeps them out of Git; deleting the
JSON file clears the board.

The project-delivery state lives under the workspace `.dsh/` directory as well:
`.dsh/acceptance.json` (checklist, evidence, history), `.dsh/pipeline.json`
(seven stages incl. the project-manager agent acceptance review, reviews,
releases), `.dsh/deliveries.json`, `.dsh/runs.json` (task
run ledger), `.dsh/review.json` (stage baseline + reviewed marks) and
`.dsh/verifications/` (retest records). All are generated with a `.gitignore`
that keeps them out of the repository.

## Limitations

- Only registered workspaces (or the deployment default directory) are
  accessible; an absolute path typed in the address bar is registered first.
- No folder upload/download and no binary editing. Local workspaces poll the
  expanded tree and open text files; SSH roots are not polled. A clean tab
  reloads automatically when its file changes on disk, while a dirty tab asks
  before discarding edits. Saves use stale-file protection. SSH host keys are not
  pinned; password auth is one-time per connection and is never stored.
- Todos are local-only: SSH roots show an explanation instead of an editor, and
  the panel's automatic refresh pauses while an inline edit is open.
- Git is limited to the repository root; no automatic merge/rebase or hunk-level
  staging. A diverged pull must be resolved in a terminal, and pushes never force.
- Built against Harness `0.2.1-rc.2`; newer releases may change slot/service
  contracts.

## Security

See the project [security policy](../SECURITY.md). Report vulnerabilities
privately, not in a public issue.

## License

[MIT](../LICENSE) © DSH Web Dev Workspace contributors.
