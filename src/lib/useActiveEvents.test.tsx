import { render, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import EventService from '@/services/EventService';
import type { ServerEvent } from '@/types';

// The flag is a module constant read at import time, so each suite decides its value before importing
// the hook. Hoisted so the factory below can reach it.
const flag = vi.hoisted(() => ({ enabled: true }));
vi.mock('@/lib/featureFlags', () => ({ get COMMUNITY_ENABLED() { return flag.enabled; } }));

const { useActiveEvents, refreshActiveEvents, EVENTS_POLL_MS, EVENTS_FOCUS_FLOOR_MS } = await import('./useActiveEvents');

const sample: ServerEvent = {
  id: 'e1', type: 'contest', title: 'A Contest', bannerText: 'blurb', body: 'body',
  rulesText: null, startsAt: '2026-08-01T00:00:00Z', endsAt: '2026-09-01T00:00:00Z',
  cancelledAt: null, startMessageId: null, endMessageId: null, resultsMessageId: null,
  resultsAnnouncedAt: null, placements: [],
};

/** Renders the hook and exposes what it last returned, plus the poll callback it was handed. */
function Probe({ onPoll, enabled, seen }: {
  onPoll?: () => void; enabled?: boolean; seen: (events: ServerEvent[]) => void;
}) {
  const events = useActiveEvents({ onPoll, enabled });
  seen(events);
  return null;
}

beforeEach(() => {
  flag.enabled = true;
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const stub = (events: ServerEvent[]) => vi.spyOn(EventService, 'fetchActive').mockResolvedValue(events);

describe('useActiveEvents', () => {
  it('reads the running events on mount', async () => {
    stub([sample]);
    let latest: ServerEvent[] = [];

    render(<Probe seen={(e) => { latest = e; }} />);

    await waitFor(() => expect(latest).toEqual([sample]));
  });

  it('re-reads on the poll interval and when the window regains focus', async () => {
    const fetchActive = stub([sample]);
    render(<Probe seen={() => {}} />);
    await waitFor(() => expect(fetchActive).toHaveBeenCalledTimes(1));

    await act(async () => { await vi.advanceTimersByTimeAsync(EVENTS_POLL_MS); });
    expect(fetchActive).toHaveBeenCalledTimes(2);

    await act(async () => { await vi.advanceTimersByTimeAsync(EVENTS_FOCUS_FLOOR_MS); });
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    await waitFor(() => expect(fetchActive).toHaveBeenCalledTimes(3));
  });

  it('ignores a focus that lands too soon after the last read — alt-tabbing is not news', async () => {
    const fetchActive = stub([sample]);
    render(<Probe seen={() => {}} />);
    await waitFor(() => expect(fetchActive).toHaveBeenCalledTimes(1));

    await act(async () => {
      for (let i = 0; i < 10; i += 1) window.dispatchEvent(new Event('focus'));
    });
    expect(fetchActive).toHaveBeenCalledTimes(1);

    // Once the floor has passed, the next focus is read again.
    await act(async () => { await vi.advanceTimersByTimeAsync(EVENTS_FOCUS_FLOOR_MS); });
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    await waitFor(() => expect(fetchActive).toHaveBeenCalledTimes(2));
  });

  it('re-reads at once when an admin event write announces itself, and never after unmount', async () => {
    const fetchActive = stub([sample]);
    const { unmount } = render(<Probe seen={() => {}} />);
    await waitFor(() => expect(fetchActive).toHaveBeenCalledTimes(1));

    // An extended contest deadline must reach the publish flow now, not at the next 5-minute poll.
    await act(async () => { refreshActiveEvents(); });
    expect(fetchActive).toHaveBeenCalledTimes(2);

    unmount();
    await act(async () => { refreshActiveEvents(); });
    expect(fetchActive).toHaveBeenCalledTimes(2);
  });

  it('nudges its caller after each successful read, through whichever callback is current', async () => {
    stub([sample]);
    const first = vi.fn();
    const second = vi.fn();

    const { rerender } = render(<Probe onPoll={first} seen={() => {}} />);
    await waitFor(() => expect(first).toHaveBeenCalledTimes(1));

    rerender(<Probe onPoll={second} seen={() => {}} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(EVENTS_POLL_MS); });

    expect(second).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledTimes(1);
  });

  it('holds the callback in a ref, so a fresh identity every render does not re-poll', async () => {
    const fetchActive = stub([sample]);
    const { rerender } = render(<Probe onPoll={() => {}} seen={() => {}} />);
    await waitFor(() => expect(fetchActive).toHaveBeenCalledTimes(1));

    // What the notification feed shipped: an inline arrow re-identifies on every render, and an effect
    // depending on it fetches on every render.
    for (let i = 0; i < 5; i += 1) rerender(<Probe onPoll={() => {}} seen={() => {}} />);

    expect(fetchActive).toHaveBeenCalledTimes(1);
  });

  it('fails silent — an unreachable server leaves an empty list and no interval left behind', async () => {
    const fetchActive = vi.spyOn(EventService, 'fetchActive').mockRejectedValue(new Error('offline'));
    let latest: ServerEvent[] = [sample];
    const onPoll = vi.fn();

    const { unmount } = render(<Probe onPoll={onPoll} seen={(e) => { latest = e; }} />);

    await waitFor(() => expect(fetchActive).toHaveBeenCalled());
    expect(latest).toEqual([]);
    expect(onPoll).not.toHaveBeenCalled();

    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(EVENTS_POLL_MS * 2); });
    expect(fetchActive).toHaveBeenCalledTimes(1);
  });

  it('never touches the server when the community features are off', async () => {
    flag.enabled = false;
    const fetchActive = stub([sample]);

    render(<Probe seen={() => {}} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(EVENTS_POLL_MS * 2); });

    expect(fetchActive).not.toHaveBeenCalled();
  });

  it('costs nothing while disabled, so a mounted-but-hidden surface adds no second poll', async () => {
    const fetchActive = stub([sample]);

    render(<Probe enabled={false} seen={() => {}} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(EVENTS_POLL_MS * 2); });
    await act(async () => { window.dispatchEvent(new Event('focus')); });

    expect(fetchActive).not.toHaveBeenCalled();
  });

  it('starts reading the moment it is enabled, and stops again when it is not', async () => {
    const fetchActive = stub([sample]);
    const { rerender } = render(<Probe enabled={false} seen={() => {}} />);
    expect(fetchActive).not.toHaveBeenCalled();

    rerender(<Probe enabled seen={() => {}} />);
    await waitFor(() => expect(fetchActive).toHaveBeenCalledTimes(1));

    // Disabled again, the interval it left behind must be gone with it.
    rerender(<Probe enabled={false} seen={() => {}} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(EVENTS_POLL_MS * 2); });
    expect(fetchActive).toHaveBeenCalledTimes(1);
  });
});
