import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import EventService from '@/services/EventService';
import {
  cachedEventProse, cachedEvents, EVENTS_STALE_MS, invalidateEvents, readEvents, resetEventsCache,
  storeEventProse, subscribeEvents,
} from './eventsCache';
import { serverEvent } from '@/test/serverEvents';

vi.mock('@/services/AuthService', () => ({ default: { token: 'test-token' } }));

vi.mock('@/services/EventService', () => ({
  default: { fetchList: vi.fn(async () => []) },
}));

/**
 * The one events list the whole app reads.
 *
 * Two things have to hold. Opening a surface that wants the list a second time must not go back to the
 * server — the archive is permanent and the whole point of holding it is not re-downloading it. And an
 * admin's change must reach what is already mounted, because the alternative is telling a player to
 * restart the app to see the winner that was just announced.
 */

const list = () => vi.mocked(EventService.fetchList);

const reads = () => list().mock.calls.length;

beforeEach(() => {
  resetEventsCache();
  list().mockClear();
  list().mockResolvedValue([serverEvent({ id: 'first' })]);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  resetEventsCache();
  vi.restoreAllMocks();
});

describe('reading the shared events list', () => {
  it('asks the server for the prose-free rows', async () => {
    await readEvents();

    expect(list()).toHaveBeenCalledWith({ slim: true });
  });

  it('answers a second reader from memory, so reopening a surface costs no request', async () => {
    await readEvents();
    const again = await readEvents();

    expect(reads()).toBe(1);
    expect(again.map((event) => event.id)).toEqual(['first']);
  });

  it('shares one fetch between readers that arrive together', async () => {
    const [a, b] = await Promise.all([readEvents(), readEvents()]);

    expect(reads()).toBe(1);
    expect(a).toBe(b);
  });

  it('goes back to the server once what it holds is older than the window', async () => {
    await readEvents();
    list().mockResolvedValue([serverEvent({ id: 'second' })]);

    // The clock is moved rather than the test waiting five minutes. Fake timers are the wrong tool: the
    // read this asserts on settles as a promise, which they do not advance.
    const later = Date.now() + EVENTS_STALE_MS + 1;
    vi.spyOn(Date, 'now').mockReturnValue(later);

    expect((await readEvents()).map((event) => event.id)).toEqual(['second']);
  });

  it('holds nothing until something has been read', () => {
    expect(cachedEvents()).toBeNull();
  });

  it('leaves the last answer standing when a read fails, rather than blanking the archive', async () => {
    await readEvents();
    list().mockRejectedValueOnce(new Error('offline'));
    invalidateEvents();

    await expect(readEvents()).rejects.toThrow('offline');
    // The failure must not wedge every later read behind the rejected promise.
    list().mockResolvedValue([serverEvent({ id: 'second' })]);
    expect((await readEvents()).map((event) => event.id)).toEqual(['second']);
  });
});

describe('an admin change to an event', () => {
  it('drops what is held, so the next read is fresh', async () => {
    await readEvents();
    list().mockResolvedValue([serverEvent({ id: 'second' })]);

    invalidateEvents();

    expect((await readEvents()).map((event) => event.id)).toEqual(['second']);
  });

  it('tells a mounted surface what replaced it, without waiting for it to ask', async () => {
    const seen: string[][] = [];
    const unsubscribe = subscribeEvents((events) => seen.push(events.map((event) => event.id)));
    await readEvents();
    list().mockResolvedValue([serverEvent({ id: 'second' })]);

    invalidateEvents();
    await vi.waitFor(() => expect(seen).toContainEqual(['second']));

    unsubscribe();
  });

  it('forgets the prose read back for it, so rewritten rules are not still on screen next time', () => {
    // The list and the full rows are the same events. Kept apart, an admin's edit would reach the
    // archive while a rules dialog opened earlier in the session kept the wording it replaced.
    storeEventProse(serverEvent({ id: 'first', rulesText: 'One entry per creator.' }));

    invalidateEvents();

    expect(cachedEventProse('first')).toBeUndefined();
  });

  it('does not go back to the server when nothing is mounted to receive the answer', async () => {
    await readEvents();

    invalidateEvents();

    expect(reads()).toBe(1);
  });

  it('retires a read that was already in flight, so the pre-change answer cannot land last', async () => {
    let release: (events: ReturnType<typeof serverEvent>[]) => void = () => {};
    list().mockReturnValueOnce(new Promise((resolve) => { release = resolve; }));
    const stale = readEvents();

    invalidateEvents();
    list().mockResolvedValue([serverEvent({ id: 'second' })]);
    await readEvents();
    release([serverEvent({ id: 'stale' })]);
    await stale;

    expect(cachedEvents()?.map((event) => event.id)).toEqual(['second']);
  });
});
