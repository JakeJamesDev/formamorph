import dagre from "@dagrejs/dagre";
import type { Connection, GameLocation } from "@/types";
import {
  CANVAS_GRID, CANVAS_NODE_HEIGHT, CANVAS_NODE_WIDTH, GROUP_HEADER, GROUP_PADDING,
  buildLocationCanvas, holderOf,
} from "./locationCanvas";
import { pairKey } from "./locationGraph";

/**
 * Auto Arrange: the canvas's one automatic layout (ADR-0004), asked for by name rather than run behind the
 * author's back. A group's direct children are handed to dagre as a layered graph over the travel the map
 * already draws, and the result comes back as ordinary author-owned positions — on the grid, so an arranged
 * layout and a hand-dragged one share the same rhythm.
 *
 * Scope is one group's *direct* children. A nested group is a single box here: whatever the author arranged
 * inside it is theirs, and only its frame moves and resizes around what it holds.
 */

/** The clearance the layout leaves between neighbors and between ranks — two grid cells, so the gaps read as
 *  part of the same rhythm the nodes land on. */
const ARRANGE_GAP = CANVAS_GRID * 2;

const onGrid = (value: number) => Math.round(value / CANVAS_GRID) * CANVAS_GRID;

/** The near corner a group's children start from: clear of the frame and its title strip, and on the grid, so
 *  every position the layout writes is a multiple of the cell. */
const originFor = (groupId: string | null) => (groupId === null
  ? { x: 0, y: 0 }
  : { x: Math.ceil(GROUP_PADDING / CANVAS_GRID) * CANVAS_GRID, y: Math.ceil(GROUP_HEADER / CANVAS_GRID) * CANVAS_GRID });

/**
 * One group's direct children, laid out and written back. The top level is arranged by the same call, asked
 * for with no group.
 *
 * Authored Connections are what the layers are built from. The free travel containment hands out runs between
 * *every* pair of siblings, so it says nothing about which of them belong near which — handed to a layered
 * layout it puts each sibling in a rank of its own and spreads a plain group across the canvas. Siblings with
 * no authored travel between them therefore share a rank, and a Connection is what pulls two of them apart
 * into the order it is traveled in.
 *
 * Returns the same array when there is nothing to arrange, so a menu action on a leaf writes no world.
 */
export function autoArrange(
  locations: GameLocation[],
  connections: Connection[],
  groupId: string | null,
): GameLocation[] {
  const children = locations.filter((l) => holderOf(locations, l) === groupId);
  if (!children.length) return locations;

  const map = buildLocationCanvas(locations, connections);
  const sizeById = new Map(map.nodes.map((n) => [n.id, { width: n.width, height: n.height }]));

  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: "LR", nodesep: ARRANGE_GAP, ranksep: ARRANGE_GAP, marginx: 0, marginy: 0 });
  graph.setDefaultEdgeLabel(() => ({}));
  for (const child of children) {
    graph.setNode(child.id, sizeById.get(child.id) ?? { width: CANVAS_NODE_WIDTH, height: CANVAS_NODE_HEIGHT });
  }
  // One edge per pair: the map draws an arrow per travelable direction, and a rank order is a property of the
  // pair rather than of either arrow. Reading them in the map's own order keeps the same world arranging the
  // same way every time.
  const inScope = new Set(children.map((c) => c.id));
  const seen = new Set<string>();
  for (const edge of map.edges) {
    if (edge.kind !== "connection") continue;
    if (!inScope.has(edge.source) || !inScope.has(edge.target)) continue;
    const key = pairKey(edge.source, edge.target);
    if (seen.has(key)) continue;
    seen.add(key);
    graph.setEdge(edge.source, edge.target);
  }
  dagre.layout(graph);

  // dagre reports a node's center; the canvas stores the corner it is drawn from, against whichever frame
  // holds it. The whole layout is then carried back to that frame's near corner, so it never starts wherever
  // dagre happened to number from.
  const laid = children.map((child) => {
    const node = graph.node(child.id);
    return { id: child.id, x: node.x - node.width / 2, y: node.y - node.height / 2 };
  });
  const left = Math.min(...laid.map((n) => n.x));
  const top = Math.min(...laid.map((n) => n.y));
  const origin = originFor(groupId);
  const placed = new Map(laid.map((n) => [n.id, {
    x: origin.x + onGrid(n.x - left),
    y: origin.y + onGrid(n.y - top),
  }]));
  return locations.map((l) => (placed.has(l.id) ? { ...l, canvasPosition: placed.get(l.id)! } : l));
}

/**
 * Every group and the top level, arranged in one pass. Deepest first: a group's frame is measured around the
 * children it holds, so laying the innermost out first means every box its parent arranges is already the
 * size it will finally be drawn at.
 */
export function autoArrangeAll(locations: GameLocation[], connections: Connection[]): GameLocation[] {
  const byId = new Map(locations.map((l) => [l.id, l]));
  const depthOf = (loc: GameLocation) => {
    let depth = 0;
    for (let at = loc; holderOf(locations, at); depth += 1) at = byId.get(holderOf(locations, at)!)!;
    return depth;
  };
  const groups = locations
    .filter((loc) => locations.some((l) => holderOf(locations, l) === loc.id))
    .sort((a, b) => depthOf(b) - depthOf(a))
    .map((loc) => loc.id);
  return [...groups, null].reduce(
    (world, id) => autoArrange(world, connections, id),
    locations,
  );
}
