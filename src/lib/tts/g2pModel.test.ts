// @vitest-environment node
import { readFileSync } from "node:fs";
import * as ort from "onnxruntime-node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadG2pModel, type G2pModel, type OrtRuntime } from "./g2pModel";
import vocab from "./g2p/vocab.json";

const file = (name: string) => readFileSync(new URL(`./g2p/${name}`, import.meta.url));
const allowed = new Set(vocab.phonemes);

describe("the shipped model", () => {
  let model: G2pModel;
  beforeAll(async () => {
    model = await loadG2pModel(ort as unknown as OrtRuntime, file("encoder.fp16.onnx"), file("decoder.fp16.onnx"));
  });
  afterAll(() => model.release());

  it("says plain words the way its training data does", async () => {
    expect(await model.predict("cat")).toBe("kˈæt");
    expect(await model.predict("wraith")).toBe("ɹˈAθ");
  });

  it("answers an invented word with only its own phonemes", async () => {
    const said = await model.predict("kaelith");
    expect(said).not.toBe("");
    expect([...said].filter((symbol) => !allowed.has(symbol))).toEqual([]);
  });

  it("answers overlapping calls the same as calls made one by one", async () => {
    const [first, second] = await Promise.all([model.predict("kaelith"), model.predict("vaelor")]);
    expect(first).toBe(await model.predict("kaelith"));
    expect(second).toBe(await model.predict("vaelor"));
  });

  it("stops on a word far past its input length", async () => {
    await expect(model.predict("a".repeat(200))).resolves.toEqual(expect.any(String));
  });
});
