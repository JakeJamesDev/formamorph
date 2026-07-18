// Choices probe — feeds the real choices prompt (defaultChoicesPrompt + defaultChoicesUserPrompt) a set of
// pre-written, standard-prose narration passages (NOT engineered to trip anything) and measures how well the
// output holds the contract: 3-5 lines, each ONE first-person action sentence, no numbering/bullets/quotes/
// headings/lead-in/commentary, never bordering on prose. Reports leaks and verbosity per case, prints the
// raw options to read. Defaults to the FieryLion default endpoint.
//
// Usage:  node choices-probe.mjs [--endpoint URL] [--model default] [--runs 2] [--max 320] [--only ford]

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HARNESS_DIR, "../../..");
const args = process.argv.slice(2);
const argVal = (f, d = null) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const endpoint = argVal("--endpoint", "https://api.lyonade.net/v1/chat/completions");
const model = argVal("--model", "default");
const runs = Number(argVal("--runs", "2"));
const maxTokens = Number(argVal("--max", "320"));
const only = argVal("--only");
const token = argVal("--token", process.env.PROBE_TOKEN || "");

const { world, playerTrait, location } = JSON.parse(
  await readFile(path.resolve(HARNESS_DIR, "../planning-cases.json"), "utf8"),
);

// Standard-prose narration passages across moods/scene types — representative storytelling, not bait. Each
// carries the entities present so the choices step can engage them, mirroring the real app's context.
const CASES = [
  {
    name: "standoff",
    entities: [{ name: "Corvin", description: "A debt collector, soft-voiced, hard-eyed; a knife under his coat.", type: "Person" }],
    narration:
      "Corvin rises from the table without hurry, smoothing the front of his coat with one pale hand. The pleasant mask has not slipped, but his eyes have gone flat and cold. \"You're a hard woman to do business with,\" he says, and his hand does not stop at the buttons - it drifts on, toward the dark line of a sheath half-hidden beneath the wool. Behind him, the tavern has gone quiet; the barkeep has found somewhere else to look.",
  },
  {
    name: "discovery",
    entities: [{ name: "the strongbox", description: "An iron strongbox salvaged from a wreck.", type: "Object" }],
    narration:
      "The lock gives with a gritty snap and the lid groans back on salt-stiff hinges. Inside there is no gold - only a bundle of oilcloth, which you peel open to find a sheaf of charts. They are maps of this very river, drawn in a careful hand, every shoal and depth marked, and along the margins someone has inked notes in a cipher you do not recognize. The topmost sheet is dated only last spring.",
  },
  {
    name: "gossip",
    entities: [{ name: "Odette", description: "A market woman who loves to talk and misses nothing.", type: "Person" }],
    narration:
      "Odette leans so far over her stall that the dried herbs brush your sleeve, her voice dropping to the delighted hush of someone with a secret to spend. \"Three of them, mind, all in city wool, asking after the old quarry road - the one nobody's walked since the flood.\" She straightens, eyeing your ink-stained hands with fresh interest. \"You're a mapmaker, aren't you? Now what would three grim men want with a road that goes nowhere?\"",
  },
  {
    name: "ford",
    entities: [{ name: "the ford", description: "A flooded river crossing; the guide rope runs bank to bank.", type: "Location" }],
    narration:
      "Halfway across, the water climbs from your knees to your thighs in the space of two steps, cold enough to steal the breath. The guide rope thrums under your grip, slick with weed, and somewhere upstream a log strikes a stone with a crack like a shot. Your pack drags at your shoulders, heavy with everything you own, and the far bank still seems a long, dark way off.",
  },
  {
    name: "arrival",
    entities: [
      { name: "the inn", description: "A low, lamplit inn at the top of the landing.", type: "Location" },
      { name: "Sedge", description: "A fisherwoman mending nets on the jetty.", type: "Person" },
    ],
    narration:
      "The ferry noses into the landing as the last light drains from the sky, and the hamlet reveals itself in pieces: a lamplit inn at the top of the rise, its door propped open on warmth and noise; the black jetty below, where a lone figure sits mending nets by feel; and a mud track that bends away east into the fog, toward wherever the road goes next. The ferryman waits, one hand out for his coin.",
  },
  {
    name: "reunion",
    entities: [{ name: "Mira", description: "An old friend the player had lost touch with.", type: "Person" }],
    narration:
      "\"I wrote them,\" Mira says, and the laughter is gone from her voice now. \"Every week, for a year. I just never sent a one.\" She turns the frayed hem of her apron over and over in her fingers, not meeting your eye. \"I told myself you'd have moved on. That a letter would only drag you back to a place you'd worked so hard to leave.\" The lantern sways between you, and she finally looks up, waiting to see what you will make of it.",
  },
];

const source = await readFile(path.join(REPO_ROOT, "src/components/game/GamePrompts.ts"), "utf8");
const grab = (name) => {
  const at = source.indexOf(name + " = `");
  if (at === -1) throw new Error("missing " + name);
  const from = source.indexOf("`", at) + 1;
  return source.slice(from, source.indexOf("`;", from));
};
const SYS = grab("defaultChoicesPrompt");
const USER = grab("defaultChoicesUserPrompt");
const renderEntities = (entities) =>
  entities.map((e) => `- **${e.name}** - ${e.description} (${e.type})`).join("\n");
const renderSys = (c) =>
  SYS
    .replaceAll("<WORLD DESCRIPTION>", world)
    .replaceAll("<STATS DESCRIPTION|descriptions.markdown>", "- **Resolve:** steady\n- **Guile:** sharp")
    .replaceAll("<TRAITS DESCRIPTION|markdown>", `- **Identity:** ${playerTrait}`)
    .replaceAll("<NOTES>", "None")
    .replaceAll("<LOCATION|summary.markdown>", `- **name:** ${location}`)
    .replaceAll("<LOCATION|sublocations.summary.markdown>", "N/A")
    .replaceAll("<LOCATION|reachable.summary.markdown>", "N/A")
    .replaceAll("<ENTITIES|summary.markdown>", renderEntities(c.entities))
    .replaceAll("<ENTITIES|sublocations.summary.markdown>", "N/A")
    .replaceAll("<ENTITIES|reachable.summary.markdown>", "N/A");
const renderUser = (c) => USER.replaceAll("<NARRATION>", c.narration);

async function call(sys, user) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(endpoint, {
    method: "POST", headers,
    body: JSON.stringify({ model, messages: [{ role: "system", content: sys }, { role: "user", content: user }], max_tokens: maxTokens, reasoning_effort: "none", stream: false }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const j = await res.json();
  return (j.choices?.[0]?.message?.content ?? "").trim();
}

// Contract checks per line.
const BULLET = /^\s*([-*•‣·]|\d+[.)])\s/;                       // numbering / bullets / dashes
const HEADING = /^\s*#{1,6}\s/;                                  // markdown heading
const QUOTED = /^\s*["'“][\s\S]*["'”]\s*$/;                      // whole line wrapped in quotes
const LEADIN = /^\s*(here (are|is)|here'?s|your options|options\b|choose\b|i could:|you (can|could|might)\b|possible actions)/i;
const FIRST_PERSON = /^\s*(I|I'|I’|My )\b/;                      // first-person action ("I ..." / "My ...")
const sentences = (s) => (s.match(/[.!?]+(\s|$)/g) || []).length;
const words = (s) => (s.trim().match(/\S+/g) || []).length;

// Verbal-answer axis (both directions). SPEAKS = the option has the player say content; ANSWER = speaks and
// isn't a deflection. QUESTION_CASES pose a question / invite a reply — they WANT >=1 answer. The rest have no
// one or nothing to answer, so they're the false-positive guard: verbal there should stay ~0.
const SPEAKS = /("[^"]{2,}"|\b(tells?|told|says?|saying|answer(s|ing)?|repl(y|ies|ying)|responds?|responding|admit|explain|confess|insist|agree|deny|denies|l(ie|ying)|claim|mention|joke|introduce|assure|remind|announce|blurt)\b)/i;
const DEFLECT = /\b(deflect|vague|avoid|decline|dodge|stall|evade|change the subject|turn it back|say(s|ing)? nothing|mysterious|refuse|without answering|non-?committal|sidestep|rather (not|talk about)|something else)\b/i;
const QUESTION_CASES = new Set(["gossip", "reunion"]); // Odette asks a question; Mira waits for a spoken reply

const pick = CASES.filter((c) => !only || c.name.includes(only));
console.log(`Choices probe · ${endpoint} · "${model}" · ${pick.length} case(s) · ${runs} run(s)/case`);
console.log(`Contract: 3-5 lines · each ONE first-person sentence · no bullets/quotes/headings/lead-in/commentary\n`);
await call(renderSys(pick[0]), "warm up").catch(() => {});

const T = { runs: 0, options: 0, leaks: 0, nonFP: 0, multiSent: 0, longOpt: 0, badCount: 0, maxWords: 0,
  qAnswers: 0, qRuns: 0, npVerbal: 0, npRuns: 0 };
for (const c of pick) {
  console.log(`\n######## ${c.name}`);
  for (let r = 0; r < runs; r++) {
    let out, err = null;
    try { out = await call(renderSys(c), renderUser(c)); } catch (e) { err = String(e.message || e); }
    T.runs++;
    if (err) { console.log(`  #${r + 1} ERROR: ${err}`); continue; }
    const lines = out.split("\n").map((l) => l.trim()).filter(Boolean);
    T.options += lines.length;
    let leaks = 0, nonFP = 0, multi = 0, long = 0;
    const rows = lines.map((l) => {
      const flags = [];
      if (BULLET.test(l)) flags.push("bullet/num");
      if (HEADING.test(l)) flags.push("heading");
      if (QUOTED.test(l)) flags.push("quoted");
      if (LEADIN.test(l)) flags.push("lead-in");
      const fp = FIRST_PERSON.test(l);
      if (!fp && !flags.length) flags.push("non-1st-person");
      if (!fp) nonFP++;
      const w = words(l), s = sentences(l);
      if (s > 1) { multi++; flags.push(`${s}-sent`); }
      if (w > 25) { long++; flags.push(`${w}w`); }
      if (w > T.maxWords) T.maxWords = w;
      if (flags.some((f) => ["bullet/num", "heading", "quoted", "lead-in", "non-1st-person"].includes(f))) leaks++;
      return { l, w, flags };
    });
    const countOk = lines.length >= 3 && lines.length <= 5;
    if (!countOk) T.badCount++;
    T.leaks += leaks; T.nonFP += nonFP; T.multiSent += multi; T.longOpt += long;
    // Verbal-answer axis: count spoken/answering options; accumulate split by question vs non-question case.
    const isQ = QUESTION_CASES.has(c.name);
    const speaks = lines.filter((l) => SPEAKS.test(l)).length;
    const answers = lines.filter((l) => SPEAKS.test(l) && !DEFLECT.test(l)).length;
    if (isQ) { T.qAnswers += answers; T.qRuns++; } else { T.npVerbal += speaks; T.npRuns++; }
    const verbalNote = isQ ? `answer ${answers}` : `verbal ${speaks} (want 0)`;
    console.log(`  #${r + 1} ${lines.length} opts${countOk ? "" : " (COUNT!)"} · leaks ${leaks} · multi-sent ${multi} · >25w ${long} · ${verbalNote}`);
    for (const row of rows) console.log(`      ${SPEAKS.test(row.l) ? "🗣" : "  "}[${String(row.w).padStart(2)}w${row.flags.length ? " " + row.flags.join(",") : ""}] ${row.l}`);
  }
}
console.log(`\n==== ${T.runs} runs · ${(T.options / T.runs).toFixed(1)} opts/run · bad-count ${T.badCount} · leaks ${T.leaks} · non-1st-person ${T.nonFP} · multi-sentence ${T.multiSent} · >25w ${T.longOpt} · longest ${T.maxWords}w ====`);
console.log(`==== verbal-answer axis · question scenes: ${T.qRuns ? (T.qAnswers / T.qRuns).toFixed(1) : "-"} answers/run (want >=1) · non-question scenes: ${T.npRuns ? (T.npVerbal / T.npRuns).toFixed(1) : "-"} verbal/run (false-positive guard, want ~0) ====`);
