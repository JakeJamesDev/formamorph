import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { APP_VERSION } from '@/lib/version';

// The build class is a compile-time constant, so the one platform that reads off it is only reachable
// through the module it comes from.
const build = vi.hoisted(() => ({ target: '' }));
vi.mock('@/lib/buildInfo', () => ({
  get BUILD_TARGET() { return build.target; },
  get BUILD_TAG() { return build.target || 'dev'; },
  buildSignature: () => '',
}));

const { CLIENT_HEADER, clientPlatform, watchClientVersion } = await import('@/lib/clientIdentity');

const API = 'https://api.example.test/api';

/** A canned reply, standing in for whatever the real `fetch` would have returned. */
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const refusal = { success: false, code: 'CLIENT_UPDATE_REQUIRED', minVersion: '2.18.0', feature: 'Contests' };

let stop: (() => void) | null = null;

beforeEach(() => {
  build.target = '';
  delete (window as { formamorphDesktop?: unknown }).formamorphDesktop;
});

afterEach(() => {
  stop?.();
  stop = null;
  vi.unstubAllGlobals();
  delete (window as { formamorphDesktop?: unknown }).formamorphDesktop;
});

/** Install the watch over a stubbed `fetch` that answers every call with `answer`. */
const arrange = (answer: () => Response) => {
  // Typed parameters, so each recorded call is the pair the wrapper passed rather than an empty tuple.
  const inner = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => answer());
  vi.stubGlobal('fetch', inner);

  const onUpdateRequired = vi.fn();
  stop = watchClientVersion(API, onUpdateRequired);
  return { inner, onUpdateRequired };
};

type Inner = ReturnType<typeof arrange>['inner'];

/** The header the inner `fetch` was called with on its `nth` call (1-based). */
const sentHeader = (inner: Inner, nth = 1): string | null => {
  const [input, init] = inner.mock.calls[nth - 1];
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  return headers.get(CLIENT_HEADER);
};

describe('the client identity header', () => {
  it('rides every request to the API', async () => {
    const { inner } = arrange(() => reply(200, { success: true }));

    await fetch(`${API}/worlds`);

    expect(sentHeader(inner)).toBe(`${APP_VERSION} web`);
  });

  it('rides nothing else', async () => {
    const { inner } = arrange(() => reply(200, { success: true }));

    await fetch('https://cdn.example.test/asset.webp');

    expect(sentHeader(inner)).toBeNull();
  });

  it('leaves the caller its own headers', async () => {
    const { inner } = arrange(() => reply(200, { success: true }));

    await fetch(`${API}/worlds`, { headers: { Authorization: 'Bearer token-abc' } });

    const [, init] = inner.mock.calls[0];
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer token-abc');
  });

  it('carries the method and body of a Request it was handed', async () => {
    const { inner } = arrange(() => reply(200, { success: true }));

    await fetch(new Request(`${API}/worlds`, {
      method: 'POST',
      body: '{"name":"x"}',
      headers: { Authorization: 'Bearer token-abc' },
    }));

    const [input, init] = inner.mock.calls[0];
    const sent = new Request(input, init);
    expect(sent.method).toBe('POST');
    expect(sent.headers.get('Authorization')).toBe('Bearer token-abc');
    expect(sent.headers.get(CLIENT_HEADER)).toBe(`${APP_VERSION} web`);
    await expect(sent.text()).resolves.toBe('{"name":"x"}');
  });
});

describe('the platform the header names', () => {
  it('is web in the browser build', () => {
    expect(clientPlatform()).toBe('web');
  });

  it('is android in the Android build, bridge or no bridge', () => {
    build.target = 'android';

    expect(clientPlatform()).toBe('android');
  });

  it('is the operating system in the desktop build', () => {
    (window as { formamorphDesktop?: unknown }).formamorphDesktop = {};

    const agents: Array<[string, string]> = [
      ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) Electron/33.0.0', 'windows'],
      ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Electron/33.0.0', 'mac'],
      ['Mozilla/5.0 (X11; Linux x86_64) Electron/33.0.0', 'linux'],
    ];

    for (const [userAgent, platform] of agents) {
      vi.stubGlobal('navigator', { userAgent });
      expect(clientPlatform()).toBe(platform);
    }
  });
});

describe('the update-required reply', () => {
  it('reports the feature and the version it needs', async () => {
    const { onUpdateRequired } = arrange(() => reply(426, refusal));

    await fetch(`${API}/contests/abc/enter`, { method: 'POST' });

    expect(onUpdateRequired).toHaveBeenCalledWith({ feature: 'Contests', minVersion: '2.18.0' });
  });

  it('leaves the body readable by the caller', async () => {
    arrange(() => reply(426, refusal));

    const response = await fetch(`${API}/contests/abc/enter`);

    // The watch reads the body to find the code; a read that consumed it would strand the caller,
    // which still has its own error to report.
    await expect(response.json()).resolves.toEqual(refusal);
  });

  it('ignores a 426 that is some other refusal', async () => {
    const { onUpdateRequired } = arrange(() => reply(426, { success: false, code: 'SOMETHING_ELSE' }));

    await fetch(`${API}/worlds`);

    expect(onUpdateRequired).not.toHaveBeenCalled();
  });

  it('ignores a 426 from somewhere that is not the API', async () => {
    const { onUpdateRequired } = arrange(() => reply(426, refusal));

    await fetch('https://cdn.example.test/asset.webp');

    expect(onUpdateRequired).not.toHaveBeenCalled();
  });

  it('ignores a body that is not JSON at all', async () => {
    const { onUpdateRequired } = arrange(() => new Response('<html>gateway</html>', { status: 426 }));

    await fetch(`${API}/worlds`);

    expect(onUpdateRequired).not.toHaveBeenCalled();
  });

  it('says nothing about a reply that is not a refusal', async () => {
    const { onUpdateRequired } = arrange(() => reply(200, { success: true }));

    const response = await fetch(`${API}/policies`);

    expect(response.status).toBe(200);
    expect(onUpdateRequired).not.toHaveBeenCalled();
  });

  it('accepts a Request or a URL, not only a string', async () => {
    const { onUpdateRequired } = arrange(() => reply(426, refusal));

    await fetch(new Request(`${API}/worlds`, { method: 'POST' }));
    await fetch(new URL(`${API}/comments`));

    expect(onUpdateRequired).toHaveBeenCalledTimes(2);
  });

  it('restores the previous fetch when stopped', async () => {
    const { inner, onUpdateRequired } = arrange(() => reply(426, refusal));

    stop?.();
    stop = null;
    await fetch(`${API}/worlds`);

    expect(inner).toHaveBeenCalledTimes(1);
    expect(onUpdateRequired).not.toHaveBeenCalled();
  });
});
