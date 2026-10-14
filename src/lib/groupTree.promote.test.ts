import { describe, it, expect } from 'vitest';
import { buildTree, flattenTree, removeGroupPromotingChildren, type TreeGroup, type TreeLeaf } from './groupTree';

const group = (id: string, parentId: string | null, order: number): TreeGroup => ({ id, name: id, parentId, order });
const leaf = (id: string, groupId: string | null, order: number): TreeLeaf => ({ id, name: id, groupId, order });

/** The tree as the editor draws it: ids in depth-first order, each with its depth. */
const drawn = (groups: TreeGroup[], leaves: TreeLeaf[]) =>
  flattenTree(buildTree(groups, leaves)).map((n) => `${'-'.repeat(n.depth)}${n.id}`);

describe('removeGroupPromotingChildren', () => {
  // Root: a, G{x, H{y}, z}, b
  const groups = [group('G', null, 1), group('H', 'G', 1)];
  const leaves = [leaf('a', null, 0), leaf('b', null, 2), leaf('x', 'G', 0), leaf('y', 'H', 0), leaf('z', 'G', 2)];

  it('puts the children in the slot of a middle group', () => {
    const next = removeGroupPromotingChildren(groups, leaves, 'G');
    expect(drawn(next.groups, next.leaves)).toEqual(['a', 'x', 'H', '-y', 'z', 'b']);
  });

  it('renumbers the siblings with no gap or repeat', () => {
    const next = removeGroupPromotingChildren(groups, leaves, 'G');
    const rootOrders = [...next.groups, ...next.leaves]
      .filter((n) => ('groupId' in n ? n.groupId : (n as TreeGroup).parentId) === null)
      .map((n) => n.order).sort();
    expect(rootOrders).toEqual([0, 1, 2, 3, 4]);
  });

  it('puts the children first when the group is the first slot', () => {
    const first = [group('G', null, 0)];
    const held = [leaf('x', 'G', 0), leaf('y', 'G', 1), leaf('a', null, 1), leaf('b', null, 2)];
    const next = removeGroupPromotingChildren(first, held, 'G');
    expect(drawn(next.groups, next.leaves)).toEqual(['x', 'y', 'a', 'b']);
  });

  it('puts the children last when the group is the last slot', () => {
    const last = [group('G', null, 2)];
    const held = [leaf('a', null, 0), leaf('b', null, 1), leaf('x', 'G', 0), leaf('y', 'G', 1)];
    const next = removeGroupPromotingChildren(last, held, 'G');
    expect(drawn(next.groups, next.leaves)).toEqual(['a', 'b', 'x', 'y']);
  });

  it('promotes a nested group into the slot inside its own parent', () => {
    const next = removeGroupPromotingChildren(groups, leaves, 'H');
    expect(drawn(next.groups, next.leaves)).toEqual(['a', 'G', '-x', '-y', '-z', 'b']);
    expect(next.leaves.find((l) => l.id === 'y')?.groupId).toBe('G');
  });

  it('keeps the grandchildren under the subgroup it promotes', () => {
    const deep = [...groups, group('I', 'H', 1)];
    const held = [...leaves, leaf('w', 'I', 0)];
    const next = removeGroupPromotingChildren(deep, held, 'G');
    expect(drawn(next.groups, next.leaves)).toEqual(['a', 'x', 'H', '-y', '-I', '--w', 'z', 'b']);
  });

  it('returns both arrays as given when the id is unknown', () => {
    const next = removeGroupPromotingChildren(groups, leaves, 'gone');
    expect(next.groups).toBe(groups);
    expect(next.leaves).toBe(leaves);
  });

  it('leaves a tree without leaf order to its array order, renumbering only the groups', () => {
    const folders = [group('F', null, 0), group('G', null, 1), group('H', 'G', 0), group('K', null, 2)];
    const rows = [{ id: 'p', name: 'p', groupId: 'G' }, { id: 'q', name: 'q', groupId: 'F' }];
    const next = removeGroupPromotingChildren(folders, rows, 'G', { orderLeaves: false });
    expect(next.groups.map((g) => [g.id, g.parentId, g.order])).toEqual([['F', null, 0], ['H', null, 1], ['K', null, 2]]);
    expect(next.leaves).toEqual([{ id: 'p', name: 'p', groupId: null }, { id: 'q', name: 'q', groupId: 'F' }]);
    expect(next.leaves[1]).toBe(rows[1]);
  });

  it('writes a leaf through placeLeaf when the tree has one', () => {
    const folders = [group('G', null, 0)];
    const rows: TreeLeaf[] = [{ id: 'p', name: 'p', groupId: 'G' }];
    const next = removeGroupPromotingChildren(folders, rows, 'G', {
      orderLeaves: false,
      placeLeaf: (row, groupId) => (groupId === null ? { id: row.id, name: row.name } : { ...row, groupId }),
    });
    expect(next.leaves).toEqual([{ id: 'p', name: 'p' }]);
  });
});
