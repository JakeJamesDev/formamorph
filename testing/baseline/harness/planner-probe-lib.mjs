// Shared harness for the three planner-defect probes. They all fire the REAL continuity planner
// (`defaultThinkingPrompt`) exactly as the game's precall stage does — same system fill, same user
// assembly ("What just happened:" + "The player's next action:" + the closing cue), same cap (256), and
// the same pinned sampler (thinking: temperature 0.4 / repetition_penalty 1, per promptSamplers.ts). The
// planner is where the analyzed session's failures originate (narration renders the plan near-verbatim),
// so all three probes target its output rather than narration.
//
// Content: cases are consenting-adult and charged but non-graphic (intimacy-onset level, matching the
// tracked gate world's turn 9). Explicit anatomy is avoided; entity-fidelity uses a SFW distinctive trait.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HARNESS_DIR, "../../..");

export function parseArgs(argv, defaults = {}) {
  const args = argv.slice(2);
  const val = (f, d = null) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
  return {
    endpoint: val("--endpoint", "http://127.0.0.1:1234/v1/chat/completions"),
    model: val("--model", "cydonia-24b-v4.3@q4_k_m"),
    runs: Number(val("--runs", defaults.runs ?? "3")),
    maxTokens: Number(val("--max", "256")),
    seed: Number(val("--seed", "7")),
    repPen: Number(val("--reppen", "1")), // thinking pin default is 1; override to trial de-repetition
    only: val("--only"),
    token: val("--token", process.env.PROBE_TOKEN || ""),
  };
}

// Pull the live prompt text from source so editing GamePrompts.ts is all that's needed between runs.
const source = await readFile(path.join(REPO_ROOT, "src/components/game/GamePrompts.ts"), "utf8");
export function grab(name) {
  const at = source.indexOf(name + " = `");
  if (at === -1) throw new Error("missing " + name);
  const from = source.indexOf("`", at) + 1;
  return source.slice(from, source.indexOf("`;", from));
}
const THINK = grab("defaultThinkingPrompt");

const renderEntities = (entities) =>
  entities.map((e) => `- **${e.name}**\n  - **description:** ${e.description}\n  - **type:** ${e.type}`).join("\n");

/** Fill the planner system prompt from a case (world, playerTrait, location, entities). */
export function renderThinkingSys(c) {
  return THINK
    .replaceAll("<WORLD DESCRIPTION>", c.world)
    .replaceAll("<TRAITS DESCRIPTION|markdown>", `- **Identity:** ${c.playerTrait}`)
    .replaceAll("<LOCATION|summary.markdown>", `- **name:** ${c.location}`)
    .replaceAll("<LOCATION|sublocations.summary.markdown>", "N/A")
    .replaceAll("<LOCATION|reachable.summary.markdown>", "N/A")
    .replaceAll("<ENTITIES|summary.markdown>", renderEntities(c.entities))
    .replaceAll("<ENTITIES|sublocations.summary.markdown>", "N/A")
    .replaceAll("<ENTITIES|reachable.summary.markdown>", "N/A")
    .replaceAll("<NOTES>", c.notes ?? "None");
}

/** Assemble the planner user message exactly as GameViewer's precall stage does. */
export function buildThinkingUser(recap, action) {
  return `${recap ? `What just happened:\n${recap}\n\n` : ""}The player's next action: ${action}\n\nSet the scene, list the cast, and lay out the beats now. Do not narrate.`;
}

/** Fire an arbitrary message array at the model with the production thinking sampler pins. */
export async function callMessages({ endpoint, model, token, maxTokens, seed, repPen = 1, temp = 0.4 }, messages) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(endpoint, {
    method: "POST", headers,
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature: temp,         // default 0.4 (thinking pin); summary pins 0
      repetition_penalty: repPen, // thinking pin (default 1); --reppen to trial de-repetition
      seed,                      // LM Studio (llama.cpp) honors this → reproducible baselines
      reasoning_effort: "none",  // harmless on Cydonia; keeps parity with other probes
      stream: false,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const j = await res.json();
  return (j.choices?.[0]?.message?.content ?? "").trim();
}

/** One planner call from a system + user pair (the synthetic probes' shape). */
export function callPlanner(opts, sys, user) {
  return callMessages(opts, [{ role: "system", content: sys }, { role: "user", content: user }]);
}

// Shared scoring for a plan's Beats (or whole text). Kept here so the synthetic and replay probes agree.
export const FREEZE_RE = /\b(goes? (?:completely )?still|stills|freezes?|goes? rigid|motionless|hangs? (?:suspended|in the air)|processes?|processing|registers?|takes? in (?:the|your) words|breath (?:catches|hitches)|pupils? dilat\w*|eyes? widen\w*|grip tighten\w*|tightens? (?:her|his|their) grip|goes? quiet|says? nothing|frozen|suspended|paralys\w*|unspoken)\b/gi;
export const NPC_FORWARD_RE = /\b(reaches?|pulls?|slides?|leans? in|presses? forward|guides?|takes? your|takes? his|takes? her|tugs?|unbutton\w*|unzip\w*|stands?|rises?|moves? (?:to|toward|closer)|steps?|kisses?|deepen\w*|grabs?|lifts?|draws? you|answers?|replies?|nods? and|tells? you|leads?|whispers? back|climbs?|shifts? (?:to|onto)|wraps?|thrust\w*|grinds?)\b/gi;
export const QUOTE_RE = /("[^"]{2,}"|[“][^”]{2,}[”])/g;
// Deferral: a character (or the narrator) handing the decision back to the player instead of acting.
export const DEFER_RE = /\b(are you (?:absolutely |really )?sure|if you (?:want|wanted|like|need)|only if you|we don'?t have to|do you want (?:me|to|this)|what do you want|what (?:do|would) you (?:like|need)|is (?:this|that) (?:what|okay|alright)|should i (?:keep|stop|continue)|tell me what you (?:want|need)|you sure about this)\b/i;

/** Score a plan's Beats text for the three failure signatures. */
export function scorePlan(beats) {
  const freeze = (beats.match(FREEZE_RE) || []).length;
  const npcAction = NPC_FORWARD_RE.test(beats);
  const npcSpeech = QUOTE_RE.test(beats);
  const defer = DEFER_RE.test(beats);
  const stall = freeze >= 2 && !npcAction && !npcSpeech;
  return { freeze, npcAction, npcSpeech, defer, stall };
}

/** Split a planner response into its Scene / Cast / Beats sections (case-insensitive labels). */
export function parsePlan(text) {
  const grabSection = (label, next) => {
    const re = new RegExp(`${label}\\s*:?\\s*([\\s\\S]*?)(?=\\n\\s*(?:${next})\\s*:|$)`, "i");
    const m = text.match(re);
    return m ? m[1].trim() : "";
  };
  return {
    scene: grabSection("Scene", "Cast|Beats"),
    cast: grabSection("Cast", "Beats"),
    beats: grabSection("Beats", "$a"),
  };
}

/** Jaccard word overlap of two strings (lowercased, alnum tokens ≥3 chars) — a cheap echo/similarity gauge. */
export function jaccard(a, b) {
  const toks = (s) => new Set((s.toLowerCase().match(/[a-z0-9]{3,}/g) || []));
  const A = toks(a), B = toks(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

// Fire every job concurrently — LM Studio runs as many as the model's parallel slots allow and QUEUES the
// rest, so there's no benefit to throttling here. Keep jobs independent (per-request seed) so order is moot.
export const runAll = (items, fn) => Promise.all(items.map((it, i) => fn(it, i)));

export function printOut(text, indent = "      ") {
  return text.split("\n").filter(Boolean).map((l) => indent + l).join("\n");
}
