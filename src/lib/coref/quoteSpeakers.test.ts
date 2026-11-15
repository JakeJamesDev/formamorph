import { describe, expect, it } from 'vitest';
import { narrationHash, type MentionReadingMap } from './mentionReadings';
import { turnQuoteSpeakers } from './quoteSpeakers';
import { speakerColors } from './speakerPalette';

const COLORS = speakerColors([{ id: 'mira' }]);

const NARRATION = '"Hold the line," Mira says.';
const quotes = [{ start: 0, end: 16, speaker: 'mira' }];
const readings = (narration = NARRATION, speaker: string | null = 'mira'): MentionReadingMap => ({
  t1: { model: 'small', version: 1, textHash: narrationHash(narration), reading: { mentions: [], quotes: [{ ...quotes[0], speaker }] } },
});

describe('turnQuoteSpeakers', () => {
  it("gives the renderer the turn's quotes over its narration", () => {
    expect(turnQuoteSpeakers(true, readings(), COLORS, 't1', NARRATION)).toEqual({ text: NARRATION, quotes, colors: COLORS });
  });

  it('gives nothing with the feature off', () => {
    expect(turnQuoteSpeakers(false, readings(), COLORS, 't1', NARRATION)).toBeUndefined();
  });

  it('gives nothing when the reading read another narration', () => {
    expect(turnQuoteSpeakers(true, readings('"Hold it," Mira says.'), COLORS, 't1', NARRATION)).toBeUndefined();
  });

  it('gives the quotes when the reading names no speaker, so each can be corrected (Q70)', () => {
    expect(turnQuoteSpeakers(true, readings(NARRATION, null), COLORS, 't1', NARRATION)?.quotes).toEqual([{ ...quotes[0], speaker: null }]);
  });

  it('gives nothing when the reading holds no quote', () => {
    const empty: MentionReadingMap = {
      t1: { model: 'small', version: 1, textHash: narrationHash(NARRATION), reading: { mentions: [], quotes: [] } },
    };
    expect(turnQuoteSpeakers(true, empty, COLORS, 't1', NARRATION)).toBeUndefined();
  });

  it('builds a new object when the colors change, so a new cast member repaints', () => {
    const map = readings();
    expect(turnQuoteSpeakers(true, map, speakerColors([{ id: 'mira' }]), 't1', NARRATION))
      .not.toBe(turnQuoteSpeakers(true, map, COLORS, 't1', NARRATION));
  });

  it('returns the same object for the same reading, so the renderer keeps its plugins', () => {
    const map = readings();
    expect(turnQuoteSpeakers(true, map, COLORS, 't1', NARRATION)).toBe(turnQuoteSpeakers(true, map, COLORS, 't1', NARRATION));
  });
});
