import { describe, it, expect } from 'vitest';
import { anyRowCanParent, knownParent, projectDrop, removeCollapsedRows } from './treeProjection';

interface Row { id: string; parentId: string | null; depth: number; folder: boolean }
const row = (id: string, parentId: string | null, depth: number, folder = false): Row => ({ id, parentId, depth, folder });
const foldersOnly = (r: Row) => r.folder;

describe('projectDrop', () => {
  // A (folder) · B · C — all top level.
  const flat = [row('A', null, 0, true), row('B', null, 0), row('C', null, 0)];

  it('nests under the row above when any row can parent', () => {
    expect(projectDrop(flat, 'C', 'C', 24, 24, anyRowCanParent)).toEqual({ depth: 1, parentId: 'B' });
  });

  it('keeps a row level when the row above cannot parent', () => {
    expect(projectDrop(flat, 'C', 'C', 24, 24, foldersOnly)).toEqual({ depth: 0, parentId: null });
  });

  it('nests under a row that can parent', () => {
    expect(projectDrop(flat, 'B', 'B', 24, 24, foldersOnly)).toEqual({ depth: 1, parentId: 'A' });
  });

  it('keeps the first row at the top level however far right it is dragged', () => {
    expect(projectDrop(flat, 'C', 'A', 24 * 3, 24, anyRowCanParent)).toEqual({ depth: 0, parentId: null });
  });

  it('descends at most one level past the row above', () => {
    expect(projectDrop(flat, 'C', 'C', 24 * 5, 24, anyRowCanParent)).toEqual({ depth: 1, parentId: 'B' });
  });

  // A: [B: [C], D]
  const nested = [row('A', null, 0), row('B', 'A', 1), row('C', 'B', 2), row('D', 'A', 1)];

  it('takes the parent of the nearest row above at a shallower depth', () => {
    // D sits below C (depth 2) at depth 1, so its parent comes from B.
    expect(projectDrop(nested, 'D', 'D', 0, 24, anyRowCanParent)).toEqual({ depth: 1, parentId: 'A' });
  });

  it('cannot rise above the row below it', () => {
    expect(projectDrop(nested, 'C', 'C', -24 * 5, 24, anyRowCanParent)).toEqual({ depth: 1, parentId: 'A' });
  });

  it('shares the parent of the row above when level with it', () => {
    // Over D while dragging C left by one level: C lands after D, under A.
    expect(projectDrop(nested, 'C', 'D', -24, 24, anyRowCanParent)).toEqual({ depth: 1, parentId: 'A' });
  });

  it('lands at the top level at depth zero', () => {
    expect(projectDrop(nested, 'D', 'D', -24, 24, anyRowCanParent)).toEqual({ depth: 0, parentId: null });
  });

  it('returns the top level for an id that is not a row', () => {
    expect(projectDrop(nested, 'missing', 'D', 24, 24, anyRowCanParent)).toEqual({ depth: 0, parentId: null });
    expect(projectDrop(nested, 'D', 'missing', 24, 24, anyRowCanParent)).toEqual({ depth: 0, parentId: null });
  });
});

describe('removeCollapsedRows', () => {
  // A: [B: [C], D] · E
  const rows = [row('A', null, 0), row('B', 'A', 1), row('C', 'B', 2), row('D', 'A', 1), row('E', null, 0)];

  it('hides every descendant of a collapsed row and keeps the row itself', () => {
    expect(removeCollapsedRows(rows, ['A']).map((r) => r.id)).toEqual(['A', 'E']);
  });

  it('hides only the collapsed subtree', () => {
    expect(removeCollapsedRows(rows, ['B']).map((r) => r.id)).toEqual(['A', 'B', 'D', 'E']);
  });

  it('keeps every row when nothing named is a row', () => {
    expect(removeCollapsedRows(rows, ['missing'])).toEqual(rows);
  });
});

describe('knownParent', () => {
  const known = new Set(['g1']);

  it('keeps a reference to a known parent', () => {
    expect(knownParent('g1', known)).toBe('g1');
  });

  it('reads a dangling reference as the top level', () => {
    expect(knownParent('deleted', known)).toBeNull();
  });

  it('reads an absent reference as the top level', () => {
    expect(knownParent(null, known)).toBeNull();
    expect(knownParent(undefined, known)).toBeNull();
  });
});
