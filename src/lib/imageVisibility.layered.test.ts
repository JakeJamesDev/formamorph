import { describe, it, expect } from 'vitest';
import { visibleImages } from './imageVisibility';
import type { GateInput, GateStat, GateStatSet } from './traitGates';
import { scoped } from './scope';
import type { GalleryLink, LayeredMediaEntry, MediaLayer, MediaList, StatRequirement, TraitRequirementRow } from '@/types';
import { layeredSizeMismatches, outsidePlayLayered, type LayeredPicture } from './layeredImages';

const health = (value: number): GateStat => ({ name: 'Health', value, min: 0, max: 100 });
const below = (value: number): TraitRequirementRow[] =>
  [{ all: [{ kind: 'stat', id: 'health', operator: '<', value, unit: 'raw' } satisfies StatRequirement] }];

/** Ash and Bram, each with their own Health. */
const input = (ash: number, bram = 90): GateInput => ({
  global: { traits: [], groups: [] },
  owners: [],
  active: scoped([]),
  stats: scoped<GateStatSet>({}, { ash: { health: health(ash) }, bram: { health: health(bram) } }),
  entities: [{ id: 'ash', name: 'Ash' }, { id: 'bram', name: 'Bram' }],
  persona: { source: 'none' },
});

const image = (id: string) => ({ id, name: id, kind: 'image' as const, data: `data:${id}` });
const layer = (id: string, variants: MediaLayer['variants'], extra: Partial<MediaLayer> = {}): MediaLayer => ({ id, name: id, variants, ...extra });

/** Body, a Face that shows hurt below 50 Health else calm, and a Bandage that shows below 20. */
const RIG: LayeredMediaEntry = {
  id: 'rig', name: 'Rig', kind: 'layered', layers: [
    layer('body', [{ mediaId: 'body' }]),
    layer('face', [{ mediaId: 'hurt', requires: below(50) }, { mediaId: 'calm' }]),
    layer('bandage', [{ mediaId: 'bandage', requires: below(20) }], { opacity: 0.5 }),
  ],
};
const media = (rig: LayeredMediaEntry = RIG): MediaList => ({
  ...Object.fromEntries(['body', 'hurt', 'calm', 'bandage', 'plain'].map((id) => [id, image(id)])),
  [rig.id]: rig,
});

const entity = (id: string, images: GalleryLink[]) => ({ id, images });
const pictureOf = (id: string, i: GateInput, list = media(), images: GalleryLink[] = [{ mediaId: 'rig' }]) =>
  visibleImages(entity(id, images), i, list)[0]?.data as LayeredPicture | undefined;
/** What each Layer shows, by Layer id: its image's data, or null when empty. */
const shows = (picture: LayeredPicture | undefined) =>
  picture && Object.fromEntries(picture.layers.map((l) => [l.id, l.data ?? null]));

describe('visibleImages with a Layered Image', () => {
  it('shows each Layer’s first visible Variant, and the next one once the first stops holding', () => {
    expect(shows(pictureOf('ash', input(40)))).toEqual({ body: 'data:body', face: 'data:hurt', bandage: null });
    expect(shows(pictureOf('ash', input(80)))).toEqual({ body: 'data:body', face: 'data:calm', bandage: null });
  });

  it('leaves a Layer empty when none of its Variants holds, and fills it when one does', () => {
    expect(pictureOf('ash', input(80))?.layers[2]).toEqual({ id: 'bandage', opacity: 0.5, blend: 'normal' });
    expect(pictureOf('ash', input(10))?.layers[2]).toEqual({ id: 'bandage', opacity: 0.5, blend: 'normal', data: 'data:bandage' });
  });

  it('reads the showing entity for a Variant rule with no owner, so two entities sharing a rig differ', () => {
    const i = input(10, 90);
    expect(shows(pictureOf('ash', i))?.face).toBe('data:hurt');
    expect(shows(pictureOf('bram', i))?.face).toBe('data:calm');
  });

  it('keeps the slot of an all-hidden rig, sized by the bottom Layer’s first Variant', () => {
    const hidden: LayeredMediaEntry = {
      ...RIG, layers: [layer('body', [{ mediaId: 'body', requires: below(0) }]), layer('face', [{ mediaId: 'hurt', requires: below(0) }])],
    };
    const picture = pictureOf('ash', input(50), media(hidden));
    expect(picture).toEqual({ kind: 'layered', entryId: 'rig', canvas: 'data:body', layers: [{ id: 'body', opacity: 1, blend: 'normal' }, { id: 'face', opacity: 1, blend: 'normal' }] });
  });

  it('lets the gallery link’s own rule decide whether the rig shows at all', () => {
    const gated: GalleryLink[] = [{ mediaId: 'rig', requires: below(50) }, { mediaId: 'plain' }];
    expect(visibleImages(entity('ash', gated), input(40), media()).map((v) => v.slot)).toEqual([0, 1]);
    expect(visibleImages(entity('ash', gated), input(80), media())).toEqual([{ slot: 1, data: 'data:plain' }]);
  });

  it('passes over a Variant whose image is gone', () => {
    const missing: LayeredMediaEntry = { ...RIG, layers: [layer('body', [{ mediaId: 'body' }]), layer('face', [{ mediaId: 'gone' }, { mediaId: 'calm' }])] };
    expect(shows(pictureOf('ash', input(50), media(missing)))).toEqual({ body: 'data:body', face: 'data:calm' });
  });

  it('drops a rig whose bottom Layer’s first Variant has no image to size it, even with another after it', () => {
    const unsized: LayeredMediaEntry = { ...RIG, layers: [layer('body', [{ mediaId: 'gone' }, { mediaId: 'body' }])] };
    expect(visibleImages(entity('ash', [{ mediaId: 'rig' }, { mediaId: 'plain' }]), input(50), media(unsized))).toEqual([{ slot: 0, data: 'data:plain' }]);
  });

  it('clamps a stored opacity to 0–1', () => {
    const loud: LayeredMediaEntry = { ...RIG, layers: [layer('body', [{ mediaId: 'body' }], { opacity: 3 }), layer('face', [{ mediaId: 'calm' }], { opacity: -1 })] };
    expect(pictureOf('ash', input(50), media(loud))?.layers.map((l) => l.opacity)).toEqual([1, 0]);
  });

  it('keeps a script override first, ahead of the rig', () => {
    expect(visibleImages(entity('ash', [{ mediaId: 'rig' }]), input(50), media(), 'plain').map((v) => v.slot)).toEqual([-1, 0]);
  });
});

describe('a Layered Image whose bottom Layer is empty', () => {
  it('takes its canvas from the lowest Layer that has a Variant (Q27)', () => {
    const emptied: LayeredMediaEntry = { ...RIG, layers: [layer('body', []), ...RIG.layers.slice(1)] };
    const picture = pictureOf('ash', input(80), media(emptied));
    expect(picture?.canvas).toBe('data:hurt');
    expect(shows(picture)).toEqual({ body: null, face: 'data:calm', bandage: null });
  });
});

describe('outsidePlayLayered', () => {
  it('shows each Layer’s first Variant with its rule ignored (Q5)', () => {
    expect(shows(outsidePlayLayered(RIG, media()))).toEqual({ body: 'data:body', face: 'data:hurt', bandage: 'data:bandage' });
  });

  it('keeps the authored opacity', () => {
    expect(outsidePlayLayered(RIG, media())?.layers[2].opacity).toBe(0.5);
  });
});

describe('layeredSizeMismatches', () => {
  const sizes: Record<string, { width: number; height: number }> = {
    body: { width: 240, height: 288 }, hurt: { width: 240, height: 288 }, calm: { width: 480, height: 576 }, bandage: { width: 300, height: 288 },
  };
  const sizeOf = (id: string) => sizes[id];

  it('flags each Variant whose size differs from the canvas, same aspect included', () => {
    expect(layeredSizeMismatches(RIG, media(), sizeOf).map((m) => [m.layerId, m.mediaId])).toEqual([['face', 'calm'], ['bandage', 'bandage']]);
    expect(layeredSizeMismatches(RIG, media(), sizeOf)[0]).toMatchObject({ size: { width: 480, height: 576 }, canvas: { width: 240, height: 288 } });
  });

  it('flags nothing while the canvas size is unknown, and passes over a Variant whose size is unknown', () => {
    expect(layeredSizeMismatches(RIG, media(), (id) => (id === 'body' ? undefined : sizes[id]))).toEqual([]);
    expect(layeredSizeMismatches(RIG, media(), (id) => (id === 'calm' ? undefined : sizes[id])).map((m) => m.mediaId)).toEqual(['bandage']);
  });
});
