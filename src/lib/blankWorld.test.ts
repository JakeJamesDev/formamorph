import { describe, expect, it } from 'vitest';
import { newLocation } from './blankWorld';
import { migrateWorld } from './version';
import type { World } from '@/types';

describe('newLocation', () => {
  it('makes a location with no Nearby Through Connections field', () => {
    expect(newLocation('l1')).not.toHaveProperty('nearbyUsesConnections');
  });

  it('drops the removed Nearby Through Connections field on load, and a second load changes nothing', () => {
    const world = { locations: [{ id: 'old', name: 'Old Mill', nearbyUsesConnections: true }] } as unknown as World;
    const once = migrateWorld(world);
    expect(once.locations?.[0]).toEqual({ id: 'old', name: 'Old Mill' });
    expect(migrateWorld(once).locations).toEqual(once.locations);
  });
});
