# Workspace Files IO (`@local/dsh-side-io`)

Host-only companion bundle for **[Workspace Files](../dsh-side-plugin)** — part of
[DSH Side](../README.md). It provides the binary upload and forced-download host
routes used by the main explorer/editor UI.

## Why a separate bundle?

The main bundle owns the explorer, editor and JSON file API. Binary transfer lives
in this small host-only bundle so it can be installed, updated or disabled
independently, and so adding it does not require replacing the loaded main plugin
module. Keep it enabled if you want upload and download.

## Install

Normally the combined bundle at the repository root installs this component
automatically. To install it alone for development, use the Harness Plugin
Manager:

1. Open **Plugins → Add plugin → Install a third-party plugin**.
2. Enter the absolute path to this directory:

   ```text
   /absolute/path/to/dsh-side/dsh-side-io
   ```

3. Install and enable it.

Full installation, update and troubleshooting steps are in the
[root README](../README.md#installation). Requires DeepSeek Harness `0.2.1-rc.2`
or a compatible Web profile; no build step.

## Routes

Both are exact routes on the authenticated `/api` channel, so only the owner
browser with its signed Harness cookie reaches them.

### Upload

```http
POST /api/dsh-side-io?op=upload&root=<absolute-root>&path=<relative-path>
Content-Type: application/octet-stream

<raw file bytes>
```

- Writes the raw request body under the target workspace root.
- Same-name collisions are auto-renamed: `name (1).ext`, `name (2).ext`, ...
- Pass `overwrite=1` to replace an existing file instead.
- In the default auto-rename mode, files are opened with `wx` before writing, so
  concurrent same-name uploads cannot silently overwrite each other.
- Maximum upload: **128 MiB**.
- Success response: `{ "ok": true, "value": { "path", "name", "bytes" } }`.

### Download

```http
GET /api/dsh-side-io?op=download&root=<absolute-root>&path=<relative-path>
```

- Streams the file with `Content-Disposition: attachment`, so the browser saves
  instead of previewing (useful for PDFs and images).
- Errors are JSON with a stable `error.code`.

## Safety

- Every target is confined to a registered workspace root or the deployment
  default directory.
- Paths are split into segments; `..` and absolute/backslash segments are
  rejected, and the parent is resolved before writing.
- The route is owner-authenticated by the shared Harness connection; no separate
  token or port is exposed.
- This bundle registers no client UI, tools, prompts or session events.

## License

[MIT](../LICENSE) © DSH Side contributors.
