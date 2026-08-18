import { describe, it, expect } from 'vitest';
import {
  convertDescriptorUnits, describeInThresholdUnits, describeThreshold, descriptorSpans,
  isThresholdOutOfRange, startCaptionLeft, statStartValue, thresholdInputWidthRem, thresholdTagInsetRem,
  thresholdUnitOf, thresholdUnitTag, thresholdValue, uncoveredSpan, valueThreshold, type BandedStat,
} from './statDescriptorGeometry';

// The world the whole feature exists for: ten rockets banded 3/6/10 in the stat's own units.
const rockets: BandedStat = {
  min: 0, max: 10, type: 'number',
  descriptors: [
    { id: 'd1', threshold: 3, description: 'low' },
    { id: 'd2', threshold: 6, description: 'stocked' },
    { id: 'd3', threshold: 10, description: 'full' },
  ],
};

// The same banding authored proportionally: the bottom 30% is low, whatever the range becomes.
const proportional: BandedStat = {
  min: 0, max: 10, type: 'number', thresholdUnit: 'percent',
  descriptors: [
    { id: 'd1', threshold: 30, description: 'low' },
    { id: 'd2', threshold: 60, description: 'stocked' },
    { id: 'd3', threshold: 100, description: 'full' },
  ],
};

describe('thresholdUnitOf', () => {
  it('reads a stat with no unit field as raw', () => {
    expect(thresholdUnitOf(rockets)).toBe('raw');
  });

  it('reads the opt-in field', () => {
    expect(thresholdUnitOf(proportional)).toBe('percent');
    expect(thresholdUnitOf({ ...rockets, thresholdUnit: 'raw' })).toBe('raw');
  });

  it('pins a Percentage stat to percent, whatever the field says', () => {
    // Its range is forced to 0–100, so the two readings are the same number and the choice is meaningless.
    expect(thresholdUnitOf({ min: 0, max: 100, type: 'percentage' })).toBe('percent');
    expect(thresholdUnitOf({ min: 0, max: 100, type: 'percentage', thresholdUnit: 'raw' })).toBe('percent');
  });
});

describe('thresholdValue', () => {
  it('is the number itself in raw mode', () => {
    expect(thresholdValue(rockets, 3)).toBe(3);
  });

  it('is a share of min→max in percent mode', () => {
    expect(thresholdValue(proportional, 30)).toBe(3);
    expect(thresholdValue(proportional, 100)).toBe(10);
  });

  it('measures the share from min, not from zero', () => {
    const shifted: BandedStat = { min: 20, max: 40, thresholdUnit: 'percent' };
    expect(thresholdValue(shifted, 50)).toBe(30);
    expect(thresholdValue(shifted, 0)).toBe(20);
  });

  it('collapses a degenerate range onto its single value', () => {
    expect(thresholdValue({ min: 5, max: 5, thresholdUnit: 'percent' }, 40)).toBe(5);
  });
});

describe('valueThreshold', () => {
  it('round-trips raw→percent→raw within rounding', () => {
    for (const raw of [0, 1, 3, 6.5, 10]) {
      const pct = valueThreshold(proportional, raw);
      expect(thresholdValue(proportional, pct)).toBeCloseTo(raw, 6);
    }
  });

  it('reads every value of a degenerate range as 0%', () => {
    expect(valueThreshold({ min: 5, max: 5, thresholdUnit: 'percent' }, 5)).toBe(0);
  });

  it('is the value itself in raw mode', () => {
    expect(valueThreshold(rockets, 4)).toBe(4);
  });
});

describe('descriptorSpans', () => {
  it('runs each band from the one below it, starting at min', () => {
    expect(descriptorSpans(rockets)).toEqual([
      { id: 'd1', description: 'low', threshold: 3, from: 0, to: 3 },
      { id: 'd2', description: 'stocked', threshold: 6, from: 3, to: 6 },
      { id: 'd3', description: 'full', threshold: 10, from: 6, to: 10 },
    ]);
  });

  it('draws a percent stat at the same raw extents as its raw twin', () => {
    expect(descriptorSpans(proportional).map((s) => [s.from, s.to]))
      .toEqual(descriptorSpans(rockets).map((s) => [s.from, s.to]));
  });

  it('starts the first band at a non-zero min', () => {
    expect(descriptorSpans({ min: 20, max: 40, descriptors: [{ id: 'd', threshold: 30, description: 'thin' }] })[0])
      .toMatchObject({ from: 20, to: 30 });
  });

  it('orders by threshold, not by how they were authored', () => {
    const jumbled = { ...rockets, descriptors: [...rockets.descriptors!].reverse() };
    expect(descriptorSpans(jumbled).map((s) => s.description)).toEqual(['low', 'stocked', 'full']);
  });

  it('has nothing to draw for a stat with no descriptors', () => {
    expect(descriptorSpans({ min: 0, max: 10 })).toEqual([]);
  });
});

describe('uncoveredSpan', () => {
  it('is null when the top band reaches max', () => {
    expect(uncoveredSpan(rockets)).toBeNull();
    expect(uncoveredSpan(proportional)).toBeNull();
  });

  it('names the range above the top band', () => {
    expect(uncoveredSpan({ ...rockets, descriptors: rockets.descriptors!.slice(0, 2) })).toEqual({ from: 6, to: 10 });
  });

  it('reads a percent stat’s shortfall in raw values', () => {
    expect(uncoveredSpan({ ...proportional, descriptors: [{ id: 'd', threshold: 60, description: 'stocked' }] }))
      .toEqual({ from: 6, to: 10 });
  });

  it('is null for a stat with no bands at all — nothing is missing, there is just nothing to say', () => {
    expect(uncoveredSpan({ min: 0, max: 10 })).toBeNull();
  });
});

describe('statStartValue', () => {
  it('prefers the authored start, then a live value, then the floor', () => {
    expect(statStartValue({ min: 2, max: 10, starting: 7, value: 4 })).toBe(7);
    expect(statStartValue({ min: 2, max: 10, value: 4 })).toBe(4);
    expect(statStartValue({ min: 2, max: 10 })).toBe(2);
  });
});

describe('unit labels', () => {
  it('tags a raw threshold with the stat’s own ceiling and a percent one with %', () => {
    expect(thresholdUnitTag(rockets)).toBe('of 10');
    expect(thresholdUnitTag(proportional)).toBe('%');
  });

  it('states a value in whichever unit the thresholds use', () => {
    expect(describeInThresholdUnits(rockets, 3)).toBe('3 of 10');
    expect(describeInThresholdUnits(proportional, 3)).toBe('30%');
  });

  it('states a stored threshold the same way', () => {
    expect(describeThreshold(rockets, 6)).toBe('6 of 10');
    expect(describeThreshold(proportional, 60)).toBe('60%');
  });

  it('compacts a five-digit ceiling and leaves four digits exact', () => {
    expect(thresholdUnitTag({ min: 0, max: 100999 })).toBe('of 101k');
    expect(thresholdUnitTag({ min: 0, max: 10000 })).toBe('of 10k');
    expect(thresholdUnitTag({ min: 0, max: 9999 })).toBe('of 9999');
  });

  it('never compacts a percent tag', () => {
    expect(thresholdUnitTag({ min: 0, max: 100999, thresholdUnit: 'percent' })).toBe('%');
  });
});

describe('threshold input sizing', () => {
  it('keeps the classic 7rem box for short tags', () => {
    expect(thresholdInputWidthRem('%')).toBe(7);
  });

  it('widens with the tag so the value keeps its room', () => {
    const small = thresholdInputWidthRem(thresholdUnitTag(rockets));
    const large = thresholdInputWidthRem(thresholdUnitTag({ min: 0, max: 100999 }));
    expect(large).toBeGreaterThan(small);
    expect(large - thresholdTagInsetRem(thresholdUnitTag({ min: 0, max: 100999 }))).toBeGreaterThanOrEqual(4.5);
  });
});

describe('startCaptionLeft', () => {
  it('centers the caption under the marker when there is room', () => {
    expect(startCaptionLeft(200, 60, 400)).toBe(170);
  });

  it('pins to the left edge instead of spilling out', () => {
    expect(startCaptionLeft(10, 60, 400)).toBe(0);
  });

  it('pins to the right edge instead of spilling out', () => {
    expect(startCaptionLeft(395, 60, 400)).toBe(340);
  });

  it('holds the left edge when the caption outgrows the container', () => {
    expect(startCaptionLeft(50, 500, 400)).toBe(0);
  });
});

describe('isThresholdOutOfRange', () => {
  it('accepts thresholds inside the range under either unit', () => {
    expect(isThresholdOutOfRange(rockets, 10)).toBe(false);
    expect(isThresholdOutOfRange(rockets, 0)).toBe(false);
    expect(isThresholdOutOfRange(proportional, 100)).toBe(false);
  });

  it('flags a raw threshold past the ceiling — the percent number left behind by the old reading', () => {
    expect(isThresholdOutOfRange(rockets, 60)).toBe(true);
  });

  it('flags a threshold under the floor, which no value can ever reach', () => {
    expect(isThresholdOutOfRange({ min: 20, max: 40 }, 5)).toBe(true);
  });

  it('flags a percent threshold over 100', () => {
    expect(isThresholdOutOfRange(proportional, 150)).toBe(true);
  });
});

describe('convertDescriptorUnits', () => {
  it('rewrites raw thresholds as percentages that cover the same values', () => {
    const converted = convertDescriptorUnits(rockets, 'percent');
    expect(converted.map((d) => d.threshold)).toEqual([30, 60, 100]);
    expect(descriptorSpans({ ...rockets, thresholdUnit: 'percent', descriptors: converted }).map((s) => [s.from, s.to]))
      .toEqual(descriptorSpans(rockets).map((s) => [s.from, s.to]));
  });

  it('rewrites percentages as raw values that cover the same values', () => {
    const converted = convertDescriptorUnits(proportional, 'raw');
    expect(converted.map((d) => d.threshold)).toEqual([3, 6, 10]);
  });

  it('keeps every other field on the descriptor', () => {
    expect(convertDescriptorUnits(rockets, 'percent')[0]).toMatchObject({ id: 'd1', description: 'low' });
  });

  it('is a no-op when the stat is already in that unit', () => {
    expect(convertDescriptorUnits(rockets, 'raw').map((d) => d.threshold)).toEqual([3, 6, 10]);
  });

  it('round-trips through both units within rounding', () => {
    const there = convertDescriptorUnits(rockets, 'percent');
    const back = convertDescriptorUnits({ ...rockets, thresholdUnit: 'percent', descriptors: there }, 'raw');
    expect(back.map((d) => d.threshold)).toEqual([3, 6, 10]);
  });

  it('measures the share from min, so a shifted range converts to the same coverage', () => {
    const shifted: BandedStat = {
      min: 20, max: 40,
      descriptors: [{ id: 'd1', threshold: 30, description: 'half' }, { id: 'd2', threshold: 40, description: 'brimming' }],
    };
    const converted = convertDescriptorUnits(shifted, 'percent');
    expect(converted.map((d) => d.threshold)).toEqual([50, 100]);
    expect(descriptorSpans({ ...shifted, thresholdUnit: 'percent', descriptors: converted }).map((s) => [s.from, s.to]))
      .toEqual([[20, 30], [30, 40]]);
  });

  it('sends a degenerate range to 0% rather than dividing by nothing', () => {
    const flat: BandedStat = { min: 5, max: 5, descriptors: [{ id: 'd', threshold: 5, description: 'fixed' }] };
    expect(convertDescriptorUnits(flat, 'percent')[0].threshold).toBe(0);
  });
});
