import type { Connection, GameLocation } from "@/types";
import { implicitPairs, overriddenPairs, pairKey, reachableFromStarts } from "./locationGraph";

/**
 * The canvas's mapping layer: world data in, node and edge descriptions out. Everything the map means lives
 * here as plain values, so the xyflow component stays a renderer with no rules of its own.
 *
 * The visual vocabulary: containment is a box around its children — a parent and its child never get a line,
 * because being inside the box *is* the free travel between them. Implicit sibling travel gets one dashed
 * arrow per direction. An authored Connection gets one solid arrow per travelable direction, and takes that
 * pair's implicit arrows off the map, since the Connection is now the pair's whole travel rule.
 */

/** A plain location node's footprint. Groups are measured around their children instead. */
export const CANVAS_NODE_WIDTH = 180;
export const CANVAS_NODE_HEIGHT = 52;
/** Clearance inside a group box: the title strip along its top, and the margin around what it holds. */
export const GROUP_HEADER = 36;
export const GROUP_PADDING = 20;
/** Gap between two auto-placed neighbors, and the row width they wrap at (about three plain nodes wide). */
const LAYOUT_GAP = 40;
const LAYOUT_ROW_WIDTH = 660;

export interface CanvasNodeData {
  /** The location's name as the author reads it (chips resolved by the caller's resolver). */
  label: string;
  isStarting: boolean;
  /** No starting location can reach here — a one-way trap or an island the author never linked. */
  unreachable: boolean;
}

export interface CanvasNode {
  id: string;
  /** `locationGroup` holds sub-locations; `location` is a leaf box. */
  type: "locationGroup" | "location";
  /** Relative to the parent box when nested, as xyflow reads a child node's position. */
  position: { x: number; y: number };
  parentId?: string;
  width: number;
  height: number;
  data: CanvasNodeData;
}

export type CanvasEdgeKind = "implicit" | "connection";

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  kind: CanvasEdgeKind;
  /** The travel hint, on the direction the Connection was authored in — one label per record, not per arrow. */
  label?: string;
  /** The Connection this arrow came from, so selecting an arrow can reach its record. */
  connectionId?: string;
}

export interface LocationCanvasMap {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

/**
 * World → the map. Nodes come out parents-first (xyflow resolves a nested position against a parent it has
 * already seen), and each group is sized around the children it holds.
 */
export function buildLocationCanvas(
  locations: GameLocation[],
  connections: Connection[],
  opts: { resolveName?: (location: GameLocation) => string } = {},
): LocationCanvasMap {
  const resolveName = opts.resolveName ?? ((location: GameLocation) => location.name);
  const known = new Set(locations.map((l) => l.id));
  // A parent id pointing at a location that isn't here would strand its children off the map.
  const parentOf = (loc: GameLocation) => (loc.parentId && known.has(loc.parentId) ? loc.parentId : null);
  const childrenOf = new Map<string | null, GameLocation[]>();
  for (const loc of locations) {
    const parent = parentOf(loc);
    childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), loc]);
  }

  const reachable = reachableFromStarts(locations, connections);

  // Sizes and default placements are one bottom-up pass: a location is as large as the children it holds,
  // and an unplaced child is flowed past its siblings' real sizes — a fixed grid would leave a wide group
  // sitting on top of whatever came next.
  const positionById = new Map<string, { x: number; y: number }>();
  const sizeById = new Map<string, { width: number; height: number }>();

  const flow = (children: GameLocation[], nested: boolean) => {
    const originX = nested ? GROUP_PADDING : 0;
    const originY = nested ? GROUP_HEADER : 0;
    let right = originX + CANVAS_NODE_WIDTH;
    let bottom = originY + CANVAS_NODE_HEIGHT;
    const stretch = (at: { x: number; y: number }, size: { width: number; height: number }) => {
      right = Math.max(right, at.x + size.width);
      bottom = Math.max(bottom, at.y + size.height);
    };
    // Author-placed siblings are laid down first and hold their ground; the rest flow in beneath them, so a
    // location added years later can't land on top of an arrangement someone made by hand.
    const unplaced: GameLocation[] = [];
    for (const child of children) {
      const size = measure(child);
      if (!child.canvasPosition) {
        unplaced.push(child);
        continue;
      }
      positionById.set(child.id, child.canvasPosition);
      stretch(child.canvasPosition, size);
    }
    let cursorX = originX;
    let cursorY = unplaced.length < children.length ? bottom + LAYOUT_GAP : originY;
    let rowHeight = 0;
    for (const child of unplaced) {
      const size = measure(child);
      if (cursorX > originX && cursorX + size.width > originX + LAYOUT_ROW_WIDTH) {
        cursorX = originX;
        cursorY += rowHeight + LAYOUT_GAP;
        rowHeight = 0;
      }
      const at = { x: cursorX, y: cursorY };
      cursorX += size.width + LAYOUT_GAP;
      rowHeight = Math.max(rowHeight, size.height);
      positionById.set(child.id, at);
      stretch(at, size);
    }
    return { right, bottom };
  };

  function measure(loc: GameLocation): { width: number; height: number } {
    const cached = sizeById.get(loc.id);
    if (cached) return cached;
    const children = childrenOf.get(loc.id) ?? [];
    let size = { width: CANVAS_NODE_WIDTH, height: CANVAS_NODE_HEIGHT };
    if (children.length) {
      const bounds = flow(children, true);
      size = { width: bounds.right + GROUP_PADDING, height: bounds.bottom + GROUP_PADDING };
    }
    sizeById.set(loc.id, size);
    return size;
  }

  flow(childrenOf.get(null) ?? [], false);

  const nodes: CanvasNode[] = [];
  const emit = (parent: string | null) => {
    (childrenOf.get(parent) ?? []).forEach((loc) => {
      const children = childrenOf.get(loc.id) ?? [];
      nodes.push({
        id: loc.id,
        type: children.length ? "locationGroup" : "location",
        position: positionById.get(loc.id) ?? { x: 0, y: 0 },
        ...(parent === null ? {} : { parentId: parent }),
        ...measure(loc),
        data: {
          label: resolveName(loc),
          isStarting: !!loc.isStarting,
          unreachable: !reachable.has(loc.id),
        },
      });
      emit(loc.id); // children follow their parent, so xyflow never meets one first
    });
  };
  emit(null);

  const byId = new Map(locations.map((l) => [l.id, l]));
  const parentChild = (a: string, b: string) =>
    parentOf(byId.get(a)!) === b || parentOf(byId.get(b)!) === a;
  const overridden = new Set(overriddenPairs(locations, connections).map(([a, b]) => pairKey(a, b)));

  const edges: CanvasEdge[] = [];
  for (const [a, b] of implicitPairs(locations)) {
    if (parentChild(a, b)) continue; // containment already draws this: the child sits in the box
    if (overridden.has(pairKey(a, b))) continue; // the Connection's arrows stand in its place
    edges.push({ id: `implicit:${a}>${b}`, source: a, target: b, kind: "implicit" });
    edges.push({ id: `implicit:${b}>${a}`, source: b, target: a, kind: "implicit" });
  }
  for (const connection of connections) {
    if (!known.has(connection.from) || !known.has(connection.to)) continue;
    edges.push({
      id: `connection:${connection.id}:forward`,
      source: connection.from,
      target: connection.to,
      kind: "connection",
      connectionId: connection.id,
      ...(connection.aiHint ? { label: connection.aiHint } : {}),
    });
    if (connection.twoWay) {
      edges.push({
        id: `connection:${connection.id}:back`,
        source: connection.to,
        target: connection.from,
        kind: "connection",
        connectionId: connection.id,
      });
    }
  }
  return { nodes, edges };
}

/**
 * A dragged node's resting place, written onto its location. Whole pixels — a drag is not sub-pixel work.
 *
 * A sub-location's position is measured inside its parent's box, so it is held clear of the frame and the
 * title strip: dragged past either, it would render outside the box that says it is in there. Nothing holds
 * it back on the other sides — the box grows to whatever it now has to hold.
 */
export function withCanvasPosition(
  locations: GameLocation[],
  id: string,
  position: { x: number; y: number },
): GameLocation[] {
  const target = locations.find((l) => l.id === id);
  if (!target) return locations;
  const nested = !!target.parentId && locations.some((l) => l.id === target.parentId);
  const canvasPosition = {
    x: Math.round(nested ? Math.max(position.x, GROUP_PADDING) : position.x),
    y: Math.round(nested ? Math.max(position.y, GROUP_HEADER) : position.y),
  };
  return locations.map((l) => (l.id === id ? { ...l, canvasPosition } : l));
}
