import { execFileSync } from 'node:child_process';
import pins from '../../scripts/pinnedCommits.json';
import type { World } from '@/types';

/** The last commit before the bundled worlds refresh changed a world file. */
export const PRE_REFRESH_SHA = pins.preRefresh;

/** The last commit before the bundled worlds expansion changed a world file. */
export const PRE_EXPANSION_SHA = pins.preExpansion;

/** The last commit before Entity Places removed the stored list from entities with a kind. */
export const PRE_ENTITY_PLACES_SHA = pins.preEntityPlaces;

/** The world without its first stat: a global one, else the first an entity owns. Null when it has none. */
export function withoutAStat(world: World): World | null {
  if (world.stats.length) return { ...world, stats: world.stats.slice(1) };
  const owner = world.entities.find((e) => e.stats?.length);
  if (!owner) return null;
  return { ...world, entities: world.entities.map((e) => (e === owner ? { ...e, stats: e.stats!.slice(1) } : e)) };
}

/**
 * A bundled world's file as it stood at a commit, parsed. Throws when the commit is missing, so a clone without
 * it fails rather than skipping.
 *
 * @param sha - The commit to read
 * @param id - The world's file name without `.json`
 */
export function worldAt(sha: string, id: string): Record<string, unknown> {
  const text = execFileSync('git', ['show', `${sha}:src/defaultworlds/${id}.json`], { maxBuffer: 1 << 30 });
  return JSON.parse(text.toString('utf8')) as Record<string, unknown>;
}
