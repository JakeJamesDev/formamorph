import type { Connection, ConnectionLeg, GameLocation, LegKey } from "@/types";

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

/** The fields of a location the graph reads. */
export type LocationLink = Pick<GameLocation, "id" | "parentId">;

/** Order-independent key for a pair of location ids — the identity a pair's implicit link is looked up by. */
export function pairKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}

/** Who contains whom, built in one pass over the world so a location's implicit neighbors cost its own
 *  degree, not the world's sibling pairs. A parent id counts even when no location carries it. */
export interface ParentIndex {
  parentOf: Map<string, string>;
  childrenOf: Map<string, string[]>;
}

export function parentIndex(locations: readonly LocationLink[]): ParentIndex {
  const parentOf = new Map<string, string>();
  const childrenOf = new Map<string, string[]>();
  for (const loc of locations) {
    const parentId = loc.parentId ?? null;
    if (parentId === null) continue; // top-level locations share no parent, so they are not siblings
    parentOf.set(loc.id, parentId);
    const group = childrenOf.get(parentId);
    if (group) group.push(loc.id);
    else childrenOf.set(parentId, [loc.id]);
  }
  return { parentOf, childrenOf };
}

/** The ids the containment tree links to `id` for free: its parent, its children, and its siblings. */
export function implicitNeighbors(id: string, { parentOf, childrenOf }: ParentIndex): string[] {
  const out = new Set<string>(childrenOf.get(id));
  const parentId = parentOf.get(id);
  if (parentId !== undefined) {
    out.add(parentId);
    for (const sibling of childrenOf.get(parentId) ?? []) if (sibling !== id) out.add(sibling);
  }
  return [...out];
}

/** Whether the containment tree links `a` and `b` for free, in one probe. */
export function isImplicitPair({ parentOf }: ParentIndex, a: string, b: string): boolean {
  if (a === b) return parentOf.get(a) === a; // only a location that names itself its parent pairs with itself
  const parentA = parentOf.get(a);
  return parentA === b || parentOf.get(b) === a || (parentA !== undefined && parentA === parentOf.get(b));
}

/** Every pair the containment tree links for free: parent↔child, and sibling↔sibling under a real parent. */
export function implicitPairs(locations: GameLocation[]): [string, string][] {
  const pairs = new Map<string, [string, string]>();
  for (const [parentId, children] of parentIndex(locations).childrenOf) {
    for (let i = 0; i < children.length; i++) {
      pairs.set(pairKey(children[i], parentId), [children[i], parentId]);
      for (let j = i + 1; j < children.length; j++) {
        pairs.set(pairKey(children[i], children[j]), [children[i], children[j]]);
      }
    }
  }
  return [...pairs.values()];
}

/** One travelable direction of a Connection, with the ends it runs between. */
export interface ConnectionLegView {
  key: LegKey;
  from: string;
  to: string;
  leg: ConnectionLeg;
}

/** The other direction of a Connection. */
export const otherLeg = (key: LegKey): LegKey => (key === "aToB" ? "bToA" : "aToB");

/** Travel runs both ways. */
export const isTwoWay = (connection: Connection): boolean => !!connection.aToB && !!connection.bToA;

/** A Connection's present legs, `a → b` first. */
export function connectionLegs(connection: Connection): ConnectionLegView[] {
  const legs: ConnectionLegView[] = [];
  if (connection.aToB) legs.push({ key: "aToB", from: connection.a, to: connection.b, leg: connection.aToB });
  if (connection.bToA) legs.push({ key: "bToA", from: connection.b, to: connection.a, leg: connection.bToA });
  return legs;
}

/** A Connection's ends in travel order: `a → b`, unless travel runs only `b → a`. */
export function travelEnds(connection: Connection): [string, string] {
  return connection.bToA && !connection.aToB ? [connection.b, connection.a] : [connection.a, connection.b];
}

const authoredPairs = (connections: readonly Connection[]) => new Set(connections.map((c) => pairKey(c.a, c.b)));

/** The implicit pairs an authored Connection has replaced — what an editor surface must show as no longer
 *  free, so an author narrowing travel to one way can see they did. */
export function overriddenPairs(locations: GameLocation[], connections: Connection[]): [string, string][] {
  const index = parentIndex(locations);
  const out = new Map<string, [string, string]>();
  for (const { a, b } of connections) {
    if (isImplicitPair(index, a, b)) out.set(pairKey(a, b), [a, b]);
  }
  return [...out.values()];
}

/** How a destination is reached: for free through containment, or across an authored Connection. */
export type DestinationVia =
  | { via: "implicit" }
  | { via: "connection"; connection: Connection; leg: ConnectionLeg };

/**
 * Where travel from `id` can actually go: its surviving implicit neighbors plus the Connection legs leaving
 * it. Keyed by destination id, so a place reachable both ways appears once — the Connection wins, since its
 * leg carries the travel hint.
 */
export function effectiveDestinations(
  id: string,
  locations: readonly LocationLink[],
  connections: readonly Connection[],
): Map<string, DestinationVia> {
  return destinationsIn(id, parentIndex(locations), authoredPairs(connections), connections);
}

/** {@link effectiveDestinations} over a prebuilt index, so a walk builds it once. */
function destinationsIn(
  id: string, index: ParentIndex, authored: Set<string>, connections: readonly Connection[],
): Map<string, DestinationVia> {
  const out = new Map<string, DestinationVia>();
  for (const other of implicitNeighbors(id, index)) {
    if (!authored.has(pairKey(id, other))) out.set(other, { via: "implicit" });
  }
  for (const connection of connections) {
    for (const { from, to, leg } of connectionLegs(connection)) {
      if (from === id) out.set(to, { via: "connection", connection, leg });
    }
  }
  out.delete(id); // a self-link is authorable and reaches nowhere new
  return out;
}

/** The pair is Far: no pull reach or context across it. */
export const isFar = (connection: Connection): boolean => connection.distance === "far";

const farPairs = (connections: readonly Connection[]) =>
  new Set(connections.flatMap((c) => (isFar(c) ? [pairKey(c.a, c.b)] : [])));

/**
 * The places one Nearby link from `id`: its implicit neighbors (parent, children, siblings) and the other
 * end of every Connection touching it, in either direction. A Far Connection drops its pair, including the
 * implicit link it replaces. Never chained.
 */
export function nearbyPlaces(
  id: string,
  locations: readonly LocationLink[],
  connections: readonly Connection[],
): string[] {
  const far = farPairs(connections);
  const out = new Set<string>(implicitNeighbors(id, parentIndex(locations)));
  for (const { a, b } of connections) {
    if (a === id) out.add(b);
    if (b === id) out.add(a);
  }
  out.delete(id);
  return [...out].filter((other) => !far.has(pairKey(id, other)));
}

/** How far a router or narrated move may carry the player in one turn. */
export const WALK_MOVE_CAP = 3;

/** One place a walk from the start reaches, and the shortest way there. */
export interface WalkStep {
  id: string;
  /** How many moves the walk takes, from 1. */
  moves: number;
  /** The places passed through on the way, in walk order. Empty for a one-move place. */
  route: string[];
  /** How the first move is made. For a one-move place, how the whole trip is made. */
  via: DestinationVia;
}

/**
 * Every place reachable from `id` in up to {@link WALK_MOVE_CAP} moves, each move one of the effective destinations of the
 * place it leaves, so one-way legs stay one-way. Nearest first, in walk order; the first shortest route wins.
 */
export function walkableReach(
  id: string,
  locations: readonly LocationLink[],
  connections: readonly Connection[],
): WalkStep[] {
  const index = parentIndex(locations);
  const authored = authoredPairs(connections);
  const steps: WalkStep[] = [];
  const seen = new Set([id]);
  let frontier: WalkStep[] = [{ id, moves: 0, route: [], via: { via: "implicit" } }];
  for (let moves = 1; moves <= WALK_MOVE_CAP && frontier.length; moves++) {
    const next: WalkStep[] = [];
    for (const from of frontier) {
      for (const [to, via] of destinationsIn(from.id, index, authored, connections)) {
        if (seen.has(to)) continue;
        seen.add(to);
        const step = moves === 1
          ? { id: to, moves, route: [], via }
          : { id: to, moves, route: [...from.route, from.id], via: from.via };
        next.push(step);
      }
    }
    steps.push(...next);
    frontier = next;
  }
  return steps;
}

/**
 * The ids a player can actually arrive at, walking the graph in its travel directions from every starting
 * location. Everything else is unreachable — a one-way trap or an orphaned island the author never linked.
 *
 * A world flagging no starting location starts anywhere at random, so every location is a start and nothing
 * is unreachable. Treating that as "no starts" would badge an entire ordinary world.
 */
export function reachableFromStarts(locations: GameLocation[], connections: Connection[]): Set<string> {
  const flagged = locations.filter((l) => l.isStarting);
  return reachableFrom((flagged.length ? flagged : locations).map((l) => l.id), locations, connections);
}

/** The ids travel can reach from any of `starts` through any path, in travel directions. Holds `starts`. */
export function reachableFrom(
  starts: readonly string[], locations: readonly LocationLink[], connections: readonly Connection[],
): Set<string> {
  const authored = authoredPairs(connections);
  const { parentOf, childrenOf } = parentIndex(locations);
  const legs = new Map<string, string[]>();
  for (const connection of connections) {
    for (const { from, to } of connectionLegs(connection)) {
      const out = legs.get(from);
      if (out) out.push(to);
      else legs.set(from, [to]);
    }
  }

  const seen = new Set(starts);
  const queue = [...seen];
  const visit = (id: string) => {
    if (!seen.has(id)) {
      seen.add(id);
      queue.push(id);
    }
  };
  // Siblings are a clique minus the overridden pairs, so each parent keeps the siblings no visit has claimed
  // yet. A visit claims all it can link to and skips only the few overridden pairs: the walk stays linear
  // in the children, where visiting every sibling's full sibling list would be quadratic.
  const unclaimed = new Map<string, Set<string>>();
  for (let next = 0; next < queue.length; next++) {
    const id = queue[next];
    for (const to of legs.get(id) ?? []) visit(to);
    for (const child of childrenOf.get(id) ?? []) {
      if (!authored.has(pairKey(id, child))) visit(child);
    }
    const parentId = parentOf.get(id);
    if (parentId === undefined) continue;
    if (!authored.has(pairKey(id, parentId))) visit(parentId);
    let group = unclaimed.get(parentId);
    if (!group) unclaimed.set(parentId, (group = new Set(childrenOf.get(parentId))));
    for (const sibling of group) {
      if (seen.has(sibling)) group.delete(sibling);
      else if (!authored.has(pairKey(id, sibling))) {
        group.delete(sibling);
        visit(sibling);
      }
    }
  }
  return seen;
}

/** `connections` minus every record touching `locationId` — run when a location is deleted, so no record is
 *  left pointing at a place that no longer exists. Returns the same array when nothing referenced it. */
export function dropLocationFromConnections(locationId: string, connections: Connection[]): Connection[] {
  if (!connections.some((c) => c.a === locationId || c.b === locationId)) return connections;
  return connections.filter((c) => c.a !== locationId && c.b !== locationId);
}
