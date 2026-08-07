import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import FeedbackService from './FeedbackService';
import type { FeedbackStatus, FeedbackThread } from '@/types';

vi.mock('./AuthService', () => ({ default: { API_URL: 'http://api', token: 't' } }));

const thread = (id: string, createdAt: string, over: Partial<FeedbackThread> = {}): FeedbackThread => ({
  id,
  type: 'bug',
  title: id,
  category: 'crash',
  body: 'b',
  status: 'open',
  reporter: { id: 'u1', username: 'finder' },
  diagnostics: {},
  createdAt,
  updatedAt: createdAt,
  locked: false,
  votes: 0,
  voted: false,
  unread: false,
  ...over,
});

/**
 * Stand in for the server, which only ever filters by one status. Answers each request from the rows
 * carrying that status, honoring `page`/`limit` the way a real handler would.
 *
 * @param rows - Every thread the server holds
 * @param cap - A page-size ceiling the server silently applies, if it has one
 */
const stubServer = (rows: FeedbackThread[], cap = Infinity) => {
  const fetchMock = vi.fn(async (url: string) => {
    const query = new URL(url).searchParams;
    const status = query.get('status');
    const page = Number(query.get('page'));
    const limit = Math.min(Number(query.get('limit')), cap);

    const matching = rows
      .filter((row) => row.status === status)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

    return {
      ok: true,
      json: async () => ({ data: matching.slice((page - 1) * limit, page * limit), total: matching.length }),
    } as unknown as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const OPEN: FeedbackStatus[] = ['open', 'need_info', 'confirmed'];

describe('FeedbackService.list across several statuses', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  // Nine unresolved reports spread over the three states, interleaved in time so no single request
  // holds a whole page — the merge has to be doing the ordering, not one lucky sub-list.
  const spread = [
    thread('a', '2026-07-09T00:00:00Z', { status: 'open' }),
    thread('b', '2026-07-08T00:00:00Z', { status: 'need_info' }),
    thread('c', '2026-07-07T00:00:00Z', { status: 'confirmed' }),
    thread('d', '2026-07-06T00:00:00Z', { status: 'open' }),
    thread('e', '2026-07-05T00:00:00Z', { status: 'need_info' }),
    thread('f', '2026-07-04T00:00:00Z', { status: 'confirmed' }),
    thread('g', '2026-07-03T00:00:00Z', { status: 'open' }),
    thread('h', '2026-07-02T00:00:00Z', { status: 'need_info' }),
    thread('i', '2026-07-01T00:00:00Z', { status: 'confirmed' }),
    // Closed work the filter must never reach for.
    thread('z', '2026-07-10T00:00:00Z', { status: 'resolved' }),
    thread('y', '2026-07-11T00:00:00Z', { status: 'wontfix' }),
  ];

  it('one request per status, and none for the closed ones', async () => {
    const fetchMock = stubServer(spread);

    await FeedbackService.list({ type: 'bug', page: 1, limit: 4, status: OPEN, scope: 'all' });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const asked = fetchMock.mock.calls.map(([url]) => new URL(url as string).searchParams.get('status'));
    expect(asked.sort()).toEqual(['confirmed', 'need_info', 'open']);
  });

  it('orders the merge the way the server would have', async () => {
    stubServer(spread);

    const { threads } = await FeedbackService.list({ type: 'bug', page: 1, limit: 4, status: OPEN });

    // Newest first across all three states, not three lists stacked end to end.
    expect(threads.map((t) => t.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('pages through the merge without repeating or dropping a row', async () => {
    stubServer(spread);

    const pages = [];
    for (const page of [1, 2, 3]) {
      const result = await FeedbackService.list({ type: 'bug', page, limit: 4, status: OPEN });
      pages.push(result.threads.map((t) => t.id));
    }

    expect(pages).toEqual([['a', 'b', 'c', 'd'], ['e', 'f', 'g', 'h'], ['i']]);
  });

  it('reaches deep enough for a later page when one state holds most of the queue', async () => {
    // Six of the eight are open, so page 3 of a two-row page is rows five and six — both of them open,
    // and both further down that state's list than a single page. Fetching only one page per state
    // would leave them out of the merge entirely and hand back the wrong rows.
    const lopsided = [
      thread('1', '2026-07-08T00:00:00Z', { status: 'open' }),
      thread('2', '2026-07-07T00:00:00Z', { status: 'open' }),
      thread('3', '2026-07-06T00:00:00Z', { status: 'need_info' }),
      thread('4', '2026-07-05T00:00:00Z', { status: 'open' }),
      thread('5', '2026-07-04T00:00:00Z', { status: 'open' }),
      thread('6', '2026-07-03T00:00:00Z', { status: 'open' }),
      thread('7', '2026-07-02T00:00:00Z', { status: 'confirmed' }),
      thread('8', '2026-07-01T00:00:00Z', { status: 'open' }),
    ];
    stubServer(lopsided);

    const { threads } = await FeedbackService.list({ type: 'bug', page: 3, limit: 2, status: OPEN });

    expect(threads.map((t) => t.id)).toEqual(['5', '6']);
  });

  it('counts every matching thread and no closed one', async () => {
    stubServer(spread);

    const { total } = await FeedbackService.list({ type: 'bug', page: 1, limit: 4, status: OPEN });

    // The nine unresolved ones; the resolved and wontfix pair are not in any sub-list to be counted.
    expect(total).toBe(9);
  });

  it('ranks by votes when that is what was asked for', async () => {
    const voted = [
      thread('low', '2026-07-09T00:00:00Z', { status: 'open', votes: 1 }),
      thread('high', '2026-07-01T00:00:00Z', { status: 'confirmed', votes: 9 }),
      thread('mid', '2026-07-05T00:00:00Z', { status: 'need_info', votes: 5 }),
    ];
    stubServer(voted);

    const { threads } = await FeedbackService.list(
      { type: 'bug', page: 1, limit: 3, status: OPEN, sort: 'votes' });

    expect(threads.map((t) => t.id)).toEqual(['high', 'mid', 'low']);
  });

  it('says so when the server capped the page instead of showing a short list as complete', async () => {
    // A server that quietly refuses to hand back more than two rows at a time cannot supply a deep
    // merged page. Reporting it is the honest answer; silently showing four of eight rows is not.
    stubServer(spread, 2);

    const { truncated } = await FeedbackService.list({ type: 'bug', page: 2, limit: 4, status: OPEN });

    expect(truncated).toBe(true);
  });

  it('does not cry truncation when the server simply has fewer rows than asked for', async () => {
    // Three reports against a page of ten is a complete page, not a capped one.
    stubServer(spread.slice(0, 3));

    const { truncated } = await FeedbackService.list({ type: 'bug', page: 1, limit: 10, status: OPEN });

    expect(truncated).toBe(false);
  });

  it('still sends a single status as one plain request', async () => {
    const fetchMock = stubServer(spread);

    await FeedbackService.list({ type: 'bug', page: 1, limit: 4, status: 'confirmed' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(new URL(fetchMock.mock.calls[0][0] as string).searchParams.get('status')).toBe('confirmed');
  });
});
