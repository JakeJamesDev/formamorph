// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const flags = vi.hoisted(() => ({ available: true }));
// The real base ends in `/api`, so the route must not add it again.
vi.mock('@/lib/apiBase', () => ({ API_BASE_URL: 'https://api.test/api' }));
vi.mock('@/lib/hostedAi/hostedUrls', () => ({
  get HOSTED_AI_AVAILABLE() { return flags.available; },
}));

import { FUNNEL_STEPS, sendFunnelStep } from '@/lib/funnel';

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
    sendFunnelStep('setup_see_levels');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.test/api/funnel/setup_see_levels');
    expect(init).toEqual({ method: 'POST', credentials: 'omit', keepalive: true });
  });

  it('sends each step once per device', () => {
    sendFunnelStep('demo_offer_shown');
    sendFunnelStep('demo_offer_shown');
    sendFunnelStep('demo_patreon_click');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('drops a rejected send without an unhandled error', async () => {
    fetchMock.mockRejectedValue(new TypeError('offline'));
    sendFunnelStep('notice_checklist_finished');
    await Promise.resolve();
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('drops a synchronous throw', () => {
    fetchMock.mockImplementation(() => { throw new Error('blocked'); });
    expect(() => sendFunnelStep('locked_see_levels')).not.toThrow();
  });

  it('sends nothing in a build without hosted AI', () => {
    flags.available = false;
    sendFunnelStep('engine_see_levels');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lists each source with its own steps, and types out every other name', () => {
    expect(FUNNEL_STEPS).toEqual([
      'setup_offer_shown', 'setup_see_levels', 'setup_patreon_click', 'setup_checklist_finished',
      'demo_offer_shown', 'demo_see_levels', 'demo_patreon_click', 'demo_checklist_finished',
      'engine_offer_shown', 'engine_see_levels', 'engine_patreon_click', 'engine_checklist_finished',
      'notice_see_levels', 'notice_patreon_click', 'notice_checklist_finished',
      'locked_see_levels', 'locked_patreon_click', 'locked_checklist_finished',
    ]);
    // @ts-expect-error The notice shows on every visit, so it has no shown step.
    sendFunnelStep('notice_offer_shown');
    // @ts-expect-error The locked-preset panel has no shown step either.
    sendFunnelStep('locked_offer_shown');
    // @ts-expect-error New builds send no step without a source.
    sendFunnelStep('see_levels');
    // @ts-expect-error A v3.6.2 name, which the server still accepts from old builds.
    sendFunnelStep('offer_shown');
    // @ts-expect-error A v3.6.2 name.
    sendFunnelStep('patreon_click');
    // @ts-expect-error A v3.6.2 name.
    sendFunnelStep('checklist_finished');
  });
});
