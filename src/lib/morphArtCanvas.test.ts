import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Placeholder } from '@/types';
import { phValues } from '@/test/placeholderValues';
import { encodePlaceholderToken } from './placeholders';
import { gooMask, morphCardImage } from './morphArtCanvas';

const letterMask = vi.hoisted(() => vi.fn());
vi.mock('./letterMask', () => ({ letterMask }));

const W = 120, H = 60;

/** White discs on a clear RGBA buffer, as the renderer draws a body before the goo pass. */
function discs(list: Array<[number, number, number]>): Uint8ClampedArray {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (list.some(([cx, cy, r]) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r)) data.set([255, 255, 255, 255], (y * W + x) * 4);
    }
  }
  return data;
}

const alphaAt = (data: Uint8ClampedArray, x: number, y: number) => data[(y * W + x) * 4 + 3];

describe('gooMask', () => {
  it('bridges two bodies that nearly touch, as the SVG goo filter does', () => {
    const data = discs([[46, 30, 12], [74, 30, 12]]);
    expect(alphaAt(data, 60, 30)).toBe(0);
    gooMask(data, W, H, 4);
    expect(alphaAt(data, 60, 30)).toBe(255);
  });

  it('keeps bodies apart when the gap is wide', () => {
    const data = discs([[20, 30, 12], [100, 30, 12]]);
    gooMask(data, W, H, 4);
    expect(alphaAt(data, 60, 30)).toBe(0);
  });

  it('keeps a body solid inside and clear far outside, with a hard edge between', () => {
    const data = discs([[60, 30, 20]]);
    gooMask(data, W, H, 4);
    expect(alphaAt(data, 60, 30)).toBe(255);
    expect(alphaAt(data, 60, 2)).toBe(0);
    // The threshold turns the blur's soft ramp into an edge a pixel or two wide.
    const row = Array.from({ length: W }, (_, x) => alphaAt(data, x, 30));
    expect(row.filter((a) => a > 0 && a < 255).length).toBeLessThanOrEqual(4);
  });
});

describe('morphCardImage', () => {
  let loaded: () => void;
  let fontReady: boolean;
  const load = vi.fn();

  beforeEach(() => {
    fontReady = true;
    load.mockReset().mockImplementation(() => new Promise<void>((resolve) => { loaded = resolve; }));
    letterMask.mockReset().mockReturnValue({ width: 200, height: 300, ink: () => false });
    Object.defineProperty(document, 'fonts', { configurable: true, value: { load, check: () => fontReady } });
    document.documentElement.style.setProperty('--app-font', "'Lexend Variable', sans-serif");
    // jsdom has no 2D canvas; the drawing itself is covered in the browser suite.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  afterEach(() => {
    Reflect.deleteProperty(document, 'fonts');
    document.documentElement.style.removeProperty('--app-font');
    vi.restoreAllMocks();
  });

  it('measures the letter only after the app font loads', async () => {
    const image = morphCardImage('id-1', 'Mara', []).catch((error: Error) => error);
    await Promise.resolve();
    expect(load).toHaveBeenCalledWith("800 118px 'Lexend Variable', sans-serif", 'M');
    expect(letterMask).not.toHaveBeenCalled();

    loaded();
    await image;
    expect(letterMask).toHaveBeenCalledWith('M', "'Lexend Variable', sans-serif", expect.any(Number));
  });

  it('refuses to draw when the app font never arrives', async () => {
    fontReady = false;
    const image = morphCardImage('id-1', 'Mara', []);
    loaded();
    await expect(image).rejects.toThrow(/font/);
    expect(letterMask).not.toHaveBeenCalled();
  });

  it('picks the letter from a name made only of chips after they resolve', async () => {
    const king: Placeholder = { id: 'king', name: 'king', values: phValues(['Aldric']) };
    const token = encodePlaceholderToken({ id: 'king', mode: 'world', placementId: 'p1' });
    const image = morphCardImage('id-1', token, [king]).catch(() => undefined);
    loaded();
    await image;
    expect(letterMask).toHaveBeenCalledWith('A', expect.any(String), expect.any(Number));
  });
});
