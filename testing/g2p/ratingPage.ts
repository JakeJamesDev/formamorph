// Builds a blind rating page, carrying ratings for identical strings, and folds the results back in.
// Build: npx vite-node testing/g2p/ratingPage.ts build <set> <out dir> <arm>=<word-to-phonemes.json> [...] [--accent a|b] [--voice af_heart]
// Merge: npx vite-node testing/g2p/ratingPage.ts merge <results.json> [--accent a|b]
// Tally: npx vite-node testing/g2p/ratingPage.ts tally <set> <arm>=<word-to-phonemes.json> [...] [--accent a|b]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { KokoroClient } from "@/lib/tts/kokoroClient";
import { mergeRatings, pageHtml, planClips, tally } from "./ratingPlan.mjs";

type Ratings = Record<string, Record<string, boolean>>;
const storeUrl = new URL("./ratings.json", import.meta.url);
/** Whole sentences, spoken with no carrier; no bar counts them. */
const SENTENCES = "sentences";
const CARRIER: Record<string, (phonemes: string) => string> = {
  a: (ph) => `ðə ɹˈOd tə ${ph} wʌz klˈOzd.`,
  b: (ph) => `ðə ɹˈəʊd tə ${ph} wɒz klˈəʊzd.`,
};

const argv = process.argv.slice(2);
function flag(name: string, fallback: string): string {
  const at = argv.indexOf(`--${name}`);
  if (at < 0) return fallback;
  return argv.splice(at, 2)[1];
}
const accent = flag("accent", "a");
const voice = flag("voice", accent === "a" ? "af_heart" : "bf_emma");
const [command, ...rest] = argv;
const store: Record<string, Ratings> = JSON.parse(readFileSync(storeUrl, "utf8"));
const ratings = store[accent] ?? {};

const setWords = (name: string): string[] => {
  const data = JSON.parse(readFileSync(new URL(`./sets/${name}.json`, import.meta.url), "utf8"));
  return Array.isArray(data) ? data : Object.keys(data);
};
const readArms = (specs: string[]): Record<string, Record<string, string>> =>
  Object.fromEntries(specs.map((spec) => {
    const at = spec.indexOf("=");
    return [spec.slice(0, at), JSON.parse(readFileSync(spec.slice(at + 1), "utf8"))];
  }));
const printTally = (arms: Record<string, Record<string, string>>, words: string[], from: Ratings) => {
  for (const [arm, row] of Object.entries(tally(arms, words, from))) {
    console.log(`${arm}: ${row.acceptable} acceptable, ${row.rejected} rejected, ${row.unrated.length} unrated of ${words.length}`);
  }
};

if (command === "build") {
  const [set, outDir, ...specs] = rest;
  const arms = readArms(specs);
  const words = setWords(set);
  const plan = planClips(arms, words, ratings);
  printTally(arms, words, ratings);
  // q8 on CPU is what every carried rating was heard through.
  const loaded = await KokoroClient.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: "q8", device: "cpu" });
  const tts = new KokoroClient(loaded.model, loaded.tokenizer, { phonemize: async (phonemes) => phonemes });
  mkdirSync(resolve(outDir), { recursive: true });
  let n = 0;
  const rows = [];
  for (const { word, clips } of plan) {
    const rendered = [];
    for (const phonemes of clips) {
      const audio = await tts.generate(set === SENTENCES ? phonemes : CARRIER[accent](phonemes), { voice });
      const file = `c${String(n++).padStart(4, "0")}.wav`;
      writeFileSync(join(resolve(outDir), file), Buffer.from(audio.toWav()));
      rendered.push({ phonemes, file });
    }
    rows.push({ word, clips: rendered });
  }
  const intro = set === SENTENCES ? "Each clip says the sentence above it." : undefined;
  writeFileSync(join(resolve(outDir), "index.html"), pageHtml(`Rating ${set} ${accent}`, rows, intro));
  console.log(`${n} clips for ${rows.length} words in ${join(resolve(outDir), "index.html")}`);
} else if (command === "merge") {
  const results = JSON.parse(readFileSync(rest[0], "utf8"));
  store[accent] = mergeRatings(ratings, results);
  writeFileSync(storeUrl, `${JSON.stringify(store)}\n`);
  console.log(`Merged ${Object.keys(results).length} words.`);
} else if (command === "tally") {
  const [set, ...specs] = rest;
  printTally(readArms(specs), setWords(set), ratings);
} else {
  throw new Error("Use build, merge, or tally.");
}
