// Writes word-to-phonemes over every set for the rating page: npx vite-node testing/g2p/writePredictions.ts <out.json> [a|b]
import { readFileSync, writeFileSync } from "node:fs";
import pipeline from "./pipeline";

const out = process.argv[2];
const accent = process.argv[3] ?? "a";
if (!out) throw new Error("Pass the output file.");
const predictions: Record<string, string> = {};
for (const file of ["./sets/unknown.json", "./sets/known.json", "./sets/strange.json", "./sets/fantasy.json", "./sets/sentences.json", "./sets/homographs.json", "../../src/lib/tts/g2p/britishWords.json"]) {
  const data: string[] | Record<string, unknown> = JSON.parse(readFileSync(new URL(file, import.meta.url), "utf8"));
  for (const word of Array.isArray(data) ? data : Object.keys(data)) predictions[word] = await pipeline(word, accent);
}
writeFileSync(out, JSON.stringify(predictions, null, 1));
console.log(`${Object.keys(predictions).length} entries in ${out}`);
