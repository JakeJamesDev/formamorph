import { describe, expect, it } from 'vitest';
import type { MediaList, StatRequirement } from '@/types';
import type { GateInput } from './traitGates';
import { sandboxMediaOf } from './sandboxMedia';

const list: MediaList = {
  'm-calm': { id: 'm-calm', name: 'Calm', kind: 'image', data: 'calm' },
  'm-hurt': { id: 'm-hurt', name: 'Hurt', kind: 'image', data: 'hurt' },
  'm-rain': { id: 'm-rain', name: 'Rain', kind: 'sound', data: 'rain' },
  'm-theme': { id: 'm-theme', name: 'Theme', kind: 'sound', data: 'theme' },
};

// Mira's Health below 20 shows the hurt picture first.
const gateAt = (health: number): GateInput => ({
  global: { traits: [], groups: [] }, owners: [], active: { global: [], owners: {} },
  stats: { global: {}, owners: { mira: { health: { name: 'Health', value: health, min: 0, max: 100 } } } },
  entities: [{ id: 'mira', name: 'Mira' }], persona: { source: 'none' },
});
const low: StatRequirement = { kind: 'stat', id: 'health', operator: '<', value: 20, unit: 'raw' };

const mediaAt = (health: number) => sandboxMediaOf({
  list, overrides: { music: 'm-rain' },
  entities: [
    { id: 'mira', images: [{ mediaId: 'm-hurt', requires: [{ all: [low] }] }, { mediaId: 'm-calm' }], sound: { mediaId: 'm-rain' } },
    { id: 'hero', images: [{ data: 'embedded' }] },
  ],
  personaId: 'mira',
  locations: [{ id: 'gate', images: [{ mediaId: 'm-calm' }], ambientSound: { mediaId: 'm-rain' } }, { id: 'hall' }],
  items: [{ id: 'lamp', images: [{ mediaId: 'm-calm' }] }],
  itemInstances: [
    { id: 'c-1', item: { kind: 'item', itemId: 'lamp' }, where: { kind: 'you' }, quantity: 1, visibility: 'visible' },
    { id: 'c-2', item: { kind: 'runtime', runtimeItemId: 'r' }, where: { kind: 'you' }, quantity: 1, visibility: 'visible' },
  ],
  music: { mediaId: 'm-theme' },
  gate: () => gateAt(health),
  generics: { guard: { north: { position: 'gate', lastRun: 0 }, south: { lastRun: 0 } } },
});

describe('sandboxMediaOf', () => {
  it('lists every entry by name and kind, and hands on the overrides in force', () => {
    const media = mediaAt(50);
    expect(media.entries).toEqual([
      { id: 'm-calm', name: 'Calm', kind: 'image' }, { id: 'm-hurt', name: 'Hurt', kind: 'image' },
      { id: 'm-rain', name: 'Rain', kind: 'sound' }, { id: 'm-theme', name: 'Theme', kind: 'sound' },
    ]);
    expect(media.overrides).toEqual({ music: 'm-rain' });
  });

  it('reads what each owner shows with no override: the rule-picked link, the linked sounds, and the played persona under the empty key', () => {
    expect(mediaAt(10).defaults()).toEqual({
      entities: { mira: { image: 'm-hurt', sound: 'm-rain' }, hero: {}, '': { image: 'm-hurt', sound: 'm-rain' } },
      locations: { gate: { image: 'm-calm', ambience: 'm-rain' }, hall: {} },
      items: { 'c-1': 'm-calm' },
      music: 'm-theme',
    });
    expect(mediaAt(50).defaults().entities?.mira).toEqual({ image: 'm-calm', sound: 'm-rain' });
  });

  it('lists each Generic entity’s copies in Start order, with where each stands', () => {
    expect(mediaAt(50).instances).toEqual({ guard: [{ id: 'north', locationId: 'gate' }, { id: 'south' }] });
  });
});
