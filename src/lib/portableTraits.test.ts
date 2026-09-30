import { describe, it, expect } from 'vitest';
import {
  SELF_ENTITY, adoptOwnedTraits, bindOwnedTraits, comparableOwnedTraits, portableOwnedTraits, type TraitWorld,
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
    }).get(bound.id)!.get('t-oath')!;
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

  it('keeps a "playing as" id only when it names a persona', () => {
    const world = target({ entities: [{ id: 'aldric', name: 'Sir Aldric' }] });
    expect(oathOf(bindOwnedTraits(carried(), world))![2]).toEqual({ kind: 'playingAs', id: '', name: 'Sir Aldric' });
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

  it('keeps every requirement of an entity written before names were stored, when the world holds its targets', () => {
    const legacy: Entity = { ...ash([{ kind: 'trait', id: 'n-paladin' }, { kind: 'group', id: 'n-class' }]), id: 'copy' };
    const adopted = adoptOwnedTraits(legacy, target());
    expect(adopted.traits).toEqual(legacy.traits);
    const plain: Entity = { id: 'e', name: 'E' };
    expect(adoptOwnedTraits(plain, target())).toBe(plain);
  });

  it('gives fresh link ids when a second copy of a links-only entity joins', () => {
    const first: Entity = { id: 'e1', name: 'E', traitLinks: mira().traitLinks };
    const adopted = adoptOwnedTraits({ ...first, id: 'e2' }, { ...linkOrigin, entities: [first] });
    expect(adopted.traitLinks!.map((l) => l.id)).not.toContain('l-class');
    expect(adopted.traitLinks!.map((l) => l.originalId)).toEqual(['w-class', 'w-smite']);
  });

  it('ignores the copy itself when looking for collisions', () => {
    const copy = carried();
    const adopted = adoptOwnedTraits(copy, target({ entities: [...target().entities, copy] }));
    expect(adopted.traits!.map((t) => t.id)).toEqual(['t-tamed', 't-pack', 't-oath']);
  });
});

/** A world whose Blueprints hold a Class group of two classes and a Smite, and Albus. */
const linkOrigin: TraitWorld = {
  traits: [
    trait('w-paladin', { name: 'Paladin', groupId: 'w-class' }),
    trait('w-wizard', { name: 'Wizard', groupId: 'w-class' }),
    trait('w-smite', { name: 'Smite', groupId: 'w-blueprints' }),
  ],
  traitGroups: [{ ...group('w-blueprints', 'Blueprints'), system: 'blueprints' }, { ...group('w-class', 'Class'), parentId: 'w-blueprints' }],
  entities: [{ id: 'albus', name: 'Albus' }],
};

/** What Mira's Class link overrides on Paladin: default-on, and its pins aimed at the Garb blueprint. */
const paladinOverrides = {
  isDefault: { value: true, blueprint: false },
  placeholderPins: { value: [{ placeholderId: 'garb', value: 'plate' }], blueprint: [] },
};
const smiteOverrides = { playerToggle: { value: true, blueprint: false } };

/** A persona that links Class with Paladin on and a pinned garb, links Smite as a toggle, and owns a vow gated on bearers. */
const mira = (): Entity => ({
  id: 'mira', name: 'Mira', persona: true,
  traits: [trait('t-vow', { name: 'Vow', requires: [
    { kind: 'trait', id: 'w-smite', bearer: { kind: 'entity', id: 'albus' } },
    { kind: 'trait', id: 'w-smite', bearer: { kind: 'you' } },
    { kind: 'trait', id: 'w-smite', bearer: { kind: 'entity', id: 'mira' } },
  ] })],
  traitLinks: [
    {
      id: 'l-class', originalId: 'w-class', kind: 'group', originalName: 'Class', groupId: null, order: 1,
      overrides: { 'w-paladin': paladinOverrides },
    },
    { id: 'l-smite', originalId: 'w-smite', kind: 'trait', originalName: 'Old Smite', groupId: null, order: 2, overrides: { 'w-smite': smiteOverrides } },
  ],
});

const linkOf = (e: Pick<Entity, 'traitLinks'>, id: string) => e.traitLinks?.find((l) => l.id === id);
const vowOf = (e: Pick<Entity, 'traits'>) => e.traits!.find((t) => t.id === 't-vow')!.requires!;

describe('portableOwnedTraits with links', () => {
  it("names each link's original, and each child its per-link data keys", () => {
    const out = portableOwnedTraits(mira(), linkOrigin);
    expect(out.traitLinks).toEqual([
      { ...linkOf(mira(), 'l-class'), keyNames: { 'w-paladin': 'Paladin' } },
      { ...linkOf(mira(), 'l-smite'), originalName: 'Smite' },
    ]);
  });

  it('names a named-scope bearer, and the entity itself as SELF_ENTITY', () => {
    expect(vowOf(portableOwnedTraits(mira(), linkOrigin)).map((r) => r.kind !== 'playingAs' && r.bearer)).toEqual([
      { kind: 'entity', id: 'albus', name: 'Albus' },
      { kind: 'you' },
      { kind: 'entity', id: SELF_ENTITY, name: 'Mira' },
    ]);
  });

  it('keeps stored names without a world', () => {
    const out = portableOwnedTraits(mira());
    expect(linkOf(out, 'l-smite')!.originalName).toBe('Old Smite');
    expect(vowOf(out)[0]).toEqual({ kind: 'trait', id: 'w-smite', bearer: { kind: 'entity', id: 'albus' } });
  });

  it('carries the links of an entity that owns nothing', () => {
    const linksOnly: Entity = { id: 'e', name: 'E', traitLinks: mira().traitLinks };
    expect(portableOwnedTraits(linksOnly, linkOrigin).traitLinks).toHaveLength(2);
  });
});

/** The receiving world: the same names under new ids, and its own Albus. */
const linkTarget = (extra: Partial<TraitWorld> = {}): TraitWorld => ({
  traits: [
    trait('n-paladin', { name: 'Paladin', groupId: 'n-class' }),
    trait('n-smite', { name: 'Smite', groupId: 'n-blueprints' }),
  ],
  traitGroups: [{ ...group('n-blueprints', 'Blueprints'), system: 'blueprints' }, { ...group('n-class', 'Class'), parentId: 'n-blueprints' }],
  entities: [{ id: 'n-albus', name: 'Albus' }],
  ...extra,
});

const carriedMira = () => ({ ...mira(), ...portableOwnedTraits(mira(), linkOrigin), id: 'copy' });

describe('bindOwnedTraits with links', () => {
  it('binds by id first, so a trip home keeps every key and drops the names map', () => {
    const bound = bindOwnedTraits(carriedMira(), linkOrigin);
    expect(bound.traitLinks).toEqual([linkOf(mira(), 'l-class'), { ...linkOf(mira(), 'l-smite'), originalName: 'Smite' }]);
  });

  it('keeps a key by id at home after its trait is renamed', () => {
    const renamed = { ...linkOrigin, traits: linkOrigin.traits.map((t) => (t.id === 'w-paladin' ? { ...t, name: 'Holy Knight' } : t)) };
    expect(linkOf(bindOwnedTraits(carriedMira(), renamed), 'l-class')!.overrides).toEqual({ 'w-paladin': paladinOverrides });
  });

  it('rebinds by unique name, with each key following its child by name', () => {
    const bound = bindOwnedTraits(carriedMira(), linkTarget());
    expect(linkOf(bound, 'l-class')).toEqual({
      id: 'l-class', originalId: 'n-class', kind: 'group', originalName: 'Class', groupId: null, order: 1,
      overrides: { 'n-paladin': paladinOverrides },
    });
    expect(linkOf(bound, 'l-smite')).toMatchObject({ originalId: 'n-smite', overrides: { 'n-smite': smiteOverrides } });
  });

  it('drops a key whose child the rebound original does not hold', () => {
    const world = linkTarget({ traits: [trait('n-cleric', { name: 'Cleric', groupId: 'n-class' }), trait('n-smite', { name: 'Smite', groupId: 'n-blueprints' })] });
    const cls = linkOf(bindOwnedTraits(carriedMira(), world), 'l-class')!;
    expect(cls.originalId).toBe('n-class');
    expect(cls).not.toHaveProperty('overrides');
  });

  it('drops a link whose original matches no name, or two', () => {
    const none = bindOwnedTraits(carriedMira(), linkTarget({ traits: [] , traitGroups: [] }));
    expect(none.traitLinks).toBeUndefined();
    const two = linkTarget({ traits: [...linkTarget().traits, trait('n-smite-2', { name: 'Smite', groupId: 'n-blueprints' })] });
    expect(bindOwnedTraits(carriedMira(), two).traitLinks!.map((l) => l.id)).toEqual(['l-class']);
  });

  it('treats a top-level match, by name or by id, as no match (Q5)', () => {
    // Smite sits at the top level here, so only the Class link binds.
    const rooted = linkTarget({ traits: [trait('n-smite', { name: 'Smite', groupId: null })] });
    expect(bindOwnedTraits(carriedMira(), rooted).traitLinks!.map((l) => l.id)).toEqual(['l-class']);
    // A top-level Smite beside the Blueprints one leaves the Blueprints one unique.
    const beside = linkTarget({ traits: [...linkTarget().traits, trait('n-smite-root', { name: 'Smite', groupId: null })] });
    expect(linkOf(bindOwnedTraits(carriedMira(), beside), 'l-smite')!.originalId).toBe('n-smite');
  });

  it('binds a link only to an original of its own kind, never to Blueprints itself', () => {
    const world = linkTarget({
      traits: [trait('n-class-trait', { name: 'Class', groupId: 'n-blueprints' }), trait('n-smite', { name: 'Smite', groupId: 'n-blueprints' })],
      traitGroups: [{ ...group('n-blueprints', 'Class'), system: 'blueprints' }],
    });
    expect(bindOwnedTraits(carriedMira(), world).traitLinks!.map((l) => l.id)).toEqual(['l-smite']);
    // Blueprints sharing the name leaves the one real Class unique.
    const shadowed = linkTarget({ traitGroups: [{ ...group('n-blueprints', 'Class'), system: 'blueprints' }, { ...group('n-class', 'Class'), parentId: 'n-blueprints' }] });
    expect(linkOf(bindOwnedTraits(carriedMira(), shadowed), 'l-class')!.originalId).toBe('n-class');
  });

  it('drops a link whose original the tree already holds through an earlier link', () => {
    const paladin = { id: 'l-paladin', originalId: 'w-paladin', kind: 'trait' as const, originalName: 'Paladin', groupId: null };
    const doubled: Entity = { ...mira(), traitLinks: [...mira().traitLinks!, paladin] };
    const carried = { ...doubled, ...portableOwnedTraits(doubled, linkOrigin), id: 'copy' };
    expect(bindOwnedTraits(carried, linkTarget()).traitLinks!.map((l) => l.id)).toEqual(['l-class', 'l-smite']);
  });

  it('keeps the duplicate that comes first in tree order, not in storage order', () => {
    const paladin = { id: 'l-paladin', originalId: 'w-paladin', kind: 'trait' as const, originalName: 'Paladin', groupId: null, order: 0 };
    const first: Entity = { ...mira(), traitLinks: [...mira().traitLinks!, paladin] };
    const carried = { ...first, ...portableOwnedTraits(first, linkOrigin), id: 'copy' };
    expect(bindOwnedTraits(carried, linkTarget()).traitLinks!.map((l) => l.id)).toEqual(['l-smite', 'l-paladin']);
  });

  it('rebinds a named-scope bearer by id, then unique name, else leaves it unresolved by name', () => {
    expect(vowOf(bindOwnedTraits(carriedMira(), linkOrigin)).map((r) => r.kind !== 'playingAs' && r.bearer)).toEqual([
      { kind: 'entity', id: 'albus', name: 'Albus' }, { kind: 'you' }, { kind: 'entity', id: 'copy', name: 'Mira' },
    ]);
    expect(vowOf(bindOwnedTraits(carriedMira(), linkTarget()))[0]).toEqual(
      { kind: 'trait', id: 'n-smite', name: 'Smite', bearer: { kind: 'entity', id: 'n-albus', name: 'Albus' } },
    );
    const twins = linkTarget({ entities: [{ id: 'a1', name: 'Albus' }, { id: 'a2', name: 'Albus' }] });
    expect(vowOf(bindOwnedTraits(carriedMira(), twins))[0]).toMatchObject({ bearer: { kind: 'entity', id: '', name: 'Albus' } });
    const renamed = { ...linkOrigin, entities: [{ id: 'albus', name: 'Sir Albus' }] };
    expect(vowOf(bindOwnedTraits(carriedMira(), renamed))[0]).toMatchObject({ bearer: { kind: 'entity', id: 'albus' } });
  });

  it('binds the links of an entity that owns nothing', () => {
    const linksOnly: Entity = { id: 'e', name: 'E', ...portableOwnedTraits({ id: 'e', name: 'E', traitLinks: mira().traitLinks }, linkOrigin) };
    expect(bindOwnedTraits(linksOnly, linkTarget()).traitLinks!.map((l) => l.originalId)).toEqual(['n-class', 'n-smite']);
  });
});

describe('comparableOwnedTraits with links', () => {
  it('reads a copy bound elsewhere the same as the carried form', () => {
    const carried = carriedMira();
    const bound = portableOwnedTraits(bindOwnedTraits(carried, linkTarget()), linkTarget());
    expect(comparableOwnedTraits({ ...carried, ...bound })).toEqual(comparableOwnedTraits(carried));
  });

  it('tells a changed override apart', () => {
    const carried = carriedMira();
    const flipped = { ...paladinOverrides, isDefault: { value: false, blueprint: false } };
    const changed = {
      ...carried,
      traitLinks: carried.traitLinks!.map((l) => (l.id === 'l-class' ? { ...l, overrides: { 'w-paladin': flipped } } : l)),
    };
    expect(comparableOwnedTraits(changed)).not.toEqual(comparableOwnedTraits(carried));
  });
});
