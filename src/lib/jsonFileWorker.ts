/**
 * Web Worker for the JSON file boundary: serializing an export payload to a Blob, parsing an imported
 * file's text, measuring a world's publish size, and indexing and restoring a backup. Each is a long call over
 * payloads that carry embedded base64 images (worlds, backups, saves), so running them here keeps the UI responsive.
 * See `createWorkerClient` for the request/response model.
 */
import { runJsonFileOp } from './jsonFileOps';

self.addEventListener('message', async (event) => {
  const { id, ...request } = event.data;
  try {
    const onProgress = (progress: unknown) => self.postMessage({ type: 'progress', id, progress });
    self.postMessage({ type: 'success', id, result: await runJsonFileOp(request, onProgress) });
  } catch (error) {
    self.postMessage({
      type: 'error',
      id,
      error: { message: (error as Error).message, stack: (error as Error).stack },
    });
  }
});
