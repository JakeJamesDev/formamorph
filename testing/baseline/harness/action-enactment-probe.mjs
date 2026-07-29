// ACTION ENACTMENT + WORLD ADJUDICATION probe — the evidence bar for two proposed narration levers:
//
//   L1 "first beat"  the player's action goes on the page as it happens, voiced. Shipped wording tells the
//        model the player's words are already spoken, so a vague speech action ("I tell him what I think")
//        comes back as the NPC restating it in their own mouth - flat, and the player never speaks.
//   L2 "attempt"     the narrator adjudicates. The planner already defers this ("you never decide whether
//        the player's own action succeeds - the narrator judges that") and nothing downstream picks it up,
//        so an impossible action simply happens.
//   BRACKET          authorial [direction] outranks L2, so an impossible action still lands when asked for.
//
// Both halves are guarded against their own overreach, which is most of the point:
//   L1's guard   wordless actions (ctl-*, control "silent") must NOT sprout invented player dialogue, and
//                NPC participation must not fall - the clause being rewritten is half the measured 3x
//                dialogue lever, so trading NPC speech for player speech is a loss, not a win.
//   L2's guard   trivial and hard-but-possible actions (control "possible") must still succeed; a prompt
//                that adjudicates attempts will happily start failing "I sit down".
//
// Metrics per case/run: pcSpeech (quotes attributed to the player) · npcSpeech (quotes attributed to
// anyone else) · parrot (NPC quote restating the action's own content words) · leak (bracket text on the
// page) · plus two temp-0 judges: tone (does the player's speech carry what the action names) and outcome
// (succeed / partly / fail). Judges run on the cloud endpoint by default - free, and independent of the
// model under test.
//
//   node action-enactment-probe.mjs --arm shipped --runs 3
//     [--endpoint ... --model ...] [--only enact-angry] [--judge-endpoint ...] [--nojudge] [--verbose]

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { callMessages, grab, QUOTE_RE } from "./planner-probe-lib.mjs";
import { applyLevers, renderNarrationSys } from "./rider-arms.mjs";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const str = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const num = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? Number(argv[i + 1]) : d; };
const verbose = argv.includes("--verbose");

const ARM = str("--arm", "shipped");
const RUNS = num("--runs", 3);
const SEED = num("--seed", 7);
const ONLY = str("--only", null);
const JUDGE = !argv.includes("--nojudge");
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

const cases = JSON.parse(await readFile(path.join(HARNESS_DIR, "../action-enactment-cases.json"), "utf8"))
  .filter((c) => !ONLY || c.id === ONLY);

// ── Prompts: shipped text, arm applied, world filled from the case's committed world file ──
const { sys: ARM_SYS, userRider: ARM_USER, oocRider: ARM_OOC } = applyLevers(ARM, {
  sys: grab("defaultSystemPrompt"),
  userRider: grab("defaultNarrationUserPrompt"),
  oocRider: grab("defaultOocDirectivePrompt"),
});
const MARKDOWN = grab("MARKDOWN_ON");
const USER_RIDER_TAIL = ARM_USER.replace("<PLAYER ACTION>", "").trim();

const worldCache = new Map();
async function loadWorld(file) {
  if (!worldCache.has(file)) worldCache.set(file, JSON.parse(await readFile(path.join(HARNESS_DIR, "..", file), "utf8")));
  return worldCache.get(file);
}
const describe = (x) => (x?.aiDescription || x?.description || "").trim();

async function messagesFor(c) {
  const w = await loadWorld(c.world);
  const loc = (w.locations ?? []).find((l) => l.name === c.location);
  if (!loc) throw new Error(`${c.id}: no location "${c.location}" in ${c.world}`);
  const here = (w.entities ?? []).filter((e) => c.present.includes(e.name));
  if (here.length !== c.present.length) throw new Error(`${c.id}: cast ${c.present} not all present in ${c.world}`);

  const sys = renderNarrationSys(ARM_SYS, {
    WORLD: w.worldOverview || "",
    PLAYER_TRAIT: "a traveler who came down to the landing on foot",
    LOCATION: `${loc.name}\n- **description:** ${describe(loc)}`,
    ENTITIES: here.map((e) => ({ name: e.name, type: e.type ?? "Person", description: describe(e) })),
  }, { markdown: MARKDOWN, length: "Aim for two to four tight paragraphs; land the moment and stop." });

  // Bracketed actions carry the OOC rider as the app composes it (bracket turns only).
  const bracketed = /\[[^\]]+\]/.test(c.action);
  const riders = [USER_RIDER_TAIL, bracketed ? ARM_OOC : null].filter(Boolean).join("\n\n");
  return [
    { role: "system", content: sys },
    { role: "user", content: "Recap the story so far." },
    { role: "assistant", content: c.prior },
    { role: "user", content: `${c.action}\n\n${riders}` },
  ];
}

// ── Speaker attribution (kept in lockstep with app-dialogue-score.mjs) ──
// Wide on purpose: a speech verb missing from this list silently reassigns the player's own line to the
// NPC bucket, which both undercounts player speech AND scores their words as the NPC parroting them.
const PC_VERB_STEMS = [
  "say", "ask", "whisper", "murmur", "tell", "reply", "answer", "breathe", "call", "promise", "offer",
  "add", "manage", "repeat", "echo", "press", "insist", "admit", "confess", "mutter", "mumble", "snap",
  "spit", "lie", "shout", "hiss", "growl", "plead", "beg", "counter", "explain", "state", "describe",
  "demand", "urge", "argue", "protest", "confide", "venture", "blurt", "stammer", "swear", "warn",
  "agree", "remark", "note", "observe", "continue", "begin", "finish", "return", "voice", "speak",
  "declare", "announce", "correct", "concede", "object", "reason", "sigh", "laugh", "growl", "rasp",
];
// stem + s + irregular pasts the models actually use.
const PC_VERB = `(?:${[...PC_VERB_STEMS, ...PC_VERB_STEMS.map((v) => `${v}s`), "said", "told", "spoke", "began", "swore", "lied"].join("|")})`;
const PC_BEFORE = new RegExp(`\\byou(?:r voice)?\\s+(?:\\w+\\s+){0,3}?${PC_VERB}\\b`, "i");
const PC_AFTER = new RegExp(`^[,—-]?\\s*you\\s+${PC_VERB}\\b`, "i");

// Attribution is sentence-local, and a named cast member in the quote's own sentence wins over a "you
// ... say" further back: the narrator restating the action in prose ("You tell Bram what you think.")
// otherwise captures the NPC's reply two sentences later and scores it as player speech.
const rx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function splitQuotes(text, cast = []) {
  const pc = [], npc = [];
  const named = (s) => cast.some((n) => new RegExp(`\\b${rx(n.split(/\s+/)[0])}\\b`).test(s));
  const sentences = text.split(/(?<=[.!?…]["'”’]?)\s+/);
  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    QUOTE_RE.lastIndex = 0;
    let m;
    while ((m = QUOTE_RE.exec(s))) {
      const body = m[0].replace(/^["“]|["”]$/g, "");
      const after = s.slice(m.index + m[0].length, m.index + m[0].length + 30);
      const outside = s.slice(0, m.index) + s.slice(m.index + m[0].length);
      // Same sentence decides when it can: a cast name means theirs, a "you ... say" means the player's.
      if (named(outside)) { npc.push(body); continue; }
      if (PC_BEFORE.test(outside) || PC_AFTER.test(after)) { pc.push(body); continue; }
      // Unattributed: fall back to the previous sentence, same precedence.
      const prev = sentences[i - 1] ?? "";
      if (named(prev)) npc.push(body);
      else if (PC_BEFORE.test(prev)) pc.push(body);
      else npc.push(body); // default to the world, never to the player
    }
  }
  return { pc, npc };
}

const STOP = new Set("i a an and the to my me of in on at with for as it is was be you your her his their them that this so into onto but or if then him she he what about".split(" "));
const content = (s) => [...new Set(s.toLowerCase().match(/[a-z']{3,}/g)?.filter((w) => !STOP.has(w)) ?? [])];
// Parroting: an NPC quote that hands the action's own words back ("You're telling me what you think?").
function parrotScore(action, npcQuotes) {
  const want = content(action);
  if (!want.length || !npcQuotes.length) return 0;
  const said = new Set(content(npcQuotes.join(" ")));
  return want.filter((w) => said.has(w)).length / want.length;
}

// ── Judges (temp 0) ──
const judge = async (system, user) =>
  (await callMessages({ ...judgeOpts, maxTokens: 12, seed: 1, temp: 0, repPen: 1 },
    [{ role: "system", content: system }, { role: "user", content: user }])).trim().toLowerCase();

// The judge only ever sees passages where the player demonstrably has quoted words (the caller gates on
// attribution first): asked cold, it happily rates narrated summary - "You lay out what you think" - as
// register-matching, which scored the exact failure being measured as a pass.
const TONE_SYS = "You are given a stage direction, the register it asks for, and the player character's own quoted words from a story passage. Answer with one word: MATCH if those quoted words carry the attitude the direction names, or MISMATCH if they carry a different one. Nothing else.";
const OUTCOME_SYS = "You judge how an attempted action turned out in a story passage. Answer with one word: SUCCEED if the character achieves what they attempted, FAIL if they attempt it and it does not work, or PARTLY if it half-lands. Nothing else.";

// Gated: no quoted player speech means ABSENT by attribution, never by the judge's opinion of the prose.
const toneOf = (c, pcQuotes) =>
  pcQuotes.length
    ? judge(TONE_SYS, `Stage direction: ${c.action}\nRegister asked for: ${c.mood}\n\nThe player character's quoted words:\n${pcQuotes.map((q) => `"${q}"`).join("\n")}`)
    : Promise.resolve("absent");
const outcomeOf = (c, out) => judge(OUTCOME_SYS, `Attempted action: ${c.action.replace(/^\[|\]$/g, "")}\n\nPassage:\n${out}`);

// ── Run ──
console.log(`ACTION ENACTMENT · arm ${ARM} · "${opts.model}" · ${cases.length} case(s) × ${RUNS} run(s)${JUDGE ? ` · judge "${judgeOpts.model}"` : " · judges off"}\n`);
console.log("case         fam      pc   npc  parrot  leak   tone/outcome");

const OUT = str("--out", null);
const dump = [];
const agg = {
  enact: { n: 0, pc: 0, npc: 0, parrot: 0, match: 0, mismatch: 0, absent: 0 },
  silent: { n: 0, pc: 0, npc: 0 },
  imp: { n: 0, fail: 0, partly: 0, succeed: 0 },
  possible: { n: 0, succeed: 0, partly: 0, fail: 0 },
  bracket: { n: 0, ok: 0, leak: 0 },
};

for (const c of cases) {
  const messages = await messagesFor(c);
  const row = { pc: 0, npc: 0, parrot: 0, leak: 0, verdicts: [] };
  for (let r = 0; r < RUNS; r++) {
    const out = (await callMessages({ ...opts, maxTokens: 600, seed: SEED + r, temp: 0.8, repPen: 1 }, messages)).trim();
    const { pc, npc } = splitQuotes(out, c.present);
    const parrot = parrotScore(c.action, npc);
    const leak = /\[[^\]]*\]/.test(out) ? 1 : 0;
    row.pc += pc.length; row.npc += npc.length; row.parrot += parrot; row.leak += leak;

    let verdict = "";
    if (c.family === "enact" && !c.control && JUDGE) verdict = await toneOf(c, pc);
    else if ((c.family === "plaus" || c.family === "bracket") && JUDGE) verdict = await outcomeOf(c, out);
    row.verdicts.push(verdict || (pc.length ? "pc-speech" : "silent"));

    if (c.family === "enact" && !c.control) {
      agg.enact.n++; agg.enact.pc += pc.length ? 1 : 0; agg.enact.npc += npc.length ? 1 : 0;
      agg.enact.parrot += parrot;
      if (verdict.startsWith("match")) agg.enact.match++;
      else if (verdict.startsWith("mismatch")) agg.enact.mismatch++;
      else agg.enact.absent++;
    }
    if (c.control === "silent") { agg.silent.n++; agg.silent.pc += pc.length ? 1 : 0; agg.silent.npc += npc.length ? 1 : 0; }
    if (c.family === "plaus" && c.expect === "fail") {
      agg.imp.n++;
      if (verdict.startsWith("fail")) agg.imp.fail++; else if (verdict.startsWith("partly")) agg.imp.partly++; else agg.imp.succeed++;
    }
    if (c.control === "possible") {
      agg.possible.n++;
      if (verdict.startsWith("succeed")) agg.possible.succeed++; else if (verdict.startsWith("partly")) agg.possible.partly++; else agg.possible.fail++;
    }
    if (c.family === "bracket") {
      agg.bracket.n++; agg.bracket.leak += leak;
      const want = c.expect === "succeed" ? verdict.startsWith("succeed") : verdict.startsWith("fail");
      if (want && !leak) agg.bracket.ok++;
    }
    if (verbose) console.log(`\n[${c.id} #${r + 1} · ${verdict}]\n${out}\n`);
    dump.push({ arm: ARM, model: opts.model, id: c.id, family: c.family, control: c.control ?? null, run: r + 1, action: c.action, mood: c.mood ?? null, verdict, pc, npc, parrot, text: out });
  }
  const tag = c.control ? `${c.family}/${c.control}` : c.family;
  console.log(
    `${c.id.padEnd(13)}${tag.padEnd(9)}${(row.pc / RUNS).toFixed(1).padStart(4)}${(row.npc / RUNS).toFixed(1).padStart(6)}` +
    `${(row.parrot / RUNS).toFixed(2).padStart(8)}${String(row.leak).padStart(6)}   ${row.verdicts.join(",")}`,
  );
}

const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : "n/a");
console.log(`\n==== arm ${ARM} · ${opts.model} ====`);
console.log(`L1 speech cases (${agg.enact.n}): player speaks ${pct(agg.enact.pc, agg.enact.n)} · NPC speaks ${pct(agg.enact.npc, agg.enact.n)} · parrot ${(agg.enact.parrot / Math.max(1, agg.enact.n)).toFixed(2)} · tone ${agg.enact.match} match / ${agg.enact.mismatch} mismatch / ${agg.enact.absent} absent`);
console.log(`L1 GUARD silent cases (${agg.silent.n}): invented player speech ${pct(agg.silent.pc, agg.silent.n)} (want 0%) · NPC speaks ${pct(agg.silent.npc, agg.silent.n)}`);
console.log(`L2 impossible (${agg.imp.n}): fail ${agg.imp.fail} · partly ${agg.imp.partly} · succeed ${agg.imp.succeed} (want all fail)`);
console.log(`L2 GUARD possible (${agg.possible.n}): succeed ${agg.possible.succeed} · partly ${agg.possible.partly} · fail ${agg.possible.fail} (want all succeed)`);
console.log(`BRACKET (${agg.bracket.n}): as-directed ${pct(agg.bracket.ok, agg.bracket.n)} · bracket text leaked ${agg.bracket.leak}`);

if (OUT) {
  await (await import("node:fs/promises")).writeFile(OUT, JSON.stringify(dump, null, 2), "utf8");
  console.log(`wrote ${OUT} (${dump.length} passages)`);
}
