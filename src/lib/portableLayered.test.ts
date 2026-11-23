import { describe, it, expect } from 'vitest';
import type { EmbeddedLayeredImage, Entity, LayeredMediaEntry, MediaEntry, MediaList, Trait, TraitRequirementRow } from '@/types';
import { loadMediaHashes, loadMediaLookup, placeEntityMedia } from './libraryMedia';
import { toLibraryItem } from './librarySources';
import { buildEntityCardData, parseEntityCardData } from './entityFile';
import { entityPublishPayload } from './publishPayload';
import { contentMatchesSource } from './linkedContent';
import { migrateGalleriesToMediaList, embeddedGalleryView, relinkEmbeddedGallery } from './mediaGallery';
import { embeddedImageFiles, primaryPicture } from './entityImages';
import { entityPicture } from './entityLook';
import { isLayeredPicture } from './layeredImages';
import { bindOwnedTraits, traitWorldOf } from './portableTraits';
import { flattenLayered, type Raster, type RasterIO } from './layeredFlatten';

const KNIGHT: TraitRequirementRow[] = [{ all: [{ kind: 'trait', id: 'knight' }] }];
const BODY = 'data:image/png;base64,Qk9EWQ==';
const SMILE = 'data:image/png;base64,U01JTEU=';
const FROWN = 'data:image/png;base64,RlJPV04=';
// FROWN's bytes under another MIME label: one file, two strings.
const FROWN_RAW = 'data:application/octet-stream;base64,RlJPV04=';

const image = (id: string, name: string, data: string): MediaEntry => ({ id, name, kind: 'image', data });
const rig: LayeredMediaEntry = {
  id: 'rig', name: 'Mira Rig', kind: 'layered', layers: [
    { id: 'l-body', name: 'Body', variants: [{ mediaId: 'm-body' }] },
    {
      id: 'l-face', name: 'Face', opacity: 0.5, tint: '#ff8000', blend: 'multiply', transition: { mode: 'jelly', squash: 0.3, durationMs: 400 } as never,
      variants: [{ mediaId: 'm-smile', requires: KNIGHT }, { mediaId: 'm-frown' }],
    },
  ],
};
const worldList = (): MediaList => ({
  'm-body': image('m-body', 'Body', BODY), 'm-smile': image('m-smile', 'Smile', SMILE), 'm-frown': image('m-frown', 'Frown', FROWN), rig,
});
const mira = (extra: Partial<Entity> = {}): Entity => ({ id: 'e1', name: 'Mira', images: [{ mediaId: 'rig', requires: KNIGHT }, { mediaId: 'm-body' }], ...extra });

const embeddedRig = (entity: Entity): EmbeddedLayeredImage => entity.images?.[0] as EmbeddedLayeredImage;
const layeredIn = (list: MediaList | undefined) => Object.values(list ?? {}).filter((e): e is LayeredMediaEntry => e.kind === 'layered');
const variantData = (entry: LayeredMediaEntry, list: MediaList) =>
  entry.layers.map((layer) => layer.variants.map((v) => (list[v.mediaId] as { data: string }).data));

describe('a Layered Image through the library', () => {
  it('embeds the rig with every Layer, Variant name and rule when saved to the library', () => {
    const item = toLibraryItem(mira(), [], [], undefined, worldList());
    expect(JSON.stringify(item)).not.toContain('mediaId');
    const slot = embeddedRig(item);
    expect(slot.requires).toEqual(KNIGHT);
    expect(slot.layered.name).toBe('Mira Rig');
    expect(slot.layered.layers.map((l) => l.name)).toEqual(['Body', 'Face']);
    const face = slot.layered.layers[1];
    expect(face).toMatchObject({ id: 'l-face', opacity: 0.5, tint: '#ff8000', blend: 'multiply', transition: { mode: 'jelly' } });
    expect(face.variants).toEqual([{ data: SMILE, name: 'Smile', requires: KNIGHT }, { data: FROWN, name: 'Frown' }]);
  });

  it('rebuilds the rig in another world, merging byte-identical images and reusing an equal rig', async () => {
    const item = toLibraryItem(mira(), [], [], undefined, worldList());
    // The receiving world already holds FROWN's bytes under another string and name.
    const target: MediaList = { 'w-frown': image('w-frown', 'Sad', FROWN_RAW) };
    const hashes = await loadMediaHashes([item], target);
    const first = placeEntityMedia(item, target, hashes);
    const [entry] = layeredIn(first.list);
    expect(entry.name).toBe('Mira Rig');
    expect(first.entity.images?.[0]).toEqual({ mediaId: entry.id, requires: KNIGHT });
    expect(entry.layers[1]).toMatchObject({ name: 'Face', opacity: 0.5, tint: '#ff8000', blend: 'multiply' });
    expect(entry.layers[1].variants[0].requires).toEqual(KNIGHT);
    expect(entry.layers[1].variants[1].mediaId).toBe('w-frown');
    expect(variantData(entry, first.list!)).toEqual([[BODY], [SMILE, FROWN_RAW]]);
    // The gallery's plain Body slot and the Body Variant share one entry.
    expect(first.entity.images?.[1]).toEqual({ mediaId: entry.layers[0].variants[0].mediaId });
    // Added a second time, nothing new joins.
    const again = placeEntityMedia(item, first.list, await loadMediaHashes([item], first.list));
    expect(Object.keys(again.list!)).toHaveLength(Object.keys(first.list!).length);
    expect(again.entity.images?.[0]).toEqual({ mediaId: entry.id, requires: KNIGHT });
  });

  it('reuses an equal rig the world renamed, keeping the world\'s name (Q37)', async () => {
    const item = toLibraryItem(mira(), [], [], undefined, worldList());
    const held = placeEntityMedia(item, {}, await loadMediaHashes([item], {}));
    const [entry] = layeredIn(held.list);
    const renamed = { ...held.list, [entry.id]: { ...entry, name: 'Mira Look' } };
    const again = placeEntityMedia(item, renamed, await loadMediaHashes([item], renamed));
    expect(layeredIn(again.list).map((e) => e.name)).toEqual(['Mira Look']);
    expect(again.entity.images?.[0]).toEqual({ mediaId: entry.id, requires: KNIGHT });
  });

  it('adds a rig whose Layer was renamed as a new entry, since scripts address Layers by name', async () => {
    const item = toLibraryItem(mira(), [], [], undefined, worldList());
    const held = placeEntityMedia(item, {}, await loadMediaHashes([item], {}));
    const [entry] = layeredIn(held.list);
    const renamed = { ...held.list, [entry.id]: { ...entry, layers: [{ ...entry.layers[0], name: 'Torso' }, entry.layers[1]] } };
    const again = placeEntityMedia(item, renamed, await loadMediaHashes([item], renamed));
    expect(layeredIn(again.list)).toHaveLength(2);
  });

  it('adds a changed rig as a new entry under a unique name', async () => {
    const item = toLibraryItem(mira(), [], [], undefined, worldList());
    const held = placeEntityMedia(item, {}, await loadMediaHashes([item], {}));
    const changed = embeddedRig(item);
    const other: Entity = { ...item, images: [{ ...changed, layered: { ...changed.layered, layers: changed.layered.layers.slice(0, 1) } }] };
    const placed = placeEntityMedia(other, held.list, await loadMediaHashes([other], held.list));
    expect(layeredIn(placed.list).map((e) => e.name).sort()).toEqual(['Mira Rig', 'Mira Rig (2)']);
  });

  it('reads a world copy and its library item with the same rig as unchanged, and a changed Variant as changed', async () => {
    const list = worldList();
    const copy = mira();
    const item = { ...toLibraryItem(copy, [], [], undefined, list), id: 'lib-1' };
    const media = await loadMediaLookup([copy, item], list);
    expect(contentMatchesSource(copy, item, undefined, undefined, undefined, media)).toBe(true);
    const slot = embeddedRig(item);
    const swapped: Entity = { ...item, images: [{ ...slot, layered: { ...slot.layered, layers: [slot.layered.layers[0], { ...slot.layered.layers[1], variants: [{ ...slot.layered.layers[1].variants[0], data: BODY }, slot.layered.layers[1].variants[1]] }] } }] };
    expect(contentMatchesSource(copy, swapped, undefined, undefined, undefined, await loadMediaLookup([copy, swapped], list))).toBe(false);
  });

  it('compares a rule-free rig by its Variant images', async () => {
    const plain: LayeredMediaEntry = { ...rig, layers: rig.layers.map((l) => ({ ...l, variants: l.variants.map(({ mediaId }) => ({ mediaId })) })) };
    const list = { ...worldList(), rig: plain };
    const copy: Entity = { id: 'e1', name: 'Mira', images: [{ mediaId: 'rig' }] };
    const item = { ...toLibraryItem(copy, [], [], undefined, list), id: 'lib-1' };
    expect(contentMatchesSource(copy, item, undefined, undefined, undefined, await loadMediaLookup([copy, item], list))).toBe(true);
    const swapped: Entity = JSON.parse(JSON.stringify(item).replace(SMILE, BODY));
    expect(contentMatchesSource(copy, swapped, undefined, undefined, undefined, await loadMediaLookup([copy, swapped], list))).toBe(false);
  });

  it('compares a world rig whose Layer fields were stored in another order as unchanged', async () => {
    const plain: LayeredMediaEntry = { ...rig, layers: rig.layers.map(({ variants, ...layer }) => ({
      variants: variants.map(({ mediaId }) => ({ mediaId })),
      ...Object.fromEntries(Object.entries(layer).reverse()),
    }) as LayeredMediaEntry['layers'][number]) };
    const copy: Entity = { id: 'e1', name: 'Mira', images: [{ mediaId: 'rig' }] };
    // The library item went through a card, which writes Layer fields in its own order.
    const card = parseEntityCardData(JSON.parse(JSON.stringify(buildEntityCardData(copy, [], {}, undefined, undefined, { ...worldList(), rig: plain }))), BODY);
    const item = { ...card, id: 'lib-1' };
    const list = { ...worldList(), rig: plain };
    expect(contentMatchesSource(copy, item, undefined, undefined, undefined, await loadMediaLookup([copy, item], list))).toBe(true);
  });

  it('lists every embedded image file, a rig\'s Variants included', () => {
    expect(embeddedImageFiles(toLibraryItem(mira(), [], [], undefined, worldList()))).toEqual([BODY, SMILE, FROWN, BODY]);
  });

  it('keeps the rig through a library edit of the gallery', () => {
    const item = toLibraryItem(mira(), [], [], undefined, worldList());
    const view = embeddedGalleryView(item.images ?? []);
    // The author drags the plain Body ahead of the rig and drops the rig's rule.
    const next = relinkEmbeddedGallery(item.images ?? [], [view[1], { ...view[0], requires: undefined }]);
    expect(next[1]).toEqual({ layered: embeddedRig(item).layered });
    expect(next[0]).toEqual({ data: BODY, name: 'Body' });
  });

  it('places an embedded rig into the list when a world file is migrated', () => {
    const item = toLibraryItem(mira(), [], [], undefined, worldList());
    const world: Record<string, unknown> = { entities: [item], worldOverview: {} };
    migrateGalleriesToMediaList(world);
    const list = (world.worldOverview as { mediaList: MediaList }).mediaList;
    const [entry] = layeredIn(list);
    expect((world.entities as Entity[])[0].images?.[0]).toEqual({ mediaId: entry.id, requires: KNIGHT });
    expect(variantData(entry, list)).toEqual([[BODY], [SMILE, FROWN]]);
  });

  it('names Variant rules on a card and binds them to the receiving world by name', () => {
    const traitWorld = (id: string) => traitWorldOf({ traits: [{ id, name: 'Knight' } as Trait], traitGroups: [], entities: [] })!;
    const card = buildEntityCardData(mira(), [], {}, undefined, traitWorld('knight'), worldList());
    expect(card.primaryLayered?.layers[1].variants[0].requires?.[0].all[0]).toMatchObject({ id: 'knight', name: 'Knight' });
    const bound = bindOwnedTraits(parseEntityCardData(JSON.parse(JSON.stringify(card)), BODY), traitWorld('knight-here'));
    expect(embeddedRig(bound).layered.layers[1].variants[0].requires?.[0].all[0]).toMatchObject({ id: 'knight-here' });
    // The slot's own rule binds the same way.
    expect(embeddedRig(bound).requires?.[0].all[0]).toMatchObject({ id: 'knight-here' });
  });
});

describe('a Layered Image through publish', () => {
  it("publishes the embedded rig and its flattened picture under the entity's starting values as the listing art", async () => {
    const item = toLibraryItem(mira(), [], [], undefined, worldList());
    const io = fakeIO();
    const payload = await entityPublishPayload(item, undefined, io);
    expect(embeddedRig(payload.contentData as Entity).layered.layers).toHaveLength(2);
    // Mira holds no Knight, so her Face shows Frown.
    const picture = entityPicture(item);
    expect(isLayeredPicture(picture) && picture.layers.map((l) => l.data)).toEqual([BODY, FROWN]);
    expect(payload.thumbnail).toBe(await flattenLayered(picture as never, io));
    expect(payload.thumbnail).toMatch(/;q=0\.92$/);
  });
});

describe('a Layered Image through a character card', () => {
  it('carries the full rig as `primaryLayered`, and import rebuilds it in place of the pixels', () => {
    const card = buildEntityCardData(mira(), [], {}, undefined, undefined, worldList());
    expect(card.primaryLayered?.layers.map((l) => l.name)).toEqual(['Body', 'Face']);
    expect(card.primaryImageRequires).toEqual(KNIGHT);
    expect(card.primaryImageName).toBeUndefined();
    const parsed = parseEntityCardData(JSON.parse(JSON.stringify(card)), 'data:image/webp;base64,UElYRUxT');
    const [slot, extra] = parsed.images ?? [];
    expect(slot).toEqual({ layered: card.primaryLayered, requires: KNIGHT });
    expect(JSON.stringify(parsed.images)).not.toContain('UElYRUxT');
    expect(extra).toEqual({ data: BODY, name: 'Body' });
  });

  it('carries a rig past the first slot in `extraImages`', () => {
    const entity = mira({ images: [{ mediaId: 'm-body' }, { mediaId: 'rig' }] });
    const card = buildEntityCardData(entity, [], {}, undefined, undefined, worldList());
    expect(card.primaryLayered).toBeUndefined();
    const parsed = parseEntityCardData(JSON.parse(JSON.stringify(card)), BODY);
    expect((parsed.images?.[1] as EmbeddedLayeredImage).layered.layers[1].variants.map((v) => v.name)).toEqual(['Smile', 'Frown']);
  });

  it('reads a malformed Layer field from a card as absent', () => {
    const card = JSON.parse(JSON.stringify(buildEntityCardData(mira(), [], {}, undefined, undefined, worldList())));
    card.primaryLayered.layers[1].blend = 'overlay';
    card.primaryLayered.layers[1].opacity = 'half';
    const slot = parseEntityCardData(card, BODY).images?.[0] as EmbeddedLayeredImage;
    expect(slot.layered.layers[1].blend).toBeUndefined();
    expect(slot.layered.layers[1].opacity).toBeUndefined();
  });
});

describe('the outside-play picture', () => {
  it('is the first-Variant stack for a library entity whose first slot is a rig, rules ignored', () => {
    const picture = primaryPicture(toLibraryItem(mira(), [], [], undefined, worldList()));
    expect(isLayeredPicture(picture) && picture.layers.map((l) => l.data)).toEqual([BODY, SMILE]);
  });

  it('is the first-Variant stack for a world entity whose first slot links a rig', () => {
    const picture = primaryPicture(mira(), worldList());
    expect(isLayeredPicture(picture) && picture.layers.map((l) => ({ data: l.data, tint: l.tint, blend: l.blend })))
      .toEqual([{ data: BODY, tint: undefined, blend: 'normal' }, { data: SMILE, tint: '#ff8000', blend: 'multiply' }]);
  });
});

/** A raster IO over 1×1 images whose pixel is the data URL's first payload bytes, written as a readable string. */
function fakeIO(): RasterIO {
  const pixel = (data: string): number[] => {
    const bytes = atob(data.slice(data.indexOf(',') + 1));
    return [0, 1, 2].map((i) => bytes.charCodeAt(i) || 0).concat(255);
  };
  return {
    size: async () => ({ width: 1, height: 1 }),
    read: async (data, width, height): Promise<Raster> => ({ width, height, data: new Uint8ClampedArray(pixel(data)) }),
    write: async (raster, quality) => `data:image/png;raster,${Array.from(raster.data).join('.')};q=${quality}`,
  };
}
