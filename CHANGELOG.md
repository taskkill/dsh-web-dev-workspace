# Changelog

All notable changes to this project are documented here.

## Unreleased

### Git

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
- Host-only companion bundle `@local/dsh-side-io` for binary I/O.

### Git

- Git view in the explorer header with branch, upstream and ahead/behind status.
- Staged, unstaged and untracked file lists; per-file and bulk stage/unstage.
- Commit message box with `Ctrl/⌘+Enter`; read-only unified diff modal.
- Repository initialization and local branch switching.
- Host-only companion bundle `@local/dsh-side-git` for safe local Git
  operations; no fetch/pull/push and no credential storage.

### Integration

- Left-sidebar panel entry, right-sidebar Start card and tab body/title seats.
- English and Chinese UI; theme-token styling; no Harness Client imports.
- Fixed the SVG icon renderer so multi-path icons (new file/folder, upload and
  download, wrap, More, Git, hidden files, copy, save and collapse) render every
  stroke; key toolbar/editor icons use a crisp 16px size.
- No model-facing tools, prompts or session events.
