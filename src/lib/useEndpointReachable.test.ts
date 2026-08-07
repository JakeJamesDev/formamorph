import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useEndpointReachable, resetEndpointReachableCache } from './useEndpointReachable';
import type { EndpointProbe } from './useAiReachable';

// The badge's only job is orchestrating probes; what makes an endpoint reachable is probeEndpoint's own
// subject, covered in useAiReachable.test.ts. Stubbing it here keeps this about caching and staleness.
const probe = vi.fn<(url: string, token: string, model: string) => Promise<EndpointProbe>>();
vi.mock('./useAiReachable', async () => {
  const actual = await vi.importActual<typeof import('./useAiReachable')>('./useAiReachable');
  return { ...actual, probeEndpoint: (...args: [string, string, string]) => probe(...args) };
});

const UP = 'http://up.test/v1';
const DOWN = 'http://down.test/v1';

beforeEach(() => {
  resetEndpointReachableCache();
  probe.mockReset();
  probe.mockImplementation(async (url) => (url === DOWN ? 'unreachable' : 'ok'));
});

describe('useEndpointReachable', () => {
  it('reports a reachable endpoint', async () => {
    const { result } = renderHook(() => useEndpointReachable(UP, '', 'm'));
    expect(result.current.checking).toBe(true);
    await waitFor(() => expect(result.current.status).toBe('ok'));
    expect(result.current.checking).toBe(false);
  });

  it('reports one that never answered', async () => {
    const { result } = renderHook(() => useEndpointReachable(DOWN, '', 'm'));
    await waitFor(() => expect(result.current.status).toBe('unreachable'));
  });

  it('probes nothing while disabled — an unpinned prompt needs no badge', async () => {
    const { result } = renderHook(() => useEndpointReachable(UP, '', 'm', false));
    await Promise.resolve();
    expect(probe).not.toHaveBeenCalled();
    expect(result.current.status).toBeNull();
    expect(result.current.checking).toBe(false);
  });

  it('serves a second consumer of the same target from cache instead of re-probing', async () => {
    const first = renderHook(() => useEndpointReachable(UP, '', 'm'));
    await waitFor(() => expect(first.result.current.status).toBe('ok'));
    expect(probe).toHaveBeenCalledTimes(1);

    const second = renderHook(() => useEndpointReachable(UP, '', 'm'));
    expect(second.result.current.status).toBe('ok'); // synchronous — no flash of "checking"
    expect(second.result.current.checking).toBe(false);
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it('issues one request when two badges for the same target mount together', async () => {
    const a = renderHook(() => useEndpointReachable(UP, '', 'm'));
    const b = renderHook(() => useEndpointReachable(UP, '', 'm'));
    await waitFor(() => expect(a.result.current.status).toBe('ok'));
    await waitFor(() => expect(b.result.current.status).toBe('ok'));
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it('treats a different model on the same host as its own target', async () => {
    const { result, rerender } = renderHook(({ m }) => useEndpointReachable(UP, '', m), {
      initialProps: { m: 'small' },
    });
    await waitFor(() => expect(result.current.status).toBe('ok'));
    rerender({ m: 'large' });
    await waitFor(() => expect(probe).toHaveBeenCalledTimes(2));
  });

  it('re-probes past the cache on recheck, and picks up a recovered endpoint', async () => {
    const { result } = renderHook(() => useEndpointReachable(DOWN, '', 'm'));
    await waitFor(() => expect(result.current.status).toBe('unreachable'));

    // The server comes back up; without a forced re-probe the badge would stay red forever.
    probe.mockResolvedValue('ok');
    act(() => result.current.recheck());
    await waitFor(() => expect(result.current.status).toBe('ok'));
    expect(probe).toHaveBeenCalledTimes(2);
  });

  it('does not let a slow answer for an abandoned target land on the current one', async () => {
    let resolveSlow: (v: EndpointProbe) => void = () => {};
    probe.mockImplementation((url) =>
      url === DOWN ? new Promise<EndpointProbe>((r) => { resolveSlow = r; }) : Promise.resolve('ok'),
    );

    const { result, rerender } = renderHook(({ u }) => useEndpointReachable(u, '', 'm'), {
      initialProps: { u: DOWN },
    });
    // Switch to a different endpoint before the first probe settles, then let the stale one land.
    rerender({ u: UP });
    await waitFor(() => expect(result.current.status).toBe('ok'));
    await act(async () => { resolveSlow('unreachable'); });

    expect(result.current.status).toBe('ok');
  });
});
