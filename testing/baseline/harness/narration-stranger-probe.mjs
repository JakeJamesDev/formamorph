// NARRATION STRANGER probe — with Thinking Mode Off, does the narrator keep an unmet stranger's true name out
// of the prose when its roster block also carries the stranger label?
//
// Arms in one batch, rendered by the REAL shipped roster and template code (bundled from src):
//   A old  — the narration prompt from `--old`; the roster lists the stranger by true name only.
//   B new  — the shipped narration prompt; the stranger's roster block carries its label.
//   C alt  — optional, from `--alt`: a rival narration prompt, with the label.
//
// Cases: a stranger seen for the first time; a stranger whose name was gossiped in the player's hearing (Q71);
// a stranger with a story alias, whose label is that alias (Q70); a quiet turn; a long reply. One guard case
// asks the stranger's name, so there the name should appear.
//
// Metrics, per arm:
//   LEAK      any part of the stranger's true name appears in the narration. Lower is better.
//   LABEL     the label's key words appear in the narration. Higher is better.
//   CONTROL   the met entity named last turn is still named. Must hold in every arm.
//
//   node narration-stranger-probe.mjs --old <old GamePrompts.ts> --endpoint https://api.lyonade.net/v1/chat/completions --model default --runs 8

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { parseArgs } from "./planner-probe-lib.mjs";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HARNESS_DIR, "../../..");
const opts = parseArgs(process.argv, { runs: "8" });
const VERBOSE = process.argv.includes("--verbose");

const load = async (rel) => {
  const out = await build({
    entryPoints: [path.join(REPO_ROOT, rel)],
    bundle: true, format: "esm", write: false, platform: "node", logLevel: "silent",
    alias: { "@": path.join(REPO_ROOT, "src") },
    loader: { ".json": "json" },
  });
  return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString("base64")}`);
};
const tpl = await load("src/lib/promptTemplate.ts");
const lc = await load("src/lib/locationContext.ts");

const flag = (f) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : null; };
// A template literal's source with its line continuations and `\n` escapes applied, as JS does.
const unescape = (s) => s.replaceAll("\\\n", "").replaceAll("\\n", "\n");
/** The narration prompt in a GamePrompts.ts, English-only. */
function narrationPromptIn(file) {
  const source = readFileSync(file, "utf8");
  const from = source.indexOf("`", source.indexOf("defaultSystemPrompt = `")) + 1;
  return unescape(source.slice(from, source.indexOf("`;", from)).replaceAll("<LANGUAGE>", "").trimEnd());
}
if (!flag("--old")) throw new Error("pass --old <GamePrompts.ts with the old narration prompt>");
const PROMPTS = {
  A: narrationPromptIn(flag("--old")),
  B: narrationPromptIn(path.join(REPO_ROOT, "src/components/game/GamePrompts.ts")),
  ...(flag("--alt") && { C: narrationPromptIn(flag("--alt")) }),
};
// --nowforms (with --nowline): two more arms on the new prompt that vary only the Now Line's stranger.
//   D name  — the true name alone, no label.
//   E label — the label alone, in place of the name.
const NOW_FORMS = process.argv.includes("--nowforms");
if (NOW_FORMS) Object.assign(PROMPTS, { D: PROMPTS.B, E: PROMPTS.B });
const ARMS = Object.keys(PROMPTS);
const ARM_LABEL = { A: "A old", B: "B new", C: "C alt", D: "D name", E: "E label" };

const WORLD = "A walled river town in a low-magic fantasy realm. Trade barges, guild politics, rain.";
const PERSONA = { name: "Wren", aiDescription: "A courier for the river guild, quick and wary." };

const CASES = [
  {
    id: "first-sight",
    location: { name: "North Gate", aiDescription: "A stone gate with a toll booth and a muddy yard." },
    stranger: { id: "s", name: "Sylvie Thornwhistle", strangerName: "a hooded traveler", aiDescription: "A smuggler of letters who hides her face under a deep hood. Speaks softly, deflects questions about herself." },
    control: { id: "c", name: "Marr", aiDescription: "The gate guard, gruff and fair." },
    last: "Marr waves you through the toll with a grunt. Near the booth, a hooded traveler leans on a staff and watches the road.",
    action: "I walk over to the hooded traveler and ask where she is headed.",
    keys: ["hood"],
  },
  {
    id: "gossip",
    location: { name: "The Brass Kettle", aiDescription: "A smoky tavern by the docks." },
    stranger: { id: "s", name: "Corvin Ashby", strangerName: "a gaunt man in a gray cloak", aiDescription: "A disgraced alchemist who drinks alone and trusts no one." },
    control: { id: "c", name: "Hesta", aiDescription: "The barkeep, sharp-eyed and loud." },
    last: "Hesta slides your ale across. \"Corvin Ashby hasn't paid his tab in a month,\" she mutters. In the corner, a gaunt man in a gray cloak stares into his cup.",
    action: "I take my drink to the corner table and sit across from the gaunt man.",
    keys: ["gaunt", "gray cloak", "grey cloak"],
  },
  {
    id: "story-alias",
    location: { name: "Spice Row", aiDescription: "A covered market lane thick with scent." },
    stranger: { id: "s", name: "Isolde Varn", strangerName: "a spice merchant", alias: "the woman with copper earrings", aiDescription: "A guild informant posing as a trader. Friendly, curious about every buyer." },
    control: { id: "c", name: "Tobin", aiDescription: "A porter who carries for anyone who pays." },
    last: "Tobin sets down your crate and wipes his brow. At the next stall, the woman with copper earrings weighs saffron on a brass scale.",
    action: "I ask the woman with copper earrings what the saffron costs, and tell Tobin to wait.",
    keys: ["copper earring"],
  },
  {
    id: "idle-watch",
    location: { name: "Ferry Landing", aiDescription: "A plank dock where the night ferry ties up, lanterns swinging." },
    stranger: { id: "s", name: "Bastian Krell", strangerName: "a scarred boatman", aiDescription: "A former river pirate who now poles the ferry. Hums old shanties, watches every passenger." },
    control: { id: "c", name: "Odile", aiDescription: "The ferry clerk, who sells passage from a damp ledger." },
    last: "Odile stamps your ticket and points you to the bench. Down at the water, a scarred boatman coils rope and hums under his breath.",
    action: "I sit on the bench and watch the landing while we wait for the ferry to load.",
    keys: ["scar", "boatman"],
  },
  {
    id: "long-reply",
    location: { name: "Mill Road", aiDescription: "A rutted road past a creaking water mill." },
    stranger: { id: "s", name: "Maelis Dunmore", strangerName: "an old woman with a cart", aiDescription: "A retired guild spy who sells turnips and gossip. Talkative, proud, sharp memory." },
    control: { id: "c", name: "Pell", aiDescription: "The miller's boy, always underfoot." },
    last: "Pell runs past chasing a goose. At the roadside, an old woman with a cart of turnips waves you over.",
    action: "I help the old woman lift a fallen sack back onto her cart and ask how long she has worked this road.",
    keys: ["old woman"],
  },
  {
    // The guard: the stranger is asked their name and has no reason to hide it, so the name should appear.
    id: "asked-name",
    intro: true,
    location: { name: "Lamp Street", aiDescription: "A narrow street of lamp-makers' shops." },
    stranger: { id: "s", name: "Tamsin Holloway", strangerName: "a lamp-maker's apprentice", aiDescription: "A cheerful apprentice who loves to chat and tells everyone her name." },
    control: { id: "c", name: "Garrick", aiDescription: "The master lamp-maker, busy at his bench." },
    last: "Garrick grunts at you from his bench. A lamp-maker's apprentice polishes brass by the window and smiles at you.",
    action: "I tell the apprentice my name and ask hers.",
    keys: ["apprentice"],
  },
];

const labelOf = (c) => c.stranger.alias ?? c.stranger.strangerName;

/** The narration system prompt for one arm, filled through the shipped template renderer and roster. */
function system(c, arm) {
  const roster = lc.renderEntityRoster(["s", "c"], [c.stranger, c.control], {
    format: "markdown", ...(arm !== "A" && { strangerLabels: { s: labelOf(c) } }),
  });
  const values = (key) => {
    if (key === "<LENGTH GUIDANCE>") return "Write at most 4 short paragraphs.";
    if (key.startsWith("<WORLD DESCRIPTION")) return WORLD;
    if (key === "<PERSONA|name>") return PERSONA.name;
    if (key.startsWith("<PERSONA")) return `- **${PERSONA.name}**\n  - **description:** ${PERSONA.aiDescription}\n`;
    if (key === "<LOCATION|markdown>") return `- **${c.location.name}**\n  - **description:** ${c.location.aiDescription}`;
    if (key === "<ENTITIES|markdown>") return roster;
    return "";
  };
  return tpl.renderPromptTemplate(PROMPTS[arm], values);
}

// --nowline: the history opens with a recap pair whose reply ends on the Now Line, as when a digest band exists.
const NOW_LINE = process.argv.includes("--nowline")
  ? unescape(readFileSync(path.join(REPO_ROOT, "src/components/game/GamePrompts.ts"), "utf8")
    .match(/defaultNowLinePrompt = `([^`]*)`/)[1])
  : null;
/** The Now Line for one arm: the stranger and the met entity in scene, name-only. */
function nowLine(c, arm) {
  const stranger = arm === "E" ? { ...c.stranger, name: labelOf(c) } : c.stranger;
  const inScene = lc.renderEntityRoster(["s", "c"], [stranger, c.control], {
    nameOnly: true, ...(!["A", "D", "E"].includes(arm) && { strangerLabels: { s: labelOf(c) } }),
  });
  return tpl.renderPromptTemplate(NOW_LINE, (key) => {
    if (key === "<LOCATION|name>") return c.location.name;
    if (key.startsWith("<ENTITIES|inscene.name")) return inScene;
    return "";
  });
}
const recap = (c, arm) => NOW_LINE ? [
  { role: "user", content: "Recap the story so far." },
  { role: "assistant", content: `You came to ${c.location.name} on a guild errand and have been here a while.\n\n${nowLine(c, arm)}` },
] : [];

/** The Thinking Mode Off message shape: last turn's narration, then the action and its cue. */
const messages = (c, arm) => [
  { role: "system", content: system(c, arm) },
  ...recap(c, arm),
  { role: "user", content: "I head on." },
  { role: "assistant", content: c.last },
  {
    role: "user",
    content: `${c.action}\n\nThe player's action is the turn's first beat, written as it happens - an action that speaks reaches the page as the player's own quoted sentences, carrying the feeling the action names, and then the character answers in their own quoted voice with something of their own.`,
  },
];

const rx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hasWord = (text, w) => new RegExp(`\\b${rx(w)}`, "i").test(text);
const score = (text, c) => ({
  leak: c.stranger.name.split(/\s+/).some((p) => hasWord(text, p)),
  label: c.keys.some((k) => hasWord(text, k)),
  control: hasWord(text, c.control.name),
});

// Render guard: arm A lists the true name with no label; every other arm carries the label.
for (const c of CASES) {
  const a = system(c, "A");
  if (!a.includes(`**${c.stranger.name}**`) || a.includes("stranger name")) throw new Error(`${c.id}: arm A rendered wrong`);
  for (const arm of ARMS.slice(1)) {
    if (!system(c, arm).includes(`**stranger name:** ${labelOf(c)}`)) throw new Error(`${c.id}: arm ${arm} lacks the label`);
  }
}
if (process.argv.includes("--dry")) {
  console.log(system(CASES[0], "B"));
  if (NOW_LINE) for (const arm of ["A", "B"]) console.log(`\n${arm}: ${nowLine(CASES[0], arm)}`);
  process.exit(0);
}

/** One narration call. Narration pins no sampler, so a custom endpoint gets no temperature or penalty. */
async function narrate(messages) {
  const headers = { "Content-Type": "application/json" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await fetch(opts.endpoint, {
    method: "POST", headers,
    body: JSON.stringify({ model: opts.model, messages, max_tokens: 600, reasoning_effort: "none", stream: false }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const j = await res.json();
  return (j.choices?.[0]?.message?.content ?? "").trim();
}

const jobs = [];
for (let i = 0; i < opts.runs; i++) for (const c of CASES) for (const arm of ARMS) jobs.push({ c, arm, i });
const results = await Promise.all(jobs.map(async (j) => {
  try {
    const text = await narrate(messages(j.c, j.arm));
    return { ...j, text, ...score(text, j.c) };
  } catch (err) {
    return { ...j, error: String(err) };
  }
}));
console.log(`model ${opts.model} · runs ${opts.runs} per case per arm · ${CASES.length} cases`);
const SAVE = flag("--save");
if (SAVE) writeFileSync(SAVE, JSON.stringify(results.map((r) => ({ case: r.c.id, arm: r.arm, i: r.i, text: r.text, error: r.error })), null, 1));

const pct = (n, d) => (d ? `${String(Math.round((n / d) * 100)).padStart(3)}%` : "  n/a");
const row = (rs) => {
  const ok = rs.filter((r) => !r.error);
  const sum = (k) => ok.filter((r) => r[k]).length;
  return `n ${String(ok.length).padStart(2)}  LEAK ${pct(sum("leak"), ok.length)} (${sum("leak")})  LABEL ${pct(sum("label"), ok.length)}  CONTROL ${pct(sum("control"), ok.length)}`
    + (rs.length - ok.length ? `  errors ${rs.length - ok.length}` : "");
};
for (const c of CASES) {
  for (const arm of ARMS) console.log(`${c.id.padEnd(12)} ${ARM_LABEL[arm]}  ${row(results.filter((r) => r.c === c && r.arm === arm))}`);
}
// ALL leaves out the guard, where the name belongs on the page; its LEAK column reads as "named".
for (const arm of ARMS) console.log(`${"ALL".padEnd(12)} ${ARM_LABEL[arm]}  ${row(results.filter((r) => r.arm === arm && !r.c.intro))}`);
if (VERBOSE) for (const r of results) console.log(`\n--- ${r.c.id} ${r.arm} #${r.i} leak=${r.leak}\n${r.text ?? r.error}`);
