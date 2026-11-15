// Each turn's Mention Reading, by turn id (Q42). Held beside the history like script tells, so no request
// carries it. A reading belongs to one narration text: an edit or a regenerate drops it.

import type { ChatMessage } from '@/types';
import { parseTurnContent } from '@/lib/turnDigest';
import type { CorefModelId } from './corefManifest';
import type { MentionReading } from './mentionReading';

/** A turn's reading, with the model that made it and the narration it read. */
export interface TurnMentionReading {
  model: CorefModelId;
  version: number;
  /** FNV-1a of the narration the reading's spans index into. */
  textHash: string;
  reading: MentionReading;
}

export type MentionReadingMap = Record<string, TurnMentionReading>;

/** A short fingerprint of a narration text. */
export function narrationHash(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${text.length}:${(hash >>> 0).toString(16)}`;
}

/** The reading of a turn's narration, or null when there is none or it read another text. */
export function turnMentionReading(map: MentionReadingMap, turnId: string | undefined, narration: string): MentionReading | null {
  const entry = turnId ? map[turnId] : undefined;
  return entry && entry.textHash === narrationHash(narration) ? entry.reading : null;
}

/** Whether a turn's narration still needs a reading. */
export const needsMentionReading = (map: MentionReadingMap, turnId: string, narration: string): boolean =>
  turnMentionReading(map, turnId, narration) === null;

/** Each assistant turn's id and narration, newest last. */
function turnNarrations(history: readonly ChatMessage[]): Map<string, string> {
  const turns = new Map<string, string>();
  for (const message of history) {
    if (message.role !== 'assistant') continue;
    const turn = parseTurnContent(message.content);
    if (turn?.turnId) turns.set(turn.turnId, turn.narration ?? '');
  }
  return turns;
}

/** The map without readings of turns that left the history or whose narration changed. Unchanged when nothing drops. */
export function pruneMentionReadings(map: MentionReadingMap, history: readonly ChatMessage[]): MentionReadingMap {
  const ids = Object.keys(map);
  if (!ids.length) return map;
  const turns = turnNarrations(history);
  const kept = ids.filter((id) => {
    const narration = turns.get(id);
    return narration !== undefined && map[id].textHash === narrationHash(narration);
  });
  return kept.length === ids.length ? map : Object.fromEntries(kept.map((id) => [id, map[id]]));
}

/** The turns to read, newest first: the newest turn, and any turn in `read` (turns that had a reading) whose
 *  narration changed. Older turns are never backfilled (Q42). */
export function turnsToRead(
  history: readonly ChatMessage[], map: MentionReadingMap, read: ReadonlySet<string>,
): { turnId: string; narration: string }[] {
  const turns = [...turnNarrations(history)].reverse();
  return turns
    .filter(([turnId, narration], i) => (i === 0 || read.has(turnId)) && narration.trim() && needsMentionReading(map, turnId, narration))
    .map(([turnId, narration]) => ({ turnId, narration }));
}

/** Whether `history` still holds `turnId` with this narration. */
export const holdsTurn = (history: readonly ChatMessage[], turnId: string, narration: string): boolean =>
  turnNarrations(history).get(turnId) === narration;

/** The newest turn's id and narration, or null before the first narration. */
export function newestTurnNarration(history: readonly ChatMessage[]): { turnId: string; narration: string } | null {
  const last = history.findLast((message) => message.role === 'assistant');
  const turn = last ? parseTurnContent(last.content) : null;
  return turn?.turnId ? { turnId: turn.turnId, narration: turn.narration ?? '' } : null;
}

const isSpanList = (value: unknown, field: 'entityId' | 'speaker'): boolean => Array.isArray(value) && value.every((item) => {
  const span = item as Record<string, unknown> | null;
  return !!span && Number.isInteger(span.start) && Number.isInteger(span.end) && (span.start as number) <= (span.end as number)
    && (span[field] === null || typeof span[field] === 'string');
});

/** The map a save holds, read back. A save is a file the player can edit, so only well-formed readings stay. */
export function restoreMentionReadings(raw: unknown): MentionReadingMap {
  const restored: MentionReadingMap = {};
  if (!raw || typeof raw !== 'object') return restored;
  for (const [turnId, value] of Object.entries(raw)) {
    const entry = value as Partial<TurnMentionReading> | null;
    if (!entry || (entry.model !== 'big' && entry.model !== 'small') || typeof entry.version !== 'number'
      || typeof entry.textHash !== 'string' || !entry.reading
      || !isSpanList(entry.reading.mentions, 'entityId') || !isSpanList(entry.reading.quotes, 'speaker')) continue;
    const { model, version, textHash, reading } = entry as TurnMentionReading;
    restored[turnId] = {
      model, version, textHash,
      reading: {
        mentions: reading.mentions.map(({ start, end, entityId }) => ({ start, end, entityId })),
        quotes: reading.quotes.map(({ start, end, speaker }) => ({ start, end, speaker })),
      },
    };
  }
  return restored;
}
