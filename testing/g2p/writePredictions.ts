// Writes word-to-phonemes over every set for the rating page: npx vite-node testing/g2p/writePredictions.ts <out.json>
import { readFileSync, writeFileSync } from "node:fs";
import pipeline from "./pipeline";

const out = process.argv[2];
if (!out) throw new Error("Pass the output file.");
const predictions: Record<string, string> = {};
for (const name of ["unknown", "known", "strange", "fantasy", "sentences"]) {
  const data: string[] | Record<string, number> = JSON.parse(readFileSync(new URL(`./sets/${name}.json`, import.meta.url), "utf8"));
  for (const word of Array.isArray(data) ? data : Object.keys(data)) predictions[word] = await pipeline(word, "a");
}
writeFileSync(out, JSON.stringify(predictions, null, 1));
console.log(`${Object.keys(predictions).length} entries in ${out}`);
