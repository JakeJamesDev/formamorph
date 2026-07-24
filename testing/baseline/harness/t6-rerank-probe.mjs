// T6 rerank probe — does a cross-encoder fix the bare-cosine recall failures the 50-turn A/B
// exposed? Deterministic, no LLM. Two evidence sources:
//   1. REAL failure cases from the semQB run dumps: at probe turns C1 (compass) / C3 (seal), the
//      band candidates are the last milestoneSelect input's numbered digests; cosine failed to
//      rank the target into the top-12 (cap) — the A/B's verified loss mechanism.
//   2. The same-cast fixture (semantic-recall-margin-cases.json): return-target ranks + margins.
// For each case: target rank under cosine (all-MiniLM-L6-v2 q8, the app's embedder) vs under the
// cross-encoder (Xenova/ms-marco-MiniLM-L-6-v2 q8), plus per-pair CE latency (app viability).
//
// Usage:  node t6-rerank-probe.mjs [--cap 12]

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline, AutoTokenizer, AutoModelForSequenceClassification } from "@huggingface/transformers";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const RUNS_DIR = path.resolve(HARNESS_DIR, "../runs");
const args = process.argv.slice(2);
const argVal = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const CAP = Number(argVal("--cap", "12"));

// ── Case extraction from semQB dumps ──
const PROBES = [
  { key: "C1-compass", action: "I go through my pack piece by piece", targetRe: /compass/i },
  { key: "C3-seal", action: "how anyone will know the finished map is truly mine", targetRe: /\bseal\b/i },
];
const cases = [];
const files = (await readdir(RUNS_DIR)).filter((f) => f.startsWith("semQB-") && f.endsWith(".json")).sort();
for (const f of files) {
  const dump = JSON.parse(await readFile(path.join(RUNS_DIR, f), "utf8"));
  for (const p of PROBES) {
    const idx = dump.findIndex((e) => e.action && e.action.includes(p.action));
    if (idx < 0) continue;
    let digests = null;
    for (let j = idx; j >= 0; j--) {
      const ms = (dump[j].requests || []).filter((r) => r.type === "milestoneSelect");
      if (ms.length) {
        const um = ms[ms.length - 1].messages.at(-1).content;
        digests = [...um.matchAll(/^\d+\. (.+)$/gm)].map((m) => m[1]);
        break;
      }
    }
    if (!digests) continue;
    const target = digests.findIndex((d) => p.targetRe.test(d));
    if (target < 0) continue;
    cases.push({ name: `${p.key} · ${f.slice(0, 30)}`, query: dump[idx].action, digests, targets: [target] });
  }
}

// ── Fixture cases (return actions only) ──
const fx = JSON.parse(await readFile(path.resolve(HARNESS_DIR, "../semantic-recall-margin-cases.json"), "utf8"));
for (const a of fx.actions.filter((a) => a.expect.length)) {
  cases.push({ name: `fixture · ${a.name}`, query: a.text, digests: fx.digests, targets: a.expect });
}

console.log(`Loading embedder + cross-encoder (q8)…`);
const relevanceSrc = await readFile(path.resolve(HARNESS_DIR, "../../../src/lib/memoryRelevance.ts"), "utf8");
const EMBED_ID = relevanceSrc.match(/EMBEDDING_MODEL_ID = '([^']+)'/)[1];
const embedder = await pipeline("feature-extraction", EMBED_ID, { dtype: "q8" });
// Raw logits, not the text-classification pipeline: its sigmoid saturates every pair at 1.000 on
// this domain, collapsing the ranking to input order (verified — a positional artifact, not a bug
// in the model). Logits keep the full ordering.
const CE_IDS = (argVal("--ce", "Xenova/ms-marco-MiniLM-L-6-v2,jinaai/jina-reranker-v1-turbo-en,mixedbread-ai/mxbai-rerank-xsmall-v1")).split(",");

const embed = async (texts) => {
  const out = await embedder(texts, { pooling: "mean", normalize: true });
  const [n, d] = out.dims;
  return Array.from({ length: n }, (_, r) => out.data.slice(r * d, (r + 1) * d));
};
const cos = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

const rankOf = (scores, target) => scores.map((s, i) => ({ s, i })).sort((a, b) => b.s - a.s).findIndex((x) => x.i === target) + 1;

// Cosine baseline once.
const cosRanks = [];
for (const c of cases) {
  const [qv, ...dv] = await embed([c.query, ...c.digests]);
  const cosS = dv.map((v) => cos(qv, v));
  cosRanks.push(Math.min(...c.targets.map((t) => rankOf(cosS, t))));
}
const inCap = (ranks) => ranks.filter((r) => r <= CAP).length;

const summary = [`cosine`.padEnd(40) + `in-cap ${inCap(cosRanks)}/${cases.length}`];
for (const id of CE_IDS) {
  let ceModel, ceTokenizer;
  try {
    ceTokenizer = await AutoTokenizer.from_pretrained(id);
    ceModel = await AutoModelForSequenceClassification.from_pretrained(id, { dtype: "q8" });
  } catch (e) {
    summary.push(`${id.padEnd(40)}LOAD FAILED: ${String(e.message).slice(0, 80)}`);
    continue;
  }
  let ceMs = 0, cePairs = 0;
  const ceRanks = [];
  console.log(`\n[${id}]`);
  console.log(`case`.padEnd(45) + `n     rank: cosine → CE`);
  for (let ci = 0; ci < cases.length; ci++) {
    const c = cases[ci];
    const t0 = performance.now();
    const inputs = ceTokenizer(c.digests.map(() => c.query), { text_pair: c.digests, padding: true, truncation: true });
    const { logits } = await ceModel(inputs);
    ceMs += performance.now() - t0;
    cePairs += c.digests.length;
    const ceS = Array.from({ length: c.digests.length }, (_, i) => logits.data[i]);
    const bestCe = Math.min(...c.targets.map((t) => rankOf(ceS, t)));
    ceRanks.push(bestCe);
    console.log(c.name.slice(0, 43).padEnd(45) + String(c.digests.length).padEnd(6) + `${String(cosRanks[ci]).padStart(2)} → ${String(bestCe).padStart(2)}`);
  }
  summary.push(`${id.padEnd(40)}in-cap ${inCap(ceRanks)}/${cases.length} · ${(ceMs / cePairs).toFixed(1)} ms/pair`);
}
console.log(`\n==== Targets inside the top-${CAP} ====`);
for (const s of summary) console.log(s);
