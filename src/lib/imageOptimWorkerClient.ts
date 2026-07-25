/**
 * Main-thread client for the image-encode worker. Detects WebP support here (the worker can't run the
 * `canvas.toDataURL` probe) and passes it in. Falls back to encoding on the main thread when Workers or
 * OffscreenCanvas are unavailable (jsdom, older browsers) or the worker fails to load.
 */
import { createWorkerClient } from './createWorkerClient';

let webpSupport: boolean | null = null;
/** True when the browser can emit WebP from a canvas — cached after the first probe. */
export function supportsWebp(): boolean {
  if (webpSupport === null) {
    try {
      const c = document.createElement('canvas');
      c.width = c.height = 1;
      webpSupport = c.toDataURL('image/webp').startsWith('data:image/webp');
    } catch {
      webpSupport = false;
    }
  }
  return webpSupport;
}

// OffscreenCanvas is what the worker (and the main-thread fallback) encode onto; without it there's no point
// spinning up a worker — encodeImageDataUrl would just return the original.
const workerUsable = typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined';

// `type: 'module'` is required for DEV: Vite serves the worker's TS with bare `import` statements, which a
// classic worker rejects ("Cannot use import statement outside a module") — the error is swallowed by the
// fallback, so the encode silently runs on the main thread and the lag returns. Prod is format-agnostic
// (the bundled iife executes fine as a module).
const client = createWorkerClient(
  () => new Worker(new URL('./imageOptimWorker.ts', import.meta.url), { type: 'module' }),
);

/**
 * Encode an image data-URL off the main thread. Mirrors `encodeImageDataUrl`'s contract (never grows unless
 * `allowGrow`, never throws — returns the original on failure), so callers can't tell worker from fallback.
 */
export async function encodeInWorker(
  url: string, maxDim: number, lossless = false, allowGrow = false,
): Promise<string> {
  const webpSupported = supportsWebp();
  if (workerUsable) {
    try {
      return (await client.run({ url, maxDim, webpSupported, lossless, allowGrow })) as string;
    } catch {
      // Worker failed to load or crashed — fall through to a main-thread encode so the op still completes.
    }
  }
  // Lazy-import keeps imageEncode (and its wasm-webp dependency) out of the main bundle — only pulled in when
  // the worker path is unavailable and we actually have to encode here.
  const { encodeImageDataUrl } = await import('./imageEncode');
  return encodeImageDataUrl(url, maxDim, webpSupported, lossless, allowGrow);
}

/**
 * Measure an image data-URL (dimensions + bytes) off the main thread — decoding a multi-MB base64 string on
 * the main thread is a visible hitch, so scans go through the worker too. Throws on unreadable input, matching
 * the direct `measureImageDataUrl` contract (callers treat unreadable as within-budget).
 */
export async function measureInWorker(url: string): Promise<{ w: number; h: number; bytes: number }> {
  if (workerUsable) {
    try {
      return (await client.run({ op: 'measure', url })) as { w: number; h: number; bytes: number };
    } catch {
      // Worker failed to load or crashed — fall through to a main-thread measure.
    }
  }
  const { measureImageDataUrl } = await import('./imageEncode');
  return measureImageDataUrl(url);
}

/** Terminate the encode worker (teardown / tests). */
export const terminateImageOptimWorker = () => client.terminate();
