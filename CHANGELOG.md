# Changelog

All notable changes to this project are documented here.

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
- Save, reload and stale-file protection with reload/overwrite choices.
- Markdown files share the full text-editing path: initial read, save, reload,
  copy-all and word wrap, alongside the rendered preview.
- Embedded PDF viewer, inline image preview, browser handoff for binaries.

### Transfer

- Multi-file upload with auto-rename on conflict and a 128 MiB per-file limit.
- Forced-download route for any file, including PDFs and images.
- Host-only companion bundle `@local/dsh-side-io` for binary I/O.

### Integration

- Left-sidebar panel entry, right-sidebar Start card and tab body/title seats.
- English and Chinese UI; theme-token styling; no Harness Client imports.
- No model-facing tools, prompts or session events.
