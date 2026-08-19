import dagre from "@dagrejs/dagre";
import type { Connection, GameLocation } from "@/types";
import {
  CANVAS_GRID, CANVAS_NODE_HEIGHT, CANVAS_NODE_WIDTH, GROUP_HEADER, GROUP_PADDING,
  buildLocationCanvas,
} from "./locationCanvas";
import { pairKey } from "./locationGraph";
import { holderOf } from "./locationTree";

/**
 * Auto Arrange: the canvas's one automatic layout (ADR-0004), asked for by name rather than run behind the
 * author's back. It lays out what has structure and packs what does not — sub-locations joined by authored
 * Connections are laid out left→right in travel order, and every one of those clusters, along with every
 * unlinked sub-location, is packed into a compact wrapping block. The result comes back as ordinary
 * author-owned positions, on the grid, so an arranged layout and a hand-dragged one share the same rhythm.
 *
 * Scope is one group's *direct* children. A nested group is a single box here: whatever the author arranged
 * inside it is theirs, and only its frame moves and resizes around what it holds.
 */

/** The clearance the layout leaves between neighbors and between ranks — two grid cells, so the gaps read as
 *  part of the same rhythm the nodes land on. */
const ARRANGE_GAP = CANVAS_GRID * 2;

/** The shape the pack aims at: roughly a screen, so a large group arranges into a block an author can take in
 *  at one zoom rather than a ribbon running off either edge. */
const TARGET_ASPECT = 16 / 10;

const onGrid = (value: number) => Math.round(value / CANVAS_GRID) * CANVAS_GRID;

/** The near corner a group's children start from: clear of the frame and its title strip, and on the grid, so
 *  every position the layout writes is a multiple of the cell. */
const originFor = (groupId: string | null) => (groupId === null
  ? { x: 0, y: 0 }
  : { x: Math.ceil(GROUP_PADDING / CANVAS_GRID) * CANVAS_GRID, y: Math.ceil(GROUP_HEADER / CANVAS_GRID) * CANVAS_GRID });

interface Size { width: number; height: number }

/** One thing the packer places: a lone sub-location, or a whole cluster already laid out inside its own box.
 *  Members carry their offset from the box's near corner, so packing never has to know which it is holding. */
interface PackBox extends Size {
  members: { id: string; dx: number; dy: number }[];
}

/**
 * The pairs a layered layout can rank on: authored Connections with *both* ends among the children being
 * arranged. A link crossing the frame — group to its own child, or in from outside — says nothing about the
 * order of what is inside the box, so it is left out. One edge per pair, read in the world's own Connection
 * order and kept in the direction it was authored in even when travel is two-way, so reading order becomes
 * left→right order and the same world arranges the same way every time.
 */
function scopedEdges(connections: Connection[], inScope: Set<string>): [string, string][] {
  const seen = new Set<string>();
  const edges: [string, string][] = [];
  for (const connection of connections) {
    const { from, to } = connection;
    if (from === to || !inScope.has(from) || !inScope.has(to)) continue;
    const key = pairKey(from, to);
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push([from, to]);
  }
  return edges;
}

/**
 * Children split into connected components over those edges, in world order — members within a component, and
 * components by their earliest member, so a cluster ends up occupying the slot of the first of its places the
 * author listed.
 */
function componentsOf(ids: string[], edges: [string, string][]): string[][] {
  const parent = new Map(ids.map((id) => [id, id]));
  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root)!;
    for (let at = id; at !== root; ) {
      const next = parent.get(at)!;
      parent.set(at, root);
      at = next;
    }
    return root;
  };
  for (const [a, b] of edges) {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent.set(rootA, rootB);
  }
  const byRoot = new Map<string, string[]>();
  for (const id of ids) {
    const root = find(id);
    byRoot.set(root, [...(byRoot.get(root) ?? []), id]);
  }
  return [...byRoot.values()];
}

/**
 * A component as one box. A lone member is its own box with nothing to arrange; a linked component is handed
 * to dagre as a layered graph left→right, and what comes back is normalized to the box's near corner so the
 * cluster can be packed as a unit.
 */
function boxOf(
  members: string[],
  sizeOf: (id: string) => Size,
  edges: [string, string][],
): PackBox {
  if (members.length === 1) {
    const size = sizeOf(members[0]);
    return { ...size, members: [{ id: members[0], dx: 0, dy: 0 }] };
  }
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: "LR", nodesep: ARRANGE_GAP, ranksep: ARRANGE_GAP, marginx: 0, marginy: 0 });
  graph.setDefaultEdgeLabel(() => ({}));
  for (const id of members) graph.setNode(id, { ...sizeOf(id) });
  const inside = new Set(members);
  for (const [from, to] of edges) {
    if (inside.has(from) && inside.has(to)) graph.setEdge(from, to);
  }
  dagre.layout(graph);

  // dagre reports a node's center; the canvas stores the corner a box is drawn from.
  const laid = members.map((id) => {
    const node = graph.node(id);
    return { id, x: node.x - node.width / 2, y: node.y - node.height / 2, ...sizeOf(id) };
  });
  const left = Math.min(...laid.map((n) => n.x));
  const top = Math.min(...laid.map((n) => n.y));
  return {
    width: Math.max(...laid.map((n) => n.x + n.width)) - left,
    height: Math.max(...laid.map((n) => n.y + n.height)) - top,
    members: laid.map((n) => ({ id: n.id, dx: n.x - left, dy: n.y - top })),
  };
}

interface Packed {
  placed: { box: PackBox; x: number; y: number }[];
  width: number;
  height: number;
}

/** Boxes laid into rows that wrap at a width, in the order given. A box wider than the wrap width still starts
 *  a row of its own rather than being shrunk to fit. */
function shelfPack(boxes: PackBox[], wrapWidth: number): Packed {
  const placed: Packed["placed"] = [];
  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;
  let width = 0;
  for (const box of boxes) {
    if (cursorX > 0 && cursorX + box.width > wrapWidth) {
      cursorX = 0;
      cursorY += rowHeight + ARRANGE_GAP;
      rowHeight = 0;
    }
    placed.push({ box, x: cursorX, y: cursorY });
    cursorX += box.width + ARRANGE_GAP;
    rowHeight = Math.max(rowHeight, box.height);
    width = Math.max(width, cursorX - ARRANGE_GAP);
  }
  return { placed, width, height: cursorY + rowHeight };
}

/**
 * The packing whose block comes closest to screen-shaped. The candidates are the widths that fit exactly one,
 * two, three… boxes on the first row, which is every wrap that can change the result — boxes differ in size,
 * so a width computed from total area alone would round the wrong way on a small group and put four rooms in
 * one column. Ties go to the narrower block, so the choice is deterministic.
 */
function packBoxes(boxes: PackBox[]): Packed {
  let best: Packed | null = null;
  let bestScore = Infinity;
  let wrapWidth = -ARRANGE_GAP;
  for (const box of boxes) {
    wrapWidth += box.width + ARRANGE_GAP;
    const packed = shelfPack(boxes, wrapWidth);
    // Log-distance, so a block twice as wide as the target scores the same as one half as wide.
    const score = Math.abs(Math.log(packed.width / packed.height / TARGET_ASPECT));
    if (score < bestScore) {
      best = packed;
      bestScore = score;
    }
  }
  return best!;
}

/**
 * One group's direct children, laid out and written back. The top level is arranged by the same call, asked
 * for with no group.
 *
 * Authored Connections are the only thing the layered part is built from. The free travel containment hands
 * out runs between *every* pair of siblings, so it says nothing about which of them belong near which — handed
 * to a layered layout it puts each sibling in a column of its own and spreads a plain group across the canvas.
 * Siblings with no authored travel between them are therefore packed rather than ranked.
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
  const sizeOf = (id: string) =>
    sizeById.get(id) ?? { width: CANVAS_NODE_WIDTH, height: CANVAS_NODE_HEIGHT };

  const ids = children.map((c) => c.id);
  const edges = scopedEdges(connections, new Set(ids));
  const boxes = componentsOf(ids, edges).map((members) => boxOf(members, sizeOf, edges));
  const packed = packBoxes(boxes);

  // The block is carried back to the frame's near corner, so it never starts wherever dagre happened to
  // number from, and every position it writes lands on the grid.
  const origin = originFor(groupId);
  const placed = new Map<string, { x: number; y: number }>();
  for (const { box, x, y } of packed.placed) {
    for (const member of box.members) {
      placed.set(member.id, {
        x: origin.x + onGrid(x + member.dx),
        y: origin.y + onGrid(y + member.dy),
      });
    }
  }
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
