# Workspace Files (`@local/dsh-side`)

Part of **[DSH Side](../README.md)** — a VS Code-style workspace for the
DeepSeek Harness Web UI. This package is the main bundle: it provides the Host
file API and the browser explorer/editor. Upload and forced download are provided
by the companion host-only bundle [`@local/dsh-side-io`](../dsh-side-io); the Git
view is provided by [`@local/dsh-side-git`](../dsh-side-git).

Chinese overview: [`README.zh.md`](../README.zh.md).

## Install

The plugin is a **local bundle**, not an npm package. Install it from a cloned
checkout through the Harness Plugin Manager:

1. Clone the repository:

   ```bash
   git clone <repository-url> dsh-side
   ```

2. In the Harness Web UI, open **Plugins → Add plugin → Install a third-party
   plugin** and enter the absolute path to this directory:

   ```text
   /absolute/path/to/dsh-side/dsh-side-plugin
   ```

3. Install and enable it, then install the two companion bundles the same way:

   ```text
   /absolute/path/to/dsh-side/dsh-side-io
   /absolute/path/to/dsh-side/dsh-side-git
   ```

4. Refresh the page if the new entries are not visible.

You can also ask the Harness agent to install all three local bundle directories. The
full installation, update, uninstall and troubleshooting notes live in the
[root README](../README.md#installation).

Tested with DeepSeek Harness `0.2.1-rc.2` (Web profile). No build step and no
third-party runtime dependencies.

## Entry points

- **Left Sidebar** panel icon (`sidebar.panellist`, id `files`) opens the full
  workspace in the centre column.
- A **Git** button in the explorer header switches to the source-control view.
- **Right Sidebar Start / guide page** lists a third card, "Code Workspace", next
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
- Click a file to open it; click a folder to select it, and double-click a folder
  (or use its chevron) to expand or collapse it. Context menu offers open, open in
  browser, favorite, new file/folder, upload, rename, delete, download, copy
  relative path.

### Editor

- Multi-tab editing: dirty indicators, save (button or `⌘/Ctrl+S`), reload,
  stale-file protection, drag-to-resize explorer width, a remembered and visibly
  labeled word-wrap toggle, and one-click **copy all** of the active buffer.
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
- Stage/unstage a file or everything, commit with a message (`Ctrl/⌘+Enter`), view a
  read-only unified diff, initialize a repository and switch local branches.
- Requires the [`@local/dsh-side-git`](../dsh-side-git) host companion; if it is not
  installed, the Git view shows an install hint.
- Local-only: no fetch/pull/push, no remote credentials. The workspace must be the
  repository root; commit runs the repository's configured Git hooks.

## Shortcuts

| Shortcut | Action |
| --- | --- |
| `⌘/Ctrl + S` | Save the active file |
| `F2` | Rename the selected file/folder |
| `Delete` | Delete the selected file/folder |
| `Enter` | Open the selected file / toggle the selected folder |
| `Alt + Home` | Go to the current workspace root |
| `Ctrl/⌘ + Enter` | Commit staged changes from the Git message box |
| `Escape` | Close a menu/modal or clear the address input |

## How it works

- The Host half (`index.js`) registers one exact Fetch route on the authenticated
  shared API channel: `/api/dsh-side`. Only owner peers reach exact routes, so the
  browser's signed Harness cookie authenticates every request; no extra token is
  introduced. Every path is confined to a registered workspace root, symlinks are
  resolved before containment is checked, and the workspace root itself cannot be
  renamed or deleted.

  | Method | Operation |
  | --- | --- |
  | `POST` | JSON operations: `roots`, `list`, `read`, `write`, `createFile`, `createDir`, `rename`, `delete`, `stat` |
  | `GET` | `?op=raw&root=…&path=…` streams a file for preview/download links |

- The Client half (`client.js`) registers the `files` key in the `main` slot and a
  matching entry in `sidebar.panellist`, so the sidebar icon opens this page. It
  also registers `ctx.sidebarRightTabs` (kind `dsh-side`, guide card order 30) with
  a `sidebar.right.pane.tab` body and title, so the right Sidebar's Start page gets
  a card. Styling uses only Harness theme tokens (`--dsw-*`); no Harness Client package
  is imported.
- File mutations use Node's filesystem API on the Host because the shipped
  `workspaceFiles` Remote namespace is read-only. Editor text reads are capped at
  8 MiB; raw preview passthrough at 128 MiB.
- Binary upload/download lives in the separate host-only bundle
  [`@local/dsh-side-io`](../dsh-side-io) at `/api/dsh-side-io`. It accepts raw
  octet-stream uploads, writes with `wx` so concurrent same-name uploads never
  overwrite each other, and confines every target to a registered workspace root
  (or the deployment default directory). Downloads are streamed with
  `Content-Disposition: attachment`.
- Git status/stage/commit/diff/branch operations live in the separate host-only
  bundle [`@local/dsh-side-git`](../dsh-side-git) at `/api/dsh-side-git`. It invokes
  `git` locally with `execFile`, requires the workspace to be the repository root
  and never runs network commands.
- No model-facing tools, prompts, or session events are registered.

## Local data

Preferences and favorites are stored in the browser's `localStorage`:

| Key | Contents |
| --- | --- |
| `dsh-side:root` | Last opened workspace path |
| `dsh-side:tree-width` | Explorer width in px |
| `dsh-side:show-hidden` | Show dotfiles (`1`/`0`) |
| `dsh-side:favorites` | Per-root favorites map |
| `dsh-side:favorites-open` | Favorites section open state |
| `dsh-side:word-wrap` | Word-wrap toggle |
| `dsh-side:hidden-roots` | Locally hidden directory paths |

## Limitations

- Only registered workspaces (or the deployment default directory) are
  accessible; an absolute path typed in the address bar is registered first.
- No folder upload/download, no automatic file watching, no search, no
  drag-and-drop, and no binary editing.
- Git is limited to the repository root; no pull/push, merge/rebase or hunk-level
  staging.
- External changes require a manual refresh/reload; saves use stale-file
  protection.
- Built against Harness `0.2.1-rc.2`; newer releases may change slot/service
  contracts.

## Security

See the project [security policy](../SECURITY.md). Report vulnerabilities
privately, not in a public issue.

## License

[MIT](../LICENSE) © DSH Side contributors.
