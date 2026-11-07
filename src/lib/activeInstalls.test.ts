// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const flags = vi.hoisted(() => ({ available: true }));
vi.mock('@/lib/apiBase', () => ({ API_BASE_URL: 'https://api.test/api' }));
vi.mock('@/lib/hostedAi/hostedUrls', () => ({
  get HOSTED_AI_AVAILABLE() { return flags.available; },
}));

type Lib = typeof import('@/lib/activeInstalls');
type Likes = typeof import('@/lib/anonymousLikes');
type Identity = typeof import('@/lib/clientIdentity');

const URL_SENT = 'https://api.test/api/active-installs';
const DAY_ONE = new Date('2026-11-07T10:00:00Z');
const DAY_ONE_LATE = new Date('2026-11-07T23:59:00Z');
const DAY_TWO = new Date('2026-11-08T00:01:00Z');

describe('createDailySender', () => {
  const fetchMock = vi.fn<typeof fetch>();
  let lib: Lib;
  let likes: Likes;
  let restoreFetch: () => void;
  let clock: Date;
  let state: { enabled: boolean; attested: boolean };

  const sender = () => lib.createDailySender(() => state, () => clock);
  const sends = () => fetchMock.mock.calls.filter(([input]) => String(input) === URL_SENT);

  beforeEach(async () => {
    vi.resetModules();
    localStorage.clear();
    flags.available = true;
    clock = DAY_ONE;
    state = { enabled: true, attested: true };
    fetchMock.mockReset().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    lib = await import('@/lib/activeInstalls');
    likes = await import('@/lib/anonymousLikes');
    const identity: Identity = await import('@/lib/clientIdentity');
    // The real wrapper the app installs, so the client header comes from where it does in the app.
    restoreFetch = identity.watchClientVersion('https://api.test/api', () => {});
  });
  afterEach(() => {
    restoreFetch();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sends once per UTC day, and again after the day changes', async () => {
    const attempt = sender();
    await attempt();
    clock = DAY_ONE_LATE;
    await attempt();
    expect(sends()).toHaveLength(1);
    clock = DAY_TWO;
    await attempt();
    expect(sends()).toHaveLength(2);
  });

  it('keeps one day, not a list of past days', async () => {
    const attempt = sender();
    await attempt();
    clock = DAY_TWO;
    await attempt();
    expect(localStorage.getItem(lib.DAILY_SEND_DAY_KEY)).toBe('2026-11-08');
  });

  it('runs one attempt at a time', async () => {
    const attempt = sender();
    await Promise.all([attempt(), attempt()]);
    expect(sends()).toHaveLength(1);
  });

  it('carries the Install id and client headers, and no credential or body', async () => {
    await sender()();
    const [, init] = sends()[0];
    const headers = new Headers(init?.headers);
    expect(init?.method).toBe('POST');
    expect(init?.credentials).toBe('omit');
    expect(init?.body).toBeUndefined();
    expect(headers.get('X-Formamorph-Install')).toBe(localStorage.getItem(likes.INSTALL_STORAGE_KEY));
    expect(headers.get('X-Formamorph-Client')).toMatch(/^\S+ web$/);
    expect(headers.has('Authorization')).toBe(false);
  });

  it('drops a failed send silently and tries again on the next attempt that day', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    const attempt = sender();
    await expect(attempt()).resolves.toBeUndefined();
    expect(localStorage.getItem(lib.DAILY_SEND_DAY_KEY)).toBeNull();
    await attempt();
    expect(sends()).toHaveLength(2);
    expect(localStorage.getItem(lib.DAILY_SEND_DAY_KEY)).toBe('2026-11-07');
  });

  it('treats a refused reply as a failed send', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 429 }));
    const attempt = sender();
    await attempt();
    await attempt();
    expect(sends()).toHaveLength(2);
  });

  it('sends nothing with the switch off, and stops at once when it turns off', async () => {
    state.enabled = false;
    const attempt = sender();
    await attempt();
    expect(sends()).toHaveLength(0);

    state.enabled = true;
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    await attempt();
    state.enabled = false;
    await attempt();
    expect(sends()).toHaveLength(1);
  });

  it('sends nothing before the age gate is passed', async () => {
    state.attested = false;
    await sender()();
    expect(sends()).toHaveLength(0);
    expect(localStorage.getItem(likes.INSTALL_STORAGE_KEY)).toBeNull();
  });

  it('sends nothing in a build without a community server', async () => {
    flags.available = false;
    await sender()();
    expect(sends()).toHaveLength(0);
    expect(lib.dailySendAvailable()).toBe(false);
  });

  it('sends nothing where guest likes are off', async () => {
    likes.setShellOffersGuestLikes(false);
    await sender()();
    expect(sends()).toHaveLength(0);
  });

  it('sends nothing after a server refused the Install header', async () => {
    likes.noteInstallHeaderRefused();
    await sender()();
    expect(sends()).toHaveLength(0);
  });

  it('sends nothing when storage refuses to keep the Install id', async () => {
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === likes.INSTALL_STORAGE_KEY) throw new DOMException('quota', 'QuotaExceededError');
      setItem.call(this, key, value);
    });
    const attempt = sender();
    await attempt();
    await attempt();
    expect(sends()).toHaveLength(0);
  });
});
