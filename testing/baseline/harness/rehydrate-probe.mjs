// Rehydrate probe — the evidence bar for semantic rehydration's temporal framing (roadmap step 2,
// the "dead-Jim" case). Fixture: ../semantic-rehydrate-cases.json — digests say Jim died; the
// rehydrated scene is from before his death and carries a planted detail (the carved gull whistle)
// that no digest mentions. Three arms:
//   none   — recap only, no rehydration (baseline: detail should be near-unreachable)
//   bare   — the old scene spliced in as a live-looking user/assistant pair (v1's failure shape)
//   framed — the shipped shape: the scene as the remembered-scene exchange (defaultRehydrateUserPrompt)
// Metrics per run: ALIVE-WRITE (narration depicts Jim acting in the present scene — the temporal
// failure; regex over present-tense action verbs adjacent to Jim) and DETAIL-RECALL (a planted-detail
// token surfaces — the benefit). Good framing: DETAIL-RECALL ≈ bare, ALIVE-WRITE ≈ none.
//
// Usage:  node rehydrate-probe.mjs [--endpoint URL] [--model default] [--runs 3] [--arms none,bare,framed] [--max 400]

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
const arms = argVal("--arms", "none,bare,framed").split(",");
const maxTokens = Number(argVal("--max", "400"));
const token = argVal("--token", process.env.PROBE_TOKEN || "");

const fx = JSON.parse(await readFile(path.resolve(HARNESS_DIR, "../semantic-rehydrate-cases.json"), "utf8"));

const promptsSrc = await readFile(path.join(REPO_ROOT, "src/components/game/GamePrompts.ts"), "utf8");
const grab = (name) => {
  const at = promptsSrc.indexOf(name + " = `");
  if (at === -1) throw new Error("missing " + name);
  const from = promptsSrc.indexOf("`", at) + 1;
  // Probes run English-only, where the language chip renders to nothing, and the arms that do test the
  // directive append their own wording — so the chip is stripped rather than left as a literal token.
  return promptsSrc.slice(from, promptsSrc.indexOf("`;", from)).replaceAll("<LANGUAGE>", "").trimEnd();
};
const SYS = grab("defaultSystemPrompt");
const RECAP = grab("defaultRecapUserPrompt");
const RECALL = grab("defaultRehydrateUserPrompt");

const renderSys = () =>
  SYS
    .replaceAll("<LENGTH GUIDANCE>", "Aim for two to four tight paragraphs; land the moment and stop.")
    .replaceAll("<MARKDOWN GUIDANCE>", "")
    .replaceAll("<WORLD DESCRIPTION>", fx.world)
    .replaceAll("<DICTIONARY|before>", "N/A")
    .replaceAll("<STATS DESCRIPTION|descriptions.markdown>", "- **Resolve:** steady\n- **Coin:** light")
    .replaceAll("<TRAITS DESCRIPTION|markdown>", `- **Identity:** ${fx.playerTrait}`)
    .replaceAll("<NOTES>", "None")
    .replaceAll("<LOCATION|markdown>", `- **name:** ${fx.location}`)
    .replaceAll("<LOCATION|sublocations.summary.markdown>", "N/A")
    .replaceAll("<LOCATION|reachable.summary.markdown>", "N/A")
    .replaceAll("<ENTITIES|markdown>", "- **Alice**\n  - **description:** The innkeeper of the Drowned Willow; Jim's sister, newly grieving.\n  - **type:** character")
    .replaceAll("<ENTITIES|sublocations.markdown>", "N/A")
    .replaceAll("<ENTITIES|reachable.summary.markdown>", "N/A")
    .replaceAll("<DICTIONARY>", "N/A");

// Message assembly mirrors buildBandedHistory: recap exchange (digests + now-line) → [arm-specific
// old scene] → prior floor turn as a real pair → the action. Only the middle differs between arms.
const nowLine = `Now you are at ${fx.location} with Alice present; the scene is already underway.`;
const buildMessages = (arm, c) => {
  // The rehydrated scene leaves the band, mirroring production (framed/bare arms drop its digest —
  // the compressed "carves you a keepsake" line; the "none" baseline keeps it, so the detail tokens
  // themselves are the only thing rehydration adds).
  const digests = arm === "none" ? fx.digests : fx.digests.filter((_, i) => i !== fx.sceneDigestIndex);
  const messages = [
    { role: "user", content: RECAP },
    { role: "assistant", content: `${digests.join(" ")}\n\n${nowLine}` },
  ];
  if (arm === "bare") messages.push({ role: "user", content: fx.sceneUserMsg }, { role: "assistant", content: fx.rehydratedScene });
  if (arm === "framed") messages.push({ role: "user", content: RECALL }, { role: "assistant", content: fx.rehydratedScene });
  messages.push({ role: "user", content: c.priorUserMsg }, { role: "assistant", content: c.priorTurn });
  messages.push({ role: "user", content: c.action }); // bare action, matching production
  return messages;
};

const call = async (messages, seed) => {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const body = {
    model,
    messages: [{ role: "system", content: renderSys() }, ...messages],
    max_tokens: maxTokens, stream: false, reasoning_effort: "none", // narration is unpinned — no temperature
  };
  if (seed !== undefined) body.seed = seed; // honored by llama.cpp; the cloud endpoint ignores it
  const res = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  return (j.choices?.[0]?.message?.content ?? "").trim();
};

// ALIVE-WRITE: Jim as the subject of a present-scene action verb. The narration is present-tense, so
// "Jim says/steps/hands" = he is being written into the live scene. Past references ("Jim said",
// "Jim would have laughed") and quoted memories don't match.
const aliveRe = new RegExp(`\\bJim(?:['’]s)?\\s+(?:${fx.aliveVerbs})\\b`, "i");
const detailRe = new RegExp(fx.detailTokens.map((t) => t.replace(/ /g, "\\s+")).join("|"), "i");

console.log(`Rehydrate probe · ${endpoint} · model "${model}" · arms [${arms.join(", ")}] · ${runs} run(s)/arm\n`);
await call([{ role: "user", content: "warm up" }], 1).catch(() => {});

const tally = {};
for (const c of fx.cases) {
  for (const arm of arms) {
    const key = `${c.name}/${arm}`;
    tally[key] = { alive: 0, detail: 0, total: 0 };
    const messages = buildMessages(arm, c);
    for (let r = 0; r < runs; r++) {
      let out, err = null;
      try { out = await call(messages, 100 + r); } catch (e) { err = String(e.message || e); }
      tally[key].total++;
      if (err) { console.log(`  ${key}#${r + 1} ERROR: ${err}`); continue; }
      const alive = aliveRe.test(out);
      const detail = detailRe.test(out);
      if (alive) tally[key].alive++;
      if (detail) tally[key].detail++;
      console.log(`  ${key.padEnd(16)}#${r + 1} ${alive ? "ALIVE-WRITE" : "past-ok"} · ${detail ? "DETAIL" : "no-detail"} · ${out.replace(/\s+/g, " ").slice(0, 95)}…`);
    }
  }
}
console.log(`\nCase/arm          alive-writes  detail-recall`);
for (const key of Object.keys(tally)) {
  const t = tally[key];
  console.log(`${key.padEnd(17)} ${String(t.alive).padStart(2)}/${t.total}          ${t.detail}/${t.total}`);
}
