// Each turn's Mention Reading, by turn id (Q42). Held beside the history like script tells, so no request
// carries it. A reading belongs to one narration text: an edit or a regenerate drops it.

import type { ChatMessage } from '@/types';
import { parseTurnContent } from '@/lib/turnDigest';
import type { CorefModelId } from './corefManifest';
import type { MentionReading, QuoteRule, QuoteSpeaker, ReadingSpan } from './mentionReading';
import type { CorefCluster } from './corefHost';

/** A turn's reading, with the model that made it and the narration it read. */
export interface TurnMentionReading {
  model: CorefModelId;
  version: number;
  /** FNV-1a of the narration the reading's spans index into. */
  textHash: string;
  reading: MentionReading;
  /** The host's clusters and each one's entity, which a contribution sends (Q35). A reading without them sends nothing (Q59). */
  clusters?: CorefCluster[];
  clusterEntities?: (string | null)[];
  /** The `readingVersion` the rules ran at; absent on a reading made before it was kept. */
  readingVersion?: number;
  /** The ids of the cast the reading voted with, the persona apart; absent on a reading made before they were kept. */
  castIds?: string[];
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
export function turnNarrations(history: readonly ChatMessage[]): Map<string, string> {
  const turns = new Map<string, string>();
  for (const message of history) {
    if (message.role !== 'assistant') continue;
    const turn = parseTurnContent(message.content);
    if (turn?.turnId) turns.set(turn.turnId, turn.narration ?? '');
  }
  return turns;
}

/** The map without entries of turns that left the history or whose narration changed. Unchanged when nothing
 *  drops. Readings and corrections both prune this way. */
export function pruneByNarration<T extends { textHash: string }>(map: Record<string, T>, history: readonly ChatMessage[]): Record<string, T> {
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

/** A turn's narration, or undefined when `history` no longer holds the turn. */
export const turnNarration = (history: readonly ChatMessage[], turnId: string): string | undefined =>
  turnNarrations(history).get(turnId);

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

const isClusterList = (clusters: unknown, entities: unknown): clusters is CorefCluster[] =>
  Array.isArray(clusters) && Array.isArray(entities) && clusters.length === entities.length
  && entities.every((id) => id === null || typeof id === 'string')
  && clusters.every((cluster) => Array.isArray(cluster) && cluster.length > 0 && cluster.every((span) =>
    Array.isArray(span) && span.length === 2 && Number.isInteger(span[0]) && Number.isInteger(span[1]) && span[0] < span[1]));

const isSpan = (value: unknown): value is ReadingSpan => {
  const span = value as Record<string, unknown> | null;
  return !!span && Number.isInteger(span.start) && Number.isInteger(span.end) && (span.start as number) < (span.end as number);
};
const isRule = (value: unknown): value is QuoteRule => typeof value === 'string' && /^[a-z-]{1,40}$/.test(value);

/** A saved quote, read back: its span and speaker, and each record field that is well-formed. A quote saved before
 *  the record fields came back without them. */
export function restoreQuote(quote: QuoteSpeaker & { fallback?: unknown }): QuoteSpeaker & { fallback?: QuoteRule | null } {
  const { start, end, speaker, rule, mention, firstPerson, fallback } = quote;
  return {
    start, end, speaker,
    ...(isRule(rule) ? { rule } : {}),
    ...(mention === null ? { mention: null } : isSpan(mention) ? { mention: { start: mention.start, end: mention.end } } : {}),
    ...(Array.isArray(firstPerson) && firstPerson.every(isSpan) ? { firstPerson: firstPerson.map(({ start: s, end: e }) => ({ start: s, end: e })) } : {}),
    ...(fallback === null || isRule(fallback) ? { fallback } : {}),
  };
}

/** The map a save holds, read back. A save is a file the player can edit, so only well-formed readings stay. */
export function restoreMentionReadings(raw: unknown): MentionReadingMap {
  const restored: MentionReadingMap = {};
  if (!raw || typeof raw !== 'object') return restored;
  for (const [turnId, value] of Object.entries(raw)) {
    const entry = value as Partial<TurnMentionReading> | null;
    if (!entry || (entry.model !== 'big' && entry.model !== 'small') || typeof entry.version !== 'number'
      || typeof entry.textHash !== 'string' || !entry.reading
      || !isSpanList(entry.reading.mentions, 'entityId') || !isSpanList(entry.reading.quotes, 'speaker')) continue;
    const { model, version, textHash, reading, clusters, clusterEntities, readingVersion, castIds } = entry as TurnMentionReading;
    restored[turnId] = {
      model, version, textHash,
      reading: {
        mentions: reading.mentions.map(({ start, end, entityId }) => ({ start, end, entityId })),
        quotes: reading.quotes.map(restoreQuote),
      },
      ...(Number.isInteger(readingVersion) && (readingVersion as number) > 0 ? { readingVersion } : {}),
      ...(Array.isArray(castIds) && castIds.every((id) => typeof id === 'string') ? { castIds: [...castIds] } : {}),
      ...(isClusterList(clusters, clusterEntities)
        ? { clusters: clusters.map((cluster) => cluster.map(([s, e]): [number, number] => [s, e])), clusterEntities: [...(clusterEntities ?? [])] }
        : {}),
    };
  }
  return restored;
}
