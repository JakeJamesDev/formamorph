// SCENE-TAGS probe — does the scene-image tag pass write the ACTION LAYER, and only the action layer?
//
// The pass (`defaultSceneTagsPrompt`, requestType `sceneTags`) is one third of a scene image. The other two
// thirds are authored and pasted in verbatim by the composer (src/lib/sceneTags.ts): the cast's own image
// tags describe who is in frame, the location's describe where it is. That split is the whole design — it
// is what keeps a world's look stable while the picture still changes with the story — so a reply that
// re-describes hair or scenery is not merely redundant, it puts tags in the prompt that compete with the
// authored ones.
//
// Vocabulary is scored against the tag list the app ships (src/data/danbooruTags.json, the top 10,000 by
// popularity), but it is a SIGNAL, NOT A BAR. Image models read natural language too — the text encoder is
// not a lookup table — so "hands flat on wood" is weaker than a canonical tag, not inert. A rising vocab
// share means the reply is getting denser and more reliable; a low one is a reason to look at the output,
// never a failure on its own. Judge the picture, not this percentage.
//
// Metrics, in the order they matter:
//
//   DISCRIM   mean pairwise Jaccard between the tag lines of DIFFERENT cases, per run. This is the headline.
//             Every other number can look fine while the model emits the same five tags for every scene,
//             which is the failure that makes this kind of feature worthless. Lower is better; a pass that
//             reads the prose should land well under 0.3.
//   LEAK      tags that belong to a layer this pass does not own, split by which:
//               APPEAR  matches one of the cast's authored tags, or an appearance lexicon (hair/eyes/clothes)
//               BG      matches the location's authored tags, or a scenery lexicon
//             Both are exact-tag comparisons against the case's own authored text, so they measure the
//             actual collision, not a guess at one.
//   VOCAB     share of emitted tags present in the shipped 10k list. Denser is better; see the note above
//             on why this is not a pass/fail number.
//   FIDELITY  HIT   at least one tag matching the case's `wantAny` — did it describe THIS scene at all
//             CONTRA any tag in the case's `forbid` — did it assert something the passage denies
//   SLOTS     ACTION (required) · POSE · FRAME · LIGHT. Framing is credited, never required: forcing a
//             camera angle onto every turn produces worse pictures than letting it default to neutral.
//   HYGIENE   NAMES  the composer's stripNames would fire (a character named in the tags)
//             COUNT  emitted a subject-count tag (1girl/2girls/solo) the composer has to overrule
//             FORMAT prose, preamble, labels or numbering instead of one comma-separated line
//             SIZE   tag count outside 4-8
//             The last four are all repaired downstream, so they measure the MODEL, not shipped output.
//
// Cases are ../scene-tags-cases.json: standard prose in the Sedge Landing register, each carrying the
// authored character/location tags the composer would supply, plus the action it should land and the
// contradictions it must not. `empty` (nobody in frame) is the negative control — the pass must not
// invent people into a scenery shot.
//
// Sampler: temperature 0.3, the sceneTags pin in promptSamplers.ts. Cloud is nondeterministic regardless
// of seed, so give it more runs than the local tier.
//
//   node scene-tags-probe.mjs --endpoint https://api.lyonade.net/v1/chat/completions --model default --runs 12
//   node scene-tags-probe.mjs --runs 3 [--only boat] [--verbose]

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, callMessages, grab } from "./planner-probe-lib.mjs";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HARNESS_DIR, "../../..");
const args = process.argv.slice(2);
const argVal = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const ONLY = argVal("--only", null);
const VERBOSE = args.includes("--verbose");
const opts = parseArgs(process.argv, { runs: "3" });

const SYS = grab("defaultSceneTagsPrompt");
const USER_TEMPLATE = grab("defaultSceneTagsUserPrompt");
const VOCAB = new Set(
  JSON.parse(await readFile(path.join(REPO_ROOT, "src/data/danbooruTags.json"), "utf8")).map((t) => t.toLowerCase()),
);
const cases = JSON.parse(await readFile(path.join(HARNESS_DIR, "../scene-tags-cases.json"), "utf8"))
  .filter((c) => !ONLY || c.id === ONLY);

// ---- lexicons -------------------------------------------------------------------------------------
// Only used where a case's own authored tags cannot answer the question: the authored comparison catches a
// tag that literally collides, these catch one that belongs to the layer without being in that exact list.
const APPEARANCE = /\b(hair|eyes?|eyebrows?|skin|freckles|braid|ponytail|bangs|beard|shirt|dress|skirt|coat|jacket|apron|boots|shawl|hat|scarf|gloves|cloak|sleeves|breasts|tall|short|slender|muscular|young|old|blonde|brunette|redhead)\b/;
const SCENERY = /\b(indoors|outdoors|room|house|building|forest|tree|trees|river|water|dock|pier|village|town|street|road|field|grass|wall|window|door|floor|ceiling|table|chair|mountain|sky|beach|boat|ship)\b/;
const FRAMING = /\b(from behind|from above|from below|from side|close-up|wide shot|upper body|full body|cowboy shot|portrait|profile|pov|dutch angle|facing viewer|looking at viewer|back turned|over the shoulder|silhouette)\b/;
// Bare `dim` and `lit` matter as much as `dim lighting`: naming the tag vocabulary shortens tags, and a
// lexicon that only knows the long forms reads that shortening as the light slot going missing.
const LIGHT = /\b(night|dawn|dusk|twilight|sunset|sunrise|daylight|daytime|sunlight|moonlight|lantern|candlelight|firelight|backlighting|rim light|lighting|lit|dim|dimly|gloom|gloomy|bright|dark|overcast|cloudy|sunny|rain|raining|snow|fog|mist|storm|shadow|shadows|lens flare|god rays)\b/;
const POSE = /\b(smile|smiling|frown|frowning|crying|laughing|serious|angry|surprised|open mouth|closed eyes|looking (at|away|down|up|back)|head down|arms? (crossed|at sides|raised)|hands? (on|in|behind)|leaning|crouching|kneeling|sitting|standing|lying)\b/;
// A verb-shaped tag is the action slot's fallback: booru action tags are overwhelmingly gerunds.
const ACTION = /\b\w+ing\b/;
// Reply-level format faults: a line that is prose or a list rather than tags.
const PROSE = /(^\s*(here|the|these|tags?|answer)\b)|[.;!?]\s|^\s*[-*\d]+[.)]\s|:\s/i;

const COUNT_TAG = /^(\d+(girls?|boys?|others?)|multiple (girls|boys|others)|solo( focus)?)$/;

const splitTags = (line) => line.split(/[,\n]/).map((t) => t.trim().toLowerCase()).filter(Boolean);
const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : "n/a");
const jaccard = (a, b) => {
  const A = new Set(a), B = new Set(b);
  if (!A.size && !B.size) return 0;
  let hit = 0;
  for (const x of A) if (B.has(x)) hit++;
  return hit / (A.size + B.size - hit);
};

/** Would the composer's stripNames fire on this tag? Mirrors src/lib/sceneTags.ts. */
const namesIn = (tags, names) =>
  tags.filter((t) => names.some((n) => {
    const name = n.toLowerCase();
    return name.includes(" ") ? new RegExp(`\\b${name}\\b`).test(t) : new RegExp(`^${name}\\b`).test(t);
  }));

const userMessage = (c) =>
  USER_TEMPLATE
    .replaceAll("<IN FRAME>", c.inFrame.length ? c.inFrame.map((e) => e.name).join(", ") : "nobody - an empty scene")
    .replaceAll("<NARRATION>", c.narration);

console.log(`${cases.length} cases · model ${opts.model} · runs ${opts.runs} · temp 0.3 (sceneTags pin)\n`);
await callMessages({ ...opts, temp: 0, maxTokens: 4 }, [{ role: "user", content: "ping" }]).catch(() => {});

const replies = new Map(cases.map((c) => [c.id, []]));
for (const c of cases) {
  for (let i = 0; i < opts.runs; i++) {
    const reply = await callMessages({ ...opts, temp: 0.3, maxTokens: 120 }, [
      { role: "system", content: SYS },
      { role: "user", content: userMessage(c) },
    ]);
    replies.get(c.id).push((reply || "").trim());
    if (VERBOSE) console.log(`    ${c.id}#${i + 1} -> ${reply.replace(/\s+/g, " ").slice(0, 160)}`);
  }
  process.stdout.write(`  ran ${c.id}\n`);
}

let tagTotal = 0, inVocab = 0, leakAppear = 0, leakBg = 0, nameTags = 0, countTags = 0;
let badFormat = 0, badSize = 0, replyTotal = 0;
let hit = 0, contra = 0, slotAction = 0, slotPose = 0, slotFrame = 0, slotLight = 0;

console.log("");
for (const c of cases) {
  const authoredAppear = new Set(c.inFrame.flatMap((e) => splitTags(e.tags)));
  const authoredBg = new Set(splitTags(c.locationTags));
  const names = c.inFrame.map((e) => e.name);
  let cHit = 0, cContra = 0, cLeak = 0, cVocabHit = 0, cTags = 0;

  for (const reply of replies.get(c.id)) {
    replyTotal += 1;
    const tags = splitTags(reply);
    const line = tags.join(", ");
    if (PROSE.test(reply)) badFormat += 1;
    if (tags.length < 4 || tags.length > 8) badSize += 1;

    tagTotal += tags.length;
    cTags += tags.length;
    for (const t of tags) {
      if (VOCAB.has(t)) { inVocab += 1; cVocabHit += 1; }
      // Authored collision first (the real cost), lexicon second (the same layer, differently worded).
      if (authoredAppear.has(t) || APPEARANCE.test(t)) { leakAppear += 1; cLeak += 1; }
      else if (authoredBg.has(t) || SCENERY.test(t)) { leakBg += 1; cLeak += 1; }
      if (COUNT_TAG.test(t)) countTags += 1;
    }
    nameTags += namesIn(tags, names).length;

    if (c.wantAny.every((group) => group.some((w) => line.includes(w)))) { hit += 1; cHit += 1; }
    if (c.forbid.some((f) => tags.includes(f))) { contra += 1; cContra += 1; }
    if (ACTION.test(line) || POSE.test(line)) slotAction += 1;
    if (POSE.test(line)) slotPose += 1;
    if (FRAMING.test(line)) slotFrame += 1;
    if (LIGHT.test(line)) slotLight += 1;
  }

  const n = replies.get(c.id).length;
  console.log(
    `  ${cHit === n ? "OK  " : cHit === 0 ? "MISS" : "part"} ${c.id.padEnd(11)}` +
    `fidelity ${cHit}/${n}  contra ${cContra}  leak ${cLeak}  vocab ${pct(cVocabHit, cTags)}`,
  );
  if (VERBOSE) for (const r of replies.get(c.id)) console.log(`        ${r.replace(/\s+/g, " ")}`);
}

// Discrimination: compare each PAIR OF DIFFERENT CASES within the same run index. Same-case repeats are
// deliberately excluded — repeating yourself on one scene is consistency, not collapse.
let pairSum = 0, pairs = 0;
for (let i = 0; i < opts.runs; i++) {
  for (let a = 0; a < cases.length; a++) {
    for (let b = a + 1; b < cases.length; b++) {
      const ra = replies.get(cases[a].id)[i], rb = replies.get(cases[b].id)[i];
      if (ra == null || rb == null) continue;
      pairSum += jaccard(splitTags(ra), splitTags(rb));
      pairs += 1;
    }
  }
}

const discrim = pairs ? pairSum / pairs : 0;
console.log(`\n  DISCRIM  ${discrim.toFixed(2)} mean pairwise overlap across scenes   (lower is better; >0.3 = converging)`);
console.log(`  LEAK     APPEAR ${pct(leakAppear, tagTotal)} · BG ${pct(leakBg, tagTotal)}   of ${tagTotal} tags`);
console.log(`  VOCAB    ${pct(inVocab, tagTotal)} in the shipped 10k`);
console.log(`  FIDELITY HIT ${pct(hit, replyTotal)} · CONTRA ${pct(contra, replyTotal)}`);
console.log(`  SLOTS    ACTION ${pct(slotAction, replyTotal)} (required) · POSE ${pct(slotPose, replyTotal)} · FRAME ${pct(slotFrame, replyTotal)} · LIGHT ${pct(slotLight, replyTotal)}`);
console.log(`  HYGIENE  NAMES ${nameTags} · COUNT ${countTags} · FORMAT ${badFormat}/${replyTotal} · SIZE ${badSize}/${replyTotal}   (all repaired downstream)`);
