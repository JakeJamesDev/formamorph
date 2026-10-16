import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import AuthService from './AuthService';
import AgeGateService from './AgeGateService';
import AuditService from './AuditService';
import EventService from './EventService';
import FeedbackService from './FeedbackService';
import MessageService from './MessageService';
import PolicyService from './PolicyService';
import ReportService from './ReportService';
import ServerSettingsService from './ServerSettingsService';
import UserService from './UserService';
import WorldStorageService from './WorldStorageService';
import { PatreonService } from './PatreonService';

/**
 * Signed out, a request names no account. Every service used to build its own header, and several sent
 * `Bearer null`, which the server reads as a bad token rather than an anonymous caller.
 */

const ok = (body: unknown = { data: [], success: true }): Response =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

const refusal = (body: string, status: number): Response => new Response(body, { status });

/** The headers of the first fetch call, as a plain record. */
const sentHeaders = (): Record<string, string> =>
  (vi.mocked(fetch).mock.calls[0][1]?.headers ?? {}) as Record<string, string>;

const SERVICE_CALLS: [string, () => Promise<unknown>][] = [
  ['age gate read', () => AgeGateService.read()],
  ['audit list', () => AuditService.list()],
  ['event list', () => EventService.fetchList()],
  ['feedback list', () => FeedbackService.list({ type: 'bug' })],
  ['message inbox', () => MessageService.fetchInbox()],
  ['policy read', () => PolicyService.fetchPolicies()],
  ['report queue', () => ReportService.fetchQueue()],
  ['server setting read', () => ServerSettingsService.fetchSetting('anonymous_likes')],
  ['profile read', () => UserService.fetchProfile('u1')],
  ['staff liker list', () => WorldStorageService.fetchLikers('w1')],
  ['quarantine release', () => WorldStorageService.releaseRemoteWorld('w1')],
  ['world list', () => WorldStorageService.fetchRemoteWorlds()],
  ['comment list', () => WorldStorageService.fetchComments('w1')],
  ['relationship read', () => WorldStorageService.fetchDependencies('w1')],
  ['source check', () => WorldStorageService.checkSource('w1')],
];

beforeEach(() => {
  AuthService.token = null;
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  AuthService.token = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('a signed-out request', () => {
  it.each(SERVICE_CALLS)('carries no auth header: %s', async (_name, call) => {
    vi.mocked(fetch).mockImplementation(async () => ok());

    await call().catch(() => undefined);

    expect(fetch).toHaveBeenCalled();
    expect(sentHeaders()).not.toHaveProperty('Authorization');
  });

  it('never sends the text "null" as a token', async () => {
    vi.mocked(fetch).mockImplementation(async () => ok());

    await MessageService.fetchInbox().catch(() => undefined);

    expect(JSON.stringify(sentHeaders())).not.toContain('null');
  });

  it('refuses the Patreon call before any request goes out', async () => {
    await expect(PatreonService.getStatus()).rejects.toThrow('Not authenticated');

    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('a signed-in request', () => {
  it.each(SERVICE_CALLS)('carries the bearer token: %s', async (_name, call) => {
    AuthService.token = 'tok';
    vi.mocked(fetch).mockImplementation(async () => ok());

    await call().catch(() => undefined);

    expect(sentHeaders().Authorization).toBe('Bearer tok');
  });

  it('carries the bearer token on a Patreon call', async () => {
    AuthService.token = 'tok';
    vi.mocked(fetch).mockResolvedValue(ok({ data: { linked: false } }));

    await PatreonService.getStatus();

    expect(sentHeaders().Authorization).toBe('Bearer tok');
  });
});

describe('a refused catalog read', () => {
  it('shows the server text for the world list', async () => {
    vi.mocked(fetch).mockResolvedValue(refusal(JSON.stringify({ error: 'Catalog is closed' }), 503));

    const result = await WorldStorageService.fetchRemoteWorlds();

    expect(result).toMatchObject({ success: false, error: 'Catalog is closed' });
  });

  it('shows the server text for the comment list', async () => {
    vi.mocked(fetch).mockResolvedValue(refusal(JSON.stringify({ error: 'Comments are paused' }), 503));

    const result = await WorldStorageService.fetchComments('w1');

    expect(result).toMatchObject({ success: false, error: 'Comments are paused' });
  });

  it('keeps the fallback when the refusal is an HTML page', async () => {
    vi.mocked(fetch).mockResolvedValue(refusal('<html>Bad Gateway</html>', 502));

    const result = await WorldStorageService.fetchRemoteWorlds();

    expect(result).toMatchObject({ success: false, error: 'Failed to fetch worlds' });
  });
});
