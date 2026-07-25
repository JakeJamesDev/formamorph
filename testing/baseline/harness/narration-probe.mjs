// Narration probe — fires the real narration system prompt (defaultSystemPrompt) at an endpoint and prints
// the story it writes, so a new model can be judged on the main job (not the aux prompts). Reuses the
// planning gold scenarios (../planning-cases.json: world + trait + location + entities + prior narration +
// action). Defaults to the shipped FieryLion default endpoint (api.lyonade.net, model "default"), which is
// where the candidate model currently lives. Objective red flags are auto-noted; prose quality is eyeballed.
//
// Usage:  node narration-probe.mjs [--endpoint URL] [--model default] [--only unrevealed] [--runs 1] [--max 400]

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HARNESS_DIR, "../../..");

const args = process.argv.slice(2);
const argVal = (f, d = null) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const endpoint = argVal("--endpoint", "https://api.lyonade.net/v1/chat/completions");
const model = argVal("--model", "default");
const only = argVal("--only");
const runs = Number(argVal("--runs", "1"));
const maxTokens = Number(argVal("--max", "400"));
const token = argVal("--token", process.env.PROBE_TOKEN || "");

const { world, playerTrait, location, cases } = JSON.parse(
  await readFile(path.resolve(HARNESS_DIR, "../planning-cases.json"), "utf8"),
);

const source = await readFile(path.join(REPO_ROOT, "src/components/game/GamePrompts.ts"), "utf8");
const grab = (name) => {
  const at = source.indexOf(name + " = `");
  if (at === -1) throw new Error("missing " + name);
  const from = source.indexOf("`", at) + 1;
  return source.slice(from, source.indexOf("`;", from));
};
const SYS = grab("defaultSystemPrompt");

const MARKDOWN_ON = `## Formatting
- Write immersive, flowing prose - never a list, menu, or table.
- Reach for Markdown emphasis where it genuinely lands: **bold** the single most important noun of the moment (a threat, a key object, a revealed name) and *italicize* a sharp inner thought, sound, or stressed word - because the moment earns it, not to fill a quota.`;

const renderEntities = (entities) =>
  entities?.length
    ? entities.map((e) => `- **${e.name}**\n  - **description:** ${e.description}\n  - **type:** ${e.type}`).join("\n")
    : "N/A";

const renderSys = (c) =>
  SYS
    .replaceAll("<LENGTH GUIDANCE>", "Aim for two to four tight paragraphs; land the moment and stop.")
    .replaceAll("<MARKDOWN GUIDANCE>", MARKDOWN_ON)
    .replaceAll("<WORLD DESCRIPTION>", world)
    .replaceAll("<DICTIONARY|before>", "N/A")
    .replaceAll("<STATS DESCRIPTION|descriptions.markdown>", "- **Resolve:** steady\n- **Coin:** light")
    .replaceAll("<TRAITS DESCRIPTION|markdown>", `- **Identity:** ${playerTrait}`)
    .replaceAll("<NOTES>", "None")
    .replaceAll("<LOCATION|markdown>", `- **name:** ${location}`)
    .replaceAll("<LOCATION|sublocations.summary.markdown>", "N/A")
    .replaceAll("<LOCATION|reachable.summary.markdown>", "N/A")
    .replaceAll("<ENTITIES|markdown>", renderEntities(c.entities))
    .replaceAll("<ENTITIES|sublocations.markdown>", "N/A")
    .replaceAll("<ENTITIES|reachable.summary.markdown>", renderEntities(c.reachableEntities))
    .replaceAll("<DICTIONARY>", "N/A");

async function call(sys, messages) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: sys }, ...messages],
      max_tokens: maxTokens, stream: false, // narration is unpinned — no temperature, endpoint decides
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  return (j.choices?.[0]?.message?.content ?? "").trim();
}

// Objective red flags (quality itself is read by eye).
const flags = (text, c) => {
  const f = [];
  if (!/\byou'?r?e?\b|\byour\b/i.test(text)) f.push("NO-2ND-PERSON");
  if (/\b(what (do|would|will) you|choose one|choose from|your options?|options?:|pick one)\b/i.test(text) ||
      /^\s*(\d+[.)]|[-*])\s+.+\?$/m.test(text)) f.push("OFFERS-CHOICES");
  if (/(^|\n)\s*[-*]?\s*(resolve|coin|hp|health|strength|stat)\s*:?\s*[+-]?\d/i.test(text)) f.push("STAT-TABULATION");
  // Name-spoiler: a character the prior narration had NOT named yet must not be named in this turn's prose.
  if (c.aliasHidden && new RegExp(`\\b${c.aliasHidden}\\b`).test(text)) f.push(`NAME-SPOILER:${c.aliasHidden}`);
  return f;
};

const pick = cases.filter((c) => !only || c.name.includes(only));
console.log(`Narration probe · ${endpoint} · model "${model}" · ${pick.length} case(s) · ${runs} run(s)\n`);
await call(renderSys(pick[0]), [{ role: "user", content: "warm up" }]).catch(() => {});

const agg = { total: 0, flagged: 0 };
for (const c of pick) {
  for (let r = 0; r < runs; r++) {
    let out, err = null;
    try {
      out = await call(renderSys(c), [
        { role: "assistant", content: c.prevNarration },
        // Bare action, no "Player action:" wrapper — matches the app's message assembly (dropped 2026-07-21).
        { role: "user", content: c.action },
      ]);
    } catch (e) { err = String(e.message || e); }
    agg.total++;
    if (err) { console.log(`\n=== ${c.name}${runs > 1 ? ` #${r + 1}` : ""} ===\n  ERROR: ${err}`); continue; }
    const f = flags(out, c);
    if (f.length) agg.flagged++;
    console.log(`\n=== ${c.name}${runs > 1 ? ` #${r + 1}` : ""} ${f.length ? "⚠ " + f.join(",") : "✓"} ===`);
    console.log(`  action: ${c.action}`);
    console.log(out.split("\n").map((l) => "  " + l).join("\n"));
  }
}
console.log(`\n${agg.total - agg.flagged}/${agg.total} without red flags (quality: read the prose above).`);
