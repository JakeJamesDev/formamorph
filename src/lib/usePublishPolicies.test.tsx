import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { usePublishPolicies } from './usePublishPolicies';
import PolicyService from '@/services/PolicyService';
import type { PolicyState } from '@/types';

const gateState = (title: string): PolicyState => ({
  uploadGate: { title, body: 'Be excellent.', tags: [], accepted: false },
  tagNotice: null,
  privacyPolicy: null,
});

/** A fetch whose replies are released by hand, so two reads can be put in flight and landed out of order. */
const deferredFetches = () => {
  const resolvers: Array<(state: PolicyState) => void> = [];
  vi.spyOn(PolicyService, 'fetchPolicies').mockImplementation(
    () => new Promise<PolicyState>((resolve) => { resolvers.push(resolve); }),
  );
  return resolvers;
};

afterEach(() => { vi.restoreAllMocks(); });

describe('usePublishPolicies in-flight reads', () => {
  it('keeps the newest read when an older one lands after it', async () => {
    const resolvers = deferredFetches();

    // Opening fetches; closing and reopening fetches again, leaving the first reply still in flight.
    const { result, rerender } = renderHook(({ open }) => usePublishPolicies(open, true), {
      initialProps: { open: true },
    });
    await waitFor(() => expect(resolvers).toHaveLength(1));
    rerender({ open: false });
    rerender({ open: true });
    await waitFor(() => expect(resolvers).toHaveLength(2));

    // The reopen's reply arrives first, then the stale one from the original open.
    await act(async () => { resolvers[1](gateState('current')); });
    await act(async () => { resolvers[0](gateState('stale')); });

    expect(result.current.gate?.title).toBe('current');
  });

  it('keeps the newest read when an older one fails after it', async () => {
    const rejecters: Array<(error: Error) => void> = [];
    const resolvers: Array<(state: PolicyState) => void> = [];
    vi.spyOn(PolicyService, 'fetchPolicies').mockImplementation(
      () => new Promise<PolicyState>((resolve, reject) => { resolvers.push(resolve); rejecters.push(reject); }),
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result, rerender } = renderHook(({ open }) => usePublishPolicies(open, true), {
      initialProps: { open: true },
    });
    await waitFor(() => expect(resolvers).toHaveLength(1));
    rerender({ open: false });
    rerender({ open: true });
    await waitFor(() => expect(resolvers).toHaveLength(2));

    await act(async () => { resolvers[1](gateState('current')); });
    // The stale read fails; failing open must not clear the newer state it knows nothing about.
    await act(async () => { rejecters[0](new Error('offline')); });

    expect(result.current.gate?.title).toBe('current');
  });
});
