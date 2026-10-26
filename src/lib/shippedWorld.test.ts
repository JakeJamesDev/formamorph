import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import sharp from 'sharp';
import factory from 'wasm-webp/dist/esm/webp-wasm.js';
import type { World } from '@/types';
import { worldFingerprint } from './bundledFingerprint';
import { DEFAULT_WORLDS, seedWorldData } from './defaultWorlds';
import { bytesToDataUrl, dataUrlBytes, dataUrlImageSize, dataUrlRealMime, isLosslessImage } from './imageBytes';
import { downscaleDeps } from './imageOptimCore';
import { IMAGE_CAPS } from './imageSlots';
import { worldImageItems } from './mediaIndex';
import { isAnimatedWebpUrl, nodeImageCodec, resizeRgba } from './nodeImageCodec';
import { worldPublishPayload } from './publishPayload';
import { downscaleWorldText, shippedWorldText, shipRuleFiles, skippedAnimations } from './shippedWorld';
import list from './bundledFingerprints.json';

/** A WebP of the given RGBA pixels, lossless or lossy. */
const encodeWebp = async (rgba: Uint8Array, width: number, height: number, lossless = true) =>
  bytesToDataUrl((await factory()).encode(rgba, width, height, true, { lossless: lossless ? 1 : 0, quality: lossless ? 100 : 82 })!, 'image/webp');

/** Fixed RGBA noise, which lossy WebP shrinks the way it shrinks painted art. */
function noise(width: number, height: number): Uint8Array {
  let seed = 7;
  return new Uint8Array(width * height * 4).map((_, i) => {
    seed = (seed * 1103515245 + 12345) >>> 0;
    return i % 4 === 3 ? 255 : seed >>> 24;
  });
}

/** A lossless WebP of noise, as the art harness stores generated art. */
const webp = (width: number, height: number) => encodeWebp(noise(width, height), width, height);

/** A lossy WebP of noise, as Downscale leaves it. */
const lossyWebp = (width: number, height: number) => encodeWebp(noise(width, height), width, height, false);

describe('resizeRgba', () => {
  it('averages each output pixel over the source pixels it covers', () => {
    const px = Uint8Array.from([0, 0, 0, 255, 100, 50, 20, 255, 200, 100, 40, 255, 10, 10, 10, 255]);
    expect([...resizeRgba(px, 4, 1, 2, 1)]).toEqual([50, 25, 10, 255, 105, 55, 25, 255]);
  });

  it('weighs a source pixel by the share of it an output pixel covers', () => {
    const px = Uint8Array.from([0, 0, 0, 255, 90, 90, 90, 255, 180, 180, 180, 255]);
    // Three pixels into two: each output takes one whole pixel and half of the middle one.
    expect([...resizeRgba(px, 3, 1, 2, 1)]).toEqual([30, 30, 30, 255, 150, 150, 150, 255]);
  });

  it('lends no color from a transparent pixel', () => {
    const px = Uint8Array.from([255, 0, 0, 255, 0, 0, 255, 0]);
    expect([...resizeRgba(px, 2, 1, 1, 1)]).toEqual([255, 0, 0, 128]);
  });
});

describe('nodeImageCodec', () => {
  it('fits the long edge within the cap as lossy WebP, the same bytes every run', async () => {
    const source = await webp(2048, 64);
    const first = await nodeImageCodec.encode(source, 1024);
    expect(dataUrlImageSize(first)).toEqual({ width: 1024, height: 32 });
    expect(dataUrlRealMime(first)).toBe('image/webp');
    expect(await nodeImageCodec.encode(source, 1024)).toBe(first);
  });

  it('downscales an older JPEG to WebP the same way', async () => {
    const pixels = Buffer.from((await webp(1600, 40)).split(',')[1], 'base64');
    const jpeg = await sharp(pixels).jpeg({ quality: 95 }).toBuffer();
    const out = await nodeImageCodec.encode(bytesToDataUrl(jpeg, 'image/jpeg'), 1024);
    expect(dataUrlImageSize(out)).toEqual({ width: 1024, height: 26 });
    expect(dataUrlRealMime(out)).toBe('image/webp');
  });

  it('keeps the source when the re-encode is not smaller', async () => {
    const flat = await encodeWebp(new Uint8Array(2048 * 64 * 4).fill(255), 2048, 64);
    expect(await nodeImageCodec.encode(flat, 1024)).toBe(flat);
  });

  it('refuses an image it cannot decode instead of shipping it unchanged', async () => {
    const gif = bytesToDataUrl(Buffer.from('GIF89a\x01\x00\x01\x00\x00\x00\x00', 'latin1'), 'image/gif');
    await expect(nodeImageCodec.encode(gif, 1024)).rejects.toThrow(/not image\/gif/);
  });
});

/** Veilwood's animated portraits, real art the art tickets keep. */
const animated = worldImageItems(JSON.parse(readFileSync('src/defaultworlds/veilwood.json', 'utf8')) as World)
  .map((item) => item.value)
  .filter(isAnimatedWebpUrl);

describe('downscaleWorldText', () => {
  // Tab-indented, so a re-serialized copy cannot pass for the source text.
  const world = (thumbnail: string, backdrop: string) => JSON.stringify({
    worldOverview: { name: 'Fixture', thumbnail },
    locations: [{ id: 'harbor', name: 'Harbor', images: [{ data: backdrop }] }],
    stats: [{ id: 'grit', name: 'Grit' }],
  }, null, '\t');

  it('returns the source text byte for byte when Downscale selects no image', async () => {
    const source = world(await lossyWebp(64, 64), await lossyWebp(64, 64));
    expect(await downscaleWorldText(source, nodeImageCodec)).toBe(source);
  });

  it('downscales lossless art within its budget, as the app scan selects it', async () => {
    const art = await webp(512, 64);
    const shipped = JSON.parse(await downscaleWorldText(world(art, art), nodeImageCodec)) as World;
    expect(dataUrlImageSize(shipped.locations[0].images?.[0].data ?? '')).toEqual({ width: 512, height: 64 });
    expect(isLosslessImage(shipped.locations[0].images?.[0].data ?? '')).toBe(false);
  });

  it('downscales each slot by its own budget, the same image included', async () => {
    const wide = await lossyWebp(1536, 64);
    const source = world(wide, wide);
    const shipped = JSON.parse(await downscaleWorldText(source, nodeImageCodec)) as World;
    // The thumbnail budget is 1024 px, a backdrop's 1920 px.
    expect(dataUrlImageSize(shipped.worldOverview.thumbnail ?? '')).toEqual({ width: 1024, height: 43 });
    expect(shipped.locations[0].images?.[0].data).toBe(wide);
    expect(JSON.stringify({ ...shipped, worldOverview: { ...shipped.worldOverview, thumbnail: wide } })).toBe(JSON.stringify(JSON.parse(source)));
  });

  it('ships an animated image over its budget unchanged, and names it', async () => {
    // The largest one is over the thumbnail's 500 KB budget.
    const largest = animated.reduce((a, b) => (dataUrlBytes(b) > dataUrlBytes(a) ? b : a));
    expect(dataUrlBytes(largest)).toBeGreaterThan(IMAGE_CAPS.thumbnail.maxBytes);
    const source = world(largest, await lossyWebp(64, 64));
    expect(await downscaleWorldText(source, nodeImageCodec)).toBe(source);
    expect(await skippedAnimations(source)).toEqual(['World › Thumbnail']);
  });
});

describe('shipRuleFiles', () => {
  it('reaches the modules the slot walk imports, however deep', () => {
    const names = shipRuleFiles().map((file) => file.replaceAll('\\', '/').replace(/^.*\/src\/lib\//, ''));
    for (const module of ['nodeImageCodec.ts', 'imageOptimCore.ts', 'imageSlots.ts', 'imageEncode.ts', 'mediaParents.ts',
      'entityImages.ts', 'locationImages.ts', 'mapBackground.ts', 'entityGroupTree.ts', 'locationTree.ts']) {
      expect(names).toContain(module);
    }
    expect(names.some((name) => /\.test\./.test(name))).toBe(false);
  });
});

const files = readdirSync('src/defaultworlds').filter((f) => f.endsWith('.json'));
const fingerprints = new Set(list.worlds);

/** The world's text with every image value masked, so two forms compare on everything else. */
function withoutImages(world: World): string {
  const images = new Set(worldImageItems(world).map((item) => item.value));
  return JSON.stringify(world, (_key, value: unknown) => (typeof value === 'string' && images.has(value) ? '<image>' : value));
}

describe.each(files)('the shipped copy of %s', (file) => {
  const sourceText = readFileSync(`src/defaultworlds/${file}`, 'utf8');
  const texts = async () => ({ source: sourceText, shipped: await shippedWorldText(sourceText) });

  it('keeps every id, rule and other field, and changes only image bytes', async () => {
    const { source: sourceJson, shipped: shippedJson } = await texts();
    const source = JSON.parse(sourceJson) as World;
    const shipped = JSON.parse(shippedJson) as World;
    expect(withoutImages(shipped)).toBe(withoutImages(source));
    const before = worldImageItems(source);
    const after = worldImageItems(shipped);
    expect(after.map((item) => item.id)).toEqual(before.map((item) => item.id));
    const scan = downscaleDeps(nodeImageCodec);
    for (const [i, item] of after.entries()) {
      const { value: was, budget } = before[i];
      if (item.value === was) continue;
      // A changed image is one the app's Downscale scan selects, now a smaller WebP within its long edge.
      expect(await scan.shouldEncode(was, budget)).toBe(true);
      const size = dataUrlImageSize(item.value)!;
      expect(Math.max(size.width, size.height)).toBeLessThanOrEqual(budget.maxDim);
      expect(dataUrlRealMime(item.value)).toBe('image/webp');
      expect(item.value.length).toBeLessThan(was.length);
    }
  });

  it('seeds and publishes with a fingerprint the list holds, from either form', async () => {
    const id = file.replace(/\.json$/, '');
    const seed = DEFAULT_WORLDS.find((w) => w.id === id)!;
    for (const text of Object.values(await texts())) {
      const seeded = seedWorldData(JSON.parse(text) as Record<string, unknown>, seed);
      expect(fingerprints.has(await worldFingerprint(worldPublishPayload(seeded).contentData))).toBe(true);
    }
  });
});
