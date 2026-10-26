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
  type ImageCap,
} from './imageOptim';
import type { Entity, TraitRequirementRow, World } from '@/types';
import { applyEntityImagesOptimize, type ImageCodec } from './imageOptimCore';
import { worldImageItems } from './mediaIndex';

const WOUNDED: TraitRequirementRow[] = [{ all: [{ kind: 'stat', id: 'hp', operator: '<', value: 20, unit: 'percent' }] }];

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
      systemPrompt: '', tags: [],
    },
    stats: [],
    locations: [
      { id: 'l1', name: 'Loc1', images: [{ data: 'BIG-bg' }, { data: 'BIG-bg2', requires: WOUNDED }] },
      { id: 'l2', name: 'Loc2' },
    ],
    entities: [
      { id: 'e1', name: 'Ent1', images: [{ data: 'BIG-e' }, { data: 'BIG-e2', requires: WOUNDED }] },
      { id: 'e2', name: 'Ent2', images: [{ data: 'small-e', requires: WOUNDED }] },
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
    // A location's gallery is visited slot by slot too, rules kept.
    expect(out.locations[0].images).toEqual([{ data: 'OPT:BIG-bg' }, { data: 'OPT:BIG-bg2', requires: WOUNDED }]);
    expect(out.locations[1].images).toEqual([]);
    // Every slot in a gallery is visited, not just the primary, and each keeps its own rule.
    expect(out.entities[0].images).toEqual([{ data: 'OPT:BIG-e' }, { data: 'OPT:BIG-e2', requires: WOUNDED }]);
    expect(out.entities[1].images).toEqual([{ data: 'small-e', requires: WOUNDED }]); // within cap → untouched
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
    expect(out.locations[0].images).toEqual([{ data: 'WEBP:BIG-bg' }, { data: 'WEBP:BIG-bg2', requires: WOUNDED }]);
    expect(out.entities[0].images).toEqual([{ data: 'WEBP:BIG-e' }, { data: 'WEBP:BIG-e2', requires: WOUNDED }]);
    expect(out.entities[1].images).toEqual([{ data: 'small-e', requires: WOUNDED }]); // within cap → untouched
  });

  it('reports monotonic progress that ticks once per image-bearing slot (skipped ones included)', async () => {
    const calls: { done: number; total: number }[] = [];
    await downscaleWorldImages(world, deps, (done, total) => calls.push({ done, total }));
    // 6 image slots: thumbnail, 2 in l1's gallery (l2 has none), and 3 across the two entity galleries. `total` is constant.
    expect(calls.every((c) => c.total === 6)).toBe(true);
    // First call is the 0/total prime; then done climbs 1→6, never repeating or skipping.
    expect(calls.map((c) => c.done)).toEqual([0, 1, 2, 3, 4, 5, 6]);
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

  it('visits a dictionary thumbnail under the thumbnail budget and counts it in the progress total', async () => {
    const caps: unknown[] = [];
    const capDeps: DownscaleDeps = {
      shouldEncode: (url, cap) => { if (url === 'BIG-book') caps.push(cap); return Promise.resolve(url.startsWith('BIG')); },
      optimize: (url) => Promise.resolve(`OPT:${url}`),
    };
    const withBooks = {
      ...world,
      dictionaries: [
        { id: 'd1', name: 'Lore', entries: [], thumbnail: 'BIG-book' },
        { id: 'd2', name: 'Plain', entries: [] },
      ],
    } as unknown as World;
    const calls: number[] = [];
    const out = await downscaleWorldImages(withBooks, capDeps, (_done, total) => calls.push(total));
    expect(out.dictionaries[0].thumbnail).toBe('OPT:BIG-book');
    expect(out.dictionaries[1]).toEqual(withBooks.dictionaries[1]);
    expect(caps).toEqual([IMAGE_CAPS.thumbnail]);
    expect(new Set(calls)).toEqual(new Set([7]));
  });

  it('visits each Map Background image under the map budget, rules, frame and opacity kept', async () => {
    const caps: unknown[] = [];
    const capDeps: DownscaleDeps = {
      shouldEncode: (url, cap) => { if (url.startsWith('BIG-map')) caps.push(cap); return Promise.resolve(url.startsWith('BIG')); },
      optimize: (url) => Promise.resolve(`OPT:${url}`),
    };
    const frame = { x: 1, y: 2, width: 300, height: 200 };
    const withMap: World = {
      ...world,
      worldOverview: { ...world.worldOverview, mapBackground: { images: [{ data: 'BIG-map' }, { data: 'BIG-map2', requires: WOUNDED }], frame, opacity: 0.4 } },
    };
    const totals: number[] = [];
    const out = await downscaleWorldImages(withMap, capDeps, (_done, total) => totals.push(total));
    expect(out.worldOverview.mapBackground).toEqual({
      images: [{ data: 'OPT:BIG-map' }, { data: 'OPT:BIG-map2', requires: WOUNDED }], frame, opacity: 0.4,
    });
    expect(caps).toEqual([IMAGE_CAPS.map, IMAGE_CAPS.map]);
    expect(new Set(totals)).toEqual(new Set([8]));
    // A world without one keeps the field absent.
    expect((await downscaleWorldImages(world, deps)).worldOverview).not.toHaveProperty('mapBackground');
  });

  it('shrinks every image slot the media index lists, each under its own cap', async () => {
    const seen = new Map<string, unknown>();
    const capDeps: DownscaleDeps = {
      shouldEncode: (url, cap) => { seen.set(url, cap); return Promise.resolve(true); },
      optimize: (url) => Promise.resolve(`OPT:${url}`),
    };
    const frame = { x: 0, y: 0, width: 10, height: 10 };
    const everything = {
      ...world,
      worldOverview: {
        ...world.worldOverview,
        mapBackground: { images: [{ data: 'BIG-map', requires: WOUNDED }], frame, opacity: 1 },
      },
      dictionaries: [{ id: 'd1', name: 'Lore', entries: [], thumbnail: 'BIG-book' }],
    } as unknown as World;
    const listed = worldImageItems(everything);
    expect(new Set(listed.map((i) => i.parent.kind))).toEqual(new Set(['world', 'map', 'entity', 'location', 'dictionary']));

    const out = await downscaleWorldImages(everything, capDeps);
    const after = worldImageItems(out);
    expect(after.map((i) => i.id)).toEqual(listed.map((i) => i.id));
    expect(after.map((i) => i.value)).toEqual(listed.map((i) => `OPT:${i.value}`));
    expect(after.map((i) => i.rules)).toEqual(listed.map((i) => i.rules));
    for (const i of listed) expect(seen.get(i.value)).toEqual(i.budget);
  });

  it('reports a zero total when the world has no images', async () => {
    const empty = { worldOverview: {}, entities: [], locations: [] } as unknown as World;
    const calls: { done: number; total: number }[] = [];
    await downscaleWorldImages(empty, deps, (done, total) => calls.push({ done, total }));
    expect(calls).toEqual([{ done: 0, total: 0 }]);
  });
});

describe('estimateEncodedBytes', () => {
  const source = (bytes: number, w: number, h: number, cap: ImageCap, lossless = false) => ({ bytes, w, h, cap, lossless });

  it('reencode (lossless) keeps most of the source and ignores the cap', () => {
    expect(estimateEncodedBytes(source(1_000_000, 800, 600, IMAGE_CAPS.thumbnail), 'reencode')).toBe(850_000);
  });
  it('downscale is smaller than reencode when dimensions exceed the cap', () => {
    const big = source(1_000_000, 4000, 3000, IMAGE_CAPS.thumbnail);
    expect(estimateEncodedBytes(big, 'downscale')).toBeLessThan(estimateEncodedBytes(big, 'reencode'));
  });
  it('within the cap, downscale (lossy) is smaller than reencode (lossless)', () => {
    const small = source(300_000, 100, 100, IMAGE_CAPS.background);
    expect(estimateEncodedBytes(small, 'downscale')).toBeLessThan(estimateEncodedBytes(small, 'reencode'));
  });
  it('downscale predicts about a tenth of a lossless source and half of a lossy one, within the cap', () => {
    expect(estimateEncodedBytes(source(1_000_000, 1216, 832, IMAGE_CAPS.background, true), 'downscale')).toBe(100_000);
    expect(estimateEncodedBytes(source(1_000_000, 1216, 832, IMAGE_CAPS.background), 'downscale')).toBe(500_000);
  });
  it('scales the per-format factor by the cap fit’s area', () => {
    // 2560×1440 fits the background cap at 1920×1080: 0.5625 of the area.
    expect(estimateEncodedBytes(source(1_000_000, 2560, 1440, IMAGE_CAPS.background, true), 'downscale')).toBe(56_250);
  });
  it('leaves the Optimize estimate on one factor, lossless source or not', () => {
    expect(estimateEncodedBytes(source(1_000_000, 800, 600, IMAGE_CAPS.thumbnail, true), 'reencode')).toBe(850_000);
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

/** The one-entity pass the downscale prompt, the character import and the backup restore all run. */
describe('applyEntityImagesOptimize', () => {
  const big = 'data:image/png;base64,BIG';
  // A JPEG, so being within budget is what keeps it: a PNG is a Downscale target at any size.
  const small = 'data:image/jpeg;base64,small';
  const codec: ImageCodec = {
    encode: async (url) => `data:image/webp;base64,ENC(${url.length})`,
    measure: async (url) => (url === big ? { w: 4000, h: 4000, bytes: 9_000_000 } : { w: 10, h: 10, bytes: 10 }),
  };
  const ada: Entity = { id: 'e1', name: 'Ada', images: [{ data: small }, { data: big, requires: WOUNDED }, { data: small, requires: WOUNDED }] };

  it('downscales an oversized picture and keeps every image’s rule on its own slot', async () => {
    const out = await applyEntityImagesOptimize(codec, ada, 'downscale');
    expect(out.images).toEqual([
      { data: small },
      { data: `data:image/webp;base64,ENC(${big.length})`, requires: WOUNDED },
      { data: small, requires: WOUNDED },
    ]);
  });

  it('wraps a gallery stored as data strings', async () => {
    const legacy = { id: 'e1', name: 'Ada', images: [small] } as unknown as Entity;
    expect((await applyEntityImagesOptimize(codec, legacy, 'downscale')).images).toEqual([{ data: small }]);
  });
});
