/**
 * Supporter content: what the signed-in account may install, what is installed, and the start check that
 * keeps the two in step.
 *
 * A good check removes what it no longer lists and re-fetches what it lists at a higher revision. Failed
 * checks and signed-out starts keep the cache usable until 7 days after the last good check, then remove it.
 * Items installed for one account are never handed out while another account is signed in.
 */
import { createSupporterCache, itemKey, type CheckRecord, type ItemRecord, type SupporterCache, type SupporterItemRef } from './cache';

export type { SupporterItemRef } from './cache';

export const OFFLINE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export interface SupporterSession {
  accountId: string;
  token: string;
}

export interface SupporterContentDeps {
  fetch: typeof fetch;
  /** Epoch milliseconds. */
  now: () => number;
  /** The signed-in account, or null when signed out. */
  session: () => SupporterSession | null;
  apiBase: string;
  cache?: SupporterCache;
}

export interface SupporterContentSnapshot {
  /** `idle` until the first check finishes. */
  status: 'idle' | 'checking' | 'ready';
  qualifies: boolean;
  /** What the account may install, as the last good check listed it. */
  entitled: SupporterItemRef[];
  installed: SupporterItemRef[];
}

export type SupporterContentRefusal = 'signed-out' | 'not-entitled';

export class SupporterContentError extends Error {
  constructor(readonly reason: SupporterContentRefusal, message: string) {
    super(message);
    this.name = 'SupporterContentError';
  }
}

interface Entitlement {
  qualifies: boolean;
  items: SupporterItemRef[];
}

const asObject = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

const asItemRef = (value: unknown): SupporterItemRef | null => {
  const item = asObject(value);
  if (!item || typeof item.id !== 'string' || !item.id || typeof item.kind !== 'string' || !Number.isInteger(item.revision)) return null;
  return { id: item.id, kind: item.kind, revision: item.revision as number };
};

const refOf = ({ id, kind, revision }: SupporterItemRef): SupporterItemRef => ({ id, kind, revision });

export function createSupporterContent(deps: SupporterContentDeps) {
  const cache = deps.cache ?? createSupporterCache();
  const listeners = new Set<() => void>();
  let check: CheckRecord | null = null;
  let items: ItemRecord[] = [];
  let loaded: Promise<void> | null = null;
  let status: SupporterContentSnapshot['status'] = 'idle';
  let snapshot: SupporterContentSnapshot = { status, qualifies: false, entitled: [], installed: [] };
  let queue: Promise<unknown> = Promise.resolve();

  const withinWindow = (record: CheckRecord | null): record is CheckRecord =>
    !!record && deps.now() < record.checkedAt + OFFLINE_WINDOW_MS;

  /** The last good check, when it may still be used for whoever is (or was last) signed in. */
  const usableCheck = (): CheckRecord | null => {
    if (!withinWindow(check)) return null;
    const session = deps.session();
    return session && session.accountId !== check.accountId ? null : check;
  };

  const usableItems = (): ItemRecord[] => {
    const usable = usableCheck();
    return usable ? items.filter((item) => item.accountId === usable.accountId) : [];
  };

  const publish = () => {
    const usable = usableCheck();
    snapshot = {
      status,
      qualifies: !!usable?.qualifies,
      entitled: usable ? usable.entitled.map(refOf) : [],
      installed: usableItems().map(refOf),
    };
    listeners.forEach((listener) => listener());
  };

  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task);
    queue = run.catch(() => undefined);
    return run;
  };

  const load = () => {
    loaded ??= Promise.all([cache.readCheck(), cache.readItems()]).then(([storedCheck, storedItems]) => {
      check = storedCheck;
      items = storedItems;
    }).catch((error: unknown) => {
      loaded = null;
      throw error;
    });
    return loaded;
  };

  const authorized = (session: SupporterSession) => ({ headers: { Authorization: `Bearer ${session.token}` } });

  /** The entitlement route's answer, or null when the check failed in any way. */
  const fetchEntitlement = async (session: SupporterSession): Promise<Entitlement | null> => {
    try {
      const response = await deps.fetch(`${deps.apiBase}/supporter-content/entitlement`, authorized(session));
      if (!response.ok) return null;
      const data = asObject(asObject(await response.json())?.data);
      if (!data || typeof data.qualifies !== 'boolean' || !Array.isArray(data.items)) return null;
      const listed = data.items.map(asItemRef);
      if (listed.some((item) => !item)) return null;
      return { qualifies: data.qualifies, items: data.qualifies ? listed as SupporterItemRef[] : [] };
    } catch {
      return null;
    }
  };

  /** Fetch one listing from the gated route and store it in place of any other revision. */
  const fetchAndStore = async (session: SupporterSession, id: string): Promise<void> => {
    const response = await deps.fetch(`${deps.apiBase}/worlds/${encodeURIComponent(id)}/supporter-content`, authorized(session));
    if (!response.ok) throw new Error(`The Supporter content download failed with status ${response.status}`);
    const data = asObject(asObject(await response.json())?.data);
    const ref = asItemRef({ id, kind: data?.kind, revision: data?.revision });
    if (!data || !ref || data.contentData === undefined) throw new Error('The Supporter content download returned no content');
    const record = { ...ref, accountId: session.accountId, content: data.contentData };
    await cache.replaceItem(record);
    items = [...items.filter((item) => item.id !== id), { ...record, key: itemKey(id, ref.revision) }];
  };

  const applyGoodCheck = async (session: SupporterSession, entitlement: Entitlement) => {
    const listed = new Map(entitlement.items.map((item) => [item.id, item]));
    const drop = items.filter((item) => item.accountId !== session.accountId || !listed.has(item.id));
    await cache.deleteItems(drop.map((item) => item.key));
    items = items.filter((item) => !drop.includes(item));
    const good: CheckRecord = { accountId: session.accountId, checkedAt: deps.now(), qualifies: entitlement.qualifies, entitled: entitlement.items };
    await cache.writeCheck(good);
    check = good;
    publish();

    const stale = items.filter((item) => (listed.get(item.id)?.revision ?? item.revision) > item.revision);
    for (const item of stale) {
      try {
        await fetchAndStore(session, item.id);
      } catch (error) {
        // The installed copy stays until a later check fetches the new revision.
        console.error('Failed to update Supporter content:', error);
      }
    }
  };

  const applyOfflineWindow = async () => {
    if (withinWindow(check)) return;
    if (!check && !items.length) return;
    await cache.clearAll();
    check = null;
    items = [];
  };

  const runCheck = async () => {
    status = 'checking';
    publish();
    try {
      await load();
      const session = deps.session();
      const entitlement = session ? await fetchEntitlement(session) : null;
      if (session && entitlement) await applyGoodCheck(session, entitlement);
      else await applyOfflineWindow();
    } catch (error) {
      console.error('The Supporter content check failed:', error);
    } finally {
      status = 'ready';
      publish();
    }
  };

  return {
    /** Run the start check. Never rejects. */
    check: (): Promise<void> => serial(runCheck),

    /**
     * Install one listing the last good check listed.
     *
     * @throws SupporterContentError when signed out or the listing is not entitled; Error when the download fails
     */
    install: (id: string): Promise<void> => serial(async () => {
      await load();
      const session = deps.session();
      if (!session) throw new SupporterContentError('signed-out', 'Sign in to install Supporter content');
      const usable = usableCheck();
      if (!usable?.qualifies || !usable.entitled.some((item) => item.id === id)) {
        throw new SupporterContentError('not-entitled', 'This account cannot install that Supporter content');
      }
      await fetchAndStore(session, id);
      publish();
    }),

    /** The installed content of `id` with its layers still scrambled, or null when it is not usable now. */
    readItem: async (id: string): Promise<unknown> => {
      await load();
      return usableItems().find((item) => item.id === id)?.content ?? null;
    },

    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },

    getSnapshot: (): SupporterContentSnapshot => snapshot,
  };
}

export type SupporterContent = ReturnType<typeof createSupporterContent>;
