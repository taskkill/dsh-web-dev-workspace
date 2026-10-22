/**
 * Combined DSH Web Dev Workspace bundle.
 *
 * A single profile entry hosts three interchangeable halves:
 * - the workspace files API and browser client (`dsh-web-filebrowser-plugin/`)
 * - binary upload/download (`dsh-web-filebrowser-io/`)
 * - local Git (`dsh-web-filebrowser-git/`)
 *
 * Keeping one bundle entry means users install this repository once; the three
 * component directories remain independently loadable for development.
 */

import { apply as applyFiles } from './dsh-web-filebrowser-plugin/index.js'
import { apply as applyIo } from './dsh-web-filebrowser-io/index.js'
import { apply as applyGit } from './dsh-web-filebrowser-git/index.js'

/** All three components register routes on the shared connection service. */
export const inject = ['connection']

/**
 * Start the files, binary I/O and Git components.
 * @param ctx - Host context shared by the components.
 */
export function apply(ctx) {
  applyFiles(ctx)
  applyIo(ctx)
  applyGit(ctx)
}

