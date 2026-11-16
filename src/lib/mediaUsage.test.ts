import { describe, it, expect } from 'vitest';
import type { Body, Entity, GameLocation, Item, WorldOverview } from '@/types';
import { mediaUsage } from './mediaUsage';
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
