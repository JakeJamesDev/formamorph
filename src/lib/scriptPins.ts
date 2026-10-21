// The memories `memories.pin` adds: Memory Manager notes whose id names their turn, so a turn that leaves the
// history takes its pins with it (Q16, Q36).

import type { ChatMessage } from '@/types';
import type { MemoryNote } from './memoryOverrides';
import { survivingTurnIds } from './turnDigest';

const PREFIX = 'script:';

const pinId = (turnId: string, index: number) => `${PREFIX}${turnId}:${index}`;

/** The turn id a script pin's note id names, or null for a note the player wrote. */
const pinTurn = (note: MemoryNote): string | null =>
  (note.id.startsWith(PREFIX) ? note.id.slice(PREFIX.length, note.id.lastIndexOf(':')) : null);

/** A script pin's place among its turn's pins. */
const pinIndex = (note: MemoryNote): number => Number(note.id.slice(note.id.lastIndexOf(':') + 1));

/** `notes` with the turn's pins set to `lines`, anchored at `anchorTurn`. The same list when the turn pins nothing new. */
export function withScriptPins(notes: readonly MemoryNote[], turnId: string, lines: readonly string[], anchorTurn: number): MemoryNote[] {
  const others = notes.filter((note) => pinTurn(note) !== turnId);
  if (!lines.length && others.length === notes.length) return notes as MemoryNote[];
  return [...others, ...lines.map((text, index) => ({ id: pinId(turnId, index), text, anchorTurn }))];
}

/** `notes` with `lines` after the turn's pins, anchored at `anchorTurn`. The same list when `lines` is empty. */
export function addScriptPins(notes: readonly MemoryNote[], turnId: string, lines: readonly string[], anchorTurn: number): MemoryNote[] {
  if (!lines.length) return notes as MemoryNote[];
  // Past the turn's highest index, so a pin the player deleted frees no id a kept one holds.
  const next = Math.max(-1, ...notes.filter((note) => pinTurn(note) === turnId).map(pinIndex)) + 1;
  return [...notes, ...lines.map((text, index) => ({ id: pinId(turnId, next + index), text, anchorTurn }))];
}

/** `notes` without the pins of turns no longer in `history`: a failed, rolled-back or re-generated turn. */
export function pruneScriptPins(notes: readonly MemoryNote[], history: ChatMessage[]): MemoryNote[] {
  const live = survivingTurnIds(history);
  const kept = notes.filter((note) => {
    const turnId = pinTurn(note);
    return turnId === null || live.has(turnId);
  });
  return kept.length === notes.length ? notes as MemoryNote[] : kept;
}
