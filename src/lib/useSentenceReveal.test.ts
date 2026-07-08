import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSentenceReveal } from './useSentenceReveal';
import { setRevealTiming } from './revealTimingStore';

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
