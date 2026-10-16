import { describe, it, expect } from 'vitest';
import type { Entity, PersonaRef, Placeholder, PlaceholderPin, Trait, TraitLink } from '@/types';
import { phValueId, phValues } from '@/test/placeholderValues';
import { allPinTexts, type PinnableStat } from './placeholderPins';
import {
  activeOwnedTraitIds, addedCharacters, ownerGroupId, ownerPins, ownerPriming, ownerTraitTree, inPlayLibrary, libraryUnder, playerEntityIds,
  rowOwner, withOwnerNames,
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

describe('ownerPins — each owner lays its own pins', () => {
  it("traces a blueprint pin to the owner's own copy, with the copy's text", () => {
    expect(pinsUnder(NONE, []).of('albus')).toEqual({ 'albus-garb': 'Gilded plate', mood: 'fierce' });
  });

  it("traces a link's overridden pins list to that owner's copy, while another owner reads its own", () => {
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
    expect(pins.of('kit')).toEqual({ 'kit-garb': 'Sackcloth' });
    expect(pins.of('albus')).toEqual({ 'albus-garb': 'Gilded plate', mood: 'fierce' });
  });

  it("reads the blueprint itself for an owner with no copy, valued by the link's own pins", () => {
    expect(pinsUnder(NONE, []).of('mira')).toEqual({ garb: 'Plate' });
  });

  it("lays nothing for a pin naming a value the owner's copy removed", () => {
    expect(pinsUnder(NONE, []).of('bo')).toEqual({});
  });

  it("keeps a cast entity's pins out of world-level text", () => {
    const pins = pinsUnder(NONE, [brave]);
    expect(pins.world).toEqual({ mood: 'wary' });
    expect(pins.of(null)).toBe(pins.world);
  });

  it('reads the global slot for no owner, with one copy lookup between them', () => {
    const pins = pinsUnder(NONE, [brave]);
    expect(pins.of(undefined)).toBe(pins.world);
    expect(pins.copies(undefined)).toBe(pins.copies(null));
  });

  it("lays the player's pins in world-level text and in a cast entity's, under the entity's own", () => {
    const pins = pinsUnder(NONE, [brave], { owned: picked });
    expect(pins.world).toEqual({ mood: 'wary', garb: 'Robe' });
    // Mira's Plate beats the player's Robe in her own text; the player's Wary reaches it untouched.
    expect(pins.of('mira')).toEqual({ mood: 'wary', garb: 'Plate' });
    expect(pins.of('bo')).toBe(pins.world);
  });

  it("gives a directly held blueprint pin the pin's own text, on the copy of whoever is played", () => {
    expect(pinsUnder(NONE, [cloak]).world).toEqual({ garb: 'Robe' });
    // Played as Albus, the same root trait lands on his own copy of Class Garb.
    expect(pinsUnder(AS_ALBUS, [cloak], { owned: { albus: ['t-stern'] } }).world).toEqual({ 'albus-garb': 'Robe', mood: 'fierce' });
  });

  it("lays every global trait before the persona's, so the persona wins even where its node sits among root traits (Q31)", () => {
    const calm = trait('calm', [pin('mood', 'calm')], { groupId: null, order: 3 });
    const placed = { ...albus, traitPlacement: { groupId: null, order: 2 } };
    // No Custom Persona entity: the picked persona then keeps its own place in the tree.
    const among = { ...world, traits: [...world.traits, calm], entities: [placed, mira, bo] };
    const pins = pinsUnder(AS_ALBUS, [brave, calm], { world: among, owned: { albus: ['t-stern'] } });
    expect(pins.world.mood).toBe('fierce');
    // With no persona node among them, the global traits still lay in tree order, the later winning.
    expect(pinsUnder(NONE, [brave, calm], { world: among, owned: {} }).world.mood).toBe('calm');
  });

  it("reads the played persona's own text with the player's set", () => {
    const pins = pinsUnder(AS_ALBUS, [brave]);
    expect(pins.world).toEqual({ mood: 'fierce', 'albus-garb': 'Gilded plate' });
    expect(pins.of('albus')).toBe(pins.world);
  });

  it("binds the Custom Persona entity's pins to a library persona's own copy first", () => {
    expect(pinsUnder(AS_LIB, [], { owned: picked }).world).toEqual({ 'lib-garb': 'Robe' });
  });

  it("reads the Custom Persona entity's copy for the player under None and under a library persona without one, never under a world persona", () => {
    const youCopy: Entity = { ...you, placeholders: [garbCopy('cp-garb', 'Newcomer robe')], traitLinks: [link('l-you', 'paladin')] };
    const w = { ...world, entities: [albus, mira, bo, youCopy] };
    const under = (persona: PersonaRef, library: Entity[]) => ownerPins(
      { world: w, persona, library, globalTraits: [], owned: picked, sharedPlaceholders: shared },
      { placeholders: [...allPlaceholders, ...youCopy.placeholders!] },
    ).world;
    expect(under(NONE, [])).toEqual({ 'cp-garb': 'Newcomer robe' });
    expect(under(AS_LIB, [{ ...lib, placeholders: [] }])).toEqual({ 'cp-garb': 'Newcomer robe' });
    expect(under(AS_LIB, [lib])).toEqual({ 'lib-garb': 'Wren cloak' });
    expect(under(AS_ALBUS, [])).toEqual({ mood: 'fierce', 'albus-garb': 'Gilded plate' });
  });

  it("lets only the player's traits decide which stat bands pin", () => {
    const pins = ownerPins(
      { world, persona: NONE, globalTraits: [], owned, sharedPlaceholders: shared },
      { placeholders: shared, stats: [hunger] },
    );
    // Mira's Paladin switches Hunger off; that toggle is not the player's, so the band still pins.
    expect(pins.of('mira')).toEqual({ garb: 'Plate', mood: 'calm' });
  });

  it('drops a disabled player trait, and binds a trait card for its owner', () => {
    const pins = pinsUnder(NONE, [brave], { disabledTraitIds: ['brave'], owned: picked });
    expect(pins.world).toEqual({ garb: 'Robe' });
    expect(pins.bind(paladin, 'albus').placeholderPins).toEqual([{ placeholderId: 'albus-garb', value: 'Gilded plate', valueId: TABARD }]);
    expect(pins.bind(paladin, 'bo').placeholderPins).toEqual([]);
    expect(pins.bind(paladin, 'mira').placeholderPins).toEqual(paladinPins);
    expect(pins.bind(brave, 'albus')).toBe(brave);
  });

  it('lays nothing for an owner the playthrough does not hold', () => {
    expect(pinsUnder(NONE, []).of('ghost')).toEqual({});
  });

  it("lays a Custom Persona pick's pin under None, and nothing from it under a world persona, where it lies dormant", () => {
    expect(pinsUnder(NONE, [], { owned: picked }).world.garb).toBe('Robe');
    const asAlbus = pinsUnder(AS_ALBUS, [], { owned: picked }).world;
    expect(asAlbus.garb).toBeUndefined();
    expect(asAlbus['albus-garb']).toBe('Gilded plate');
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
