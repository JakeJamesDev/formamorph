import { describe, it, expect } from 'vitest';
import { createCellSim, type SimResult, type SimTile } from './cellSim';

/** A board built from `[id, row, col, span]` rows, so a case reads as the shape it starts in. */
const board = (rows: [string, number, number, number][]): SimTile[] =>
  rows.map(([id, row, col, span]) => ({ id, row, col, span }));

/** Where one tile stands in a result, as `[row, col]`. */
const at = (result: SimResult, id: string): [number, number] => {
  const tile = result.tiles.find((t) => t.id === id);
  if (!tile) throw new Error(`${id} is not on the board`);
  return [tile.row, tile.col];
};

/** True when two footprints claim any base cell in common. */
const overlaps = (a: SimTile, b: SimTile): boolean =>
  a.row < b.row + b.span && b.row < a.row + a.span
  && a.col < b.col + b.span && b.col < a.col + a.span;

/**
 * The board is still a board: nothing has left it sideways, no two residents share a cell, and no tile
 * has changed shape. Every gesture has to leave this true, however tangled the path was.
 *
 * The dragged tile joins the overlap check only while the claim stands. A blocked claim is exactly the
 * case where it lands on someone — that is what the caller reads `blocked` for, and what makes it commit
 * the last standing configuration instead of this one.
 */
const expectSound = (result: SimResult, columns: number, spans: Record<string, number>) => {
  const all = result.blocked ? result.tiles : [...result.tiles, result.pinned];
  for (const tile of [...result.tiles, result.pinned]) {
    expect(tile.span).toBe(spans[tile.id]);
    expect(tile.col).toBeGreaterThanOrEqual(0);
    expect(tile.row).toBeGreaterThanOrEqual(0);
    expect(tile.col + tile.span).toBeLessThanOrEqual(columns);
  }
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      expect(overlaps(all[i], all[j]), `${all[i].id} and ${all[j].id} share a cell`).toBe(false);
    }
  }
};

describe('createCellSim', () => {
  it('trades places with the tile it steps onto, the way the flat grid does', () => {
    const sim = createCellSim(board([['a', 0, 0, 1], ['b', 0, 1, 1]]), 'a', 4);

    const result = sim.advance({ row: 0, col: 1 });

    expect(at(result, 'b')).toEqual([0, 0]);
    expect(result.moved).toEqual(['b']);
    expect(result.blocked).toBe(false);
  });

  it('moves nothing when the drag crosses open cells', () => {
    const sim = createCellSim(board([['a', 0, 0, 1], ['b', 0, 3, 1]]), 'a', 6);

    const result = sim.advance({ row: 0, col: 1 });

    expect(result.moved).toEqual([]);
    expect(at(result, 'b')).toEqual([0, 3]);
    expect(result.blocked).toBe(false);
    expect(result.blocker).toBeNull();
  });

  it('reports the claimed footprint as the pinned tile', () => {
    const sim = createCellSim(board([['a', 0, 0, 2], ['b', 2, 0, 2]]), 'a', 6);

    const result = sim.advance({ row: 0, col: 2 });

    expect(result.pinned).toEqual({ id: 'a', row: 0, col: 2, span: 2 });
  });

  it('leaves a large tile alone when the drag only clips its corner', () => {
    // One cell of sixteen is swept, so the big tile holds its ground and the claim is refused.
    const sim = createCellSim(board([['a', 0, 0, 1], ['big', 0, 2, 4]]), 'a', 8);

    const result = sim.advance({ row: 0, col: 2 });

    expect(at(result, 'big')).toEqual([0, 2]);
    expect(result.moved).toEqual([]);
    expect(result.blocked).toBe(true);
    expect(result.blocker).toEqual({ id: 'big', consented: false });
  });

  it('lets a large tile hold its ground when the drag sweeps one row of it and moves on', () => {
    // The whole row of four is swept and the drag ends clear of the tile, so a spot to lean into is
    // free and valid. A quarter is still a quarter: the big tile does not follow the drag out.
    const sim = createCellSim(board([['a', 0, 0, 1], ['big', 0, 1, 4]]), 'a', 8);

    const result = sim.advance({ row: 0, col: 5 });

    expect(at(result, 'big')).toEqual([0, 1]);
    expect(result.moved).toEqual([]);
    expect(result.blocked).toBe(false);
  });

  it('refuses to land a consenting group under the tile being dragged', () => {
    // Half of `m` is swept and it leans two columns left, which is where `a` now stands.
    const sim = createCellSim(board([['a', 0, 0, 2], ['m', 0, 2, 2]]), 'a', 6);

    const result = sim.advance({ row: 0, col: 1 });

    expect(at(result, 'm')).toEqual([0, 2]);
    expect(result.moved).toEqual([]);
    expect(result.blocker).toEqual({ id: 'm', consented: true });
  });

  it('refuses to push a consenting group off the edge of the board', () => {
    // `m` sits against the right edge and the gesture leans it further right, so its only landing spot
    // is off the board. It stays where it is rather than being clipped or wrapped.
    const sim = createCellSim(board([['a', 2, 3, 1], ['m', 0, 2, 2]]), 'a', 4);

    const result = sim.advance({ row: 1, col: 1 });

    expect(at(result, 'm')).toEqual([0, 2]);
    expect(result.moved).toEqual([]);
    expectSound(result, 4, { a: 1, m: 2 });
  });

  it('holds a group still below half its cells, and moves it at half', () => {
    const sim = createCellSim(board([['a', 0, 0, 1], ['m', 0, 1, 2]]), 'a', 6);

    // One cell of four: a quarter swept, nowhere near enough to shift the whole group.
    const quarter = sim.advance({ row: 0, col: 1 });
    expect(at(quarter, 'm')).toEqual([0, 1]);
    expect(quarter.blocker).toEqual({ id: 'm', consented: false });

    // A second column of the same tile: half its cells, and the group goes.
    const half = sim.advance({ row: 0, col: 2 });
    expect(at(half, 'm')).toEqual([0, 0]);
    expect(half.moved).toEqual(['m']);
    expect(half.blocked).toBe(false);
  });

  it('keeps a moved group in formation at the spot its cells were pushed to', () => {
    const sim = createCellSim(board([['a', 0, 0, 1], ['m', 0, 1, 2]]), 'a', 6);

    sim.advance({ row: 0, col: 1 });
    const result = sim.advance({ row: 0, col: 2 });

    // The whole 2x2 lands one column behind the drag, shape intact — not scattered across the cells
    // its parts were pushed into.
    expect(result.tiles.find((t) => t.id === 'm')).toEqual({ id: 'm', row: 0, col: 0, span: 2 });
    expectSound(result, 6, { a: 1, m: 2 });
  });

  it('follows the way most of a group was pushed, not the way its first cell went', () => {
    // Down into the big tile, then across it: the corner cell is nudged one way and the column that
    // follows is pushed another. The group lands where the majority leaned.
    const sim = createCellSim(board([['a', 0, 3, 2], ['big', 3, 0, 4]]), 'a', 8);

    sim.advance({ row: 1, col: 3 });
    const result = sim.advance({ row: 4, col: 0 });

    expect(at(result, 'big')).toEqual([3, 2]);
    expect(result.moved).toContain('big');
  });

  it('walks the board home when the gesture backtracks', () => {
    const sim = createCellSim(board([['a', 0, 0, 1], ['m', 0, 1, 2]]), 'a', 6);

    sim.advance({ row: 0, col: 1 });
    const back = sim.advance({ row: 0, col: 0 });

    expect(at(back, 'm')).toEqual([0, 1]);
    expect(back.moved).toEqual([]);
    expect(back.blocked).toBe(false);

    // And the retreat really undid the sweep: the next push forward has to earn its half all over
    // again, rather than arriving already consented.
    expect(sim.advance({ row: 0, col: 1 }).blocker).toEqual({ id: 'm', consented: false });
  });

  it('refuses to land a consenting group on top of another tile', () => {
    // `m` is swept to half and leans left, but `x` is already standing where it would land.
    const sim = createCellSim(
      board([['a', 1, 0, 1], ['m', 0, 1, 2], ['x', 0, 0, 1]]),
      'a',
      6,
    );

    sim.advance({ row: 1, col: 1 });
    const result = sim.advance({ row: 1, col: 2 });

    expect(at(result, 'm')).toEqual([0, 1]);
    expect(at(result, 'x')).toEqual([0, 0]);
    expect(result.moved).toEqual([]);
    // Consented, and stuck: a different refusal from the corner poke, and the caller can tell them apart.
    expect(result.blocker).toEqual({ id: 'm', consented: true });
  });

  it('clamps a wanted anchor to the board it is dragging on', () => {
    const sim = createCellSim(board([['a', 0, 0, 2], ['b', 0, 2, 2]]), 'a', 4);

    const result = sim.advance({ row: -5, col: 99 });

    expect(result.pinned.row).toBe(0);
    expect(result.pinned.col).toBe(2);
  });

  it('carries a large tile through a field of smalls and leaves the board sound', () => {
    const spans = { big: 4, s0: 1, s1: 1, s2: 1, s3: 1, s4: 1, s5: 1, m: 2 };
    const sim = createCellSim(
      board([
        ['big', 0, 0, 4], ['m', 0, 4, 2], ['s0', 0, 6, 1], ['s1', 1, 6, 1],
        ['s2', 2, 4, 1], ['s3', 2, 5, 1], ['s4', 3, 4, 1], ['s5', 3, 5, 1],
      ]),
      'big',
      8,
    );

    // A long, turning gesture: right across the smalls, down, back left, and up again.
    const path = [
      { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 }, { row: 0, col: 4 },
      { row: 1, col: 4 }, { row: 2, col: 4 }, { row: 2, col: 2 }, { row: 1, col: 1 },
      { row: 0, col: 0 },
    ];
    for (const want of path) expectSound(sim.advance(want), 8, spans);
  });

  it('never lets a group land off the board, however the gesture turns', () => {
    const spans = { drag: 1, wide: 4 };
    const sim = createCellSim(board([['drag', 0, 4, 1], ['wide', 0, 0, 4]]), 'drag', 5);

    // Sweeping the big tile column by column from both sides is what mixes the displacement vectors,
    // so the spot it leans toward is not simply "one behind the drag" any more.
    const path = [
      { row: 0, col: 3 }, { row: 1, col: 3 }, { row: 2, col: 3 }, { row: 3, col: 3 },
      { row: 3, col: 2 }, { row: 2, col: 2 }, { row: 1, col: 2 }, { row: 0, col: 2 },
      { row: 0, col: 1 }, { row: 1, col: 1 }, { row: 2, col: 1 }, { row: 3, col: 1 },
    ];
    for (const want of path) expectSound(sim.advance(want), 5, spans);
  });
});
