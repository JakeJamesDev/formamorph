import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { SegmentPill, pillAt } from './collapsing-segments';
import { createSwipeProgress } from '@/lib/swipeProgress';
import type { SegmentLayout } from '@/lib/collapsingSegments';

// Three segments of unequal width, so the width blend shows.
const LAYOUT: SegmentLayout = { lefts: [4, 104, 184], widths: [100, 80, 120], total: 308 };

afterEach(cleanup);

describe('pillAt', () => {
  it('sits on a segment at a whole position', () => {
    expect(pillAt(LAYOUT, 1)).toEqual({ left: 104, width: 80 });
  });

  it('blends between the two segments it sits over', () => {
    expect(pillAt(LAYOUT, 1.5)).toEqual({ left: 144, width: 100 });
  });

  it('stays on the end segments past either end', () => {
    expect(pillAt(LAYOUT, -0.4)).toEqual({ left: 4, width: 100 });
    expect(pillAt(LAYOUT, 2.3)).toEqual({ left: 184, width: 120 });
  });
});

describe('SegmentPill with a swipe to follow', () => {
  const pill = () => document.querySelector<HTMLElement>('[data-collapsing-pill]')!;

  it('tracks the strip without its slide, then rests on the active segment', () => {
    const swipe = createSwipeProgress();
    render(<SegmentPill layout={LAYOUT} active={1} animate follow={swipe} />);
    act(() => swipe.set(0.5));
    expect(pill().style.transform).toBe('translateX(54px)');
    expect(pill().style.width).toBe('90px');
    expect(pill().style.transition).toBe('none');
    act(() => swipe.set(null));
    expect(pill().style.transform).toBe('translateX(104px)');
    expect(pill().style.transition).toBe('');
  });

  it('stays under the strip when the tab changes mid-glide', () => {
    const swipe = createSwipeProgress();
    const { rerender } = render(<SegmentPill layout={LAYOUT} active={1} animate follow={swipe} />);
    expect(pill().style.transform).toBe('translateX(104px)');
    act(() => swipe.set(1.5));
    rerender(<SegmentPill layout={LAYOUT} active={2} animate follow={swipe} />);
    expect(pill().style.transform).toBe('translateX(144px)');
    act(() => swipe.set(null));
    expect(pill().style.transform).toBe('translateX(184px)');
  });

  it('stops following once unmounted', () => {
    const swipe = createSwipeProgress();
    const { unmount } = render(<SegmentPill layout={LAYOUT} active={1} animate follow={swipe} />);
    unmount();
    expect(() => swipe.set(1.5)).not.toThrow();
  });
});
