import { describe, it, expect } from 'vitest';
import {
  buildTraitTree, isDescendantGroup, buildTraitContext,
  flattenTraitTree, removeChildrenOf, getTraitDropProjection, applyTraitDrop,
  duplicateTraitNode,
} from './traitTree';
import type { Trait, TraitGroup } from '@/types';

const group = (id: string, parentId: string | null, order: number): TraitGroup =>
  ({ id, name: id, parentId, order });
const trait = (id: string, groupId: string | null, order: number): Trait =>
  ({ id, name: id, statChanges: [], groupId, order });

describe('buildTraitTree', () => {
  it('nests groups and traits and orders siblings by `order`', () => {
    const groups = [group('world', null, 0), group('player', null, 1), group('clans', 'world', 0)];
    const traits = [
      trait('quick', 'player', 0),
      trait('storm', 'clans', 0),
      trait('loner', null, 2), // ungrouped, sorts after the two root groups
    ];
    const tree = buildTraitTree(groups, traits);
    expect(tree.map((n) => n.id)).toEqual(['world', 'player', 'loner']);
    const world = tree[0];
    expect(world.kind === 'group' && world.children.map((c) => c.id)).toEqual(['clans']);
    const clans = world.kind === 'group' ? world.children[0] : null;
    expect(clans && clans.kind === 'group' && clans.children.map((c) => c.id)).toEqual(['storm']);
  });

  it('falls back to array order when `order` is absent (legacy traits)', () => {
    const traits: Trait[] = [
      { id: 'a', name: 'a', statChanges: [] },
      { id: 'b', name: 'b', statChanges: [] },
    ];
    expect(buildTraitTree([], traits).map((n) => n.id)).toEqual(['a', 'b']);
  });
});

describe('isDescendantGroup', () => {
  const groups = [group('world', null, 0), group('clans', 'world', 0), group('player', null, 1)];
  it('detects a group nested under an ancestor (and itself)', () => {
    expect(isDescendantGroup(groups, 'world', 'clans')).toBe(true);
    expect(isDescendantGroup(groups, 'world', 'world')).toBe(true);
  });
  it('returns false for unrelated groups', () => {
    expect(isDescendantGroup(groups, 'player', 'clans')).toBe(false);
  });
});

describe('duplicateTraitNode', () => {
  it('copies a trait in place, right after the original in the same group', () => {
    const groups = [group('world', null, 0)];
    const traits = [trait('a', 'world', 0), trait('b', 'world', 1)];
    const { groups: g2, traits: t2, newId } = duplicateTraitNode(groups, traits, 'a');
    const order = flattenTraitTree(buildTraitTree(g2, t2)).map((n) => n.id);
    expect(order).toEqual(['world', 'a', newId, 'b']);
    const copy = t2.find((t) => t.id === newId)!;
    expect(copy.groupId).toBe('world');
    expect(copy.name).toBe('a (Copy)');
  });

  it('places the copy after the original even when items have no explicit order (legacy)', () => {
    const traits: Trait[] = [
      { id: 'a', name: 'a', statChanges: [] },
      { id: 'b', name: 'b', statChanges: [] },
    ];
    const { groups: g2, traits: t2, newId } = duplicateTraitNode([], traits, 'a');
    expect(flattenTraitTree(buildTraitTree(g2, t2)).map((n) => n.id)).toEqual(['a', newId, 'b']);
  });

  it('deep-copies a group subtree with fresh ids and remapped parents', () => {
    const groups = [group('world', null, 0), group('clans', 'world', 0)];
    const traits = [trait('storm', 'clans', 0), trait('loner', null, 1)];
    const { groups: g2, traits: t2, newId } = duplicateTraitNode(groups, traits, 'world');

    // Original tree intact + a sibling copy of `world` after it at root.
    const tree = buildTraitTree(g2, t2);
    expect(tree.map((n) => n.id)).toEqual(['world', newId, 'loner']);

    // The copied subgroup + trait are brand-new ids nested under the copied root, not the originals.
    const copyRoot = tree.find((n) => n.id === newId);
    const copySub = copyRoot?.kind === 'group' ? copyRoot.children[0] : null;
    expect(copySub && copySub.id).not.toBe('clans');
    expect(copySub?.kind === 'group' && copySub.children[0].id).not.toBe('storm');
    expect(g2.find((g) => g.id === newId)!.name).toBe('world (Copy)');
    // No id collisions: every group/trait id is unique.
    const ids = [...g2.map((g) => g.id), ...t2.map((t) => t.id)];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('does not mutate the input arrays and no-ops on an unknown id', () => {
    const groups = [group('world', null, 0)];
    const traits = [trait('a', 'world', 0)];
    const res = duplicateTraitNode(groups, traits, 'missing');
    expect(res.groups).toBe(groups);
    expect(res.traits).toBe(traits);
    duplicateTraitNode(groups, traits, 'a');
    expect(traits).toHaveLength(1); // original untouched
    expect(groups).toHaveLength(1);
  });
});

describe('flattenTraitTree', () => {
  it('tags each node with parent and depth, depth-first', () => {
    const groups = [group('world', null, 0)];
    const traits = [trait('a', 'world', 0), trait('b', null, 1)];
    const flat = flattenTraitTree(buildTraitTree(groups, traits));
    expect(flat.map((n) => [n.id, n.depth, n.parentId])).toEqual([
      ['world', 0, null],
      ['a', 1, 'world'],
      ['b', 0, null],
    ]);
  });
});

describe('removeChildrenOf', () => {
  it('drops the descendants of a collapsed group', () => {
    const flat = flattenTraitTree(buildTraitTree([group('world', null, 0)], [trait('a', 'world', 0)]));
    expect(removeChildrenOf(flat, ['world']).map((n) => n.id)).toEqual(['world']);
  });
});

describe('getTraitDropProjection', () => {
  it('nests under the group directly above the drop slot when dragged right', () => {
    const groups = [group('world', null, 0), group('player', null, 1)];
    const traits = [trait('t', null, 2)];
    const flat = flattenTraitTree(buildTraitTree(groups, traits));
    const proj = getTraitDropProjection(flat, 't', 'player', 30, 24); // +1 depth
    expect(proj).toEqual({ depth: 1, parentId: 'world' });
  });

  it('pulls back to the root (parent null) when dragged left', () => {
    const flat = flattenTraitTree(buildTraitTree([group('world', null, 0)], [trait('a', 'world', 0)]));
    const proj = getTraitDropProjection(flat, 'a', 'world', -30, 24);
    expect(proj).toEqual({ depth: 0, parentId: null });
  });
});

describe('applyTraitDrop', () => {
  it('re-parents and reindexes from a rightward drag', () => {
    const groups = [group('world', null, 0), group('player', null, 1)];
    const traits = [trait('t', null, 2)];
    const out = applyTraitDrop(groups, traits, [], 't', 'player', 30, 24);
    expect(out.traits.find((x) => x.id === 't')?.groupId).toBe('world');
    expect(out.traits.find((x) => x.id === 't')?.order).toBe(0);
    expect(out.groups.find((g) => g.id === 'player')?.order).toBe(1);
  });

  it('pulls a trait out of its group to the root', () => {
    const out = applyTraitDrop([group('world', null, 0)], [trait('a', 'world', 0)], [], 'a', 'world', -30, 24);
    expect(out.traits.find((x) => x.id === 'a')?.groupId).toBeNull();
  });

  it('refuses to nest a group into its own descendant', () => {
    const groups = [group('world', null, 0), group('clans', 'world', 0)];
    const out = applyTraitDrop(groups, [], [], 'world', 'clans', 30, 24);
    expect(out.groups).toBe(groups); // unchanged reference = no-op
  });
});

describe('buildTraitContext', () => {
  const groups = [
    { ...group('world', null, 0), name: 'World' },
    { ...group('player', null, 1), name: 'Player' },
  ];
  const traits: Trait[] = [
    { id: 'storm', name: 'Stormtouched', statChanges: [], groupId: 'world', aiDescription: 'lightning resistance', order: 0 },
    { id: 'quick', name: 'Quick', statChanges: [], groupId: 'player', aiDescription: '+2 reflexes', order: 0 },
    { id: 'loner', name: 'Loner', statChanges: [], groupId: null, order: 0 },
  ];

  it('emits group headers, AI descriptions, and ungrouped traits', () => {
    const withDesc = [{ ...groups[0], aiDescription: 'Born of the storm clans.' }, groups[1]];
    const out = buildTraitContext(['storm', 'quick', 'loner'], traits, withDesc);
    expect(out).toBe(
      'Loner\n' +
      'World:\n' +
      '  Born of the storm clans.\n' +
      '  - Stormtouched: lightning resistance\n' +
      'Player:\n' +
      '  - Quick: +2 reflexes',
    );
  });

  it('omits a blank group AI description and groups with no selected trait', () => {
    const out = buildTraitContext(['quick'], traits, groups);
    expect(out).toBe('Player:\n  - Quick: +2 reflexes');
  });

  it('returns an empty string when nothing is selected', () => {
    expect(buildTraitContext([], traits, groups)).toBe('');
  });
});
