// Re-score saved character-discovery transcripts with the CURRENT extractor, so a rule change can be
// measured without re-running any model. The run files keep the full transcript and the world's
// exclusions, which is everything the extractor needs.
//
//   node disc-rescore.mjs [runs-dir]

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import os from "node:os";

const HARNESS = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HARNESS, "../../..");
const DIR = process.argv[2] ?? path.join(HARNESS, "..", "runs");

const BUNDLE = path.join(os.tmpdir(), `fm-rescore-${process.pid}.mjs`);
await build({
  entryPoints: [path.join(REPO, "src/lib/characterCandidates.ts")],
  outfile: BUNDLE, bundle: true, format: "esm", platform: "node", logLevel: "silent",
  alias: { "@": path.join(REPO, "src") },
});
const { extractCharacterCandidates, collectCandidateEvidence, mergeCandidateEvidence } =
  await import(`file://${BUNDLE.replace(/\\/g, "/")}`);

const files = (await readdir(DIR)).filter((f) => f.startsWith("disc-") && f.endsWith(".json"));
let before = 0, after = 0;
const gone = [], kept = [], added = [];

for (const f of files) {
  const r = JSON.parse(await readFile(path.join(DIR, f), "utf8"));
  const known = [...r.exclusions.characters];
  const now = [];
  let acc = new Map();
  for (const t of r.transcript) {
    acc = mergeCandidateEvidence(acc, collectCandidateEvidence(t.narration));
    for (const name of extractCharacterCandidates("", { ...r.exclusions, characters: known }, acc)) {
      if (!now.includes(name)) { now.push(name); known.push(name); }
    }
  }
  const was = r.promoted.map((p) => p.name);
  before += was.length; after += now.length;
  for (const n of was) (now.includes(n) ? kept : gone).push(`${n}  (${r.world})`);
  for (const n of now) if (!was.includes(n)) added.push(`${n}  (${r.world})`);
}

console.log(`${files.length} sessions · promotions ${before} → ${after}\n`);
console.log(`REMOVED by the current rules (${gone.length}):`);
for (const g of gone.sort()) console.log("  - " + g);
if (added.length) {
  console.log(`\nNEWLY promoted (${added.length}) — a rule change should not add these:`);
  for (const a of added.sort()) console.log("  + " + a);
}
console.log(`\nSTILL promoted (${kept.length}):`);
for (const k of kept.sort()) console.log("    " + k);
