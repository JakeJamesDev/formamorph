import { describe, it, expect } from 'vitest';
import type { Entity, PersonaRef, Placeholder, PlaceholderPin, Trait, TraitLink } from '@/types';
import { phValueId, phValues } from '@/test/placeholderValues';
import { allPinTexts, type PinnableStat } from './placeholderPins';
import {
  activeOwnedTraitIds, addedCharacters, ownerGroupId, ownerPins, ownerPriming, ownerTraitTree, inPlayLibrary, libraryUnder, playerEntityIds,
  rowOwner, withOwnerNames, inSceneTraitTree,
  type OwnerPinState,
} from './ownedTraitsInPlay';
import { INITIAL_SOURCE_TURN_ID } from './runtimeCharacters';

const pin = (placeholderId: string, value: string, valueId?: string): PlaceholderPin =>
  ({ placeholderId, value, ...(valueId ? { valueId } : {}) });
const trait = (id: string, pins: PlaceholderPin[] = [], extra: Partial<Trait> = {}): Trait =>
  ({ id, name: id, statChanges: [], ...(pins.length ? { placeholderPins: pins } : {}), ...extra });
const NONE: PersonaRef = { source: 'none' };
const AS_ALBUS: PersonaRef = { source: 'world', entityId: 'albus' };
const AS_LIB: PersonaRef = { source: 'library', entityId: 'lib' };
// Class Garb is a blueprint: a trait pin names it, and each owner reads its own copy of it.
const shared: Placeholder[] = [
  { id: 'garb', name: 'Class Garb', values: phValues(['Robe', 'Plate', 'Tabard']) },
  { id: 'mood', name: 'Mood', values: phValues(['calm', 'wary', 'fierce']) },
];
const TABARD = phValueId('Tabard');
/** An owner's copy of Class Garb: Tabard reworded to `text`, or removed when `text` is null. */
const garbCopy = (id: string, text: string | null): Placeholder => ({
  id, name: 'Class Garb', values: [], blueprintId: 'garb',
  valueOverrides: { [TABARD]: text === null ? { removed: true } : { text: { value: text, blueprint: 'Tabard' } } },
});
const paladinPins = [pin('garb', 'Tabard', TABARD)];
/** A link to a trait; `pins` overrides the original's pin list. */
const link = (id: string, originalId: string, pins?: PlaceholderPin[]): TraitLink => ({
  id, originalId, kind: 'trait', originalName: originalId, groupId: null, order: 5,
  ...(pins ? { overrides: { [originalId]: { placeholderPins: { value: pins, blueprint: paladinPins } } } } : {}),
});

const paladin = trait('paladin', paladinPins, { groupId: 'blueprints', statToggles: [{ statId: 'hunger', enabled: false }] });
const brave = trait('brave', [pin('mood', 'wary')], { groupId: null, order: 0 });
const cloak = trait('cloak', [pin('garb', 'Robe')], { groupId: null, order: 1 });
// Albus rewords Tabard on his copy; Bo removes it; Mira has no copy and her link pins Plate instead.
const albus: Entity = {
  id: 'albus', name: 'Albus', persona: true,
  placeholders: [garbCopy('albus-garb', 'Gilded plate')],
  traits: [trait('t-stern', [pin('mood', 'fierce')], { groupId: null, order: 0 })],
  traitLinks: [link('l-albus', 'paladin')],
};
const mira: Entity = { id: 'mira', name: 'Mira', traitLinks: [link('l-mira', 'paladin', [pin('garb', 'Plate')])] };
const bo: Entity = { id: 'bo', name: 'Bo', placeholders: [garbCopy('bo-garb', null)], traitLinks: [link('l-bo', 'paladin')] };
/** The Custom Persona entity: its Paladin link pins Robe on the blueprint. */
const you: Entity = { id: 'cp', name: 'Newcomer', customPersona: true, traitLinks: [link('l-you', 'paladin', [pin('garb', 'Robe')])] };
const lib: Entity = { id: 'lib', name: 'Wren', persona: true, placeholders: [garbCopy('lib-garb', 'Wren cloak')] };
const world = {
  traits: [brave, cloak, paladin],
  traitGroups: [{ id: 'blueprints', name: 'Blueprints', parentId: null, order: 2, system: 'blueprints' as const }],
  entities: [albus, mira, bo, you],
};
const hunger: PinnableStat = {
  id: 'hunger', value: 10, min: 0, max: 100, enabled: true,
  descriptors: [{ id: 'starving', threshold: 20, description: 'Starving', placeholderPins: [pin('mood', 'calm')] }],
};
const owned = { albus: ['t-stern', 'paladin'], mira: ['paladin'], bo: ['paladin'] };
/** The player picked the Custom Persona entity's Paladin. */
const picked = { ...owned, cp: ['paladin'] };
const allPlaceholders = [...shared, ...albus.placeholders!, ...bo.placeholders!, ...lib.placeholders!];
const pinsUnder = (persona: PersonaRef, globalTraits: Trait[], extra: Partial<OwnerPinState> = {}) =>
  ownerPins(
    { world, persona, library: [lib], globalTraits, owned, sharedPlaceholders: shared, ...extra },
    { placeholders: allPlaceholders },
  );

describe('ownerPins — every owner’s pins reach every text (Q17)', () => {
  // Under None the cast is Albus, Mira and Bo; the Custom Persona entity is played.
  const castPins = { mood: 'fierce', 'albus-garb': 'Gilded plate', garb: 'Plate' };

  it("traces each cast owner's blueprint pin to its own copy, in the one set every text reads", () => {
    const pins = pinsUnder(NONE, []);
    expect(pins.world).toEqual(castPins);
    expect(pins.of('albus')).toBe(pins.world);
    expect(pins.of('mira')).toBe(pins.world);
  });

  it("traces a link's overridden pins list to that owner's copy, beside another owner's", () => {
    const ROBE = phValueId('Robe');
    const kitCopy: Placeholder = {
      id: 'kit-garb', name: 'Class Garb', values: [], blueprintId: 'garb',
      valueOverrides: { [ROBE]: { text: { value: 'Sackcloth', blueprint: 'Robe' } } },
    };
    const kit: Entity = { id: 'kit', name: 'Kit', placeholders: [kitCopy], traitLinks: [link('l-kit', 'paladin', [pin('garb', 'Robe', ROBE)])] };
    const pins = ownerPins(
      { world: { ...world, entities: [...world.entities, kit] }, persona: NONE, globalTraits: [], owned: { ...owned, kit: ['paladin'] }, sharedPlaceholders: shared },
      { placeholders: [...allPlaceholders, kitCopy] },
    );
    expect(pins.world).toEqual({ ...castPins, 'kit-garb': 'Sackcloth' });
  });

  it("lays the blueprint itself for an owner with no copy, valued by the link's own pins", () => {
    expect(pinsUnder(NONE, []).world.garb).toBe('Plate');
  });

  it("lays nothing for a pin naming a value the owner's copy removed", () => {
    expect(pinsUnder(NONE, []).world).not.toHaveProperty('bo-garb');
  });

  it("lays a cast entity's pins in world-level text, under the global traits (Q18)", () => {
    const pins = pinsUnder(NONE, [brave]);
    expect(pins.world).toEqual({ ...castPins, mood: 'wary' });
    expect(pins.of(null)).toBe(pins.world);
  });

  it('reads the global slot for no owner, with one copy lookup between them', () => {
    const pins = pinsUnder(NONE, [brave]);
    expect(pins.of(undefined)).toBe(pins.world);
    expect(pins.copies(undefined)).toBe(pins.copies(null));
  });

  it("lets the played persona's pin beat a cast entity's, wherever the persona sits (Q18)", () => {
    // The Custom Persona entity's Robe beats Mira's Plate though Mira is listed first.
    const pins = pinsUnder(NONE, [brave], { owned: picked });
    expect(pins.world).toEqual({ ...castPins, mood: 'wary', garb: 'Robe' });
    expect(pins.of('mira')).toBe(pins.world);
  });

  it("gives a directly held blueprint pin the pin's own text, on the copy of whoever is played", () => {
    expect(pinsUnder(NONE, [cloak], { owned: {} }).world).toEqual({ garb: 'Robe' });
    // Played as Albus, the same root trait lands on his own copy of Class Garb.
    expect(pinsUnder(AS_ALBUS, [cloak], { owned: { albus: ['t-stern'] } }).world).toEqual({ 'albus-garb': 'Robe', mood: 'fierce' });
  });

  it("lays every global trait after the persona's, so a global trait wins even where the persona's node sits (Q18)", () => {
    const calm = trait('calm', [pin('mood', 'calm')], { groupId: null, order: 3 });
    const placed = { ...albus, traitPlacement: { groupId: null, order: 2 } };
    // No Custom Persona entity: the picked persona then keeps its own place in the tree.
    const among = { ...world, traits: [...world.traits, calm], entities: [placed, mira, bo] };
    expect(pinsUnder(AS_ALBUS, [brave, calm], { world: among, owned: { albus: ['t-stern'] } }).world.mood).toBe('calm');
    expect(pinsUnder(AS_ALBUS, [brave], { world: among, owned: { albus: ['t-stern'] } }).world.mood).toBe('wary');
    expect(pinsUnder(AS_ALBUS, [], { world: among, owned: { albus: ['t-stern'] } }).world.mood).toBe('fierce');
  });

  it("reads the played persona's own text with the one set", () => {
    const pins = pinsUnder(AS_ALBUS, [brave]);
    expect(pins.world).toEqual({ ...castPins, mood: 'wary' });
    expect(pins.of('albus')).toBe(pins.world);
  });

  it("binds the Custom Persona entity's pins to a library persona's own copy first", () => {
    expect(pinsUnder(AS_LIB, [], { owned: { cp: ['paladin'] } }).world).toEqual({ 'lib-garb': 'Robe' });
  });

  it("reads the Custom Persona entity's copy for the player under None and under a library persona without one, never under a world persona", () => {
    const youCopy: Entity = { ...you, placeholders: [garbCopy('cp-garb', 'Newcomer robe')], traitLinks: [link('l-you', 'paladin')] };
    const w = { ...world, entities: [albus, mira, bo, youCopy] };
    const albusPins = { mood: 'fierce', 'albus-garb': 'Gilded plate' };
    const under = (persona: PersonaRef, library: Entity[]) => ownerPins(
      { world: w, persona, library, globalTraits: [], owned: { albus: owned.albus, cp: ['paladin'] }, sharedPlaceholders: shared },
      { placeholders: [...allPlaceholders, ...youCopy.placeholders!] },
    ).world;
    expect(under(NONE, [])).toEqual({ ...albusPins, 'cp-garb': 'Newcomer robe' });
    expect(under(AS_LIB, [{ ...lib, placeholders: [] }])).toEqual({ ...albusPins, 'cp-garb': 'Newcomer robe' });
    expect(under(AS_LIB, [lib])).toEqual({ ...albusPins, 'lib-garb': 'Wren cloak' });
    expect(under(AS_ALBUS, [])).toEqual(albusPins);
  });

  it("lets only the player's traits decide which global stat bands pin", () => {
    const pins = ownerPins(
      { world, persona: NONE, globalTraits: [], owned, sharedPlaceholders: shared },
      { placeholders: shared, stats: [hunger] },
    );
    // Mira's Paladin switches Hunger off; that toggle is not the player's, so the band still pins.
    expect(pins.world.mood).toBe('calm');
  });

  it('drops a disabled player trait, and binds a trait card for its owner', () => {
    const pins = pinsUnder(NONE, [brave], { disabledTraitIds: ['brave'], owned: picked });
    expect(pins.world).toEqual({ ...castPins, garb: 'Robe' });
    expect(pins.bind(paladin, 'albus').placeholderPins).toEqual([{ placeholderId: 'albus-garb', value: 'Gilded plate', valueId: TABARD }]);
    expect(pins.bind(paladin, 'bo').placeholderPins).toEqual([]);
    expect(pins.bind(paladin, 'mira').placeholderPins).toEqual(paladinPins);
    expect(pins.bind(brave, 'albus')).toBe(brave);
  });

  it('reads the one set for an owner the playthrough does not hold', () => {
    const pins = pinsUnder(NONE, []);
    expect(pins.of('ghost')).toBe(pins.world);
  });

  it("lays a Custom Persona pick's pin under None, and nothing from it under a world persona, where it lies dormant", () => {
    expect(pinsUnder(NONE, [], { owned: picked }).world.garb).toBe('Robe');
    const asAlbus = pinsUnder(AS_ALBUS, [], { owned: picked }).world;
    // Mira's Plate is all that pins the blueprint while the Custom Persona entity is absent.
    expect(asAlbus.garb).toBe('Plate');
    expect(asAlbus['albus-garb']).toBe('Gilded plate');
  });
});

describe('ownerPins — a character’s own stat bands (Q6, Q10, Q11, Q19)', () => {
  const town: Placeholder = { id: 'town', name: 'Town', values: phValues(['Sedge', 'Marrow', 'Fen']) };
  const albusMood: Placeholder = { id: 'albus-mood', name: 'Mood', values: phValues(['proud', 'meek']) };
  /** A stat of `owner` at `value` with one band up to 50 laying `pins`. */
  const standing = (value: number, pins: PlaceholderPin[], extra: Partial<PinnableStat> = {}): PinnableStat => ({
    id: 'standing', value, min: 0, max: 100, enabled: true,
    descriptors: [{ id: 'low', threshold: 50, description: 'Low', placeholderPins: pins }], ...extra,
  });
  const run = (persona: PersonaRef, entityStats: Record<string, PinnableStat[]>, extra: Partial<OwnerPinState> = {}, stats: PinnableStat[] = []) =>
    ownerPins(
      { world, persona, library: [lib], globalTraits: [], owned: {}, sharedPlaceholders: shared, entityStats, ...extra },
      { placeholders: [...allPlaceholders, town, albusMood], stats },
    );

  it("pins world text and every other text from a cast entity's band, whoever is played", () => {
    const stats = { mira: [standing(10, [pin('town', 'Fen')])] };
    for (const persona of [NONE, AS_ALBUS, AS_LIB]) {
      const pins = run(persona, stats);
      expect(pins.world.town).toBe('Fen');
      expect(pins.of('bo')).toBe(pins.world);
    }
  });

  it("pins from the played persona's own band too", () => {
    expect(run(AS_ALBUS, { albus: [standing(10, [pin('town', 'Marrow')])] }).world.town).toBe('Marrow');
  });

  it('lays nothing once the stat leaves the band', () => {
    expect(run(NONE, { mira: [standing(80, [pin('town', 'Fen')])] }).world.town).toBeUndefined();
  });

  it("pins the character's own placeholder", () => {
    expect(run(NONE, { albus: [standing(10, [pin('albus-mood', 'meek')])] }).world['albus-mood']).toBe('meek');
  });

  it("holds while the character is out of the scene: the collection reads no scene, only who is in the playthrough", () => {
    // A persona-only Persona not played is out of the playthrough, so her band lays nothing.
    const solo = { ...world, entities: [{ ...albus, personaOnly: true }, mira, bo, you] };
    const stats = { albus: [standing(10, [pin('town', 'Marrow')])] };
    expect(run(NONE, stats).world.town).toBe('Marrow');
    expect(run(NONE, stats, { world: solo }).world.town).toBeUndefined();
  });

  it("lets the character's own traits in force switch her stat off", () => {
    const off = trait('t-off', [], { groupId: null, order: 1, statToggles: [{ statId: 'standing', enabled: false }] });
    const w = { ...world, entities: [albus, { ...mira, traits: [off] }, bo, you] };
    const stats = { mira: [standing(10, [pin('town', 'Fen')])] };
    expect(run(NONE, stats, { world: w }).world.town).toBe('Fen');
    expect(run(NONE, stats, { world: w, owned: { mira: ['t-off'] } }).world.town).toBeUndefined();
  });

  it('orders ties inside the band kind: global wins, then the played persona, then the later character (Q18)', () => {
    const at = (value: string) => [standing(10, [pin('town', value)])];
    // Bo is listed after Mira, so Bo's band wins between the two.
    expect(run(NONE, { mira: at('Fen'), bo: at('Sedge') }).world.town).toBe('Sedge');
    expect(run(NONE, { bo: at('Sedge'), mira: at('Fen') }).world.town).toBe('Sedge');
    // Played Albus is listed first and still beats both.
    expect(run(AS_ALBUS, { albus: at('Marrow'), mira: at('Fen'), bo: at('Sedge') }).world.town).toBe('Marrow');
    // A global band beats every character's.
    const globalBand = { ...standing(10, [pin('town', 'Fen')]), id: 'g-standing' };
    expect(run(AS_ALBUS, { albus: at('Marrow'), bo: at('Sedge') }, {}, [globalBand]).world.town).toBe('Fen');
  });

  it('keeps the order between kinds: any band beats any trait', () => {
    const pins = run(NONE, { mira: [standing(10, [pin('mood', 'calm')])] }, { owned: { albus: ['t-stern'] }, globalTraits: [brave] });
    expect(pins.world.mood).toBe('calm');
  });
});

describe('ownerPins — a Blueprint stat’s band pins each owner’s own copy (Q13, Q16)', () => {
  // Pregnancy is a Blueprint stat; Term is a Blueprint placeholder each mare copies.
  const term: Placeholder = { id: 'term', name: 'Term', values: phValues(['early', 'late']) };
  const termCopy = (id: string): Placeholder => ({ id, name: 'Term', values: [], blueprintId: 'term' });
  const dawn: Entity = { id: 'dawn', name: 'Dawn', placeholders: [termCopy('dawn-term')] };
  const ember: Entity = { id: 'ember', name: 'Ember', placeholders: [termCopy('ember-term')] };
  const town: Placeholder = { id: 'town', name: 'Town', values: phValues(['Sedge', 'Fen']) };
  const pregnancy = (value: number): PinnableStat => ({
    id: 'pregnancy', value, min: 0, max: 100, enabled: true,
    descriptors: [
      { id: 'b-early', threshold: 50, description: 'Early', placeholderPins: [pin('term', 'early', phValueId('early')), pin('town', 'Fen')] },
      { id: 'b-late', threshold: 100, description: 'Late', placeholderPins: [pin('term', 'late', phValueId('late'))] },
    ],
  });
  const mares = { traits: [], traitGroups: [], entities: [dawn, ember] };
  const run = (blueprints?: OwnerPinState['blueprints']) => ownerPins(
    {
      world: mares, persona: NONE, globalTraits: [], owned: {}, sharedPlaceholders: [term, town],
      entityStats: { dawn: [pregnancy(20)], ember: [pregnancy(90)] }, ...(blueprints ? { blueprints } : {}),
    },
    { placeholders: [term, town, ...dawn.placeholders!, ...ember.placeholders!] },
  );
  const blueprints = { stats: new Set(['pregnancy']), placeholders: new Set(['term']) };

  it("reads each mare's own copy's pinned value, from her own band", () => {
    const pins = run(blueprints);
    expect(pins.world['dawn-term']).toBe('early');
    expect(pins.world['ember-term']).toBe('late');
    expect(pins.world.term).toBeUndefined();
  });

  it('ignores a world placeholder a Blueprint stat’s band pins by hand', () => {
    expect(run(blueprints).world.town).toBeUndefined();
    // An own stat of the same shape pins it.
    expect(run({ stats: new Set(), placeholders: new Set(['term']) }).world.town).toBe('Fen');
  });
});

describe('ownerPriming — what roll priming walks per owner', () => {
  it("walks each owner's pin values traced to its own copy or the blueprint, and nothing for a removed value", () => {
    const texts = allPinTexts({
      traits: [...world.traits, ...ownerPriming(world, [lib], shared).pinTraits],
      placeholders: allPlaceholders,
    });
    // Albus's link, and the player's cloak, which lands on Albus's own copy while you play him.
    expect([...texts['albus-garb']].sort()).toEqual(['Gilded plate', 'Robe']);
    // Paladin's own pin, Mira's and the Custom Persona entity's link pins, and the directly held cloak.
    expect([...texts.garb].sort()).toEqual(['Plate', 'Robe', 'Tabard']);
    // Under the library persona the player's pins land on its own copy.
    expect(texts['lib-garb']).toEqual(['Robe']);
    expect(texts['bo-garb']).toBeUndefined();
    expect(texts['']).toBeUndefined();
  });

  it("walks every owner's own trait and group text, which the world's lists leave out", () => {
    const owner: Entity = {
      id: 'kit', name: 'Kit',
      traits: [trait('t-kit', [], { name: 'Kit’s {{ph:mood:world:p1}} streak', aiDescription: 'Kit hums {{ph:mood:world:p2}}.' })],
      traitGroups: [{ id: 'g-kit', name: 'Habits', aiDescription: 'Kit’s {{ph:mood:world:p3}} habits.', parentId: null }],
    };
    const { texts } = ownerPriming({ ...world, entities: [owner] }, [], shared);
    expect(texts).toEqual(expect.arrayContaining([
      'Kit’s {{ph:mood:world:p1}} streak', 'Kit hums {{ph:mood:world:p2}}.', 'Kit’s {{ph:mood:world:p3}} habits.',
    ]));
  });
});

describe('withOwnerNames — linked rows in the Traits tab', () => {
  const vow = trait('vow', [], { name: '{{char}}’s Vow', groupId: 'blueprints' });
  const oaths = { id: 'oaths', name: '{{char}}’s Oaths', parentId: 'blueprints', order: 0 };
  const vowWorld = {
    ...world, traits: [...world.traits, vow], traitGroups: [...world.traitGroups, oaths],
    entities: [{ ...mira, traitLinks: [link('l-vow', 'vow')] }, { ...bo, traitLinks: [{ ...link('l-oaths', 'oaths'), kind: 'group' as const }] }],
  };
  const named = (text: string, owner: Entity) => text.replace('{{char}}', owner.name);

  it("names a linked row for its entity, and leaves the player's rows alone", () => {
    const tree = withOwnerNames(ownerTraitTree(vowWorld, NONE), vowWorld, named);
    expect(tree.traits.filter((t) => t.id === 'vow').map((t) => [rowOwner(tree, t), t.name])).toEqual([['mira', 'Mira’s Vow']]);
    expect(tree.groups.find((g) => g.id === ownerGroupId('bo', 'oaths'))?.name).toBe('Bo’s Oaths');
    expect(tree.traits.find((t) => t.id === 'brave')?.name).toBe('brave');
  });
});

describe('ownerTraitTree — the player-facing tree', () => {
  const classes = { id: 'classes', name: 'Classes', parentId: 'blueprints', order: 0, maxPicks: 1 };
  const wizard = trait('wizard', [], { groupId: 'classes', order: 1 });
  const linkedWorld = {
    ...world,
    traits: [brave, cloak, { ...paladin, groupId: 'classes', order: 0 }, wizard],
    traitGroups: [...world.traitGroups, classes],
    entities: [
      { ...albus, traitLinks: [link('l-albus', 'classes')], traitPlacement: { groupId: null, order: 5 } },
      { ...mira, traitGroups: [{ id: 'g-mira', name: 'Bond', parentId: null, order: 0 }], traitLinks: [{ ...link('l-mira', 'classes'), groupId: 'g-mira' }] },
      { ...you, traitLinks: [link('l-you', 'wizard')] },
    ],
  };
  const rows = (t: { id: string; groupId?: string | null }[]) => t.map((x) => [x.id, x.groupId ?? null]);

  it('gives each entity owner a node holding its links expanded, with group rows keyed by owner', () => {
    const tree = ownerTraitTree(linkedWorld, NONE);
    expect(tree.groups.map((g) => [g.id, g.parentId])).toEqual([
      ['albus', null], [ownerGroupId('albus', 'classes'), 'albus'],
      ['mira', null], [ownerGroupId('mira', 'g-mira'), 'mira'], [ownerGroupId('mira', 'classes'), ownerGroupId('mira', 'g-mira')],
      ['cp', null],
    ]);
    expect(rows(tree.traits)).toEqual([
      ['brave', null], ['cloak', null],
      ['t-stern', 'albus'], ['paladin', ownerGroupId('albus', 'classes')], ['wizard', ownerGroupId('albus', 'classes')],
      ['paladin', ownerGroupId('mira', 'classes')], ['wizard', ownerGroupId('mira', 'classes')],
      ['wizard', 'cp'],
    ]);
    expect([...tree.entityNodes.keys()]).toEqual(['albus', 'mira', 'cp']);
    expect(tree.groups.find((g) => g.id === ownerGroupId('albus', 'classes'))?.maxPicks).toBe(1);
    expect(tree.traits.map((t) => rowOwner(tree, t))).toEqual([null, null, 'albus', 'albus', 'albus', 'mira', 'mira', 'cp']);
  });

  it('keeps only In Scene owners, the player and the kept library owners, and draws a stranger under its label', () => {
    const tree = inSceneTraitTree(ownerTraitTree(linkedWorld, NONE), {
      scene: new Set(['albus']), keep: new Set(), labels: new Map([['albus', 'a hooded man']]),
    });
    expect([...tree.entityNodes.keys()]).toEqual(['albus', 'cp']);
    expect(tree.entityNodes.get('albus')?.name).toBe('a hooded man');
    expect(tree.groups.find((g) => g.id === 'albus')?.name).toBe('a hooded man');
    expect(tree.groups.some((g) => g.id === 'mira' || g.id.startsWith('mira/'))).toBe(false);
    expect(tree.traits.map((t) => rowOwner(tree, t))).toEqual([null, null, 'albus', 'albus', 'albus', 'cp']);
    expect([...tree.ownerOfGroup.values()]).not.toContain('mira');
  });

  it('keeps a kept owner that is not in scene', () => {
    const tree = inSceneTraitTree(ownerTraitTree(linkedWorld, NONE), { scene: new Set(), keep: new Set(['mira']), labels: new Map() });
    expect([...tree.entityNodes.keys()]).toEqual(['mira', 'cp']);
    expect(tree.entityNodes.get('mira')?.name).toBe('Mira');
  });

  it("gives the Custom Persona entity a node beside the player's top level under None, and none under a world persona", () => {
    const none = ownerTraitTree(linkedWorld, NONE);
    expect(rows(none.traits).slice(0, 2)).toEqual([['brave', null], ['cloak', null]]);
    expect(none.traits.filter((t) => rowOwner(none, t) === 'cp').map((t) => t.id)).toEqual(['wizard']);
    expect(none.owners.find((b) => b.id === 'cp')?.isPlayer).toBe(true);
    const asAlbus = ownerTraitTree(linkedWorld, AS_ALBUS);
    expect(asAlbus.entityNodes.has('cp')).toBe(false);
    expect(asAlbus.traits.map((t) => rowOwner(asAlbus, t))).not.toContain('cp');
  });

  it('places a node where the author put it, ends the top level with the unplaced ones, and puts an added library character last', () => {
    const wolf: Entity = { id: 'wolf', name: 'Wolf', traits: [trait('t-wild')] };
    const tree = ownerTraitTree(linkedWorld, AS_LIB, [{ ...lib, traits: [trait('t-lib')] }, wolf]);
    const nodes = tree.groups.filter((g) => tree.entityNodes.has(g.id)).map((g) => [g.id, g.order] as const);
    // The library persona takes the unplaced marked entity's place among the nodes.
    expect(nodes.map(([id]) => id)).toEqual(['albus', 'mira', 'lib', 'cp', 'wolf']);
    expect(nodes.find(([id]) => id === 'albus')?.[1]).toBe(5);
    // The unplaced nodes follow the last top-level order, Albus's placed node at 5.
    const rootMax = Math.max(5, ...tree.traits.filter((t) => t.groupId == null).map((t) => t.order ?? 0));
    const unplaced = nodes.filter(([id]) => id !== 'albus').map(([, order]) => order ?? -1);
    expect(unplaced).toEqual([rootMax + 1, rootMax + 2, rootMax + 3, rootMax + 4]);
  });

  describe('the picked persona in the marked entity’s slot', () => {
    // Knights is a root group Albus's node sits in; the marked entity sits at the top level, third.
    const knights = { id: 'g-knights', name: 'Knights', parentId: null, order: 3 };
    const slotWorld = {
      ...linkedWorld,
      traitGroups: [...linkedWorld.traitGroups, knights],
      entities: [
        { ...linkedWorld.entities[0], traitPlacement: { groupId: 'g-knights', order: 0 } },
        linkedWorld.entities[1],
        { ...linkedWorld.entities[2], traitPlacement: { groupId: null, order: 2 } },
      ],
    };
    const nodeAt = (tree: ReturnType<typeof ownerTraitTree>, id: string) => {
      const node = tree.groups.find((g) => g.id === id);
      return node ? [node.parentId, node.order] : null;
    };

    it('keeps the marked entity in its slot under None, and marks it the player’s', () => {
      const tree = ownerTraitTree(slotWorld, NONE);
      expect(nodeAt(tree, 'cp')).toEqual([null, 2]);
      expect(nodeAt(tree, 'albus')).toEqual(['g-knights', 0]);
      expect(playerEntityIds(tree)).toEqual(['cp']);
    });

    it('moves a played world persona’s node into the marked entity’s slot, out of its own group, with the marked node gone', () => {
      const tree = ownerTraitTree(slotWorld, AS_ALBUS);
      expect(nodeAt(tree, 'albus')).toEqual([null, 2]);
      expect(nodeAt(tree, 'cp')).toBeNull();
      // Albus's node stands third among the nodes, where the marked entity stood.
      expect(tree.groups.filter((g) => tree.entityNodes.has(g.id)).map((g) => g.id)).toEqual(['mira', 'albus']);
      expect(playerEntityIds(tree)).toEqual(['albus']);
    });

    it('puts a library persona’s node in the marked entity’s slot with the marked node right after it, both the player’s', () => {
      const tree = ownerTraitTree(slotWorld, AS_LIB, [{ ...lib, traits: [trait('t-lib')] }]);
      expect(nodeAt(tree, 'lib')).toEqual([null, 2]);
      expect(nodeAt(tree, 'cp')).toEqual([null, 2]);
      expect(tree.groups.filter((g) => tree.entityNodes.has(g.id)).map((g) => g.id)).toEqual(['albus', 'mira', 'lib', 'cp']);
      expect(playerEntityIds(tree)).toEqual(['cp', 'lib']);
      expect(rowOwner(tree, tree.traits.find((t) => t.id === 't-lib')!)).toBe('lib');
      expect(tree.traits.filter((t) => t.id === 'wizard').map((t) => rowOwner(tree, t))).toEqual(['albus', 'mira', 'cp']);
    });

    it('leaves a played persona at its own placement when the world has no marked entity', () => {
      const unmarked = { ...slotWorld, entities: slotWorld.entities.slice(0, 2) };
      expect(nodeAt(ownerTraitTree(unmarked, AS_ALBUS), 'albus')).toEqual(['g-knights', 0]);
      const withLib = ownerTraitTree(unmarked, AS_LIB, [{ ...lib, traits: [trait('t-lib')] }]);
      // Unplaced, after Mira's unplaced node at 4.
      expect(nodeAt(withLib, 'lib')).toEqual([null, 5]);
    });
  });

  it('leaves out an owner the playthrough does not hold', () => {
    const ghost: Entity = { id: 'ghost', name: 'Ghost', persona: true, personaOnly: true, traits: [trait('t-ghost')] };
    expect(ownerTraitTree({ ...linkedWorld, entities: [...linkedWorld.entities, ghost] }, NONE).entityNodes.has('ghost')).toBe(false);
    expect(ownerTraitTree({ ...linkedWorld, entities: [...linkedWorld.entities, ghost] }, { source: 'world', entityId: 'ghost' }).entityNodes.has('ghost')).toBe(true);
  });
});

describe('activeOwnedTraitIds', () => {
  it('reads each entity’s chosen traits less the ones switched off', () => {
    expect(activeOwnedTraitIds({ ash: { chosen: ['a', 'b'], disabled: ['a'] }, bo: { chosen: ['c'] } }))
      .toEqual({ ash: ['b'], bo: ['c'] });
  });
});

describe('the library entities in play', () => {
  const world = { traits: [trait('w-paladin', [], { name: 'Paladin' })], traitGroups: [], entities: [] };
  const persona: Entity = {
    id: 'lib-wren', name: 'Wren', persona: true,
    traits: [trait('t-oath', [], { requires: [{ all: [{ kind: 'trait', id: 'elsewhere', name: 'Paladin' }] }] })],
  };
  const added: Entity = {
    id: 'copy-moss', name: 'Moss', traits: [trait('t-calm', [], { requires: [{ all: [{ kind: 'trait', id: 'x', name: 'Paladin' }] }] })],
  };

  it('lists the library persona, then the characters added at Enter World, never a character met in play', () => {
    const discovered = [
      { entity: added, locationId: 'dock', sourceTurnId: INITIAL_SOURCE_TURN_ID },
      { entity: { id: 'met', name: 'Met' }, locationId: 'dock', sourceTurnId: 'turn-3' },
    ];
    expect(inPlayLibrary(world, persona, addedCharacters(discovered)).map((e) => e.id)).toEqual(['lib-wren', 'copy-moss']);
  });

  it("binds the library persona's and the added characters' requirements to the world by name", () => {
    const [wren, moss] = inPlayLibrary(world, persona, [added]);
    expect(wren.traits![0].requires).toEqual([{ all: [{ kind: 'trait', id: 'w-paladin', name: 'Paladin' }] }]);
    expect(moss.traits![0].requires).toEqual([{ all: [{ kind: 'trait', id: 'w-paladin', name: 'Paladin' }] }]);
    expect(inPlayLibrary(world, null)).toEqual([]);
  });

  describe('libraryUnder — the library a new persona leaves', () => {
    const library = [persona, added];
    const wren: PersonaRef = { source: 'library', entityId: 'lib-wren' };

    it('drops the library persona the player stopped playing, and keeps the added characters', () => {
      expect(libraryUnder(library, wren, { source: 'world', entityId: 'w-mira' }).map((e) => e.id)).toEqual(['copy-moss']);
      expect(libraryUnder(library, wren, { source: 'none' }).map((e) => e.id)).toEqual(['copy-moss']);
    });

    it('keeps the list as it is when the library persona still plays, or none played', () => {
      expect(libraryUnder(library, wren, { ...wren })).toBe(library);
      expect(libraryUnder(library, { source: 'world', entityId: 'w-ash' }, { source: 'none' })).toBe(library);
      expect(libraryUnder(library, undefined, wren)).toBe(library);
    });
  });
});

describe('blueprint chips per owner — copies and priming', () => {
  const chipOf = (id: string) => `{{ph:${id}:world:p-${id}}}`;
  // Paladin's text places Class Garb; each owner should read and roll its own copy.
  const texted = { ...world, traits: world.traits.map((t) => (t.id === 'paladin' ? { ...t, aiDescription: `Wears ${chipOf('garb')}.` } : t)) };
  const withText = (persona: PersonaRef) => ownerPins(
    { world: texted, persona, library: [lib], globalTraits: [], owned, sharedPlaceholders: shared }, { placeholders: allPlaceholders },
  );

  it("gives each owner a copy lookup that reads its own copy, and the player's under the played persona", () => {
    expect(withText(NONE).copies('albus')('garb')?.id).toBe('albus-garb');
    expect(withText(NONE).copies('mira')('garb')).toBeUndefined();
    expect(withText(NONE).copies(null)('garb')).toBeUndefined();
    expect(withText(AS_ALBUS).copies(null)('garb')?.id).toBe('albus-garb');
    expect(withText(AS_LIB).copies(null)('garb')?.id).toBe('lib-garb');
  });

  const readsOf = (text: string) => {
    const withCloak = { ...texted, traits: texted.traits.map((t) => (t.id === 'cloak' ? { ...t, aiDescription: text } : t)) };
    return new Set(ownerPriming(withCloak, [lib], shared).copyTexts
      .filter((g) => g.texts.includes(text)).map((g) => g.copies('garb')?.id ?? 'garb'));
  };

  it("primes a linked original's text under each linking owner's copy lookup", () => {
    // Albus's and Bo's copies; Mira and the Custom Persona entity hold none and read the blueprint.
    const { copyTexts } = ownerPriming(texted, [lib], shared);
    const reads = copyTexts.filter((g) => g.texts.includes(`Wears ${chipOf('garb')}.`)).map((g) => g.copies('garb')?.id ?? 'garb');
    expect(new Set(reads)).toEqual(new Set(['albus-garb', 'bo-garb', 'garb']));
  });

  it("primes a root trait's text once per way the player can be played", () => {
    // None, Albus as a world persona, and Wren as the library persona.
    expect(readsOf(`Cloaked in ${chipOf('garb')}.`)).toEqual(new Set(['garb', 'albus-garb', 'lib-garb']));
  });
});
