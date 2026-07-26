// OPENING-TIME probe — should the opening-time pass be allowed to say "unstated", or be forced to pick a
// daypart? This is the one open question in the game-start clock design (docs-internal/time-system-design.md):
// everything else about it is settled, and the answer decides the shipped prompt.
//
// The pass runs once at game start, AFTER the opening narration and with <TIME> suppressed, and its answer
// seeds `startHour` on the save envelope. It asks for a DAYPART from the closed set gameClock's `daypart()`
// already emits — never a clock reading — for the same reason the delta pass asks for a duration and not a
// date: a small model picks from six words reliably and cannot do calendar arithmetic.
//
// A 2x2, run together on one set of narrations so neither axis is confounded by the other:
//
//        hatch axis                          gloss axis
//   A  — the set plus `unstated`        (none) — the six words, unexplained
//   B  — the six dayparts only          g      — plus a verbal gloss of where each word falls
//
// The hatch axis is unsettled because the tiers disagree: cloud declined 0 times in 264 (the hatch is inert
// there), while Cydonia declined 27% — and only on scenes with no sky, never on one that states a time.
// The gloss axis targets a measured miss: both tiers read "a few hours past noon" as `midday`, i.e. they
// know the six words but not where gameClock's boundaries actually sit.
//
// Both prompts live HERE, not in GamePrompts.ts, because the arms *are* the candidate prompt and the probe
// is what decides which one ships. Move the winner into GamePrompts.ts as `defaultOpeningTimePrompt`.
//
// Cases split by what they are actually able to measure:
//
//   stated   — authored openings that name a time (../opening-time-cases.json). Real worlds could not
//              supply these: a sweep of every tracked test world found NO time-of-day language in any
//              starting location, only ambient lamps. That absence is why this probe exists, so the stated
//              group is authored the way time-delta-cases.json is, with a ground-truth daypart each.
//              Includes a genuine `morning` case so accuracy cannot be gamed by never answering the value
//              the game already defaults to, and an `afternoon` case a night-leaning model cannot fake.
//   unstated — the REAL test worlds, since that is the true distribution. Nothing here has a right answer.
//
// Metrics:
// EVERY `locationDesc` here is deliberately timeless, and the stated cases put their time in the opening
// ACTION instead. That is not a stylistic choice — it is what makes the location-description arm honest.
// With the time written into the description, a loc arm would simply be handed the answer, and would score
// well for a reason that cannot generalize: the world sweep found no real world that states a time in its
// location text. Putting it in the action matches how the app actually works (the opening cue is editable
// prose sent verbatim to narration only), keeps the descriptions looking like real authored ones, and
// leaves the narration as the sole route by which a time can reach the pass.
//
// Metrics:
//   stated    ACCURACY   answer is in the case's ground-truth set. The headline number for both arms.
//             FALSE-HATCH (arm A only) answered `unstated` on a passage that does state a time. This is the
//                        hatch's real cost and the number that would sink arm A.
//   unstated  HATCH RATE (arm A only) how often it declines.
//             AGREEMENT  per case, the modal answer's share across runs — does it read a stable signal?
//             SPREAD     how many DISTINCT modal dayparts across the unstated cases. This is the decider and
//                        the one that is easy to get wrong: an arm that confidently answers `morning` for
//                        every world scores perfect agreement while being exactly identical to the 08:00
//                        default it was supposed to improve on. Consistency only counts if it varies.
//   INVALID   replies outside the closed set, both arms, as the contract check.
//
// The narration is generated per case from the REAL defaultSystemPrompt, so the probe measures the whole
// chain the feature will use — world text -> opening prose -> the pass -- rather than handing the pass the
// authored description directly. A stated case whose narration silently drops the time is a real failure of
// the design, and this is where it would show up.
//
// Sampler: narration at temp 0.7 (the game's narration pin), the pass at temp 0 (classifier, matching the
// timePassed pin). Cloud is nondeterministic at temp 0, hence the higher run count there.
//
//   node opening-time-probe.mjs --endpoint https://api.lyonade.net/v1/chat/completions --model default --runs 12
//   node opening-time-probe.mjs --runs 3 [--only vigil] [--arm B] [--verbose]

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, callMessages, grab } from "./planner-probe-lib.mjs";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const argVal = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const ONLY = argVal("--only", null);
const ARM = argVal("--arm", null);
const VERBOSE = args.includes("--verbose");
const opts = parseArgs(process.argv, { runs: "3" });

// The closed set is exactly what gameClock.daypart() emits — the answer has to round-trip back through it.
const DAYPARTS = ["night", "dawn", "morning", "midday", "afternoon", "evening"];

const BODY = `You read the opening scene of a story and say what time of day it takes place at.

- Go by what the passage shows: the light, what the people in it are doing, what has just finished or is about to start.
- Treat night as covering the dark hours on either side of midnight.
- A lamp or a fire on its own does not tell you the time. Rooms are lit at every hour.
- Name the specific part of the day. A broad word like "day" or "daytime" is not one of the answers.`;

// Variant 1: gloss the six words. Both tiers read "a few hours past noon" as midday and one read "the sun
// directly overhead" as afternoon — the model knows the vocabulary but not where the boundaries sit, and it
// is being scored against gameClock's real ones. Deliberately verbal: a clock reading here would be a
// parrotable value and the whole design avoids putting numerals in front of the model.
const GLOSS = `
- Where the words fall: dawn is first light; morning is before noon; midday is around noon; afternoon runs from past noon until the light begins to go; evening is dusk and the hours just after; night is full dark.`;

const CLOSER = `Your entire reply is that one word, with nothing before or after it.`;

/** The hatch axis: whether the pass may decline. */
const HATCH = `Answer with exactly one of these words: ${DAYPARTS.join(", ")}, unstated.

- Answer unstated when the passage genuinely gives you nothing to go on, rather than choosing the time that seems most likely.`;

const FORCED = `Answer with exactly one of these words: ${DAYPARTS.join(", ")}.

- When the passage is not specific, answer with the time that best fits the scene as written.`;

// Every arm ever run, kept so a rejected variant can be re-measured rather than re-argued. `loc` adds the
// authored location description to the user message alongside the narration.
//
//   A   SHIPPED. Hatch, no gloss.
//   Al  A plus the location description — does authored context help where the prose is thin?
//   B   forced. Tied with A on cloud (78/78); behind on Cydonia (70 vs 73) and coin-flips the no-sky cases.
//   Ag/Bg  REJECTED (gloss): -7pp stated on both arms over 120 samples, by dragging "past midnight" into
//          `evening`. Runnable with --arm for re-checking; not in the default set.
const ARMS_DEF = {
  A: { sys: `${BODY}\n\n${HATCH}\n\n${CLOSER}`, loc: false, label: "A  hatch (shipped)" },
  Al: { sys: `${BODY}\n\n${HATCH}\n\n${CLOSER}`, loc: true, label: "Al hatch + location" },
  B: { sys: `${BODY}\n\n${FORCED}\n\n${CLOSER}`, loc: false, label: "B  forced" },
  Ag: { sys: `${BODY}${GLOSS}\n\n${HATCH}\n\n${CLOSER}`, loc: false, label: "Ag hatch+gloss (rejected)" },
  Bg: { sys: `${BODY}${GLOSS}\n\n${FORCED}\n\n${CLOSER}`, loc: false, label: "Bg forced+gloss (rejected)" },
};
const DEFAULT_ARMS = ["A", "Al", "B"];

// `where` is the authored location description, present only on the `loc` arms. It goes BEFORE the
// narration so the generated prose stays the most recent thing the model read — the scene as it actually
// came out should outrank the description it was grown from.
const USER = (narration, where) =>
  `${where ? `Where the scene takes place:\n${where}\n\n` : ""}The opening scene:\n${narration}\n\nWhat time of day does this scene take place at?`;

const SYS = grab("defaultSystemPrompt");
const cases = JSON.parse(await readFile(path.join(HARNESS_DIR, "../opening-time-cases.json"), "utf8"))
  .filter((c) => !ONLY || c.id === ONLY);

const worldCache = new Map();
async function loadWorld(file) {
  if (!worldCache.has(file)) {
    worldCache.set(file, JSON.parse(await readFile(path.join(HARNESS_DIR, "..", file), "utf8")));
  }
  return worldCache.get(file);
}

const describe = (x) => (x?.aiDescription || x?.description || "").trim();

/** A case's world text, location and cast — read from the world file for the real-world cases, inline for
 *  the authored ones. Both end up in the same shape so the narration fill has one code path. */
async function resolve(c) {
  if (!c.worldFile) {
    return { world: c.world, locName: c.location, locDesc: c.locationDesc, entities: [] };
  }
  const w = await loadWorld(c.worldFile);
  const locs = (w.locations ?? []).filter((l) => l && l.id);
  const loc = locs.find((l) => l.name === c.location);
  if (!loc) throw new Error(`${c.id}: no location "${c.location}" in ${c.worldFile}`);
  const entities = (w.entities ?? []).filter((e) => (loc.entities ?? []).includes(e.id));
  return {
    world: w.systemPrompt || w.description || "",
    locName: loc.name,
    locDesc: describe(loc),
    entities,
  };
}

const renderEntities = (es) =>
  es.length ? es.map((e) => `- **${e.name}**\n  - **description:** ${describe(e)}`).join("\n") : "N/A";

/** Turn 1 exactly as the game builds it: no recap, no now-line, and so no <TIME> anywhere. That absence is
 *  the design's suppression guard, not a simplification — asking a model what time it is right after
 *  telling it would measure nothing. */
function openingMessages(r, c) {
  const sys = SYS
    .replaceAll("<LENGTH GUIDANCE>", "Aim for two to four tight paragraphs; land the moment and stop.")
    .replaceAll("<MARKDOWN GUIDANCE>", "Write plain prose - no headings, lists, or tables.")
    .replaceAll("<WORLD DESCRIPTION>", r.world)
    .replaceAll("<DICTIONARY|before>", "N/A")
    .replaceAll("<STATS DESCRIPTION|descriptions.markdown>", "- **Resolve:** steady")
    .replaceAll("<TRAITS DESCRIPTION|markdown>", "N/A")
    .replaceAll("<NOTES>", "N/A")
    .replaceAll("<LOCATION|markdown>", `- **name:** ${r.locName}\n- **description:** ${r.locDesc}`)
    .replaceAll("<LOCATION|sublocations.summary.markdown>", "N/A")
    .replaceAll("<LOCATION|reachable.summary.markdown>", "N/A")
    .replaceAll("<ENTITIES|markdown>", renderEntities(r.entities))
    .replaceAll("<ENTITIES|sublocations.markdown>", "N/A")
    .replaceAll("<ENTITIES|reachable.summary.markdown>", "N/A")
    .replaceAll("<DICTIONARY>", "N/A");
  return [
    { role: "system", content: sys },
    { role: "user", content: c.action },
  ];
}

/** Strict read of the pass's reply. Anything outside the closed set is INVALID rather than coerced: a
 *  model writing "noon" or "late evening" has not honored the contract, and softening that here would hide
 *  the one thing the closing instruction is supposed to guarantee. */
function readDaypart(reply) {
  const m = (reply || "").toLowerCase().match(new RegExp(`\\b(${DAYPARTS.join("|")}|unstated)\\b`));
  return m ? m[1] : null;
}

const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : "n/a");

/** The most common answer and its share of the runs. */
function modal(answers) {
  const counts = {};
  for (const a of answers) counts[a ?? "invalid"] = (counts[a ?? "invalid"] || 0) + 1;
  const [word, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? ["none", 0];
  return { word, share: n / Math.max(1, answers.length), counts };
}

const resolved = new Map();
for (const c of cases) resolved.set(c.id, await resolve(c));
const stated = cases.filter((c) => c.group === "stated");
const unstatedCases = cases.filter((c) => c.group === "unstated");
const ARMS = (ARM ? ARM.split(",") : DEFAULT_ARMS).filter((a) => ARMS_DEF[a]);
const hatched = (arm) => arm.startsWith("A");

console.log(`${stated.length} stated · ${unstatedCases.length} unstated · model ${opts.model} · runs ${opts.runs} · arms ${ARMS.join("+")}\n`);
await callMessages({ ...opts, temp: 0, maxTokens: 4 }, [{ role: "user", content: "ping" }]).catch(() => {});

// Both arms read the SAME generated opening. The arms differ only in the pass's prompt, so pairing them on
// one narration removes narration variance from the comparison entirely — and halves the calls, since the
// prose does not depend on which arm is scoring it.
const answers = {};
for (const arm of ARMS) answers[arm] = new Map(cases.map((c) => [c.id, []]));

for (const c of cases) {
  const r = resolved.get(c.id);
  for (let i = 0; i < opts.runs; i++) {
    const narration = await callMessages({ ...opts, temp: 0.7, maxTokens: 600 }, openingMessages(r, c));
    for (const arm of ARMS) {
      const def = ARMS_DEF[arm];
      const reply = await callMessages({ ...opts, temp: 0, maxTokens: 8 }, [
        { role: "system", content: def.sys },
        { role: "user", content: USER(narration, def.loc ? `${r.locName} — ${r.locDesc}` : null) },
      ]);
      answers[arm].get(c.id).push(readDaypart(reply));
      if (VERBOSE) console.log(`    ${c.id}#${i + 1} ${arm} -> "${reply.replace(/\s+/g, " ").slice(0, 24)}"`);
    }
    if (VERBOSE) console.log(`${narration.slice(0, 300)}\n`);
  }
  process.stdout.write(`  generated ${c.id}\n`);
}

for (const arm of ARMS) {
  console.log(`\n--- arm ${ARMS_DEF[arm].label} ---`);

  let accHit = 0, accTotal = 0, falseHatch = 0, invalid = 0, relHit = 0, relTotal = 0;
  for (const c of stated) {
    const got = answers[arm].get(c.id);
    const ok = got.filter((a) => a && c.expect.includes(a)).length;
    accTotal += got.length;
    accHit += ok;
    falseHatch += got.filter((a) => a === "unstated").length;
    invalid += got.filter((a) => !a).length;
    // The relative-phrasing subgroup ("two hours past noon", "an hour after first light") is what the gloss
    // targets, so it is scored on its own — folded into the total it would be a fifth of the signal.
    if (c.phrasing === "relative") { relTotal += got.length; relHit += ok; }
    console.log(`  ${ok === got.length ? "OK  " : ok === 0 ? "MISS" : "part"} ${c.id.padEnd(15)}${c.phrasing === "relative" ? "~" : " "}want ${c.expect.join("|").padEnd(14)} got ${got.map((a) => a ?? "??").join(" ")}`);
  }

  let hatch = 0, unTotal = 0;
  const modals = [];
  for (const c of unstatedCases) {
    const got = answers[arm].get(c.id);
    unTotal += got.length;
    hatch += got.filter((a) => a === "unstated").length;
    invalid += got.filter((a) => !a).length;
    // Agreement is measured over the answers that actually committed to a daypart: a case that mostly
    // declines is described by the hatch rate, and folding those in would read as false confidence.
    const committed = got.filter((a) => a && a !== "unstated");
    const m = modal(committed);
    if (committed.length) modals.push(m.word);
    console.log(`  ---- ${c.id.padEnd(11)} ${got.map((a) => a ?? "??").join(" ")}   agreement ${committed.length ? pct(Math.round(m.share * committed.length), committed.length) : "n/a"}`);
  }

  const spread = new Set(modals).size;
  console.log(`\n  stated    ACCURACY ${pct(accHit, accTotal)} (${accHit}/${accTotal})${hatched(arm) ? ` · FALSE-HATCH ${pct(falseHatch, accTotal)}` : ""}`);
  console.log(`  ~relative ACCURACY ${pct(relHit, relTotal)} (${relHit}/${relTotal})  <- what the gloss targets`);
  console.log(`  unstated  ${hatched(arm) ? `HATCH RATE ${pct(hatch, unTotal)} · ` : ""}SPREAD ${spread}/${modals.length} distinct dayparts across worlds`);
  if (spread <= 1 && modals.length > 1) {
    console.log(`            ^ every world resolved to "${modals[0]}" — a forced pick here is the 08:00 default wearing a confident answer`);
  }
  console.log(`  INVALID   ${pct(invalid, accTotal + unTotal)} of all replies outside the closed set`);
}
