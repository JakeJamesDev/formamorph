// Named memories: Custom memories a script finds again by name, whose script writes rewind with their turn (Q3, Q4, Q10).

import type { ChatMessage } from '@/types';
import type { MemoryNote, NamedRevision } from './memoryOverrides';
import { survivingTurnIds } from './turnDigest';

/** One `memories.pin(name, text)` call. */
export interface NamedPin {
  name: string;
  text: string;
}

/** The form two names match in: trimmed, case-insensitive. */
export const nameKey = (name: string): string => name.trim().toLowerCase();

/** The id a memory takes when `turnId`'s pin creates it under `name`. */
export const namedId = (turnId: string, name: string): string => `named:${turnId}:${nameKey(name)}`;

/** The live memory `name` names, or undefined. A deleted memory holds no name. */
export function findNamed(notes: readonly MemoryNote[], deleted: readonly string[], name: string): MemoryNote | undefined {
  const key = nameKey(name);
  return notes.find((note) => note.name !== undefined && nameKey(note.name) === key && !deleted.includes(note.id));
}

/** `note` with its text and anchor taken from its newest revision. */
function resolved(note: MemoryNote, revisions: NamedRevision[]): MemoryNote {
  const latest = revisions[revisions.length - 1];
  return { ...note, revisions, text: latest.text, anchorTurn: latest.anchorTurn };
}

/** `notes` with `pins` applied in call order: a live name's text is overwritten for the turn, a new name makes a memory. */
export function addNamedPins(
  notes: readonly MemoryNote[], deleted: readonly string[], turnId: string, pins: readonly NamedPin[], anchorTurn: number,
): MemoryNote[] {
  let out = notes as MemoryNote[];
  for (const { name, text } of pins) {
    const revision: NamedRevision = { turnId, text, anchorTurn };
    const held = findNamed(out, deleted, name);
    if (held) {
      // One revision per turn, overwritten by a later write in the turn; the creating revision stays first.
      const kept = (held.revisions ?? []).filter((r) => r.turnId !== turnId);
      const revisions = held.revisions?.[0]?.turnId === turnId ? [revision, ...kept] : [...kept, revision];
      out = out.map((note) => (note === held ? resolved(note, revisions) : note));
    } else {
      const base = namedId(turnId, name);
      let id = base;
      for (let n = 2; out.some((note) => note.id === id); n++) id = `${base}#${n}`;
      out = [...out, { id, name: name.trim(), text, anchorTurn, revisions: [revision] }];
    }
  }
  return out;
}

/** `notes` with the turn's named writes set to `pins`, overwriting what the turn wrote when it committed before. */
export function withNamedPins(
  notes: readonly MemoryNote[], deleted: readonly string[], turnId: string, pins: readonly NamedPin[], anchorTurn: number,
): MemoryNote[] {
  return addNamedPins(withoutTurns(notes, (id) => id !== turnId), deleted, turnId, pins, anchorTurn);
}

/** `notes` without the named revisions of turns no longer in `history`. A memory with no script revision left goes. */
export function pruneNamedMemories(notes: readonly MemoryNote[], history: ChatMessage[]): MemoryNote[] {
  const live = survivingTurnIds(history);
  return withoutTurns(notes, (id) => live.has(id));
}

/** `notes` keeping only the script revisions whose turn `keep` accepts; player revisions always stay. */
function withoutTurns(notes: readonly MemoryNote[], keep: (turnId: string) => boolean): MemoryNote[] {
  let changed = false;
  const out = notes.flatMap((note): MemoryNote[] => {
    const revisions = note.revisions;
    if (!revisions) return [note];
    const kept = revisions.filter((r) => r.turnId === undefined || keep(r.turnId));
    if (kept.length === revisions.length) return [note];
    changed = true;
    // In a linear history the creating pin leaves last, so this is "the creator left"; it also holds when a
    // regenerated turn wrote before the prune ran.
    if (!kept.some((r) => r.turnId !== undefined)) return [];
    return [resolved(note, kept)];
  });
  return changed ? out : notes as MemoryNote[];
}
