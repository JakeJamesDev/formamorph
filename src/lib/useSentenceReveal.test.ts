import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSentenceReveal } from './useSentenceReveal';
import { setRevealTiming, getRevealPaceScale, setRevealPaceScale } from './revealTimingStore';
import { PACE_FEEDBACK_UP, PACE_FEEDBACK_DOWN } from './narrationRevealConfig';

// Fixed timing so waits are assertable: rhythm span = words × 10ms, fade tail = 100ms.
const STAGGER = 10;
const DURATION = 100;

function setup() {
  const onText = vi.fn();
  const { result } = renderHook(() => useSentenceReveal(onText));
  return { onText, reveal: result.current };
}

describe('useSentenceReveal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setRevealTiming({ stagger: STAGGER, duration: DURATION });
    setRevealPaceScale(1);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('releases queued sentences one rhythm span apart', () => {
    const { onText, reveal } = setup();
    act(() => {
      reveal.push('One two three.'); // 3 words → 30ms rhythm span
      reveal.push('One two three. Four five.');
    });
    // First sentence releases immediately; the second waits its predecessor's span.
    expect(onText).toHaveBeenLastCalledWith('One two three.');
    act(() => vi.advanceTimersByTime(30));
    expect(onText).toHaveBeenLastCalledWith('One two three. Four five.');
  });

  it('adds the fade tail before a release that opens a new paragraph', () => {
    const { onText, reveal } = setup();
    act(() => {
      reveal.push('First paragraph.');
      reveal.push('First paragraph.\n\nSecond paragraph.');
    });
    expect(onText).toHaveBeenLastCalledWith('First paragraph.');
    // Rhythm span (2 words → 20ms) passes, but the paragraph handoff still holds the release…
    act(() => vi.advanceTimersByTime(20));
    expect(onText).toHaveBeenLastCalledWith('First paragraph.');
    // …until the previous sentence's fade tail (duration) has also played out.
    act(() => vi.advanceTimersByTime(DURATION));
    expect(onText).toHaveBeenLastCalledWith('First paragraph.\n\nSecond paragraph.');
  });

  it('does not add the tail wait within a paragraph or on the first release', () => {
    const { onText, reveal } = setup();
    act(() => {
      reveal.push('\n\nStarts with a break.'); // first release: no predecessor to wait for
    });
    expect(onText).toHaveBeenCalledWith('\n\nStarts with a break.');
    act(() => {
      reveal.push('\n\nStarts with a break. Same paragraph continues.');
    });
    act(() => vi.advanceTimersByTime(4 * STAGGER)); // rhythm span only
    expect(onText).toHaveBeenLastCalledWith('\n\nStarts with a break. Same paragraph continues.');
  });

  it('drains after finish, including a paragraph handoff', async () => {
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

  it('stretches the pace after running dry mid-stream (queue feedback up)', () => {
    const { reveal } = setup();
    act(() => {
      reveal.push('One two three.'); // releases immediately; 30ms rhythm span
    });
    expect(getRevealPaceScale()).toBe(1);
    // The rhythm timer fires with nothing queued and the stream unfinished → a real starve → stretch.
    act(() => vi.advanceTimersByTime(30));
    expect(getRevealPaceScale()).toBeCloseTo(PACE_FEEDBACK_UP);
    // A push-driven pump on an empty queue (tokens mid-sentence) must NOT stretch again.
    act(() => {
      reveal.push(''); // no complete sentence yet
    });
    expect(getRevealPaceScale()).toBeCloseTo(PACE_FEEDBACK_UP);
  });

  it('tightens back toward base when releases back up (queue feedback down)', () => {
    const { reveal } = setup();
    act(() => setRevealPaceScale(2));
    act(() => {
      reveal.push('One.'); // releases immediately (1 word) — nothing behind it yet
      reveal.push('One. Two.');
      reveal.push('One. Two. Three.');
      reveal.push('One. Two. Three. Four.'); // queue is now 3 deep behind the active release
    });
    // Next release (after the 1-word rhythm span at scale 2 → 20ms) sees ≥2 waiting → tighten.
    act(() => vi.advanceTimersByTime(20));
    expect(getRevealPaceScale()).toBeCloseTo(2 * PACE_FEEDBACK_DOWN);
  });

  it('never tightens below the base pace, and finish/reset restore scale 1', () => {
    const { reveal } = setup();
    act(() => setRevealPaceScale(1)); // already at base
    act(() => {
      reveal.push('One.');
      reveal.push('One. Two.');
      reveal.push('One. Two. Three.');
      reveal.push('One. Two. Three. Four.');
    });
    act(() => vi.advanceTimersByTime(10)); // deep queue at scale 1 → clamped at 1
    expect(getRevealPaceScale()).toBe(1);
    act(() => setRevealPaceScale(3));
    act(() => reveal.finish('One. Two. Three. Four.'));
    expect(getRevealPaceScale()).toBe(1); // finish hands back to the pinned whole-turn rate
    act(() => setRevealPaceScale(3));
    act(() => reveal.reset());
    expect(getRevealPaceScale()).toBe(1);
  });

  it('reset clears a pending paragraph handoff', () => {
    const { onText, reveal } = setup();
    act(() => {
      reveal.push('One.');
      reveal.push('One.\n\nTwo.');
      reveal.reset();
    });
    expect(onText).toHaveBeenLastCalledWith('');
    act(() => vi.advanceTimersByTime(1000));
    // Nothing replays after reset.
    expect(onText).toHaveBeenLastCalledWith('');
  });
});
