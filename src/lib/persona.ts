import { primaryImage } from './entityImages';
import type { Entity, PersonaRef } from '@/types';

/** The entity the player plays, and where it was read from. */
export interface ResolvedPersona {
  entity: Entity;
  source: Exclude<PersonaRef['source'], 'none'>;
}

export interface PersonaResolution {
  /** Null for no reference, an explicit None, or a reference that no longer resolves. */
  persona: ResolvedPersona | null;
  /** The world's entities without the played one. Every in-play reader of the entity list reads this. */
  cast: Entity[];
  /** The names the planner reads as the player: the persona's name and aliases. */
  playerNames: string[];
  /** The reference names an entity that its source no longer holds. */
  unresolved: boolean;
}

/**
 * Turn a save's persona reference into the persona, the cast, and the player-name list.
 *
 * A reference resolves by id alone: the Persona mark gates the picker, so an entity unmarked after the pick
 * still plays. A library persona is never a world entity, so the cast only changes for a world persona.
 */
export function resolvePersona(
  ref: PersonaRef | undefined,
  worldEntities: Entity[],
  libraryEntities: Entity[],
): PersonaResolution {
  if (!ref || ref.source === 'none') {
    return { persona: null, cast: worldEntities, playerNames: [], unresolved: false };
  }
  const pool = ref.source === 'world' ? worldEntities : libraryEntities;
  const entity = pool.find((e) => e.id === ref.entityId);
  if (!entity) return { persona: null, cast: worldEntities, playerNames: [], unresolved: true };
  return {
    persona: { entity, source: ref.source },
    cast: ref.source === 'world' ? worldEntities.filter((e) => e.id !== entity.id) : worldEntities,
    playerNames: [entity.name, ...(entity.aliases ?? [])].map((n) => n.trim()).filter(Boolean),
    unresolved: false,
  };
}

/** The persona chosen at world entry. A library pick carries the entity read at entry, so page one can
 *  name it; the save keeps only the reference. */
export interface PersonaPick {
  ref: PersonaRef;
  libraryEntity?: Entity;
}

/** A world entity as a persona picker option, its player description resolved through `resolve`. */
export const personaOption = (resolve: (text: string) => string) =>
  (entity: Entity): { id: string; name: string; image?: string; description?: string } => {
    const description = entity.playerDescription?.trim();
    return { id: entity.id, name: entity.name, image: primaryImage(entity), description: description ? resolve(description) : undefined };
  };
