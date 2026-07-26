// Aggregate character-discovery-probe runs: how many promotions were TITLED, and what they were.
// Answers the open question — is "title + capitalized word = character on sight" too eager in
// practice, or does it only misfire on page furniture the non-prose rule now removes?
//
//   node disc-aggregate.mjs [runs-glob-dir]

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HARNESS = path.dirname(fileURLToPath(import.meta.url));
const DIR = process.argv[2] ?? path.join(HARNESS, "..", "runs");
const files = (await readdir(DIR)).filter((f) => f.startsWith("disc-") && f.endsWith(".json"));

let titled = 0, untitled = 0, sessions = 0, totalTurns = 0;
const byWorld = new Map();
const rows = [];

for (const f of files) {
  const r = JSON.parse(await readFile(path.join(DIR, f), "utf8"));
  sessions++; totalTurns += r.turns;
  const key = `${r.world} · ${r.model}`;
  const agg = byWorld.get(key) ?? { promoted: 0, titled: 0, turns: 0, names: new Set() };
  agg.turns += r.turns;
  for (const p of r.promoted) {
    agg.promoted++; agg.names.add(p.name);
    if (p.evidence?.titled) { titled++; agg.titled++; } else untitled++;
    rows.push({ world: r.world, model: r.model, seed: r.seed, name: p.name,
      titled: !!p.evidence?.titled, mid: p.evidence?.mid ?? 0, turn: p.firstTurn });
  }
  byWorld.set(key, agg);
}

console.log(`${sessions} sessions · ${totalTurns} turns · ${rows.length} promotions\n`);
console.log("world · model".padEnd(42), "turns", "promoted", "titled", "distinct");
for (const [k, v] of byWorld) {
  console.log(k.padEnd(42), String(v.turns).padStart(5), String(v.promoted).padStart(8),
    String(v.titled).padStart(6), String(v.names.size).padStart(8));
}
console.log(`\nqualification path: titled ${titled} · repetition ${untitled}`);

console.log("\nevery promotion (label these by hand — precision cannot be self-assessed):");
for (const r of rows.sort((a, b) => a.world.localeCompare(b.world) || a.name.localeCompare(b.name))) {
  console.log(`  ${r.world.padEnd(20)} ${r.model.padEnd(18)} s${r.seed} t${String(r.turn).padStart(2)} ` +
    `${r.titled ? "TITLED    " : `mid ${String(r.mid).padStart(2)}    `} ${r.name}`);
}
