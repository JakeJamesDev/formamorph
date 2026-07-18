import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchCatalogContent } from './fetchCatalogContent';
import AuthService from '@/services/AuthService';

/** A response whose body streams `chunks` back, so the progress path is exercised. */
const streaming = (chunks: string[], contentLength?: number): Response => {
  const encoder = new TextEncoder();
  let i = 0;
  return {
    ok: true,
    headers: { get: (h: string) => (h === 'Content-Length' && contentLength ? String(contentLength) : null) },
    body: {
      getReader: () => ({
        read: async () =>
          i < chunks.length ? { done: false, value: encoder.encode(chunks[i++]) } : { done: true, value: undefined },
      }),
    },
    json: async () => JSON.parse(chunks.join('')),
  } as unknown as Response;
};

/** A response with no readable body — the non-streaming fallback. */
const plain = (body: unknown, ok = true): Response =>
  ({ ok, headers: { get: () => null }, body: null, json: async () => body } as unknown as Response);

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  vi.spyOn(console, 'error').mockImplementation(() => {});
  AuthService.token = null;
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('fetchCatalogContent', () => {
  it('unwraps the payload from data.contentData', async () => {
    vi.mocked(fetch).mockResolvedValue(plain({ success: true, data: { contentData: { name: 'Mara' } } }));
    expect(await fetchCatalogContent('w1', () => {})).toEqual({ name: 'Mara' });
  });

  it('reassembles a streamed body and reports progress', async () => {
    const json = JSON.stringify({ success: true, data: { contentData: { name: 'Sedge' } } });
    const half = Math.ceil(json.length / 2);
    vi.mocked(fetch).mockResolvedValue(streaming([json.slice(0, half), json.slice(half)], json.length));

    const seen: number[] = [];
    const out = await fetchCatalogContent('w1', (f) => seen.push(f));

    expect(out).toEqual({ name: 'Sedge' });
    expect(seen.at(-1)).toBe(1); // finishes at 100%
    expect(seen.every((f) => f > 0 && f <= 1)).toBe(true);
  });

  it('reports an indeterminate bar when the size is unknown', async () => {
    const json = JSON.stringify({ success: true, data: { contentData: {} } });
    vi.mocked(fetch).mockResolvedValue(streaming([json])); // no Content-Length

    const seen: number[] = [];
    await fetchCatalogContent('w1', (f) => seen.push(f));

    expect(seen).toEqual([-1]); // -1, never a fabricated fraction
  });

  it('decodes multi-byte characters split across chunks', async () => {
    // 'é' is two bytes; a chunk boundary through it would corrupt without streaming decode.
    const json = JSON.stringify({ success: true, data: { contentData: { name: 'café' } } });
    const bytes = new TextEncoder().encode(json);
    const cut = bytes.indexOf(0xc3) + 1; // mid-character
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      headers: { get: () => String(bytes.length) },
      body: {
        getReader: () => {
          let i = 0;
          const parts = [bytes.slice(0, cut), bytes.slice(cut)];
          return { read: async () => (i < parts.length ? { done: false, value: parts[i++] } : { done: true }) };
        },
      },
    } as unknown as Response);

    expect(await fetchCatalogContent('w1', () => {})).toEqual({ name: 'café' });
  });

  it('throws the server error message', async () => {
    vi.mocked(fetch).mockResolvedValue(plain({ error: 'Not found' }, false));
    await expect(fetchCatalogContent('w1', () => {})).rejects.toThrow('Not found');
  });

  it('throws on a well-formed response with no data', async () => {
    vi.mocked(fetch).mockResolvedValue(plain({ success: false }));
    await expect(fetchCatalogContent('w1', () => {})).rejects.toThrow(/Invalid data/);
  });

  it('sends the auth header only when signed in', async () => {
    vi.mocked(fetch).mockResolvedValue(plain({ success: true, data: { contentData: {} } }));

    await fetchCatalogContent('w1', () => {});
    expect((vi.mocked(fetch).mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBeUndefined();

    AuthService.token = 'tok';
    await fetchCatalogContent('w1', () => {});
    expect((vi.mocked(fetch).mock.calls[1][1]?.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });
});
