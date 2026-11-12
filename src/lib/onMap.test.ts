import { describe, expect, it, vi } from 'vitest';
import type { Entity, World } from '@/types';
import { ON_MAP_OPTIONS, onMapOf, withOnMap } from './onMap';
import { serializeWorldFile } from './worldFile';
import { migrateWorld } from './version';

// The serializer runs in a worker the test environment lacks; this stand-in writes the same JSON text.
vi.mock('./jsonFileWorkerUtils', () => ({
  serializeJsonBlob: async (value: unknown, space?: number) => new Blob([JSON.stringify(value, null, space)]),
}));

describe('onMapOf', () => {
  it.each(ON_MAP_OPTIONS.map((o) => o.value))('reads %s as itself', (value) => {
    expect(onMapOf({ onMap: value })).toBe(value);
  });

  it('reads an absent field and an unknown value as Always', () => {
    expect(onMapOf({})).toBe('always');
    expect(onMapOf({ onMap: 'sometimes' as unknown as Entity['onMap'] })).toBe('always');
  });
});

describe('withOnMap', () => {
  it('stores Always as no field and any other value as the field', () => {
    expect(withOnMap({ id: 'a', name: 'A', onMap: 'never' } as Entity, 'always')).not.toHaveProperty('onMap');
    expect(withOnMap({ id: 'a', name: 'A' } as Entity, 'onceMet').onMap).toBe('onceMet');
  });
});

describe('On Map in a world file', () => {
  it('survives export and import for each value, and an absent field stays absent', async () => {
    const entities = [
      { id: 'a', name: 'A', onMap: 'onceMet' }, { id: 'b', name: 'B', onMap: 'whenNearby' },
      { id: 'c', name: 'C', onMap: 'never' }, { id: 'd', name: 'D' },
    ] as Entity[];
    const blob = await serializeWorldFile({ id: 'w', name: 'W', entities } as unknown as World);
    const back = migrateWorld(JSON.parse(await blob.text()));
    expect(back.entities.map((e) => e.onMap)).toEqual(['onceMet', 'whenNearby', 'never', undefined]);
  });
});
