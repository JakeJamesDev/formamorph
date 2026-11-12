import type { Connection } from '@/types';
import type { EntityPresence } from '@/lib/presence';
import { numbered } from '@/lib/presence';
import { nearbyPlaces, type LocationLink } from '@/lib/locationGraph';

/** What the Map shows at one place: the names the player has heard, then how many entries stay unknown. */
export interface MapPlace {
  /** True names first, then stranger labels, each in cast order. A repeated entry takes a count. */
  named: string[];
  unknown: number;
}

/** Location id → what the Map shows there. A place with nothing to show has no key. */
export type MapRoster = Readonly<Record<string, MapPlace>>;

/**
 * The Map's roster: every cast entity at each place it stands. The player's place and its Nearby places show
 * an unmet stranger under its stranger label; every other place counts it as unknown. An unmet entity with
 * no label is unknown everywhere. A stranger's true name never enters the output before it is met.
 */
export function mapRoster(
  presence: Iterable<EntityPresence>,
  playerPlace: string | null | undefined,
  locations: readonly LocationLink[],
  connections: readonly Connection[],
): MapRoster {
  const reach = new Set<string>(playerPlace ? [playerPlace, ...nearbyPlaces(playerPlace, locations, connections)] : []);
  const names: Record<string, string[]> = {};
  const labels: Record<string, string[]> = {};
  const unknown: Record<string, number> = {};
  for (const { entity, position, known, label } of presence) {
    for (const at of position) {
      if (known) (names[at] ??= []).push(entity.name);
      else if (label && reach.has(at)) (labels[at] ??= []).push(label);
      else unknown[at] = (unknown[at] ?? 0) + 1;
    }
  }
  const roster: Record<string, MapPlace> = {};
  for (const at of new Set([...Object.keys(names), ...Object.keys(labels), ...Object.keys(unknown)])) {
    const named = numbered([...(names[at] ?? []), ...(labels[at] ?? [])].map((label) => ({ label }))).map((n) => n.label);
    roster[at] = { named, unknown: unknown[at] ?? 0 };
  }
  return roster;
}
