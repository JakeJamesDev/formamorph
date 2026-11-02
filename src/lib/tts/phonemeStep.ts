import { env } from "@huggingface/transformers";
// The runtime instance transformers imports, undeclared in package.json so the two cannot drift apart.
import * as ort from "onnxruntime-web";
import ortMjsUrl from "onnxruntime-web-dist/ort-wasm-simd-threaded.jsep.mjs?url";
import ortWasmUrl from "onnxruntime-web-dist/ort-wasm-simd-threaded.jsep.wasm?url";
import dictionaryUrl from "./g2p/cmudict.dict?url";
import decoderUrl from "./g2p/decoder.fp16.onnx?url";
import encoderUrl from "./g2p/encoder.fp16.onnx?url";
import { loadG2pModel, type G2pModel, type OrtRuntime } from "./g2pModel";
import { createTextToPhonemes, parseDictionary, type Accent } from "./textToPhonemes";

export type { Accent };

if (env.backends.onnx.wasm) {
  // The bundled runtime files, as absolute URLs because the runtime's XHR rejects root-relative ones.
  env.backends.onnx.wasm.wasmPaths = {
    mjs: new URL(ortMjsUrl, import.meta.url).href,
    wasm: new URL(ortWasmUrl, import.meta.url).href,
  };
}

async function fetchAsset(url: string): Promise<Response> {
  const response = await fetch(new URL(url, import.meta.url).href);
  if (!response.ok) throw new Error(`Phoneme data failed to load (${response.status}).`);
  return response;
}

async function loadModel(): Promise<G2pModel> {
  const [encoder, decoder] = await Promise.all([
    fetchAsset(encoderUrl).then((r) => r.arrayBuffer()),
    fetchAsset(decoderUrl).then((r) => r.arrayBuffer()),
  ]);
  // The runtime's overloads do not fit OrtRuntime's single signatures.
  return loadG2pModel(ort as unknown as OrtRuntime, new Uint8Array(encoder), new Uint8Array(decoder), { executionProviders: ["wasm"] });
}

let model: Promise<G2pModel> | null = null;
let pipeline: Promise<(text: string, accent: Accent) => Promise<string>> | null = null;

function loadPipeline(): Promise<(text: string, accent: Accent) => Promise<string>> {
  pipeline ??= fetchAsset(dictionaryUrl)
    .then((r) => r.text())
    .then((text) => createTextToPhonemes({
      dictionary: parseDictionary(text),
      predict: async (word) => {
        model ??= loadModel().catch((error: unknown) => {
          model = null;
          throw error;
        });
        return (await model).predict(word);
      },
    }))
    .catch((error: unknown) => {
      pipeline = null;
      throw error;
    });
  return pipeline;
}

/** Drops the phoneme data and model; the next use loads them again. */
export async function releasePhonemeStep(): Promise<void> {
  const loaded = model;
  model = null;
  pipeline = null;
  if (loaded) await (await loaded).release();
}

/** Turns text into Kokoro phonemes in a voice's accent. */
export async function phonemize(text: string, accent: Accent = "a"): Promise<string> {
  return (await loadPipeline())(text, accent);
}
