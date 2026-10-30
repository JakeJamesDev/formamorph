import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { useRef } from 'react';
import type { SegmentFold } from '@/lib/collapsingSegments';
import { useHeaderFold } from './useHeaderFold';
import type { HeaderFold } from './headerFold';

// jsdom lays nothing out, so each marked part reports the width written on it.
let barWidth = 0;
let original: PropertyDescriptor | undefined;
beforeEach(() => {
  original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get(this: HTMLElement) { return Number(this.dataset.w ?? 0); },
  });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get() { return barWidth; } });
});
afterEach(() => {
  if (original) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', original);
  delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
});

const TABS: Record<SegmentFold, number> = { full: 422, active: 254, icons: 168 };
let seen: HeaderFold | null = null;

function Bar({ badges, centers }: { badges: boolean; centers: number[] }) {
  const ref = useRef<HTMLDivElement>(null);
  seen = useHeaderFold(ref, TABS, String(badges));
  return (
    <div ref={ref}>
      <div data-fold-left="" />
      <div data-fold-live="toggle" data-w="96" />
      {centers.map((w, i) => <div key={i} data-fold-measure="center" data-w={w} />)}
      <div data-fold-measure="center-menu" data-w="56" />
      <div data-fold-measure="right-menu" data-w="48" />
      {badges && <div data-fold-measure="badges-full" data-w="220" />}
      {badges && <div data-fold-measure="badges-count" data-w="64" />}
    </div>
  );
}

describe('useHeaderFold', () => {
  it('reads every measured copy and picks the first fold that fits', () => {
    // Level 0 needs 422 + 590 + (220 + 96 + 48 + 16) + 16 = 1408.
    barWidth = 1408;
    render(<Bar badges centers={[500, 590, 520]} />);
    expect(seen).toEqual({ tabs: 'full', center: 'full', badges: 'full' });
  });

  it('sizes the action buttons by the widest library tab, so a narrower one never decides the fold', () => {
    barWidth = 1400;
    render(<Bar badges centers={[500, 590, 520]} />);
    expect(seen).toEqual({ tabs: 'active', center: 'full', badges: 'full' });
  });

  it('leaves the badges out of the row while none shows', () => {
    // Without badges level 0 needs 422 + 590 + 152 + 16 = 1180.
    barWidth = 1180;
    render(<Bar badges={false} centers={[590]} />);
    expect(seen).toEqual({ tabs: 'full', center: 'full', badges: 'full' });
  });
});
