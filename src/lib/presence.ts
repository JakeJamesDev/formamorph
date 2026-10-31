import type { Connection, Entity, EntityPositions, GameLocation } from '@/types';
import { ancestors, parentLookup } from './ancestors';
import { entitiesInPlay } from './entityPresence';
import { findNameMatches } from './entityMatch';
import type { StrangerLabels } from './locationContext';

/**
 * Scene Presence: for every entity, where it is, whether the player has met it, whether it is in scene, and
 * the label the player sees. Every player surface reads one of the three named sets; AI passes never do.
 */

/** How many recent turns keep a quiet entity in scene. */
export const IN_SCENE_TURNS = 3;

/** Where an entity stands relative to the player. */
export type Where = 'here' | 'connected' | 'elsewhere';

/** One assistant turn as presence reads it: who took part, and where it took place. */
export interface SceneTurn {
  participants: readonly string[];
  /** Absent on turns saved before the field; such a turn never cuts the window. */
  locationId?: string;
}

export interface PresenceInput {
  /** The authored cast, texts resolved. */
  entities: readonly Entity[];
  /** The runtime characters, texts resolved. */
  runtime: readonly Entity[];
  /** Where each positioned entity stands, runtime characters included. */
  positions: Readonly<EntityPositions>;
  followers: readonly string[];
  locationId: string | null | undefined;
  locations: readonly Pick<GameLocation, 'id' | 'parentId'>[];
  connections: readonly Pick<Connection, 'a' | 'b'>[];
  /** The played persona's entity. */
  persona: Entity | null;
  /** The met-in-play list. */
  met: readonly string[];
  /** The latest alias each stranger was seen under, by entity id. */
  strangerAliases: StrangerLabels;
  /** The recorded turns, oldest first. */
  turns: readonly SceneTurn[];
}

export interface EntityPresence {
  entity: Entity;
  where: Where;
  met: boolean;
  inScene: boolean;
  /** What the player sees the entity as. Null for a stranger with no alias and no Stranger Name. */
  label: string | null;
}

export interface Presence {
  byId: ReadonlyMap<string, EntityPresence>;
  /** Everyone here with a label: In Scene first, then the quiet ones. */
  lookAround: EntityPresence[];
  /** Everyone here with a label who took part lately. */
  inScene: EntityPresence[];
  /** Everyone the player knows, wherever they are. */
  met: EntityPresence[];
}

const nameKey = (name: string) => name.trim().toLowerCase();

/** Whether the start rule meets `entity` under `persona`. Never stored. */
export function startsMet(
  entity: Entity,
  persona: Entity | null,
  locations: readonly Pick<GameLocation, 'id' | 'parentId'>[],
  runtime = false,
): boolean {
  // A Stranger Name that resolves blank still makes a stranger, one with no label.
  if (runtime || entity.strangerName === undefined) return true;
  if (!persona) return false;
  const tied = entity.relationships?.some((r) => r.targetId === persona.id)
    || persona.relationships?.some((r) => r.targetId === entity.id);
  if (tied) return true;
  // Nearby and Nowhere meet nobody; each explicit pick covers its subtree.
  const picks = Array.isArray(entity.knownIn) ? new Set(entity.knownIn) : null;
  if (!picks?.size) return false;
  const parentOf = parentLookup(locations, (l) => l.parentId);
  return (persona.locations ?? []).some((at) => [at, ...ancestors(at, parentOf)].some((id) => picks.has(id)));
}

/** Whether the player has met an entity: on the met-in-play list, or by the start rule. */
export function metCheck(
  met: readonly string[],
  persona: Entity | null,
  locations: readonly Pick<GameLocation, 'id' | 'parentId'>[],
  runtimeIds: ReadonlySet<string>,
): (entity: Entity) => boolean {
  const metIds = new Set(met);
  return (entity) => metIds.has(entity.id) || startsMet(entity, persona, locations, runtimeIds.has(entity.id));
}

/** The places one step from `locationId`: its parent, siblings, children and map connections. */
export function connectedPlaces(
  locationId: string,
  locations: readonly Pick<GameLocation, 'id' | 'parentId'>[],
  connections: readonly Pick<Connection, 'a' | 'b'>[],
): Set<string> {
  const parentId = locations.find((l) => l.id === locationId)?.parentId ?? null;
  const out = new Set<string>();
  if (parentId) out.add(parentId);
  for (const l of locations) {
    if (l.id === locationId) continue;
    if (l.parentId === locationId || (parentId && l.parentId === parentId)) out.add(l.id);
  }
  for (const c of connections) {
    if (c.a === locationId) out.add(c.b);
    if (c.b === locationId) out.add(c.a);
  }
  out.delete(locationId);
  return out;
}

/** The ids of everyone who took part in the in-scene window. A move ends the window for all but followers. */
function participantIds(
  turns: readonly SceneTurn[], locationId: string | null | undefined, cast: readonly Entity[], followers: ReadonlySet<string>,
): Set<string> {
  const idByName = new Map<string, string>();
  for (const e of cast) if (!idByName.has(nameKey(e.name))) idByName.set(nameKey(e.name), e.id);
  const out = new Set<string>();
  let cut = false;
  for (let i = turns.length - 1, seen = 0; i >= 0 && seen < IN_SCENE_TURNS; i--, seen++) {
    const turn = turns[i];
    if (turn.locationId !== undefined && turn.locationId !== locationId) cut = true;
    for (const name of turn.participants) {
      const id = idByName.get(nameKey(name));
      if (id && (!cut || followers.has(id))) out.add(id);
    }
  }
  return out;
}

/** What an unmet entity shows as: its latest story alias, else its Stranger Name, else nothing. */
function strangerLabel(entity: Entity, aliases: StrangerLabels): string | null {
  return aliases[entity.id]?.trim() || entity.strangerName?.trim() || null;
}

/** How the planner names each entity that has a Stranger Name, by true name. Absent for everyone else, who
 *  keeps the narration test. */
export interface StrangerReveal {
  met: boolean;
  /** The label an unmet stranger is cast under; null when it has none. */
  label: string | null;
}

/** How the planner sees the entities that have a Stranger Name. */
export interface PlannerStrangers {
  /** The label each unmet stranger prints in the planner's roster, by entity id. */
  labels: StrangerLabels;
  /** A lookup by true name: whether the entity is met, and its label while unmet. */
  reveal: (realName: string) => StrangerReveal | undefined;
}

/** The planner's view of every entity that has a Stranger Name. */
export function plannerStrangers(
  entities: readonly Entity[],
  isMet: (entity: Entity) => boolean,
  aliases: StrangerLabels,
): PlannerStrangers {
  const labels: Record<string, string> = {};
  const byName = new Map<string, StrangerReveal>();
  for (const entity of entities) {
    if (entity.strangerName === undefined) continue;
    const met = isMet(entity);
    const label = met ? null : strangerLabel(entity, aliases);
    if (label) labels[entity.id] = label;
    if (!byName.has(nameKey(entity.name))) byName.set(nameKey(entity.name), { met, label });
  }
  return { labels, reveal: (realName) => byName.get(nameKey(realName)) };
}

/** Every entity's presence and the three named sets, in cast order. */
export function computePresence(input: PresenceInput): Presence {
  const { persona, locationId, locations } = input;
  const isMet = metCheck(input.met, persona, locations, new Set(input.runtime.map((e) => e.id)));
  const cast = entitiesInPlay([...input.entities, ...input.runtime], input.positions)
    .filter((e) => !e.customPersona && e.id !== persona?.id);
  const near = locationId ? connectedPlaces(locationId, locations, input.connections) : new Set<string>();
  const recentIds = participantIds(input.turns, locationId, cast, new Set(input.followers));

  const byId = new Map<string, EntityPresence>();
  for (const entity of cast) {
    const places = entity.locations ?? [];
    const where: Where = locationId && places.includes(locationId) ? 'here'
      : places.some((id) => near.has(id)) ? 'connected' : 'elsewhere';
    const met = isMet(entity);
    const label = met ? entity.name : strangerLabel(entity, input.strangerAliases);
    byId.set(entity.id, { entity, where, met, inScene: where === 'here' && recentIds.has(entity.id), label });
  }
  const all = [...byId.values()];
  const shown = all.filter((p) => p.where === 'here' && p.label !== null);
  const inScene = shown.filter((p) => p.inScene);
  return {
    byId,
    lookAround: [...inScene, ...shown.filter((p) => !p.inScene)],
    inScene,
    met: all.filter((p) => p.met),
  };
}

/** The ids of the entities in `hereIds` that `narration` names, dialogue included. Authored aliases never
 *  introduce, and nobody elsewhere is introduced. */
export function introducedIds(narration: string, entities: readonly Entity[], hereIds: readonly string[]): string[] {
  const here = new Set(hereIds);
  const present = entities.filter((e) => here.has(e.id));
  const named = new Set(findNameMatches(narration, present.map((e) => e.name)).map((m) => m.name));
  return present.filter((e) => named.has(e.name)).map((e) => e.id);
}

/** `aliases` with the alias each cast member carries for an entity `isMet` rejects. The same record when
 *  nothing changes. */
export function strangerAliasesFromCast(
  aliases: StrangerLabels,
  cast: readonly { name: string; alias?: string; isPlayer?: boolean }[],
  entities: readonly Entity[],
  isMet: (entity: Entity) => boolean,
): StrangerLabels {
  let next = aliases;
  for (const member of cast) {
    const alias = member.alias?.trim();
    if (member.isPlayer || !alias) continue;
    const entity = entities.find((e) => nameKey(e.name) === nameKey(member.name));
    if (!entity || isMet(entity) || next[entity.id] === alias) continue;
    next = { ...next, [entity.id]: alias };
  }
  return next;
}

/** The live scene list after a move: the followers' rows only. The same array when every row stays. */
export function sceneAfterMove<R extends { name: string }>(rows: R[], followers: readonly string[], cast: readonly Entity[]): R[] {
  const following = new Set(followers);
  const kept = rows.filter((row) => cast.some((e) => following.has(e.id) && nameKey(e.name) === nameKey(row.name)));
  return kept.length === rows.length ? rows : kept;
}

/** `met` plus each of `ids` not already in it, in order. The same array when nobody new is met. */
export function withMet(met: readonly string[], ids: readonly string[]): readonly string[] {
  const known = new Set(met);
  const added: string[] = [];
  for (const id of ids) {
    if (known.has(id)) continue;
    known.add(id);
    added.push(id);
  }
  return added.length ? [...met, ...added] : met;
}
