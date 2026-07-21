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
// only (last --floor pairs verbatim, older turns dropped entirely — the accumulation sanity check).
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
const ARMS = strArg("--arms", "B,E").split(",").map((s) => s.trim().toUpperCase());
const RUNS = num("--runs", 8);
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
  const SYS = EDITS[editKey](SYSTEM);
  const history = []; // {action, narration, summary?}
  const turns = [];
  const openerNarr = await call([{ role: "system", content: SYS }, { role: "user", content: OPENER }]);
  history.push({ action: OPENER, narration: openerNarr });
  if (arm === "E") history[0].summary = await callSummary(OPENER, openerNarr).catch(() => "");
  for (let t = 0; t < TURNS.length; t++) {
    const { a: action, hot } = TURNS[t];
    const pairs = [];
    for (let i = 0; i < history.length; i++) {
      if (arm === "W" && i < history.length - FLOOR) continue; // window-only: older turns vanish entirely
      const inBand = arm === "E" && i < history.length - FLOOR;
      if (inBand && !history[i].summary) continue;
      pairs.push([history[i].action, inBand ? history[i].summary : history[i].narration]);
    }
    const msgs = [{ role: "system", content: SYS }];
    for (const [u, a] of pairs) msgs.push({ role: "user", content: u }, { role: "assistant", content: a });
    msgs.push({ role: "user", content: action });
    while (msgs.reduce((n, m) => n + m.content.length, 0) > STORY_CAP + SYS.length && msgs.length > 4) msgs.splice(2, 2);
    let narration = "";
    try { narration = await call(msgs); }
    catch (e) { console.error(`[${arm} r${run} t${t}] ${e.message}`); }
    const entry = { action, narration };
    if (arm === "E" && narration) entry.summary = await callSummary(action, narration).catch(() => "");
    history.push(entry);
    const quotes = narration ? npcQuotes(narration) : [];
    const sentences = quoteSentences(quotes);
    const bar = sentences >= 2;
    let engaged = false;
    if (bar && JUDGE) { try { engaged = await judgeEngages(action, quotes); } catch (e) { console.error(`[judge ${arm} r${run} t${t}] ${e.message}`); engaged = true; } }
    const participate = bar && (!JUDGE || engaged);
    turns.push({ t, action, hot, narration, quotes, sentences, bar, engaged, participate, ...(entry.summary !== undefined ? { summary: entry.summary } : {}) });
    if (verbose) console.log(`[${arm} r${run} t${t}] npcSent ${sentences} ${bar ? (participate ? "PART" : "bar-only") : "·"}`);
  }
  return { arm: editKey === "none" ? arm : `${arm}+${editKey}`, run, turns };
}

// ── Run all chains ──
console.log(`dialogue-hold — ${ARMS.join("/")} × edits ${EDIT_KEYS.join("/")} × ${RUNS} runs × ${TURNS.length} baited turns · ${MODEL_LABEL} @ ${ENDPOINT} · judge ${JUDGE ? "on" : "OFF"} · floor ${FLOOR}`);
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
    const first8 = mean(seq.slice(0, 8)), mid = mean(seq.slice(8, 17)), last8 = mean(seq.slice(17));
    const sl = slopeOf(seq);
    const verdict = last8 < first8 && sl < 0 ? "DECAY" : "steady";
    const glyphs = c.turns.map((x) => (x.participate ? "█" : x.bar ? "▒" : x.sentences > 0 ? "·" : " ")).join("");
    console.log(`run${c.run}: |${glyphs}| part ${seq.reduce((a, b) => a + b, 0)}/${seq.length} · first8 ${(first8 * 100).toFixed(0)}% mid ${(mid * 100).toFixed(0)}% last8 ${(last8 * 100).toFixed(0)}% · slope ${(sl * 100).toFixed(1)}%/turn · ${verdict}`);
  }
  const pooled = Array.from({ length: TURNS.length }, (_, t) => mean(armSeqs.map((s) => s[t])));
  const pf = mean(pooled.slice(0, 8)), pm = mean(pooled.slice(8, 17)), pl = mean(pooled.slice(17));
  const ps = slopeOf(pooled);
  console.log(`POOLED: first8 ${(pf * 100).toFixed(0)}% · mid ${(pm * 100).toFixed(0)}% · last8 ${(pl * 100).toFixed(0)}% · slope ${(ps * 100).toFixed(2)}%/turn · ${pl < pf && ps < 0 ? "DECAY — FAIL" : "HOLDS"}`);
  // Charge split: cool vs hot participation per window — separates time decay from charge-locality.
  const typeWin = (hot, lo, hi) => {
    const idx = TURNS.map((x, t) => ({ t, hot: x.hot })).filter((x) => x.hot === hot && x.t >= lo && x.t < hi).map((x) => x.t);
    return mean(idx.map((t) => pooled[t]));
  };
  for (const hot of [false, true]) {
    console.log(`  ${hot ? "hot " : "cool"}: first8 ${(typeWin(hot, 0, 8) * 100).toFixed(0)}% · mid ${(typeWin(hot, 8, 17) * 100).toFixed(0)}% · last8 ${(typeWin(hot, 17, 25) * 100).toFixed(0)}%`);
  }
}
console.log(`\nglyphs: █ participating · ▒ >=2 NPC sentences but judged non-engaging · · NPC spoke <2 sentences · (blank) silent`);
console.log(`raw chains: testing/baseline/runs/dialogue-hold-{arm}-run{n}-${MODEL_LABEL}-${ts}.json`);
