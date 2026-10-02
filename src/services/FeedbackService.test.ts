import { describe, it, expect, afterEach, vi } from 'vitest';
import FeedbackService from './FeedbackService';

vi.mock('./AuthService', () => ({ default: { API_URL: 'http://api', token: 't' } }));

const stubFetch = () => {
  const fetchMock = vi.fn(async (_url: string) => ({
    ok: true,
    json: async () => ({ data: [], total: 42 }),
  }) as unknown as Response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const queryOf = (fetchMock: ReturnType<typeof stubFetch>) =>
  new URL(fetchMock.mock.calls[0][0]).searchParams;

describe('FeedbackService.list', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends a status list as one comma-separated request', async () => {
    const fetchMock = stubFetch();

    await FeedbackService.list({ type: 'bug', page: 2, limit: 10, status: ['open', 'need_info', 'confirmed'] });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(queryOf(fetchMock).get('status')).toBe('open,need_info,confirmed');
    expect(queryOf(fetchMock).get('page')).toBe('2');
    expect(queryOf(fetchMock).get('limit')).toBe('10');
  });

  it('returns the total the server counted', async () => {
    stubFetch();

    const { total } = await FeedbackService.list({ type: 'bug', status: ['open', 'confirmed'] });

    expect(total).toBe(42);
  });

  it('still sends a single status as itself', async () => {
    const fetchMock = stubFetch();

    await FeedbackService.list({ type: 'bug', status: 'confirmed' });

    expect(queryOf(fetchMock).get('status')).toBe('confirmed');
  });

  it.each([[undefined], [[]]])('sends no status for %j', async (status) => {
    const fetchMock = stubFetch();

    await FeedbackService.list({ type: 'bug', status });

    expect(queryOf(fetchMock).has('status')).toBe(false);
  });

  it('sends the search text, trimmed, in the same request', async () => {
    const fetchMock = stubFetch();

    await FeedbackService.list({ type: 'suggestion', status: ['open'], search: '  100% my_save  ' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(queryOf(fetchMock).get('search')).toBe('100% my_save');
    expect(queryOf(fetchMock).get('status')).toBe('open');
  });

  it.each([[undefined], [''], ['   ']])('sends no search for %j', async (search) => {
    const fetchMock = stubFetch();

    await FeedbackService.list({ type: 'bug', search });

    expect(queryOf(fetchMock).has('search')).toBe(false);
  });
});
