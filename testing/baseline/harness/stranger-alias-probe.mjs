// STRANGER ALIAS probe — does the precall planner cast an unmet stranger under its label, and keep the true
// name out of the plan?
//
// Two arms in one batch, rendered by the REAL shipped roster and template code (bundled from src):
//   A old  — the planner prompt from `--old`; the roster carries no stranger name.
//   B new  — the shipped planner prompt; each unmet stranger's roster block carries its label.
//   C alt  — optional, from `--alt`: a rival wording, with the label.
//
// Cases: a stranger met for the first time; a stranger whose name was gossiped while away (Q71); a stranger
// with a story alias, whose label is that alias (Q70). Each case also holds a met entity named last turn.
//
// Metrics, per arm:
//   LEAK      the true name appears in the raw plan outside the cast's "Real (alias)" pair. Lower is better.
//   SHOWN     the true name survives the code backstop into what the narrator reads. Lower is better.
//   BEATS     the same, in the Beats alone.
//   LABEL     the stranger's cast bullet carries the label as its alias, word for word. Higher is better.
//   CONTROL   the met entity is cast plainly by name, no parentheses. Must hold in both arms.
//
//   node stranger-alias-probe.mjs --old <old GamePrompts.ts> --endpoint https://api.lyonade.net/v1/chat/completions --model default --runs 8

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { parseArgs, callMessages, grab, parsePlan } from "./planner-probe-lib.mjs";

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
const sp = await load("src/lib/stagedPlanning.ts");

// A template literal's source with its line continuations and `\n` escapes applied, as JS does.
const unescape = (s) => s.replaceAll("\\\n", "").replaceAll("\\n", "\n");
const NEW = unescape(grab("defaultThinkingPrompt"));
const flag = (f) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : null; };
/** The planner prompt in another GamePrompts.ts (e.g. `git show <base>:src/components/game/GamePrompts.ts`). */
function plannerPromptIn(file) {
  const source = readFileSync(file, "utf8");
  const from = source.indexOf("`", source.indexOf("defaultThinkingPrompt = `")) + 1;
  return unescape(source.slice(from, source.indexOf("`;", from)).replaceAll("<LANGUAGE>", "").trimEnd());
}
// --old: the old planner prompt (arm A, no labels). --alt: an optional rival wording (arm C, with labels).
if (!flag("--old")) throw new Error("pass --old <GamePrompts.ts with the old planner prompt>");
const PROMPTS = { A: plannerPromptIn(flag("--old")), B: NEW, ...(flag("--alt") && { C: plannerPromptIn(flag("--alt")) }) };
const ARMS = Object.keys(PROMPTS);
const ARM_LABEL = { A: "A old", B: "B new", C: "C alt" };
if (PROMPTS.A === NEW) throw new Error("--old holds the same planner prompt as the source");

const WORLD = "A walled river town in a low-magic fantasy realm. Trade barges, guild politics, rain.";
const PERSONA = { id: "me", name: "Wren", aiSummary: "A courier for the river guild, quick and wary." };

const CASES = [
  {
    id: "first-sight",
    location: { name: "North Gate", summary: "A stone gate with a toll booth and a muddy yard." },
    stranger: { id: "s", name: "Sylvie Thornwhistle", strangerName: "a hooded traveler", aiSummary: "A smuggler of letters who hides her face." },
    control: { id: "c", name: "Marr", aiSummary: "The gate guard, gruff and fair." },
    last: "Marr waves you through the toll with a grunt. Near the booth, a hooded traveler leans on a staff and watches the road.",
    action: "I walk over to the hooded traveler and ask where she is headed.",
  },
  {
    id: "gossip",
    location: { name: "The Brass Kettle", summary: "A smoky tavern by the docks." },
    stranger: { id: "s", name: "Corvin Ashby", strangerName: "a gaunt man in a gray cloak", aiSummary: "A disgraced alchemist who drinks alone." },
    control: { id: "c", name: "Hesta", aiSummary: "The barkeep, sharp-eyed and loud." },
    last: "Hesta slides your ale across. \"Corvin Ashby hasn't paid his tab in a month,\" she mutters. In the corner, a gaunt man in a gray cloak stares into his cup.",
    action: "I take my drink to the corner table and sit across from the gaunt man.",
  },
  {
    id: "story-alias",
    location: { name: "Spice Row", summary: "A covered market lane thick with scent." },
    stranger: { id: "s", name: "Isolde Varn", strangerName: "a spice merchant", alias: "the woman with copper earrings", aiSummary: "A guild informant posing as a trader." },
    control: { id: "c", name: "Tobin", aiSummary: "A porter who carries for anyone who pays." },
    last: "Tobin sets down your crate and wipes his brow. At the next stall, the woman with copper earrings weighs saffron on a brass scale.",
    action: "I ask the woman with copper earrings what the saffron costs.",
  },
];

const labelOf = (c) => c.stranger.alias ?? c.stranger.strangerName;
const NAMES = [PERSONA.name, ...CASES.flatMap((c) => [c.stranger.name, c.control.name])];

/** The planner's system prompt for one arm, filled through the shipped template renderer and roster. */
function system(c, arm) {
  const entities = [c.stranger, c.control];
  const roster = lc.renderEntityRoster(["s", "c"], entities, {
    preferSummary: true, format: "markdown", ...(arm !== "A" && { strangerLabels: { s: labelOf(c) } }),
  });
  const values = (key) => {
    if (key.startsWith("<WORLD DESCRIPTION")) return WORLD;
    if (key.startsWith("<PERSONA")) return `- **${PERSONA.name}**\n  - **summary:** ${PERSONA.aiSummary}\n`;
    if (key === "<LOCATION|summary.markdown>") return `- **${c.location.name}**\n  - **summary:** ${c.location.summary}`;
    if (key === "<ENTITIES|summary.markdown>") return roster;
    return "N/A";
  };
  return tpl.renderPromptTemplate(PROMPTS[arm], values);
}

const user = (c) =>
  `What just happened:\n${c.last}\n\nThe player's next action: ${c.action}\n\nList the cast and lay out the beats now. Do not narrate.`;

const rx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const norm = (s) => (s ?? "").toLowerCase().replace(/[.,;:!"']/g, "").replace(/\s+/g, " ").trim();
const parts = (name) => name.split(/\s+/);

/** Whether any part of `name` appears in `text` outside a "Real (alias)" pair. */
function leaks(text, name) {
  let rest = text;
  for (const p of [name, ...parts(name)]) rest = rest.replace(new RegExp(`\\b${rx(p)}\\b\\s*\\([^)]*\\)`, "g"), "");
  return parts(name).some((p) => new RegExp(`\\b${rx(p)}\\b`).test(rest));
}

/** What the narrator would read: the backstop with each arm's reveal rule. */
function shown(raw, c, arm) {
  const isStranger = (n) => parts(c.stranger.name).some((p) => norm(n).includes(norm(p)));
  const heard = (n) => new RegExp(`\\b${rx(n)}\\b`, "i").test(c.last);
  return arm !== "A"
    ? sp.sanitizePlanForReveal(raw, (n) => (isStranger(n) ? false : heard(n)), { labelFor: (n) => (isStranger(n) ? labelOf(c) : null), otherNames: NAMES })
    : sp.sanitizePlanForReveal(raw, heard, { otherNames: NAMES });
}

function score(raw, c, arm) {
  const { cast } = sp.parseDirectorCast(raw);
  const member = cast.find((m) => parts(c.stranger.name).some((p) => norm(m.name).split(" ").includes(norm(p))));
  const control = cast.find((m) => norm(m.name) === norm(c.control.name));
  const seen = shown(raw, c, arm);
  return {
    leak: leaks(raw, c.stranger.name),
    shown: leaks(seen, c.stranger.name),
    beats: leaks(parsePlan(seen).beats, c.stranger.name),
    label: !!member && norm(member.alias) === norm(labelOf(c)),
    cast: !!member,
    control: !!control && !control.alias,
  };
}

// Render guard: each arm carries the roster, and only arm B the label.
for (const c of CASES) {
  const a = system(c, "A"), b = system(c, "B");
  if (!a.includes(`**${c.stranger.name}**`) || a.includes("stranger name") || !b.includes(`**stranger name:** ${labelOf(c)}`)) {
    throw new Error(`${c.id}: arms rendered wrong`);
  }
}
if (process.argv.includes("--dry")) { console.log(system(CASES[2], "B")); process.exit(0); }

// --save writes the raw plans; --replay re-scores saved plans, so a backstop change is judged on the same outputs.
const SAVE = flag("--save");
const REPLAY = flag("--replay");
const byId = new Map(CASES.map((c) => [c.id, c]));

const jobs = [];
for (const c of CASES) for (const arm of ARMS) for (let i = 0; i < opts.runs; i++) jobs.push({ c, arm, i });
const results = REPLAY
  ? JSON.parse(readFileSync(REPLAY, "utf8")).map((r) => {
    const c = byId.get(r.case);
    return { c, arm: r.arm, i: r.i, raw: r.raw, error: r.error, ...(r.raw != null ? score(r.raw, c, r.arm) : {}) };
  })
  : await Promise.all(jobs.map(async (j) => {
  try {
    const raw = await callMessages(
      { ...opts, maxTokens: 256, temp: 0.4, seed: 7 + j.i * 31 },
      [{ role: "system", content: system(j.c, j.arm) }, { role: "user", content: user(j.c) }],
    );
    return { ...j, raw, ...score(raw, j.c, j.arm) };
  } catch (err) {
    return { ...j, error: String(err) };
  }
}));
console.log(REPLAY ? `replay ${REPLAY}` : `model ${opts.model} · runs ${opts.runs} per case per arm · ${CASES.length} cases`);
if (SAVE) writeFileSync(SAVE, JSON.stringify(results.map((r) => ({ case: r.c.id, arm: r.arm, i: r.i, raw: r.raw, error: r.error })), null, 1));

const pct = (n, d) => (d ? `${String(Math.round((n / d) * 100)).padStart(3)}%` : "  n/a");
const row = (rs) => {
  const ok = rs.filter((r) => !r.error);
  const sum = (k) => ok.filter((r) => r[k]).length;
  return `n ${String(ok.length).padStart(2)}  LEAK ${pct(sum("leak"), ok.length)}  SHOWN ${pct(sum("shown"), ok.length)}  BEATS ${pct(sum("beats"), ok.length)}  `
    + `LABEL ${pct(sum("label"), ok.length)}  CAST ${pct(sum("cast"), ok.length)}  CONTROL ${pct(sum("control"), ok.length)}`
    + (rs.length - ok.length ? `  errors ${rs.length - ok.length}` : "");
};
for (const c of CASES) {
  for (const arm of ARMS) console.log(`${c.id.padEnd(12)} ${ARM_LABEL[arm]}  ${row(results.filter((r) => r.c === c && r.arm === arm))}`);
}
for (const arm of ARMS) console.log(`${"ALL".padEnd(12)} ${ARM_LABEL[arm]}  ${row(results.filter((r) => r.arm === arm))}`);
if (VERBOSE) for (const r of results) console.log(`\n--- ${r.c.id} ${r.arm} #${r.i} leak=${r.leak} label=${r.label}\n${r.raw ?? r.error}`);
