/**
 * The brush editor's Weather Mask as a document: an ordered list of operations with undo and redo, and the
 * grayscale raster they replay to. Pure: it holds no canvas, so a renderer draws what it returns.
 *
 * A raster is one byte per pixel, row by row: 255 shows the weather, 0 hides it.
 */

export type MaskTool = 'brush' | 'eraser';

/** A point in mask pixels. */
export interface MaskPoint { x: number; y: number }

/** One stroke: dabs along its points. `size` is the dab's diameter in mask pixels; `softness` 0 is a hard edge, 1 fades from the center. */
export interface MaskStroke {
  kind: 'stroke';
  mode: MaskTool;
  size: number;
  softness: number;
  points: readonly MaskPoint[];
}

export type MaskOp = MaskStroke | { kind: 'fill' } | { kind: 'clear' } | { kind: 'invert' };

export interface MaskDocument {
  readonly width: number;
  readonly height: number;
  /** Applied operations, oldest first. */
  readonly ops: readonly MaskOp[];
  /** Undone operations, the next redo last. */
  readonly undone: readonly MaskOp[];
}

export const newMaskDocument = (width: number, height: number): MaskDocument => ({ width, height, ops: [], undone: [] });

/** `doc` with `op` applied. A new operation drops the redo stack. */
export const applyMaskOp = (doc: MaskDocument, op: MaskOp): MaskDocument => ({ ...doc, ops: [...doc.ops, op], undone: [] });

export const canUndoMask = (doc: MaskDocument): boolean => doc.ops.length > 0;
export const canRedoMask = (doc: MaskDocument): boolean => doc.undone.length > 0;

export function undoMask(doc: MaskDocument): MaskDocument {
  const last = doc.ops.at(-1);
  return last ? { ...doc, ops: doc.ops.slice(0, -1), undone: [...doc.undone, last] } : doc;
}

export function redoMask(doc: MaskDocument): MaskDocument {
  const next = doc.undone.at(-1);
  return next ? { ...doc, ops: [...doc.ops, next], undone: doc.undone.slice(0, -1) } : doc;
}

/** A dab's coverage, 0 to 1, at `distance` from its center. A hard dab keeps a one-pixel antialiased rim. */
export function dabCoverage(distance: number, radius: number, softness: number): number {
  const feather = Math.max(radius * Math.min(Math.max(softness, 0), 1), 1);
  const t = Math.min(Math.max((radius - distance) / feather, 0), 1);
  // Smoothstep, so a soft edge has no visible ring where the fade starts.
  return t * t * (3 - 2 * t);
}

/** The dab centers of a stroke segment from `from` (exclusive) to `to`, spaced a quarter radius apart. */
export function segmentDabs(from: MaskPoint | null, to: MaskPoint, size: number): MaskPoint[] {
  if (!from) return [to];
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const spacing = Math.max(size / 8, 0.5);
  const count = Math.ceil(distance / spacing);
  const out: MaskPoint[] = [];
  for (let i = 1; i <= count; i++) {
    const t = i / count;
    out.push({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });
  }
  return out;
}

/** A pixel rectangle, `x1` and `y1` exclusive. */
export interface MaskRect { x0: number; y0: number; x1: number; y1: number }

/** The smallest rectangle holding both, or the one given when the other is null. */
export const unionRect = (a: MaskRect | null, b: MaskRect | null): MaskRect | null => {
  if (!a) return b;
  if (!b) return a;
  return { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };
};

/**
 * A stroke being painted onto a raster, dab by dab. Within one stroke the coverage of overlapping dabs is the
 * highest one, not their sum, so a slow stroke paints as dark as a fast one.
 */
export class MaskStrokePainter {
  private readonly before: Uint8ClampedArray;
  private readonly coverage: Uint8ClampedArray;
  private last: MaskPoint | null = null;
  private readonly points: MaskPoint[] = [];

  constructor(
    private readonly raster: Uint8ClampedArray,
    private readonly width: number,
    private readonly height: number,
    readonly mode: MaskTool,
    readonly size: number,
    readonly softness: number,
  ) {
    this.before = raster.slice();
    this.coverage = new Uint8ClampedArray(raster.length);
  }

  /** Paints to `point` and returns the pixels it changed, or null for none. */
  extend(point: MaskPoint): MaskRect | null {
    let dirty: MaskRect | null = null;
    for (const dab of segmentDabs(this.last, point, this.size)) dirty = unionRect(dirty, this.stamp(dab));
    this.last = point;
    this.points.push(point);
    return dirty;
  }

  /** The operation this stroke adds to the document. */
  op(): MaskStroke {
    return { kind: 'stroke', mode: this.mode, size: this.size, softness: this.softness, points: [...this.points] };
  }

  private stamp({ x, y }: MaskPoint): MaskRect | null {
    const radius = this.size / 2;
    const x0 = Math.max(0, Math.floor(x - radius));
    const y0 = Math.max(0, Math.floor(y - radius));
    const x1 = Math.min(this.width, Math.ceil(x + radius) + 1);
    const y1 = Math.min(this.height, Math.ceil(y + radius) + 1);
    if (x0 >= x1 || y0 >= y1) return null;
    const erase = this.mode === 'eraser';
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        const a = Math.round(255 * dabCoverage(Math.hypot(px + 0.5 - x, py + 0.5 - y), radius, this.softness));
        const i = py * this.width + px;
        if (a <= this.coverage[i]) continue;
        this.coverage[i] = a;
        const v = this.before[i];
        this.raster[i] = erase ? v - (v * a) / 255 : v + ((255 - v) * a) / 255;
      }
    }
    return { x0, y0, x1, y1 };
  }
}

/** Applies one operation to `raster` in place. */
export function paintMaskOp(raster: Uint8ClampedArray, width: number, height: number, op: MaskOp): void {
  switch (op.kind) {
    case 'fill': raster.fill(255); return;
    case 'clear': raster.fill(0); return;
    case 'invert':
      for (let i = 0; i < raster.length; i++) raster[i] = 255 - raster[i];
      return;
    case 'stroke': {
      const painter = new MaskStrokePainter(raster, width, height, op.mode, op.size, op.softness);
      for (const point of op.points) painter.extend(point);
    }
  }
}

/** The raster `doc` replays to over `base`, a raster of the document's size. `base` is left unchanged. */
export function replayMask(doc: MaskDocument, base: Uint8ClampedArray): Uint8ClampedArray {
  const raster = base.slice();
  for (const op of doc.ops) paintMaskOp(raster, doc.width, doc.height, op);
  return raster;
}

/** A raster from RGBA pixels by luminance, with transparent pixels reading as black. */
export function grayFromRgba(rgba: Uint8ClampedArray): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba.length / 4);
  for (let i = 0; i < out.length; i++) {
    const j = i * 4;
    const luminance = 0.2126 * rgba[j] + 0.7152 * rgba[j + 1] + 0.0722 * rgba[j + 2];
    out[i] = (luminance * rgba[j + 3]) / 255;
  }
  return out;
}

/** Opaque gray RGBA pixels from a raster: the PNG a mask saves as. */
export function rgbaFromGray(raster: Uint8ClampedArray): Uint8ClampedArray {
  const out = new Uint8ClampedArray(raster.length * 4);
  for (let i = 0; i < raster.length; i++) {
    const j = i * 4;
    out[j] = out[j + 1] = out[j + 2] = raster[i];
    out[j + 3] = 255;
  }
  return out;
}
