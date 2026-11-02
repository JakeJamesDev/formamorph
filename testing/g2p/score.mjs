// Scores a pipeline against WikiPron and prints exact and phoneme error beside eSpeak's stored numbers. scoreCli.mjs runs it.
// WikiPron is CC BY-SA: it is fetched here at run time, cached under node_modules, and never committed.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (path) => JSON.parse(readFileSync(resolve(HERE, path), "utf8"));

/** The bar leaves these out: their reduced forms never match a dictionary reference. */
const FUNCTION_WORDS = new Set(["the", "and", "a"]);

const COMBINING = /[̩̯̥̍̆̚͡]/g;
const SHARED = [[/A/g, "eɪ"], [/I/g, "aɪ"], [/W/g, "aʊ"], [/Y/g, "ɔɪ"], [/ʤ/g, "dʒ"], [/ʧ/g, "tʃ"], [/ᵊ/g, "ə"], [/T/g, "t"], [/ɾ/g, "t"], [/ɫ/g, "l"], [/ᵻ/g, "ɪ"], [/ɐ/g, "ə"], [/ʔ/g, ""], [/r/g, "ɹ"], [/g/g, "ɡ"], [/ʍ/g, "w"]];

/** Reduces Kokoro notation and WikiPron IPA to one spelling, so only real sound differences count. */
export function normalize(phonemes, accent = "us") {
  let s = phonemes.replace(/[ˈˌ\s.,!?]/g, "").normalize("NFD").replace(COMBINING, "").normalize("NFC");
  if (accent === "us") {
    s = s.replace(/ɜː/g, "ɜɹ").replace(/oːɹ/g, "ɔɹ").replace(/ɜ˞/g, "ɜɹ").replace(/O/g, "oʊ");
    for (const [from, to] of SHARED) s = s.replace(from, to);
    return s.replace(/ː/g, "").replace(/ɚ/g, "əɹ").replace(/ɝ/g, "ɜɹ").replace(/ɜɹ/g, "əɹ");
  }
  s = s.replace(/Q/g, "əʊ").replace(/O/g, "əʊ").replace(/ɛː/g, "ɛə").replace(/a(?![ɪʊ])/g, "æ");
  for (const [from, to] of SHARED) s = s.replace(from, to);
  return s.replace(/ː/g, "");
}

export function editDistance(left, right) {
  const a = [...left], b = [...right];
  let prev = [0, ...b.map((_, i) => i + 1)];
  for (let i = 0; i < a.length; i++) {
    const row = [i + 1];
    for (let j = 0; j < b.length; j++) row.push(Math.min(prev[j + 1] + 1, row[j] + 1, prev[j] + (a[i] === b[j] ? 0 : 1)));
    prev = row;
  }
  return prev[b.length];
}

/** Any listed reference variant counts. `items` holds `[word, weight]`; a word with no reference is left out. */
export async function scoreWords(items, references, phonemize, accent = "us") {
  let scored = 0, exact = 0, errors = 0, length = 0, words = 0, total = 0;
  for (const [word, weight] of items) {
    total += weight;
    const refs = references.get(word.toLowerCase());
    if (!refs || FUNCTION_WORDS.has(word.toLowerCase())) continue;
    const said = normalize(await phonemize(word), accent);
    const normal = refs.map((r) => normalize(r, accent));
    let best = Infinity, bestLength = 1;
    for (const ref of normal) {
      const d = editDistance(said, ref);
      if (d < best) { best = d; bestLength = [...ref].length; }
    }
    words++;
    scored += weight;
    if (normal.includes(said)) exact += weight;
    errors += best * weight;
    length += bestLength * weight;
  }
  return { words, tokens: scored, coverage: +(100 * scored / (total || 1)).toFixed(1), exact: +(100 * exact / (scored || 1)).toFixed(1), error: +(100 * errors / (length || 1)).toFixed(1) };
}

export function setItems(name) {
  const data = read(`sets/${name}.json`);
  return Array.isArray(data) ? data.map((w) => [w, 1]) : Object.entries(data);
}

export function gitBlob(bytes) {
  return createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
}

export async function loadWikipron(accent) {
  const { repo, commit, [accent]: file } = read("pins.json").wikipron;
  const cache = resolve(HERE, `../../node_modules/.cache/wikipron/${file.blob}.tsv`);
  if (!existsSync(cache)) {
    const url = `https://raw.githubusercontent.com/${repo}/${commit}/${file.path}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url} answered ${response.status}.`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (gitBlob(bytes) !== file.blob) throw new Error(`${url} is not blob ${file.blob}.`);
    mkdirSync(dirname(cache), { recursive: true });
    writeFileSync(cache, bytes);
  }
  const references = new Map();
  for (const line of readFileSync(cache, "utf8").split("\n")) {
    const [word, ipa] = line.split("\t");
    if (!ipa) continue;
    const key = word.toLowerCase();
    if (!references.has(key)) references.set(key, []);
    references.get(key).push(ipa.trim().replace(/\s+/g, ""));
  }
  return references;
}

function option(name) {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : undefined;
}

export async function main() {
  const predictions = option("predictions"), module = option("module");
  if (!predictions && !module) throw new Error("Pass --predictions <file> or --module <file>.");
  const voiceAccent = option("accent") ?? "a";
  const accent = { a: "us", b: "uk" }[voiceAccent];
  if (!accent) throw new Error(`--accent is a or b, not "${voiceAccent}".`);
  const sets = (option("sets") ?? "unknown,known,strange,fantasy").split(",");
  let phonemize;
  if (predictions) {
    const table = JSON.parse(readFileSync(predictions, "utf8"));
    phonemize = async (word) => {
      const said = table[word] ?? table[word.toLowerCase()];
      if (said === undefined) throw new Error(`${predictions} has no entry for "${word}".`);
      return said;
    };
  } else {
    const { default: pipeline } = await import(pathToFileURL(resolve(module)).href);
    phonemize = (word) => pipeline(word, voiceAccent);
  }
  const references = await loadWikipron(accent);
  const stored = read("espeak-reference.json").results[accent] ?? {};
  const results = {};
  for (const name of sets) {
    const score = await scoreWords(setItems(name), references, phonemize, accent);
    results[name] = score;
    const base = stored[name];
    const delta = base ? ` | eSpeak ${base.exact}% / ${base.error}, delta ${(score.error - base.error).toFixed(1)}` : "";
    console.log(`${name.padEnd(8)} ${score.words} words, ${score.coverage}% covered | exact ${score.exact}% | phoneme error ${score.error}${delta}`);
  }
  const out = option("json");
  if (out) writeFileSync(out, JSON.stringify(results, null, 1));
}
