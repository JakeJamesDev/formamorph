// Objective scorer for Profile Q (quality) runs. Judged bars (agency, question-ack, outcome,
// world-fact) are graded by hand/LLM from the dump; this script covers only what is countable:
// planted-fact recall, cross-turn repetition, sentence-shape stats, and format violations.
//
// Usage: node qualityScore.mjs <run-file.json> [more-run-files...]

import { readFile } from "node:fs/promises";

// Turn indices (0-based) of the Profile Q script's objective recall checks.
const RECALL = [
  { turn: 20, label: "C1 compass (planted T3)", all: [/compass/i], any: [/crack/i, /lid/i, /mother/i] },
  { turn: 21, label: "C2 destination (planted T2)", all: [/harrowgate/i], any: [/autumn/i, /fair/i] },
];
const QUIET_TURNS = [15, 16, 19]; // the deliberate repetition stress cluster

const words = (s) => s.split(/\s+/).filter(Boolean);
const sentences = (s) =>
  s
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?…])\s+(?=["'A-Z])/)
    .map((x) => x.trim())
    .filter(Boolean);

function ngrams(text, n) {
  const w = words(text.toLowerCase().replace(/[^a-z0-9'\s]/g, ""));
  const out = new Set();
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(" "));
  return out;
}

function scoreRun(dump, file) {
  const narrations = dump.map((t) => t.requests?.find((r) => r.type === "narration")?.response ?? "");

  // --- recall ---
  const recall = RECALL.map((c) => {
    const text = narrations[c.turn] ?? "";
    const pass = c.all.every((re) => re.test(text)) && c.any.some((re) => re.test(text));
    const partial = !pass && [...c.all, ...c.any].some((re) => re.test(text));
    return { label: c.label, turn: c.turn + 1, pass, partial };
  });

  // --- repetition: 8-grams shared between different turns ---
  const grams = narrations.map((n) => ngrams(n, 8));
  const pairHits = [];
  for (let a = 0; a < grams.length; a++) {
    for (let b = a + 1; b < grams.length; b++) {
      let shared = 0;
      for (const g of grams[a]) if (grams[b].has(g)) shared++;
      if (shared > 0) pairHits.push({ a: a + 1, b: b + 1, shared });
    }
  }
  pairHits.sort((x, y) => y.shared - x.shared);
  const quietPairs = pairHits.filter((p) => QUIET_TURNS.includes(p.a - 1) && QUIET_TURNS.includes(p.b - 1));

  // --- sentence shape + format per turn ---
  const perTurn = narrations.map((text, i) => {
    const sents = sentences(text);
    const lens = sents.map((s) => words(s).length);
    const mean = lens.length ? lens.reduce((x, y) => x + y, 0) / lens.length : 0;
    return {
      turn: i + 1,
      wordCount: words(text).length,
      sentenceCount: sents.length,
      meanLen: Math.round(mean * 10) / 10,
      maxLen: Math.max(0, ...lens),
      runOns: lens.filter((l) => l > 40).length,
      fragments: lens.filter((l) => l < 4).length,
      unterminated: text.trim().length > 0 && !/[.!?…"')\]]$/.test(text.trim()),
      markdown: /(\*\*|(?<!\w)\*\w|^#{1,4}\s|^\s*[-*]\s|^\s*\d+\.\s)/m.test(text),
      empty: text.trim().length === 0,
    };
  });

  const agg = {
    turns: narrations.length,
    totalRunOns: perTurn.reduce((s, t) => s + t.runOns, 0),
    totalFragments: perTurn.reduce((s, t) => s + t.fragments, 0),
    unterminatedTurns: perTurn.filter((t) => t.unterminated).map((t) => t.turn),
    markdownTurns: perTurn.filter((t) => t.markdown).map((t) => t.turn),
    emptyTurns: perTurn.filter((t) => t.empty).map((t) => t.turn),
    meanWordsPerTurn: Math.round(perTurn.reduce((s, t) => s + t.wordCount, 0) / (perTurn.length || 1)),
    repeatedPairsOver3: pairHits.filter((p) => p.shared >= 3).length,
    worstPair: pairHits[0] ?? null,
    quietClusterWorst: quietPairs[0] ?? null,
  };

  console.log(`\n== ${file}`);
  console.log(`turns: ${agg.turns}  mean words/turn: ${agg.meanWordsPerTurn}`);
  for (const r of recall) console.log(`recall ${r.label}: ${r.pass ? "PASS" : r.partial ? "PARTIAL" : "FAIL"} (turn ${r.turn})`);
  console.log(`run-ons(>40w): ${agg.totalRunOns}  fragments(<4w): ${agg.totalFragments}`);
  console.log(`unterminated turns: [${agg.unterminatedTurns}]  markdown-despite-off turns: [${agg.markdownTurns}]  empty: [${agg.emptyTurns}]`);
  console.log(`8-gram repeat pairs (>=3 shared): ${agg.repeatedPairsOver3}  worst: ${agg.worstPair ? `T${agg.worstPair.a}~T${agg.worstPair.b} (${agg.worstPair.shared})` : "none"}`);
  console.log(`quiet cluster (16/17/20) worst: ${agg.quietClusterWorst ? `T${agg.quietClusterWorst.a}~T${agg.quietClusterWorst.b} (${agg.quietClusterWorst.shared})` : "none"}`);
  console.table(perTurn.map(({ turn, wordCount, sentenceCount, meanLen, maxLen, runOns, fragments }) => ({ turn, wordCount, sentenceCount, meanLen, maxLen, runOns, fragments })));
  return { recall, agg, perTurn };
}

for (const file of process.argv.slice(2)) {
  const dump = JSON.parse(await readFile(file, "utf8"));
  scoreRun(dump, file);
}
