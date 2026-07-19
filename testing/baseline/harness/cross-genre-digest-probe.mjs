// CROSS-GENRE digest probe — the generalization gate. All prior A/B evidence is one intimate session; the
// B summary prompt ("record the outcome, not the play-by-play") could help there but DROP genre-critical
// detail elsewhere: in combat the physical play-by-play IS the tactical state; in mystery a stray detail is
// a clue; in exploration the spatial layout is the state. This probe tests that directly.
//
// Each case is an authored SFW narration plus a hand-specified `must` list of DURABLE facts a later turn
// depends on (ground truth defined by us, NOT an LLM extractor — removing that noise). It digests the
// narration with BOTH prompts (A = HEAD snapshot via --a, B = working tree) at the summary sampler, then
// judges which `must` facts each digest preserves. Headline: does B retain the must-facts as well as A,
// per genre?
//
//   node cross-genre-digest-probe.mjs --a <A-snapshot GamePrompts.ts> [--only combat] [--verbose]

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, callMessages } from "./planner-probe-lib.mjs";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HARNESS_DIR, "../../..");
const argv = process.argv.slice(2);
const strArg = (f, d = null) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const aPath = strArg("--a", null);
if (!aPath) { console.error("Pass --a <A-snapshot GamePrompts.ts> (git show HEAD:... > file)."); process.exit(1); }
const only = strArg("--only");
const verbose = argv.includes("--verbose");
const opts = parseArgs(process.argv);

const grabFrom = (src, name) => {
  const at = src.indexOf(name + " = `");
  if (at === -1) throw new Error(`missing ${name}`);
  const s = src.indexOf("`", at) + 1;
  return src.slice(s, src.indexOf("`;", s));
};
const aSrc = await readFile(aPath, "utf8");
const bSrc = await readFile(path.join(REPO_ROOT, "src/components/game/GamePrompts.ts"), "utf8");
const prompts = (src) => ({ sys: grabFrom(src, "defaultSummaryPrompt"), user: grabFrom(src, "defaultSummaryUserPrompt") });
const A = prompts(aSrc), B = prompts(bSrc);

// Authored cross-genre cases. Each narration deliberately mixes durable state with disposable play-by-play,
// so B has beats to correctly drop; `must` = the durable, genre-critical facts that must survive.
const CASES = [
  {
    genre: "combat", action: "I break cover and rush the archer on the stairs.",
    narration: `You burst from behind the toppled cart and sprint for the stairs. The archer looses a shaft that punches through your left shoulder — pain flares white-hot, and your arm goes half-numb, the sword nearly slipping from that hand. You reach her before she can nock again and slam her against the railing; her bow clatters down the steps, out of reach below. Behind you, the second raider — the big one with the axe — has stopped trading blows with Bran and is turning your way. Bran is down on one knee, clutching a gash along his ribs, but still up.`,
    must: [
      "You are wounded in the left shoulder (an arrow hit)",
      "The archer's bow is lost down the stairs, out of her reach",
      "The axe raider is now turning to attack you",
      "Bran is injured (a gash on his ribs) but still fighting",
    ],
  },
  {
    genre: "mystery", action: "I search the study while the inspector waits outside.",
    narration: `The study smells of cold pipe smoke. You run your eyes over the desk: a half-written letter addressed to "M. Halloran," the ink still tacky at the last word, as if set down in a hurry. On the sill, a smear of river mud — odd, three floors up. The wall safe behind the portrait hangs open and empty, but a single train ticket to Aldermont, dated tomorrow, lies fallen beneath it. The mantel clock has stopped at 2:14. You pocket nothing, but you have seen enough.`,
    must: [
      "The unfinished letter is addressed to M. Halloran",
      "There is river mud on the third-floor windowsill",
      "The wall safe (behind the portrait) is open and empty",
      "A train ticket to Aldermont dated tomorrow was found",
      "The clock stopped at 2:14",
    ],
  },
  {
    genre: "exploration", action: "I follow the ridge trail to find a way down.",
    narration: `You pick your way along the ridge, wind tugging at your cloak. The trail forks: the left branch drops toward a cluster of smoke — a village, maybe an hour off — while the right hugs the cliff toward a stone tower on the headland. The rope bridge that once spanned the gorge ahead is gone, only two frayed ends swaying. You tuck a coil of dried meat and a flint into a crevice by a lightning-split pine, marking it in your mind, and turn back to choose a path.`,
    must: [
      "The trail forks: left leads to a village (about an hour), right toward a stone tower on the headland",
      "The rope bridge over the gorge is destroyed / impassable",
      "You cached dried meat and a flint by a lightning-split pine",
    ],
  },
  {
    genre: "negotiation", action: "I press the fence to name his terms.",
    narration: `Oswin turns the ring over, unimpressed, then names his price: forty crowns, not the sixty you hoped for, and only if you bring the matching brooch by the new moon — three nights off. He'll hold the buyer that long, no longer. And a warning, delivered flat: cross him, and the Wardens get an anonymous word about your name. You shake on it. The ring stays with him as surety.`,
    must: [
      "Oswin agreed to pay forty crowns (not sixty)",
      "The deal requires you to bring the matching brooch by the new moon, three nights away",
      "Oswin threatened to inform the Wardens about you if you cross him",
      "The ring stays with Oswin as surety",
    ],
  },
  {
    genre: "calm-control", action: "I sit by the fire and rest a while.",
    narration: `You settle onto the hearthstones and let the fire's warmth soak into your travel-stiff hands. The inn is quiet at this hour; a cat threads between the table legs and a log shifts, throwing a brief spray of sparks. Nothing stirs outside. You breathe, and for a while you simply rest.`,
    must: [], // control: nothing durable happens — a faithful digest is minimal / "nothing notable"
  },
];

const JUDGE_SYS = `You check whether a short memory note preserves a list of facts. The note need not use the same words - it preserves a fact if it conveys the same thing, explicitly or by clear implication. For each numbered fact, reply on its own line exactly "<n>: yes" or "<n>: no". Output only those lines.`;

async function digest(P, c) {
  const user = P.user.replaceAll("<PLAYER ACTION>", c.action).replaceAll("<NARRATION>", c.narration);
  return (await callMessages({ ...opts, temp: 0, maxTokens: 160 }, [
    { role: "system", content: P.sys }, { role: "user", content: user },
  ])).trim();
}
async function judge(must, dig) {
  if (!must.length) return [];
  const list = must.map((m, i) => `${i + 1}. ${m}`).join("\n");
  const out = await callMessages({ ...opts, temp: 0, maxTokens: 200 }, [
    { role: "system", content: JUDGE_SYS }, { role: "user", content: `Facts:\n${list}\n\nMemory note:\n${dig}` },
  ]);
  const yes = new Set();
  for (const m of out.matchAll(/(\d+)\s*:\s*(yes|no)/gi)) if (/yes/i.test(m[2])) yes.add(Number(m[1]));
  return must.map((_, i) => yes.has(i + 1));
}

const pick = CASES.filter((c) => !only || c.genre.includes(only));
console.log(`CROSS-GENRE DIGEST · A=${aPath.split(/[\\/]/).pop()} vs B=working tree · "${opts.model}"\n`);
const tot = { a: 0, b: 0, n: 0 };
for (const c of pick) {
  const dA = await digest(A, c), dB = await digest(B, c);
  const jA = await judge(c.must, dA), jB = await judge(c.must, dB);
  const aK = jA.filter(Boolean).length, bK = jB.filter(Boolean).length, n = c.must.length;
  tot.a += aK; tot.b += bK; tot.n += n;
  console.log(`## ${c.genre.toUpperCase()} — must-facts kept: A ${aK}/${n} · B ${bK}/${n}`);
  c.must.forEach((m, i) => { if (jA[i] !== jB[i]) console.log(`   DIFF [A ${jA[i] ? "kept" : "lost"} · B ${jB[i] ? "kept" : "lost"}] ${m}`); });
  if (verbose || aK !== bK) { console.log(`   A: ${dA}`); console.log(`   B: ${dB}`); }
  console.log();
}
const pc = (k) => tot.n ? `${((100 * k) / tot.n).toFixed(0)}%` : "—";
console.log(`==== ${tot.n} must-facts across ${pick.length} genres ====`);
console.log(`A retention ${pc(tot.a)} (${tot.a}/${tot.n}) · B retention ${pc(tot.b)} (${tot.b}/${tot.n})`);
