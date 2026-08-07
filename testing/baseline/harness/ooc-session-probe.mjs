// OOC session probe — the multi-turn companion to ooc-probe.mjs.
//
// ooc-probe scores ONE bracket turn against a fixed prior narration. This one plays a whole session:
// each turn's real model output is fed back as assistant history, so bracket turns accumulate. The
// failure it hunts is the one ooc-probe cannot see - the convention bleeding across turns until the
// narrator breaks frame and talks to the player about brackets ("go ahead and send a [] action").
//
// Every turn is scored, bracket and bracket-free alike, because the bleed shows up on the PLAIN turns
// that follow a bracket turn. Turn-position of each hit is reported so late-session drift is visible.
//
// Arms:  rider — OOC_DIRECTIVE after the action (ships today)  ·  pre — the same rider before it
//
// Sessions are independent replays of the same script; chained output amplifies a single divergence,
// so read the per-session spread, not one number.
//
// Usage:  node ooc-session-probe.mjs [--endpoint URL] [--model default] [--sessions 3] [--max 380]
//         [--arm rider,pre] [--seed 900] [--verbose]

import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HARNESS_DIR, "../../..");
const args = process.argv.slice(2);
const argVal = (f, d = null) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const endpoint = argVal("--endpoint", "https://api.lyonade.net/v1/chat/completions");
const model = argVal("--model", "default");
const sessions = Number(argVal("--sessions", "3"));
const maxTokens = Number(argVal("--max", "380"));
const armPick = argVal("--arm");
const seedBase = argVal("--seed");
const verbose = args.includes("--verbose");
const token = argVal("--token", process.env.PROBE_TOKEN || "");

const { world, playerTrait, location } = JSON.parse(
  await readFile(path.resolve(HARNESS_DIR, "../planning-cases.json"), "utf8"),
);

const ENTITIES = [
  { name: "Ivett", description: "A drover leading a saddled mare; capable, wary of strangers.", type: "Person" },
  { name: "Rook", description: "A traveling companion walking the road beside the player.", type: "Person" },
];

const OPENING =
  "\"She's not used to carrying two,\" the drover says, one hand on the mare's neck, the reins only half-gathered. " +
  "She glances down the road, then back at you, weighing something. \"And I don't know you from a fencepost.\" " +
  "The mare shifts her weight, tack creaking in the cold. Rook waits a few steps off, saying nothing.";

// Bracket turns are spaced so each is followed by a plain turn - the plain ones are where the bleed lands.
const SCRIPT = [
  { action: "I swing up behind her and settle in, keeping my hands where she can see them. [She stops second-guessing it - she agrees, and they set off down the road at once.]" },
  { action: "I watch the fenland go by over her shoulder and say nothing for a while." },
  { action: "I ask Ivett how far the landing still is. [Skip ahead - the scene picks up as we finally arrive at the ferry landing, at dusk.]" },
  { action: "I climb down and stretch the ride out of my legs." },
  { action: "I ask Rook what he makes of the place." },
  { action: "I go looking for whoever runs the crossing. [Keep this easy and warm - nothing goes wrong tonight.]" },
  { action: "I ask about a bed for the night." },
  { action: "I sit down where I can see the water and let the day settle." },
];

const PROMPTS_PATH = "src/components/game/GamePrompts.ts";
const source = await readFile(path.join(REPO_ROOT, PROMPTS_PATH), "utf8");
const grabFrom = (text, name) => {
  const at = text.indexOf(name + " = `");
  if (at === -1) throw new Error("missing " + name);
  const from = text.indexOf("`", at) + 1;
  return text.slice(from, text.indexOf("`;", from));
};
const grab = (name) => grabFrom(source, name);
const SYS = grab("defaultSystemPrompt");
const MARKDOWN_ON = grab("MARKDOWN_ON");
const OOC_DIRECTIVE = grab("defaultOocDirectivePrompt");
// Paired A/B: the committed rider is the static baseline, the working tree is the variant, so one
// invocation runs both at identical seeds and the wording is the only difference between them.
const headSource = execFileSync("git", ["show", `HEAD:${PROMPTS_PATH}`], { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 1 << 24 });
const OOC_DIRECTIVE_HEAD = grabFrom(headSource, "defaultOocDirectivePrompt");

const renderEntities = (entities) =>
  entities.map((e) => `- **${e.name}**\n  - **description:** ${e.description}\n  - **type:** ${e.type}`).join("\n");
const SYSTEM = SYS
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
  .replaceAll("<ENTITIES|markdown>", renderEntities(ENTITIES))
  .replaceAll("<ENTITIES|sublocations.markdown>", "N/A")
  .replaceAll("<ENTITIES|reachable.summary.markdown>", "N/A")
  .replaceAll("<DICTIONARY>", "N/A");

const ARMS = {
  rider: { placement: "after", text: OOC_DIRECTIVE },
  pre: { placement: "before", text: OOC_DIRECTIVE },
  head: { placement: "after", text: OOC_DIRECTIVE_HEAD },
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

const BRACKET_RE = /\[[^\]]*\]/;
// Narrow, not author\w* - that also matches "authority", ordinary prose in this genre.
const META_RE = /\b(author|authors|author'?s|authorial|out-of-character|OOC)\b/i;
const ADDRESS_RE = /\b(go ahead and|feel free to|let me know|just (send|tell|give)|you can (send|use|give|tell)|i'?ll (act|play|write|narrate)|ready when you are|square[- ]bracket)\b/i;
const hasBracket = (a) => /\[[^\]]+\]/.test(a);
// History stores the bare action (stripOocDirectives' shape) - the rider must never accumulate.
const bare = (a) => a.replace(/\s*\[[^\]]+\]/g, "").replace(/\s{2,}/g, " ").trim();

console.log(`OOC session probe · ${endpoint} · "${model}" · ${SCRIPT.length}-turn script · ${sessions} session(s) · arms: ${armNames.join(", ")}\n`);
await call([{ role: "system", content: SYSTEM }, { role: "user", content: "warm up" }]).catch(() => {});

for (const armName of armNames) {
  const { placement, text: rider } = ARMS[armName];
  console.log(`\n======== arm: ${armName} ========`);
  const perSession = [];
  for (let s = 0; s < sessions; s++) {
    const history = [{ role: "assistant", content: OPENING }];
    const hits = [];
    let turns = 0;
    for (let t = 0; t < SCRIPT.length; t++) {
      const action = SCRIPT[t].action;
      const bracketed = hasBracket(action);
      const userContent = !bracketed
        ? action
        : placement === "before" ? `${rider}\n\n${action}` : `${action}\n\n${rider}`;
      let out, err = null;
      try {
        out = await call(
          [{ role: "system", content: SYSTEM }, ...history, { role: "user", content: userContent }],
          seedBase != null ? Number(seedBase) + s : undefined,
        );
      } catch (e) { err = String(e.message || e); }
      if (err) { console.log(`  s${s + 1} t${t + 1} ERROR: ${err}`); break; }
      turns++;
      const b = BRACKET_RE.test(out), m = META_RE.test(out), a = ADDRESS_RE.test(out);
      if (b || m || a) hits.push(`t${t + 1}${bracketed ? "" : "(plain)"}:${[b && "bracket", m && "meta", a && "address"].filter(Boolean).join("+")}`);
      console.log(`  s${s + 1} t${t + 1}${bracketed ? "[]" : "  "} ${b || m || a ? `HIT ${[b && "bracket", m && "meta", a && "address"].filter(Boolean).join("+")}` : "clean"}`);
      if (verbose || b || m || a) console.log(out.split("\n").filter(Boolean).map((l) => "        " + l).join("\n"));
      // The bare action is what real history stores, so the rider never accumulates across turns.
      history.push({ role: "user", content: bare(action) }, { role: "assistant", content: out });
    }
    perSession.push({ turns, hits });
    console.log(`  -- session ${s + 1}: ${hits.length}/${turns} turns hit${hits.length ? " · " + hits.join(", ") : ""}`);
  }
  const totalTurns = perSession.reduce((n, s) => n + s.turns, 0);
  const totalHits = perSession.reduce((n, s) => n + s.hits.length, 0);
  const spread = perSession.map((s) => `${s.hits.length}/${s.turns}`).join(", ");
  console.log(`\n==== arm ${armName} · hits ${totalHits}/${totalTurns} turns · per-session ${spread} ====`);
}
