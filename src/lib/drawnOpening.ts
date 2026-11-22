import { DEFAULT_OPENING, openingName, type DrawnOpening } from './openings';
import type { SandboxOpening } from './statCodeExecutor';
import type { ResolveText, SandboxState } from './statCodeTurn';
import type { Entity, GameLocation, Opening, WorldOverview } from '@/types';

/** Which Opening a row is: its owner and its id, since ids repeat across owners. `ownerId` is the entity's
 *  id, or null for the world's and a location's rows; `locationId` is set on a location's rows only. */
export interface OpeningKey {
  ownerId: string | null;
  openingId: string;
  locationId?: string;
}

/** A Drawn Opening read against the live cast, with the owner tagged by what it is, or null for the world's own row. */
export interface ResolvedOpening {
  key: OpeningKey;
  opening: Opening;
  owner: { category: 'entity'; entity: Entity } | { category: 'location'; location: GameLocation } | null;
}

/** What a key resolves against: the world, the entities in play (world, picked library entities, the
 *  persona, the Custom Persona entity) and the locations. */
export interface DrawnOpeningSources {
  overview: WorldOverview | null | undefined;
  entities: readonly Entity[];
  locations: readonly GameLocation[];
}

/** A world's own sources: its overview, entities and locations, as the editor holds them. */
export const drawnOpeningSourcesOf = (world: { worldOverview?: WorldOverview | null; entities?: readonly Entity[]; locations?: readonly GameLocation[] }): DrawnOpeningSources =>
  ({ overview: world.worldOverview, entities: world.entities ?? [], locations: world.locations ?? [] });

/** The key a draw records, or null for the shipped default opening. */
export function drawnOpeningKey(draw: DrawnOpening): OpeningKey | null {
  if (draw.opening === DEFAULT_OPENING) return null;
  return {
    ownerId: draw.ownerId,
    openingId: draw.opening.id,
    ...(draw.locationId !== undefined && { locationId: draw.locationId }),
  };
}

export const sameOpeningKey = (a: OpeningKey | null, b: OpeningKey | null): boolean =>
  a === b || (!!a && !!b && a.ownerId === b.ownerId && a.openingId === b.openingId && a.locationId === b.locationId);

/** `value` as a key when it has the key's shape, else null. */
export function readOpeningKey(value: unknown): OpeningKey | null {
  if (!value || typeof value !== 'object') return null;
  const { ownerId, openingId, locationId } = value as Record<string, unknown>;
  if (typeof openingId !== 'string' || (ownerId !== null && typeof ownerId !== 'string')) return null;
  if (locationId !== undefined && (typeof locationId !== 'string' || ownerId !== null)) return null;
  return { ownerId, openingId, ...(locationId !== undefined && { locationId }) };
}

/** The Opening `key` names, or null when there is no key or its owner or Opening is gone. */
export function resolveDrawnOpening(key: OpeningKey | null | undefined, sources: DrawnOpeningSources): ResolvedOpening | null {
  if (!key) return null;
  const find = (openings: Opening[] | undefined) => openings?.find((o) => o.id === key.openingId);
  if (key.locationId !== undefined) {
    const location = sources.locations.find((l) => l.id === key.locationId);
    const opening = location && find(location.openings);
    return location && opening ? { key, opening, owner: { category: 'location', location } } : null;
  }
  if (key.ownerId !== null) {
    const entity = sources.entities.find((e) => e.id === key.ownerId);
    const opening = entity && find(entity.openings);
    return entity && opening ? { key, opening, owner: { category: 'entity', entity } } : null;
  }
  const opening = find(sources.overview?.openings);
  return opening ? { key, opening, owner: null } : null;
}

/** `resolved` as the `opening` global reads it, its text filled in by `fill` against its entity owner, or null. */
export function sandboxOpeningOf(
  resolved: ResolvedOpening | null, fill: (text: string, owner: Entity | null) => string,
): SandboxOpening | null {
  if (!resolved) return null;
  const { opening, owner } = resolved;
  return {
    id: opening.id, name: openingName(opening), kind: opening.kind, self: !!opening.self,
    time: opening.time ?? null, weather: opening.weather ?? null,
    text: fill(opening.text, owner?.category === 'entity' ? owner.entity : null),
    owner: owner && { category: owner.category, id: owner.category === 'entity' ? owner.entity.id : owner.location.id },
  };
}

/** `state` with `key` as its Drawn Opening, the text filled by the state's own resolver. */
export const withDrawnOpening = (state: SandboxState, key: OpeningKey | null | undefined, sources: DrawnOpeningSources): SandboxState => {
  const fill: ResolveText = state.resolveText ?? ((text) => text);
  return { ...state, opening: sandboxOpeningOf(resolveDrawnOpening(key, sources), fill) };
};
