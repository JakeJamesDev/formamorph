import type { GameLocation } from "@/types";
import { canvasRects, withCanvasPosition } from "./locationCanvas";
import { holderOf, isDescendantLocation } from "./locationTree";

/**
 * The finishing moves a hand-made arrangement gets: a selection lined up on one edge, spaced evenly along one
 * axis, or stepped by a single grid cell. Auto Arrange decides a whole group's layout; these take an
 * arrangement the author already made and true it up, which is why they are the multi-selection's own commands
 * rather than a second layout engine.
 *
 * Every one of them is measured in canvas coordinates rather than in whatever frame holds each location, so a
 * location inside a Group and one standing on its own line up with each other on screen — which is where the
 * author is reading the edge. Growing a Group leaves what it holds exactly where it was on screen, so the
 * places worked out up front are still the right places by the time each one is written.
 */

/** Which edge of the picked boxes is brought together. */
export type AlignEdge = "left" | "top";

/** Which way an even spacing runs. */
export type DistributeAxis = "horizontal" | "vertical";

/**
 * The picked locations that will actually move. One held by another that was picked too is left out: its frame
 * carries it, so moving it as well would step it twice for one command.
 */
function movers(locations: GameLocation[], ids: string[]): string[] {
  const known = ids.filter((id) => locations.some((l) => l.id === id));
  return known.filter(
    (id) => !known.some((other) => other !== id && isDescendantLocation(locations, other, id)),
  );
}

/**
 * Locations written to the canvas coordinates worked out for them. Each is placed against whatever frame holds
 * it *as the world stands by then* — a Group that grew around an earlier one has moved its own corner, and the
 * position stored on a child is read from that corner.
 */
function placeAbsolute(
  locations: GameLocation[],
  targets: { id: string; x: number; y: number }[],
): GameLocation[] {
  const placed = targets.reduce((world, target) => {
    const location = world.find((l) => l.id === target.id);
    if (!location) return world;
    const parentId = holderOf(world, location);
    const origin = (parentId && canvasRects(world).get(parentId)) || { x: 0, y: 0 };
    return withCanvasPosition(world, target.id, { x: target.x - origin.x, y: target.y - origin.y });
  }, locations);
  // A command asked for on an arrangement that already answers it moved nothing, and a world nothing moved in
  // is the world that was handed in — writing a fresh copy of it would spend an undo step on a press that
  // changed nothing. Positions are what is compared: every writer here returns new records either way.
  const moved = locations.some((loc, index) => {
    const now = placed[index].canvasPosition;
    return now?.x !== loc.canvasPosition?.x || now?.y !== loc.canvasPosition?.y;
  });
  return moved ? placed : locations;
}

/**
 * The picked boxes brought onto one edge — the outermost of them, so the selection tightens toward a line
 * that one of its own members already stands on rather than drifting somewhere none of them were.
 *
 * Returns the same array when there is nothing to line up: one box is already aligned with itself.
 */
export function alignLocations(
  locations: GameLocation[],
  ids: string[],
  edge: AlignEdge,
): GameLocation[] {
  const moving = movers(locations, ids);
  if (moving.length < 2) return locations;
  const rects = canvasRects(locations);
  const boxes = moving.map((id) => ({ id, rect: rects.get(id)! })).filter((entry) => entry.rect);
  if (boxes.length < 2) return locations;
  const to = edge === "left"
    ? Math.min(...boxes.map((b) => b.rect.x))
    : Math.min(...boxes.map((b) => b.rect.y));
  return placeAbsolute(locations, boxes.map(({ id, rect }) => ({
    id,
    x: edge === "left" ? to : rect.x,
    y: edge === "top" ? to : rect.y,
  })));
}

/**
 * The picked boxes spaced evenly along one axis, by their centers: the two on the ends hold their places and
 * everything between them is dealt out at equal intervals, so the run keeps the span the author gave it.
 *
 * Order comes off the canvas rather than off the selection — what is being evened out is the row as it is
 * drawn, whichever way round the author happened to click it together.
 *
 * Returns the same array below three boxes: two are evenly spaced by definition.
 */
export function distributeLocations(
  locations: GameLocation[],
  ids: string[],
  axis: DistributeAxis,
): GameLocation[] {
  const moving = movers(locations, ids);
  if (moving.length < 3) return locations;
  const rects = canvasRects(locations);
  const boxes = moving
    .map((id) => ({ id, rect: rects.get(id)! }))
    .filter((entry) => entry.rect)
    .map(({ id, rect }) => ({
      id,
      rect,
      center: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
    }));
  if (boxes.length < 3) return locations;
  const along = axis === "horizontal" ? "x" : "y";
  const ordered = [...boxes].sort((a, b) => a.center[along] - b.center[along]);
  const from = ordered[0].center[along];
  const step = (ordered[ordered.length - 1].center[along] - from) / (ordered.length - 1);
  return placeAbsolute(locations, ordered.map((box, index) => {
    const center = from + step * index;
    const corner = center - (along === "x" ? box.rect.width : box.rect.height) / 2;
    return {
      id: box.id,
      x: along === "x" ? corner : box.rect.x,
      y: along === "y" ? corner : box.rect.y,
    };
  }));
}

/**
 * The picked boxes stepped by a fixed distance, keeping their arrangement — the keyboard's own drag, so fine
 * adjustment is a keypress rather than a mouse gesture that has to be aimed.
 *
 * A step past a Group's frame grows the frame exactly as a drag past it does: the keyboard is not a narrower
 * way to move a location than the pointer.
 */
export function nudgeLocations(
  locations: GameLocation[],
  ids: string[],
  delta: { x: number; y: number },
): GameLocation[] {
  const moving = movers(locations, ids);
  if (!moving.length) return locations;
  const rects = canvasRects(locations);
  const targets = moving
    .filter((id) => rects.has(id))
    .map((id) => ({ id, x: rects.get(id)!.x + delta.x, y: rects.get(id)!.y + delta.y }));
  if (!targets.length) return locations;
  return placeAbsolute(locations, targets);
}
