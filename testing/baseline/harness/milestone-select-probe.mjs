// Milestone-select probe — measures the milestone-memory selector prompt against the hand-labeled
// fixture (milestone-fixture.json). Per story, the model gets the numbered digest list and replies with
// keep-indices; we score against labels. See docs-internal/milestone-memory-design.md.
//
// Fixture tiers (v2 reframe — keep = "someone would bring it up again or act on it"):
//   must   — must-keep. Recall gate >= 0.90; every miss printed verbatim (the expensive error).
//   either — defensible in both directions under the drop-when-unsure bias; keep rate is informational.
//   drop   — no one would mention it again (noise or superseded). Keep rate is a PRIMARY metric now
//            (target ~<= 0.10): kept drops are the history mass this feature exists to kill.
//   malformed — unparseable replies (fall back to keep-everything in the app; counted here).
//
//   node milestone-select-probe.mjs [--runs 3] [--model gemma4-e4b-cloud] [--prompt base] [--fixture milestone-fixture.json] [--verbose]

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const num = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? Number(argv[i + 1]) : d; };
const strArg = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const verbose = argv.includes("--verbose");
const RUNS = num("--runs", 3);
const MODEL_LABEL = strArg("--model", "gemma4-e4b-cloud");

const profiles = JSON.parse(await readFile(path.join(HARNESS_DIR, "profiles.json"), "utf8"));
const modelCfg = profiles.models.find((m) => m.label === MODEL_LABEL);
if (!modelCfg) throw new Error(`model label '${MODEL_LABEL}' not in profiles.json`);
const ENDPOINT = modelCfg.endpointUrl ?? profiles.endpointUrl;
const MODEL = modelCfg.modelName ?? MODEL_LABEL;
const TOKEN = modelCfg.apiToken ?? profiles.apiToken ?? "";

// ── Selector prompt candidates (--prompt <key>); 'reframe' is current (drop bias + would-anyone-mention-it
// test); 'base' is the original spec draft (keep bias, event taxonomy), kept for comparison ──
const PROMPTS = {
  base: `You are the memory keeper of an interactive story. You are given the story's remembered moments as a numbered list, oldest first. Keep the entries a player returning after a month would still need: what was gained or lost, promises made, quests taken or finished, characters met who matter, doors opened that stay open, wounds and debts that persist. An entry that only records passing movement, small talk, or a moment already superseded by a later entry has served its purpose - let it go. When unsure whether something still matters, keep it.

Reply with only the numbers to keep, comma-separated.`,
  reframe: `You are the memory keeper of an interactive story. You are given the story's remembered moments as a numbered list, oldest first. Keep an entry only if someone in the story would bring it up again or act on it: a promise or debt still open, a threat or wound that persists, a thing gained and kept, a favor done or a slight given that changes how one character sees another, a secret learned, a task done well that someone might mention. Drop what no one would ever speak of again - passing movement, small talk, and any moment whose outcome a later entry already carries. When unsure whether something still matters, let it go.

Reply with only the numbers to keep, comma-separated.`,
  // reframe2: reframe + the outcome-over-setup clause (cloud kept commitments and dropped resolutions).
  reframe2: `You are the memory keeper of an interactive story. You are given the story's remembered moments as a numbered list, oldest first. Keep an entry only if someone in the story would bring it up again or act on it: a promise or debt still open, a threat or wound that persists, a thing gained and kept, a favor done or a slight given that changes how one character sees another, a secret learned, a task done well that someone might mention. When something begun is later finished, the ending carries the memory - keep the outcome and let the setup go. Drop what no one would ever speak of again - passing movement, small talk, and any moment whose outcome a later entry already carries. When unsure whether something still matters, let it go.

Reply with only the numbers to keep, comma-separated.`,
  // fewshot: reframe + a worked toy example demonstrating the commitment->resolution pattern (keep the
  // outcome, drop the setup) — teaching by demonstration after instruction wording went null five times.
  fewshot: `You are the memory keeper of an interactive story. You are given the story's remembered moments as a numbered list, oldest first. Keep an entry only if someone in the story would bring it up again or act on it: a promise or debt still open, a threat or wound that persists, a thing gained and kept, a favor done or a slight given that changes how one character sees another, a secret learned, a task done well that someone might mention. Drop what no one would ever speak of again - passing movement, small talk, and any moment whose outcome a later entry already carries. When unsure whether something still matters, let it go.

Example:
1. You take the cliff path toward the lighthouse.
2. You promise the keeper Brann you will fetch his lamp oil from town.
3. You trade jokes with a fishwife on the quay.
4. You bring Brann his lamp oil, and he lights the beacon, calling you a friend of the tower.
Correct reply: 4
Entry 4 carries entry 2's outcome - the fulfilled promise replaces the promise itself, so the ending is kept and the setup is dropped. Entries 1 and 3 are passing moments no one would mention again.

Reply with only the numbers to keep, comma-separated.`,
  // stateful2: minimal fold-in — two short items appended to the existing keep enumeration instead of
  // stateful's second sentence (which cost cloud 6/15 malformed replies and dropped recall to 0.78).
  stateful2: `You are the memory keeper of an interactive story. You are given the story's remembered moments as a numbered list, oldest first. Keep an entry only if someone in the story would bring it up again or act on it: a promise or debt still open, a threat or wound that persists, a thing gained and kept, a favor done or a slight given that changes how one character sees another, a secret learned, a role or pretense still being played, or the player's own stated goal while it is unmet. Drop what no one would ever speak of again - passing movement, small talk, and any moment whose outcome a later entry already carries. When unsure whether something still matters, let it go.

Example:
1. You take the cliff path toward the lighthouse.
2. You promise the keeper Brann you will fetch his lamp oil from town.
3. You trade jokes with a fishwife on the quay.
4. You bring Brann his lamp oil, and he lights the beacon, calling you a friend of the tower.
Correct reply: 4
Entry 4 carries entry 2's outcome - the fulfilled promise replaces the promise itself, so the ending is kept and the setup is dropped. Entries 1 and 3 are passing moments no one would mention again.

Reply with only the numbers to keep, comma-separated.`,
  // stateful3: stateful2's enumeration + the state lesson taught where this selector actually
  // learns - inside the worked example (a kept stated-goal entry). Instruction wording alone
  // left the goal dropped 3/3 (stateful2), consistent with the prompt's whole probe history.
  stateful3: `You are the memory keeper of an interactive story. You are given the story's remembered moments as a numbered list, oldest first. Keep an entry only if someone in the story would bring it up again or act on it: a promise or debt still open, a threat or wound that persists, a thing gained and kept, a favor done or a slight given that changes how one character sees another, a secret learned, a role or pretense still being played, or the player's own stated goal while it is unmet. Drop what no one would ever speak of again - passing movement, small talk, and any moment whose outcome a later entry already carries. When unsure whether something still matters, let it go.

Example:
1. You take the cliff path toward the lighthouse.
2. You tell the keeper Brann you are bound for the harbor at Selle, where your charts are due before the spring tide.
3. You promise Brann you will fetch his lamp oil from town.
4. You trade jokes with a fishwife on the quay.
5. You bring Brann his lamp oil, and he lights the beacon, calling you a friend of the tower.
Correct reply: 2, 5
Entry 2 is the player's own errand, still unmet - the story steers by it until it is done, so it stays. Entry 5 carries entry 3's outcome - the fulfilled promise replaces the promise itself, so the ending is kept and the setup is dropped. Entries 1 and 4 are passing moments no one would mention again.

Reply with only the numbers to keep, comma-separated.`,
  // stateful4: the shipped fewshot example untouched (its supersession lesson is proven) + a second
  // two-line example teaching only the stated-goal keep. stateful3's merged example taught the goal
  // but broke supersession (all three resolution entries dropped 3/3).
  stateful4: `You are the memory keeper of an interactive story. You are given the story's remembered moments as a numbered list, oldest first. Keep an entry only if someone in the story would bring it up again or act on it: a promise or debt still open, a threat or wound that persists, a thing gained and kept, a favor done or a slight given that changes how one character sees another, a secret learned, a role or pretense still being played, or the player's own stated goal while it is unmet. Drop what no one would ever speak of again - passing movement, small talk, and any moment whose outcome a later entry already carries. When unsure whether something still matters, let it go.

Example:
1. You take the cliff path toward the lighthouse.
2. You promise the keeper Brann you will fetch his lamp oil from town.
3. You trade jokes with a fishwife on the quay.
4. You bring Brann his lamp oil, and he lights the beacon, calling you a friend of the tower.
Correct reply: 4
Entry 4 carries entry 2's outcome - the fulfilled promise replaces the promise itself, so the ending is kept and the setup is dropped. Entries 1 and 3 are passing moments no one would mention again.

Second example:
1. You tell the ferrywoman you are bound for Selle, where your charts are due before the spring tide.
2. You cross to the far bank and walk on.
Correct reply: 1
The player's own stated errand steers the story until it is done, so it stays; the crossing is passing movement.

Reply with only the numbers to keep, comma-separated.`,
  // stateful5: stateful4 minus every met/unmet word — "while it is unmet"/"until it is done" taught
  // cloud that completed things are droppable, killing resolution keeps (repayment/handoff 3/3 dropped).
  // Completion is already the supersession rule's job.
  stateful5: `You are the memory keeper of an interactive story. You are given the story's remembered moments as a numbered list, oldest first. Keep an entry only if someone in the story would bring it up again or act on it: a promise or debt still open, a threat or wound that persists, a thing gained and kept, a favor done or a slight given that changes how one character sees another, a secret learned, a role or pretense being played, or the player's own stated errand - who they say they are and where they are bound. Drop what no one would ever speak of again - passing movement, small talk, and any moment whose outcome a later entry already carries. When unsure whether something still matters, let it go.

Example:
1. You take the cliff path toward the lighthouse.
2. You promise the keeper Brann you will fetch his lamp oil from town.
3. You trade jokes with a fishwife on the quay.
4. You bring Brann his lamp oil, and he lights the beacon, calling you a friend of the tower.
Correct reply: 4
Entry 4 carries entry 2's outcome - the fulfilled promise replaces the promise itself, so the ending is kept and the setup is dropped. Entries 1 and 3 are passing moments no one would mention again.

Second example:
1. You tell the ferrywoman you are bound for Selle, where your charts are due before the spring tide.
2. You cross to the far bank and walk on.
Correct reply: 1
The player's stated errand is what the story steers by, so it stays; the crossing is passing movement.

Reply with only the numbers to keep, comma-separated.`,
  // stateful6: stateful5 with the examples swapped — goal lesson first, supersession lesson LAST.
  // With the goal example last, its "Correct reply: 1" (keep the earliest entry) was the final lesson
  // in view and pure-closure resolutions dropped 3/3; the outcome-over-setup lesson must close.
  stateful6: `You are the memory keeper of an interactive story. You are given the story's remembered moments as a numbered list, oldest first. Keep an entry only if someone in the story would bring it up again or act on it: a promise or debt still open, a threat or wound that persists, a thing gained and kept, a favor done or a slight given that changes how one character sees another, a secret learned, a role or pretense being played, or the player's own stated errand - who they say they are and where they are bound. Drop what no one would ever speak of again - passing movement, small talk, and any moment whose outcome a later entry already carries. When unsure whether something still matters, let it go.

Example:
1. You tell the ferrywoman you are bound for Selle, where your charts are due before the spring tide.
2. You cross to the far bank and walk on.
Correct reply: 1
The player's stated errand is what the story steers by, so it stays; the crossing is passing movement.

Second example:
1. You take the cliff path toward the lighthouse.
2. You promise the keeper Brann you will fetch his lamp oil from town.
3. You trade jokes with a fishwife on the quay.
4. You bring Brann his lamp oil, and he lights the beacon, calling you a friend of the tower.
Correct reply: 4
Entry 4 carries entry 2's outcome - the fulfilled promise replaces the promise itself, so the ending is kept and the setup is dropped. Entries 1 and 3 are passing moments no one would mention again.

Reply with only the numbers to keep, comma-separated.`,
  // stateful7: one merged example (goal kept AND resolution kept, side by side) + no met/unmet
  // language anywhere. stateful3 = merged example but poisoned wording; stateful5/6 = clean wording
  // but split examples that de-stabilized closure keeps. This is the untested pairing.
  stateful7: `You are the memory keeper of an interactive story. You are given the story's remembered moments as a numbered list, oldest first. Keep an entry only if someone in the story would bring it up again or act on it: a promise or debt still open, a threat or wound that persists, a thing gained and kept, a favor done or a slight given that changes how one character sees another, a secret learned, a role or pretense being played, or the player's own stated errand - who they say they are and where they are bound. Drop what no one would ever speak of again - passing movement, small talk, and any moment whose outcome a later entry already carries. When unsure whether something still matters, let it go.

Example:
1. You take the cliff path toward the lighthouse.
2. You tell the keeper Brann you are bound for the harbor at Selle, where your charts are due before the spring tide.
3. You promise Brann you will fetch his lamp oil from town.
4. You trade jokes with a fishwife on the quay.
5. You bring Brann his lamp oil, and he lights the beacon, calling you a friend of the tower.
Correct reply: 2, 5
Entry 2 is the player's stated errand - the story steers by it, so it stays. Entry 5 carries entry 3's outcome - the fulfilled promise replaces the promise itself, so the ending is kept and the setup is dropped. Entries 1 and 4 are passing moments no one would mention again.

Reply with only the numbers to keep, comma-separated.`,
  // stateful8: stateful7 with the example's resolution reshaped from favor-completed to DEBT REPAID —
  // the exact closure shape cloud keeps dropping (Essa repayment 3/3, letter handoff 2/3).
  stateful8: `You are the memory keeper of an interactive story. You are given the story's remembered moments as a numbered list, oldest first. Keep an entry only if someone in the story would bring it up again or act on it: a promise or debt still open, a threat or wound that persists, a thing gained and kept, a favor done or a slight given that changes how one character sees another, a secret learned, a role or pretense being played, or the player's own stated errand - who they say they are and where they are bound. Drop what no one would ever speak of again - passing movement, small talk, and any moment whose outcome a later entry already carries. When unsure whether something still matters, let it go.

Example:
1. You take the cliff path toward the lighthouse.
2. You tell the keeper Brann you are bound for the harbor at Selle, where your charts are due before the spring tide.
3. You borrow three silver from Brann to pay the chandler.
4. You trade jokes with a fishwife on the quay.
5. You repay Brann his three silver, and he calls you square.
Correct reply: 2, 5
Entry 2 is the player's stated errand - the story steers by it, so it stays. Entry 5 settles entry 3's debt - how it ended is what anyone would bring up, so the settling is kept and the borrowing is dropped. Entries 1 and 4 are passing moments no one would mention again.

Reply with only the numbers to keep, comma-separated.`,
  // genericex: stateful7's enumeration with the worked example rewritten as FORMAT-ONLY placeholders —
  // no concrete story values. A concrete example that shares its template with fixture entries (or real
  // play) makes both the probe and the feature measure pattern-matching; placeholders test whether the
  // lesson itself generalizes.
  genericex: `You are the memory keeper of an interactive story. You are given the story's remembered moments as a numbered list, oldest first. Keep an entry only if someone in the story would bring it up again or act on it: a promise or debt still open, a threat or wound that persists, a thing gained and kept, a favor done or a slight given that changes how one character sees another, a secret learned, a role or pretense being played, or the player's own stated errand - who they say they are and where they are bound. Drop what no one would ever speak of again - passing movement, small talk, and any moment whose outcome a later entry already carries. When unsure whether something still matters, let it go.

Example of the reasoning, with placeholder entries standing for any story:
1. <the player travels from one place to another>
2. <the player states who they are and what they mean to accomplish>
3. <the player promises a character they will do some task>
4. <idle small talk with a passerby>
5. <the player completes the promised task, and the character acknowledges it>
Correct reply: 2, 5
Entry 2 is the player's stated errand - the story steers by it, so it stays. Entry 5 carries entry 3's outcome - the fulfilled promise replaces the promise itself, so the ending is kept and the setup is dropped. Entries 1 and 4 are passing moments no one would mention again.

Reply with only the numbers to keep, comma-separated.`,
  // genericex2: genericex + a pretense placeholder entry in the example (Cydonia dropped the fixture's
  // standing-arrangement 3/3 without a demonstrated pretense keep).
  genericex2: `You are the memory keeper of an interactive story. You are given the story's remembered moments as a numbered list, oldest first. Keep an entry only if someone in the story would bring it up again or act on it: a promise or debt still open, a threat or wound that persists, a thing gained and kept, a favor done or a slight given that changes how one character sees another, a secret learned, a role or pretense being played, or the player's own stated errand - who they say they are and where they are bound. Drop what no one would ever speak of again - passing movement, small talk, and any moment whose outcome a later entry already carries. When unsure whether something still matters, let it go.

Example of the reasoning, with placeholder entries standing for any story:
1. <the player travels from one place to another>
2. <the player states who they are and what they mean to accomplish>
3. <a character agrees to pose as someone else, and the pretense begins>
4. <the player promises a character they will do some task>
5. <idle small talk with a passerby>
6. <the player completes the promised task, and the character acknowledges it>
Correct reply: 2, 3, 6
Entry 2 is the player's stated errand - the story steers by it, so it stays. Entry 3 is an arrangement still governing the scene - every later moment is misread without it. Entry 6 carries entry 4's outcome - the fulfilled promise replaces the promise itself, so the ending is kept and the setup is dropped. Entries 1 and 5 are passing moments no one would mention again.

Reply with only the numbers to keep, comma-separated.`,
  // stateful: fewshot + state-shaped keeps. The event taxonomy misses STATE: both test tiers dropped
  // the player's own stated goal 3/3 (and a real session lost its standing roleplay agreement) —
  // facts that stay true rather than things that happened.
  stateful: `You are the memory keeper of an interactive story. You are given the story's remembered moments as a numbered list, oldest first. Keep an entry only if someone in the story would bring it up again or act on it: a promise or debt still open, a threat or wound that persists, a thing gained and kept, a favor done or a slight given that changes how one character sees another, a secret learned, a task done well that someone might mention. Also keep what still governs the scene: an arrangement in effect - a role someone has assumed, a game agreed to, a name borrowed - and the player's own declared purpose while it is unmet: who they say they are, where they are bound, what is due and by when. Drop what no one would ever speak of again - passing movement, small talk, and any moment whose outcome a later entry already carries. When unsure whether something still matters, let it go.

Example:
1. You take the cliff path toward the lighthouse.
2. You promise the keeper Brann you will fetch his lamp oil from town.
3. You trade jokes with a fishwife on the quay.
4. You bring Brann his lamp oil, and he lights the beacon, calling you a friend of the tower.
Correct reply: 4
Entry 4 carries entry 2's outcome - the fulfilled promise replaces the promise itself, so the ending is kept and the setup is dropped. Entries 1 and 3 are passing moments no one would mention again.

Reply with only the numbers to keep, comma-separated.`,
  // twostep: supersession discrimination as its own dedicated output step before selection — the
  // structural fix for cloud keeping commitments and dropping resolutions (wording alone was null twice).
  twostep: `You are the memory keeper of an interactive story. You are given the story's remembered moments as a numbered list, oldest first.

Work in two steps:
1. On a line starting "Superseded:", list the numbers of entries whose outcome a later entry already carries - the agreement whose task was later finished, the hook whose quest was later resolved. The later entry replaces them.
2. On a line starting "Keep:", list the numbers to keep: entries someone in the story would bring up again or act on - a promise or debt still open, a threat or wound that persists, a thing gained and kept, a favor done or a slight given that changes how one character sees another, a secret learned, a task done well that someone might mention. A superseded entry is never kept - the later entry that replaced it is the one to keep. Drop passing movement and small talk. When unsure whether something still matters, let it go.

Reply with exactly those two lines.`,
};
const PROMPT_KEY = strArg("--prompt", "reframe");
const TWO_STEP = PROMPT_KEY === "twostep";
const SELECTOR_SYS = PROMPTS[PROMPT_KEY] ?? (() => { throw new Error(`unknown prompt '${PROMPT_KEY}'`); })();

const FIXTURE = strArg("--fixture", "milestone-fixture.json");
// --reverse: present the list newest-first (prompt wording flipped to match); scoring maps indices back.
const REVERSE = argv.includes("--reverse");
// --entityrule: post-filter prototype — the newest entry mentioning each known entity is force-kept
// (in-app this would ride the existing entity/alias matcher; here a per-story name list stands in).
const ENTITY_RULE = argv.includes("--entityrule");
const STORY_ENTITIES = {
  "ferry-quest": ["Halvern", "Wren"],
  "evening": ["Mara", "Sofia"],
  "town-intrigue": ["Essa", "Corin", "Odo", "harbormaster", "cooper"],
  "wilds": ["Maren", "hound"],
};
function entityForced(entries, storyName) {
  const forced = new Set();
  for (const name of STORY_ENTITIES[storyName] ?? []) {
    const re = new RegExp(`\\b${name}\\b`, "i");
    for (let i = entries.length - 1; i >= 0; i--) {
      if (re.test(entries[i].text)) { forced.add(i); break; }
    }
  }
  return forced;
}
const { stories } = JSON.parse(await readFile(path.join(HARNESS_DIR, FIXTURE), "utf8"));

async function callSelector(entries) {
  const shown = REVERSE ? [...entries].reverse() : entries;
  const list = shown.map((e, i) => `${i + 1}. ${e.text}`).join("\n");
  const order = REVERSE ? "newest first" : "oldest first";
  const headers = { "Content-Type": "application/json" };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  const res = await fetch(ENDPOINT, {
    method: "POST", headers,
    body: JSON.stringify({
      model: MODEL, temperature: 0, max_tokens: 200, reasoning_effort: "none", stream: false,
      messages: [
        { role: "system", content: SELECTOR_SYS.replace("oldest first", order) },
        { role: "user", content: `The story's remembered moments, ${order}:\n${list}\n\nReply with only the numbers to keep, comma-separated.` },
      ],
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return ((await res.json()).choices?.[0]?.message?.content ?? "").trim();
}

// Parse keep-indices; null = malformed (app behavior: keep everything).
function parseKeep(reply, count) {
  // Two-step replies carry a Superseded: line first; only the Keep: line's numbers are the selection.
  const source = TWO_STEP ? (reply.match(/Keep:\s*([^\n]*)/i)?.[1] ?? "") : reply;
  const nums = (source.match(/\d+/g) || []).map(Number).filter((n) => n >= 1 && n <= count);
  if (!nums.length) return null;
  // A reply that is mostly prose is suspect; accept if it contains at least one valid index and
  // no more text than a list plausibly carries.
  if (!TWO_STEP && reply.replace(/[\d,.\s\-and]+/gi, "").length > 40) return null;
  // Map shown positions back to chronological indices when the list was reversed.
  return new Set(nums.map((n) => (REVERSE ? count - n : n - 1)));
}

const agg = { mKept: 0, mAll: 0, eKept: 0, eAll: 0, dKept: 0, dAll: 0, malformed: 0, calls: 0 };
const misses = new Map(); // missed must-keep text -> count
const keptDrops = new Map(); // kept drop-tier text -> count

for (const story of stories) {
  const { entries } = story;
  let line = `${story.name.padEnd(14)}`;
  for (let r = 0; r < RUNS; r++) {
    let reply = "";
    try { reply = await callSelector(entries); } catch (e) { console.error(`[${story.name} r${r + 1}] ${e.message}`); }
    agg.calls++;
    const keep = parseKeep(reply, entries.length);
    if (!keep) { agg.malformed++; line += `  r${r + 1}:MALFORMED`; continue; }
    let forcedAdds = 0;
    if (ENTITY_RULE) {
      for (const i of entityForced(entries, story.name)) {
        if (!keep.has(i)) { keep.add(i); forcedAdds++; }
      }
    }
    let mK = 0, mA = 0, eK = 0, eA = 0, dK = 0, dA = 0;
    entries.forEach((e, i) => {
      const kept = keep.has(i);
      if (e.label === "must") { mA++; if (kept) mK++; else misses.set(e.text, (misses.get(e.text) || 0) + 1); }
      else if (e.label === "either") { eA++; if (kept) eK++; }
      else { dA++; if (kept) { dK++; keptDrops.set(e.text, (keptDrops.get(e.text) || 0) + 1); } }
    });
    agg.mKept += mK; agg.mAll += mA; agg.eKept += eK; agg.eAll += eA; agg.dKept += dK; agg.dAll += dA;
    line += `  r${r + 1}: must ${mK}/${mA} drop↑ ${dK}/${dA} either↑ ${eK}/${eA}${ENTITY_RULE ? ` forced+${forcedAdds}` : ""}`;
    if (verbose) console.log(`[${story.name} r${r + 1}] reply: ${reply}`);
  }
  console.log(line);
}

console.log(`\n==== ${MODEL_LABEL} · prompt '${PROMPT_KEY}' · ${RUNS} run(s)/story ====`);
console.log(
  `must recall ${(agg.mKept / Math.max(1, agg.mAll)).toFixed(2)} (gate >= 0.90)` +
  ` · drop keep ${(agg.dKept / Math.max(1, agg.dAll)).toFixed(2)} (target <= 0.10)` +
  ` · either keep ${(agg.eKept / Math.max(1, agg.eAll)).toFixed(2)} (informational)` +
  ` · malformed ${agg.malformed}/${agg.calls}`,
);
if (misses.size) {
  console.log(`\nMISSED MUST-KEEPS (expensive errors):`);
  for (const [text, n] of misses) console.log(`  ${n}× ${text}`);
}
if (keptDrops.size) {
  console.log(`\nKEPT DROPS (history mass):`);
  for (const [text, n] of keptDrops) console.log(`  ${n}× ${text.slice(0, 90)}`);
}
