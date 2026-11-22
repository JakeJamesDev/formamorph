import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '@/types';
import {
  addMentionCorrection, applyCardCorrection, correctReading, correctedMentionReadings, restoreMentionCorrections,
  type MentionCorrectionMap,
} from './mentionCorrections';
import { pruneByNarration } from './mentionReadings';
import { readingNamesFor } from './mentionMemory';
import { narrationHash, type MentionReadingMap } from './mentionReadings';
import type { MentionReading } from './mentionReading';

const TEXT = 'Mira waves. She grins. "Go," the courier says.';
const at = (word: string, from = 0) => {
  const start = TEXT.indexOf(word, from);
  return { start, end: start + word.length };
};
const READING: MentionReading = {
  mentions: [{ ...at('Mira'), entityId: 'mira' }, { ...at('She'), entityId: 'mira' }, { ...at('the courier'), entityId: 'courier' }],
  quotes: [{ ...at('"Go,"'), speaker: 'courier' }],
};
const HASH = narrationHash(TEXT);
const READINGS: MentionReadingMap = { t1: { model: 'small', version: 1, textHash: HASH, reading: READING } };
const CAST = [{ id: 'mira', name: 'Mira' }, { id: 'kessa', name: 'Kessa' }, { id: 'courier', name: 'Ilan' }];
const turn = (turnId: string, narration: string): ChatMessage => ({ role: 'assistant', content: JSON.stringify({ turnId, narration, choices: [] }) });

describe('correctReading', () => {
  it("relinks a mention and leaves the others", () => {
    const fixed = correctReading(READING, [{ kind: 'mention', ...at('She'), entityId: 'kessa' }]);
    expect(fixed.mentions).toEqual([READING.mentions[0], { ...at('She'), entityId: 'kessa' }, READING.mentions[2]]);
    expect(fixed.quotes).toBe(READING.quotes);
  });

  it('unlinks a mention with "Not Listed"', () => {
    const fixed = correctReading(READING, [{ kind: 'mention', ...at('She'), entityId: null }]);
    expect(fixed.mentions.find((m) => m.start === at('She').start)?.entityId).toBeNull();
  });

  it('removes the link of a non-mention and adds none', () => {
    const fixed = correctReading(READING, [{ kind: 'nonMention', ...at('She'), entityId: null }]);
    expect(fixed.mentions).toEqual([READING.mentions[0], READING.mentions[2]]);
    expect(fixed.quotes).toBe(READING.quotes);
  });

  it('replaces every span its correction overlaps (Q38)', () => {
    const wide = { start: at('the courier').start, end: at('the courier').end };
    const reading = { ...READING, mentions: [...READING.mentions, { ...at('courier'), entityId: 'courier' }] };
    const fixed = correctReading(reading, [{ kind: 'mention', ...wide, entityId: 'kessa' }]);
    expect(fixed.mentions.filter((m) => m.start >= wide.start)).toEqual([{ ...wide, entityId: 'kessa' }]);
  });

  it("changes a quote's speaker, not its mentions", () => {
    const fixed = correctReading(READING, [{ kind: 'quote', ...at('"Go,"'), entityId: 'mira' }]);
    expect(fixed.quotes).toEqual([{ ...at('"Go,"'), speaker: 'mira' }]);
    expect(fixed.mentions).toBe(READING.mentions);
  });

  it('keeps a corrected quote’s rule, mention and first person, and changes only its speaker', () => {
    const record = { rule: 'beat' as const, mention: { start: 0, end: 4 }, firstPerson: [{ start: 1, end: 2 }] };
    const reading = { ...READING, quotes: [{ ...at('"Go,"'), speaker: 'courier', ...record }] };
    const fixed = correctReading(reading, [{ kind: 'quote', ...at('"Go,"'), entityId: 'mira' }]);
    expect(fixed.quotes).toEqual([{ ...at('"Go,"'), speaker: 'mira', ...record }]);
    expect(reading.quotes[0].speaker).toBe('courier');
  });

  it('applies corrections in order, the later one winning', () => {
    const fixed = correctReading(READING, [
      { kind: 'mention', ...at('She'), entityId: 'kessa' }, { kind: 'mention', ...at('She'), entityId: 'courier' },
    ]);
    expect(fixed.mentions[1].entityId).toBe('courier');
  });
});

describe('the corrections map', () => {
  it('overlays corrections on the readings, and the In Scene names follow at once', () => {
    const before = readingNamesFor(true, READINGS, CAST)!('t1', TEXT);
    expect(before).toEqual(['Mira', 'Ilan']);
    const corrections = addMentionCorrection({}, 't1', HASH, { kind: 'mention', ...at('She'), entityId: 'kessa' });
    const names = readingNamesFor(true, correctedMentionReadings(READINGS, corrections), CAST)!('t1', TEXT);
    expect(names).toEqual(['Mira', 'Kessa', 'Ilan']);
  });

  it('keeps the same objects for turns without corrections, and the same corrected entry on recompute', () => {
    expect(correctedMentionReadings(READINGS, {})).toBe(READINGS);
    const both: MentionReadingMap = { ...READINGS, t2: { ...READINGS.t1 } };
    const corrections = addMentionCorrection({}, 't1', HASH, { kind: 'mention', ...at('She'), entityId: null });
    const first = correctedMentionReadings(both, corrections);
    expect(first.t2).toBe(both.t2);
    expect(correctedMentionReadings(both, corrections).t1).toBe(first.t1);
  });

  it('ignores corrections made on another narration of the turn', () => {
    const stale = addMentionCorrection({}, 't1', narrationHash('Older text.'), { kind: 'mention', start: 0, end: 4, entityId: null });
    expect(correctedMentionReadings(READINGS, stale)).toBe(READINGS);
    const fresh = addMentionCorrection(stale, 't1', HASH, { kind: 'mention', ...at('She'), entityId: null });
    expect(fresh.t1.corrections).toEqual([{ kind: 'mention', ...at('She'), entityId: null }]);
  });

  it("files a card's correction under the narration its turn's reading read, and skips a turn with no reading", () => {
    const card = { turnId: 't1', kind: 'mention' as const, ...at('She'), entityId: 'kessa' };
    expect(applyCardCorrection({}, READINGS, card)).toEqual({ t1: { textHash: HASH, corrections: [{ kind: 'mention', ...at('She'), entityId: 'kessa' }] } });
    const none: MentionCorrectionMap = {};
    expect(applyCardCorrection(none, READINGS, { ...card, turnId: 't9' })).toBe(none);
  });

  it('replaces an earlier correction of the same span and kind', () => {
    let map: MentionCorrectionMap = addMentionCorrection({}, 't1', HASH, { kind: 'mention', ...at('She'), entityId: 'kessa' });
    map = addMentionCorrection(map, 't1', HASH, { kind: 'quote', ...at('"Go,"'), entityId: 'mira' });
    map = addMentionCorrection(map, 't1', HASH, { kind: 'mention', ...at('She'), entityId: null });
    expect(map.t1.corrections).toEqual([
      { kind: 'quote', ...at('"Go,"'), entityId: 'mira' }, { kind: 'mention', ...at('She'), entityId: null },
    ]);
  });

  it('keeps corrections when other turns are rewound, and drops those of a rewound or rewritten turn', () => {
    const map: MentionCorrectionMap = {
      t1: { textHash: HASH, corrections: [{ kind: 'mention', ...at('She'), entityId: 'kessa' }] },
      t2: { textHash: narrationHash('Later.'), corrections: [{ kind: 'mention', start: 0, end: 5, entityId: null }] },
      t3: { textHash: narrationHash('Gone.'), corrections: [{ kind: 'mention', start: 0, end: 4, entityId: null }] },
    };
    const undone = pruneByNarration(map, [turn('t1', TEXT), turn('t2', 'Later.')]);
    expect(undone).toEqual({ t1: map.t1, t2: map.t2 });
    expect(Object.keys(pruneByNarration(map, [turn('t1', TEXT), turn('t2', 'Rewritten.')]))).toEqual(['t1']);
    const whole = { t1: map.t1 };
    expect(pruneByNarration(whole, [turn('t1', TEXT)])).toBe(whole);
  });

  it('lets a later mention pick replace a non-mention of the same span, and the reverse', () => {
    const none = { kind: 'nonMention', ...at('She'), entityId: null } as const;
    const kessa = { kind: 'mention', ...at('She'), entityId: 'kessa' } as const;
    const first = addMentionCorrection({}, 't1', HASH, none);
    expect(addMentionCorrection(first, 't1', HASH, kessa).t1.corrections).toEqual([kessa]);
    expect(addMentionCorrection(addMentionCorrection({}, 't1', HASH, kessa), 't1', HASH, none).t1.corrections).toEqual([none]);
  });

  it('keeps a non-mention through a save, and drops one that names an entity', () => {
    const none = { kind: 'nonMention', start: 0, end: 4, entityId: null };
    const restored = restoreMentionCorrections(JSON.parse(JSON.stringify({
      t1: { textHash: HASH, corrections: [none, { ...none, entityId: 'mira' }] },
    })));
    expect(restored).toEqual({ t1: { textHash: HASH, corrections: [none] } });
  });

  it('restores only well-formed corrections from a save', () => {
    const good = { kind: 'mention', start: 0, end: 4, entityId: 'mira' };
    const restored = restoreMentionCorrections(JSON.parse(JSON.stringify({
      t1: { textHash: HASH, corrections: [good, { ...good, kind: 'name' }, { ...good, start: 5, end: 2 }, { ...good, entityId: 3 }, { ...good, extra: 1 }] },
      t2: { textHash: HASH, corrections: [{ ...good, start: 'a' }] },
      t3: { corrections: [good] },
      t4: 5,
    })));
    expect(restored).toEqual({ t1: { textHash: HASH, corrections: [good, good] } });
  });
});
