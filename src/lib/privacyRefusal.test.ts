import { describe, expect, it, vi, afterEach } from 'vitest';
import { watchPrivacyRefusals } from '@/lib/privacyRefusal';

const API = 'https://api.example.test/api';

/** A canned reply, standing in for whatever the real `fetch` would have returned. */
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const refusal = { success: false, code: 'PRIVACY_REQUIRED', error: 'Formamorph needs updating to continue.' };

let stop: (() => void) | null = null;

afterEach(() => {
  stop?.();
  stop = null;
  vi.unstubAllGlobals();
});

/** Install the watch over a stubbed `fetch` that answers every call with `answer`. */
const arrange = (answer: () => Response) => {
  const inner = vi.fn(async () => answer());
  vi.stubGlobal('fetch', inner);

  const onRefusal = vi.fn();
  stop = watchPrivacyRefusals(API, onRefusal);
  return { inner, onRefusal };
};

describe('watchPrivacyRefusals', () => {
  it('reports the refusal when an API call is answered with the code', async () => {
    const { onRefusal } = arrange(() => reply(403, refusal));

    await fetch(`${API}/worlds/abc/like`, { method: 'POST' });

    expect(onRefusal).toHaveBeenCalledTimes(1);
  });

  it('leaves the body readable by the caller', async () => {
    arrange(() => reply(403, refusal));

    const response = await fetch(`${API}/worlds`);

    // The watch reads the body to find the code; a read that consumed it would strand every caller
    // that reports the server's own message.
    await expect(response.json()).resolves.toEqual(refusal);
  });

  it('ignores a 403 that is some other refusal', async () => {
    const { onRefusal } = arrange(() => reply(403, { success: false, code: 'TERMS_REQUIRED', error: 'no' }));

    await fetch(`${API}/worlds`, { method: 'POST' });

    expect(onRefusal).not.toHaveBeenCalled();
  });

  it('ignores a 403 from somewhere that is not the API', async () => {
    const { onRefusal } = arrange(() => reply(403, refusal));

    await fetch('https://cdn.example.test/asset.webp');

    expect(onRefusal).not.toHaveBeenCalled();
  });

  it('ignores a body that is not JSON at all', async () => {
    const { onRefusal } = arrange(() => new Response('<html>gateway</html>', { status: 403 }));

    await fetch(`${API}/worlds`);

    expect(onRefusal).not.toHaveBeenCalled();
  });

  it('passes the response through untouched', async () => {
    arrange(() => reply(200, { success: true }));

    const response = await fetch(`${API}/policies`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
  });

  it('accepts a Request or a URL, not only a string', async () => {
    const { onRefusal } = arrange(() => reply(403, refusal));

    await fetch(new Request(`${API}/worlds`, { method: 'POST' }));
    await fetch(new URL(`${API}/comments`));

    expect(onRefusal).toHaveBeenCalledTimes(2);
  });

  it('restores the previous fetch when stopped', async () => {
    const { inner, onRefusal } = arrange(() => reply(403, refusal));

    stop?.();
    stop = null;
    await fetch(`${API}/worlds`);

    expect(inner).toHaveBeenCalledTimes(1);
    expect(onRefusal).not.toHaveBeenCalled();
  });
});
