/**
 * The IndexedDB records behind the Supporter content module. Content stays scrambled as the gated route
 * sent it; nothing here ever holds an unscrambled layer.
 */
import { cachedConnection, promisifyRequest, transactionDone, writeAfterRead } from '@/lib/idb';

/** A listing the account may install, as the entitlement route lists it. */
export interface SupporterItemRef {
  id: string;
  kind: string;
  revision: number;
}

/** What the last good check said, and for which account. */
export interface CheckRecord {
  accountId: string;
  /** Epoch milliseconds. */
  checkedAt: number;
  qualifies: boolean;
  entitled: SupporterItemRef[];
}

/** One installed listing revision, keyed `<id>@<revision>`. */
export interface ItemRecord extends SupporterItemRef {
  key: string;
  accountId: string;
  /** The listing's content as the gated route returned it, layers still scrambled. */
  content: unknown;
}

const DB_NAME = 'FormamorphSupporterContent';
const ITEMS = 'items';
const META = 'meta';
const CHECK_KEY = 'lastGoodCheck';

export const itemKey = (id: string, revision: number) => `${id}@${revision}`;

/** The records of one database, on one connection opened at first use. */
export function createSupporterCache(name = DB_NAME) {
  const connect = cachedConnection(name, 1, [
    { name: ITEMS, keyPath: 'key' },
    { name: META, keyPath: 'key' },
  ]);

  async function readCheck(): Promise<CheckRecord | null> {
    const db = await connect();
    const row = await promisifyRequest(db.transaction([META], 'readonly').objectStore(META).get(CHECK_KEY)) as
      (CheckRecord & { key: string }) | undefined;
    if (!row) return null;
    const { key: _key, ...check } = row;
    return check;
  }

  async function readItems(): Promise<ItemRecord[]> {
    const db = await connect();
    return await promisifyRequest(db.transaction([ITEMS], 'readonly').objectStore(ITEMS).getAll()) as ItemRecord[];
  }

  /** Store `check` as the last good check. */
  async function writeCheck(check: CheckRecord): Promise<void> {
    const db = await connect();
    const transaction = db.transaction([META], 'readwrite');
    transaction.objectStore(META).put({ key: CHECK_KEY, ...check });
    await transactionDone(transaction);
  }

  /** Store `item`, replacing every other revision of its listing in the same transaction. */
  async function replaceItem(item: Omit<ItemRecord, 'key'>): Promise<void> {
    const db = await connect();
    const transaction = db.transaction([ITEMS], 'readwrite');
    const store = transaction.objectStore(ITEMS);
    await writeAfterRead(transaction, store.getAll() as IDBRequest<ItemRecord[]>, (rows) => {
      rows.filter((row) => row.id === item.id).forEach((row) => store.delete(row.key));
      store.put({ ...item, key: itemKey(item.id, item.revision) });
    });
  }

  async function deleteItems(keys: string[]): Promise<void> {
    if (!keys.length) return;
    const db = await connect();
    const transaction = db.transaction([ITEMS], 'readwrite');
    const store = transaction.objectStore(ITEMS);
    keys.forEach((key) => store.delete(key));
    await transactionDone(transaction);
  }

  /** Remove every installed item and the last good check. */
  async function clearAll(): Promise<void> {
    const db = await connect();
    const transaction = db.transaction([ITEMS, META], 'readwrite');
    transaction.objectStore(ITEMS).clear();
    transaction.objectStore(META).clear();
    await transactionDone(transaction);
  }

  return { readCheck, readItems, writeCheck, replaceItem, deleteItems, clearAll };
}

export type SupporterCache = ReturnType<typeof createSupporterCache>;
