import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Entity, MediaList } from '@/types';

// A card export normally runs a canvas encode and a WebP container write; stub both so these tests cover
// only what a linked portrait changes.
const fetchAsDataUrl = vi.fn();
vi.mock('./imageSource', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./imageSource')>()),
  fetchAsDataUrl: (...a: unknown[]) => fetchAsDataUrl(...a),
}));
vi.mock('./imageOptim', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./imageOptim')>()),
  optimizeToWebpDataUrl: vi.fn(async (url: string) => url.replace(/^data:[^;]+/, 'data:image/webp')),
  measureDataUrl: vi.fn(async () => ({ w: 64, h: 64, bytes: 100 })),
}));
vi.mock('./entityCard', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./entityCard')>()),
  embedEntityCard: vi.fn((bytes: Uint8Array) => bytes),
}));

const morphCardImage = vi.fn(async () => 'data:image/webp;base64,ART');
vi.mock('./morphArtCanvas', () => ({ morphCardImage: (...a: unknown[]) => morphCardImage(...(a as [])) }));

// The browser's canvas is absent here: flattening reads 1×1 pixels named by each data URL's payload.
const PIXELS: Record<string, number[]> = { BODY: [200, 100, 50, 255], FACE: [255, 255, 255, 255] };
const rasterIO = {
  size: async () => ({ width: 1, height: 1 }),
  read: async (data: string) => ({ width: 1, height: 1, data: new Uint8ClampedArray(PIXELS[data.slice(data.indexOf(',') + 1)]) }),
  write: async (raster: { data: Uint8ClampedArray }) => `data:image/png;base64,${btoa(Array.from(raster.data).join('.'))}`,
};
vi.mock('./layeredFlatten', async (importOriginal) => {
  const real = await importOriginal<typeof import('./layeredFlatten')>();
  return { ...real, pictureFile: (picture: Parameters<typeof real.pictureFile>[0]) => real.pictureFile(picture, rasterIO) };
});

const { exportEntityCard } = await import('./entityFile');

const entity = (images: string[]): Entity => ({ id: 'e1', name: 'Mara', images: images.map((data) => ({ data })) });

beforeEach(() => {
  fetchAsDataUrl.mockReset();
  morphCardImage.mockClear();
  // exportEntityCard reads the final data URL's bytes back through fetch().
  vi.stubGlobal('fetch', vi.fn(async () => ({ arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer })));
});

describe('exportEntityCard with a linked portrait', () => {
  it('downloads the portrait so the card carries real pixels', async () => {
    fetchAsDataUrl.mockResolvedValue('data:image/webp;base64,DOWNLOADED');

    const blob = await exportEntityCard(entity(['https://files.example/mara.png']));

    expect(fetchAsDataUrl).toHaveBeenCalledWith('https://files.example/mara.png', expect.anything());
    expect(blob.type).toBe('image/webp');
  });

  it('fails with the host named rather than shipping a card with the wrong face', async () => {
    fetchAsDataUrl.mockRejectedValue(
      new Error("Couldn't download the image from files.example — the site may not allow it."),
    );

    await expect(exportEntityCard(entity(['https://files.example/mara.png'])))
      .rejects.toThrow(/files\.example/);
  });

  it('draws the card from slot 0, its Visibility rule ignored', async () => {
    const ruled: Entity = { id: 'e1', name: 'Mara', images: [
      { data: 'data:image/webp;base64,SLOT0', requires: [{ all: [{ kind: 'trait', id: 'knight' }] }] },
      { data: 'data:image/webp;base64,SLOT1' },
    ] };
    await exportEntityCard(ruled);
    expect(fetch).toHaveBeenCalledWith('data:image/webp;base64,SLOT0');
  });

  it('leaves an embedded portrait alone — no download for a card that already has its bytes', async () => {
    await exportEntityCard(entity(['data:image/webp;base64,ALREADY']));

    expect(fetchAsDataUrl).not.toHaveBeenCalled();
  });
});

describe('exportEntityCard with no portrait', () => {
  const seedOf = () => (morphCardImage.mock.calls[0] as unknown[])[0];

  it('seeds the Morph art with the listing id first', async () => {
    await exportEntityCard(entity([]), [], { source: { sourceId: 'listing-9', libraryId: 'lib-3' } });
    expect(seedOf()).toBe('listing-9');
  });

  it('falls back to the library item, then the entity id', async () => {
    await exportEntityCard(entity([]), [], { source: { libraryId: 'lib-3' } });
    expect(seedOf()).toBe('lib-3');
    morphCardImage.mockClear();
    await exportEntityCard(entity([]));
    expect(seedOf()).toBe('e1');
  });

  it('never draws art for an entity that has a portrait', async () => {
    await exportEntityCard(entity(['data:image/webp;base64,ALREADY']));
    expect(morphCardImage).not.toHaveBeenCalled();
  });
});

describe('exportEntityCard with a Layered Image first', () => {
  const media: MediaList = {
    body: { id: 'body', name: 'Body', kind: 'image', data: 'data:image/png;base64,BODY' },
    face: { id: 'face', name: 'Face', kind: 'image', data: 'data:image/png;base64,FACE' },
    rig: { id: 'rig', name: 'Rig', kind: 'layered', layers: [
      { id: 'b', name: 'Body', variants: [{ mediaId: 'body' }] },
      // Rules never hold outside play, so the first Variant shows (Q5).
      { id: 'f', name: 'Face', tint: '#00ff00', blend: 'multiply', opacity: 0.5, variants: [{ mediaId: 'face', requires: [{ all: [{ kind: 'trait', id: 'gone' }] }] }] },
    ] },
  };

  it('draws the card from the flattened outside-play picture, tint and blend included', async () => {
    await exportEntityCard({ id: 'e1', name: 'Mara', images: [{ mediaId: 'rig' }, { mediaId: 'body' }] }, [], {}, undefined, undefined, undefined, media);
    // White tinted green multiplies Body to (0, 100, 0); at half opacity over Body: (100, 100, 25).
    expect(fetch).toHaveBeenCalledWith(`data:image/webp;base64,${btoa('100.100.25.255')}`);
  });

  it('draws the card from the first slot that draws, as the tile does', async () => {
    const withEmpty: MediaList = { ...media, empty: { id: 'empty', name: 'Empty', kind: 'layered', layers: [{ id: 'l', name: 'Layer', variants: [] }] } };
    await exportEntityCard({ id: 'e1', name: 'Mara', images: [{ mediaId: 'empty' }, { mediaId: 'body' }] }, [], {}, undefined, undefined, undefined, withEmpty);
    expect(fetch).toHaveBeenCalledWith('data:image/webp;base64,BODY');
    expect(morphCardImage).not.toHaveBeenCalled();
  });
});
