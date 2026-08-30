import { describe, it, expect } from 'vitest';
import {
  collapseBoard,
  prunePlacements,
  resolvePlacements,
  rowMajor,
  spanAt,
  withPlacements,
} from './placements';
import { setTileSize } from './operations';
import { emptyTabOrganization, type LibraryTabOrganization, type LibraryTileSize } from './types';

/** An organization built from the parts a case actually cares about. */
const org = (parts: Partial<LibraryTabOrganization>): LibraryTabOrganization => ({
  ...emptyTabOrganization(),
  ...parts,
});

/** A placement map from `[id, row, col]` rows, so a board reads as its shape. */
const homes = (rows: [string, number, number][]) =>
  Object.fromEntries(rows.map(([id, row, col]) => [id, { row, col }]));

const sizes = (list: [string, LibraryTileSize][]): Record<string, LibraryTileSize> =>
  Object.fromEntries(list);

describe('rowMajor', () => {
  it('reads the board the way the eye does: down the rows, then along each one', () => {
    const places = homes([['c', 1, 0], ['a', 0, 2], ['b', 0, 0]]);

    expect(rowMajor(places, ['a', 'b', 'c'])).toEqual(['b', 'a', 'c']);
  });

  it('puts an id with no home yet after the ones that have one', () => {
    const places = homes([['a', 0, 2]]);

    expect(rowMajor(places, ['new', 'a'])).toEqual(['a', 'new']);
  });
});

describe('spanAt', () => {
  it('gives each size half, one, and double a medium tile', () => {
    expect([spanAt('small', 8), spanAt('medium', 8), spanAt('large', 8)]).toEqual([1, 2, 4]);
  });

  it('clamps a tile wider than the grid rather than dropping it off a narrow phone', () => {
    expect(spanAt('large', 2)).toBe(2);
  });
});

describe('resolvePlacements', () => {
  it('lays out a width no one has arranged yet the way the packer would', () => {
    const state = org({ order: ['a', 'b', 'c'], sizes: sizes([['b', 'large']]) });

    const places = resolvePlacements(state, ['a', 'b', 'c'], 8);

    // Medium, large, medium: the large one cannot share the first row band, so it takes the next block.
    expect(places).toEqual(homes([['a', 0, 0], ['b', 0, 2], ['c', 0, 6]]));
  });

  it('seeds a new width from the arrangement of the nearest one, not from the stored order', () => {
    // The board was arranged at width 8 with `b` to the left of `a`, which the flat order does not say.
    const state = org({
      order: ['a', 'b'],
      placements: { 8: homes([['a', 0, 2], ['b', 0, 0]]) },
    });

    const places = resolvePlacements(state, ['a', 'b'], 4);

    expect(rowMajor(places, ['a', 'b'])).toEqual(['b', 'a']);
  });

  it('keeps every stored home exactly where it is, partial holes and all', () => {
    // The row-0 gap at columns 2-3 is part of the arrangement; `c` below keeps those columns alive,
    // so nothing here is allowed to close it.
    const stored = homes([['a', 0, 0], ['b', 0, 4], ['c', 2, 2]]);
    const state = org({ order: ['a', 'b', 'c'], placements: { 8: stored } });

    expect(resolvePlacements(state, ['a', 'b', 'c'], 8)).toEqual(stored);
  });

  it('folds a row and a column nothing touches, and leaves the rest of the shape alone', () => {
    // Rows 2-3 and columns 2-3 are crossed by no footprint at all: dead lines, not holes.
    const stored = homes([['a', 0, 0], ['b', 0, 4], ['c', 4, 0]]);
    const state = org({ order: ['a', 'b', 'c'], placements: { 8: stored } });

    expect(resolvePlacements(state, ['a', 'b', 'c'], 8))
      .toEqual(homes([['a', 0, 0], ['b', 0, 2], ['c', 2, 0]]));
  });

  it('drops a newcomer into the first free space and leaves the arrangement alone', () => {
    const stored = homes([['a', 0, 0], ['b', 0, 4]]);
    const state = org({ order: ['a', 'b', 'fresh'], placements: { 8: stored } });

    const places = resolvePlacements(state, ['a', 'b', 'fresh'], 8);

    expect(places.a).toEqual({ row: 0, col: 0 });
    expect(places.b).toEqual({ row: 0, col: 4 });
    expect(places.fresh).toEqual({ row: 0, col: 2 });
  });

  it('ignores the homes of tiles that belong to another grid', () => {
    // A folder's members share the width map with the main grid. They are drawn in their own board, so
    // one of them standing at (0,0) must not push a top-level tile out of (0,0).
    const state = org({
      order: ['top'],
      placements: { 8: homes([['member', 0, 0]]) },
    });

    expect(resolvePlacements(state, ['top'], 8)).toEqual(homes([['top', 0, 0]]));
  });

  it('re-fits a home the grid has outgrown rather than drawing a tile off the board', () => {
    const state = org({
      order: ['a'],
      sizes: sizes([['a', 'large']]),
      placements: { 8: homes([['a', 0, 5]]) },
    });

    const places = resolvePlacements(state, ['a'], 8);

    expect(places.a.col + spanAt('large', 8)).toBeLessThanOrEqual(8);
  });
});

describe('collapseBoard', () => {
  const tile = (id: string, row: number, col: number, span: number) => ({ id, row, col, span });

  it('slides everything past a dead line closer, up and left', () => {
    const folded = collapseBoard([tile('a', 2, 2, 2), tile('b', 6, 6, 1)]);

    // Leading lines are dead lines too, and so is the whole gap between the tiles: the board pulls
    // to the top-left corner and the two footprints end up touching.
    expect(folded).toEqual([tile('a', 0, 0, 2), tile('b', 2, 2, 1)]);
  });

  it('keeps a line any footprint crosses, so a partial hole survives', () => {
    const board = [tile('big', 0, 0, 4), tile('s', 0, 5, 1)];

    // Every row is crossed by `big`, so no row folds even though `s` sits alone in row 0. Column 4
    // is crossed by nothing, so `s` slides left to meet the large tile.
    expect(collapseBoard(board)).toEqual([tile('big', 0, 0, 4), tile('s', 0, 4, 1)]);
  });

  it('returns the very same array when nothing is dead', () => {
    const board = [tile('a', 0, 0, 1), tile('b', 1, 1, 1)];

    expect(collapseBoard(board)).toBe(board);
  });
});

describe('prunePlacements', () => {
  it('frees a deleted tile\'s cells and leaves every other home in place', () => {
    const placements = {
      8: homes([['a', 0, 0], ['gone', 0, 2], ['b', 0, 4]]),
      4: homes([['a', 0, 0], ['gone', 2, 0]]),
    };

    const pruned = prunePlacements(placements, new Set(['a', 'b']));

    expect(pruned[8]).toEqual(homes([['a', 0, 0], ['b', 0, 4]]));
    expect(pruned[4]).toEqual(homes([['a', 0, 0]]));
  });

  it('returns the same object when there is nothing to forget', () => {
    const placements = { 8: homes([['a', 0, 0]]) };

    expect(prunePlacements(placements, new Set(['a']))).toBe(placements);
  });
});

describe('withPlacements', () => {
  it('replaces one width and leaves the others untouched', () => {
    const state = org({ placements: { 4: homes([['a', 0, 0]]), 8: homes([['a', 1, 1]]) } });

    const next = withPlacements(state, 8, homes([['a', 2, 2]]));

    expect(next.placements[8]).toEqual(homes([['a', 2, 2]]));
    expect(next.placements[4]).toEqual(homes([['a', 0, 0]]));
  });
});

describe('setTileSize with a grid to fit into', () => {
  it('keeps a grown tile where it stands when the bigger footprint is free', () => {
    const state = org({
      order: ['a', 'b'],
      placements: { 8: homes([['a', 0, 0], ['b', 0, 4]]) },
    });

    const next = setTileSize(state, 'a', 'large', ['a', 'b']);

    expect(next.placements[8].a).toEqual({ row: 0, col: 0 });
    expect(next.placements[8].b).toEqual({ row: 0, col: 4 });
  });

  it('moves a grown tile to the nearest free space rather than crushing its neighbors', () => {
    const state = org({
      order: ['a', 'b'],
      placements: { 8: homes([['a', 0, 0], ['b', 0, 2]]) },
    });

    const next = setTileSize(state, 'a', 'large', ['a', 'b']);

    // `b` never budges; `a` finds the first block of four that is genuinely free.
    expect(next.placements[8].b).toEqual({ row: 0, col: 2 });
    expect(next.placements[8].a).toEqual({ row: 0, col: 4 });
  });

  it('keeps the anchor when a tile shrinks', () => {
    const state = org({
      order: ['a'],
      sizes: sizes([['a', 'large']]),
      placements: { 8: homes([['a', 0, 4]]) },
    });

    const next = setTileSize(state, 'a', 'small', ['a']);

    expect(next.placements[8].a).toEqual({ row: 0, col: 4 });
  });

  it('re-fits the tile at every width it has a home in', () => {
    const state = org({
      order: ['a', 'b'],
      placements: { 8: homes([['a', 0, 0], ['b', 0, 2]]), 4: homes([['a', 0, 0], ['b', 0, 2]]) },
    });

    const next = setTileSize(state, 'a', 'large', ['a', 'b']);

    expect(next.placements[8].a).toEqual({ row: 0, col: 4 });
    // Four columns wide, a large tile fills the row, so it drops below the tile that stayed.
    expect(next.placements[4].a).toEqual({ row: 2, col: 0 });
    expect(next.placements[4].b).toEqual({ row: 0, col: 2 });
  });
});
