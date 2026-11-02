// Adapted from kokoro-js (https://github.com/hexgrad/kokoro, Apache-2.0, copyright hexgrad and contributors):
// src/kokoro.js and src/voices.js. Holds the calls Text to Speech uses: load, generate, and dispose.
import { StyleTextToSpeech2Model, AutoTokenizer, Tensor, RawAudio } from "@huggingface/transformers";
import { phonemize, releasePhonemeStep, type Accent } from "./phonemeStep";

const STYLE_DIM = 256;
const SAMPLE_RATE = 24000;
const MAX_STYLE_TOKENS = 509;
const VOICE_BASE_URL = "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/voices";
const VOICE_CACHE_NAME = "kokoro-voices";

/** Voice ids in picker order; the first letter is the accent (`a` American, `b` British). */
export const KOKORO_VOICES = [
  "af_heart", "af_alloy", "af_aoede", "af_bella", "af_jessica",
  "af_kore", "af_nicole", "af_nova", "af_river", "af_sarah",
  "af_sky", "am_adam", "am_echo", "am_eric", "am_fenrir",
  "am_liam", "am_michael", "am_onyx", "am_puck", "am_santa",
  "bf_emma", "bf_isabella", "bm_george", "bm_lewis", "bf_alice",
  "bf_lily", "bm_daniel", "bm_fable",
] as const;

export interface GenerateOptions {
  voice?: string;
  speed?: number;
}

export interface KokoroLoadOptions {
  dtype?: "fp32" | "fp16" | "q8" | "q4" | "q4f16";
  device?: "wasm" | "webgpu" | "cpu";
}

/** The model call the client needs; `StyleTextToSpeech2Model` satisfies it. */
export interface KokoroModel {
  (inputs: Record<string, Tensor>): Promise<{ waveform: { data: Float32Array } }>;
  dispose(): Promise<unknown>;
}

export type Tokenizer = (text: string, options: { truncation: boolean }) => { input_ids: Tensor };

export interface KokoroClientDeps {
  phonemize?: (text: string, accent: Accent) => Promise<string>;
  loadVoice?: (voice: string) => Promise<Float32Array>;
}

const voiceCache = new Map<string, Float32Array>();

async function fetchVoiceBuffer(id: string): Promise<ArrayBuffer> {
  const url = `${VOICE_BASE_URL}/${id}.bin`;
  let cache: Cache | undefined;
  try {
    cache = await caches.open(VOICE_CACHE_NAME);
    const hit = await cache.match(url);
    if (hit) return await hit.arrayBuffer();
  } catch (error) {
    console.warn("Unable to open cache", error);
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Voice "${id}" failed to load (${response.status}).`);
  const buffer = await response.arrayBuffer();
  if (cache) {
    try {
      await cache.put(url, new Response(buffer, { headers: response.headers }));
    } catch (error) {
      console.warn("Unable to cache file", error);
    }
  }
  return buffer;
}

async function loadVoiceData(voice: string): Promise<Float32Array> {
  const hit = voiceCache.get(voice);
  if (hit) return hit;
  const data = new Float32Array(await fetchVoiceBuffer(voice));
  voiceCache.set(voice, data);
  return data;
}

function accentOf(voice: string): Accent {
  if (!(KOKORO_VOICES as readonly string[]).includes(voice)) {
    throw new Error(`Voice "${voice}" not found. Should be one of: ${KOKORO_VOICES.join(", ")}.`);
  }
  return voice.startsWith("b") ? "b" : "a";
}

export class KokoroClient {
  constructor(
    readonly model: KokoroModel,
    readonly tokenizer: Tokenizer,
    private readonly deps: KokoroClientDeps = {},
  ) {}

  /** Keeps the kokoro-js name for the load call. */
  static async from_pretrained(
    modelId: string,
    { dtype = "fp32", device }:KokoroLoadOptions = {},
  ): Promise<KokoroClient> {
    const [model, tokenizer] = await Promise.all([
      StyleTextToSpeech2Model.from_pretrained(modelId, { dtype, device }),
      AutoTokenizer.from_pretrained(modelId),
    ]);
    return new KokoroClient(model as unknown as KokoroModel, tokenizer as unknown as Tokenizer);
  }

  async dispose(): Promise<void> {
    await Promise.all([this.model.dispose(), releasePhonemeStep()]);
  }

  async generate(text: string, { voice = "af_heart", speed = 1 }: GenerateOptions = {}): Promise<RawAudio> {
    const accent = accentOf(voice);
    const phonemes = await (this.deps.phonemize ?? phonemize)(text, accent);
    const { input_ids } = this.tokenizer(phonemes, { truncation: true });
    return this.generateFromIds(input_ids, { voice, speed });
  }

  private async generateFromIds(input_ids: Tensor, { voice = "af_heart", speed = 1 }: GenerateOptions = {}): Promise<RawAudio> {
    // The style row is picked by token count, minus the two boundary tokens.
    const tokenCount = Math.min(Math.max(input_ids.dims.at(-1)! - 2, 0), MAX_STYLE_TOKENS);
    const data = await (this.deps.loadVoice ?? loadVoiceData)(voice);
    const offset = tokenCount * STYLE_DIM;
    const style = new Tensor("float32", data.slice(offset, offset + STYLE_DIM), [1, STYLE_DIM]);
    const { waveform } = await this.model({
      input_ids,
      style,
      speed: new Tensor("float32", [speed], [1]),
    });
    return new RawAudio(waveform.data, SAMPLE_RATE);
  }
}
