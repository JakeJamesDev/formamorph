import { describe, it, expect } from 'vitest';
import type { PersonaRef, Trait, TraitGroup, TraitRequirement } from '@/types';
import { WORLD_OWNER, gateStates, neverUnlockable, settle, settleDefaults, switchTrait, type GateInput, type GateOwner } from './traitGates';

const T = (id: string, extra: Partial<Trait> = {}): Trait => ({ id, name: id, statChanges: [], ...extra });
const G = (id: string, extra: Partial<TraitGroup> = {}): TraitGroup => ({ id, name: id, parentId: null, ...extra });
const trait = (id: string): TraitRequirement => ({ kind: 'trait', id });

const world = (
  traits: Trait[],
  groups: TraitGroup[] = [],
  active: string[] = [],
  extra: Partial<GateInput> = {},
): GateInput => ({
  owners: [{ id: WORLD_OWNER, name: '', traits, groups }],
  active: { [WORLD_OWNER]: active },
  entities: [],
  persona: { source: 'none' } as PersonaRef,
  ...extra,
});

const unlocked = (input: GateInput, id: string) => gateStates(input).get(id)?.unlocked;
const reason = (input: GateInput, id: string) => gateStates(input).get(id)?.requirements.map((r) => r.text);

describe('gate states', () => {
  const classes = [T('Paladin'), T('Knight'), T('Plate Armor', { requires: [trait('Paladin'), trait('Knight')] })];

  it('keeps a trait with no requirements unlocked', () => {
    expect(unlocked(world([T('Rogue')]), 'Rogue')).toBe(true);
    expect(unlocked(world([T('Rogue', { requires: [] })]), 'Rogue')).toBe(true);
  });

  it('unlocks a gated trait when any one requirement holds', () => {
    expect(unlocked(world(classes), 'Plate Armor')).toBe(false);
    expect(unlocked(world(classes, [], ['Knight']), 'Plate Armor')).toBe(true);
    expect(unlocked(world(classes, [], ['Paladin']), 'Plate Armor')).toBe(true);
  });

  it('names every requirement of a locked trait', () => {
    expect(reason(world(classes), 'Plate Armor')).toEqual(['Paladin', 'Knight']);
  });
});

describe('requirement kinds', () => {
  const groups = [G('Class'), G('Hybrid', { parentId: 'Class' })];
  const traits = [
    T('Mage', { groupId: 'Class' }),
    T('Spellblade', { groupId: 'Hybrid' }),
    T('Loose'),
    T('Cant', { requires: [{ kind: 'group', id: 'Class' }] }),
  ];

  it('holds a group requirement when any trait below the group is active, however deep', () => {
    expect(unlocked(world(traits, groups), 'Cant')).toBe(false);
    expect(unlocked(world(traits, groups, ['Loose']), 'Cant')).toBe(false);
    expect(unlocked(world(traits, groups, ['Mage']), 'Cant')).toBe(true);
    expect(unlocked(world(traits, groups, ['Spellblade']), 'Cant')).toBe(true);
    expect(reason(world(traits, groups), 'Cant')).toEqual(['any Class']);
  });

  it('holds a group requirement through the traits of an entity node placed inside the group', () => {
    const wolf: GateOwner = {
      id: 'wolf', name: 'Ash', parentGroupId: 'Hybrid', groups: [G('Bond')], traits: [T('Tamed', { groupId: 'Bond' })],
    };
    const input = world(traits, groups, [], { owners: [world(traits, groups).owners[0], wolf], active: { wolf: ['Tamed'] } });
    expect(unlocked(input, 'Cant')).toBe(true);
  });

  it('holds playing-as only while the persona is that world entity', () => {
    const royal = [T('Royal Plate', { requires: [{ kind: 'playingAs', id: 'aldric' }] })];
    const entities = [{ id: 'aldric', name: 'Sir Aldric', persona: true }];
    const as = (persona: PersonaRef) => world(royal, [], [], { entities, persona });
    expect(unlocked(as({ source: 'none' }), 'Royal Plate')).toBe(false);
    expect(unlocked(as({ source: 'library', entityId: 'aldric' }), 'Royal Plate')).toBe(false);
    expect(unlocked(as({ source: 'world', entityId: 'aldric' }), 'Royal Plate')).toBe(true);
    expect(reason(as({ source: 'none' }), 'Royal Plate')).toEqual(['playing as Sir Aldric']);
  });

  it('never holds an unresolved requirement, and names it by its stored name or its kind', () => {
    const gated = [T('Guild Mark', {
      requires: [
        { kind: 'trait', id: 'gone', name: 'Thief' },
        { kind: 'group', id: 'gone-group', name: 'Guilds' },
        { kind: 'playingAs', id: 'gone-entity', name: 'Mara' },
        { kind: 'trait', id: 'gone-2' },
        { kind: 'group', id: 'gone-group-2' },
        { kind: 'playingAs', id: 'gone-entity-2' },
      ],
    })];
    const input = world(gated, [], ['gone', 'gone-2'], { persona: { source: 'world', entityId: 'gone-entity' } });
    const state = gateStates(input).get('Guild Mark')!;
    expect(state.unlocked).toBe(false);
    expect(state.requirements.map((r) => r.text)).toEqual([
      'Thief', 'any Guilds', 'playing as Mara',
      'a missing trait', 'any trait in a missing group', 'playing as a missing persona',
    ]);
    expect(state.requirements.every((r) => r.unresolved)).toBe(true);
  });

  it('holds a requirement on another owner\'s trait, named with its owner', () => {
    const wolf: GateOwner = { id: 'wolf', name: 'Ash', groups: [], traits: [T('Tamed'), T('Pack Leader', { requires: [trait('Tamed')] })] };
    const tamer = T('Beast Tamer', { requires: [trait('Tamed')] });
    const input = (active: string[]): GateInput => ({
      owners: [{ id: WORLD_OWNER, name: '', traits: [tamer], groups: [] }, wolf],
      active: { wolf: active },
      entities: [],
      persona: { source: 'none' },
    });
    expect(unlocked(input([]), 'Beast Tamer')).toBe(false);
    expect(unlocked(input(['Tamed']), 'Beast Tamer')).toBe(true);
    expect(reason(input([]), 'Beast Tamer')).toEqual(["Ash's Tamed"]);
    expect(reason(input([]), 'Pack Leader')).toEqual(['Tamed']);
  });
});


describe('settle', () => {
  const ids = (refs: { traitId: string }[]) => refs.map((r) => r.traitId);

  it('keeps every proposed trait whose gate holds', () => {
    const traits = [T('Knight'), T('Plate Armor', { requires: [trait('Knight')] })];
    const result = settle(world(traits, [], ['Knight', 'Plate Armor']));
    expect(result.active[WORLD_OWNER]).toEqual(['Knight', 'Plate Armor']);
    expect(result.turnedOff).toEqual([]);
  });

  it('turns off a chain, dependents before their prerequisites', () => {
    // Tamed ← Pack Leader ← Beast Tamer, proposed with Tamed already dropped.
    const traits = [
      T('Beast Tamer', { requires: [trait('Pack Leader')] }),
      T('Tamed'),
      T('Pack Leader', { requires: [trait('Tamed')] }),
      T('Spare'),
    ];
    const result = settle(world(traits, [], ['Pack Leader', 'Beast Tamer', 'Spare']));
    expect(result.active[WORLD_OWNER]).toEqual(['Spare']);
    expect(ids(result.turnedOff)).toEqual(['Beast Tamer', 'Pack Leader']);
  });

  it('orders the turned-off list the same way whatever order the traits are authored in', () => {
    const traits = [
      T('Pack Leader', { requires: [trait('Tamed')] }),
      T('Beast Tamer', { requires: [trait('Pack Leader')] }),
      T('Tamed'),
    ];
    const result = settle(world(traits, [], ['Pack Leader', 'Beast Tamer']));
    expect(ids(result.turnedOff)).toEqual(['Beast Tamer', 'Pack Leader']);
  });

  it('never lets two traits that require only each other hold each other up', () => {
    const traits = [T('Sun', { requires: [trait('Moon')] }), T('Moon', { requires: [trait('Sun')] })];
    const result = settle(world(traits, [], ['Sun', 'Moon']));
    expect(result.active[WORLD_OWNER]).toEqual([]);
    expect(ids(result.turnedOff).sort()).toEqual(['Moon', 'Sun']);
  });

  it('keeps a mutual pair once a third trait opens one of them', () => {
    const traits = [
      T('Root'),
      T('Sun', { requires: [trait('Moon'), trait('Root')] }),
      T('Moon', { requires: [trait('Sun')] }),
    ];
    expect(settle(world(traits, [], ['Root', 'Sun', 'Moon'])).active[WORLD_OWNER]).toEqual(['Root', 'Sun', 'Moon']);
  });

  it('cascades across owners and reports each trait with its owner', () => {
    const wolf: GateOwner = { id: 'wolf', name: 'Ash', groups: [], traits: [T('Loyal', { requires: [trait('Paladin')] })] };
    const input: GateInput = {
      owners: [{ id: WORLD_OWNER, name: '', traits: [T('Paladin'), T('Rogue')], groups: [] }, wolf],
      active: { [WORLD_OWNER]: ['Rogue'], wolf: ['Loyal'] },
      entities: [],
      persona: { source: 'none' },
    };
    const result = settle(input);
    expect(result.active).toEqual({ [WORLD_OWNER]: ['Rogue'], wolf: [] });
    expect(result.turnedOff).toEqual([{ ownerId: 'wolf', traitId: 'Loyal' }]);
  });

  it('turns off a playing-as trait when the persona changes away', () => {
    const traits = [T('Royal Plate', { requires: [{ kind: 'playingAs', id: 'aldric' }] })];
    const entities = [{ id: 'aldric', name: 'Sir Aldric', persona: true }];
    const as = (persona: PersonaRef) => settle(world(traits, [], ['Royal Plate'], { entities, persona }));
    expect(as({ source: 'world', entityId: 'aldric' }).turnedOff).toEqual([]);
    expect(ids(as({ source: 'none' }).turnedOff)).toEqual(['Royal Plate']);
  });

  it('turns off a trait whose only requirement is unresolved', () => {
    const traits = [T('Guild Mark', { requires: [{ kind: 'trait', id: 'gone', name: 'Thief' }] })];
    expect(ids(settle(world(traits, [], ['Guild Mark', 'gone'])).turnedOff)).toEqual(['Guild Mark']);
  });

  it('leaves an active id the world no longer holds alone', () => {
    expect(settle(world([T('Knight')], [], ['deleted', 'Knight'])).active[WORLD_OWNER]).toEqual(['deleted', 'Knight']);
  });
});

describe('return after a cascade', () => {
  const traits = [
    T('Tamed'),
    T('Pack Leader', { requires: [trait('Tamed')] }),
    T('Beast Tamer', { requires: [trait('Pack Leader')] }),
  ];

  it('switches cascade-off traits back on, chain and all, once their gate holds again', () => {
    const result = settle(world(traits, [], ['Tamed']), { [WORLD_OWNER]: ['Beast Tamer', 'Pack Leader'] });
    expect(result.active[WORLD_OWNER]).toEqual(['Tamed', 'Pack Leader', 'Beast Tamer']);
    expect(result.returned.map((r) => r.traitId)).toEqual(['Pack Leader', 'Beast Tamer']);
    expect(result.cascadeOff[WORLD_OWNER]).toEqual([]);
  });

  it('keeps a cascade-off trait off while its gate still fails', () => {
    const result = settle(world(traits, [], []), { [WORLD_OWNER]: ['Pack Leader'] });
    expect(result.active[WORLD_OWNER]).toEqual([]);
    expect(result.returned).toEqual([]);
    expect(result.cascadeOff[WORLD_OWNER]).toEqual(['Pack Leader']);
  });

  it('never returns a trait the player switched off by hand', () => {
    const result = settle(world(traits, [], ['Tamed']), {});
    expect(result.active[WORLD_OWNER]).toEqual(['Tamed']);
    expect(result.returned).toEqual([]);
  });

  it('records a new cascade in the cascade-off list', () => {
    const result = settle(world(traits, [], ['Pack Leader', 'Beast Tamer']));
    expect(result.cascadeOff[WORLD_OWNER]).toEqual(['Beast Tamer', 'Pack Leader']);
  });

  it('keeps a returning trait off when the player has picked its exclusive sibling since, and forgets it', () => {
    const groups = [G('Stance', { exclusive: true })];
    const stances = [
      T('Knight'),
      T('Shield Wall', { groupId: 'Stance', requires: [trait('Knight')] }),
      T('Charge', { groupId: 'Stance' }),
    ];
    const result = settle(world(stances, groups, ['Knight', 'Charge']), { [WORLD_OWNER]: ['Shield Wall'] });
    expect(result.active[WORLD_OWNER]).toEqual(['Knight', 'Charge']);
    expect(result.returned).toEqual([]);
    expect(result.cascadeOff[WORLD_OWNER]).toEqual([]);
  });

  it('returns only one of two exclusive siblings that wait together', () => {
    const groups = [G('Stance', { exclusive: true })];
    const stances = [
      T('Knight'),
      T('Shield Wall', { groupId: 'Stance', order: 0, requires: [trait('Knight')] }),
      T('Guard', { groupId: 'Stance', order: 1, requires: [trait('Knight')] }),
    ];
    const result = settle(world(stances, groups, ['Knight']), { [WORLD_OWNER]: ['Guard', 'Shield Wall'] });
    expect(result.active[WORLD_OWNER]).toEqual(['Knight', 'Shield Wall']);
    expect(result.cascadeOff[WORLD_OWNER]).toEqual(['Guard']);
  });
});

describe('switching a trait', () => {
  const groups = [G('Class', { exclusive: true })];
  const traits = [
    T('Paladin', { groupId: 'Class' }),
    T('Knight', { groupId: 'Class' }),
    T('Rogue', { groupId: 'Class' }),
    T('Plate Armor', { requires: [trait('Paladin'), trait('Knight')] }),
    T('Shield', { requires: [trait('Plate Armor')] }),
  ];
  const input = (active: string[]) => world(traits, groups, active);

  it('retires the exclusive siblings, then turns off what they held up', () => {
    const result = switchTrait(input(['Knight', 'Plate Armor', 'Shield']), WORLD_OWNER, 'Rogue')!;
    expect(result.active[WORLD_OWNER]).toEqual(['Rogue']);
    expect(result.turnedOff.map((r) => r.traitId)).toEqual(['Shield', 'Plate Armor']);
  });

  it('keeps a dependent that a picked sibling still holds up', () => {
    const result = switchTrait(input(['Knight', 'Plate Armor']), WORLD_OWNER, 'Paladin')!;
    expect(result.active[WORLD_OWNER]).toEqual(['Plate Armor', 'Paladin']);
    expect(result.turnedOff).toEqual([]);
  });

  it('turns a trait off, and its dependents with it', () => {
    const result = switchTrait(input(['Knight', 'Plate Armor']), WORLD_OWNER, 'Knight')!;
    expect(result.active[WORLD_OWNER]).toEqual([]);
    expect(result.turnedOff.map((r) => r.traitId)).toEqual(['Plate Armor']);
  });

  it('unlocks a dependent the moment its requirement is picked', () => {
    const picked = switchTrait(input([]), WORLD_OWNER, 'Knight')!;
    expect(gateStates({ ...input([]), active: picked.active }).get('Plate Armor')?.unlocked).toBe(true);
  });

  it('refuses to switch on a locked trait', () => {
    expect(switchTrait(input(['Rogue']), WORLD_OWNER, 'Plate Armor')).toBeNull();
  });

  it('never lets an exclusive sibling hold a trait up, since picking the trait retires it', () => {
    const armor = [G('Armor', { exclusive: true })];
    const pieces = [
      T('Chain Mail', { groupId: 'Armor' }),
      T('Heavy Plate', { groupId: 'Armor', requires: [trait('Chain Mail')] }),
      T('Any Armor', { groupId: 'Armor', requires: [{ kind: 'group', id: 'Armor' }] }),
    ];
    const picked = world(pieces, armor, ['Chain Mail']);
    expect(gateStates(picked).get('Heavy Plate')?.unlocked).toBe(false);
    expect(gateStates(picked).get('Any Armor')?.unlocked).toBe(false);
    expect(switchTrait(picked, WORLD_OWNER, 'Heavy Plate')).toBeNull();
    expect(neverUnlockable(world(pieces, armor)).map((set) => [...set].sort())).toEqual([['Any Armor', 'Heavy Plate']]);
  });
});

describe('default selection', () => {
  const defaults = (traits: Trait[], groups: TraitGroup[] = []) =>
    settleDefaults(world(traits, groups)).active[WORLD_OWNER];

  it('keeps a gated default whose requirement is also a default', () => {
    expect(defaults([T('Knight', { isDefault: true }), T('Plate', { isDefault: true, requires: [trait('Knight')] })]))
      .toEqual(['Knight', 'Plate']);
  });

  it('starts a gated default unselected when its requirement is not a default', () => {
    expect(defaults([T('Knight'), T('Plate', { isDefault: true, requires: [trait('Knight')] })])).toEqual([]);
  });

  it('starts two defaults that require only each other unselected', () => {
    expect(defaults([
      T('Sun', { isDefault: true, requires: [trait('Moon')] }),
      T('Moon', { isDefault: true, requires: [trait('Sun')] }),
    ])).toEqual([]);
  });

  it('collapses exclusive defaults to the first, then drops what only the second held up', () => {
    const groups = [G('Class', { exclusive: true })];
    expect(defaults([
      T('Paladin', { groupId: 'Class', isDefault: true, order: 0 }),
      T('Knight', { groupId: 'Class', isDefault: true, order: 1 }),
      T('Lance', { isDefault: true, requires: [trait('Knight')] }),
    ], groups)).toEqual(['Paladin']);
  });
});

describe('never-unlockable sets', () => {
  const sets = (traits: Trait[], groups: TraitGroup[] = [], extra: Partial<GateInput> = {}) =>
    neverUnlockable(world(traits, groups, [], extra)).map((set) => [...set].sort());

  it('passes a loop that a third trait opens', () => {
    expect(sets([
      T('A', { requires: [trait('B'), trait('C')] }),
      T('B', { requires: [trait('A')] }),
      T('C'),
    ])).toEqual([]);
  });

  it('reports a loop with no open root, and each separate loop as its own set', () => {
    expect(sets([
      T('A', { requires: [trait('B')] }),
      T('B', { requires: [trait('A')] }),
      T('X', { requires: [trait('Y')] }),
      T('Y', { requires: [trait('X')] }),
      T('Free'),
    ])).toEqual([['A', 'B'], ['X', 'Y']]);
  });

  it('puts a trait that hangs off a closed loop in the loop\'s set', () => {
    expect(sets([
      T('A', { requires: [trait('B')] }),
      T('B', { requires: [trait('A')] }),
      T('Tail', { requires: [trait('B')] }),
    ])).toEqual([['A', 'B', 'Tail']]);
  });

  it('opens through a group only when the group holds an unlockable trait', () => {
    const groups = [G('Class')];
    expect(sets([T('Mage', { groupId: 'Class' }), T('Cant', { requires: [{ kind: 'group', id: 'Class' }] })], groups))
      .toEqual([]);
    expect(sets([
      T('Mage', { groupId: 'Class', requires: [trait('Cant')] }),
      T('Cant', { requires: [{ kind: 'group', id: 'Class' }] }),
    ], groups)).toEqual([['Cant', 'Mage']]);
  });

  it('opens through playing as a world persona, never through an entity no one can play', () => {
    const royal = [T('Royal Plate', { requires: [{ kind: 'playingAs', id: 'aldric' }] })];
    expect(sets(royal, [], { entities: [{ id: 'aldric', name: 'Sir Aldric', persona: true }] })).toEqual([]);
    expect(sets(royal, [], { entities: [{ id: 'aldric', name: 'Sir Aldric' }] })).toEqual([['Royal Plate']]);
    expect(sets(royal)).toEqual([['Royal Plate']]);
  });
});
