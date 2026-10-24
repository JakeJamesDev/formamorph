import { describe, it, expect } from 'vitest';
import type { PersonaRef, Trait, TraitGroup, TraitRequirement } from '@/types';
import {
  NO_ACTIVE, alwaysOnOverMax, gateOf, gateStates, groupPickStates, neverUnlockable, requirementOptions, sameRequirement, settle, settleDefaults, shownRefs, switchTrait,
  underfills, withRequirementOwner, type GateInput, type GateOwner, type GateTree,
} from './traitGates';
import { playedEntityIds, scoped, withPart, type OwnerId } from './scope';

const T = (id: string, extra: Partial<Trait> = {}): Trait => ({ id, name: id, statChanges: [], ...extra });
const G = (id: string, extra: Partial<TraitGroup> = {}): TraitGroup => ({ id, name: id, parentId: null, ...extra });
const trait = (id: string): TraitRequirement => ({ kind: 'trait', id });
const you = (id: string): TraitRequirement => ({ kind: 'trait', id, owner: { kind: 'you' } });
const on = (entity: string, id: string): TraitRequirement => ({ kind: 'trait', id, owner: { kind: 'entity', id: entity } });

const world = (
  traits: Trait[],
  groups: TraitGroup[] = [],
  active: string[] = [],
  extra: Partial<GateInput> = {},
): GateInput => ({
  global: { traits, groups },
  owners: [],
  active: scoped(active),
  entities: [],
  persona: { source: 'none' } as PersonaRef,
  ...extra,
});

const unlocked = (input: GateInput, id: string, owner: OwnerId = null) => gateOf(gateStates(input), owner, id)?.unlocked;
const reason = (input: GateInput, id: string, owner: OwnerId = null) =>
  gateOf(gateStates(input), owner, id)?.rows.flatMap((row) => row.conditions).map((c) => c.text);

describe('gate states', () => {
  const classes = [T('Paladin'), T('Knight'), T('Plate Armor', { requires: [{ all: [trait('Paladin')] }, { all: [trait('Knight')] }] })];

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
    const wolf: GateOwner = { id: 'wolf', name: 'Ash', groups: [], traits: [T('Loyal', { requires: [{ all: [trait('Tamed')] }] })] };
    const states = gateStates(world([T('Brave')], [], [], { owners: [wolf] }));
    expect([...states.global.keys()]).toEqual(['Brave']);
    expect(Object.keys(states.owners)).toEqual(['wolf']);
    expect(gateOf(states, 'wolf', 'Loyal')?.unlocked).toBe(false);
    expect(gateOf(states, null, 'Loyal')).toBeUndefined();
  });

  it('flags a requirement on a Hidden trait, in the owner’s tree or only in the originals', () => {
    const traits = [T('Bond', { mode: 'hidden' }), T('Rite', { requires: [{ all: [trait('Bond')] }, { all: [trait('Omen')] }, { all: [trait('Knight')] }] }), T('Knight')];
    const input = world(traits, [], [], { originals: { traits: [T('Omen', { mode: 'hidden' })], groups: [] } });
    expect(gateOf(gateStates(input), null, 'Rite')?.rows.flatMap((row) => row.conditions).map((c) => [c.text, c.hidden])).toEqual([
      ['Bond', true], ['Omen', true], ['Knight', false],
    ]);
  });

  it('names every ref but a Hidden trait’s for the player', () => {
    const input = world([T('Bond', { mode: 'hidden' }), T('Knight')]);
    const refs = [{ ownerId: null, traitId: 'Bond' }, { ownerId: null, traitId: 'Knight' }];
    expect(shownRefs(input, refs)).toEqual([{ ownerId: null, traitId: 'Knight' }]);
  });
});

describe('requirement rows', () => {
  const ref = (traitId: string) => ({ ownerId: null, traitId });
  // Plate: Knight and Heavy. Banner: Knight and Heavy, or Merc.
  const plate = T('Plate', { requires: [{ all: [trait('Knight'), trait('Heavy')] }] });
  const banner = T('Banner', { requires: [{ all: [trait('Knight'), trait('Heavy')] }, { all: [trait('Merc')] }] });
  const traits = [T('Knight'), T('Heavy'), T('Merc'), plate, banner];

  it('holds a row only when every Condition in it holds', () => {
    expect(unlocked(world(traits, [], ['Knight']), 'Plate')).toBe(false);
    expect(unlocked(world(traits, [], ['Heavy']), 'Plate')).toBe(false);
    expect(unlocked(world(traits, [], ['Knight', 'Heavy']), 'Plate')).toBe(true);
  });

  it('holds a gate when any one row holds', () => {
    expect(unlocked(world(traits, [], ['Merc']), 'Banner')).toBe(true);
    expect(unlocked(world(traits, [], ['Knight']), 'Banner')).toBe(false);
  });

  it('reports each row and each Condition in it, in authored order', () => {
    const state = gateOf(gateStates(world(traits, [], ['Knight', 'Merc'])), null, 'Banner')!;
    expect(state.rows.map((row) => [row.holds, row.conditions.map((c) => [c.text, c.holds])])).toEqual([
      [false, [['Knight', true], ['Heavy', false]]],
      [true, [['Merc', true]]],
    ]);
    expect(gateOf(gateStates(world(traits)), null, 'Knight')).toEqual({ unlocked: true, rows: [] });
  });

  it('settles a pick off when its row loses one Condition, and brings it back through the cascade-off list', () => {
    const on = world(traits, [], ['Knight', 'Heavy', 'Plate']);
    expect(settle(on).active.global).toEqual(['Knight', 'Heavy', 'Plate']);
    const dropped = switchTrait(on, null, 'Heavy')!;
    expect(dropped.active.global).toEqual(['Knight']);
    expect(dropped.turnedOff).toEqual([ref('Plate')]);
    const back = switchTrait(world(traits, [], dropped.active.global), null, 'Heavy', dropped.cascadeOff)!;
    expect(back.active.global).toEqual(['Knight', 'Heavy', 'Plate']);
    expect(back.returned).toEqual([ref('Plate')]);
  });

  it('refuses to switch on a trait whose every row has a Condition unmet', () => {
    expect(switchTrait(world(traits, [], ['Knight']), null, 'Plate')).toBeNull();
    expect(switchTrait(world(traits, [], ['Knight', 'Heavy']), null, 'Plate')).not.toBeNull();
  });

  it('starts a gated default only when every Condition of a row starts too', () => {
    const defaults = (heavy: boolean) => world([
      T('Knight', { isDefault: true }), T('Heavy', { isDefault: heavy }),
      T('Plate', { isDefault: true, requires: [{ all: [trait('Knight'), trait('Heavy')] }] }),
    ]);
    expect(settleDefaults(defaults(false)).active.global).toEqual(['Knight']);
    expect(settleDefaults(defaults(true)).active.global).toEqual(['Knight', 'Heavy', 'Plate']);
  });

  it('finds a trait never unlockable when its only row loops back, and unlockable through a second row', () => {
    const loop = [
      T('Knight'), T('Oath', { requires: [{ all: [trait('Plate')] }] }),
      T('Plate', { requires: [{ all: [trait('Knight'), trait('Oath')] }] }),
    ];
    expect(neverUnlockable(world(loop))).toEqual([[ref('Oath'), ref('Plate')]]);
    const second = loop.map((t) => (t.id === 'Plate' ? { ...t, requires: [...t.requires!, { all: [trait('Knight')] }] } : t));
    expect(neverUnlockable(world(second))).toEqual([]);
  });

  it('opens Automatic traits together only through every Condition of a row', () => {
    // Knight and Rogue are max-one rivals, so a row needing both never opens.
    const groups = [G('Class', { maxPicks: 1 }), G('Auto', { maxPicks: 1 })];
    const auto = (rows: Trait['requires']) => world([
      T('Knight', { groupId: 'Class' }), T('Rogue', { groupId: 'Class' }), T('Heavy'), T('Merc'),
      T('Vigil', { groupId: 'Auto', mode: 'alwaysOn', requires: rows }),
      T('Watch', { groupId: 'Auto', mode: 'alwaysOn', requires: [{ all: [trait('Merc')] }] }),
    ], groups);
    expect(alwaysOnOverMax(auto([{ all: [trait('Knight'), trait('Rogue')] }]))).toEqual([]);
    expect(alwaysOnOverMax(auto([{ all: [trait('Knight'), trait('Heavy')] }])).map((o) => o.traitIds)).toEqual([['Vigil', 'Watch']]);
  });
});

describe('requirement kinds', () => {
  const groups = [G('Class'), G('Hybrid', { parentId: 'Class' })];
  const traits = [
    T('Mage', { groupId: 'Class' }),
    T('Spellblade', { groupId: 'Hybrid' }),
    T('Loose'),
    T('Cant', { requires: [{ all: [{ kind: 'group', id: 'Class' }] }] }),
  ];

  it('holds a group requirement when any trait below the group is active, however deep', () => {
    expect(unlocked(world(traits, groups), 'Cant')).toBe(false);
    expect(unlocked(world(traits, groups, ['Loose']), 'Cant')).toBe(false);
    expect(unlocked(world(traits, groups, ['Mage']), 'Cant')).toBe(true);
    expect(unlocked(world(traits, groups, ['Spellblade']), 'Cant')).toBe(true);
    expect(reason(world(traits, groups), 'Cant')).toEqual(['any Class']);
  });

  // Q6: a world group counts global items only, so a placed entity node never holds it up, played or not.
  it('never holds a world group requirement through an entity node placed inside the group', () => {
    const wolf: GateOwner = {
      id: 'wolf', name: 'Ash', parentGroupId: 'Hybrid', groups: [G('Bond')], traits: [T('Tamed', { groupId: 'Bond' })],
    };
    const entities = [{ id: 'wolf', name: 'Ash', persona: true }];
    const as = (persona: PersonaRef) => world(traits, groups, [], {
      owners: [wolf], active: scoped([], { wolf: ['Tamed'] }), entities, persona,
    });
    expect(unlocked(as({ source: 'none' }), 'Cant')).toBe(false);
    expect(unlocked(as({ source: 'world', entityId: 'wolf' }), 'Cant')).toBe(false);
  });

  it('holds playing-as only while the persona is that world entity', () => {
    const royal = [T('Royal Plate', { requires: [{ all: [{ kind: 'playingAs', id: 'aldric' }] }] })];
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
        { all: [{ kind: 'trait', id: 'gone', name: 'Thief' }] },
        { all: [{ kind: 'group', id: 'gone-group', name: 'Guilds' }] },
        { all: [{ kind: 'playingAs', id: 'gone-entity', name: 'Mara' }] },
        { all: [{ kind: 'trait', id: 'gone-2' }] },
        { all: [{ kind: 'group', id: 'gone-group-2' }] },
        { all: [{ kind: 'playingAs', id: 'gone-entity-2' }] },
      ],
    })];
    const input = world(gated, [], ['gone', 'gone-2'], { persona: { source: 'world', entityId: 'gone-entity' } });
    const state = gateOf(gateStates(input), null, 'Guild Mark')!;
    expect(state.unlocked).toBe(false);
    expect(state.rows.flatMap((row) => row.conditions).map((c) => c.text)).toEqual([
      'Thief', 'any Guilds', 'playing as Mara',
      'a missing trait', 'any trait in a missing group', 'playing as a missing persona',
    ]);
    expect(state.rows.every((row) => row.conditions.every((c) => c.unresolved))).toBe(true);
  });
});

describe('requirements per owner', () => {
  // The world's Smite requires Paladin. Albus links Paladin and Smite, so both owners hold both ids.
  const paladin = T('Paladin');
  const smite = T('Smite', { requires: [{ all: [trait('Paladin')] }] });
  const albus: GateOwner = { id: 'albus', name: 'Albus', groups: [], traits: [paladin, smite] };
  const mira: GateOwner = { id: 'mira', name: 'Mira', groups: [], traits: [T('Squire', { requires: [{ all: [you('Paladin')] }] })] };
  const entities = [{ id: 'albus', name: 'Albus', persona: true }, { id: 'mira', name: 'Mira' }];
  const input = (active: GateInput['active'], persona: PersonaRef = { source: 'none' }): GateInput => ({
    global: { traits: [paladin, smite], groups: [] },
    owners: [albus, mira],
    active, entities, persona,
  });

  it('never opens a gate through an active id the owner does not hold, so a dormant pick opens nothing', () => {
    // Under Albus, the global list still carries a Custom Persona pick global scope no longer holds.
    const dormant = input(scoped(['Halfling'], { albus: [] }), { source: 'world', entityId: 'albus' });
    const lucky = T('Lucky Step', { requires: [{ all: [trait('Halfling')] }] });
    const withLucky: GateInput = {
      ...dormant,
      owners: dormant.owners.map((o) => (o.id === 'albus' ? { ...o, traits: [...o.traits, lucky] } : o)),
      originals: { traits: [T('Halfling'), lucky], groups: [] },
    };
    expect(reason(withLucky, 'Lucky Step', 'albus')).toEqual(['Halfling']);
    expect(unlocked(withLucky, 'Lucky Step', 'albus')).toBe(false);
    expect(switchTrait(withLucky, 'albus', 'Lucky Step')).toBeNull();
  });

  it('never lets a same-owner requirement hold through another owner', () => {
    const albusOnly = input(scoped([], { albus: ['Paladin'] }));
    expect(unlocked(albusOnly, 'Smite', 'albus')).toBe(true);
    expect(unlocked(albusOnly, 'Smite', null)).toBe(false);
    expect(reason(albusOnly, 'Smite', null)).toEqual(['Paladin']);
    const globalOnly = input(scoped(['Paladin']));
    expect(unlocked(globalOnly, 'Smite', null)).toBe(true);
    expect(unlocked(globalOnly, 'Smite', 'albus')).toBe(false);
  });

  it('holds a named requirement through the named entity, wherever the trait sits', () => {
    const gated: GateOwner = { ...mira, traits: [T('Squire', { requires: [{ all: [on('albus', 'Paladin')] }] })] };
    const owners = [albus, gated];
    expect(unlocked({ ...input(scoped([], { albus: ['Paladin'] })), owners }, 'Squire', 'mira')).toBe(true);
    expect(unlocked({ ...input(scoped(['Paladin'], { mira: ['Paladin'] })), owners }, 'Squire', 'mira')).toBe(false);
    expect(reason({ ...input(NO_ACTIVE), owners }, 'Squire', 'mira')).toEqual(['Albus: Paladin']);
  });

  it('holds a You requirement through the player’s set, which a persona switch changes', () => {
    // Under None the player has no Paladin. Playing Albus, his Paladin is the player’s.
    expect(unlocked(input(scoped([], { albus: ['Paladin'] })), 'Squire', 'mira')).toBe(false);
    expect(unlocked(input(scoped(['Paladin'])), 'Squire', 'mira')).toBe(true);
    expect(unlocked(input(scoped([], { albus: ['Paladin'] }), { source: 'world', entityId: 'albus' }), 'Squire', 'mira')).toBe(true);
    expect(reason(input(NO_ACTIVE), 'Squire', 'mira')).toEqual(['Persona: Paladin']);
  });

  // Q7, Q11: the author reads the persona owner as Persona; the player reads the played persona's name.
  describe('the persona owner by reader', () => {
    const state = (gate: GateInput) => gateOf(gateStates(gate), 'mira', 'Squire')!.rows[0].conditions[0];
    const player = (persona: PersonaRef, extra: Partial<GateInput> = {}): GateInput => ({ ...input(NO_ACTIVE, persona), reader: 'player', ...extra });

    it('reads Persona to the author, whoever is played', () => {
      expect(reason(input(NO_ACTIVE, { source: 'world', entityId: 'albus' }), 'Squire', 'mira')).toEqual(['Persona: Paladin']);
      expect(state(input(NO_ACTIVE, { source: 'world', entityId: 'albus' })).persona).toBeUndefined();
    });

    it("reads the played world persona's name to the player, and names it for the mark", () => {
      expect(state(player({ source: 'world', entityId: 'albus' }))).toEqual({ text: 'Albus: Paladin', persona: 'Albus', holds: false, unresolved: false, hidden: false });
    });

    it('keeps Persona for a player with no played owner', () => {
      expect(state(player({ source: 'none' }))).toEqual({ text: 'Persona: Paladin', holds: false, unresolved: false, hidden: false });
    });

    it("reads the Custom Persona entity under None by its owner's name, the one the player entered", () => {
      const custom: GateOwner = { id: 'cp', name: 'Ash Vale', groups: [], traits: [] };
      const gate = player({ source: 'none' }, { owners: [albus, mira, custom], entities: [...entities, { id: 'cp', name: 'Wanderer', customPersona: true }] });
      expect(state(gate)).toMatchObject({ text: 'Ash Vale: Paladin', persona: 'Ash Vale' });
    });

    it("reads a library persona's name, not the Custom Persona entity's, when both are played", () => {
      const lib: GateOwner = { id: 'lib', name: 'Kate', groups: [], traits: [] };
      const gate = player({ source: 'library', entityId: 'lib' }, { owners: [albus, mira, lib], entities: [...entities, { id: 'cp', name: 'Wanderer', customPersona: true }] });
      expect(state(gate)).toMatchObject({ text: 'Kate: Paladin', persona: 'Kate' });
    });
  });

  // Q6 replaces Q74: a global trait never counts as the persona's, so the played persona's Paladin opens nothing.
  it('never reads a same-owner requirement on a root trait through the played persona', () => {
    const asAlbus = input(scoped([], { albus: ['Paladin'] }), { source: 'world', entityId: 'albus' });
    expect(unlocked(asAlbus, 'Smite', null)).toBe(false);
    expect(unlocked(input(scoped([], { albus: ['Paladin'] }), { source: 'world', entityId: 'mira' }), 'Smite', null)).toBe(false);
    expect(playedEntityIds({ source: 'library', entityId: 'lib' })).toEqual(['lib']);
  });

  it('counts the Custom Persona entity as the player under None and a library persona, never under a world persona', () => {
    const entities = [{ id: 'cp', name: 'Newcomer', customPersona: true }, { id: 'albus', name: 'Albus', persona: true }];
    expect(playedEntityIds({ source: 'none' }, entities)).toEqual(['cp']);
    expect(playedEntityIds({ source: 'library', entityId: 'lib' }, entities)).toEqual(['lib', 'cp']);
    expect(playedEntityIds({ source: 'world', entityId: 'albus' }, entities)).toEqual(['albus']);
  });

  it('names the target from the originals when no present owner holds it, and a gone owner by its stored name', () => {
    const squire = T('Squire', { requires: [{ all: [you('Cleric')] }, { all: [{ kind: 'trait', id: 'Paladin', owner: { kind: 'entity', id: 'gone', name: 'Old Albus' } }] }] });
    const owners = [{ ...mira, traits: [squire] }];
    const state = gateOf(gateStates({ ...input(NO_ACTIVE), owners, originals: { traits: [T('Cleric')], groups: [] } }), 'mira', 'Squire')!;
    expect(state.rows).toEqual([
      { holds: false, conditions: [{ text: 'Persona: Cleric', holds: false, unresolved: false, hidden: false }] },
      { holds: false, conditions: [{ text: 'Old Albus: Paladin', holds: false, unresolved: true, hidden: false }] },
    ]);
    expect(reason({ ...input(NO_ACTIVE), owners }, 'Squire', 'mira')?.[0]).toBe('Persona: a missing trait');
  });

  it('holds a named group requirement through that owner’s traits below the group', () => {
    const classes = G('Classes');
    const knight = T('Knight', { groupId: 'Classes' });
    const global: GateTree = { traits: [], groups: [] };
    const owners: GateOwner[] = [
      { id: 'albus', name: 'Albus', groups: [classes], traits: [knight] },
      { id: 'mira', name: 'Mira', groups: [], traits: [T('Squire', { requires: [{ all: [{ kind: 'group', id: 'Classes', owner: { kind: 'entity', id: 'albus' } }] }] })] },
    ];
    const at = (active: GateInput['active']) => ({ ...input(active), global, owners });
    expect(unlocked(at(scoped([], { albus: ['Knight'] })), 'Squire', 'mira')).toBe(true);
    expect(unlocked(at(scoped([], { mira: ['Knight'] })), 'Squire', 'mira')).toBe(false);
    expect(reason(at(NO_ACTIVE), 'Squire', 'mira')).toEqual(['Albus: any Classes']);
  });
});

describe('settle', () => {
  const ids = (refs: { traitId: string }[]) => refs.map((r) => r.traitId);

  it('keeps every proposed trait whose gate holds', () => {
    const traits = [T('Knight'), T('Plate Armor', { requires: [{ all: [trait('Knight')] }] })];
    const result = settle(world(traits, [], ['Knight', 'Plate Armor']));
    expect(result.active.global).toEqual(['Knight', 'Plate Armor']);
    expect(result.turnedOff).toEqual([]);
  });

  it('turns off a chain, dependents before their prerequisites', () => {
    // Tamed ← Pack Leader ← Beast Tamer, proposed with Tamed already dropped.
    const traits = [
      T('Beast Tamer', { requires: [{ all: [trait('Pack Leader')] }] }),
      T('Tamed'),
      T('Pack Leader', { requires: [{ all: [trait('Tamed')] }] }),
      T('Spare'),
    ];
    const result = settle(world(traits, [], ['Pack Leader', 'Beast Tamer', 'Spare']));
    expect(result.active.global).toEqual(['Spare']);
    expect(ids(result.turnedOff)).toEqual(['Beast Tamer', 'Pack Leader']);
  });

  it('orders the turned-off list the same way whatever order the traits are authored in', () => {
    const traits = [
      T('Pack Leader', { requires: [{ all: [trait('Tamed')] }] }),
      T('Beast Tamer', { requires: [{ all: [trait('Pack Leader')] }] }),
      T('Tamed'),
    ];
    const result = settle(world(traits, [], ['Pack Leader', 'Beast Tamer']));
    expect(ids(result.turnedOff)).toEqual(['Beast Tamer', 'Pack Leader']);
  });

  it('never lets two traits that require only each other hold each other up', () => {
    const traits = [T('Sun', { requires: [{ all: [trait('Moon')] }] }), T('Moon', { requires: [{ all: [trait('Sun')] }] })];
    const result = settle(world(traits, [], ['Sun', 'Moon']));
    expect(result.active.global).toEqual([]);
    expect(ids(result.turnedOff).sort()).toEqual(['Moon', 'Sun']);
  });

  it('keeps a mutual pair once a third trait opens one of them', () => {
    const traits = [
      T('Root'),
      T('Sun', { requires: [{ all: [trait('Moon')] }, { all: [trait('Root')] }] }),
      T('Moon', { requires: [{ all: [trait('Sun')] }] }),
    ];
    expect(settle(world(traits, [], ['Root', 'Sun', 'Moon'])).active.global).toEqual(['Root', 'Sun', 'Moon']);
  });

  it('settles each owner against its own set and reports each trait with its owner', () => {
    const paladin = T('Paladin');
    const loyal = T('Loyal', { requires: [{ all: [trait('Paladin')] }] });
    const wolf: GateOwner = { id: 'wolf', name: 'Ash', groups: [], traits: [paladin, loyal] };
    const input = (active: GateInput['active']): GateInput => ({
      global: { traits: [paladin, loyal, T('Rogue')], groups: [] },
      owners: [wolf],
      active, entities: [], persona: { source: 'none' },
    });
    // The global Paladin never holds Ash's Loyal up.
    const crossed = settle(input(scoped(['Rogue', 'Paladin'], { wolf: ['Loyal'] })));
    expect(crossed.active).toEqual({ global: ['Rogue', 'Paladin'], owners: { wolf: [] } });
    expect(crossed.turnedOff).toEqual([{ ownerId: 'wolf', traitId: 'Loyal' }]);
    // Each owner's own Paladin holds its own Loyal; the same id turns off in one owner and stays in the other.
    const own = settle(input(scoped(['Loyal'], { wolf: ['Paladin', 'Loyal'] })));
    expect(own.active).toEqual({ global: [], owners: { wolf: ['Paladin', 'Loyal'] } });
    expect(own.turnedOff).toEqual([{ ownerId: null, traitId: 'Loyal' }]);
    expect(own.cascadeOff).toEqual({ global: ['Loyal'], owners: { wolf: [] } });
  });

  it('cascades a named requirement off when the named owner drops the target', () => {
    const wolf: GateOwner = { id: 'wolf', name: 'Ash', groups: [], traits: [T('Tamed')] };
    const tamer = T('Beast Tamer', { requires: [{ all: [on('wolf', 'Tamed')] }] });
    const input = (active: GateInput['active']): GateInput => ({
      global: { traits: [tamer], groups: [] }, owners: [wolf], active, entities: [], persona: { source: 'none' },
    });
    expect(settle(input(scoped(['Beast Tamer'], { wolf: ['Tamed'] }))).turnedOff).toEqual([]);
    expect(settle(input(scoped(['Beast Tamer'], { wolf: [] }))).turnedOff).toEqual([{ ownerId: null, traitId: 'Beast Tamer' }]);
  });

  it('turns off a playing-as trait when the persona changes away', () => {
    const traits = [T('Royal Plate', { requires: [{ all: [{ kind: 'playingAs', id: 'aldric' }] }] })];
    const entities = [{ id: 'aldric', name: 'Sir Aldric', persona: true }];
    const as = (persona: PersonaRef) => settle(world(traits, [], ['Royal Plate'], { entities, persona }));
    expect(as({ source: 'world', entityId: 'aldric' }).turnedOff).toEqual([]);
    expect(ids(as({ source: 'none' }).turnedOff)).toEqual(['Royal Plate']);
  });

  it('turns off a You trait when the persona changes away from the owner that met it', () => {
    const albus: GateOwner = { id: 'albus', name: 'Albus', groups: [], traits: [T('Paladin')] };
    const squire = T('Squire', { requires: [{ all: [you('Paladin')] }] });
    const mira: GateOwner = { id: 'mira', name: 'Mira', groups: [], traits: [squire] };
    const as = (persona: PersonaRef) => settle({
      global: { traits: [], groups: [] },
      owners: [albus, mira],
      active: scoped([], { albus: ['Paladin'], mira: ['Squire'] }),
      entities: [{ id: 'albus', name: 'Albus', persona: true }], persona,
    });
    expect(as({ source: 'world', entityId: 'albus' }).turnedOff).toEqual([]);
    expect(as({ source: 'none' }).turnedOff).toEqual([{ ownerId: 'mira', traitId: 'Squire' }]);
  });

  it('turns off a trait whose only requirement is unresolved', () => {
    const traits = [T('Guild Mark', { requires: [{ all: [{ kind: 'trait', id: 'gone', name: 'Thief' }] }] })];
    expect(ids(settle(world(traits, [], ['Guild Mark', 'gone'])).turnedOff)).toEqual(['Guild Mark']);
  });

  it('leaves an active id the owner no longer holds alone', () => {
    expect(settle(world([T('Knight')], [], ['deleted', 'Knight'])).active.global).toEqual(['deleted', 'Knight']);
  });
});

describe('return after a cascade', () => {
  const traits = [
    T('Tamed'),
    T('Pack Leader', { requires: [{ all: [trait('Tamed')] }] }),
    T('Beast Tamer', { requires: [{ all: [trait('Pack Leader')] }] }),
  ];

  it('switches cascade-off traits back on, chain and all, once their gate holds again', () => {
    const result = settle(world(traits, [], ['Tamed']), scoped(['Beast Tamer', 'Pack Leader']));
    expect(result.active.global).toEqual(['Tamed', 'Pack Leader', 'Beast Tamer']);
    expect(result.returned.map((r) => r.traitId)).toEqual(['Pack Leader', 'Beast Tamer']);
    expect(result.cascadeOff.global).toEqual([]);
  });

  it('keeps a cascade-off trait off while its gate still fails', () => {
    const result = settle(world(traits, [], []), scoped(['Pack Leader']));
    expect(result.active.global).toEqual([]);
    expect(result.returned).toEqual([]);
    expect(result.cascadeOff.global).toEqual(['Pack Leader']);
  });

  it('never returns a trait the player switched off by hand', () => {
    const result = settle(world(traits, [], ['Tamed']), NO_ACTIVE);
    expect(result.active.global).toEqual(['Tamed']);
    expect(result.returned).toEqual([]);
  });

  it('records a new cascade in the cascade-off list', () => {
    const result = settle(world(traits, [], ['Pack Leader', 'Beast Tamer']));
    expect(result.cascadeOff.global).toEqual(['Beast Tamer', 'Pack Leader']);
  });

  it('returns a trait to the owner whose list held it, not to another owner with the same id', () => {
    const wolf: GateOwner = { id: 'wolf', name: 'Ash', groups: [], traits };
    const input: GateInput = {
      global: { traits, groups: [] }, owners: [wolf],
      active: scoped([], { wolf: ['Tamed'] }), entities: [], persona: { source: 'none' },
    };
    const result = settle(input, scoped(['Pack Leader'], { wolf: ['Pack Leader'] }));
    expect(result.active).toEqual({ global: [], owners: { wolf: ['Tamed', 'Pack Leader'] } });
    expect(result.returned).toEqual([{ ownerId: 'wolf', traitId: 'Pack Leader' }]);
    expect(result.cascadeOff).toEqual({ global: ['Pack Leader'], owners: { wolf: [] } });
  });

  it('keeps a returning trait off when the player has picked its exclusive sibling since, and forgets it', () => {
    const groups = [G('Stance', { maxPicks: 1 })];
    const stances = [
      T('Knight'),
      T('Shield Wall', { groupId: 'Stance', requires: [{ all: [trait('Knight')] }] }),
      T('Charge', { groupId: 'Stance' }),
    ];
    const result = settle(world(stances, groups, ['Knight', 'Charge']), scoped(['Shield Wall']));
    expect(result.active.global).toEqual(['Knight', 'Charge']);
    expect(result.returned).toEqual([]);
    expect(result.cascadeOff.global).toEqual([]);
  });

  it('returns only one of two exclusive siblings that wait together', () => {
    const groups = [G('Stance', { maxPicks: 1 })];
    const stances = [
      T('Knight'),
      T('Shield Wall', { groupId: 'Stance', order: 0, requires: [{ all: [trait('Knight')] }] }),
      T('Guard', { groupId: 'Stance', order: 1, requires: [{ all: [trait('Knight')] }] }),
    ];
    const result = settle(world(stances, groups, ['Knight']), scoped(['Guard', 'Shield Wall']));
    expect(result.active.global).toEqual(['Knight', 'Shield Wall']);
    expect(result.cascadeOff.global).toEqual(['Guard']);
  });
});

describe('switching a trait', () => {
  const groups = [G('Class', { maxPicks: 1 })];
  const traits = [
    T('Paladin', { groupId: 'Class' }),
    T('Knight', { groupId: 'Class' }),
    T('Rogue', { groupId: 'Class' }),
    T('Plate Armor', { requires: [{ all: [trait('Paladin')] }, { all: [trait('Knight')] }] }),
    T('Shield', { requires: [{ all: [trait('Plate Armor')] }] }),
  ];
  const input = (active: string[]) => world(traits, groups, active);

  it('retires the exclusive siblings, then turns off what they held up', () => {
    const result = switchTrait(input(['Knight', 'Plate Armor', 'Shield']), null, 'Rogue')!;
    expect(result.active.global).toEqual(['Rogue']);
    expect(result.turnedOff.map((r) => r.traitId)).toEqual(['Shield', 'Plate Armor']);
  });

  it('keeps a dependent that a picked sibling still holds up', () => {
    const result = switchTrait(input(['Knight', 'Plate Armor']), null, 'Paladin')!;
    expect(result.active.global).toEqual(['Plate Armor', 'Paladin']);
    expect(result.turnedOff).toEqual([]);
  });

  it('turns a trait off, and its dependents with it', () => {
    const result = switchTrait(input(['Knight', 'Plate Armor']), null, 'Knight')!;
    expect(result.active.global).toEqual([]);
    expect(result.turnedOff.map((r) => r.traitId)).toEqual(['Plate Armor']);
  });

  it('unlocks a dependent the moment its requirement is picked', () => {
    const picked = switchTrait(input([]), null, 'Knight')!;
    expect(unlocked({ ...input([]), active: picked.active }, 'Plate Armor')).toBe(true);
  });

  it('refuses to switch on a locked trait', () => {
    expect(switchTrait(input(['Rogue']), null, 'Plate Armor')).toBeNull();
  });

  it('refuses a switch in the owner whose copy is locked, and allows it in the owner whose copy is open', () => {
    const paladin = T('Paladin');
    const smite = T('Smite', { requires: [{ all: [trait('Paladin')] }] });
    const two: GateInput = {
      global: { traits: [paladin, smite], groups: [] }, owners: [{ id: 'albus', name: 'Albus', groups: [], traits: [paladin, smite] }],
      active: scoped([], { albus: ['Paladin'] }), entities: [], persona: { source: 'none' },
    };
    expect(switchTrait(two, null, 'Smite')).toBeNull();
    expect(switchTrait(two, 'albus', 'Smite')?.active).toEqual({ global: [], owners: { albus: ['Paladin', 'Smite'] } });
  });

  it('never lets an exclusive sibling hold a trait up, since picking the trait retires it', () => {
    const armor = [G('Armor', { maxPicks: 1 })];
    const pieces = [
      T('Chain Mail', { groupId: 'Armor' }),
      T('Heavy Plate', { groupId: 'Armor', requires: [{ all: [trait('Chain Mail')] }] }),
      T('Any Armor', { groupId: 'Armor', requires: [{ all: [{ kind: 'group', id: 'Armor' }] }] }),
    ];
    const picked = world(pieces, armor, ['Chain Mail']);
    expect(unlocked(picked, 'Heavy Plate')).toBe(false);
    expect(unlocked(picked, 'Any Armor')).toBe(false);
    expect(switchTrait(picked, null, 'Heavy Plate')).toBeNull();
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
    expect(switchTrait(input(['Archery', 'Stealth']), null, 'Lore')).toBeNull();
  });

  it('allows a switch-on below the max, keeping every pick', () => {
    expect(switchTrait(input(['Archery']), null, 'Lore')?.active.global).toEqual(['Archery', 'Lore']);
  });

  it('allows a switch-off in a full group', () => {
    expect(switchTrait(input(['Archery', 'Stealth']), null, 'Stealth')?.active.global).toEqual(['Archery']);
  });

  it('counts only the traits placed directly in the group', () => {
    expect(switchTrait(input(['Archery', 'Herbs']), null, 'Lore')?.active.global).toEqual(['Archery', 'Herbs', 'Lore']);
  });

  it('applies the cap to an entity-owned group', () => {
    const ash: GateOwner = { id: 'ash', name: 'Ash', groups, traits };
    const two: GateInput = { ...world([], []), owners: [ash], active: scoped([], { ash: ['Archery', 'Stealth'] }) };
    expect(switchTrait(two, 'ash', 'Lore')).toBeNull();
    expect(switchTrait({ ...two, active: withPart(two.active, 'ash', ['Archery']) }, 'ash', 'Lore')?.active.owners.ash).toEqual(['Archery', 'Lore']);
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
    expect(underfills(input(['Archery', 'Stealth']), null, 'Stealth')).toBe(true);
  });

  it('allows a switch-off that keeps the group at its minimum', () => {
    expect(underfills(input(['Archery', 'Stealth', 'Lore']), null, 'Lore')).toBe(false);
  });

  it('refuses a switch-off in a group that is already short', () => {
    expect(underfills(input(['Archery']), null, 'Archery')).toBe(true);
  });

  it('counts only the traits placed directly in the group', () => {
    expect(underfills(input(['Archery', 'Stealth', 'Herbs']), null, 'Herbs')).toBe(false);
  });

  it('never refuses a switch-on, or a trait that is off', () => {
    expect(underfills(input(['Archery']), null, 'Lore')).toBe(false);
  });

  it('refuses a switch-off of the one pick in an Exactly One group', () => {
    expect(underfills(input(['Paladin']), null, 'Paladin')).toBe(true);
  });

  it('applies the minimum to an entity-owned group, against that owner alone', () => {
    const ash: GateOwner = { id: 'ash', name: 'Ash', groups, traits };
    const two: GateInput = { ...input([]), owners: [ash], active: scoped(['Archery', 'Stealth', 'Lore'], { ash: ['Archery', 'Stealth'] }) };
    expect(underfills(two, 'ash', 'Stealth')).toBe(true);
    expect(underfills(two, null, 'Stealth')).toBe(false);
  });

  it('leaves the setup switch free, so Begin gates the short group instead', () => {
    expect(switchTrait(input(['Archery', 'Stealth']), null, 'Stealth')?.active.global).toEqual(['Archery']);
  });
});

describe('a short group after a cascade', () => {
  const groups = [G('Oath', { minPicks: 1 })];
  const traits = [T('Knight'), T('Vow', { groupId: 'Oath', requires: [{ all: [trait('Knight')] }] }), T('Pledge', { groupId: 'Oath', requires: [{ all: [trait('Knight')] }] })];

  it('lets a cascade drop the group below its minimum', () => {
    const result = switchTrait(world(traits, groups, ['Knight', 'Vow']), null, 'Knight')!;
    expect(result.active.global).toEqual([]);
    expect(result.turnedOff.map((r) => r.traitId)).toEqual(['Vow']);
    expect(groupPickStates({ ...world(traits, groups), active: result.active }).global.get('Oath')?.short).toBe(true);
  });

  it('fills the group again when the trait returns', () => {
    const result = settle(world(traits, groups, ['Knight']), scoped(['Vow']));
    expect(result.active.global).toEqual(['Knight', 'Vow']);
    expect(groupPickStates({ ...world(traits, groups), active: result.active }).global.get('Oath')?.short).toBe(false);
  });
});

describe('group pick states', () => {
  const groups = [G('Class', { minPicks: 1, maxPicks: 1 }), G('Skills', { minPicks: 2, maxPicks: 3 }), G('Folder'), G('Sub', { parentId: 'Skills' })];
  const traits = [
    T('Paladin', { groupId: 'Class' }), T('Knight', { groupId: 'Class' }),
    T('Archery', { groupId: 'Skills' }), T('Stealth', { groupId: 'Skills' }), T('Lore', { groupId: 'Skills' }),
    T('Herbs', { groupId: 'Sub' }), T('Map', { groupId: 'Folder' }),
  ];
  const states = (active: string[]) => groupPickStates(world(traits, groups, active)).global;

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

  it('reports each owner against its own active set', () => {
    const ash: GateOwner = { id: 'ash', name: 'Ash', groups, traits };
    const input: GateInput = { ...world(traits, groups), owners: [ash], active: scoped([], { ash: ['Knight'] }) };
    const all = groupPickStates(input);
    expect(all.global.get('Class')?.count).toBe(0);
    expect(all.owners.ash!.get('Class')?.count).toBe(1);
  });
});

describe('default selection', () => {
  const defaults = (traits: Trait[], groups: TraitGroup[] = []) =>
    settleDefaults(world(traits, groups)).active.global;

  it('keeps a gated default whose requirement is also a default', () => {
    expect(defaults([T('Knight', { isDefault: true }), T('Plate', { isDefault: true, requires: [{ all: [trait('Knight')] }] })]))
      .toEqual(['Knight', 'Plate']);
  });

  it('starts a gated default unselected when its requirement is not a default', () => {
    expect(defaults([T('Knight'), T('Plate', { isDefault: true, requires: [{ all: [trait('Knight')] }] })])).toEqual([]);
  });

  it('starts two defaults that require only each other unselected', () => {
    expect(defaults([
      T('Sun', { isDefault: true, requires: [{ all: [trait('Moon')] }] }),
      T('Moon', { isDefault: true, requires: [{ all: [trait('Sun')] }] }),
    ])).toEqual([]);
  });

  it('collapses exclusive defaults to the first, then drops what only the second held up', () => {
    const groups = [G('Class', { maxPicks: 1 })];
    expect(defaults([
      T('Paladin', { groupId: 'Class', isDefault: true, order: 0 }),
      T('Knight', { groupId: 'Class', isDefault: true, order: 1 }),
      T('Lance', { isDefault: true, requires: [{ all: [trait('Knight')] }] }),
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
    expect(settleDefaults({ ...rest, owners: [ash] }).active.owners.ash).toEqual(['Archery', 'Stealth']);
  });
});

describe('never-unlockable sets', () => {
  const sets = (traits: Trait[], groups: TraitGroup[] = [], extra: Partial<GateInput> = {}) =>
    neverUnlockable(world(traits, groups, [], extra)).map((set) => set.map((r) => r.traitId).sort());

  it('passes a loop that a third trait opens', () => {
    expect(sets([
      T('A', { requires: [{ all: [trait('B')] }, { all: [trait('C')] }] }),
      T('B', { requires: [{ all: [trait('A')] }] }),
      T('C'),
    ])).toEqual([]);
  });

  it('reports a loop with no open root, and each separate loop as its own set', () => {
    expect(sets([
      T('A', { requires: [{ all: [trait('B')] }] }),
      T('B', { requires: [{ all: [trait('A')] }] }),
      T('X', { requires: [{ all: [trait('Y')] }] }),
      T('Y', { requires: [{ all: [trait('X')] }] }),
      T('Free'),
    ])).toEqual([['A', 'B'], ['X', 'Y']]);
  });

  it('puts a trait that hangs off a closed loop in the loop\'s set', () => {
    expect(sets([
      T('A', { requires: [{ all: [trait('B')] }] }),
      T('B', { requires: [{ all: [trait('A')] }] }),
      T('Tail', { requires: [{ all: [trait('B')] }] }),
    ])).toEqual([['A', 'B', 'Tail']]);
  });

  it('opens through a group only when the group holds an unlockable trait', () => {
    const groups = [G('Class')];
    expect(sets([T('Mage', { groupId: 'Class' }), T('Cant', { requires: [{ all: [{ kind: 'group', id: 'Class' }] }] })], groups))
      .toEqual([]);
    expect(sets([
      T('Mage', { groupId: 'Class', requires: [{ all: [trait('Cant')] }] }),
      T('Cant', { requires: [{ all: [{ kind: 'group', id: 'Class' }] }] }),
    ], groups)).toEqual([['Cant', 'Mage']]);
  });

  it('opens through playing as a world persona, never through an entity no one can play', () => {
    const royal = [T('Royal Plate', { requires: [{ all: [{ kind: 'playingAs', id: 'aldric' }] }] })];
    expect(sets(royal, [], { entities: [{ id: 'aldric', name: 'Sir Aldric', persona: true }] })).toEqual([]);
    expect(sets(royal, [], { entities: [{ id: 'aldric', name: 'Sir Aldric' }] })).toEqual([['Royal Plate']]);
    expect(sets(royal)).toEqual([['Royal Plate']]);
  });

  it('reports a linked trait stuck on the owner that lacks its requirement, and open on the one that has it', () => {
    // Smite requires Faithful, both Blueprints. The world tree holds both; Albus links Smite alone.
    const blueprints = G('bp', { system: 'blueprints' });
    const smite = T('Smite', { groupId: 'bp', requires: [{ all: [trait('Faithful')] }] });
    const input: Omit<GateInput, 'active'> = {
      global: { traits: [T('Faithful', { groupId: 'bp' }), smite], groups: [blueprints] },
      owners: [{ id: 'albus', name: 'Albus', groups: [], traits: [smite] }],
      entities: [], persona: { source: 'none' },
    };
    expect(neverUnlockable(input)).toEqual([[{ ownerId: 'albus', traitId: 'Smite' }]]);
    // Q10: a global Faithful reads global scope from Albus's trait too, so nothing is stuck.
    const ungrouped = (tree: GateTree): GateTree => ({ groups: [], traits: tree.traits.map((t) => ({ ...t, groupId: null })) });
    const global = { ...input, global: ungrouped(input.global), owners: input.owners.map((o) => ({ ...o, ...ungrouped(o) })) };
    expect(neverUnlockable(global)).toEqual([]);
    // A You requirement opens through the played entity that holds the target, and only under a played one (Q13).
    const mira: GateOwner = { id: 'mira', name: 'Mira', groups: [], traits: [T('Faithful', { groupId: 'bp' })] };
    const named = {
      ...input,
      owners: [{ ...input.owners[0], traits: [T('Smite', { requires: [{ all: [you('Faithful')] }] })] }, mira],
      entities: [{ id: 'mira', name: 'Mira', persona: true }],
    };
    expect(neverUnlockable({ ...named, persona: { source: 'world', entityId: 'mira' } })).toEqual([]);
    expect(neverUnlockable(named)).toEqual([[{ ownerId: 'albus', traitId: 'Smite' }]]);
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
    global: { traits, groups },
    owners: [wolf],
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

  // Q10: a global target offers no owner; an entity's target offers You and every entity that owns it.
  it('lists a target once, where the first owner holds it, with owners for an entity target only', () => {
    const albus: GateOwner = { id: 'albus', name: 'Albus', groups: [G('Class', { maxPicks: 1 })], traits: [T('Paladin', { groupId: 'Class' }), T('Oath')] };
    const options = requirementOptions({ ...input, owners: [...input.owners, albus] }, 'Loose');
    expect(rows(options.traits)).toEqual(['Paladin @ Class', 'Knight @ Class', 'Plate Armor @ Gear › Heavy', 'Tamed @ Ash › Bond', 'Oath @ Albus']);
    const owners = (label: string) => options.traits.find((o) => o.label === label)?.owners.map((b) => b.name);
    expect(owners('Paladin')).toEqual([]);
    expect(owners('Knight')).toEqual([]);
    expect(owners('Tamed')).toEqual(['Persona', 'Ash']);
    expect(owners('Oath')).toEqual(['Persona', 'Albus']);
    expect(options.traits.find((o) => o.label === 'Oath')?.owners[1].owner).toEqual({ kind: 'entity', id: 'albus', name: 'Albus' });
    expect(options.groups.find((o) => o.label === 'any Class')?.owners).toEqual([]);
  });

  it('leaves out a group that holds only the trait and its exclusive siblings, and keeps one with another way in', () => {
    const labels = requirementOptions(input, 'Paladin').groups.map((o) => o.label);
    expect(labels).not.toContain('any Class');
    expect(labels).toContain('any Gear');
    // A parent group holds the exclusive one plus a trait of its own, so it can still unlock Paladin.
    const nested = {
      ...input,
      global: {
        groups: [G('Martial'), G('Class', { maxPicks: 1, parentId: 'Martial' })],
        traits: [...traits.filter((t) => t.groupId === 'Class'), T('Brawler', { groupId: 'Martial' })],
      },
      owners: [wolf],
    };
    expect(requirementOptions(nested, 'Paladin').groups.map((o) => o.label)).toContain('any Martial');
    // An empty group is offered: it can open the trait once the author fills it.
    const empty = { ...input, global: { ...input.global, groups: [...groups, G('Oaths')] }, owners: [wolf] };
    expect(requirementOptions(empty, 'Paladin').groups.map((o) => o.label)).toContain('any Oaths');
  });

  it('lists every group as "any" with its parent path', () => {
    expect(rows(requirementOptions(input, 'Loose').groups)).toEqual([
      'any Class @ World', 'any Gear @ World', 'any Heavy @ Gear', 'any Bond @ Ash',
    ]);
  });

  it('lists only the world personas under playing as', () => {
    expect(requirementOptions(input, 'Loose').personas).toEqual([
      { requirement: { kind: 'playingAs', id: 'aldric' }, label: 'playing as Sir Aldric', breadcrumb: ['Persona'], owners: [] },
    ]);
  });

  it('carries the requirement each row adds, and scopes it to a picked owner', () => {
    const options = requirementOptions(input, 'Loose');
    expect(options.traits[0].requirement).toEqual({ kind: 'trait', id: 'Paladin' });
    expect(options.groups[0].requirement).toEqual({ kind: 'group', id: 'Class' });
    expect(withRequirementOwner(options.traits[0].requirement, { kind: 'you' })).toEqual({ kind: 'trait', id: 'Paladin', owner: { kind: 'you' } });
    expect(withRequirementOwner(options.traits[0].requirement)).toEqual({ kind: 'trait', id: 'Paladin' });
    expect(withRequirementOwner(options.personas[0].requirement, { kind: 'you' })).toEqual({ kind: 'playingAs', id: 'aldric' });
  });
});

describe('Always On traits', () => {
  const AO = (id: string, extra: Partial<Trait> = {}): Trait => T(id, { mode: 'alwaysOn', ...extra });
  // A curse is an Always On trait that requires the cursed item.
  const gear = [G('Gear', { maxPicks: 2 })];
  const curse = [T('Cursed Ring', { groupId: 'Gear' }), T('Lantern', { groupId: 'Gear' }), AO('Curse', { requires: [{ all: [trait('Cursed Ring')] }] })];

  it('turns an ungated Always On trait on without a pick, and reports it as it joins', () => {
    const result = settle(world([AO('Scarred'), T('Brave')], [], ['Brave']));
    expect(result.active.global).toEqual(['Brave', 'Scarred']);
    expect(result.returned).toEqual([{ ownerId: null, traitId: 'Scarred' }]);
  });

  it('brings the curse when its item is picked, and lifts it when the item drops', () => {
    const picked = switchTrait(world(curse, gear), null, 'Cursed Ring')!;
    expect(picked.active.global).toEqual(['Cursed Ring', 'Curse']);
    const dropped = switchTrait(world(curse, gear, picked.active.global), null, 'Cursed Ring', picked.cascadeOff)!;
    expect(dropped.active.global).toEqual([]);
    expect(dropped.turnedOff).toEqual([{ ownerId: null, traitId: 'Curse' }]);
    // It returns by its mode, so it never waits on the cascade-off list.
    expect(dropped.cascadeOff.global).toEqual([]);
    const again = switchTrait(world(curse, gear, dropped.active.global), null, 'Cursed Ring', dropped.cascadeOff)!;
    expect(again.active.global).toEqual(['Cursed Ring', 'Curse']);
    expect(again.returned).toEqual([{ ownerId: null, traitId: 'Curse' }]);
  });

  it('keeps a dormant Always On trait off without reporting it', () => {
    const result = settle(world(curse, gear, ['Lantern']));
    expect(result.active.global).toEqual(['Lantern']);
    expect(result.turnedOff).toEqual([]);
    expect(result.returned).toEqual([]);
  });

  it('lets an Always On trait open the traits that require it', () => {
    const traits = [...curse, T('Dark Pact', { requires: [{ all: [trait('Curse')] }] })];
    const result = settle(world(traits, gear, ['Cursed Ring', 'Dark Pact']));
    expect(result.active.global).toEqual(['Cursed Ring', 'Dark Pact', 'Curse']);
  });

  it('refuses to switch an Always On trait in either direction', () => {
    expect(switchTrait(world([AO('Scarred')]), null, 'Scarred')).toBeNull();
    expect(switchTrait(world([AO('Scarred')], [], ['Scarred']), null, 'Scarred')).toBeNull();
    expect(switchTrait(world(curse, gear, ['Cursed Ring']), null, 'Curse')).toBeNull();
  });

  it('counts toward the max, so a full group refuses another pick', () => {
    const groups = [G('Marks', { maxPicks: 2 })];
    const traits = [AO('Scarred', { groupId: 'Marks' }), T('Tattoo', { groupId: 'Marks' }), T('Brand', { groupId: 'Marks' })];
    expect(switchTrait(world(traits, groups, ['Scarred', 'Tattoo']), null, 'Brand')).toBeNull();
    expect(switchTrait(world(traits, groups, ['Scarred']), null, 'Brand')?.active.global).toEqual(['Scarred', 'Brand']);
  });

  it('counts toward the min, so dropping the other pick leaves the group short', () => {
    const groups = [G('Marks', { minPicks: 2 })];
    const traits = [AO('Scarred', { groupId: 'Marks' }), T('Tattoo', { groupId: 'Marks' })];
    const input = world(traits, groups, ['Scarred', 'Tattoo']);
    expect(groupPickStates(input).global.get('Marks')?.short).toBe(false);
    expect(underfills(input, null, 'Tattoo')).toBe(true);
  });

  it('refuses a max-one swap that would retire an active Always On sibling', () => {
    const groups = [G('Oath', { maxPicks: 1 })];
    const traits = [AO('Sworn', { groupId: 'Oath' }), T('Free', { groupId: 'Oath' })];
    expect(switchTrait(world(traits, groups, ['Sworn']), null, 'Free')).toBeNull();
    // A dormant Always On sibling blocks nothing.
    const gated = [AO('Sworn', { groupId: 'Oath', requires: [{ all: [trait('Vow')] }] }), T('Free', { groupId: 'Oath' }), T('Vow')];
    expect(switchTrait(world(gated, groups), null, 'Free')?.active.global).toEqual(['Free']);
  });

  it('joins a full group over its max and retires nothing (Q29)', () => {
    const groups = [G('Oath', { maxPicks: 1 })];
    const traits = [AO('Sworn', { groupId: 'Oath', requires: [{ all: [trait('Vow')] }] }), T('Free', { groupId: 'Oath' }), T('Vow')];
    const result = switchTrait(world(traits, groups, ['Free']), null, 'Vow')!;
    expect(result.active.global).toEqual(['Free', 'Vow', 'Sworn']);
    expect(result.turnedOff).toEqual([]);
  });

  it('treats Hidden as Always On (Q31)', () => {
    expect(settle(world([T('Secret', { mode: 'hidden' })])).active.global).toEqual(['Secret']);
    expect(switchTrait(world([T('Secret', { mode: 'hidden' })], [], ['Secret']), null, 'Secret')).toBeNull();
  });

  it('behaves the same for an entity-owned trait, against that owner alone', () => {
    const ash: GateOwner = { id: 'ash', name: 'Ash', groups: gear, traits: curse };
    const input: GateInput = {
      global: { traits: [], groups: [] }, owners: [ash],
      active: scoped([], { ash: [] }), entities: [], persona: { source: 'none' },
    };
    const picked = switchTrait(input, 'ash', 'Cursed Ring')!;
    expect(picked.active).toEqual({ global: [], owners: { ash: ['Cursed Ring', 'Curse'] } });
    expect(switchTrait({ ...input, active: picked.active }, 'ash', 'Curse')).toBeNull();
  });

  describe('Always On traits over a max', () => {
    const over = (traits: Trait[], groups: TraitGroup[], extra: Partial<GateInput> = {}) => {
      const { active: _active, ...input } = world(traits, groups, [], extra);
      return alwaysOnOverMax(input).map((o) => `${o.ownerId ?? 'global'}/${o.groupId}: ${o.traitIds.join(', ')}`);
    };
    const curses = [G('Curses', { maxPicks: 1 })];
    const weapons = [G('Weapon', { maxPicks: 1 })];

    it('reports ungated Always On traits past the max', () => {
      expect(over([AO('Weak', { groupId: 'Curses' }), AO('Slow', { groupId: 'Curses' })], curses))
        .toEqual(['global/Curses: Weak, Slow']);
    });

    it('stays quiet at the max, and for a group with no max', () => {
      expect(over([AO('Weak', { groupId: 'Curses' })], curses)).toEqual([]);
      expect(over([AO('Weak', { groupId: 'Free' }), AO('Slow', { groupId: 'Free' })], [G('Free')])).toEqual([]);
    });

    it('stays quiet when only rival picks open the curses, since one selection never holds both', () => {
      const traits = [
        T('Sword', { groupId: 'Weapon' }), T('Axe', { groupId: 'Weapon' }),
        AO('Weak', { groupId: 'Curses', requires: [{ all: [trait('Sword')] }] }), AO('Slow', { groupId: 'Curses', requires: [{ all: [trait('Axe')] }] }),
      ];
      expect(over(traits, [...curses, ...weapons])).toEqual([]);
    });

    it('reports curses that one selection can open together', () => {
      const traits = [
        T('Sword', { groupId: 'Weapon' }), T('Ring'),
        AO('Weak', { groupId: 'Curses', requires: [{ all: [trait('Sword')] }] }), AO('Slow', { groupId: 'Curses', requires: [{ all: [trait('Ring')] }] }),
      ];
      expect(over(traits, [...curses, ...weapons])).toEqual(['global/Curses: Weak, Slow']);
    });

    it('follows a chain down to rival roots', () => {
      const traits = [
        T('Sword', { groupId: 'Weapon' }), T('Axe', { groupId: 'Weapon' }),
        T('Blade Oath', { requires: [{ all: [trait('Sword')] }] }),
        AO('Weak', { groupId: 'Curses', requires: [{ all: [trait('Blade Oath')] }] }), AO('Slow', { groupId: 'Curses', requires: [{ all: [trait('Axe')] }] }),
      ];
      expect(over(traits, [...curses, ...weapons])).toEqual([]);
    });

    it('never lets a gate open itself through a loop on the way to a clash', () => {
      // Slow's Pact opens through Slow itself or through the Axe, which Weak's Sword rules out.
      const traits = [
        T('Sword', { groupId: 'Weapon' }), T('Axe', { groupId: 'Weapon' }),
        T('Pact', { requires: [{ all: [trait('Slow')] }, { all: [trait('Axe')] }] }),
        AO('Weak', { groupId: 'Curses', requires: [{ all: [trait('Sword')] }] }), AO('Slow', { groupId: 'Curses', requires: [{ all: [trait('Pact')] }] }),
      ];
      expect(over(traits, [...curses, ...weapons])).toEqual([]);
    });

    it('never counts a trait that can never unlock, or a loop that only opens itself', () => {
      const traits = [
        AO('Weak', { groupId: 'Curses' }),
        AO('Slow', { groupId: 'Curses', requires: [{ all: [trait('Sun')] }] }),
        T('Sun', { requires: [{ all: [trait('Moon')] }] }), T('Moon', { requires: [{ all: [trait('Sun')] }] }),
      ];
      expect(over(traits, curses)).toEqual([]);
    });

    it('checks an entity-owned group against its own owner', () => {
      const ash: GateOwner = {
        id: 'ash', name: 'Ash', groups: curses, traits: [AO('Weak', { groupId: 'Curses' }), AO('Slow', { groupId: 'Curses' })],
      };
      expect(over([], [], { owners: [ash] })).toEqual(['ash/Curses: Weak, Slow']);
    });
  });

  describe('default selection', () => {
    const defaults = (traits: Trait[], groups: TraitGroup[] = []) => settleDefaults(world(traits, groups)).active.global;

    it('includes active Always On traits and ignores their Default field', () => {
      expect(defaults([AO('Scarred'), AO('Cursed', { isDefault: true, requires: [{ all: [trait('Ring')] }] }), T('Ring')]))
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
        AO('Curse', { groupId: 'Mark', requires: [{ all: [trait('Ring')] }] }),
        T('Ring', { isDefault: true }),
      ], groups)).toEqual(['Curse', 'Ring']);
    });

    it('brings the Always On trait a default opens', () => {
      expect(defaults([T('Cursed Ring', { isDefault: true }), AO('Curse', { requires: [{ all: [trait('Cursed Ring')] }] })]))
        .toEqual(['Cursed Ring', 'Curse']);
    });
  });
});

describe('Not Conditions', () => {
  const not = (req: TraitRequirement): TraitRequirement => ({ ...req, not: true }) as TraitRequirement;
  const ref = (traitId: string, ownerId: OwnerId = null) => ({ ownerId, traitId });
  const only = (...all: TraitRequirement[]) => [{ all }];

  describe('holding', () => {
    it('holds a Not trait Condition while the target is off', () => {
      const traits = [T('Paladin'), T('Street Smarts', { requires: only(not(trait('Paladin'))) })];
      expect(unlocked(world(traits), 'Street Smarts')).toBe(true);
      expect(unlocked(world(traits, [], ['Paladin']), 'Street Smarts')).toBe(false);
      expect(reason(world(traits), 'Street Smarts')).toEqual(['not Paladin']);
    });

    it('holds a Not group Condition only while no trait below the group is active', () => {
      const groups = [G('Class'), G('Hybrid', { parentId: 'Class' })];
      const traits = [T('Mage', { groupId: 'Class' }), T('Spellblade', { groupId: 'Hybrid' }), T('Loose'),
        T('Drifter', { requires: only(not({ kind: 'group', id: 'Class' })) })];
      expect(unlocked(world(traits, groups, ['Loose']), 'Drifter')).toBe(true);
      expect(unlocked(world(traits, groups, ['Spellblade']), 'Drifter')).toBe(false);
      expect(reason(world(traits, groups), 'Drifter')).toEqual(['not any Class']);
    });

    it('holds a Not playing-as Condition under every persona but that one', () => {
      const traits = [T('Commoner', { requires: only(not({ kind: 'playingAs', id: 'aldric' })) })];
      const entities = [{ id: 'aldric', name: 'Sir Aldric', persona: true }, { id: 'mara', name: 'Mara', persona: true }];
      const as = (persona: PersonaRef) => world(traits, [], [], { entities, persona });
      expect(unlocked(as({ source: 'none' }), 'Commoner')).toBe(true);
      expect(unlocked(as({ source: 'world', entityId: 'mara' }), 'Commoner')).toBe(true);
      expect(unlocked(as({ source: 'world', entityId: 'aldric' }), 'Commoner')).toBe(false);
      expect(reason(as({ source: 'none' }), 'Commoner')).toEqual(['not playing as Sir Aldric']);
    });

    it('holds a Not Condition with an owner through that owner’s set alone', () => {
      const wolf: GateOwner = { id: 'wolf', name: 'Ash', groups: [], traits: [T('Tamed')] };
      const traits = [T('Paladin'), T('Hunt', { requires: only(not(on('wolf', 'Tamed'))) }), T('Rebel', { requires: only(not(you('Paladin'))) })];
      const at = (active: GateInput['active']) => world(traits, [], [], {
        owners: [wolf], active, entities: [{ id: 'wolf', name: 'Ash' }],
      });
      expect(unlocked(at(scoped(['Tamed'])), 'Hunt')).toBe(true);
      expect(unlocked(at(scoped([], { wolf: ['Tamed'] })), 'Hunt')).toBe(false);
      expect(unlocked(at(scoped([], { wolf: ['Paladin'] })), 'Rebel')).toBe(true);
      expect(unlocked(at(scoped(['Paladin'])), 'Rebel')).toBe(false);
      expect(reason(at(NO_ACTIVE), 'Hunt')).toEqual(['Ash: not Tamed']);
      expect(reason(at(NO_ACTIVE), 'Rebel')).toEqual(['Persona: not Paladin']);
    });

    it('counts an exclusive sibling as off for a Not Condition', () => {
      const groups = [G('Stance', { maxPicks: 1 })];
      const traits = [T('Guard', { groupId: 'Stance' }), T('Charge', { groupId: 'Stance', requires: only(not(trait('Guard'))) })];
      expect(unlocked(world(traits, groups, ['Guard']), 'Charge')).toBe(true);
      expect(switchTrait(world(traits, groups, ['Guard']), null, 'Charge')?.active.global).toEqual(['Charge']);
    });

    it('skips exclusive siblings only in the trait’s own tree, never in another owner’s', () => {
      // Albus's Smite and Paladin are max-one siblings; the player's Paladin is another owner's copy.
      const classes = [G('Classes', { maxPicks: 1 })];
      const at = (smite: TraitRequirement) => world([T('Paladin')], [], ['Paladin'], {
        owners: [{
          id: 'albus', name: 'Albus', groups: classes,
          traits: [T('Paladin', { groupId: 'Classes' }), T('Smite', { groupId: 'Classes', requires: only(smite) })],
        }],
        entities: [{ id: 'albus', name: 'Albus' }],
      });
      expect(unlocked(at(you('Paladin')), 'Smite', 'albus')).toBe(true);
      expect(unlocked(at(not(you('Paladin'))), 'Smite', 'albus')).toBe(false);
    });

    it('never counts a trait’s own activity toward its own gate (Q26)', () => {
      const groups = [G('Class')];
      const scout = T('Scout', { groupId: 'Class', requires: only(not({ kind: 'group', id: 'Class' })) });
      const ranger = T('Ranger', { groupId: 'Class', requires: only({ kind: 'group', id: 'Class' }) });
      const traits = [scout, ranger, T('Mage', { groupId: 'Class' })];
      expect(unlocked(world(traits, groups, ['Scout']), 'Scout')).toBe(true);
      expect(settle(world(traits, groups, ['Scout'])).active.global).toEqual(['Scout']);
      expect(unlocked(world(traits, groups, ['Ranger']), 'Ranger')).toBe(false);
      expect(unlocked(world(traits, groups, ['Mage']), 'Scout')).toBe(false);
    });

    it('never holds a Not Condition whose target is gone (Q27)', () => {
      const traits = [T('Rogue', { requires: only(not({ kind: 'trait', id: 'gone', name: 'Paladin' })) })];
      const state = gateOf(gateStates(world(traits)), null, 'Rogue')!;
      expect(state.unlocked).toBe(false);
      expect(state.rows[0].conditions[0]).toMatchObject({ text: 'not Paladin', unresolved: true, holds: false });
      expect(settle(world(traits, [], ['Rogue'])).active.global).toEqual([]);
    });

    it('tells a Not Condition from a plain one on the same target', () => {
      expect(sameRequirement(trait('Paladin'), not(trait('Paladin')))).toBe(false);
      expect(sameRequirement(not(trait('Paladin')), not(trait('Paladin')))).toBe(true);
    });
  });

  describe('exclusion', () => {
    const traits = [T('Paladin'), T('Knight'), T('Street Smarts', { requires: only(not(trait('Paladin'))) })];

    it('locks a trait the moment the player picks what it excludes', () => {
      const picked = switchTrait(world(traits), null, 'Paladin')!;
      expect(unlocked(world(traits, [], picked.active.global), 'Street Smarts')).toBe(false);
      expect(switchTrait(world(traits, [], picked.active.global), null, 'Street Smarts')).toBeNull();
    });

    it('turns an active trait off when its excluded target is picked, and returns it when the pick is dropped', () => {
      const picked = switchTrait(world(traits, [], ['Knight', 'Street Smarts']), null, 'Paladin')!;
      expect(picked.active.global).toEqual(['Knight', 'Paladin']);
      expect(picked.turnedOff).toEqual([ref('Street Smarts')]);
      expect(picked.cascadeOff.global).toEqual(['Street Smarts']);
      const other = switchTrait(world(traits, [], picked.active.global), null, 'Knight', picked.cascadeOff)!;
      expect(other.cascadeOff.global).toEqual(['Street Smarts']);
      const dropped = switchTrait(world(traits, [], picked.active.global), null, 'Paladin', picked.cascadeOff)!;
      expect(dropped.active.global).toEqual(['Knight', 'Street Smarts']);
      expect(dropped.returned).toEqual([ref('Street Smarts')]);
      expect(dropped.cascadeOff.global).toEqual([]);
    });

    it('turns off what the excluded trait held up, with it', () => {
      const chain = [...traits, T('Alley Map', { requires: only(trait('Street Smarts')) })];
      const picked = switchTrait(world(chain, [], ['Street Smarts', 'Alley Map']), null, 'Paladin')!;
      expect(picked.active.global).toEqual(['Paladin']);
      expect(picked.turnedOff).toEqual([ref('Alley Map'), ref('Street Smarts')]);
    });

    it('keeps a trait open through another row when a Not row fails', () => {
      const rows = [T('Paladin'), T('Merc'), T('Smarts', { requires: [{ all: [not(trait('Paladin'))] }, { all: [trait('Merc')] }] })];
      expect(settle(world(rows, [], ['Smarts', 'Paladin', 'Merc'])).active.global).toEqual(['Smarts', 'Paladin', 'Merc']);
      expect(settle(world(rows, [], ['Smarts', 'Paladin'])).active.global).toEqual(['Paladin']);
    });

    it('turns off the later of two traits that exclude each other, so the earlier pick wins (Q8)', () => {
      const pair = [T('Sun', { requires: only(not(trait('Moon'))) }), T('Moon', { requires: only(not(trait('Sun'))) })];
      expect(settle(world(pair, [], ['Sun', 'Moon']))).toMatchObject({ active: { global: ['Sun'] }, turnedOff: [ref('Moon')] });
      expect(settle(world(pair, [], ['Moon', 'Sun']))).toMatchObject({ active: { global: ['Moon'] }, turnedOff: [ref('Sun')] });
    });

    it('keeps the earlier pick even when its gate opens after the later one’s', () => {
      // Sun also needs Dawn, which comes last, so a plain growth pass would seat Moon first.
      const pair = [
        T('Sun', { requires: only(trait('Dawn'), not(trait('Moon'))) }),
        T('Moon', { requires: only(not(trait('Sun'))) }),
        T('Dawn'),
      ];
      expect(settle(world(pair, [], ['Sun', 'Moon', 'Dawn'])).active.global).toEqual(['Sun', 'Dawn']);
    });

    it('keeps a dropped trait whose gate holds once a later drop clears it, so a second settle changes nothing (Q29)', () => {
      const three = [
        T('A', { requires: only(not(trait('B'))) }), T('B', { requires: only(not(trait('A'))) }), T('C', { requires: only(not(trait('B'))) }),
      ];
      const first = settle(world(three, [], ['A', 'B', 'C']));
      expect(first).toMatchObject({ active: { global: ['A', 'C'] }, turnedOff: [ref('B')], cascadeOff: { global: ['B'] } });
      const again = settle(world(three, [], first.active.global), first.cascadeOff);
      expect(again).toEqual({ active: first.active, turnedOff: [], returned: [], cascadeOff: first.cascadeOff });
    });

    it('never lets a trait that fails block another’s return (Q29)', () => {
      // Shore comes back once Gull is out. Tide needs Shore but still fails on Net, so it stays off.
      const traits = [
        T('Wind'), T('Gull', { requires: only(not(trait('Wind'))) }), T('Net'),
        T('Tide', { requires: only(trait('Shore'), not(trait('Net'))) }), T('Shore', { requires: only(not(trait('Gull'))) }),
      ];
      const result = settle(world(traits, [], ['Wind', 'Gull', 'Net', 'Tide', 'Shore']));
      expect(result.active.global).toEqual(['Wind', 'Net', 'Shore']);
      expect(result.turnedOff.map((r) => r.traitId).sort()).toEqual(['Gull', 'Tide']);
    });

    it('never lets a returning trait turn off a pick; the returner keeps waiting (Q30)', () => {
      const chain = [T('Oath'), T('Crown', { requires: only(trait('Oath')) }), T('Exile', { requires: only(not(trait('Crown'))) })];
      const back = switchTrait(world(chain, [], ['Exile']), null, 'Oath', scoped(['Crown']))!;
      expect(back.active.global).toEqual(['Exile', 'Oath']);
      expect(back).toMatchObject({ turnedOff: [], returned: [], cascadeOff: { global: ['Crown'] } });
    });

    it('never lets a returning trait turn off an Automatic trait (Q30)', () => {
      const chain = [T('Oath'), T('Crown', { requires: only(trait('Oath')) }), T('Vigil', { mode: 'alwaysOn', requires: only(not(trait('Crown'))) })];
      const back = switchTrait(world(chain, [], ['Vigil']), null, 'Oath', scoped(['Crown']))!;
      expect(back.active.global).toEqual(['Vigil', 'Oath']);
      expect(back.cascadeOff.global).toEqual(['Crown']);
    });

    it('locks a pick that excludes an active Automatic trait (Q30)', () => {
      const traits = [T('Vigil', { mode: 'alwaysOn' }), T('Rebel', { requires: only(not(trait('Vigil'))) })];
      const start = settle(world(traits));
      expect(start.active.global).toEqual(['Vigil']);
      expect(unlocked(world(traits, [], start.active.global), 'Rebel')).toBe(false);
      expect(switchTrait(world(traits, [], start.active.global), null, 'Rebel')).toBeNull();
    });

    it('settles any mix of plain and Not gates to a set that checks clean and settles to itself', () => {
      let seed = 7;
      const rand = (n: number) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
      const ids = ['A', 'B', 'C', 'D', 'E', 'F'];
      for (let world_ = 0; world_ < 4000; world_++) {
        const traits = ids.map((id) => T(id, {
          ...(rand(5) === 0 ? { mode: 'alwaysOn' as const } : {}),
          requires: Array.from({ length: rand(3) }, () => ({
            all: Array.from({ length: 1 + rand(2) }, () => {
              const target = trait(ids[rand(ids.length)]);
              return rand(2) ? not(target) : target;
            }),
          })),
        }));
        const order = [...ids].sort(() => rand(3) - 1).slice(0, rand(ids.length + 1));
        const waiting = ids.filter((id) => !order.includes(id) && rand(2));
        const first = settle(world(traits, [], order), scoped(waiting));
        const on = first.active.global;
        const clean = (ids: string[]) => {
          const states = gateStates(world(traits, [], ids));
          return ids.every((id) => gateOf(states, null, id)?.unlocked);
        };
        expect(clean(on), `${world_}: clean`).toBe(true);
        // Nothing left off could join alone without breaking a gate.
        const offered = [...order, ...waiting, ...traits.filter((t) => t.mode === 'alwaysOn').map((t) => t.id)];
        for (const id of offered.filter((x) => !on.includes(x))) expect(clean([...on, id]), `${world_}: ${id} fits`).toBe(false);
        expect(settle(world(traits, [], on), first.cascadeOff).active, `${world_}: again`).toEqual(first.active);
      }
    });

    it('returns a trait an exclusion turned off once the excluding trait leaves for any reason', () => {
      const chain = [T('Oath'), T('Paladin', { requires: only(trait('Oath')) }), T('Street Smarts', { requires: only(not(trait('Paladin'))) })];
      const picked = switchTrait(world(chain, [], ['Oath', 'Street Smarts']), null, 'Paladin')!;
      expect(picked.cascadeOff.global).toEqual(['Street Smarts']);
      const broken = switchTrait(world(chain, [], picked.active.global), null, 'Oath', picked.cascadeOff)!;
      expect(broken.active.global).toEqual(['Street Smarts']);
      expect(broken.turnedOff).toEqual([ref('Paladin')]);
      expect(broken.returned).toEqual([ref('Street Smarts')]);
    });
  });

  describe('Automatic unless X (Q10)', () => {
    const traits = [T('Paladin'), T('Vigil', { mode: 'alwaysOn', requires: only(not(trait('Paladin'))) })];

    it('follows its gate both ways and never waits on the cascade-off list', () => {
      const start = settle(world(traits));
      expect(start.active.global).toEqual(['Vigil']);
      const picked = switchTrait(world(traits, [], start.active.global), null, 'Paladin')!;
      expect(picked.active.global).toEqual(['Paladin']);
      expect(picked.turnedOff).toEqual([ref('Vigil')]);
      expect(picked.cascadeOff.global).toEqual([]);
      const dropped = switchTrait(world(traits, [], picked.active.global), null, 'Paladin', picked.cascadeOff)!;
      expect(dropped.active.global).toEqual(['Vigil']);
      expect(dropped.returned).toEqual([ref('Vigil')]);
    });
  });

  describe('defaults (Q16)', () => {
    it('starts the later of two defaults that exclude each other unselected', () => {
      const pair = [
        T('Sun', { isDefault: true, requires: only(not(trait('Moon'))) }),
        T('Moon', { isDefault: true, requires: only(not(trait('Sun'))) }),
      ];
      expect(settleDefaults(world(pair)).active.global).toEqual(['Sun']);
      expect(settleDefaults(world([...pair].reverse())).active.global).toEqual(['Moon']);
    });

    it('starts a default that excludes another default unselected', () => {
      expect(settleDefaults(world([
        T('Street Smarts', { isDefault: true, requires: only(not(trait('Paladin'))) }),
        T('Paladin', { isDefault: true }),
      ])).active.global).toEqual(['Paladin']);
    });
  });

  describe('author checks', () => {
    it('treats every Not Condition as holding when it looks for traits no selection can open (Q15)', () => {
      expect(neverUnlockable(world([T('Paladin'), T('Rogue', { requires: only(trait('Paladin'), not(trait('Paladin'))) })]))).toEqual([]);
    });

    it('never joins two stuck sets through a Not Condition', () => {
      expect(neverUnlockable(world([
        T('Sun', { requires: only(trait('Moon')) }), T('Moon', { requires: only(trait('Sun')) }),
        T('Ash', { requires: only(trait('Ember'), not(trait('Sun'))) }), T('Ember', { requires: only(trait('Ash')) }),
      ]))).toEqual([[ref('Sun'), ref('Moon')], [ref('Ash'), ref('Ember')]]);
    });

    it('opens Automatic traits together through a Not Condition on a target no selection opens', () => {
      const groups = [G('Auto', { maxPicks: 1 })];
      expect(alwaysOnOverMax(world([
        T('Paladin', { requires: only(trait('Ghost')) }), T('Ghost', { requires: only(trait('Paladin')) }),
        T('Vigil', { groupId: 'Auto', mode: 'alwaysOn', requires: only(not(trait('Paladin'))) }),
        T('Watch', { groupId: 'Auto', mode: 'alwaysOn' }),
      ], groups)).map((o) => o.traitIds)).toEqual([['Vigil', 'Watch']]);
    });
  });
});
