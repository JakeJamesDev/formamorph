import type { BandTurn } from './turnBanding';
import { isMemoryDeleted, memoryRewrite, type TurnTextEdits } from './turnTextEdits';

/**
 * The player's memory changes, applied on top of the AI's digests: the shared text edit layer
 * (lib/turnTextEdits) and hand-written memories. Design: docs-internal/designs/memory-editing/design.md.
 *
 * Applied at the one chokepoint (`parseTurns` → `applyMemoryOverrides`) so every consumer — narration
 * recap, planner recap, selector input, semantic retrieval, the panel — reads the same effective text and
 * the model can never see a pre-edit version.
 */

/** A memory the player wrote that no turn produced. `anchorTurn` is the message-history length at
 *  creation, which places it chronologically against `BandTurn.index` (the same message-array domain) and
 *  is fixed for the note's life — a misplaced note is deleted and re-added. */
export interface MemoryNote {
  id: string;
  text: string;
  anchorTurn: number;
  /** A named memory's name as the script first wrote it. `text` and `anchorTurn` then mirror its newest revision. */
  name?: string;
  /** A named memory's writes, oldest first. */
  revisions?: NamedRevision[];
}

/** One write to a named memory: a script's, keyed by its turn, or the player's, with no turn. */
export interface NamedRevision {
  turnId?: string;
  text: string;
  anchorTurn: number;
  /** A script's `remove()`: the memory is gone while this revision is its newest, `text` keeping what it removed. */
  removed?: true;
}

/** Whether a script removed the named memory, so it reads as deleted until a restore or a rewind. */
export const isRemoved = (note: MemoryNote): boolean => note.revisions?.at(-1)?.removed === true;

export interface MemoryOverrides {
  textEdits?: TurnTextEdits;
  notes?: MemoryNote[];
}

/** Importance stamped on a player rewrite. The selector's scale is 1-3 and `importanceFactors` ranks
 *  within the band, so the top of that scale is what "the player touched this" resolves to. */
export const PLAYER_EDIT_IMPORTANCE = 3;

/** Fold the override layer into parsed turns. A tombstoned turn loses its `summary` only — the turn
 *  itself stays, so its narration still rides in the verbatim floor while it stops being a memory
 *  candidate anywhere (band, selector input, semantic retrieval). Returns a new array; inputs untouched. */
export function applyMemoryOverrides(turns: BandTurn[], overrides: MemoryOverrides | null | undefined): BandTurn[] {
  const layer = overrides?.textEdits;
  if (!layer || Object.keys(layer).length === 0) return turns;
  return turns.map((t) => {
    if (!t.turnId) return t;
    if (isMemoryDeleted(layer, t.turnId)) return { ...t, summary: undefined };
    const edit = memoryRewrite(layer, t.turnId);
    if (!edit) return t;
    return {
      ...t,
      summary: edit.text,
      importance: edit.source === 'player' ? PLAYER_EDIT_IMPORTANCE : t.importance,
    };
  });
}

/** The notes that actually ride, tombstones removed, chronological. */
export function activeNotes(overrides: MemoryOverrides | null | undefined): MemoryNote[] {
  const notes = overrides?.notes;
  if (!notes || notes.length === 0) return [];
  return notes.filter((n) => !isMemoryDeleted(overrides?.textEdits, n.id) && !isRemoved(n)).sort((a, b) => a.anchorTurn - b.anchorTurn);
}
