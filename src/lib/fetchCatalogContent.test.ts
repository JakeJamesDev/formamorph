import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadStalledMessage, fetchCatalogContent } from './fetchCatalogContent';
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
  ({ ok, headers: { get: () => null }, body: null, json: async () => body, text: async () => JSON.stringify(body) } as unknown as Response);

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

  // A fetch that never settles until its AbortSignal fires — models a server that stalls.
  const stalling = () =>
    vi.fn((_url: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const sig = init?.signal;
        const fail = () => reject(sig?.reason ?? new DOMException('Aborted', 'AbortError'));
        if (sig?.aborted) fail();
        else sig?.addEventListener('abort', fail, { once: true });
      }),
    );

  it('aborts a stalled download instead of hanging forever', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockImplementation(stalling());
    try {
      const p = fetchCatalogContent('w1', () => {}, { stallTimeoutMs: 1000 });
      const assertion = expect(p).rejects.toThrow(downloadStalledMessage(1000));
      await vi.advanceTimersByTimeAsync(1100); // past the stall window → controller aborts the fetch
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  /**
   * A fetch whose headers arrive after `headersMs` and whose chunks each take their delay. An abort rejects the
   * pending step: with the signal's reason, or with the bare AbortError older Chromium gives a body read.
   */
  const dripping = (headersMs: number, chunkDelays: number[], legacy = false) => {
    const json = JSON.stringify({ success: true, data: { contentData: { name: 'Sedge' } } });
    const size = Math.ceil(json.length / chunkDelays.length);
    const parts = chunkDelays.map((_, n) => json.slice(n * size, (n + 1) * size));
    return vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      const sig = init?.signal;
      const wait = <T,>(ms: number, value: T) => new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => resolve(value), ms);
        sig?.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(legacy ? new DOMException('The user aborted a request.', 'AbortError') : sig.reason);
        }, { once: true });
      });
      let i = 0;
      const encoder = new TextEncoder();
      const response = {
        ok: true,
        headers: { get: () => null },
        body: {
          getReader: () => ({
            read: () => i < parts.length
              ? wait(chunkDelays[i], { done: false, value: encoder.encode(parts[i++]) })
              : Promise.resolve({ done: true, value: undefined }),
          }),
        },
      } as unknown as Response;
      return wait(headersMs, response);
    });
  };

  /** A document whose visibility the test sets, firing `visibilitychange` like a browser does. */
  const fakeDocument = () => {
    const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' as DocumentVisibilityState });
    vi.stubGlobal('document', doc);
    return {
      hide: () => { doc.visibilityState = 'hidden'; doc.dispatchEvent(new Event('visibilitychange')); },
      show: () => { doc.visibilityState = 'visible'; doc.dispatchEvent(new Event('visibilitychange')); },
    };
  };

  describe('stall timer', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('names the stall when the browser rejects with a generic abort', async () => {
      vi.mocked(fetch).mockImplementation(dripping(100, [5000], true));
      const p = fetchCatalogContent('w1', () => {}, { stallTimeoutMs: 1000 });
      const assertion = expect(p).rejects.toThrow(downloadStalledMessage(1000));
      await vi.advanceTimersByTimeAsync(1200);
      await assertion;
    });

    it('gives the first chunk a full window after slow headers', async () => {
      vi.mocked(fetch).mockImplementation(dripping(900, [600]));
      const p = fetchCatalogContent('w1', () => {}, { stallTimeoutMs: 1000 });
      await vi.advanceTimersByTimeAsync(1600);
      await expect(p).resolves.toEqual({ name: 'Sedge' });
    });

    it('does not count time the page spends hidden', async () => {
      const page = fakeDocument();
      vi.mocked(fetch).mockImplementation(dripping(100, [3000]));
      const p = fetchCatalogContent('w1', () => {}, { stallTimeoutMs: 1000 });
      page.hide();
      await vi.advanceTimersByTimeAsync(3200);
      await expect(p).resolves.toEqual({ name: 'Sedge' });
    });

    it('gives a full window when the page shows again', async () => {
      const page = fakeDocument();
      vi.mocked(fetch).mockImplementation(dripping(100, [2200]));
      const p = fetchCatalogContent('w1', () => {}, { stallTimeoutMs: 1000 });
      page.hide();
      await vi.advanceTimersByTimeAsync(1900);
      page.show();
      await vi.advanceTimersByTimeAsync(600);
      await expect(p).resolves.toEqual({ name: 'Sedge' });
    });

    it('still ends a stall that continues after the page shows again', async () => {
      const page = fakeDocument();
      vi.mocked(fetch).mockImplementation(dripping(100, [60_000]));
      const p = fetchCatalogContent('w1', () => {}, { stallTimeoutMs: 1000 });
      const assertion = expect(p).rejects.toThrow(downloadStalledMessage(1000));
      page.hide();
      await vi.advanceTimersByTimeAsync(5000);
      page.show();
      await vi.advanceTimersByTimeAsync(1100);
      await assertion;
    });

    it('does not end a download when its timer runs late after a freeze', async () => {
      vi.mocked(fetch).mockImplementation(dripping(100, [1500]));
      const p = fetchCatalogContent('w1', () => {}, { stallTimeoutMs: 1000 });
      await vi.advanceTimersByTimeAsync(500);
      // A frozen page: the clock moves on while no timer runs.
      vi.setSystemTime(Date.now() + 40_000);
      await vi.advanceTimersByTimeAsync(1100);
      await expect(p).resolves.toEqual({ name: 'Sedge' });
    });
  });

  it('rejects when the caller aborts via signal', async () => {
    vi.mocked(fetch).mockImplementation(stalling());
    const ac = new AbortController();
    ac.abort(new DOMException('User canceled', 'AbortError'));
    await expect(fetchCatalogContent('w1', () => {}, { signal: ac.signal })).rejects.toThrow();
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
