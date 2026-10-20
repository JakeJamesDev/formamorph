import { describe, expect, it } from 'vitest';
import { newLocation } from './blankWorld';
import { migrateWorld } from './version';
import type { World } from '@/types';

describe('newLocation', () => {
  it('opts a location made in the editor into Nearby through Connections', () => {
    expect(newLocation('l1').nearbyUsesConnections).toBe(true);
  });

  it('leaves the flag to the editor: migrating a world never sets it', () => {
    const world = { locations: [{ id: 'old', name: 'Old Mill' }] } as unknown as World;
    expect(migrateWorld(world).locations?.[0]).not.toHaveProperty('nearbyUsesConnections');
  });
});
