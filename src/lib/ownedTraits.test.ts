import { describe, it, expect } from 'vitest';
import {
  addOwnedGroup, addOwnedTrait, findOwnedItem, removeOwnedItem, remintOwnedTraits, updateOwnedGroup,
  traitOwners, updateOwnedTrait,
} from './ownedTraits';
import { gateOf, gateStates } from './traitGates';
import type { Entity, Trait, TraitGroup } from '@/types';

const trait = (id: string, extra: Partial<Trait> = {}): Trait => ({ id, name: id, statChanges: [], ...extra });

const ash = (extra: Partial<Entity> = {}): Entity => ({
  id: 'ash', name: 'Ash',
  traitGroups: [{ id: 'g-bond', name: 'Bond', parentId: null, maxPicks: 1 }],
  traits: [
    trait('t-tamed', { name: 'Tamed', groupId: 'g-bond' }),
    trait('t-wild', { name: 'Wild', groupId: 'g-bond' }),
    trait('t-pack', { name: 'Pack Leader', requires: [{ kind: 'trait', id: 't-tamed' }] }),
  ],
  ...extra,
});

describe('owned trait edits', () => {
  it('adds the first trait at the entity root with no stat effects', () => {
    const next = addOwnedTrait({ id: 'wolf', name: 'Wolf' }, 'new');
    expect(next.traits).toEqual([expect.objectContaining({ id: 'new', groupId: null, statChanges: [], order: 0 })]);
    expect(next.traits?.[0].statToggles).toBeUndefined();
  });

  it('orders a new trait or group after the root items already there', () => {
    const withTrait = addOwnedTrait(ash(), 'new');
    expect(withTrait.traits?.find((t) => t.id === 'new')?.order).toBe(2);
    const withGroup = addOwnedGroup(withTrait, 'g-new');
    expect(withGroup.traitGroups?.find((g) => g.id === 'g-new')).toMatchObject({ parentId: null, order: 3 });
  });

  it('counts the links at the entity root when it orders a new item, and takes a name', () => {
    const linked = ash({ traitLinks: [{ id: 'l1', originalId: 't-paladin', kind: 'trait', originalName: 'Paladin', groupId: null, order: 2 }] });
    expect(addOwnedTrait(linked, 'new', 'Oath').traits?.find((t) => t.id === 'new')).toMatchObject({ name: 'Oath', order: 3 });
    expect(addOwnedGroup(linked, 'g-new', 'Vows').traitGroups?.find((g) => g.id === 'g-new')).toMatchObject({ name: 'Vows', order: 3 });
  });

  it('replaces one trait or group by id and leaves the rest', () => {
    const renamed = updateOwnedTrait(ash(), trait('t-wild', { name: 'Feral', groupId: 'g-bond' }));
    expect(renamed.traits?.map((t) => t.name)).toEqual(['Tamed', 'Feral', 'Pack Leader']);
    const regrouped = updateOwnedGroup(ash(), { id: 'g-bond', name: 'Temper', parentId: null });
    expect(regrouped.traitGroups).toEqual([{ id: 'g-bond', name: 'Temper', parentId: null }]);
  });

  it('removing a group moves its traits up to its parent, as a world group does', () => {
    const next = removeOwnedItem(ash(), 'g-bond');
    expect(next.traitGroups).toBeUndefined();
    expect(next.traits?.find((t) => t.id === 't-tamed')?.groupId).toBeNull();
  });

  it('removing the last trait leaves the entity owning nothing', () => {
    const next = removeOwnedItem({ id: 'wolf', name: 'Wolf', traits: [trait('only')] }, 'only');
    expect(next.traits).toBeUndefined();
  });

  it('finds an owned trait or group with its owner', () => {
    const entities = [{ id: 'npc', name: 'Npc' }, ash()];
    expect(findOwnedItem(entities, 't-pack')).toMatchObject({ entity: { id: 'ash' }, trait: { name: 'Pack Leader' } });
    expect(findOwnedItem(entities, 'g-bond')).toMatchObject({ entity: { id: 'ash' }, group: { name: 'Bond' } });
    expect(findOwnedItem(entities, 't-paladin')).toBeNull();
  });
});

describe('remintOwnedTraits', () => {
  it('gives every owned trait and group a fresh id, keeping the tree and inward requirements', () => {
    const source = ash({ traits: [...ash().traits!, trait('t-oath', { requires: [{ kind: 'trait', id: 't-paladin' }] })] });
    const copy = remintOwnedTraits(source);
    const ids = [...copy.traits!.map((t) => t.id), ...copy.traitGroups!.map((g) => g.id)];
    expect(ids.some((id) => ['t-tamed', 't-wild', 't-pack', 't-oath', 'g-bond'].includes(id))).toBe(false);

    const byName = (name: string) => copy.traits!.find((t) => t.name === name)!;
    expect(byName('Tamed').groupId).toBe(copy.traitGroups![0].id);
    expect(byName('Pack Leader').requires).toEqual([{ kind: 'trait', id: byName('Tamed').id }]);
    // A requirement pointing out of the entity keeps its target.
    expect(byName('t-oath').requires).toEqual([{ kind: 'trait', id: 't-paladin' }]);
  });

  it('remaps an inward group requirement too', () => {
    const source = ash({ traits: [trait('t-x', { requires: [{ kind: 'group', id: 'g-bond' }] })] });
    const copy = remintOwnedTraits(source);
    expect(copy.traits![0].requires).toEqual([{ kind: 'group', id: copy.traitGroups![0].id }]);
  });

  it('points a "playing as" the source requirement at the copy, and leaves other personas alone', () => {
    const source = ash({ traits: [trait('t-self', { requires: [{ kind: 'playingAs', id: 'ash' }, { kind: 'playingAs', id: 'aldric' }] })] });
    const copy = remintOwnedTraits({ ...source, id: 'ash-copy' }, new Map([['ash', 'ash-copy']]));
    expect(copy.traits![0].requires).toEqual([{ kind: 'playingAs', id: 'ash-copy' }, { kind: 'playingAs', id: 'aldric' }]);
  });

  it('leaves an entity that owns nothing as it is', () => {
    const plain: Entity = { id: 'npc', name: 'Npc' };
    expect(remintOwnedTraits(plain)).toBe(plain);
  });
});

describe('traitOwners', () => {
  const companions: TraitGroup[] = [
    { id: 'g-allies', name: 'Allies', parentId: null },
    { id: 'g-companions', name: 'Companions', parentId: 'g-allies' },
  ];
  const keeper = trait('t-keeper', { name: 'Keeper', requires: [{ kind: 'group', id: 'g-allies' }] });
  // Playing Ash, so Ash's active traits are the player's own and can meet the world's group requirement.
  const unlocked = (entity: Entity) => gateOf(gateStates({
    owners: traitOwners({ traits: [keeper], traitGroups: companions, entities: [entity] }),
    active: { ash: ['t-tamed'] }, entities: [], persona: { source: 'world', entityId: 'ash' },
  }), 'world', 't-keeper')?.unlocked;

  it('counts the traits of an entity node placed inside a group, at any depth, toward that group', () => {
    expect(unlocked(ash({ traitPlacement: { groupId: 'g-companions', order: 0 } }))).toBe(true);
  });

  it('counts no traits of an entity node at the top level, or placed in a group that is gone', () => {
    expect(unlocked(ash())).toBe(false);
    expect(unlocked(ash({ traitPlacement: { groupId: null, order: 0 } }))).toBe(false);
    expect(unlocked(ash({ traitPlacement: { groupId: 'g-deleted', order: 0 } }))).toBe(false);
  });
});
