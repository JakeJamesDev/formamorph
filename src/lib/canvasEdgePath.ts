/**
 * The geometry of one arrow on the Locations Canvas: where it leaves a box, where it lands on another, and
 * the shape it takes between them. Pure numbers in and out, so how the map is drawn is testable without
 * mounting a canvas — the edge component is left holding nothing but the rects xyflow measured.
 *
 * The three shapes are presentation only. An author picks the one they read graphs in; the world never hears
 * about it, and every arrow keeps its dashed-or-solid weight, its arrowhead and its label in all three.
 */

/** A box in flow coordinates. */
export interface EdgeRect { x: number; y: number; width: number; height: number }

export interface Point { x: number; y: number }

/** How the line between two boxes is drawn. Straight is the default: the plainest reading of the map. */
export type ConnectionStyle = 'straight' | 'bezier' | 'elbow';

/** The choice as the author is offered it, in the order it reads. */
export const CONNECTION_STYLES: { value: ConnectionStyle; label: string }[] = [
  { value: 'straight', label: 'Straight Connections' },
  { value: 'bezier', label: 'Curved Connections' },
  { value: 'elbow', label: 'Elbow Connections' },
];

/** Whether a stored or incoming name is one of the shapes on offer. */
export function isConnectionStyle(value: string): value is ConnectionStyle {
  return CONNECTION_STYLES.some((style) => style.value === value);
}

const centerOf = (rect: EdgeRect): Point => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });

/** Where the ray from a box's center toward `toward` crosses its border. */
function borderPoint(rect: EdgeRect, toward: Point): Point {
  const center = centerOf(rect);
  const dx = toward.x - center.x;
  const dy = toward.y - center.y;
  if (dx === 0 && dy === 0) return { x: center.x, y: rect.y + rect.height }; // nowhere to aim: the near edge
  const scale = Math.min(
    dx !== 0 ? rect.width / 2 / Math.abs(dx) : Infinity,
    dy !== 0 ? rect.height / 2 / Math.abs(dy) : Infinity,
  );
  return { x: center.x + dx * scale, y: center.y + dy * scale };
}

/** Whether a point is inside a box, which is how a Group is told from a neighbor without being told which
 *  location holds which. */
const holds = (rect: EdgeRect, point: Point) =>
  point.x > rect.x && point.x < rect.x + rect.width && point.y > rect.y && point.y < rect.y + rect.height;

/**
 * The two points an arrow runs between: one on each box's border, whichever sides face each other.
 *
 * A box standing inside another one is the case the plain reading gets wrong. An authored Connection between
 * a Group and something it holds would otherwise aim at the Group's center — a line plunging *through* the
 * child it starts at and out the far side. So a nested pair is read outward instead: the ray runs from the
 * Group's center through the child, and the arrow spans the child's own border to the Group's border on that
 * same side. Both ends land on a border in every case, which is the whole rule.
 */
export function edgeAnchors(from: EdgeRect, to: EdgeRect): { start: Point; end: Point } {
  const fromCenter = centerOf(from);
  const toCenter = centerOf(to);
  if (holds(to, fromCenter)) {
    const end = borderPoint(to, fromCenter); // the Group's border on the side its child sits toward
    return { start: borderPoint(from, end), end };
  }
  if (holds(from, toCenter)) {
    const start = borderPoint(from, toCenter);
    return { start, end: borderPoint(to, start) };
  }
  return { start: borderPoint(from, toCenter), end: borderPoint(to, fromCenter) };
}

/** The way out of a box at one of its border points, as an axis-aligned unit vector: whichever side of the
 *  box the point sits on. */
function outwardNormal(rect: EdgeRect, at: Point): Point {
  const center = centerOf(rect);
  const dx = (at.x - center.x) / (rect.width / 2 || 1);
  const dy = (at.y - center.y) / (rect.height / 2 || 1);
  if (Math.abs(dx) >= Math.abs(dy)) return { x: Math.sign(dx) || 1, y: 0 };
  return { x: 0, y: Math.sign(dy) };
}

/** The normal turned to agree with where the arrow is actually going, so a nested pair curves out of the
 *  child and into the Group rather than looping back on itself. */
function leaning(normal: Point, along: Point): Point {
  return normal.x * along.x + normal.y * along.y >= 0 ? normal : { x: -normal.x, y: -normal.y };
}

const round = (n: number) => Math.round(n * 100) / 100;
const at = (p: Point) => `${round(p.x)},${round(p.y)}`;

export interface EdgeGeometry {
  start: Point;
  end: Point;
  /** The SVG path between them, in the chosen style. */
  path: string;
  /** Where a travel hint sits: on the line, halfway along the shape rather than halfway between its ends. */
  labelAt: Point;
}

/**
 * Two boxes and a style → the arrow between them. `offset` slides the whole arrow sideways from the line it
 * would otherwise take, which is what keeps a pair's two directions side by side instead of on top of each
 * other — applied to the endpoints, so it holds in every style.
 */
export function edgeGeometry(
  from: EdgeRect,
  to: EdgeRect,
  // Named rather than defaulted: which shape is drawn is the author's choice, and a default here would be a
  // second answer to it living somewhere the picker never reaches.
  opts: { style: ConnectionStyle; offset?: number },
): EdgeGeometry {
  const { style } = opts;
  const anchors = edgeAnchors(from, to);
  const span = { x: anchors.end.x - anchors.start.x, y: anchors.end.y - anchors.start.y };
  const length = Math.hypot(span.x, span.y) || 1;
  const slide = opts.offset ?? 0;
  const shift = { x: (-span.y / length) * slide, y: (span.x / length) * slide };
  const start = { x: anchors.start.x + shift.x, y: anchors.start.y + shift.y };
  const end = { x: anchors.end.x + shift.x, y: anchors.end.y + shift.y };
  const along = { x: end.x - start.x, y: end.y - start.y };

  if (style === 'bezier') {
    // Both control points reach less than halfway, so they never cross each other: a short arrow between two
    // boxes all but touching curves barely at all, rather than kinking into an S to use up a fixed reach.
    const reach = Math.min(length * 0.4, 140);
    const outFrom = leaning(outwardNormal(from, anchors.start), along);
    const outTo = leaning(outwardNormal(to, anchors.end), { x: -along.x, y: -along.y });
    const c1 = { x: start.x + outFrom.x * reach, y: start.y + outFrom.y * reach };
    const c2 = { x: end.x + outTo.x * reach, y: end.y + outTo.y * reach };
    return {
      start,
      end,
      path: `M ${at(start)} C ${at(c1)} ${at(c2)} ${at(end)}`,
      // The curve's own halfway point, so a hint sits on the line rather than beside it.
      labelAt: {
        x: (start.x + 3 * c1.x + 3 * c2.x + end.x) / 8,
        y: (start.y + 3 * c1.y + 3 * c2.y + end.y) / 8,
      },
    };
  }

  if (style === 'elbow') {
    // The turn is taken halfway along whichever axis the arrow leaves its box on, so the first leg carries it
    // clear of the box before the line changes direction.
    const horizontal = outwardNormal(from, anchors.start).x !== 0;
    const corner1 = horizontal
      ? { x: (start.x + end.x) / 2, y: start.y }
      : { x: start.x, y: (start.y + end.y) / 2 };
    const corner2 = horizontal
      ? { x: (start.x + end.x) / 2, y: end.y }
      : { x: end.x, y: (start.y + end.y) / 2 };
    return {
      start,
      end,
      path: `M ${at(start)} L ${at(corner1)} L ${at(corner2)} L ${at(end)}`,
      labelAt: { x: (corner1.x + corner2.x) / 2, y: (corner1.y + corner2.y) / 2 },
    };
  }

  return {
    start,
    end,
    path: `M ${at(start)} L ${at(end)}`,
    labelAt: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
  };
}
