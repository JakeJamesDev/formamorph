import { createKeyedRecordStore, readStorageJson, writeStorageJson } from './keyedStorage';
import type { AllowedPersonas, Entity, GameLocation, PersonaRef, StartPersona, WorldOverview } from '@/types';

/** Every Allowed Personas value, in the order the World Editor shows them. */
export const ALLOWED_PERSONAS: readonly AllowedPersonas[] = ['any', 'world'];

/** The world's Allowed Personas. An absent or unknown value is Any. */
export function worldAllowedPersonas(overview: Pick<WorldOverview, 'allowedPersonas'> | undefined): AllowedPersonas {
  const value = overview?.allowedPersonas;
  return value && ALLOWED_PERSONAS.includes(value) ? value : 'any';
}

/** The world's Starts On pick. An absent or malformed value is the player's default. */
export function worldStartPersona(overview: Pick<WorldOverview, 'startPersona'> | undefined): StartPersona | undefined {
  const value = overview?.startPersona;
  if (value?.source === 'none') return { source: 'none' };
  if (value?.source === 'world' && typeof value.entityId === 'string') return { source: 'world', entityId: value.entityId };
  return undefined;
}

/** The world's persona rules, as the pickers read them. */
export interface PersonaRules {
  allowed: AllowedPersonas;
  start: StartPersona | undefined;
}

export const worldPersonaRules = (overview: WorldOverview | undefined): PersonaRules =>
  ({ allowed: worldAllowedPersonas(overview), start: worldStartPersona(overview) });

/** World Only applies once the world has a persona or a Custom Persona; before that it works like Any. */
export const limitsToWorld = (allowed: AllowedPersonas, available: { world: readonly unknown[]; custom?: unknown }): boolean =>
  allowed === 'world' && (available.world.length > 0 || available.custom !== undefined);

/** What a picker lists under the world's Allowed Personas. */
export interface PersonaOffer<T> {
  world: T[];
  library: T[];
  /** The picker offers None. */
  none: boolean;
  /** The Custom Persona entity, which stands in None's place while None is offered. */
  custom?: T;
}

/** The personas a picker lists. World Only drops the library personas, and drops None unless the Custom
 *  Persona stands in its place. */
export function offeredPersonas<T>(allowed: AllowedPersonas, available: { world: T[]; library: T[]; custom?: T }): PersonaOffer<T> {
  const custom = available.custom ? { custom: available.custom } : {};
  if (limitsToWorld(allowed, available)) return { world: available.world, library: [], none: !!available.custom, ...custom };
  return { world: available.world, library: available.library, none: true, ...custom };
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
  rules: PersonaRules;
  /** This world's last pick on this device. */
  remembered: PersonaRef | undefined;
  /** The global default: a library entity id. */
  globalDefault: string | undefined;
  /** The persona ids the picker offers: the world's marked entities and the library personas, and whether a
   *  Custom Persona entity stands in None's place. */
  available: { world: string[]; library: string[]; custom?: boolean };
}

const NONE: PersonaRef = { source: 'none' };

/** The persona the picker starts on: the world's remembered pick, then the world's Starts On, then the default
 *  (the global default under Any, the first world persona under World Only), then None. A pick the picker does
 *  not offer falls through to the next rule. */
export function preselectPersona({ rules, remembered, globalDefault, available }: PersonaChoices): PersonaRef {
  const offer = offeredPersonas(rules.allowed, { ...available, custom: available.custom ? 'custom' : undefined });
  if (!hasPersonaChoice(offer)) return NONE;
  const offered = (ref: PersonaRef) => (ref.source === 'none' ? offer.none : offer[ref.source].includes(ref.entityId));
  if (remembered && offered(remembered)) return remembered;
  if (rules.start && offered(rules.start)) return rules.start;
  if (limitsToWorld(rules.allowed, offer)) return offer.world.length ? { source: 'world', entityId: offer.world[0] } : NONE;
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
