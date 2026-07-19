// NARRATION BAND-FORMAT probe — A/B the CONTEXT STRUCTURE fed to the narrator, on real accumulated context.
//
// Why this exists: both live failures (dialogue goes quiet "after a while"; the scene won't advance) are
// context-driven, not prompt-wording — the wording changes kept failing. The context's STRUCTURE was never
// tested. In-game the narrator gets banded history as turn-by-turn user/assistant PAIRS, and the older (band)
// turns ride in the ASSISTANT slot as terse, dialogue-free summaries ("You asked Sarah... she agreed..."). So
// the model's own recent "examples of how I narrate" are increasingly dialogue-free summaries — direct
// register pressure toward the measured decay. The planner instead gets one "Earlier events:" block.
//
// This probe replays a real export's narration turns under two band formats and scores both:
//   turnwise  — the recorded messages AS-IS (current behavior).
//   block     — collapse all but the most-recent `--floor` full turns into one "Earlier events:" system block,
//               so the ONLY assistant messages left are full narration (with dialogue), never summaries.
//
// We do NOT test optimistically: every condition is scored on GOAL metrics AND known-good GUARDRAILS, off the
// SAME generations. A format only "wins" if goal-up AND every guardrail within noise.
//   GOAL:      dialogueShare (quoted chars / narration chars) · speakers (distinct characters given a line) ·
//              handback (scene ends handing the decision back / stalling on "gradual means")
//   GUARDRAIL: freeze (register) · length (not ballooning) · [--deep] factRetention (memory fidelity)
//
//   node narration-format-probe.mjs "D:/Downloads/stalled.json" --format both --runs 3 [--floor 3] [--from 6] [--deep] [--verbose]

import { readFileSync } from "node:fs";
import { parseArgs, callMessages, runAll, grab, QUOTE_RE, FREEZE_RE } from "./planner-probe-lib.mjs";

const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith("--"));
if (!file) { console.error("Provide an ai-context export path as the first arg."); process.exit(1); }
const flag = (f) => argv.includes(f);
const strArg = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const numArg = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? Number(argv[i + 1]) : d; };
const opts = parseArgs(process.argv);
const format = strArg("--format", "both");      // turnwise | block | both
const RUNS = Math.max(1, numArg("--runs", 3));
const FLOOR = numArg("--floor", 3);              // recent full turns kept as real pairs in `block`
const TEMP = numArg("--temp", 0.7);              // narration is unpinned in-game
const from = numArg("--from", 0);
const to = numArg("--to", Infinity);
const deep = flag("--deep");
const verbose = flag("--verbose");

const raw = JSON.parse(readFileSync(file, "utf8"));
const turns = Array.isArray(raw) ? raw : Object.values(raw);
const nreq = (t) => t.requests?.find((r) => r.type === "narration");

// Distinct characters actually given a spoken line: a capitalized name adjacent to a say-verb near a quote.
const SAY = "(?:says?|said|adds?|replies|replied|murmurs?|whispers?|asks?|asked|continues?|offers?|breathes?|answers?|tells?|calls?)";
function speakers(text) {
  const names = new Set();
  const re = new RegExp(`\\b([A-Z][a-z]{2,})\\b\\s+${SAY}|${SAY}\\s+([A-Z][a-z]{2,})\\b`, "g");
  for (const m of text.matchAll(re)) { const nm = m[1] || m[2]; if (nm && !/^(You|The|Her|His|Their|Its|She|And|But|That|This)$/.test(nm)) names.add(nm); }
  // Player speaking counts too: a quote in a "you say/tell" clause.
  if (/\byou\s+(?:say|said|tell|add|reply|whisper|murmur|ask)\b/i.test(text)) names.add("you");
  return names.size;
}
// Semantic stall: the passage ENDS handing the decision back or leaning on the "go slow" stall.
const HANDBACK_RE = /\b(waits? for (?:your|you to)|waiting for (?:you|your)|as you consider|it'?s your (?:turn|move|call|decision)|for you to (?:respond|decide|answer)|awaiting your|gradual (?:means|approach|trust)|build(?:ing)? trust (?:slowly|gradually|first)|take (?:it|things) slow|prefers? (?:to )?(?:go slow|gradual))\b/i;
const handback = (text) => HANDBACK_RE.test(text.trim().slice(-220));

function scoreNarr(text) {
  const len = text.length || 1;
  const qChars = (text.match(QUOTE_RE) || []).reduce((a, q) => a + q.length, 0);
  return {
    dialogueShare: Math.round((100 * qChars) / len),
    speakers: speakers(text),
    handback: handback(text) ? 1 : 0,
    freeze: (text.match(FREEZE_RE) || []).length,
    words: (text.match(/\S+/g) || []).length,
  };
}

// BLOCK transform: keep [system] + the last FLOOR user/assistant pairs verbatim; fold every earlier assistant
// (the band summaries) into an "Earlier events:" block appended to the system message. The current template's
// data ends right before "Respond"/"Output only" — insert the recap just before that tail if present, else end.
function toBlock(messages) {
  const sys = messages[0];
  const pairs = [];
  for (let i = 1; i < messages.length - 1; i += 2) pairs.push([messages[i], messages[i + 1]]);
  const trailingUser = (messages.length - 1) % 2 === 1 ? messages[messages.length - 1] : null;
  const floor = pairs.slice(-FLOOR);
  const older = pairs.slice(0, Math.max(0, pairs.length - FLOOR));
  const recap = older.map(([u, a]) => `- ${(u.content || "").replace(/\s+/g, " ").trim()} => ${(a.content || "").replace(/\s+/g, " ").trim()}`).join("\n");
  let sysContent = sys.content;
  if (recap) {
    const block = `\n\n## Earlier events (older turns, condensed)\n${recap}`;
    const marker = sysContent.search(/\n(?:Output only|Respond in exactly)/);
    sysContent = marker >= 0 ? sysContent.slice(0, marker) + block + sysContent.slice(marker) : sysContent + block;
  }
  const out = [{ ...sys, content: sysContent }];
  for (const [u, a] of floor) out.push(u, a);
  if (trailingUser) out.push(trailingUser);
  return out;
}

// Fact guardrail. Two modes (--factmode):
//   recorded     — [state] facts from THIS turn's recorded narration; judged as "still stated". Penalizes any
//                  plan divergence (breaking the recorded stall scores as a lost fact) — the biased original.
//   carryforward — [state] facts from the PRIOR turn (the durable state entering this turn); judged as "not
//                  CONTRADICTED" (a fact simply not mentioned is fine). Measures real memory fidelity — does the
//                  fresh narration violate established state — blind to which beats the turn chooses. (default)
const EXTRACT_SYS = `You extract the durable facts a passage of a story establishes, for a memory system. List 3 to 6 concrete, checkable [state] facts (a decision, admission, revealed trait, position, relationship shift, object, or commitment) - most important first, only what the passage explicitly states. Format each line: [state] <fact>. Nothing else.`;
const JUDGE_RECORDED = `You check whether a passage preserves a list of facts. It preserves a fact if it conveys the same thing, explicitly or by clear implication - same words not required. For each numbered fact reply on its own line "<n>: yes" or "<n>: no". Only those lines.`;
const JUDGE_CARRYFWD = `You check whether a story passage stays CONSISTENT with a list of previously-established facts. A fact is preserved (yes) unless the passage CONTRADICTS it - states or clearly implies something that cannot both be true. A fact the passage simply does not mention is still preserved (yes); only an actual contradiction is "no". For each numbered fact reply on its own line "<n>: yes" or "<n>: no". Only those lines.`;
const factMode = strArg("--factmode", "carryforward");
const JUDGE_SYS = factMode === "recorded" ? JUDGE_RECORDED : JUDGE_CARRYFWD;
// Retry transient failures (LM Studio occasionally 500s a request under heavy concurrency) so one bad call
// doesn't abort the whole batch; give up after `tries` and let the caller treat it as empty.
async function withRetry(fn, tries = 3) {
  let last;
  for (let k = 0; k < tries; k++) {
    try { return await fn(); }
    catch (e) {
      last = e;
      // Context overflow / 4xx are deterministic — retrying just wastes time. Only retry transient errors.
      if (/Context size|HTTP 4\d\d/.test(String(e.message || e))) break;
      await new Promise((r) => setTimeout(r, 400 * (k + 1)));
    }
  }
  throw last;
}
async function extractFacts(text) {
  const out = await withRetry(() => callMessages({ ...opts, temp: 0, maxTokens: 240 }, [{ role: "system", content: EXTRACT_SYS }, { role: "user", content: text }]));
  return out.split("\n").map((l) => l.replace(/^\[state\]\s*/i, "").trim()).filter((l) => l && !/^\[/.test(l));
}
async function judgeFacts(facts, text) {
  if (!facts.length) return { kept: 0, n: 0 };
  const list = facts.map((f, i) => `${i + 1}. ${f}`).join("\n");
  const out = await callMessages({ ...opts, temp: 0, maxTokens: 200 }, [{ role: "system", content: JUDGE_SYS }, { role: "user", content: `Facts:\n${list}\n\nPassage:\n${text}` }]);
  let kept = 0; for (const m of out.matchAll(/(\d+)\s*:\s*(yes|no)/gi)) if (/yes/i.test(m[2])) kept++;
  return { kept, n: facts.length };
}

// ── cast-plan condition: re-fire the PLANNER with the casting candidate, splice its fresh plan into the
// narration's final user message (staged mode feeds the plan there). Isolates the plan change; narration is
// freshly generated for both conditions so it's apples-to-apples. Candidate = shipped planner + 2 edits. ──
const THINK = grab("defaultThinkingPrompt");
const CAND = (() => {
  const e1from = "the words the present characters actually speak aloud>";
  const e1to = "a spoken line from each present character who is engaged, so the scene is carried by their voices>";
  const e2from = "their grounded physical reactions and the words they speak aloud, in quotation marks, consistent with the Cast above. Characters present keep speaking as the scene continues; don't reduce them to silent motion.";
  const e2to = "their grounded physical reactions and, in quotation marks, the words they speak aloud, consistent with the Cast above. When more than one character is present and engaged, give each of them a spoken line of their own this turn, in their own voice - the scene runs on several people talking, not narration around one speaker. End the Beats on something happening - a character's action or line that carries the scene forward on its own momentum.";
  let c = THINK;
  for (const [f, t] of [[e1from, e1to], [e2from, e2to]]) {
    if (!c.includes(f)) throw new Error(`cast-plan candidate: edit target not found (prompt drifted?):\n${f}`);
    c = c.replace(f, t);
  }
  return c;
})();
function rerenderPlanner(recordedSys, tmpl) {
  const START = "## Game World", END = "Respond in exactly this format:";
  const data = recordedSys.slice(recordedSys.indexOf(START), recordedSys.indexOf(END)).trimEnd();
  return tmpl.slice(0, tmpl.indexOf(START)) + data + "\n\n" + tmpl.slice(tmpl.indexOf(END));
}
// Re-plan with `tmpl` (CAND = casting candidate; THINK = shipped control), splice into the narration message.
async function replanMessages(i, seed, tmpl) {
  const th = turns[i].requests.find((r) => r.type === "thinking");
  const nrec = nreq(turns[i]);
  if (!th?.messages || !nrec?.messages) return nrec?.messages || null;
  const planMsgs = th.messages.map((m) => (m.role === "system" ? { ...m, content: rerenderPlanner(m.content, tmpl) } : m));
  const plan = (await withRetry(() => callMessages({ ...opts, temp: 0.4, repPen: 1, maxTokens: 256, seed }, planMsgs))).trim();
  const nmsgs = nrec.messages.map((m) => ({ ...m }));
  for (let k = nmsgs.length - 1; k >= 0; k--) {
    if (nmsgs[k].role !== "user") continue;
    const at = nmsgs[k].content.indexOf("\nScene:");           // keep the "Rough notes" preamble, swap the plan
    if (at >= 0) nmsgs[k].content = nmsgs[k].content.slice(0, at + 1) + plan;
    break;
  }
  return nmsgs;
}

const CONDS = format === "both" ? ["turnwise", "block"] : format.split(",");
console.log(`NARRATION BAND-FORMAT · ${file} · "${opts.model}"`);
console.log(`conditions: ${CONDS.join(" vs ")} · runs ${RUNS} · floor ${FLOOR} · temp ${TEMP}${deep ? ` · deep(fact:${factMode})` : ""}\n`);

const acc = Object.fromEntries(CONDS.map((c) => [c, { dlg: 0, spk: 0, hb: 0, frz: 0, wrd: 0, kept: 0, factN: 0, n: 0 }]));
const t0 = Date.now();

// Collect the turns in range, pre-extracting their ground-truth facts concurrently (deep only).
const idxs = [];
for (let i = from; i <= Math.min(to, turns.length - 1); i++) if (nreq(turns[i])?.messages) idxs.push(i);
const factsByTurn = {};
// carryforward sources facts from the PRIOR turn's narration (state entering this turn); recorded from this turn.
const factSource = (i) => factMode === "recorded" ? (nreq(turns[i])?.response || "") : (nreq(turns[i - 1])?.response || "");
if (deep) await runAll(idxs, async (i) => { try { factsByTurn[i] = await extractFacts(factSource(i)); } catch { factsByTurn[i] = []; } });

// Flatten every (turn × condition × run) generation into ONE concurrent batch — LM Studio queues past its slots.
const jobs = [];
for (const i of idxs) for (const cond of CONDS) for (let run = 0; run < RUNS; run++) jobs.push({ i, cond, run });
const results = await runAll(jobs, async ({ i, cond, run }) => {
  let messages;
  try {
    messages = cond === "block" ? toBlock(nreq(turns[i]).messages)
      : cond === "castplan" ? await replanMessages(i, opts.seed + run, CAND)
      : cond === "shipreplan" ? await replanMessages(i, opts.seed + run, THINK)
      : nreq(turns[i]).messages;
  } catch (e) { console.log(`${i} ${cond} r${run} PLAN ERROR: ${String(e.message || e)}`); messages = nreq(turns[i]).messages; }
  let text = "";
  try { text = await withRetry(() => callMessages({ ...opts, temp: TEMP, maxTokens: 512, seed: opts.seed + run }, messages)); }
  catch (e) { console.log(`${i} ${cond} r${run} ERROR: ${String(e.message || e)}`); }
  const sc = scoreNarr(text);
  // Judge fact retention against THIS turn's ground truth (the generation must be scored, so this chains).
  if (deep && factsByTurn[i]?.length && text) { const j = await withRetry(() => judgeFacts(factsByTurn[i], text)).catch(() => ({ kept: 0, n: 0 })); sc.kept = j.kept; sc.factN = j.n; }
  else { sc.kept = 0; sc.factN = 0; }
  if (verbose) console.log(`   [${i} ${cond} r${run}] dlg ${sc.dialogueShare}% spk ${sc.speakers} hb ${sc.handback} | ${text.replace(/\s+/g, " ").slice(0, 120)}`);
  return { i, cond, sc };
});

// Aggregate + per-turn table (means over runs, per condition).
const perTurn = {}; // `${i}|${cond}` -> summed sc
for (const { i, cond, sc } of results) {
  const a = acc[cond];
  a.dlg += sc.dialogueShare; a.spk += sc.speakers; a.hb += sc.handback; a.frz += sc.freeze; a.wrd += sc.words; a.kept += sc.kept; a.factN += sc.factN; a.n += 1;
  const k = `${i}|${cond}`; const p = perTurn[k] || (perTurn[k] = { dlg: 0, spk: 0, hb: 0 });
  p.dlg += sc.dialogueShare; p.spk += sc.speakers; p.hb += sc.handback;
}
for (const i of idxs) {
  const line = [String(i).padStart(3)];
  for (const cond of CONDS) { const p = perTurn[`${i}|${cond}`]; line.push(`${cond[0]}: dlg ${Math.round(p.dlg / RUNS)}% spk ${(p.spk / RUNS).toFixed(1)} hb ${p.hb}/${RUNS}`); }
  console.log(line.join("  |  "));
}

console.log(`\n==== summary (${((Date.now() - t0) / 60000).toFixed(1)} min) ====`);
console.log("cond      dialogue%  speakers  handback  freeze  words" + (deep ? "  factRet%" : ""));
for (const cond of CONDS) {
  const a = acc[cond], n = a.n || 1;
  const fr = a.factN ? `${Math.round((100 * a.kept) / a.factN)}%` : "—";
  console.log(`${cond.padEnd(9)} ${String(Math.round(a.dlg / n)).padStart(7)}%  ${(a.spk / n).toFixed(2).padStart(7)}  ${String(Math.round((100 * a.hb) / n)).padStart(7)}%  ${(a.frz / n).toFixed(2).padStart(6)}  ${String(Math.round(a.wrd / n)).padStart(5)}${deep ? `  ${fr.padStart(7)}` : ""}`);
}
console.log(`\nGOAL: dialogue% & speakers UP, handback DOWN.  GUARDRAIL: freeze flat, factRet% flat (a format that lifts dialogue but drops facts is a silent regression).`);
