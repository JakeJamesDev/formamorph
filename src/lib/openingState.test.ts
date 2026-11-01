import { describe, expect, it } from 'vitest';
import { bodyFixture } from '@/test/bodyFixture';
import { openingFold, openingStateOf, type OpeningFoldWorld } from './openingState';
import type { Body, Entity, GameLocation, Item, Placement, Stat, StatChange, Trait } from '@/types';

const stat = (id: string, value: number, over: Partial<Stat> = {}): Stat => ({
  id, name: id, type: 'number', description: '', min: 0, max: 100, value, regen: 0, descriptors: [], ...over,
});
const trait = (id: string, statChanges: StatChange[] = [], over: Partial<Trait> = {}): Trait => ({
  id, name: id, statChanges, playerToggle: true, ...over,
});

// Giant raises the HP cap before Tough adds to it, so authored order decides whether the clamp bites.
const giant = trait('giant', [{ statId: 'hp', value: 10, type: 'max' }]);
const tough = trait('tough', [{ statId: 'hp', value: 5, type: 'starting' }]);
// Bram (cast) owns Vigor; Hardy raises it, and Boast's row on Gold is a global row (Bram owns no Gold).
const hardy = trait('hardy', [{ statId: 'vigor', value: 2, type: 'starting' }]);
const boast = trait('boast', [{ statId: 'gold', value: 1, type: 'starting' }]);
// Albus is a world persona with its own Stock; Paladin raises it.
const paladin = trait('paladin', [{ statId: 'stock', value: 3, type: 'starting' }]);
const bram: Entity = { id: 'bram', name: 'Bram', description: '', locations: [], stats: [stat('vigor', 3)], traits: [hardy, boast] } as Entity;
const albus: Entity = { id: 'albus', name: 'Albus', description: '', locations: [], persona: true, stats: [stat('stock', 4)], traits: [paladin] } as Entity;
const town = { id: 'town', name: 'Town', description: '' } as GameLocation;
const gate = { id: 'gate', name: 'Gate', description: '', isStarting: true } as GameLocation;

const world: OpeningFoldWorld = {
  stats: [stat('hp', 10, { max: 12 }), stat('gold', 5)],
  statGroups: [],
  traits: [giant, tough],
  traitGroups: [],
  entities: [bram, albus],
  locations: [town, gate],
  dictionaries: [],
};

const valueOf = (stats: readonly { id: string; value?: number }[] | undefined, id: string) => stats?.find((s) => s.id === id)?.value;
const ownerStats = (state: ReturnType<typeof openingStateOf>, id: string) => state.owners?.find((o) => o.id === id)?.stats;

describe('openingStateOf', () => {
  it('folds the held picks, the global rows and the owned traits under the persona, as Enter World opens a game', () => {
    const state = openingStateOf(
      world,
      // Click order puts Tough first; authored order applies Giant first, so HP reaches 15 under a cap of 22.
      { traits: ['tough', 'giant'], owned: { bram: ['hardy', 'boast'], albus: ['paladin'] } },
      { ref: { source: 'world', entityId: 'albus' } },
    );

    expect(state.stats.find((s) => s.id === 'hp')).toMatchObject({ value: 15, max: 22 });
    // Bram's Boast reaches the global Gold through its global row.
    expect(valueOf(state.stats, 'gold')).toBe(6);
    expect(state.ownerTraits.acquired.map((t) => t.id)).toEqual(['giant', 'tough']);
    expect(state.ownerTraits.ownedTraits).toMatchObject({ bram: { chosen: ['hardy', 'boast'] }, albus: { chosen: ['paladin'] } });
    expect(state.ownerTraits.world.persona).toEqual({ source: 'world', entityId: 'albus' });
    expect(valueOf(ownerStats(state, 'bram'), 'vigor')).toBe(5);
    expect(valueOf(ownerStats(state, 'albus'), 'stock')).toBe(7);
    expect(state.enabled).toEqual({ hp: true, gold: true });
    expect(state.clock).toEqual({ deltaHours: 0, elapsedHours: 0 });
  });

  it('opens the authored world at turn one with no picks and no persona', () => {
    const state = openingStateOf(world);

    expect(state.stats.find((s) => s.id === 'hp')).toMatchObject({ value: 10, max: 12 });
    expect(valueOf(state.stats, 'gold')).toBe(5);
    expect(state.ownerTraits.acquired).toEqual([]);
    expect(state.ownerTraits.world.persona).toEqual({ source: 'none' });
    expect(valueOf(ownerStats(state, 'bram'), 'vigor')).toBe(3);
    expect(state.clock).toEqual({ deltaHours: 0, elapsedHours: 0 });
    expect(state.placeholders).toMatchObject({ rolls: {} });
    expect(state.placeholders?.pins).toBeUndefined();
    expect(state.places).toEqual({ locations: world.locations, location: { id: 'gate', name: 'Gate' }, connections: [] });
    expect(state.ownerTraits.discovered).toBeUndefined();
  });

  it('seeds and plays a library persona, and seeds the added library characters', () => {
    const rook: Entity = { id: 'rook', name: 'Rook', description: '', locations: [], persona: true, stats: [stat('grit', 2)], traits: [trait('steady', [{ statId: 'grit', value: 4, type: 'starting' }])] } as Entity;
    const vale: Entity = { id: 'vale', name: 'Vale', description: '', locations: [], stats: [stat('calm', 6)] } as Entity;
    const fold = openingFold(world, { traits: [], owned: { rook: ['steady'] } }, {
      ref: { source: 'library', entityId: 'rook' }, libraryEntity: rook, characters: [vale],
    });

    expect(fold.state.ownerTraits.library?.map((e) => e.id)).toEqual(['rook', 'vale']);
    expect(valueOf(ownerStats(fold.state, 'rook'), 'grit')).toBe(6);
    expect(valueOf(fold.entityStats.vale, 'calm')).toBe(6);
  });

  it('opens with the start rule’s met list: no Stranger Name, or a tie to the persona', () => {
    const hooded = { ...bram, id: 'hooded', name: 'Hooded', strangerName: 'a hooded stranger' } as Entity;
    const friend = { ...bram, id: 'friend', name: 'Friend', strangerName: 'a stranger', relationships: [{ targetId: 'albus' }] } as Entity;
    const fold = openingFold({ ...world, entities: [bram, albus, hooded, friend] }, { traits: [], owned: {} }, { ref: { source: 'world', entityId: 'albus' } });
    expect(fold.state.ownerTraits.metIds).toEqual(['bram', 'albus', 'friend']);
  });

  it('stands nowhere in a world with no locations', () => {
    expect(openingStateOf({ ...world, locations: [] }).places).toEqual({ locations: [], location: null, connections: [] });
  });

  it('hands play every seeded entity and the traits its log names', () => {
    // Albus is played, so Bram's Boast row stays out of the log and Albus's own Boast row is in it.
    const albusBoast = trait('albus-boast', [{ statId: 'gold', value: 2, type: 'starting' }]);
    const played = { ...world, entities: [bram, { ...albus, traits: [paladin, albusBoast] }] };
    const fold = openingFold(
      played, { traits: ['tough'], owned: { bram: ['hardy', 'boast'], albus: ['albus-boast'] } }, { ref: { source: 'world', entityId: 'albus' } },
    );
    expect(Object.keys(fold.entityStats)).toEqual(['bram', 'albus']);
    expect(fold.startingTraits.map(({ trait: t, ownerId }) => [t.id, ownerId])).toEqual([['tough', null], ['albus-boast', 'albus']]);
    expect(fold.traitState.entityStats).toBe(fold.entityStats);
  });

  it("carries the seeded Item Copies, with the played Persona entity's placements on the player", () => {
    const lamp = { id: 'lamp', name: 'Lamp', statEffects: [], traitEffects: [], equipRequires: [] };
    const state = openingStateOf({
      ...world,
      items: [lamp],
      placements: [
        { id: 'p1', where: { kind: 'entity', id: 'albus' }, quantity: 1, source: { kind: 'item', itemId: 'lamp' } },
        { id: 'p2', where: { kind: 'location', id: 'gate' }, quantity: 2, hidden: true, source: { kind: 'item', itemId: 'lamp' } },
      ],
    }, undefined, { ref: { source: 'world', entityId: 'albus' } });
    expect(state.itemCopies?.map(({ where, quantity, visibility }) => ({ where, quantity, visibility }))).toEqual([
      { where: { kind: 'you' }, quantity: 1, visibility: 'visible' },
      { where: { kind: 'location', id: 'gate' }, quantity: 2, visibility: 'hidden' },
    ]);
  });
  it("puts the seeded Item Copies' effects in place on the first turn, On First Obtain included (Q59)", () => {
    const row = (id: string, statId: string, amount: number, timing: 'owned' | 'firstObtain', facet: 'value' | 'max' = 'value') =>
      ({ id, statId, amount, timing, facet, op: 'add' as const });
    const ledger = { id: 'ledger', name: 'Ledger', statEffects: [row('r1', 'stock', 2, 'owned')], traitEffects: [], equipRequires: [] };
    const charm = { id: 'charm', name: 'Charm', statEffects: [row('r2', 'vigor', 5, 'firstObtain', 'max'), row('r3', 'vigor', 1, 'firstObtain')], traitEffects: [], equipRequires: [] };
    const fold = openingFold({
      ...world,
      items: [ledger, charm],
      placements: [
        { id: 'p1', where: { kind: 'you' }, quantity: 3, source: { kind: 'item', itemId: 'ledger' } },
        { id: 'p2', where: { kind: 'entity', id: 'bram' }, quantity: 1, source: { kind: 'item', itemId: 'charm' } },
      ],
    }, { traits: [], owned: { bram: ['hardy'] } }, { ref: { source: 'world', entityId: 'albus' } });
    // Albus's Stock 4 + the ledger once, for three Item Copies; Bram's Vigor 3 + Hardy 2 + the charm 1, under a cap raised by 5.
    expect(valueOf(fold.entityStats.albus, 'stock')).toBe(6);
    expect(fold.entityStats.bram.find((s) => s.id === 'vigor')).toMatchObject({ value: 6, max: 105 });
    expect(fold.itemEffects.ledger.firstObtained).toEqual({ bram: ['charm'] });
    expect(ownerStats(fold.state, 'bram')?.find((s) => s.id === 'vigor')?.value).toBe(6);
  });
});

describe('openingFold — Equipped placements', () => {
  const gear = (id: string, slotId: string, over: Partial<Item> = {}): Item =>
    ({ id, name: id, slotRule: { mode: 'either', slotIds: [slotId] }, statEffects: [], traitEffects: [], equipRequires: [], ...over });
  const place = (id: string, where: Placement['where'], itemId: string, over: Partial<Placement> = {}): Placement =>
    ({ id, where, quantity: 1, equipped: true, source: { kind: 'item', itemId }, ...over });
  const you = { kind: 'you' } as const;
  const humanoid: Body = bodyFixture({ id: 'humanoid', name: 'Humanoid', entries: [{ slotId: 'hand' }, { slotId: 'ring', capacity: 2 }, { slotId: 'head' }] });
  const dog: Body = bodyFixture({ id: 'dog', name: 'Dog', entries: [{ slotId: 'collar' }] });
  const kit: OpeningFoldWorld = {
    ...world,
    slots: [{ id: 'hand', name: 'Hand' }, { id: 'ring', name: 'Ring' }, { id: 'head', name: 'Head' }, { id: 'collar', name: 'Collar' }],
    bodies: [humanoid, dog],
  };
  /** Each copy of `itemId` as [where kind, equipped slot or null, quantity], in list order. */
  const copiesOf = (fold: ReturnType<typeof openingFold>, itemId: string) => (fold.state.itemCopies ?? [])
    .filter((c) => c.item.kind === 'item' && c.item.itemId === itemId)
    .map((c) => [c.where.kind, c.equipped?.slotId ?? null, c.quantity]);

  it('equips in placement order, so a later placement swaps an earlier one out (Q26)', () => {
    const fold = openingFold({
      ...kit,
      items: [gear('sword', 'hand'), gear('axe', 'hand')],
      placements: [place('p1', you, 'sword'), place('p2', you, 'axe')],
    });
    expect(copiesOf(fold, 'sword')).toEqual([['you', null, 1]]);
    expect(copiesOf(fold, 'axe')).toEqual([['you', 'hand', 1]]);
  });

  it('equips once per unit, so Ring ×3 into a capacity of 2 leaves one carried (Q36)', () => {
    const rings = openingFold({ ...kit, items: [gear('ring', 'ring')], placements: [place('p1', you, 'ring', { quantity: 3 })] });
    expect(copiesOf(rings, 'ring').filter(([, slot]) => slot === 'ring')).toHaveLength(2);
    expect(copiesOf(rings, 'ring').filter(([, slot]) => slot === null)).toHaveLength(1);
    const arrows = openingFold({
      ...kit, items: [gear('arrow', 'hand', { stackable: true })], placements: [place('p1', you, 'arrow', { quantity: 3 })],
    });
    expect(copiesOf(arrows, 'arrow')).toEqual([['you', null, 2], ['you', 'hand', 1]]);
  });

  it('leaves an unmarked placement carried', () => {
    const fold = openingFold({ ...kit, items: [gear('sword', 'hand')], placements: [place('p1', you, 'sword', { equipped: undefined })] });
    expect(copiesOf(fold, 'sword')).toEqual([['you', null, 1]]);
  });

  it("applies While Equipped effects on the first turn, and an Equipped item's state is the one scripts read", () => {
    const helm = gear('helm', 'head', { statEffects: [{ id: 'r', statId: 'stock', facet: 'value', timing: 'equipped', amount: 2, op: 'add' }] });
    const fold = openingFold({ ...kit, items: [helm], placements: [place('p1', you, 'helm')] }, undefined, { ref: { source: 'world', entityId: 'albus' } });
    // Albus's Stock 4 + the equipped helm's 2.
    expect(valueOf(fold.entityStats.albus, 'stock')).toBe(6);
    expect(fold.itemEffects.log).toEqual(['helm: stock +2']);
    expect(fold.state.itemCopies?.[0].equipped?.slotId).toBe('head');
    expect(fold.state.ownerTraits.world.itemCopies?.[0].equipped?.slotId).toBe('head');
  });

  it("starts carried when the owner's Body lacks the slot, with no log line (Q2)", () => {
    const rex = { ...bram, id: 'rex', name: 'Rex', body: { kind: 'body', id: 'dog' } } as Entity;
    const ghost = { ...bram, id: 'ghost', name: 'Ghost', body: { kind: 'none' } } as Entity;
    const fold = openingFold({
      ...kit,
      entities: [rex, ghost],
      items: [gear('helm', 'head'), gear('collar', 'collar')],
      placements: [place('p1', { kind: 'entity', id: 'rex' }, 'helm'), place('p2', { kind: 'entity', id: 'rex' }, 'collar'), place('p3', { kind: 'entity', id: 'ghost' }, 'collar')],
    });
    expect(copiesOf(fold, 'helm')).toEqual([['entity', null, 1]]);
    expect(copiesOf(fold, 'collar')).toEqual([['entity', 'collar', 1], ['entity', null, 1]]);
    expect(fold.itemEffects.log).toEqual([]);
  });

  it('refuses an equip whose requirement fails up front: carried, no log line (Q37)', () => {
    const heavy = gear('heavy', 'hand', { equipRequires: [{ all: [{ kind: 'stat', id: 'gold', operator: '>=', value: 50, unit: 'raw' }] }] });
    const fold = openingFold({ ...kit, items: [heavy], placements: [place('p1', you, 'heavy')] });
    expect(copiesOf(fold, 'heavy')).toEqual([['you', null, 1]]);
    expect(fold.itemEffects.log).toEqual([]);
  });

  it("unequips a starting item another one's effect leaves short of its requirement, with no log line (Q50)", () => {
    // The sword needs Stock 4, which Albus has until the helm's While Equipped -2 applies.
    const helm = gear('helm', 'head', { statEffects: [{ id: 'r', statId: 'stock', facet: 'value', timing: 'equipped', amount: -2, op: 'add' }] });
    const sword = gear('sword', 'hand', { equipRequires: [{ all: [{ kind: 'stat', id: 'stock', operator: '>=', value: 4, unit: 'raw' }] }] });
    const fold = openingFold({
      ...kit, items: [helm, sword], placements: [place('p1', you, 'sword'), place('p2', you, 'helm')],
    }, undefined, { ref: { source: 'world', entityId: 'albus' } });
    expect(copiesOf(fold, 'sword')).toEqual([['you', null, 1]]);
    expect(copiesOf(fold, 'helm')).toEqual([['you', 'head', 1]]);
    expect(fold.itemEffects.log).toEqual(['helm: stock -2']);
  });

  it('starts a Hidden Equipped placement equipped and hidden (Q38)', () => {
    const fold = openingFold({ ...kit, items: [gear('ring', 'ring')], placements: [place('p1', you, 'ring', { hidden: true })] });
    expect(fold.state.itemCopies?.[0]).toMatchObject({ visibility: 'hidden', equipped: { slotId: 'ring' } });
  });

  it('never equips at a location, even when the placement carries the flag', () => {
    const fold = openingFold({ ...kit, items: [gear('sword', 'hand')], placements: [place('p1', { kind: 'location', id: 'gate' }, 'sword')] });
    expect(copiesOf(fold, 'sword')).toEqual([['location', null, 1]]);
  });

  it("reads the played Persona's Body: a world persona's own pick, else the Custom Persona entity's (Q31)", () => {
    const custom = { ...bram, id: 'custom', name: 'Custom', customPersona: true, body: { kind: 'body', id: 'dog' } } as Entity;
    const knight = { ...albus, body: { kind: 'body', id: 'humanoid' } } as Entity;
    const fold = (persona?: Parameters<typeof openingFold>[2]) => openingFold({
      ...kit, entities: [knight, custom], items: [gear('sword', 'hand')], placements: [place('p1', you, 'sword')],
    }, undefined, persona);
    expect(copiesOf(fold({ ref: { source: 'world', entityId: 'albus' } }), 'sword')).toEqual([['you', 'hand', 1]]);
    expect(copiesOf(fold(), 'sword')).toEqual([['you', null, 1]]);
    expect(copiesOf(fold({ ref: { source: 'library', entityId: 'lib' } }), 'sword')).toEqual([['you', null, 1]]);
  });
});
