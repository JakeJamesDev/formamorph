import { primaryImage } from './entityImages';
import { inCast } from './bearers';
import { customPersonaEntity } from './blueprints';
import type { Entity, PersonaRef } from '@/types';
import type { ResolveEntityText } from './resolveWorldNames';

/** The entity the player plays, and where it was read from. `custom` is the Custom Persona entity in
 *  None's place, carrying the player's entry. */
export interface ResolvedPersona {
  entity: Entity;
  source: 'world' | 'library' | 'custom';
}

export type NoneRef = Extract<PersonaRef, { source: 'none' }>;

/** The Custom Persona entity with the player's entry: the entered name in place of its name, and the
 *  entered description after its player and AI descriptions. The entity itself with a blank entry. */
export function enteredPersona(entity: Entity, ref: NoneRef | undefined): Entity {
  const name = ref?.name?.trim();
  const description = ref?.description?.trim();
  if (!name && !description) return entity;
  const followed = (text: string | undefined) => [text?.trim(), description].filter(Boolean).join('\n\n');
  return {
    ...entity,
    ...(name ? { name } : {}),
    ...(description ? { playerDescription: followed(entity.playerDescription), aiDescription: followed(entity.aiDescription) } : {}),
  };
}

/** The world's entities with the Custom Persona entity carrying the player's entry, or the picked library
 *  persona's name, for the surfaces that read the marked entity from the list: its tree node and its
 *  Character Name. The same list otherwise. */
export function withPersonaEntry(entities: readonly Entity[], ref: PersonaRef | undefined, libraryName?: string): readonly Entity[] {
  if (ref?.source === 'world') return entities;
  const marked = customPersonaEntity(entities);
  const entered = marked && (ref?.source === 'library'
    ? (libraryName?.trim() ? { ...marked, name: libraryName.trim() } : marked)
    : enteredPersona(marked, ref));
  return !entered || entered === marked ? entities : entities.map((e) => (e === marked ? entered : e));
}

const namesOf = (entity: Entity): string[] => [entity.name, ...(entity.aliases ?? [])].map((n) => n.trim()).filter(Boolean);

export interface PersonaResolution {
  /** Null for no reference, an explicit None, or a reference that no longer resolves. */
  persona: ResolvedPersona | null;
  /** The world's entities without the played one and without unpicked persona-only entities. Every in-play
   *  reader of the entity list reads this. */
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
 * still plays. A library persona is never a world entity. An unpicked persona-only entity is never in the cast.
 * Under None the Custom Persona entity plays, with the player's entry; a world without one plays no persona.
 */
export function resolvePersona(
  ref: PersonaRef | undefined,
  worldEntities: Entity[],
  libraryEntities: Entity[],
): PersonaResolution {
  const kept = worldEntities.filter((e) => inCast(e, ref));
  const cast = kept.length === worldEntities.length ? worldEntities : kept;
  if (!ref || ref.source === 'none') {
    const marked = customPersonaEntity(worldEntities);
    if (!marked) return { persona: null, cast, playerNames: [], unresolved: false };
    const entity = enteredPersona(marked, ref);
    return { persona: { entity, source: 'custom' }, cast, playerNames: namesOf(entity), unresolved: false };
  }
  const pool = ref.source === 'world' ? worldEntities : libraryEntities;
  const entity = pool.find((e) => e.id === ref.entityId);
  if (!entity) return { persona: null, cast, playerNames: [], unresolved: true };
  return { persona: { entity, source: ref.source }, cast, playerNames: namesOf(entity), unresolved: false };
}

/** Every present world entity: the cast, plus the played one when it is a world entity, the Custom Persona
 *  entity included. */
export const worldEntitiesOf = (cast: Entity[], persona: ResolvedPersona | null): Entity[] =>
  (persona && persona.source !== 'library' ? [...cast, persona.entity] : cast);

/** The persona chosen at world entry. A library pick carries the entity read at entry, so page one can
 *  name it; the save keeps only the reference. */
export interface PersonaPick {
  ref: PersonaRef;
  libraryEntity?: Entity;
}

/** A world entity as a persona picker option, its player description resolved through `resolve` with the
 *  entity as its owner. */
export const personaOption = (resolve: ResolveEntityText) =>
  (entity: Entity): { id: string; name: string; image?: string; description?: string } => {
    const description = entity.playerDescription?.trim();
    return {
      id: entity.id, name: entity.name, image: primaryImage(entity),
      description: description ? resolve(entity, description) : undefined,
    };
  };
