/**
 * Singleton client for the semantic-memory embedding worker. Same request/response contract as
 * createWorkerClient (ids, failAll on worker error) extended with download-progress events, which
 * the shared factory has no channel for — progress messages invoke the request's callback without
 * settling its promise.
 */
import { randomUUID } from '@/lib/uuid';

/** Aggregate model-download progress across files; `total` grows as files announce sizes. */
export interface EmbeddingLoadProgress {
  loaded: number;
  total: number;
}

type ProgressCallback = (progress: EmbeddingLoadProgress) => void;

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  onProgress?: ProgressCallback;
  /** Per-file byte counts so multi-file downloads sum instead of flickering between files. */
  files?: Map<string, { loaded: number; total: number }>;
}

interface WorkerReply {
  type: 'success' | 'error' | 'progress';
  id: string;
  result?: unknown;
  error?: { message: string };
  file?: string;
  loaded?: number;
  total?: number;
}

const pendingRequests = new Map<string, PendingRequest>();
let workerInstance: Worker | null = null;
let modelReady = false;

const getWorker = (): Worker => {
  if (!workerInstance) {
    workerInstance = new Worker(new URL('./embeddingWorker.ts', import.meta.url), { type: 'module' });
    workerInstance.addEventListener('message', (event: MessageEvent<WorkerReply>) => {
      const { type, id, result, error, file, loaded, total } = event.data;
      const pending = pendingRequests.get(id);
      if (!pending) return;
      if (type === 'progress') {
        if (pending.onProgress && file !== undefined) {
          const files = (pending.files ??= new Map());
          files.set(file, { loaded: loaded ?? 0, total: total ?? 0 });
          let sumLoaded = 0, sumTotal = 0;
          files.forEach((f) => { sumLoaded += f.loaded; sumTotal += f.total; });
          pending.onProgress({ loaded: sumLoaded, total: sumTotal });
        }
        return; // progress never settles the promise
      }
      if (type === 'success') pending.resolve(result);
      else pending.reject(new Error(error?.message || 'Embedding worker error'));
      pendingRequests.delete(id);
    });
    const failAll = (reason: string, discard = false) => {
      pendingRequests.forEach((req) => req.reject(new Error(reason)));
      pendingRequests.clear();
      if (discard) {
        workerInstance?.terminate();
        workerInstance = null;
        modelReady = false;
      }
    };
    workerInstance.addEventListener('error', (event) => failAll(event.message || 'Embedding worker failed to load', true));
    workerInstance.addEventListener('messageerror', () => failAll('Embedding worker message could not be deserialized'));
  }
  return workerInstance;
};

const run = (payload: Record<string, unknown>, onProgress?: ProgressCallback): Promise<unknown> =>
  new Promise((resolve, reject) => {
    try {
      const worker = getWorker();
      const id = randomUUID();
      pendingRequests.set(id, { resolve, reject, onProgress });
      worker.postMessage({ ...payload, id });
    } catch (error) {
      reject(error as Error);
    }
  });

/** Download (or re-open from the browser cache) the embedding model. Resolves when inference-ready. */
export async function loadEmbeddingModel(onProgress?: ProgressCallback): Promise<void> {
  await run({ cmd: 'load' }, onProgress);
  modelReady = true;
}

/** True once loadEmbeddingModel has resolved this session — the cheap guard callers check before
 *  routing scoring work here. Never triggers a download itself. */
export function isEmbeddingModelReady(): boolean {
  return modelReady && workerInstance !== null;
}

/** Embed texts into L2-normalized vectors, one per input, in input order. */
export async function embedTexts(texts: string[]): Promise<Float32Array[]> {
  if (texts.length === 0) return [];
  const buffers = (await run({ cmd: 'embed', texts })) as ArrayBuffer[];
  return buffers.map((b) => new Float32Array(b));
}

/** Free the model (WASM memory + sessions) and kill the worker; in-flight requests reject. */
export async function disposeEmbeddingModel(): Promise<void> {
  modelReady = false;
  if (!workerInstance) return;
  await run({ cmd: 'dispose' }).catch(() => {}); // dying anyway; terminate below is the real cleanup
  workerInstance.terminate();
  workerInstance = null;
  pendingRequests.forEach((req) => req.reject(new Error('Embedding worker terminated before response')));
  pendingRequests.clear();
}
