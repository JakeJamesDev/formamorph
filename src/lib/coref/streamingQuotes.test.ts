// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStreamingQuoteReader, holdPoint, type ReadQuotes } from './streamingQuotes';
import { DEFAULT_QUOTE_RUN_MS } from '@/lib/narrationRevealConfig';
import { turnCardTriggers } from '@/components/game/MentionCards';
import { speakerColors } from './speakerPalette';
import { narrationHash } from './mentionReadings';

const TWO = '"You\'re late," he said. "The courier came by."\n\n"She promised," Wren said.';

/** A read that answers each passage's quotes after `ms`, naming every quote's speaker `s<start>`. */
function timedRead(ms: number) {
  const passages: string[] = [];
  const read: ReadQuotes = (passage) => {
    passages.push(passage);
    return new Promise((resolve) => setTimeout(() => {
      resolve([...passage.matchAll(/"[^"]*"/g)].map((m) => ({ start: m.index, end: m.index + m[0].length, speaker: `s${m.index}` })));
    }, ms));
  };
  return { read, passages };
}

describe('holdPoint', () => {
  it('ends after the tag sentence, at the next quote, or at the paragraph end, whichever comes first', () => {
    expect(holdPoint('"Hi," he said. More.', 5, false)).toBe(14);
    expect(holdPoint('"Hi," he said "Yes."', 5, false)).toBe(14);
    expect(holdPoint('"Hi," he said\n\nNext', 5, false)).toBe(13);
  });

  it('waits for the character after a sentence end, unless the stream finished', () => {
    expect(holdPoint('"Hi," he said.', 5, false)).toBeNull();
    expect(holdPoint('"Hi," he said.', 5, true)).toBe(14);
    expect(holdPoint('"Hi," he said', 5, true)).toBe(13);
  });
});

describe('createStreamingQuoteReader', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] }));
  afterEach(() => vi.useRealTimers());

  it('reads a quote on the passage up to its hold point, and only once that point has arrived', async () => {
    const reader = createStreamingQuoteReader();
    const { read, passages } = timedRead(100);
    reader.begin(read);
    reader.update('"You\'re late," he said', false);
    expect(passages).toEqual([]);
    reader.update('"You\'re late," he said. "The', false);
    expect(passages).toEqual(['"You\'re late," he said.']);
    await vi.advanceTimersByTimeAsync(100);
    expect(reader.live().quotes).toEqual([{ start: 0, end: 14, speaker: 's0' }]);
    expect(reader.gate.quotes(Date.now()).map((q) => q.eta === null)).toEqual([true, false]);
  });

  it('covers every quote whose hold point arrived during a run with the next single run', async () => {
    const reader = createStreamingQuoteReader();
    const { read, passages } = timedRead(100);
    reader.begin(read);
    reader.update(TWO.slice(0, 25), false);
    reader.update(TWO, false);
    reader.update(TWO, true);
    expect(passages).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(100);
    expect(passages).toEqual(['"You\'re late," he said.', TWO]);
    await vi.advanceTimersByTimeAsync(100);
    expect(reader.live().quotes.map((q) => q.speaker)).toEqual(['s0', 's24', 's48']);
  });

  it('lists a closed quote without a speaker at once, and tells subscribers when its run ends (Q74)', async () => {
    const reader = createStreamingQuoteReader();
    reader.begin(timedRead(100).read);
    const live = reader.live();
    const heard = vi.fn();
    live.subscribe!(heard);
    // An open quote has no final span yet; a closed one is keyed before its hold point arrives.
    reader.update('"You\'re late', false);
    expect(live.quotes).toEqual([]);
    reader.update('"You\'re late," he said', false);
    expect(live.quotes).toEqual([{ start: 0, end: 14, speaker: null }]);
    reader.update('"You\'re late," he said. "The', false);
    expect(heard).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);
    expect(heard).toHaveBeenCalledTimes(1);
    expect(live.quotes).toEqual([{ start: 0, end: 14, speaker: 's0' }]);
  });

  it('dates a running quote at the run end and a queued one a run later', async () => {
    const reader = createStreamingQuoteReader();
    reader.begin(timedRead(100).read);
    reader.update(TWO.slice(0, 25), false);
    reader.update(TWO, true);
    const now = Date.now();
    expect(reader.gate.quotes(now).map((q) => q.eta! - now)).toEqual([DEFAULT_QUOTE_RUN_MS, 2 * DEFAULT_QUOTE_RUN_MS, 2 * DEFAULT_QUOTE_RUN_MS]);
  });

  it('keeps the measured run time across turns', async () => {
    const reader = createStreamingQuoteReader();
    reader.begin(timedRead(80).read);
    reader.update(TWO, true);
    await vi.advanceTimersByTimeAsync(80);
    reader.begin(timedRead(80).read);
    expect(reader.gate.runMs()).toBe(80);
  });

  it('opens every gate when the model is gone, and on a failed run', async () => {
    const reader = createStreamingQuoteReader();
    reader.begin(() => Promise.resolve(null));
    reader.update(TWO, true);
    await vi.advanceTimersByTimeAsync(0);
    expect(reader.gate.quotes(Date.now()).every((q) => q.eta === null)).toBe(true);

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    reader.begin(() => Promise.reject(new Error('device lost')));
    reader.update(TWO, true);
    await vi.advanceTimersByTimeAsync(0);
    expect(reader.gate.quotes(Date.now()).every((q) => q.eta === null)).toBe(true);
    expect(reader.live().quotes.map((q) => q.speaker)).toEqual([null, null, null]);
    warn.mockRestore();
  });

  it('holds no quote without a read, and lets a canceled turn land nothing', async () => {
    const reader = createStreamingQuoteReader();
    reader.begin(null);
    reader.update(TWO, true);
    expect(reader.gate.quotes(Date.now()).every((q) => q.eta === null)).toBe(true);

    const { read } = timedRead(100);
    reader.begin(read);
    reader.update(TWO, true);
    const live = reader.live();
    reader.cancel();
    await vi.advanceTimersByTimeAsync(100);
    expect(live.quotes.map((q) => [q.start, q.speaker])).toEqual([[0, null], [24, null], [48, null]]);
    expect(reader.gate.quotes(Date.now()).every((q) => q.eta === null)).toBe(true);
  });
});

describe('turnCardTriggers with early quotes', () => {
  const NARRATION = '"Hold the line," Mira says.';
  const COLORS = speakerColors([{ id: 'mira' }]);
  const early = { text: NARRATION, quotes: [{ start: 0, end: 16, speaker: 'mira' }] };

  it('colors a live turn from its early quotes, without card triggers', () => {
    const triggers = turnCardTriggers(true, true, {}, COLORS, 't1', NARRATION, early);
    expect(Object.keys(triggers)).toEqual(['speakers']);
  });

  it('gives a live turn nothing with Character Mentions off or no early quotes, as before', () => {
    expect(turnCardTriggers(true, false, {}, COLORS, 't1', NARRATION, early)).toEqual({});
    expect(turnCardTriggers(true, true, {}, COLORS, 't1', NARRATION, null)).toEqual({});
  });

  it("gives a committed turn its reading's source when no early quotes match its narration", () => {
    const readings = { t1: { model: 'small' as const, version: 1, textHash: narrationHash(NARRATION), reading: { mentions: [], quotes: early.quotes } } };
    const plain = turnCardTriggers(false, true, readings, COLORS, 't1', NARRATION);
    expect(turnCardTriggers(false, true, readings, COLORS, 't1', NARRATION, { ...early, text: 'another turn' })).toEqual(plain);
  });
});
