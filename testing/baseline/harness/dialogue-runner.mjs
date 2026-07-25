// Dialogue-intent runner — plays the authored corpus as a real staged session (planner -> narration, context
// accumulating turn to turn) and scores:
//   MAIN (baited turns 11-15): did the ADDRESSED characters speak?
//     direct mode — every named responder must have a spoken line; a single addressed person silent = HARD FAIL.
//     group  mode — >=2 of the present cast must speak (2/3 passes).
//   GUARDRAILS (the 15 regular turns, direction-neutral): dialogue% · freeze · handback · words - must not
//     degrade while we chase the baited turns.
//
//   node dialogue-runner.mjs [--runs 5] [--window 12] [--template shipped] [--verbose]
//
// A playthrough is serial (each turn needs the prior narration); RUNS playthroughs fire concurrently (varied
// seed) and LM Studio queues past its slots. Context is windowed to --window recent turns so per-slot fits.

import { parseArgs, callMessages, runAll, grab, buildThinkingUser, QUOTE_RE, FREEZE_RE, DEFER_RE } from "./planner-probe-lib.mjs";
import { applyFix } from "./candidates/freeze-fixes.mjs";

const argv = process.argv.slice(2);
const num = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? Number(argv[i + 1]) : d; };
const strArg = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const verbose = argv.includes("--verbose");
const opts = parseArgs(process.argv);
const RUNS = num("--runs", 5);
const WINDOW = num("--window", 12);
const which = strArg("--template", "shipped");
const { WORLD, PLAYER_TRAIT, LOCATION, ENTITIES, TURNS } = await import(strArg("--corpus", "./dialogue-corpus.mjs"));

// ── Prompt fills ──
const FIX = strArg("--fix", "shipped");
const { narr: NARR, think: THINK } = applyFix(FIX, { narr: grab("defaultSystemPrompt"), think: grab("defaultThinkingPrompt") });
const entMd = ENTITIES.map((e) => `- **${e.name}** (${e.type}): ${e.description}`).join("\n");
const PLANNER_SYS = THINK
  .replaceAll("<WORLD DESCRIPTION>", WORLD)
  .replaceAll("<TRAITS DESCRIPTION|markdown>", `- **Identity:** ${PLAYER_TRAIT}`)
  .replaceAll("<LOCATION|summary.markdown>", `- **name:** ${LOCATION}`)
  .replaceAll("<LOCATION|sublocations.summary.markdown>", "N/A")
  .replaceAll("<LOCATION|reachable.summary.markdown>", "N/A")
  .replaceAll("<ENTITIES|summary.markdown>", entMd)
  .replaceAll("<ENTITIES|sublocations.summary.markdown>", "N/A")
  .replaceAll("<ENTITIES|reachable.summary.markdown>", "N/A")
  .replaceAll("<NOTES>", "None");
const NARR_SYS = NARR
  .replaceAll("<LENGTH GUIDANCE>", "Two or three short paragraphs.")
  .replaceAll("<MARKDOWN GUIDANCE>", "Write immersive, flowing prose - never a list or menu.")
  .replaceAll("<WORLD DESCRIPTION>", WORLD)
  .replaceAll("<DICTIONARY|before>", "N/A")
  .replaceAll("<STATS DESCRIPTION|descriptions.markdown>", "N/A")
  .replaceAll("<TRAITS DESCRIPTION|markdown>", `- **Identity:** ${PLAYER_TRAIT}`)
  .replaceAll("<NOTES>", "None")
  .replaceAll("<LOCATION|markdown>", `- **name:** ${LOCATION}`)
  .replaceAll("<LOCATION|sublocations.summary.markdown>", "N/A")
  .replaceAll("<LOCATION|reachable.summary.markdown>", "N/A")
  .replaceAll("<ENTITIES|markdown>", entMd)
  .replaceAll("<ENTITIES|sublocations.markdown>", "N/A")
  .replaceAll("<DICTIONARY>", "N/A");
const PREAMBLE = "Rough notes on what happens this turn (not words the player spoke) - write the scene from them as flowing second-person prose in your own words, expanding and voicing the characters' dialogue freshly rather than reciting the notes. They are private scaffolding - never repeat their labels, lists, or headings on the page.";

// ── Detection ──
// A character "spoke" if a quote is attributed to them: their name is in the quote-bearing sentence, OR (for the
// common "Nadia set down her glass. 'Oy...'" beat-then-quote form) the quote sentence names NO cast member and
// their name is in the immediately preceding sentence. The no-other-name guard avoids crediting a bystander
// named just before someone else's line ("Nadia watched. 'Yes,' Theo said.").
const ALL_NAMES = ENTITIES.map((e) => e.name);
const hasName = (s, n) => new RegExp(`\\b${n.split(/\s+/)[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(s);
const hasQuote = (s) => /"[^"]{2,}"|[“][^”]{2,}[”]/.test(s);
// Attribute quotes by tracking the most-recently-named cast member: a quoted sentence's speaker is the last
// cast name in that sentence, or (when it's just "she said") the last cast name seen before it. Handles the
// common "Sofia leans in. She murmurs. '...'" form that same-sentence matching misses.
function speakerSet(text) {
  const set = new Set(); let last = null;
  for (const s of text.split(/(?<=[.!?])\s+/)) {
    const named = ALL_NAMES.filter((n) => hasName(s, n));
    if (hasQuote(s)) { const spk = named.length ? named[named.length - 1] : last; if (spk) set.add(spk); }
    if (named.length) last = named[named.length - 1];
  }
  return set;
}
const spoke = (text, name) => speakerSet(text).has(name);
const HANDBACK_RE = /\b(waits? for (?:your|you to)|waiting for (?:you|your)|as you consider|it'?s your (?:turn|move|call)|for you to (?:respond|decide|answer)|awaiting your)\b/i;
const dialoguePct = (t) => Math.round((100 * (t.match(QUOTE_RE) || []).reduce((a, q) => a + q.length, 0)) / (t.length || 1));

// ── One playthrough (serial) ──
async function playthrough(seed) {
  const history = []; // {action, text}
  const rows = [];
  for (let i = 0; i < TURNS.length; i++) {
    const turn = TURNS[i];
    const win = history.slice(-WINDOW);
    const recap = win.map((h) => h.text).join("\n\n");
    const plan = (await callMessages({ ...opts, temp: 0.4, repPen: 1, maxTokens: 256, seed }, [
      { role: "system", content: PLANNER_SYS }, { role: "user", content: buildThinkingUser(recap, turn.action) },
    ])).trim();
    const msgs = [{ role: "system", content: NARR_SYS }];
    for (const h of win) msgs.push({ role: "user", content: h.action }, { role: "assistant", content: h.text });
    // Bare action, no "Player action:" wrapper — matches the app's message assembly (dropped 2026-07-21).
    msgs.push({ role: "user", content: `${turn.action}\n\n${PREAMBLE}\n${plan}` });
    const text = (await callMessages({ ...opts, temp: 0.7, maxTokens: 512, seed }, msgs)).trim();
    history.push({ action: turn.action, text });
    rows.push({ i, turn, text });
  }
  return rows;
}

console.log(`DIALOGUE-INTENT · corpus ${TURNS.length} turns · "${opts.model}" · fix ${FIX} · runs ${RUNS} · window ${WINDOW}\n`);
const runs = (await runAll(Array.from({ length: RUNS }, (_, r) => r), (r) => playthrough(opts.seed + r).catch((e) => { console.log(`run ${r} ERROR: ${String(e.message || e).slice(0, 80)}`); return null; }))).filter(Boolean);

// ── Score ──
const baited = [], guard = { dlg: 0, frz: 0, hb: 0, wrd: 0, n: 0 };
let pass = 0, hardFail = 0, baitN = 0;
for (const rows of runs) {
  for (const { i, turn, text } of rows) {
    if (turn.expect) {
      const e = turn.expect;
      let spkOk = true, advOk = true, detected = [];
      if (e.responders) { detected = e.responders.filter((r) => spoke(text, r)); spkOk = e.mode === "group" ? turn.present.filter((p) => spoke(text, p)).length >= 2 : detected.length === e.responders.length; }
      if (e.advance) advOk = !HANDBACK_RE.test(text.trim().slice(-220)) && !DEFER_RE.test(text); // advance = no stall/defer
      const ok = spkOk && advOk;
      const hard = e.mode === "direct" && e.responders && detected.length === 0; // addressed, wholly silent
      baitN++; if (ok) pass++; if (hard) hardFail++;
      baited.push({ i, e, detected, ok, spkOk, advOk, hard, text });
    } else {
      guard.dlg += dialoguePct(text); guard.frz += (text.match(FREEZE_RE) || []).length; guard.hb += HANDBACK_RE.test(text.trim().slice(-200)) ? 1 : 0; guard.wrd += (text.match(/\S+/g) || []).length; guard.n++;
    }
  }
}

console.log("── BAITED (main metric) ──");
console.log("turn  mode     goal                     pass     detail");
const byTurn = {};
for (const b of baited) (byTurn[b.i] ||= []).push(b);
for (const i of Object.keys(byTurn).map(Number).sort((a, b) => a - b)) {
  const bs = byTurn[i], e = bs[0].e;
  const mode = e.mode || (e.advance ? "advance" : "?");
  const goal = [e.responders ? e.responders.join("+") : null, e.advance ? "advance" : null].filter(Boolean).join(" & ");
  const okN = bs.filter((b) => b.ok).length, hardN = bs.filter((b) => b.hard).length;
  const silentN = bs.filter((b) => !b.spkOk).length, stallN = bs.filter((b) => !b.advOk).length;
  console.log(`${String(i).padStart(3)}  ${mode.padEnd(7)}  ${goal.padEnd(23)}  ${`${okN}/${bs.length}`.padEnd(7)}  ${silentN ? `${silentN} silent ` : ""}${stallN ? `${stallN} stalled ` : ""}${hardN ? `${hardN} HARD` : ""}`);
}
if (verbose) for (const b of baited) console.log(`\n[turn ${b.i} · spoke ${b.detected.join("+") || "NONE"} · ${b.ok ? "pass" : "FAIL"}${b.spkOk ? "" : " silent"}${b.advOk ? "" : " stalled"}]\n${b.text}`);

console.log(`\nMAIN: ${pass}/${baitN} baited pass (${Math.round((100 * pass) / baitN)}%) · HARD-FAILS ${hardFail}`);
console.log(`GUARDRAILS (${guard.n} regular turns): dialogue ${Math.round(guard.dlg / guard.n)}% · freeze ${(guard.frz / guard.n).toFixed(2)} · handback ${Math.round((100 * guard.hb) / guard.n)}% · words ${Math.round(guard.wrd / guard.n)}`);
