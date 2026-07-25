/**
 * Web Worker that runs the image-encode core off the main thread, so optimizing a world's images (large lossless
 * WebP encodes especially) doesn't freeze the UI. See `createWorkerClient` for the request/response model.
 */
import { encodeImageDataUrl, measureImageDataUrl } from './imageEncode';

self.addEventListener('message', async (event) => {
  const { op, url, maxDim, webpSupported, lossless, allowGrow, id } = event.data;
  try {
    // 'measure' decodes dimensions/bytes only; anything else is an encode. Both keep the multi-MB
    // base64 decode + image decode off the main thread.
    const result = op === 'measure'
      ? await measureImageDataUrl(url)
      : await encodeImageDataUrl(url, maxDim, webpSupported, lossless, allowGrow);
    self.postMessage({ type: 'success', id, result });
  } catch (error) {
    self.postMessage({ type: 'error', id, error: { message: (error as Error).message, stack: (error as Error).stack } });
  }
});
