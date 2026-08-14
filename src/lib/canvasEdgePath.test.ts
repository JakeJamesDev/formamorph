import { describe, expect, it } from 'vitest';
import { CONNECTION_STYLES, edgeAnchors, edgeGeometry, isConnectionStyle, type EdgeRect, type Point } from './canvasEdgePath';

/**
 * The arrow's geometry, which is the whole of what the three styles change. What matters is where an arrow
 * touches each box — a line that starts or ends anywhere but a border reads as a mistake on the map — and
 * that the choice of style moves the shape between the ends without moving the ends themselves.
 */

const GROUP: EdgeRect = { x: 0, y: 0, width: 400, height: 300 };
const CHILD: EdgeRect = { x: 20, y: 36, width: 180, height: 52 };
const NEIGHBOR: EdgeRect = { x: 600, y: 100, width: 180, height: 52 };

/** How far a point sits outside the border it should be on. Zero for a point on the frame itself. */
const outside = (rect: EdgeRect, p: Point) =>
  Math.max(rect.x - p.x, p.x - (rect.x + rect.width), rect.y - p.y, p.y - (rect.y + rect.height));

/** Whether a point lies on a box's border rather than adrift inside or outside it. */
const onBorder = (rect: EdgeRect, p: Point) => {
  const toEdge = Math.min(
    Math.abs(p.x - rect.x), Math.abs(p.x - (rect.x + rect.width)),
    Math.abs(p.y - rect.y), Math.abs(p.y - (rect.y + rect.height)),
  );
  return outside(rect, p) < 1e-9 && toEdge < 1e-9;
};

describe('edge anchoring', () => {
  it('meets the facing borders of two boxes side by side', () => {
    const { start, end } = edgeAnchors(CHILD, NEIGHBOR);
    expect(onBorder(CHILD, start)).toBe(true);
    expect(onBorder(NEIGHBOR, end)).toBe(true);
    expect(start.x).toBeCloseTo(CHILD.x + CHILD.width, 6); // its right side, facing the neighbor
    expect(end.x).toBeCloseTo(NEIGHBOR.x, 6);
  });

  /** The Group case: a box inside another box. Aimed at the Group's center, the arrow would run backwards
   *  through the child it started at, so this is what the border-anchor fix is for. */
  it('runs from a child border out to the Group border on the same side', () => {
    const { start, end } = edgeAnchors(CHILD, GROUP);
    expect(onBorder(CHILD, start)).toBe(true);
    expect(onBorder(GROUP, end)).toBe(true);
    // Outward, not inward: the child sits up in the Group's top-left, so both ends are on top borders.
    expect(end.y).toBeCloseTo(GROUP.y, 6);
    expect(start.y).toBeCloseTo(CHILD.y, 6);
    // And it never doubles back through the child's far side — it leaves going the way it lands.
    expect(start.y).toBeGreaterThan(end.y);
  });

  it('anchors the same pair the same way with the Group as the source', () => {
    const child = edgeAnchors(CHILD, GROUP);
    const group = edgeAnchors(GROUP, CHILD);
    expect(onBorder(GROUP, group.start)).toBe(true);
    expect(onBorder(CHILD, group.end)).toBe(true);
    expect(group.start).toEqual(child.end);
    expect(group.end).toEqual(child.start);
  });

  it('still lands on both borders when a child sits dead center in its Group', () => {
    const centered: EdgeRect = { x: 110, y: 124, width: 180, height: 52 };
    const { start, end } = edgeAnchors(centered, GROUP);
    expect(Number.isFinite(start.x) && Number.isFinite(start.y)).toBe(true);
    expect(Number.isFinite(end.x) && Number.isFinite(end.y)).toBe(true);
    expect(onBorder(centered, start)).toBe(true);
    expect(onBorder(GROUP, end)).toBe(true);
  });
});

describe('connection styles', () => {
  const styles = CONNECTION_STYLES.map((s) => s.value);

  /** Every point a path names, in order: its ends and whatever steers it between them. */
  const points = (path: string): Point[] => path
    .split(/[A-Z]/).filter((part) => part.trim())
    .flatMap((part) => part.trim().split(/\s+/))
    .map((pair) => { const [x, y] = pair.split(',').map(Number); return { x, y }; });

  it('keeps both ends on their borders whichever shape is drawn', () => {
    for (const style of styles) {
      const nested = edgeGeometry(CHILD, GROUP, { style });
      expect(onBorder(CHILD, nested.start)).toBe(true);
      expect(onBorder(GROUP, nested.end)).toBe(true);
      const apart = edgeGeometry(CHILD, NEIGHBOR, { style });
      expect(onBorder(CHILD, apart.start)).toBe(true);
      expect(onBorder(NEIGHBOR, apart.end)).toBe(true);
    }
  });

  it('starts every shape at the start and finishes it at the end', () => {
    for (const style of styles) {
      const { path, start, end } = edgeGeometry(CHILD, NEIGHBOR, { style });
      const drawn = points(path);
      expect(drawn[0].x).toBeCloseTo(start.x, 1);
      expect(drawn[0].y).toBeCloseTo(start.y, 1);
      expect(drawn[drawn.length - 1].x).toBeCloseTo(end.x, 1);
      expect(drawn[drawn.length - 1].y).toBeCloseTo(end.y, 1);
    }
  });

  it('draws one segment straight, a curve bezier, and only right angles elbow', () => {
    expect(points(edgeGeometry(CHILD, NEIGHBOR, { style: 'straight' }).path)).toHaveLength(2);

    const curve = edgeGeometry(CHILD, NEIGHBOR, { style: 'bezier' });
    expect(curve.path).toContain(' C ');
    expect(points(curve.path)).toHaveLength(4);

    const elbow = points(edgeGeometry(CHILD, NEIGHBOR, { style: 'elbow' }).path);
    expect(elbow.length).toBeGreaterThan(2);
    for (let i = 1; i < elbow.length; i += 1) {
      const axisAligned = elbow[i].x === elbow[i - 1].x || elbow[i].y === elbow[i - 1].y;
      expect(axisAligned).toBe(true);
    }
  });

  it('curves out of the box it leaves rather than back through it', () => {
    // The control point steers the curve; on a nested pair it has to lean outward with the arrow, or the
    // line loops back over the child it just left.
    const { start, end, path } = edgeGeometry(CHILD, GROUP, { style: 'bezier' });
    const [, c1, c2] = points(path);
    const along = { x: end.x - start.x, y: end.y - start.y };
    // Each control point leads its own end along the way the arrow travels, never back into the box.
    expect((c1.x - start.x) * along.x + (c1.y - start.y) * along.y).toBeGreaterThan(0);
    expect((c2.x - end.x) * along.x + (c2.y - end.y) * along.y).toBeLessThan(0);
  });

  /** A Group and the child just inside it are a few pixels apart, and a curve that reaches further than the
   *  arrow is long doubles back on itself — an S-kink across a gap the eye reads as a straight hop. */
  it('holds a curve short enough not to kink on a short arrow', () => {
    // A Group barely bigger than the child it holds: its padding is the whole of the arrow's length.
    const snug: EdgeRect = { x: 0, y: 0, width: 440, height: 108 };
    const { start, end, path } = edgeGeometry(CHILD, snug, { style: 'bezier' });
    expect(Math.hypot(end.x - start.x, end.y - start.y)).toBeLessThan(30);
    const [, c1, c2] = points(path);
    const along = { x: end.x - start.x, y: end.y - start.y };
    const reachOf = (p: Point) => ((p.x - start.x) * along.x + (p.y - start.y) * along.y);
    expect(reachOf(c1)).toBeLessThan(reachOf(c2)); // in order along the arrow, never crossed over
  });

  it('offsets a pair of arrows to opposite sides of the line they share', () => {
    for (const style of styles) {
      const there = edgeGeometry(CHILD, NEIGHBOR, { style, offset: 5 });
      const back = edgeGeometry(NEIGHBOR, CHILD, { style, offset: 5 });
      const plain = edgeGeometry(CHILD, NEIGHBOR, { style });
      // Neither rides on the line it was offset from, and the two ride on opposite sides of it.
      expect(there.start.y).not.toBeCloseTo(plain.start.y, 3);
      expect(Math.sign(there.start.y - plain.start.y)).toBe(-Math.sign(back.end.y - plain.start.y));
    }
  });

  it('puts the label on the line in every shape', () => {
    for (const style of styles) {
      const { start, end, labelAt } = edgeGeometry(CHILD, NEIGHBOR, { style });
      expect(labelAt.x).toBeGreaterThan(Math.min(start.x, end.x));
      expect(labelAt.x).toBeLessThan(Math.max(start.x, end.x));
    }
  });
});

describe('the stored style', () => {
  it('accepts only the three shapes on offer', () => {
    expect(isConnectionStyle('bezier')).toBe(true);
    expect(isConnectionStyle('squiggle')).toBe(false);
  });
});
