/**
 * The play log's append rule and its world/system split.
 *
 * The log mixes two feeds: things that happened in the story (moving, a trait landing, starving) and
 * things that happened to the app (saving, a failed load, an aborted request). Only the first kind gets an
 * in-world timestamp — dating "Game saved" to a story evening states something false about the fiction.
 *
 * Pure and React-free so the append rule is testable without standing up the provider.
 */

import type { LogEntry } from '@/types';

export type LogKind = 'world' | 'system';

/** Entries written before the split carry no `kind`. Everything was stamped back then, so they read as
 *  story events and those saves render exactly as they did. */
export function logKind(entry: LogEntry): LogKind {
  return entry.kind ?? 'world';
}

/**
 * Append an entry, collapsing a consecutive exact repeat into the previous entry's `repeat` count.
 *
 * A repeat must match on kind as well as wording: the two feeds render differently, so collapsing across
 * the split would hide an app message inside a story event's count. The surviving entry keeps the FIRST
 * occurrence's timestamp — a repeat count says when something started, not when it last fired — and is a
 * new object, since saved snapshots hold these entries by reference and must not change retroactively.
 */
export function appendLogEntry(
  entries: LogEntry[],
  text: string,
  gameTime: number,
  kind: LogKind,
): LogEntry[] {
  const last = entries[entries.length - 1];
  if (last && last.text === text && logKind(last) === kind) {
    return [...entries.slice(0, -1), { ...last, repeat: (last.repeat || 0) + 1 }];
  }
  return [...entries, { text, gameTime, repeat: 0, kind }];
}
