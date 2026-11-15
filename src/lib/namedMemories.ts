// Named memories: Custom memories a script finds again by name, whose script writes rewind with their turn and
// whose player writes never do (Q3, Q4, Q7, Q8, Q10, Q11, Q20-Q24).

import type { ChatMessage } from '@/types';
import { isRemoved, type MemoryNote, type NamedRevision } from './memoryOverrides';
import { survivingTurnIds } from './turnDigest';

/** One script write to a named memory: `memories.pin(name, text)` or `edit(text)` on its entry, or `remove()` on it. */
export type NamedWrite = { name: string; text: string } | { name: string; remove: true };

/** The form two names match in: trimmed, case-insensitive. */
export const nameKey = (name: string): string => name.trim().toLowerCase();

/** The id a memory takes when `turnId`'s pin creates it under `name`. */
export const namedId = (turnId: string, name: string): string => `named:${turnId}:${nameKey(name)}`;

/** The memory that holds `name`, or undefined. A player-deleted memory holds no name; a script-removed one still does. */
export function findNamed(notes: readonly MemoryNote[], deleted: readonly string[], name: string): MemoryNote | undefined {
  const key = nameKey(name);
  return notes.find((note) => note.name !== undefined && nameKey(note.name) === key && !deleted.includes(note.id));
}

const isScript = (revision: NamedRevision): revision is NamedRevision & { turnId: string } => revision.turnId !== undefined;

/** `note` with its text from its newest revision and its anchor from its newest script revision. */
function resolved(note: MemoryNote, revisions: NamedRevision[]): MemoryNote {
  const latest = revisions[revisions.length - 1];
  const anchor = revisions.findLast(isScript) ?? latest;
  return { ...note, revisions, text: latest.text, anchorTurn: anchor.anchorTurn };
}

/** `notes` with `writes` applied in call order. A write to a held name is the turn's newest revision, overwriting what
 *  the turn wrote before; a pin of a new name makes a memory; a removal of an unknown name changes nothing. */
export function addNamedWrites(
  notes: readonly MemoryNote[], deleted: readonly string[], turnId: string, writes: readonly NamedWrite[], anchorTurn: number,
): MemoryNote[] {
  let out = notes as MemoryNote[];
  for (const write of writes) {
    const held = findNamed(out, deleted, write.name);
    if (held) {
      // A removal keeps the text and anchor it removed, so a restore or a rewind has them.
      const revision: NamedRevision = 'remove' in write
        ? { turnId, text: held.text, anchorTurn: held.anchorTurn, removed: true }
        : { turnId, text: write.text, anchorTurn };
      const revisions = [...(held.revisions ?? []).filter((r) => r.turnId !== turnId), revision];
      out = out.map((note) => (note === held ? resolved(note, revisions) : note));
    } else if (!('remove' in write)) {
      const base = namedId(turnId, write.name);
      let id = base;
      // A deleted id stays taken after its note prunes, or the new memory would read as deleted.
      for (let n = 2; out.some((note) => note.id === id) || deleted.includes(id); n++) id = `${base}#${n}`;
      out = [...out, { id, name: write.name.trim(), text: write.text, anchorTurn, revisions: [{ turnId, text: write.text, anchorTurn }] }];
    }
  }
  return out;
}

/** `notes` with the turn's named writes set to `writes`, overwriting what the turn wrote when it committed before. */
export function withNamedWrites(
  notes: readonly MemoryNote[], deleted: readonly string[], turnId: string, writes: readonly NamedWrite[], anchorTurn: number,
): MemoryNote[] {
  return addNamedWrites(keepingTurns(notes, (id) => id !== turnId), deleted, turnId, writes, anchorTurn);
}

/** `notes` without the named revisions of turns no longer in `history`. A memory with no script revision left goes. */
export function pruneNamedMemories(notes: readonly MemoryNote[], history: ChatMessage[]): MemoryNote[] {
  const live = survivingTurnIds(history);
  return keepingTurns(notes, (id) => live.has(id));
}

/** `notes` keeping only the script revisions whose turn `keep` accepts; player revisions always stay. A memory with
 *  no script revision left goes. */
function keepingTurns(notes: readonly MemoryNote[], keep: (turnId: string) => boolean): MemoryNote[] {
  let changed = false;
  const out = notes.flatMap((note): MemoryNote[] => {
    const revisions = note.revisions;
    if (!revisions) return [note];
    const kept = revisions.filter((r) => !isScript(r) || keep(r.turnId));
    if (kept.length === revisions.length) return [note];
    changed = true;
    // In a linear history the creating pin leaves last, so this is "the creator left"; it also holds when a
    // regenerated turn wrote before the prune ran.
    if (!kept.some(isScript)) return [];
    return [resolved(note, kept)];
  });
  return changed ? out : notes as MemoryNote[];
}

/** `notes` after the player rewrites memory `id`. A named memory gains a player revision that no rewind takes. */
export function playerEdit(notes: readonly MemoryNote[], id: string, text: string): MemoryNote[] {
  return notes.map((note) => {
    if (note.id !== id) return note;
    if (!note.revisions) return { ...note, text };
    return resolved(note, [...note.revisions, { text, anchorTurn: note.anchorTurn }]);
  });
}

/** The notes and deletions after the player restores memory `id`. A script-removed memory comes back through a player
 *  revision. A memory whose name another memory holds comes back as a plain unnamed memory. */
export function restoreMemory(
  notes: readonly MemoryNote[], deleted: readonly string[], id: string,
): { notes: MemoryNote[]; deleted: string[] } {
  const nextDeleted = deleted.includes(id) ? deleted.filter((at) => at !== id) : deleted as string[];
  const note = notes.find((at) => at.id === id);
  if (!note?.revisions) return { notes: notes as MemoryNote[], deleted: nextDeleted };
  const back = isRemoved(note) ? resolved(note, [...note.revisions, { text: note.text, anchorTurn: note.anchorTurn }]) : note;
  const taken = note.name !== undefined && findNamed(notes.filter((at) => at !== note), nextDeleted, note.name);
  const restored: MemoryNote = taken ? { id: back.id, text: back.text, anchorTurn: back.anchorTurn } : back;
  return { notes: notes.map((at) => (at === note ? restored : at)), deleted: nextDeleted };
}

/** The notes and deletions after Reset All: every deleted memory restored one at a time, then every script removal. */
export function restoreAll(notes: readonly MemoryNote[], deleted: readonly string[]): { notes: MemoryNote[]; deleted: string[] } {
  const ids = [...deleted, ...notes.filter(isRemoved).map((note) => note.id)];
  return ids.reduce((at, id) => restoreMemory(at.notes, at.deleted, id), { notes: notes as MemoryNote[], deleted: deleted as string[] });
}
