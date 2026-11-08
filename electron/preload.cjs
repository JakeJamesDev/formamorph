// Preload runs before the renderer with contextIsolation on. Exposes a minimal desktop-only bridge:
// a CORS-free HTTP fetch and a native VRAM readout, both performed in the main process. Its presence
// (`window.formamorphDesktop`) is also how the app detects it's running in the desktop build.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('formamorphDesktop', {
  fetch: (req) => ipcRenderer.invoke('net-fetch', req),
  // Main passes this argument only where it hides the title bar. See windowChrome.cjs.
  windowOverlay: process.argv.includes('--formamorph-window-overlay'),
  setWindowSymbolColor: (color) => ipcRenderer.invoke('window-symbol-color', color),
  isFullScreen: () => ipcRenderer.sendSync('window-is-full-screen'),
  onFullScreen: (cb) => {
    // FULL_SCREEN_CHANNEL in windowChrome.cjs; the sandboxed preload can't require it.
    const handler = (_event, on) => cb(on);
    ipcRenderer.on('window-full-screen', handler);
    return () => ipcRenderer.removeListener('window-full-screen', handler);
  },
  leaveFullScreen: () => ipcRenderer.invoke('window-leave-full-screen'),
  vramStats: () => ipcRenderer.invoke('vram-stats'),
  cudaSupport: () => ipcRenderer.invoke('cuda-support'),
  // The optional CUDA engine build: status, install with pushed progress, cancel (keeps partials), remove.
  cuda: {
    status: () => ipcRenderer.invoke('cuda-status'),
    install: () => ipcRenderer.invoke('cuda-install'),
    cancel: () => ipcRenderer.invoke('cuda-cancel'),
    remove: () => ipcRenderer.invoke('cuda-remove'),
    onStatus: (cb) => {
      const handler = (_event, s) => cb(s);
      ipcRenderer.on('cuda-status', handler);
      return () => ipcRenderer.removeListener('cuda-status', handler);
    },
  },
  // The ComfyUI server whose Origin check the main process passes for this window; null for none.
  setComfyEndpoint: (url) => ipcRenderer.invoke('comfy-endpoint', url),
  // Local LLM engine: stop/load a GGUF served on a localhost OpenAI endpoint, read its status, learn
  // where models live, and subscribe to status changes (auto-start, load progress, errors). Loading takes a
  // ref (`load`), which main resolves inside a searched folder — no arbitrary-path start is exposed.
  llm: {
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
    load: (ref) => ipcRenderer.invoke('llm-load', ref),
    // Searched folders: where downloads land plus one optional external library (e.g. LM Studio's).
    getLocations: () => ipcRenderer.invoke('llm-get-locations'),
    setLocations: (opts) => ipcRenderer.invoke('llm-set-locations', opts),
    pickFolder: (title) => ipcRenderer.invoke('llm-pick-folder', title),
    freeSpace: (dir) => ipcRenderer.invoke('llm-free-space', dir),
    // Moving models after the download folder changes, with per-file progress.
    countMovable: (dir) => ipcRenderer.invoke('llm-count-movable', dir),
    moveModels: (opts) => ipcRenderer.invoke('llm-move-models', opts),
    cancelMove: () => ipcRenderer.invoke('llm-move-cancel'),
    onMoveProgress: (cb) => {
      const handler = (_event, p) => cb(p);
      ipcRenderer.on('llm-move-progress', handler);
      return () => ipcRenderer.removeListener('llm-move-progress', handler);
    },
    setOptions: (opts) => ipcRenderer.invoke('llm-set-options', opts),
    setContextOverflow: (policy) => ipcRenderer.invoke('llm-set-context-overflow', policy),
    listDevices: () => ipcRenderer.invoke('llm-list-devices'),
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
  // Profile merge: whether the AppData profile waits to merge, its record summaries and records, and the
  // marker that ends the offer.
  profileMerge: {
    offer: () => ipcRenderer.invoke('merge-offer'),
    summaries: (categories) => ipcRenderer.invoke('merge-summaries', categories),
    record: (category, id) => ipcRenderer.invoke('merge-record', { category, id }),
    settings: () => ipcRenderer.invoke('merge-settings'),
    modelFolder: () => ipcRenderer.invoke('merge-model-folder'),
    fillModelFolder: (field) => ipcRenderer.invoke('merge-model-folder-fill', field),
    models: () => ipcRenderer.invoke('merge-models'),
    moveModel: async (name, onBytes) => {
      const listener = (_event, bytes) => onBytes?.(bytes);
      ipcRenderer.on('merge-model-progress', listener);
      try {
        await ipcRenderer.invoke('merge-model-move', name);
      } finally {
        ipcRenderer.removeListener('merge-model-progress', listener);
      }
    },
    restart: () => ipcRenderer.invoke('merge-restart'),
    later: () => ipcRenderer.invoke('merge-later'),
    mark: (state, categories) => ipcRenderer.invoke('merge-mark', { state, categories }),
  },
  // Desktop auto-updater: detection is renderer-side (via the fetch bridge); these drive the per-platform
  // download/apply and stream progress + completion back from the main process.
  update: {
    check: () => ipcRenderer.invoke('update-check'),
    pending: () => ipcRenderer.invoke('update-pending'),
    download: (opts) => ipcRenderer.invoke('update-download', opts),
    apply: () => ipcRenderer.invoke('update-apply'),
    onAvailable: (cb) => {
      const handler = (_event, info) => cb(info);
      ipcRenderer.on('update-available', handler);
      return () => ipcRenderer.removeListener('update-available', handler);
    },
    onProgress: (cb) => {
      const handler = (_event, p) => cb(p);
      ipcRenderer.on('update-download-progress', handler);
      return () => ipcRenderer.removeListener('update-download-progress', handler);
    },
    onDownloaded: (cb) => {
      const handler = () => cb();
      ipcRenderer.on('update-downloaded', handler);
      return () => ipcRenderer.removeListener('update-downloaded', handler);
    },
  },
});
