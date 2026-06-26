// Electron main process: thin desktop shell around the built web app (dist/).
// Loads the SPA from a privileged custom scheme so module workers, WASM, WebGPU,
// and fetch behave like a normal web origin (raw file:// gives a null origin and breaks them).
const { app, BrowserWindow, protocol, net } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

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
