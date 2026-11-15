// The player's corrections to Mention Readings, by turn id (Q42). Each overlays its turn's reading, so every
// consumer of a reading sees the corrected one.
import type { MentionReading } from './mentionReading';
import type { TextSpan } from '@/lib/quoteSegments';
import type { MentionReadingMap, TurnMentionReading } from './mentionReadings';

/** A mention's entity or a quote's speaker, set by the player; null is "Someone Else". Spans index into
 *  the turn's narration. */
export interface MentionCorrection {
  kind: 'mention' | 'quote';
  start: number;
  end: number;
  entityId: string | null;
}

/** A turn's corrections, oldest first, with the hash of the narration their spans index into. */
export interface TurnMentionCorrections {
  textHash: string;
  corrections: MentionCorrection[];
}

export type MentionCorrectionMap = Record<string, TurnMentionCorrections>;

const overlaps = (a: TextSpan, b: TextSpan) => a.start < b.end && b.start < a.end;
const byStart = (a: TextSpan, b: TextSpan) => a.start - b.start || b.end - a.end;

/** The reading with `corrections` applied in order. A correction replaces every span of its kind that overlaps
 *  it (Q38). */
export function correctReading(reading: MentionReading, corrections: readonly MentionCorrection[]): MentionReading {
  let { mentions, quotes } = reading;
  for (const { kind, start, end, entityId } of corrections) {
    if (kind === 'mention') mentions = [...mentions.filter((m) => !overlaps(m, { start, end })), { start, end, entityId }].sort(byStart);
    else quotes = [...quotes.filter((q) => !overlaps(q, { start, end })), { start, end, speaker: entityId }].sort(byStart);
  }
  return { mentions, quotes };
}

/** `map` with `correction` added to its turn. A later correction of the same span and kind replaces the earlier
 *  one. Corrections for another narration of the turn are dropped. */
export function addMentionCorrection(
  map: MentionCorrectionMap, turnId: string, textHash: string, correction: MentionCorrection,
): MentionCorrectionMap {
  const prior = map[turnId]?.textHash === textHash ? map[turnId].corrections : [];
  const kept = prior.filter((c) => c.kind !== correction.kind || c.start !== correction.start || c.end !== correction.end);
  return { ...map, [turnId]: { textHash, corrections: [...kept, correction] } };
}

/** `map` with a card's correction added, against the narration its turn's reading read. Unchanged when the turn
 *  has no reading. */
export function applyCardCorrection(
  map: MentionCorrectionMap, readings: MentionReadingMap, { turnId, ...correction }: MentionCorrection & { turnId: string },
): MentionCorrectionMap {
  const textHash = readings[turnId]?.textHash;
  return textHash ? addMentionCorrection(map, turnId, textHash, correction) : map;
}

// One corrected entry per reading entry and corrections entry, so consumers that memoize on a reading keep hits.
const corrected = new WeakMap<TurnMentionReading, WeakMap<TurnMentionCorrections, TurnMentionReading>>();

/** The readings with each turn's corrections overlaid. A turn without corrections for the narration its
 *  reading read keeps the same entry object. */
export function correctedMentionReadings(readings: MentionReadingMap, corrections: MentionCorrectionMap): MentionReadingMap {
  const ids = Object.keys(corrections).filter((id) => readings[id] && readings[id].textHash === corrections[id].textHash);
  if (!ids.length) return readings;
  const out = { ...readings };
  for (const id of ids) {
    const entry = readings[id];
    let byCorrections = corrected.get(entry);
    if (!byCorrections) {
      byCorrections = new WeakMap();
      corrected.set(entry, byCorrections);
    }
    let next = byCorrections.get(corrections[id]);
    if (!next) {
      next = { ...entry, reading: correctReading(entry.reading, corrections[id].corrections) };
      byCorrections.set(corrections[id], next);
    }
    out[id] = next;
  }
  return out;
}

const isCorrection = (value: unknown): value is MentionCorrection => {
  const c = value as Record<string, unknown> | null;
  return !!c && (c.kind === 'mention' || c.kind === 'quote') && Number.isInteger(c.start) && Number.isInteger(c.end)
    && (c.start as number) < (c.end as number) && (c.entityId === null || typeof c.entityId === 'string');
};

/** The map a save holds, read back. A save is a file the player can edit, so only well-formed corrections stay. */
export function restoreMentionCorrections(raw: unknown): MentionCorrectionMap {
  const restored: MentionCorrectionMap = {};
  if (!raw || typeof raw !== 'object') return restored;
  for (const [turnId, value] of Object.entries(raw)) {
    const entry = value as Partial<TurnMentionCorrections> | null;
    if (!entry || typeof entry.textHash !== 'string' || !Array.isArray(entry.corrections)) continue;
    const corrections = entry.corrections.filter(isCorrection).map(({ kind, start, end, entityId }) => ({ kind, start, end, entityId }));
    if (corrections.length) restored[turnId] = { textHash: entry.textHash, corrections };
  }
  return restored;
}
