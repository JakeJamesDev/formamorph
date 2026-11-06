// Location-ROUTER probe. Feeds the fixed cases (../location-router-cases.json) through the live
// location-change prompt and grades each: from the player's action alone, did it output the right
// destination name (a real move) or NONE (looking/pointing/talking/summoning someone else, or only
// waiting at a place's threshold)? Renders the location blocks exactly as the app's
// `<LOCATION|summary.markdown>` and `<LOCATION|destinations.summary.markdown>` tokens do.
//
// Usage:  node location-router-probe.mjs [--model silver-siren] [--runs 2] [--temp 0.15] [--only a,b] [--set gold,threshold]
// Cloud:  node location-router-probe.mjs --endpoint https://api.lyonade.net/v1/chat/completions --model-id default --runs 10
// A/B:    add `--base <file>` (e.g. `git show HEAD:src/components/game/GamePrompts.ts > base.ts`): arm A reads the router
//         prompt from that file, arm B from the working tree; each run sends both arms back to back.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HARNESS_DIR, "../../..");

const args = process.argv.slice(2);
const argVal = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const modelFilter = argVal("--model");
const runs = Number(argVal("--runs") || 1);
const temp = Number(argVal("--temp") ?? 0.15); // matches what the app pins for locationChange
const only = argVal("--only")?.split(",");
const sets = argVal("--set")?.split(",");
const basePath = argVal("--base");
const parallel = Number(argVal("--parallel") || 4);
// Optional sampler overrides (else the endpoint's own preset applies). `--seed` pins sampling.
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

// `--endpoint` + `--model-id` bypass profiles.json (the cloud default needs no profile).
const endpointArg = argVal("--endpoint");
const cfg = endpointArg
  ? { endpointUrl: endpointArg, apiToken: argVal("--token") ?? "", models: [{ label: argVal("--model-id") ?? "default", modelName: argVal("--model-id") ?? "default" }] }
  : JSON.parse(await readFile(path.join(HARNESS_DIR, "profiles.json"), "utf8"));
const model = cfg.models.find((m) => !modelFilter || m.label.includes(modelFilter)) ?? cfg.models[0];
const data = JSON.parse(await readFile(path.resolve(HARNESS_DIR, "../location-router-cases.json"), "utf8"));
const cases = data.cases.filter((c) => (!only || only.includes(c.name)) && (!sets || sets.includes(c.set ?? "gold")));

// Pull the live prompts from source (slice between the template backticks).
const grabFrom = (source) => (name) => {
  const at = source.indexOf(name + " = `");
  if (at === -1) throw new Error("missing " + name);
  const from = source.indexOf("`", at) + 1;
  // Probes run English-only, where the language chip renders to nothing. `\` + newline is a template continuation.
  return source.slice(from, source.indexOf("`;", from)).replaceAll("\\\n", "").replaceAll("<LANGUAGE>", "").trimEnd();
};
const loadArm = async (file) => {
  const grab = grabFrom(await readFile(file, "utf8"));
  return { sys: grab("defaultLocationChangePrompt"), user: grab("defaultLocationChangeUserPrompt") };
};
const arms = { ...(basePath && { A: await loadArm(path.resolve(basePath)) }), B: await loadArm(path.join(REPO_ROOT, "src/components/game/GamePrompts.ts")) };

const worldOf = (c) => (c.world ? data.worlds[c.world] : data);
// Render exactly as buildLocationContext(preferSummary, markdown) and buildDestinationsContext do, framed by
// promptHeader's markdown form when the token carries a header.
const chip = (text, variant, value) =>
  text.replace(new RegExp(`<LOCATION\\|${variant.replace(".", "\\.")}(?:\\|header="([^"]*)")?>`, "g"),
    (_, header) => (header ? `\n## ${header}\n${value}\n` : value));
const renderSys = (arm, { current, destinations }) =>
  chip(chip(arm.sys, "summary.markdown", `- **name:** ${current.name}\n- **description:** ${current.description}`),
    "destinations.summary.markdown", destinations.map((d) => `- **${d.name}:** ${d.description}`).join("\n"));

const norm = (s) => (s || "").trim().replace(/^[\s*_"'`]+/, "").replace(/[\s*_"'`.!]+$/, "").toLowerCase();
// Mirror the app's matchLocationResponse: tolerate a dropped/added leading article on either side.
const bare = (s) => norm(s).replace(/^(?:the|an?)\s+/, "");

// Decode the model's raw reply into a decision: a canonical destination name, "NONE", or "?" (garbage).
function decide(raw, names) {
  const firstLine = (raw || "").split("\n").map((l) => l.trim()).find((l) => l.length) || "";
  const n = norm(firstLine);
  if (n === "none") return "NONE";
  return names.find((name) => norm(name) === n || bare(name) === bare(firstLine))
    ?? names.find((name) => n.includes(norm(name)) || bare(firstLine).includes(bare(name)))
    ?? "?";
}

async function call(arm, c) {
  const headers = { "Content-Type": "application/json" };
  if (cfg.apiToken) headers.Authorization = `Bearer ${cfg.apiToken}`;
  const res = await fetch(cfg.endpointUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: model.modelName,
      messages: [{ role: "system", content: renderSys(arm, worldOf(c)) }, { role: "user", content: arm.user.replaceAll("<PLAYER ACTION>", c.narration) }],
      max_tokens: 40,
      temperature: temp,
      reasoning_effort: "none",
      ...extras,
      stream: false,
    }),
  });
  const j = await res.json();
  return (j.choices?.[0]?.message?.content ?? "").trim();
}

console.log(`Location-router probe · ${model.label} · temp ${temp}${Object.keys(extras).length ? " · " + JSON.stringify(extras) : ""} · ${runs} run(s)/case · arms ${Object.keys(arms).join(",")}\n`);
if (args.includes("--show")) { console.log(renderSys(arms.B, worldOf(cases[0]))); process.exit(0); }
await call(arms.B, cases[0]).catch(() => {});

// falseMove = said a place when the answer was NONE (over-trigger). miss = said NONE when a real move
// was expected (under-trigger). wrong = moved to the wrong place.
const tally = {}; // `${arm}|${set}` and `${arm}|case|${name}` → counts
const bump = (key, verdict) => {
  const t = (tally[key] ??= { pass: 0, total: 0, falseMove: 0, miss: 0, wrong: 0, garbage: 0 });
  t.total++;
  if (verdict === "PASS") t.pass++;
  else t[{ "FALSE-MOVE": "falseMove", MISS: "miss", WRONG: "wrong", GARBAGE: "garbage" }[verdict]]++;
};
function grade(c, raw) {
  const got = decide(raw, worldOf(c).destinations.map((d) => d.name));
  const want = c.expect;
  if (got === want) return { got, verdict: "PASS" };
  if (want === "NONE" && got !== "?") return { got, verdict: "FALSE-MOVE" };
  if (want !== "NONE" && got === "NONE") return { got, verdict: "MISS" };
  return { got, verdict: got === "?" ? "GARBAGE" : "WRONG" };
}

const jobs = [];
for (let r = 0; r < runs; r++) for (const c of cases) for (const armName of Object.keys(arms)) jobs.push({ r, c, armName });
let next = 0;
await Promise.all(Array.from({ length: parallel }, async () => {
  while (next < jobs.length) {
    const { r, c, armName } = jobs[next++];
    const raw = await call(arms[armName], c).catch((e) => `ERROR ${e}`);
    const { got, verdict } = grade(c, raw);
    bump(`${armName}|${c.set ?? "gold"}`, verdict);
    bump(`${armName}|case|${c.name}`, verdict);
    console.log(`[${armName}] [${verdict}] ${c.name} #${r + 1}  want=${c.expect} got=${got}  ::  ${JSON.stringify(raw)}`);
  }
}));

const line = (t) => `${t.pass}/${t.total} clean · false-moves=${t.falseMove} misses=${t.miss} wrong=${t.wrong} garbage=${t.garbage}`;
console.log("\nPer case (pass/total per arm):");
for (const c of cases) console.log(`  ${(c.set ?? "gold").padEnd(9)} ${c.name.padEnd(16)} ` + Object.keys(arms).map((a) => { const t = tally[`${a}|case|${c.name}`]; return `${a} ${t.pass}/${t.total}`; }).join("  "));
console.log("\nTotals:");
for (const set of [...new Set(cases.map((c) => c.set ?? "gold"))])
  for (const a of Object.keys(arms)) console.log(`  ${set.padEnd(9)} ${a}  ${line(tally[`${a}|${set}`])}`);
