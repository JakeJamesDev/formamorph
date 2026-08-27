// Detection + bridge for desktop-only capabilities. In the Electron build, preload.cjs exposes
// `window.formamorphDesktop`; in the plain web build it's absent. Cloud image providers (which need a
// CORS-free proxy) route through this bridge and are disabled in the UI when it isn't present.

export interface DesktopFetchRequest {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}
export interface DesktopFetchResponse {
  ok: boolean;
  status: number;
  body: string;
}

/** Progress of an in-flight model download (see electron/modelDownload.cjs). */
export interface LocalDownloadProgress {
  fileName: string;
  /** Bytes received so far. */
  received: number;
  /** Total bytes (0 if the server didn't send content-length). */
  total: number;
  /** True on the final event, once the file is renamed into place. */
  done: boolean;
}

/** A paused/interrupted download waiting to be resumed (its `.part` on disk). */
export interface LocalPartial {
  /** The target GGUF filename (without the `.part` suffix). */
  fileName: string;
  /** Bytes already on disk. */
  received: number;
}

/** An installed GGUF in one of the searched folders (any source, not just our downloader). */
export interface LocalInstalledModel {
  /** Stable ref used to load, delete, and order this model. Root models use their bare filename; models in
   *  the external folder use `ext:<path relative to that folder>`. */
  id: string;
  fileName: string;
  /** Containing folder relative to its search root (`publisher/repo`), or '' at the top level. */
  subpath: string;
  /** On-disk size in bytes. */
  size: number;
  /** Absolute path — lets the UI match the loaded model even when two folders share a filename. */
  path: string;
  /** Which folder it came from. `external` models are read-only: loadable, never deleted by us. */
  source: 'root' | 'external';
}

/** Progress of an in-flight model move, in bytes across the whole batch. */
export interface LocalMoveProgress {
  /** File currently being moved. */
  file: string;
  movedBytes: number;
  totalBytes: number;
}

/** What a finished move did. `skipped` accounts for every file that stayed behind, and why. */
export interface LocalMoveResult {
  moved: string[];
  skipped: { file: string; reason: string }[];
  canceled: boolean;
}

/** The folders searched for models, plus what the folder picker should suggest. */
export interface LocalModelLocations {
  /** Where downloads land and where deleting is allowed — the user's choice, or the built-in default. */
  rootDir: string;
  /** The built-in `models` folder beside the app, for the "Use Default" button. */
  defaultDir: string;
  /** True when rootDir is still the built-in default (nothing custom chosen). */
  isDefaultDir: boolean;
  /** True when the download folder isn't reachable right now — downloads refuse until it's back. */
  downloadDirMissing: boolean;
  /** Free bytes on the download folder's volume, or null when it can't be read. */
  freeBytes: number | null;
  /** The user's extra library, or null when unset. */
  externalDir: string | null;
  /** Whether the external folder is searched recursively (LM Studio nests publisher/repo/file). */
  searchSubfolders: boolean;
  /** True when a configured external folder isn't there right now (unplugged drive, moved library). */
  externalMissing: boolean;
  /** Detected LM Studio library for the quick-pick button, or null when it isn't installed. */
  lmStudioDir: string | null;
}

/** Thrown message the downloader uses when a download is paused (user aborted). Not a real error. */
export const DOWNLOAD_PAUSED = 'DOWNLOAD_PAUSED';

/** Serializable status of the desktop local-LLM engine (see electron/llmEngine.cjs). */
export interface LocalLlmState {
  status: 'stopped' | 'loading' | 'ready' | 'error';
  /** Absolute path of the loaded GGUF, or null when stopped. */
  modelPath: string | null;
  /** Model id served on the OpenAI endpoint (the GGUF filename), or null. */
  modelId: string | null;
  /** Port of the local OpenAI server once ready, or null. */
  port: number | null;
  /** Error message when status is 'error'. */
  error: string | null;
  /** Whole-percent progress while status is 'loading', null at every other status. Weights stream in over
   *  tens of seconds for a large model, so this is the only sign the load is moving. */
  loadProgress: number | null;
  /** Options the loaded model was loaded with (null when no model is loaded) — lets the UI tell whether
   *  pending settings differ from what's actually applied. */
  contextSize: number | null;
  gpuLayers: number | null;
  flashAttention: boolean | null;
  /** Parallel decode slots the model was loaded with (context sequences). */
  parallelRequests: number | null;
  /** The loaded model's trained context length — the ceiling for contextSize (null when no model loaded). */
  maxContextSize: number | null;
  /** Our VRAM footprint in MB (device-usage delta across model load), or null if unknown/no model. */
  engineVramMB: number | null;
  /** The backend llama.cpp selected — 'cuda' | 'vulkan' | 'metal' | 'cpu' — or null before one is chosen.
   *  Survives a failed load, so an out-of-VRAM error still says which device it ran on. */
  gpuBackend: string | null;
  /** Devices that backend enumerated, or null when it can't enumerate them. */
  gpuDeviceNames: string[] | null;
  /** Total / free VRAM in MB on the selected device, read just before the load sizes itself against it.
   *  A mismatch against the nvidia-smi readout means llama.cpp picked a different device than expected. */
  deviceVramTotalMB: number | null;
  deviceVramFreeMB: number | null;
  /** The device index the backend was restricted to, or null when it was left unfiltered. Pinning one
   *  device is what stops llama.cpp aggregating several adapters' memory into a budget belonging to none. */
  gpuDeviceIndex: number | null;
  /** Where the pin came from — the automatic policy, the player's choice, or a chosen device that no
   *  longer exists (so the policy chose instead). Null when nothing was pinned. */
  gpuDeviceOrigin: EngineDeviceOrigin | null;
  /** The unfiltered device list the pin was resolved against, in index order — what `gpuDeviceIndex` indexes
   *  into. A pinned backend can only enumerate its own device, so this is the only record of what it was
   *  chosen from, and the answer to "why that one" in a bug report. Null when nothing was pinned. */
  gpuDeviceOptions: string[] | null;
}

/** How the engine's pinned device was arrived at. */
export type EngineDeviceOrigin = 'auto' | 'manual' | 'fallback-auto';

/** Every GPU the engine could be pinned to. An empty list under a `cpu` backend is a machine with no GPU;
 *  an empty list under a null backend means nothing answered, which is not the same thing. */
export interface EngineDeviceList {
  /** The backend that enumerated them ('vulkan' | 'cuda' | 'metal' | 'cpu'), or null when none answered. */
  backend: string | null;
  devices: string[];
}

/** The device an engine state is pinned to, by name — null when nothing was pinned. Read from the list the
 *  pin was resolved against rather than from what the pinned backend reports, which is filtered. */
export function pinnedEngineDevice(engine: LocalLlmState): string | null {
  if (engine.gpuDeviceIndex == null) return null;
  return engine.gpuDeviceOptions?.[engine.gpuDeviceIndex] ?? null;
}

declare global {
  interface Window {
    formamorphDesktop?: {
      fetch: (req: DesktopFetchRequest) => Promise<DesktopFetchResponse>;
      /** Live nvidia-smi VRAM numbers from the main process (same shape as the standalone helper's JSON). */
      vramStats?: () => Promise<unknown>;
      /** Local LLM engine: load a GGUF served on a localhost OpenAI endpoint and read its status. */
      llm?: {
        stop: () => Promise<LocalLlmState>;
        status: () => Promise<LocalLlmState>;
        /** Absolute path of the folder where local GGUF models live (and downloads land). */
        modelsDir: () => Promise<string>;
        /** Subscribe to status changes (auto-start, loading, ready, error); returns an unsubscribe fn. */
        onStatus: (cb: (state: LocalLlmState) => void) => () => void;
        /** Installed GGUF filenames in the models folder. */
        listModels: () => Promise<string[]>;
        /** Installed GGUFs with their sizes and provenance. */
        listInstalled: () => Promise<LocalInstalledModel[]>;
        /** Load an installed model by its ref. */
        load: (ref: string) => Promise<LocalLlmState>;
        /** The folders searched for models. */
        getLocations: () => Promise<LocalModelLocations>;
        /** Set any subset of the folder settings; returns the updated locations. */
        setLocations: (opts: Partial<{ downloadDir: string | null; externalDir: string | null; searchSubfolders: boolean }>) => Promise<LocalModelLocations>;
        /** Native folder picker; resolves null when canceled. */
        pickFolder: (title?: string) => Promise<string | null>;
        /** Free bytes on a folder's volume, or null when unreadable. */
        freeSpace: (dir?: string) => Promise<number | null>;
        /** Models and resumable partials a move would carry out of a folder. */
        countMovable: (dir: string) => Promise<{ count: number; bytes: number }>;
        /** Move models between folders; the loaded one is unloaded and reloaded around the move. */
        moveModels: (opts: { from: string; to: string }) => Promise<LocalMoveResult>;
        /** Stop a move after the current file. */
        cancelMove: () => Promise<boolean>;
        /** Subscribe to move progress; returns an unsubscribe fn. */
        onMoveProgress: (cb: (p: LocalMoveProgress) => void) => () => void;
        /** Set engine load options (context size / GPU layers / flash attention / GPU device); reloads if changed. */
        setOptions: (opts: { contextSize: number; gpuLayers: number; flashAttention: boolean; parallelRequests: number; gpuDevice: string }) => Promise<LocalLlmState>;
        /** Every GPU the engine can pin to, for the device picker. */
        listDevices: () => Promise<EngineDeviceList>;
        /** Download a GGUF from Hugging Face, loading it on finish unless autoLoad is false; resolves with
         *  the saved path. */
        download: (opts: { url: string; fileName: string; autoLoad?: boolean }) => Promise<{ path: string }>;
        /** Cancel (pause) the in-flight download; its partial is kept for a later resume. */
        cancelDownload: () => Promise<boolean>;
        /** Partial downloads waiting to be resumed. */
        listPartials: () => Promise<LocalPartial[]>;
        /** Discard a partial download. */
        discardPartial: (fileName: string) => Promise<boolean>;
        /** Delete an installed model by filename. */
        deleteModel: (fileName: string) => Promise<boolean>;
        /** Subscribe to download progress; returns an unsubscribe fn. */
        onDownloadProgress: (cb: (progress: LocalDownloadProgress) => void) => () => void;
      };
      /** Desktop auto-updater bridge (implemented in preload.cjs / electron/updater.cjs). Detection is done
       *  renderer-side via UpdateService; these drive the per-platform download + apply and stream progress. */
      update?: {
        /** Ask the main process to (re)check — used by the Linux electron-updater path. */
        check: () => Promise<void>;
        /** A previously downloaded update still staged on disk (survives a restart), or null. */
        pending: () => Promise<{ version: string } | null>;
        /** Start the platform download for the given target release (channel drives the Linux updater). */
        download: (opts: { version?: string; channel?: 'stable' | 'prerelease' }) => Promise<void>;
        /** Apply a downloaded update and relaunch (Windows launcher swap / Linux quitAndInstall). */
        apply: () => Promise<void>;
        /** An update became available (main-detected, e.g. electron-updater); returns an unsubscribe fn. */
        onAvailable: (cb: (info: { version: string }) => void) => () => void;
        /** Download progress; returns an unsubscribe fn. */
        onProgress: (cb: (p: { received: number; total: number }) => void) => () => void;
        /** Download finished and is staged/ready to apply; returns an unsubscribe fn. */
        onDownloaded: (cb: () => void) => () => void;
      };
    };
  }
}

/** True inside the Electron desktop build (the net-fetch bridge is available). */
export const isDesktop = (): boolean => typeof window !== 'undefined' && !!window.formamorphDesktop;

/** Default chat-completions URL of the bundled local LLM engine. Port must match DEFAULT_PORT in
 *  electron/llmEngine.cjs. Used as the desktop build's default endpoint so it targets the local model. */
export const DEFAULT_LOCAL_LLM_ENDPOINT = 'http://localhost:8977/v1/chat/completions';

/** Live VRAM numbers from the desktop main process (nvidia-smi). Throws if not running in the desktop app. */
export async function desktopVramStats(): Promise<unknown> {
  const bridge = typeof window !== 'undefined' ? window.formamorphDesktop : undefined;
  if (!bridge?.vramStats) throw new Error('VRAM stats are only available in the Formamorph desktop app.');
  return bridge.vramStats();
}

/** POST/GET through the Electron main process (no browser CORS). Throws if not running in the desktop app. */
export async function desktopFetch(req: DesktopFetchRequest): Promise<DesktopFetchResponse> {
  const bridge = typeof window !== 'undefined' ? window.formamorphDesktop : undefined;
  if (!bridge) throw new Error('This image provider is only available in the Formamorph desktop app.');
  return bridge.fetch(req);
}

/** True when the desktop build exposes the local-LLM engine bridge. */
export const isLocalLlmAvailable = (): boolean =>
  typeof window !== 'undefined' && !!window.formamorphDesktop?.llm;

const requireLlm = () => {
  const llm = typeof window !== 'undefined' ? window.formamorphDesktop?.llm : undefined;
  if (!llm) throw new Error('The local LLM engine is only available in the Formamorph desktop app.');
  return llm;
};

/** Stop the local LLM engine and free the model. */
export const stopLocalLlm = (): Promise<LocalLlmState> => requireLlm().stop();

/** Current local LLM engine status. */
export const localLlmStatus = (): Promise<LocalLlmState> => requireLlm().status();

/** Folder where local GGUF models live (and where downloads will land). */
export const localLlmModelsDir = (): Promise<string> => requireLlm().modelsDir();

/** Subscribe to engine status changes; returns an unsubscribe fn (a no-op off desktop). */
export function subscribeLocalLlm(cb: (state: LocalLlmState) => void): () => void {
  const llm = typeof window !== 'undefined' ? window.formamorphDesktop?.llm : undefined;
  return llm?.onStatus ? llm.onStatus(cb) : () => {};
}

/** Installed GGUF filenames in the models folder. */
export const listLocalModels = (): Promise<string[]> => requireLlm().listModels();

/** Installed GGUFs with their on-disk sizes (any source, not just our downloader). */
export const listLocalInstalled = (): Promise<LocalInstalledModel[]> => requireLlm().listInstalled();

/** Load an installed model by its ref; resolves with the engine state. */
export const loadLocalModel = (ref: string): Promise<LocalLlmState> => requireLlm().load(ref);

/** The folders searched for models (root plus the optional external library). */
export const localModelLocations = (): Promise<LocalModelLocations> => requireLlm().getLocations();

/** Set any subset of the model folder settings; resolves with the updated locations. */
export const setLocalModelLocations = (opts: Partial<{ downloadDir: string | null; externalDir: string | null; searchSubfolders: boolean }>): Promise<LocalModelLocations> =>
  requireLlm().setLocations(opts);

/** Open the native folder picker (null when canceled). */
export const pickLocalModelFolder = (title?: string): Promise<string | null> => requireLlm().pickFolder(title);

/** Free bytes on a folder's volume, or null when it can't be read. */
export const localModelFreeSpace = (dir?: string): Promise<number | null> => requireLlm().freeSpace(dir);

/** Models and resumable partials a move would carry out of `dir`. */
export const countMovableModels = (dir: string): Promise<{ count: number; bytes: number }> =>
  requireLlm().countMovable(dir);

/** Move downloaded models from one folder to another; resolves with what moved and what didn't. */
export const moveLocalModels = (opts: { from: string; to: string }): Promise<LocalMoveResult> =>
  requireLlm().moveModels(opts);

/** Stop an in-flight move after the current file. */
export const cancelLocalModelMove = (): Promise<boolean> => requireLlm().cancelMove();

/** Subscribe to move progress; returns an unsubscribe fn (a no-op off desktop). */
export function subscribeLocalMove(cb: (p: LocalMoveProgress) => void): () => void {
  const llm = typeof window !== 'undefined' ? window.formamorphDesktop?.llm : undefined;
  return llm?.onMoveProgress ? llm.onMoveProgress(cb) : () => {};
}

/** Set engine load options (context size / GPU layers / flash attention / GPU device); reloads if they changed. */
export const setLocalLlmOptions = (opts: { contextSize: number; gpuLayers: number; flashAttention: boolean; parallelRequests: number; gpuDevice: string }): Promise<LocalLlmState> =>
  requireLlm().setOptions(opts);

/** Every GPU the engine can pin to. Off desktop, and on a machine whose backend can't enumerate, an empty
 *  list — which the picker states rather than showing an empty dropdown. */
export const listLocalGpuDevices = (): Promise<EngineDeviceList> =>
  isLocalLlmAvailable() ? requireLlm().listDevices() : Promise.resolve({ backend: null, devices: [] });

/** Download a GGUF from Hugging Face, loading it on finish unless autoLoad is false; resolves with the
 *  saved path. */
export const downloadLocalModel = (opts: { url: string; fileName: string; autoLoad?: boolean }): Promise<{ path: string }> =>
  requireLlm().download(opts);

/** Cancel (pause) the in-flight model download; the partial is kept for a later resume. */
export const cancelLocalDownload = (): Promise<boolean> => requireLlm().cancelDownload();

/** Partial downloads waiting to be resumed (empty off desktop). */
export const listLocalPartials = (): Promise<LocalPartial[]> => requireLlm().listPartials();

/** Discard a partial download by its target filename. */
export const discardLocalPartial = (fileName: string): Promise<boolean> => requireLlm().discardPartial(fileName);

/** Delete an installed model by filename. */
export const deleteLocalModel = (fileName: string): Promise<boolean> => requireLlm().deleteModel(fileName);

/** Subscribe to download progress; returns an unsubscribe fn (a no-op off desktop). */
export function subscribeLocalDownload(cb: (progress: LocalDownloadProgress) => void): () => void {
  const llm = typeof window !== 'undefined' ? window.formamorphDesktop?.llm : undefined;
  return llm?.onDownloadProgress ? llm.onDownloadProgress(cb) : () => {};
}

/** Full chat-completions URL for the running local model (the app uses the endpoint verbatim, like the
 *  default `…/v1/chat/completions`), or null when not ready. */
export function localLlmEndpoint(state: LocalLlmState): string | null {
  return state.status === 'ready' && state.port ? `http://localhost:${state.port}/v1/chat/completions` : null;
}
