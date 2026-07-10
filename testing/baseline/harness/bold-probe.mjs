// Bold-emphasis probe — the positive counterpart to the bold check in dialogue-unbaited-probe.mjs. Those
// scenes are mundane, so correct behavior is ZERO bold; this one engineers a genuine PIVOT each turn (a
// sudden threat, a key object revealed, a name finally spoken) where the prompt's own rule says **bold**
// SHOULD fire. Confirms the tightened markdown contract suppresses the reflex without killing real emphasis.
// Prints the bolded spans so you can see WHAT it bolded (should be the pivot noun, not a trailing one).
//
// Usage:  node bold-probe.mjs [--endpoint URL] [--model default] [--runs 3] [--max 380] [--only blade]

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
const token = argVal("--token", process.env.PROBE_TOKEN || "");

const { world, playerTrait, location } = JSON.parse(
  await readFile(path.resolve(HARNESS_DIR, "../planning-cases.json"), "utf8"),
);

// Pivot cases: each turn's action detonates a moment the prompt explicitly calls bold-worthy — a threat,
// a key object, or a revealed name. `pivot` names what a correctly-placed bold should land on.
const CASES = [
  {
    name: "blade",
    entities: [{ name: "Corvin", description: "A soft-spoken debt collector with hard eyes; carries a hidden knife.", type: "Person" }],
    prevNarration: "Corvin sets his cup down with exaggerated care and asks, one last time, for the ledger you carry - his voice still pleasant, his eyes not.",
    action: "I tell him no and step back toward the door.",
    pivot: "the drawn knife / weapon",
  },
  {
    name: "lurker",
    entities: [{ name: "the water", description: "The black river below the jetty; something large moves under the surface.", type: "Creature" }],
    prevNarration: "A slow ripple crosses the still water below the jetty, too wide and too deliberate for any fish. The dark surface goes glassy again.",
    action: "I kneel at the edge and lean out over the water to look closer.",
    pivot: "the creature that surfaces",
  },
  {
    name: "name-reveal",
    entities: [{ name: "Ysolde", description: "A hooded woman the player has only known as 'the stranger'; guarded, watchful.", type: "Person" }],
    prevNarration: "The hooded woman - the stranger who has shadowed you since the ford - finally lowers her hood by the firelight and meets your eyes, ready, it seems, to talk.",
    action: "I ask her plainly who she is.",
    pivot: "her revealed name",
  },
  {
    name: "key-object",
    entities: [{ name: "the strongbox", description: "An iron strongbox the player carried up from the wreck; still locked.", type: "Object" }],
    prevNarration: "The iron strongbox from the wreck sits before you on the table, salt-crusted and heavy. The small brass key you pried from the dead captain's hand fits the lock.",
    action: "I turn the key and lift the lid.",
    pivot: "whatever pivotal thing is inside",
  },
  {
    name: "ambush",
    entities: [{ name: "the alley", description: "A narrow cut between two buildings on the way to the inn; unlit.", type: "Location" }],
    prevNarration: "The lane to the inn narrows into an unlit cut between two leaning buildings. The town's noise falls away behind you, and ahead there is only dark.",
    action: "I round the corner into the alley, heading for the inn's back door.",
    pivot: "the ambusher / sudden threat",
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
const renderEntities = (entities) =>
  entities.map((e) => `- **${e.name}**\n  - **description:** ${e.description}\n  - **type:** ${e.type}`).join("\n");
const renderSys = (c) =>
  SYS
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

async function call(sys, messages) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(endpoint, {
    method: "POST", headers,
    body: JSON.stringify({ model, messages: [{ role: "system", content: sys }, ...messages], max_tokens: maxTokens, reasoning_effort: "none", stream: false }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const j = await res.json();
  return (j.choices?.[0]?.message?.content ?? "").trim();
}

const BOLD_RE = /\*\*([^*]+)\*\*/g;

const pick = CASES.filter((c) => !only || c.name.includes(only));
console.log(`Bold (pivot) probe · ${endpoint} · "${model}" · ${pick.length} case(s) · ${runs} run(s)/case\n`);
await call(renderSys(pick[0]), [{ role: "user", content: "warm up" }]).catch(() => {});

const totals = { runs: 0, withBold: 0, bold: 0 };
for (const c of pick) {
  let withBold = 0;
  console.log(`\n######## ${c.name} — pivot: ${c.pivot}`);
  for (let r = 0; r < runs; r++) {
    let out, err = null;
    try {
      out = await call(renderSys(c), [
        { role: "assistant", content: c.prevNarration },
        { role: "user", content: `Player action: ${c.action}` },
      ]);
    } catch (e) { err = String(e.message || e); }
    totals.runs++;
    if (err) { console.log(`  #${r + 1} ERROR: ${err}`); continue; }
    const bolds = [...out.matchAll(BOLD_RE)].map((m) => m[1]);
    if (bolds.length) { withBold++; totals.withBold++; }
    totals.bold += bolds.length;
    console.log(`  #${r + 1} bold ${bolds.length}${bolds.length ? " -> " + bolds.map((b) => `**${b}**`).join(", ") : " (NONE)"}`);
    console.log(out.split("\n").filter(Boolean).map((l) => "      " + l).join("\n"));
  }
  console.log(`  -> ${c.name}: bold fired ${withBold}/${runs}`);
}
console.log(`\n==== bold fired in ${totals.withBold}/${totals.runs} pivot turns · ${(totals.bold / totals.runs).toFixed(1)} bold/turn ====`);
