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

declare global {
  interface Window {
    formamorphDesktop?: {
      fetch: (req: DesktopFetchRequest) => Promise<DesktopFetchResponse>;
      /** Live nvidia-smi VRAM numbers from the main process (same shape as the standalone helper's JSON). */
      vramStats?: () => Promise<unknown>;
    };
  }
}

/** True inside the Electron desktop build (the net-fetch bridge is available). */
export const isDesktop = (): boolean => typeof window !== 'undefined' && !!window.formamorphDesktop;

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
