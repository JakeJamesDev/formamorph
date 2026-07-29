// Monologue probe — the NPC-ramble gate (the inverse of dialogue-hold-probe.mjs).
//
// dialogue-hold asks "does an NPC speak at all?" — the failure it guards is silence. This probe asks the
// opposite question, on the failure players actually report: when the turn has room to run long, the
// narrator has exactly one legal way to fill it. The player's action, speech, and decisions are forbidden
// subjects in every prompt in the chain (system prompt closing contract, defaultThinkingPrompt, the beats
// and character passes), so "longer" resolves to "the NPC keeps talking" — one character holding the floor
// for paragraphs, turn after turn, with no room left for the player's half of the scene.
//
// Corpus: dialogue-corpus.mjs — a 20-turn sequential housewarming session, 15 regular turns (where a
// ramble is unprompted and therefore measurable) + 5 baited turns carrying `expect` (where dialogue is
// CORRECT and serves as the false-positive guard: a fix that cures rambling by muting everyone fails here).
// Sequential and accumulating, because the reported failure is late-session, not first-turn.
//
// Metrics per turn — RAMBLE axis (want down) / GUARD axis (must not move):
//   acts        distinct NPC speech acts (quote runs separated by >=SPLIT chars of prose)
//   longestAct  sentences in the largest single act — the monologue block itself
//   topShare    share of the turn's NPC sentences spoken by its most talkative character (floor hogging)
//   dlgMass     chars inside NPC quotes / total narration chars — lever 2's direct target: does a longer
//               turn buy world, or just more mouth?
//   floorRun    (cross-turn) longest streak of consecutive turns with the SAME top speaker — "the NPC
//               rambles to themselves over and over"
//   endsAsk     turn ends on a question aimed at the player — lever 1's target: stop on the handoff
//   part        GUARD. The dialogue-hold bar (>=2 NPC quoted sentences, judged engaging on baited turns).
//               Scored on `expect` turns only. This is the regression that a ramble fix is most likely
//               to cause, so a RAMBLE win with a PART loss is a FAIL, not a trade.
//
// Arms (--edit): none (shipped) · stopfirst (lever 1, the stop-on-handoff contract) · fillelse (lever 2,
// give length somewhere to go that isn't speech) · combo. Baseline `none` is static — run it once per
// batch alongside the variants so the cloud's between-batch mood drift is common to both arms.
//
//   node monologue-probe.mjs [--edit none,combo] [--runs 6] [--model gemma4-e4b-cloud]
//                            [--paras 8] [--turns 20] [--reppen 1.1] [--serial] [--nojudge] [--verbose]
//
// --paras IS the experimental condition: 8 = the long-turn setting the failure lives at, 4 = the control.
// max_tokens is derived from it with the app's real budget (src/lib/outputLength.ts), not guessed.
//
// LM Studio REQUIRES --serial: it divides the loaded context length across concurrent request slots, so
// parallel chains at this max_tokens fail on turn 0 with "Context size has been exceeded".

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { grab, QUOTE_RE } from "./planner-probe-lib.mjs";
import { WORLD, PLAYER_TRAIT, LOCATION, ENTITIES, TURNS } from "./dialogue-corpus.mjs";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const num = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? Number(argv[i + 1]) : d; };
const strArg = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const verbose = argv.includes("--verbose");
const RUNS = num("--runs", 6);
const NTURNS = num("--turns", TURNS.length);
// Sessions longer than the corpus cycle it, but only past the arrival block — the first turns knock at
// the door and gather the cast, and replaying those resets the scene instead of extending it.
const ARRIVAL = 5;
const SESSION = Array.from({ length: NTURNS }, (_, i) =>
  (i < TURNS.length ? TURNS[i] : TURNS[ARRIVAL + ((i - TURNS.length) % (TURNS.length - ARRIVAL))]));
const PARAS = num("--paras", 8);
const JUDGE = !argv.includes("--nojudge");
const SERIAL = argv.includes("--serial");
const MODEL_LABEL = strArg("--model", "gemma4-e4b-cloud");
const SEED = num("--seed", 0);
const REPPEN = argv.includes("--reppen") ? num("--reppen", 1.1) : undefined;
// Prose gap that separates two speech acts: shorter than this and the quotes read as one utterance.
const SPLIT = num("--split", 120);
const STORY_CAP = num("--cap", 24000);

// The app's own paragraph budget (AVG_TOKENS_PER_PARAGRAPH 65 / HEADROOM 0.8), inverted: the max_tokens
// that yields exactly PARAS paragraphs of guidance, so the cap and the directive can never disagree.
const MAX_TOKENS = Math.ceil((PARAS * 65) / 0.8);
const LENGTH_GUIDANCE = PARAS <= 1 ? "Write a single paragraph." : `Write at most ${PARAS} short paragraphs.`;

const profiles = JSON.parse(await readFile(path.join(HARNESS_DIR, "profiles.json"), "utf8"));
const modelCfg = profiles.models.find((m) => m.label === MODEL_LABEL);
if (!modelCfg) throw new Error(`model label '${MODEL_LABEL}' not in profiles.json`);
const ENDPOINT = modelCfg.endpointUrl ?? profiles.endpointUrl;
const MODEL = modelCfg.modelName ?? MODEL_LABEL;
const TOKEN = modelCfg.apiToken ?? profiles.apiToken ?? "";

// ── Shipped prompts, corpus-filled ──
const entMd = ENTITIES.map((e) => `- **${e.name}** (${e.type}): ${e.description}`).join("\n");
const CAST = ENTITIES.map((e) => e.name);
const SYSTEM = grab("defaultSystemPrompt")
  .replaceAll("<LENGTH GUIDANCE>", LENGTH_GUIDANCE)
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
  .replaceAll("<ENTITIES|reachable.summary.markdown>", "N/A")
  .replaceAll("<DICTIONARY>", "N/A");
const NARRATION_USER = grab("defaultNarrationUserPrompt");

// ── Candidate edits ──
const STOP_MARKER = "- Advance the scene, then stop, ending on a spoken line or concrete image that lands what this turn changed.";
const SPEECH_MARKER = "- Characters speak through what they do: their actual words land as quoted dialogue woven into their movements, and the more physical the moment, the more they voice it - urging, teasing, voicing what they want next. Their words respond to what the player just said or did and carry the scene onward.";

const EDITS = {
  none: (s) => s,
  // Lever 1 — the stop contract is currently length-blind: it says where to end, never when the turn is
  // over. This ties the stop to the handoff and caps the floor at one turn of speech per character.
  stopfirst: (s) => {
    if (!s.includes(STOP_MARKER)) throw new Error("stop-contract line not found in shipped prompt");
    return s.replace(STOP_MARKER,
      "- Advance the scene to the first point where what happens next depends on the player, then stop there - on the spoken line, question, or concrete image that hands the turn back. Each character gets one turn of speech: once someone has said their piece and the scene is waiting on the player, the turn is finished even if there is room left.");
  },
  // Lever 2 — the length knob's only outlet is currently the NPC's mouth ("the more physical the moment,
  // the more they voice it"). This names the non-speech fills a long turn is supposed to buy.
  fillelse: (s) => {
    if (!s.includes(SPEECH_MARKER)) throw new Error("speech line not found in shipped prompt");
    return s.replace(SPEECH_MARKER,
      "- Characters speak through what they do: their actual words land as quoted dialogue woven into their movements, answering what the player just said or did and carrying the scene onward. Each speech stays to what a person says in one breath - a longer turn earns its extra length from the world instead: what the place does, what the others present do with their hands and eyes, and how the player's action plays out around them.");
  },
  combo: (s) => EDITS.fillelse(EDITS.stopfirst(s)),
  // The voice clause is the strongest dialogue lever ever measured on the cloud hold gate (~3x
  // participation). It rides BOTH the user slot and the system prompt's closing contract, identical text.
  // On a model that already over-produces dialogue it may be pushing the monologue: novoice strips the
  // user-slot copy only, novoiceboth strips both — run together, since stripping one of two identical
  // copies can be a no-op and that would be indistinguishable from "the clause doesn't matter".
  novoice: (s) => s,
  novoiceboth: (s) => {
    if (!s.includes(VOICE_CLAUSE)) throw new Error("voice clause not found in shipped system prompt");
    return s.replace(VOICE_CLAUSE, "");
  },
};
// The clause as it sits in the system prompt's closing contract, leading space included.
const VOICE_CLAUSE = " When the player's action speaks to a character, the reply on the page is that character's own voice: their quoted sentences, answering what was asked and adding something of their own. The player's words are already spoken by the player - yours to write is the world's answer.";
// Arms that send the bare action instead of the shipped user template.
const BARE_ACTION_ARMS = new Set(["novoice", "novoiceboth"]);
const EDIT_KEYS = strArg("--edit", "none,combo").split(",").map((s) => s.trim());
for (const k of EDIT_KEYS) if (!EDITS[k]) throw new Error(`unknown edit '${k}'`);

async function call(messages, extra = {}) {
  const headers = { "Content-Type": "application/json" };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  const body = { model: MODEL, messages, max_tokens: MAX_TOKENS, reasoning_effort: "none", stream: false, ...extra };
  if (SEED) body.seed = SEED;
  // Narration is unpinned in promptSamplers.ts and custom endpoints get NO penalty field (the model's own
  // config applies), so omitting is the production-faithful default. --reppen tests pinning one: both
  // spellings go out because LM Studio reads only `repeat_penalty` and ignores `repetition_penalty`.
  if (REPPEN !== undefined && extra.temperature === undefined) {
    body.repetition_penalty = REPPEN;
    body.repeat_penalty = REPPEN;
  }
  const res = await fetch(ENDPOINT, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return ((await res.json()).choices?.[0]?.message?.content ?? "").trim();
}

// ── NPC quote extraction (shared bar with dialogue-hold-probe: player-voiced quotes are excluded) ──
const PC_VERB = "(?:say|says|said|ask|asks|asked|whisper|whispers|murmur|murmurs|tell|tells|reply|replies|answer|answers|breathe|breathes|call|calls|promise|promises|offer|offers|add|adds|manage|manages|repeat|repeats|echo|echoes|prompt|prompts|urge|urges|press|presses|coax|coaxes|invite|invites|wonder|wonders|venture|ventures|continue|continues|begin|begins|muse|muses|tease|teases|insist|insists|note|notes|observe|observes|remark|remarks|admit|admits|confess|confesses|mutter|mutters|mumble|mumbles|voice|voices|speak|speaks|gasp|gasps|sigh|sighs|laugh|laughs|purr|purrs|plead|pleads|beg|begs|warn|warns|drawl|drawls|croon|croons)";
const PC_BEFORE = new RegExp(`\\byou(?:r voice)?\\s+(?:\\w+\\s+){0,3}?${PC_VERB}\\b`, "i");
const PC_AFTER = new RegExp(`^[,—-]?\\s*you\\s+${PC_VERB}\\b`, "i");

// Each NPC quote with its position and best-guess speaker. Speaker = the cast name most recently named
// anywhere before the quote (how a reader attributes an unattributed line); a quote with no name before it
// inherits the previous quote's speaker, which is how alternating dialogue reads. The PC-exclusion span
// stays narrow (250 chars) so a distant "you say" can't strip a genuine NPC line.
function npcQuotes(text) {
  const out = [];
  let m, lastEnd = 0, prevSpeaker = null, pc = 0;
  QUOTE_RE.lastIndex = 0;
  while ((m = QUOTE_RE.exec(text))) {
    const spanStart = Math.max(lastEnd, m.index - 250);
    const before = text.slice(spanStart, m.index);
    const end = m.index + m[0].length;
    const after = text.slice(end, end + 60);
    if (PC_BEFORE.test(before) || PC_AFTER.test(after)) { lastEnd = end; pc++; continue; }
    const preceding = text.slice(0, m.index);
    let speaker = null, bestPos = -1;
    for (const name of CAST) {
      const i = preceding.lastIndexOf(name);
      if (i > bestPos) { bestPos = i; speaker = name; }
    }
    if (!speaker) for (const name of CAST) if (after.includes(name)) speaker = name;
    out.push({ text: m[0].replace(/^["“]|["”]$/g, ""), start: m.index, end, gap: m.index - lastEnd, speaker: speaker ?? prevSpeaker });
    if (speaker) prevSpeaker = speaker;
    lastEnd = end;
  }
  out.pcQuotes = pc;
  return out;
}
function sentencesIn(quoteText) {
  let n = 0;
  for (const seg of quoteText.split(/(?<=[.!?…])\s+/)) {
    const s = seg.trim();
    if (!s) continue;
    if (/[.!?…]["'”’]?$/.test(s) || s.split(/\s+/).length >= 4) n++;
  }
  return n;
}
// Speech acts: consecutive quotes with less than SPLIT chars of prose between them are one utterance.
function speechActs(quotes) {
  const acts = [];
  for (const q of quotes) {
    const last = acts.at(-1);
    if (last && q.gap < SPLIT) { last.sentences += sentencesIn(q.text); last.chars += q.text.length; }
    else acts.push({ speaker: q.speaker, sentences: sentencesIn(q.text), chars: q.text.length });
  }
  return acts;
}

async function judgeEngages(action, quotes) {
  const out = await call([{ role: "user", content:
    `The player just said or did: "${action}"\n\nA story character then spoke these lines:\n${quotes.map((q) => `"${q.text}"`).join("\n")}\n\nDo the character's lines engage with what the player just asked or said - answering it, reacting to it, or building on it? Reply with exactly YES or NO.` }],
    { temperature: 0, max_tokens: 5 });
  return /^\s*YES/i.test(out);
}

// ── One chain ──
async function runChain(editKey, run) {
  const SYS = EDITS[editKey](SYSTEM);
  const history = [];
  const turns = [];
  for (let t = 0; t < SESSION.length; t++) {
    const { action, expect } = SESSION[t];
    const msgs = [{ role: "system", content: SYS }];
    for (const h of history) msgs.push({ role: "user", content: h.action }, { role: "assistant", content: h.narration });
    const userMsg = BARE_ACTION_ARMS.has(editKey) ? action : NARRATION_USER.replace("<PLAYER ACTION>", action);
    msgs.push({ role: "user", content: userMsg });
    while (msgs.reduce((n, x) => n + x.content.length, 0) > STORY_CAP + SYS.length && msgs.length > 4) msgs.splice(2, 2);
    let narration = "";
    try { narration = await call(msgs); }
    catch (e) { console.error(`[${editKey} r${run} t${t}] ${e.message}`); }
    history.push({ action, narration });

    const quotes = narration ? npcQuotes(narration) : [];
    const acts = speechActs(quotes);
    const npcSent = acts.reduce((n, a) => n + a.sentences, 0);
    const quoteChars = acts.reduce((n, a) => n + a.chars, 0);
    const bySpeaker = new Map();
    for (const a of acts) bySpeaker.set(a.speaker ?? "?", (bySpeaker.get(a.speaker ?? "?") ?? 0) + a.sentences);
    const top = [...bySpeaker.entries()].sort((x, y) => y[1] - x[1])[0] ?? [null, 0];
    const tail = narration.trim().slice(-200);
    const lastQuote = quotes.at(-1);
    const endsSpeech = !!lastQuote && lastQuote.end >= narration.trim().length - 5;
    const turnRec = {
      t, action, baited: !!expect, narration,
      words: (narration.match(/\S+/g) || []).length,
      paras: narration.split(/\n\s*\n/).filter((p) => p.trim()).length,
      npcSent,
      acts: acts.length,
      longestAct: acts.reduce((n, a) => Math.max(n, a.sentences), 0),
      speakers: bySpeaker.size,
      topSpeaker: top[0],
      topShare: npcSent ? top[1] / npcSent : 0,
      dlgMass: narration.length ? quoteChars / narration.length : 0,
      endsSpeech,
      endsAsk: endsSpeech && /\?["”]?\s*$/.test(tail),
      // Observation, not a target: how often the narrator already voices the player despite the ban.
      pcQuotes: quotes.pcQuotes ?? 0,
    };
    // GUARD, baited turns only: the dialogue-hold participation bar.
    if (expect) {
      const bar = npcSent >= 2;
      let engaged = false;
      if (bar && JUDGE) { try { engaged = await judgeEngages(action, quotes); } catch { engaged = true; } }
      turnRec.participate = bar && (!JUDGE || engaged);
    }
    turns.push(turnRec);
    if (verbose) console.log(`[${editKey} r${run} t${t}] acts ${turnRec.acts} longest ${turnRec.longestAct} dlgMass ${(turnRec.dlgMass * 100).toFixed(0)}% words ${turnRec.words}`);
  }
  return { arm: editKey, run, turns };
}

// ── Run ──
console.log(`monologue — edits ${EDIT_KEYS.join("/")} × ${RUNS} runs × ${SESSION.length} turns · ${MODEL_LABEL} @ ${ENDPOINT}`);
console.log(`length condition: ${PARAS} paragraphs (max_tokens ${MAX_TOKENS}) · act split ${SPLIT} chars · judge ${JUDGE ? "on" : "OFF"}${SEED ? ` · seed ${SEED}` : ""} · rep-pen ${REPPEN ?? "omitted (endpoint default)"}`);
const thunks = EDIT_KEYS.flatMap((ek) => Array.from({ length: RUNS }, (_, r) => () => runChain(ek, r + 1)));
const chains = [];
if (SERIAL) { for (const th of thunks) chains.push(await th()); }
else chains.push(...await Promise.all(thunks.map((th) => th())));

const ts = new Date().toISOString().replace(/[:.]/g, "-");
for (const c of chains) {
  await writeFile(path.join(HARNESS_DIR, "../runs", `monologue-${c.arm}-run${c.run}-${MODEL_LABEL}-p${PARAS}-${ts}.json`), JSON.stringify({ model: MODEL_LABEL, paras: PARAS, ...c }, null, 1));
}

// ── Report ──
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
// Longest streak of consecutive turns sharing a top speaker (null/unknown breaks the streak).
function floorRun(turns) {
  let best = 0, cur = 0, prev = null;
  for (const x of turns) {
    if (x.topSpeaker && x.topSpeaker === prev) cur++; else cur = x.topSpeaker ? 1 : 0;
    prev = x.topSpeaker;
    best = Math.max(best, cur);
  }
  return best;
}
const pct = (x) => `${(x * 100).toFixed(0)}%`;
for (const arm of EDIT_KEYS) {
  const armChains = chains.filter((c) => c.arm === arm);
  console.log(`\n═══ ARM ${arm} ═══`);
  for (const c of armChains) {
    const reg = c.turns.filter((x) => !x.baited);
    console.log(`run${c.run}: regular acts ${mean(reg.map((x) => x.acts)).toFixed(1)} · longestAct ${mean(reg.map((x) => x.longestAct)).toFixed(1)} · dlgMass ${pct(mean(reg.map((x) => x.dlgMass)))} · topShare ${pct(mean(reg.map((x) => x.topShare)))} · floorRun ${floorRun(c.turns)} · words ${Math.round(mean(c.turns.map((x) => x.words)))}`);
  }
  const all = armChains.flatMap((c) => c.turns);
  const reg = all.filter((x) => !x.baited);
  const baited = all.filter((x) => x.baited);
  console.log(`POOLED regular (n=${reg.length}) — RAMBLE axis, want DOWN:`);
  console.log(`  acts/turn ${mean(reg.map((x) => x.acts)).toFixed(2)} · longestAct ${mean(reg.map((x) => x.longestAct)).toFixed(2)} · longestAct>=4 ${pct(mean(reg.map((x) => (x.longestAct >= 4 ? 1 : 0))))}`);
  console.log(`  dlgMass ${pct(mean(reg.map((x) => x.dlgMass)))} · dlgMass>=50% ${pct(mean(reg.map((x) => (x.dlgMass >= 0.5 ? 1 : 0))))} · topShare ${pct(mean(reg.map((x) => x.topShare)))} · speakers/turn ${mean(reg.map((x) => x.speakers)).toFixed(2)}`);
  console.log(`  floorRun mean ${mean(armChains.map((c) => floorRun(c.turns))).toFixed(1)} · max ${Math.max(...armChains.map((c) => floorRun(c.turns)))}`);
  console.log(`  handoff: endsSpeech ${pct(mean(reg.map((x) => (x.endsSpeech ? 1 : 0))))} · endsAsk ${pct(mean(reg.map((x) => (x.endsAsk ? 1 : 0))))} · words ${Math.round(mean(reg.map((x) => x.words)))} · over${PARAS}paras ${pct(mean(all.map((x) => (x.paras > PARAS ? 1 : 0))))}`);
  console.log(`  observed: player voiced in ${pct(mean(all.map((x) => (x.pcQuotes > 0 ? 1 : 0))))} of turns (${mean(all.map((x) => x.pcQuotes)).toFixed(2)} quotes/turn)`);
  // Thirds — a ramble that only appears deep in a session is invisible in the pooled mean.
  const third = Math.floor(SESSION.length / 3);
  const win = (lo, hi) => reg.filter((x) => x.t >= lo && x.t < hi);
  const row = (label, xs) => `  ${label}: acts ${mean(xs.map((x) => x.acts)).toFixed(2)} · longestAct ${mean(xs.map((x) => x.longestAct)).toFixed(2)} · >=4 ${pct(mean(xs.map((x) => (x.longestAct >= 4 ? 1 : 0))))} · dlgMass ${pct(mean(xs.map((x) => x.dlgMass)))} · topShare ${pct(mean(xs.map((x) => x.topShare)))} · words ${Math.round(mean(xs.map((x) => x.words)))}`;
  console.log(row("early", win(0, third)));
  console.log(row("mid  ", win(third, SESSION.length - third)));
  console.log(row("late ", win(SESSION.length - third, SESSION.length)));
  const bwin = (lo, hi) => baited.filter((x) => x.t >= lo && x.t < hi);
  const bEarly = bwin(0, third), bLate = bwin(SESSION.length - third, SESSION.length);
  console.log(`  guard by window: early participation ${pct(mean(bEarly.map((x) => (x.participate ? 1 : 0))))} (n=${bEarly.length}) → late ${pct(mean(bLate.map((x) => (x.participate ? 1 : 0))))} (n=${bLate.length})`);
  console.log(`GUARD baited (n=${baited.length}) — must NOT drop:`);
  console.log(`  participation ${pct(mean(baited.map((x) => (x.participate ? 1 : 0))))} · npcSent ${mean(baited.map((x) => x.npcSent)).toFixed(1)} · speakers/turn ${mean(baited.map((x) => x.speakers)).toFixed(2)}`);
}
console.log(`\nraw chains: testing/baseline/runs/monologue-{arm}-run{n}-${MODEL_LABEL}-p${PARAS}-${ts}.json`);
