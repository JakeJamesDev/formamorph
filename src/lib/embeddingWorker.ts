/**
 * Web Worker hosting the semantic-memory embedding model (transformers.js, WASM backend). Keeps model
 * download + inference off the main thread. Protocol matches the other workers'
 * `{ type: 'success' | 'error', id, ... }` shape, plus `{ type: 'progress', id, ... }` events streamed
 * during model download so the Settings toggle can show a real progress bar.
 */
import { pipeline, env, type FeatureExtractionPipeline, type ProgressInfo } from '@huggingface/transformers';
import { EMBEDDING_MODEL_ID } from './memoryRelevance';

// The page sends no COOP/COEP headers, so it is not cross-origin-isolated and multithreaded WASM
// (SharedArrayBuffer) is unavailable — pin to one thread rather than let the runtime probe and warn.
if (env.backends.onnx.wasm) env.backends.onnx.wasm.numThreads = 1;

let extractor: FeatureExtractionPipeline | null = null;
let loading: Promise<FeatureExtractionPipeline> | null = null;

interface WorkerRequest {
  cmd: 'load' | 'embed' | 'dispose';
  id: string;
  texts?: string[];
}

const loadExtractor = (id: string): Promise<FeatureExtractionPipeline> => {
  if (!loading) {
    loading = pipeline('feature-extraction', EMBEDDING_MODEL_ID, {
      dtype: 'q8',
      device: 'wasm',
      progress_callback: (info: ProgressInfo) => {
        // Per-file byte progress; the client aggregates. Other statuses (initiate/done/ready) carry no bytes.
        if (info.status === 'progress') {
          self.postMessage({ type: 'progress', id, file: info.file, loaded: info.loaded, total: info.total });
        }
      },
    }).catch((err) => {
      loading = null; // let a later load retry (e.g. offline first attempt)
      throw err;
    });
  }
  return loading;
};

self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const { cmd, id, texts } = event.data;
  const fail = (error: unknown) =>
    self.postMessage({ type: 'error', id, error: { message: (error as Error).message, stack: (error as Error).stack } });

  void (async () => {
    try {
      if (cmd === 'load') {
        extractor = await loadExtractor(id);
        self.postMessage({ type: 'success', id, result: true });
      } else if (cmd === 'embed') {
        if (!extractor) extractor = await loadExtractor(id);
        const input = texts ?? [];
        if (input.length === 0) {
          self.postMessage({ type: 'success', id, result: [] });
          return;
        }
        const output = await extractor(input, { pooling: 'mean', normalize: true });
        const [rows, dims] = output.dims as [number, number];
        const data = output.data as Float32Array;
        const buffers: ArrayBuffer[] = [];
        for (let r = 0; r < rows; r++) {
          buffers.push(data.slice(r * dims, (r + 1) * dims).buffer as ArrayBuffer);
        }
        output.dispose();
        self.postMessage({ type: 'success', id, result: buffers }, { transfer: buffers });
      } else if (cmd === 'dispose') {
        if (extractor) await extractor.dispose();
        extractor = null;
        loading = null;
        self.postMessage({ type: 'success', id, result: true });
      }
    } catch (error) {
      fail(error);
    }
  })();
});
