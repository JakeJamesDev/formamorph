import type { Connection, GameLocation } from "@/types";

/**
 * The location graph's rules (ADR-0002), as pure functions over plain world data.
 *
 * Two travel systems meet here. **Implicit navigation** is what containment gives away for free: a location
 * reaches its parent, its children, and its siblings — top-level locations are not siblings of each other.
 * **Connections** are authored links between any two locations, one-way or two-way. Where a Connection
 * exists between a pair, it *replaces* that pair's implicit link, so the Connection's own directions are all
 * the travel that remains for the pair. A world with no Connections therefore navigates exactly as it did
 * before the graph existed.
 */

/** Order-independent key for a pair of location ids — the identity a pair's implicit link is looked up by. */
export function pairKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}

/** Every pair the containment tree links for free: parent↔child, and sibling↔sibling under a real parent. */
export function implicitPairs(locations: GameLocation[]): [string, string][] {
  const byParent = new Map<string, GameLocation[]>();
  for (const loc of locations) {
    const parentId = loc.parentId ?? null;
    if (parentId === null) continue; // top-level locations share no parent, so they are not siblings
    const group = byParent.get(parentId);
    if (group) group.push(loc);
    else byParent.set(parentId, [loc]);
  }
  const pairs = new Map<string, [string, string]>();
  for (const [parentId, children] of byParent) {
    for (let i = 0; i < children.length; i++) {
      pairs.set(pairKey(children[i].id, parentId), [children[i].id, parentId]);
      for (let j = i + 1; j < children.length; j++) {
        pairs.set(pairKey(children[i].id, children[j].id), [children[i].id, children[j].id]);
      }
    }
  }
  return [...pairs.values()];
}

const authoredPairs = (connections: Connection[]) => new Set(connections.map((c) => pairKey(c.from, c.to)));

/** The implicit pairs an authored Connection has replaced — what an editor surface must show as no longer
 *  free, so an author narrowing travel to one way can see they did. */
export function overriddenPairs(locations: GameLocation[], connections: Connection[]): [string, string][] {
  const authored = authoredPairs(connections);
  return implicitPairs(locations).filter(([a, b]) => authored.has(pairKey(a, b)));
}

/** How a destination is reached: for free through containment, or across an authored Connection. */
export type DestinationVia = { via: "implicit" } | { via: "connection"; connection: Connection };

/**
 * Where travel from `id` can actually go: its surviving implicit neighbors plus the Connections leaving it
 * (a two-way Connection also leaves from its `to` end). Keyed by destination id, so a place reachable both
 * ways appears once — the Connection wins, since it carries the travel hint.
 */
export function effectiveDestinations(
  id: string,
  locations: GameLocation[],
  connections: Connection[],
): Map<string, DestinationVia> {
  const authored = authoredPairs(connections);
  const out = new Map<string, DestinationVia>();
  for (const [a, b] of implicitPairs(locations)) {
    if (authored.has(pairKey(a, b))) continue;
    if (a === id) out.set(b, { via: "implicit" });
    if (b === id) out.set(a, { via: "implicit" });
  }
  for (const connection of connections) {
    if (connection.from === id) out.set(connection.to, { via: "connection", connection });
    else if (connection.twoWay && connection.to === id) out.set(connection.from, { via: "connection", connection });
  }
  out.delete(id); // a self-link is authorable and reaches nowhere new
  return out;
}

/**
 * The ids a player can actually arrive at, walking the graph in its travel directions from every starting
 * location. Everything else is unreachable — a one-way trap or an orphaned island the author never linked.
 *
 * A world flagging no starting location starts anywhere at random, so every location is a start and nothing
 * is unreachable. Treating that as "no starts" would badge an entire ordinary world.
 */
export function reachableFromStarts(locations: GameLocation[], connections: Connection[]): Set<string> {
  // The whole graph's travel, gathered once before the walk: asking `effectiveDestinations` per visited
  // location rebuilds the sibling mesh each time, which large grouped worlds cannot afford.
  const authored = authoredPairs(connections);
  const adjacency = new Map<string, string[]>();
  const link = (from: string, to: string) => {
    const out = adjacency.get(from);
    if (out) out.push(to);
    else adjacency.set(from, [to]);
  };
  for (const [a, b] of implicitPairs(locations)) {
    if (authored.has(pairKey(a, b))) continue;
    link(a, b);
    link(b, a);
  }
  for (const connection of connections) {
    link(connection.from, connection.to);
    if (connection.twoWay) link(connection.to, connection.from);
  }

  const flagged = locations.filter((l) => l.isStarting);
  const seen = new Set((flagged.length ? flagged : locations).map((l) => l.id));
  const queue = [...seen];
  while (queue.length) {
    const id = queue.shift()!;
    for (const dest of adjacency.get(id) ?? []) {
      if (!seen.has(dest)) {
        seen.add(dest);
        queue.push(dest);
      }
    }
  }
  return seen;
}

/** `connections` minus every record touching `locationId` — run when a location is deleted, so no record is
 *  left pointing at a place that no longer exists. Returns the same array when nothing referenced it. */
export function dropLocationFromConnections(locationId: string, connections: Connection[]): Connection[] {
  if (!connections.some((c) => c.from === locationId || c.to === locationId)) return connections;
  return connections.filter((c) => c.from !== locationId && c.to !== locationId);
}
