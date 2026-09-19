import { followedLibraryId } from './publishLinks';
import type { Entity, EntityMetadata } from '@/types';

const nameKey = (name: string) => name.trim().toLowerCase();

/**
 * The library personas a Change offers in game. One entity fills one role: a persona the world holds a copy
 * of, or one added as a character at Enter World, stays out. Added characters carry fresh ids, so names match.
 */
export function inGamePersonas(library: EntityMetadata[], cast: Entity[], added: Entity[]): EntityMetadata[] {
  const followed = new Set(cast.map(followedLibraryId).filter((id): id is string => !!id));
  const addedNames = new Set(added.map((e) => nameKey(e.name)));
  return library.filter((meta) => meta.persona === true && !followed.has(meta.id) && !addedNames.has(nameKey(meta.name)));
}
