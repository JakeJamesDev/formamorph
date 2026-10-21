/**
 * A script's verbs on `memories` entries, landed on the save fields the Memory Manager writes, as its buttons
 * write them (Q3, Q45). Each function applies the writes in call order and hands back the same value when they
 * change nothing.
 */
import type { MemoryWrite } from './statCodeExecutor';
import type { MemoryPinMap } from './milestoneMemory';
import type { MemoryEditMap, MemoryNote } from './memoryOverrides';

/** `pins` after `writes`: `pin` keeps, `forget` drops, and an edit of a digest keeps, as the Memory Manager's Save does. */
export function pinsAfter(pins: MemoryPinMap, writes: readonly MemoryWrite[]): MemoryPinMap {
  let out = pins;
  for (const write of writes) {
    const pin = pinOf(write);
    if (pin && out[write.id] !== pin) out = { ...out, [write.id]: pin };
  }
  return out;
}

/** The verdict one write sets, or null when it sets none. */
function pinOf(write: MemoryWrite): 'keep' | 'drop' | null {
  if (write.kind === 'forget') return 'drop';
  if (write.kind === 'pin') return 'keep';
  return write.kind === 'edit' && !write.custom ? 'keep' : null;
}

/** `edits` after `writes`: an edit of a digest is a player rewrite, its original kept behind it. */
export function editsAfter(edits: MemoryEditMap, writes: readonly MemoryWrite[]): MemoryEditMap {
  let out = edits;
  for (const write of writes) {
    if (write.kind === 'edit' && !write.custom) out = { ...out, [write.id]: { text: write.text, source: 'player' } };
  }
  return out;
}

/** `notes` after `writes`: an edit of a Custom line rewrites its text. */
export function notesAfter(notes: MemoryNote[], writes: readonly MemoryWrite[]): MemoryNote[] {
  let out = notes;
  for (const write of writes) {
    if (write.kind === 'edit' && write.custom) out = out.map((note) => (note.id === write.id ? { ...note, text: write.text } : note));
  }
  return out;
}

/** `deleted` after `writes`: `remove` tombstones the row, restorable from the Memory Manager. */
export function deletedAfter(deleted: string[], writes: readonly MemoryWrite[]): string[] {
  let out = deleted;
  for (const write of writes) {
    if (write.kind === 'remove' && !out.includes(write.id)) out = [...out, write.id];
  }
  return out;
}
