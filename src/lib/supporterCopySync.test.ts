import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { OFFLINE_WINDOW_MS, createSupporterContent, type SupporterSession } from '@/lib/supporterContent/supporterContent';
import { createSupporterCache } from '@/lib/supporterContent/cache';
import { createSupporterCopySync, type SupporterCopyHolder } from './supporterCopySync';
import { bindCopyViewer, isHiddenCopy } from './supporterCopyVisibility';

const API = 'https://api.test/api';
const START = Date.UTC(2026, 10, 14);
const ALICE: SupporterSession = { accountId: 'acct-a', token: 'token-a' };
const BOB: SupporterSession = { accountId: 'acct-b', token: 'token-b' };

const item = (id: string) => ({ id, kind: 'world', revision: 1 });

/** The entitlement route as the client sees it, with a switch to take it offline. */
class FakeServer {
  qualifies = true;
  tier = 'supporter_top';
  current: string[] = [];
  expired: string[] = [];
  offline = false;
  /** A route bug: lists items although the account does not qualify. */
  listWhenNotQualifying = false;

  fetch = vi.fn(async () => {
    if (this.offline) throw new TypeError('Failed to fetch');
    const listed = this.qualifies || this.listWhenNotQualifying;
    return Response.json({
      success: true,
      data: { qualifies: this.qualifies, tier: this.tier, items: listed ? this.current.map(item) : [], expired: listed ? this.expired.map(item) : [] },
    });
  });
}

/** A store of copies: world records and a library, as far as the sync reads them. */
const makeHolder = (records: Record<string, { listingId: string; accountId: string } | null>): SupporterCopyHolder & { ids: () => string[] } => ({
  list: async () => Object.entries(records).map(([id, marker]) => ({
    id,
    ...(marker ? { supporterCopy: { ...marker, revision: 1 } } : {}),
  })),
  remove: async (id) => { delete records[id]; },
  ids: () => Object.keys(records),
});

let server: FakeServer;
let now: number;
let session: SupporterSession | null;

const startApp = () => createSupporterContent({ fetch: server.fetch as unknown as typeof fetch, now: () => now, session: () => session, apiBase: API });

/** One app start: a check, then the sync over the given stores. */
const checkAndSync = async (holders: SupporterCopyHolder[]) => {
  const content = startApp();
  await content.check();
  await createSupporterCopySync({ content, holders }).sync();
  return content;
};

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory());
  server = new FakeServer();
  now = START;
  session = ALICE;
});

afterEach(() => {
  bindCopyViewer(() => null);
  vi.unstubAllGlobals();
});

describe('Supporter Copy sync', () => {
  it('removes every copy of an account that no longer qualifies, in worlds and the library', async () => {
    server.current = ['w1'];
    const worlds = makeHolder({ copyA: { listingId: 'w1', accountId: 'acct-a' }, plain: null });
    const library = makeHolder({ entryA: { listingId: 'w1', accountId: 'acct-a' } });
    await checkAndSync([worlds, library]);
    expect(worlds.ids()).toEqual(['copyA', 'plain']);

    server.qualifies = false;
    await checkAndSync([worlds, library]);

    expect(worlds.ids()).toEqual(['plain']);
    expect(library.ids()).toEqual([]);
  });

  it('keeps a copy when the account downgrades to a lower tier, and removes it on a full lapse', async () => {
    server.current = ['w1'];
    const worlds = makeHolder({ copyA: { listingId: 'w1', accountId: 'acct-a' } });
    await checkAndSync([worlds]);

    server.tier = 'supporter';
    await checkAndSync([worlds]);
    expect(worlds.ids()).toEqual(['copyA']);

    server.qualifies = false;
    await checkAndSync([worlds]);
    expect(worlds.ids()).toEqual([]);
  });

  it('removes every copy when the route lists items for an account it says does not qualify', async () => {
    server.current = ['w1'];
    server.expired = ['w2'];
    const worlds = makeHolder({
      a: { listingId: 'w1', accountId: 'acct-a' },
      b: { listingId: 'w2', accountId: 'acct-a' },
    });
    await checkAndSync([worlds]);
    server.qualifies = false;
    server.listWhenNotQualifying = true;

    await checkAndSync([worlds]);

    expect(worlds.ids()).toEqual([]);
  });

  it('keeps copies of current and expired listings and removes one in neither list', async () => {
    server.current = ['now'];
    server.expired = ['old'];
    const worlds = makeHolder({
      current: { listingId: 'now', accountId: 'acct-a' },
      expired: { listingId: 'old', accountId: 'acct-a' },
      gone: { listingId: 'unlisted', accountId: 'acct-a' },
    });

    await checkAndSync([worlds]);

    expect(worlds.ids()).toEqual(['current', 'expired']);
  });

  it("removes another account's copies on the signed-in account's first good check", async () => {
    server.current = ['w1'];
    const worlds = makeHolder({
      mine: { listingId: 'w1', accountId: 'acct-b' },
      theirs: { listingId: 'w1', accountId: 'acct-a' },
    });
    session = BOB;

    await checkAndSync([worlds]);

    expect(worlds.ids()).toEqual(['mine']);
  });

  it('does not remove another account\'s copies while only a failed check backs the session', async () => {
    server.current = ['w1'];
    const worlds = makeHolder({ theirs: { listingId: 'w1', accountId: 'acct-a' } });
    await checkAndSync([worlds]);

    session = BOB;
    server.offline = true;
    await checkAndSync([worlds]);

    expect(worlds.ids()).toEqual(['theirs']);
  });

  it('keeps copies through failed checks inside 7 days and removes them after', async () => {
    server.current = ['w1'];
    const worlds = makeHolder({ copyA: { listingId: 'w1', accountId: 'acct-a' } });
    await checkAndSync([worlds]);

    server.offline = true;
    now = START + OFFLINE_WINDOW_MS - 1000;
    await checkAndSync([worlds]);
    expect(worlds.ids()).toEqual(['copyA']);

    now = START + OFFLINE_WINDOW_MS + 1000;
    await checkAndSync([worlds]);
    expect(worlds.ids()).toEqual([]);
  });

  it('keeps copies through a failed start signed out inside 7 days', async () => {
    server.current = ['w1'];
    const worlds = makeHolder({ copyA: { listingId: 'w1', accountId: 'acct-a' } });
    await checkAndSync([worlds]);

    session = null;
    now = START + 1000;
    await checkAndSync([worlds]);

    expect(worlds.ids()).toEqual(['copyA']);
  });

  it('removes the other copies when one removal fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    server.qualifies = false;
    const records: Record<string, { listingId: string; accountId: string }> = {
      stuck: { listingId: 'w1', accountId: 'acct-a' },
      free: { listingId: 'w1', accountId: 'acct-a' },
    };
    const worlds = makeHolder(records);
    const remove = worlds.remove;
    worlds.remove = async (id) => { if (id === 'stuck') throw new Error('locked'); await remove(id); };

    await checkAndSync([worlds]);

    expect(worlds.ids()).toEqual(['stuck']);
  });

  it('removes nothing when the stored check cannot be read', async () => {
    const worlds = makeHolder({ copyA: { listingId: 'w1', accountId: 'acct-a' } });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const cache = { ...createSupporterCache(), readCheck: async () => { throw new Error('storage unavailable'); } };
    const content = createSupporterContent({ fetch: server.fetch as unknown as typeof fetch, now: () => now, session: () => session, apiBase: API, cache });

    await content.check();
    await createSupporterCopySync({ content, holders: [worlds] }).sync();

    expect(worlds.ids()).toEqual(['copyA']);
  });

  it('removes nothing before the first check finishes', async () => {
    const worlds = makeHolder({ copyA: { listingId: 'w1', accountId: 'acct-a' } });
    const content = startApp();

    await createSupporterCopySync({ content, holders: [worlds] }).sync();

    expect(worlds.ids()).toEqual(['copyA']);
  });
});

describe('copy visibility', () => {
  it("hides another account's copy while signed in, and nothing while signed out", () => {
    const marker = { accountId: 'acct-a' };
    bindCopyViewer(() => 'acct-b');
    expect(isHiddenCopy(marker)).toBe(true);
    expect(isHiddenCopy({ accountId: 'acct-b' })).toBe(false);
    expect(isHiddenCopy(undefined)).toBe(false);
    bindCopyViewer(() => null);
    expect(isHiddenCopy(marker)).toBe(false);
  });
});
