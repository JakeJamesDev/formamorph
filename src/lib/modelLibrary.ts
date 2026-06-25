import type { PlayerModel } from '@/types';
import { openDatabase, promisifyRequest } from './idb';

/**
 * Local, per-browser library of player-uploaded VRM models, persisted in its own IndexedDB
 * database. Kept separate from the save-game DB (`dbUtils`) because that one opens versionlessly
 * and can't gain a new object store cleanly. Models are stored as Blobs (lighter than base64 for
 * multi-MB files; GLTFLoader accepts the resulting `blob:` URLs).
 */
const DB_NAME = 'FORMAMORPH_MODELS_DB';
const STORE_NAME = 'models';
const DB_VERSION = 1;

const openDB = (): Promise<IDBDatabase> =>
  openDatabase(DB_NAME, DB_VERSION, [{ name: STORE_NAME, keyPath: 'id' }]);

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
  await promisifyRequest(db.transaction([STORE_NAME], 'readwrite').objectStore(STORE_NAME).put(model));
  return model;
};

/** All stored models, newest first. */
export const getAllModels = async (): Promise<PlayerModel[]> => {
  const db = await openDB();
  const models = await promisifyRequest<PlayerModel[]>(
    db.transaction([STORE_NAME], 'readonly').objectStore(STORE_NAME).getAll(),
  );
  return models.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
};

/** A single model by id, or null if it isn't in the library. */
export const getModel = async (id: string): Promise<PlayerModel | null> => {
  const db = await openDB();
  const model = await promisifyRequest<PlayerModel>(
    db.transaction([STORE_NAME], 'readonly').objectStore(STORE_NAME).get(id),
  );
  return model ?? null;
};

export const deleteModel = async (id: string): Promise<void> => {
  const db = await openDB();
  await promisifyRequest(db.transaction([STORE_NAME], 'readwrite').objectStore(STORE_NAME).delete(id));
};
