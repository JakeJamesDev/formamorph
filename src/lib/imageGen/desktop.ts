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

/** An installed GGUF in the models folder (any source, not just our downloader). */
export interface LocalInstalledModel {
  fileName: string;
  /** On-disk size in bytes. */
  size: number;
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
  /** Options the loaded model was loaded with (null when no model is loaded) — lets the UI tell whether
   *  pending settings differ from what's actually applied. */
  contextSize: number | null;
  gpuLayers: number | null;
  flashAttention: boolean | null;
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
        /** Installed GGUFs with their on-disk sizes. */
        listInstalled: () => Promise<LocalInstalledModel[]>;
        /** Load an installed model by filename. */
        load: (fileName: string) => Promise<LocalLlmState>;
        /** Set engine load options (context size / GPU layers / flash attention); reloads if changed. */
        setOptions: (opts: { contextSize: number; gpuLayers: number; flashAttention: boolean }) => Promise<LocalLlmState>;
        /** Download a GGUF from Hugging Face, then load it; resolves with the saved path. */
        download: (opts: { url: string; fileName: string }) => Promise<{ path: string }>;
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

/** Load an installed model by filename; resolves with the engine state. */
export const loadLocalModel = (fileName: string): Promise<LocalLlmState> => requireLlm().load(fileName);

/** Set engine load options (context size / GPU layers / flash attention); reloads if they changed. */
export const setLocalLlmOptions = (opts: { contextSize: number; gpuLayers: number; flashAttention: boolean }): Promise<LocalLlmState> =>
  requireLlm().setOptions(opts);

/** Download a GGUF from Hugging Face and load it; resolves with the saved path. */
export const downloadLocalModel = (opts: { url: string; fileName: string }): Promise<{ path: string }> =>
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
