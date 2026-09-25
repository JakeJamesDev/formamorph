// @vitest-environment node
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { importCharacterFile, buildEntityCardData } from './entityFile';
import { readTavernJson } from './tavernCard';
import { isStPersonaBackupFile } from './stPersonaImport';
import { libraryLines, saveCopyToLibrary } from './librarySources';
import EntityStorageService from '@/services/EntityStorageService';
import WorldStorageService from '@/services/WorldStorageService';
import { addCopyToStoredWorld } from './addToStoredWorld';
import type { Entity } from '@/types';

const card = {
  spec: 'chara_card_v2', spec_version: '2.0', data: {
    name: 'Mara', description: '{{char}} knows {{user}}.', personality: 'Patient', scenario: 'At the dock',
    first_mes: '*{{ Char }} waves.*', alternate_greetings: ['Welcome back.'],
    creator: ' Rowan ', tags: [' Guide ', '', 'Guide', 3, 'River'],
    avatar: 'https://example.com/mara.png',
    character_book: { entries: [{ keys: ['dock'], content: 'A quiet landing.' }] },
  },
};
const file = (raw: unknown, name = 'card.json') => new File([JSON.stringify(raw)], name, { type: 'application/json' });

afterEach(async () => {
  for (const record of await EntityStorageService.getEntityMetadata()) await EntityStorageService.deleteEntity(record.id);
  for (const id of await WorldStorageService.getWorldIds()) await WorldStorageService.deleteWorld(id);
});

describe('SillyTavern JSON import', () => {
  it('imports a real file through the shared entry point and keeps library fields separate', async () => {
    const result = await importCharacterFile(file(card));
    expect(result.entity).toMatchObject({ name: 'Mara', images: ['https://example.com/mara.png'] });
    expect(result.entity.aiDescription).toBe('{{char}} knows {{user}}.\n\nPersonality: Patient\n\nScenario: At the dock');
    expect(result.entity.openings?.map(({ text, kind }) => ({ text, kind }))).toEqual([
      { text: '*{{char}} waves.*', kind: 'narration' }, { text: 'Welcome back.', kind: 'narration' },
    ]);
    expect(result.libraryDetails).toEqual({ author: 'Rowan', tags: ['Guide', 'River'] });
    expect(result.book?.entries[0].value).toBe('A quiet landing.');
    expect(result.entity).not.toHaveProperty('tags');
    expect(result.entity).not.toHaveProperty('author');
    expect(result.links).toEqual({});
  });

  it.each([
    { ...card, spec: 'chara_card_v3', spec_version: '3.0' },
    { name: 'Mara', description: 'A guide.' },
  ])('accepts supported versioned and flat cards', async (raw) => {
    expect((await importCharacterFile(file(raw, 'CARD.JSON'))).entity.name).toBe('Mara');
  });

  it.each([null, [], {}, { name: 'A world', entities: [] }, { formamorphKind: 'world', ...card },
    { ...card, spec: 'unknown' }, { ...card, data: [] }, { ...card, data: { name: ' ' } },
  ])('rejects non-card JSON: %j', async (raw) => {
    await expect(importCharacterFile(file(raw))).rejects.toThrow('SillyTavern character card');
  });

  it('rejects malformed JSON and recognizes an extension without a MIME type', async () => {
    expect(readTavernJson('{')).toBeNull();
    expect((await importCharacterFile(new File([JSON.stringify(card)], 'card.json'))).entity.name).toBe('Mara');
  });

  it.each([undefined, 'none', '', 'not a URL', 'file:///portrait.png', 'javascript:alert(1)', 'data:image/png;base64,AA'])(
    'imports without a portrait for an unusable avatar: %s', (avatar) => {
      const result = readTavernJson(JSON.stringify({ ...card, data: { ...card.data, avatar } }));
      expect(result?.entity.name).toBe('Mara');
      expect(result?.entity.images).toBeUndefined();
    });

  it('routes persona backups by their contents, not the JSON extension', async () => {
    expect(await isStPersonaBackupFile(file(card))).toBe(false);
    expect(await isStPersonaBackupFile(file({ personas: {}, persona_descriptions: {} }))).toBe(true);
    expect(await isStPersonaBackupFile(file({ personas: {} }))).toBe(true);
    expect(await isStPersonaBackupFile(new File(['{'], 'broken.json'))).toBe(false);
    expect(await isStPersonaBackupFile(new File(['pixels'], 'card.png'))).toBe(false);
  });

  it('carries library credit into shared cards without adding it to world entities', async () => {
    const { entity, libraryDetails } = await importCharacterFile(file(card));
    const source = await saveCopyToLibrary(entity, [], [], libraryDetails);
    const meta = (await EntityStorageService.getEntityMetadata())[0];
    expect(meta.tags).toEqual(['Guide', 'River']);
    expect(meta.author).toBe('Rowan');
    expect(libraryLines(meta).authorLine).toBe('Rowan');
    expect(meta.sourceAuthorId).toBeUndefined();
    expect(meta.sourceId).toBeUndefined();
    const worldEntity = await EntityStorageService.getEntityData(source.id);
    expect(worldEntity).not.toHaveProperty('tags');
    expect(worldEntity).not.toHaveProperty('libraryDetails');
    expect(buildEntityCardData(worldEntity)).not.toHaveProperty('tags');
    expect(buildEntityCardData(worldEntity, undefined, {}, libraryDetails).author).toBe('Rowan');
    await WorldStorageService.storeWorld({ id: 'audit-world', name: 'Landing', author: 'Ann', data: {
      worldOverview: { name: 'Landing' }, stats: [], traits: [], statUpdates: [], entities: [], locations: [],
    } });
    await addCopyToStoredWorld('audit-world', worldEntity, source, {
      placeholders: {}, locations: {}, newLocations: [], newPlaceholders: [],
    });
    const world = await WorldStorageService.getWorldData('audit-world') as { entities?: Entity[] };
    expect(world.entities).toEqual([expect.objectContaining({ name: 'Mara' })]);
    expect(JSON.stringify(world)).not.toContain('Rowan');
    expect(JSON.stringify(world)).not.toContain('River');
    expect(JSON.stringify(world)).not.toContain('libraryDetails');
    await EntityStorageService.storeEntity({ id: source.id, name: 'Edited', data: { ...worldEntity, name: 'Edited' } });
    expect((await EntityStorageService.getEntityMetadata())[0].libraryDetails).toEqual(libraryDetails);
    await EntityStorageService.storeEntity({ id: source.id, name: 'Edited', data: worldEntity, libraryDetails: { ...libraryDetails, tags: [] } });
    expect((await EntityStorageService.getEntityMetadata())[0].tags).toEqual([]);
  });
});
