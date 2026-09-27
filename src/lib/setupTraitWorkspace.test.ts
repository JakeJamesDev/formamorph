import { describe, expect, it } from 'vitest';
import { buildTraitWorkspace } from './setupTraitWorkspace';
import { ownedTraitTree } from './traitTree';
import type { Entity, Trait } from '@/types';

const trait = (id: string, groupId: string | null = null): Trait => ({ id, name: id, groupId, statChanges: [] });

describe('buildTraitWorkspace with entity nodes', () => {
  it("gives an entity node a page even when all its traits sit in its groups, and nests the groups under it", () => {
    const wolf: Entity = {
      id: 'wolf', name: 'Wolf',
      traitGroups: [{ id: 'temper', name: 'Temper', parentId: null, order: 0 }],
      traits: [trait('calm', 'temper')],
    };
    const tree = ownedTraitTree({ traits: [trait('brave')], traitGroups: [] }, [wolf]);
    const { categories, navigationGroups } = buildTraitWorkspace(tree.traits, tree.groups, new Set(tree.entityNodes.keys()));
    expect(categories.map((c) => [c.name, c.entityId ?? null, c.traits.map((t) => t.id)])).toEqual([
      ['General', null, ['brave']],
      ['Wolf', 'wolf', []],
      ['Temper', null, ['calm']],
    ]);
    expect(navigationGroups.map((g) => [g.group.name, g.depth])).toEqual([['Wolf', 0], ['Temper', 1]]);
  });

  it("starts an entity's group path at its node, so a world group's description stays off its pages", () => {
    const ash: Entity = {
      id: 'ash', name: 'Ash', traitPlacement: { groupId: 'class', order: 1 },
      traitGroups: [{ id: 'bond', name: 'Bond', parentId: null, order: 1 }],
      traits: [trait('tamed'), trait('loyal', 'bond')],
    };
    const tree = ownedTraitTree({
      traits: [trait('paladin', 'class')],
      traitGroups: [{ id: 'class', name: 'Class', parentId: null, order: 0, playerDescription: 'Pick one class.' }],
    }, [ash]);
    const { categories } = buildTraitWorkspace(tree.traits, tree.groups, new Set(tree.entityNodes.keys()));
    expect(categories.map((c) => [c.name, c.path.map((g) => g.name)])).toEqual([
      ['Class', ['Class']],
      ['Ash', ['Ash']],
      ['Bond', ['Ash', 'Bond']],
    ]);
  });

  it('leaves a world group with no traits of its own without a page', () => {
    const { categories } = buildTraitWorkspace([trait('a', 'inner')], [
      { id: 'outer', name: 'Outer', parentId: null, order: 0 },
      { id: 'inner', name: 'Inner', parentId: 'outer', order: 0 },
    ]);
    expect(categories.map((c) => c.name)).toEqual(['Inner']);
  });
});
