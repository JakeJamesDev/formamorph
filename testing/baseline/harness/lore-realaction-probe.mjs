// Lore real-action probe — the external check on SEMANTIC_LORE_THRESHOLD. semantic-lore-probe.mjs scores a
// fixture whose actions were written to test it; this one replays REAL player actions harvested from the
// Sedge Landing baseline runs against the same 20-entry lore fixture (same trade-coast genre), so the
// phrasing is nobody's idea of a good test case.
//
// There are no ground-truth labels on real actions, so this does NOT measure precision/recall. It answers
// three things the labeled probe cannot:
//   1. fire rate — is the feature still alive at the shipped threshold, or effectively off?
//   2. plausibility — the top hits are printed, to be read rather than scored.
//   3. novelty — how many hits the keyword pass would already have caught. A semantic activation that
//      duplicates a keyword hit adds nothing; only keyword-free hits are the feature earning its place.
//
// Needs testing/baseline/runs/ (gitignored — produced by `npm run baseline`).
// Usage:  node lore-realaction-probe.mjs
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "@huggingface/transformers";

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname.slice(1)), "../../..");
const RUNS = path.join(REPO, "testing/baseline/runs");

const { entries } = JSON.parse(await readFile(path.join(REPO, "testing/baseline/semantic-lore-cases.json"), "utf8"));

// Collect unique actions from runs whose context names the Sedge Landing world.
const seen = new Set();
for (const f of await readdir(RUNS)) {
  if (!f.endsWith(".json")) continue;
  let d;
  try { d = JSON.parse(await readFile(path.join(RUNS, f), "utf8")); } catch { continue; }
  if (!Array.isArray(d) || !d.length) continue;
  const blob = JSON.stringify(d[0].requests ?? "").slice(0, 20000);
  if (!/Sedge|sedge channel|ferrywoman|Harrowgate/.test(blob)) continue;
  for (const t of d) if (typeof t.action === "string" && t.action.trim()) seen.add(t.action.trim());
}
const acts = [...seen];
console.log(`Real Sedge Landing player actions: ${acts.length}`);

const embedTextFor = (arm) => (e) => {
  const keys = (e.key ?? []).join(", ");
  const name = arm === "deduped" && e.name === keys ? "" : e.name;
  return [name, keys, (e.value || "").slice(0, 1000)].filter(Boolean).join(" — ");
};
const asAuthored = (e) => ({ ...e, name: (e.key ?? []).join(", ") });

const extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { dtype: "q8" });
const embed = async (texts) => {
  const out = await extractor(texts, { pooling: "mean", normalize: true });
  const [n, d] = out.dims;
  return Array.from({ length: n }, (_, r) => out.data.slice(r * d, (r + 1) * d));
};
const cos = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

const actVecs = await embed(acts);
const CAP = 3;

for (const population of ["authored", "imported"]) {
  const src = population === "authored" ? entries.map(asAuthored) : entries;
  const entryVecs = await embed(src.map(embedTextFor("deduped")));

  console.log(`\n=== ${population} ===`);
  console.log(`  thr    actions firing   total fires   fires/action`);
  for (const thr of [0.30, 0.35, 0.40, 0.42, 0.44, 0.46, 0.50]) {
    let firing = 0, total = 0;
    for (let i = 0; i < acts.length; i++) {
      const hits = entries.filter((_, ei) => cos(actVecs[i], entryVecs[ei]) >= thr).slice(0, CAP);
      if (hits.length) firing++;
      total += Math.min(hits.length, CAP);
    }
    const mark = thr === 0.44 ? "  ← shipped" : thr === 0.30 ? "  ← old" : "";
    console.log(`  ${thr.toFixed(2)}     ${String(firing).padStart(3)}/${acts.length}         ${String(total).padStart(3)}          ${(total / acts.length).toFixed(2)}${mark}`);
  }

  if (population === "imported") {
    console.log(`\n  What fires at 0.44 (real action → entry, similarity):`);
    const rows = [];
    for (let i = 0; i < acts.length; i++) {
      for (let ei = 0; ei < entries.length; ei++) {
        const sim = cos(actVecs[i], entryVecs[ei]);
        if (sim >= 0.44) rows.push({ a: acts[i], id: entries[ei].id, sim });
      }
    }
    rows.sort((x, y) => y.sim - x.sim);
    for (const r of rows.slice(0, 20)) console.log(`    ${r.sim.toFixed(2)}  ${r.id.padEnd(13)} ${r.a.slice(0, 88)}`);
    if (!rows.length) console.log(`    (nothing fired)`);
  }
}

// The decisive question: semantic lore only ADDS value where the keyword pass would not already fire.
// For every semantic hit, check whether the action literally contains one of that entry's keywords.
{
  const src = entries;
  const entryVecs = await embed(src.map(embedTextFor("deduped")));
  console.log(`\n\n=== Does semantic lore add anything the keyword pass misses? (imported) ===`);
  console.log(`  thr    fires   also keyword-matched   NOVEL (keyword-free)`);
  for (const thr of [0.30, 0.35, 0.40, 0.42, 0.44, 0.46]) {
    let fires = 0, kw = 0;
    for (let i = 0; i < acts.length; i++) {
      const lower = acts[i].toLowerCase();
      for (let ei = 0; ei < entries.length; ei++) {
        if (cos(actVecs[i], entryVecs[ei]) < thr) continue;
        fires++;
        if ((entries[ei].key ?? []).some((k) => lower.includes(k.toLowerCase()))) kw++;
      }
    }
    const mark = thr === 0.44 ? "  ← shipped" : thr === 0.30 ? "  ← old" : "";
    console.log(`  ${thr.toFixed(2)}    ${String(fires).padStart(3)}          ${String(kw).padStart(3)}                  ${String(fires - kw).padStart(3)}${mark}`);
  }
}
