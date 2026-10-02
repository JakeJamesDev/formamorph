// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

const CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/';
const wasm: { numThreads?: number; wasmPaths?: unknown } = { wasmPaths: CDN };

vi.mock('@huggingface/transformers', () => ({ pipeline: vi.fn(), env: { backends: { onnx: { wasm } } } }));

describe('embeddingWorker runtime paths', () => {
  it('points the ONNX runtime at the bundled files, as absolute URLs', async () => {
    await import('./embeddingWorker');
    const paths = wasm.wasmPaths as { mjs: string; wasm: string };
    for (const [file, url] of [['mjs', paths.mjs], ['wasm', paths.wasm]] as const) {
      expect(url).toBe(new URL(url).href);
      expect(new URL(url).hostname).not.toBe('cdn.jsdelivr.net');
      expect(url).toMatch(new RegExp(`onnxruntime-web/dist/ort-wasm-simd-threaded\\.jsep\\.${file}$`));
    }
  });
});
