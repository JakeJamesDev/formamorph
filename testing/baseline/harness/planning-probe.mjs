// Planning probe for the reframed precall "continuity planner" prompt (Scene / Cast / Beats). Feeds fixed
// gold cases (../planning-cases.json) - each a previous narration + the player's next action + an entity
// roster - through the live prompt and grades the continuity behaviors: does the plan parse, open the Cast
// with the Player Character, carry the whole prior cast forward, drop who plainly leaves, keep an established
// object (not a substitute), and use the "name (alias)" spoiler form only for a not-yet-named character.
// Mirrors parseDirectorCast (stagedPlanning.ts) so the grade matches what the app would actually extract.
//
// Usage:  node planning-probe.mjs [--model silver-siren] [--runs 2] [--temp 0.4]

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HARNESS_DIR, "../../..");

const args = process.argv.slice(2);
const argVal = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const modelFilter = argVal("--model");
const runs = Number(argVal("--runs") || 1);
const temp = Number(argVal("--temp") ?? 0.4); // precall isn't pinned; 0.4 is a mid default to probe with
const seed = argVal("--seed");
const extras = { ...(seed != null && { seed: Number(seed) }) };

const cfg = JSON.parse(await readFile(path.join(HARNESS_DIR, "profiles.json"), "utf8"));
const model = cfg.models.find((m) => !modelFilter || m.label.includes(modelFilter)) ?? cfg.models[0];
const { world, playerTrait, location, cases } = JSON.parse(await readFile(path.resolve(HARNESS_DIR, "../planning-cases.json"), "utf8"));

const source = await readFile(path.join(REPO_ROOT, "src/components/game/GamePrompts.ts"), "utf8");
const grab = (name) => {
  const at = source.indexOf(name + " = `");
  if (at === -1) throw new Error("missing " + name);
  const from = source.indexOf("`", at) + 1;
  return source.slice(from, source.indexOf("`;", from));
};
const SYS = grab("defaultThinkingPrompt");

// Render the entity roster exactly as buildEntityContext(markdown) does.
const renderEntities = (entities) =>
  entities.length
    ? entities.map((e) => `- **${e.name}**\n  - **description:** ${e.description}\n  - **type:** ${e.type}`).join("\n")
    : "N/A";
const renderSys = (entities) =>
  SYS.replaceAll("<WORLD DESCRIPTION>", world)
    .replaceAll("<TRAITS DESCRIPTION|markdown>", `- **Identity:** ${playerTrait}`)
    .replaceAll("<LOCATION|summary.markdown>", `- **name:** ${location}`)
    .replaceAll("<LOCATION|sublocations.summary.markdown>", "N/A")
    .replaceAll("<LOCATION|reachable.summary.markdown>", "N/A")
    .replaceAll("<ENTITIES|summary.markdown>", renderEntities(entities))
    .replaceAll("<ENTITIES|sublocations.summary.markdown>", "N/A")
    .replaceAll("<ENTITIES|reachable.summary.markdown>", "N/A")
    .replaceAll("<NOTES>", "None");
const renderUser = (prev, action) =>
  `What just happened:\n${prev}\n\nThe player's next action: ${action}\n\nSet the scene, list the cast, and lay out the beats now. Do not narrate.`;

// --- Mirror of parseDirectorCast (stagedPlanning.ts), plus alias capture ---
const BULLET_RE = /^\s*[-*•]\s+(.+)$/;
const CAST_SEP_RE = /\s+[—–-]\s+|:\s/;
const PLAYER_ALIASES = new Set(["you", "player", "the player", "player character", "the player character", "yourself", "protagonist", "the protagonist", "main character", "the main character"]);
const strip = (s) => s.replace(/^[^\p{L}\p{N}(]+|[^\p{L}\p{N})]+$/gu, "").trim();

function parsePlan(raw) {
  const lines = (raw || "").split("\n");
  const cast = [];
  let inCast = false, beats = "", sceneSeen = false, scene = "";
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    const beatsM = t.match(/^beats\s*:?\s*(.*)$/i);
    if (beatsM && inCast) { beats = beatsM[1].trim(); continue; }
    const bullet = t.match(BULLET_RE);
    if (bullet) {
      inCast = true;
      let body = bullet[1].trim();
      const sep = body.search(CAST_SEP_RE);
      let namePart = sep !== -1 ? body.slice(0, sep) : body;
      const stance = sep !== -1 ? body.slice(sep).replace(CAST_SEP_RE, "").trim() : "";
      const aliasM = namePart.match(/\(([^)]*)\)/);
      const alias = aliasM ? aliasM[1].trim() : "";
      const name = strip(namePart.replace(/\([^)]*\)/, ""));
      if (name) cast.push({ name, alias, stance, isPlayer: PLAYER_ALIASES.has(name.toLowerCase()) });
      continue;
    }
    if (/^cast\b\s*:?/i.test(t)) { inCast = true; continue; }
    const sceneM = t.match(/^scene\s*:\s*(.*)$/i);
    if (sceneM) { if (!inCast && sceneM[1].trim()) { scene = sceneM[1].trim(); sceneSeen = true; } continue; }
    if (!inCast) { scene += (scene ? " " : "") + t; sceneSeen = true; }
  }
  return { scene, sceneSeen, cast, beats };
}

async function call(sys, user) {
  const headers = { "Content-Type": "application/json" };
  if (cfg.apiToken) headers.Authorization = `Bearer ${cfg.apiToken}`;
  const res = await fetch(cfg.endpointUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: model.modelName,
      messages: [{ role: "system", content: sys }, { role: "user", content: user }],
      max_tokens: 256, temperature: temp, ...extras, stream: false,
    }),
  });
  const j = await res.json();
  return (j.choices?.[0]?.message?.content ?? "").trim();
}

const hasName = (cast, sub) => cast.some((c) => c.name.toLowerCase().includes(sub.toLowerCase()));
const memberOf = (cast, sub) => cast.find((c) => c.name.toLowerCase().includes(sub.toLowerCase()));

console.log(`Planning probe · ${model.label} · temp ${temp} · ${runs} run(s)/case\n`);
await call(renderSys([]), "warm up").catch(() => {});
const agg = { pass: 0, total: 0, fmt: 0, playerFirst: 0, dropMiss: 0, carryMiss: 0, objMiss: 0, aliasMiss: 0, solo: 0 };
for (const c of cases) {
  for (let r = 0; r < runs; r++) {
    const raw = await call(renderSys(c.entities), renderUser(c.prevNarration, c.action));
    const { sceneSeen, cast, beats } = parsePlan(raw);
    const npcs = cast.filter((x) => !x.isPlayer);
    const fails = [];
    if (!sceneSeen || cast.length === 0 || !beats) { fails.push("FORMAT"); agg.fmt++; }
    if (cast.length && !cast[0].isPlayer) { fails.push("PLAYER-NOT-FIRST"); agg.playerFirst++; }
    for (const n of c.castPresent || []) if (!hasName(cast, n)) { fails.push(`CARRY-MISS:${n}`); agg.carryMiss++; }
    for (const n of c.castAbsent || []) if (hasName(cast, n)) { fails.push(`NOT-DROPPED:${n}`); agg.dropMiss++; }
    if (c.soloExpected && npcs.length) { fails.push(`INVENTED:${npcs.map((x) => x.name).join("/")}`); agg.solo++; }
    if (c.keepWord || c.forbidWord) {
      const blob = (cast.map((x) => x.stance).join(" ") + " " + beats).toLowerCase();
      if (c.keepWord && !blob.includes(c.keepWord.toLowerCase())) { fails.push(`OBJ-LOST:${c.keepWord}`); agg.objMiss++; }
      for (const w of c.forbidWord || []) if (blob.includes(w.toLowerCase())) { fails.push(`OBJ-SWAP:${w}`); agg.objMiss++; }
    }
    if (c.aliasHidden) { const m = memberOf(cast, c.aliasHidden); if (!m || !m.alias) { fails.push("ALIAS-SPOILED"); agg.aliasMiss++; } }
    if (c.aliasRevealed) { const m = memberOf(cast, c.aliasRevealed); if (m && m.alias) { fails.push("ALIAS-OVERHIDDEN"); agg.aliasMiss++; } }
    const pass = fails.length === 0;
    agg.total++; if (pass) agg.pass++;
    const castStr = cast.map((x) => x.isPlayer ? "[P]" : x.alias ? `${x.name}(${x.alias})` : x.name).join(", ");
    console.log(`[${pass ? "PASS" : "FAIL"}] ${c.name}${runs > 1 ? ` #${r + 1}` : ""}${fails.length ? "  <" + fails.join(",") + ">" : ""}  cast: ${castStr}`);
    if (!pass) console.log(`        ${JSON.stringify(raw).slice(0, 400)}`);
  }
}
console.log(`\n${agg.pass}/${agg.total} clean · format=${agg.fmt} playerFirst=${agg.playerFirst} carryMiss=${agg.carryMiss} notDropped=${agg.dropMiss} objMiss=${agg.objMiss} aliasMiss=${agg.aliasMiss} invented=${agg.solo}`);
