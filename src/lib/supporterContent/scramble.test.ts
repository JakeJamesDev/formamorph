// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isScrambledLayer, unscramble, unscrambleToCanvas, type RgbaImage } from './scramble';
import vectorFile from './scrambleVectors.json';

const bytes = (base64: string) => Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));

const vectors = vectorFile.vectors.map((vector) => ({
  ...vector,
  params: { seed: vector.seed, version: vector.version, sourceWidth: vector.sourceWidth, sourceHeight: vector.sourceHeight },
  scrambledImage: { width: vector.scrambledWidth, height: vector.scrambledHeight, data: bytes(vector.scrambled) },
  sourceBytes: bytes(vector.source),
}));

describe('unscramble', () => {
  it.each(vectors)('restores the $name shared vector exactly', ({ scrambledImage, params, sourceBytes, sourceWidth, sourceHeight }) => {
    const restored = unscramble(scrambledImage, params);
    expect(restored.width).toBe(sourceWidth);
    expect(restored.height).toBe(sourceHeight);
    expect(Array.from(restored.data)).toEqual(Array.from(sourceBytes));
  });

  it('refuses an unknown format version', () => {
    const [vector] = vectors;
    expect(() => unscramble(vector.scrambledImage, { ...vector.params, version: 2 })).toThrow(RangeError);
  });

  it('refuses an image that is not the padded size', () => {
    const vector = vectors.find((v) => v.name.startsWith('unaligned'))!;
    const cropped = { width: vector.sourceWidth, height: vector.sourceHeight, data: new Uint8Array(vector.sourceWidth * vector.sourceHeight * 4) };
    expect(() => unscramble(cropped, vector.params)).toThrow(RangeError);
  });
});

/** A 2D context whose `drawImage` copies pixels between RGBA buffers, as an unsmoothed canvas does. */
const recordingContext = (target: RgbaImage) => ({
  imageSmoothingEnabled: true,
  drawImage: (source: RgbaImage, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number) => {
    for (let row = 0; row < sh; row++) {
      for (let col = 0; col < sw; col++) {
        const x = dx + col;
        const y = dy + row;
        if (x >= target.width || y >= target.height) continue;
        const from = ((sy + row) * source.width + sx + col) * 4;
        target.data.set(source.data.subarray(from, from + 4), (y * target.width + x) * 4);
      }
    }
  },
});

describe('unscrambleToCanvas', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each(vectors)('draws the $name shared vector back at its source size', async ({ scrambledImage, params, sourceBytes }) => {
    const target = { width: params.sourceWidth, height: params.sourceHeight, data: new Uint8Array(params.sourceWidth * params.sourceHeight * 4) };
    const context = recordingContext(target);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);

    const canvas = await unscrambleToCanvas(
      { ...params, dataUrl: 'data:image/png;base64,' },
      async () => scrambledImage as unknown as HTMLCanvasElement,
    );

    expect([canvas.width, canvas.height]).toEqual([params.sourceWidth, params.sourceHeight]);
    expect(context.imageSmoothingEnabled).toBe(false);
    expect(Array.from(target.data)).toEqual(Array.from(sourceBytes));
  });
});

describe('isScrambledLayer', () => {
  it('accepts the gated route shape and nothing else', () => {
    const layer = { dataUrl: 'data:image/png;base64,AA', seed: 1, version: 1, sourceWidth: 3, sourceHeight: 5 };
    expect(isScrambledLayer(layer)).toBe(true);
    expect(isScrambledLayer(layer.dataUrl)).toBe(false);
    expect(isScrambledLayer({ ...layer, sourceWidth: 0 })).toBe(false);
    expect(isScrambledLayer({ ...layer, seed: '1' })).toBe(false);
  });
});
