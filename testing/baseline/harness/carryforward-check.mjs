// Carry-forward check for milestone memory (Phase 1, milestone-memory-design.md): were the entries the
// selector DROPPED load-bearing? For each saved arm-M dialogue-hold chain, re-derive the final kept/dropped
// split over the old-band summaries (selector is temp 0 — deterministic re-derivation), then judge every
// candidate fact against the chain's LATE narrations: does the late story contradict it? If dropped facts
// are contradicted no more often than kept ones, dropping was not load-bearing on this corpus.
//
//   node carryforward-check.mjs [--ts <batch timestamp substring>] [--model gemma4-e4b-cloud] [--verbose]

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const RUNS_DIR = path.join(HARNESS_DIR, "../runs");
const argv = process.argv.slice(2);
const strArg = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const verbose = argv.includes("--verbose");
const TS = strArg("--ts", "");
const MODEL_LABEL = strArg("--model", "gemma4-e4b-cloud");
const FLOOR = 3, RECENT = 6, LATE_FROM = 18;

const profiles = JSON.parse(await readFile(path.join(HARNESS_DIR, "profiles.json"), "utf8"));
const modelCfg = profiles.models.find((m) => m.label === MODEL_LABEL);
const ENDPOINT = modelCfg.endpointUrl ?? profiles.endpointUrl;
const MODEL = modelCfg.modelName ?? MODEL_LABEL;
const TOKEN = modelCfg.apiToken ?? profiles.apiToken ?? "";

async function call(messages, extra = {}) {
  const headers = { "Content-Type": "application/json" };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  const res = await fetch(ENDPOINT, {
    method: "POST", headers,
    body: JSON.stringify({ model: MODEL, reasoning_effort: "none", stream: false, ...extra, messages }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return ((await res.json()).choices?.[0]?.message?.content ?? "").trim();
}

// Same selector as dialogue-hold arm M (fewshot, temp 0).
const SELECTOR_SYS = `You are the memory keeper of an interactive story. You are given the story's remembered moments as a numbered list, oldest first. Keep an entry only if someone in the story would bring it up again or act on it: a promise or debt still open, a threat or wound that persists, a thing gained and kept, a favor done or a slight given that changes how one character sees another, a secret learned, a task done well that someone might mention. Drop what no one would ever speak of again - passing movement, small talk, and any moment whose outcome a later entry already carries. When unsure whether something still matters, let it go.

Example:
1. You take the cliff path toward the lighthouse.
2. You promise the keeper Brann you will fetch his lamp oil from town.
3. You trade jokes with a fishwife on the quay.
4. You bring Brann his lamp oil, and he lights the beacon, calling you a friend of the tower.
Correct reply: 4
Entry 4 carries entry 2's outcome - the fulfilled promise replaces the promise itself, so the ending is kept and the setup is dropped. Entries 1 and 3 are passing moments no one would mention again.

Reply with only the numbers to keep, comma-separated.`;
async function selectKeep(summaries) {
  const list = summaries.map((s, i) => `${i + 1}. ${s}`).join("\n");
  const out = await call(
    [{ role: "system", content: SELECTOR_SYS },
     { role: "user", content: `The story's remembered moments, oldest first:\n${list}\n\nReply with only the numbers to keep, comma-separated.` }],
    { temperature: 0, max_tokens: 120 },
  );
  const nums = (out.match(/\d+/g) || []).map(Number).filter((n) => n >= 1 && n <= summaries.length);
  return new Set(nums.map((n) => n - 1));
}

async function judgeContradiction(fact, lateText) {
  const out = await call(
    [{ role: "user", content:
      `A fact recorded earlier in a story: "${fact}"\n\nA later part of the same story:\n${lateText}\n\nDoes the later part CONTRADICT the recorded fact - describe something that could not be true if the fact holds? Not mentioning the fact is not a contradiction. Reply with exactly YES or NO.` }],
    { temperature: 0, max_tokens: 5 },
  );
  return /^\s*YES/i.test(out);
}

const files = (await readdir(RUNS_DIR)).filter((f) => f.startsWith("dialogue-hold-M-run") && f.includes(TS));
if (!files.length) throw new Error("no arm-M chains found (pass --ts)");
// Use the newest batch only.
const newestTs = files.map((f) => f.match(/(\d{4}-\d{2}-\d{2}T[\d-]+Z)/)?.[1]).sort().pop();
const batch = files.filter((f) => f.includes(newestTs));
console.log(`carry-forward — ${batch.length} arm-M chain(s) from ${newestTs} · judge/model ${MODEL_LABEL}`);

const agg = { dropJudged: 0, dropContra: 0, keepJudged: 0, keepContra: 0 };
for (const f of batch.sort()) {
  const j = JSON.parse(await readFile(path.join(RUNS_DIR, f), "utf8"));
  const turns = j.turns;
  // Final-turn old band: candidate entries are the opener + turns older than floor+recent.
  // turns[] excludes the opener, so candidates are turns[0 .. total+1-FLOOR-RECENT-2].
  const candEnd = turns.length + 1 - FLOOR - RECENT - 1;
  const cands = turns.slice(0, candEnd).filter((t) => t.summary);
  const late = turns.slice(LATE_FROM).map((t) => t.narration).filter(Boolean).join("\n\n").slice(0, 12000);
  if (!cands.length || !late) { console.log(`${f}: skipped (no candidates or late text)`); continue; }
  const keep = await selectKeep(cands.map((t) => t.summary));
  let line = `run${j.run}: cand ${cands.length} kept ${keep.size}`;
  for (let i = 0; i < cands.length; i++) {
    const contra = await judgeContradiction(cands[i].summary, late);
    const kept = keep.has(i);
    if (kept) { agg.keepJudged++; if (contra) agg.keepContra++; }
    else { agg.dropJudged++; if (contra) agg.dropContra++; }
    if (contra && verbose) console.log(`  CONTRA (${kept ? "kept" : "DROPPED"}): ${cands[i].summary.slice(0, 100)}`);
    if (contra && !kept) line += ` · CONTRA-DROPPED t${cands[i].t}`;
  }
  console.log(line);
}

console.log(`\n==== carry-forward (${MODEL_LABEL}) ====`);
const rate = (c, n) => (n ? (c / n).toFixed(2) : "n/a");
console.log(
  `dropped facts contradicted ${agg.dropContra}/${agg.dropJudged} (${rate(agg.dropContra, agg.dropJudged)})` +
  ` · kept facts contradicted ${agg.keepContra}/${agg.keepJudged} (${rate(agg.keepContra, agg.keepJudged)})`,
);
console.log(`Pass condition: dropped rate <= kept rate (dropping was not load-bearing).`);
