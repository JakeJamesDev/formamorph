import { entityTexts } from './entityTexts';
import { carriedPlaceholders } from './placeholderHomes';
import { primeRolls, weightedPick, type PlaceholderPick } from './placeholders';
import type { Entity, Placeholder, PlaceholderRolls } from '@/types';

/**
 * The session's Placeholder Set: the world's list, then the library persona's own pool. A world persona
 * passes null, because its placeholders are already in the world's list. The world list is never written,
 * and it comes back as itself when the persona adds nothing. The world copy wins an id both hold.
 */
export function personaPlaceholderSet(world: Placeholder[], persona: Entity | null): Placeholder[] {
  const carried = persona ? carriedPlaceholders(persona) : [];
  if (carried.length === 0) return world;
  const held = new Set(world.map((p) => p.id));
  const added = carried.filter((p) => !held.has(p.id));
  return added.length ? [...world, ...added] : world;
}

/** The rolls with every Wildcard the persona's text places drawn. Existing rolls are kept, so a persona
 *  set a second time reads the values it read the first time. */
export function primePersonaRolls(
  world: Placeholder[],
  persona: Entity,
  rolls: PlaceholderRolls,
  pick: PlaceholderPick = weightedPick,
): PlaceholderRolls {
  const set = personaPlaceholderSet(world, persona);
  if (set === world) return rolls;
  const texts = entityTexts(persona).filter((t): t is string => !!t);
  const next = primeRolls(set, texts, rolls, pick);
  const added = Object.keys(next.world ?? {}).length + Object.keys(next.unique ?? {}).length
    - Object.keys(rolls.world ?? {}).length - Object.keys(rolls.unique ?? {}).length;
  return added > 0 ? next : rolls;
}
