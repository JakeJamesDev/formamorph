// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSentenceReveal } from '@/lib/useSentenceReveal';
import { getRevealTiming } from '@/lib/revealTimingStore';
import { completeSentenceCount, completeSentencePrefix } from '@/lib/aiRequest/narrationStream';
import { REVEAL_TEST_PROFILES, type RevealArrivalEvent } from '@/lib/revealTestScripts';
import { createStreamingQuoteReader, type ReadQuotes } from './streamingQuotes';
import { quoteSpans, readPassageMentions, type MentionCast } from './mentionReading';
import { PROBE_PASSAGE } from './probePassage';

const CAST: MentionCast = [
  { id: 'wren', name: 'Wren', kind: 'unique' },
  { id: 'keeper', name: 'Keeper', aliases: ['the old keeper', 'old man'], kind: 'unique' },
];

const countWords = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);

/** The attribution rules on the passage so far, after a fake run time. */
const fakeRead = (runMs: number): ReadQuotes => (passage) => new Promise((resolve) => {
  setTimeout(() => resolve(readPassageMentions(passage, [], CAST).reading.quotes), runMs);
});

/** A steady stream at `tokensPerSecond`, in eight-char steps, as the reveal scripts step. */
const tokenStream = (tokensPerSecond: number) => (length: number): RevealArrivalEvent[] => {
  const cps = tokensPerSecond * 3.9;
  const events: RevealArrivalEvent[] = [];
  for (let c = 8; c < length + 8; c += 8) events.push({ atMs: Math.round((Math.min(c, length) / cps) * 1000), chars: Math.min(c, length) });
  return events;
};

interface Run {
  /** Each word's reveal start, ms from the stream's start. */
  wordAt: number[];
  /** The pace of each release, ms per word. */
  paces: number[];
  /** Quotes that showed before their color was back. */
  uncolored: number;
}

/** One turn through the real pacer, fed as the preview feeds it: the reader first, then the pacer. */
async function playTurn(
  reveal: ReturnType<typeof useSentenceReveal>, released: { text: string; at: number }[],
  reader: ReturnType<typeof createStreamingQuoteReader> | null, read: ReadQuotes | null,
  text: string, schedule: RevealArrivalEvent[],
): Promise<Run> {
  released.length = 0;
  act(() => {
    if (reader) {
      reader.begin(read);
      reveal.setGate(read ? reader.gate : null);
    }
    reveal.reset();
    reveal.push('', 0);
  });
  const t0 = Date.now();
  const paces: number[] = [];
  const wordAt: number[] = [];
  let uncolored = 0;
  let shownWords = 0;
  // Records each release as the pacer makes it.
  const onRelease = (shown: string) => {
    if (!shown) return;
    const pace = getRevealTiming().stagger;
    paces.push(pace);
    const now = Date.now() - t0;
    const words = countWords(shown);
    for (let i = shownWords; i < words; i++) wordAt.push(now + (i - shownWords) * pace);
    shownWords = words;
    if (reader && read) {
      const back = new Set(reader.live().quotes.map((q) => q.start));
      uncolored += quoteSpans(shown).filter((q) => !back.has(q.start)).length;
    }
  };
  let seen = 0;
  const drain = () => {
    while (seen < released.length) onRelease(released[seen++].text);
  };
  let at = 0;
  for (const event of schedule) {
    await act(async () => { await vi.advanceTimersByTimeAsync(event.atMs - at); });
    at = event.atMs;
    drain();
    const slice = text.slice(0, event.chars);
    act(() => {
      reader?.update(slice, false);
      reveal.push(completeSentencePrefix(slice), completeSentenceCount(slice));
    });
    drain();
  }
  let done = false;
  act(() => {
    reader?.update(text, true);
    reveal.finish(text);
    void reveal.drained().then(() => { done = true; });
  });
  for (let i = 0; i < 2000 && !done; i++) {
    await act(async () => { await vi.advanceTimersByTimeAsync(16); });
    drain();
  }
  drain();
  expect(done).toBe(true);
  return { wordAt, paces, uncolored };
}

function setup() {
  const released: { text: string; at: number }[] = [];
  const { result } = renderHook(() => useSentenceReveal((text) => released.push({ text, at: Date.now() })));
  return { reveal: () => result.current, released };
}

/** A warm-up turn, as the second turn of a session, then the measured one. */
async function measure(read: ReadQuotes | null, schedule: (length: number) => RevealArrivalEvent[], text = PROBE_PASSAGE) {
  const { reveal, released } = setup();
  const reader = createStreamingQuoteReader();
  await playTurn(reveal(), released, reader, read, text, schedule(text.length));
  return playTurn(reveal(), released, reader, read, text, schedule(text.length));
}

const maxGap = (times: number[]) => Math.max(...times.slice(1).map((t, i) => t - times[i]));
const report = (label: string, run: Run) =>
  `${label}: pace ${Math.round(Math.min(...run.paces))}–${Math.round(Math.max(...run.paces))} ms/word, `
  + `${(run.wordAt.at(-1)! / 1000).toFixed(1)} s, longest word gap ${Math.round(maxGap(run.wordAt))} ms`;

describe('streaming quote colors through the paced reveal (Q72)', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] }));
  afterEach(() => vi.useRealTimers());

  for (const profile of ['steady', 'burst'] as const) {
    for (const runMs of [60, 1250]) {
      it(`shows no quote before its color on the ${profile} script with a ${runMs} ms run`, async () => {
        const run = await measure(fakeRead(runMs), REVEAL_TEST_PROFILES[profile].schedule);
        expect(run.wordAt).toHaveLength(countWords(PROBE_PASSAGE));
        expect(run.uncolored).toBe(0);
      });
    }
  }

  // No lead-in to slow over: only the gate holds the first quote until its color is back.
  const OPENS_ON_A_QUOTE = `"You're late," the old keeper said. ${PROBE_PASSAGE}`;
  for (const profile of ['steady', 'burst'] as const) {
    it(`holds a turn that opens on a quote until its color is back (${profile})`, async () => {
      const run = await measure(fakeRead(1250), REVEAL_TEST_PROFILES[profile].schedule, OPENS_ON_A_QUOTE);
      expect(run.uncolored).toBe(0);
      expect(run.wordAt[0]).toBeGreaterThanOrEqual(1250);
    });
  }

  it('keeps every word under 150 ms with a 1.25 s run at 50 tokens/s', async () => {
    const smooth = await measure(fakeRead(1250), tokenStream(50));
    const today = await measure(null, tokenStream(50));
    console.info(`${report('smooth', smooth)}\n${report('today', today)}`);
    expect(smooth.uncolored).toBe(0);
    expect(maxGap(smooth.wordAt)).toBeLessThanOrEqual(150);
  });

  it('costs at most 5% of the reveal time with a 60 ms run', async () => {
    const smooth = await measure(fakeRead(60), tokenStream(50));
    const today = await measure(null, tokenStream(50));
    console.info(`${report('smooth', smooth)}\n${report('today', today)}`);
    expect(smooth.wordAt.at(-1)!).toBeLessThanOrEqual(today.wordAt.at(-1)! * 1.05);
  });

  it('shows a quote uncolored after the hold cap when its run never ends', async () => {
    const never: ReadQuotes = () => new Promise(() => {});
    const run = await measure(never, REVEAL_TEST_PROFILES.steady.schedule);
    expect(run.wordAt).toHaveLength(countWords(PROBE_PASSAGE));
    expect(run.uncolored).toBeGreaterThan(0);
  });
});
