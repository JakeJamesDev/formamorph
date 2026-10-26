/**
 * The widened scan and the per-mode gates: Optimize acts on every losslessly convertible image at any size,
 * Downscale on what's over budget or stored lossless. Each test pins one side of that split, so collapsing
 * the gates back into a single check goes red here.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WEBP_ANIMATED_LOSSLESS, WEBP_LOSSLESS_4x13, WEBP_LOSSY_9x5 } from '@/test/webpFixtures';

const measureInWorker = vi.fn<(url: string) => Promise<{ w: number; h: number; bytes: number }>>();
const encodeInWorker = vi.fn<(url: string, maxDim: number, lossless: boolean) => Promise<string>>();
vi.mock('./imageOptimWorkerClient', () => ({
  measureInWorker: (url: string) => measureInWorker(url),
  encodeInWorker: (url: string, maxDim: number, lossless: boolean) => encodeInWorker(url, maxDim, lossless),
}));

const { scanImages, applyImageOptimize, estimateEncodedBytes, fitWithin, IMAGE_CAPS } = await import('./imageOptim');

// Within every entity budget (1280px / 250 KB); 'big' names exceed both.
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

  it("'downscale' leaves a within-budget JPEG alone", async () => {
    await expect(applyImageOptimize(smallJpeg, 'downscale', IMAGE_CAPS.entity)).resolves.toBe(smallJpeg);
    expect(encodeInWorker).not.toHaveBeenCalled();
  });
});

const losslessWebp = `data:image/webp;base64,${WEBP_LOSSLESS_4x13}`;
const lossyWebp = `data:image/webp;base64,${WEBP_LOSSY_9x5}`;
const animatedLosslessWebp = `data:image/webp;base64,${WEBP_ANIMATED_LOSSLESS}`;
const smallBmp = 'data:image/bmp;base64,small';

describe('Downscale targets — over budget, or stored lossless at any size', () => {
  it('lists a within-budget lossless WebP as a Downscale target Optimize cannot improve', async () => {
    const [item] = await scanImages([losslessWebp], IMAGE_CAPS.entity);
    expect(item).toMatchObject({ lossless: true, oversized: false, convertible: false });
  });

  it.each([
    ['lossless WebP', losslessWebp],
    ['PNG', smallPng],
    ['BMP', smallBmp],
  ])('turns a within-budget %s into lossy WebP within the entity cap', async (_, url) => {
    await expect(applyImageOptimize(url, 'downscale', IMAGE_CAPS.entity)).resolves.toBe('data:image/webp;base64,encoded');
    const [[encoded, maxDim, lossless]] = encodeInWorker.mock.calls;
    expect([encoded, maxDim]).toEqual([url, 1280]);
    expect(lossless).toBeFalsy();
  });

  it('leaves a within-budget lossy WebP, a static GIF and an animated lossless WebP alone', async () => {
    vi.stubGlobal('ImageDecoder', class {});
    for (const url of [lossyWebp, smallGif, animatedLosslessWebp]) {
      await expect(applyImageOptimize(url, 'downscale', IMAGE_CAPS.entity)).resolves.toBe(url);
    }
    expect(encodeInWorker).not.toHaveBeenCalled();
  });

  it('keeps an 832×1216 portrait at its size and resamples a 1300 px one to 1280', async () => {
    const sizes: Record<string, { w: number; h: number; bytes: number }> = {
      [smallPng]: { w: 832, h: 1216, bytes: 100_000 },
      [smallJpeg]: { w: 889, h: 1300, bytes: 100_000 },
    };
    measureInWorker.mockImplementation((url) => Promise.resolve(sizes[url]));
    const fitted: Array<{ w: number; h: number }> = [];
    // The encoder fits the decoded image within the long edge it is handed.
    encodeInWorker.mockImplementation((url, maxDim) => {
      fitted.push(fitWithin(sizes[url].w, sizes[url].h, maxDim));
      return Promise.resolve('data:image/webp;base64,encoded');
    });

    await applyImageOptimize(smallPng, 'downscale', IMAGE_CAPS.entity);
    await applyImageOptimize(smallJpeg, 'downscale', IMAGE_CAPS.entity);
    expect(fitted).toEqual([{ w: 832, h: 1216 }, { w: 875, h: 1280 }]);
  });

  it.each([
    ['thumbnail', 204_800],
    ['entity', 256_000],
    ['background', 921_600],
    ['map', 1_572_864],
  ] as const)('flags a %s image over budget past %i bytes', async (slot, budget) => {
    measureInWorker.mockImplementation((url) => Promise.resolve({ w: 100, h: 100, bytes: url.includes('over') ? budget + 1 : budget }));
    const [at] = await scanImages(['data:image/jpeg;base64,at'], IMAGE_CAPS[slot]);
    const [over] = await scanImages(['data:image/jpeg;base64,over'], IMAGE_CAPS[slot]);
    expect(at).toBeUndefined();
    expect(over).toMatchObject({ oversized: true, lossless: false });
  });

  it('estimates a scanned lossless source at a tenth and a lossy one at half', async () => {
    const [png, jpeg] = await scanImages([smallPng, 'data:image/jpeg;base64,big'], IMAGE_CAPS.thumbnail);
    expect(estimateEncodedBytes(png, 'downscale')).toBe(SMALL.bytes / 10);
    // 5000×5000 fits the thumbnail cap at 1024×1024.
    expect(estimateEncodedBytes(jpeg, 'downscale')).toBe(Math.round(BIG.bytes * 0.5 * (1024 * 1024) / (5000 * 5000)));
  });
});
