// Writes the known-word set from bundled world prose: word and token count, no pronunciation.
// Usage: node testing/g2p/freezeKnownWords.mjs
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const worlds = new URL("../../src/defaultworlds/", import.meta.url);
const counts = new Map();
const CODE = /[{};]|=>|function |const |\breturn\b/;

function walk(value) {
  if (typeof value === "string") {
    if (value.startsWith("data:") || value.length > 200000 || value.length < 40 || !/\s/.test(value) || CODE.test(value)) return;
    for (const raw of value.match(/[A-Za-z]+(?:['’][a-z]+)?/g) ?? []) {
      const word = raw.replace(/’/g, "'");
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  } else if (Array.isArray(value)) value.forEach(walk);
  else if (value && typeof value === "object") Object.values(value).forEach(walk);
}

for (const file of readdirSync(worlds).filter((f) => f.endsWith(".json"))) walk(JSON.parse(readFileSync(new URL(file, worlds), "utf8")));

const sorted = Object.fromEntries([...counts].sort(([a], [b]) => (a < b ? -1 : 1)));
writeFileSync(new URL("./sets/known.json", import.meta.url), `${JSON.stringify(sorted, null, 0)}\n`);
console.log(`${counts.size} words, ${[...counts.values()].reduce((a, b) => a + b, 0)} tokens`);
