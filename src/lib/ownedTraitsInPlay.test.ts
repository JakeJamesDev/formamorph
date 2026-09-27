import { describe, it, expect } from 'vitest';
import type { Entity, PersonaRef, Placeholder, PlaceholderPin, Trait, TraitLink } from '@/types';
import { phValues } from '@/test/placeholderValues';
import type { PinnableStat } from './placeholderPins';
import {
  activeOwnedTraitIds, addedCharacters, bearerGroupId, bearerPins, bearerTraitTree, inPlayLibrary, rowBearer, type BearerPinState,
} from './ownedTraitsInPlay';
import { INITIAL_SOURCE_TURN_ID } from './runtimeCharacters';

const pin = (placeholderId: string, value: string): PlaceholderPin => ({ placeholderId, value });
const trait = (id: string, pins: PlaceholderPin[] = [], extra: Partial<Trait> = {}): Trait =>
  ({ id, name: id, statChanges: [], ...(pins.length ? { placeholderPins: pins } : {}), ...extra });
const NONE: PersonaRef = { source: 'none' };
const shared: Placeholder[] = [
  { id: 'garb', name: 'Class Garb', values: phValues(['Robe', 'Plate', 'Tabard']) },
  { id: 'mood', name: 'Mood', values: phValues(['calm', 'wary', 'fierce']) },
];
const garb = (value: string): PlaceholderPin => ({ placeholderId: '', value, bearerPlaceholder: 'Class Garb' });
const link = (id: string, originalId: string, pinValues?: TraitLink['pinValues']): TraitLink =>
  ({ id, originalId, kind: 'trait', originalName: originalId, groupId: null, order: 5, ...(pinValues ? { pinValues } : {}) });
const worn = (value: string) => ({ paladin: { 'Class Garb': { value } } });

const paladin = trait('paladin', [garb('Tabard')], { groupId: 'templates', statToggles: [{ statId: 'hunger', enabled: false }] });
const brave = trait('brave', [pin('mood', 'wary')], { groupId: null, order: 0 });
const cloak = trait('cloak', [garb('Robe')], { groupId: null, order: 1 });
// Albus carries his own Class Garb; Mira and Bo fall back to the world's.
const albus: Entity = {
  id: 'albus', name: 'Albus', persona: true,
  placeholders: [{ id: 'albus-garb', name: 'Class Garb', values: phValues(['Gilded plate', 'Chain']) }],
  traits: [trait('t-stern', [pin('mood', 'fierce')], { groupId: null, order: 0 })],
  traitLinks: [link('l-albus', 'paladin', worn('Gilded plate'))],
};
const mira: Entity = { id: 'mira', name: 'Mira', traitLinks: [link('l-mira', 'paladin', worn('Plate'))] };
const bo: Entity = { id: 'bo', name: 'Bo', traitLinks: [link('l-bo', 'paladin')] };
const lib: Entity = {
  id: 'lib', name: 'Wren', persona: true,
  placeholders: [{ id: 'lib-garb', name: 'Class Garb', values: phValues(['Wren cloak']) }],
};
const world = {
  traits: [brave, cloak, paladin],
  traitGroups: [{ id: 'templates', name: 'Templates', parentId: null, order: 2, system: 'templates' as const }],
  entities: [albus, mira, bo],
  customPersona: { traitLinks: [link('l-you', 'paladin', worn('Robe'))] },
};
const hunger: PinnableStat = {
  id: 'hunger', value: 10, min: 0, max: 100, enabled: true,
  descriptors: [{ id: 'starving', threshold: 20, description: 'Starving', placeholderPins: [pin('mood', 'calm')] }],
};
const owned = { albus: ['t-stern', 'paladin'], mira: ['paladin'], bo: ['paladin'] };
const pinsUnder = (persona: PersonaRef, playerTraits: Trait[], extra: Partial<BearerPinState> = {}) =>
  bearerPins(
    { world, persona, library: [lib], playerTraits, owned, sharedPlaceholders: shared, ...extra },
    { placeholders: [...shared, ...albus.placeholders!, ...lib.placeholders!] },
  );

describe('bearerPins — each bearer lays its own pins', () => {
  it("binds a bearer-relative pin to the bearer's own placeholder, valued by the link", () => {
    expect(pinsUnder(NONE, []).of('albus')).toEqual({ 'albus-garb': 'Gilded plate', mood: 'fierce' });
  });

  it('falls back to the world placeholder of that name, valued by the link', () => {
    expect(pinsUnder(NONE, []).of('mira')).toEqual({ garb: 'Plate' });
  });

  it('lays no pin for a link with no value', () => {
    expect(pinsUnder(NONE, []).of('bo')).toEqual({});
  });

  it("keeps a cast entity's pins out of world-level text", () => {
    const pins = pinsUnder(NONE, [brave]);
    expect(pins.world).toEqual({ mood: 'wary' });
    expect(pins.of(null)).toBe(pins.world);
  });

  it("lays the player's pins in world-level text and in a cast entity's, under the entity's own", () => {
    const pins = pinsUnder(NONE, [brave, paladin]);
    expect(pins.world).toEqual({ mood: 'wary', garb: 'Robe' });
    // Mira's Plate beats the player's Robe in her own text; the player's Wary reaches it untouched.
    expect(pins.of('mira')).toEqual({ mood: 'wary', garb: 'Plate' });
    expect(pins.of('bo')).toBe(pins.world);
  });

  it("gives a directly held bearer-relative pin the pin's own value", () => {
    expect(pinsUnder(NONE, [cloak]).world).toEqual({ garb: 'Robe' });
    // Played as Albus, the same root trait binds to his own Class Garb.
    expect(pinsUnder({ source: 'world', entityId: 'albus' }, [cloak], { owned: { albus: ['t-stern'] } }).world)
      .toEqual({ 'albus-garb': 'Robe', mood: 'fierce' });
  });

  it("reads the played persona's own text with the player's set", () => {
    const pins = pinsUnder({ source: 'world', entityId: 'albus' }, [brave]);
    expect(pins.world).toEqual({ mood: 'fierce', 'albus-garb': 'Gilded plate' });
    expect(pins.of('albus')).toBe(pins.world);
  });

  it("binds Custom Persona's links to a library persona's own placeholder first", () => {
    expect(pinsUnder({ source: 'library', entityId: 'lib' }, [paladin]).world).toEqual({ 'lib-garb': 'Robe' });
  });

  it("lets only the player's traits decide which stat bands pin", () => {
    const pins = bearerPins(
      { world, persona: NONE, playerTraits: [], owned, sharedPlaceholders: shared },
      { placeholders: shared, stats: [hunger] },
    );
    // Mira's Paladin switches Hunger off; that toggle is not the player's, so the band still pins.
    expect(pins.of('mira')).toEqual({ garb: 'Plate', mood: 'calm' });
  });

  it('drops a disabled player trait, and binds a trait card for its bearer', () => {
    const pins = pinsUnder(NONE, [brave, paladin], { disabledTraitIds: ['brave'] });
    expect(pins.world).toEqual({ garb: 'Robe' });
    expect(pins.bind(paladin, 'albus').placeholderPins).toEqual([{ placeholderId: 'albus-garb', value: 'Gilded plate' }]);
    expect(pins.bind(paladin, 'bo').placeholderPins).toEqual([]);
    expect(pins.bind(brave, 'albus')).toBe(brave);
  });

  it('lays nothing for a bearer the playthrough does not hold', () => {
    expect(pinsUnder(NONE, []).of('ghost')).toEqual({});
  });

  it("lays a Custom Persona pick's pin under None, and nothing from it under a world persona, where it lies dormant", () => {
    // Custom Persona links Paladin, whose Class Garb pin falls back to the world's; the pick stays chosen.
    expect(pinsUnder(NONE, [paladin]).world.garb).toBe('Robe');
    expect(pinsUnder({ source: 'world', entityId: 'albus' }, [paladin]).world.garb).toBeUndefined();
  });
});

describe('bearerTraitTree — the player-facing tree', () => {
  const classes = { id: 'classes', name: 'Classes', parentId: 'templates', order: 0, exclusive: true };
  const wizard = trait('wizard', [], { groupId: 'classes', order: 1 });
  const linkedWorld = {
    ...world,
    traits: [brave, cloak, { ...paladin, groupId: 'classes', order: 0 }, wizard],
    traitGroups: [...world.traitGroups, classes],
    entities: [
      { ...albus, traitLinks: [link('l-albus', 'classes')], traitPlacement: { groupId: null, order: 5 } },
      { ...mira, traitGroups: [{ id: 'g-mira', name: 'Bond', parentId: null, order: 0 }], traitLinks: [{ ...link('l-mira', 'classes'), groupId: 'g-mira' }] },
    ],
    customPersona: { traitLinks: [link('l-you', 'wizard')] },
  };
  const rows = (t: { id: string; groupId?: string | null }[]) => t.map((x) => [x.id, x.groupId ?? null]);

  it('gives each entity bearer a node holding its links expanded, with group rows keyed by bearer', () => {
    const tree = bearerTraitTree(linkedWorld, NONE);
    expect(tree.groups.map((g) => [g.id, g.parentId])).toEqual([
      ['albus', null], [bearerGroupId('albus', 'classes'), 'albus'],
      ['mira', null], [bearerGroupId('mira', 'g-mira'), 'mira'], [bearerGroupId('mira', 'classes'), bearerGroupId('mira', 'g-mira')],
    ]);
    expect(rows(tree.traits)).toEqual([
      ['brave', null], ['cloak', null], ['wizard', null],
      ['t-stern', 'albus'], ['paladin', bearerGroupId('albus', 'classes')], ['wizard', bearerGroupId('albus', 'classes')],
      ['paladin', bearerGroupId('mira', 'classes')], ['wizard', bearerGroupId('mira', 'classes')],
    ]);
    expect([...tree.entityNodes.keys()]).toEqual(['albus', 'mira']);
    expect(tree.groups.find((g) => g.id === bearerGroupId('albus', 'classes'))?.exclusive).toBe(true);
    expect(tree.traits.map((t) => rowBearer(tree, t))).toEqual(['world', 'world', 'world', 'albus', 'albus', 'albus', 'mira', 'mira']);
  });

  it("merges Custom Persona's links into the player's top level under None, and drops them under a world persona", () => {
    expect(rows(bearerTraitTree(linkedWorld, NONE).traits).slice(0, 3)).toEqual([['brave', null], ['cloak', null], ['wizard', null]]);
    expect(rows(bearerTraitTree(linkedWorld, { source: 'world', entityId: 'albus' }).traits).slice(0, 2)).toEqual([['brave', null], ['cloak', null]]);
  });

  it('places a node where the author put it, ends the top level with the unplaced ones, and puts the library last', () => {
    const wolf: Entity = { id: 'wolf', name: 'Wolf', traits: [trait('t-wild')] };
    const tree = bearerTraitTree(linkedWorld, { source: 'library', entityId: 'lib' }, [{ ...lib, traits: [trait('t-lib')] }, wolf]);
    const nodes = tree.groups.filter((g) => tree.entityNodes.has(g.id)).map((g) => [g.id, g.order] as const);
    expect(nodes.map(([id]) => id)).toEqual(['albus', 'mira', 'lib', 'wolf']);
    expect(nodes.find(([id]) => id === 'albus')?.[1]).toBe(5);
    const rootMax = Math.max(...tree.traits.filter((t) => t.groupId == null).map((t) => t.order ?? 0));
    const unplaced = nodes.filter(([id]) => id !== 'albus').map(([, order]) => order ?? -1);
    expect(unplaced).toEqual([rootMax + 1, rootMax + 2, rootMax + 3]);
  });

  it('leaves out a bearer the playthrough does not hold', () => {
    const ghost: Entity = { id: 'ghost', name: 'Ghost', persona: true, personaOnly: true, traits: [trait('t-ghost')] };
    expect(bearerTraitTree({ ...linkedWorld, entities: [...linkedWorld.entities, ghost] }, NONE).entityNodes.has('ghost')).toBe(false);
    expect(bearerTraitTree({ ...linkedWorld, entities: [...linkedWorld.entities, ghost] }, { source: 'world', entityId: 'ghost' }).entityNodes.has('ghost')).toBe(true);
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
    traits: [trait('t-oath', [], { requires: [{ kind: 'trait', id: 'elsewhere', name: 'Paladin' }] })],
  };
  const added: Entity = {
    id: 'copy-moss', name: 'Moss', traits: [trait('t-calm', [], { requires: [{ kind: 'trait', id: 'x', name: 'Paladin' }] })],
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
    expect(wren.traits![0].requires).toEqual([{ kind: 'trait', id: 'w-paladin', name: 'Paladin' }]);
    expect(moss.traits![0].requires).toEqual([{ kind: 'trait', id: 'w-paladin', name: 'Paladin' }]);
    expect(inPlayLibrary(world, null)).toEqual([]);
  });
});
