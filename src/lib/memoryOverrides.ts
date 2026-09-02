import type { BandTurn } from './turnBanding';

/**
 * The player's memory override layer: rewrites, deletions and hand-written memories, applied on top of
 * the AI's digests. Design: docs-internal/designs/memory-editing-design.md.
 *
 * The AI's original is never destroyed — `summary` on the turn stays exactly as the digest wrote it and
 * every override lives in its own map, keyed by turn id like `memoryPins`. Clearing an override restores
 * the original text and its stored verdict, so every change is reversible from the save alone.
 *
 * Applied at the one chokepoint (`parseTurns` → `applyMemoryOverrides`) so every consumer — narration
 * recap, planner recap, selector input, semantic retrieval, the panel — reads the same effective text and
 * the model can never see a pre-edit version.
 */

/** One rewritten summary. `source` separates the two ways text gets replaced: a player rewrite is intent
 *  (force-kept and top-ranked), a regeneration is just fresher AI text under the selector's usual verdict. */
export interface MemoryEdit {
  text: string;
  source: 'player' | 'ai';
}

export type MemoryEditMap = Record<string, MemoryEdit>;

/** A memory the player wrote that no turn produced. `anchorTurn` is the message-history length at
 *  creation, which places it chronologically against `BandTurn.index` (the same message-array domain) and
 *  is fixed for the note's life — a misplaced note is deleted and re-added. */
export interface MemoryNote {
  id: string;
  text: string;
  anchorTurn: number;
}

export interface MemoryOverrides {
  edits?: MemoryEditMap;
  deleted?: string[];
  notes?: MemoryNote[];
}

/** Importance stamped on a player rewrite. The selector's scale is 1-3 and `importanceFactors` ranks
 *  within the band, so the top of that scale is what "the player touched this" resolves to. */
export const PLAYER_EDIT_IMPORTANCE = 3;

/** Fold the override layer into parsed turns. A tombstoned turn loses its `summary` only — the turn
 *  itself stays, so its narration still rides in the verbatim floor while it stops being a memory
 *  candidate anywhere (band, selector input, semantic retrieval). Returns a new array; inputs untouched. */
export function applyMemoryOverrides(turns: BandTurn[], overrides: MemoryOverrides | null | undefined): BandTurn[] {
  if (!overrides) return turns;
  const { edits, deleted } = overrides;
  const gone = deleted && deleted.length ? new Set(deleted) : null;
  const hasEdits = edits && Object.keys(edits).length > 0;
  if (!gone && !hasEdits) return turns;
  return turns.map((t) => {
    if (!t.turnId) return t;
    if (gone?.has(t.turnId)) return { ...t, summary: undefined };
    const edit = edits?.[t.turnId];
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
  const gone = overrides?.deleted?.length ? new Set(overrides.deleted) : null;
  return notes.filter((n) => !gone?.has(n.id)).sort((a, b) => a.anchorTurn - b.anchorTurn);
}
