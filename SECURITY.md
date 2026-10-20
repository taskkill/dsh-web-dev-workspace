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
- The plugin registers no model-facing tools, prompts or session events.

## Supported versions

The project is at 1.0.x and does not maintain multiple release branches. Security
fixes target the latest `main` and the most recent release.
