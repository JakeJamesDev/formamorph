// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const flags = vi.hoisted(() => ({ available: true }));
// The real base ends in `/api`, so the route must not add it again.
vi.mock('@/lib/apiBase', () => ({ API_BASE_URL: 'https://api.test/api' }));
vi.mock('@/lib/hostedAi/hostedUrls', () => ({
  get HOSTED_AI_AVAILABLE() { return flags.available; },
}));

import { sendFunnelStep } from '@/lib/funnel';

describe('sendFunnelStep', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    flags.available = true;
    fetchMock.mockReset().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('posts the step name alone', () => {
    sendFunnelStep('see_levels');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.test/api/funnel/see_levels');
    expect(init).toEqual({ method: 'POST', credentials: 'omit', keepalive: true });
  });

  it('sends each step once per device', () => {
    sendFunnelStep('offer_shown');
    sendFunnelStep('offer_shown');
    sendFunnelStep('patreon_click');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('drops a rejected send without an unhandled error', async () => {
    fetchMock.mockRejectedValue(new TypeError('offline'));
    sendFunnelStep('checklist_finished');
    await Promise.resolve();
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('drops a synchronous throw', () => {
    fetchMock.mockImplementation(() => { throw new Error('blocked'); });
    expect(() => sendFunnelStep('see_levels')).not.toThrow();
  });

  it('sends nothing in a build without hosted AI', () => {
    flags.available = false;
    sendFunnelStep('see_levels');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
