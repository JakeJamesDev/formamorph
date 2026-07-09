// Portable-build profile location + one-time migration of the persistent Chromium stores. Deliberately has
// no electron dependency so it's unit-testable in plain Node. Wired into electron/main.cjs before app-ready
// (userData must be set before Chromium touches the profile). See that file for the call site.
const path = require('node:path');
const fs = require('node:fs');

// Renderer stores worth carrying to the portable folder (all our persistent data lives here: saves, worlds,
// entities, dictionaries, model library, settings/auth/theme). Caches are intentionally NOT migrated
// (Cache, Code Cache, GPUCache, DawnCache, blob_storage, Network, Service Worker) — they regenerate.
const PERSISTENT_STORES = ['IndexedDB', 'Local Storage', 'Session Storage'];

/** The folder a relocatable build should keep its data beside (portable .exe or AppImage), or null for
 *  installed (mac dmg) and dev builds — those keep the OS-default userData. Runtime markers only. */
function portableRoot(env = process.env) {
  if (env.PORTABLE_EXECUTABLE_DIR) return env.PORTABLE_EXECUTABLE_DIR;
  if (env.APPIMAGE) return path.dirname(env.APPIMAGE);
  return null;
}

/** Where the Chromium profile should live for a portable build, or null when the default should be kept. */
function portableUserDataDir(env = process.env) {
  const root = portableRoot(env);
  return root ? path.join(root, 'userdata') : null;
}

/** Copy the persistent stores from the old default profile into a fresh portable profile, once. No-op for a
 *  store already present at the target or absent at the source, so it never clobbers newer portable data. */
function migratePersistentStores(from, to) {
  for (const store of PERSISTENT_STORES) {
    const src = path.join(from, store);
    const dst = path.join(to, store);
    if (fs.existsSync(src) && !fs.existsSync(dst)) {
      try { fs.cpSync(src, dst, { recursive: true }); }
      catch (e) { console.error(`[portable] migrate ${store} failed:`, e); }
    }
  }
}

module.exports = { PERSISTENT_STORES, portableRoot, portableUserDataDir, migratePersistentStores };
