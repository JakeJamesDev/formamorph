import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';

// Mocked at the module path: each case reloads the hook for a fresh cache, which imports a fresh service.
const mocks = vi.hoisted(() => ({ fetchMeta: vi.fn() }));

vi.mock('@/services/ReviewService', () => ({ default: { fetchMeta: mocks.fetchMeta } }));

afterEach(() => {
  cleanup();
  mocks.fetchMeta.mockReset();
});

/** A hook with an empty session cache. */
const freshHook = async () => {
  vi.resetModules();
  const { useListingReviewMeta } = await import('./useListingReviewMeta');
  return useListingReviewMeta;
};

describe('detecting listing review', () => {
  it('reports nothing until the answer arrives', async () => {
    const hook = await freshHook();
    mocks.fetchMeta.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => hook());

    expect(result.current).toEqual({ supported: false, enabled: false });
  });

  it('reports a server with review on', async () => {
    const hook = await freshHook();
    mocks.fetchMeta.mockResolvedValue({ enabled: true });

    const { result } = renderHook(() => hook());

    await waitFor(() => expect(result.current).toEqual({ supported: true, enabled: true }));
  });

  it('reports a server with review off as supported', async () => {
    const hook = await freshHook();
    mocks.fetchMeta.mockResolvedValue({ enabled: false });

    const { result } = renderHook(() => hook());

    await waitFor(() => expect(result.current).toEqual({ supported: true, enabled: false }));
  });

  it('treats a 404 as absent and keeps that answer for the session', async () => {
    const hook = await freshHook();
    mocks.fetchMeta.mockResolvedValue(null);

    const first = renderHook(() => hook());
    await waitFor(() => expect(mocks.fetchMeta).toHaveBeenCalledTimes(1));
    first.unmount();

    const { result } = renderHook(() => hook());
    await waitFor(() => expect(result.current).toEqual({ supported: false, enabled: false }));
    expect(mocks.fetchMeta).toHaveBeenCalledTimes(1);
  });

  it('does not cache a transient failure, so the next surface asks again', async () => {
    const hook = await freshHook();
    mocks.fetchMeta.mockResolvedValueOnce(undefined).mockResolvedValueOnce({ enabled: true });

    const first = renderHook(() => hook());
    await waitFor(() => expect(mocks.fetchMeta).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(first.result.current).toEqual({ supported: false, enabled: false }));
    first.unmount();

    const { result } = renderHook(() => hook());
    await waitFor(() => expect(result.current).toEqual({ supported: true, enabled: true }));
    expect(mocks.fetchMeta).toHaveBeenCalledTimes(2);
  });

  it('survives an unmount mid-request, and keeps the answer for the next surface', async () => {
    const hook = await freshHook();
    let answer: (meta: { enabled: boolean }) => void = () => {};
    mocks.fetchMeta.mockReturnValue(new Promise((resolve) => { answer = resolve; }));
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});

    const first = renderHook(() => hook());
    first.unmount();
    answer({ enabled: true });

    const { result } = renderHook(() => hook());
    await waitFor(() => expect(result.current).toEqual({ supported: true, enabled: true }));
    expect(mocks.fetchMeta).toHaveBeenCalledTimes(1);
    expect(errors).not.toHaveBeenCalled();
  });

  it('shares one request between surfaces that mount together', async () => {
    const hook = await freshHook();
    mocks.fetchMeta.mockResolvedValue({ enabled: true });

    const a = renderHook(() => hook());
    const b = renderHook(() => hook());

    await waitFor(() => expect(a.result.current.supported).toBe(true));
    await waitFor(() => expect(b.result.current.supported).toBe(true));
    expect(mocks.fetchMeta).toHaveBeenCalledTimes(1);
  });
});
