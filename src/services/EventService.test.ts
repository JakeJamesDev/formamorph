import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import EventService from './EventService';
import AuthService from './AuthService';
import { serverEvent } from '@/test/serverEvents';

/**
 * What the events reads put on the wire.
 *
 * The archive is permanent, so the list only grows — which is why it is asked for without its prose, and
 * why there is a second call that reads one event back in full. Both have to work against a server that
 * has never heard of either, so what matters here is the request, not a shape only a new server sends.
 */

// Minimal fetch Response stub (only the bits EventService reads).
const res = (body: unknown, ok = true, status = 200): Response =>
  ({ ok, status, json: async () => body } as unknown as Response);

/** The URL of the nth fetch call. */
const urlOf = (call = 0) => String(vi.mocked(fetch).mock.calls[call][0]);

beforeEach(() => {
  AuthService.token = 'test-token';
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('reading the events list', () => {
  it('asks for the prose-free rows when it is told to', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ data: [] }));

    await EventService.fetchList({ slim: true });

    expect(urlOf()).toContain('slim=1');
  });

  it('asks for whole rows by default, which is what the admin calendar wants', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ data: [] }));

    await EventService.fetchList();

    expect(urlOf()).not.toContain('slim');
  });

  it('carries the token, so staff see what has not been announced yet', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ data: [] }));

    await EventService.fetchList({ slim: true });

    const headers = vi.mocked(fetch).mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-token');
  });

  it('answers with an empty list when the server sends no data, rather than throwing', async () => {
    vi.mocked(fetch).mockResolvedValue(res({}));

    await expect(EventService.fetchList({ slim: true })).resolves.toEqual([]);
  });
});

describe('reading one event in full', () => {
  it('names the event and hands back the row inside the envelope', async () => {
    const full = serverEvent({ id: 'e9', body: 'The long version.' });
    vi.mocked(fetch).mockResolvedValue(res({ data: full }));

    const event = await EventService.fetchOne('e9');

    expect(urlOf()).toContain('/events/e9');
    expect(event).toEqual(full);
  });

  it('raises the server error text verbatim, so a 404 reads as one', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ success: false, error: 'Event not found' }, false, 404));

    await expect(EventService.fetchOne('gone')).rejects.toThrow('Event not found');
  });
});
