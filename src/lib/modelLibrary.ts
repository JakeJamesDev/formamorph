import type { PlayerModel } from '@/types';

/**
 * Local, per-browser library of player-uploaded VRM models, persisted in its own IndexedDB
 * database. Kept separate from the save-game DB (`dbUtils`) because that one opens versionlessly
 * and can't gain a new object store cleanly. Models are stored as Blobs (lighter than base64 for
 * multi-MB files; GLTFLoader accepts the resulting `blob:` URLs).
 */
const DB_NAME = 'FORMAMORPH_MODELS_DB';
const STORE_NAME = 'models';
const DB_VERSION = 1;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/** Store an uploaded VRM file and return its library record. */
export const addModel = async (file: File): Promise<PlayerModel> => {
  const model: PlayerModel = {
    id: crypto.randomUUID(),
    name: file.name.replace(/\.[^.]+$/, ''),
    type: file.type || 'model/vrm',
    blob: file,
    size: file.size,
    addedAt: new Date().toISOString(),
  };
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const request = db.transaction([STORE_NAME], 'readwrite').objectStore(STORE_NAME).put(model);
    request.onsuccess = () => resolve(model);
    request.onerror = () => reject(request.error);
  });
};

/** All stored models, newest first. */
export const getAllModels = async (): Promise<PlayerModel[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const request = db.transaction([STORE_NAME], 'readonly').objectStore(STORE_NAME).getAll();
    request.onsuccess = () =>
      resolve((request.result as PlayerModel[]).sort((a, b) => b.addedAt.localeCompare(a.addedAt)));
    request.onerror = () => reject(request.error);
  });
};

/** A single model by id, or null if it isn't in the library. */
export const getModel = async (id: string): Promise<PlayerModel | null> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const request = db.transaction([STORE_NAME], 'readonly').objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve((request.result as PlayerModel) ?? null);
    request.onerror = () => reject(request.error);
  });
};

export const deleteModel = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const request = db.transaction([STORE_NAME], 'readwrite').objectStore(STORE_NAME).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};
