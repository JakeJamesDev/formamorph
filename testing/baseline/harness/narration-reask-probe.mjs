// NARRATION RE-ASK probe — replays a real export's PLAN-MODE narration requests and scores the re-ask loop:
// the narration ending a committed turn by questioning the player's resolve ("are you sure / tell me true /
// do you understand what I must do") instead of landing the new state. This is the stage the planner replay
// cleared: in the traced session, turn 18's plan resolved the beat and the narration re-asked anyway.
//
// Arms (per --arm, default A):
//   A  messages exactly as recorded (shipped prompt baked into the export)
//   B  the current GamePrompts.ts narration edits string-substituted into the recorded system + plan
//      directive (asserts each target substring exists, so a drifted export fails loud)
// Sampler: fixed temp (default 0.8 — narration is unpinned in-app) + seed, --reppen to co-vary.
//
// Metrics per run: reask (vetting-question hits in the LAST paragraph) · anyReask (anywhere) · quotes
// (dialogue volume guard) · freeze · words. A commit-turn re-ask is the defect; turn 13 in the traced dump
// is a legitimate-vetting control (the player hasn't answered yet) — mark such turns with --control.
//
// Usage:
//   node narration-reask-probe.mjs "D:/Downloads/stuck again.json" --from 12 --to 18 --runs 3 --arm B [--reppen 1.07] [--control 13]

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { callMessages, FREEZE_RE, QUOTE_RE } from "./planner-probe-lib.mjs";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HARNESS_DIR, "../../..");

const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith("--")) || null;
if (!file) { console.error("Provide an ai-context export path as the first argument."); process.exit(1); }
const strArg = (f, d = null) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const numArg = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? Number(argv[i + 1]) : d; };
const arm = strArg("--arm", "A").toUpperCase();
const from = numArg("--from", 0);
const to = numArg("--to", Infinity);
const runs = numArg("--runs", 3);
const temp = numArg("--temp", 0.8);
const repPen = numArg("--reppen", 1);
const seed = numArg("--seed", 7);
const controls = new Set((strArg("--control", "") || "").split(",").filter(Boolean).map(Number));
const model = strArg("--model", "cydonia-24b-v4.3@q4_k_m");
const endpoint = strArg("--endpoint", "http://127.0.0.1:1234/v1/chat/completions");
const maxTokens = numArg("--max", 600);

// The B arm's edits, selected by --fix. Each pair asserts its target exists so a drifted export or
// prompt fails loud instead of no-op'ing.
//   reask       the 2026-07-20 re-ask batch (for exports recorded on the pre-batch shipped prompt)
//   hesitation  the wavering-resolution sentence (for exports recorded WITH the re-ask batch baked in)
const FIX_SETS = {
  reask: {
    sys: [
      ["narrator stage of an interactive roleplay",
       "narrator stage of an interactive story"],
      ["ending on a concrete image, action, or line of dialogue.",
       "ending on a concrete image, action, or spoken line that lands what this turn changed."],
      ["Let real conversation carry the scene where it fits, rather than narrating around silent figures.",
       "Their words respond to what the player just said or did and carry the scene onward."],
    ],
    directive: [[
      "reciting the notes. They are private scaffolding",
      "reciting the notes. The notes decide what happens: whatever they settle, answer, or finish this turn stays that way on the page. They are private scaffolding",
    ]],
  },
  hesitation: {
    sys: [
      ["Their words respond to what the player just said or did and carry the scene onward.",
       "Their words respond to what the player just said or did and carry the scene onward. A character who wavers settles it within the turn - they give in or they pull back, and the scene follows their choice."],
    ],
    directive: [],
  },
};
const fix = FIX_SETS[strArg("--fix", "reask")];
if (!fix) { console.error("Unknown --fix (use reask | hesitation)"); process.exit(1); }
const SYS_EDITS = fix.sys;
const DIRECTIVE_EDITS = fix.directive;

function applyEdits(text, edits, label) {
  let out = text;
  for (const [find, replace] of edits) {
    if (!out.includes(find)) throw new Error(`[${label}] edit target not found (export/prompt drifted?):\n${find}`);
    out = out.replace(find, replace);
  }
  return out;
}

// --noplan strips the attached plan from the final user turn (the directive and everything after it),
// reproducing non-plan mode on the same recorded context — isolates whether a defect rides in via the plan.
const noplan = argv.includes("--noplan");
const PLAN_MARK = "\n\nRough notes on what happens this turn";
function stripPlan(messages) {
  return messages.map((m, idx) => {
    if (idx === messages.length - 1 && m.role === "user") {
      const cut = m.content.indexOf(PLAN_MARK);
      return cut >= 0 ? { ...m, content: m.content.slice(0, cut) } : m;
    }
    return m;
  });
}

// --scrub removes protest sentences from the assistant HISTORY (not the fresh response), isolating the
// history attractor: if hesitation persists against a protest-free context, it is model-baked.
const scrub = argv.includes("--scrub");
function scrubHistory(messages) {
  return messages.map((m) => {
    if (m.role !== "assistant") return m;
    const kept = m.content
      .split(/(?<=[.!?]["'”’]?)\s+/)
      .filter((s) => { HESITATE_RE.lastIndex = 0; return !HESITATE_RE.test(s); });
    return { ...m, content: kept.join(" ") };
  });
}

function armMessages(narr) {
  let base = noplan ? stripPlan(narr.messages) : narr.messages;
  if (scrub) base = scrubHistory(base);
  if (arm !== "B") return base;
  return base.map((m, idx) => {
    if (idx === 0 && m.role === "system") return { ...m, content: applyEdits(m.content, SYS_EDITS, "system") };
    if (DIRECTIVE_EDITS.length && idx === narr.messages.length - 1 && m.role === "user" && m.content.includes("Rough notes on what happens this turn")) {
      return { ...m, content: applyEdits(m.content, DIRECTIVE_EDITS, "directive") };
    }
    return m;
  });
}

// Vetting-question detector: a quoted question probing the player's resolve/readiness after they've spoken.
const REASK_RE = /(are you (?:sure|certain|ready)|tell me true|do you (?:still )?(?:wish|want)|do you understand|is this (?:truly |really )?what you|are you prepared|you(?:'re| are) sure)/gi;
// Verbal-hesitation detector: a character deferring resolution via protest while the scene continues.
const HESITATE_RE = /\b(I can'?t|we can'?t|I shouldn'?t|we shouldn'?t|I mustn'?t|(?:have|need|ought) to stop|we should stop|this is wrong)\b/gi;
const lastPara = (s) => s.trim().split(/\n\s*\n/).filter(Boolean).at(-1) ?? "";

const turns = JSON.parse(await readFile(path.resolve(file), "utf8"));
console.log(`NARRATION RE-ASK · ${file} · arm ${arm} · temp ${temp} · reppen ${repPen} · ${runs} run(s)/turn\n`);
console.log("turn  reask(end)  reask(any)  hesit  quotes  freeze  words   action");

const agg = { runs: 0, endReask: 0, anyReask: 0, hesit: 0, quotes: 0, freeze: 0, ctrlRuns: 0, ctrlReask: 0, ctrlHesit: 0 };
for (let i = 0; i < turns.length; i++) {
  if (i < from || i > to) continue;
  const narr = turns[i].requests?.find((r) => r.type === "narration");
  if (!narr) continue;
  const messages = armMessages(narr);
  const ctrl = controls.has(i);
  let e = 0, a = 0, h = 0, q = 0, f = 0, w = 0;
  for (let r = 0; r < runs; r++) {
    const out = await callMessages({ endpoint, model, token: "", maxTokens, seed: seed + r, repPen, temp }, messages);
    const end = (lastPara(out).match(REASK_RE) || []).length;
    const any = (out.match(REASK_RE) || []).length;
    const hes = (out.match(HESITATE_RE) || []).length;
    e += end; a += any; h += hes;
    q += (out.match(QUOTE_RE) || []).length;
    f += (out.match(FREEZE_RE) || []).length;
    w += out.split(/\s+/).length;
    if (ctrl) { agg.ctrlRuns++; agg.ctrlReask += any ? 1 : 0; agg.ctrlHesit += hes; }
    else { agg.runs++; agg.endReask += end; agg.anyReask += any; agg.hesit += hes; }
  }
  if (!ctrl) { agg.quotes += q; agg.freeze += f; }
  const act = (turns[i].action || "").slice(0, 46);
  console.log(` ${String(i).padStart(2)}     ${e}/${runs * 1}${ctrl ? "*" : " "}       ${a}       ${(h / runs).toFixed(1)}    ${(q / runs).toFixed(1)}    ${(f / runs).toFixed(1)}    ${(w / runs).toFixed(0)}   ${act}`);
}
console.log(`\n==== arm ${arm} · reppen ${repPen} ====`);
console.log(`commit-turn re-asks: ending ${agg.endReask} · anywhere ${agg.anyReask} (over ${agg.runs} runs) · hesitation/run ${(agg.hesit / Math.max(1, agg.runs)).toFixed(1)} · quotes/run ${(agg.quotes / Math.max(1, agg.runs)).toFixed(1)} · freeze/run ${(agg.freeze / Math.max(1, agg.runs)).toFixed(1)}`);
if (agg.ctrlRuns) console.log(`control turns (pausing legitimate): re-ask in ${agg.ctrlReask}/${agg.ctrlRuns} runs · hesitation/run ${(agg.ctrlHesit / Math.max(1, agg.ctrlRuns)).toFixed(1)} (should stay > 0 — a stop must survive)`);
