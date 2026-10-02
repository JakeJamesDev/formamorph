import { describe, it, expect } from 'vitest';
import type { PersonaRef, Trait, TraitGroup, TraitRequirement } from '@/types';
import {
  WORLD_OWNER, alwaysOnOverMax, gateOf, gateStates, groupPickStates, neverUnlockable, playerOwnerIds, requirementOptions, settle, settleDefaults, shownRefs, switchTrait,
  underfills, withBearer, type GateInput, type GateOwner,
} from './traitGates';

const T = (id: string, extra: Partial<Trait> = {}): Trait => ({ id, name: id, statChanges: [], ...extra });
const G = (id: string, extra: Partial<TraitGroup> = {}): TraitGroup => ({ id, name: id, parentId: null, ...extra });
const trait = (id: string): TraitRequirement => ({ kind: 'trait', id });
const you = (id: string): TraitRequirement => ({ kind: 'trait', id, bearer: { kind: 'you' } });
const on = (entity: string, id: string): TraitRequirement => ({ kind: 'trait', id, bearer: { kind: 'entity', id: entity } });

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

const unlocked = (input: GateInput, id: string, owner = WORLD_OWNER) => gateOf(gateStates(input), owner, id)?.unlocked;
const reason = (input: GateInput, id: string, owner = WORLD_OWNER) =>
  gateOf(gateStates(input), owner, id)?.requirements.map((r) => r.text);

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

  it('reports each owner’s gates under that owner', () => {
    const wolf: GateOwner = { id: 'wolf', name: 'Ash', groups: [], traits: [T('Loyal', { requires: [trait('Tamed')] })] };
    const states = gateStates(world([T('Brave')], [], [], { owners: [world([T('Brave')]).owners[0], wolf] }));
    expect([...states.keys()]).toEqual([WORLD_OWNER, 'wolf']);
    expect(gateOf(states, 'wolf', 'Loyal')?.unlocked).toBe(false);
    expect(gateOf(states, WORLD_OWNER, 'Loyal')).toBeUndefined();
  });

  it('flags a requirement on a Hidden trait, in the owner’s tree or only in the originals', () => {
    const traits = [T('Bond', { mode: 'hidden' }), T('Rite', { requires: [trait('Bond'), trait('Omen'), trait('Knight')] }), T('Knight')];
    const input = world(traits, [], [], { originals: { traits: [T('Omen', { mode: 'hidden' })], groups: [] } });
    expect(gateOf(gateStates(input), WORLD_OWNER, 'Rite')?.requirements.map((r) => [r.text, r.hidden])).toEqual([
      ['Bond', true], ['Omen', true], ['Knight', false],
    ]);
  });

  it('names every ref but a Hidden trait’s for the player', () => {
    const owners = world([T('Bond', { mode: 'hidden' }), T('Knight')]).owners;
    const refs = [{ ownerId: WORLD_OWNER, traitId: 'Bond' }, { ownerId: WORLD_OWNER, traitId: 'Knight' }];
    expect(shownRefs(owners, refs)).toEqual([{ ownerId: WORLD_OWNER, traitId: 'Knight' }]);
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

  it('holds a group requirement through an entity node placed inside the group only while that entity is played', () => {
    const wolf: GateOwner = {
      id: 'wolf', name: 'Ash', parentGroupId: 'Hybrid', groups: [G('Bond')], traits: [T('Tamed', { groupId: 'Bond' })],
    };
    const entities = [{ id: 'wolf', name: 'Ash', persona: true }];
    const as = (persona: PersonaRef) => world(traits, groups, [], {
      owners: [world(traits, groups).owners[0], wolf], active: { wolf: ['Tamed'] }, entities, persona,
    });
    expect(unlocked(as({ source: 'none' }), 'Cant')).toBe(false);
    expect(unlocked(as({ source: 'world', entityId: 'wolf' }), 'Cant')).toBe(true);
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
    const state = gateOf(gateStates(input), WORLD_OWNER, 'Guild Mark')!;
    expect(state.unlocked).toBe(false);
    expect(state.requirements.map((r) => r.text)).toEqual([
      'Thief', 'any Guilds', 'playing as Mara',
      'a missing trait', 'any trait in a missing group', 'playing as a missing persona',
    ]);
    expect(state.requirements.every((r) => r.unresolved)).toBe(true);
  });
});

describe('requirements per bearer', () => {
  // The world's Smite requires Paladin. Albus links Paladin and Smite, so both owners hold both ids.
  const paladin = T('Paladin');
  const smite = T('Smite', { requires: [trait('Paladin')] });
  const albus: GateOwner = { id: 'albus', name: 'Albus', groups: [], traits: [paladin, smite] };
  const mira: GateOwner = { id: 'mira', name: 'Mira', groups: [], traits: [T('Squire', { requires: [you('Paladin')] })] };
  const entities = [{ id: 'albus', name: 'Albus', persona: true }, { id: 'mira', name: 'Mira' }];
  const input = (active: GateInput['active'], persona: PersonaRef = { source: 'none' }): GateInput => ({
    owners: [{ id: WORLD_OWNER, name: '', traits: [paladin, smite], groups: [] }, albus, mira],
    active, entities, persona,
  });

  it('never opens a gate through an active id the owner does not hold, so a dormant pick opens nothing', () => {
    // Under Albus, the player's list still carries a Custom Persona pick the world owner no longer holds.
    const dormant = input({ [WORLD_OWNER]: ['Halfling'], albus: [] }, { source: 'world', entityId: 'albus' });
    const lucky = T('Lucky Step', { requires: [trait('Halfling')] });
    const withLucky: GateInput = {
      ...dormant,
      owners: dormant.owners.map((o) => (o.id === 'albus' ? { ...o, traits: [...o.traits, lucky] } : o)),
      originals: { traits: [T('Halfling'), lucky], groups: [] },
    };
    expect(reason(withLucky, 'Lucky Step', 'albus')).toEqual(['Halfling']);
    expect(unlocked(withLucky, 'Lucky Step', 'albus')).toBe(false);
    expect(switchTrait(withLucky, 'albus', 'Lucky Step')).toBeNull();
  });

  it('never lets a same-bearer requirement hold through another bearer', () => {
    const albusOnly = input({ albus: ['Paladin'] });
    expect(unlocked(albusOnly, 'Smite', 'albus')).toBe(true);
    expect(unlocked(albusOnly, 'Smite', WORLD_OWNER)).toBe(false);
    expect(reason(albusOnly, 'Smite', WORLD_OWNER)).toEqual(['Paladin']);
    const playerOnly = input({ [WORLD_OWNER]: ['Paladin'] });
    expect(unlocked(playerOnly, 'Smite', WORLD_OWNER)).toBe(true);
    expect(unlocked(playerOnly, 'Smite', 'albus')).toBe(false);
  });

  it('holds a named requirement through the named entity, wherever the trait sits', () => {
    const gated: GateOwner = { ...mira, traits: [T('Squire', { requires: [on('albus', 'Paladin')] })] };
    const owners = [input({}).owners[0], albus, gated];
    expect(unlocked({ ...input({ albus: ['Paladin'] }), owners }, 'Squire', 'mira')).toBe(true);
    expect(unlocked({ ...input({ [WORLD_OWNER]: ['Paladin'], mira: ['Paladin'] }), owners }, 'Squire', 'mira')).toBe(false);
    expect(reason({ ...input({}), owners }, 'Squire', 'mira')).toEqual(['Albus: Paladin']);
  });

  it('holds a You requirement through the player’s set, which a persona switch changes', () => {
    // Under None the player has no Paladin. Playing Albus, his Paladin is the player’s.
    expect(unlocked(input({ albus: ['Paladin'] }), 'Squire', 'mira')).toBe(false);
    expect(unlocked(input({ [WORLD_OWNER]: ['Paladin'] }), 'Squire', 'mira')).toBe(true);
    expect(unlocked(input({ albus: ['Paladin'] }, { source: 'world', entityId: 'albus' }), 'Squire', 'mira')).toBe(true);
    expect(reason(input({}), 'Squire', 'mira')).toEqual(['You: Paladin']);
  });

  it('reads a same-bearer requirement on a root trait through the played persona’s set (Q74)', () => {
    const asAlbus = input({ albus: ['Paladin'] }, { source: 'world', entityId: 'albus' });
    expect(unlocked(asAlbus, 'Smite', WORLD_OWNER)).toBe(true);
    expect(unlocked(input({ albus: ['Paladin'] }, { source: 'world', entityId: 'mira' }), 'Smite', WORLD_OWNER)).toBe(false);
    expect(playerOwnerIds({ source: 'library', entityId: 'lib' })).toEqual([WORLD_OWNER, 'lib']);
  });

  it('counts the Custom Persona entity as the player under None and a library persona, never under a world persona', () => {
    const entities = [{ id: 'cp', name: 'Newcomer', customPersona: true }, { id: 'albus', name: 'Albus', persona: true }];
    expect(playerOwnerIds({ source: 'none' }, entities)).toEqual([WORLD_OWNER, 'cp']);
    expect(playerOwnerIds({ source: 'library', entityId: 'lib' }, entities)).toEqual([WORLD_OWNER, 'lib', 'cp']);
    expect(playerOwnerIds({ source: 'world', entityId: 'albus' }, entities)).toEqual([WORLD_OWNER, 'albus']);
  });

  it('names the target from the originals when no present bearer holds it, and a gone bearer by its stored name', () => {
    const squire = T('Squire', { requires: [you('Cleric'), { kind: 'trait', id: 'Paladin', bearer: { kind: 'entity', id: 'gone', name: 'Old Albus' } }] });
    const owners = [input({}).owners[0], { ...mira, traits: [squire] }];
    const state = gateOf(gateStates({ ...input({}), owners, originals: { traits: [T('Cleric')], groups: [] } }), 'mira', 'Squire')!;
    expect(state.requirements).toEqual([
      { text: 'You: Cleric', holds: false, unresolved: false, hidden: false },
      { text: 'Old Albus: Paladin', holds: false, unresolved: true, hidden: false },
    ]);
    expect(reason({ ...input({}), owners }, 'Squire', 'mira')?.[0]).toBe('You: a missing trait');
  });

  it('holds a named group requirement through that bearer’s traits below the group', () => {
    const classes = G('Classes');
    const knight = T('Knight', { groupId: 'Classes' });
    const owners: GateOwner[] = [
      { id: WORLD_OWNER, name: '', traits: [], groups: [] },
      { id: 'albus', name: 'Albus', groups: [classes], traits: [knight] },
      { id: 'mira', name: 'Mira', groups: [], traits: [T('Squire', { requires: [{ kind: 'group', id: 'Classes', bearer: { kind: 'entity', id: 'albus' } }] })] },
    ];
    const at = (active: GateInput['active']) => ({ ...input(active), owners });
    expect(unlocked(at({ albus: ['Knight'] }), 'Squire', 'mira')).toBe(true);
    expect(unlocked(at({ mira: ['Knight'] }), 'Squire', 'mira')).toBe(false);
    expect(reason(at({}), 'Squire', 'mira')).toEqual(['Albus: any Classes']);
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

  it('settles each owner against its own set and reports each trait with its owner', () => {
    const paladin = T('Paladin');
    const loyal = T('Loyal', { requires: [trait('Paladin')] });
    const wolf: GateOwner = { id: 'wolf', name: 'Ash', groups: [], traits: [paladin, loyal] };
    const input = (active: GateInput['active']): GateInput => ({
      owners: [{ id: WORLD_OWNER, name: '', traits: [paladin, loyal, T('Rogue')], groups: [] }, wolf],
      active, entities: [], persona: { source: 'none' },
    });
    // The player's Paladin never holds Ash's Loyal up.
    const crossed = settle(input({ [WORLD_OWNER]: ['Rogue', 'Paladin'], wolf: ['Loyal'] }));
    expect(crossed.active).toEqual({ [WORLD_OWNER]: ['Rogue', 'Paladin'], wolf: [] });
    expect(crossed.turnedOff).toEqual([{ ownerId: 'wolf', traitId: 'Loyal' }]);
    // Each owner's own Paladin holds its own Loyal; the same id turns off in one owner and stays in the other.
    const own = settle(input({ [WORLD_OWNER]: ['Loyal'], wolf: ['Paladin', 'Loyal'] }));
    expect(own.active).toEqual({ [WORLD_OWNER]: [], wolf: ['Paladin', 'Loyal'] });
    expect(own.turnedOff).toEqual([{ ownerId: WORLD_OWNER, traitId: 'Loyal' }]);
    expect(own.cascadeOff).toEqual({ [WORLD_OWNER]: ['Loyal'], wolf: [] });
  });

  it('cascades a named requirement off when the named bearer drops the target', () => {
    const wolf: GateOwner = { id: 'wolf', name: 'Ash', groups: [], traits: [T('Tamed')] };
    const tamer = T('Beast Tamer', { requires: [on('wolf', 'Tamed')] });
    const input = (active: GateInput['active']): GateInput => ({
      owners: [{ id: WORLD_OWNER, name: '', traits: [tamer], groups: [] }, wolf], active, entities: [], persona: { source: 'none' },
    });
    expect(settle(input({ [WORLD_OWNER]: ['Beast Tamer'], wolf: ['Tamed'] })).turnedOff).toEqual([]);
    expect(settle(input({ [WORLD_OWNER]: ['Beast Tamer'], wolf: [] })).turnedOff).toEqual([{ ownerId: WORLD_OWNER, traitId: 'Beast Tamer' }]);
  });

  it('turns off a playing-as trait when the persona changes away', () => {
    const traits = [T('Royal Plate', { requires: [{ kind: 'playingAs', id: 'aldric' }] })];
    const entities = [{ id: 'aldric', name: 'Sir Aldric', persona: true }];
    const as = (persona: PersonaRef) => settle(world(traits, [], ['Royal Plate'], { entities, persona }));
    expect(as({ source: 'world', entityId: 'aldric' }).turnedOff).toEqual([]);
    expect(ids(as({ source: 'none' }).turnedOff)).toEqual(['Royal Plate']);
  });

  it('turns off a You trait when the persona changes away from the bearer that met it', () => {
    const albus: GateOwner = { id: 'albus', name: 'Albus', groups: [], traits: [T('Paladin')] };
    const squire = T('Squire', { requires: [you('Paladin')] });
    const mira: GateOwner = { id: 'mira', name: 'Mira', groups: [], traits: [squire] };
    const as = (persona: PersonaRef) => settle({
      owners: [{ id: WORLD_OWNER, name: '', traits: [], groups: [] }, albus, mira],
      active: { albus: ['Paladin'], mira: ['Squire'] },
      entities: [{ id: 'albus', name: 'Albus', persona: true }], persona,
    });
    expect(as({ source: 'world', entityId: 'albus' }).turnedOff).toEqual([]);
    expect(as({ source: 'none' }).turnedOff).toEqual([{ ownerId: 'mira', traitId: 'Squire' }]);
  });

  it('turns off a trait whose only requirement is unresolved', () => {
    const traits = [T('Guild Mark', { requires: [{ kind: 'trait', id: 'gone', name: 'Thief' }] })];
    expect(ids(settle(world(traits, [], ['Guild Mark', 'gone'])).turnedOff)).toEqual(['Guild Mark']);
  });

  it('leaves an active id the owner no longer holds alone', () => {
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

  it('returns a trait to the owner whose list held it, not to another owner with the same id', () => {
    const wolf: GateOwner = { id: 'wolf', name: 'Ash', groups: [], traits };
    const input: GateInput = {
      owners: [{ id: WORLD_OWNER, name: '', traits, groups: [] }, wolf],
      active: { [WORLD_OWNER]: [], wolf: ['Tamed'] }, entities: [], persona: { source: 'none' },
    };
    const result = settle(input, { [WORLD_OWNER]: ['Pack Leader'], wolf: ['Pack Leader'] });
    expect(result.active).toEqual({ [WORLD_OWNER]: [], wolf: ['Tamed', 'Pack Leader'] });
    expect(result.returned).toEqual([{ ownerId: 'wolf', traitId: 'Pack Leader' }]);
    expect(result.cascadeOff).toEqual({ [WORLD_OWNER]: ['Pack Leader'], wolf: [] });
  });

  it('keeps a returning trait off when the player has picked its exclusive sibling since, and forgets it', () => {
    const groups = [G('Stance', { maxPicks: 1 })];
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
    const groups = [G('Stance', { maxPicks: 1 })];
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
  const groups = [G('Class', { maxPicks: 1 })];
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
    expect(unlocked({ ...input([]), active: picked.active }, 'Plate Armor')).toBe(true);
  });

  it('refuses to switch on a locked trait', () => {
    expect(switchTrait(input(['Rogue']), WORLD_OWNER, 'Plate Armor')).toBeNull();
  });

  it('refuses a switch in the owner whose copy is locked, and allows it in the owner whose copy is open', () => {
    const paladin = T('Paladin');
    const smite = T('Smite', { requires: [trait('Paladin')] });
    const two: GateInput = {
      owners: [{ id: WORLD_OWNER, name: '', traits: [paladin, smite], groups: [] }, { id: 'albus', name: 'Albus', groups: [], traits: [paladin, smite] }],
      active: { [WORLD_OWNER]: [], albus: ['Paladin'] }, entities: [], persona: { source: 'none' },
    };
    expect(switchTrait(two, WORLD_OWNER, 'Smite')).toBeNull();
    expect(switchTrait(two, 'albus', 'Smite')?.active).toEqual({ [WORLD_OWNER]: [], albus: ['Paladin', 'Smite'] });
  });

  it('never lets an exclusive sibling hold a trait up, since picking the trait retires it', () => {
    const armor = [G('Armor', { maxPicks: 1 })];
    const pieces = [
      T('Chain Mail', { groupId: 'Armor' }),
      T('Heavy Plate', { groupId: 'Armor', requires: [trait('Chain Mail')] }),
      T('Any Armor', { groupId: 'Armor', requires: [{ kind: 'group', id: 'Armor' }] }),
    ];
    const picked = world(pieces, armor, ['Chain Mail']);
    expect(unlocked(picked, 'Heavy Plate')).toBe(false);
    expect(unlocked(picked, 'Any Armor')).toBe(false);
    expect(switchTrait(picked, WORLD_OWNER, 'Heavy Plate')).toBeNull();
    expect(neverUnlockable(world(pieces, armor)).map((set) => set.map((r) => r.traitId).sort())).toEqual([['Any Armor', 'Heavy Plate']]);
  });
});

describe('switching in a group with a max above one', () => {
  const groups = [G('Skills', { maxPicks: 2 }), G('Deep', { parentId: 'Skills' })];
  const traits = [
    T('Archery', { groupId: 'Skills' }), T('Stealth', { groupId: 'Skills' }), T('Lore', { groupId: 'Skills' }),
    T('Herbs', { groupId: 'Deep' }),
  ];
  const input = (active: string[]) => world(traits, groups, active);

  it('refuses a switch-on once the group is full', () => {
    expect(switchTrait(input(['Archery', 'Stealth']), WORLD_OWNER, 'Lore')).toBeNull();
  });

  it('allows a switch-on below the max, keeping every pick', () => {
    expect(switchTrait(input(['Archery']), WORLD_OWNER, 'Lore')?.active[WORLD_OWNER]).toEqual(['Archery', 'Lore']);
  });

  it('allows a switch-off in a full group', () => {
    expect(switchTrait(input(['Archery', 'Stealth']), WORLD_OWNER, 'Stealth')?.active[WORLD_OWNER]).toEqual(['Archery']);
  });

  it('counts only the traits placed directly in the group', () => {
    expect(switchTrait(input(['Archery', 'Herbs']), WORLD_OWNER, 'Lore')?.active[WORLD_OWNER]).toEqual(['Archery', 'Herbs', 'Lore']);
  });

  it('applies the cap to an entity-owned group', () => {
    const ash: GateOwner = { id: 'ash', name: 'Ash', groups, traits };
    const two: GateInput = { ...world([], []), owners: [world([], []).owners[0], ash], active: { [WORLD_OWNER]: [], ash: ['Archery', 'Stealth'] } };
    expect(switchTrait(two, 'ash', 'Lore')).toBeNull();
    expect(switchTrait({ ...two, active: { ...two.active, ash: ['Archery'] } }, 'ash', 'Lore')?.active.ash).toEqual(['Archery', 'Lore']);
  });
});

describe('a switch-off below the minimum', () => {
  const groups = [G('Skills', { minPicks: 2 }), G('Deep', { parentId: 'Skills' }), G('Class', { minPicks: 1, maxPicks: 1 })];
  const traits = [
    T('Archery', { groupId: 'Skills' }), T('Stealth', { groupId: 'Skills' }), T('Lore', { groupId: 'Skills' }),
    T('Herbs', { groupId: 'Deep' }), T('Paladin', { groupId: 'Class' }), T('Knight', { groupId: 'Class' }),
  ];
  const input = (active: string[]) => world(traits, groups, active);

  it('refuses the switch-off that drops the group below its minimum', () => {
    expect(underfills(input(['Archery', 'Stealth']), WORLD_OWNER, 'Stealth')).toBe(true);
  });

  it('allows a switch-off that keeps the group at its minimum', () => {
    expect(underfills(input(['Archery', 'Stealth', 'Lore']), WORLD_OWNER, 'Lore')).toBe(false);
  });

  it('refuses a switch-off in a group that is already short', () => {
    expect(underfills(input(['Archery']), WORLD_OWNER, 'Archery')).toBe(true);
  });

  it('counts only the traits placed directly in the group', () => {
    expect(underfills(input(['Archery', 'Stealth', 'Herbs']), WORLD_OWNER, 'Herbs')).toBe(false);
  });

  it('never refuses a switch-on, or a trait that is off', () => {
    expect(underfills(input(['Archery']), WORLD_OWNER, 'Lore')).toBe(false);
  });

  it('refuses a switch-off of the one pick in an Exactly One group', () => {
    expect(underfills(input(['Paladin']), WORLD_OWNER, 'Paladin')).toBe(true);
  });

  it('applies the minimum to an entity-owned group, against that bearer alone', () => {
    const ash: GateOwner = { id: 'ash', name: 'Ash', groups, traits };
    const two: GateInput = { ...input([]), owners: [input([]).owners[0], ash], active: { [WORLD_OWNER]: ['Archery', 'Stealth', 'Lore'], ash: ['Archery', 'Stealth'] } };
    expect(underfills(two, 'ash', 'Stealth')).toBe(true);
    expect(underfills(two, WORLD_OWNER, 'Stealth')).toBe(false);
  });

  it('leaves the setup switch free, so Begin gates the short group instead', () => {
    expect(switchTrait(input(['Archery', 'Stealth']), WORLD_OWNER, 'Stealth')?.active[WORLD_OWNER]).toEqual(['Archery']);
  });
});

describe('a short group after a cascade', () => {
  const groups = [G('Oath', { minPicks: 1 })];
  const traits = [T('Knight'), T('Vow', { groupId: 'Oath', requires: [trait('Knight')] }), T('Pledge', { groupId: 'Oath', requires: [trait('Knight')] })];

  it('lets a cascade drop the group below its minimum', () => {
    const result = switchTrait(world(traits, groups, ['Knight', 'Vow']), WORLD_OWNER, 'Knight')!;
    expect(result.active[WORLD_OWNER]).toEqual([]);
    expect(result.turnedOff.map((r) => r.traitId)).toEqual(['Vow']);
    expect(groupPickStates({ ...world(traits, groups), active: result.active }).get(WORLD_OWNER)!.get('Oath')?.short).toBe(true);
  });

  it('fills the group again when the trait returns', () => {
    const result = settle(world(traits, groups, ['Knight']), { [WORLD_OWNER]: ['Vow'] });
    expect(result.active[WORLD_OWNER]).toEqual(['Knight', 'Vow']);
    expect(groupPickStates({ ...world(traits, groups), active: result.active }).get(WORLD_OWNER)!.get('Oath')?.short).toBe(false);
  });
});

describe('group pick states', () => {
  const groups = [G('Class', { minPicks: 1, maxPicks: 1 }), G('Skills', { minPicks: 2, maxPicks: 3 }), G('Folder'), G('Sub', { parentId: 'Skills' })];
  const traits = [
    T('Paladin', { groupId: 'Class' }), T('Knight', { groupId: 'Class' }),
    T('Archery', { groupId: 'Skills' }), T('Stealth', { groupId: 'Skills' }), T('Lore', { groupId: 'Skills' }),
    T('Herbs', { groupId: 'Sub' }), T('Map', { groupId: 'Folder' }),
  ];
  const states = (active: string[]) => groupPickStates(world(traits, groups, active)).get(WORLD_OWNER)!;

  it('reports a short group and a full one', () => {
    const s = states(['Paladin', 'Archery', 'Herbs']);
    expect(s.get('Class')).toEqual({ count: 1, min: 1, max: 1, short: false, full: true });
    expect(s.get('Skills')).toEqual({ count: 1, min: 2, max: 3, short: true, full: false });
  });

  it('reads an absent min as zero and an absent max as no limit', () => {
    expect(states(['Map']).get('Folder')).toEqual({ count: 1, min: 0, max: null, short: false, full: false });
  });

  it('fills a group at its max', () => {
    expect(states(['Archery', 'Stealth', 'Lore']).get('Skills')).toMatchObject({ count: 3, short: false, full: true });
  });

  it('reports each bearer against its own active set', () => {
    const ash: GateOwner = { id: 'ash', name: 'Ash', groups, traits };
    const input: GateInput = { ...world(traits, groups), owners: [world(traits, groups).owners[0], ash], active: { [WORLD_OWNER]: [], ash: ['Knight'] } };
    const all = groupPickStates(input);
    expect(all.get(WORLD_OWNER)!.get('Class')?.count).toBe(0);
    expect(all.get('ash')!.get('Class')?.count).toBe(1);
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
    const groups = [G('Class', { maxPicks: 1 })];
    expect(defaults([
      T('Paladin', { groupId: 'Class', isDefault: true, order: 0 }),
      T('Knight', { groupId: 'Class', isDefault: true, order: 1 }),
      T('Lance', { isDefault: true, requires: [trait('Knight')] }),
    ], groups)).toEqual(['Paladin']);
  });

  it('caps defaults at a larger max in authored order, in every owner', () => {
    const groups = [G('Skills', { maxPicks: 2 })];
    const skills = [
      T('Archery', { groupId: 'Skills', isDefault: true, order: 0 }),
      T('Stealth', { groupId: 'Skills', isDefault: true, order: 1 }),
      T('Lore', { groupId: 'Skills', isDefault: true, order: 2 }),
    ];
    expect(defaults(skills, groups)).toEqual(['Archery', 'Stealth']);
    const ash: GateOwner = { id: 'ash', name: 'Ash', groups, traits: skills };
    const { active: _active, ...rest } = world([], []);
    expect(settleDefaults({ ...rest, owners: [rest.owners[0], ash] }).active.ash).toEqual(['Archery', 'Stealth']);
  });
});

describe('never-unlockable sets', () => {
  const sets = (traits: Trait[], groups: TraitGroup[] = [], extra: Partial<GateInput> = {}) =>
    neverUnlockable(world(traits, groups, [], extra)).map((set) => set.map((r) => r.traitId).sort());

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

  it('reports a linked trait stuck on the bearer that lacks its requirement, and open on the one that has it', () => {
    // Smite requires Faithful. The player has Faithful at the root; Albus links Smite alone.
    const smite = T('Smite', { requires: [trait('Faithful')] });
    const input: Omit<GateInput, 'active'> = {
      owners: [
        { id: WORLD_OWNER, name: '', traits: [T('Faithful'), smite], groups: [] },
        { id: 'albus', name: 'Albus', groups: [], traits: [smite] },
      ],
      entities: [], persona: { source: 'none' },
    };
    expect(neverUnlockable(input)).toEqual([[{ ownerId: 'albus', traitId: 'Smite' }]]);
    // A named requirement opens through the named bearer, and a You requirement through the player.
    const named = { ...input, owners: [input.owners[0], { ...input.owners[1], traits: [T('Smite', { requires: [you('Faithful')] })] }] };
    expect(neverUnlockable(named)).toEqual([]);
  });
});

describe('requirement options', () => {
  const groups = [G('Class', { maxPicks: 1 }), G('Gear'), G('Heavy', { parentId: 'Gear' })];
  const traits = [
    T('Paladin', { groupId: 'Class' }),
    T('Knight', { groupId: 'Class' }),
    T('Plate Armor', { groupId: 'Heavy' }),
    T('Loose'),
  ];
  const wolf: GateOwner = { id: 'wolf', name: 'Ash', groups: [G('Bond')], traits: [T('Tamed', { groupId: 'Bond' })] };
  const input = {
    owners: [{ id: WORLD_OWNER, name: '', traits, groups }, wolf],
    entities: [{ id: 'aldric', name: 'Sir Aldric', persona: true }, { id: 'odd', name: 'Odd Wick' }],
  };
  const rows = (list: { label: string; breadcrumb: string[] }[]) => list.map((o) => `${o.label} @ ${o.breadcrumb.join(' › ')}`);

  it('lists every trait in tree order with where it lives, leaving out the trait itself', () => {
    expect(rows(requirementOptions(input, 'Plate Armor').traits)).toEqual([
      'Paladin @ Class', 'Knight @ Class', 'Loose @ World', 'Tamed @ Ash › Bond',
    ]);
  });

  it('leaves out an exclusive sibling, which can never hold the trait up', () => {
    expect(rows(requirementOptions(input, 'Paladin').traits)).toEqual([
      'Plate Armor @ Gear › Heavy', 'Loose @ World', 'Tamed @ Ash › Bond',
    ]);
  });

  it('lists a target once, where the first owner holds it, with You and every entity that bears it', () => {
    const albus: GateOwner = { id: 'albus', name: 'Albus', groups: [G('Class', { maxPicks: 1 })], traits: [T('Paladin', { groupId: 'Class' }), T('Oath')] };
    const options = requirementOptions({ ...input, owners: [...input.owners, albus] }, 'Loose');
    expect(rows(options.traits)).toEqual(['Paladin @ Class', 'Knight @ Class', 'Plate Armor @ Gear › Heavy', 'Tamed @ Ash › Bond', 'Oath @ Albus']);
    const bearers = (label: string) => options.traits.find((o) => o.label === label)?.bearers.map((b) => b.name);
    expect(bearers('Paladin')).toEqual(['You', 'Albus']);
    expect(bearers('Tamed')).toEqual(['You', 'Ash']);
    expect(bearers('Knight')).toEqual(['You']);
    expect(options.traits[0].bearers[1].bearer).toEqual({ kind: 'entity', id: 'albus', name: 'Albus' });
    expect(options.groups.find((o) => o.label === 'any Class')?.bearers.map((b) => b.name)).toEqual(['You', 'Albus']);
  });

  it('leaves out a group that holds only the trait and its exclusive siblings, and keeps one with another way in', () => {
    const labels = requirementOptions(input, 'Paladin').groups.map((o) => o.label);
    expect(labels).not.toContain('any Class');
    expect(labels).toContain('any Gear');
    // A parent group holds the exclusive one plus a trait of its own, so it can still unlock Paladin.
    const nested = {
      ...input,
      owners: [{
        ...input.owners[0],
        groups: [G('Martial'), G('Class', { maxPicks: 1, parentId: 'Martial' })],
        traits: [...traits.filter((t) => t.groupId === 'Class'), T('Brawler', { groupId: 'Martial' })],
      }, wolf],
    };
    expect(requirementOptions(nested, 'Paladin').groups.map((o) => o.label)).toContain('any Martial');
    // An empty group is offered: it can open the trait once the author fills it.
    const empty = { ...input, owners: [{ ...input.owners[0], groups: [...groups, G('Oaths')] }, wolf] };
    expect(requirementOptions(empty, 'Paladin').groups.map((o) => o.label)).toContain('any Oaths');
  });

  it('lists every group as "any" with its parent path', () => {
    expect(rows(requirementOptions(input, 'Loose').groups)).toEqual([
      'any Class @ World', 'any Gear @ World', 'any Heavy @ Gear', 'any Bond @ Ash',
    ]);
  });

  it('lists only the world personas under playing as', () => {
    expect(requirementOptions(input, 'Loose').personas).toEqual([
      { requirement: { kind: 'playingAs', id: 'aldric' }, label: 'playing as Sir Aldric', breadcrumb: ['Persona'], bearers: [] },
    ]);
  });

  it('carries the requirement each row adds, and scopes it to a picked bearer', () => {
    const options = requirementOptions(input, 'Loose');
    expect(options.traits[0].requirement).toEqual({ kind: 'trait', id: 'Paladin' });
    expect(options.groups[0].requirement).toEqual({ kind: 'group', id: 'Class' });
    expect(withBearer(options.traits[0].requirement, { kind: 'you' })).toEqual({ kind: 'trait', id: 'Paladin', bearer: { kind: 'you' } });
    expect(withBearer(options.traits[0].requirement)).toEqual({ kind: 'trait', id: 'Paladin' });
    expect(withBearer(options.personas[0].requirement, { kind: 'you' })).toEqual({ kind: 'playingAs', id: 'aldric' });
  });
});

describe('Always On traits', () => {
  const AO = (id: string, extra: Partial<Trait> = {}): Trait => T(id, { mode: 'alwaysOn', ...extra });
  // A curse is an Always On trait that requires the cursed item.
  const gear = [G('Gear', { maxPicks: 2 })];
  const curse = [T('Cursed Ring', { groupId: 'Gear' }), T('Lantern', { groupId: 'Gear' }), AO('Curse', { requires: [trait('Cursed Ring')] })];

  it('turns an ungated Always On trait on without a pick, and reports it as it joins', () => {
    const result = settle(world([AO('Scarred'), T('Brave')], [], ['Brave']));
    expect(result.active[WORLD_OWNER]).toEqual(['Brave', 'Scarred']);
    expect(result.returned).toEqual([{ ownerId: WORLD_OWNER, traitId: 'Scarred' }]);
  });

  it('brings the curse when its item is picked, and lifts it when the item drops', () => {
    const picked = switchTrait(world(curse, gear), WORLD_OWNER, 'Cursed Ring')!;
    expect(picked.active[WORLD_OWNER]).toEqual(['Cursed Ring', 'Curse']);
    const dropped = switchTrait(world(curse, gear, picked.active[WORLD_OWNER]), WORLD_OWNER, 'Cursed Ring', picked.cascadeOff)!;
    expect(dropped.active[WORLD_OWNER]).toEqual([]);
    expect(dropped.turnedOff).toEqual([{ ownerId: WORLD_OWNER, traitId: 'Curse' }]);
    // It returns by its mode, so it never waits on the cascade-off list.
    expect(dropped.cascadeOff[WORLD_OWNER]).toEqual([]);
    const again = switchTrait(world(curse, gear, dropped.active[WORLD_OWNER]), WORLD_OWNER, 'Cursed Ring', dropped.cascadeOff)!;
    expect(again.active[WORLD_OWNER]).toEqual(['Cursed Ring', 'Curse']);
    expect(again.returned).toEqual([{ ownerId: WORLD_OWNER, traitId: 'Curse' }]);
  });

  it('keeps a dormant Always On trait off without reporting it', () => {
    const result = settle(world(curse, gear, ['Lantern']));
    expect(result.active[WORLD_OWNER]).toEqual(['Lantern']);
    expect(result.turnedOff).toEqual([]);
    expect(result.returned).toEqual([]);
  });

  it('lets an Always On trait open the traits that require it', () => {
    const traits = [...curse, T('Dark Pact', { requires: [trait('Curse')] })];
    const result = settle(world(traits, gear, ['Cursed Ring', 'Dark Pact']));
    expect(result.active[WORLD_OWNER]).toEqual(['Cursed Ring', 'Dark Pact', 'Curse']);
  });

  it('refuses to switch an Always On trait in either direction', () => {
    expect(switchTrait(world([AO('Scarred')]), WORLD_OWNER, 'Scarred')).toBeNull();
    expect(switchTrait(world([AO('Scarred')], [], ['Scarred']), WORLD_OWNER, 'Scarred')).toBeNull();
    expect(switchTrait(world(curse, gear, ['Cursed Ring']), WORLD_OWNER, 'Curse')).toBeNull();
  });

  it('counts toward the max, so a full group refuses another pick', () => {
    const groups = [G('Marks', { maxPicks: 2 })];
    const traits = [AO('Scarred', { groupId: 'Marks' }), T('Tattoo', { groupId: 'Marks' }), T('Brand', { groupId: 'Marks' })];
    expect(switchTrait(world(traits, groups, ['Scarred', 'Tattoo']), WORLD_OWNER, 'Brand')).toBeNull();
    expect(switchTrait(world(traits, groups, ['Scarred']), WORLD_OWNER, 'Brand')?.active[WORLD_OWNER]).toEqual(['Scarred', 'Brand']);
  });

  it('counts toward the min, so dropping the other pick leaves the group short', () => {
    const groups = [G('Marks', { minPicks: 2 })];
    const traits = [AO('Scarred', { groupId: 'Marks' }), T('Tattoo', { groupId: 'Marks' })];
    const input = world(traits, groups, ['Scarred', 'Tattoo']);
    expect(groupPickStates(input).get(WORLD_OWNER)!.get('Marks')?.short).toBe(false);
    expect(underfills(input, WORLD_OWNER, 'Tattoo')).toBe(true);
  });

  it('refuses a max-one swap that would retire an active Always On sibling', () => {
    const groups = [G('Oath', { maxPicks: 1 })];
    const traits = [AO('Sworn', { groupId: 'Oath' }), T('Free', { groupId: 'Oath' })];
    expect(switchTrait(world(traits, groups, ['Sworn']), WORLD_OWNER, 'Free')).toBeNull();
    // A dormant Always On sibling blocks nothing.
    const gated = [AO('Sworn', { groupId: 'Oath', requires: [trait('Vow')] }), T('Free', { groupId: 'Oath' }), T('Vow')];
    expect(switchTrait(world(gated, groups), WORLD_OWNER, 'Free')?.active[WORLD_OWNER]).toEqual(['Free']);
  });

  it('joins a full group over its max and retires nothing (Q29)', () => {
    const groups = [G('Oath', { maxPicks: 1 })];
    const traits = [AO('Sworn', { groupId: 'Oath', requires: [trait('Vow')] }), T('Free', { groupId: 'Oath' }), T('Vow')];
    const result = switchTrait(world(traits, groups, ['Free']), WORLD_OWNER, 'Vow')!;
    expect(result.active[WORLD_OWNER]).toEqual(['Free', 'Vow', 'Sworn']);
    expect(result.turnedOff).toEqual([]);
  });

  it('treats Hidden as Always On (Q31)', () => {
    expect(settle(world([T('Secret', { mode: 'hidden' })])).active[WORLD_OWNER]).toEqual(['Secret']);
    expect(switchTrait(world([T('Secret', { mode: 'hidden' })], [], ['Secret']), WORLD_OWNER, 'Secret')).toBeNull();
  });

  it('behaves the same for an entity-owned trait, against that bearer alone', () => {
    const ash: GateOwner = { id: 'ash', name: 'Ash', groups: gear, traits: curse };
    const input: GateInput = {
      owners: [{ id: WORLD_OWNER, name: '', traits: [], groups: [] }, ash],
      active: { [WORLD_OWNER]: [], ash: [] }, entities: [], persona: { source: 'none' },
    };
    const picked = switchTrait(input, 'ash', 'Cursed Ring')!;
    expect(picked.active).toEqual({ [WORLD_OWNER]: [], ash: ['Cursed Ring', 'Curse'] });
    expect(switchTrait({ ...input, active: picked.active }, 'ash', 'Curse')).toBeNull();
  });

  describe('Always On traits over a max', () => {
    const over = (traits: Trait[], groups: TraitGroup[], extra: Partial<GateInput> = {}) => {
      const { active: _active, ...input } = world(traits, groups, [], extra);
      return alwaysOnOverMax(input).map((o) => `${o.ownerId}/${o.groupId}: ${o.traitIds.join(', ')}`);
    };
    const curses = [G('Curses', { maxPicks: 1 })];
    const weapons = [G('Weapon', { maxPicks: 1 })];

    it('reports ungated Always On traits past the max', () => {
      expect(over([AO('Weak', { groupId: 'Curses' }), AO('Slow', { groupId: 'Curses' })], curses))
        .toEqual([`${WORLD_OWNER}/Curses: Weak, Slow`]);
    });

    it('stays quiet at the max, and for a group with no max', () => {
      expect(over([AO('Weak', { groupId: 'Curses' })], curses)).toEqual([]);
      expect(over([AO('Weak', { groupId: 'Free' }), AO('Slow', { groupId: 'Free' })], [G('Free')])).toEqual([]);
    });

    it('stays quiet when only rival picks open the curses, since one selection never holds both', () => {
      const traits = [
        T('Sword', { groupId: 'Weapon' }), T('Axe', { groupId: 'Weapon' }),
        AO('Weak', { groupId: 'Curses', requires: [trait('Sword')] }), AO('Slow', { groupId: 'Curses', requires: [trait('Axe')] }),
      ];
      expect(over(traits, [...curses, ...weapons])).toEqual([]);
    });

    it('reports curses that one selection can open together', () => {
      const traits = [
        T('Sword', { groupId: 'Weapon' }), T('Ring'),
        AO('Weak', { groupId: 'Curses', requires: [trait('Sword')] }), AO('Slow', { groupId: 'Curses', requires: [trait('Ring')] }),
      ];
      expect(over(traits, [...curses, ...weapons])).toEqual([`${WORLD_OWNER}/Curses: Weak, Slow`]);
    });

    it('follows a chain down to rival roots', () => {
      const traits = [
        T('Sword', { groupId: 'Weapon' }), T('Axe', { groupId: 'Weapon' }),
        T('Blade Oath', { requires: [trait('Sword')] }),
        AO('Weak', { groupId: 'Curses', requires: [trait('Blade Oath')] }), AO('Slow', { groupId: 'Curses', requires: [trait('Axe')] }),
      ];
      expect(over(traits, [...curses, ...weapons])).toEqual([]);
    });

    it('never lets a gate open itself through a loop on the way to a clash', () => {
      // Slow's Pact opens through Slow itself or through the Axe, which Weak's Sword rules out.
      const traits = [
        T('Sword', { groupId: 'Weapon' }), T('Axe', { groupId: 'Weapon' }),
        T('Pact', { requires: [trait('Slow'), trait('Axe')] }),
        AO('Weak', { groupId: 'Curses', requires: [trait('Sword')] }), AO('Slow', { groupId: 'Curses', requires: [trait('Pact')] }),
      ];
      expect(over(traits, [...curses, ...weapons])).toEqual([]);
    });

    it('never counts a trait that can never unlock, or a loop that only opens itself', () => {
      const traits = [
        AO('Weak', { groupId: 'Curses' }),
        AO('Slow', { groupId: 'Curses', requires: [trait('Sun')] }),
        T('Sun', { requires: [trait('Moon')] }), T('Moon', { requires: [trait('Sun')] }),
      ];
      expect(over(traits, curses)).toEqual([]);
    });

    it('checks an entity-owned group against its own bearer', () => {
      const ash: GateOwner = {
        id: 'ash', name: 'Ash', groups: curses, traits: [AO('Weak', { groupId: 'Curses' }), AO('Slow', { groupId: 'Curses' })],
      };
      expect(over([], [], { owners: [world([]).owners[0], ash] })).toEqual(['ash/Curses: Weak, Slow']);
    });
  });

  describe('default selection', () => {
    const defaults = (traits: Trait[], groups: TraitGroup[] = []) => settleDefaults(world(traits, groups)).active[WORLD_OWNER];

    it('includes active Always On traits and ignores their Default field', () => {
      expect(defaults([AO('Scarred'), AO('Cursed', { isDefault: true, requires: [trait('Ring')] }), T('Ring')]))
        .toEqual(['Scarred']);
    });

    it('counts active Always On traits toward the max before the defaults, in authored order', () => {
      const groups = [G('Marks', { maxPicks: 2 })];
      expect(defaults([
        T('Tattoo', { groupId: 'Marks', isDefault: true, order: 0 }),
        T('Brand', { groupId: 'Marks', isDefault: true, order: 1 }),
        AO('Scarred', { groupId: 'Marks', order: 2 }),
      ], groups)).toEqual(['Tattoo', 'Scarred']);
    });

    it('counts an Always On trait a default opens toward its group’s max', () => {
      const groups = [G('Mark', { maxPicks: 1 })];
      expect(defaults([
        T('Brand', { groupId: 'Mark', isDefault: true }),
        AO('Curse', { groupId: 'Mark', requires: [trait('Ring')] }),
        T('Ring', { isDefault: true }),
      ], groups)).toEqual(['Curse', 'Ring']);
    });

    it('brings the Always On trait a default opens', () => {
      expect(defaults([T('Cursed Ring', { isDefault: true }), AO('Curse', { requires: [trait('Cursed Ring')] })]))
        .toEqual(['Cursed Ring', 'Curse']);
    });
  });
});
