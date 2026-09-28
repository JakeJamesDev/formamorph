import { createKeyedRecordStore, readStorageJson, writeStorageJson } from './keyedStorage';
import type { Entity, GameLocation, PersonaRef, WorldOverview, WorldPlayerSetting } from '@/types';

/** Every player setting, in the order the World Editor shows them. */
export const PLAYER_SETTINGS: readonly WorldPlayerSetting[] = ['open', 'fixed', 'cast'];

/** The world's player setting. An absent or unknown value is Open. */
export function worldPlayerSetting(overview: Pick<WorldOverview, 'playerSetting'> | undefined): WorldPlayerSetting {
  const value = overview?.playerSetting;
  return value && PLAYER_SETTINGS.includes(value) ? value : 'open';
}

/** What a picker lists under the world's player setting. */
export interface PersonaOffer<T> {
  world: T[];
  library: T[];
  /** The picker offers None. */
  none: boolean;
  /** The Custom Persona entity, which stands in None's place while None is offered. */
  custom?: T;
}

/** The personas a picker lists. Cast keeps only the world's personas and drops None; a Cast world with no
 *  world persona offers what Fixed offers. */
export function offeredPersonas<T>(setting: WorldPlayerSetting, available: { world: T[]; library: T[]; custom?: T }): PersonaOffer<T> {
  if (setting === 'cast' && available.world.length > 0) return { world: available.world, library: [], none: false };
  return { world: available.world, library: available.library, none: true, ...(available.custom ? { custom: available.custom } : {}) };
}

/** A picker has something to pick: None alone is no choice, but the Custom Persona entity's row is one. */
export function hasPersonaChoice(offer: PersonaOffer<unknown>): boolean {
  return offer.world.length + offer.library.length > 0 || (offer.none && offer.custom !== undefined);
}

/** Whether two refs name the same pick, an entered name or description included. */
export function samePersonaRef(a: PersonaRef, b: PersonaRef): boolean {
  if (a.source !== b.source) return false;
  if (a.source === 'none' && b.source === 'none') return (a.name ?? '') === (b.name ?? '') && (a.description ?? '') === (b.description ?? '');
  return a.source !== 'none' && b.source !== 'none' && a.entityId === b.entityId;
}

/** The inputs of the preselect rule, shared by the enter-world step and Quick Start. */
export interface PersonaChoices {
  playerSetting: WorldPlayerSetting;
  /** This world's last pick on this device. */
  remembered: PersonaRef | undefined;
  /** The global default: a library entity id. */
  globalDefault: string | undefined;
  /** The persona ids the picker offers: the world's marked entities and the library personas, and whether a
   *  Custom Persona entity stands in None's place. */
  available: { world: string[]; library: string[]; custom?: boolean };
}

const NONE: PersonaRef = { source: 'none' };

/** The persona the picker starts on: the world's remembered pick, then the rule of the world's player setting,
 *  then the global default, then None. A pick the picker does not offer falls through to the next rule. */
export function preselectPersona({ playerSetting, remembered, globalDefault, available }: PersonaChoices): PersonaRef {
  const offer = offeredPersonas(playerSetting, { ...available, custom: available.custom ? 'custom' : undefined });
  if (!hasPersonaChoice(offer)) return NONE;
  const offered = (ref: PersonaRef) => (ref.source === 'none' ? offer.none : offer[ref.source].includes(ref.entityId));
  if (remembered && offered(remembered)) return remembered;
  if (!offer.none) return { source: 'world', entityId: offer.world[0] };
  if (playerSetting !== 'open') return NONE;
  if (globalDefault && offer.library.includes(globalDefault)) return { source: 'library', entityId: globalDefault };
  return NONE;
}

/** The location the persona names for itself, while the world still has it. */
export function namedStartLocation<L extends GameLocation>(entity: Entity, locations: readonly L[]): L | undefined {
  return entity.startingLocationId ? locations.find((l) => l.id === entity.startingLocationId) : undefined;
}

/** Where a world persona begins: the location it names, else the first of its locations that is a starting
 *  location, else null. */
export function personaStartLocation(entity: Entity, locations: readonly GameLocation[]): string | null {
  const named = namedStartLocation(entity, locations);
  if (named) return named.id;
  return entity.locations?.find((id) => locations.some((l) => l.id === id && l.isStarting)) ?? null;
}

/** What a persona pick reads to preselect a starting location. */
export interface PersonaPickContext {
  worldEntities: readonly Entity[];
  locations: readonly GameLocation[];
}

const worldPersona = (ref: PersonaRef, worldEntities: readonly Entity[]) =>
  ref.source === 'world' ? worldEntities.find((e) => e.id === ref.entityId) : undefined;

/** The locations the Starting Location step lists, in world order: the flagged ones, plus the one the picked
 *  world persona names. */
export function offeredStartLocations<L extends GameLocation>(
  ref: PersonaRef, { worldEntities, locations }: { worldEntities: readonly Entity[]; locations: readonly L[] },
): L[] {
  const persona = worldPersona(ref, worldEntities);
  return locations.filter((l) => l.isStarting || l.id === persona?.startingLocationId);
}

/** The starting location after a persona pick. A location the step no longer lists drops to the new persona's
 *  own pick, else Random. Otherwise a world persona preselects its own starting location until the player
 *  picks a location by hand, and every other pick keeps the current one. */
export function locationForPersonaPick({ ref, current, locationChosen, ...context }: {
  ref: PersonaRef;
  current: string | null;
  /** The player picked the location by hand in this step. */
  locationChosen: boolean;
} & PersonaPickContext): { locationId: string | null; locationChosen: boolean } {
  const persona = worldPersona(ref, context.worldEntities);
  const own = persona ? personaStartLocation(persona, context.locations) : null;
  if (current !== null && !offeredStartLocations(ref, context).some((l) => l.id === current)) {
    return { locationId: own, locationChosen: false };
  }
  if (locationChosen) return { locationId: current, locationChosen };
  return { locationId: own ?? current, locationChosen };
}

/** The added characters without the library persona: one entity fills one role per playthrough. */
export function withoutPersona(entityIds: Set<string>, persona: PersonaRef): Set<string> {
  if (persona.source !== 'library' || !entityIds.has(persona.entityId)) return entityIds;
  const next = new Set(entityIds);
  next.delete(persona.entityId);
  return next;
}

const WORLD_PERSONA_KEY = 'FORMAMORPH_worldPersona';
const DEFAULT_PERSONA_KEY = 'FORMAMORPH_defaultPersona';
const worldPersonas = createKeyedRecordStore('local', WORLD_PERSONA_KEY);

const isPersonaRef = (value: unknown): value is PersonaRef => {
  if (typeof value !== 'object' || value === null) return false;
  const ref = value as Record<string, unknown>;
  if (ref.source === 'none') return true;
  return (ref.source === 'world' || ref.source === 'library') && typeof ref.entityId === 'string';
};

/** This world's last pick on this device, None included. */
export function readWorldPersona(worldId: string): PersonaRef | undefined {
  const stored = worldPersonas.read(worldId);
  return isPersonaRef(stored) ? stored : undefined;
}

export function rememberWorldPersona(worldId: string, ref: PersonaRef): void {
  worldPersonas.write(worldId, ref);
}

/** The global default persona's library id. Device-local, never exported. */
export function readDefaultPersona(): string | undefined {
  const stored = readStorageJson('local', DEFAULT_PERSONA_KEY);
  return typeof stored === 'string' && stored ? stored : undefined;
}

export function setDefaultPersona(entityId: string): void {
  writeStorageJson('local', DEFAULT_PERSONA_KEY, entityId);
}

export function clearDefaultPersona(): void {
  try {
    localStorage.removeItem(DEFAULT_PERSONA_KEY);
  } catch {
    // Blocked storage holds no default to clear.
  }
}
