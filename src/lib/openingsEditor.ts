import { entityIdsAt } from '@/lib/entityPresence';
import { openingChances, openingPool, openingWeight, type OpeningOwner } from '@/lib/openings';
import { startCandidates } from '@/lib/startingLocation';
import type { Entity, GameLocation, Opening, WorldOverview } from '@/types';

/** One row as the world panel shows it. `chance` is a percentage of the described pool, or null for a row
 *  whose entity is not at the described starting location. */
export interface EditorOpeningRow {
  opening: Opening;
  weight: number;
  chance: number | null;
}

/** One owner's rows. `ownerId` is the entity's id, or null for the world's own. */
export interface EditorOpeningGroup {
  ownerId: string | null;
  name: string;
  rows: EditorOpeningRow[];
  /** The entity is at none of the world's starting locations, so its rows never come up. */
  atNoStart: boolean;
}

export interface OpeningsEditorView {
  /** The locations a new game may begin in, resolved as the start of play resolves them. */
  starts: GameLocation[];
  /** The start the chances describe, or null in a world with no locations. */
  describedStartId: string | null;
  groups: EditorOpeningGroup[];
}

export interface OpeningsEditorSources {
  overview: WorldOverview | null | undefined;
  entities: readonly Entity[];
  locations: readonly GameLocation[];
}

/**
 * Every opening in the world grouped by owner: the world's rows first, then each authored entity that has
 * openings, in cast order. A chance is the row's share of the whole pool at `startId`, falling back to the
 * first start. The switch is ignored, so a switched-off draft reads the odds it will have.
 */
export function openingsEditorView(
  { overview, entities, locations }: OpeningsEditorSources,
  startId?: string | null,
): OpeningsEditorView {
  const starts = startCandidates(locations);
  const describedStartId = starts.find((l) => l.id === startId)?.id ?? starts[0]?.id ?? null;
  const startIds = new Set(starts.map((l) => l.id));

  const pool = openingPool({
    overview: overview ? { ...overview, openingsEnabled: undefined } : overview,
    entities,
    startingLocationId: describedStartId,
  });
  const total = pool.reduce((sum, e) => sum + e.weight, 0);
  const present = new Set(entityIdsAt(describedStartId, [...entities]));

  const rowsOf = (owner: Pick<Entity, 'openings' | 'openingWeights'>, ownerId: string | null, drawn: boolean) =>
    (owner.openings ?? []).map((opening) => {
      const entry = pool.find((e) => e.ownerId === ownerId && e.opening.id === opening.id);
      return {
        opening,
        weight: openingWeight(owner.openingWeights, opening.id),
        chance: !drawn ? null : entry && total > 0 ? (entry.weight / total) * 100 : 0,
      };
    });

  return {
    starts,
    describedStartId,
    groups: [
      { ownerId: null, name: overview?.name ?? '', rows: rowsOf(overview ?? {}, null, true), atNoStart: false },
      ...entities.filter((e) => e.openings?.length).map((e) => ({
        ownerId: e.id,
        name: e.name,
        rows: rowsOf(e, e.id, present.has(e.id)),
        atNoStart: !e.locations?.some((id) => startIds.has(id)),
      })),
    ],
  };
}

/** One owner's rows with chances within its own list, for an entity's Openings tab. */
export function ownerOpeningRows(owner: OpeningOwner): EditorOpeningRow[] {
  const chances = openingChances(owner);
  return (owner.openings ?? []).map((opening) => ({
    opening,
    weight: openingWeight(owner.openingWeights, opening.id),
    chance: chances[opening.id] ?? 0,
  }));
}
