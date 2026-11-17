import { describe, expect, it } from 'vitest';
import { buildTraitWorkspace, subtreeRollup } from './setupTraitWorkspace';
import { ownerTraitTree, ownerGroupId } from './ownedTraitsInPlay';
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
    const tree = ownerTraitTree({ traits: [trait('brave')], traitGroups: [], entities: [wolf] }, undefined);
    const { categories, navigationNodes } = buildTraitWorkspace(tree.traits, tree.groups, new Set(tree.entityNodes.keys()));
    expect(categories.map((c) => [c.name, c.entityId ?? null, c.entityNode ?? false, c.traits.map((t) => t.id)])).toEqual([
      ['General', null, false, ['brave']],
      ['Wolf', 'wolf', true, []],
      ['Temper', 'wolf', false, ['calm']],
    ]);
    expect(navigationNodes.map((g) => [g.group.name, g.depth])).toEqual([['Wolf', 0], ['Temper', 1]]);
  });

  it("starts an entity's group path at its node, so a world group's description stays off its pages", () => {
    const ash: Entity = {
      id: 'ash', name: 'Ash', traitPlacement: { groupId: 'class', order: 1 },
      traitGroups: [{ id: 'bond', name: 'Bond', parentId: null, order: 1 }],
      traits: [trait('tamed'), trait('loyal', 'bond')],
    };
    const tree = ownerTraitTree({
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

  it('gives a linked group under an entity its own page in that entity, so two owners of one group get two pages', () => {
    const classes = { id: 'classes', name: 'Classes', parentId: 'blueprints', order: 0 };
    const link = (id: string, order: number) => ({ id, originalId: 'classes', kind: 'group' as const, originalName: 'Classes', groupId: null, order });
    const tree = ownerTraitTree({
      traits: [trait('paladin', 'classes')],
      traitGroups: [{ id: 'blueprints', name: 'Blueprints', parentId: null, order: 0, system: 'blueprints' }, classes],
      entities: [{ id: 'ash', name: 'Ash', traitLinks: [link('l-ash', 0)] }, { id: 'bo', name: 'Bo', traitLinks: [link('l-bo', 0)] }],
    }, undefined);
    const { categories } = buildTraitWorkspace(tree.traits, tree.groups, new Set(tree.entityNodes.keys()));
    expect(categories.map((c) => [c.id, c.entityId ?? null, c.traits.map((t) => t.id)])).toEqual([
      ['ash', 'ash', []],
      [ownerGroupId('ash', 'classes'), 'ash', ['paladin']],
      ['bo', 'bo', []],
      [ownerGroupId('bo', 'classes'), 'bo', ['paladin']],
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
    { ...trait('curse', 'omens'), mode: 'alwaysOn', requires: [{ all: [{ kind: 'trait', id: 'paladin' }] }] },
  ];
  const shows = (picks: string[]) => (t: Trait) => isShown(t, picks);

  it('drops a category holding only Hidden or dormant Always On traits, and keeps every trait in a shown one', () => {
    const { categories, navigationNodes } = buildTraitWorkspace(traits, groups, new Set(), shows(['bond', 'veil']));
    expect(categories.map((c) => [c.name, c.traits.map((t) => t.id)])).toEqual([['Class', ['paladin', 'bond']]]);
    expect(navigationNodes.map((g) => g.group.name)).toEqual(['Class']);
  });

  it('brings a category back once an Always On trait in it turns on', () => {
    const { categories } = buildTraitWorkspace(traits, groups, new Set(), shows(['paladin', 'curse', 'veil']));
    expect(categories.map((c) => c.name)).toEqual(['Class', 'Omens']);
  });

  it("reads an entity's rows under that entity's picks", () => {
    const wolf: Entity = {
      id: 'wolf', name: 'Wolf', traits: [{ ...trait('howl'), mode: 'alwaysOn', requires: [{ all: [{ kind: 'trait', id: 'x' }] }] }],
    };
    const tree = ownerTraitTree({ traits: [], traitGroups: [], entities: [wolf] }, undefined);
    const build = (picks: Record<string, string[]>) => buildTraitWorkspace(
      tree.traits, tree.groups, new Set(tree.entityNodes.keys()), (t, entityId) => isShown(t, picks[entityId ?? 'world'] ?? []),
    ).categories.map((c) => c.name);
    expect(build({ world: ['howl'] })).toEqual([]);
    expect(build({ wolf: ['howl'] })).toEqual(['Wolf']);
  });
});

describe('buildTraitWorkspace nav nodes', () => {
  // Martial holds only groups; Arms holds traits and a child; Origin is a lone leaf. Authored order is reversed on input.
  const groups = [
    { id: 'origin', name: 'Origin', parentId: null, order: 1 },
    { id: 'martial', name: 'Martial', parentId: null, order: 0 },
    { id: 'style', name: 'Weapon Style', parentId: 'arms', order: 0 },
    { id: 'arms', name: 'Arms', parentId: 'martial', order: 1 },
    { id: 'stance', name: 'Stance', parentId: 'martial', order: 0 },
  ];
  const traits = [trait('sword', 'arms'), trait('dual', 'style'), trait('low', 'stance'), trait('north', 'origin')];
  const workspace = buildTraitWorkspace(traits, groups);
  const node = (name: string) => workspace.navigationNodes.find((n) => n.group.name === name)!;
  const subtreeNames = (name: string) => node(name).subtree.map((i) => workspace.categories[i].name);

  it('lists nodes in authored preorder with their depth, children and ancestors', () => {
    expect(workspace.navigationNodes.map((n) => [n.group.name, n.depth, n.hasChildren, n.ancestorIds])).toEqual([
      ['Martial', 0, true, []],
      ['Stance', 1, false, ['martial']],
      ['Arms', 1, true, ['martial']],
      ['Weapon Style', 2, false, ['martial', 'arms']],
      ['Origin', 0, false, []],
    ]);
  });

  it("gives a label-only group a node with no category of its own and a subtree of its descendants' categories", () => {
    expect(node('Martial').categoryIndex).toBe(-1);
    expect(subtreeNames('Martial')).toEqual(['Stance', 'Arms', 'Weapon Style']);
  });

  it('starts a subtree with its own category, then its descendants in authored order', () => {
    expect(subtreeNames('Arms')).toEqual(['Arms', 'Weapon Style']);
    expect(subtreeNames('Origin')).toEqual(['Origin']);
  });

  it('gives an entity node a subtree of its own page and every group under it', () => {
    const wolf: Entity = {
      id: 'wolf', name: 'Wolf',
      traitGroups: [{ id: 'temper', name: 'Temper', parentId: null, order: 0 }],
      traits: [trait('calm', 'temper')],
    };
    const tree = ownerTraitTree({ traits: [], traitGroups: [], entities: [wolf] }, undefined);
    const built = buildTraitWorkspace(tree.traits, tree.groups, new Set(tree.entityNodes.keys()));
    const wolfNode = built.navigationNodes.find((n) => n.group.name === 'Wolf')!;
    expect(wolfNode.hasChildren).toBe(true);
    expect(wolfNode.subtree.map((i) => built.categories[i].name)).toEqual(['Wolf', 'Temper']);
  });
});

describe('subtreeRollup', () => {
  const groups = [
    { id: 'martial', name: 'Martial', parentId: null, order: 0 },
    { id: 'arms', name: 'Arms', parentId: 'martial', order: 0, minPicks: 1 },
    { id: 'stance', name: 'Stance', parentId: 'martial', order: 1 },
  ];
  const traits: Trait[] = [
    trait('sword', 'arms'), trait('axe', 'arms'), { ...trait('secret', 'arms'), mode: 'hidden' },
    trait('low', 'stance'), trait('high', 'stance'),
  ];
  const { categories, navigationNodes } = buildTraitWorkspace(traits, groups);
  const martial = navigationNodes.find((n) => n.group.id === 'martial')!;
  const arms = navigationNodes.find((n) => n.group.id === 'arms')!;
  const rollup = (picks: string[], subtree = martial.subtree) => subtreeRollup(categories, subtree, () => picks);

  it('sums shown and selected traits over the subtree, leaving unseen traits out', () => {
    expect(rollup(['low'])).toEqual({ shown: 4, selected: 1, short: true });
  });

  it('marks the subtree short while any group in it is below its minimum, and clears once picks meet it', () => {
    expect(rollup(['low']).short).toBe(true);
    expect(rollup(['low', 'sword'])).toEqual({ shown: 4, selected: 2, short: false });
  });

  it('counts a leaf alone', () => {
    expect(rollup(['sword'], arms.subtree)).toEqual({ shown: 2, selected: 1, short: false });
  });

  it("reads each category's picks under its own owner", () => {
    const wolf: Entity = {
      id: 'wolf', name: 'Wolf',
      traitGroups: [{ id: 'temper', name: 'Temper', parentId: null, order: 0, minPicks: 1 }],
      traits: [trait('calm', 'temper')],
    };
    const tree = ownerTraitTree({ traits: [], traitGroups: [], entities: [wolf] }, undefined);
    const built = buildTraitWorkspace(tree.traits, tree.groups, new Set(tree.entityNodes.keys()));
    const wolfNode = built.navigationNodes.find((n) => n.group.name === 'Wolf')!;
    const picks = (entityId: string | undefined) => (entityId === 'wolf' ? ['calm'] : []);
    expect(subtreeRollup(built.categories, wolfNode.subtree, picks)).toEqual({ shown: 1, selected: 1, short: false });
  });
});
