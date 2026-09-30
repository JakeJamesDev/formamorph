// @vitest-environment node
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { buildEntityCardData, importCharacterFile, parseEntityCardData } from './entityFile';
import { embedEntityCard } from './entityCard';
import { saveCopyToLibrary } from './librarySources';
import { adoptOwnedTraits, type TraitWorld } from './portableTraits';
import { inPlayLibrary } from './ownedTraitsInPlay';
import { resolveBearers } from './bearers';
import EntityStorageService from '@/services/EntityStorageService';
import type { Entity, Trait, TraitLink } from '@/types';

const trait = (id: string, name: string, groupId?: string): Trait => ({ id, name, statChanges: [], ...(groupId ? { groupId } : {}) });

/** The world the entity leaves: Blueprints holding a Class group of two classes and a Smite, and Albus. */
const home: TraitWorld = {
  traits: [trait('w-paladin', 'Paladin', 'w-class'), trait('w-wizard', 'Wizard', 'w-class'), trait('w-smite', 'Smite', 'w-blueprints')],
  traitGroups: [
    { id: 'w-blueprints', name: 'Blueprints', parentId: null, system: 'blueprints' },
    { id: 'w-class', name: 'Class', parentId: 'w-blueprints' },
  ],
  entities: [{ id: 'albus', name: 'Albus' }],
};

/** What the Class link overrides on Paladin: default-on, and its pins aimed at the Garb blueprint. */
const paladinOverrides = {
  isDefault: { value: true, blueprint: false },
  mode: { value: 'hidden' as const, blueprint: 'optional' as const },
  placeholderPins: { value: [{ placeholderId: 'garb', value: 'plate' }], blueprint: [] },
};
const classLink: TraitLink = {
  id: 'l-class', originalId: 'w-class', kind: 'group', originalName: 'Class', groupId: null, order: 0,
  overrides: { 'w-paladin': paladinOverrides },
};
const smiteLink: TraitLink = { id: 'l-smite', originalId: 'w-smite', kind: 'trait', originalName: 'Smite', groupId: null, order: 1 };
const paladinLink: TraitLink = { id: 'l-paladin', originalId: 'w-paladin', kind: 'trait', originalName: 'Paladin', groupId: null, order: 2 };

/** A persona linking Class (Paladin on), Smite, and Paladin again, with a vow gated on Albus's Smite. */
const mira: Entity = {
  id: 'mira', name: 'Mira', persona: true,
  traits: [{ ...trait('t-vow', 'Vow'), requires: [{ kind: 'trait', id: 'w-smite', bearer: { kind: 'entity', id: 'albus' } }] }],
  traitLinks: [classLink, smiteLink, paladinLink],
};

/** Another world: the same names under new ids in Blueprints, and its own Albus. */
const elsewhere: TraitWorld = {
  traits: [trait('n-paladin', 'Paladin', 'n-class'), trait('n-smite', 'Smite', 'n-blueprints')],
  traitGroups: [
    { id: 'n-blueprints', name: 'Blueprints', parentId: null, system: 'blueprints' },
    { id: 'n-class', name: 'Class', parentId: 'n-blueprints' },
  ],
  entities: [{ id: 'n-albus', name: 'Albus' }],
};

const fakeWebp = (): Uint8Array => {
  const out = new Uint8Array(24);
  const view = new DataView(out.buffer);
  const put4 = (s: string, at: number) => { for (let i = 0; i < 4; i++) out[at + i] = s.charCodeAt(i); };
  put4('RIFF', 0); view.setUint32(4, 16, true); put4('WEBP', 8); put4('VP8 ', 12); view.setUint32(16, 4, true);
  return out;
};

/** Each way an entity leaves a world, and comes back as a carried entity. */
const carriers: [string, (e: Entity) => Promise<Entity>][] = [
  ['the entity file', async (e) => parseEntityCardData(JSON.parse(JSON.stringify(buildEntityCardData(e, undefined, {}, undefined, home))))],
  ['the character card', async (e) => {
    const bytes = embedEntityCard(fakeWebp(), JSON.stringify(buildEntityCardData(e, undefined, {}, undefined, home)), { w: 4, h: 4 });
    const file = new File([bytes], 'mira.webp', { type: 'image/webp' });
    Object.defineProperty(file, 'arrayBuffer', { value: async () => bytes.buffer });
    return (await importCharacterFile(file)).entity;
  }],
  ['the library', async (e) => ({ ...await EntityStorageService.getEntityData((await saveCopyToLibrary(e, [], [], undefined, home)).id), id: 'copy' })],
];

afterEach(async () => {
  for (const record of await EntityStorageService.getEntityMetadata()) await EntityStorageService.deleteEntity(record.id);
});

describe.each(carriers)('links through %s', (_name, carry) => {
  it('bind by id at home, even after the original is renamed', async () => {
    const renamed = { ...home, traits: home.traits.map((t) => (t.id === 'w-smite' ? { ...t, name: 'Holy Smite' } : t)) };
    const adopted = adoptOwnedTraits(await carry(mira), renamed);
    expect(adopted.traitLinks).toEqual([classLink, smiteLink]);
  });

  it('rebind by unique name elsewhere, with each data key following its trait', async () => {
    const adopted = adoptOwnedTraits(await carry(mira), elsewhere);
    expect(adopted.traitLinks).toEqual([
      { ...classLink, originalId: 'n-class', overrides: { 'n-paladin': paladinOverrides } },
      { ...smiteLink, originalId: 'n-smite' },
    ]);
  });

  it('drop a link whose original the world lacks, and a duplicate', async () => {
    const noSmite = { ...elsewhere, traits: elsewhere.traits.filter((t) => t.name !== 'Smite') };
    expect(adoptOwnedTraits(await carry(mira), noSmite).traitLinks!.map((l) => l.id)).toEqual(['l-class']);
  });

  it('bind at enter-world for a library persona, and resolve as the player', async () => {
    const persona = { ...await carry(mira), id: 'lib-mira' };
    const library = inPlayLibrary(elsewhere, persona);
    const { bearers, playerBearerIds } = resolveBearers(elsewhere, { source: 'library', entityId: 'lib-mira' }, library);
    const bearer = bearers.find((b) => b.id === 'lib-mira')!;
    expect(playerBearerIds).toContain('lib-mira');
    expect(bearer.traits.map((t) => [t.id, !!t.isDefault])).toEqual([['t-vow', false], ['n-paladin', true], ['n-smite', false]]);
    expect(bearer.traits[1].placeholderPins).toEqual([{ placeholderId: 'garb', value: 'plate' }]);
    expect(bearer.traits.map((t) => t.mode)).toEqual([undefined, 'hidden', undefined]);
  });

  it('rebind a named-scope requirement by bearer name', async () => {
    const adopted = adoptOwnedTraits(await carry(mira), elsewhere);
    expect(adopted.traits![0].requires).toEqual([
      { kind: 'trait', id: 'n-smite', name: 'Smite', bearer: { kind: 'entity', id: 'n-albus', name: 'Albus' } },
    ]);
  });
});
