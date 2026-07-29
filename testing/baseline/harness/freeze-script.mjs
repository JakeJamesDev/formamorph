// Frozen self-play script generator — plays a real session (shipped narration prompt -> shipped choices
// prompt -> pick one option -> next turn) and writes the resulting player actions out as a committed corpus
// module. The point is a LONG action script that reads like real play but is byte-identical across arms, so
// a prompt A/B has the prompt as its only variable.
//
// Generated against the SHIPPED prompt on purpose: production default is the fair reference story. An arm
// that strips riders then replays the same actions, rather than steering its own plot.
//
// Choice picking is deterministic (round-robin by turn index) so a regenerate with the same seed and model
// reproduces the same script.
//
//   node freeze-script.mjs --turns 40 --out charged-long-corpus.mjs [--base ./charged-corpus.mjs]
//     [--endpoint https://api.lyonade.net/v1/chat/completions --model default] [--window 10] [--seed 7]

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { callMessages, grab } from "./planner-probe-lib.mjs";
import { renderNarrationSys, renderChoicesSys, VOICE_RIDER } from "./rider-arms.mjs";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const str = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const num = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? Number(argv[i + 1]) : d; };

const TURNS = num("--turns", 40);
const WINDOW = num("--window", 10);
const SEED = num("--seed", 7);
const OUT = str("--out", "charged-long-corpus.mjs");
const BASE = str("--base", "./charged-corpus.mjs");
const opts = {
  endpoint: str("--endpoint", "https://api.lyonade.net/v1/chat/completions"),
  model: str("--model", "default"),
  token: str("--token", process.env.PROBE_TOKEN || ""),
};

// The PC gets distinctive fixed features so the "don't re-describe the player" rider has something to
// measure; the base corpus's own trait line stays untouched for the probes already built on it.
const PC_TRAIT = str("--pctrait", null);
const PC_TIC = str("--pctic", null);
const DEFAULT_PC = {
  trait: "Alex, an adult in a loving, established relationship with both partners; tall, with close-cropped copper hair and a faded scar through one eyebrow.",
  // Anchored on "your" so it counts the PC being re-described, not a partner who happens to share a word
  // (the choices stage will occasionally hand the PC's features to someone else in the frozen script).
  tic: "/your (?:close-cropped |cropped |faded )*(?:copper hair|hair,? (?:close-)?cropped|scar|eyebrow)/gi",
};

const baseMod = await import(BASE);
const base = {
  ...baseMod,
  PLAYER_TRAIT: PC_TRAIT ?? DEFAULT_PC.trait,
};

// --speech-every N substitutes a vague speech action on every Nth turn instead of taking the choices
// stage's pick. The self-play story then continues FROM that speech turn, so the script stays coherent
// while guaranteeing measurable player-speech turns at every depth (the choices stage on its own drifts
// almost entirely physical, leaving a long-session L1 probe nothing to score past turn 10).
// A corpus supplies its own SPEECH_TURNS; these are the fallback and fit the charged base. A neutral
// world seeded with charged speech actions measures nothing about the neutral world.
const SPEECH_EVERY = num("--speech-every", 0);
const SPEECH_TURNS = baseMod.SPEECH_TURNS ?? [
  { action: "I tell them what I'm thinking.", mood: "unguarded, saying the quiet part" },
  { action: "I tell her exactly what I want tonight.", mood: "direct, wanting" },
  { action: "I admit what I've been holding back.", mood: "vulnerable, tired of hiding it" },
  { action: "I tease her about what she just did.", mood: "playful, teasing" },
  { action: "I ask them both what they want from me.", mood: "open, inviting an answer" },
];
const { ENTITIES } = base;
const PC_TIC_SRC = PC_TIC ?? DEFAULT_PC.tic;

const NARR_SYS = renderNarrationSys(grab("defaultSystemPrompt"), base, { markdown: grab("MARKDOWN_ON") });
const CHOICES_SYS = renderChoicesSys(grab("defaultChoicesPrompt"), base);
const CHOICES_USER = grab("defaultChoicesUserPrompt");
const OPENING_CUE = grab("OPENING_SCENE_CUE");

// The app's choices contract: one option per line, each starting "I ".
function parseOptions(text) {
  return text
    .split("\n")
    .map((l) => l.trim().replace(/^[-*\d.)\s]+/, "").replace(/^["“]|["”]$/g, "").trim())
    .filter((l) => /^I\s+\S/.test(l) && l.split(/\s+/).length >= 4);
}

const history = []; // {action, text}
const script = [];

for (let i = 0; i < TURNS; i++) {
  const win = history.slice(-WINDOW);
  const msgs = [{ role: "system", content: NARR_SYS }];
  for (const h of win) msgs.push({ role: "user", content: h.action }, { role: "assistant", content: h.text });

  // Turn 0 is the opening cue; every later turn is the bare action plus the shipped voice rider.
  const action = i === 0 ? null : script[i - 1].action;
  msgs.push({ role: "user", content: i === 0 ? OPENING_CUE : `${action}\n\n${VOICE_RIDER}` });

  const text = await callMessages({ ...opts, maxTokens: 600, seed: SEED, temp: 0.8, repPen: 1 }, msgs);
  history.push({ action: i === 0 ? "START GAME" : action, text });

  // Next action: the shipped choices stage, picked round-robin for determinism.
  const raw = await callMessages(
    { ...opts, maxTokens: 300, seed: SEED, temp: 0.8, repPen: 1 },
    [{ role: "system", content: CHOICES_SYS }, { role: "user", content: CHOICES_USER.replace("<NARRATION>", text) }],
  );
  const options = parseOptions(raw);
  if (!options.length) throw new Error(`turn ${i}: choices stage produced no parseable options:\n${raw.slice(0, 300)}`);
  // Seeded speech turns override the choices pick; the next narration answers them like any other action.
  const seedIdx = SPEECH_EVERY && (script.length + 1) % SPEECH_EVERY === 0 ? script.length / SPEECH_EVERY : -1;
  const seed = seedIdx >= 0 ? SPEECH_TURNS[Math.floor(seedIdx) % SPEECH_TURNS.length] : null;
  const next = seed ? seed.action : options[i % options.length];
  script.push(seed ? { action: seed.action, mood: seed.mood } : { action: next });
  console.log(`${String(i).padStart(2)}  ${options.length} opts  ->  ${next}`);
}

const module = `// Frozen self-play action script (${TURNS} turns) generated by freeze-script.mjs against the SHIPPED
// prompt on ${opts.model} (seed ${SEED}, window ${WINDOW}), seeded from ${BASE}'s opening turns. The actions
// came out of the real choices stage, so they read like play; they are frozen here so every prompt arm
// replays the identical script and the prompt is the only variable. Regenerate only deliberately — a new
// script invalidates comparison with earlier runs.
//
// World, cast, and location are re-exported from the base corpus unchanged.

export { WORLD, LOCATION, ENTITIES } from "${BASE}";

// The PC carries distinctive fixed features here (the base corpus's trait line is featureless), so the
// "don't re-describe the player each turn" rider has a countable metric.
export const PLAYER_TRAIT = ${JSON.stringify(base.PLAYER_TRAIT)};
export const PC_TIC_RE = ${PC_TIC_SRC};

export const TURNS = [
${script.map((t) => `  { action: ${JSON.stringify(t.action)},${t.mood ? ` mood: ${JSON.stringify(t.mood)},` : ""} present: [${ENTITIES.map((e) => JSON.stringify(e.name)).join(", ")}] },`).join("\n")}
];
`;

await writeFile(path.join(HARNESS_DIR, OUT), module, "utf8");
console.log(`\nwrote ${OUT} — ${script.length} turns`);
