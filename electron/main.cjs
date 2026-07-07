// Electron main process: thin desktop shell around the built web app (dist/).
// Loads the SPA from a privileged custom scheme so module workers, WASM, WebGPU,
// and fetch behave like a normal web origin (raw file:// gives a null origin and breaks them).
const { app, BrowserWindow, protocol, net, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { collect: collectVram } = require('./vramCollect.cjs');
const llmEngine = require('./llmEngine.cjs');
const modelDownload = require('./modelDownload.cjs');

const DIST = path.join(__dirname, '..', 'dist');

// Where local GGUF models live (and where the model downloader will land them). A single window is
// tracked so engine status changes can be pushed to the renderer.
let mainWindow = null;

// Engine load options set by the renderer (from settings). Defaults match the renderer's defaults so a
// user who hasn't customized them never triggers a reload. contextSize bounds the KV cache (VRAM);
// gpuLayers null = auto-offload all that fit.
let engineOptions = { contextSize: 8192, gpuLayers: 64, flashAttention: false };

// Keep the (multi-GB) models beside the app so a portable build stays self-contained — burying them in
// AppData orphans them for a portable exe with no uninstaller. Portable Windows builds run from a temp
// dir but expose PORTABLE_EXECUTABLE_DIR (the exe's real folder); AppImage exposes APPIMAGE; dev uses the
// project dir; an installed mac/other build falls back to the conventional userData path.
function appBaseDir() {
  if (process.env.PORTABLE_EXECUTABLE_DIR) return process.env.PORTABLE_EXECUTABLE_DIR;
  if (process.env.APPIMAGE) return path.dirname(process.env.APPIMAGE);
  if (!app.isPackaged) return app.getAppPath();
  return app.getPath('userData');
}
const modelsDir = () => path.join(appBaseDir(), 'models');
// Ensure the models folder exists so the picker/downloader have somewhere to land files.
try { fs.mkdirSync(modelsDir(), { recursive: true }); } catch { /* ignore */ }

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

  // Dev: load the Vite dev server when its URL is provided; otherwise the packaged build.
  const devURL = process.env.VITE_DEV_SERVER_URL;
  if (devURL) win.loadURL(devURL);
  else win.loadURL('app://local/index.html');
}

// Desktop-only network bridge: renderer → main HTTP fetch that isn't bound by browser CORS. Used by
// cloud image providers (OpenAI-style) whose APIs can't be reached directly from the web build.
ipcMain.handle('net-fetch', async (_event, { url, method = 'GET', headers = {}, body }) => {
  const res = await net.fetch(url, { method, headers, body });
  return { ok: res.ok, status: res.status, body: await res.text() };
});

// Desktop-native VRAM readout: run nvidia-smi in the main process so the Hardware tab works without a
// separate helper. Mirrors the standalone helper's "no GPU" payload when nvidia-smi is missing/errors.
ipcMain.handle('vram-stats', async () => {
  try {
    return await collectVram();
  } catch {
    return { error: 'nvidia-smi-not-found', gpus: [], processes: [] };
  }
});

// Desktop-only local LLM: load a GGUF and serve an OpenAI-compatible endpoint on localhost. The renderer
// then points its normal OpenAI endpoint at it. Handlers return the engine's serializable state.
ipcMain.handle('llm-start', (_event, opts) => llmEngine.start(opts));
// Load an installed model by filename (resolves it inside the models folder), using the current options.
ipcMain.handle('llm-load', async (_event, fileName) => {
  await llmEngine.stop();
  return llmEngine.start({ modelPath: path.join(modelsDir(), path.basename(fileName)), ...engineOptions });
});
ipcMain.handle('llm-stop', () => llmEngine.stop());
ipcMain.handle('llm-status', () => llmEngine.getState());
ipcMain.handle('llm-models-dir', () => modelsDir());

// Update engine load options (context size / GPU layers). Reloads the current model if one is loaded and
// the options actually changed, so the new context/VRAM budget takes effect.
ipcMain.handle('llm-set-options', async (_event, opts) => {
  const next = { contextSize: opts.contextSize, gpuLayers: opts.gpuLayers, flashAttention: opts.flashAttention === true };
  const changed = next.contextSize !== engineOptions.contextSize
    || next.gpuLayers !== engineOptions.gpuLayers
    || next.flashAttention !== engineOptions.flashAttention;
  engineOptions = next;
  const loaded = llmEngine.getState().modelPath;
  if (changed && loaded) {
    await llmEngine.stop();
    return llmEngine.start({ modelPath: loaded, ...engineOptions });
  }
  return llmEngine.getState();
});

// Installed GGUF filenames in the models folder.
ipcMain.handle('llm-list-models', () => {
  try {
    return fs.readdirSync(modelsDir()).filter((f) => f.toLowerCase().endsWith('.gguf')).sort();
  } catch {
    return [];
  }
});

// Download a catalog model from Hugging Face, then load it. Progress streams to the renderer.
ipcMain.handle('llm-download', async (_event, { url, fileName }) => {
  const finalPath = await modelDownload.download({ url, fileName, destDir: modelsDir() }, (p) => {
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
ipcMain.handle('llm-delete-model', async (_event, fileName) => {
  const target = path.join(modelsDir(), path.basename(fileName));
  if (llmEngine.getState().modelPath === target) await llmEngine.stop();
  modelDownload.discardPartial(modelsDir(), fileName);
  try { fs.unlinkSync(target); return true; } catch { return false; }
});

app.whenReady().then(() => {
  // Map app://local/<path> → dist/<path>, defaulting to index.html. Files are kept inside DIST.
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    const rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
    const filePath = path.join(DIST, rel);
    if (!filePath.startsWith(DIST)) return new Response('Not found', { status: 404 });
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
