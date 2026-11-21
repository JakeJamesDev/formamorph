import { describe, expect, it } from 'vitest';
import type { Entity, GameLocation, GenericStates, Item, LayeredMediaEntry, MediaList, StatRequirement } from '@/types';
import { resolveLayered } from './layeredImages';
import type { GateInput } from './traitGates';
import { mediaOverrideReader, soundWithOverride, withMediaWrites, type MediaEntryWrite, type MediaWrite } from './mediaOverrides';
import { visibleImages, visibleItemImage, visibleLocationImages } from './imageVisibility';
import { resolveSound } from './mediaSounds';

const list: MediaList = {
  'm-calm': { id: 'm-calm', name: 'Calm', kind: 'image', data: 'calm' },
  'm-hurt': { id: 'm-hurt', name: 'Hurt', kind: 'image', data: 'hurt' },
  'm-captain': { id: 'm-captain', name: 'Captain', kind: 'image', data: 'captain' },
  'm-rain': { id: 'm-rain', name: 'Rain', kind: 'sound', data: 'rain' },
  'm-theme': { id: 'm-theme', name: 'Theme', kind: 'sound', data: 'theme' },
};

// Mira's Health is the stat her rule reads: below 20 shows the hurt picture.
const input = (health: number): GateInput => ({
  global: { traits: [], groups: [] }, owners: [], active: { global: [], owners: {} },
  stats: { global: {}, owners: { 'e-mira': { health: { name: 'Health', value: health, min: 0, max: 100 } } } },
  entities: [{ id: 'e-mira', name: 'Mira' }], persona: { source: 'none' },
});
const low: StatRequirement = { kind: 'stat', id: 'health', operator: '<', value: 20, unit: 'raw' };
const mira: Pick<Entity, 'id' | 'images'> = { id: 'e-mira', images: [{ mediaId: 'm-hurt', requires: [{ all: [low] }] }, { mediaId: 'm-calm' }] };

const write = (owner: MediaEntryWrite['owner'], field: MediaEntryWrite['field'], mediaId: string | null): MediaWrite => ({ owner, field, mediaId });

describe('withMediaWrites', () => {
  it('lays writes on in order, the later winning, and null clears with no empty record left', () => {
    const set = withMediaWrites({}, [
      write({ kind: 'entity', id: 'e-mira' }, 'image', 'm-hurt'),
      write({ kind: 'entity', id: 'e-mira' }, 'image', 'm-calm'),
      write({ kind: 'item', id: 'c-1' }, 'image', 'm-calm'),
      write({ kind: 'world' }, 'music', 'm-theme'),
    ]);
    expect(set).toEqual({ entities: { 'e-mira': { image: 'm-calm' } }, items: { 'c-1': 'm-calm' }, music: 'm-theme' });
    const cleared = withMediaWrites(set, [
      write({ kind: 'entity', id: 'e-mira' }, 'image', null), write({ kind: 'item', id: 'c-1' }, 'image', null), write({ kind: 'world' }, 'music', null),
    ]);
    expect(cleared).toEqual({});
  });

  it('hands back the same object when there are no writes', () => {
    const overrides = { music: 'm-theme' };
    expect(withMediaWrites(overrides, [])).toBe(overrides);
    expect(withMediaWrites(overrides, undefined)).toBe(overrides);
  });
});

describe('a stale instance Variant in play (Q32)', () => {
  const layered: MediaList = {
    ...list,
    rig: {
      id: 'rig', name: 'Rig', kind: 'layered', layers: [
        { id: 'l-hat', name: 'Hat', variants: [{ mediaId: 'm-hurt', requires: [{ all: [low] }] }, { mediaId: 'm-calm' }] },
      ],
    },
  };
  const everyRuleHolds = { statesOf: (rows: unknown[]) => rows.map(() => ({ holds: true, conditions: [] })) };
  const scene = { genericStates: { 'e-guard': { 's-north': { position: 'l-gate', lastRun: 0 } } } as GenericStates, locationId: 'l-gate' };
  const overrides = {
    layers: {
      entities: { 'e-guard': { rig: { 'l-hat': { variant: 'm-calm' } } } },
      instances: { 'e-guard': { 's-north': { rig: { 'l-hat': { variant: 'm-gone' } } } } },
    },
  };

  it('draws the entity-wide Variant, not the Layer’s rules', () => {
    const { layers } = mediaOverrideReader(overrides, layered, scene).entityPicture('e-guard');
    const entry = layered.rig as LayeredMediaEntry;
    const picture = resolveLayered(entry, layered, everyRuleHolds, layers?.rig);
    expect(picture?.layers.map((layer) => layer.data)).toEqual(['calm']);
  });
});

describe('an override in play', () => {
  it('shows first over the Visibility rule, the rule-picked pictures after it, and null returns to the rules', () => {
    const set = withMediaWrites({}, [write({ kind: 'entity', id: 'e-mira' }, 'image', 'm-captain')]);
    const shown = (overrides: typeof set) => visibleImages(mira, input(10), list, mediaOverrideReader(overrides, list, {}).entityPicture('e-mira')).map((img) => img.data);
    expect(shown({})).toEqual(['hurt', 'calm']);
    expect(shown(set)).toEqual(['captain', 'hurt', 'calm']);
    expect(shown(withMediaWrites(set, [write({ kind: 'entity', id: 'e-mira' }, 'image', null)]))).toEqual(['hurt', 'calm']);
  });

  it('drops the rule-picked copy of the overriding picture', () => {
    const set = withMediaWrites({}, [write({ kind: 'entity', id: 'e-mira' }, 'image', 'm-calm')]);
    const shown = visibleImages(mira, input(10), list, mediaOverrideReader(set, list, {}).entityPicture('e-mira'));
    expect(shown.map((img) => img.data)).toEqual(['calm', 'hurt']);
  });

  it('reads an override naming a deleted entry as unset, so the rules show again', () => {
    const set = withMediaWrites({}, [write({ kind: 'entity', id: 'e-mira' }, 'image', 'm-captain')]);
    const { 'm-captain': _deleted, ...afterDelete } = list;
    const reader = mediaOverrideReader(set, afterDelete, {});
    expect(reader.entity('e-mira', 'image')).toBeUndefined();
    expect(visibleImages(mira, input(10), afterDelete, reader.entityPicture('e-mira')).map((img) => img.data)).toEqual(['hurt', 'calm']);
  });

  it('keeps the played persona’s override under the empty key, whoever the player plays', () => {
    const set = withMediaWrites({}, [write({ kind: 'entity', id: '' }, 'image', 'm-captain')]);
    expect(mediaOverrideReader(set, list, { personaId: 'e-mira' }).entity('e-mira', 'image')).toBe('m-captain');
    expect(mediaOverrideReader(set, list, { personaId: 'e-hero' }).entity('e-mira', 'image')).toBeUndefined();
  });

  it('gives each Generic Entity Instance its own override, the panel showing the one where the player stands', () => {
    const states: GenericStates = { 'e-guard': { 's-north': { position: 'l-gate', lastRun: 0 }, 's-south': { position: 'l-hall', lastRun: 0 } } };
    const set = withMediaWrites({}, [
      write({ kind: 'entity', id: 'e-guard' }, 'image', 'm-calm'),
      write({ kind: 'instance', entityId: 'e-guard', startId: 's-north' }, 'image', 'm-captain'),
    ]);
    const at = (locationId: string) => mediaOverrideReader(set, list, { genericStates: states, locationId }).entity('e-guard', 'image');
    expect(at('l-gate')).toBe('m-captain');
    expect(at('l-hall')).toBe('m-calm');
  });

  it('switches a location’s image and ambience, an Item Instance’s image, an entity’s sound and the music by name', () => {
    const set = withMediaWrites({}, [
      write({ kind: 'location', id: 'l-gate' }, 'image', 'm-hurt'),
      write({ kind: 'location', id: 'l-gate' }, 'ambience', 'm-rain'),
      write({ kind: 'item', id: 'c-2' }, 'image', 'm-captain'),
      write({ kind: 'entity', id: 'e-mira' }, 'sound', 'm-theme'),
      write({ kind: 'world' }, 'music', 'm-rain'),
    ]);
    const reader = mediaOverrideReader(set, list, {});
    const gate: Pick<GameLocation, 'images'> = { images: [{ mediaId: 'm-calm' }] };
    expect(visibleLocationImages(gate, input(50), list, reader.locationPicture('l-gate'))[0]?.data).toBe('hurt');
    expect(resolveSound(soundWithOverride(undefined, reader.location('l-gate', 'ambience')), list)?.data).toBe('rain');
    const lamp: Pick<Item, 'images'> = { images: [{ mediaId: 'm-calm' }] };
    expect(visibleItemImage(lamp, { where: { kind: 'you' } }, input(50), list, reader.itemPicture('c-2'))).toBe('captain');
    expect(visibleItemImage(lamp, { where: { kind: 'you' } }, input(50), list, reader.itemPicture('c-1'))).toBe('calm');
    expect(resolveSound(soundWithOverride({ mediaId: 'm-rain' }, reader.entity('e-mira', 'sound')), list)?.data).toBe('theme');
    expect(resolveSound(soundWithOverride({ mediaId: 'm-theme' }, reader.music()), list)?.data).toBe('rain');
  });

  it('ignores an override naming an entry of the wrong kind', () => {
    const reader = mediaOverrideReader({ entities: { 'e-mira': { image: 'm-rain' } }, music: 'm-calm' }, list, {});
    expect(reader.entity('e-mira', 'image')).toBeUndefined();
    expect(reader.music()).toBeUndefined();
  });
});
