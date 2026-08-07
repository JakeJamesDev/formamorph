// OOC-channel probe — measures the square-bracket authorial-direction convention (narration prompt).
// Bracket cases reproduce the real close-session T27/28 failure shape (in-character hesitation read as a
// real brake) plus pacing/tone/speak-up directions; two bracket-free control cases are the false-positive
// guard (the convention must not make the narrator emit brackets or meta talk on normal turns).
//
// Arms (all three run by default, so one invocation is the full A/B):
//   base  — the pre-change prompt: the OOC guideline stripped from the system prompt, no rider
//   sys   — the system-prompt guideline only (arm A)
//   rider — guideline + OOC_DIRECTIVE appended AFTER the action in the bracket turn's user message
//   pre   — same rider placed BEFORE the action
//
// Metrics per run: COMPLY (directed outcome appears), DEFY (the braked/undirected outcome appears),
// LEAK (bracket chars or author-meta words in the prose), ADDRESS (breaking frame to talk to the player
// about the convention, e.g. "go ahead and send a [] action"). Controls report bracket/meta/address.
//
// Usage:  node ooc-probe.mjs [--endpoint URL] [--model default] [--runs 3] [--max 380] [--only mount] [--arm rider,pre]

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HARNESS_DIR, "../../..");
const args = process.argv.slice(2);
const argVal = (f, d = null) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const endpoint = argVal("--endpoint", "https://api.lyonade.net/v1/chat/completions");
const model = argVal("--model", "default");
const runs = Number(argVal("--runs", "3"));
const maxTokens = Number(argVal("--max", "380"));
const only = argVal("--only");
const armPick = argVal("--arm");
const seedBase = argVal("--seed"); // paired seeds: run r sends seed+r on every arm (llama.cpp honors it; cloud ignores)
const token = argVal("--token", process.env.PROBE_TOKEN || "");

const { world, playerTrait, location } = JSON.parse(
  await readFile(path.resolve(HARNESS_DIR, "../planning-cases.json"), "utf8"),
);

// Bracket cases carry a `bracket` (the OOC direction inside the action), a complianceRe (the directed
// outcome), and a defianceRe (the braked outcome the direction overrides). Controls have neither bracket
// nor compliance axis — they only guard against bracket/meta emission on plain turns.
const CASES = [
  {
    name: "mount-hesitation", // the T27/28 shape: hesitation as a real brake, player had to script the NPC
    entities: [{ name: "Ivett", description: "A drover leading a saddled mare; capable, wary of strangers.", type: "Person" }],
    prevNarration:
      "\"She's not used to carrying two,\" the drover says, one hand on the mare's neck, the reins only half-gathered. She glances down the road, then back at you, weighing something. \"And I don't know you from a fencepost.\" The mare shifts her weight, tack creaking in the cold.",
    action: "I swing up behind her and settle in, keeping my hands where she can see them. [She stops second-guessing it - she agrees, and they set off down the road at once.]",
    complianceRe: /\b(agree\w*|nods?|relent\w*|gives? in|settl\w+|sets? off|move\w* off|rides?|riding|kicks?|heels?|urges?|trots?|canter\w*|clucks?|down the road)\b/i,
    defianceRe: /\b(hesitat\w+|refus\w+|pulls? away|shakes? her head|not so fast|shoves?|pushes? you (off|back)|get down|off the horse|dismount\w*)\b/i,
  },
  {
    name: "skip-ahead",
    entities: [{ name: "Rook", description: "A traveling companion walking the road beside the player.", type: "Person" }],
    prevNarration:
      "The road unwinds through flat fenland, mile after mile of reeds and standing water, the landing still a long way off. Rook walks at your shoulder, saying little, the light slowly going gray around you.",
    action: "I keep walking. [Skip ahead - the scene picks up as we finally arrive at the ferry landing, at dusk.]",
    complianceRe: /\b(landing|ferry|arriv\w+|reach\w*|at last|finally|dusk|evening)\b/i,
    defianceRe: /\b(mile after mile|still a long way|the road (goes|stretches|unwinds) on|hours? pass)\b/i,
  },
  {
    name: "tone-hold",
    entities: [{ name: "Mara", description: "An innkeeper sharing a late drink after closing up.", type: "Person" }],
    prevNarration:
      "The taproom is empty but for the two of you, chairs up on the tables, one lamp left burning. Mara turns her cup slowly on the boards, tired in the pleasant way of a day that went well.",
    action: "I pour her another cup and ask how she came to run this place. [Keep this scene easy and warm - nothing goes wrong tonight.]",
    // The direction is a tone HOLD, so the axis that matters is defiance staying 0; compliance = warm register.
    complianceRe: /\b(warm\w*|comfort\w*|eas(y|e|ed|es)|settl\w+|smil\w*|laugh\w*|chuckl\w*|knowing|gentl\w*)\b/i,
    defianceRe: /\b(blade|knife|blood|scream\w*|shatter\w*|crash\w*|slams? open|danger|threat\w*|goes? (cold|wrong)|stiffens)\b/i,
  },
  {
    name: "speak-up",
    entities: [{ name: "Fenn", description: "A quiet passenger who deflects questions about where she's from.", type: "Person" }],
    prevNarration:
      "Fenn watches the water instead of you, the way she does whenever the talk drifts toward her. \"Doesn't matter where I'm from,\" she said the last time you asked, and the time before that.",
    action: "I ask her again, gently, what she's running from. [This time she answers plainly.]",
    complianceRe: /("[^"]{3,}"|[“][^”]{3,}[”])/,
    // No bare "silence" here - the motif fires incidentally while she still answers; only real refusals count.
    defianceRe: /\b(looks? away|says? nothing|said nothing|changes? the subject|doesn'?t answer|without answering|shakes? her head)\b/i,
  },
  // Bracket-free controls: the convention must not leak brackets or author-meta into normal turns.
  {
    name: "control-quiet",
    entities: [{ name: "Sedge", description: "A weathered fisherwoman mending a net, absorbed in the work.", type: "Person" }],
    prevNarration:
      "Out on the jetty a woman sits on an upturned crate, a great tangle of net across her knees, her needle flashing as she works a tear closed. She has not looked up.",
    action: "I wander out onto the jetty and stand near her, watching her hands work the net.",
  },
  {
    name: "control-ask",
    entities: [{ name: "Tomas", description: "The barkeep, wiping down mugs behind the counter.", type: "Person" }],
    prevNarration:
      "The tavern is low and warm, a few patrons hunched over their cups. Behind the counter, a heavyset barkeep works a rag around the rim of a mug, glancing up as the door swings shut behind you.",
    action: "I cross to the bar and ask him what there is to eat.",
  },
];

const source = await readFile(path.join(REPO_ROOT, "src/components/game/GamePrompts.ts"), "utf8");
const grab = (name) => {
  const at = source.indexOf(name + " = `");
  if (at === -1) throw new Error("missing " + name);
  const from = source.indexOf("`", at) + 1;
  return source.slice(from, source.indexOf("`;", from));
};
const SYS = grab("defaultSystemPrompt");
const MARKDOWN_ON = grab("MARKDOWN_ON");
const OOC_DIRECTIVE = grab("defaultOocDirectivePrompt");
// The base arm reconstructs the pre-change system prompt by stripping the OOC guideline line.
const SYS_BASE = SYS.split("\n").filter((l) => !/square-bracket/i.test(l)).join("\n");
if (SYS_BASE === SYS) throw new Error("OOC guideline not found in defaultSystemPrompt - arms would be identical");

const renderEntities = (entities) =>
  entities.map((e) => `- **${e.name}**\n  - **description:** ${e.description}\n  - **type:** ${e.type}`).join("\n");
const renderSys = (sysText, c) =>
  sysText
    .replaceAll("<LENGTH GUIDANCE>", "Aim for two to four tight paragraphs; land the moment and stop.")
    .replaceAll("<MARKDOWN GUIDANCE>", MARKDOWN_ON)
    .replaceAll("<WORLD DESCRIPTION>", world)
    .replaceAll("<DICTIONARY|before>", "N/A")
    .replaceAll("<STATS DESCRIPTION|descriptions.markdown>", "- **Resolve:** steady")
    .replaceAll("<TRAITS DESCRIPTION|markdown>", `- **Identity:** ${playerTrait}`)
    .replaceAll("<NOTES>", "None")
    .replaceAll("<LOCATION|markdown>", `- **name:** ${location}`)
    .replaceAll("<LOCATION|sublocations.summary.markdown>", "N/A")
    .replaceAll("<LOCATION|reachable.summary.markdown>", "N/A")
    .replaceAll("<ENTITIES|markdown>", renderEntities(c.entities))
    .replaceAll("<ENTITIES|sublocations.markdown>", "N/A")
    .replaceAll("<ENTITIES|reachable.summary.markdown>", "N/A")
    .replaceAll("<DICTIONARY>", "N/A");

const ARMS = {
  base: { sys: SYS_BASE, rider: false },
  sys: { sys: SYS, rider: false },
  rider: { sys: SYS, rider: "after" },
  pre: { sys: SYS, rider: "before" },
};
const armNames = armPick ? armPick.split(",") : Object.keys(ARMS);
if (armNames.some((a) => !ARMS[a])) throw new Error(`unknown arm; expected one of ${Object.keys(ARMS).join("/")}`);

async function call(messages, seed) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(endpoint, {
    method: "POST", headers,
    // Narration is unpinned in promptSamplers - send no temperature so the endpoint default applies.
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, reasoning_effort: "none", stream: false, ...(seed != null ? { seed } : {}) }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const j = await res.json();
  return (j.choices?.[0]?.message?.content ?? "").trim();
}

const BRACKET_RE = /[\[\]]/;
// Narrow, not author\w* - that also matches "authority", ordinary prose in this genre.
const META_RE = /\b(author|authors|author'?s|authorial|out-of-character|OOC)\b/i;
// Breaking frame to talk to the player about the convention instead of narrating the turn.
const ADDRESS_RE = /\b(go ahead and|feel free to|let me know|just (send|tell|give)|you can (send|use|give|tell)|i'?ll (act|play|write|narrate)|ready when you are|square[- ]bracket)\b/i;
const hasBracket = (c) => /\[[^\]]+\]/.test(c.action);
// Leak of the direction's own distinctive wording into the prose (quoted or narrated as speech).
const bracketPhrase = (c) => (c.action.match(/\[([^\]]+)\]/) || [])[1] ?? "";

const pick = CASES.filter((c) => !only || c.name.includes(only));
console.log(`OOC probe · ${endpoint} · "${model}" · ${pick.length} case(s) · ${runs} run(s)/case · arms: ${armNames.join(", ")}\n`);
await call([{ role: "system", content: renderSys(SYS, pick[0]) }, { role: "user", content: "warm up" }]).catch(() => {});

for (const armName of armNames) {
  const arm = ARMS[armName];
  const T = { bRuns: 0, comply: 0, defy: 0, leak: 0, addr: 0, cRuns: 0, cBracket: 0, cMeta: 0, cAddr: 0 };
  console.log(`\n======== arm: ${armName} ========`);
  for (const c of pick) {
    const bracketed = hasBracket(c);
    console.log(`\n#### ${c.name}${bracketed ? "" : " (control)"}`);
    for (let r = 0; r < runs; r++) {
      // Production shape: bare action as the user turn; the rider arm appends OOC_DIRECTIVE on bracket turns.
      const userContent = !bracketed || !arm.rider
        ? c.action
        : arm.rider === "before"
          ? `${OOC_DIRECTIVE}\n\n${c.action}`
          : `${c.action}\n\n${OOC_DIRECTIVE}`;
      let out, err = null;
      try {
        out = await call([
          { role: "system", content: renderSys(arm.sys, c) },
          { role: "assistant", content: c.prevNarration },
          { role: "user", content: userContent },
        ], seedBase != null ? Number(seedBase) + r : undefined);
      } catch (e) { err = String(e.message || e); }
      if (err) { console.log(`  #${r + 1} ERROR: ${err}`); continue; }
      if (bracketed) {
        T.bRuns++;
        const comply = c.complianceRe.test(out);
        const defy = c.defianceRe.test(out);
        const phrase = bracketPhrase(c);
        const leak = BRACKET_RE.test(out) || META_RE.test(out) || (phrase && out.toLowerCase().includes(phrase.toLowerCase()));
        if (comply) T.comply++;
        if (defy) T.defy++;
        if (leak) T.leak++;
        const addr = ADDRESS_RE.test(out);
        if (addr) T.addr++;
        console.log(`  #${r + 1} ${comply ? "COMPLY" : "no-comply"}${defy ? " · DEFY" : ""}${leak ? " · LEAK" : ""}${addr ? " · ADDRESS" : ""}`);
      } else {
        T.cRuns++;
        const b = BRACKET_RE.test(out), m = META_RE.test(out), a = ADDRESS_RE.test(out);
        if (b) T.cBracket++;
        if (m) T.cMeta++;
        if (a) T.cAddr++;
        console.log(`  #${r + 1} ${b || m || a ? `GUARD-HIT${b ? " bracket" : ""}${m ? " meta" : ""}${a ? " address" : ""}` : "clean"}`);
      }
      console.log(out.split("\n").filter(Boolean).map((l) => "      " + l).join("\n"));
    }
  }
  console.log(`\n==== arm ${armName} · bracket turns: comply ${T.comply}/${T.bRuns} · defy ${T.defy}/${T.bRuns} · leak ${T.leak}/${T.bRuns} · address ${T.addr}/${T.bRuns} · controls: bracket ${T.cBracket}/${T.cRuns} · meta ${T.cMeta}/${T.cRuns} · address ${T.cAddr}/${T.cRuns} ====`);
}
