// Inline-thinking probe — fires the real narration system prompt with INLINE_THINKING_DIRECTIVE appended
// (thinkingMode === 'inline') and measures whether the model reliably emits a <think> block AND then writes
// clean narration. The whole point of Inline hardening: some models (e.g. MeroMero) skipped the block under
// the full app prompt with the old one-sentence directive. Reuses the planning gold scenarios.
//
// Metrics per run: THINK (a complete <think>...</think> emitted), bullets (count inside it), NARR (prose after
// the close tag), LEAK (a bullet/label bled into the narration the player would see). Aggregate = emit rate.
//
// Usage:  node inline-probe.mjs --endpoint http://localhost:11434/v1/chat/completions --model silver-siren --runs 2

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HARNESS_DIR, "../../..");

const args = process.argv.slice(2);
const argVal = (f, d = null) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const endpoint = argVal("--endpoint", "http://localhost:11434/v1/chat/completions");
const model = argVal("--model", "default");
const only = argVal("--only");
const runs = Number(argVal("--runs", "2"));
const maxTokens = Number(argVal("--max", "600"));
// Where the directive rides: 'system' (appended to the system prompt, as the app ships) or 'user'
// (appended to the final player-action turn, for recency). Tests placement as a lever, not just wording.
const placement = argVal("--placement", "system");
const token = argVal("--token", process.env.PROBE_TOKEN || "");

const { world, playerTrait, location, cases } = JSON.parse(
  await readFile(path.resolve(HARNESS_DIR, "../planning-cases.json"), "utf8"),
);

const source = await readFile(path.join(REPO_ROOT, "src/components/game/GamePrompts.ts"), "utf8");
const grab = (name) => {
  const at = source.indexOf(name + " = `");
  if (at === -1) throw new Error("missing " + name);
  const from = source.indexOf("`", at) + 1;
  // Probes run English-only, where the language chip renders to nothing, and the arms that do test the
  // directive append their own wording — so the chip is stripped rather than left as a literal token.
  return source.slice(from, source.indexOf("`;", from)).replaceAll("<LANGUAGE>", "").trimEnd();
};
const SYS = grab("defaultSystemPrompt");
const INLINE = grab("INLINE_THINKING_DIRECTIVE");

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
    .replaceAll("<DICTIONARY>", "N/A")
  + (placement === "system" ? INLINE : "");

async function call(sys, messages) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: sys }, ...messages],
      max_tokens: maxTokens, stream: false,
      // Guided modes suppress native reasoning so it can't fire on top of the injected <think>.
      reasoning_effort: "none",
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  return (j.choices?.[0]?.message?.content ?? "").trim();
}

// Split a completion into its <think> block and the narration that follows.
const THINK_RE = /<think>([\s\S]*?)<\/think>/i;
const dissect = (text) => {
  const m = text.match(THINK_RE);
  const think = m ? m[1].trim() : null;
  const narration = m ? text.slice(m.index + m[0].length).trim() : text.trim();
  const bullets = think ? (think.match(/^\s*[-*•]/gm) || []).length : 0;
  // A "leak" = the narration still carries note-style bullet lines the player would see.
  const leak = /^\s*[-*•]\s+\S/m.test(narration);
  return { think, narration, bullets, leak };
};

const pick = cases.filter((c) => !only || c.name.includes(only));
console.log(`Inline probe · ${endpoint} · model "${model}" · ${pick.length} case(s) · ${runs} run(s)\n`);
await call(renderSys(pick[0]), [{ role: "user", content: "warm up" }]).catch(() => {});

const agg = { total: 0, think: 0, narr: 0, leak: 0 };
for (const c of pick) {
  for (let r = 0; r < runs; r++) {
    let out, err = null;
    try {
      out = await call(renderSys(c), [
        { role: "assistant", content: c.prevNarration },
        // Bare action, no "Player action:" wrapper — matches the app's message assembly (dropped 2026-07-21).
        { role: "user", content: `${c.action}${placement === "user" ? INLINE : ""}` },
      ]);
    } catch (e) { err = String(e.message || e); }
    agg.total++;
    if (err) { console.log(`\n=== ${c.name} #${r + 1} ===\n  ERROR: ${err}`); continue; }
    const d = dissect(out);
    if (d.think !== null) agg.think++;
    if (d.narration) agg.narr++;
    if (d.leak) agg.leak++;
    const tag = [d.think !== null ? `THINK(${d.bullets}b)` : "NO-THINK", d.narration ? "NARR" : "NO-NARR", d.leak ? "LEAK" : ""].filter(Boolean).join(" ");
    console.log(`\n=== ${c.name} #${r + 1} · ${tag} ===`);
    console.log(`  action: ${c.action}`);
    if (d.think !== null) console.log(`  <think>\n${d.think.split("\n").map((l) => "    " + l).join("\n")}\n  </think>`);
    console.log(`  narration:\n${d.narration.split("\n").map((l) => "    " + l).join("\n")}`);
  }
}
console.log(`\nEmit rate: ${agg.think}/${agg.total} had <think>, ${agg.narr}/${agg.total} had narration, ${agg.leak}/${agg.total} leaked a bullet into prose.`);
