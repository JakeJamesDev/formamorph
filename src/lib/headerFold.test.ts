import { describe, expect, it } from 'vitest';
import { HEADER_FOLD_LEVELS, headerFold, headerRowWidth, type HeaderWidths } from './headerFold';

const widths = (bar: number, over: Partial<HeaderWidths> = {}): HeaderWidths => ({
  bar,
  gap: 8,
  tabs: { full: 422, active: 254, icons: 168 },
  center: { full: 590, menu: 56 },
  right: { toggle: 96, menu: 48 },
  badges: { full: 220, count: 64 },
  ...over,
});
// Right cell at full: 220 + 96 + 48 + 16 = 380. Row at level 0: 422 + 590 + 380 + 16 = 1408.

describe('headerFold', () => {
  it('keeps everything at full when the row fits', () => {
    expect(headerFold(widths(1408))).toEqual(HEADER_FOLD_LEVELS[0]);
  });

  it('folds the library tabs first, one step at a time', () => {
    expect(headerFold(widths(1407))).toEqual({ tabs: 'active', center: 'full', badges: 'full' });
    expect(headerFold(widths(1200))).toEqual({ tabs: 'icons', center: 'full', badges: 'full' });
  });

  it('folds the action buttons only once the tabs are icons, and takes the right menu with them', () => {
    // Level 2 needs 168 + 590 + 380 + 16 = 1154; level 3 needs 168 + 56 + 324 + 16 = 564.
    expect(headerFold(widths(1153))).toEqual({ tabs: 'icons', center: 'menu', badges: 'full' });
    expect(headerRowWidth(widths(0), HEADER_FOLD_LEVELS[3])).toBe(564);
  });

  it('folds the badges last, into a count', () => {
    expect(headerFold(widths(563))).toEqual({ tabs: 'icons', center: 'menu', badges: 'count' });
  });

  it('stays at the last fold when nothing fits', () => {
    expect(headerFold(widths(100))).toEqual(HEADER_FOLD_LEVELS[4]);
  });

  it('judges the row as a whole, so free room on one side lets the other side stay at full', () => {
    // No badges: 422 + 590 + 152 + 16 = 1180. Centered, each side would get only 287px, under the tabs' 422.
    expect(headerFold(widths(1180, { badges: null }))).toEqual(HEADER_FOLD_LEVELS[0]);
  });

  it('leaves out the tabs where they are hidden', () => {
    expect(headerRowWidth(widths(0, { tabs: null }), HEADER_FOLD_LEVELS[0])).toBe(590 + 380 + 8);
  });
});
