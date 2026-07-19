// PLAN-QUALITY VARIANCE probe — the dialogue decay isn't format or narration wording; it's that a fresh plan
// sometimes voices the whole cast and sometimes collapses to ONE speaker, and the narrator renders whichever it
// got. This scores the PLANNER directly: fire the shipped planner N times per real turn (rerendered onto the
// recorded recap/entities), and measure per plan:
//   present  — cast members besides the player (from the Cast list)
//   voiced   — distinct cast members given a quoted line in the Beats
//   collapse — present >= 2 but voiced <= 1 (the failure: everyone's there, only one talks)
// Then it correlates collapse with turn index and cast size, to find what predicts it.
//
//   node plan-cast-probe.mjs "D:/Downloads/stalled.json" [--runs 10] [--from 1] [--to 15] [--verbose]

import { readFileSync } from "node:fs";
import { parseArgs, callMessages, runAll, grab, parsePlan } from "./planner-probe-lib.mjs";

const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith("--"));
const num = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? Number(argv[i + 1]) : d; };
const verbose = argv.includes("--verbose");
const opts = parseArgs(process.argv);
const RUNS = num("--runs", 10);
const from = num("--from", 1);
const to = num("--to", Infinity);

const turns = JSON.parse(readFileSync(file, "utf8"));
const thinkOf = (t) => t.requests?.find((r) => r.type === "thinking");

const THINK = grab("defaultThinkingPrompt");
function rerender(sys) {
  const S = "## Game World", E = "Respond in exactly this format:";
  return THINK.slice(0, THINK.indexOf(S)) + sys.slice(sys.indexOf(S), sys.indexOf(E)).trimEnd() + "\n\n" + THINK.slice(THINK.indexOf(E));
}

// Cast members (besides the player), from the "- <Name> - <placement>" lines; strip any "(how known)" tail.
function castNames(planText) {
  const { cast } = parsePlan(planText);
  return cast.split("\n").map((l) => l.replace(/^\s*[-*]\s*/, "")).map((l) => l.split(" - ")[0].trim())
    .filter((n) => n && !/player character/i.test(n)).map((n) => n.replace(/\s*\(.*$/, "").trim()).filter(Boolean);
}
// Distinct cast members who appear in a Beats sentence that contains quoted dialogue (a proxy for "voiced").
function voicedCount(beats, names) {
  const spk = new Set();
  for (const s of beats.split(/(?<=[.!?])\s+/)) {
    if (!/"[^"]{2,}"|[“][^”]{2,}[”]/.test(s)) continue;
    for (const n of names) { const first = n.split(/\s+/)[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); if (first.length > 1 && new RegExp(`\\b${first}\\b`).test(s)) spk.add(n); }
  }
  return spk.size;
}

const jobs = [];
for (let i = from; i <= Math.min(to, turns.length - 1); i++) if (thinkOf(turns[i])?.messages) for (let r = 0; r < RUNS; r++) jobs.push({ i, r });

console.log(`PLAN-QUALITY VARIANCE · ${file} · "${opts.model}" · runs ${RUNS}\n`);
const scored = await runAll(jobs, async ({ i, r }) => {
  const th = thinkOf(turns[i]);
  const msgs = th.messages.map((m) => (m.role === "system" ? { ...m, content: rerender(m.content) } : m));
  let plan = "";
  try { plan = await callMessages({ ...opts, temp: 0.4, repPen: 1, maxTokens: 256, seed: opts.seed + r }, msgs); }
  catch (e) { if (!/Context size/.test(String(e.message || e))) console.log(`${i} r${r} ERR ${String(e.message || e).slice(0, 60)}`); return null; }
  let names, voiced, present;
  try { names = castNames(plan); voiced = voicedCount(parsePlan(plan).beats || plan, names); present = names.length; }
  catch (e) { console.log(`${i} r${r} SCORE ERR ${String(e.message || e).slice(0, 60)}`); return null; }
  if (verbose) console.log(`  [${i} r${r}] present ${present} voiced ${voiced}${present >= 2 && voiced <= 1 ? "  COLLAPSE" : ""}`);
  return { i, present, voiced, collapse: present >= 2 && voiced <= 1 };
});

const byTurn = {};
for (const s of scored.filter(Boolean)) (byTurn[s.i] ||= []).push(s);
console.log("turn | present | mean-voiced | collapse-rate");
const all = [];
for (const i of Object.keys(byTurn).map(Number).sort((a, b) => a - b)) {
  const rows = byTurn[i]; all.push(...rows);
  const present = (rows.reduce((a, s) => a + s.present, 0) / rows.length);
  const voiced = (rows.reduce((a, s) => a + s.voiced, 0) / rows.length);
  const coll = Math.round((100 * rows.filter((s) => s.collapse).length) / rows.length);
  console.log(`${String(i).padStart(3)}  |  ${present.toFixed(1).padStart(4)}   |    ${voiced.toFixed(2)}     |   ${String(coll).padStart(3)}%`);
}

const collAll = Math.round((100 * all.filter((s) => s.collapse).length) / all.length);
console.log(`\n==== ${all.length} plans · overall collapse-rate ${collAll}% (present>=2 but voiced<=1) ====`);
// Predictors: collapse rate by cast size, and early (<=8) vs late (>8) turns.
const byPresent = {};
for (const s of all) { const k = Math.min(s.present, 5); (byPresent[k] ||= []).push(s); }
console.log("collapse by cast size:");
for (const k of Object.keys(byPresent).map(Number).sort((a, b) => a - b)) {
  const rs = byPresent[k]; console.log(`  present ${k}${k === 5 ? "+" : " "}: ${Math.round((100 * rs.filter((s) => s.collapse).length) / rs.length)}% (${rs.length} plans)`);
}
const early = all.filter((s) => s.i <= 8), late = all.filter((s) => s.i > 8);
const cr = (a) => a.length ? Math.round((100 * a.filter((s) => s.collapse).length) / a.length) : 0;
console.log(`collapse early (turn<=8) ${cr(early)}% vs late (turn>8) ${cr(late)}%`);
