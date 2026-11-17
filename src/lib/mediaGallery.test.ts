import { describe, it, expect } from 'vitest';
import type { GalleryLink, MediaList, TraitRequirementRow, World } from '@/types';
import { migrateWorld } from './version';
import { relinkGallery, galleryView } from './mediaGallery';
import { entityImages } from './entityImages';
import { locationImages } from './locationImages';

const WOUNDED: TraitRequirementRow[] = [{ all: [{ kind: 'trait', id: 'wounded' }] }];
// "ABC" under two MIME labels: one file's bytes, two strings.
const ABC_PNG = 'data:image/png;base64,QUJD';
const ABC_RAW = 'data:application/octet-stream;base64,QUJD';
const XYZ_PNG = 'data:image/png;base64,WFla';
const URL = 'https://host/wren.png';

const world = (): World => migrateWorld({
  worldOverview: { name: 'W' },
  entities: [
    { id: 'wren', name: 'Wren', images: [{ data: ABC_PNG }, { data: XYZ_PNG, requires: WOUNDED }] },
    { id: 'kit', name: 'Kit', images: [{ data: ABC_RAW, name: 'Kit portrait' }, URL] },
  ],
  locations: [{ id: 'yard', name: 'Yard', backgroundImage: XYZ_PNG }],
});

const listOf = (w: World): MediaList => w.worldOverview.mediaList ?? {};
const names = (w: World) => Object.values(listOf(w)).map((e) => e.name).sort();

describe('migrateGalleriesToMediaList', () => {
  it('moves entity and location galleries into the list as links', () => {
    const w = world();
    for (const holder of [...w.entities, ...w.locations]) {
      expect((holder.images ?? []).every((link: GalleryLink) => 'mediaId' in link)).toBe(true);
    }
    expect(Object.values(listOf(w))).toHaveLength(3);
  });

  it('merges byte-identical files into one entry, whatever their MIME label (Q14)', () => {
    const w = world();
    const [wren, kit] = w.entities;
    expect((kit.images![0] as { mediaId: string }).mediaId).toBe((wren.images![0] as { mediaId: string }).mediaId);
    // The location's background is Wren's second picture.
    expect((w.locations[0].images![0] as { mediaId: string }).mediaId).toBe((wren.images![1] as { mediaId: string }).mediaId);
  });

  it('names entries by the first subject, a carried name never applying to a merged entry', () => {
    expect(names(world())).toEqual(['Kit 1', 'Wren 1', 'Wren 2']);
  });

  it('takes a carried name as the entry name (Q31)', () => {
    const w = migrateWorld({ worldOverview: { name: 'W' }, entities: [{ id: 'kit', name: 'Kit', images: [{ data: ABC_PNG, name: 'Kit portrait' }] }] });
    expect(names(w)).toEqual(['Kit portrait']);
  });

  it('keeps each link its own Visibility rule (Q11)', () => {
    const w = world();
    expect(entityImages(w.entities[0], listOf(w)).map((img) => img.requires)).toEqual([undefined, WOUNDED]);
    expect(locationImages(w.locations[0], listOf(w))[0].requires).toBeUndefined();
  });

  it('reads the same pictures through the resolver as before', () => {
    const w = world();
    expect(entityImages(w.entities[1], listOf(w)).map((img) => img.data)).toEqual([ABC_PNG, URL]);
    expect(locationImages(w.locations[0], listOf(w)).map((img) => img.data)).toEqual([XYZ_PNG]);
  });

  it('keeps a linked image a linked entry, merged by URL', () => {
    const entry = Object.values(listOf(world())).find((e) => e.data === URL);
    expect(entry).toMatchObject({ kind: 'image', name: 'Kit 1' });
    expect(entry?.type).toBeUndefined();
  });

  it('is idempotent and deterministic', () => {
    const once = world();
    expect(migrateWorld(once)).toEqual(once);
    // The default book's id is random, so the media parts carry the determinism check.
    const again = world();
    expect([again.entities, again.locations, listOf(again)]).toEqual([once.entities, once.locations, listOf(once)]);
  });

  it('gives a world with galleries but no overview a list its links resolve through (Q26)', () => {
    const w = migrateWorld({ entities: [{ id: 'wren', name: 'Wren', images: [{ data: ABC_PNG }] }] });
    expect(entityImages(w.entities[0], w.worldOverview.mediaList).map((img) => img.data)).toEqual([ABC_PNG]);
  });

  it('gives a world with no galleries an empty list (Q26)', () => {
    expect(migrateWorld({ worldOverview: { name: 'W' }, entities: [] }).worldOverview.mediaList).toEqual({});
  });
});

describe('relinkGallery', () => {
  const start = () => {
    const w = world();
    return { links: w.entities[0].images!, list: listOf(w) };
  };

  it('keeps a link through a rule change and a reorder', () => {
    const { links, list } = start();
    const { images } = galleryView(links, list);
    const next = relinkGallery(links, list, [{ ...images[1], requires: undefined }, { ...images[0], requires: WOUNDED }], 'Wren');
    expect(next.list).toBe(list);
    expect(next.links).toEqual([{ mediaId: (links[1] as { mediaId: string }).mediaId }, { mediaId: (links[0] as { mediaId: string }).mediaId, requires: WOUNDED }]);
  });

  it('places an upload as a named entry and links it', () => {
    const { links, list } = start();
    const { images } = galleryView(links, list);
    const upload = 'data:image/png;base64,TkVX';
    const next = relinkGallery(links, list, [...images, { data: upload, name: 'armor' }], 'Wren');
    const added = next.list[(next.links[2] as { mediaId: string }).mediaId];
    expect(added).toMatchObject({ name: 'armor', data: upload });
    expect(Object.keys(next.list)).toHaveLength(Object.keys(list).length + 1);
  });

  it('names a nameless upload after the subject', () => {
    const { links, list } = start();
    const next = relinkGallery(links, list, [...galleryView(links, list).images, { data: 'data:image/png;base64,TkVX' }], 'Wren');
    expect(next.list[(next.links[2] as { mediaId: string }).mediaId].name).toBe('Wren 3');
  });

  it('reuses the entry holding an uploaded file', () => {
    const { links, list } = start();
    const next = relinkGallery(links, list, [...galleryView(links, list).images, { data: ABC_RAW }], 'Wren');
    expect(next.list).toBe(list);
    expect(next.links[2]).toEqual({ mediaId: (links[0] as { mediaId: string }).mediaId });
  });

  it('unlinks a removed picture and leaves its entry', () => {
    const { links, list } = start();
    const next = relinkGallery(links, list, galleryView(links, list).images.slice(1), 'Wren');
    expect(next.links).toHaveLength(1);
    expect(next.list).toBe(list);
  });
});
