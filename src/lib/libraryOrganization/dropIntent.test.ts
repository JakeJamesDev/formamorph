import { describe, it, expect } from 'vitest';
import { isGroupDrop, type TileRect } from './dropIntent';

/** A 200x200 tile at the origin, so its center is (100, 100) and its middle band spans 60..140. */
const rect: TileRect = { left: 0, top: 0, width: 200, height: 200 };

describe('isGroupDrop', () => {
  it('groups on the middle of a tile', () => {
    expect(isGroupDrop({ x: 100, y: 100 }, rect, true)).toBe(true);
    expect(isGroupDrop({ x: 140, y: 60 }, rect, true)).toBe(true);
  });

  it('leaves the edges of the tile to reordering', () => {
    expect(isGroupDrop({ x: 20, y: 100 }, rect, true)).toBe(false);
    expect(isGroupDrop({ x: 180, y: 100 }, rect, true)).toBe(false);
    expect(isGroupDrop({ x: 100, y: 20 }, rect, true)).toBe(false);
    expect(isGroupDrop({ x: 100, y: 180 }, rect, true)).toBe(false);
  });

  it('never groups from outside the tile, so boundary drops stay reorders', () => {
    expect(isGroupDrop({ x: 100, y: 220 }, rect, true)).toBe(false);
    expect(isGroupDrop({ x: -10, y: 100 }, rect, true)).toBe(false);
  });

  it('never groups a drag that cannot group, such as a folder tile', () => {
    expect(isGroupDrop({ x: 100, y: 100 }, rect, false)).toBe(false);
  });

  it('reads a tile that is not at the origin from its own box', () => {
    const offset: TileRect = { left: 500, top: 300, width: 200, height: 200 };

    expect(isGroupDrop({ x: 600, y: 400 }, offset, true)).toBe(true);
    expect(isGroupDrop({ x: 520, y: 400 }, offset, true)).toBe(false);
  });
});
