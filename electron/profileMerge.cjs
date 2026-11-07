// The AppData profile a direct start of the inner exe wrote to, and whether its data still needs a merge into
// the launcher folder's profile. No electron dependency, so plain Node tests it.
const path = require('node:path');
const { LOCATIONS_FILE } = require('./profileMergeModelFolder.cjs');

/** The marker file in the AppData profile: `done` lists the merged categories, `declined` ends every offer. */
const MARKER_FILE = 'formamorph-merge.json';

/** Profile folders that hold merged data: records, settings and sign-in, and local models. */
const MERGED_STORES = ['IndexedDB', 'Local Storage', 'models'];

/** The AppData IndexedDB stores the renderer may read, by merge category. */
const SOURCE_STORES = {
  worlds: { db: 'worldsDB', store: 'worlds' },
  saves: { db: 'FORMAMORPH_DB', store: 'saveRecords' },
  entities: { db: 'entitiesDB', store: 'entities' },
  dictionaries: { db: 'dictionariesDB', store: 'dictionaries' },
  avatars: { db: 'FORMAMORPH_MODELS_DB', store: 'models' },
  statTemplates: { db: 'statTemplatesDB', store: 'templates' },
  mascotImages: { db: 'FORMAMORPH_MASCOT_DB', store: 'images' },
};

const samePath = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();

/** The marker, or null when none is written. An unreadable marker reads as declined. */
function readMarker(sourceDir, fsApi) {
  const file = path.join(sourceDir, MARKER_FILE);
  if (!fsApi.existsSync(file)) return null;
  try {
    const marker = JSON.parse(fsApi.readFileSync(file, 'utf8'));
    if (marker?.state === 'done' && Array.isArray(marker.categories)) {
      return { state: 'done', categories: marker.categories.filter((key) => typeof key === 'string') };
    }
  } catch { /* fall through */ }
  return { state: 'declined' };
}

/**
 * The AppData profile to offer a merge from, with the categories it already merged, or null. Offered on a
 * Windows launcher start when that profile exists, is not the folder's own profile, holds a merged store,
 * and was not declined.
 */
function mergeSource({ platform, env, sourceDir, targetDir, fsApi }) {
  if (platform !== 'win32' || !env.FORMAMORPH_ROOT || !sourceDir || !targetDir) return null;
  if (samePath(sourceDir, targetDir) || !fsApi.existsSync(sourceDir)) return null;
  const marker = readMarker(sourceDir, fsApi);
  if (marker?.state === 'declined') return null;
  // A model-folder choice counts too: models in a chosen folder have no store in the profile.
  const holdsStore = fsApi.existsSync(path.join(sourceDir, LOCATIONS_FILE)) || MERGED_STORES.some((store) => {
    const dir = path.join(sourceDir, store);
    try { return fsApi.existsSync(dir) && fsApi.readdirSync(dir).length > 0; } catch { return false; }
  });
  return holdsStore ? { dir: sourceDir, merged: marker?.categories ?? [] } : null;
}

/** Write the marker: `done` adds `categories` to those already merged; `declined` ends every offer. */
function writeMarker(sourceDir, state, fsApi, categories = [], now = new Date()) {
  if (state !== 'done' && state !== 'declined') throw new Error(`Unknown merge marker: ${state}`);
  const marker = { state, at: now.toISOString() };
  if (state === 'done') {
    const before = readMarker(sourceDir, fsApi);
    const merged = before?.state === 'done' ? before.categories : [];
    marker.categories = [...new Set([...merged, ...categories.filter((key) => typeof key === 'string')])];
  }
  fsApi.writeFileSync(path.join(sourceDir, MARKER_FILE), JSON.stringify(marker));
}

module.exports = { MARKER_FILE, MERGED_STORES, SOURCE_STORES, mergeSource, readMarker, writeMarker };
