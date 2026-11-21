import { describe, it, expect } from 'vitest';
import type { LayerBlend } from '@/types';
import { composeLayers, flattenLayered, type Raster, type RasterIO, type RasterLayer } from './layeredFlatten';
import { DEFAULT_LAYER_TRANSITION, type LayeredPicture } from './layeredImages';

/** One pixel as a layer source. */
const px = (r: number, g: number, b: number, a = 255): Raster => ({ width: 1, height: 1, data: new Uint8ClampedArray([r, g, b, a]) });
const layer = (pixels: Raster, blend: LayerBlend = 'normal', extra: Partial<RasterLayer> = {}): RasterLayer => ({ pixels, opacity: 1, blend, ...extra });
const one = (...layers: RasterLayer[]) => Array.from(composeLayers(1, 1, layers).data);

describe('composeLayers', () => {
  it('draws Normal source-over: an opaque Layer hides the one below', () => {
    expect(one(layer(px(0, 0, 255)), layer(px(255, 0, 0)))).toEqual([255, 0, 0, 255]);
  });

  it('scales alpha by opacity over a transparent canvas, keeping the color', () => {
    expect(one(layer(px(255, 255, 255), 'normal', { opacity: 0.5 }))).toEqual([255, 255, 255, 128]);
  });

  it('mixes a half-opacity Layer over an opaque one', () => {
    expect(one(layer(px(0, 0, 0)), layer(px(255, 255, 255), 'normal', { opacity: 0.5 }))).toEqual([128, 128, 128, 255]);
  });

  it('tints by a per-channel scale in sRGB and leaves alpha as it is', () => {
    expect(one(layer(px(255, 255, 255, 100), 'normal', { tint: '#ff8000' }))).toEqual([255, 128, 0, 100]);
    expect(one(layer(px(200, 100, 50), 'normal', { tint: '#808080' }))).toEqual([100, 50, 25, 255]);
  });

  it('multiplies over the backdrop', () => {
    expect(one(layer(px(255, 0, 255)), layer(px(128, 128, 128), 'multiply'))).toEqual([128, 0, 128, 255]);
  });

  it('screens over the backdrop', () => {
    // 0.502 + 0.502 − 0.502² = 0.752 → 192.
    expect(one(layer(px(128, 0, 255)), layer(px(128, 0, 0), 'screen'))).toEqual([192, 0, 255, 255]);
  });

  it('adds as plus-lighter, clamping each channel', () => {
    expect(one(layer(px(100, 200, 0)), layer(px(100, 100, 0), 'add'))).toEqual([200, 255, 0, 255]);
  });

  it('blends a Multiply Layer as Normal where nothing lies below', () => {
    expect(one(layer(px(10, 20, 30), 'multiply'))).toEqual([10, 20, 30, 255]);
  });

  it('applies tint before blending', () => {
    expect(one(layer(px(255, 255, 255)), layer(px(255, 255, 255), 'multiply', { tint: '#ff0000' }))).toEqual([255, 0, 0, 255]);
  });
});

describe('flattenLayered', () => {
  const reads: [string, number, number][] = [];
  const pixels: Record<string, Raster> = { base: px(0, 0, 255), top: px(255, 0, 0) };
  const io: RasterIO = {
    size: async (data) => (data === 'base' ? { width: 3, height: 2 } : { width: 9, height: 9 }),
    read: async (data, width, height) => {
      reads.push([data, width, height]);
      return { width, height, data: new Uint8ClampedArray(Array.from({ length: width * height }, () => Array.from(pixels[data].data)).flat()) };
    },
    write: async (raster, quality) => `${raster.width}x${raster.height}:${Array.from(raster.data.slice(0, 4)).join(',')}@${quality}`,
  };
  const picture: LayeredPicture = {
    kind: 'layered', entryId: 'rig', canvas: 'base', layers: [
      { id: 'a', data: 'base', opacity: 1, blend: 'normal', transition: DEFAULT_LAYER_TRANSITION },
      { id: 'empty', opacity: 1, blend: 'normal', transition: DEFAULT_LAYER_TRANSITION },
      { id: 'b', data: 'top', opacity: 0.5, blend: 'normal', transition: DEFAULT_LAYER_TRANSITION },
    ],
  };

  it('draws each non-empty Layer stretched to the canvas image\'s size', async () => {
    reads.length = 0;
    expect(await flattenLayered(picture, io)).toBe('3x2:128,0,128,255@0.92');
    expect(reads).toEqual([['base', 3, 2], ['top', 3, 2]]);
  });
});
