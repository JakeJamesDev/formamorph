import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import EventService from '@/services/EventService';
import { useContests } from './useContests';
import { invalidateEvents, resetEventsCache } from './eventsCache';
import { serverEvent } from '@/test/serverEvents';

vi.mock('@/services/AuthService', () => ({ default: { token: 'test-token' } }));

vi.mock('@/services/EventService', () => ({
  default: { fetchList: vi.fn(async () => []) },
}));

/**
 * The contests feed, as the two surfaces that hold it see it.
 *
 * The main menu keeps this open for the whole session and the browser asks again on every open, so what
 * matters is that opening a second time is free and that an admin's change still lands.
 */

const list = () => vi.mocked(EventService.fetchList);

const contest = (id: string) => serverEvent({ id, title: id });

beforeEach(() => {
  resetEventsCache();
  list().mockClear();
  list().mockResolvedValue([contest('first')]);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  resetEventsCache();
  vi.restoreAllMocks();
});

describe('the contests feed', () => {
  it('reads the list once and reports it loaded', async () => {
    const { result } = renderHook(() => useContests(true));

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.contests.map((event) => event.id)).toEqual(['first']);
    expect(list()).toHaveBeenCalledTimes(1);
  });

  it('reads nothing while the surface holding it is closed', async () => {
    renderHook(() => useContests(false));

    expect(list()).not.toHaveBeenCalled();
  });

  it('reuses what the first surface read when a second opens, rather than downloading it again', async () => {
    const first = renderHook(() => useContests(true));
    await waitFor(() => expect(first.result.current.loaded).toBe(true));

    const second = renderHook(() => useContests(true));

    // Held from the first render, so the second has its answer before any request could return.
    expect(second.result.current.contests.map((event) => event.id)).toEqual(['first']);
    expect(second.result.current.loaded).toBe(true);
    expect(list()).toHaveBeenCalledTimes(1);
  });

  it('reuses it across a close and a reopen, which is what a browser visit is', async () => {
    const visit = renderHook(({ open }) => useContests(open), { initialProps: { open: true } });
    await waitFor(() => expect(visit.result.current.loaded).toBe(true));

    visit.rerender({ open: false });
    visit.rerender({ open: true });

    expect(list()).toHaveBeenCalledTimes(1);
    expect(visit.result.current.contests.map((event) => event.id)).toEqual(['first']);
  });

  it('picks up an admin change while it is still mounted, without being reopened', async () => {
    const { result } = renderHook(() => useContests(true));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    list().mockResolvedValue([contest('second')]);
    invalidateEvents();

    await waitFor(() => expect(result.current.contests.map((event) => event.id)).toEqual(['second']));
  });

  it('holds an empty list when the server cannot be reached, and still reports it settled', async () => {
    list().mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => useContests(true));

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.contests).toEqual([]);
  });
});
