/**
 * Web Worker hosting the Coref Host on onnxruntime-web (WebGPU or WASM). Protocol matches the other workers'
 * `{ type: 'success' | 'error', id, ... }` shape.
 */
import * as ort from 'onnxruntime-web';
import ortMjsUrl from 'onnxruntime-web-dist/ort-wasm-simd-threaded.jsep.mjs?url';
import ortWasmUrl from 'onnxruntime-web-dist/ort-wasm-simd-threaded.jsep.wasm?url';
import type { TokenizerJson } from './bpe';
import { createCorefHost, type CorefHost, type CorefHostConfig, type GraphRun, type HostTensor } from './corefHost';

export type CorefDevice = 'webgpu' | 'wasm';

export type CorefWorkerRequest =
  | {
    cmd: 'load';
    id: string;
    config: CorefHostConfig;
    tokenizer: TokenizerJson;
    graphA: ArrayBuffer;
    graphB: ArrayBuffer;
    device: CorefDevice;
  }
  | { cmd: 'resolve'; id: string; text: string }
  | { cmd: 'dispose'; id: string };

// The bundled runtime files, as absolute URLs because the runtime's XHR rejects root-relative ones.
ort.env.wasm.wasmPaths = {
  mjs: new URL(ortMjsUrl, import.meta.url).href,
  wasm: new URL(ortWasmUrl, import.meta.url).href,
};
// Threads need SharedArrayBuffer, which only a cross-origin-isolated page has.
ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;

// Graph outputs the host only hands from graph A to graph B; on WebGPU they stay on the GPU.
const PASSTHROUGH: Record<CorefHostConfig['architecture'], string[]> = {
  lingmess: ['sequence_output'],
  fcoref: ['start_reps', 'end_reps'],
};

let host: CorefHost | null = null;
let sessions: ort.InferenceSession[] = [];
// Each output's runtime tensor, so graph B gets graph A's GPU-resident outputs back without a copy.
const originals = new WeakMap<HostTensor, ort.Tensor>();

function graphRun(session: ort.InferenceSession): GraphRun {
  return async (feeds) => {
    const input: Record<string, ort.Tensor> = {};
    for (const [name, t] of Object.entries(feeds)) {
      input[name] = originals.get(t) ?? new ort.Tensor(t.type, t.data, t.dims);
    }
    const output = await session.run(input);
    const result: Record<string, HostTensor> = {};
    for (const [name, t] of Object.entries(output)) {
      const onCpu = t.location === 'cpu';
      const wrapped: HostTensor = {
        type: t.type as HostTensor['type'],
        data: onCpu ? (t.data as HostTensor['data']) : new Float32Array(0),
        dims: t.dims,
      };
      originals.set(wrapped, t);
      result[name] = wrapped;
    }
    // A GPU-resident input that graph B consumed has no further use.
    for (const t of Object.values(input)) if (t.location === 'gpu-buffer') t.dispose();
    return result;
  };
}

async function load(req: Extract<CorefWorkerRequest, { cmd: 'load' }>): Promise<void> {
  await dispose();
  const options = (outputs: string[]): ort.InferenceSession.SessionOptions => ({
    executionProviders: [req.device],
    graphOptimizationLevel: 'all',
    ...(req.device === 'webgpu' && outputs.length
      ? { preferredOutputLocation: Object.fromEntries(outputs.map((o) => [o, 'gpu-buffer' as const])) }
      : {}),
  });
  const graphA = await ort.InferenceSession.create(new Uint8Array(req.graphA), options(PASSTHROUGH[req.config.architecture]));
  const graphB = await ort.InferenceSession.create(new Uint8Array(req.graphB), options([]));
  sessions = [graphA, graphB];
  host = createCorefHost(req.config, req.tokenizer, { a: graphRun(graphA), b: graphRun(graphB) });
}

async function dispose(): Promise<void> {
  host = null;
  const old = sessions;
  sessions = [];
  await Promise.all(old.map((s) => s.release()));
}

self.addEventListener('message', (event: MessageEvent<CorefWorkerRequest>) => {
  const req = event.data;
  const { id } = req;
  void (async () => {
    try {
      let result: unknown = true;
      if (req.cmd === 'load') await load(req);
      else if (req.cmd === 'dispose') await dispose();
      else {
        if (!host) throw new Error('No coref model is loaded');
        result = await host.resolve(req.text);
      }
      self.postMessage({ type: 'success', id, result });
    } catch (error) {
      const { message, name } = error instanceof Error ? error : new Error(String(error));
      self.postMessage({ type: 'error', id, error: { message, name } });
    }
  })();
});
