import type { Connection } from '@/types';
import type { EntityPresence } from '@/lib/presence';
import { numbered } from '@/lib/presence';
import { onMapOf, shownOnMap } from '@/lib/onMap';
import { nearbyPlaces, type LocationLink } from '@/lib/locationGraph';

/** What the Map shows at one place: the names the player has heard, then how many entries stay unknown. */
export interface MapPlace {
  /** True names first, then stranger labels, each in cast order. A repeated entry takes a count. */
  named: string[];
  unknown: number;
}

/** Location id → what the Map shows there. A place with nothing to show has no key. */
export type MapRoster = Readonly<Record<string, MapPlace>>;

/** The places where the Map names an unmet stranger: the player's place and its Nearby places. Empty with no place. */
export function mapReach(
  playerPlace: string | null | undefined,
  locations: readonly LocationLink[],
  connections: readonly Connection[],
): ReadonlySet<string> {
  return new Set(playerPlace ? [playerPlace, ...nearbyPlaces(playerPlace, locations, connections)] : []);
}

/**
 * The Map's roster: every cast entity at each place it stands, after its On Map. Inside `reach` an unmet stranger
 * shows under its stranger label; every other place counts it as unknown. An unmet entity with no label is
 * unknown everywhere. A stranger's true name never enters the output before it is met.
 */
export function mapRoster(presence: Iterable<EntityPresence>, reach: ReadonlySet<string>): MapRoster {
  const names: Record<string, string[]> = {};
  const labels: Record<string, string[]> = {};
  const unknown: Record<string, number> = {};
  for (const { entity, position, known, label } of presence) {
    const onMap = onMapOf(entity);
    for (const at of position) {
      const inReach = reach.has(at);
      if (!shownOnMap(onMap, known, inReach)) continue;
      if (known) (names[at] ??= []).push(entity.name);
      else if (label && inReach) (labels[at] ??= []).push(label);
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
