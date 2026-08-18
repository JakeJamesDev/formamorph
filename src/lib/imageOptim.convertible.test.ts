/**
 * The widened scan and the per-mode gates: Optimize acts on every losslessly convertible image at any size,
 * Downscale only on what's over budget. Each test pins one side of that split, so collapsing the two gates
 * back into a single oversized check goes red here.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const measureInWorker = vi.fn<(url: string) => Promise<{ w: number; h: number; bytes: number }>>();
const encodeInWorker = vi.fn<(url: string, maxDim: number, lossless: boolean) => Promise<string>>();
vi.mock('./imageOptimWorkerClient', () => ({
  measureInWorker: (url: string) => measureInWorker(url),
  encodeInWorker: (url: string, maxDim: number, lossless: boolean) => encodeInWorker(url, maxDim, lossless),
}));

const { scanImages, applyImageOptimize, IMAGE_CAPS } = await import('./imageOptim');

// Within every entity budget (1024px / 600 KB); 'big' names exceed both.
const SMALL = { w: 400, h: 300, bytes: 100_000 };
const BIG = { w: 5000, h: 5000, bytes: 5_000_000 };
const measureByName = (url: string) => Promise.resolve(url.includes('big') ? BIG : SMALL);

const smallPng = 'data:image/png;base64,small';
const smallJpeg = 'data:image/jpeg;base64,small';
const smallWebp = 'data:image/webp;base64,small';
const smallGif = 'data:image/gif;base64,small';
const bigGif = 'data:image/gif;base64,big';

beforeEach(() => {
  vi.clearAllMocks();
  measureInWorker.mockImplementation(measureByName);
  encodeInWorker.mockResolvedValue('data:image/webp;base64,encoded');
});
afterEach(() => vi.unstubAllGlobals());

describe('scanImages — what the popup gets to offer', () => {
  it('surfaces a within-budget PNG as convertible, not oversized', async () => {
    const [item] = await scanImages([smallPng], IMAGE_CAPS.entity);
    expect(item).toMatchObject({ convertible: true, oversized: false, bytes: SMALL.bytes });
  });

  it('skips within-budget images that are already efficiently encoded', async () => {
    expect(await scanImages([smallJpeg, smallWebp], IMAGE_CAPS.entity)).toEqual([]);
  });

  // The test environment genuinely lacks WebCodecs ImageDecoder, which is the real Safari condition:
  // re-encoding a GIF there would flatten its animation, so nothing lossless can be offered for it.
  it('without a frame decoder, offers nothing for a within-budget GIF', async () => {
    expect('ImageDecoder' in globalThis).toBe(false);
    expect(await scanImages([smallGif], IMAGE_CAPS.entity)).toEqual([]);
  });

  it('without a frame decoder, still lists an oversized GIF — but not as convertible', async () => {
    const [item] = await scanImages([bigGif], IMAGE_CAPS.entity);
    expect(item).toMatchObject({ oversized: true, convertible: false });
  });

  it('with a frame decoder, a within-budget GIF is convertible again', async () => {
    vi.stubGlobal('ImageDecoder', class {});
    const [item] = await scanImages([smallGif], IMAGE_CAPS.entity);
    expect(item).toMatchObject({ convertible: true, oversized: false });
  });
});

describe('applyImageOptimize — per-mode gates', () => {
  it("'optimize' re-encodes a within-budget PNG losslessly at its own resolution", async () => {
    await expect(applyImageOptimize(smallPng, 'optimize', IMAGE_CAPS.entity))
      .resolves.toBe('data:image/webp;base64,encoded');
    expect(encodeInWorker).toHaveBeenCalledWith(smallPng, Infinity, true);
  });

  it("'optimize' never touches a JPEG — its lossless WebP only grows", async () => {
    await expect(applyImageOptimize(smallJpeg, 'optimize', IMAGE_CAPS.entity)).resolves.toBe(smallJpeg);
    expect(encodeInWorker).not.toHaveBeenCalled();
  });

  it("'optimize' never touches a GIF it would flatten, even an oversized one", async () => {
    await expect(applyImageOptimize(bigGif, 'optimize', IMAGE_CAPS.entity)).resolves.toBe(bigGif);
    expect(encodeInWorker).not.toHaveBeenCalled();
  });

  it("'downscale' leaves a within-budget PNG alone — size is its only concern", async () => {
    await expect(applyImageOptimize(smallPng, 'downscale', IMAGE_CAPS.entity)).resolves.toBe(smallPng);
    expect(encodeInWorker).not.toHaveBeenCalled();
  });
});
