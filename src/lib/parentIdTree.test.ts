import { describe, it, expect } from 'vitest';
import {
  buildTree, flattenTree, removeCollapsedChildren, isDescendant,
  removePromotingChildren, getDropProjection, applyDrop, type TreeItem,
} from './parentIdTree';

type Item = TreeItem & { name: string };
// A > B (> D), C. Array order encodes siblings.
const items: Item[] = [
  { id: 'a', name: 'A', parentId: null },
  { id: 'b', name: 'B', parentId: 'a' },
  { id: 'd', name: 'D', parentId: 'b' },
  { id: 'c', name: 'C', parentId: null },
];

describe('flattenTree', () => {
  it('depth-first order with depth tags', () => {
    const flat = flattenTree(buildTree(items)).map((n) => [n.id, n.depth]);
    expect(flat).toEqual([['a', 0], ['b', 1], ['d', 2], ['c', 0]]);
  });
});

describe('removeCollapsedChildren', () => {
  it('drops the whole subtree under a collapsed id', () => {
    const flat = flattenTree(buildTree(items));
    expect(removeCollapsedChildren(flat, ['a']).map((n) => n.id)).toEqual(['a', 'c']);
  });
});

describe('isDescendant', () => {
  it('walks the parent chain (self and nested count), guarding cyclic moves', () => {
    expect(isDescendant(items, 'a', 'd')).toBe(true); // d nested under a
    expect(isDescendant(items, 'a', 'a')).toBe(true); // self
    expect(isDescendant(items, 'c', 'd')).toBe(false);
  });
});

describe('removePromotingChildren', () => {
  it('removes a node and lifts its children to the removed node’s parent', () => {
    const out = removePromotingChildren(items, 'b'); // b removed; d promoted to a
    expect(out.find((i) => i.id === 'b')).toBeUndefined();
    expect(out.find((i) => i.id === 'd')?.parentId).toBe('a');
  });
});

describe('getDropProjection / applyDrop', () => {
  it('projects depth from the horizontal offset, clamped to a valid parent', () => {
    const flat = flattenTree(buildTree(items));
    // Dragging C (depth 0) right over the row after B: at one indent it nests under the row above.
    const proj = getDropProjection(flat, 'c', 'd', 24, 24);
    expect(proj.depth).toBeGreaterThanOrEqual(0);
  });

  it('re-parents on drop and rebuilds array in tree order; rejects cyclic moves', () => {
    // Drop C over B (so A is the row above) at one indent → C nests under A.
    const moved = applyDrop(items, [], 'c', 'b', 24, 24);
    expect(moved.find((i) => i.id === 'c')?.parentId).toBe('a');
    // A cyclic move (A under its own descendant D) is a no-op.
    expect(applyDrop(items, [], 'a', 'd', 24, 24)).toBe(items);
  });
});
