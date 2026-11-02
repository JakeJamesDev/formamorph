import type { InferenceSession, Tensor } from "onnxruntime-common";
import vocab from "./g2p/vocab.json";

const FIRST_TOKEN = 4;
const MAX_LEN = 48;
const MAX_INPUT = MAX_LEN - 2;

const graphemeIds = new Map(vocab.graphemes.map((grapheme, i) => [grapheme, i + FIRST_TOKEN]));

/** The ONNX runtime calls the model needs; `onnxruntime-web` and `onnxruntime-node` both fit. */
export interface OrtRuntime {
  InferenceSession: { create(bytes: Uint8Array, options?: InferenceSession.SessionOptions): Promise<InferenceSession> };
  Tensor: new (type: "int64", data: BigInt64Array, dims: number[]) => Tensor;
}

export interface G2pModel {
  predict(word: string): Promise<string>;
  release(): Promise<void>;
}

export async function loadG2pModel(
  ort: OrtRuntime,
  encoderBytes: Uint8Array,
  decoderBytes: Uint8Array,
  options?: InferenceSession.SessionOptions,
): Promise<G2pModel> {
  const [encoder, decoder] = await Promise.all([
    ort.InferenceSession.create(encoderBytes, options),
    ort.InferenceSession.create(decoderBytes, options),
  ]);
  const int64Row = (ids: number[]) => new ort.Tensor("int64", BigInt64Array.from(ids, BigInt), [1, ids.length]);

  const decode = async (word: string): Promise<string> => {
    const ids = [vocab.bos, ...[...word.slice(0, MAX_INPUT)].map((c) => graphemeIds.get(c) ?? vocab.unk), vocab.eos];
    const mask = int64Row(ids.map(() => 1));
    const { last_hidden_state: hidden } = await encoder.run({ input_ids: int64Row(ids), attention_mask: mask });
    // The graphs have no cache, so each step reruns the whole prefix and reads the last row.
    const decoded = [vocab.bos];
    let phonemes = "";
    while (decoded.length < MAX_LEN) {
      const { logits } = await decoder.run({ decoder_input_ids: int64Row(decoded), encoder_hidden_states: hidden, encoder_attention_mask: mask });
      const size = logits.dims[2];
      const last = (logits.data as Float32Array).subarray(size * (decoded.length - 1), size * decoded.length);
      const next = last.reduce((best, score, i) => (score > last[best] ? i : best), 0);
      if (next === vocab.eos) break;
      decoded.push(next);
      if (next >= FIRST_TOKEN) phonemes += vocab.phonemes[next - FIRST_TOKEN] ?? "";
    }
    return phonemes;
  };

  // An ONNX session takes one call at a time, and two clips can ask at once.
  let queue: Promise<unknown> = Promise.resolve();
  return {
    predict(word) {
      const result = queue.then(() => decode(word));
      queue = result.catch(() => undefined);
      return result;
    },
    async release() {
      await Promise.all([encoder.release(), decoder.release()]);
    },
  };
}
