import type { World } from '@/types';

// A plain module reference, so the crash screen can read it with every provider gone. No copy is made.
let read: (() => World) | null = null;
let exportBlock: UnsavedExportBlock = null;

/** Why the held world may not be exported: null when it may; a null reason when there is none to show. */
export type UnsavedExportBlock = { reason: string | null } | null;

/**
 * Set by the data provider whenever its committed world or its unsaved state changes: a reader while edits are
 * unsaved, otherwise null. `block` says whether the world may be exported.
 */
export function holdUnsavedWorld(next: (() => World) | null, block: UnsavedExportBlock = null): void {
  read = next;
  exportBlock = block;
}

/** The last world the data provider committed, while it holds unsaved edits. Null when the reader fails: the crash screen must not crash. */
export function readUnsavedWorld(): World | null {
  try {
    return read?.() ?? null;
  } catch (error) {
    console.error('Could not read the unsaved world:', error);
    return null;
  }
}

/** Whether the held world may be exported. */
export function unsavedWorldExportBlock(): UnsavedExportBlock {
  return exportBlock;
}
