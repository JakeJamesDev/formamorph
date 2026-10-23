// Parity scorer: narration paragraph breaks and cross-turn repetition for baseline run dumps, grouped by arm.
// Usage: node parity-score.mjs <arm>=<run.json> [<arm>=<run.json> ...]   (repeat an arm name per run)

import { readFile } from "node:fs/promises";

const words = (s) => s.split(/\s+/).filter(Boolean);

function ngrams(text, n) {
  const w = words(text.toLowerCase().replace(/[^a-z0-9'\s]/g, ""));
  const out = new Set();
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(" "));
  return out;
}

export function scoreRun(dump) {
  const narrations = dump.map((t) => t.requests?.find((r) => r.type === "narration")?.response ?? "");
  const paragraphs = narrations.map((n) => n.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).length);
  const lineBreaks = narrations.map((n) => (n.match(/\n/g) ?? []).length);
  const grams = narrations.map((n) => ngrams(n, 8));
  let repeatedPairs = 0;
  let sharedGrams = 0;
  for (let a = 0; a < grams.length; a++) {
    for (let b = a + 1; b < grams.length; b++) {
      let shared = 0;
      for (const g of grams[a]) if (grams[b].has(g)) shared++;
      sharedGrams += shared;
      if (shared >= 3) repeatedPairs++;
    }
  }
  const sum = (xs) => xs.reduce((x, y) => x + y, 0);
  return {
    turns: narrations.length,
    empty: narrations.filter((n) => !n.trim()).length,
    meanWords: sum(narrations.map((n) => words(n).length)) / (narrations.length || 1),
    meanParagraphs: sum(paragraphs) / (paragraphs.length || 1),
    singleParagraphTurns: paragraphs.filter((p) => p <= 1).length,
    meanLineBreaks: sum(lineBreaks) / (lineBreaks.length || 1),
    repeatedPairs,
    sharedGrams,
  };
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
const sd = (xs) => Math.sqrt(mean(xs.map((x) => (x - mean(xs)) ** 2)));

async function main() {
  const arms = new Map();
  for (const spec of process.argv.slice(2)) {
    const [arm, file] = spec.split("=");
    const dump = JSON.parse(await readFile(file, "utf8"));
    const turns = Array.isArray(dump) ? dump : (dump.turns ?? dump.debugTurns ?? []);
    if (!arms.has(arm)) arms.set(arm, []);
    arms.get(arm).push(scoreRun(turns));
  }
  const metrics = ["turns", "empty", "meanWords", "meanParagraphs", "singleParagraphTurns", "meanLineBreaks", "repeatedPairs", "sharedGrams"];
  const rows = [];
  for (const [arm, runs] of arms) {
    const row = { arm, runs: runs.length };
    for (const m of metrics) {
      const xs = runs.map((r) => r[m]);
      row[m] = `${mean(xs).toFixed(2)}±${sd(xs).toFixed(2)}`;
    }
    rows.push(row);
  }
  console.table(rows);
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`) await main();
