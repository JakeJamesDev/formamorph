// PROMPT REGRESSION RUNNER — one entry point that scores the prompt suite against a committed baseline and
// exits non-zero on regression. Built for the "≤30-min, run-it-when-worried" workflow: a small curated,
// repo-safe (SFW) corpus, every cheap metric scored off ONE generation (combine), and paid metrics
// (fact-retention judge) as an opt-in `--deep` layer.
//
// Two dimensions today:
//   continuation — charged-but-tasteful escalation planner cases: does the plan advance (freeze↓, npc acts &
//                  speaks) instead of freezing? (the register/advancement failure)
//   digest       — cross-genre digest cases: does the current summary prompt keep the authored must-facts?
//                  (the memory-fidelity failure), plus digest freeze as a free regex.
//
// Usage:
//   node regression-runner.mjs --update          # capture the CURRENT prompts as the baseline (do this on B)
//   node regression-runner.mjs                    # gate: score current prompts, diff vs baseline, exit 1 on regress
//   node regression-runner.mjs --deep             # add fact-retention (extra judge calls)
//   node regression-runner.mjs --runs 3           # more samples per case (default 2)

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseArgs, renderThinkingSys, buildThinkingUser, callMessages, parsePlan, scorePlan, FREEZE_RE, grab,
} from "./planner-probe-lib.mjs";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const BASELINE = path.join(HARNESS_DIR, "regression-baseline.json");
const argv = process.argv.slice(2);
const update = argv.includes("--update");
const deep = argv.includes("--deep");
const opts = parseArgs(process.argv, { runs: "5" }); // 5 default — calibrated so %-metrics aren't noise-dominated
const RUNS = Math.max(1, opts.runs);

// ── Corpus (committed, SFW). Charged cases stay at intimacy-onset level, matching the tracked gate world. ──
const CONT_WORLD = "A grounded modern-day adult romance. Two consenting adults, mutual desire established and escalating; the scene should keep moving under its own momentum.";
const SARAH = { name: "Sarah", description: "AGE: 27. Confident, warm, very into the player; forward and talkative rather than shy.", type: "Person" };
// 6 cases × runs (default 5) = 30 continuation samples — enough that a single flip is ~3%, not ~17%.
const CONTINUATION = [
  { name: "escalate-kiss", recap: "You've been leaning into each other on the couch; Sarah just kissed you, slow and certain, and pulled back only far enough to watch your face.", action: "I kiss her back harder and pull her closer against me." },
  { name: "spoken-declaration", recap: "The two of you are tangled together, breathless, foreheads resting against each other in the low light.", action: "I hold her gaze and tell her I want her to stay the night." },
  { name: "invite-forward", recap: "Sarah has you backed against the kitchen counter, one hand flat on your waist, grinning at how flustered you are.", action: "I take her hand and tell her to take me to bed." },
  { name: "reunion-embrace", recap: "You haven't seen Sarah in years; she just pulled you into a tight hug at the door, laughing through it.", action: "I hold her close and tell her how much I missed her." },
  { name: "hand-on-cheek", recap: "You're close together on the porch swing under the string lights, the conversation gone quiet and warm.", action: "I reach up and cup her cheek, my thumb brushing her jaw." },
  { name: "slow-dance", recap: "The kitchen radio is playing something slow; Sarah took your hand and pulled you up to dance.", action: "I draw her in and rest my forehead against hers." },
];

const DIGEST = [
  { genre: "combat", action: "I break cover and rush the archer on the stairs.",
    narration: `You burst from behind the toppled cart and sprint for the stairs. The archer looses a shaft that punches through your left shoulder — pain flares white-hot, and your arm goes half-numb, the sword nearly slipping from that hand. You reach her before she can nock again and slam her against the railing; her bow clatters down the steps, out of reach below. Behind you, the second raider — the big one with the axe — has stopped trading blows with Bran and is turning your way. Bran is down on one knee, clutching a gash along his ribs, but still up.`,
    must: ["You are wounded in the left shoulder", "The archer's bow is lost down the stairs, out of reach", "The axe raider is now turning to attack you", "Bran is injured but still fighting"] },
  { genre: "mystery", action: "I search the study while the inspector waits outside.",
    narration: `The study smells of cold pipe smoke. On the desk: a half-written letter addressed to "M. Halloran," ink still tacky. On the sill, a smear of river mud — odd, three floors up. The wall safe behind the portrait hangs open and empty, but a single train ticket to Aldermont, dated tomorrow, lies fallen beneath it. The mantel clock has stopped at 2:14.`,
    must: ["The letter is addressed to M. Halloran", "There is river mud on the third-floor windowsill", "The wall safe is open and empty", "A train ticket to Aldermont dated tomorrow was found", "The clock stopped at 2:14"] },
  { genre: "negotiation", action: "I press the fence to name his terms.",
    narration: `Oswin turns the ring over, then names his price: forty crowns, not the sixty you hoped for, and only if you bring the matching brooch by the new moon — three nights off. Cross him, he says flatly, and the Wardens get an anonymous word about your name. You shake on it. The ring stays with him as surety.`,
    must: ["Oswin agreed to pay forty crowns (not sixty)", "You must bring the matching brooch by the new moon, three nights away", "Oswin threatened to inform the Wardens if you cross him", "The ring stays with Oswin as surety"] },
  // Charged-but-tasteful case (gate-world level) — exercises the freeze register on the digest side, which
  // SFW combat/mystery don't. A regressed summary prompt reintroduces "goes still / processes" here.
  { genre: "intimacy", action: "I kiss her and pull her down with me.",
    narration: `You lean in and kiss Sarah, slow at first, and she answers it at once — one hand fisting in your shirt to pull you both down onto the couch. She breaks away just long enough to breathe "finally" against your mouth, then tells you her roommate is gone until morning and the front door is already locked. You can feel her heart hammering where your chests press together.`,
    must: ["You and Sarah moved onto the couch together", "Sarah's roommate is gone until morning", "The front door is locked"] },
];

const JUDGE_SYS = `You check whether a short memory note preserves a list of facts. It preserves a fact if it conveys the same thing, explicitly or by clear implication - same words not required. For each numbered fact reply on its own line "<n>: yes" or "<n>: no". Only those lines.`;

// ── Runner ──
const t0 = Date.now();
const SUM = { sys: grab("defaultSummaryPrompt"), user: grab("defaultSummaryUserPrompt") };
let calls = 0;
const call = (args, msgs) => { calls++; return callMessages(args, msgs); };

async function continuation() {
  let freeze = 0, action = 0, speech = 0, stall = 0, n = 0;
  for (const c of CONTINUATION) {
    const sys = renderThinkingSys({ world: CONT_WORLD, playerTrait: "Jessica, an adult woman", location: "Sarah's apartment", entities: [SARAH] });
    const user = buildThinkingUser(c.recap, c.action);
    for (let r = 0; r < RUNS; r++) {
      const out = await call({ ...opts, maxTokens: 256, temp: 0.4, seed: opts.seed + r }, [{ role: "system", content: sys }, { role: "user", content: user }]);
      const s = scorePlan(parsePlan(out).beats || out);
      freeze += s.freeze; if (s.npcAction) action++; if (s.npcSpeech) speech++; if (s.stall) stall++; n++;
    }
  }
  return { contFreeze: +(freeze / n).toFixed(2), contAction: Math.round(100 * action / n), contSpeech: Math.round(100 * speech / n), contStall: Math.round(100 * stall / n) };
}

async function digests() {
  let dFreeze = 0, kept = 0, total = 0, n = 0;
  for (const c of DIGEST) {
    const user = SUM.user.replaceAll("<PLAYER ACTION>", c.action).replaceAll("<NARRATION>", c.narration);
    for (let r = 0; r < RUNS; r++) {
      const dig = (await call({ ...opts, maxTokens: 160, temp: 0, seed: opts.seed + r }, [{ role: "system", content: SUM.sys }, { role: "user", content: user }])).trim();
      dFreeze += (dig.match(FREEZE_RE) || []).length; n++;
      if (deep) {
        const list = c.must.map((m, i) => `${i + 1}. ${m}`).join("\n");
        const j = await call({ ...opts, maxTokens: 200, temp: 0 }, [{ role: "system", content: JUDGE_SYS }, { role: "user", content: `Facts:\n${list}\n\nMemory note:\n${dig}` }]);
        const yes = new Set(); for (const m of j.matchAll(/(\d+)\s*:\s*(yes|no)/gi)) if (/yes/i.test(m[2])) yes.add(Number(m[1]));
        kept += yes.size; total += c.must.length;
      }
    }
  }
  const out = { digestFreeze: +(dFreeze / n).toFixed(2) };
  if (deep) out.factRetention = Math.round(100 * kept / total);
  return out;
}

console.log(`PROMPT REGRESSION · "${opts.model}" · runs ${RUNS}${deep ? " · deep (fact-retention)" : ""}\n`);
const metrics = { ...(await continuation()), ...(await digests()) };
const mins = ((Date.now() - t0) / 60000).toFixed(1);
console.log(`metrics: ${JSON.stringify(metrics)}`);
console.log(`(${calls} model calls · ${mins} min)\n`);

// dir = which direction is better; tol = how much worse than baseline is still allowed (set from the measured
// noise floor: 5 identical runs). advisory = report the drift but do NOT fail the gate on it (metrics still
// too coarse to gate reliably even at 30 samples — track them, don't block on them).
const SPEC = {
  contFreeze:    { dir: "lower",  tol: 0.3 },              // floor ±0
  contStall:     { dir: "lower",  tol: 6 },                // floor ±0
  factRetention: { dir: "higher", tol: 8 },                // floor ±4
  digestFreeze:  { dir: "lower",  tol: 0.3 },              // floor ±0 (now has signal via the charged case)
  contAction:    { dir: "higher", tol: 15, advisory: true }, // floor ±33 at n=6 → advisory even at n=30
  contSpeech:    { dir: "higher", tol: 12, advisory: true }, // floor ±16 at n=6 → advisory
};

if (update || !(await readFile(BASELINE).then(() => true).catch(() => false))) {
  await writeFile(BASELINE, JSON.stringify({ model: opts.model, runs: RUNS, capturedMetrics: metrics }, null, 2));
  console.log(`${update ? "Updated" : "No baseline found — captured"} baseline → ${path.basename(BASELINE)}`);
  process.exit(0);
}

const base = JSON.parse(await readFile(BASELINE, "utf8")).capturedMetrics;
let fail = 0;
console.log("metric          baseline  current   verdict");
for (const [k, v] of Object.entries(metrics)) {
  if (base[k] === undefined || !SPEC[k]) continue;
  const { dir, tol, advisory } = SPEC[k];
  const regressed = dir === "lower" ? v > base[k] + tol : v < base[k] - tol;
  if (regressed && !advisory) fail++;
  const verdict = advisory ? (regressed ? "drift (advisory)" : "ok (advisory)") : (regressed ? "REGRESSED ✗" : "ok");
  console.log(`${k.padEnd(15)} ${String(base[k]).padStart(7)} ${String(v).padStart(9)}   ${verdict}`);
}
console.log(`\n${fail ? `FAIL — ${fail} gating metric(s) regressed beyond tolerance` : "PASS — no gating regression"}`);
process.exit(fail ? 1 : 0);
