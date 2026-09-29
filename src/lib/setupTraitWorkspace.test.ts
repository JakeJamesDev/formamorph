import { describe, expect, it } from 'vitest';
import { buildTraitWorkspace } from './setupTraitWorkspace';
import { bearerTraitTree, bearerGroupId } from './ownedTraitsInPlay';
import { isShown } from './traitEffects';
import type { Entity, Trait } from '@/types';

const trait = (id: string, groupId: string | null = null): Trait => ({ id, name: id, groupId, statChanges: [] });

describe('buildTraitWorkspace with entity nodes', () => {
  it("gives an entity node a page even when all its traits sit in its groups, and nests the groups under it", () => {
    const wolf: Entity = {
      id: 'wolf', name: 'Wolf',
      traitGroups: [{ id: 'temper', name: 'Temper', parentId: null, order: 0 }],
      traits: [trait('calm', 'temper')],
    };
    const tree = bearerTraitTree({ traits: [trait('brave')], traitGroups: [], entities: [wolf] }, undefined);
    const { categories, navigationGroups } = buildTraitWorkspace(tree.traits, tree.groups, new Set(tree.entityNodes.keys()));
    expect(categories.map((c) => [c.name, c.entityId ?? null, c.entityNode ?? false, c.traits.map((t) => t.id)])).toEqual([
      ['General', null, false, ['brave']],
      ['Wolf', 'wolf', true, []],
      ['Temper', 'wolf', false, ['calm']],
    ]);
    expect(navigationGroups.map((g) => [g.group.name, g.depth])).toEqual([['Wolf', 0], ['Temper', 1]]);
  });

  it("starts an entity's group path at its node, so a world group's description stays off its pages", () => {
    const ash: Entity = {
      id: 'ash', name: 'Ash', traitPlacement: { groupId: 'class', order: 1 },
      traitGroups: [{ id: 'bond', name: 'Bond', parentId: null, order: 1 }],
      traits: [trait('tamed'), trait('loyal', 'bond')],
    };
    const tree = bearerTraitTree({
      traits: [trait('paladin', 'class')],
      traitGroups: [{ id: 'class', name: 'Class', parentId: null, order: 0, playerDescription: 'Pick one class.' }],
      entities: [ash],
    }, undefined);
    const { categories } = buildTraitWorkspace(tree.traits, tree.groups, new Set(tree.entityNodes.keys()));
    expect(categories.map((c) => [c.name, c.path.map((g) => g.name)])).toEqual([
      ['Class', ['Class']],
      ['Ash', ['Ash']],
      ['Bond', ['Ash', 'Bond']],
    ]);
  });

  it('gives a linked group under an entity its own page in that entity, so two bearers of one group get two pages', () => {
    const classes = { id: 'classes', name: 'Classes', parentId: 'blueprints', order: 0 };
    const link = (id: string, order: number) => ({ id, originalId: 'classes', kind: 'group' as const, originalName: 'Classes', groupId: null, order });
    const tree = bearerTraitTree({
      traits: [trait('paladin', 'classes')],
      traitGroups: [{ id: 'blueprints', name: 'Blueprints', parentId: null, order: 0, system: 'blueprints' }, classes],
      entities: [{ id: 'ash', name: 'Ash', traitLinks: [link('l-ash', 0)] }, { id: 'bo', name: 'Bo', traitLinks: [link('l-bo', 0)] }],
    }, undefined);
    const { categories } = buildTraitWorkspace(tree.traits, tree.groups, new Set(tree.entityNodes.keys()));
    expect(categories.map((c) => [c.id, c.entityId ?? null, c.traits.map((t) => t.id)])).toEqual([
      ['ash', 'ash', []],
      [bearerGroupId('ash', 'classes'), 'ash', ['paladin']],
      ['bo', 'bo', []],
      [bearerGroupId('bo', 'classes'), 'bo', ['paladin']],
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

describe('buildTraitWorkspace with rows the player does not see', () => {
  const groups = [
    { id: 'class', name: 'Class', parentId: null, order: 0 },
    { id: 'secret', name: 'Secret', parentId: null, order: 1 },
    { id: 'omens', name: 'Omens', parentId: 'secret', order: 0 },
  ];
  const traits: Trait[] = [
    trait('paladin', 'class'),
    { ...trait('bond', 'class'), mode: 'hidden' },
    { ...trait('veil', 'secret'), mode: 'hidden' },
    { ...trait('curse', 'omens'), mode: 'alwaysOn', requires: [{ kind: 'trait', id: 'paladin' }] },
  ];
  const shows = (picks: string[]) => (t: Trait) => isShown(t, picks);

  it('drops a category holding only Hidden or dormant Always On traits, and keeps every trait in a shown one', () => {
    const { categories, navigationGroups } = buildTraitWorkspace(traits, groups, new Set(), shows(['bond', 'veil']));
    expect(categories.map((c) => [c.name, c.traits.map((t) => t.id)])).toEqual([['Class', ['paladin', 'bond']]]);
    expect(navigationGroups.map((g) => g.group.name)).toEqual(['Class']);
  });

  it('brings a category back once an Always On trait in it turns on', () => {
    const { categories } = buildTraitWorkspace(traits, groups, new Set(), shows(['paladin', 'curse', 'veil']));
    expect(categories.map((c) => c.name)).toEqual(['Class', 'Omens']);
  });

  it("reads an entity's rows under that entity's picks", () => {
    const wolf: Entity = {
      id: 'wolf', name: 'Wolf', traits: [{ ...trait('howl'), mode: 'alwaysOn', requires: [{ kind: 'trait', id: 'x' }] }],
    };
    const tree = bearerTraitTree({ traits: [], traitGroups: [], entities: [wolf] }, undefined);
    const build = (picks: Record<string, string[]>) => buildTraitWorkspace(
      tree.traits, tree.groups, new Set(tree.entityNodes.keys()), (t, entityId) => isShown(t, picks[entityId ?? 'world'] ?? []),
    ).categories.map((c) => c.name);
    expect(build({ world: ['howl'] })).toEqual([]);
    expect(build({ wolf: ['howl'] })).toEqual(['Wolf']);
  });
});
