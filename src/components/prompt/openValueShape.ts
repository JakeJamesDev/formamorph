/**
 * Geometry for open values on the Values tab: the traced outline around a value's line fragments, and the
 * editor-wide pass that keeps floating headers inside the editor and off each other. Pure, in client pixels.
 */

/** A rectangle in client pixels. */
export interface Box { left: number; top: number; right: number; bottom: number }

/** How far the outline stands off the text, and how round its corners are. */
export interface ShapeOptions { padX: number; padY: number; radius: number }

/** The outline as an SVG path relative to `bounds`, and the padded first line a header seats on. */
export interface Outline { path: string; bounds: Box; firstLine: Box }

/** Merges the client rects of a value into one box per visual line, in order. */
export function lineBoxes(rects: Iterable<Box>): Box[] {
  const lines: Box[] = [];
  for (const rect of rects) {
    if (rect.right <= rect.left) continue;
    const last = lines[lines.length - 1];
    if (last && rect.top < last.bottom && rect.bottom > last.top) {
      last.left = Math.min(last.left, rect.left);
      last.right = Math.max(last.right, rect.right);
      last.top = Math.min(last.top, rect.top);
      last.bottom = Math.max(last.bottom, rect.bottom);
    } else {
      lines.push({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom });
    }
  }
  return lines;
}

type Point = [number, number];

/**
 * Traces one rounded outline around a value's lines. Consecutive lines join only where they overlap enough
 * for two corners; otherwise the outline splits into pieces. The first piece's top-left corner stays square.
 */
export function traceOutline(lineList: readonly Box[], { padX, padY, radius }: ShapeOptions): Outline | null {
  if (!lineList.length) return null;
  const lines = lineList.map((l) => ({ left: l.left - padX, top: l.top - padY, right: l.right + padX, bottom: l.bottom + padY }));
  const firstLine = { ...lines[0] };
  const groups: Box[][] = [];
  for (const line of lines) {
    const group = groups[groups.length - 1];
    const prev = group?.[group.length - 1];
    if (prev && Math.min(prev.right, line.right) - Math.max(prev.left, line.left) >= 2 * radius + 2) group.push(line);
    else groups.push([line]);
  }
  // Joined lines meet halfway, so the shape has no gap or double edge at a wrap.
  for (const group of groups) {
    for (let i = 1; i < group.length; i++) {
      const mid = (group[i - 1].bottom + group[i].top) / 2;
      group[i - 1].bottom = mid;
      group[i].top = mid;
    }
  }
  const bounds: Box = {
    left: Math.min(...lines.map((l) => l.left)),
    top: Math.min(...lines.map((l) => l.top)),
    right: Math.max(...lines.map((l) => l.right)),
    bottom: Math.max(...lines.map((l) => l.bottom)),
  };
  const at = ([x, y]: Point) => `${(x - bounds.left).toFixed(1)} ${(y - bounds.top).toFixed(1)}`;
  let path = '';
  groups.forEach((group, g) => {
    const points: Point[] = [];
    for (const line of group) points.push([line.right, line.top], [line.right, line.bottom]);
    for (let i = group.length - 1; i >= 0; i--) points.push([group[i].left, group[i].bottom], [group[i].left, group[i].top]);
    const corners = cornersOf(points);
    const n = corners.length;
    corners.forEach((p, i) => {
      const a = corners[(i + n - 1) % n];
      const b = corners[(i + 1) % n];
      const square = g === 0 && p[0] === group[0].left && p[1] === group[0].top;
      const r = square ? 0 : Math.min(radius, Math.hypot(p[0] - a[0], p[1] - a[1]) / 2, Math.hypot(b[0] - p[0], b[1] - p[1]) / 2);
      const from: Point = [p[0] + Math.sign(a[0] - p[0]) * r, p[1] + Math.sign(a[1] - p[1]) * r];
      const to: Point = [p[0] + Math.sign(b[0] - p[0]) * r, p[1] + Math.sign(b[1] - p[1]) * r];
      path += `${i ? 'L' : 'M'} ${at(from)} Q ${at(p)} ${at(to)} `;
    });
    path += 'Z ';
  });
  return { path: path.trim(), bounds, firstLine };
}

/** The real corners of a rectilinear polygon: repeated and collinear points dropped. */
function cornersOf(points: Point[]): Point[] {
  const unique: Point[] = [];
  for (const p of points) {
    const q = unique[unique.length - 1];
    if (!q || q[0] !== p[0] || q[1] !== p[1]) unique.push(p);
  }
  return unique.filter((p, i) => {
    const a = unique[(i + unique.length - 1) % unique.length];
    const b = unique[(i + 1) % unique.length];
    return !((a[0] === p[0] && p[0] === b[0]) || (a[1] === p[1] && p[1] === b[1]));
  });
}

/** A header where its value seated it, with the left and right edges of that value's padded first line. */
export interface HeaderBox extends Box { lineLeft: number; lineRight: number }

/** Where the pass moves a header, and which bottom corners overhang the first line. */
export interface HeaderPlacement { dx: number; roundLeft: boolean; roundRight: boolean }

/** Pixels a header keeps clear of the editor's own edge. */
const EDGE_PX = 4;
/** Pixels left between two headers that had to be pushed apart. */
const GAP_PX = 2;

/**
 * Keeps every header inside `bounds` and off its neighbors. For two that meet on one line, the left one
 * slides to the right end of its own first line if that clears them, then the right one tries the same,
 * and as a last resort the left one is pushed away, with whatever room it lacked taken by pushing the
 * right one. Neither push leaves the editor: an editor too narrow for both headers keeps them inside and
 * overlapping, because a header outside the box cannot be read at all.
 */
export function layoutHeaders(heads: readonly HeaderBox[], bounds: { left: number; right: number }): HeaderPlacement[] {
  const dx = heads.map(() => 0);
  const left = (i: number) => heads[i].left + dx[i];
  const right = (i: number) => heads[i].right + dx[i];
  const minX = bounds.left + EDGE_PX;
  const maxX = bounds.right - EDGE_PX;
  heads.forEach((_, i) => {
    dx[i] += Math.max(0, minX - left(i)) - Math.max(0, right(i) - maxX);
  });
  const overlap = (a: number, b: number) => {
    if (!(heads[a].top < heads[b].bottom && heads[b].top < heads[a].bottom)) return 0;
    return Math.min(right(a), right(b)) - Math.max(left(a), left(b));
  };
  /** Moves `mover` to the end of its own first line, and keeps the move only if it clears the pair. */
  const slideToLineEnd = (mover: number, a: number, b: number) => {
    const end = Math.min(heads[mover].lineRight, maxX);
    if (end - (right(mover) - left(mover)) < left(mover) + 1) return false;
    const before = dx[mover];
    dx[mover] += end - right(mover);
    if (overlap(a, b) <= 0) return true;
    dx[mover] = before;
    return false;
  };
  const order = heads.map((_, i) => i).sort((a, b) => left(a) - left(b));
  for (let k = 1; k < order.length; k++) {
    const a = order[k - 1];
    const b = order[k];
    const over = overlap(a, b);
    if (over <= 0 || slideToLineEnd(a, a, b) || slideToLineEnd(b, a, b)) continue;
    const pushLeft = Math.min(over + GAP_PX, Math.max(0, left(a) - minX));
    dx[a] -= pushLeft;
    dx[b] += Math.min(over + GAP_PX - pushLeft, Math.max(0, maxX - right(b)));
  }
  return heads.map((h, i) => ({
    dx: dx[i],
    roundLeft: left(i) < h.lineLeft - 0.5,
    roundRight: right(i) > h.lineRight + 0.5,
  }));
}
