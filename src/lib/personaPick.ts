import { createKeyedRecordStore, readStorageJson, writeStorageJson } from './keyedStorage';
import type { PersonaRef } from '@/types';

/** Who a world lets the player be. Only Open exists until the world gains its player setting. */
export type WorldPlayerSetting = 'open';

/** The inputs of the preselect rule, shared by the enter-world step and Quick Start. */
export interface PersonaChoices {
  playerSetting: WorldPlayerSetting;
  /** This world's last pick on this device. */
  remembered: PersonaRef | undefined;
  /** The global default: a library entity id. */
  globalDefault: string | undefined;
  /** The persona ids the picker offers. */
  available: { library: string[] };
}

const NONE: PersonaRef = { source: 'none' };

/** The persona the picker starts on: the world's remembered pick, then the global default, then None. A pick
 *  that names an entity the picker does not offer falls through to the next rule. */
export function preselectPersona({ remembered, globalDefault, available }: PersonaChoices): PersonaRef {
  const offered = (ref: PersonaRef) => ref.source === 'none' || (ref.source === 'library' && available.library.includes(ref.entityId));
  if (available.library.length === 0) return NONE;
  if (remembered && offered(remembered)) return remembered;
  if (globalDefault && available.library.includes(globalDefault)) return { source: 'library', entityId: globalDefault };
  return NONE;
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
