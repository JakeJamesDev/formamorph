import { randomUUID } from "@/lib/uuid";
import type { Dictionary, DictionaryEntry } from '@/types';

/** Pure array move (no dnd-kit dependency, so these reducers stay unit-testable). */
function move<T>(arr: T[], from: number, to: number): T[] {
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Reorder books so `activeId` lands at `overBookId`'s slot; book order = prompt order within each block. */
export function reorderBooks(books: Dictionary[], activeId: string, overBookId: string): Dictionary[] {
  const from = books.findIndex((b) => b.id === activeId);
  const to = books.findIndex((b) => b.id === overBookId);
  if (from === -1 || to === -1 || from === to) return books;
  return move(books, from, to);
}

/** Keep a book's Background (before) entries ahead of its Foreground (after) entries, each zone preserving
 *  its relative order — so the flat array order matches on-screen zone order (and the injection order). */
function normalizeZones(entries: DictionaryEntry[]): DictionaryEntry[] {
  const before = entries.filter((e) => e.position === 'before');
  const after = entries.filter((e) => e.position !== 'before');
  return [...before, ...after];
}

/**
 * Move an entry to a target book + position (Foreground/Background), inserting before `overEntryId` (or at
 * the zone's end when null). Sets the entry's `position` and keeps each book's zones contiguous. Works for
 * same-book reorders, cross-zone moves, and cross-book moves alike. Returns `books` unchanged if the entry
 * or target book can't be found (so a stray drop never loses an entry).
 */
export function moveEntryInBooks(
  books: Dictionary[],
  entryId: string,
  targetBookId: string,
  targetPosition: 'before' | 'after',
  overEntryId: string | null,
): Dictionary[] {
  if (!books.some((b) => b.id === targetBookId)) return books;
  // Dropped on itself (a pick-up with no move): a no-op, like arrayMove(i, i). Without this, stripping the
  // entry then `findIndex(over)` returns -1 (over IS the stripped entry) and the fallback appends it to the
  // zone's end — so any in-place drag would banish the item to the bottom.
  if (overEntryId === entryId) return books;

  // Same-zone downward reorder: the entry sat *above* `over` in the same zone of the same book. Each zone is
  // its own SortableContext, whose live preview (arrayMove) lands the entry *after* `over`. Insert-before —
  // correct for upward, cross-zone, and cross-book moves — would drop it one slot too high here, mismatching
  // the preview. Detected from the pre-move positions, so it only fires for a genuine same-zone reorder.
  // `position` defaults to 'after' (the Foreground zone) when unset, so compare with that default applied —
  // an untouched entry has `position: undefined` and a strict `===` would misread it as a cross-zone move.
  const zone = (e: DictionaryEntry) => e.position ?? 'after';
  const targetBook = books.find((b) => b.id === targetBookId);
  const movedOrig = targetBook?.entries.find((e) => e.id === entryId);
  const overOrig = overEntryId ? targetBook?.entries.find((e) => e.id === overEntryId) : undefined;
  const insertAfterOver =
    !!movedOrig && !!overOrig
    && zone(movedOrig) === zone(overOrig)
    && targetBook!.entries.indexOf(movedOrig) < targetBook!.entries.indexOf(overOrig);

  let moved: DictionaryEntry | undefined;
  const stripped = books.map((b) => {
    const idx = b.entries.findIndex((e) => e.id === entryId);
    if (idx === -1) return b;
    moved = { ...b.entries[idx], position: targetPosition };
    return { ...b, entries: b.entries.filter((e) => e.id !== entryId) };
  });
  if (!moved) return books;
  const movedEntry = moved;
  return stripped.map((b) => {
    if (b.id !== targetBookId) return b;
    const entries = b.entries.slice();
    const oi = overEntryId ? entries.findIndex((e) => e.id === overEntryId) : -1;
    const at = oi === -1 ? entries.length : insertAfterOver ? oi + 1 : oi;
    entries.splice(at, 0, movedEntry);
    return { ...b, entries: normalizeZones(entries) };
  });
}

/** Duplicate an entry in place (right after the original, same book), returning the new entry's id. */
export function duplicateEntryInBooks(books: Dictionary[], entryId: string): { books: Dictionary[]; newId: string | null } {
  let newId: string | null = null;
  const next = books.map((b) => {
    const idx = b.entries.findIndex((e) => e.id === entryId);
    if (idx === -1) return b;
    const copy: DictionaryEntry = { ...structuredClone(b.entries[idx]), id: randomUUID() };
    copy.name = `${copy.name} (Copy)`;
    newId = copy.id;
    return { ...b, entries: [...b.entries.slice(0, idx + 1), copy, ...b.entries.slice(idx + 1)] };
  });
  return { books: next, newId };
}
