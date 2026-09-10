/**
 * Web Worker for the JSON file boundary: serializing an export payload to a Blob, parsing an imported
 * file's text, and measuring a world's publish size. Each is a single long synchronous call over payloads
 * that carry embedded base64 images (worlds, backups, saves), so running them here keeps the UI responsive.
 * See `createWorkerClient` for the request/response model.
 */
import { runJsonFileOp } from './jsonFileOps';

self.addEventListener('message', (event) => {
  const { id, ...request } = event.data;
  try {
    self.postMessage({ type: 'success', id, result: runJsonFileOp(request) });
  } catch (error) {
    self.postMessage({
      type: 'error',
      id,
      error: { message: (error as Error).message, stack: (error as Error).stack },
    });
  }
});
