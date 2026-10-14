// Global scope: the stats and traits no one owns, in their own slot beside an owners map keyed by entity
// id. Owner-keyed maps still hold global scope under the stand-in key; these converters bridge the two.

import type { PersonaRef } from '@/types';

/** The stand-in owner key that holds global scope in an owner-keyed map. */
export const PLAYER_OWNER = 'world';

/** Owner-keyed state in two parts: the global part no one owns, and each entity owner's part by entity id. */
export interface Scoped<T> {
  global: T;
  owners: Readonly<Record<string, T>>;
}

/** The scoped form of an owner-keyed map: its stand-in key's value is the global part, or `empty` without one. */
export function scopedOf<T>(keyed: Readonly<Record<string, T>>, empty: T): Scoped<T> {
  const { [PLAYER_OWNER]: global = empty, ...owners } = keyed;
  return { global, owners };
}

/** The owner-keyed map a scoped value stands for, the global part under the stand-in key. */
export const keyedOf = <T>(scoped: Scoped<T>): Record<string, T> => ({ [PLAYER_OWNER]: scoped.global, ...scoped.owners });

/** The entities played under `persona`, by id: a world persona's entity; a library persona's entity, then the
 *  Custom Persona entity; under None, the Custom Persona entity alone (Q26). */
export function playedEntityIds(persona: PersonaRef, entities: readonly { id: string; customPersona?: boolean }[] = []): string[] {
  if (persona.source === 'world') return [persona.entityId];
  const custom = entities.filter((e) => e.customPersona).map((e) => e.id);
  return persona.source === 'none' ? custom : [persona.entityId, ...custom];
}
