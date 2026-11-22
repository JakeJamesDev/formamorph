import { describe, it, expect } from 'vitest';
import type { Body, Entity, GameLocation, Item, WorldOverview } from '@/types';
import { mediaUsage, unsharedParts } from './mediaUsage';
import type { MediaWorld } from './mediaIndex';

const ref = (mediaId: string) => ({ mediaId });

describe('mediaUsage', () => {
  it('lists every field that links an entry', () => {
    // Single fields hold a link before their declared types widen.
    const world = {
      worldOverview: {
        thumbnail: ref('cover'), bgm: ref('song'),
        mapBackground: { images: [{ data: 'data:x' }, ref('shared')], frame: { x: 0, y: 0, width: 1, height: 1 }, opacity: 1 },
      } as unknown as WorldOverview,
      entities: [
        { id: 'e1', name: 'Wren', images: [ref('shared'), { data: 'data:y' }, ref('wren')], sound: ref('song') },
        { id: 'e2', name: 'Moss', images: [{ data: 'data:z' }] },
      ] as unknown as Entity[],
      locations: [{ id: 'l1', name: 'Marsh', images: ['', ref('shared')], ambientSound: ref('rain') }] as unknown as GameLocation[],
      items: [{ id: 'i1', name: 'Lamp', images: [ref('lamp')] }] as Item[],
      bodies: [{ id: 'b1', name: 'Horse', backdrop: { kind: 'image', image: ref('shared') } }] as unknown as Body[],
      dictionaries: [],
    } satisfies MediaWorld;

    const usage = mediaUsage(world);
    const where = (id: string) => usage.get(id)?.map((u) => `${u.owner.kind}:${u.owner.id} ${u.field}${u.index === undefined ? '' : ` ${u.index}`}`);

    expect(where('shared')).toEqual(['map:map images 1', 'entity:e1 images 0', 'location:l1 images 1', 'body:b1 backdrop']);
    expect(where('song')).toEqual(['world:world bgm', 'entity:e1 sound']);
    expect(where('cover')).toEqual(['world:world thumbnail']);
    expect(where('wren')).toEqual(['entity:e1 images 2']);
    expect(where('rain')).toEqual(['location:l1 ambientSound']);
    expect(where('lamp')).toEqual(['item:i1 images 0']);
    expect([...usage.keys()].sort()).toEqual(['cover', 'lamp', 'rain', 'shared', 'song', 'wren']);
  });
});

describe('unsharedParts', () => {
  const img = (id: string) => ({ id, name: id, kind: 'image' as const, data: 'data:x' });
  const rig = (id: string, ...layers: string[][]) => ({
    id, name: id, kind: 'layered' as const, layers: layers.map((ids, i) => ({ id: `${id}${i}`, name: `L${i}`, variants: ids.map(ref) })),
  });
  // `twice` sits in two of the rig's Layers; each of the rest has one use outside it.
  const world = {
    worldOverview: {
      thumbnail: ref('cover'),
      mapBackground: { images: [ref('map')], frame: { x: 0, y: 0, width: 1, height: 1 }, opacity: 1 },
      mediaList: {
        rig: rig('rig', ['twice', 'own'], ['twice', 'shared', 'gallery', 'cover', 'map', 'backdrop']),
        other: rig('other', ['shared']),
        ...Object.fromEntries(['twice', 'own', 'shared', 'gallery', 'cover', 'map', 'backdrop', 'loose'].map((id) => [id, img(id)])),
      },
    } as unknown as WorldOverview,
    entities: [{ id: 'e1', name: 'Wren', images: [ref('gallery')] }] as unknown as Entity[],
    locations: [],
    bodies: [{ id: 'b1', name: 'Horse', backdrop: { kind: 'image', image: ref('backdrop') } }] as unknown as Body[],
    dictionaries: [],
  } satisfies MediaWorld;

  it('lists the images only this rig uses, keeping those another rig or any field uses', () => {
    expect(unsharedParts(world, 'rig')).toEqual(['twice', 'own']);
    expect(unsharedParts(world, 'other')).toEqual([]);
  });

  it('lists nothing for an image', () => {
    expect(unsharedParts(world, 'loose')).toEqual([]);
  });
});
