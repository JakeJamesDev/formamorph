// Re-score saved probe dumps with the CURRENT speech-attrib rules, without re-running any model calls.
// Attribution bugs have twice changed a headline number after the fact; the dumps hold the full passages,
// so a scorer fix is re-applied to the evidence already collected rather than paid for again.
//
//   node rescore-speech.mjs ../runs/levers/decay50-shipped.json [more.json...] [--bucket 10]

import { readFile } from "node:fs/promises";
import { splitQuotes, parrotScore } from "./speech-attrib.mjs";

const argv = process.argv.slice(2);
const num = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? Number(argv[i + 1]) : d; };
const BUCKET = num("--bucket", 10);
const files = argv.filter((a) => !a.startsWith("--") && a.endsWith(".json"));

const corpus = await import("./charged-speech-corpus.mjs");
const CAST = (corpus.ENTITIES ?? []).map((e) => e.name);
const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : "-");

for (const file of files) {
  const j = JSON.parse(await readFile(file, "utf8"));
  const rows = j.runs.flat().filter((r) => r.speech);
  const buckets = new Map();
  for (const r of rows) {
    const b = Math.floor((r.turn - 1) / BUCKET);
    if (!buckets.has(b)) buckets.set(b, { n: 0, pc: 0, npc: 0, parrot: 0, was: 0 });
    const t = buckets.get(b);
    const { pc, npc } = splitQuotes(r.text, CAST);
    t.n++; t.pc += pc.length ? 1 : 0; t.npc += npc.length ? 1 : 0;
    t.parrot += parrotScore(r.action, npc);
    t.was += r.pcSpeech; // what the dump recorded at run time
  }
  console.log(`\n== ${file.split(/[\\/]/).pop()} · levers ${j.levers ?? "?"} · ${rows.length} speech-turn runs`);
  console.log("turns      PCspk(was)   NPCspk   parrot");
  const totals = { n: 0, pc: 0, npc: 0, parrot: 0, was: 0 };
  for (const b of [...buckets.keys()].sort((x, y) => x - y)) {
    const t = buckets.get(b);
    for (const k of Object.keys(totals)) totals[k] += t[k];
    console.log(`${`${b * BUCKET + 1}-${(b + 1) * BUCKET}`.padEnd(11)}${`${pct(t.pc, t.n)} (${pct(t.was, t.n)})`.padStart(11)}${pct(t.npc, t.n).padStart(9)}${(t.parrot / t.n).toFixed(2).padStart(9)}`);
  }
  console.log(`${"ALL".padEnd(11)}${`${pct(totals.pc, totals.n)} (${pct(totals.was, totals.n)})`.padStart(11)}${pct(totals.npc, totals.n).padStart(9)}${(totals.parrot / totals.n).toFixed(2).padStart(9)}`);
}
