// Location-ROUTER probe. Feeds the fixed gold cases (../location-router-cases.json) through the live
// location-change prompt against a local model and grades each: from the player's action alone, did it
// output the right destination name (a real move) or NONE (looking/pointing/talking/summoning someone
// else)? Renders the location blocks exactly as the app's `<LOCATION|summary.markdown>` and
// `<LOCATION|destinations.summary.markdown>` tokens do (`- **name:** value` / `- **Name:** summary`).
//
// Usage:  node location-router-probe.mjs [--model rocinante] [--runs 2] [--temp 0.15]

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HARNESS_DIR, "../../..");

const args = process.argv.slice(2);
const argVal = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const modelFilter = argVal("--model");
const runs = Number(argVal("--runs") || 1);
const temp = Number(argVal("--temp") ?? 0.15); // matches what the app now pins for locationChange
// Optional sampler overrides (else the endpoint's own roleplay preset applies). `--seed` pins sampling.
const reppen = argVal("--reppen");
const minp = argVal("--minp");
const topk = argVal("--topk");
const seed = argVal("--seed");
const extras = {
  ...(reppen != null && { repeat_penalty: Number(reppen) }),
  ...(minp != null && { min_p: Number(minp) }),
  ...(topk != null && { top_k: Number(topk) }),
  ...(seed != null && { seed: Number(seed) }),
};

const cfg = JSON.parse(await readFile(path.join(HARNESS_DIR, "profiles.json"), "utf8"));
const model = cfg.models.find((m) => !modelFilter || m.label.includes(modelFilter)) ?? cfg.models[0];
const { current, destinations, cases } = JSON.parse(await readFile(path.resolve(HARNESS_DIR, "../location-router-cases.json"), "utf8"));

// Pull the live prompts from source (slice between the template backticks).
const source = await readFile(path.join(REPO_ROOT, "src/components/game/GamePrompts.ts"), "utf8");
const grab = (name) => {
  const at = source.indexOf(name + " = `");
  if (at === -1) throw new Error("missing " + name);
  const from = source.indexOf("`", at) + 1;
  return source.slice(from, source.indexOf("`;", from));
};
const SYS = grab("defaultLocationChangePrompt");
const USER = grab("defaultLocationChangeUserPrompt");

// Render exactly as buildLocationContext(preferSummary, markdown) and buildDestinationsContext do.
const currentBlock = `- **name:** ${current.name}\n- **description:** ${current.description}`;
const destBlock = destinations.map((d) => `- **${d.name}:** ${d.description}`).join("\n");
const renderSys = () =>
  SYS.replaceAll("<LOCATION|summary.markdown>", currentBlock)
    .replaceAll("<LOCATION|destinations.summary.markdown>", destBlock);
const renderUser = (narration) => USER.replaceAll("<PLAYER ACTION>", narration);

const NAMES = destinations.map((d) => d.name);
const norm = (s) => (s || "").trim().replace(/^[\s*_"'`]+/, "").replace(/[\s*_"'`.!]+$/, "").toLowerCase();
// Mirror the app's matchLocationResponse: tolerate a dropped/added leading article on either side.
const bare = (s) => norm(s).replace(/^(?:the|an?)\s+/, "");

// Decode the model's raw reply into a decision: a canonical destination name, "NONE", or "?" (garbage).
function decide(raw) {
  const firstLine = (raw || "").split("\n").map((l) => l.trim()).find((l) => l.length) || "";
  const n = norm(firstLine);
  if (n === "none") return "NONE";
  const exact = NAMES.find((name) => norm(name) === n || bare(name) === bare(firstLine));
  if (exact) return exact;
  const contained = NAMES.find((name) => n.includes(norm(name)) || bare(firstLine).includes(bare(name)));
  if (contained) return contained;
  return "?";
}

async function call(narration) {
  const headers = { "Content-Type": "application/json" };
  if (cfg.apiToken) headers.Authorization = `Bearer ${cfg.apiToken}`;
  const res = await fetch(cfg.endpointUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: model.modelName,
      messages: [{ role: "system", content: renderSys() }, { role: "user", content: renderUser(narration) }],
      max_tokens: 40,
      temperature: temp,
      ...extras,
      stream: false,
    }),
  });
  const j = await res.json();
  return (j.choices?.[0]?.message?.content ?? "").trim();
}

console.log(`Location-router probe · ${model.label} · temp ${temp}${Object.keys(extras).length ? " · " + JSON.stringify(extras) : ""} · ${runs} run(s)/case\n`);
await call("warm up").catch(() => {});
// falseMove = said a place when the answer was NONE (over-trigger, the 12B weakness).
// miss = said NONE when a real move was expected (under-trigger). wrong = moved to the wrong place.
const agg = { pass: 0, total: 0, falseMove: 0, miss: 0, wrong: 0, garbage: 0 };
for (const c of cases) {
  for (let r = 0; r < runs; r++) {
    const raw = await call(c.narration);
    const got = decide(raw);
    const want = c.expect;
    let verdict;
    if (got === want) verdict = "PASS";
    else if (want === "NONE" && got !== "NONE" && got !== "?") { verdict = "FALSE-MOVE"; agg.falseMove++; }
    else if (want !== "NONE" && got === "NONE") { verdict = "MISS"; agg.miss++; }
    else if (got === "?") { verdict = "GARBAGE"; agg.garbage++; }
    else { verdict = "WRONG"; agg.wrong++; }
    agg.total++; if (verdict === "PASS") agg.pass++;
    console.log(`[${verdict}] ${c.name}${runs > 1 ? ` #${r + 1}` : ""}  want=${want} got=${got}  ::  ${JSON.stringify(raw)}`);
  }
}
console.log(`\n${agg.pass}/${agg.total} clean · false-moves=${agg.falseMove} misses=${agg.miss} wrong=${agg.wrong} garbage=${agg.garbage}`);
