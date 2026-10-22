import { describe, it, expect } from 'vitest';
import {
  applyStatDrop, buildStatTree, duplicateStatNode, newStatGroup, removeStatGroup, statPanelBlocks, statPanelLayout, statRootCount,
  statsInTreeOrder,
} from './statGroupTree';
import type { Stat, StatGroup } from '@/types';

const INDENT = 20;

const stat = (id: string, extra: Partial<Stat> = {}): Stat => ({
  id, name: id, type: 'number', description: '', min: 0, max: 100, value: 0, regen: 0, descriptors: [], ...extra,
});
const group = (id: string, extra: Partial<StatGroup> = {}): StatGroup => ({ id, name: id, parentId: null, ...extra });
const ids = (list: { id: string }[]) => list.map((x) => x.id);

describe('statsInTreeOrder', () => {
  it('lists stats group by group, in sibling order', () => {
    const groups = [group('body', { order: 0 }), group('mind', { order: 1 })];
    const stats = [
      stat('calm', { groupId: 'mind', order: 0 }), stat('vigor', { groupId: 'body', order: 1 }),
      stat('grit', { groupId: 'body', order: 0 }),
    ];
    expect(ids(statsInTreeOrder(groups, stats))).toEqual(['grit', 'vigor', 'calm']);
  });

  it('reads a stat whose group is gone as top level', () => {
    expect(ids(statsInTreeOrder([], [stat('a', { groupId: 'gone' })]))).toEqual(['a']);
  });
});

describe('statRootCount', () => {
  it('counts the top-level stats and groups, a dangling group reference as top level', () => {
    const groups = [group('g'), group('child', { parentId: 'g' })];
    const stats = [stat('a'), stat('b', { groupId: 'g' }), stat('c', { groupId: 'gone' })];
    expect(statRootCount(groups, stats)).toBe(3);
  });
});

describe('applyStatDrop', () => {
  const base = () => ({
    groups: [group('g', { order: 2 })],
    stats: [stat('a', { order: 0 }), stat('b', { order: 1 })],
  });

  it('nests a stat into the group above the drop when the drag goes one level right', () => {
    const { groups, stats } = base();
    const next = applyStatDrop(groups, stats, [], 'b', 'g', INDENT, INDENT);
    expect(next.stats.find((s) => s.id === 'b')?.groupId).toBe('g');
  });

  it('nests a group into another group the same way', () => {
    const next = applyStatDrop(
      [group('h', { order: 0 }), group('g', { order: 1 })], [], [], 'h', 'g', INDENT, INDENT,
    );
    expect(next.groups.find((g) => g.id === 'h')?.parentId).toBe('g');
  });

  it('returns the stats in the order the tree now draws them', () => {
    const { groups, stats } = base();
    const next = applyStatDrop(groups, stats, [], 'b', 'g', INDENT, INDENT);
    expect(ids(next.stats)).toEqual(['a', 'b']);
    const reordered = applyStatDrop(groups, stats, [], 'a', 'b', 0, INDENT);
    expect(ids(reordered.stats)).toEqual(['b', 'a']);
  });

  it('refuses to move a group into its own subtree', () => {
    const groups = [group('g', { order: 0 }), group('child', { parentId: 'g', order: 0 })];
    const next = applyStatDrop(groups, [], [], 'g', 'child', INDENT, INDENT);
    expect(next.groups.find((g) => g.id === 'g')?.parentId).toBeNull();
  });
});

describe('duplicateStatNode', () => {
  it('copies a stat right after its original with a fresh id, and keeps the list in tree order', () => {
    const stats = [stat('a', { order: 0 }), stat('b', { order: 1 })];
    const next = duplicateStatNode([], stats, 'a');
    expect(next.stats).toHaveLength(3);
    expect(next.stats[1].id).toBe(next.newId);
    expect(next.stats[1].name).toBe('a (Copy)');
    expect(next.stats[1].id).not.toBe('a');
  });

  it('copies a group with every stat and subgroup below it, each under a fresh id', () => {
    const groups = [group('g', { order: 0 }), group('sub', { parentId: 'g', order: 0 })];
    const stats = [stat('in-g', { groupId: 'g', order: 1 }), stat('in-sub', { groupId: 'sub', order: 0 })];
    const next = duplicateStatNode(groups, stats, 'g');
    expect(next.groups).toHaveLength(4);
    expect(next.stats).toHaveLength(4);
    const copy = next.groups.find((g) => g.id === next.newId);
    expect(copy?.name).toBe('g (Copy)');
    const copiedStats = next.stats.filter((s) => !['in-g', 'in-sub'].includes(s.id));
    expect(copiedStats).toHaveLength(2);
    // Every copied stat sits under a copied group, never under the original.
    const copiedGroupIds = new Set(next.groups.filter((g) => !['g', 'sub'].includes(g.id)).map((g) => g.id));
    expect(copiedStats.every((s) => copiedGroupIds.has(s.groupId ?? ''))).toBe(true);
  });
});

describe('removeStatGroup', () => {
  it('moves the group\'s stats and subgroups up to its parent', () => {
    const groups = [group('outer'), group('inner', { parentId: 'outer' }), group('leaf', { parentId: 'inner' })];
    const stats = [stat('a', { groupId: 'inner' })];
    const next = removeStatGroup(groups, stats, 'inner');
    expect(ids(next.groups)).toEqual(['outer', 'leaf']);
    expect(next.groups.find((g) => g.id === 'leaf')?.parentId).toBe('outer');
    expect(next.stats[0].groupId).toBe('outer');
  });

  it('puts what the group held in the group\'s own slot, numbers the parent anew and stores stats in tree order', () => {
    const groups = [group('g', { order: 1 })];
    const stats = [
      stat('first', { order: 0 }), stat('in-b', { groupId: 'g', order: 1 }), stat('in-a', { groupId: 'g', order: 0 }),
      stat('last', { order: 2 }),
    ];
    const next = removeStatGroup(groups, stats, 'g');
    expect(next.groups).toEqual([]);
    expect(ids(next.stats)).toEqual(['first', 'in-a', 'in-b', 'last']);
    expect(next.stats.map((s) => s.order)).toEqual([0, 1, 2, 3]);
    expect(next.stats.every((s) => s.groupId === null)).toBe(true);
  });

  it('numbers a parent group\'s items anew when an inner group goes', () => {
    const groups = [group('outer', { order: 0 }), group('inner', { parentId: 'outer', order: 0 })];
    const stats = [stat('a', { groupId: 'inner', order: 0 }), stat('b', { groupId: 'outer', order: 1 })];
    const next = removeStatGroup(groups, stats, 'inner');
    expect(ids(next.stats)).toEqual(['a', 'b']);
    expect(next.stats.map((s) => [s.groupId, s.order])).toEqual([['outer', 0], ['outer', 1]]);
  });

  it('keeps identity for an id it lacks', () => {
    const groups = [group('g')];
    const stats = [stat('a')];
    const next = removeStatGroup(groups, stats, 'nope');
    expect(next.groups).toBe(groups);
    expect(next.stats).toBe(stats);
  });
});

describe('statPanelLayout', () => {
  const groups = [group('body', { order: 0 }), group('mind', { order: 1 }), group('inner', { parentId: 'body', order: 0 })];
  const authored = [
    stat('vigor', { groupId: 'body', order: 1 }), stat('grit', { groupId: 'inner', order: 0 }),
    stat('calm', { groupId: 'mind', order: 0 }), stat('luck', { order: 2 }),
  ];
  const shape = (nodes: ReturnType<typeof statPanelLayout<Stat>>): unknown[] => nodes.map((n) => (
    n.kind === 'group' ? { [n.group.id]: shape(n.children) } : n.item.id
  ));

  it('nests the visible stats under their groups, as authored', () => {
    expect(shape(statPanelLayout(groups, authored, authored, (s) => s.id)))
      .toEqual([{ body: [{ inner: ['grit'] }, 'vigor'] }, { mind: ['calm'] }, 'luck']);
  });

  it('leaves out a group with nothing visible, below it as well', () => {
    const visible = authored.filter((s) => s.id === 'calm' || s.id === 'luck');
    expect(shape(statPanelLayout(groups, authored, visible, (s) => s.id))).toEqual([{ mind: ['calm'] }, 'luck']);
  });

  it('keeps a group that holds a visible stat only in a subgroup', () => {
    const visible = authored.filter((s) => s.id === 'grit');
    expect(shape(statPanelLayout(groups, authored, visible, (s) => s.id))).toEqual([{ body: [{ inner: ['grit'] }] }]);
  });

  it('places a live row by the authored stat, so a save\'s frozen copy follows a regrouping', () => {
    const frozen = [{ ...authored[2], groupId: undefined, order: undefined }];
    expect(shape(statPanelLayout(groups, authored, frozen, (s) => s.id))).toEqual([{ mind: ['calm'] }]);
  });

  it('puts a row the world no longer lists at the top level, after the grouped ones', () => {
    const removed = stat('old');
    expect(shape(statPanelLayout(groups, authored, [authored[2], removed], (s) => s.id))).toEqual([{ mind: ['calm'] }, 'old']);
  });

  it('is a plain list in authored order for a world with no groups', () => {
    const flat = [stat('a'), stat('b')];
    expect(shape(statPanelLayout([], flat, flat, (s) => s.id))).toEqual(['a', 'b']);
  });
});

describe('statPanelBlocks', () => {
  const groups = [
    group('body', { name: 'Body', order: 0 }), group('mind', { name: 'Mind', order: 1 }),
    group('inner', { name: 'Reflexes', parentId: 'body', order: 0 }),
  ];
  const authored = [
    stat('vigor', { groupId: 'body', order: 1 }), stat('grit', { groupId: 'inner', order: 0 }),
    stat('calm', { groupId: 'mind', order: 0 }), stat('luck', { order: 2 }),
  ];
  const blocks = (visible: Stat[]) => statPanelBlocks(statPanelLayout(groups, authored, visible, (s) => s.id))
    .map((b) => ({ path: b.path?.join(' › ') ?? null, ids: ids(b.items) }));

  it('puts ungrouped stats first, then each group\'s own stats before its subgroups, under full paths', () => {
    expect(blocks(authored)).toEqual([
      { path: null, ids: ['luck'] },
      { path: 'Body', ids: ['vigor'] },
      { path: 'Body › Reflexes', ids: ['grit'] },
      { path: 'Mind', ids: ['calm'] },
    ]);
  });

  it('gives a group with stats only in a subgroup no block of its own', () => {
    expect(blocks(authored.filter((s) => s.id === 'grit'))).toEqual([{ path: 'Body › Reflexes', ids: ['grit'] }]);
  });

  it('is one unnamed block for a world with no groups', () => {
    const flat = [stat('a'), stat('b')];
    expect(statPanelBlocks(statPanelLayout([], flat, flat, (s) => s.id)).map((b) => [b.path, ids(b.items)]))
      .toEqual([[null, ['a', 'b']]]);
  });
});

describe('newStatGroup and buildStatTree', () => {
  it('makes a top-level group that the tree reads as a node', () => {
    const made = newStatGroup('g', 3);
    expect(made).toMatchObject({ id: 'g', name: 'New Group', parentId: null, order: 3 });
    expect(buildStatTree([made], [])[0]).toMatchObject({ kind: 'group', id: 'g' });
  });
});
