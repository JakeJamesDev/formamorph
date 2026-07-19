// SECTION-STYLE regression probe — A/B the DEFAULT (markdown) vs XML prompt preset on the committed
// regression corpus, both dimensions (continuation planner + digest summary). Same corpus, same seeds,
// same model; the section style is the ONLY variable, so the delta is the style's effect.
//
// Faithful to the app's XML preset: chip bodies are rendered through the REAL context builders in each
// format (markdown bullets vs nested tags) and the assembled system prompt's headings are wrapped by the
// REAL `restyle` (## Heading -> <heading>). Order mirrors GameViewer: fill chips, then restyle.
//
// MUST run under vite-node so it can import the TS transforms:
//   node_modules/.bin/vite-node testing/baseline/harness/regression-style-probe.mjs -- --model cydonia-24b-v4.3@q4_k_m --runs 3
//
// Continuation metrics (per style): contFreeze (lower=better) · contAction% · contSpeech% · contStall%.
// Digest metric: digestFreeze (lower=better). GOAL: xml should not regress freeze/stall vs markdown.

import { restyle } from "@/lib/sectionStyle";
import { buildLocationContext, buildEntityContext } from "@/lib/locationContext";
import { buildTraitContext } from "@/lib/traitTree";
import {
  parseArgs, grab, buildThinkingUser, callMessages, parsePlan, scorePlan, FREEZE_RE,
} from "./planner-probe-lib.mjs";

const opts = parseArgs(process.argv, { runs: "3" });
const RUNS = Math.max(1, opts.runs);
const STYLES = ["markdown", "xml"];

// ── Committed regression corpus (mirrors regression-runner.mjs; keep in sync) ──
const CONT_WORLD = "A grounded modern-day adult romance. Two consenting adults, mutual desire established and escalating; the scene should keep moving under its own momentum.";
const LOCATION = { name: "Sarah's apartment", aiSummary: "Sarah's apartment — warm lamplight, a couch, a small kitchen off to one side.", entities: ["sarah"] };
const ENTITIES = [{ id: "sarah", name: "Sarah", type: "Person", aiSummary: "AGE: 27. Confident, warm, very into the player; forward and talkative rather than shy." }];
const TRAITS = [{ id: "identity", name: "Identity", aiDescription: "Jessica, an adult woman", groupId: null, order: 0 }];

const CONTINUATION = [
  { name: "escalate-kiss", recap: "You've been leaning into each other on the couch; Sarah just kissed you, slow and certain, and pulled back only far enough to watch your face.", action: "I kiss her back harder and pull her closer against me." },
  { name: "spoken-declaration", recap: "The two of you are tangled together, breathless, foreheads resting against each other in the low light.", action: "I hold her gaze and tell her I want her to stay the night." },
  { name: "invite-forward", recap: "Sarah has you backed against the kitchen counter, one hand flat on your waist, grinning at how flustered you are.", action: "I take her hand and tell her to take me to bed." },
  { name: "reunion-embrace", recap: "You haven't seen Sarah in years; she just pulled you into a tight hug at the door, laughing through it.", action: "I hold her close and tell her how much I missed her." },
  { name: "hand-on-cheek", recap: "You're close together on the porch swing under the string lights, the conversation gone quiet and warm.", action: "I reach up and cup her cheek, my thumb brushing her jaw." },
  { name: "slow-dance", recap: "The kitchen radio is playing something slow; Sarah took your hand and pulled you up to dance.", action: "I draw her in and rest my forehead against hers." },
];

const DIGEST = [
  { action: "I break cover and rush the archer on the stairs.",
    narration: `You burst from behind the toppled cart and sprint for the stairs. The archer looses a shaft that punches through your left shoulder — pain flares white-hot, and your arm goes half-numb, the sword nearly slipping from that hand. You reach her before she can nock again and slam her against the railing; her bow clatters down the steps, out of reach below. Behind you, the second raider — the big one with the axe — has stopped trading blows with Bran and is turning your way. Bran is down on one knee, clutching a gash along his ribs, but still up.` },
  { action: "I search the study while the inspector waits outside.",
    narration: `The study smells of cold pipe smoke. On the desk: a half-written letter addressed to "M. Halloran," ink still tacky. On the sill, a smear of river mud — odd, three floors up. The wall safe behind the portrait hangs open and empty, but a single train ticket to Aldermont, dated tomorrow, lies fallen beneath it. The mantel clock has stopped at 2:14.` },
  { action: "I press the fence to name his terms.",
    narration: `Oswin turns the ring over, then names his price: forty crowns, not the sixty you hoped for, and only if you bring the matching brooch by the new moon — three nights off. Cross him, he says flatly, and the Wardens get an anonymous word about your name. You shake on it. The ring stays with him as surety.` },
  { action: "I kiss her and pull her down with me.",
    narration: `You lean in and kiss Sarah, slow at first, and she answers it at once — one hand fisting in your shirt to pull you both down onto the couch. She breaks away just long enough to breathe "finally" against your mouth, then tells you her roommate is gone until morning and the front door is already locked. You can feel her heart hammering where your chests press together.` },
];

// ── System-prompt assembly (fill chips per format, then restyle headings) ──
// grab() reads the raw source file (CRLF on Windows); the app sees the JS-evaluated template literal, which
// normalizes to LF. Strip \r so restyle's line-anchored header regex matches exactly as it does in-app.
const THINK = grab("defaultThinkingPrompt").replace(/\r/g, "");
const SUM_SYS = grab("defaultSummaryPrompt").replace(/\r/g, "");
const SUM_USER = grab("defaultSummaryUserPrompt").replace(/\r/g, "");

function thinkingSys(style) {
  const fmt = style === "xml" ? "xml" : "markdown";
  const filled = THINK
    .replaceAll("<WORLD DESCRIPTION>", CONT_WORLD)
    .replaceAll("<TRAITS DESCRIPTION|markdown>", buildTraitContext(TRAITS.map((t) => t.id), TRAITS, [], fmt))
    .replaceAll("<LOCATION|summary.markdown>", buildLocationContext(LOCATION, { preferSummary: true, format: fmt }))
    .replaceAll("<LOCATION|sublocations.summary.markdown>", "N/A")
    .replaceAll("<LOCATION|reachable.summary.markdown>", "N/A")
    .replaceAll("<ENTITIES|summary.markdown>", buildEntityContext(LOCATION, ENTITIES, { preferSummary: true, format: fmt }))
    .replaceAll("<ENTITIES|sublocations.summary.markdown>", "N/A")
    .replaceAll("<ENTITIES|reachable.summary.markdown>", "N/A")
    .replaceAll("<NOTES>", "None");
  return restyle(filled, style);
}

let calls = 0;
const call = (args, msgs) => { calls++; return callMessages(args, msgs); };

async function continuation(style) {
  const sys = thinkingSys(style);
  let freeze = 0, action = 0, speech = 0, stall = 0, n = 0;
  for (const c of CONTINUATION) {
    const user = buildThinkingUser(c.recap, c.action);
    for (let r = 0; r < RUNS; r++) {
      const out = await call({ ...opts, maxTokens: 256, temp: 0.4, seed: opts.seed + r },
        [{ role: "system", content: sys }, { role: "user", content: user }]);
      const s = scorePlan(parsePlan(out).beats || out);
      freeze += s.freeze; if (s.npcAction) action++; if (s.npcSpeech) speech++; if (s.stall) stall++; n++;
    }
  }
  return { contFreeze: +(freeze / n).toFixed(2), contAction: Math.round(100 * action / n), contSpeech: Math.round(100 * speech / n), contStall: Math.round(100 * stall / n) };
}

async function digests(style) {
  const sys = restyle(SUM_SYS, style); // summary prompt has no chips — style only wraps its `## Rules`
  let dFreeze = 0, n = 0;
  for (const c of DIGEST) {
    const user = SUM_USER.replaceAll("<PLAYER ACTION>", c.action).replaceAll("<NARRATION>", c.narration);
    for (let r = 0; r < RUNS; r++) {
      const dig = (await call({ ...opts, maxTokens: 160, temp: 0, seed: opts.seed + r },
        [{ role: "system", content: sys }, { role: "user", content: user }])).trim();
      dFreeze += (dig.match(FREEZE_RE) || []).length; n++;
    }
  }
  return { digestFreeze: +(dFreeze / n).toFixed(2) };
}

const t0 = Date.now();
console.log(`SECTION-STYLE REGRESSION · "${opts.model}" · runs ${RUNS} · markdown vs xml\n`);
const results = {};
for (const style of STYLES) {
  results[style] = { ...(await continuation(style)), ...(await digests(style)) };
  console.log(`${style.padEnd(9)} ${JSON.stringify(results[style])}`);
}
const mins = ((Date.now() - t0) / 60000).toFixed(1);

console.log(`\nmetric          markdown       xml        delta (xml-md)`);
const KEYS = ["contFreeze", "contAction", "contSpeech", "contStall", "digestFreeze"];
const BETTER = { contFreeze: "lower", contAction: "higher", contSpeech: "higher", contStall: "lower", digestFreeze: "lower" };
for (const k of KEYS) {
  const md = results.markdown[k], xml = results.xml[k];
  const d = +(xml - md).toFixed(2);
  const good = d === 0 ? "=" : (BETTER[k] === "lower" ? d < 0 : d > 0) ? "xml better" : "xml worse";
  console.log(`${k.padEnd(15)} ${String(md).padStart(7)} ${String(xml).padStart(10)}   ${String(d).padStart(6)}  ${good}`);
}
console.log(`\n(${calls} model calls · ${mins} min)`);
