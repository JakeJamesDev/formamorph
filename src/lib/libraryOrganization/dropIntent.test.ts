import { describe, it, expect } from 'vitest';
import { dropIntent, type TileRect } from './dropIntent';

/** A 200x200 tile at the origin, so its center is (100, 100) and its edge bands start 50px out. */
const rect: TileRect = { left: 0, top: 0, width: 200, height: 200 };

const medium = { canGroup: true, overSize: 'medium' } as const;
const small = { canGroup: true, overSize: 'small' } as const;

describe('dropIntent', () => {
  it('groups on the middle of a tile', () => {
    expect(dropIntent({ x: 100, y: 100 }, rect, medium)).toEqual({ kind: 'group' });
    expect(dropIntent({ x: 140, y: 60 }, rect, medium)).toEqual({ kind: 'group' });
  });

  it('reorders on the left and right edges of a normal tile', () => {
    expect(dropIntent({ x: 20, y: 100 }, rect, medium)).toEqual({ kind: 'reorder', position: 'before' });
    expect(dropIntent({ x: 180, y: 100 }, rect, medium)).toEqual({ kind: 'reorder', position: 'after' });
  });

  it('reorders on the top and bottom edges of a small tile, so smalls stack by hand', () => {
    expect(dropIntent({ x: 100, y: 20 }, rect, small)).toEqual({ kind: 'reorder', position: 'before' });
    expect(dropIntent({ x: 100, y: 180 }, rect, small)).toEqual({ kind: 'reorder', position: 'after' });
  });

  it('gives the whole tile to reordering when the drag cannot group', () => {
    // A folder never nests, so its middle would otherwise be a dead zone.
    const folder = { canGroup: false, overSize: 'medium' } as const;

    expect(dropIntent({ x: 100, y: 100 }, rect, folder)).toEqual({ kind: 'reorder', position: 'after' });
    expect(dropIntent({ x: 99, y: 100 }, rect, folder)).toEqual({ kind: 'reorder', position: 'before' });
  });

  it('reads a tile that is not at the origin from its own box', () => {
    const offset: TileRect = { left: 500, top: 300, width: 200, height: 200 };

    expect(dropIntent({ x: 600, y: 400 }, offset, medium)).toEqual({ kind: 'group' });
    expect(dropIntent({ x: 520, y: 400 }, offset, medium)).toEqual({ kind: 'reorder', position: 'before' });
  });

  it('reads a pointer past the tile as a boundary drop, never as a grouping', () => {
    // Past the grid's last tile the collision layer still hands that tile over, so without this rule
    // the very last slot would be unreachable: every drop there would fold a folder instead.
    expect(dropIntent({ x: 100, y: 220 }, rect, medium)).toEqual({ kind: 'reorder', position: 'after' });
    expect(dropIntent({ x: 100, y: -10 }, rect, medium)).toEqual({ kind: 'reorder', position: 'before' });
  });

  it('takes the far corners of a large tile as edges, not as its middle', () => {
    const large = { canGroup: true, overSize: 'large' } as const;

    expect(dropIntent({ x: 5, y: 5 }, rect, large)).toEqual({ kind: 'reorder', position: 'before' });
    expect(dropIntent({ x: 195, y: 195 }, rect, large)).toEqual({ kind: 'reorder', position: 'after' });
  });
});
