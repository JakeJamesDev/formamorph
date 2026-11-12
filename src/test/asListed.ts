import type { Entity, GameLocation } from '@/types';
import { idsAt, positionsIn } from '@/lib/entityPlaces';
import { renderEntityRoster, type RosterOpts } from '@/lib/locationContext';

/** Where each test entity stands with no live positions: an entity with no kind at its own list. */
export const AS_LISTED = positionsIn({ positions: {}, generics: {} });

/** The ids of `entities` at `place` with no live positions. */
export const idsAsListed = (place: string | null | undefined, entities: readonly Entity[]): string[] => idsAt(place, entities, AS_LISTED);

/** The `<ENTITIES>` roster at `location` with no live positions, as the chip renders who stands there. */
export const rosterAsListed = (location: Pick<GameLocation, 'id' | 'name'>, entities: Entity[], opts: RosterOpts = {}): string =>
  renderEntityRoster(idsAsListed(location.id, entities), entities, opts);
