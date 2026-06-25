import { openDatabase, promisifyRequest } from '@/lib/idb';

export const DB_NAME = 'FORMAMORPH_DB';
export const STORE_NAME = 'saves';
export const DB_VERSION = 1;

// Open versionlessly to avoid version-mismatch errors with older saves.
export const initDB = (): Promise<IDBDatabase> =>
  openDatabase(DB_NAME, undefined, [{ name: STORE_NAME, keyPath: 'name' }]);

const store = async (mode: IDBTransactionMode) =>
  (await initDB()).transaction([STORE_NAME], mode).objectStore(STORE_NAME);

export const saveToDB = async (name: string, data: Record<string, unknown>) => {
  await promisifyRequest((await store('readwrite')).put({ name, ...data }));
};

export const loadFromDB = async (name: string) =>
  promisifyRequest((await store('readonly')).get(name));

export const getAllSaves = async () =>
  promisifyRequest((await store('readonly')).getAll());

export const deleteFromDB = async (name: string) => {
  await promisifyRequest((await store('readwrite')).delete(name));
};
