// Preload runs before the renderer with contextIsolation on. Exposes a minimal desktop-only bridge:
// a CORS-free HTTP fetch and a native VRAM readout, both performed in the main process. Its presence
// (`window.formamorphDesktop`) is also how the app detects it's running in the desktop build.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('formamorphDesktop', {
  fetch: (req) => ipcRenderer.invoke('net-fetch', req),
  vramStats: () => ipcRenderer.invoke('vram-stats'),
  // Local LLM engine: start/stop a GGUF served on a localhost OpenAI endpoint, and read its status.
  llm: {
    start: (opts) => ipcRenderer.invoke('llm-start', opts),
    stop: () => ipcRenderer.invoke('llm-stop'),
    status: () => ipcRenderer.invoke('llm-status'),
  },
});
