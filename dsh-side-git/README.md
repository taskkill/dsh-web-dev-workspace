# Workspace Git (`@local/dsh-side-git`)

Host-only companion bundle for **[Workspace Files](../dsh-side-plugin)** — part of
[DSH Side](../README.md). It adds local Git operations to the workspace panel:
status, staging, commits, repository initialization, branch switching and diffs.

> Git runs on the **Harness host** with the host's permissions. This bundle does
> not implement network operations (no fetch/pull/push) and stores no credentials.

## Install

Install it from a cloned checkout through the Harness Plugin Manager, alongside
the main and IO bundles:

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
- Git's `safe.directory` rules still apply; a repository owned by another user may
  be rejected by Git until the host is configured.

## Operations

`POST /api/dsh-side-git` with JSON `{ "op": "...", "root": "<absolute workspace root>", ... }`.

| `op` | Body | Result |
| --- | --- | --- |
| `status` | `root` | Branch/upstream/ahead/behind, staged entries, changes, untracked files |
| `init` | `root` | Runs `git init`, then returns status |
| `stage` | `root`, optional `paths` | `git add -A` for the paths, or the whole root |
| `unstage` | `root`, optional `paths` | `git reset`/`git rm --cached` for staged paths |
| `commit` | `root`, `message` | `git commit -m <message>` |
| `diff` | `root`, `path`, `staged`, `untracked` | Unified diff for a changed/untracked file |
| `branches` | `root` | Local branches and current branch |
| `checkout` | `root`, `branch` | Switches to an existing local branch |

All commands use `execFile('git', args, { cwd })` — never a shell — with a timeout,
a bounded buffer and `GIT_TERMINAL_PROMPT=0`.

## Safety

- Only owner-authenticated requests reach the exact `/api/dsh-side-git` route.
- The root must be a registered workspace (or the deployment default) **and** the
  repository top level. Paths are validated and passed after `--`.
- Output is capped: up to 2000 status entries, 2 MiB tracked diffs, 512 KiB
  generated untracked diffs.
- Git runs inside the selected repository; its local config, hooks or fsmonitor can
  execute code. Only use Git in repositories you trust.
- No fetch/pull/push, no remote credentials, no Git config writes.

## Limitations

- No staging of individual hunks; stage is per file or all.
- No merge/rebase/cherry-pick/stash UI.
- No remote branch management or network synchronization.
- Repositories whose top level is above the workspace root are not supported for
  mutations.

## License

[MIT](../LICENSE) © DSH Side contributors.
