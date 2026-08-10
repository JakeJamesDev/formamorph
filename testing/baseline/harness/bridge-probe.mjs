// Bridge probe — feeds the real World Editor description-bridging prompts (src/lib/bridgeDescription.ts,
// compiled in-memory so the probe always tests the shipped text) a set of authored subject notes and
// measures both directions of the contract.
//
//   playerDesc: AI-facing reference note -> what the player reads. The note carries VISIBLE facts and
//     SECRET facts. Leakage = a secret reaching the player text (want 0). Its false-positive guard is
//     visible-fact recall: a rewrite that drops everything scores zero leaks and is still wrong.
//   aiDesc: short player blurb -> the fuller reference note. Fidelity = recall of the blurb's own facts
//     (want high), and the output must actually expand rather than restate.
//
// Both directions also check format: no preamble/label/quote wrapper, and the stated sentence range.
//
// Usage:  node bridge-probe.mjs [--endpoint URL] [--model default] [--runs 12] [--only harbormaster]
//                               [--dir playerDesc|aiDesc] [--seed 7] [--token TOK] [--dump out.jsonl]

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transform } from "esbuild";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HARNESS_DIR, "../../..");
const args = process.argv.slice(2);
const argVal = (f, d = null) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const endpoint = argVal("--endpoint", "https://api.lyonade.net/v1/chat/completions");
const model = argVal("--model", "default");
const runs = Number(argVal("--runs", "12"));
const only = argVal("--only");
const onlyDir = argVal("--dir");
const baseSeed = Number(argVal("--seed", "7"));
const token = argVal("--token", process.env.PROBE_TOKEN || "");
const dumpPath = argVal("--dump");
const dump = [];

// The prompt text and sampler pins come from the shipped module, not a copy — compile the TS in memory and
// import it, so an edit to bridgeDescription.ts is picked up with no probe change.
// --promptfile points at a snapshot of the module (e.g. `git show HEAD:src/lib/bridgeDescription.ts > A.ts`)
// so a baseline arm can be re-scored with the current metric instead of stale numbers.
const promptFile = argVal("--promptfile", path.join(REPO_ROOT, "src/lib/bridgeDescription.ts"));
const tsSource = await readFile(promptFile, "utf8");
const { code } = await transform(tsSource, { loader: "ts", format: "esm" });
const { bridgePrompt } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
// Mirrors the constants in the module under test; a drift check below fails the run if they diverge.
const TEMPERATURE = 0.6;
const MAX_TOKENS = 400;
for (const [name, want] of [["BRIDGE_TEMPERATURE", TEMPERATURE], ["BRIDGE_MAX_TOKENS", MAX_TOKENS]]) {
  const m = tsSource.match(new RegExp(`${name}\\s*=\\s*([\\d.]+)`));
  if (!m || Number(m[1]) !== want) throw new Error(`${name} drifted (${m?.[1]}) — update bridge-probe.mjs`);
}

// Authored subjects. Three fact classes, because the first cut of this probe conflated the last two and
// scored a false 5/12 leak rate:
//   visible   - what a player could learn by looking; the false-positive guard (dropping these is a failure)
//   secret    - private knowledge nobody could observe (a motive, a past crime, a future event). Any of these
//               in player text is a real leak.
//   ambiguous - physically present in the scene but authorially withheld (a covered cage, a missing bell).
//               A model that describes them is arguably obeying "what a stranger would notice", so these are
//               counted and printed separately rather than scored as leaks.
// Each fact is a regex covering the ways a model may phrase it, so the metric survives paraphrase.
const CASES = [
  {
    name: "harbormaster",
    kind: "character",
    aiNote:
      "Ordec runs the harbor office at the river mouth. Gray-bearded, heavy through the shoulders, and he walks "
      + "with a pronounced limp from a winch accident on the dock years ago. He wears the same tarred oilskin coat "
      + "in every weather and is never without the tally ledger he keeps every barge's cargo in. He is curt with "
      + "strangers and slow to warm. Privately, he takes bribes from the night barges to leave their cargo out of "
      + "that ledger. His younger brother drowned at this same landing and he has never forgiven himself for it. "
      + "He intends to sell the office and flee downriver before the winter ice closes the channel.",
    visible: [
      { id: "beard", re: /\b(gray|grey|grizzl\w*|white)[- ]?(beard|bearded|whisker)|beard\w*\s+(is\s+)?(gray|grey)/i },
      { id: "limp", re: /\b(limp\w*|lame|uneven gait|favors? (one|his) leg|hitch in his (step|stride))\b/i },
      { id: "ledger", re: /\b(ledger|tally|tallies|logbook|record book|manifest)\b/i },
      { id: "oilskin", re: /\b(oilskin|oilcloth|tarred coat|slicker)\b/i },
      { id: "curt", re: /\b(curt|brusque|gruff|short with|terse|unfriendly|abrupt|little patience|few words)\b/i },
    ],
    secret: [
      { id: "bribes", re: /\b(bribe\w*|payoff|paid off|kickback|smuggl\w*|contraband|off the books|falsif\w*|omits?\b.{0,30}ledger)\b/i },
      { id: "brother", re: /\b(brother|sibling)\b/i },
      { id: "flight", re: /\b(flee|fleeing|escape|run away|sell the office|leave before (the )?winter|slip away downriver)\b/i },
    ],
    blurb:
      "The harbormaster is a gray-bearded man in a tarred oilskin coat who limps between the barges, tally ledger "
      + "always under one arm, and has no patience for strangers.",
    blurbFacts: [
      { id: "beard", re: /\b(gray|grey|grizzl\w*)[- ]?(beard|bearded|whisker)|beard\w*\s+(is\s+)?(gray|grey)/i },
      { id: "oilskin", re: /\b(oilskin|oilcloth|tarred|slicker)\b/i },
      { id: "limp", re: /\b(limp\w*|lame|uneven gait|favors? (one|his) leg)\b/i },
      { id: "ledger", re: /\b(ledger|tally|tallies|logbook|manifest)\b/i },
      { id: "barges", re: /\b(barge|dock|harbor|harbour|wharf|quay|jetty|landing)\w*\b/i },
    ],
  },
  {
    name: "healer",
    kind: "character",
    aiNote:
      "Mother Ain is a small, spare woman whose fingers are permanently stained brown from the herbs she works. "
      + "She speaks slowly, leaving long gaps between sentences, and keeps a walled garden of bitterroot behind her "
      + "cottage. She has endless patience with frightened children. What nobody in the village knows: she poisoned "
      + "the old magistrate two winters ago and watched him die. She has never learned to read, and hides it by "
      + "having others read aloud to her. She is herself dying of the same wasting sickness she treats in others.",
    visible: [
      { id: "stained", re: /\b(stain\w*|dyed|discolo\w*|brown\w*)\b.{0,25}\b(finger|hand|nail)|(finger|hand|nail)\w*\b.{0,25}\b(stain\w*|brown)/i },
      { id: "slow", re: /\b(slow\w*|unhurried|deliberate|pause\w*|measured|long gaps|takes her time)\b/i },
      { id: "garden", re: /\b(garden|bitterroot|herb\w*|plot|beds)\b/i },
      { id: "children", re: /\b(child\w*|kid\w*|young ones|little ones)\b/i },
      { id: "small", re: /\b(small|slight|spare|thin|slender|tiny|frail)\b/i },
    ],
    secret: [
      { id: "poison", re: /\b(poison\w*|murder\w*|magistrate)\b/i },
      { id: "illiterate", re: /\b(illiterate|cannot read|can't read|never learned to read|unable to read)\b/i },
    ],
    // Her own failing health could plausibly show on her face.
    ambiguous: [
      { id: "dying", re: /\b(dying|her own (illness|sickness|death)|wasting\b.{0,20}\bherself|she (is|'s) (also )?(ill|sick|afflicted))\b/i },
    ],
    blurb:
      "A small, slow-spoken woman with herb-stained fingers who tends a bitterroot garden behind her cottage and "
      + "has endless patience with frightened children.",
    blurbFacts: [
      { id: "small", re: /\b(small|slight|spare|thin|slender|tiny)\b/i },
      { id: "slow", re: /\b(slow\w*|unhurried|deliberate|measured|pause\w*)\b/i },
      { id: "stained", re: /\b(stain\w*|brown\w*|discolo\w*)\b.{0,25}\b(finger|hand|nail)|(finger|hand|nail)\w*\b.{0,25}\b(stain\w*|brown)/i },
      { id: "garden", re: /\b(garden|bitterroot|herb\w*|cottage)\b/i },
      { id: "children", re: /\b(child\w*|kid\w*|young ones|little ones)\b/i },
    ],
  },
  {
    name: "chapel",
    kind: "location",
    aiNote:
      "The drowned chapel stands half-sunk in the marsh a mile east of the village, its stone walls tilting where "
      + "the ground gave way. Inside, standing water reaches the knee and never drains; the air is cold and smells "
      + "of silt. Herons nest in the exposed roof beams and scatter noisily when anyone enters. Below the flooded "
      + "floor is a sealed crypt holding the village's plague dead, which is why the ground was abandoned. The "
      + "bronze bell was stolen and sold downriver a generation ago. Smugglers now use the nave to meet after dark.",
    visible: [
      { id: "sunk", re: /\b(sunk\w*|sinking|half-?submerged|subsid\w*|tilt\w*|lean\w*|settling)\b/i },
      { id: "water", re: /\b(water|flood\w*|knee-?deep|wading|wade|pool\w*|standing water)\b/i },
      { id: "cold", re: /\b(cold|chill\w*|damp|clammy|raw)\b/i },
      { id: "silt", re: /\b(silt|mud|muck|rot\w*|stagnant|brack\w*|marsh\w*|peat)\b/i },
      { id: "birds", re: /\b(heron|bird|nest\w*|roost\w*|wing)\w*\b/i },
    ],
    secret: [
      { id: "crypt", re: /\b(crypt|plague|ossuary|catacomb|burial vault|sealed\b.{0,20}\b(dead|tomb)|plague dead)\b/i },
      { id: "smugglers", re: /\b(smuggl\w*|meet\w*\b.{0,20}\b(after dark|at night)|contraband|conspir\w*|clandestine|secret meeting)\b/i },
    ],
    // The bell's absence is visible from inside; only its sale downriver is private.
    ambiguous: [
      { id: "bell", re: /\b(bell)\b/i },
    ],
    blurb:
      "A stone chapel half-sunk in the marsh east of the village, cold inside and flooded to the knee, where herons "
      + "nest in the open roof beams.",
    blurbFacts: [
      { id: "stone", re: /\b(stone|masonry|granite|rock)\b/i },
      { id: "sunk", re: /\b(sunk\w*|sinking|half-?submerged|subsid\w*|tilt\w*|lean\w*)\b/i },
      { id: "marsh", re: /\b(marsh\w*|swamp|fen|bog|wetland|mire)\b/i },
      { id: "water", re: /\b(water|flood\w*|knee-?deep|wading|wade|pool\w*)\b/i },
      { id: "birds", re: /\b(heron|bird|nest\w*|roost\w*)\w*\b/i },
    ],
  },
  {
    name: "nightmarket",
    kind: "location",
    aiNote:
      "The night market fills six lantern-strung alleys behind the customs house and runs from dusk until the first "
      + "gray light, when the stalls fold away entirely. It is loud and packed shoulder to shoulder. The stalls sell "
      + "dried fish, hammered copperware and cheap sweet wine, and the whole quarter smells of frying oil. The guard "
      + "captain takes a cut from every stallholder to let the market stand at all. Behind the furthest stall a "
      + "slaver keeps a covered cage, which the crowd is careful not to look at. The whole quarter burns next spring.",
    visible: [
      { id: "lantern", re: /\b(lantern|lamp\w*|lit|light\w*|glow\w*)\b/i },
      { id: "alleys", re: /\b(alley\w*|lane\w*|passage\w*|street\w*|quarter)\b/i },
      { id: "night", re: /\b(dusk|night|dark|dawn|first light|until morning|sunset)\b/i },
      { id: "wares", re: /\b(fish|copper\w*|wine|stall\w*|wares|goods)\b/i },
      { id: "smell", re: /\b(smell\w*|scent|odor|odour|reek\w*|frying|oil|aroma)\b/i },
      { id: "crowd", re: /\b(crowd\w*|packed|press\w*|throng|shoulder|jostl\w*|busy|bustl\w*)\b/i },
    ],
    secret: [
      { id: "bribe", re: /\b(bribe\w*|cut\b.{0,20}\b(stall|trader|holder)|protection money|payoff|kickback|extort\w*)\b/i },
      { id: "fire", re: /\b(burns?\b.{0,25}\b(spring|year|soon|later)|will burn|doomed|fire to come|razed)\b/i },
    ],
    // The covered cage physically sits in the alley, so describing it is defensible.
    ambiguous: [
      { id: "slaver", re: /\b(slav\w*|cage|chained|captive|bound prisoner)\b/i },
    ],
    blurb:
      "Six lantern-strung alleys behind the customs house, packed shoulder to shoulder from dusk to first light, "
      + "selling dried fish and hammered copperware under a haze of frying oil.",
    blurbFacts: [
      { id: "lantern", re: /\b(lantern|lamp\w*|lit|light\w*)\b/i },
      { id: "alleys", re: /\b(alley\w*|lane\w*|passage\w*|street\w*)\b/i },
      { id: "night", re: /\b(dusk|night|dark|dawn|first light)\b/i },
      { id: "wares", re: /\b(fish|copper\w*|stall\w*|wares)\b/i },
      { id: "crowd", re: /\b(crowd\w*|packed|press\w*|throng|shoulder|jostl\w*)\b/i },
    ],
  },
];

// Format leaks. A preamble/label/whole-output quote wrapper all violate "Output only the description".
const PREAMBLE = /^\s*(here (is|are)|here'?s|sure[,!.]|certainly|okay[,!.]|of course|below is|this is (the|a)|i('ve| have) (written|rewritten)|as requested)/i;
const LABEL = /^\s*(\*\*)?(player[- ]facing|ai[- ]facing|description|reference note|note|summary|output|rewritten|player|blurb)\s*(\*\*)?\s*:/i;
const WRAPPED = /^\s*["“][\s\S]*["”]\s*$/;
const HEADING = /^\s*#{1,6}\s/;
const words = (s) => (s.trim().match(/\S+/g) || []).length;
const sentences = (s) => (s.match(/[.!?]+(\s|$)/g) || []).length;

async function call(sys, user, seed) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(endpoint, {
    method: "POST", headers,
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: sys }, { role: "user", content: user }],
      temperature: TEMPERATURE, max_tokens: MAX_TOKENS, seed,
      reasoning_effort: "none", stream: false,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const j = await res.json();
  return (j.choices?.[0]?.message?.content ?? "").trim();
}

const DIRS = ["playerDesc", "aiDesc"].filter((d) => !onlyDir || d === onlyDir);
const pick = CASES.filter((c) => !only || c.name.includes(only));
console.log(`Bridge probe · ${endpoint} · "${model}" · ${pick.length} case(s) · ${runs} run(s)/case · temp ${TEMPERATURE}`);
console.log(`playerDesc: secret leakage (want 0) + visible recall (guard, want high) · aiDesc: blurb fidelity + expansion\n`);
await call(bridgePrompt("playerDesc", "character"), "warm up", baseSeed).catch(() => {});

const totals = {};
for (const dir of DIRS) {
  totals[dir] = { runs: 0, errors: 0, leakHits: 0, leakRuns: 0, ambHits: 0, ambRuns: 0, factHit: 0, factTotal: 0,
    preamble: 0, label: 0, wrapped: 0, heading: 0, badSent: 0, ratioSum: 0, sentSum: 0 };
  const range = dir === "playerDesc" ? [2, 4] : [3, 6];
  console.log(`\n================ ${dir} (want ${range[0]}-${range[1]} sentences)`);
  for (const c of pick) {
    const sys = bridgePrompt(dir, c.kind);
    const src = dir === "playerDesc" ? c.aiNote : c.blurb;
    const facts = dir === "playerDesc" ? c.visible : c.blurbFacts;
    console.log(`\n######## ${c.name} (${c.kind})`);
    for (let r = 0; r < runs; r++) {
      const T = totals[dir];
      let out, err = null;
      try { out = await call(sys, src, baseSeed + r); } catch (e) { err = String(e.message || e); }
      T.runs++;
      if (err) { T.errors++; console.log(`  #${r + 1} ERROR: ${err}`); continue; }
      const flags = [];
      if (PREAMBLE.test(out)) { T.preamble++; flags.push("preamble"); }
      if (LABEL.test(out)) { T.label++; flags.push("label"); }
      if (WRAPPED.test(out)) { T.wrapped++; flags.push("quoted"); }
      if (HEADING.test(out)) { T.heading++; flags.push("heading"); }
      const s = sentences(out), w = words(out);
      T.sentSum += s;
      if (s < range[0] || s > range[1]) { T.badSent++; flags.push(`${s}-sent`); }
      const hitFacts = facts.filter((f) => f.re.test(out));
      T.factHit += hitFacts.length; T.factTotal += facts.length;
      T.ratioSum += w / words(src);
      let leaked = [], amb = [];
      if (dir === "playerDesc") {
        leaked = c.secret.filter((f) => f.re.test(out)).map((f) => f.id);
        amb = (c.ambiguous ?? []).filter((f) => f.re.test(out)).map((f) => f.id);
        T.leakHits += leaked.length;
        if (leaked.length) T.leakRuns++;
        T.ambHits += amb.length;
        if (amb.length) T.ambRuns++;
      }
      const leakNote = dir === "playerDesc"
        ? ` · LEAK ${leaked.length ? leaked.join(",") : "0"}${amb.length ? ` · amb ${amb.join(",")}` : ""}` : "";
      console.log(`  #${r + 1} ${w}w ${s}sent · facts ${hitFacts.length}/${facts.length}${leakNote}${flags.length ? " · " + flags.join(",") : ""}`);
      console.log(`      ${out.replace(/\s+/g, " ").slice(0, 240)}`);
      // A regex hit can be an artifact (an innocent word inside a fact's alternation), so show the words
      // around each one — the count is only trustworthy once the match has been read.
      for (const f of [...c.secret, ...(c.ambiguous ?? [])].filter((sf) => sf.re.test(out))) {
        const flat = out.replace(/\s+/g, " ");
        const m = flat.match(f.re);
        const at = Math.max(0, m.index - 45);
        console.log(`      ↳ ${f.id}: …${flat.slice(at, m.index + m[0].length + 45)}…`);
      }
      dump.push({ dir, case: c.name, kind: c.kind, run: r + 1, seed: baseSeed + r, words: w, sentences: s, out });
    }
  }
}

console.log(`\n${"=".repeat(96)}`);
for (const dir of DIRS) {
  const T = totals[dir];
  const ok = T.runs - T.errors || 1;
  const line = [
    `${dir} · ${T.runs} runs (${T.errors} err)`,
    `facts ${(100 * T.factHit / (T.factTotal || 1)).toFixed(0)}%`,
    `sent ${(T.sentSum / ok).toFixed(1)} avg, ${T.badSent} out-of-range`,
    `len ${(T.ratioSum / ok).toFixed(2)}x source`,
    `format leaks: preamble ${T.preamble} label ${T.label} quoted ${T.wrapped} heading ${T.heading}`,
  ];
  if (dir === "playerDesc") line.splice(1, 0,
    `SECRET LEAK ${T.leakRuns}/${ok} runs (${T.leakHits} facts)`,
    `ambiguous ${T.ambRuns}/${ok} runs`);
  console.log(line.join(" · "));
}
if (dumpPath) {
  await writeFile(dumpPath, dump.map((d) => JSON.stringify(d)).join("\n") + "\n");
  console.log(`\nFull outputs -> ${dumpPath} (${dump.length} rows) — re-score without re-running.`);
}
