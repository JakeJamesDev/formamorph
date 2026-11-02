// Writes the training pairs from the pinned CMUdict, so the Python trainer never maps phones itself.
// Usage: npx vite-node testing/g2p/writePairs.ts <out.json>
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { arpabetToKokoro, parseCmudictLine } from "@/lib/tts/arpabet";
import pins from "./pins.json";

const out = process.argv[2];
if (!out) throw new Error("Usage: writePairs.ts <out.json>");

const text = readFileSync(new URL("../../src/lib/tts/g2p/cmudict.dict", import.meta.url), "utf8");
const sha256 = createHash("sha256").update(text).digest("hex");
if (sha256 !== pins.cmudict.sha256) throw new Error(`cmudict.dict is ${sha256}, the pin says ${pins.cmudict.sha256}.`);

// Refuses variants, written `word(2)`, and one-letter words.
const PRIMARY = /^[a-z']{2,}$/;
const pairs: [string, string][] = [];
for (const line of text.split("\n")) {
  const entry = parseCmudictLine(line);
  if (entry && PRIMARY.test(entry[0])) pairs.push([entry[0], arpabetToKokoro(entry[1])]);
}

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ cmudict: pins.cmudict, seed: pins.seed, pairs }));
console.log(`${pairs.length} pairs from ${pins.cmudict.commit}`);
