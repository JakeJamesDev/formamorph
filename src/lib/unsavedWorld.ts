import type { World } from '@/types';

// A plain module reference, so the crash screen can read it with every provider gone. No copy is made.
let read: (() => World) | null = null;

/** Set by the data provider whenever its committed world or its unsaved state changes: a reader while edits are unsaved, otherwise null. */
export function holdUnsavedWorld(next: (() => World) | null): void {
  read = next;
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
