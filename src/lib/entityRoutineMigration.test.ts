import { describe, expect, it } from 'vitest';
import { loadDevFixture } from './devFixtures';
import { migrateWorld } from './version';
import type { Entity, World } from '@/types';

/** Every bundled world and the dev fixtures with a cast, through the same load migration the game runs. */

const OLD_FIELDS = ['presence', 'movement'];

/** What breaks the new entity shape in `world`, one line per entity. Empty when every entity fits it. */
function shapeProblems(world: World): string[] {
  return (world.entities ?? []).flatMap((entity: Entity) => {
    const problems: string[] = [];
    const old = OLD_FIELDS.filter((key) => key in entity);
    if (old.length) problems.push(`${entity.id} keeps ${old.join(', ')}`);
    if (!entity.customPersona && entity.locations?.length && !entity.kind) problems.push(`${entity.id} has places and no kind`);
    if (entity.kind && 'locations' in entity) problems.push(`${entity.id} has a kind and stores locations`);
    return problems;
  });
}

const bundled = import.meta.glob<{ default: unknown }>('../defaultworlds/*.json', { eager: true });

describe('the load migration over shipped content', () => {
  it.each(Object.keys(bundled))('leaves no entity of %s on the old fields', (path) => {
    expect(shapeProblems(migrateWorld(structuredClone(bundled[path].default)))).toEqual([]);
  });

  // The fixtures that carry a cast with places; the rest need a browser to load.
  it.each(['whiteRoom', 'entityPresence', 'entityFollowers'])('leaves no entity of the %s fixture on the old fields', async (name) => {
    const fixture = await loadDevFixture(name);
    expect(fixture?.world).toBeDefined();
    expect(shapeProblems(migrateWorld(fixture!.world!))).toEqual([]);
  });
});
