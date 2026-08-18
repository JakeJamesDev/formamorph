import { describe, it, expect } from 'vitest';
import {
  fitWithin,
  dataUrlBytes,
  dataUrlMime,
  downscaleWorldImages,
  estimateEncodedBytes,
  applyWorldOptimize,
  applyImageOptimize,
  IMAGE_CAPS,
  type DownscaleDeps,
} from './imageOptim';
import type { World } from '@/types';

describe('fitWithin', () => {
  it('never upscales an image already within the cap', () => {
    expect(fitWithin(100, 80, 512)).toEqual({ w: 100, h: 80 });
    expect(fitWithin(512, 300, 512)).toEqual({ w: 512, h: 300 });
  });
  it('downscales the long edge to the cap, preserving aspect', () => {
    expect(fitWithin(4000, 2000, 1920)).toEqual({ w: 1920, h: 960 });
    expect(fitWithin(500, 1000, 500)).toEqual({ w: 250, h: 500 });
  });
  it('keeps a minimum of 1px', () => {
    expect(fitWithin(10000, 1, 100).h).toBe(1);
  });
});

describe('dataUrlBytes', () => {
  it('approximates decoded size from the base64 payload (accounts for padding)', () => {
    // "AAAA" → 3 bytes, no padding; "AAA=" → 2 bytes.
    expect(dataUrlBytes('data:image/png;base64,AAAA')).toBe(3);
    expect(dataUrlBytes('data:image/png;base64,AAA=')).toBe(2);
  });
});

describe('dataUrlMime', () => {
  it('extracts the MIME type from a data-URL (used to skip Optimize for already-WebP images)', () => {
    expect(dataUrlMime('data:image/webp;base64,AAAA')).toBe('image/webp');
    expect(dataUrlMime('data:image/png;base64,AAAA')).toBe('image/png');
  });
  it('returns empty string for a non-data-URL', () => {
    expect(dataUrlMime('BIG-thumb')).toBe('');
  });
});

describe('downscaleWorldImages', () => {
  const world: World = {
    id: 'w1',
    version: '2.0.0',
    worldOverview: {
      name: 'W', description: '', author: '', thumbnail: 'BIG-thumb', bgm: null,
      systemPrompt: '', use3DModel: false, tags: [],
    },
    stats: [],
    locations: [
      { id: 'l1', name: 'Loc1', backgroundImage: 'BIG-bg' },
      { id: 'l2', name: 'Loc2' },
    ],
    entities: [
      { id: 'e1', name: 'Ent1', images: ['BIG-e', 'BIG-e2'] },
      { id: 'e2', name: 'Ent2', images: ['small-e'] },
    ],
    traits: [],
    traitGroups: [],
    statUpdates: [],
    dictionaries: [],
  };

  const deps: DownscaleDeps = {
    shouldEncode: (url) => Promise.resolve(url.startsWith('BIG')),
    optimize: (url) => Promise.resolve(`OPT:${url}`),
  };

  it('re-encodes only the oversized image fields and passes everything else through', async () => {
    const out = await downscaleWorldImages(world, deps);
    expect(out.worldOverview.thumbnail).toBe('OPT:BIG-thumb');
    expect(out.locations[0].backgroundImage).toBe('OPT:BIG-bg');
    expect(out.locations[1].backgroundImage).toBeUndefined();
    // Every slot in a gallery is visited, not just the primary.
    expect(out.entities[0].images).toEqual(['OPT:BIG-e', 'OPT:BIG-e2']);
    expect(out.entities[1].images).toEqual(['small-e']); // within cap → untouched
    // Non-image data is preserved.
    expect(out.entities[0].name).toBe('Ent1');
    expect(out.id).toBe('w1');
  });

  it('the reencode-deps path visits the same oversized fields (no downscale)', async () => {
    const reencodeDeps: DownscaleDeps = {
      shouldEncode: (url) => Promise.resolve(url.startsWith('BIG')),
      optimize: (url) => Promise.resolve(`WEBP:${url}`),
    };
    const out = await downscaleWorldImages(world, reencodeDeps);
    expect(out.worldOverview.thumbnail).toBe('WEBP:BIG-thumb');
    expect(out.locations[0].backgroundImage).toBe('WEBP:BIG-bg');
    expect(out.entities[0].images).toEqual(['WEBP:BIG-e', 'WEBP:BIG-e2']);
    expect(out.entities[1].images).toEqual(['small-e']); // within cap → untouched
  });

  it('reports monotonic progress that ticks once per image-bearing slot (skipped ones included)', async () => {
    const calls: { done: number; total: number }[] = [];
    await downscaleWorldImages(world, deps, (done, total) => calls.push({ done, total }));
    // 5 image slots: thumbnail, 1 background (l2 has none), and 3 across the two galleries. `total` is constant.
    expect(calls.every((c) => c.total === 5)).toBe(true);
    // First call is the 0/total prime; then done climbs 1→5, never repeating or skipping.
    expect(calls.map((c) => c.done)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('an aborted signal stops the run before the next image and rejects with AbortError', async () => {
    const controller = new AbortController();
    const optimized: string[] = [];
    const abortingDeps: DownscaleDeps = {
      shouldEncode: () => Promise.resolve(true),
      optimize: (url) => {
        // Abort mid-run, as the editor's unmount cleanup does — after the first image completes.
        optimized.push(url);
        controller.abort();
        return Promise.resolve(`OPT:${url}`);
      },
    };
    await expect(downscaleWorldImages(world, abortingDeps, undefined, controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(optimized).toEqual(['BIG-thumb']); // the remaining slots were never dispatched
  });

  it('a pre-aborted signal rejects before any work', async () => {
    const controller = new AbortController();
    controller.abort();
    const spyDeps: DownscaleDeps = {
      shouldEncode: () => Promise.resolve(true),
      optimize: (url) => Promise.resolve(`OPT:${url}`),
    };
    await expect(downscaleWorldImages(world, spyDeps, undefined, controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('reports a zero total when the world has no images', async () => {
    const empty = { worldOverview: {}, entities: [], locations: [] } as unknown as World;
    const calls: { done: number; total: number }[] = [];
    await downscaleWorldImages(empty, deps, (done, total) => calls.push({ done, total }));
    expect(calls).toEqual([{ done: 0, total: 0 }]);
  });
});

describe('estimateEncodedBytes', () => {
  it('reencode (lossless) keeps most of the source and ignores the cap', () => {
    expect(estimateEncodedBytes(1_000_000, 800, 600, 'reencode', IMAGE_CAPS.thumbnail)).toBe(850_000);
  });
  it('downscale is smaller than reencode when dimensions exceed the cap', () => {
    const bytes = 1_000_000;
    const re = estimateEncodedBytes(bytes, 4000, 3000, 'reencode', IMAGE_CAPS.thumbnail);
    const down = estimateEncodedBytes(bytes, 4000, 3000, 'downscale', IMAGE_CAPS.thumbnail);
    expect(down).toBeLessThan(re);
  });
  it('within the cap, downscale (lossy) is smaller than reencode (lossless)', () => {
    const bytes = 300_000;
    const cap = IMAGE_CAPS.background;
    expect(estimateEncodedBytes(bytes, 100, 100, 'downscale', cap))
      .toBeLessThan(estimateEncodedBytes(bytes, 100, 100, 'reencode', cap));
  });
});

describe('applyWorldOptimize / applyImageOptimize (mode gating)', () => {
  const world = { worldOverview: { thumbnail: 'data:x' }, entities: [], locations: [] } as unknown as World;

  it("'off' returns the world untouched", async () => {
    expect(await applyWorldOptimize(world, 'off')).toBe(world);
  });

  it("'off' leaves an image url unchanged", async () => {
    expect(await applyImageOptimize('data:image/png;base64,AAAA', 'off')).toBe('data:image/png;base64,AAAA');
  });

  it('passes a missing image url through for any mode', async () => {
    expect(await applyImageOptimize(undefined, 'downscale')).toBeUndefined();
    expect(await applyImageOptimize(null, 'optimize', IMAGE_CAPS.entity)).toBeNull();
  });
});
