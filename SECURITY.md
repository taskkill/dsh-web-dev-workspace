# Security Policy

DSH Side runs inside the DeepSeek Harness host and can read and write files inside
the workspace roots you open. Please report security-sensitive issues privately.

## Reporting a vulnerability

**Do not open a public issue for a vulnerability.**

Use GitHub's private vulnerability reporting for this repository
(**Security → Advisories → Report a vulnerability**), or contact the maintainers
through the repository's private contact channel.

Please include:

- the affected version or commit, and the DeepSeek Harness version;
- whether the companion bundle `@local/dsh-side-io` is installed;
- a minimal reproduction and the expected/actual behavior;
- the impact (files read or written, paths reached, data exposed);
- any relevant logs with secrets removed.

## Scope

Examples of issues that matter:

- bypassing the owner-cookie check on the `/api/dsh-side*` routes;
- reading or writing outside the selected workspace root, including symlink
  escapes;
- a directory traversal in the address bar, upload path, rename, delete or raw
  preview routes;
- script injection through Markdown preview, file names, or rendered metadata;
- leaking the Harness session cookie, launch token, or unrelated files.

General UI bugs, missing features and questions belong in public issues.

## Design notes

- Both exact API routes live on the authenticated `/api` channel; the plugin does
  not mint a token or open an additional port.
- Every operation resolves its root and checks containment after resolving
  symlinks. Path segments are validated before the filesystem call.
- Uploads are opened with `wx` in auto-rename mode so concurrent same-name uploads
  do not overwrite each other.
- Copy/move reject the workspace root, refuse to place a directory inside itself,
  never overwrite a destination, and copy directory trees without following
  symlinks.
- Git operations run through `git` on the Host. Network operations are explicit
  fetch/pull/push: pulls are fast-forward only, pushes never force, interactive
  prompts are disabled, and the plugin stores no credentials (the Host's SSH key or
  credential helper is the only authentication path). Commits and pushes run the
  repository's configured hooks.
- SSH remote folders authenticate with the Host's SSH agent or `~/.ssh` keys and
  never collect passwords. `ssh2` does not pin host keys, so connect only to hosts
  you trust.
- The plugin registers no model-facing tools, prompts or session events.

## Before you publish

- Do not commit environment files, registry tokens, private keys or Harness profile
  directories. The repository `.gitignore` covers common cases, but it cannot
  protect a file that was already staged.
- Review `git status --short` and the staged diff before the first push, especially
  when the repository was cloned into a directory that also contains local
  workspace or profile data.

## Supported versions

The project is at 1.0.x and does not maintain multiple release branches. Security
fixes target the latest `main` and the most recent release.
