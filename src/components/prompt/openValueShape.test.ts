import { describe, expect, it } from 'vitest';
import { layoutHeaders, lineBoxes, traceOutline, type Box, type HeaderBox } from './openValueShape';

const box = (left: number, top: number, right: number, bottom: number): Box => ({ left, top, right, bottom });
const OPTS = { padX: 3, padY: 1, radius: 5 };

/** Subpaths in a traced outline: one per separate piece. */
const pieces = (path: string) => path.match(/M/g)?.length ?? 0;

describe('lineBoxes', () => {
  it('merges the rects of one visual line into one box', () => {
    // Nested spans report their own rects on the same line.
    expect(lineBoxes([box(10, 0, 40, 20), box(12, 2, 60, 18), box(0, 20, 30, 40)])).toEqual([
      box(10, 0, 60, 20),
      box(0, 20, 30, 40),
    ]);
  });

  it('drops empty rects', () => {
    expect(lineBoxes([box(10, 0, 10, 20), box(10, 0, 30, 20)])).toEqual([box(10, 0, 30, 20)]);
  });
});

describe('traceOutline', () => {
  it('draws one piece around a one-line value, padded', () => {
    const shape = traceOutline([box(10, 0, 60, 20)], OPTS);
    expect(shape && pieces(shape.path)).toBe(1);
    expect(shape?.bounds).toEqual(box(7, -1, 63, 21));
  });

  it('joins three overlapping wrapped lines into one piece', () => {
    const shape = traceOutline([box(50, 0, 100, 20), box(0, 20, 100, 40), box(0, 40, 30, 60)], OPTS);
    expect(shape && pieces(shape.path)).toBe(1);
  });

  it('splits a wrap whose lines do not overlap horizontally', () => {
    // The first line starts right of where the second line ends.
    const shape = traceOutline([box(70, 0, 100, 20), box(0, 20, 40, 40)], OPTS);
    expect(shape && pieces(shape.path)).toBe(2);
  });

  it('splits a wrap whose overlap is too narrow for two corners', () => {
    const shape = traceOutline([box(36, 0, 100, 20), box(0, 20, 40, 40)], OPTS);
    expect(shape && pieces(shape.path)).toBe(2);
  });

  it('keeps the top-left corner square under the header', () => {
    const shape = traceOutline([box(10, 0, 60, 20)], OPTS);
    // Path coordinates are relative to the bounds; the padded top-left corner is (0, 0).
    expect(shape?.path).toMatch(/Q 0\.0 0\.0 /);
    expect(shape?.path.match(/Q /g)?.length).toBe(4);
    const squares = [...(shape?.path.matchAll(/(?:M|L) ([\d.]+) ([\d.]+) Q \1 \2 /g) ?? [])];
    expect(squares.map((m) => `${m[1]} ${m[2]}`)).toEqual(['0.0 0.0']);
  });

  it('returns nothing for a value with no line boxes', () => {
    expect(traceOutline([], OPTS)).toBeNull();
  });
});

describe('layoutHeaders', () => {
  const BOUNDS = { left: 0, right: 400 };
  const head = (left: number, width: number, lineLeft: number, lineRight: number, top = 0): HeaderBox => ({
    left, right: left + width, top, bottom: top + 16, lineLeft, lineRight,
  });
  const placed = (heads: HeaderBox[], out: ReturnType<typeof layoutHeaders>) =>
    heads.map((h, i) => ({ left: h.left + out[i].dx, right: h.right + out[i].dx }));
  const overlaps = (a: { left: number; right: number }, b: { left: number; right: number }) =>
    a.right > b.left && b.right > a.left;

  it('leaves a lone header where its value seated it', () => {
    expect(layoutHeaders([head(20, 80, 20, 200)], BOUNDS)[0].dx).toBe(0);
  });

  it('keeps a header inside the editor at the right edge', () => {
    const [out] = layoutHeaders([head(350, 80, 350, 380)], BOUNDS);
    expect(350 + out.dx + 80).toBeLessThanOrEqual(BOUNDS.right - 4);
  });

  it('keeps a header inside the editor at the left edge', () => {
    const [out] = layoutHeaders([head(-6, 80, -6, 100)], BOUNDS);
    expect(-6 + out.dx).toBeGreaterThanOrEqual(BOUNDS.left + 4);
  });

  it('slides the left header to the right end of its own first line, and leaves the right one in place', () => {
    // The right header covers 60..140; the left value's first line ends at 230, so its header fits at 150..230.
    const heads = [head(10, 80, 10, 230), head(60, 80, 60, 300, 0)];
    const out = layoutHeaders(heads, BOUNDS);
    const [a, b] = placed(heads, out);
    expect(out[0].dx).toBe(230 - 90);
    expect(out[1].dx).toBe(0);
    expect(overlaps(a, b)).toBe(false);
  });

  it('slides the right header when the left one has no room at its own end', () => {
    // Left value is a short one-word line: its end is where the header already is.
    const heads = [head(10, 80, 10, 60), head(60, 80, 60, 300)];
    const out = layoutHeaders(heads, BOUNDS);
    expect(out[0].dx).toBe(0);
    expect(out[1].dx).toBe(300 - 140);
    const [a, b] = placed(heads, out);
    expect(overlaps(a, b)).toBe(false);
  });

  it('pushes the left header away as a last resort', () => {
    const heads = [head(100, 80, 100, 150), head(140, 80, 140, 200)];
    const out = layoutHeaders(heads, BOUNDS);
    expect(out[1].dx).toBe(0);
    expect(out[0].dx).toBeLessThan(0);
    const [a, b] = placed(heads, out);
    expect(overlaps(a, b)).toBe(false);
  });

  it('pushes the right header when the left one is against the editor edge', () => {
    const heads = [head(4, 80, 4, 40), head(30, 80, 30, 60)];
    const [a, b] = placed(heads, layoutHeaders(heads, BOUNDS));
    expect(overlaps(a, b)).toBe(false);
    expect(a.left).toBeGreaterThanOrEqual(4);
    expect(b.right).toBeLessThanOrEqual(BOUNDS.right - 4);
  });

  it('keeps both headers inside an editor too narrow to part them', () => {
    // No room to the left of the first header and none to the right of the second: a push that ignored the
    // editor would send the right header outside it, which is worse than the overlap it cures.
    const narrow = { left: 0, right: 100 };
    const heads = [head(4, 80, 4, 40), head(30, 80, 30, 60)];
    const [a, b] = placed(heads, layoutHeaders(heads, narrow));
    for (const h of [a, b]) {
      expect(h.left).toBeGreaterThanOrEqual(narrow.left);
      expect(h.right).toBeLessThanOrEqual(narrow.right);
    }
  });

  it('never moves headers that sit on different lines', () => {
    const heads = [head(10, 80, 10, 60, 0), head(30, 80, 30, 60, 40)];
    expect(layoutHeaders(heads, BOUNDS).map((o) => o.dx)).toEqual([0, 0]);
  });

  it('rounds a bottom corner only past the first line', () => {
    // Header 10..90 over a first line 10..60: the right corner overhangs, the left one does not.
    const [out] = layoutHeaders([head(10, 80, 10, 60)], BOUNDS);
    expect(out).toMatchObject({ roundLeft: false, roundRight: true });
  });

  it('rounds the left corner of a header slid past its line start', () => {
    const heads = [head(300, 80, 320, 390)];
    const [out] = layoutHeaders(heads, { left: 0, right: 360 });
    expect(out).toMatchObject({ roundLeft: true, roundRight: false });
  });
});
