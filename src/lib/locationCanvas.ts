import type { Connection, GameLocation } from "@/types";
import {
  createConnection, directionFrom, withDirection, withHint, type ConnectionDirection,
} from "./connectionEditing";
import { implicitPairs, overriddenPairs, pairKey, reachableFromStarts } from "./locationGraph";
import { isDescendantLocation } from "./locationTree";

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

/** The box a location actually sits in. A parent id pointing at a location that isn't here would strand its
 *  children off the map, so an unknown one reads as top-level. */
function heldBy(locations: GameLocation[], loc: GameLocation): string | null {
  return loc.parentId && locations.some((l) => l.id === loc.parentId) ? loc.parentId : null;
}

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
  const parentOf = (loc: GameLocation) => heldBy(locations, loc);
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
  const nested = heldBy(locations, target) !== null;
  const canvasPosition = {
    x: Math.round(nested ? Math.max(position.x, GROUP_PADDING) : position.x),
    y: Math.round(nested ? Math.max(position.y, GROUP_HEADER) : position.y),
  };
  return locations.map((l) => (l.id === id ? { ...l, canvasPosition } : l));
}

/** A box in flow coordinates, measured from the canvas origin rather than from whatever holds it. */
interface CanvasRect { x: number; y: number; width: number; height: number }

/**
 * Every node's box in flow coordinates. The map stores a nested position against its parent's frame; a drop
 * is judged against the whole canvas, so the two have to be spoken in the same coordinates first. Nodes
 * arrive parents-first, so a parent's box is always known by the time a child is measured against it.
 */
function absoluteRects(map: LocationCanvasMap): Map<string, CanvasRect> {
  const rects = new Map<string, CanvasRect>();
  for (const node of map.nodes) {
    const origin = (node.parentId && rects.get(node.parentId)) || { x: 0, y: 0 };
    rects.set(node.id, {
      x: origin.x + node.position.x,
      y: origin.y + node.position.y,
      width: node.width,
      height: node.height,
    });
  }
  return rects;
}

/**
 * What a drag came to rest as. The same gesture does one of two things, and which one is decided by where it
 * landed rather than by a mode the author has to hold: a location that came to rest inside a different box
 * than the one it started in is now held by that box, and anything else is a move.
 *
 * The position is the raw resting place, measured against whichever box now holds the location. Rounding it
 * and holding it clear of that box's frame is `applyCanvasDrop`'s job, so a drop's *meaning* stays separate
 * from where the location is finally allowed to come to rest.
 */
export type CanvasDrop =
  | { kind: "move"; id: string; position: { x: number; y: number } }
  | { kind: "reparent"; id: string; parentId: string | null; position: { x: number; y: number } };

/**
 * Drop geometry → what the world becomes. `position` is the resting place as the canvas reports it, measured
 * against the box that held the location when the drag *began*.
 *
 * A location is held by the innermost group box its center came to rest in — dropped clear of every box, it
 * goes back to the top level. Only a group box counts: a childless location is drawn as a box the size of its
 * own name, so treating it as a container would turn two nodes brushing past each other into nesting nobody
 * asked for. Its own box, and those of everything nested beneath it, are not places it can be dropped into.
 */
export function dropIntent(
  locations: GameLocation[],
  id: string,
  position: { x: number; y: number },
): CanvasDrop | null {
  const target = locations.find((l) => l.id === id);
  if (!target) return null;
  const rects = absoluteRects(buildLocationCanvas(locations, []));
  const self = rects.get(id);
  if (!self) return null;

  const held = heldBy(locations, target);
  const heldOrigin = (held && rects.get(held)) || { x: 0, y: 0 };
  const center = {
    x: heldOrigin.x + position.x + self.width / 2,
    y: heldOrigin.y + position.y + self.height / 2,
  };

  const byId = new Map(locations.map((l) => [l.id, l]));
  const depthOf = (loc: GameLocation) => {
    let depth = 0;
    for (let at = byId.get(loc.parentId ?? ""); at; at = byId.get(at.parentId ?? "")) depth += 1;
    return depth;
  };
  // The innermost box wins: a nested group sits wholly inside the one holding it, so both contain the drop.
  let into: { id: string; depth: number } | null = null;
  for (const loc of locations) {
    const rect = rects.get(loc.id);
    if (!rect) continue;
    if (!locations.some((l) => l.parentId === loc.id)) continue; // a leaf is a name, not a container
    if (isDescendantLocation(locations, id, loc.id)) continue; // a location cannot come to hold itself
    const inside = center.x >= rect.x && center.x <= rect.x + rect.width
      && center.y >= rect.y && center.y <= rect.y + rect.height;
    const depth = depthOf(loc);
    if (inside && (!into || depth > into.depth)) into = { id: loc.id, depth };
  }

  const parentId = into?.id ?? null;
  if (parentId === held) return { kind: "move", id, position };
  const origin = (parentId && rects.get(parentId)) || { x: 0, y: 0 };
  return {
    kind: "reparent",
    id,
    parentId,
    position: {
      x: heldOrigin.x + position.x - origin.x,
      y: heldOrigin.y + position.y - origin.y,
    },
  };
}

/**
 * A drop, written onto the world. Reparenting is one field: containment and Connections are separate
 * systems, so every authored Connection survives the move untouched and only the free travel the tree gives
 * away is recomputed. The new position is stored last, so it is held clear of the frame of the box that
 * holds the location *now*.
 */
export function applyCanvasDrop(locations: GameLocation[], drop: CanvasDrop): GameLocation[] {
  const placed = drop.kind === "move"
    ? locations
    : locations.map((l) => (l.id === drop.id ? { ...l, parentId: drop.parentId } : l));
  return withCanvasPosition(placed, drop.id, drop.position);
}

/**
 * What a canvas gesture asks the world to become. The canvas never writes a Connection itself: a gesture
 * produces one of these and the shell hands it to the editor's own add/update/remove path, so what every
 * gesture *means* is testable without mounting a canvas — and both surfaces edit the one set of records.
 */
export type CanvasIntent =
  | { kind: "add"; connection: Connection }
  | { kind: "update"; connection: Connection }
  | { kind: "remove"; connectionId: string };

/**
 * A pair's two ends in a fixed order. A one-way direction is stored by rewriting `from` and `to`, so the
 * record's own ends swap under a flip — reading them in a stable order is what keeps the direction control's
 * three options in the same places while the author clicks between them. The first end is the one the
 * canvas words a direction from, standing in for the location a list panel would be open on.
 */
export function connectionEnds(connection: Connection): [string, string] {
  return [connection.from, connection.to].sort() as [string, string];
}

/** Which of the direction control's options a record currently sits on. */
export function directionOf(connection: Connection): ConnectionDirection {
  return directionFrom(connection, connectionEnds(connection)[0]);
}

/**
 * Dragging between two locations and clicking a dashed implicit arrow ask for the same thing: this pair gets
 * a two-way Connection, the common case needing no follow-up click. Nothing comes of a self-drag, or of a
 * pair that already has a record — a Connection is its pair's whole travel rule, so a second would contradict
 * the first rather than add to it.
 */
export function connectIntent(fromId: string, toId: string, connections: Connection[]): CanvasIntent | null {
  if (fromId === toId) return null;
  const key = pairKey(fromId, toId);
  if (connections.some((c) => pairKey(c.from, c.to) === key)) return null;
  return { kind: "add", connection: createConnection(fromId, toId) };
}

/** The direction control on a selected arrow — the list panel's own edit, anchored to the pair's first end
 *  instead of to the location whose panel is open. */
export function directionIntent(connection: Connection, direction: ConnectionDirection): CanvasIntent {
  return { kind: "update", connection: withDirection(connection, connectionEnds(connection)[0], direction) };
}

/** The travel hint on a selected arrow. */
export function hintIntent(connection: Connection, hint: string): CanvasIntent {
  return { kind: "update", connection: withHint(connection, hint) };
}

/** Deleting a selected arrow deletes the record both of the pair's directions came from, which hands the
 *  pair back to whatever implicit travel it had before. */
export function deleteIntent(connection: Connection): CanvasIntent {
  return { kind: "remove", connectionId: connection.id };
}
