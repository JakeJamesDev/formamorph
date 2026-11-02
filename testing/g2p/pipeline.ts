// The pipeline with Node's ONNX runtime, for scoring: npx vite-node testing/g2p/scoreCli.mjs --module testing/g2p/pipeline.ts
import { readFileSync } from "node:fs";
import * as ort from "onnxruntime-node";
import { loadG2pModel, type OrtRuntime } from "@/lib/tts/g2pModel";
import { createTextToPhonemes, parseDictionary } from "@/lib/tts/textToPhonemes";

const asset = (name: string) => new URL(`../../src/lib/tts/g2p/${name}`, import.meta.url);

// The runtime's overloads do not fit OrtRuntime's single signatures.
const model = await loadG2pModel(ort as unknown as OrtRuntime, readFileSync(asset("encoder.fp16.onnx")), readFileSync(asset("decoder.fp16.onnx")));
const say = createTextToPhonemes({ dictionary: parseDictionary(readFileSync(asset("cmudict.dict"), "utf8")), predict: model.predict });

export default async function pipeline(word: string, accent: string): Promise<string> {
  if (accent !== "a" && accent !== "b") throw new Error(`The pipeline has no accent "${accent}".`);
  return say(word, accent);
}
