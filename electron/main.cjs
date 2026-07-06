// Electron main process: thin desktop shell around the built web app (dist/).
// Loads the SPA from a privileged custom scheme so module workers, WASM, WebGPU,
// and fetch behave like a normal web origin (raw file:// gives a null origin and breaks them).
const { app, BrowserWindow, protocol, net, ipcMain } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { collect: collectVram } = require('./vramCollect.cjs');
const llmEngine = require('./llmEngine.cjs');

const DIST = path.join(__dirname, '..', 'dist');

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
ipcMain.handle('llm-stop', () => llmEngine.stop());
ipcMain.handle('llm-status', () => llmEngine.getState());

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
