// ACTION LIST probe: does the narrator react to the panel actions Since Last Turn tells it, and only those?
//
// Each case is one turn in the Sedge Landing world: a prior exchange, the typed action (empty on a
// potion-only turn), one shown entry the request tells, and one hidden entry it never sends. Two arms,
// same seeds, in one batch:
//   control  the request as it was before the Action List: the action alone.
//   block    the shipped request: the action, then defaultActionListPrompt and one line per shown entry.
//   alt      the same block under the wrapper given in --alt, when set: a candidate wording, same batch.
//
// Metrics per case/run:
//   shown    a temp-0 judge: does the passage show the shown action (YES/NO). The control arm is the
//            false-positive floor: a typed action can lead the model there unprompted.
//   hidden   the hidden entry's item named on the page (regex). The hidden line is never sent, so this
//            should stay at the control's rate.
//   acted    a temp-0 judge on typed cases: does the passage still show the typed action. The block must
//            not crowd it out; the control arm is the reference.
//
//   node action-list-probe.mjs --runs 12
//     [--endpoint ... --model ...] [--only potion-only] [--alt "<wrapper>"] [--judge-endpoint ...] [--verbose]

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { callMessages, grab } from "./planner-probe-lib.mjs";
import { renderNarrationSys } from "./rider-arms.mjs";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const str = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const num = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? Number(argv[i + 1]) : d; };
const verbose = argv.includes("--verbose");

const RUNS = num("--runs", 3);
const SEED = num("--seed", 7);
const ONLY = str("--only", null);
const opts = {
  endpoint: str("--endpoint", "https://api.lyonade.net/v1/chat/completions"),
  model: str("--model", "default"),
  token: str("--token", process.env.PROBE_TOKEN || ""),
};
const judgeOpts = {
  endpoint: str("--judge-endpoint", "https://api.lyonade.net/v1/chat/completions"),
  model: str("--judge-model", "default"),
  token: opts.token,
};

const SYS = grab("defaultSystemPrompt");
const USER = grab("defaultNarrationUserPrompt");
const WRAPPER = grab("defaultActionListPrompt");
const ALT = str("--alt", null);
const ARMS = ALT ? ["control", "block", "alt"] : ["control", "block"];
// Markdown output is on by default; the source escapes its backticks.
const MARKDOWN = grab("MARKDOWN_DEFINITIONS").replaceAll("\\`", "`");

const world = JSON.parse(await readFile(path.join(HARNESS_DIR, "../sedge-landing.json"), "utf8"));
const describe = (x) => (x?.aiDescription || x?.description || "").trim();

const CASES = [
  {
    id: "potion-typed",
    location: "Sedge Landing",
    present: ["Bram"],
    prior: "Bram loops the tar-black rope around his forearm and studies the water. \"Gloamwater's running wrong,\" he says. \"No crossing till it settles.\"",
    action: "I ask Bram how long it will take to settle.",
    shown: "Used Healing Draught",
    question: "Does the passage show the player character drinking, or having just drunk, a healing draught?",
    hidden: { line: "Equipped Oilskin Hood", re: /\b(hood|oilskin)\b/i },
  },
  {
    id: "potion-only",
    location: "Sedge Landing",
    present: ["Bram"],
    prior: "The rope ferry knocks against the jetty. Bram coils line without looking up, and the river slides past brown and fast.",
    action: "",
    shown: "Used Healing Draught",
    question: "Does the passage show the player character drinking, or having just drunk, a healing draught?",
    hidden: { line: "Equipped Oilskin Hood", re: /\b(hood|oilskin)\b/i },
  },
  {
    id: "gift",
    location: "The Eelhouse",
    present: ["Odette"],
    prior: "Odette turns an eel on the rack and wipes her hands down her skirt. \"You've been stood there an hour,\" she says. \"Buying or not?\"",
    action: "I wait for her to notice.",
    shown: "Gave 3× Copper Coin to Odette",
    question: "Does the passage show the player character giving coins to Odette, or Odette having received them?",
    hidden: { line: "Dropped Fishing Line", re: /\bfishing[- ]line\b/i },
  },
  {
    id: "equip",
    location: "The Common Green",
    present: ["Tomas"],
    prior: "Tomas leans on the well-post and watches the light go. \"Long day for a stranger,\" he says.",
    action: "I tell him I'm heading for the hamlet.",
    shown: "Equipped Iron Sword",
    question: "Does the passage show or mention the player character wearing or carrying an iron sword?",
    hidden: { line: "Used Bread Roll", re: /\b(bread|roll)\b/i },
  },
].filter((c) => !ONLY || c.id === ONLY);

/** The narration request as the app sends it with thinking off, with or without the block. */
function messagesFor(c, arm) {
  const loc = world.locations.find((l) => l.name === c.location);
  const here = world.entities.filter((e) => c.present.includes(e.name));
  const sys = renderNarrationSys(SYS, {
    WORLD: world.worldOverview?.systemPrompt || "",
    PLAYER_TRAIT: "a traveler who came down to the landing on foot",
    LOCATION: `${loc.name}\n- **description:** ${describe(loc)}`,
    ENTITIES: here.map((e) => ({ name: e.name, type: e.type ?? "Person", description: describe(e) })),
  }, { markdown: MARKDOWN, length: "Aim for two to four tight paragraphs; land the moment and stop." });
  const turn = USER.replace("<PLAYER ACTION>", c.action);
  const wrapper = arm === "alt" ? ALT : WRAPPER;
  const block = arm === "control" ? "" : `\n\n${wrapper}\n- ${c.shown}`;
  return [
    { role: "system", content: sys },
    { role: "user", content: "Recap the story so far." },
    { role: "assistant", content: c.prior },
    { role: "user", content: turn + block },
  ];
}

const JUDGE_SYS = "You answer one question about a story passage with a single word: YES if the passage shows what the question describes, or NO if it does not. Judge only what the passage actually depicts. Nothing else.";
const judge = async (question, out) =>
  (await callMessages({ ...judgeOpts, maxTokens: 12, seed: 1, temp: 0, repPen: 1 },
    [{ role: "system", content: JUDGE_SYS }, { role: "user", content: `Question: ${question}\n\nPassage:\n${out}` }]))
    .trim().toLowerCase().startsWith("yes");
const actedQuestion = (c) => `Does the passage show the player character doing this: "${c.action}"?`;

console.log(`ACTION LIST · "${opts.model}" · ${CASES.length} case(s) × ${RUNS} run(s) × ${ARMS.length} arms · judge "${judgeOpts.model}"\n`);
console.log("case           arm       shown   hidden   acted");

const totals = Object.fromEntries(ARMS.map((arm) => [arm, { n: 0, shown: 0, hidden: 0, typed: 0, acted: 0 }]));
for (const c of CASES) {
  for (const arm of ARMS) {
    const messages = messagesFor(c, arm);
    let shown = 0, hidden = 0, acted = 0;
    for (let r = 0; r < RUNS; r++) {
      const out = await callMessages({ ...opts, maxTokens: 600, seed: SEED + r, temp: 0.8, repPen: 1 }, messages);
      const saw = await judge(c.question, out);
      const leak = c.hidden.re.test(out);
      const did = c.action ? await judge(actedQuestion(c), out) : false;
      shown += saw ? 1 : 0;
      hidden += leak ? 1 : 0;
      acted += did ? 1 : 0;
      if (verbose) console.log(`\n--- ${c.id} ${arm} #${r} shown=${saw} hidden=${leak} acted=${did}\n${out}\n`);
    }
    const t = totals[arm];
    t.n += RUNS; t.shown += shown; t.hidden += hidden;
    if (c.action) { t.typed += RUNS; t.acted += acted; }
    const actedCell = c.action ? `${acted}/${RUNS}` : "-";
    console.log(`${c.id.padEnd(14)} ${arm.padEnd(8)} ${`${shown}/${RUNS}`.padStart(6)} ${`${hidden}/${RUNS}`.padStart(8)} ${actedCell.padStart(7)}`);
  }
}
const pct = (k, arm, of = "n") => `${Math.round((100 * totals[arm][k]) / totals[arm][of])}%`;
console.log(`\nTOTAL ${ARMS.map((arm) => `${arm} shown ${pct("shown", arm)} hidden ${pct("hidden", arm)} acted ${pct("acted", arm, "typed")}`).join(" · ")}`);
