import type { GameLocation } from "@/types";
import { UNNAMED_LOCATION } from "./locationCanvas";
import { holderOf } from "./locationTree";

/**
 * Finding a location by name on a map too big to read at a glance. Matching is a plain value here so the
 * canvas can stay a renderer: what counts as a match, how the matches are ordered, and what each one is
 * called are all decided without mounting anything.
 *
 * Nesting is not a filter — a location inside three boxes is as findable as one standing on its own. Where it
 * sits comes back with it as `path`, because on a big map two rooms called "Cellar" are told apart only by
 * the boxes holding them.
 */

export interface LocationMatch {
  id: string;
  /** The location's name as the author reads it. */
  label: string;
  /** The boxes holding it, outermost first. Empty for a top-level location. */
  path: string[];
}

/** How many matches the picker offers before an author is better off typing more. */
export const SEARCH_LIMIT = 8;

/** Best first: the whole name, then a name starting with it, then a word starting with it, then anywhere. */
function rankOf(label: string, query: string): number | null {
  const name = label.toLowerCase();
  const at = name.indexOf(query);
  if (at < 0) return null;
  if (name === query) return 0;
  if (at === 0) return 1;
  // A word boundary: "Old Mill" is a better answer for "mill" than "Windmills" is.
  return /[\s\-_(),.:]/.test(name[at - 1]) ? 2 : 3;
}

/**
 * The locations a query names, best match first. An empty or blank query names nothing rather than
 * everything — a list of every location in the world is the map itself, which the author is already looking at.
 */
export function searchLocations(
  locations: GameLocation[],
  query: string,
  opts: { resolveName?: (location: GameLocation) => string; limit?: number } = {},
): LocationMatch[] {
  const wanted = query.trim().toLowerCase();
  if (!wanted) return [];
  const resolveName = opts.resolveName ?? ((location: GameLocation) => location.name);
  const nameOf = new Map(locations.map((l) => [l.id, resolveName(l) || UNNAMED_LOCATION]));
  const byId = new Map(locations.map((l) => [l.id, l]));

  const pathOf = (location: GameLocation): string[] => {
    const names: string[] = [];
    const seen = new Set<string>([location.id]);
    for (let at = location; ;) {
      const parentId = holderOf(locations, at);
      // A cycle in the tree would otherwise walk forever; the world can hold one between two saves.
      if (!parentId || seen.has(parentId)) break;
      seen.add(parentId);
      const parent = byId.get(parentId)!; // holderOf only names a parent that is here
      names.unshift(nameOf.get(parent.id)!);
      at = parent;
    }
    return names;
  };

  return locations
    .map((location) => {
      const label = nameOf.get(location.id)!;
      const rank = rankOf(label, wanted);
      return rank === null ? null : { rank, match: { id: location.id, label, path: pathOf(location) } };
    })
    .filter((scored): scored is { rank: number; match: LocationMatch } => scored !== null)
    .sort((a, b) => a.rank - b.rank || a.match.label.localeCompare(b.match.label))
    .slice(0, opts.limit ?? SEARCH_LIMIT)
    .map((scored) => scored.match);
}
