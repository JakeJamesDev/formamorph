import { describe, it, expect } from 'vitest';
import { readGesture, type GestureReading } from './gestureReader';
import type { PackedTile } from './packer';

/** A board built from `[id, row, col, span]` rows, so a case reads as the shape it starts in. */
const board = (rows: [string, number, number, number][]): PackedTile[] =>
  rows.map(([id, row, col, span]) => ({ id, row, col, span }));

/** A pointer reading in base-cell units, with the cell it falls in. */
const from = (x: number, y: number) => ({
  pointer: { x, y },
  pointerCell: { row: Math.floor(y), col: Math.floor(x) },
});

/** Where one tile stands in a reading, as `[row, col]`. */
const at = (reading: GestureReading, id: string): [number, number] => {
  const tile = reading.tiles.find((t) => t.id === id);
  if (!tile) throw new Error(`${id} is not on the board`);
  return [tile.row, tile.col];
};

const overlaps = (a: PackedTile, b: PackedTile): boolean =>
  a.row < b.row + b.span && b.row < a.row + a.span
  && a.col < b.col + b.span && b.col < a.col + a.span;

/** Whatever the reading decided, the board it hands back is still a board. */
const expectSound = (reading: GestureReading, columns: number) => {
  for (const tile of reading.tiles) {
    expect(tile.row).toBeGreaterThanOrEqual(0);
    expect(tile.col).toBeGreaterThanOrEqual(0);
    expect(tile.col + tile.span).toBeLessThanOrEqual(columns);
  }
  for (let i = 0; i < reading.tiles.length; i++) {
    for (let j = i + 1; j < reading.tiles.length; j++) {
      const [a, b] = [reading.tiles[i], reading.tiles[j]];
      expect(overlaps(a, b), `${a.id} and ${b.id} share a cell`).toBe(false);
    }
  }
};

const grab = (row: number, col: number) => ({ row, col });

describe('readGesture — intent', () => {
  const row = board([['c', 0, 0, 2], ['t', 0, 2, 2]]);

  it('reads the far half of a tile in the pickup row as a move', () => {
    const reading = readGesture({
      tiles: row, carriedId: 'c', columns: 8, grabCell: grab(0, 0), ...from(3.6, 1),
    });

    expect(reading.target?.id).toBe('t');
    expect(reading.intent).toBe('move');
  });

  it('reads the near half of that tile as a folder', () => {
    const reading = readGesture({
      tiles: row, carriedId: 'c', columns: 8, grabCell: grab(0, 0), ...from(2.4, 1),
    });

    expect(reading.target?.id).toBe('t');
    expect(reading.intent).toBe('folder');
  });

  it('flips the halves when the pickup sits on the other side', () => {
    const tiles = board([['c', 0, 4, 2], ['t', 0, 2, 2]]);
    const near = { tiles, carriedId: 'c', columns: 8, grabCell: grab(0, 0) };

    expect(readGesture({ ...near, ...from(2.4, 1) }).intent).toBe('move');
    expect(readGesture({ ...near, ...from(3.6, 1) }).intent).toBe('folder');
  });

  it('splits a tile in the pickup column the same way', () => {
    const column = {
      tiles: board([['c', 0, 0, 2], ['t', 4, 0, 2]]), carriedId: 'c', columns: 6, grabCell: grab(0, 0),
    };

    expect(readGesture({ ...column, ...from(1, 5.6) }).intent).toBe('move');
    expect(readGesture({ ...column, ...from(1, 4.4) }).intent).toBe('folder');
  });

  it('flips a column tile when the pickup sits below it', () => {
    const column = {
      tiles: board([['c', 4, 0, 2], ['t', 0, 0, 2]]), carriedId: 'c', columns: 6, grabCell: grab(0, 0),
    };

    expect(readGesture({ ...column, ...from(1, 0.4) }).intent).toBe('move');
    expect(readGesture({ ...column, ...from(1, 1.6) }).intent).toBe('folder');
  });

  it('splits a diagonal tile along the line from the pickup', () => {
    const diagonal = {
      tiles: board([['c', 0, 0, 2], ['t', 2, 2, 2]]), carriedId: 'c', columns: 6, grabCell: grab(0, 0),
    };

    expect(readGesture({ ...diagonal, ...from(3.6, 3.6) }).intent).toBe('move');
    expect(readGesture({ ...diagonal, ...from(2.4, 2.4) }).intent).toBe('folder');
  });

  it('flips a diagonal tile when the pickup sits past it', () => {
    const diagonal = {
      tiles: board([['c', 2, 2, 2], ['t', 0, 0, 2]]), carriedId: 'c', columns: 6, grabCell: grab(0, 0),
    };

    expect(readGesture({ ...diagonal, ...from(0.4, 0.4) }).intent).toBe('move');
    expect(readGesture({ ...diagonal, ...from(1.6, 1.6) }).intent).toBe('folder');
  });

  it('reads open board as a move with no target', () => {
    const reading = readGesture({
      tiles: row, carriedId: 'c', columns: 8, grabCell: grab(0, 0), ...from(4.5, 4.5),
    });

    expect(reading.target).toBeNull();
    expect(reading.intent).toBe('move');
  });

  it('reads the carried tile own home as a move with no target', () => {
    const reading = readGesture({
      tiles: row, carriedId: 'c', columns: 8, grabCell: grab(0, 1), ...from(1.5, 0.5),
    });

    expect(reading.target).toBeNull();
    expect(reading.intent).toBe('move');
    expect(reading.moved).toEqual([]);
  });

  it('reads a folder tile on its near side like any other tile', () => {
    const tiles = board([['c', 0, 0, 2], ['folder-1', 0, 2, 2]]);

    const reading = readGesture({
      tiles, carriedId: 'c', columns: 8, grabCell: grab(0, 0), ...from(2.4, 1),
    });

    expect(reading.target?.id).toBe('folder-1');
    expect(reading.intent).toBe('folder');
    expect(reading.moved).toEqual([]);
    expect(at(reading, 'folder-1')).toEqual([0, 2]);
    expect(at(reading, 'c')).toEqual([0, 0]);
  });
});

describe('readGesture — anchor', () => {
  it('lands a tile of the same size on the cells of the one it rests on', () => {
    const tiles = board([['c', 0, 0, 2], ['t', 0, 2, 2]]);

    const reading = readGesture({
      tiles, carriedId: 'c', columns: 8, grabCell: grab(1, 1), ...from(3.6, 1),
    });

    expect(reading.anchor).toEqual({ row: 0, col: 2 });
    expect(at(reading, 'c')).toEqual([0, 2]);
  });

  it('takes the next nearest spot when the nearest one blocks', () => {
    const tiles = board([['c', 0, 0, 4], ['t', 0, 6, 1], ['low', 2, 4, 4]]);

    const reading = readGesture({
      tiles, carriedId: 'c', columns: 8, grabCell: grab(0, 0), ...from(6.9, 0.1),
    });

    expect(reading.anchor).toEqual({ row: 0, col: 4 });
    expect(reading.blocked).toBe(false);
    expectSound(reading, 8);
  });

  it('sits a smaller tile inside the one it rests on', () => {
    const tiles = board([['c', 0, 0, 1], ['t', 4, 1, 4]]);

    const reading = readGesture({
      tiles, carriedId: 'c', columns: 6, grabCell: grab(0, 0), ...from(4.9, 7.9),
    });

    expect(reading.anchor).toEqual({ row: 4, col: 1 });
    expect(at(reading, 't')).toEqual([0, 0]);
    expectSound(reading, 6);
  });

  it('follows the pointer cell minus the grabbed cell over open board', () => {
    // `deep` keeps the board six rows tall, so row 4 is on it.
    const tiles = board([['c', 0, 0, 2], ['t', 0, 2, 2], ['deep', 4, 6, 2]]);

    const reading = readGesture({
      tiles, carriedId: 'c', columns: 8, grabCell: grab(1, 1), ...from(5.5, 5.5),
    });

    expect(reading.anchor).toEqual({ row: 4, col: 4 });
    expect(reading.moved).toEqual([]);
  });

  it('keeps an open-board anchor on the board', () => {
    const tiles = board([['c', 0, 0, 2], ['t', 4, 4, 2]]);

    const reading = readGesture({
      tiles, carriedId: 'c', columns: 8, grabCell: grab(0, 0), ...from(7.5, 0.5),
    });

    expect(reading.anchor).toEqual({ row: 0, col: 6 });
  });
});

describe('readGesture — move', () => {
  it('pushes a row toward the hole', () => {
    const tiles = board([['c', 0, 0, 2], ['m', 0, 2, 2], ['s', 1, 5, 1]]);

    const reading = readGesture({
      tiles, carriedId: 'c', columns: 8, grabCell: grab(0, 0), ...from(4.5, 0.5),
    });

    expect(at(reading, 'm')).toEqual([0, 0]);
    expect(at(reading, 's')).toEqual([1, 3]);
    expect(at(reading, 'c')).toEqual([0, 4]);
    expect([...reading.moved].sort()).toEqual(['m', 's']);
    expect(reading.blocked).toBe(false);
    expectSound(reading, 8);
  });

  it('pushes a column toward the hole', () => {
    const tiles = board([['c', 0, 0, 2], ['m', 2, 0, 2], ['t', 4, 0, 2]]);

    const reading = readGesture({
      tiles, carriedId: 'c', columns: 6, grabCell: grab(0, 0), ...from(1, 5.6),
    });

    expect(at(reading, 'm')).toEqual([0, 0]);
    expect(at(reading, 't')).toEqual([2, 0]);
    expect(at(reading, 'c')).toEqual([4, 0]);
    expect([...reading.moved].sort()).toEqual(['m', 't']);
    expectSound(reading, 6);
  });

  it('swaps a diagonal tile into the hole and touches nothing on the path', () => {
    const tiles = board([['c', 0, 0, 2], ['t', 2, 2, 2], ['bystander', 2, 0, 2]]);

    const reading = readGesture({
      tiles, carriedId: 'c', columns: 6, grabCell: grab(0, 0), ...from(3.6, 3.6),
    });

    expect(at(reading, 't')).toEqual([0, 0]);
    expect(at(reading, 'c')).toEqual([2, 2]);
    expect(at(reading, 'bystander')).toEqual([2, 0]);
    expect(reading.moved).toEqual(['t']);
    expectSound(reading, 6);
  });

  it('swaps a block of small tiles into the hole with their offsets intact', () => {
    const tiles = board([
      ['c', 0, 0, 4], ['a', 4, 4, 1], ['b', 5, 6, 1], ['d', 6, 5, 1],
    ]);

    const reading = readGesture({
      tiles, carriedId: 'c', columns: 8, grabCell: grab(3, 3), ...from(7.5, 7.5),
    });

    expect(at(reading, 'a')).toEqual([0, 0]);
    expect(at(reading, 'b')).toEqual([1, 2]);
    expect(at(reading, 'd')).toEqual([2, 1]);
    expect(at(reading, 'c')).toEqual([4, 4]);
    expect([...reading.moved].sort()).toEqual(['a', 'b', 'd']);
    expectSound(reading, 8);
  });

  it('moves nothing when the footprint lands on open cells', () => {
    const tiles = board([['c', 0, 0, 2], ['t', 0, 2, 2], ['deep', 4, 6, 2]]);

    const reading = readGesture({
      tiles, carriedId: 'c', columns: 8, grabCell: grab(0, 0), ...from(4.5, 4.5),
    });

    expect(reading.moved).toEqual([]);
    expect(at(reading, 't')).toEqual([0, 2]);
    expect(at(reading, 'c')).toEqual([4, 4]);
  });
});

describe('readGesture — blocked', () => {
  it('blocks a mover that would leave the board', () => {
    const tiles = board([['c', 0, 0, 2], ['t', 2, 0, 2]]);

    const reading = readGesture({
      tiles, carriedId: 'c', columns: 4, grabCell: grab(1, 1), ...from(2.5, 3.5),
    });

    expect(reading.blocked).toBe(true);
    expect(reading.reason).toBe('t would leave the board');
    expect(reading.moved).toEqual([]);
  });

  it('blocks a mover that would still sit under the carried tile', () => {
    const tiles = board([['c', 4, 0, 2], ['big', 0, 2, 4]]);

    const reading = readGesture({
      tiles, carriedId: 'c', columns: 6, grabCell: grab(1, 1), ...from(3.5, 4.5),
    });

    expect(reading.blocked).toBe(true);
    expect(reading.reason).toBe('big would still sit under c');
  });

  it('blocks a mover that would land on a bystander', () => {
    const tiles = board([['c', 0, 0, 2], ['big', 0, 2, 4], ['bystander', 3, 0, 1]]);

    const reading = readGesture({
      tiles, carriedId: 'c', columns: 8, grabCell: grab(0, 1), ...from(6.5, 0.5),
    });

    expect(reading.blocked).toBe(true);
    expect(reading.reason).toBe('big would land on bystander');
  });

  it('leaves the pre-drag board standing when it blocks', () => {
    const tiles = board([['c', 0, 0, 2], ['t', 2, 0, 2]]);

    const reading = readGesture({
      tiles, carriedId: 'c', columns: 4, grabCell: grab(1, 1), ...from(2.5, 3.5),
    });

    expect(at(reading, 'c')).toEqual([0, 0]);
    expect(at(reading, 't')).toEqual([2, 0]);
    expectSound(reading, 4);
  });

  it('stands on the nearest spot when every spot on the target blocks', () => {
    const tiles = board([['c', 4, 0, 1], ['big', 0, 0, 4], ['bystander', 4, 3, 1]]);

    const reading = readGesture({
      tiles, carriedId: 'c', columns: 5, grabCell: grab(0, 0), ...from(3.9, 0.1),
    });

    expect(reading.intent).toBe('move');
    expect(reading.anchor).toEqual({ row: 3, col: 0 });
    expect(reading.blocked).toBe(true);
    expect(reading.reason).toBe('big would still sit under c');
    expect(at(reading, 'big')).toEqual([0, 0]);
  });
});

describe('readGesture — open board', () => {
  const tiles = board([['c', 0, 0, 2], ['t', 0, 2, 2], ['b', 2, 0, 2]]);

  it('lands on the cell nearest the ghost corner, not the cell under the pointer', () => {
    // Grabbed by its far corner: the pointer sits in column 5 while the ghost's corner is at 3.6.
    const reading = readGesture({
      tiles, carriedId: 'c', columns: 8, grabCell: grab(1, 1), ...from(5.6, 3.6),
      ghost: { x: 3.6, y: 1.6 },
    });

    expect(reading.anchor).toEqual({ row: 2, col: 4 });
    expect(reading.moved).toEqual([]);
    expectSound(reading, 8);
  });

  it('rounds the ghost down while its corner sits short of the next cell', () => {
    const reading = readGesture({
      tiles, carriedId: 'c', columns: 8, grabCell: grab(0, 0), ...from(4.4, 2.4),
      ghost: { x: 4.4, y: 2.4 },
    });

    expect(reading.anchor).toEqual({ row: 2, col: 4 });
  });

  it('goes no further down than the row right below the board', () => {
    const reading = readGesture({
      tiles, carriedId: 'c', columns: 8, grabCell: grab(0, 0), ...from(0.5, 30.5),
      ghost: { x: 0.2, y: 30.2 },
    });

    expect(reading.anchor).toEqual({ row: 4, col: 0 });
    expect(reading.blocked).toBe(false);
    expectSound(reading, 8);
  });

  it('caps the pointer reading the same way without a ghost', () => {
    const reading = readGesture({
      tiles, carriedId: 'c', columns: 8, grabCell: grab(0, 0), ...from(0.5, 30.5),
    });

    expect(reading.anchor).toEqual({ row: 4, col: 0 });
  });
});
