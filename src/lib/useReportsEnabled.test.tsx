import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';

/**
 * The service is mocked at the module path rather than spied on the singleton, because each case reloads
 * the hook to get a fresh cache — and a reloaded hook imports a fresh service, which a spy on the
 * already-imported instance would never reach.
 */
const mocks = vi.hoisted(() => ({ fetchMeta: vi.fn() }));

vi.mock('@/services/ReportService', () => ({
  default: { fetchMeta: mocks.fetchMeta },
  AlreadyReportedError: class extends Error {},
}));

const meta = {
  categories: ['illegal', 'hate', 'spam', 'stolen', 'malicious', 'other'],
  targetKinds: ['listing', 'comment', 'profile'],
  outcomes: ['actioned', 'dismissed'],
  detailsMax: 2000,
  noteMax: 1000,
};

afterEach(() => {
  cleanup();
  mocks.fetchMeta.mockReset();
});

/**
 * A hook with an empty cache.
 *
 * The answer is remembered for the session on purpose, so a case sharing that cache would be asserting
 * the previous case's server rather than its own.
 */
const freshHook = async () => {
  vi.resetModules();
  const { useReportsEnabled } = await import('./useReportsEnabled');
  return useReportsEnabled;
};

describe('deciding whether to offer report controls', () => {
  it('offers nothing to a signed-out visitor, without asking the server', async () => {
    const hook = await freshHook();
    mocks.fetchMeta.mockResolvedValue(meta);

    const { result } = renderHook(() => hook(false));

    expect(result.current).toBe(false);
    await waitFor(() => expect(mocks.fetchMeta).not.toHaveBeenCalled());
  });

  it('offers them once the server says it takes reports', async () => {
    const hook = await freshHook();
    mocks.fetchMeta.mockResolvedValue(meta);

    const { result } = renderHook(() => hook(true));

    await waitFor(() => expect(result.current).toBe(true));
  });

  it('offers nothing against a server that has never heard of reports', async () => {
    const hook = await freshHook();
    mocks.fetchMeta.mockResolvedValue(null);

    const { result } = renderHook(() => hook(true));

    await waitFor(() => expect(result.current).toBe(false));
  });

  it('asks once for an answer it got, however many controls are on screen', async () => {
    const hook = await freshHook();
    mocks.fetchMeta.mockResolvedValue(meta);

    const first = renderHook(() => hook(true));
    await waitFor(() => expect(first.result.current).toBe(true));
    const second = renderHook(() => hook(true));
    await waitFor(() => expect(second.result.current).toBe(true));

    expect(mocks.fetchMeta).toHaveBeenCalledTimes(1);
  });

  it('asks again after a failure rather than treating it as a no', async () => {
    // The bug this guards: a 401 on a retired token, cached as "this server has no reports", hides every
    // report control for the rest of the session — including right after the sign-in that fixed it.
    const hook = await freshHook();
    mocks.fetchMeta.mockResolvedValueOnce(undefined).mockResolvedValue(meta);

    const first = renderHook(() => hook(true));
    await waitFor(() => expect(mocks.fetchMeta).toHaveBeenCalledTimes(1));
    expect(first.result.current).toBe(false);

    const second = renderHook(() => hook(true));

    await waitFor(() => expect(second.result.current).toBe(true));
    expect(mocks.fetchMeta).toHaveBeenCalledTimes(2);
  });

  it('stops offering them when the reader signs out', async () => {
    const hook = await freshHook();
    mocks.fetchMeta.mockResolvedValue(meta);

    const { result, rerender } = renderHook(({ signedIn }) => hook(signedIn), {
      initialProps: { signedIn: true },
    });
    await waitFor(() => expect(result.current).toBe(true));

    rerender({ signedIn: false });

    expect(result.current).toBe(false);
  });
});
