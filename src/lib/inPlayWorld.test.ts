import { describe, expect, it, vi } from 'vitest';
import { inPlayWorldData, playedEntityIdOf, resolveInPlayWorld } from './inPlayWorld';
import { forceOff } from '@/test/inPlayOverride';
import type { Connection, DiscoveredEntity, Entity, GameLocation } from '@/types';

vi.mock('@/lib/inPlayGates', async (original) => (await import('@/test/inPlayOverride')).withForcedOff(original));

const place = (id: string, parentId?: string): GameLocation => ({ id, name: id, ...(parentId ? { parentId } : {}) });
const HARBOR = place('harbor');
const MARKET = place('market');
const STALL = place('stall', 'market');
const mira: Entity = { id: 'mira', name: 'Mira', locations: ['harbor'] };
const ghost: Entity = { id: 'ghost', name: 'Ghost', locations: ['market'] };
const ash: Entity = { id: 'ash', name: 'Ash', persona: true };
const quay: Connection = { id: 'quay', a: 'harbor', b: 'market', aToB: {}, bToA: {} };
const source = { entities: [mira, ghost, ash], locations: [HARBOR, MARKET, STALL], connections: [quay] };
const runtime: DiscoveredEntity[] = [{ entity: { id: 'drifter', name: 'Drifter' }, sourceTurnId: 't1' }];

describe('the In-Play World for a world with no gates', () => {
  const world = resolveInPlayWorld(source, { playedEntityId: null });

  it('has every entity, location and connection on, as the same lists', () => {
    expect(world.entities).toBe(source.entities);
    expect(world.locations).toBe(source.locations);
    expect(world.connections).toBe(source.connections);
    expect(source.entities.every(world.isEntityOn)).toBe(true);
    expect(source.locations.every((l) => world.isLocationOn(l.id))).toBe(true);
  });

  it('locks no location', () => {
    expect(source.locations.some((l) => world.isLocked(l.id))).toBe(false);
  });

  it('keeps every runtime and library entity, as the same lists', () => {
    expect(world.discoveredOn(runtime)).toBe(runtime);
    const library = [{ id: 'lib-1', name: 'Lib' }];
    expect(world.entitiesOn(library)).toBe(library);
  });
});

describe('the In-Play World with an entity and a location off', () => {
  it('drops them from every list, and the connections that reach the location', () => {
    forceOff({ entities: ['ghost'], locations: ['market'] });
    const world = resolveInPlayWorld(source, { playedEntityId: null });
    expect(world.entities.map((e) => e.id)).toEqual(['mira', 'ash']);
    expect(world.locations.map((l) => l.id)).toEqual(['harbor', 'stall']);
    expect(world.connections).toEqual([]);
    expect(world.isEntityOn(ghost)).toBe(false);
    expect(world.isLocationOn('market')).toBe(false);
  });

  it('gates runtime characters by the same verdicts', () => {
    forceOff({ entities: ['drifter'] });
    expect(resolveInPlayWorld(source, { playedEntityId: null }).discoveredOn(runtime)).toEqual([]);
  });

  it('never turns off the played entity', () => {
    forceOff({ entities: ['ash'] });
    const world = resolveInPlayWorld(source, { playedEntityId: 'ash' });
    expect(world.entities).toContain(ash);
    expect(resolveInPlayWorld(source, { playedEntityId: null }).entities).not.toContain(ash);
  });
});

describe('an authored world slice under the In-Play World', () => {
  const slice = { ...source, name: 'Sedge' };

  it('is the same object when nothing is off', () => {
    expect(inPlayWorldData(slice, resolveInPlayWorld(source, { playedEntityId: null }))).toBe(slice);
  });

  it('loses the off entity, the off location and the connection that reaches it, and keeps the rest', () => {
    forceOff({ entities: ['ghost'], locations: ['market'] });
    const gated = inPlayWorldData(slice, resolveInPlayWorld(source, { playedEntityId: null }));
    expect(gated.entities.map((e) => e.id)).toEqual(['mira', 'ash']);
    expect(gated.locations.map((l) => l.id)).toEqual(['harbor', 'stall']);
    expect(gated.connections).toEqual([]);
    expect(gated.name).toBe('Sedge');
  });
});

describe('the played entity', () => {
  const custom: Entity = { id: 'custom', name: 'You', customPersona: true };

  it('is the picked world or library entity, the Custom Persona under None, and none without a persona', () => {
    expect(playedEntityIdOf({ source: 'world', entityId: 'ash' }, [ash, custom])).toBe('ash');
    expect(playedEntityIdOf({ source: 'library', entityId: 'lib-1' }, [ash, custom])).toBe('lib-1');
    expect(playedEntityIdOf({ source: 'none' }, [ash, custom])).toBe('custom');
    expect(playedEntityIdOf(undefined, [ash, custom])).toBeNull();
  });
});
