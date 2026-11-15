import { describe, expect, it } from 'vitest';
import type { ChatMessage, Entity } from '@/types';
import { serializeTurnContent, recentSceneTurns } from '@/lib/turnDigest';
import { computePresence, introducedIds, metCheck, strangersInPlay } from '@/lib/presence';
import { bracketedNarration, knownNameFor, memoryNarrationFor, readingNamesFor, readingParticipants } from './mentionMemory';
import { narrationHash, type MentionReadingMap } from './mentionReadings';
import type { MentionReading } from './mentionReading';

// Passages written for these tests.
const ODILE: Entity = { id: 'odile', name: 'Odile', locations: ['mill'] };
const HOODED: Entity = { id: 'hooded', name: 'Sabine Thorne', strangerName: 'a hooded woman', locations: ['mill'] };
const QUIET: Entity = { id: 'quiet', name: 'Lucan Vey', strangerName: '', locations: ['mill'] };
const CAST = [ODILE, HOODED, QUIET];

/** Spans for each `[text, entityId]`, found in order in the passage. */
function readingOf(text: string, links: [string, string | null][], quotes: MentionReading['quotes'] = []): MentionReading {
  let from = 0;
  const mentions = links.map(([word, entityId]) => {
    const start = text.indexOf(word, from);
    if (start < 0) throw new Error(`"${word}" is not in the passage`);
    from = start + word.length;
    return { start, end: start + word.length, entityId };
  });
  return { mentions, quotes };
}

const PRONOUN_ONLY = 'Odile sets the sack down. She wipes her hands and turns to the door.';
const PRONOUN_READING = readingOf(PRONOUN_ONLY, [['Odile', 'odile'], ['She', 'odile'], ['her', 'odile']]);

const STRANGER = 'The door creaks. She slips inside and shakes the rain from her hood.';
const STRANGER_READING = readingOf(STRANGER, [['She', 'hooded'], ['her', 'hooded']]);

const entry = (narration: string, reading: MentionReading) =>
  ({ model: 'small' as const, version: 1, textHash: narrationHash(narration), reading });

describe('readingParticipants', () => {
  it('names an entity the prose links only by pronoun', () => {
    const reading = readingOf(STRANGER, [['She', 'hooded']]);
    expect(readingParticipants(STRANGER, reading, CAST)).toEqual(['Sabine Thorne']);
  });

  it('skips a mention inside quoted speech', () => {
    const text = 'Odile laughs. "She never pays," she says.';
    const reading = readingOf(text, [['Odile', 'odile'], ['She', 'hooded'], ['she', 'odile']]);
    expect(readingParticipants(text, reading, CAST)).toEqual(['Odile']);
  });

  it('adds nobody without a reading, or for an unnamed cluster', () => {
    expect(readingParticipants(STRANGER, null, CAST)).toEqual([]);
    expect(readingParticipants(STRANGER, readingOf(STRANGER, [['She', null]]), CAST)).toEqual([]);
  });
});

describe('In Scene from a reading', () => {
  const history: ChatMessage[] = [
    { role: 'user', content: 'Wait by the stove.' },
    { role: 'assistant', content: serializeTurnContent({ narration: STRANGER, choices: [], stat_changes: [], turnId: 't1', entities: [] }) },
  ];
  const readings: MentionReadingMap = { t1: entry(STRANGER, STRANGER_READING) };
  const presenceWith = (names?: ReturnType<typeof readingNamesFor>) => computePresence({
    entities: CAST, runtime: [], positions: {}, generics: {}, followers: [], locationId: 'mill',
    locations: [{ id: 'mill', parentId: null }], connections: [], persona: null, met: [], strangerAliases: {},
    turns: recentSceneTurns(history, 3, names),
  });

  it('puts a pronoun-only stranger In Scene and leaves it unmet, under its Stranger Name', () => {
    const presence = presenceWith(readingNamesFor(true, readings, CAST));
    expect(presence.inScene.map((p) => p.entity.id)).toEqual(['hooded']);
    const row = presence.byId.get('hooded')!;
    expect(row.met).toBe(false);
    expect(row.label).toBe('a hooded woman');
    // The met write reads names only: the passage names nobody.
    expect(introducedIds(STRANGER, CAST, ['hooded'])).toEqual([]);
  });

  it('matches today with the feature off', () => {
    expect(readingNamesFor(false, readings, CAST)).toBeUndefined();
    expect(presenceWith(undefined).inScene).toEqual([]);
  });

  it('ignores a reading of other text', () => {
    const stale: MentionReadingMap = { t1: entry(`${STRANGER} More.`, STRANGER_READING) };
    expect(presenceWith(readingNamesFor(true, stale, CAST)).inScene).toEqual([]);
  });
});

describe('bracketedNarration', () => {
  const names = (id: string) => CAST.find((e) => e.id === id)?.name;

  it('follows each linked mention with its name, and leaves a mention that holds it', () => {
    expect(bracketedNarration(PRONOUN_ONLY, PRONOUN_READING, names)?.text)
      .toBe('Odile sets the sack down. She [Odile] wipes her [Odile] hands and turns to the door.');
  });

  it('is null when nothing gets a bracket', () => {
    expect(bracketedNarration(PRONOUN_ONLY, readingOf(PRONOUN_ONLY, [['Odile', 'odile'], ['She', null]]), names)).toBeNull();
    expect(bracketedNarration(STRANGER, STRANGER_READING, () => undefined)).toBeNull();
  });

  it('scrubs the tags it added from a reply, and nothing else', () => {
    const view = bracketedNarration(PRONOUN_ONLY, PRONOUN_READING, names)!;
    expect(view.scrub('She [Odile] left the [old] mill.')).toBe('She left the [old] mill.');
  });
});

describe('knownNameFor', () => {
  const met = (ids: string[]) => metCheck(ids, null, [], new Set());

  it('gives the true name once met, else the stranger label, else nothing', () => {
    const isMet = met([]);
    const { labels } = strangersInPlay(CAST, isMet, {});
    const name = knownNameFor(CAST, isMet, labels);
    expect(name('odile')).toBe('Odile');
    expect(name('hooded')).toBe('a hooded woman');
    expect(name('quiet')).toBeUndefined();
    expect(name('nobody')).toBeUndefined();
    const metNow = met(['hooded']);
    expect(knownNameFor(CAST, metNow, strangersInPlay(CAST, metNow, {}).labels)('hooded')).toBe('Sabine Thorne');
  });

  it('never brackets an unmet stranger with the true name', () => {
    const isMet = met([]);
    const view = memoryNarrationFor(true, { t1: entry(STRANGER, STRANGER_READING) }, knownNameFor(CAST, isMet, strangersInPlay(CAST, isMet, {}).labels));
    const text = view?.('t1', STRANGER)?.text;
    expect(text).toBe('The door creaks. She [a hooded woman] slips inside and shakes the rain from her [a hooded woman] hood.');
    expect(text).not.toContain('Sabine');
  });
});
