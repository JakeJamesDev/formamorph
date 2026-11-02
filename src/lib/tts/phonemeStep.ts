// Adapted from kokoro-js (https://github.com/hexgrad/kokoro, Apache-2.0, copyright hexgrad and contributors):
// src/phonemize.js. The only file that imports `phonemizer`, which serves British voices.
import { env } from "@huggingface/transformers";
import { phonemize as espeakng } from "phonemizer";
// The runtime instance transformers imports, undeclared in package.json so the two cannot drift apart.
import * as ort from "onnxruntime-web";
import ortMjsUrl from "onnxruntime-web-dist/ort-wasm-simd-threaded.jsep.mjs?url";
import ortWasmUrl from "onnxruntime-web-dist/ort-wasm-simd-threaded.jsep.wasm?url";
import dictionaryUrl from "./g2p/cmudict.dict?url";
import decoderUrl from "./g2p/decoder.fp16.onnx?url";
import encoderUrl from "./g2p/encoder.fp16.onnx?url";
import { loadG2pModel, type G2pModel, type OrtRuntime } from "./g2pModel";
import { createTextToPhonemes, parseDictionary } from "./textToPhonemes";

export type Accent = "a" | "b";

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
let americanPipeline: Promise<(text: string) => Promise<string>> | null = null;

function loadAmerican(): Promise<(text: string) => Promise<string>> {
  americanPipeline ??= fetchAsset(dictionaryUrl)
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
      americanPipeline = null;
      throw error;
    });
  return americanPipeline;
}

/** Drops the phoneme data and model; the next use loads them again. */
export async function releasePhonemeStep(): Promise<void> {
  const loaded = model;
  model = null;
  americanPipeline = null;
  if (loaded) await (await loaded).release();
}

/** Helper function to split a string on a regex, but keep the delimiters */
function split(text: string, regex: RegExp): { match: boolean; text: string }[] {
  const result: { match: boolean; text: string }[] = [];
  let prev = 0;
  for (const match of text.matchAll(regex)) {
    const fullMatch = match[0];
    if (prev < (match.index ?? 0)) {
      result.push({ match: false, text: text.slice(prev, (match.index ?? 0)) });
    }
    if (fullMatch.length > 0) {
      result.push({ match: true, text: fullMatch });
    }
    prev = (match.index ?? 0) + fullMatch.length;
  }
  if (prev < text.length) {
    result.push({ match: false, text: text.slice(prev) });
  }
  return result;
}

/** Helper function to split numbers into phonetic equivalents */
function split_num(match: string): string {
  if (match.includes(".")) {
    return match;
  } else if (match.includes(":")) {
    const [h, m] = match.split(":").map(Number);
    if (m === 0) {
      return `${h} o'clock`;
    } else if (m < 10) {
      return `${h} oh ${m}`;
    }
    return `${h} ${m}`;
  }
  const year = parseInt(match.slice(0, 4), 10);
  if (year < 1100 || year % 1000 < 10) {
    return match;
  }
  const left = match.slice(0, 2);
  const right = parseInt(match.slice(2, 4), 10);
  const suffix = match.endsWith("s") ? "s" : "";
  if (year % 1000 >= 100 && year % 1000 <= 999) {
    if (right === 0) {
      return `${left} hundred${suffix}`;
    } else if (right < 10) {
      return `${left} oh ${right}${suffix}`;
    }
  }
  return `${left} ${right}${suffix}`;
}

/** Helper function to format monetary values */
function flip_money(match: string): string {
  const bill = match[0] === "$" ? "dollar" : "pound";
  if (isNaN(Number(match.slice(1)))) {
    return `${match.slice(1)} ${bill}s`;
  } else if (!match.includes(".")) {
    const suffix = match.slice(1) === "1" ? "" : "s";
    return `${match.slice(1)} ${bill}${suffix}`;
  }
  const [b, c] = match.slice(1).split(".");
  const d = parseInt(c.padEnd(2, "0"), 10);
  const coins = match[0] === "$" ? (d === 1 ? "cent" : "cents") : d === 1 ? "penny" : "pence";
  return `${b} ${bill}${b === "1" ? "" : "s"} and ${d} ${coins}`;
}

/** Helper function to process decimal numbers */
function point_num(match: string): string {
  const [a, b] = match.split(".");
  return `${a} point ${b.split("").join(" ")}`;
}

/** Normalize text for phonemization */
function normalize_text(text: string): string {
  return (
    text
      // 1. Handle quotes and brackets
      .replace(/[‘’]/g, "'")
      .replace(/«/g, "“")
      .replace(/»/g, "”")
      .replace(/[“”]/g, '"')
      .replace(/\(/g, "«")
      .replace(/\)/g, "»")

      // 2. Replace uncommon punctuation marks
      .replace(/、/g, ", ")
      .replace(/。/g, ". ")
      .replace(/！/g, "! ")
      .replace(/，/g, ", ")
      .replace(/：/g, ": ")
      .replace(/；/g, "; ")
      .replace(/？/g, "? ")

      // 3. Whitespace normalization
      .replace(/[^\S \n]/g, " ")
      .replace(/  +/, " ")
      .replace(/(?<=\n) +(?=\n)/g, "")

      // 4. Abbreviations
      .replace(/\bD[Rr]\.(?= [A-Z])/g, "Doctor")
      .replace(/\b(?:Mr\.|MR\.(?= [A-Z]))/g, "Mister")
      .replace(/\b(?:Ms\.|MS\.(?= [A-Z]))/g, "Miss")
      .replace(/\b(?:Mrs\.|MRS\.(?= [A-Z]))/g, "Mrs")
      .replace(/\betc\.(?! [A-Z])/gi, "etc")

      // 5. Normalize casual words
      .replace(/\b(y)eah?\b/gi, "$1e'a")

      // 5. Handle numbers and currencies
      .replace(/\d*\.\d+|\b\d{4}s?\b|(?<!:)\b(?:[1-9]|1[0-2]):[0-5]\d\b(?!:)/g, split_num)
      .replace(/(?<=\d),(?=\d)/g, "")
      .replace(/[$£]\d+(?:\.\d+)?(?: hundred| thousand| (?:[bm]|tr)illion)*\b|[$£]\d+\.\d\d?\b/gi, flip_money)
      .replace(/\d*\.\d+/g, point_num)
      .replace(/(?<=\d)-(?=\d)/g, " to ")
      .replace(/(?<=\d)S/g, " S")

      // 6. Handle possessives
      .replace(/(?<=[BCDFGHJ-NP-TV-Z])'?s\b/g, "'S")
      .replace(/(?<=X')S\b/g, "s")

      // 7. Handle hyphenated words/letters
      .replace(/(?:[A-Za-z]\.){2,} [a-z]/g, (m) => m.replace(/\./g, "-"))
      .replace(/(?<=[A-Z])\.(?=[A-Z])/gi, "-")

      // 8. Strip leading and trailing whitespace
      .trim()
  );
}

/** Escapes regular expression special characters from a string by replacing them with their escaped counterparts */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

const PUNCTUATION = ';:,.!?¡¿—…"«»“”(){}[]';
const PUNCTUATION_PATTERN = new RegExp(`(\\s*[${escapeRegExp(PUNCTUATION)}]+\\s*)+`, "g");

/** Turns text into Kokoro phonemes: American voices use our pipeline, British voices use eSpeak-NG. */
export async function phonemize(text: string, language: Accent = "a", norm = true): Promise<string> {
  if (language === "a") return (await loadAmerican())(text);

  // 1. Normalize text
  if (norm) {
    text = normalize_text(text);
  }

  // 2. Split into chunks, to ensure we preserve punctuation
  const sections = split(text, PUNCTUATION_PATTERN);

  // 3. Convert each section to phonemes
  const ps = (await Promise.all(sections.map(async ({ match, text }) => (match ? text : (await espeakng(text, "en")).join(" "))))).join("");

  // 4. Post-process phonemes
  const processed = ps
    // https://en.wiktionary.org/wiki/kokoro#English
    .replace(/kəkˈoːɹoʊ/g, "kˈoʊkəɹoʊ")
    .replace(/kəkˈɔːɹəʊ/g, "kˈəʊkəɹəʊ")
    .replace(/ʲ/g, "j")
    .replace(/r/g, "ɹ")
    .replace(/x/g, "k")
    .replace(/ɬ/g, "l")
    .replace(/(?<=[a-zɹː])(?=hˈʌndɹɪd)/g, " ")
    .replace(/ z(?=[;:,.!?¡¿—…"«»“” ]|$)/g, "z");

  return processed.trim();
}
