import type { Connection, GameLocation } from "@/types";
import {
  createConnection, directionFrom, withDirection, withHint, type ConnectionDirection,
} from "./connectionEditing";
import { implicitPairs, overriddenPairs, pairKey, reachableFromStarts } from "./locationGraph";
import { holderOf, isDescendantLocation } from "./locationTree";

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
/** The grid nodes snap to, and the rhythm every placement shares: half a layout gap, so an auto-placed
 *  neighbor and a hand-dragged one land on the same lines. */
export const CANVAS_GRID = LAYOUT_GAP / 2;
const LAYOUT_ROW_WIDTH = 660;

/** What a location with no name of its own is called, wherever one is read for the author to see. */
export const UNNAMED_LOCATION = "Unnamed Location";

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
  const parentOf = (loc: GameLocation) => holderOf(locations, loc);
  const childrenOf = new Map<string | null, GameLocation[]>();
  for (const loc of locations) {
    const parent = parentOf(loc);
    childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), loc]);
  }

  const reachable = reachableFromStarts(locations, connections);

  // Sizes and fallback placements are one bottom-up pass: a location is as large as the children it holds,
  // and a location with no stored position falls back to a row-wrapping slot among the other unplaced
  // children of the same box. The fallback reads nothing an author wrote, so the same world always draws the
  // same map and nobody's arrangement is reshuffled by a location that never had a position of its own.
  const positionById = new Map<string, { x: number; y: number }>();
  const sizeById = new Map<string, { width: number; height: number }>();

  const place = (children: GameLocation[], nested: boolean) => {
    const originX = nested ? GROUP_PADDING : 0;
    const originY = nested ? GROUP_HEADER : 0;
    let right = originX + CANVAS_NODE_WIDTH;
    let bottom = originY + CANVAS_NODE_HEIGHT;
    let cursorX = originX;
    let cursorY = originY;
    let rowHeight = 0;
    for (const child of children) {
      const size = measure(child);
      // Every child takes a slot in the fallback row, placed or not: a slot a location has no need of is
      // still not given away, so writing a position onto one location can never move another one.
      if (cursorX > originX && cursorX + size.width > originX + LAYOUT_ROW_WIDTH) {
        cursorX = originX;
        cursorY += rowHeight + LAYOUT_GAP;
        rowHeight = 0;
      }
      const at = child.canvasPosition ?? { x: cursorX, y: cursorY };
      cursorX += size.width + LAYOUT_GAP;
      rowHeight = Math.max(rowHeight, size.height);
      positionById.set(child.id, at);
      right = Math.max(right, at.x + size.width);
      bottom = Math.max(bottom, at.y + size.height);
    }
    return { right, bottom };
  };

  function measure(loc: GameLocation): { width: number; height: number } {
    const cached = sizeById.get(loc.id);
    if (cached) return cached;
    const children = childrenOf.get(loc.id) ?? [];
    let size = { width: CANVAS_NODE_WIDTH, height: CANVAS_NODE_HEIGHT };
    if (children.length) {
      const bounds = place(children, true);
      size = { width: bounds.right + GROUP_PADDING, height: bounds.bottom + GROUP_PADDING };
    }
    sizeById.set(loc.id, size);
    return size;
  }

  place(childrenOf.get(null) ?? [], false);

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

/** Where every node currently renders, against whatever box holds it — the stored position where there is
 *  one, and the fallback slot where there is not. */
function renderedPositions(locations: GameLocation[]): Map<string, { x: number; y: number }> {
  return new Map(buildLocationCanvas(locations, []).nodes.map((n) => [n.id, n.position]));
}

/**
 * A dragged node's resting place, written onto its location. Whole pixels — a drag is not sub-pixel work.
 *
 * A sub-location dragged past its group's frame or title strip grows the group rather than being pushed back:
 * the frame's own origin moves out by as much as the drag overshot, and every sibling's position is rebased by
 * the same amount, so the group gets bigger and nothing inside it appears to move. A group that overshoots its
 * own parent's frame in turn grows that one, so the growth carries all the way up the tree.
 */
export function withCanvasPosition(
  locations: GameLocation[],
  id: string,
  position: { x: number; y: number },
): GameLocation[] {
  const target = locations.find((l) => l.id === id);
  if (!target) return locations;
  const parentId = holderOf(locations, target);
  const at = { x: Math.round(position.x), y: Math.round(position.y) };
  const write = (list: GameLocation[], canvasPosition: { x: number; y: number }) =>
    list.map((l) => (l.id === id ? { ...l, canvasPosition } : l));
  if (parentId === null) return write(locations, at);

  const dx = Math.max(0, GROUP_PADDING - at.x);
  const dy = Math.max(0, GROUP_HEADER - at.y);
  const inside = { x: at.x + dx, y: at.y + dy };
  if (!dx && !dy) return write(locations, inside);

  const rendered = renderedPositions(locations);
  const grown = locations.map((l) => {
    if (l.id === id) return { ...l, canvasPosition: inside };
    if (holderOf(locations, l) !== parentId) return l;
    const from = rendered.get(l.id) ?? { x: GROUP_PADDING, y: GROUP_HEADER };
    return { ...l, canvasPosition: { x: from.x + dx, y: from.y + dy } };
  });
  const frame = rendered.get(parentId) ?? { x: 0, y: 0 };
  return withCanvasPosition(grown, parentId, { x: frame.x - dx, y: frame.y - dy });
}

/**
 * Where a location created in the editor is written: at the near corner of the box that will hold it, below
 * everything that box already holds. A creation reads the arrangement once and joins it — unlike the drawing
 * pass, which never rearranges anything on the author's behalf.
 */
export function newLocationPosition(
  locations: GameLocation[],
  parentId: string | null = null,
): { x: number; y: number } {
  const nested = parentId !== null && locations.some((l) => l.id === parentId);
  const originX = nested ? GROUP_PADDING : 0;
  const originY = nested ? GROUP_HEADER : 0;
  const holder = nested ? parentId : null;
  const nodes = buildLocationCanvas(locations, []).nodes;
  let bottom: number | null = null;
  for (const loc of locations) {
    if (holderOf(locations, loc) !== holder) continue;
    const node = nodes.find((n) => n.id === loc.id);
    if (node) bottom = Math.max(bottom ?? originY, node.position.y + node.height);
  }
  return { x: originX, y: bottom === null ? originY : bottom + LAYOUT_GAP };
}

/** A box in flow coordinates, measured from the canvas origin rather than from whatever holds it. */
export interface CanvasRect { x: number; y: number; width: number; height: number }

/** Every node's box in flow coordinates, read straight off the world. What a drop is judged against, and the
 *  one coordinate system two locations held by different frames can be compared in. */
export function canvasRects(locations: GameLocation[]): Map<string, CanvasRect> {
  return absoluteRects(buildLocationCanvas(locations, []));
}

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
 *
 * Both kinds name the box the location lands in, because both land in one — the kinds differ over whether
 * that is a *change*. A drag in flight reads the first to light the box up and the second to say so.
 */
export type CanvasDrop =
  | { kind: "move"; id: string; parentId: string | null; position: { x: number; y: number } }
  | { kind: "reparent"; id: string; parentId: string | null; position: { x: number; y: number } };

/**
 * Which box a location at this position belongs to — the innermost group box its center sits in, or `null` for
 * the top level. Only a group box counts: a childless location is drawn as a box the size of its own name, so
 * treating it as a container would turn two nodes brushing past each other into nesting nobody asked for. Its
 * own box, and those of everything nested beneath it, are not places it can go.
 *
 * The canvas asks this on every frame of a drag to light up where the location would land, and `dropIntent`
 * asks it once when the drag comes to rest — one answer, so the highlight and the drop can never disagree.
 */
export function dropTarget(
  locations: GameLocation[],
  id: string,
  position: { x: number; y: number },
): string | null {
  const drag = measureDrag(locations, id, position);
  return drag && landsIn(drag);
}

/**
 * A drag read as geometry: every box on the map, where the dragged location's center currently is, and which
 * box it started in. Measuring the map is the expensive half of judging a drop, so the two questions asked of
 * one drag — where it would land, and what that makes of the world — measure it once between them.
 */
interface DragGeometry {
  locations: GameLocation[];
  id: string;
  rects: Map<string, CanvasRect>;
  center: { x: number; y: number };
  held: string | null;
  heldOrigin: { x: number; y: number };
}

function measureDrag(
  locations: GameLocation[],
  id: string,
  position: { x: number; y: number },
): DragGeometry | null {
  const target = locations.find((l) => l.id === id);
  if (!target) return null;
  const rects = absoluteRects(buildLocationCanvas(locations, []));
  const self = rects.get(id);
  if (!self) return null;

  const held = holderOf(locations, target);
  const heldOrigin = (held && rects.get(held)) || { x: 0, y: 0 };
  return {
    locations,
    id,
    rects,
    held,
    heldOrigin,
    center: {
      x: heldOrigin.x + position.x + self.width / 2,
      y: heldOrigin.y + position.y + self.height / 2,
    },
  };
}

/** The box a measured drag would come to rest in. */
function landsIn({ locations, id, rects, center }: DragGeometry): string | null {
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
  return into?.id ?? null;
}

/**
 * Drop geometry → what the world becomes. `position` is the resting place as the canvas reports it, measured
 * against the box that held the location when the drag *began*. Where it lands is `dropTarget`'s answer — the
 * same one the drag was lighting up all the way in.
 */
export function dropIntent(
  locations: GameLocation[],
  id: string,
  position: { x: number; y: number },
): CanvasDrop | null {
  const drag = measureDrag(locations, id, position);
  if (!drag) return null;
  const { rects, held, heldOrigin } = drag;

  const parentId = landsIn(drag);
  if (parentId === held) return { kind: "move", id, parentId, position };
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
 * A whole selection's resting places → what each one asks the world to become. Every drop is judged against
 * the map as it stood when the drag began, so a selection moving together is read as one gesture: the first
 * location leaving a group cannot shrink the box the next one is still being measured against.
 *
 * A location dragged inside a selected ancestor is left out. It never moved relative to the box holding it —
 * the ancestor carried it — so judging it again would read its old resting place as a fresh drop.
 */
export function multiDropIntents(
  locations: GameLocation[],
  moves: { id: string; position: { x: number; y: number } }[],
): CanvasDrop[] {
  const carried = (id: string) =>
    moves.some((other) => other.id !== id && isDescendantLocation(locations, other.id, id));
  return moves
    .filter((move) => !carried(move.id))
    .map((move) => dropIntent(locations, move.id, move.position))
    .filter((drop): drop is CanvasDrop => drop !== null);
}

/** How far the pointer may travel and still have stayed put: a mouse is held on a surface, a finger is not. */
const CLICK_SLOP = 4;
export const TOUCH_SLOP = 12;
/** How long a finger rests on a location before the press is a hold rather than a tap on its way to being. */
export const LONG_PRESS_MS = 500;

/**
 * Whether a press that came up here stayed put rather than going somewhere. Both of the canvas's press-and-
 * hold gestures turn on this: the right button pans *and* asks for the menu, and a finger both drags a
 * location and composes a selection, so in each pair the only thing telling the two apart is whether the
 * pointer traveled.
 */
export function isStationaryClick(
  down: { x: number; y: number } | null,
  up: { x: number; y: number },
  slop: number = CLICK_SLOP,
): boolean {
  if (!down) return true;
  return Math.hypot(up.x - down.x, up.y - down.y) <= slop;
}

/** A press as the Map records it: where it went down, and how far it may wander and still be a click —
 *  a finger's slop where the press was a touch, the mouse's tighter default otherwise. */
export interface TravelPress {
  at: { x: number; y: number };
  slop?: number;
}

/**
 * Whether a click on a Map box asks to travel there. A map is dragged around far more often than it is
 * clicked, and a pan that comes to rest over a box still raises a click on it — so a press that traveled is
 * a pan, and only one that stayed put is somewhere the player asked to go. A click with no clicks in it
 * (`detail` 0) came from the keyboard: no resting place to judge, always travel.
 */
export function isTravelClick(
  press: TravelPress | null,
  click: { x: number; y: number; detail: number },
): boolean {
  if (!press || click.detail === 0) return true;
  return isStationaryClick(press.at, { x: click.x, y: click.y }, press.slop ?? CLICK_SLOP);
}

/** A selection's drops, written onto the world in one pass. */
export function applyCanvasDrops(locations: GameLocation[], drops: CanvasDrop[]): GameLocation[] {
  return drops.reduce(applyCanvasDrop, locations);
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

/** What an intent leaves the world's Connections as. Kept beside the intents themselves so the canvas's own
 *  undo records the same array the editor writes, rather than one built to look like it. */
export function applyCanvasIntent(connections: Connection[], intent: CanvasIntent): Connection[] {
  if (intent.kind === "add") return [...connections, intent.connection];
  if (intent.kind === "update") {
    return connections.map((c) => (c.id === intent.connection.id ? intent.connection : c));
  }
  return connections.filter((c) => c.id !== intent.connectionId);
}

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
