import { describe, it, expect } from 'vitest';
import {
  SELF_ENTITY, adoptOwnedTraits, bindOwnedTraits, libraryOwnersInPlay, portableOwnedTraits, type TraitWorld,
} from './portableTraits';
import { gateStates } from './traitGates';
import { traitOwners } from './ownedTraits';
import type { Entity, Trait, TraitGroup, TraitRequirement } from '@/types';

const trait = (id: string, extra: Partial<Trait> = {}): Trait => ({ id, name: id, statChanges: [], ...extra });
const group = (id: string, name: string): TraitGroup => ({ id, name, parentId: null });

/** A persona whose owned traits point inside itself, at the world, and at itself as a persona. */
const ash = (requires: TraitRequirement[] = []): Entity => ({
  id: 'ash', name: 'Ash', persona: true,
  traitGroups: [group('g-bond', 'Bond')],
  traits: [
    trait('t-tamed', { name: 'Tamed', groupId: 'g-bond' }),
    trait('t-pack', { name: 'Pack Leader', requires: [{ kind: 'trait', id: 't-tamed' }, { kind: 'group', id: 'g-bond' }] }),
    trait('t-oath', { name: 'Oath', requires }),
  ],
});

const origin: TraitWorld = {
  traits: [trait('w-paladin', { name: 'Paladin' })],
  traitGroups: [group('w-class', 'Class')],
  entities: [{ id: 'aldric', name: 'Sir Aldric', persona: true }],
};

const OUTWARD: TraitRequirement[] = [
  { kind: 'trait', id: 'w-paladin' },
  { kind: 'group', id: 'w-class' },
  { kind: 'playingAs', id: 'aldric' },
  { kind: 'playingAs', id: 'ash' },
];

const oathOf = (e: Pick<Entity, 'traits'>) => e.traits!.find((t) => t.name === 'Oath')!.requires;

describe('portableOwnedTraits', () => {
  it('keeps inward requirements by id and names every outward one, playing-as included', () => {
    const out = portableOwnedTraits(ash(OUTWARD), origin);
    expect(out.traits!.find((t) => t.id === 't-pack')!.requires).toEqual([
      { kind: 'trait', id: 't-tamed' }, { kind: 'group', id: 'g-bond' },
    ]);
    expect(oathOf(out)).toEqual([
      { kind: 'trait', id: 'w-paladin', name: 'Paladin' },
      { kind: 'group', id: 'w-class', name: 'Class' },
      { kind: 'playingAs', id: 'aldric', name: 'Sir Aldric' },
      { kind: 'playingAs', id: SELF_ENTITY, name: 'Ash' },
    ]);
  });

  it("names a requirement on another entity's owned trait", () => {
    const world = { ...origin, entities: [{ id: 'wolf', name: 'Wolf', traits: [trait('w-loyal', { name: 'Loyal' })] }] };
    expect(oathOf(portableOwnedTraits(ash([{ kind: 'trait', id: 'w-loyal' }]), world))).toEqual([
      { kind: 'trait', id: 'w-loyal', name: 'Loyal' },
    ]);
  });

  it('keeps a stored name when the world no longer holds the target', () => {
    const out = portableOwnedTraits(ash([{ kind: 'trait', id: 'gone', name: 'Knight' }, { kind: 'trait', id: 'gone-2' }]), origin);
    expect(oathOf(out)).toEqual([{ kind: 'trait', id: 'gone', name: 'Knight' }, { kind: 'trait', id: 'gone-2' }]);
  });

  it('carries nothing for an entity with no owned traits', () => {
    expect(portableOwnedTraits({ id: 'e', name: 'E' }, origin)).toEqual({});
  });
});

/** The receiving world's traits, groups, and personas. */
const target = (extra: Partial<TraitWorld> = {}): TraitWorld => ({
  traits: [trait('n-paladin', { name: 'Paladin' })],
  traitGroups: [group('n-class', 'Class')],
  entities: [{ id: 'n-aldric', name: 'Sir Aldric', persona: true }],
  ...extra,
});

const carried = () => ({ ...ash(), ...portableOwnedTraits(ash(OUTWARD), origin), id: 'copy' });

describe('bindOwnedTraits', () => {
  it('rebinds each outward requirement to the one target carrying its name', () => {
    expect(oathOf(bindOwnedTraits(carried(), target()))).toEqual([
      { kind: 'trait', id: 'n-paladin', name: 'Paladin' },
      { kind: 'group', id: 'n-class', name: 'Class' },
      { kind: 'playingAs', id: 'n-aldric', name: 'Sir Aldric' },
      { kind: 'playingAs', id: 'copy', name: 'Ash' },
    ]);
  });

  it('keeps inward requirements on the entity itself', () => {
    const bound = bindOwnedTraits(carried(), target());
    expect(bound.traits!.find((t) => t.id === 't-pack')!.requires).toEqual([
      { kind: 'trait', id: 't-tamed' }, { kind: 'group', id: 'g-bond' },
    ]);
  });

  it('binds by id first, so a round trip home survives a rename', () => {
    const home = { ...origin, traits: [trait('w-paladin', { name: 'Holy Knight' })] };
    expect(oathOf(bindOwnedTraits(carried(), home))![0]).toEqual({ kind: 'trait', id: 'w-paladin', name: 'Paladin' });
  });

  it('leaves a requirement with no match unresolved, locked, and showing its stored name', () => {
    const bound = bindOwnedTraits(carried(), target({ traits: [], traitGroups: [], entities: [] }));
    expect(oathOf(bound)!.slice(0, 3)).toEqual([
      { kind: 'trait', id: '', name: 'Paladin' },
      { kind: 'group', id: '', name: 'Class' },
      { kind: 'playingAs', id: '', name: 'Sir Aldric' },
    ]);
    const gate = gateStates({
      owners: traitOwners({ traits: [], traitGroups: [], entities: [bound] }), active: {}, entities: [], persona: { source: 'none' },
    }).get('t-oath')!;
    expect(gate.unlocked).toBe(false);
    expect(gate.requirements.map((r) => r.text).slice(0, 3)).toEqual(['Paladin', 'any Class', 'playing as Sir Aldric']);
  });

  it('leaves a requirement whose name two targets carry unresolved', () => {
    const world = target({
      traits: [trait('a', { name: 'Paladin' })],
      entities: [
        { id: 'n-aldric', name: 'Sir Aldric', persona: true },
        { id: 'n-aldric-2', name: 'Sir Aldric', persona: true },
        { id: 'wolf', name: 'Wolf', traits: [trait('b', { name: 'Paladin' })] },
      ],
      traitGroups: [group('c1', 'Class'), group('c2', 'Class')],
    });
    expect(oathOf(bindOwnedTraits(carried(), world))!.slice(0, 3).map((r) => r.id)).toEqual(['', '', '']);
  });

  it('matches "playing as" against personas only', () => {
    const world = target({ entities: [{ id: 'n-aldric', name: 'Sir Aldric' }] });
    expect(oathOf(bindOwnedTraits(carried(), world))![2]).toEqual({ kind: 'playingAs', id: '', name: 'Sir Aldric' });
  });

  it('counts owned traits of the world entities as targets', () => {
    const world = target({ traits: [], entities: [{ id: 'wolf', name: 'Wolf', traits: [trait('wolf-paladin', { name: 'Paladin' })] }] });
    expect(oathOf(bindOwnedTraits(carried(), world))![0].id).toBe('wolf-paladin');
  });

  it('returns an entity that owns nothing unchanged', () => {
    const plain: Entity = { id: 'e', name: 'E' };
    expect(bindOwnedTraits(plain, target())).toBe(plain);
  });
});

describe('libraryOwnersInPlay', () => {
  it('binds the library persona, then the added characters, to the world', () => {
    const persona = carried();
    const wolf: Entity = { id: 'wolf', name: 'Wolf', traits: [trait('w-loyal', { requires: [{ kind: 'trait', id: 'x', name: 'Paladin' }] })] };
    const owners = libraryOwnersInPlay(target(), persona, [wolf]);
    expect(owners.map((e) => e.id)).toEqual(['copy', 'wolf']);
    expect(oathOf(owners[0])![0].id).toBe('n-paladin');
    expect(owners[1].traits![0].requires).toEqual([{ kind: 'trait', id: 'n-paladin', name: 'Paladin' }]);
    expect(libraryOwnersInPlay(target(), null, [])).toEqual([]);
  });
});

describe('adoptOwnedTraits', () => {
  it('keeps the carried ids when the world holds none of them', () => {
    const adopted = adoptOwnedTraits(carried(), target());
    expect(adopted.traits!.map((t) => t.id)).toEqual(['t-tamed', 't-pack', 't-oath']);
  });

  it('gives fresh ids when one collides with the world, and inward requirements follow', () => {
    const world = target({ entities: [...target().entities, { id: 'twin', name: 'Ash', traits: [trait('t-tamed', { name: 'Tamed' })] }] });
    const adopted = adoptOwnedTraits(carried(), world);
    const ids = new Set([...adopted.traits!, ...adopted.traitGroups!].map((i) => i.id));
    for (const old of ['t-tamed', 't-pack', 't-oath', 'g-bond']) expect(ids.has(old)).toBe(false);
    const tamed = adopted.traits!.find((t) => t.name === 'Tamed')!;
    const bond = adopted.traitGroups![0];
    expect(tamed.groupId).toBe(bond.id);
    expect(adopted.traits!.find((t) => t.name === 'Pack Leader')!.requires).toEqual([
      { kind: 'trait', id: tamed.id }, { kind: 'group', id: bond.id },
    ]);
    expect(oathOf(adopted)![3]).toEqual({ kind: 'playingAs', id: 'copy', name: 'Ash' });
  });

  it('ignores the copy itself when looking for collisions', () => {
    const copy = carried();
    const adopted = adoptOwnedTraits(copy, target({ entities: [...target().entities, copy] }));
    expect(adopted.traits!.map((t) => t.id)).toEqual(['t-tamed', 't-pack', 't-oath']);
  });
});
