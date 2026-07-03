// Preload runs before the renderer with contextIsolation on. Exposes a minimal desktop-only bridge:
// a CORS-free HTTP fetch performed in the main process, used by cloud image providers. Its presence
// (`window.formamorphDesktop`) is also how the app detects it's running in the desktop build.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('formamorphDesktop', {
  fetch: (req) => ipcRenderer.invoke('net-fetch', req),
});
