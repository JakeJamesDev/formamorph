// Format-arms probe — how the player's action enters the context (dialogue-collapse investigation).
// Replays the 30 recorded actions from dynamic baseline run 1 (all wordless, charged-ambient escalation)
// through three message formats, self-managed history, narration only (no planner/choices/stats):
//   A  app format          — assistant-turn history + `Player action: X` user turns (byte-faithful baseline)
//   B  first-person        — same history shape, but the user turn IS the action text (chat-native impersonation)
//   C  single-message      — no assistant turns: each call is system + one user message holding the
//                            story-so-far as quoted text plus the action (Sukino-style rebuild)
// The system prompt and actions are lifted verbatim from the recorded run, so format is the only variable.
//
//   node format-arms-probe.mjs [--arms A,B,C] [--runs 2] [--model gemma4-e4b-cloud] [--turns 30]
//                              [--max 500] [--source ../runs/<file>.json] [--verbose]
//
// Each arm×run chain is serial (turn N needs narration N-1); all chains fire concurrently.
// Metrics per turn: dialogue% (quoted-char share) · quoted turns · freeze hits · defer · words ·
// echo5 (5-grams already seen in this chain's prior narrations, per 100 words).
// Collapse point = first turn starting >=3 consecutive quoteless narrations.
// Raw chains are saved to ../runs/format-<arm>-run<n>-<model>-<ts>.json.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { QUOTE_RE, FREEZE_RE, DEFER_RE } from "./planner-probe-lib.mjs";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const num = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? Number(argv[i + 1]) : d; };
const strArg = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const verbose = argv.includes("--verbose");

const ARMS = strArg("--arms", "A,B,C").split(",").map((s) => s.trim().toUpperCase());
const RUNS = num("--runs", 2);
const TURNS = num("--turns", 30);
const MAX_TOKENS = num("--max", 500); // "at most 6 short paragraphs" ≈ 6*65/0.8 (outputLength.ts)
const MODEL_LABEL = strArg("--model", "gemma4-e4b-cloud");
const SOURCE = strArg("--source", "../runs/dynamic-gemma4-e4b-cloud-2026-07-20T22-09-10-120Z.json");
const STORY_CAP = num("--storycap", 28000); // chars of story text in arm C (~7k tokens; system+action+500 out fit under 10750)

// ── Endpoint from profiles.json (per-model endpointUrl/modelName overrides, like run.mjs) ──
const profiles = JSON.parse(await readFile(path.join(HARNESS_DIR, "profiles.json"), "utf8"));
const modelCfg = profiles.models.find((m) => m.label === MODEL_LABEL);
if (!modelCfg) throw new Error(`model label '${MODEL_LABEL}' not in profiles.json`);
const ENDPOINT = modelCfg.endpointUrl ?? profiles.endpointUrl;
const MODEL = modelCfg.modelName ?? MODEL_LABEL;
const TOKEN = modelCfg.apiToken ?? profiles.apiToken ?? "";

// ── Recorded baseline: system prompt + fixed action script, verbatim ──
const rec = JSON.parse(await readFile(path.resolve(HARNESS_DIR, SOURCE), "utf8"));
const FULL_SYSTEM = rec["0"].requests.find((r) => r.type === "narration").messages[0].content;

// ── Ablations: each key deletes ONE section/bullet from the recorded system prompt (arm A format).
// `--ablate key1,key2,...` runs one chain set per key; metrics diff against the full-prompt A baseline.
const ABLATIONS = {
  none: [],
  opening: [/^You are the narrator stage[\s\S]*?(?=## Guidelines)/],
  "dialogue-rule": [/- When characters are present, they speak[^\n]*\n/],
  length: [/- Be concise and vivid\. Write at most \d+ short paragraphs\.\n/],
  ending: [/- Advance the scene, then stop:[^\n]*\n/],
  tense: [/- Write in second person, present tense[^\n]*\n/],
  formatting: [/## Formatting\n[\s\S]*?(?=\n## )/],
  world: [/## Game World\n[\s\S]*?(?=\n## )/],
  closing: [/Output only the story prose[\s\S]*$/],
};
// ── Candidate edits: [pattern, replacement] pairs applied to the recorded prompt (`--edit key1,key2`).
// fuse    — dialogue rule rewritten to weld speech into physical action + ending bullet loses its
//           "action" escape hatch (speech-vs-action no longer presented as alternatives).
// closing — mid-list rule untouched; the speech expectation is appended to the end-position contract
//           (recency-weighted slot the model demonstrably obeys).
const EDITS = {
  none: [],
  // gm — opening paragraph rewritten to the goalmaster role (active scene-runner, NPC initiative,
  //      advancement as job description); the pipeline/choices sentence is deleted (closing contract owns it).
  gm: [
    [/^You are the narrator stage[\s\S]*?(?=\n\n## Guidelines)/,
     "You are the narrator running a living scene. Each turn you write what happens next in vivid second-person prose: the player's latest action lands, and the world answers - the characters around them want things, act on those wants, and push the scene somewhere it wasn't before. If the story is just beginning, open the scene instead."],
  ],
  fuse: [
    [/- When characters are present, they speak[^\n]*\n/,
     "- Characters speak through what they do: their actual words land as quoted dialogue woven into their movements, and the more physical the moment, the more they voice it - urging, teasing, asking for what they want next. Their words respond to what the player just said or did and carry the scene onward.\n"],
    [/ending on a concrete image, action, or spoken line/,
     "ending on a spoken line or concrete image"],
  ],
  get gmfuse() { return [...this.gm, ...this.fuse]; }, // full stack: goalmaster opening + fused dialogue rule
  // gmlite — original opening kept intact; ONE initiative sentence appended to it (minimal goalmaster dose).
  gmlite: [
    [/(describing what happens in response to the player's most recent action - or the opening scene, if the story is just beginning\.)/,
     "$1 The characters around the player want things and act on those wants, pushing the scene somewhere it wasn't before."],
  ],
  get gmlitefuse() { return [...this.gmlite, ...this.fuse]; },
  closing: [
    [/(\[Player's turn\]\.)\s*$/,
     "$1 Every scene carries its characters' spoken words - quoted dialogue is part of the events, in the quietest and the most physical moments alike."],
  ],
};
function applyPatterns(key, table, mode) {
  const entries = table[key] ?? (() => { throw new Error(`unknown ${mode} '${key}'`); })();
  let s = FULL_SYSTEM;
  for (const e of entries) {
    const [re, to] = Array.isArray(e) ? e : [e, ""];
    const next = s.replace(re, to);
    if (next === s) throw new Error(`${mode} '${key}' pattern did not match the recorded prompt`);
    s = next;
  }
  return s;
}
const systemFor = (key) => applyPatterns(key, EDIT ? EDITS : ABLATIONS, EDIT ? "edit" : "ablation");
const ABLATE = strArg("--ablate", null)?.split(",").map((s) => s.trim()) ?? null;
const EDIT = strArg("--edit", null)?.split(",").map((s) => s.trim()) ?? null;
if (ABLATE && EDIT) throw new Error("--ablate and --edit are mutually exclusive");
const SYSTEM = FULL_SYSTEM; // arms mode uses the full prompt; ablation chains override per key
const ACTIONS = []; // index 0 is the "START GAME" opener; 1..N are the wordless actions
for (let i = 0; i < TURNS && rec[String(i)]; i++) ACTIONS.push(rec[String(i)].action);

// Narration is UNPINNED — no temperature/seed in the body so the endpoint's own config applies.
async function callNarration(messages) {
  const headers = { "Content-Type": "application/json" };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  const res = await fetch(ENDPOINT, {
    method: "POST", headers,
    body: JSON.stringify({ model: MODEL, messages, max_tokens: MAX_TOKENS, reasoning_effort: "none", stream: false }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const j = await res.json();
  return (j.choices?.[0]?.message?.content ?? "").trim();
}

// ── The three message assemblies ──
function buildMessages(arm, history, action, isOpening, sys = SYSTEM) {
  if (isOpening) return [{ role: "system", content: sys }, { role: "user", content: action }];
  if (arm === "C") {
    // Front-trim whole turns to stay inside the endpoint's context (cloud caps at 10750 tokens).
    let parts = history.map((h) => h.narration).filter(Boolean);
    let dropped = 0;
    while (parts.length > 1 && parts.join("\n\n").length > STORY_CAP) { parts.shift(); dropped++; }
    const story = (dropped ? "(earlier events omitted)\n\n" : "") + parts.join("\n\n");
    const user = `The story so far, as previously narrated:\n\n${story}\n\nPlayer action: ${action}`;
    return [{ role: "system", content: sys }, { role: "user", content: user }];
  }
  const msgs = [{ role: "system", content: sys }, { role: "user", content: "START GAME" }];
  for (let i = 0; i < history.length; i++) {
    msgs.push({ role: "assistant", content: history[i].narration });
    const a = i + 1 < history.length ? history[i + 1].action : action;
    msgs.push({ role: "user", content: arm === "B" ? a : `Player action: ${a}` });
  }
  // Window: drop oldest assistant/user pairs (after the opener) to stay inside the endpoint's context.
  while (msgs.reduce((n, m) => n + m.content.length, 0) > STORY_CAP + sys.length && msgs.length > 4) msgs.splice(2, 2);
  return msgs;
}

// ── Metrics ──
const grams5 = (text) => {
  const w = (text.toLowerCase().match(/[a-z']+/g) || []);
  const out = [];
  for (let i = 0; i + 5 <= w.length; i++) out.push(w.slice(i, i + 5).join(" "));
  return out;
};
function scoreTurn(text, seen) {
  const quotes = text.match(QUOTE_RE) || [];
  const words = (text.match(/\S+/g) || []).length;
  const g = grams5(text);
  const echo = g.filter((x) => seen.has(x)).length;
  for (const x of g) seen.add(x);
  const past = (text.match(/\b(was|were|answered|felt|found|let out|dug|met|raised|urged|pulled|pressed|seemed|made|said)\b/g) || []).length;
  const pres = (text.match(/\b(is|are|feels?|finds?|digs?|meets?|raises?|urges?|pulls?|presses?|seems?|makes?|says?)\b/g) || []).length;
  return {
    words,
    dialoguePct: Math.round((100 * quotes.reduce((a, q) => a + q.length, 0)) / (text.length || 1)),
    hasQuote: quotes.length > 0,
    freeze: (text.match(FREEZE_RE) || []).length,
    defer: DEFER_RE.test(text),
    echo5per100w: words ? +((100 * echo) / words).toFixed(1) : 0,
    paras: text.split(/\n\s*\n/).filter((p) => p.trim()).length,
    endQuestion: /\?\s*$/.test(text.trim()),
    bold: (text.match(/\*\*[^*]+\*\*/g) || []).length,
    menuLeak: /^\s*[-*\d]\.?\s/m.test(text) || /\b(Choose|Options:)\b/.test(text) || /\[[A-Z][^\]]*\]/.test(text),
    preg: /pregnan|impregnat|seed|fertile/i.test(text),
    pastDominant: past > pres,
  };
}
function collapsePoint(turns) {
  for (let i = 1; i + 2 < turns.length; i++)
    if (!turns[i].m.hasQuote && !turns[i + 1].m.hasQuote && !turns[i + 2].m.hasQuote) return i;
  return null;
}

// ── One serial chain: arm × run (label = arm or ablation key) ──
// Variant chains run under ARMS[0] (default A); e.g. `--edit none,fuse --arms B` stacks an edit on format B.
const labelFor = (arm, key) => key ? `${arm !== "A" ? arm + "+" : ""}${ABLATE ? "abl" : "edit"}-${key}` : arm;

async function runChain(arm, run, variantKey = null) {
  const sys = variantKey ? systemFor(variantKey) : SYSTEM;
  const label = labelFor(arm, variantKey);
  const history = []; // {action, narration}
  const turns = [];
  const seen = new Set();
  for (let t = 0; t < ACTIONS.length; t++) {
    const action = ACTIONS[t];
    const msgs = buildMessages(arm, history, action, t === 0, sys);
    let narration;
    try { narration = await callNarration(msgs); }
    catch (e) { console.error(`[${label} r${run} t${t}] ${e.message}`); narration = ""; }
    history.push({ action, narration });
    const m = scoreTurn(narration, seen);
    turns.push({ t, action, narration, m });
    if (verbose) console.log(`[${label} r${run} t${t}] dlg ${m.dialoguePct}% frz ${m.freeze} ${m.hasQuote ? "❝" : "·"}`);
  }
  return { arm: label, run, turns };
}

const VARIANTS = ABLATE ?? EDIT;
const LABELS = VARIANTS ?? ARMS;
console.log(`format-arms — ${LABELS.join("/")} × ${RUNS} runs × ${ACTIONS.length} turns · ${MODEL_LABEL} @ ${ENDPOINT}`);
console.log(`source: ${path.basename(SOURCE)} (system ${FULL_SYSTEM.length}ch, actions fixed)`);
if (VARIANTS) for (const k of VARIANTS) console.log(`  ${ABLATE ? "ablation" : "edit"} '${k}': system ${FULL_SYSTEM.length} -> ${systemFor(k).length}ch`);

// --serial: one chain at a time (local LM Studio — parallel slots split n_ctx and long chains need all of it)
const SERIAL = argv.includes("--serial");
const thunks = VARIANTS
  ? VARIANTS.flatMap((k) => Array.from({ length: RUNS }, (_, r) => () => runChain(ARMS[0], r + 1, k)))
  : ARMS.flatMap((arm) => Array.from({ length: RUNS }, (_, r) => () => runChain(arm, r + 1)));
const chains = [];
if (SERIAL) { for (const t of thunks) chains.push(await t()); }
else chains.push(...await Promise.all(thunks.map((t) => t())));

// ── Persist raw chains ──
const ts = new Date().toISOString().replace(/[:.]/g, "-");
for (const c of chains) {
  const file = path.join(HARNESS_DIR, "../runs", `format-${c.arm}-run${c.run}-${MODEL_LABEL}-${ts}.json`);
  await writeFile(file, JSON.stringify({ model: MODEL_LABEL, source: SOURCE, ...c }, null, 1));
}

// ── Report ──
const CHARGED_FROM = 5; // ambient escalation is fully underway by turn 5 in the recorded script
for (const label of LABELS) {
  const key = VARIANTS ? labelFor(ARMS[0], label) : label;
  console.log(`\n═══ ${ABLATE ? "ABLATION" : EDIT ? "EDIT" : "ARM"} ${key} ═══`);
  for (const c of chains.filter((x) => x.arm === key)) {
    const all = c.turns.slice(1); // skip the opening
    const charged = all.filter((x) => x.t >= CHARGED_FROM);
    const avg = (xs, f) => xs.length ? xs.reduce((a, x) => a + f(x.m), 0) / xs.length : 0;
    const cnt = (f) => all.filter((x) => f(x.m)).length;
    const cp = collapsePoint(c.turns);
    console.log(
      `run${c.run}: dialogue ${Math.round(avg(all, (m) => m.dialoguePct))}% · quoted turns ${cnt((m) => m.hasQuote)}/${all.length}` +
      ` · charged(t>=${CHARGED_FROM}) dlg ${Math.round(avg(charged, (m) => m.dialoguePct))}% quoted ${charged.filter((x) => x.m.hasQuote).length}/${charged.length}` +
      ` · freeze/turn ${avg(all, (m) => m.freeze).toFixed(2)} · defer ${cnt((m) => m.defer)}` +
      ` · words ${Math.round(avg(all, (m) => m.words))} · echo5 ${avg(all, (m) => m.echo5per100w).toFixed(1)}/100w` +
      ` · collapse@${cp ?? "—"}` +
      `\n       paras ${avg(all, (m) => m.paras).toFixed(1)} (max ${Math.max(...all.map((x) => x.m.paras))}, over6 ${cnt((m) => m.paras > 6)})` +
      ` · endQ ${cnt((m) => m.endQuestion)} · menuLeak ${cnt((m) => m.menuLeak)} · bold ${all.reduce((a, x) => a + x.m.bold, 0)}` +
      ` · preg ${cnt((m) => m.preg)}/${all.length} · pastDom ${cnt((m) => m.pastDominant)}/${all.length}`
    );
  }
}
console.log(`\nraw chains: testing/baseline/runs/format-{label}-run{n}-${MODEL_LABEL}-${ts}.json`);
