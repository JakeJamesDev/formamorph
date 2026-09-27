// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import AuthService from './AuthService';
import WorldStorageService, { AnonymousLikeRefused } from './WorldStorageService';
import AgeGateService from './AgeGateService';
import AuditService from './AuditService';
import EventService from './EventService';
import FeedbackService from './FeedbackService';
import MessageService from './MessageService';
import PolicyService from './PolicyService';
import ReportService from './ReportService';
import ServerSettingsService, { ANONYMOUS_LIKES } from './ServerSettingsService';
import UserService from './UserService';
import { responseError } from './responseError';
import { fetchCatalogContent } from '@/lib/fetchCatalogContent';
import { INSTALL_STORAGE_KEY, installId } from '@/lib/anonymousLikes';

const TOKEN = 'secret-bearer-token';
const BODY = JSON.stringify({ success: false, error: 'Listing is locked', code: 'LOCKED' });

/** A refused response the way fetch returns one: `url` is the address that was asked for. */
function refused(url: string, body = BODY, status = 423, statusText = 'Locked'): Response {
  const response = new Response(body, { status, statusText });
  Object.defineProperty(response, 'url', { value: url });
  return response;
}

const API = AuthService.API_URL;

beforeEach(() => {
  AuthService.token = TOKEN;
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => refused(String(input))));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  AuthService.token = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type Thrown = Error & { details?: unknown; code?: unknown };

async function thrown(call: () => Promise<unknown>): Promise<Thrown> {
  try {
    await call();
  } catch (error) {
    return error as Thrown;
  }
  throw new Error('expected the call to throw');
}

const changelog = { title: 'T', body: 'B', date: '2026-09-27' };

// The optional fourth value is the message a site that reads only `message` falls back to.
const calls: [string, () => Promise<unknown>, string, string?][] = [
  ['like', () => WorldStorageService.setRemoteWorldLiked('w1', true), '/worlds/w1/like'],
  ['quarantine', () => WorldStorageService.quarantineRemoteWorld('w1', 7), '/worlds/w1/quarantine'],
  ['release', () => WorldStorageService.releaseRemoteWorld('w1'), '/worlds/w1/quarantine'],
  ['post a comment', () => WorldStorageService.postComment('w1', 'hi'), '/worlds/w1/comments', 'Failed to post comment'],
  ['edit a comment', () => WorldStorageService.updateComment('c1', 'hi'), '/comments/c1'],
  ['delete a comment', () => WorldStorageService.deleteComment('c1'), '/comments/c1'],
  ['read dependencies', () => WorldStorageService.fetchDependencies('w1'), '/worlds/w1/dependencies'],
  ['review an add-on', () => WorldStorageService.setAddonReview('w1', 'a1', 'approved'), '/worlds/w1/addons/a1/review'],
  ['add a changelog entry', () => WorldStorageService.createChangelogEntry('w1', changelog), '/worlds/w1/changelog'],
  ['edit a changelog entry', () => WorldStorageService.updateChangelogEntry('w1', 'e1', changelog), '/worlds/w1/changelog/e1'],
  ['withdraw a contest entry', () => WorldStorageService.withdrawFromContest('w1'), '/worlds/w1/contest'],
  ['delete a changelog entry', () => WorldStorageService.deleteChangelogEntry('w1', 'e1'), '/worlds/w1/changelog/e1'],
  ['list likers', () => WorldStorageService.fetchLikers('w1'), '/worlds/w1/likes'],
  ['audit likes', () => WorldStorageService.fetchLikersAudit('w1'), '/worlds/w1/likes/audit'],
  ['remove Anonymous Likes', () => WorldStorageService.removeAnonymousLikes('w1'), '/worlds/w1/anonymous-likes'],
  ['remove a like', () => WorldStorageService.removeLike('w1', 'u1'), '/worlds/w1/likes/u1'],
  ['download', () => fetchCatalogContent('w1', () => {}), '/worlds/w1/content'],
  ['read a policy (staffApi)', () => PolicyService.fetchPolicies(), '/policies'],
  ['write a server setting', () => ServerSettingsService.saveSetting(ANONYMOUS_LIKES, true), `/settings/${ANONYMOUS_LIKES}`],
  ['load the report queue', () => ReportService.fetchQueue(), '/reports'],
  ['read feedback', () => FeedbackService.fetchThread('f1'), '/feedback/f1'],
  ['read the audit log', () => AuditService.list(), '/audit'],
  ['read an event', () => EventService.fetchOne('e1'), '/events/e1'],
  ['read the inbox', () => MessageService.fetchInbox(), '/messages'],
  ['read a profile', () => UserService.fetchProfile('u1'), '/users/u1'],
  ['read the age gate', () => AgeGateService.read(), '/policies/age-gate'],
];

describe('a refused community call', () => {
  it.each(calls)('%s: throws the server reason with the route, status and body as details', async (_name, call, route, message = 'Listing is locked') => {
    const error = await thrown(call);

    expect(error.message).toBe(message);
    expect(error.details).toContain(`Route: ${API}${route}`);
    expect(error.details).toContain('Status: 423 Locked');
    expect(error.details).toContain(BODY);
  });

  it.each(calls)('%s: keeps the bearer token out of the details', async (_name, call) => {
    const error = await thrown(call);

    expect(String(error.details)).not.toContain(TOKEN);
    expect(String(error.details)).not.toMatch(/authorization|bearer/i);
  });

  it('keeps the refusal code a publish branches on', async () => {
    const payload = { kind: 'world' as const, name: 'N', description: 'D', thumbnail: 't', contentData: {} };
    const error = await thrown(() => WorldStorageService.publishItem(payload));

    expect(error.code).toBe('LOCKED');
    expect(error.details).toContain(`Route: ${API}/worlds`);
  });

  it('keeps the refusal code a contest withdrawal branches on', async () => {
    expect((await thrown(() => WorldStorageService.withdrawFromContest('w1'))).code).toBe('LOCKED');
  });

  it('claims Anonymous Likes: throws the route, status and body', async () => {
    localStorage.setItem(INSTALL_STORAGE_KEY, installId());
    const error = await thrown(() => WorldStorageService.claimAnonymousLikes());

    expect(error.details).toContain(`Route: ${API}/users/me/anonymous-likes/claim`);
    expect(error.details).toContain(BODY);
    localStorage.clear();
  });

  it('reads a profile answered 200 with success false: throws the body as details', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => refused(String(input), BODY, 200, 'OK'));
    const error = await thrown(() => UserService.fetchProfile('u1'));

    expect(error.message).toBe('Listing is locked');
    expect(error.details).toContain(`Route: ${API}/users/u1`);
    expect(error.details).toContain('Status: 200 OK');
    expect(error.details).toContain('"code":"LOCKED"');
  });

  it('keeps the class and code of a refused guest like', async () => {
    const error = await thrown(() => WorldStorageService.setAnonymousWorldLiked('w1', true));

    expect(error).toBeInstanceOf(AnonymousLikeRefused);
    expect(error.code).toBe('LOCKED');
    expect(error.details).toContain(`Route: ${API}/worlds/w1/anonymous-like`);
  });

  it('falls back to the caller words and shows a body that is not JSON as sent', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => refused(String(input), '<html>502 Bad Gateway</html>', 502, 'Bad Gateway'));
    const error = await thrown(() => WorldStorageService.releaseRemoteWorld('w1'));

    expect(error.message).toBe('Failed to release this');
    expect(error.details).toContain('Status: 502 Bad Gateway');
    expect(error.details).toContain('<html>502 Bad Gateway</html>');
  });

  // These sites read `message` first, so the words the player saw before details existed stay the same.
  it.each([
    ['post a comment', () => WorldStorageService.postComment('w1', 'hi')],
    ['publish', () => WorldStorageService.publishItem({ kind: 'world' as const, name: 'N', description: 'D', thumbnail: 't', contentData: {} })],
    ['download', () => fetchCatalogContent('w1', () => {})],
  ])('%s: shows the server message over its error field', async (_name, call) => {
    vi.mocked(fetch).mockImplementation(async (input) =>
      refused(String(input), JSON.stringify({ error: 'error field', message: 'message field' })));

    expect((await thrown(call)).message).toBe('message field');
  });

  it('masks a secret in the route query string', async () => {
    const error = await responseError(refused(`${API}/worlds?page=1&token=abc123`), 'fallback');

    expect(error.details).toContain(`Route: ${API}/worlds?page=1&token=[redacted]`);
    expect(error.details).not.toContain('abc123');
  });
});
