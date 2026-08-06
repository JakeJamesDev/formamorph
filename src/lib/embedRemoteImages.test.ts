import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { World } from '@/types';

const fetchAsDataUrl = vi.fn();
vi.mock('./imageSource', () => ({ fetchAsDataUrl: (...a: unknown[]) => fetchAsDataUrl(...a) }));

const { embedWorldRemoteImages, remoteWorldImages } = await import('./embedRemoteImages');

const world = (): World => ({
  id: 'w',
  version: '2.9.2',
  worldOverview: { name: 'W', thumbnail: 'https://host/thumb.png' },
  entities: [
    { id: 'e1', name: 'A', images: ['https://host/a1.png', 'data:image/webp;base64,KEEP'] },
    { id: 'e2', name: 'B', images: ['data:image/webp;base64,ONLY'] },
  ],
  locations: [{ id: 'l1', name: 'L', backgroundImage: 'https://host/bg.png' }],
} as unknown as World);

beforeEach(() => {
  fetchAsDataUrl.mockReset();
  fetchAsDataUrl.mockImplementation(async (url: string) => `data:image/webp;base64,EMBEDDED(${url})`);
});

describe('remoteWorldImages', () => {
  it('finds every linked image across thumbnail, entities, and locations', () => {
    expect(remoteWorldImages(world())).toEqual([
      'https://host/thumb.png',
      'https://host/a1.png',
      'https://host/bg.png',
    ]);
  });

  it('reports none for a world that embeds everything, so the export dialog stays out of the way', () => {
    const w = world();
    w.worldOverview.thumbnail = 'data:image/webp;base64,T';
    w.entities[0].images = ['data:image/webp;base64,A'];
    w.locations[0].backgroundImage = 'data:image/webp;base64,B';
    expect(remoteWorldImages(w)).toEqual([]);
  });
});

describe('embedWorldRemoteImages', () => {
  it('replaces every linked image with its downloaded bytes and leaves embedded ones alone', async () => {
    const { world: out, failures } = await embedWorldRemoteImages(world());
    expect(failures).toEqual([]);
    expect(out.worldOverview.thumbnail).toBe('data:image/webp;base64,EMBEDDED(https://host/thumb.png)');
    expect(out.entities[0].images).toEqual([
      'data:image/webp;base64,EMBEDDED(https://host/a1.png)',
      'data:image/webp;base64,KEEP',
    ]);
    expect(out.entities[1].images).toEqual(['data:image/webp;base64,ONLY']);
    expect(out.locations[0].backgroundImage).toBe('data:image/webp;base64,EMBEDDED(https://host/bg.png)');
  });

  it('keeps the link and reports the failure rather than emptying a slot it could not download', async () => {
    fetchAsDataUrl.mockImplementation(async (url: string) => {
      if (url.includes('bg')) throw new Error('Couldn\'t download the image from host.');
      return `data:image/webp;base64,EMBEDDED(${url})`;
    });
    const { world: out, failures } = await embedWorldRemoteImages(world());
    expect(out.locations[0].backgroundImage).toBe('https://host/bg.png');
    expect(failures).toEqual([{ url: 'https://host/bg.png', reason: "Couldn't download the image from host." }]);
    // The rest of the world still embedded — one dead link must not abandon the whole export.
    expect(out.worldOverview.thumbnail).toContain('EMBEDDED');
  });

  it('leaves the source world untouched — the export gets its own copy', async () => {
    const original = world();
    await embedWorldRemoteImages(original);
    expect(original.worldOverview.thumbnail).toBe('https://host/thumb.png');
    expect(original.entities[0].images?.[0]).toBe('https://host/a1.png');
  });

  it('reports progress once per linked image', async () => {
    const seen: string[] = [];
    await embedWorldRemoteImages(world(), (done, total) => seen.push(`${done}/${total}`));
    expect(seen).toEqual(['0/3', '1/3', '2/3', '3/3']);
  });

  it('stops between images when the run is aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(embedWorldRemoteImages(world(), undefined, controller.signal)).rejects.toThrow(/canceled/i);
    expect(fetchAsDataUrl).not.toHaveBeenCalled();
  });
});
