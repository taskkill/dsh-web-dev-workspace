# Workspace Git (`@local/dsh-side-git`)

Host-only companion bundle for **[Workspace Files](../dsh-side-plugin)** — part of
[DSH Side](../README.md). It adds Git operations to the workspace panel: status,
staging, commits, diffs, branches, comparison, and explicit fetch/pull/push.

> Git runs on the **Harness host** with the host's permissions. Network commands
> use the host's existing SSH key or credential helper; the bundle never collects
> or stores credentials and never prompts interactively.

## Install

Normally the combined bundle at the repository root installs this component
automatically. To install it alone for development, use the Harness Plugin
Manager:

1. Open **Plugins → Add plugin → Install a third-party plugin**.
2. Enter the absolute path to this directory:

   ```text
   /absolute/path/to/dsh-side/dsh-side-git
   ```

3. Install and enable it.

The main plugin's Git button appears in the explorer header. If this bundle is
missing, that panel shows an install hint instead of failing silently.

## Requirements

- `git` available on the Harness host's `PATH`.
- The workspace root must be the **repository top level**. Opening a subdirectory
  of a larger repository is rejected for mutations so Git cannot stage or commit
  files outside the selected workspace.
- A configured Git identity (`user.name` / `user.email`) is required to commit.
  The plugin does not set or store identity.
- Network operations need a configured remote; pulls need an upstream branch. The
  Host must already authenticate (SSH key or credential helper) because the plugin
  disables interactive prompts and stores no credentials.
- Git's `safe.directory` rules still apply; a repository owned by another user may
  be rejected by Git until the host is configured.

## Operations

`POST /api/dsh-side-git` with JSON `{ "op": "...", "root": "<absolute workspace root>", ... }`.

| `op` | Body | Result |
| --- | --- | --- |
| `status` | `root` | Branch/upstream/ahead/behind, staged entries, changes, untracked files, configured remotes |
| `init` | `root` | Runs `git init`, then returns status |
| `stage` | `root`, optional `paths` | `git add -A` for the paths, or the whole root |
| `unstage` | `root`, optional `paths` | `git reset`/`git rm --cached` for staged paths |
| `commit` | `root`, `message` | `git commit -m <message>` |
| `diff` | `root`, `path`, `staged`, `untracked` | Unified diff for a changed/untracked file |
| `branches` | `root` | Local branches and current branch |
| `checkout` | `root`, `branch` | Switches to an existing local branch |
| `refs` | `root` | Local and remote branches, current branch, upstream |
| `compare` | `root`, `base` | Commits unique to `HEAD` and `base`, ahead/behind counts, files changed since the merge base |
| `compare-diff` | `root`, `base`, `path` | Unified diff of one file between the merge base and `HEAD` |
| `fetch` | `root` | `git fetch --prune`; returns the refs it updated |
| `pull` | `root`, optional `mode` (`ff-only` default, `rebase`, `merge`) | Fast-forward pull; refuses to auto-merge a diverged branch in the default mode |
| `push` | `root`, optional `remote` | Pushes the current branch; sets upstream when it has none. Never forces |

All commands use `execFile('git', args, { cwd })` — never a shell — with a timeout,
a bounded buffer and `GIT_TERMINAL_PROMPT=0`. Network commands get a 120 s budget;
interactive editors and askpass prompts are disabled.

## Safety

- Only owner-authenticated requests reach the exact `/api/dsh-side-git` route.
- The root must be a registered workspace (or the deployment default) **and** the
  repository top level. Paths, refs and remotes are validated before use.
- Output is capped: up to 2000 status entries, 2 MiB tracked diffs, 512 KiB
  generated untracked diffs, 100 commits per compare side.
- Git runs inside the selected repository; its local config, hooks (commit/push) or
  fsmonitor can execute code. Only use Git in repositories you trust.
- No credentials are read or stored; authentication is delegated to the Host's SSH
  key or credential helper. Pull never auto-merges or auto-rebases; push never
  forces. No Git config writes.

## Limitations

- No staging of individual hunks; stage is per file or all.
- No merge/rebase/cherry-pick/stash UI; a diverged pull must be resolved in a
  terminal.
- No remote branch checkout, tag management, or per-hunk staging.
- Repositories whose top level is above the workspace root are not supported for
  mutations.

## License

[MIT](../LICENSE) © DSH Side contributors.
