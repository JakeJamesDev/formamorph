// Dialogue-hold probe — the STRICT dialogue-frequency regression gate (cloud collapse hunting).
// Plays charged-interview-corpus.mjs (25 consecutive baited turns: every action asks a named, willing
// partner to speak) as narration-only chains, self-managed history, and scores each turn on the strict
// bar agreed 2026-07-21:
//   PARTICIPATING = an NPC (never "you say...") speaks >=2 quoted sentences that ENGAGE the ask
//                   (engagement judged by a temp-0 YES/NO call; --nojudge for the mechanical bar only).
// The failure is DECAY: participation must hold steady across the run — a downward trend (last-8 window
// below first-8, negative pooled slope) is a FAIL even when the average looks healthy.
//
// Arms: B = bare history (the shipped app format) · E = digest banding (turns older than --floor ride as
// present-tense summaries via the shipped summary prompt, temp 0; "nothing notable" drops) · W = window
// only (last --floor pairs verbatim, older turns dropped entirely — the accumulation sanity check) ·
// M = milestone memory (floor verbatim + --recent digests unfiltered + older digests filtered by the
// 'reframe' selector each turn, malformed reply → keep-everything; see milestone-memory-design.md).
//
//   node dialogue-hold-probe.mjs [--arms B,E] [--runs 8] [--model gemma4-e4b-cloud] [--floor 3]
//                                [--max 500] [--serial] [--nojudge] [--verbose]

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { grab, QUOTE_RE } from "./planner-probe-lib.mjs";
import { WORLD, PLAYER_TRAIT, LOCATION, ENTITIES, OPENER, TURNS } from "./charged-interview-corpus.mjs";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const num = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? Number(argv[i + 1]) : d; };
const strArg = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const verbose = argv.includes("--verbose");
// Arm tokens may carry a per-arm recent-band width suffix: M0 = milestone memory with recent 0,
// M6 = recent 6 — so band widths can be compared inside ONE batch (cloud mood-drifts between batches).
const ARMS = strArg("--arms", "B,E").split(",").map((s) => s.trim().toUpperCase());
const RUNS = num("--runs", 8);
// Session length: cycles the 25-turn corpus when longer (--turns 50 = the corpus twice).
const NTURNS = num("--turns", TURNS.length);
const SESSION = Array.from({ length: NTURNS }, (_, i) => TURNS[i % TURNS.length]);
const MAX_TOKENS = num("--max", 500);
const FLOOR = num("--floor", 3);
const JUDGE = !argv.includes("--nojudge");
const SERIAL = argv.includes("--serial");
const MODEL_LABEL = strArg("--model", "gemma4-e4b-cloud");
const STORY_CAP = 28000;

const profiles = JSON.parse(await readFile(path.join(HARNESS_DIR, "profiles.json"), "utf8"));
const modelCfg = profiles.models.find((m) => m.label === MODEL_LABEL);
if (!modelCfg) throw new Error(`model label '${MODEL_LABEL}' not in profiles.json`);
const ENDPOINT = modelCfg.endpointUrl ?? profiles.endpointUrl;
const MODEL = modelCfg.modelName ?? MODEL_LABEL;
const TOKEN = modelCfg.apiToken ?? profiles.apiToken ?? "";

// ── Shipped prompts, corpus-filled ──
const entMd = ENTITIES.map((e) => `- **${e.name}** (${e.type}): ${e.description}`).join("\n");
const SYSTEM = grab("defaultSystemPrompt")
  .replaceAll("<LENGTH GUIDANCE>", "Write at most 4 short paragraphs.")
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
const SUMMARY_SYSTEM = grab("defaultSummaryPrompt");
const SUMMARY_USER = grab("defaultSummaryUserPrompt");

// ── Candidate edits (--edit none,voice): appended to the closing contract — the recency slot ──
// voice: the hold-gate clause. Targets the two measured failure textures: the narrator voicing the
// player's questions, and NPCs "answering" with body language only.
const EDITS = {
  none: (s) => s,
  voice: (s) => {
    const marker = /(or a bracketed stage direction like \[Player's turn\]\.)\s*$/;
    if (!marker.test(s)) throw new Error("closing-contract marker not found in shipped prompt");
    return s.replace(marker,
      `$1 When the player's action speaks to a character, the reply on the page is that character's own voice: their quoted sentences, answering what was asked and adding something of their own. The player's words are already spoken by the player - yours to write is the world's answer.`);
  },
  // 2026-07-21 permission-stance clause (user theory: engagement IS the permission; outcomes belong to
  // the narrator). Appended after the shipped voice clause — the closing contract's recency slot.
  authority: (s) => {
    const marker = "yours to write is the world's answer.";
    if (!s.includes(marker)) throw new Error("voice-clause marker not found in shipped prompt");
    return s.replace(marker,
      `${marker} The world moves on its own authority. The player's action is their whole say in the turn - once it is taken, what follows is yours to decide by the world's own logic. Characters act on their own desires without waiting to be invited, and events land on the player uninvited when the world would deal them.`);
  },
  // The voicing tweak ALONE (no clause) — isolated the cloud gains to removing the ask-license.
  // SHIPPED 2026-07-21 (throws now: the marker is gone from the shipped prompt = the 'none' baseline).
  voicing: (s) => {
    if (!s.includes("asking for what they want next")) throw new Error("speech-line marker not found in shipped prompt");
    return s.replace("asking for what they want next", "voicing what they want next");
  },
  // 2026-07-21 vague-line rewrites (user: describe what we're actually asking, or remove).
  // 2026-07-22: the `combo` (consfix + endcut) SHIPPED — these edits now throw against the shipped
  // prompt (markers gone = 'none' is the new baseline), kept for the record.
  // consfix — the consistency line's real measured value is a length brake; this says the actual ask.
  consfix: (s) => {
    const marker = "- Stay consistent with the world, traits, location, and the story so far.";
    if (!s.includes(marker)) throw new Error("consistency line not found in shipped prompt");
    return s.replace(marker,
      "- What the story has established stays true: where everyone is, what they hold and wear, and what has been said or done carry into this turn unless the action changes them.");
  },
  // conscut — the consistency line removed outright (the sweep kept it only as a length brake;
  // silence/reask/echo were never the basis).
  conscut: (s) => {
    // No trailing newline in the marker — the source file is CRLF; the leftover blank line is harmless.
    const marker = "- Stay consistent with the world, traits, location, and the story so far.";
    if (!s.includes(marker)) throw new Error("consistency line not found in shipped prompt");
    return s.replace(marker, "").replace(/\r?\n\r?\n\r?\n/, "\n\n");
  },
  // endcut — the vague middle clause removed, advance+ending contract kept.
  endcut: (s) => {
    const marker = "- Advance the scene, then stop: your reply is complete once the events have been told, ending on a spoken line or concrete image that lands what this turn changed.";
    if (!s.includes(marker)) throw new Error("ending line not found in shipped prompt");
    return s.replace(marker,
      "- Advance the scene, then stop, ending on a spoken line or concrete image that lands what this turn changed.");
  },
  // combo — the proposed ship: consfix + endcut together (interactions measured, not assumed).
  combo: (s) => EDITS.endcut(EDITS.consfix(s)),
  // endfix — "the events" has no antecedent; tie the stop rule to the player's action.
  endfix: (s) => {
    const marker = "- Advance the scene, then stop: your reply is complete once the events have been told, ending on a spoken line or concrete image that lands what this turn changed.";
    if (!s.includes(marker)) throw new Error("ending line not found in shipped prompt");
    return s.replace(marker,
      "- Advance the scene, then stop: tell what the player's action sets off - what the world and its characters do and say in answer - and end on a spoken line or concrete image that lands what this turn changed.");
  },
  // Clause retry v2 (zero player-reference — v1's "the player's whole say" fed the permission prior).
  authority2: (s) => {
    const marker = "yours to write is the world's answer.";
    if (!s.includes(marker)) throw new Error("voice-clause marker not found in shipped prompt");
    return s.replace(marker,
      `${marker} The world moves on its own authority: characters act on their own desires without waiting to be invited, and what happens this turn lands on the page as settled fact, not as an offer.`);
  },
  authority2b: (s) =>
    EDITS.authority2(s).replace("settled fact, not as an offer.",
      "settled fact, not as an offer. Events arrive when the world's logic deals them - no announcement, no invitation."),
  // authority + the one shipped wording that licenses asking ("asking for what they want next").
  authorityVoicing: (s) => {
    const out = EDITS.authority(s);
    if (!out.includes("asking for what they want next")) throw new Error("speech-line marker not found in shipped prompt");
    return out.replace("asking for what they want next", "voicing what they want next");
  },
};
const EDIT_KEYS = strArg("--edit", "none").split(",").map((s) => s.trim());
for (const k of EDIT_KEYS) if (!EDITS[k]) throw new Error(`unknown edit '${k}'`);

async function call(messages, extra = {}) {
  const headers = { "Content-Type": "application/json" };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  const res = await fetch(ENDPOINT, {
    method: "POST", headers,
    body: JSON.stringify({ model: MODEL, messages, max_tokens: MAX_TOKENS, reasoning_effort: "none", stream: false, ...extra }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return ((await res.json()).choices?.[0]?.message?.content ?? "").trim();
}
const RECENT = num("--recent", 6);
// The milestone selector ('fewshot' variant — gate-passing on both models: 0.94 must-recall,
// 0.17 drop-keep; worked example fixed the commitment/resolution inversion. See milestone-select-probe.mjs.
const SELECTOR_SYS = `You are the memory keeper of an interactive story. You are given the story's remembered moments as a numbered list, oldest first. Keep an entry only if someone in the story would bring it up again or act on it: a promise or debt still open, a threat or wound that persists, a thing gained and kept, a favor done or a slight given that changes how one character sees another, a secret learned, a task done well that someone might mention. Drop what no one would ever speak of again - passing movement, small talk, and any moment whose outcome a later entry already carries. When unsure whether something still matters, let it go.

Example:
1. You take the cliff path toward the lighthouse.
2. You promise the keeper Brann you will fetch his lamp oil from town.
3. You trade jokes with a fishwife on the quay.
4. You bring Brann his lamp oil, and he lights the beacon, calling you a friend of the tower.
Correct reply: 4
Entry 4 carries entry 2's outcome - the fulfilled promise replaces the promise itself, so the ending is kept and the setup is dropped. Entries 1 and 3 are passing moments no one would mention again.

Reply with only the numbers to keep, comma-separated.`;
// Returns kept indices, or null (malformed / error) meaning keep everything.
async function selectMilestones(summaries) {
  const list = summaries.map((s, i) => `${i + 1}. ${s}`).join("\n");
  const out = await call(
    [{ role: "system", content: SELECTOR_SYS },
     { role: "user", content: `The story's remembered moments, oldest first:\n${list}\n\nReply with only the numbers to keep, comma-separated.` }],
    { temperature: 0, max_tokens: 120 },
  );
  const nums = (out.match(/\d+/g) || []).map(Number).filter((n) => n >= 1 && n <= summaries.length);
  if (!nums.length || out.replace(/[\d,.\s\-and]+/gi, "").length > 40) return null;
  return new Set(nums.map((n) => n - 1));
}

async function callSummary(action, narration) {
  const user = SUMMARY_USER.replace("<PLAYER ACTION>", action).replace("<NARRATION>", narration);
  const out = await call([{ role: "system", content: SUMMARY_SYSTEM }, { role: "user", content: user }], { temperature: 0, max_tokens: 200 });
  return out.toLowerCase().trim() === "nothing notable" ? "" : out;
}

// ── Strict scoring ──
const PC_VERB = "(?:say|says|said|ask|asks|asked|whisper|whispers|murmur|murmurs|tell|tells|reply|replies|answer|answers|breathe|breathes|call|calls|promise|promises|offer|offers|add|adds|manage|manages|repeat|repeats|echo|echoes|prompt|prompts|urge|urges|press|presses|coax|coaxes|invite|invites|wonder|wonders|venture|ventures|continue|continues|begin|begins|muse|muses|tease|teases|insist|insists|note|notes|observe|observes|remark|remarks|admit|admits|confess|confesses|mutter|mutters|mumble|mumbles|voice|voices|speak|speaks|gasp|gasps|sigh|sighs|laugh|laughs|purr|purrs|plead|pleads|beg|begs|warn|warns|drawl|drawls|croon|croons)";
// PC attribution: the narrative span between the previous quote (or 250 chars back) and this quote names
// "you" with a speech verb — covers split quotes ('"...," you whisper ..., "..."') where the verb sits far
// from the second fragment. Post-attribution ('"..." you say') is checked after the closing quote.
const PC_BEFORE = new RegExp(`\\byou(?:r voice)?\\s+(?:\\w+\\s+){0,3}?${PC_VERB}\\b`, "i");
const PC_AFTER = new RegExp(`^[,—-]?\\s*you\\s+${PC_VERB}\\b`, "i");
function npcQuotes(text) {
  const out = [];
  let m, lastEnd = 0;
  QUOTE_RE.lastIndex = 0;
  while ((m = QUOTE_RE.exec(text))) {
    const spanStart = Math.max(lastEnd, m.index - 250);
    const before = text.slice(spanStart, m.index);
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 30);
    lastEnd = m.index + m[0].length;
    if (PC_BEFORE.test(before) || PC_AFTER.test(after)) continue; // player-voiced — excluded
    out.push(m[0].replace(/^["“]|["”]$/g, ""));
  }
  return out;
}
// Sentences inside NPC quotes: terminal-punctuated segments, or an unpunctuated segment of >=4 words.
function quoteSentences(quotes) {
  let n = 0;
  for (const q of quotes) {
    for (const seg of q.split(/(?<=[.!?…])\s+/)) {
      const s = seg.trim();
      if (!s) continue;
      if (/[.!?…]["'”’]?$/.test(s) || s.split(/\s+/).length >= 4) n++;
    }
  }
  return n;
}
async function judgeEngages(action, quotes) {
  const out = await call([{ role: "user", content:
    `The player just said or did: "${action}"\n\nA story character then spoke these lines:\n${quotes.map((q) => `"${q}"`).join("\n")}\n\nDo the character's lines engage with what the player just asked or said - answering it, reacting to it, or building on it? Reply with exactly YES or NO.` }],
    { temperature: 0, max_tokens: 5 });
  return /^\s*YES/i.test(out);
}

// ── One chain ──
async function runChain(arm, run, editKey = "none") {
  // `arm` is the full token: base letter picks the mechanism, an optional digit suffix overrides the
  // recent-band width, an optional F<n> suffix overrides the verbatim floor (e.g. M0F2 = milestone
  // memory, recent 0, floor 2) — so band and floor widths compare inside ONE batch.
  const m = arm.match(/^([BEWM])(\d+)?(?:F(\d+))?$/);
  if (!m) throw new Error(`bad arm token '${arm}'`);
  const base = m[1];
  const recent = m[2] !== undefined ? Number(m[2]) : RECENT;
  const floor = m[3] !== undefined ? Number(m[3]) : FLOOR;
  const SYS = EDITS[editKey](SYSTEM);
  const history = []; // {action, narration, summary?}
  const turns = [];
  const openerNarr = await call([{ role: "system", content: SYS }, { role: "user", content: OPENER }]);
  history.push({ action: OPENER, narration: openerNarr });
  if (base === "E" || base === "M") history[0].summary = await callSummary(OPENER, openerNarr).catch(() => "");
  for (let t = 0; t < SESSION.length; t++) {
    const { a: action, hot } = SESSION[t];
    // Arm M: entries older than floor+recent go through the selector each turn (null = keep all).
    let msKeep = null, msEnd = 0;
    if (base === "M") {
      msEnd = history.length - floor - recent;
      if (msEnd > 0) {
        try { msKeep = await selectMilestones(history.slice(0, msEnd).map((h) => h.summary || "(nothing notable)")); }
        catch (e) { console.error(`[${arm} r${run} t${t}] select: ${e.message}`); }
      }
    }
    const pairs = [];
    for (let i = 0; i < history.length; i++) {
      if (base === "W" && i < history.length - floor) continue; // window-only: older turns vanish entirely
      if (base === "M" && i < msEnd && msKeep && !msKeep.has(i)) continue; // dropped by the selector
      const inBand = (base === "E" || base === "M") && i < history.length - floor;
      if (inBand && !history[i].summary) continue;
      pairs.push([history[i].action, inBand ? history[i].summary : history[i].narration]);
    }
    const msgs = [{ role: "system", content: SYS }];
    for (const [u, a] of pairs) msgs.push({ role: "user", content: u }, { role: "assistant", content: a });
    msgs.push({ role: "user", content: action });
    while (msgs.reduce((n, m) => n + m.content.length, 0) > STORY_CAP + SYS.length && msgs.length > 4) msgs.splice(2, 2);
    const ctxChars = msgs.reduce((n, m) => n + m.content.length, 0);
    let narration = "";
    try { narration = await call(msgs); }
    catch (e) { console.error(`[${arm} r${run} t${t}] ${e.message}`); }
    const entry = { action, narration };
    if ((base === "E" || base === "M") && narration) entry.summary = await callSummary(action, narration).catch(() => "");
    history.push(entry);
    const quotes = narration ? npcQuotes(narration) : [];
    const sentences = quoteSentences(quotes);
    const bar = sentences >= 2;
    let engaged = false;
    if (bar && JUDGE) { try { engaged = await judgeEngages(action, quotes); } catch (e) { console.error(`[judge ${arm} r${run} t${t}] ${e.message}`); engaged = true; } }
    const participate = bar && (!JUDGE || engaged);
    turns.push({ t, action, hot, ctxChars, narration, quotes, sentences, bar, engaged, participate, ...(entry.summary !== undefined ? { summary: entry.summary } : {}) });
    if (verbose) console.log(`[${arm} r${run} t${t}] npcSent ${sentences} ${bar ? (participate ? "PART" : "bar-only") : "·"}`);
  }
  return { arm: editKey === "none" ? arm : `${arm}+${editKey}`, run, turns };
}

// ── Run all chains ──
console.log(`dialogue-hold — ${ARMS.join("/")} × edits ${EDIT_KEYS.join("/")} × ${RUNS} runs × ${SESSION.length} baited turns · ${MODEL_LABEL} @ ${ENDPOINT} · judge ${JUDGE ? "on" : "OFF"} · floor ${FLOOR}`);
const thunks = ARMS.flatMap((arm) => EDIT_KEYS.flatMap((ek) => Array.from({ length: RUNS }, (_, r) => () => runChain(arm, r + 1, ek))));
const chains = [];
if (SERIAL) { for (const th of thunks) chains.push(await th()); }
else chains.push(...await Promise.all(thunks.map((th) => th())));

const ts = new Date().toISOString().replace(/[:.]/g, "-");
for (const c of chains) {
  await writeFile(path.join(HARNESS_DIR, "../runs", `dialogue-hold-${c.arm}-run${c.run}-${MODEL_LABEL}-${ts}.json`), JSON.stringify({ model: MODEL_LABEL, ...c }, null, 1));
}

// ── Report: per-run sequence + windows + slope; DECAY = last8 < first8 with negative slope ──
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const slopeOf = (xs) => {
  const n = xs.length, mx = (n - 1) / 2, my = mean(xs);
  let num = 0, den = 0;
  xs.forEach((y, i) => { num += (i - mx) * (y - my); den += (i - mx) ** 2; });
  return den ? num / den : 0;
};
for (const arm of [...new Set(chains.map((c) => c.arm))]) {
  console.log(`\n═══ ARM ${arm} ═══`);
  const armSeqs = [];
  for (const c of chains.filter((x) => x.arm === arm)) {
    const seq = c.turns.map((x) => (x.participate ? 1 : 0));
    armSeqs.push(seq);
    const first8 = mean(seq.slice(0, 8)), mid = mean(seq.slice(8, seq.length - 8)), last8 = mean(seq.slice(seq.length - 8));
    const sl = slopeOf(seq);
    const verdict = last8 < first8 && sl < 0 ? "DECAY" : "steady";
    const glyphs = c.turns.map((x) => (x.participate ? "█" : x.bar ? "▒" : x.sentences > 0 ? "·" : " ")).join("");
    console.log(`run${c.run}: |${glyphs}| part ${seq.reduce((a, b) => a + b, 0)}/${seq.length} · first8 ${(first8 * 100).toFixed(0)}% mid ${(mid * 100).toFixed(0)}% last8 ${(last8 * 100).toFixed(0)}% · slope ${(sl * 100).toFixed(1)}%/turn · ${verdict}`);
  }
  const pooled = Array.from({ length: SESSION.length }, (_, t) => mean(armSeqs.map((s) => s[t])));
  const pf = mean(pooled.slice(0, 8)), pm = mean(pooled.slice(8, pooled.length - 8)), pl = mean(pooled.slice(pooled.length - 8));
  const ps = slopeOf(pooled);
  console.log(`POOLED: first8 ${(pf * 100).toFixed(0)}% · mid ${(pm * 100).toFixed(0)}% · last8 ${(pl * 100).toFixed(0)}% · slope ${(ps * 100).toFixed(2)}%/turn · ${pl < pf && ps < 0 ? "DECAY — FAIL" : "HOLDS"}`);
  // Charge split: cool vs hot participation per window — separates time decay from charge-locality.
  const typeWin = (hot, lo, hi) => {
    const idx = SESSION.map((x, t) => ({ t, hot: x.hot })).filter((x) => x.hot === hot && x.t >= lo && x.t < hi).map((x) => x.t);
    return mean(idx.map((t) => pooled[t]));
  };
  const n = SESSION.length;
  for (const hot of [false, true]) {
    console.log(`  ${hot ? "hot " : "cool"}: first8 ${(typeWin(hot, 0, 8) * 100).toFixed(0)}% · mid ${(typeWin(hot, 8, n - 8) * 100).toFixed(0)}% · last8 ${(typeWin(hot, n - 8, n) * 100).toFixed(0)}%`);
  }
  // Context mass: mean request size and final-turn size (does history stop growing?).
  const armTurns = chains.filter((x) => x.arm === arm).flatMap((c) => c.turns);
  const finals = chains.filter((x) => x.arm === arm).map((c) => c.turns.at(-1)?.ctxChars ?? 0);
  console.log(`  ctx: mean ${Math.round(mean(armTurns.map((x) => x.ctxChars ?? 0)) / 1000)}k chars · final-turn ${Math.round(mean(finals) / 1000)}k chars`);
}
console.log(`\nglyphs: █ participating · ▒ >=2 NPC sentences but judged non-engaging · · NPC spoke <2 sentences · (blank) silent`);
console.log(`raw chains: testing/baseline/runs/dialogue-hold-{arm}-run{n}-${MODEL_LABEL}-${ts}.json`);
