// Scores a REAL-APP baseline dump (the `dialoguehold` profile in profiles.json, run via `npm run
// baseline -- --profile dialoguehold --model gemma4-e4b-cloud`) on the same strict dialogue-hold bar as
// dialogue-hold-probe.mjs — so the harness verdict can be confirmed through the actual app pipeline
// (real prompts, banding, milestone selection, choices, drainers). Scoring logic is a copy of the
// probe's (PC attribution, >=2 NPC quoted sentences, temp-0 engagement judge).
//
//   node app-dialogue-score.mjs [--ts <dump timestamp substring>] [--model gemma4-e4b-cloud] [--nojudge]

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { QUOTE_RE } from "./planner-probe-lib.mjs";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const RUNS_DIR = path.join(HARNESS_DIR, "../runs");
const argv = process.argv.slice(2);
const strArg = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const TS = strArg("--ts", "");
const MODEL_LABEL = strArg("--model", "gemma4-e4b-cloud");
const JUDGE = !argv.includes("--nojudge");

const profiles = JSON.parse(await readFile(path.join(HARNESS_DIR, "profiles.json"), "utf8"));
const modelCfg = profiles.models.find((m) => m.label === MODEL_LABEL);
const ENDPOINT = modelCfg.endpointUrl ?? profiles.endpointUrl;
const MODEL = modelCfg.modelName ?? MODEL_LABEL;
const TOKEN = modelCfg.apiToken ?? profiles.apiToken ?? "";

async function call(messages, extra = {}) {
  const headers = { "Content-Type": "application/json" };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  const res = await fetch(ENDPOINT, {
    method: "POST", headers,
    body: JSON.stringify({ model: MODEL, reasoning_effort: "none", stream: false, ...extra, messages }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return ((await res.json()).choices?.[0]?.message?.content ?? "").trim();
}

// ── Strict scoring (copied from dialogue-hold-probe.mjs — keep in lockstep) ──
const PC_VERB = "(?:say|says|said|ask|asks|asked|whisper|whispers|murmur|murmurs|tell|tells|reply|replies|answer|answers|breathe|breathes|call|calls|promise|promises|offer|offers|add|adds|manage|manages|repeat|repeats|echo|echoes|prompt|prompts|urge|urges|press|presses|coax|coaxes|invite|invites|wonder|wonders|venture|ventures|continue|continues|begin|begins|muse|muses|tease|teases|insist|insists|note|notes|observe|observes|remark|remarks|admit|admits|confess|confesses|mutter|mutters|mumble|mumbles|voice|voices|speak|speaks|gasp|gasps|sigh|sighs|laugh|laughs|purr|purrs|plead|pleads|beg|begs|warn|warns|drawl|drawls|croon|croons)";
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
    if (PC_BEFORE.test(before) || PC_AFTER.test(after)) continue;
    out.push(m[0].replace(/^["“]|["”]$/g, ""));
  }
  return out;
}
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

// ── Load the newest matching dump ──
const files = (await readdir(RUNS_DIR)).filter((f) => f.startsWith(`dialoguehold-${MODEL_LABEL}-`) && f.includes(TS));
if (!files.length) throw new Error(`no dialoguehold-${MODEL_LABEL} dumps found in runs/ (pass --ts)`);
const file = files.sort().pop();
const dump = JSON.parse(await readFile(path.join(RUNS_DIR, file), "utf8"));
console.log(`app-dialogue-score — ${file} · ${dump.length} turns · judge ${JUDGE ? "on" : "OFF"}`);

// Turn 0 is the opener (not baited); score turns 1..N like the probe scores its 50 baited actions.
const scored = [];
for (let i = 1; i < dump.length; i++) {
  const t = dump[i];
  const nar = t.requests?.find((r) => r.type === "narration");
  const narration = typeof nar?.response === "string" ? nar.response : "";
  const action = [...(nar?.messages ?? [])].reverse().find((m) => m.role === "user")?.content ?? "";
  const ctxChars = (nar?.messages ?? []).reduce((n, m) => n + (m.content?.length ?? 0), 0);
  const msel = t.requests?.filter((r) => r.type === "milestoneSelect").length ?? 0;
  const quotes = narration ? npcQuotes(narration) : [];
  const sentences = quoteSentences(quotes);
  const bar = sentences >= 2;
  let engaged = false;
  if (bar && JUDGE) { try { engaged = await judgeEngages(action, quotes); } catch { engaged = true; } }
  scored.push({ i, participate: bar && (!JUDGE || engaged), bar, sentences, ctxChars, msel });
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const seq = scored.map((x) => (x.participate ? 1 : 0));
const n = seq.length, mx = (n - 1) / 2, my = mean(seq);
let num = 0, den = 0;
seq.forEach((y, i) => { num += (i - mx) * (y - my); den += (i - mx) ** 2; });
const slope = den ? num / den : 0;
const first8 = mean(seq.slice(0, 8)), mid = mean(seq.slice(8, n - 8)), last8 = mean(seq.slice(n - 8));
const glyphs = scored.map((x) => (x.participate ? "█" : x.bar ? "▒" : x.sentences > 0 ? "·" : " ")).join("");
console.log(`|${glyphs}|`);
console.log(`part ${seq.reduce((a, b) => a + b, 0)}/${n} · first8 ${(first8 * 100).toFixed(0)}% · mid ${(mid * 100).toFixed(0)}% · last8 ${(last8 * 100).toFixed(0)}% · slope ${(slope * 100).toFixed(2)}%/turn · ${last8 < first8 && slope < 0 ? "DECAY" : "steady"}`);
console.log(`ctx: mean ${Math.round(mean(scored.map((x) => x.ctxChars)) / 1000)}k chars · final-turn ${Math.round((scored.at(-1)?.ctxChars ?? 0) / 1000)}k chars`);
console.log(`milestoneSelect requests captured: ${scored.reduce((a, x) => a + x.msel, 0)} across ${scored.filter((x) => x.msel > 0).length} turns`);
