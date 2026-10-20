# Changelog

All notable changes to this project are documented here.

## Unreleased

### Sidebar tabs

- Explorer and Git are now switched by two tabs at the bottom of the sidebar;
  the Git panel stays mounted so a draft commit message survives tab switches.
  The Git tab is hidden for SSH roots. Tabs are compact (26 px) to leave room for
  future sidebar views.

### Built-in browser

- Add browser tabs with an address bar, history, reload and external open, so a
  running dev server can be previewed next to the code.
- Add a Maximize editor/Restore layout button that hides the explorer and lets
  the editor or browser fill the file-workspace component without browser
  fullscreen.
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
