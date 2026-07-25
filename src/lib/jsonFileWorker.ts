/**
 * Web Worker for the JSON file boundary: serializing an export payload to a Blob and parsing an imported
 * file's text. Both are single long synchronous calls over payloads that carry embedded base64 images
 * (worlds, backups, saves), so running them here keeps the UI responsive. See `createWorkerClient` for the
 * request/response model.
 */

self.addEventListener('message', (event) => {
  const { op, value, text, mime, space, id } = event.data;
  try {
    // A Blob is structured-cloneable, so the serialized bytes come back without ever becoming a JS string
    // on the main thread.
    const result = op === 'parse'
      ? JSON.parse(text)
      : new Blob([JSON.stringify(value, null, space)], { type: mime || 'application/json' });
    self.postMessage({ type: 'success', id, result });
  } catch (error) {
    self.postMessage({
      type: 'error',
      id,
      error: { message: (error as Error).message, stack: (error as Error).stack },
    });
  }
});
