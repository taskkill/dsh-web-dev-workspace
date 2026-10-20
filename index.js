/**
 * Combined DSH Side bundle.
 *
 * A single profile entry hosts three interchangeable halves:
 * - the workspace files API and browser client (`dsh-side-plugin/`)
 * - binary upload/download (`dsh-side-io/`)
 * - local Git (`dsh-side-git/`)
 *
 * Keeping one bundle entry means users install this repository once; the three
 * component directories remain independently loadable for development.
 */

import { apply as applyFiles } from './dsh-side-plugin/index.js'
import { apply as applyIo } from './dsh-side-io/index.js'
import { apply as applyGit } from './dsh-side-git/index.js'

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

