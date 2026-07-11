// Desktop auto-updater (main process). Detection is done renderer-side (UpdateService hits the GitHub
// Releases API through the net-fetch bridge on every platform); this module owns the platform-specific
// *download + apply*:
//   - macOS: notifier only — open the release's .dmg in the browser (no Squirrel, no signing).
//   - Linux: electron-updater AppImage self-update (wired in a later step).
//   - Windows: launcher `/app` swap (wired in a later step).
// Progress/lifecycle events are pushed to the renderer with the same webContents.send pattern the model
// downloader uses, so the footer's `update.onProgress` / `onDownloaded` subscriptions light up uniformly.

const { app, ipcMain, net, shell } = require('electron');
const winUpdate = require('./winUpdate.cjs');

const REPO = 'JakeJamesDev/formamorph';
const RELEASES_URL = `https://api.github.com/repos/${REPO}/releases`;

let getWin = () => null;
function send(channel, payload) {
  const w = getWin();
  if (w && !w.isDestroyed()) w.webContents.send(channel, payload);
}

// electron-updater is only used on Linux (AppImage self-update); lazy-require + configure once so macOS and
// Windows never load it. Manual flow: autoDownload off, download on the user's click, apply on quitAndInstall.
let autoUpdater = null;
function getAutoUpdater() {
  if (!autoUpdater) {
    ({ autoUpdater } = require('electron-updater'));
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('download-progress', (p) => send('update-download-progress', { received: p.transferred, total: p.total }));
    autoUpdater.on('update-downloaded', () => send('update-downloaded'));
  }
  return autoUpdater;
}

async function fetchReleases() {
  const res = await net.fetch(RELEASES_URL, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error(`GitHub responded ${res.status}`);
  return res.json();
}

/** The release whose tag matches `version` (with/without a leading v), else the newest. */
function findRelease(releases, version) {
  if (!Array.isArray(releases) || releases.length === 0) return null;
  if (!version) return releases[0];
  return (
    releases.find((r) => r.tag_name === version) ||
    releases.find((r) => r.tag_name === `v${version}`) ||
    null
  );
}

/** macOS notifier: open the matching release's .dmg download in the default browser. */
async function macDownload(version) {
  const releases = await fetchReleases();
  const rel = findRelease(releases, version);
  const dmg = rel && rel.assets.find((a) => a.name.toLowerCase().endsWith('.dmg'));
  if (!dmg) throw new Error('No .dmg asset found for this release');
  await shell.openExternal(dmg.browser_download_url);
}

/** Windows launcher swap: find the release's `/app` payload zip + its .sha512 sidecar, download + verify it,
 *  then stream progress/completion to the renderer. The launcher does the swap on apply. */
async function winDownload(version) {
  const releases = await fetchReleases();
  const rel = findRelease(releases, version);
  const zipAsset = rel && rel.assets.find((a) => /^app-.*-win\.zip$/.test(a.name));
  if (!zipAsset) throw new Error('No Windows update payload found for this release');
  const shaAsset = rel.assets.find((a) => a.name === `${zipAsset.name}.sha512`);
  let sha512 = null;
  if (shaAsset) {
    const r = await net.fetch(shaAsset.browser_download_url);
    if (r.ok) sha512 = (await r.text()).trim().split(/\s+/)[0];
  }
  const cleanVersion = (rel.tag_name || String(version)).replace(/^v/, '');
  await winUpdate.download({ url: zipAsset.browser_download_url, sha512, version: cleanVersion }, (p) => {
    if (p.done) send('update-downloaded');
    else send('update-download-progress', { received: p.received, total: p.total });
  });
}

/** Wire the update IPC. `getWindow` returns the current BrowserWindow for pushing progress events. */
function init({ getWindow }) {
  getWin = getWindow;

  // Renderer-driven re-check hook. Detection itself is renderer-side; the Linux electron-updater path
  // overrides this later to trigger autoUpdater.checkForUpdates().
  ipcMain.handle('update-check', async () => {});

  ipcMain.handle('update-download', async (_event, opts = {}) => {
    const { version, channel } = opts;
    if (process.platform === 'darwin') return macDownload(version);
    if (process.platform === 'linux') {
      const au = getAutoUpdater();
      au.allowPrerelease = channel === 'prerelease';
      await au.checkForUpdates();
      await au.downloadUpdate();
      return;
    }
    if (process.platform === 'win32') return winDownload(version);
    throw new Error('Auto-update download is not available on this platform');
  });

  ipcMain.handle('update-apply', async () => {
    if (process.platform === 'linux') {
      getAutoUpdater().quitAndInstall();
      return;
    }
    if (process.platform === 'win32') {
      winUpdate.apply();
      app.quit(); // release file locks so the launcher can swap /app, then it relaunches us
      return;
    }
    throw new Error('Auto-update apply is not available on this platform');
  });
}

module.exports = { init, findRelease, send };
