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

// 2026-07-21 permission-stance test: `shipped` reconstructs the CURRENT app prompt on this pre-batch
// export (reask edits + 2.5.2 intimate speech line + voice clause) as the paired baseline; `authority`
// adds the narrative-authority clause (user theory: the model believes charged outcomes need explicit
// player permission — but engagement IS the permission; outcomes belong to the narrator); and
// `authorityVoicing` additionally removes the one shipped wording that licenses asking
// ("asking for what they want next" → "voicing").
const SHIPPED_SYS = [
  ["narrator stage of an interactive roleplay",
   "narrator stage of an interactive story"],
  // 2026-07-22 combo SHIPPED: concrete continuity line + vague ending middle removed.
  ["- Stay consistent with the world, traits, location, and the story so far.",
   "- What the story has established stays true: where everyone is, what they hold and wear, and what has been said or done carry into this turn unless the action changes them."],
  ["your reply is complete once the events have been told, ending on a concrete image, action, or line of dialogue.",
   "ending on a spoken line or concrete image that lands what this turn changed."],
  ["- When characters are present, they speak - render their actual spoken words as quoted dialogue, not a summary of what they say. Let real conversation carry the scene where it fits, rather than narrating around silent figures.",
   "- Characters speak through what they do: their actual words land as quoted dialogue woven into their movements, and the more physical the moment, the more they voice it - urging, teasing, voicing what they want next. Their words respond to what the player just said or did and carry the scene onward."],
  ["or a bracketed stage direction like [Player's turn].",
   "or a bracketed stage direction like [Player's turn]. When the player's action speaks to a character, the reply on the page is that character's own voice: their quoted sentences, answering what was asked and adding something of their own. The player's words are already spoken by the player - yours to write is the world's answer."],
];
const SHIPPED_DIRECTIVE = [[
  "reciting the notes. They are private scaffolding",
  "reciting the notes. The notes decide what happens: whatever they settle, answer, or finish this turn stays that way on the page. They are private scaffolding",
]];
const AUTHORITY_CLAUSE =
  " The world moves on its own authority. The player's action is their whole say in the turn - once it is taken, what follows is yours to decide by the world's own logic. Characters act on their own desires without waiting to be invited, and events land on the player uninvited when the world would deal them.";
FIX_SETS.shipped = { sys: SHIPPED_SYS, directive: SHIPPED_DIRECTIVE };
FIX_SETS.authority = {
  sys: [...SHIPPED_SYS, ["yours to write is the world's answer.", `yours to write is the world's answer.${AUTHORITY_CLAUSE}`]],
  directive: SHIPPED_DIRECTIVE,
};
FIX_SETS.authorityVoicing = {
  sys: [...FIX_SETS.authority.sys, ["asking for what they want next", "voicing what they want next"]],
  directive: SHIPPED_DIRECTIVE,
};
// 2026-07-21 verdict: the authority clause backfired on Cydonia (ending re-asks 2→11/18) and the
// ask→voicing swap alone carried the cloud gains — SHIPPED, so `shipped` above now includes it.
// The clause arms are kept for the record.
// Retry v2: zero player-reference (the v1 backfire hypothesis: "the player's whole say" put the
// player's say in the recency slot and fed the permission prior). Pure world-authority framing.
const AUTHORITY2 =
  " The world moves on its own authority: characters act on their own desires without waiting to be invited, and what happens this turn lands on the page as settled fact, not as an offer.";
const AUTHORITY2B =
  `${AUTHORITY2} Events arrive when the world's logic deals them - no announcement, no invitation.`;
FIX_SETS.authority2 = {
  sys: [...SHIPPED_SYS, ["yours to write is the world's answer.", `yours to write is the world's answer.${AUTHORITY2}`]],
  directive: SHIPPED_DIRECTIVE,
};
FIX_SETS.authority2b = {
  sys: [...SHIPPED_SYS, ["yours to write is the world's answer.", `yours to write is the world's answer.${AUTHORITY2B}`]],
  directive: SHIPPED_DIRECTIVE,
};
// 2026-07-21 vague-line rewrites (paired with dialogue-hold's consfix/endfix edits).
FIX_SETS.consfix = {
  sys: [...SHIPPED_SYS,
    ["- Stay consistent with the world, traits, location, and the story so far.",
     "- What the story has established stays true: where everyone is, what they hold and wear, and what has been said or done carry into this turn unless the action changes them."]],
  directive: SHIPPED_DIRECTIVE,
};
FIX_SETS.endfix = {
  sys: [...SHIPPED_SYS,
    ["your reply is complete once the events have been told, ending on a spoken line or concrete image that lands what this turn changed.",
     "tell what the player's action sets off - what the world and its characters do and say in answer - and end on a spoken line or concrete image that lands what this turn changed."]],
  directive: SHIPPED_DIRECTIVE,
};
FIX_SETS.conscut = {
  sys: [...SHIPPED_SYS,
    ["- Stay consistent with the world, traits, location, and the story so far.\n", ""]],
  directive: SHIPPED_DIRECTIVE,
};
FIX_SETS.endcut = {
  sys: [...SHIPPED_SYS,
    ["your reply is complete once the events have been told, ending on",
     "ending on"]],
  directive: SHIPPED_DIRECTIVE,
};
FIX_SETS.combo = {
  sys: [...FIX_SETS.consfix.sys,
    ["your reply is complete once the events have been told, ending on",
     "ending on"]],
  directive: SHIPPED_DIRECTIVE,
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

// --band N keeps the last N user/assistant turn pairs verbatim and replaces older assistant history with
// a fresh one-line digest (the shipped present-tense summary prompt, temp 0, cached per narration) —
// reproduces memory-digest banding on the recorded context, testing digests as the attractor mitigation.
const band = numArg("--band", 0);
const grabTpl = (src, name) => {
  const m = src.match(new RegExp(`export const ${name} = \`([\\s\\S]*?)\`;`));
  if (!m) throw new Error(`could not grab ${name} from GamePrompts.ts`);
  return m[1];
};
const promptsSrc = band ? await readFile(path.join(REPO_ROOT, "src/components/game/GamePrompts.ts"), "utf8") : "";
const SUMMARY_SYSTEM = band ? grabTpl(promptsSrc, "defaultSummaryPrompt") : "";
const SUMMARY_USER = band ? grabTpl(promptsSrc, "defaultSummaryUserPrompt") : "";
const digestCache = new Map();
async function digestOf(action, narration) {
  const key = narration;
  if (digestCache.has(key)) return digestCache.get(key);
  const user = SUMMARY_USER.replace("<PLAYER ACTION>", action).replace("<NARRATION>", narration);
  const out = (await callMessages(
    { endpoint, model, token: "", maxTokens: 200, seed, repPen: 1, temp: 0 },
    [{ role: "system", content: SUMMARY_SYSTEM }, { role: "user", content: user }],
  )).trim();
  const digest = out.toLowerCase() === "nothing notable" ? "" : out;
  digestCache.set(key, digest);
  return digest;
}
const stripAction = (u) => u.replace(/^Player action: /, "").split("\n\nRough notes on what happens this turn")[0];
async function bandHistory(messages) {
  const assistantIdx = messages.map((m, i) => (m.role === "assistant" ? i : -1)).filter((i) => i >= 0);
  const keep = new Set(assistantIdx.slice(-band));
  const out = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role !== "assistant" || keep.has(i)) { out.push(m); continue; }
    const action = i > 0 && messages[i - 1].role === "user" ? stripAction(messages[i - 1].content) : "";
    const digest = await digestOf(action, m.content);
    if (!digest) { out.pop(); continue; } // "nothing notable": drop the pair, like the app's band
    out.push({ ...m, content: digest });
  }
  return out;
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

async function armMessages(narr) {
  let base = noplan ? stripPlan(narr.messages) : narr.messages;
  if (band) base = await bandHistory(base);
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
  const messages = await armMessages(narr);
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
