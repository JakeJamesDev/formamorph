import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Entity } from '@/types';

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

const { exportEntityCard } = await import('./entityFile');

const entity = (images: string[]): Entity => ({ id: 'e1', name: 'Mara', images } as Entity);

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
