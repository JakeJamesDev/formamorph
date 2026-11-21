import { describe, it, expect } from 'vitest';
import { OVERRIDE_SLOT, visibleImages, visibleItemImage, visibleLocationImages } from './imageVisibility';
import { mediaOverrideReader, withMediaWrites, type LayerWrite, type MediaOwner } from './mediaOverrides';
import type { GateInput, GateStat, GateStatSet } from './traitGates';
import { scoped } from './scope';
import type { GenericStates, LayeredMediaEntry, MediaLayer, MediaList, MediaOverrides, StatRequirement, TraitRequirementRow } from '@/types';
import type { LayeredPicture, Picture } from './layeredImages';

const health = (value: number): GateStat => ({ name: 'Health', value, min: 0, max: 100 });
const below = (value: number): TraitRequirementRow[] =>
  [{ all: [{ kind: 'stat', id: 'health', operator: '<', value, unit: 'raw' } satisfies StatRequirement] }];

// Ash is hurt (Health 10), so the Face rule shows Hurt.
const input: GateInput = {
  global: { traits: [], groups: [] }, owners: [], active: scoped([]),
  stats: scoped<GateStatSet>({}, { ash: { health: health(10) }, guard: { health: health(10) } }),
  entities: [{ id: 'ash', name: 'Ash' }, { id: 'guard', name: 'Guard' }], persona: { source: 'none' },
};

const image = (id: string) => ({ id, name: id, kind: 'image' as const, data: `data:${id}` });
const layer = (id: string, variants: MediaLayer['variants'], extra: Partial<MediaLayer> = {}): MediaLayer => ({ id, name: id, variants, ...extra });

const RIG: LayeredMediaEntry = {
  id: 'rig', name: 'Rig', kind: 'layered', layers: [
    layer('body', [{ mediaId: 'body' }]),
    layer('face', [{ mediaId: 'hurt', requires: below(50) }, { mediaId: 'calm' }], { opacity: 0.9 }),
  ],
};
const WOLF: LayeredMediaEntry = { id: 'wolf', name: 'Wolf', kind: 'layered', layers: [layer('fur', [{ mediaId: 'fur' }])] };
const media: MediaList = { ...Object.fromEntries(['body', 'hurt', 'calm', 'fur', 'plain'].map((id) => [id, image(id)])), rig: RIG, wolf: WOLF };

const set = (owner: Exclude<MediaOwner, { kind: 'world' }>, layerId: string, field: LayerWrite['field'], value: LayerWrite['value'], entryId = 'rig'): LayerWrite =>
  ({ owner, entryId, layerId, field, value });

/** Each Layer of the first picture, by Layer id: what it draws and at what opacity. */
const layersOf = (picture: Picture | undefined) => {
  const stack = picture as LayeredPicture | undefined;
  return stack && Object.fromEntries(stack.layers.map((l) => [l.id, [l.data ?? null, l.opacity]]));
};

const ash = { id: 'ash', images: [{ mediaId: 'rig' }] };
const ashShows = (overrides: MediaOverrides) =>
  layersOf(visibleImages(ash, input, media, mediaOverrideReader(overrides, media, {}).entityPicture('ash'))[0]?.data);

describe('script Layer settings in play', () => {
  it('beat the Variant rules and the authored opacity until cleared', () => {
    const scripted = withMediaWrites({}, [set({ kind: 'entity', id: 'ash' }, 'face', 'variant', 'calm'), set({ kind: 'entity', id: 'ash' }, 'face', 'opacity', 0.25)]);
    expect(ashShows({})).toEqual({ body: ['data:body', 1], face: ['data:hurt', 0.9] });
    expect(ashShows(scripted)).toEqual({ body: ['data:body', 1], face: ['data:calm', 0.25] });
    const cleared = withMediaWrites(scripted, [set({ kind: 'entity', id: 'ash' }, 'face', 'variant', null), set({ kind: 'entity', id: 'ash' }, 'face', 'opacity', null)]);
    expect(cleared).toEqual({});
    expect(ashShows(cleared)).toEqual({ body: ['data:body', 1], face: ['data:hurt', 0.9] });
  });

  it('draw a set tint over the authored one until cleared', () => {
    const tinted: MediaList = { ...media, rig: { ...RIG, layers: [{ ...RIG.layers[0], tint: '#336699' }, RIG.layers[1]] } };
    const tintOf = (overrides: MediaOverrides) => (visibleImages(ash, input, tinted, mediaOverrideReader(overrides, tinted, {}).entityPicture('ash'))[0]?.data as LayeredPicture)
      .layers.map((l) => l.tint ?? null);
    expect(tintOf({})).toEqual(['#336699', null]);
    const scripted = withMediaWrites({}, [set({ kind: 'entity', id: 'ash' }, 'body', 'tint', '#ff8800'), set({ kind: 'entity', id: 'ash' }, 'face', 'tint', '#00ff00')]);
    expect(tintOf(scripted)).toEqual(['#ff8800', '#00ff00']);
    expect(tintOf(withMediaWrites(scripted, [set({ kind: 'entity', id: 'ash' }, 'body', 'tint', null)]))).toEqual(['#336699', '#00ff00']);
  });

  it('fall back to the rules when the set Variant is no longer one of the Layer’s', () => {
    expect(ashShows(withMediaWrites({}, [set({ kind: 'entity', id: 'ash' }, 'face', 'variant', 'plain')]))?.face).toEqual(['data:hurt', 0.9]);
  });

  it('keep each Generic Entity Instance apart, an instance’s setting beating the entity-wide one field by field', () => {
    const states: GenericStates = { guard: { north: { position: 'gate', lastRun: 0 }, south: { position: 'hall', lastRun: 0 } } };
    const scripted = withMediaWrites({}, [
      set({ kind: 'entity', id: 'guard' }, 'face', 'opacity', 0.5),
      set({ kind: 'entity', id: 'guard' }, 'face', 'variant', 'calm'),
      set({ kind: 'instance', entityId: 'guard', startId: 'north' }, 'face', 'variant', 'hurt'),
    ]);
    const guard = { id: 'guard', images: [{ mediaId: 'rig' }] };
    const at = (locationId: string) => layersOf(visibleImages(guard, input, media,
      mediaOverrideReader(scripted, media, { genericStates: states, locationId }).entityPicture('guard'))[0]?.data)?.face;
    expect(at('gate')).toEqual(['data:hurt', 0.5]);
    expect(at('hall')).toEqual(['data:calm', 0.5]);
  });

  it('keep each Item Instance apart', () => {
    const scripted = withMediaWrites({}, [set({ kind: 'item', id: 'c-1' }, 'face', 'variant', 'calm')]);
    const reader = mediaOverrideReader(scripted, media, {});
    const cloak = { images: [{ mediaId: 'rig' }] };
    const held = { where: { kind: 'entity' as const, id: 'ash' } };
    expect(layersOf(visibleItemImage(cloak, held, input, media, reader.itemPicture('c-1')))?.face).toEqual(['data:calm', 0.9]);
    expect(layersOf(visibleItemImage(cloak, held, input, media, reader.itemPicture('c-2')))?.face).toEqual(['data:hurt', 0.9]);
  });

  it('apply to a location’s rig', () => {
    const scripted = withMediaWrites({}, [set({ kind: 'location', id: 'gate' }, 'body', 'opacity', 0)]);
    const shown = visibleLocationImages({ images: [{ mediaId: 'rig' }] }, input, media, mediaOverrideReader(scripted, media, {}).locationPicture('gate'));
    expect(layersOf(shown[0]?.data)?.body).toEqual(['data:body', 0]);
  });

  it('show a Layered Image the whole-image setter names first, with its settings, dropping the rule-visible copy', () => {
    const scripted = withMediaWrites({}, [
      { owner: { kind: 'entity', id: 'ash' }, field: 'image', mediaId: 'wolf' },
      set({ kind: 'entity', id: 'ash' }, 'fur', 'opacity', 0.5, 'wolf'),
    ]);
    const shown = visibleImages(ash, input, media, mediaOverrideReader(scripted, media, {}).entityPicture('ash'));
    expect(shown.map((one) => one.slot)).toEqual([OVERRIDE_SLOT, 0]);
    expect(layersOf(shown[0].data)).toEqual({ fur: ['data:fur', 0.5] });
    const sameRig = withMediaWrites({}, [{ owner: { kind: 'entity', id: 'ash' }, field: 'image', mediaId: 'rig' }]);
    expect(visibleImages(ash, input, media, mediaOverrideReader(sameRig, media, {}).entityPicture('ash')).map((one) => one.slot)).toEqual([OVERRIDE_SLOT]);
  });
});
