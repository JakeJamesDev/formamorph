/**
 * Web Worker for the Bench's background pass. It holds a mirror of the edited world, fed by patches of the
 * records each edit replaced, so neither the pass nor the world's transfer blocks the editor.
 */
import { createBenchReplier } from './benchPass';
import { createWorldMirror } from './worldMirror';

const mirror = createWorldMirror();
const reply = createBenchReplier();

self.addEventListener('message', (event) => {
  const { id, patch } = event.data;
  try {
    self.postMessage({ type: 'success', id, result: reply(mirror.apply(patch)) });
  } catch (error: unknown) {
    const { message, stack } = error instanceof Error ? error : new Error(String(error));
    self.postMessage({ type: 'error', id, error: { message, stack } });
  }
});
