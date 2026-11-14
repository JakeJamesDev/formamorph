import { describe, expect, it } from 'vitest';
import type { World } from '@/types';
import { presenceLines } from './locationPresenceReasons';
import before from './locationPresenceReasons.bundled.json';
import { migrateWorld } from '@/lib/version';

/**
 * The Presence tab of every bundled world against the recorded lines in the JSON beside this file. No bundled entity
 * begins at Player's Starting Location and no bundled row is out of reach (bundledRoutines.test.ts), so every line
 * matches.
 */

const worlds = import.meta.glob<World>('@/defaultworlds/*.json', { import: 'default', eager: true });
const cases = Object.entries(worlds).map(([path, world]) => [path.replace(/^.*\/(.+)\.json$/, '$1'), migrateWorld(structuredClone(world))] as const);
const recorded: Record<string, Record<string, Record<string, string[]>>> = before;

describe('bundled Presence tabs', () => {
  it('records every bundled world', () => {
    expect(Object.keys(recorded).sort()).toEqual(cases.map(([id]) => id).sort());
  });

  it.each(cases)('%s keeps every line and reason', (id, world) => {
    const graph = { locations: world.locations ?? [], connections: world.connections ?? [] };
    const now: Record<string, Record<string, string[]>> = {};
    for (const location of graph.locations) {
      const lines = presenceLines(location.id, world.entities ?? [], graph);
      if (lines.length) now[location.id] = Object.fromEntries(lines.map((l) => [l.entity.id, l.reasons]));
    }
    expect(now).toEqual(recorded[id]);
  });
});
