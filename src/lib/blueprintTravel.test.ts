// @vitest-environment node
// Must load before the storage singletons, whose first use opens IndexedDB.
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addCopyToStoredWorld } from './addToStoredWorld';
import { bindLibraryEntity, blueprintBindWorld } from './blueprintTravel';
import { copyValueState } from './blueprints';
import { embedEntityCard } from './entityCard';
import { buildEntityCardData, importCharacterFile, parseEntityCardData } from './entityFile';
import { saveCopyToLibrary } from './librarySources';
import { encodePlaceholderToken } from './placeholders';
import { applyLibraryUpdate, type LibrarySource } from './linkedContent';
import { traitWorldOf, type TraitWorld } from './portableTraits';
import EntityStorageService from '@/services/EntityStorageService';
import WorldStorageService from '@/services/WorldStorageService';
import type { Entity, Placeholder, PlaceholderGroup, PlaceholderValue, Trait, TraitGroup } from '@/types';

vi.mock('@/services/AuthService', () => ({ default: { getCurrentUser: () => null } }));

const value = (id: string, text: string): PlaceholderValue => ({ id, text });
/** A chip at `id`, placed as `at` was; a rewrite moves the target and keeps the placement. */
const chip = (id: string, at = id) => encodePlaceholderToken({ id, mode: 'world', placementId: `p-${at}` });
const trait = (id: string, name: string): Trait => ({ id, name, statChanges: [] });
/** A trait inside the world's trait Blueprints, where a link's original sits. */
const blueprintTrait = (id: string, name: string): Trait => ({ ...trait(id, name), groupId: 'tg-bp' });

const BLUEPRINTS: PlaceholderGroup = { id: 'g-bp', name: 'Blueprints', parentId: null, system: 'blueprints' };
const TRAIT_BLUEPRINTS: TraitGroup = { id: 'tg-bp', name: 'Blueprints', parentId: null, system: 'blueprints' };
const tone: Placeholder = { id: 'tone', name: 'Tone', values: [value('v-dry', 'dry')] };

/** Home: Class Garb, whose plate nests Crest and whose robe places the world's Tone. */
const homeCrest: Placeholder = { id: 'crest', name: 'Crest', groupId: 'g-bp', values: [value('v-lion', 'a lion'), value('v-hawk', 'a hawk')] };
const homeGarb: Placeholder = {
  id: 'garb', name: 'Class Garb', groupId: 'g-bp',
  values: [value('v-plate', `plate under ${chip('crest')}`), value('v-robe', `a ${chip('tone')} robe`)],
};
const home = {
  placeholders: [tone, homeGarb, homeCrest], placeholderGroups: [BLUEPRINTS],
  traits: [blueprintTrait('w-paladin', 'Paladin')], traitGroups: [TRAIT_BLUEPRINTS],
};
const homeTraits: TraitWorld = { traits: home.traits, traitGroups: home.traitGroups, entities: [] };

/** Elsewhere: every placeholder under new ids and new placements. Crest has an eagle in place of the hawk. */
const newTone: Placeholder = { id: 'n-tone', name: 'Tone', values: [value('n-dry', 'dry')] };
const newGarb: Placeholder = {
  id: 'n-garb', name: 'Class Garb', groupId: 'g-bp',
  values: [value('n-plate', `plate under ${chip('n-crest')}`), value('n-robe', `a ${chip('n-tone')} robe`)],
};
const elsewhere = {
  placeholders: [
    newTone, newGarb,
    { id: 'n-crest', name: 'Crest', groupId: 'g-bp', values: [value('n-lion', 'a lion'), value('n-eagle', 'an eagle')] },
  ],
  placeholderGroups: [BLUEPRINTS],
  traits: [blueprintTrait('n-paladin', 'Paladin')], traitGroups: [TRAIT_BLUEPRINTS],
};

/** Bare: no placeholder Blueprints group at all. */
const bare = { placeholders: [tone], placeholderGroups: [], traits: [blueprintTrait('b-paladin', 'Paladin')], traitGroups: [TRAIT_BLUEPRINTS] };

/** Mira holds a copy of each, her own text and vow read her garb, and her Paladin link pins the blueprint. */
const mira: Entity = {
  id: 'mira', name: 'Mira', persona: true,
  playerDescription: `Mira wears ${chip('mira-garb')}.`,
  placeholders: [
    {
      id: 'mira-garb', name: 'Class Garb', blueprintId: 'garb', values: [value('v-own', 'a sash')],
      valueOverrides: { 'v-robe': { text: { value: 'a silk robe', blueprint: `a ${chip('tone')} robe` } } },
    },
    { id: 'mira-crest', name: 'Crest', blueprintId: 'crest', values: [], valueOverrides: { 'v-hawk': { removed: true } } },
  ],
  traits: [{
    ...trait('t-vow', 'Vow'),
    placeholderPins: [
      { placeholderId: 'mira-garb', value: 'a silk robe', valueId: 'v-robe' },
      { placeholderId: 'mira-garb', value: 'a sash', valueId: 'v-own' },
    ],
  }],
  traitLinks: [{
    id: 'l-paladin', originalId: 'w-paladin', kind: 'trait', originalName: 'Paladin', groupId: null, order: 1,
    overrides: {
      'w-paladin': {
        isDefault: { value: true, blueprint: false },
        placeholderPins: { value: [{ placeholderId: 'garb', value: homeGarb.values[0].text, valueId: 'v-plate' }], blueprint: [] },
      },
    },
  }],
};

const fakeWebp = (): Uint8Array => {
  const out = new Uint8Array(24);
  const view = new DataView(out.buffer);
  const put4 = (s: string, at: number) => { for (let i = 0; i < 4; i++) out[at + i] = s.charCodeAt(i); };
  put4('RIFF', 0); view.setUint32(4, 16, true); put4('WEBP', 8); put4('VP8 ', 12); view.setUint32(16, 4, true);
  return out;
};

const pool = [...home.placeholders, ...mira.placeholders!];
const cardOf = (e: Entity) => buildEntityCardData(e, pool, {}, undefined, homeTraits);

/** Each way an entity leaves its world and comes back as a carried entity. */
const carriers: [string, (e: Entity) => Promise<Entity>][] = [
  ['the entity file', async (e) => parseEntityCardData(JSON.parse(JSON.stringify(cardOf(e))))],
  ['the character card', async (e) => {
    const bytes = embedEntityCard(fakeWebp(), JSON.stringify(cardOf(e)), { w: 4, h: 4 });
    const file = new File([bytes], 'mira.webp', { type: 'image/webp' });
    Object.defineProperty(file, 'arrayBuffer', { value: async () => bytes.buffer });
    return (await importCharacterFile(file)).entity;
  }],
  ['the library', async (e) => ({ ...await EntityStorageService.getEntityData((await saveCopyToLibrary(e, pool, [], undefined, homeTraits)).id), id: 'copy' })],
];

const source: LibrarySource = { id: 'lib-1', name: 'Mira', revision: 'r1', owned: true };
const NO_PLAN = { placeholders: {}, locations: {}, newLocations: [], newPlaceholders: [] };

/** `carried` imported into a stored world holding `world`, and the entity as it landed. */
async function importInto(
  world: { placeholders: Placeholder[]; placeholderGroups: PlaceholderGroup[]; traits: Trait[]; traitGroups: TraitGroup[] }, carried: Entity,
) {
  await WorldStorageService.storeWorld({
    id: 'w-1', name: 'Target', author: 'Ann',
    data: {
      worldOverview: { name: 'Target' }, stats: [], statUpdates: [], entities: [], dictionaries: [], locations: [],
      traits: world.traits as unknown as unknown[],
      traitGroups: world.traitGroups as unknown as unknown[],
      placeholders: world.placeholders as unknown as unknown[],
      placeholderGroups: world.placeholderGroups as unknown as unknown[],
    },
  });
  const { blueprintChipsDropped } = await addCopyToStoredWorld('w-1', carried, source, NO_PLAN);
  const data = await WorldStorageService.getWorldData('w-1') as { entities: Entity[]; placeholders: Placeholder[] };
  return { entity: data.entities[0], placeholders: data.placeholders, dropped: blueprintChipsDropped };
}

const copyNamed = (e: Entity, name: string) => e.placeholders!.find((p) => p.name === name)!;

afterEach(async () => {
  for (const record of await EntityStorageService.getEntityMetadata()) await EntityStorageService.deleteEntity(record.id);
  for (const id of await WorldStorageService.getWorldIds()) await WorldStorageService.deleteWorld(id);
});

describe('an entity card', () => {
  it('carries the blueprints its copies read, apart from the shared placeholders they reach', () => {
    const card = cardOf(mira);
    expect(card.blueprints!.map((b) => b.id).sort()).toEqual(['crest', 'garb']);
    expect(card.blueprints!.every((b) => b.groupId == null)).toBe(true);
    expect(card.sharedPlaceholders!.map((p) => p.id)).toEqual(['tone']);
  });
});

describe.each(carriers)('copies through %s', (_name, carry) => {
  it('bind by id at home, keeping every override, snapshot and pin', async () => {
    const { entity, placeholders } = await importInto(home, await carry(mira));
    const garb = copyNamed(entity, 'Class Garb');
    expect(garb).toMatchObject({ blueprintId: 'garb', valueOverrides: mira.placeholders![0].valueOverrides });
    expect(copyNamed(entity, 'Crest')).toMatchObject({ blueprintId: 'crest', valueOverrides: { 'v-hawk': { removed: true } } });
    expect(entity).not.toHaveProperty('blueprints');
    expect(entity.playerDescription).toBe(`Mira wears ${chip(garb.id, 'mira-garb')}.`);
    expect(entity.traits![0].placeholderPins).toEqual([
      { placeholderId: garb.id, value: 'a silk robe', valueId: 'v-robe' },
      { placeholderId: garb.id, value: 'a sash', valueId: garb.values[0].id },
    ]);
    expect(entity.traitLinks![0].overrides).toEqual(mira.traitLinks![0].overrides);
    expect(placeholders.map((p) => p.id)).toEqual(['tone', 'garb', 'crest']);
  });

  it('bind by id at home even after the blueprint is renamed', async () => {
    const renamed = { ...home, placeholders: [tone, { ...homeGarb, name: 'Uniform' }, homeCrest] };
    const { entity } = await importInto(renamed, await carry(mira));
    expect(entity.placeholders!.map((p) => p.blueprintId)).toEqual(['garb', 'crest']);
  });

  it('bind by unique name elsewhere, each override and pin following the value that reads the same', async () => {
    const { entity } = await importInto(elsewhere, await carry(mira));
    const garb = copyNamed(entity, 'Class Garb');
    // The robe reads the same through Tone's new id, so its rewording stays, current against the new blueprint.
    expect(garb).toMatchObject({
      blueprintId: 'n-garb',
      valueOverrides: { 'n-robe': { text: { value: 'a silk robe', blueprint: newGarb.values[1].text } } },
    });
    expect(copyValueState(garb, newGarb, 'n-robe').stale).toEqual([]);
    // The hawk has no twin here, so its removal goes.
    expect(copyNamed(entity, 'Crest')).toMatchObject({ blueprintId: 'n-crest' });
    expect(copyNamed(entity, 'Crest')).not.toHaveProperty('valueOverrides');
    expect(entity.traits![0].placeholderPins).toEqual([
      { placeholderId: garb.id, value: 'a silk robe', valueId: 'n-robe' },
      { placeholderId: garb.id, value: 'a sash', valueId: garb.values[0].id },
    ]);
    expect(entity.traitLinks![0].overrides!['n-paladin'].placeholderPins).toEqual({
      value: [{ placeholderId: 'n-garb', value: newGarb.values[0].text, valueId: 'n-plate' }], blueprint: [],
    });
  });

  it('become plain placeholders without their blueprints, every pin at the blueprint moving to them', async () => {
    const { entity, placeholders, dropped } = await importInto(bare, await carry(mira));
    const garb = copyNamed(entity, 'Class Garb');
    const crest = copyNamed(entity, 'Crest');
    expect(garb).not.toHaveProperty('blueprintId');
    expect(garb).not.toHaveProperty('valueOverrides');
    // The values it read: the plate's Crest chip moves to Mira's own Crest, the robe keeps its rewording.
    // Adoption places each owned value anew, so the chip is read by its target.
    expect(garb.values.map((v) => v.text.replace(/:world:[^}]+/g, ''))).toEqual([`plate under {{ph:${crest.id}}}`, 'a silk robe', 'a sash']);
    expect(crest.values.map((v) => v.text)).toEqual(['a lion']);
    const robe = garb.values[1].id;
    expect(entity.traits![0].placeholderPins).toEqual([
      { placeholderId: garb.id, value: 'a silk robe', valueId: robe },
      { placeholderId: garb.id, value: 'a sash', valueId: garb.values[2].id },
    ]);
    expect(entity.traitLinks![0].overrides!['b-paladin'].placeholderPins!.value).toEqual([
      { placeholderId: garb.id, value: homeGarb.values[0].text, valueId: garb.values[0].id },
    ]);
    expect(placeholders.map((p) => p.id)).toEqual(['tone']);
    expect(dropped).toBe(0);
  });
});

describe('a pin at a value the bound blueprint lacks', () => {
  it('goes, and a trait left with no pins stores none', async () => {
    const hawk: Trait = { ...trait('t-hawk', 'Hawk Sigil'), placeholderPins: [{ placeholderId: 'mira-crest', value: 'a hawk', valueId: 'v-hawk' }] };
    const { entity } = await importInto(elsewhere, await carriers[0][1]({ ...mira, traits: [...mira.traits!, hawk] }));
    expect(entity.traits!.find((t) => t.name === 'Hawk Sigil')).not.toHaveProperty('placeholderPins');
  });
});

describe('a copy whose blueprint name two world blueprints carry', () => {
  it('binds to neither and turns plain', async () => {
    const twice = { ...elsewhere, placeholders: [...elsewhere.placeholders, { ...newGarb, id: 'n-garb-2' }] };
    const { entity } = await importInto(twice, await carriers[0][1](mira));
    expect(copyNamed(entity, 'Class Garb')).not.toHaveProperty('blueprintId');
    expect(copyNamed(entity, 'Crest').blueprintId).toBe('n-crest');
  });
});

describe('a copy that turns plain beside one that binds', () => {
  it('moves its chip at the bound blueprint to the entity’s copy of it', async () => {
    const half = { placeholders: [tone, homeCrest], placeholderGroups: [BLUEPRINTS], traits: [], traitGroups: [TRAIT_BLUEPRINTS] };
    const { entity } = await importInto(half, parseEntityCardData(JSON.parse(JSON.stringify(cardOf(mira)))));
    const crest = copyNamed(entity, 'Crest');
    expect(crest.blueprintId).toBe('crest');
    expect(copyNamed(entity, 'Class Garb').values[0].text.replace(/:world:[^}]+/g, '')).toBe(`plate under {{ph:${crest.id}}}`);
  });
});

describe('a chip at a blueprint that neither binds nor has a copy', () => {
  it('is dropped and counted', async () => {
    // Mira without her Crest copy: the card still carries Crest, and her sash names it too.
    const lone: Entity = { ...mira, placeholders: [{ ...mira.placeholders![0], values: [value('v-own', `a sash with ${chip('crest')}`)] }] };
    const card = { ...cardOf(lone), blueprints: [homeGarb, homeCrest] };
    const { entity, dropped } = await importInto(bare, parseEntityCardData(JSON.parse(JSON.stringify(card))));
    expect(copyNamed(entity, 'Class Garb').values.map((v) => v.text)).toEqual(['plate under ', 'a silk robe', 'a sash with ']);
    expect(dropped).toBe(2);
  });
});

describe('a library update', () => {
  it('binds the source revision’s copies to the world holding the linked copy', async () => {
    const data = await carriers[2][1](mira);
    const linked: Entity = { id: 'mira-here', name: 'Mira', link: { libraryId: 'lib-1', sourceRevision: 'r0' } };
    const { item } = applyLibraryUpdate(linked, data, { ...source, data }, elsewhere.placeholders, traitWorldOf(elsewhere));
    expect(item).not.toHaveProperty('blueprints');
    expect(item.placeholders!.map((p) => p.blueprintId)).toEqual(['n-garb', 'n-crest']);
  });
});

describe('a library persona at play', () => {
  const world = (w: typeof elsewhere) => ({ traits: w.traits, traitGroups: w.traitGroups, entities: [], ...blueprintBindWorld(w) });

  it('binds its copies and links to the world it enters', async () => {
    const there = bindLibraryEntity(await carriers[2][1](mira), world(elsewhere));
    expect(copyNamed(there, 'Class Garb').blueprintId).toBe('n-garb');
    expect(there.traitLinks![0].originalId).toBe('n-paladin');
  });

  it('reads a copy with no blueprint there as a plain placeholder', async () => {
    const garb = copyNamed(bindLibraryEntity(await carriers[2][1](mira), world(bare)), 'Class Garb');
    expect(garb).not.toHaveProperty('blueprintId');
    expect(garb.values.map((v) => v.text)).toEqual([`plate under ${chip('mira-crest', 'crest')}`, 'a silk robe', 'a sash']);
  });
});
