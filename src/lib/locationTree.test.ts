import { describe, it, expect } from 'vitest';
import {
  buildLocationTree, flattenLocationTree, removeCollapsedChildren, isDescendantLocation,
  removeLocationPromotingChildren, getLocationDropProjection, applyLocationDrop,
} from './locationTree';
import type { GameLocation } from '@/types';

// Compact location factory: id doubles as name; parentId omitted = top-level.
const L = (id: string, parentId?: string | null): GameLocation => ({ id, name: id, parentId });

// A: [B, C]  ·  D  (top-level order A, D; A's children in array order B, C)
const nested: GameLocation[] = [L('A'), L('B', 'A'), L('C', 'A'), L('D')];

describe('buildLocationTree', () => {
  it('nests by parentId with siblings in array order', () => {
    const tree = buildLocationTree(nested);
    expect(tree.map((n) => n.id)).toEqual(['A', 'D']);
    expect(tree[0].children.map((n) => n.id)).toEqual(['B', 'C']);
    expect(tree[1].children).toEqual([]);
  });
});

describe('flattenLocationTree', () => {
  it('depth-first with depth + parentId tags', () => {
    const flat = flattenLocationTree(buildLocationTree(nested));
    expect(flat.map((n) => [n.id, n.depth, n.parentId])).toEqual([
      ['A', 0, null], ['B', 1, 'A'], ['C', 1, 'A'], ['D', 0, null],
    ]);
  });
});

describe('removeCollapsedChildren', () => {
  it('hides descendants of collapsed ids', () => {
    const flat = flattenLocationTree(buildLocationTree(nested));
    expect(removeCollapsedChildren(flat, ['A']).map((n) => n.id)).toEqual(['A', 'D']);
  });
});

describe('isDescendantLocation', () => {
  it('detects self and nested descendants, rejects unrelated', () => {
    expect(isDescendantLocation(nested, 'A', 'A')).toBe(true);
    expect(isDescendantLocation(nested, 'A', 'B')).toBe(true);
    expect(isDescendantLocation(nested, 'A', 'D')).toBe(false);
  });
});

describe('removeLocationPromotingChildren', () => {
  it('promotes direct children to the removed node’s parent (nothing lost)', () => {
    const out = removeLocationPromotingChildren(nested, 'A');
    expect(out.map((l) => l.id)).toEqual(['B', 'C', 'D']); // A gone, B/C kept
    expect(out.find((l) => l.id === 'B')?.parentId ?? null).toBe(null); // promoted to top level
    expect(out.find((l) => l.id === 'C')?.parentId ?? null).toBe(null);
  });

  it('promotes to the grandparent when the removed node is itself nested', () => {
    const deep = [L('A'), L('B', 'A'), L('E', 'B')]; // A > B > E
    const out = removeLocationPromotingChildren(deep, 'B');
    expect(out.map((l) => l.id)).toEqual(['A', 'E']);
    expect(out.find((l) => l.id === 'E')?.parentId).toBe('A'); // E promoted from B up to A
  });

  it('is a no-op for an unknown id', () => {
    expect(removeLocationPromotingChildren(nested, 'nope')).toBe(nested);
  });
});

describe('getLocationDropProjection', () => {
  it('nests under the row above when dragged right in place (any location can parent)', () => {
    const flat = flattenLocationTree(buildLocationTree([L('A'), L('B'), L('C')]));
    // Hold C in place (over === active) and drag one indent right → nests under B.
    const p = getLocationDropProjection(flat, 'C', 'C', 24, 24);
    expect(p).toEqual({ depth: 1, parentId: 'B' });
  });
});

describe('applyLocationDrop', () => {
  it('reparents + reorders so the array encodes the new tree', () => {
    const flat = [L('A'), L('B'), L('C')];
    const out = applyLocationDrop(flat, [], 'C', 'C', 24, 24);
    expect(out.find((l) => l.id === 'C')?.parentId).toBe('B');
    const tree = buildLocationTree(out);
    expect(tree.find((n) => n.id === 'B')?.children.map((c) => c.id)).toEqual(['C']);
  });

  it('is a no-op when the drop target is not visible', () => {
    const flat = [L('A'), L('B'), L('C')];
    expect(applyLocationDrop(flat, [], 'C', 'missing', 24, 24)).toBe(flat);
  });

  it('cannot drop a parent onto a node inside its own (hidden) subtree — no-op', () => {
    // A > B ; while dragging A, its child B is hidden, so B is not a valid drop target → same ref back.
    const flat = [L('A'), L('B', 'A')];
    const out = applyLocationDrop(flat, [], 'A', 'B', 24, 24);
    expect(out).toBe(flat);
  });
});
