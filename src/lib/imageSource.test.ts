import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isRemoteImage, imageHost } from './imageBytes';
import { IMAGE_CAPS } from './imageOptim';

// The optimize step runs a real canvas/worker encode; stub it so these tests cover the fetch logic only.
vi.mock('./imageOptim', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./imageOptim')>()),
  optimizeImageDataUrl: vi.fn(async (url: string) => url),
}));

const { fetchAsDataUrl } = await import('./imageSource');

describe('isRemoteImage', () => {
  it('recognizes the schemes an author can paste', () => {
    expect(isRemoteImage('http://example.com/a.png')).toBe(true);
    expect(isRemoteImage('https://example.com/a.png')).toBe(true);
    expect(isRemoteImage('HTTPS://EXAMPLE.COM/a.png')).toBe(true);
    expect(isRemoteImage('  https://example.com/a.png  ')).toBe(true);
  });

  it('treats everything the app already stores as embedded', () => {
    expect(isRemoteImage('data:image/webp;base64,AAAA')).toBe(false);
    expect(isRemoteImage('blob:http://localhost/abc')).toBe(false);
    expect(isRemoteImage('/images/a.png')).toBe(false);
    expect(isRemoteImage('')).toBe(false);
    expect(isRemoteImage(undefined)).toBe(false);
    expect(isRemoteImage(null)).toBe(false);
  });
});

describe('imageHost', () => {
  it('names the host an author would recognize', () => {
    expect(imageHost('https://files.catbox.moe/abc.png')).toBe('files.catbox.moe');
  });

  it('falls back to the raw value rather than throwing on something unparseable', () => {
    expect(imageHost('not a url')).toBe('not a url');
  });
});

describe('fetchAsDataUrl', () => {
  const blobResponse = (type: string) => ({
    ok: true,
    status: 200,
    blob: async () => new Blob(['bytes'], { type }),
  });

  beforeEach(() => {
    // jsdom has no FileReader.readAsDataURL for Blobs in every version; make it deterministic.
    vi.stubGlobal('FileReader', class {
      result = 'data:image/png;base64,Ynl0ZXM=';
      onloadend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL() { queueMicrotask(() => this.onloadend?.()); }
    });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('returns the downloaded image as a data URL', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => blobResponse('image/png')));
    await expect(fetchAsDataUrl('https://example.com/a.png', IMAGE_CAPS.entity))
      .resolves.toBe('data:image/png;base64,Ynl0ZXM=');
  });

  it('names the host when the download is blocked, so the author knows which link to fix', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(fetchAsDataUrl('https://blocked.example/a.png', IMAGE_CAPS.entity))
      .rejects.toThrow(/blocked\.example/);
  });

  it('reports a non-2xx answer rather than embedding an error page', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, blob: async () => new Blob([]) })));
    await expect(fetchAsDataUrl('https://example.com/gone.png', IMAGE_CAPS.entity))
      .rejects.toThrow(/404/);
  });

  it('rejects a link that resolves to something that is not an image', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => blobResponse('text/html')));
    await expect(fetchAsDataUrl('https://example.com/page', IMAGE_CAPS.entity))
      .rejects.toThrow(/isn't an image/);
  });
});
