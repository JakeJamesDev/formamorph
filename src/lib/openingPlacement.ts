import type { Entity, OpeningPlacement } from "@/types";
import type { Standings } from "@/lib/entityPresence";
import { positionAmong, samplePlacement, type PlacesOf, type PlacesWorld } from "@/lib/entityPlaces";
import { genericPlaces } from "@/lib/positionEngine";
import type { RoutinePick } from "@/lib/entityKind";

/** The placement a game opens with, as the save stores it. */
export const placementOf = ({ positions, generics }: Standings): OpeningPlacement =>
  ({ positions: { ...positions }, genericPlaces: genericPlaces(generics) });

/** Where `cast` stood when the game opened: the stored placement, or for a save without one the Sample Placement at
 *  `start` under the Routine `pick` (Q18, Q33). */
export function openingPlacesOf(
  placement: OpeningPlacement | undefined, cast: readonly Entity[], world: PlacesWorld, start: string | undefined,
  pick?: RoutinePick,
): PlacesOf {
  if (!placement) return samplePlacement(cast, world, start, pick);
  return (entity) => positionAmong(entity, placement.positions, placement.genericPlaces);
}
