// Global scope: the stats and traits no one owns, in their own slot beside an owners map keyed by entity id.

import type { PersonaRef } from '@/types';

/** Who holds an item: an entity owner's id, or null for global scope, which no one owns. */
export type OwnerId = string | null;

/** Owner-keyed state in two parts: the global part no one owns, and each entity owner's part by entity id. */
export interface Scoped<T> {
  global: T;
  owners: Readonly<Record<string, T>>;
}

/** A key part per owner. Entity ids are never empty, so global scope keys by the empty string. */
export const scopeKey = (ownerId: OwnerId): string => ownerId ?? '';

/** A scoped value with `global` and, by default, no owners. */
export const scoped = <T>(global: T, owners: Readonly<Record<string, T>> = {}): Scoped<T> => ({ global, owners });

/** The part `ownerId` holds: the global part for null, else that owner's part, if any. */
export const partOf = <T>(value: Scoped<T>, ownerId: OwnerId): T | undefined =>
  (ownerId === null ? value.global : value.owners[ownerId]);

/** `value` with `ownerId`'s part set to `part`. */
export const withPart = <T>(value: Scoped<T>, ownerId: OwnerId, part: T): Scoped<T> =>
  (ownerId === null ? { ...value, global: part } : { ...value, owners: { ...value.owners, [ownerId]: part } });

/** Every part with its owner id, global first. */
export const scopedEntries = <T>(value: Scoped<T>): [OwnerId, T][] => [[null, value.global], ...Object.entries(value.owners)];

/** `value` with `fn` applied to each part. */
export const mapScoped = <T, U>(value: Scoped<T>, fn: (part: T, ownerId: OwnerId) => U): Scoped<U> => ({
  global: fn(value.global, null),
  owners: Object.fromEntries(Object.entries(value.owners).map(([id, part]) => [id, fn(part, id)])),
});

/** The entities played under `persona`, by id: a world persona's entity; a library persona's entity, then the
 *  Custom Persona entity; under None, the Custom Persona entity alone (Q26). */
export function playedEntityIds(persona: PersonaRef, entities: readonly { id: string; customPersona?: boolean }[] = []): string[] {
  if (persona.source === 'world') return [persona.entityId];
  const custom = entities.filter((e) => e.customPersona).map((e) => e.id);
  return persona.source === 'none' ? custom : [persona.entityId, ...custom];
}
