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
}

declare global {
  interface Window {
    formamorphDesktop?: {
      fetch: (req: DesktopFetchRequest) => Promise<DesktopFetchResponse>;
      /** Live nvidia-smi VRAM numbers from the main process (same shape as the standalone helper's JSON). */
      vramStats?: () => Promise<unknown>;
      /** Local LLM engine: load a GGUF served on a localhost OpenAI endpoint and read its status. */
      llm?: {
        start: (opts: { modelPath: string; port?: number }) => Promise<LocalLlmState>;
        stop: () => Promise<LocalLlmState>;
        status: () => Promise<LocalLlmState>;
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

/** Load a GGUF and start the local OpenAI server; resolves with the engine state (status 'ready' on success). */
export const startLocalLlm = (opts: { modelPath: string; port?: number }): Promise<LocalLlmState> =>
  requireLlm().start(opts);

/** Stop the local LLM engine and free the model. */
export const stopLocalLlm = (): Promise<LocalLlmState> => requireLlm().stop();

/** Current local LLM engine status. */
export const localLlmStatus = (): Promise<LocalLlmState> => requireLlm().status();

/** Full chat-completions URL for the running local model (the app uses the endpoint verbatim, like the
 *  default `…/v1/chat/completions`), or null when not ready. */
export function localLlmEndpoint(state: LocalLlmState): string | null {
  return state.status === 'ready' && state.port ? `http://localhost:${state.port}/v1/chat/completions` : null;
}
