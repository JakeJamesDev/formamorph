import { describe, it, expect } from 'vitest';
import { packTiles, packedRowCount, type PackedTile } from './packer';
import type { LibraryTileSize } from './types';

/** Build the sizes map from a compact list, so a case reads as the order it packs. */
const sized = (list: [string, LibraryTileSize][]): {
  order: string[];
  sizes: Record<string, LibraryTileSize>;
} => ({
  order: list.map(([id]) => id),
  sizes: Object.fromEntries(list),
});

/** Where a tile landed, as `[row, col, span]`. */
const at = (packed: PackedTile[], id: string): [number, number, number] => {
  const tile = packed.find((t) => t.id === id);
  if (!tile) throw new Error(`${id} was not packed`);
  return [tile.row, tile.col, tile.span];
};

/** True when two packed tiles claim any base cell in common. */
const overlaps = (a: PackedTile, b: PackedTile): boolean =>
  a.row < b.row + b.span && b.row < a.row + a.span
  && a.col < b.col + b.span && b.col < a.col + a.span;

const expectNoOverlap = (packed: PackedTile[], columns: number) => {
  for (const tile of packed) expect(tile.col + tile.span).toBeLessThanOrEqual(columns);
  for (let i = 0; i < packed.length; i++) {
    for (let j = i + 1; j < packed.length; j++) {
      expect(overlaps(packed[i], packed[j])).toBe(false);
    }
  }
};

describe('packTiles', () => {
  it('gives each size its own span: half, one, and double a medium tile', () => {
    const { order, sizes } = sized([['s', 'small'], ['m', 'medium'], ['l', 'large']]);

    const packed = packTiles(order, sizes, 8);

    expect(at(packed, 's')[2]).toBe(1);
    expect(at(packed, 'm')[2]).toBe(2);
    expect(at(packed, 'l')[2]).toBe(4);
  });

  it('treats a tile with no recorded size as medium', () => {
    expect(packTiles(['a'], {}, 4)).toEqual([{ id: 'a', row: 0, col: 0, span: 2 }]);
  });

  it('stacks a run of four small tiles into one medium slot', () => {
    // The Windows rule: the second small sits below the first, then the run steps one column right.
    // Four of them therefore occupy exactly the 2x2 block a medium tile would have taken.
    const { order, sizes } = sized([
      ['s1', 'small'], ['s2', 'small'], ['s3', 'small'], ['s4', 'small'],
    ]);

    const packed = packTiles(order, sizes, 4);

    expect(at(packed, 's1')).toEqual([0, 0, 1]);
    expect(at(packed, 's2')).toEqual([1, 0, 1]);
    expect(at(packed, 's3')).toEqual([0, 1, 1]);
    expect(at(packed, 's4')).toEqual([1, 1, 1]);
  });

  it('never stacks a small run more than two deep', () => {
    const { order, sizes } = sized(Array.from({ length: 6 }, (_, i): [string, LibraryTileSize] => [`s${i}`, 'small']));

    const packed = packTiles(order, sizes, 4);

    expect(packed.map((t) => t.row)).toEqual([0, 1, 0, 1, 0, 1]);
    expect(packed.map((t) => t.col)).toEqual([0, 0, 1, 1, 2, 2]);
  });

  it('starts a fresh run after a bigger tile interrupts the small ones', () => {
    const { order, sizes } = sized([
      ['s1', 'small'], ['m', 'medium'], ['s2', 'small'], ['s3', 'small'],
    ]);

    const packed = packTiles(order, sizes, 6);

    expect(at(packed, 's1')).toEqual([0, 0, 1]);
    expect(at(packed, 'm')).toEqual([0, 1, 2]);
    // s2 opens a new run past the medium rather than stacking under s1, and s3 stacks under s2.
    expect(at(packed, 's2')).toEqual([0, 3, 1]);
    expect(at(packed, 's3')).toEqual([1, 3, 1]);
  });

  it('backfills the hole beside a large tile instead of leaving a gap', () => {
    const { order, sizes } = sized([['l', 'large'], ['m', 'medium'], ['s', 'small']]);

    const packed = packTiles(order, sizes, 6);

    expect(at(packed, 'l')).toEqual([0, 0, 4]);
    expect(at(packed, 'm')).toEqual([0, 4, 2]);
    // Rows 0-1 of the right-hand strip are taken by the medium, so the small drops into row 2 of the
    // same strip — beside the large tile, not below everything.
    expect(at(packed, 's')).toEqual([2, 4, 1]);
  });

  it('clamps a tile too wide for the grid instead of dropping it off the edge', () => {
    const { order, sizes } = sized([['l', 'large'], ['m', 'medium']]);

    const packed = packTiles(order, sizes, 2);

    expect(at(packed, 'l')).toEqual([0, 0, 2]);
    expect(at(packed, 'm')).toEqual([2, 0, 2]);
    expectNoOverlap(packed, 2);
  });

  it('keeps every tile inside the grid and off its neighbours at any column count', () => {
    const { order, sizes } = sized([
      ['l1', 'large'], ['s1', 'small'], ['m1', 'medium'], ['s2', 'small'], ['s3', 'small'],
      ['m2', 'medium'], ['l2', 'large'], ['s4', 'small'], ['s5', 'small'], ['m3', 'medium'],
    ]);

    for (const columns of [2, 3, 4, 6, 8, 12]) {
      const packed = packTiles(order, sizes, columns);
      expect(packed.map((t) => t.id)).toEqual(order);
      expectNoOverlap(packed, columns);
    }
  });

  it('reports the row count the grid needs to hold every tile', () => {
    const { order, sizes } = sized([['l', 'large'], ['s', 'small']]);

    expect(packedRowCount(packTiles(order, sizes, 4))).toBe(5);
    expect(packedRowCount([])).toBe(0);
  });

  it('packs nothing from an empty order', () => {
    expect(packTiles([], {}, 4)).toEqual([]);
  });
});
