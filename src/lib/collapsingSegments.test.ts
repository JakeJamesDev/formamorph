import { describe, expect, it } from 'vitest';
import { segmentFold, segmentLayout } from './collapsingSegments';

// Labeled widths, with Dictionaries the widest; icons 40px; 4px insets.
const full = [95, 96, 126, 97];
const icon = [40, 40, 40, 40];
// Every label: 422. Widest label alone: 4 + 160 + 86 + 4 = 254. Icons only: 168.

describe('segmentFold', () => {
  it('shows every label when they all fit', () => {
    expect(segmentFold(full, icon, 422, 4)).toBe('full');
  });

  it('keeps only the selected label when every label does not fit but the widest one alone does', () => {
    expect(segmentFold(full, icon, 421, 4)).toBe('active');
    expect(segmentFold(full, icon, 254, 4)).toBe('active');
  });

  it('shows icons alone below the widest label, even where a short label would still fit', () => {
    // 4 + 120 + 95 + 4 = 223 would fit Worlds; the step is sized for Dictionaries.
    expect(segmentFold(full, icon, 240, 4)).toBe('icons');
  });
});

describe('segmentLayout', () => {
  it('gives every segment its labeled width at full', () => {
    expect(segmentLayout(full, icon, 2, 'full', 4)).toEqual({ lefts: [4, 99, 195, 321], widths: full, total: 422 });
  });

  it('keeps only the selected label, and shifts the later segments left', () => {
    expect(segmentLayout(full, icon, 2, 'active', 4)).toEqual({ lefts: [4, 44, 84, 210], widths: [40, 40, 126, 40], total: 254 });
  });

  it('gives every segment, the selected one too, its icon width when icons only', () => {
    expect(segmentLayout(full, icon, 2, 'icons', 4)).toEqual({ lefts: [4, 44, 84, 124], widths: [40, 40, 40, 40], total: 168 });
  });

  it('falls back to the labeled width for a segment with no icon measurement', () => {
    expect(segmentLayout([50, 60], [20], 0, 'icons', 0).widths).toEqual([20, 60]);
  });
});
