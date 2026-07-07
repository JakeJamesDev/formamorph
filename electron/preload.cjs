// Preload runs before the renderer with contextIsolation on. Exposes a minimal desktop-only bridge:
// a CORS-free HTTP fetch and a native VRAM readout, both performed in the main process. Its presence
// (`window.formamorphDesktop`) is also how the app detects it's running in the desktop build.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('formamorphDesktop', {
  fetch: (req) => ipcRenderer.invoke('net-fetch', req),
  vramStats: () => ipcRenderer.invoke('vram-stats'),
  // Local LLM engine: start/stop a GGUF served on a localhost OpenAI endpoint, read its status, learn
  // where models live, and subscribe to status changes (auto-start, load progress, errors).
  llm: {
    start: (opts) => ipcRenderer.invoke('llm-start', opts),
    stop: () => ipcRenderer.invoke('llm-stop'),
    status: () => ipcRenderer.invoke('llm-status'),
    modelsDir: () => ipcRenderer.invoke('llm-models-dir'),
    onStatus: (cb) => {
      const handler = (_event, state) => cb(state);
      ipcRenderer.on('llm-status', handler);
      return () => ipcRenderer.removeListener('llm-status', handler);
    },
    // Model management: list installed GGUFs, download a catalog model (with progress), cancel, delete.
    listModels: () => ipcRenderer.invoke('llm-list-models'),
    listInstalled: () => ipcRenderer.invoke('llm-list-installed'),
    load: (fileName) => ipcRenderer.invoke('llm-load', fileName),
    setOptions: (opts) => ipcRenderer.invoke('llm-set-options', opts),
    download: (opts) => ipcRenderer.invoke('llm-download', opts),
    cancelDownload: () => ipcRenderer.invoke('llm-download-cancel'),
    listPartials: () => ipcRenderer.invoke('llm-list-partials'),
    discardPartial: (fileName) => ipcRenderer.invoke('llm-discard-partial', fileName),
    deleteModel: (fileName) => ipcRenderer.invoke('llm-delete-model', fileName),
    onDownloadProgress: (cb) => {
      const handler = (_event, progress) => cb(progress);
      ipcRenderer.on('llm-download-progress', handler);
      return () => ipcRenderer.removeListener('llm-download-progress', handler);
    },
  },
});
