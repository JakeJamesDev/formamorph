// Electron main process: thin desktop shell around the built web app (dist/).
// Loads the SPA from a privileged custom scheme so module workers, WASM, WebGPU,
// and fetch behave like a normal web origin (raw file:// gives a null origin and breaks them).
const { app, BrowserWindow, Menu, protocol, net, ipcMain, session, shell, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const { collect: collectVram } = require('./vramCollect.cjs');
const llmEngine = require('./llmEngine.cjs');
const modelDownload = require('./modelDownload.cjs');
const { scanModels, resolveModelRef, isRootRef } = require('./modelScan.cjs');
const modelMove = require('./modelMove.cjs');
const { portableUserDataDir, migratePersistentStores } = require('./portableProfile.cjs');
const { corsResponse } = require('./corsShim.cjs');
const { contextMenuTemplate } = require('./contextMenu.cjs');
const updater = require('./updater.cjs');

// Portable/AppImage builds keep their whole profile (settings, saves, worlds, library) beside the exe so
// copying the folder carries everything; installed (mac dmg) and dev keep the OS-default userData (dev would
// otherwise dump the Chromium profile into the repo). Must run before app-ready — module load qualifies. On
// the first post-change launch, migrate the persistent stores out of the old default location once.
const portableProfile = portableUserDataDir();
if (portableProfile) {
  const defaultUserData = app.getPath('userData'); // capture BEFORE overriding
  const fresh = !fs.existsSync(portableProfile) || fs.readdirSync(portableProfile).length === 0;
  try { fs.mkdirSync(portableProfile, { recursive: true }); } catch { /* ignore */ }
  if (fresh && fs.existsSync(defaultUserData)) migratePersistentStores(defaultUserData, portableProfile);
  app.setPath('userData', portableProfile);
}

const DIST = path.join(__dirname, '..', 'dist');

// Where local GGUF models live (and where the model downloader will land them). A single window is
// tracked so engine status changes can be pushed to the renderer.
let mainWindow = null;

// Engine load options set by the renderer (from settings). Defaults match the renderer's defaults so a
// user who hasn't customized them never triggers a reload. contextSize bounds the KV cache (VRAM);
// gpuLayers null = auto-offload all that fit.
// gpuLayers -1 = AUTO (fit as many layers as VRAM allows); -2 = MAX (all layers); >=0 = literal count.
// Must match the renderer's DEFAULT_LOCAL_GPU_LAYERS so a fresh boot doesn't trigger a needless reload.
let engineOptions = { contextSize: 8192, gpuLayers: -1, flashAttention: true, parallelRequests: 2 };

// Keep the (multi-GB) models beside the app so a portable build stays self-contained — burying them in
// AppData orphans them for a portable exe with no uninstaller. Portable Windows builds run from a temp
// dir but expose PORTABLE_EXECUTABLE_DIR (the exe's real folder); AppImage exposes APPIMAGE; dev uses the
// project dir; an installed mac/other build falls back to the conventional userData path.
function appBaseDir() {
  if (process.env.FORMAMORPH_ROOT) return process.env.FORMAMORPH_ROOT; // Windows launcher root (app runs from <root>/app)
  if (process.env.PORTABLE_EXECUTABLE_DIR) return process.env.PORTABLE_EXECUTABLE_DIR;
  if (process.env.APPIMAGE) return path.dirname(process.env.APPIMAGE);
  if (!app.isPackaged) return app.getAppPath();
  return app.getPath('userData');
}
// The built-in default. Kept as the fallback rather than baked into the saved settings so a portable
// install that never changes it still resolves relative to wherever the folder was copied to.
const defaultModelsDir = () => path.join(appBaseDir(), 'models');

// Where downloads land and where we're allowed to delete: the user's chosen folder, or the default.
const modelsDir = () => modelLocations.downloadDir || defaultModelsDir();

// Model folders. downloadDir null = the built-in default. externalDir is an optional extra folder to look
// in (a user's existing LM Studio / Ollama library), read-only. Lives in userData — which portable builds
// redirect beside the exe — and is read in main because main is where the load path gets confined.
const locationsFile = () => path.join(app.getPath('userData'), 'model-locations.json');
let modelLocations = { downloadDir: null, externalDir: null, searchSubfolders: true };
try {
  const saved = JSON.parse(fs.readFileSync(locationsFile(), 'utf8'));
  modelLocations = {
    downloadDir: typeof saved.downloadDir === 'string' && saved.downloadDir ? saved.downloadDir : null,
    externalDir: typeof saved.externalDir === 'string' && saved.externalDir ? saved.externalDir : null,
    searchSubfolders: saved.searchSubfolders !== false,
  };
} catch { /* no saved locations yet */ }

// Ensure the download folder exists so the picker/downloader have somewhere to land files.
try { fs.mkdirSync(modelsDir(), { recursive: true }); } catch { /* ignore */ }

const scanOptions = () => ({ rootDir: modelsDir(), externalDir: modelLocations.externalDir, searchSubfolders: modelLocations.searchSubfolders });

/** Persist the current folder settings; a failed write only costs the setting on next launch. */
function saveLocations() {
  try {
    fs.mkdirSync(path.dirname(locationsFile()), { recursive: true });
    fs.writeFileSync(locationsFile(), JSON.stringify(modelLocations, null, 2));
  } catch { /* ignore */ }
}

/** The full folder picture the renderer renders, including whether each folder is reachable right now. */
const locationsPayload = () => ({
  rootDir: modelsDir(),
  defaultDir: defaultModelsDir(),
  isDefaultDir: !modelLocations.downloadDir,
  downloadDirMissing: !fs.existsSync(modelsDir()),
  freeBytes: modelMove.freeSpace(modelsDir()),
  externalDir: modelLocations.externalDir,
  searchSubfolders: modelLocations.searchSubfolders,
  externalMissing: !!modelLocations.externalDir && !fs.existsSync(modelLocations.externalDir),
  lmStudioDir: detectLmStudioDir(),
});

// Where LM Studio keeps its library, newest layout first. Probed (not assumed) so the quick-pick button
// only appears when there's really something to point at.
function detectLmStudioDir() {
  const home = os.homedir();
  const candidates = [
    path.join(home, '.lmstudio', 'models'),
    path.join(home, '.cache', 'lm-studio', 'models'),
  ];
  return candidates.find((dir) => { try { return fs.statSync(dir).isDirectory(); } catch { return false; } }) ?? null;
}

// Push every engine status change to the renderer (it also polls once on mount via 'llm-status').
llmEngine.onStatus((state) => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('llm-status', state);
});

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
]);

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow = win;

  // External links (footer socials, the update dialog's "Full changelog") open in the system browser, not a
  // new in-app window — deny the popup and hand http(s) URLs to the OS.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  // Spellcheck suggestions and clipboard actions. See contextMenu.cjs.
  win.webContents.on('context-menu', (_event, params) => {
    const template = contextMenuTemplate(params, {
      replaceMisspelling: (word) => win.webContents.replaceMisspelling(word),
      addToDictionary: (word) => win.webContents.session.addWordToSpellCheckerDictionary(word),
    });
    if (template.length) Menu.buildFromTemplate(template).popup({ window: win });
  });

  // Keep the window on its own origin. An in-window navigation away from app://local (or the dev server) —
  // e.g. a redirect from rendered/imported content — would run with the full preload bridge (net-fetch to
  // localhost, llm control) attached. Block it; http(s) targets still open in the system browser.
  win.webContents.on('will-navigate', (event, url) => {
    const dev = process.env.VITE_DEV_SERVER_URL;
    const allowed = dev ? url.startsWith(dev) : url.startsWith('app://local');
    if (!allowed) {
      event.preventDefault();
      if (/^https?:\/\//.test(url)) shell.openExternal(url);
    }
  });

  // Dev: load the Vite dev server when its URL is provided; otherwise the packaged build.
  const devURL = process.env.VITE_DEV_SERVER_URL;
  if (devURL) win.loadURL(devURL);
  else win.loadURL('app://local/index.html');

  // Post-update health signal: when the Windows launcher relaunches us with --just-updated, drop a
  // launch-ok marker once the UI actually loads so the launcher knows the swapped /app booted (and won't
  // roll back). Harmless no-op on every other launch/platform.
  if (process.argv.includes('--just-updated')) {
    win.webContents.once('did-finish-load', () => {
      try {
        const dir = path.join(app.getPath('userData'), 'updates');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'launch-ok'), String(Date.now()));
      } catch { /* ignore */ }
    });
  }
}

// Desktop-only network bridge: renderer → main HTTP fetch that isn't bound by browser CORS. Used by
// cloud image providers (OpenAI-style) whose APIs can't be reached directly from the web build.
ipcMain.handle('net-fetch', async (_event, { url, method = 'GET', headers = {}, body }) => {
  // Scheme allow-list: this bridge exists only for HTTP APIs. net.fetch would happily serve file:
  // (an arbitrary local-file read for anything that can script the renderer), so reject non-HTTP.
  const scheme = new URL(url).protocol;
  if (scheme !== 'http:' && scheme !== 'https:') {
    throw new Error(`net-fetch: unsupported URL scheme '${scheme}'`);
  }
  const res = await net.fetch(url, { method, headers, body });
  return { ok: res.ok, status: res.status, body: await res.text() };
});

// Desktop-native VRAM readout: run nvidia-smi in the main process so the Hardware tab works without a
// separate helper. Mirrors the standalone helper's "no GPU" payload when nvidia-smi is missing/errors.
ipcMain.handle('vram-stats', async () => {
  try {
    // selfPid lets the renderer pick our own row out of the per-process list (the bundled engine runs in
    // this process), to attribute Formamorph's VRAM share on the widget.
    return { ...(await collectVram()), selfPid: process.pid };
  } catch {
    return { error: 'nvidia-smi-not-found', gpus: [], processes: [], selfPid: process.pid };
  }
});

// Desktop-only local LLM: load a GGUF and serve an OpenAI-compatible endpoint on localhost. The renderer
// then points its normal OpenAI endpoint at it. Handlers return the engine's serializable state. Loading
// is filename-only and confined to the models folder — no arbitrary-path start is exposed over IPC.
// Load an installed model by ref (a bare filename in the models folder, or 'ext:<relative path>' in the
// user's external folder), using the current options. resolveModelRef confines the result to that folder.
ipcMain.handle('llm-load', async (_event, ref) => {
  const modelPath = resolveModelRef(ref, scanOptions());
  if (!modelPath) throw new Error('That model is no longer in a searched folder.');
  await llmEngine.stop();
  return llmEngine.start({ modelPath, ...engineOptions });
});
ipcMain.handle('llm-stop', () => llmEngine.stop());
ipcMain.handle('llm-status', () => llmEngine.getState());
ipcMain.handle('llm-models-dir', () => modelsDir());

// Update engine load options (context size / GPU layers). Reloads the current model if one is loaded and
// the options actually changed, so the new context/VRAM budget takes effect.
ipcMain.handle('llm-set-options', async (_event, opts) => {
  const next = {
    contextSize: opts.contextSize,
    gpuLayers: opts.gpuLayers,
    flashAttention: opts.flashAttention === true,
    parallelRequests: typeof opts.parallelRequests === 'number' ? opts.parallelRequests : engineOptions.parallelRequests,
  };
  const changed = next.contextSize !== engineOptions.contextSize
    || next.gpuLayers !== engineOptions.gpuLayers
    || next.flashAttention !== engineOptions.flashAttention
    || next.parallelRequests !== engineOptions.parallelRequests;
  engineOptions = next;
  const loaded = llmEngine.getState().modelPath;
  if (changed && loaded) {
    await llmEngine.stop();
    return llmEngine.start({ modelPath: loaded, ...engineOptions });
  }
  return llmEngine.getState();
});

// Installed GGUF filenames across every searched folder (used where only names matter).
ipcMain.handle('llm-list-models', () => scanModels(scanOptions()).map((m) => m.fileName));

// Installed GGUFs with sizes and provenance, as [{ id, fileName, subpath, size, path, source }] — any GGUF
// in the models folder or the user's external folder, not just ones from our downloader.
ipcMain.handle('llm-list-installed', () => scanModels(scanOptions()));

// The searched folders: where downloads land (ours — deletable) and the user's optional extra library
// (read-only). lmStudioDir is a suggestion for the quick-pick button, null when LM Studio isn't installed.
ipcMain.handle('llm-get-locations', () => locationsPayload());

// Set the download folder and/or the external search folder, and persist the choice. A folder that doesn't
// exist is rejected here; one that disappears later is kept (an unmounted drive shouldn't wipe the setting).
// Only the keys present in `opts` change, so the UI can set one without restating the other.
ipcMain.handle('llm-set-locations', (_event, opts) => {
  const asFolder = (value, label) => {
    if (!value) return null;
    const dir = String(value);
    let ok = false;
    try { ok = fs.statSync(dir).isDirectory(); } catch { /* not a folder */ }
    if (!ok) throw new Error(`${label} isn't a folder: ${dir}`);
    return dir;
  };

  const next = { ...modelLocations };
  if ('downloadDir' in opts) {
    next.downloadDir = asFolder(opts.downloadDir, 'Download folder');
    // A download folder we can't write to would fail later, at the least recoverable moment.
    if (next.downloadDir) {
      try { fs.accessSync(next.downloadDir, fs.constants.W_OK); } catch {
        throw new Error(`Can't write to that folder: ${next.downloadDir}`);
      }
    }
  }
  if ('externalDir' in opts) next.externalDir = asFolder(opts.externalDir, 'Search folder');
  if ('searchSubfolders' in opts) next.searchSubfolders = opts.searchSubfolders !== false;

  modelLocations = next;
  saveLocations();
  try { fs.mkdirSync(modelsDir(), { recursive: true }); } catch { /* ignore */ }
  return locationsPayload();
});

// Native folder picker; resolves null when the user cancels. `title` distinguishes the two pickers.
ipcMain.handle('llm-pick-folder', async (_event, title) => {
  const opts = { properties: ['openDirectory', 'createDirectory'], title: title || 'Choose a folder' };
  const res = mainWindow && !mainWindow.isDestroyed()
    ? await dialog.showOpenDialog(mainWindow, opts)
    : await dialog.showOpenDialog(opts);
  return res.canceled ? null : (res.filePaths[0] ?? null);
});

// What a move would carry: models plus resumable partials, so the prompt can state a count and a size.
ipcMain.handle('llm-count-movable', (_event, dir) => modelMove.countMovable(dir));

// Move downloaded models between folders after the download folder changes. The loaded model is unloaded
// first (to release its file lock) and reloaded afterwards from wherever it ended up, so a move that fails
// for that one file doesn't leave the engine stopped.
ipcMain.handle('llm-move-models', async (_event, { from, to }) => {
  const loadedBefore = llmEngine.getState().modelPath;
  const wasInSource = loadedBefore && path.dirname(path.resolve(loadedBefore)) === path.resolve(from);
  if (wasInSource) await llmEngine.stop();

  const result = await modelMove.moveModels({ from, to }, (p) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('llm-move-progress', p);
  });

  if (wasInSource) {
    const name = path.basename(loadedBefore);
    // Reload from the new folder if it made the trip, otherwise from where it stayed.
    const back = result.moved.includes(name) ? path.join(to, name) : loadedBefore;
    if (fs.existsSync(back)) await llmEngine.start({ modelPath: back, ...engineOptions });
  }
  return result;
});

ipcMain.handle('llm-move-cancel', () => { modelMove.cancel(); return true; });

// Free bytes on the volume holding a folder, for the "won't fit" warning. null when it can't be read.
ipcMain.handle('llm-free-space', (_event, dir) => modelMove.freeSpace(dir || modelsDir()));

// Download a catalog model from Hugging Face, then load it. Progress streams to the renderer.
ipcMain.handle('llm-download', async (_event, { url, fileName }) => {
  // Refuse rather than silently redirecting to the default folder: a model landing somewhere the user
  // didn't choose can quietly fill the drive they moved downloads off in the first place.
  const dest = modelsDir();
  if (!fs.existsSync(dest)) {
    throw new Error(`The download folder isn't available:\n${dest}\n\nReconnect it or choose a new one.`);
  }
  const finalPath = await modelDownload.download({ url, fileName, destDir: dest }, (p) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('llm-download-progress', p);
  });
  await llmEngine.stop();
  await llmEngine.start({ modelPath: finalPath, ...engineOptions });
  return { path: finalPath };
});
ipcMain.handle('llm-download-cancel', () => { modelDownload.cancel(); return true; });

// Partial (.part) downloads waiting to be resumed, as [{ fileName, received }].
ipcMain.handle('llm-list-partials', () => modelDownload.listPartials(modelsDir()));
// Throw away a partial download.
ipcMain.handle('llm-discard-partial', (_event, fileName) => modelDownload.discardPartial(modelsDir(), fileName));

// Delete an installed model (stopping the engine first if it's the loaded one, to release the file lock).
// Also clears any leftover .part for that model.
// Deleting is root-only: models found in the user's external folder belong to whatever app put them there.
ipcMain.handle('llm-delete-model', async (_event, fileName) => {
  if (!isRootRef(fileName)) return false;
  const target = path.join(modelsDir(), path.basename(fileName));
  if (llmEngine.getState().modelPath === target) await llmEngine.stop();
  modelDownload.discardPartial(modelsDir(), fileName);
  try { fs.unlinkSync(target); return true; } catch { return false; }
});

// Desktop auto-updater IPC (per-platform download/apply; detection is renderer-side). getWindow returns the
// live window so progress events reach the current renderer.
updater.init({ getWindow: () => mainWindow });

app.whenReady().then(() => {
  // Desktop CORS shim: the renderer lives at app://local, so its fetches to an external endpoint (a user's
  // custom LLM server, the community server, Hugging Face) are browser-CORS-gated. Servers that send no CORS
  // headers (e.g. LM Studio with CORS off) fail the preflight, which shows in-app as "Failed to process AI
  // request". A native app has no reason to be CORS-bound, so rewrite external responses to carry permissive
  // CORS headers and force an ok status onto the OPTIONS preflight — keeps streaming + webSecurity. See corsShim.cjs.
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback(corsResponse(details));
  });

  // Map app://local/<path> → dist/<path>, defaulting to index.html. Files are kept inside DIST.
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    const rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
    const filePath = path.join(DIST, rel);
    // Containment must be a path check, not a string prefix: `startsWith(DIST)` also passes a sibling like
    // `<DIST>-evil`. `path.relative` yields a `..`-leading (or absolute) path when filePath escapes DIST.
    const relToDist = path.relative(DIST, filePath);
    if (relToDist.startsWith('..') || path.isAbsolute(relToDist)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(filePath).toString());
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Free the model + close the local server before the process exits.
app.on('will-quit', () => { llmEngine.stop(); });
