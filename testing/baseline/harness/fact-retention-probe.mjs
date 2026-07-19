// FACT-RETENTION probe — the missing gate for a summary-prompt change. Freeze-count only tells us the digest
// stopped SAYING the tic words; it does NOT tell us the digest still CARRIES THE FACTS. A tic-free digest that
// also drops "Sarah is futa" or "she agreed" is worse for memory, and freeze-count would score that loss as a
// win. This probe checks fact fidelity directly, per turn, for the A (recorded) and B (--swap) digests.
//
// Per turn (blind to the digests) it asks the model to extract the facts the full narration establishes,
// TAGGED by type:
//   [state] — a durable fact later turns depend on (decision, admission, change, position, relationship,
//             world/character fact, object, commitment). THIS is what memory must keep.
//   [beat]  — an in-the-moment action/reaction that does not carry forward (a gasp, a shift, an expression).
//             B is DESIGNED to drop these, so a lower [beat] retention for B is expected, not a regression.
// Then, per digest, it judges which facts the digest preserves (batched: one judge call per digest).
//
// The headline is [state] retention A vs B. If B keeps state facts ≈ A, the freeze win is clean. If B drops
// state facts, that's the hidden flaw. [beat] retention is reported separately as a diagnostic, not a score.
//
//   node fact-retention-probe.mjs "D:/Downloads/ai-context-long session.json" --swap <redigested.json> --from 16 --to 49 [--verbose]

import { readFile } from "node:fs/promises";
import { parseArgs, callMessages } from "./planner-probe-lib.mjs";

const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith("--")) || null;
if (!file) { console.error("Provide an ai-context export path as the first argument."); process.exit(1); }
const strArg = (f, d = null) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const numArg = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? Number(argv[i + 1]) : d; };
const swapFile = strArg("--swap");
const verbose = argv.includes("--verbose");
const from = numArg("--from", 0);
const to = numArg("--to", Infinity);
const opts = parseArgs(process.argv);

const turns = JSON.parse(await readFile(file, "utf8"));
const red = swapFile ? JSON.parse(await readFile(swapFile, "utf8")) : null;
const narrOf = (t) => t.requests?.find((r) => r.type === "narration")?.response || "";
const sumOf = (t) => (t.requests?.find((r) => r.type === "summary")?.response || "").trim();

const EXTRACT_SYS = `You extract the facts one passage of a story establishes, for a memory system. List each concrete, checkable fact on its own line, tagged by type:
- [state] a durable fact a later storyteller must not forget or contradict: a decision, admission, change, revealed body/identity trait, position or place, relationship shift, object, or commitment.
- [beat] an in-the-moment action or reaction that does NOT carry forward: a gasp, a shift in position, a facial expression, a physical reaction, a passing gesture.
List 3 to 8 facts, most important first, using only what the passage explicitly states. Format each line exactly as: [state] <fact>  or  [beat] <fact>. Nothing else.`;

const JUDGE_SYS = `You check whether a short memory note preserves a list of facts. The note need not use the same words - it preserves a fact if it conveys the same thing, explicitly or by clear implication. For each numbered fact, reply on its own line exactly "<n>: yes" or "<n>: no". Output only those lines.`;

async function extractFacts(narration) {
  const out = await callMessages({ ...opts, temp: 0, maxTokens: 320 }, [
    { role: "system", content: EXTRACT_SYS },
    { role: "user", content: narration },
  ]);
  return out.split("\n").map((l) => l.trim()).filter((l) => /^\[(state|beat)\]/i.test(l))
    .map((l) => ({ type: /^\[state\]/i.test(l) ? "state" : "beat", text: l.replace(/^\[(state|beat)\]\s*/i, "") }));
}

async function judge(facts, digest) {
  if (!facts.length) return [];
  const list = facts.map((f, i) => `${i + 1}. ${f.text}`).join("\n");
  const out = await callMessages({ ...opts, temp: 0, maxTokens: 256 }, [
    { role: "system", content: JUDGE_SYS },
    { role: "user", content: `Facts:\n${list}\n\nMemory note:\n${digest}` },
  ]);
  const yes = new Set();
  for (const m of out.matchAll(/(\d+)\s*:\s*(yes|no)/gi)) if (/yes/i.test(m[2])) yes.add(Number(m[1]));
  return facts.map((f, i) => ({ ...f, kept: yes.has(i + 1) }));
}

console.log(`FACT RETENTION · ${file}${swapFile ? ` · B=${swapFile.split(/[\\/]/).pop()}` : ""} · "${opts.model}"\n`);
console.log("turn | state A/B | beat A/B | dropped-by-B [state] facts");

const T = { stateA: 0, stateB: 0, stateN: 0, beatA: 0, beatB: 0, beatN: 0 };
for (let i = from; i <= Math.min(to, turns.length - 1); i++) {
  const t = turns[i];
  if (!t.requests?.find((r) => r.type === "summary")) continue;
  const narration = narrOf(t);
  if (!narration) continue;
  let facts;
  try { facts = await extractFacts(narration); }
  catch (e) { console.log(`${String(i).padStart(3)}  EXTRACT ERROR: ${String(e.message || e)}`); continue; }
  if (!facts.length) continue;
  const aJudged = await judge(facts, sumOf(t));
  const bJudged = red ? await judge(facts, sumOf(red[i])) : aJudged;
  const bins = (j, type) => j.filter((f) => f.type === type);
  const sA = bins(aJudged, "state"), sB = bins(bJudged, "state");
  const beA = bins(aJudged, "beat"), beB = bins(bJudged, "beat");
  const sAk = sA.filter((f) => f.kept).length, sBk = sB.filter((f) => f.kept).length;
  const beAk = beA.filter((f) => f.kept).length, beBk = beB.filter((f) => f.kept).length;
  T.stateA += sAk; T.stateB += sBk; T.stateN += sA.length;
  T.beatA += beAk; T.beatB += beBk; T.beatN += beA.length;
  // State facts A kept but B dropped — the real regression to surface.
  const lost = sA.map((f, idx) => ({ f, kept: sB[idx]?.kept })).filter((x) => sA.find((y) => y.text === x.f.text)?.kept && !x.kept);
  const lostTxt = red ? sB.filter((f) => !f.kept && sA.find((a) => a.text === f.text)?.kept).map((f) => f.text.slice(0, 40)).join(" | ") : "";
  console.log(`${String(i).padStart(3)}  |  ${sAk}/${sA.length}  ${sBk}/${sB.length}  |  ${beAk}/${beA.length}  ${beBk}/${beB.length}  | ${lostTxt}`);
  if (verbose) facts.forEach((f) => console.log(`      [${f.type}] ${f.text}`));
}

const pc = (k, n) => (n ? `${((100 * k) / n).toFixed(0)}%` : "—");
console.log(`\n==== fact retention (${T.stateN} state facts, ${T.beatN} beat facts) ====`);
console.log(`STATE (memory-critical): A ${pc(T.stateA, T.stateN)} · B ${pc(T.stateB, T.stateN)}   ← headline: B should ≈ A`);
console.log(`beat (ephemeral, B meant to drop): A ${pc(T.beatA, T.beatN)} · B ${pc(T.beatB, T.beatN)}`);
