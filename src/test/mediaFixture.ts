import type { World } from '@/types';

/** A data URL whose decoded payload is about `bytes` long. */
export const fakeDataUrl = (mime: string, bytes: number, fill = 'A'): string =>
  `data:${mime};base64,${fill.repeat(Math.ceil((bytes * 4) / 3))}`;

/** A link with a non-ASCII character, so a size counts UTF-8 bytes rather than characters. */
export const LINKED_IMAGE = 'https://example.com/fen-é.png';

/**
 * A world with every media kind: a thumbnail, Background Music and two Avatars (one unused); a grouped and an
 * ungrouped entity with gallery images, a sound and a 3D Model; nested locations; and one dictionary cover.
 * Parents with no media sit beside them, so a section or card made from nothing shows up.
 */
export const mediaFixtureWorld = (): World => ({
  id: 'media-world',
  worldOverview: {
    name: 'Sedge Landing', description: '', author: '', systemPrompt: 'Narrate the fen.', readme: 'A fen primer.', tags: [],
    thumbnail: fakeDataUrl('image/webp', 2_000, 'T'),
    bgm: fakeDataUrl('audio/mpeg', 3_000, 'M'),
    vrmStore: {
      walker: { name: 'Fen Walker', file: { data: fakeDataUrl('model/gltf-binary', 4_000, 'V'), type: 'model/gltf-binary', name: 'walker.vrm' } },
      spare: { name: 'Spare', file: { data: fakeDataUrl('model/gltf-binary', 1_000, 'S'), type: 'model/gltf-binary', name: 'spare.vrm' } },
    },
  },
  stats: [],
  entityGroups: [
    { id: 'crew', name: 'Crew', parentId: null },
    { id: 'deckhands', name: 'Deckhands', parentId: 'crew' },
  ],
  entities: [
    {
      id: 'wick', name: 'Odd Wick', playerDescription: 'The lamp-keeper.', aiDescription: 'Keeps the lamps lit.', locations: ['harbor'],
      images: [
        { data: fakeDataUrl('image/webp', 1_500, 'a') },
        { data: fakeDataUrl('image/webp', 1_200, 'b'), requires: [{ all: [{ kind: 'playingAs', id: 'wick' }] }] },
        { data: LINKED_IMAGE },
      ],
      sound: { data: fakeDataUrl('audio/ogg', 2_500, 'o'), type: 'audio/ogg' },
      model: { data: fakeDataUrl('model/gltf-binary', 5_000, 'g'), type: 'model/gltf-binary' },
      vrmPick: { kind: 'world', id: 'walker' },
    },
    {
      id: 'bram', name: 'Bram', playerDescription: '', aiDescription: '', locations: [], groupId: 'deckhands',
      // Over the entity budget, under the background one.
      images: [{ data: fakeDataUrl('image/png', 700_000, 'p') }],
      vrmPick: { kind: 'world', id: 'walker' },
    },
    { id: 'empty', name: 'Hollow', playerDescription: '', aiDescription: '', locations: [], groupId: 'crew' },
  ],
  locations: [
    { id: 'harbor', name: 'Harbor Steps', isStarting: true, images: [{ data: fakeDataUrl('image/jpeg', 700_000, 'h') }] },
    {
      id: 'lamp', name: 'Lamp Room', parentId: 'harbor',
      images: [{ data: fakeDataUrl('image/jpeg', 900, 'l') }],
      ambientSound: { data: fakeDataUrl('audio/ogg', 1_800, 'w'), type: 'audio/ogg' },
    },
    { id: 'marsh', name: 'Marsh', images: [{ data: fakeDataUrl('image/jpeg', 800, 'm') }] },
    { id: 'bare', name: 'Bare Flat' },
  ],
  dictionaries: [
    { id: 'lore', name: 'Fen Lore', entries: [], thumbnail: fakeDataUrl('image/webp', 600, 'd') },
    { id: 'plain', name: 'Plain Book', entries: [] },
  ],
  placeholders: [], traits: [], statUpdates: [],
} as unknown as World);
