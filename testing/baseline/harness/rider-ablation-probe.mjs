// RIDER ABLATION — does the narration prompt's behavioral rider block still earn its place over a LONG
// session, or does it decay (or backfire) as history accumulates?
//
// Origin: a real 12-turn session (testing/real-sessions/session.json, 2026-07-29) played with the riders,
// the closing output contract, and the user-slot voice rider all removed showed no more echo/re-ask than
// shipped-prompt sessions, and read no worse. The riders were each validated by single-turn probes, never
// by deep play — this probe closes that gap.
//
// Arms replay the SAME frozen action script (charged-long-corpus.mjs), so the prompt is the only variable:
//   shipped     GamePrompts.ts as it ships
//   stripped    the real session's shape: role intro trimmed, 8 riders cut, closing contract cut, no voice rider
//   drop:<name> leave-one-out for a single rider (continuity|brackets|stats|advance|speech|names|pcFeatures|noTabulate)
//
// Metrics per turn, reported per 10-turn bucket so decay-with-depth is visible:
//   echoAct   share of the player action's content words parroted back in the narration's first sentence
//   echoPrev  8-grams shared with the immediately preceding narration (self-repetition)
//   echoAny   8-grams shared with any earlier narration in the window
//   reask     resolve-vetting question in the closing paragraph  ·  defer  handback/"are you sure" ending
//   quotes    quoted spans per turn  ·  dlg%  share of characters inside quotes
//   freeze    stall-motif hits  ·  pcTic  re-describing the PC's fixed features  ·  words
//
// History is windowed (--window, default 10 turn pairs) because both test targets are ~11-12k context: the
// app bands memory the same way, and the window is identical across arms.
//
//   node rider-ablation-probe.mjs --arm shipped --runs 3
//     [--endpoint https://api.lyonade.net/v1/chat/completions --model default]
//     [--corpus ./charged-long-corpus.mjs] [--turns 40] [--window 10] [--seed 7] [--out run.json]

import { writeFile } from "node:fs/promises";
import { callMessages, grab, runAll, FREEZE_RE, QUOTE_RE, DEFER_RE } from "./planner-probe-lib.mjs";
import { applyArm, renderNarrationSys, VOICE_RIDER } from "./rider-arms.mjs";

const argv = process.argv.slice(2);
const str = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const num = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? Number(argv[i + 1]) : d; };

const ARM = str("--arm", "shipped");
const RUNS = num("--runs", 3);
const WINDOW = num("--window", 10);
const SEED = num("--seed", 7);
const BUCKET = num("--bucket", 10);
const OUT = str("--out", null);
const opts = {
  endpoint: str("--endpoint", "https://api.lyonade.net/v1/chat/completions"),
  model: str("--model", "default"),
  token: str("--token", process.env.PROBE_TOKEN || ""),
};

const corpus = await import(str("--corpus", "./charged-long-corpus.mjs"));
const SCRIPT = corpus.TURNS.slice(0, num("--turns", corpus.TURNS.length)).map((t) => t.action);
const PC_TIC_RE = corpus.PC_TIC_RE ?? /(?!x)x/g;

const { sys: ARM_SYS, voiceRider } = applyArm(grab("defaultSystemPrompt"), ARM);
const NARR_SYS = renderNarrationSys(ARM_SYS, corpus, { markdown: grab("MARKDOWN_ON") });
const OPENING_CUE = grab("OPENING_SCENE_CUE");

// ── Metrics ──
const STOP = new Set("i a an and the to my me of in on at with for as it is was be you your her his their them that this so into onto but or if then".split(" "));
const content = (s) => s.toLowerCase().match(/[a-z']{3,}/g)?.filter((w) => !STOP.has(w)) ?? [];
const firstSentence = (s) => s.trim().split(/(?<=[.!?])\s+/)[0] ?? "";
const lastPara = (s) => s.trim().split(/\n\s*\n/).filter(Boolean).at(-1) ?? "";

function ngrams(text, n = 8) {
  const w = content(text);
  const out = new Set();
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(" "));
  return out;
}
const shared = (a, b) => { let n = 0; for (const g of a) if (b.has(g)) n++; return n; };

// Parroting the action back: what share of the action's content words open the narration.
function echoAction(action, text) {
  const want = new Set(content(action));
  if (!want.size) return 0;
  const got = new Set(content(firstSentence(text)));
  let hit = 0;
  for (const w of want) if (got.has(w)) hit++;
  return hit / want.size;
}

const REASK_RE = /(are you (?:sure|certain|ready)|tell me true|do you (?:still )?(?:wish|want)|do you understand|is this (?:truly |really )?what you|are you prepared|you(?:'re| are) sure)/gi;
const HANDBACK_RE = /\b(waits? for (?:your|you to)|waiting for (?:you|your)|as you consider|it'?s your (?:turn|move|call)|for you to (?:respond|decide|answer)|awaiting your)\b/i;
const dialoguePct = (t) => Math.round((100 * (t.match(QUOTE_RE) || []).reduce((a, q) => a + q.length, 0)) / (t.length || 1));

function score(action, text, prior) {
  const g = ngrams(text);
  const prev = prior.at(-1);
  const end = lastPara(text);
  return {
    echoAct: echoAction(action, text),
    echoPrev: prev ? shared(g, prev) : 0,
    echoAny: prior.reduce((m, p) => Math.max(m, shared(g, p)), 0),
    reask: (end.match(REASK_RE) || []).length,
    defer: DEFER_RE.test(end) ? 1 : 0,
    handback: HANDBACK_RE.test(end) ? 1 : 0,
    quotes: (text.match(QUOTE_RE) || []).length,
    dlg: dialoguePct(text),
    freeze: (text.match(FREEZE_RE) || []).length,
    pcTic: (text.match(PC_TIC_RE) || []).length,
    words: (text.match(/\S+/g) || []).length,
    grams: g,
  };
}

// ── One playthrough: opening cue, then the frozen script, history windowed ──
async function playthrough(seed) {
  const history = [];  // {action, text}
  const priorGrams = [];
  const rows = [];
  for (let i = 0; i <= SCRIPT.length; i++) {
    const win = history.slice(-WINDOW);
    const msgs = [{ role: "system", content: NARR_SYS }];
    for (const h of win) msgs.push({ role: "user", content: h.action }, { role: "assistant", content: h.text });
    const action = i === 0 ? null : SCRIPT[i - 1];
    // History always stores the bare action; the voice rider rides only the live turn (as the app does).
    msgs.push({ role: "user", content: i === 0 ? OPENING_CUE : voiceRider ? `${action}\n\n${VOICE_RIDER}` : action });

    // Narration is unpinned in-app; temp 0.8 matches the other narration probes.
    const text = (await callMessages({ ...opts, maxTokens: 600, seed, temp: 0.8, repPen: 1 }, msgs)).trim();
    history.push({ action: i === 0 ? "START GAME" : action, text });
    if (i > 0) {
      const s = score(action, text, priorGrams);
      priorGrams.push(s.grams);
      delete s.grams;
      rows.push({ turn: i, action, text, ...s });
    } else priorGrams.push(ngrams(text));
  }
  return rows;
}

console.log(`RIDER ABLATION · arm ${ARM} · "${opts.model}" · ${SCRIPT.length} turns · ${RUNS} run(s) · window ${WINDOW}\n`);
// LM Studio splits its loaded context across concurrent slots, so parallel playthroughs against a local
// model overflow where one at a time fits — --serial trades wall-clock for the full window per request.
const attempt = (r) => playthrough(SEED + r).catch((e) => { console.log(`run ${r} ERROR: ${String(e.message || e).slice(0, 120)}`); return null; });
const results = [];
if (argv.includes("--serial")) { for (let r = 0; r < RUNS; r++) results.push(await attempt(r)); }
else results.push(...(await runAll(Array.from({ length: RUNS }, (_, r) => r), attempt)));
const runs = results.filter(Boolean);
if (!runs.length) { console.error("all runs failed"); process.exit(1); }

// ── Aggregate per bucket ──
const KEYS = ["echoAct", "echoPrev", "echoAny", "reask", "defer", "handback", "quotes", "dlg", "freeze", "pcTic", "words"];
const blank = () => Object.fromEntries([...KEYS.map((k) => [k, 0]), ["n", 0]]);
const buckets = new Map();
const overall = blank();
for (const rows of runs) {
  for (const row of rows) {
    const b = Math.floor((row.turn - 1) / BUCKET);
    if (!buckets.has(b)) buckets.set(b, blank());
    for (const t of [buckets.get(b), overall]) { for (const k of KEYS) t[k] += row[k]; t.n++; }
  }
}
const fmt = (t) => [
  (t.echoAct / t.n).toFixed(2), (t.echoPrev / t.n).toFixed(2), (t.echoAny / t.n).toFixed(2),
  (t.reask / t.n).toFixed(2), (t.defer / t.n).toFixed(2), (t.handback / t.n).toFixed(2),
  (t.quotes / t.n).toFixed(1), Math.round(t.dlg / t.n), (t.freeze / t.n).toFixed(2),
  (t.pcTic / t.n).toFixed(2), Math.round(t.words / t.n),
];
const HEAD = ["echoAct", "echoPrev", "echoAny", "reask", "defer", "handbk", "quotes", "dlg%", "freeze", "pcTic", "words"];
console.log(`turns    ${HEAD.map((h) => h.padStart(8)).join("")}`);
for (const b of [...buckets.keys()].sort((x, y) => x - y)) {
  const label = `${b * BUCKET + 1}-${(b + 1) * BUCKET}`;
  console.log(`${label.padEnd(9)}${fmt(buckets.get(b)).map((v) => String(v).padStart(8)).join("")}`);
}
console.log(`${"ALL".padEnd(9)}${fmt(overall).map((v) => String(v).padStart(8)).join("")}`);
console.log(`\n==== arm ${ARM} · ${runs.length} run(s) × ${SCRIPT.length} turns ====`);

if (OUT) {
  await writeFile(OUT, JSON.stringify({ arm: ARM, model: opts.model, window: WINDOW, seed: SEED, runs }, null, 2), "utf8");
  console.log(`wrote ${OUT}`);
}
