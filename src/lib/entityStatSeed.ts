// Entity stat seeds for a new game. Kept apart from entityStats so workers that seed stats skip the markdown parser.

import type { Entity, EntityStatValues, Stat } from '@/types';
import { playStatWorld, type StatLinkWorld } from './statLinks';
import { seedNewGameStats } from './traitRuntime';

/** Each entity's own stats as a new game seeds them, its links resolved against the world's stats. */
export const seedWorldEntityStats = (world: StatLinkWorld & { stats: Stat[]; entities: Entity[] }): EntityStatValues =>
  seedEntityStats(playStatWorld(world).entities);

/** Each authored entity that owns stats, every stat seeded as a new game seeds the player's. */
export const seedEntityStats = (entities: readonly Pick<Entity, 'id' | 'stats'>[]): EntityStatValues =>
  Object.fromEntries(entities.filter((e) => e.stats?.length).map((e) => [e.id, seedNewGameStats(e.stats ?? [])]));
