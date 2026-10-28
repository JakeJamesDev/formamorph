import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import {
  OFFLINE_WINDOW_MS, SupporterContentError, createSupporterContent,
  type SupporterItemRef, type SupporterSession,
} from './supporterContent';
import { createSupporterCache } from './cache';

const API = 'https://api.test/api';
const DAY = 24 * 60 * 60 * 1000;
const START = Date.UTC(2026, 9, 28);

const layer = (seed: number) => ({ dataUrl: 'data:image/png;base64,AAAA', seed, version: 1, sourceWidth: 3, sourceHeight: 5 });
const contentFor = (id: string, revision: number) => ({ name: `${id} r${revision}`, layers: [layer(revision)] });

/** The server as the module sees it: an entitlement answer, the gated route, and a switch to take it offline. */
class FakeServer {
  qualifies = true;
  listed: SupporterItemRef[] = [];
  offline = false;
  entitlementStatus = 200;
  gatedStatus = 200;
  revisions = new Map<string, number>();
  requests: { url: string; authorization: string | undefined }[] = [];

  list(...items: [id: string, revision: number][]) {
    this.listed = items.map(([id, revision]) => ({ id, kind: 'mascot', revision }));
    items.forEach(([id, revision]) => this.revisions.set(id, revision));
  }

  fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    this.requests.push({ url, authorization: (init?.headers as Record<string, string> | undefined)?.Authorization });
    if (this.offline) throw new TypeError('Failed to fetch');
    if (url === `${API}/supporter-content/entitlement`) {
      return Response.json(
        { success: true, data: { qualifies: this.qualifies, items: this.qualifies ? this.listed : [] } },
        { status: this.entitlementStatus },
      );
    }
    const gated = /\/worlds\/([^/]+)\/supporter-content$/.exec(url);
    if (gated) {
      const id = decodeURIComponent(gated[1]);
      const revision = this.revisions.get(id) ?? 1;
      if (this.gatedStatus !== 200) return Response.json({ success: false }, { status: this.gatedStatus });
      return Response.json({ success: true, data: { id, kind: 'mascot', revision, contentData: contentFor(id, revision) } });
    }
    return Response.json({ success: false }, { status: 404 });
  });

  entitlementCalls = () => this.requests.filter((r) => r.url.endsWith('/entitlement')).length;
}

let server: FakeServer;
let now: number;
let session: SupporterSession | null;

const ALICE: SupporterSession = { accountId: 'acct-a', token: 'token-a' };
const BOB: SupporterSession = { accountId: 'acct-b', token: 'token-b' };

/** One app start: a fresh module over the same browser storage. */
const startApp = () => createSupporterContent({ fetch: server.fetch, now: () => now, session: () => session, apiBase: API });

/** Start the app and run its start check. */
const startAndCheck = async () => {
  const module = startApp();
  await module.check();
  return module;
};

/** What the browser profile holds, whatever the module would hand out. */
const storedKeys = async () => (await createSupporterCache().readItems()).map((item) => item.key).sort();

const installedIds = (module: ReturnType<typeof startApp>) => module.getSnapshot().installed.map((item) => `${item.id}@${item.revision}`);

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory());
  server = new FakeServer();
  now = START;
  session = ALICE;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('the start check', () => {
  it('reports a qualifying account and installs nothing on its own', async () => {
    server.list(['excl', 1]);
    const app = await startAndCheck();

    expect(app.getSnapshot()).toMatchObject({ status: 'ready', qualifies: true, installed: [] });
    expect(app.getSnapshot().entitled).toEqual([{ id: 'excl', kind: 'mascot', revision: 1 }]);
    expect(await app.readItem('excl')).toBeNull();
    expect(server.requests.some((r) => r.url.includes('/worlds/'))).toBe(false);
    expect(server.requests[0].authorization).toBe('Bearer token-a');
  });

  it('removes an installed item that a good check no longer lists', async () => {
    server.list(['excl', 1], ['other', 1]);
    const first = await startAndCheck();
    await first.install('excl');
    await first.install('other');

    server.list(['other', 1]);
    const next = await startAndCheck();

    expect(installedIds(next)).toEqual(['other@1']);
    expect(await next.readItem('excl')).toBeNull();
    expect(await storedKeys()).toEqual(['other@1']);
  });

  it('removes everything when the pledge ended', async () => {
    server.list(['excl', 1]);
    await (await startAndCheck()).install('excl');

    server.qualifies = false;
    const next = await startAndCheck();

    expect(next.getSnapshot()).toMatchObject({ qualifies: false, entitled: [], installed: [] });
    expect(await next.readItem('excl')).toBeNull();
  });

  it('replaces the installed copy when a good check lists a new revision', async () => {
    server.list(['excl', 1]);
    await (await startAndCheck()).install('excl');

    server.list(['excl', 2]);
    const next = await startAndCheck();

    expect(installedIds(next)).toEqual(['excl@2']);
    expect(await next.readItem('excl')).toEqual(contentFor('excl', 2));
    expect(await storedKeys()).toEqual(['excl@2']);
  });

  it('keeps the old revision when fetching the new one fails, and updates at a later check', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    server.list(['excl', 1]);
    await (await startAndCheck()).install('excl');

    server.list(['excl', 2]);
    server.gatedStatus = 503;
    const failed = await startAndCheck();
    expect(installedIds(failed)).toEqual(['excl@1']);
    expect(await failed.readItem('excl')).toEqual(contentFor('excl', 1));

    server.gatedStatus = 200;
    expect(installedIds(await startAndCheck())).toEqual(['excl@2']);
  });

  it('notifies subscribers with a new snapshot', async () => {
    server.list(['excl', 1]);
    const app = startApp();
    const seen: string[] = [];
    app.subscribe(() => seen.push(app.getSnapshot().status));
    const before = app.getSnapshot();

    await app.check();

    expect(seen).toContain('checking');
    expect(seen.at(-1)).toBe('ready');
    expect(app.getSnapshot()).not.toBe(before);
  });
});

describe('failed checks', () => {
  const installThenFail = async (fail: () => void) => {
    server.list(['excl', 1]);
    await (await startAndCheck()).install('excl');
    fail();
  };

  it.each([
    ['the server is unreachable', () => { server.offline = true; }],
    ['the route answers an error', () => { server.entitlementStatus = 500; }],
  ])('keep the cache until 7 days after the last good check when %s, then remove it', async (_case, fail) => {
    await installThenFail(fail);

    now = START + OFFLINE_WINDOW_MS - 1;
    const inside = await startAndCheck();
    expect(inside.getSnapshot()).toMatchObject({ qualifies: true });
    expect(installedIds(inside)).toEqual(['excl@1']);
    expect(await inside.readItem('excl')).toEqual(contentFor('excl', 1));

    now = START + OFFLINE_WINDOW_MS;
    const after = await startAndCheck();
    expect(after.getSnapshot()).toMatchObject({ qualifies: false, installed: [] });
    expect(await after.readItem('excl')).toBeNull();

    expect(await storedKeys()).toEqual([]);
  });

  it('stop handing out the cache in an app left running past the window', async () => {
    server.list(['excl', 1]);
    const app = await startAndCheck();
    await app.install('excl');

    now = START + OFFLINE_WINDOW_MS - 1;
    expect(await app.readItem('excl')).toEqual(contentFor('excl', 1));
    now = START + OFFLINE_WINDOW_MS;
    expect(await app.readItem('excl')).toBeNull();
  });

  it('measure the window from the last good check, not the install', async () => {
    await installThenFail(() => {});
    now = START + 5 * DAY;
    await startAndCheck();

    server.offline = true;
    now = START + 5 * DAY + OFFLINE_WINDOW_MS - 1;
    expect(installedIds(await startAndCheck())).toEqual(['excl@1']);
  });
});

describe('signed out', () => {
  it('fetches nothing and keeps an existing cache for 7 days after the last good check', async () => {
    server.list(['excl', 1]);
    await (await startAndCheck()).install('excl');
    const requests = server.requests.length;

    session = null;
    now = START + 6 * DAY;
    const inside = await startAndCheck();
    expect(server.requests.length).toBe(requests);
    expect(installedIds(inside)).toEqual(['excl@1']);
    expect(await inside.readItem('excl')).toEqual(contentFor('excl', 1));

    now = START + OFFLINE_WINDOW_MS;
    const after = await startAndCheck();
    expect(server.requests.length).toBe(requests);
    expect(installedIds(after)).toEqual([]);
    expect(await storedKeys()).toEqual([]);
  });

  it('installs nothing without a session', async () => {
    session = null;
    const app = await startAndCheck();

    expect(server.fetch).not.toHaveBeenCalled();
    expect(app.getSnapshot()).toMatchObject({ status: 'ready', qualifies: false, entitled: [], installed: [] });
    await expect(app.install('excl')).rejects.toMatchObject({ reason: 'signed-out' });
  });
});

describe('another account', () => {
  it('never hands out items installed for another account, and its good check deletes them', async () => {
    server.list(['excl', 1]);
    await (await startAndCheck()).install('excl');

    session = BOB;
    server.offline = true;
    const offline = await startAndCheck();
    expect(offline.getSnapshot()).toMatchObject({ qualifies: false, installed: [] });
    expect(await offline.readItem('excl')).toBeNull();

    server.offline = false;
    const checked = await startAndCheck();
    expect(checked.getSnapshot()).toMatchObject({ qualifies: true, installed: [] });

    expect(await storedKeys()).toEqual([]);
  });

  it('hides another account\'s items from a running app the moment that account signs in', async () => {
    server.list(['excl', 1]);
    const app = await startAndCheck();
    await app.install('excl');

    session = BOB;
    expect(await app.readItem('excl')).toBeNull();
  });
});

describe('install', () => {
  it('downloads one listing from the gated route with the session token', async () => {
    server.list(['excl', 3], ['other', 1]);
    const app = await startAndCheck();

    await app.install('excl');

    expect(installedIds(app)).toEqual(['excl@3']);
    expect(await app.readItem('excl')).toEqual(contentFor('excl', 3));
    const gated = server.requests.filter((r) => r.url.includes('/worlds/'));
    expect(gated).toEqual([{ url: `${API}/worlds/excl/supporter-content`, authorization: 'Bearer token-a' }]);
  });

  it('refuses a listing the last good check did not list', async () => {
    server.list(['excl', 1]);
    const app = await startAndCheck();

    const refusal = app.install('elsewhere');
    await expect(refusal).rejects.toBeInstanceOf(SupporterContentError);
    await expect(refusal).rejects.toMatchObject({ reason: 'not-entitled' });
  });

  it('refuses before any good check', async () => {
    server.list(['excl', 1]);
    await expect(startApp().install('excl')).rejects.toMatchObject({ reason: 'not-entitled' });
  });

  it('rejects and installs nothing when the download fails', async () => {
    server.list(['excl', 1]);
    const app = await startAndCheck();
    server.gatedStatus = 403;

    await expect(app.install('excl')).rejects.toThrow('403');
    expect(installedIds(app)).toEqual([]);
  });
});
