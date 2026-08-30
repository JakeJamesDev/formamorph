import { describe, it, expect } from 'vitest';
import { isGroupOverlap, type TileRect } from './dropIntent';

/** A 200x200 tile at the origin. */
const target: TileRect = { left: 0, top: 0, width: 200, height: 200 };

/** A same-size carried tile offset from the target by (dx, dy). */
const carried = (dx: number, dy: number, size = 200): TileRect =>
  ({ left: dx, top: dy, width: size, height: size });

describe('isGroupOverlap', () => {
  it('groups when the tiles are stacked or nearly stacked', () => {
    expect(isGroupOverlap(carried(0, 0), target)).toBe(true);
    expect(isGroupOverlap(carried(40, 40), target)).toBe(true);
  });

  it('groups at exactly half the smaller tile covered, and not just under it', () => {
    // Offset by half the width: overlap is half the area.
    expect(isGroupOverlap(carried(100, 0), target)).toBe(true);
    expect(isGroupOverlap(carried(102, 0), target)).toBe(false);
  });

  it('never groups on a corner clip or a miss', () => {
    expect(isGroupOverlap(carried(150, 150), target)).toBe(false);
    expect(isGroupOverlap(carried(210, 0), target)).toBe(false);
    expect(isGroupOverlap(carried(-210, 0), target)).toBe(false);
  });

  it('measures against the smaller tile, so a small tile groups onto a large one', () => {
    // A 100x100 carried tile sitting fully inside the 200x200 target covers all of itself.
    expect(isGroupOverlap(carried(50, 50, 100), target)).toBe(true);
    // The same small tile only a third of the way in does not.
    expect(isGroupOverlap(carried(170, 50, 100), target)).toBe(false);
  });

  it('measures against the smaller tile when the carried tile is the larger one', () => {
    const small: TileRect = { left: 50, top: 50, width: 100, height: 100 };

    // The large carried tile covering the small target completely groups.
    expect(isGroupOverlap(carried(0, 0), small)).toBe(true);
    // Covering half of it still groups; covering only a sliver does not.
    expect(isGroupOverlap(carried(100, 50), small)).toBe(true);
    expect(isGroupOverlap(carried(120, 50), small)).toBe(false);
  });
});
