import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSentenceReveal } from './useSentenceReveal';
import { getRevealTiming } from './revealTimingStore';
import { DEFAULT_STAGGER, TARGET_BUFFER_WORDS, STAGGER_MIN, STAGGER_MAX } from './narrationRevealConfig';

function setup() {
  const onText = vi.fn();
  const { result } = renderHook(() => useSentenceReveal(onText));
  return { onText, reveal: result.current };
}

// Build a cumulative prefix of `n` single-char words ("w w w …") for easy word counting.
const words = (n: number) => Array.from({ length: n }, () => 'w').join(' ');

describe('useSentenceReveal', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('releases queued sentences one rhythm span apart', () => {
    const { onText, reveal } = setup();
    act(() => {
      reveal.push('One two three.'); // 3 words
      reveal.push('One two three. Four five.');
    });
    expect(onText).toHaveBeenLastCalledWith('One two three.');
    // First sentence's rhythm span is 3 words × the current stagger; advance a generous amount.
    act(() => vi.advanceTimersByTime(3 * STAGGER_MAX));
    expect(onText).toHaveBeenLastCalledWith('One two three. Four five.');
  });

  it('flows a new paragraph in at the normal rhythm span (no extra handoff pause)', () => {
    const { onText, reveal } = setup();
    act(() => {
      reveal.push('First paragraph.');
      reveal.push('First paragraph.\n\nSecond paragraph.');
    });
    expect(onText).toHaveBeenLastCalledWith('First paragraph.');
    // The paragraph release happens after just the first sentence's rhythm span — no added dead beat.
    act(() => vi.advanceTimersByTime(2 * STAGGER_MAX));
    expect(onText).toHaveBeenLastCalledWith('First paragraph.\n\nSecond paragraph.');
  });

  it('paces from the MEASURED arrival gap, not a fixed default', () => {
    // A real 500ms gap adding 5 words ⇒ ~100 ms/word measured, well above the 40ms default. The release
    // that follows the second arrival sets its cadence from that measured rate, so stagger climbs.
    const { reveal } = setup();
    act(() => { reveal.push(words(5) + '.'); }); // first arrival releases immediately; no gap yet
    act(() => vi.advanceTimersByTime(500)); // its rhythm span elapses; wall clock advances 500ms
    act(() => { reveal.push(words(5) + '. ' + words(5) + '.'); }); // +5 words over 500ms → 100 ms/word
    expect(getRevealTiming().stagger).toBeGreaterThan(DEFAULT_STAGGER);
  });

  it('a near-instant burst does NOT poison the rate (its zero gaps are ignored)', () => {
    const { reveal } = setup();
    // Several sentences arrive in the same tick (a burst): gaps are 0 < ARRIVAL_MIN_GAP_MS → ignored.
    act(() => {
      reveal.push(words(4) + '.');
      reveal.push(words(4) + '. ' + words(4) + '.');
      reveal.push(words(4) + '. ' + words(4) + '. ' + words(4) + '.');
    });
    // Rate untouched by the burst → stagger stays clamped to a readable value, never the 8ms floor.
    act(() => vi.advanceTimersByTime(10 * STAGGER_MAX));
    expect(getRevealTiming().stagger).toBeGreaterThan(STAGGER_MIN);
  });

  it('reveals faster when a big backlog has piled up (drains toward the target buffer)', () => {
    const { reveal } = setup();
    // First sentence releases immediately; a deep second one waits behind it (backlog ≫ target buffer).
    act(() => {
      reveal.push(words(3) + '.');
      reveal.push(words(3) + '. ' + words(TARGET_BUFFER_WORDS * 4) + '.');
    });
    // Let the first sentence's rhythm span elapse so the deep one releases — its cadence is computed
    // from the large backlog → correction < 1 → a faster (smaller) stagger than the default.
    act(() => vi.advanceTimersByTime(3 * STAGGER_MAX));
    expect(getRevealTiming().stagger).toBeLessThan(DEFAULT_STAGGER);
  });

  it('drains after finish, including across a paragraph break', async () => {
    const { reveal } = setup();
    let drained = false;
    act(() => {
      reveal.push('One.');
      reveal.finish('One.\n\nTwo.');
    });
    const wait = reveal.drained().then(() => { drained = true; });
    await act(async () => {
      await vi.runAllTimersAsync();
      await wait;
    });
    expect(drained).toBe(true);
  });

  it('reset clears the queue, any pending timer, and re-seeds the timing store to default', () => {
    const { onText, reveal } = setup();
    act(() => {
      reveal.push('One.');
      reveal.push('One.\n\nTwo.');
      reveal.reset();
    });
    expect(onText).toHaveBeenLastCalledWith('');
    expect(getRevealTiming().stagger).toBe(DEFAULT_STAGGER); // store re-seeded (the measured rate carries, but nothing is shown)
    act(() => vi.advanceTimersByTime(10 * STAGGER_MAX));
    expect(onText).toHaveBeenLastCalledWith(''); // nothing replays after reset
  });

  it('carries the measured rate across a reset (seeds the next turn from the last one)', () => {
    const { reveal } = setup();
    // Turn 1: a real 1000ms gap adding 5 words ⇒ ~200 ms/word measured (blended into ~96 by the EMA).
    act(() => { reveal.push(words(5) + '.'); });
    act(() => vi.advanceTimersByTime(1000));
    act(() => { reveal.push(words(5) + '. ' + words(5) + '.'); }); // the measuring arrival
    act(() => { reveal.finish(words(5) + '. ' + words(5) + '.'); });
    act(() => vi.runAllTimers());
    // Turn 2: a fresh reset then one sentence. Its cadence reflects the carried slow rate — far above
    // what a default seed (40ms × the ≤2 backlog correction = 80ms) could ever produce.
    act(() => { reveal.reset(); });
    act(() => { reveal.push(words(15) + '.'); });
    expect(getRevealTiming().stagger).toBeGreaterThan(DEFAULT_STAGGER * 2);
  });
});
