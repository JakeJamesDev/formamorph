// Reads the AppData profile's stores for the merge. A hidden window on a session opened at that profile runs a
// blank page on the app origin, so its IndexedDB is the AppData copy. No app code runs there, and every
// database opens with no version, so nothing upgrades or creates a store in the AppData profile.

const BLANK_PAGE = '<!doctype html><meta charset="utf-8"><title>Formamorph</title>';
const PARTITION_ORIGIN = 'app://local/merge-source.html';

/** Page-side: summaries of every record in the named stores. Runs in the hidden window. */
async function pageSummaries(stores) {
  const known = new Set((await indexedDB.databases()).map((d) => d.name));
  const openDb = (name) => new Promise((resolve, reject) => {
    const req = indexedDB.open(name);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error(`${name} is blocked`));
  });
  const str = (v) => (typeof v === 'string' ? v : undefined);
  const out = {};
  for (const { key, db: dbName, store } of stores) {
    out[key] = [];
    if (!known.has(dbName)) continue;
    const db = await openDb(dbName);
    try {
      if (!db.objectStoreNames.contains(store)) continue;
      await new Promise((resolve, reject) => {
        const cursor = db.transaction([store], 'readonly').objectStore(store).openCursor();
        cursor.onerror = () => reject(cursor.error);
        cursor.onsuccess = () => {
          const at = cursor.result;
          if (!at) { resolve(); return; }
          const v = at.value;
          if (v && typeof v === 'object' && typeof v.id === 'string') {
            let size = 0;
            try { size = JSON.stringify(v).length; } catch { size = 0; }
            const state = v.currentState && typeof v.currentState === 'object' ? v.currentState : {};
            out[key].push({
              id: v.id,
              size,
              name: str(v.name),
              editedAt: str(v.editedAt),
              downloadedAt: str(v.downloadedAt),
              createdAt: str(v.createdAt),
              timestamp: str(state.timestamp),
              worldId: str(v.worldId),
              worldName: str(state.worldName),
            });
          }
          at.continue();
        };
      });
    } finally {
      db.close();
    }
  }
  return out;
}

/** Page-side: one record by id, or null. Runs in the hidden window. */
async function pageRecord({ db: dbName, store, id }) {
  if (!(await indexedDB.databases()).some((d) => d.name === dbName)) return null;
  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error(`${dbName} is blocked`));
  });
  try {
    if (!db.objectStoreNames.contains(store)) return null;
    return await new Promise((resolve, reject) => {
      const req = db.transaction([store], 'readonly').objectStore(store).get(id);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

/** Page-side: every localStorage entry as strings. Runs in the hidden window. */
function pageSettings() {
  const out = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    const value = key === null ? null : localStorage.getItem(key);
    if (key !== null && value !== null) out[key] = value;
  }
  return out;
}

const call = (fn, arg) => `(${fn.toString()})(${JSON.stringify(arg)})`;

/**
 * Open the AppData profile for reading. `electron` supplies `session` and `BrowserWindow`. Resolves to a
 * reader whose `close` destroys the hidden window.
 */
async function openSource({ electron, dir }) {
  const ses = electron.session.fromPath(dir);
  if (!ses.protocol.isProtocolHandled('app')) {
    ses.protocol.handle('app', () => new Response(BLANK_PAGE, { headers: { 'content-type': 'text/html' } }));
  }
  const win = new electron.BrowserWindow({
    show: false,
    webPreferences: { session: ses, contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  await win.loadURL(PARTITION_ORIGIN);
  const run = (fn, arg) => {
    if (win.isDestroyed()) throw new Error('The AppData profile is closed.');
    return win.webContents.executeJavaScript(call(fn, arg));
  };
  return {
    summaries: (stores) => run(pageSummaries, stores),
    record: (ref) => run(pageRecord, ref),
    settings: () => run(pageSettings, null),
    close: () => { if (!win.isDestroyed()) win.destroy(); },
  };
}

module.exports = { openSource };
