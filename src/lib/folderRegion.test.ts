import { describe, expect, it } from 'vitest';
import { folderRegion } from './folderRegion';
import type { PlacementMap } from '@/lib/libraryOrganization';

/** A board whose cells are round numbers, so a region's width reads off the column count. */
const CELL = { cellWidth: 100, rowHeight: 50, gap: 10 };
/** A wide library: eight base cells, which is four medium columns. */
const BASE_COLS = 8;

const region = (options: {
  places: PlacementMap;
  spans?: Record<string, number>;
  tileSpan: number;
  baseCols?: number;
}) => folderRegion({
  members: Object.keys(options.places),
  places: options.places,
  spanOf: (id) => options.spans?.[id] ?? 2,
  tileSpan: options.tileSpan,
  baseCols: options.baseCols ?? BASE_COLS,
  ...CELL,
});

/** The width of `cols` base cells, which is what every region width is measured against. */
const widthOf = (cols: number) => cols * CELL.cellWidth + (cols - 1) * CELL.gap;

describe('folderRegion', () => {
  it('fits the columns the folder actually uses', () => {
    // Two medium members side by side use four base columns, well under a large tile's cap of eight.
    const fit = region({
      places: { m1: { row: 0, col: 0 }, m2: { row: 0, col: 2 } },
      tileSpan: 4,
    });
    expect(fit.cols).toBe(4);
    expect(fit.width).toBeCloseTo(widthOf(4), 6);
    expect(fit.hidden).toEqual([]);
  });

  it.each([
    ['small', 1, 2],
    ['medium', 2, 4],
    ['large', 4, 8],
  ])('caps a %s folder tile at two medium columns per base cell', (_size, tileSpan, cap) => {
    // A full board of medium members, so the cap is the only thing that can decide the width.
    const places = Object.fromEntries(
      Array.from({ length: BASE_COLS / 2 }, (_, i) => [`m${i}`, { row: 0, col: i * 2 }]),
    );
    expect(region({ places, tileSpan }).cols).toBe(cap);
  });

  it('never cuts the corner member, however small the tile', () => {
    // A large member in the corner of a small folder tile, whose cap alone would be two columns.
    const corner = region({
      places: { big: { row: 0, col: 0 }, m2: { row: 0, col: 4 } },
      spans: { big: 4 },
      tileSpan: 1,
    });
    expect(corner.cols).toBe(4);
    expect(corner.hidden).toEqual(['m2']);
  });

  it('never runs wider than the board itself', () => {
    const narrow = region({
      places: { m1: { row: 0, col: 0 }, m2: { row: 0, col: 2 } },
      tileSpan: 4,
      baseCols: 2,
    });
    expect(narrow.cols).toBe(2);
    expect(narrow.width).toBeCloseTo(widthOf(2), 6);
  });

  it('leaves out a member the region edge would cut', () => {
    // m2 starts inside the two-column cap and runs past it, so half of it would show.
    const cut = region({
      places: { m1: { row: 0, col: 0 }, m2: { row: 0, col: 1 } },
      spans: { m1: 1, m2: 2 },
      tileSpan: 1,
    });
    expect(cut.cols).toBe(2);
    expect(cut.hidden).toEqual(['m2']);
  });

  it('leaves out a member below the region and keeps the rows that fit', () => {
    const tall = region({
      places: { m1: { row: 0, col: 0 }, m2: { row: 2, col: 0 }, m3: { row: 8, col: 0 } },
      tileSpan: 2,
    });
    // One medium column is all the members use, so the region is that column and the tile's own shape.
    expect(tall.cols).toBe(2);
    expect(tall.height).toBeCloseTo(2 * CELL.rowHeight + CELL.gap, 6);
    expect(tall.hidden).toEqual(['m2', 'm3']);
  });

  it('keeps the region as tall as the tile, in the tile-width proportion', () => {
    const wide = region({
      places: { m1: { row: 0, col: 0 }, m2: { row: 0, col: 2 }, m3: { row: 0, col: 4 } },
      tileSpan: 2,
    });
    // Six used columns against a medium tile's cap of four: the region is the tile's shape, grown by
    // the ratio of the two widths.
    expect(wide.cols).toBe(4);
    const tileWidth = 2 * CELL.cellWidth + CELL.gap;
    const tileHeight = 2 * CELL.rowHeight + CELL.gap;
    expect(wide.tileWidth).toBeCloseTo(tileWidth, 6);
    expect(wide.height).toBeCloseTo(tileHeight * (wide.width / tileWidth), 6);
  });

  it('leaves out a member with no home on the board', () => {
    const homeless = folderRegion({
      members: ['m1', 'ghost'],
      places: { m1: { row: 0, col: 0 } },
      spanOf: () => 2,
      tileSpan: 2,
      baseCols: BASE_COLS,
      ...CELL,
    });
    expect(homeless.hidden).toEqual(['ghost']);
  });

  it('gives an empty region for a board that has not been measured', () => {
    const unmeasured = folderRegion({
      members: ['m1'],
      places: { m1: { row: 0, col: 0 } },
      spanOf: () => 2,
      tileSpan: 2,
      baseCols: BASE_COLS,
      cellWidth: 0,
      rowHeight: 0,
      gap: CELL.gap,
    });
    expect(unmeasured.width).toBe(0);
    expect(unmeasured.height).toBe(0);
    expect(unmeasured.hidden).toEqual([]);
  });

  it('gives a region of one column for a folder whose members have no homes at all', () => {
    const empty = folderRegion({
      members: [],
      places: {},
      spanOf: () => 2,
      tileSpan: 2,
      baseCols: BASE_COLS,
      ...CELL,
    });
    expect(empty.cols).toBe(1);
    expect(empty.hidden).toEqual([]);
  });
});
