import { describe, it, expect } from 'vitest';
import { buildTraitTree, isDescendantGroup, flattenGroups, moveNode, buildTraitContext } from './traitTree';
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

describe('flattenGroups', () => {
  it('yields every group depth-first', () => {
    const groups = [group('world', null, 0), group('clans', 'world', 0), group('player', null, 1)];
    const tree = buildTraitTree(groups, []);
    expect(flattenGroups(tree).map((g) => g.id)).toEqual(['world', 'clans', 'player']);
  });
});

describe('moveNode', () => {
  it('moves a trait into a group and reindexes siblings', () => {
    const groups = [group('world', null, 0)];
    const traits = [trait('a', null, 0), trait('b', null, 1)];
    const out = moveNode(groups, traits, 'a', 'world', null);
    expect(out.traits.find((t) => t.id === 'a')?.groupId).toBe('world');
    // 'a' is the sole child of 'world' → order 0
    expect(out.traits.find((t) => t.id === 'a')?.order).toBe(0);
  });

  it('reorders within a parent by inserting before a sibling', () => {
    const traits = [trait('a', null, 0), trait('b', null, 1), trait('c', null, 2)];
    const out = moveNode([], traits, 'c', null, 'a'); // move c before a
    const ordered = [...out.traits].sort((x, y) => (x.order ?? 0) - (y.order ?? 0)).map((t) => t.id);
    expect(ordered).toEqual(['c', 'a', 'b']);
  });

  it('nests a group under another group', () => {
    const groups = [group('world', null, 0), group('clans', null, 1)];
    const out = moveNode(groups, [], 'clans', 'world', null);
    expect(out.groups.find((g) => g.id === 'clans')?.parentId).toBe('world');
  });

  it('refuses to move a group into its own descendant', () => {
    const groups = [group('world', null, 0), group('clans', 'world', 0)];
    const out = moveNode(groups, [], 'world', 'clans', null);
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
