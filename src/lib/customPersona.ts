// The Custom Persona mark on an entity: the Persona role it joins, the one-per-world rule, and the counts
// its unmark and delete confirmations name.

import { customPersonaEntity } from './blueprints';
import { namedPlacesOf, withMembership, withoutMembership } from './entityPlaces';
import { PLAYER_START, type Entity } from '@/types';

/** The four states the `persona`, `personaOnly` and `customPersona` marks can take together. */
export type PersonaRole = 'cast' | 'playable' | 'only' | 'custom';

export const personaRole = (e: Pick<Entity, 'persona' | 'personaOnly' | 'customPersona'>): PersonaRole =>
  (e.customPersona ? 'custom' : !e.persona ? 'cast' : e.personaOnly ? 'only' : 'playable');

/** The fields a role writes. The Custom Persona role clears the Persona marks, and its nodes' placements so
 *  they move to the end of the Traits and Stats tabs' top level. */
export function personaRolePatch(role: PersonaRole): Partial<Entity> {
  return {
    persona: role === 'playable' || role === 'only' ? true : undefined,
    personaOnly: role === 'only' ? true : undefined,
    customPersona: role === 'custom' ? true : undefined,
    ...(role === 'custom' ? { traitPlacement: undefined, statPlacement: undefined } : {}),
  };
}

/** Whether the role keeps its start places as the `locations` list; Cast and Playable keep a kind and Starts. */
export const keepsStartList = (role: PersonaRole): boolean => role === 'only' || role === 'custom';

/** Whether `e` is a Persona-Only or Custom Persona entity, which holds the list and no routine. */
export const holdsStartList = (e: Pick<Entity, 'persona' | 'personaOnly' | 'customPersona'>): boolean => keepsStartList(personaRole(e));

/** `entity` in `next`'s role: the marks, and the start places in that role's shape. Starts become the list (named
 *  places in Start order, each once); the list becomes one Unique Start per place. A switch inside one shape keeps it. */
export function withPersonaRole(entity: Entity, next: PersonaRole, newId: () => string): Entity {
  const marked: Entity = { ...entity, ...personaRolePatch(next) };
  const wasList = holdsStartList(entity);
  if (wasList === keepsStartList(next)) return marked;
  if (wasList) {
    const places = namedPlacesOf(entity);
    const rest = withoutMembership(marked);
    if (!places.length) return rest;
    return { ...rest, kind: 'unique', starts: places.map((place) => ({ id: newId(), place, weight: 1, schedule: [] })) };
  }
  const places = [...new Set((entity.starts ?? []).flatMap((s) => (s.place === PLAYER_START ? [] : [s.place])))];
  const { kind: _k, starts: _s, traversable: _t, onMap: _m, knownIn: _i, ...rest } = marked;
  return withMembership(rest, places);
}

/** The other entity that holds the mark, which keeps it off `id`. */
export function customPersonaHeldElsewhere(entities: readonly Entity[], id: string): Entity | undefined {
  const marked = customPersonaEntity(entities);
  return marked && marked.id !== id ? marked : undefined;
}

/** What the confirmations count on the entity: its links, its own traits, its copies, and every placeholder
 *  it owns. Groups are not counted. */
export interface CustomPersonaCounts {
  links: number;
  traits: number;
  copies: number;
  placeholders: number;
}

export function customPersonaCounts(entity: Entity): CustomPersonaCounts {
  const placeholders = entity.placeholders ?? [];
  return {
    links: entity.traitLinks?.length ?? 0,
    traits: entity.traits?.length ?? 0,
    copies: placeholders.filter((p) => p.blueprintId).length,
    placeholders: placeholders.length,
  };
}

/** "2 links, 1 trait and 3 copies": each nonzero count with its noun. Null when every count is zero. */
function countList(parts: readonly [number, string, string][]): string | null {
  const named = parts.filter(([n]) => n > 0).map(([n, one, many]) => `${n} ${n === 1 ? one : many}`);
  if (!named.length) return null;
  return named.length === 1 ? named[0] : `${named.slice(0, -1).join(', ')} and ${named.at(-1)}`;
}

/** The unmark confirmation's line; null when the entity carries nothing to name, so no confirmation. */
export function unmarkLine(counts: CustomPersonaCounts): string | null {
  const list = countList([[counts.links, 'link', 'links'], [counts.traits, 'trait', 'traits'], [counts.copies, 'copy', 'copies']]);
  return list && `It becomes a regular entity and keeps its ${list}.`;
}

/** The delete confirmation's line; null when the entity carries nothing to name, so no confirmation. */
export function deleteLine(counts: CustomPersonaCounts): string | null {
  const list = countList([
    [counts.links, 'link', 'links'], [counts.traits, 'trait', 'traits'], [counts.placeholders, 'placeholder', 'placeholders'],
  ]);
  return list && `This also deletes its ${list}.`;
}
