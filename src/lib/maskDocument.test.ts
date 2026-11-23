import { describe, expect, it } from 'vitest';
import {
  MaskStrokePainter, applyMaskOp, canRedoMask, canUndoMask, dabCoverage, grayFromRgba, newMaskDocument, redoMask,
  replayMask, rgbaFromGray, undoMask, type MaskOp, type MaskStroke,
} from './maskDocument';

const W = 40;
const H = 20;
const black = () => new Uint8ClampedArray(W * H);
const at = (raster: Uint8ClampedArray, x: number, y: number) => raster[y * W + x];
const stroke = (over: Partial<MaskStroke> = {}): MaskStroke => ({
  kind: 'stroke', mode: 'brush', size: 10, softness: 0, points: [{ x: 10, y: 10 }, { x: 30, y: 10 }], ...over,
});
const replay = (ops: MaskOp[], base = black()) =>
  replayMask(ops.reduce(applyMaskOp, newMaskDocument(W, H)), base);

describe('mask document operations', () => {
  it('a brush stroke paints white along its path and leaves the rest black', () => {
    const out = replay([stroke()]);
    expect(at(out, 10, 10)).toBe(255);
    expect(at(out, 20, 10)).toBe(255);
    expect(at(out, 30, 10)).toBe(255);
    expect(at(out, 20, 2)).toBe(0);
    expect(at(out, 2, 10)).toBe(0);
  });

  it('an eraser stroke paints black over white', () => {
    const out = replay([{ kind: 'fill' }, stroke({ mode: 'eraser' })]);
    expect(at(out, 20, 10)).toBe(0);
    expect(at(out, 20, 2)).toBe(255);
  });

  it('a hard edge steps from full to none within about a pixel', () => {
    const out = replay([stroke({ size: 16, points: [{ x: 20, y: 10 }] })]);
    expect(at(out, 20, 4)).toBe(255);
    expect(at(out, 20, 1)).toBe(0);
  });

  it('a soft edge fades: gray between the center and the rim, falling outward', () => {
    const out = replay([stroke({ size: 18, softness: 1, points: [{ x: 20, y: 10 }] })]);
    const center = at(out, 20, 10);
    const mid = at(out, 24, 10);
    const near = at(out, 27, 10);
    expect(center).toBeGreaterThan(200);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(center);
    expect(near).toBeLessThan(mid);
    expect(at(out, 30, 10)).toBe(0);
  });

  it('a soft stroke painted slowly matches one painted fast: coverage within a stroke is the highest, not the sum', () => {
    const fast = replay([stroke({ size: 18, softness: 1, points: [{ x: 10, y: 10 }, { x: 30, y: 10 }] })]);
    const steps = Array.from({ length: 41 }, (_, i) => ({ x: 10 + i / 2, y: 10 }));
    const slow = replay([stroke({ size: 18, softness: 1, points: steps })]);
    expect(at(fast, 20, 14)).toBeGreaterThan(0);
    expect(Math.abs(at(slow, 20, 14) - at(fast, 20, 14))).toBeLessThanOrEqual(3);
  });

  it('a second soft stroke builds on the first', () => {
    const dab = stroke({ size: 18, softness: 1, points: [{ x: 20, y: 10 }] });
    expect(at(replay([dab, dab]), 24, 10)).toBeGreaterThan(at(replay([dab]), 24, 10));
  });

  it('fill makes every pixel white and clear every pixel black', () => {
    expect(replay([{ kind: 'fill' }]).every((v) => v === 255)).toBe(true);
    expect(replay([{ kind: 'fill' }, { kind: 'clear' }]).every((v) => v === 0)).toBe(true);
  });

  it('invert swaps white and black and mirrors gray', () => {
    const base = black();
    base[0] = 200;
    const out = replay([stroke(), { kind: 'invert' }], base);
    expect(at(out, 20, 10)).toBe(0);
    expect(at(out, 20, 2)).toBe(255);
    expect(out[0]).toBe(55);
  });

  it('replays over the base mask and leaves the base unchanged', () => {
    const base = black().fill(128);
    const out = replay([stroke({ mode: 'eraser' })], base);
    expect(at(out, 20, 2)).toBe(128);
    expect(at(out, 20, 10)).toBe(0);
    expect(base.every((v) => v === 128)).toBe(true);
  });

  it('a stroke off the edge paints only the pixels inside', () => {
    const out = replay([stroke({ points: [{ x: -3, y: -3 }, { x: 2, y: 2 }] })]);
    expect(at(out, 0, 0)).toBe(255);
    expect(out.length).toBe(W * H);
  });
});

describe('mask document undo and redo', () => {
  const ops: MaskOp[] = [stroke(), { kind: 'invert' }, { kind: 'fill' }, stroke({ mode: 'eraser', points: [{ x: 5, y: 5 }] }), { kind: 'clear' }];

  it('undo steps back through every kind of operation, matching the replay of the shorter list', () => {
    let doc = ops.reduce(applyMaskOp, newMaskDocument(W, H));
    for (let n = ops.length - 1; n >= 0; n--) {
      doc = undoMask(doc);
      expect(replayMask(doc, black())).toEqual(replay(ops.slice(0, n)));
    }
    expect(canUndoMask(doc)).toBe(false);
    expect(undoMask(doc)).toBe(doc);
  });

  it('redo steps forward again to the same raster', () => {
    const full = ops.reduce(applyMaskOp, newMaskDocument(W, H));
    let doc = full;
    for (let i = 0; i < ops.length; i++) doc = undoMask(doc);
    for (let n = 1; n <= ops.length; n++) {
      doc = redoMask(doc);
      expect(replayMask(doc, black())).toEqual(replay(ops.slice(0, n)));
    }
    expect(canRedoMask(doc)).toBe(false);
    expect(redoMask(doc)).toBe(doc);
    expect(doc.ops).toEqual(full.ops);
  });

  it('a new operation after an undo drops the redo', () => {
    const doc = applyMaskOp(undoMask(applyMaskOp(newMaskDocument(W, H), stroke())), { kind: 'fill' });
    expect(canRedoMask(doc)).toBe(false);
    expect(doc.ops).toEqual([{ kind: 'fill' }]);
  });
});

describe('live painting', () => {
  it('a stroke painted point by point matches the replay of its operation', () => {
    const raster = black();
    const painter = new MaskStrokePainter(raster, W, H, 'brush', 12, 0.6);
    for (const point of [{ x: 4, y: 4 }, { x: 15, y: 12 }, { x: 33, y: 6 }]) painter.extend(point);
    expect(raster).toEqual(replay([painter.op()]));
  });

  it('reports the pixels it changed', () => {
    const painter = new MaskStrokePainter(black(), W, H, 'brush', 4, 0);
    expect(painter.extend({ x: 10, y: 10 })).toEqual({ x0: 8, y0: 8, x1: 13, y1: 13 });
    expect(painter.extend({ x: -20, y: -20 })).not.toBeNull();
  });
});

describe('dab coverage', () => {
  it('is full at the center and none past the rim, at any softness', () => {
    for (const softness of [0, 0.5, 1]) {
      expect(dabCoverage(0, 10, softness)).toBe(1);
      expect(dabCoverage(10.5, 10, softness)).toBe(0);
    }
  });

  it('keeps full coverage further out on a harder dab', () => {
    expect(dabCoverage(7, 10, 0.2)).toBeGreaterThan(dabCoverage(7, 10, 0.8));
  });
});

describe('pixels', () => {
  it('reads luminance, with transparent pixels as black', () => {
    const rgba = new Uint8ClampedArray([255, 255, 255, 255, 255, 255, 255, 0, 0, 255, 0, 255, 128, 128, 128, 255]);
    expect([...grayFromRgba(rgba)]).toEqual([255, 0, 182, 128]);
  });

  it('writes opaque gray', () => {
    expect([...rgbaFromGray(new Uint8ClampedArray([0, 200]))]).toEqual([0, 0, 0, 255, 200, 200, 200, 255]);
  });
});
