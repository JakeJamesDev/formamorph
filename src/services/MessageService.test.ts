import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import MessageService from './MessageService';
import AuthService from './AuthService';

// Minimal fetch Response stub (only the bits MessageService reads).
const res = (body: unknown, ok = true, status = 200): Response =>
  ({ ok, status, json: async () => body } as unknown as Response);

/** The URL of the nth fetch call. */
const urlOf = (call = 0) => String(vi.mocked(fetch).mock.calls[call][0]);

/** The init object of the nth fetch call. */
const initOf = (call = 0) => vi.mocked(fetch).mock.calls[call][1] as RequestInit;

beforeEach(() => {
  AuthService.token = 'test-token';
  vi.stubGlobal('fetch', vi.fn());
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('authorization', () => {
  it('sends the auth token on every call', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ unread: 0 }));

    await MessageService.fetchUnreadCount();

    expect((initOf().headers as Record<string, string>).Authorization).toBe('Bearer test-token');
  });

  it('sets a JSON content type only when there is a body', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ data: [] }));

    await MessageService.send({ subject: 's', body: 'b', severity: 'info', senderAs: 'team', scope: 'existing', broadcast: true });

    expect((initOf().headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });
});

describe('error handling', () => {
  it('raises the server error text verbatim', async () => {
    // The server answers `{ error }`; surfacing a generic message instead would hide the real reason
    // a send was rejected (bad severity, missing recipient, oversize body).
    vi.mocked(fetch).mockResolvedValue(res({ success: false, error: 'Subject is required' }, false, 400));

    await expect(
      MessageService.send({ subject: '', body: 'b', severity: 'info', senderAs: 'team', scope: 'existing', broadcast: true }),
    ).rejects.toThrow('Subject is required');
  });

  it('falls back when the error body is unreadable', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => { throw new Error('not json'); },
    } as unknown as Response);

    await expect(MessageService.fetchUnreadCount()).rejects.toThrow('Failed to load unread count');
  });
});

describe('fetchInbox', () => {
  it('unwraps the list, total and unread count', async () => {
    vi.mocked(fetch).mockResolvedValue(res({
      success: true,
      data: [{ id: 'm1', subject: 'Hi' }],
      total: 1,
      unread: 1,
    }));

    const result = await MessageService.fetchInbox();

    expect(result.messages).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.unread).toBe(1);
  });

  it('passes the requested limit', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ data: [], total: 0, unread: 0 }));

    await MessageService.fetchInbox(10);

    expect(urlOf()).toContain('limit=10');
  });
});

describe('send', () => {
  it('posts a broadcast without recipients', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ data: [{ id: 'm1' }] }));

    await MessageService.send({
      subject: 'Notice', body: 'Body', severity: 'warning', senderAs: 'username',
      broadcast: true, scope: 'pinned',
    });

    const sent = JSON.parse(String(initOf().body));
    expect(sent).toMatchObject({ broadcast: true, scope: 'pinned', severity: 'warning', senderAs: 'username' });
    expect(sent.recipientIds).toBeUndefined();
  });

  it('posts named recipients without the broadcast flag', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ data: [{ id: 'm1' }, { id: 'm2' }] }));

    const created = await MessageService.send({
      subject: 'Notice', body: 'Body', severity: 'info', senderAs: 'team', scope: 'existing',
      recipientIds: ['u1', 'u2'],
    });

    const sent = JSON.parse(String(initOf().body));
    expect(sent.recipientIds).toEqual(['u1', 'u2']);
    expect(sent.broadcast).toBeUndefined();
    expect(created).toHaveLength(2);
  });
});

describe('fetchSent', () => {
  it('omits the user filter when listing everything', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ data: [], total: 0 }));

    await MessageService.fetchSent();

    expect(urlOf()).not.toContain('userId');
  });

  it('narrows to one user when asked', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ data: [], total: 0 }));

    await MessageService.fetchSent({ userId: 'u1', page: 2 });

    expect(urlOf()).toContain('userId=u1');
    expect(urlOf()).toContain('page=2');
  });

  it('asks for one audience at a time', async () => {
    // The Users tab and the Broadcasts tab each show only their own half; without the parameter the
    // Users tab would list broadcasts it no longer owns.
    vi.mocked(fetch).mockResolvedValue(res({ data: [], total: 0 }));

    await MessageService.fetchSent({ audience: 'broadcast' });
    expect(urlOf()).toContain('audience=broadcast');

    await MessageService.fetchSent({ audience: 'direct' });
    expect(urlOf(1)).toContain('audience=direct');
  });

  it('omits the audience when none is given', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ data: [], total: 0 }));

    await MessageService.fetchSent();

    expect(urlOf()).not.toContain('audience');
  });
});

describe('per-message actions', () => {
  it('marks read against the read route', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ success: true }));

    await MessageService.markRead('m1');

    expect(urlOf()).toContain('/messages/m1/read');
    expect(initOf().method).toBe('POST');
  });

  it('dismisses against the message route, not the admin recall route', async () => {
    // The two DELETEs differ only by path segment; crossing them would have a user recalling messages.
    vi.mocked(fetch).mockResolvedValue(res({ success: true }));

    await MessageService.dismiss('m1');

    expect(urlOf()).toMatch(/\/messages\/m1$/);
    expect(urlOf()).not.toContain('/sent/');
    expect(initOf().method).toBe('DELETE');
  });

  it('recalls against the admin sent route', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ success: true }));

    await MessageService.recall('m1');

    expect(urlOf()).toContain('/messages/sent/m1');
    expect(initOf().method).toBe('DELETE');
  });
});
