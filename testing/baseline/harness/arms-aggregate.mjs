// Arm aggregator — reads the raw chain JSONs a format-arms-probe batch writes and reports per-arm
// mean/σ/n with a Welch t-test against the control arm. Built for the item-5 repetition batch, where
// within-arm spread is large enough that per-run lines cannot be read by eye: 8 runs x 4 arms of
// echo5 numbers is exactly the shape that invites seeing a difference that isn't there.
//
// Metrics: echo5per100w (repetition — want DOWN) and hasCallback rate + carriedNames (the guard —
// want FLAT; a clause that drops both is eating deliberate callbacks, not filler).
//
// Usage:  node arms-aggregate.mjs --ts 2026-07-25T03-11-22-333Z [--control none] [--model cydonia-lmstudio]
//         node arms-aggregate.mjs --latest            # newest timestamp present in ../runs

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const RUNS_DIR = path.resolve(HARNESS_DIR, "../runs");
const argv = process.argv.slice(2);
const argVal = (f, d = null) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const wantTs = argVal("--ts");
const controlKey = argVal("--control", "none");
const modelFilter = argVal("--model");

const files = (await readdir(RUNS_DIR)).filter((f) => f.startsWith("format-") && f.endsWith(".json"));
// Filenames are format-<arm>-run<n>-<model>-<ts>.json; the ts is the trailing ISO-ish stamp.
const parse = (f) => {
  const m = f.match(/^format-(.+)-run(\d+)-(.+)-(\d{4}-\d\d-\d\dT[\d-]+Z)\.json$/);
  return m ? { file: f, arm: m[1], run: +m[2], model: m[3], ts: m[4] } : null;
};
let entries = files.map(parse).filter(Boolean);
if (modelFilter) entries = entries.filter((e) => e.model === modelFilter);
if (!entries.length) throw new Error("no chain files matched");
const ts = wantTs ?? entries.map((e) => e.ts).sort().at(-1);
entries = entries.filter((e) => e.ts === ts);
if (!entries.length) throw new Error(`no chains for ts ${ts}`);

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
};
// Welch's t (unequal variance). Reported as |t| with df; not a p-value — with n<=10 per cell this is a
// rough "is it even worth looking at" filter, not an inferential claim.
const welch = (a, b) => {
  if (a.length < 2 || b.length < 2) return null;
  const va = sd(a) ** 2 / a.length, vb = sd(b) ** 2 / b.length;
  if (va + vb === 0) return null;
  const t = (mean(a) - mean(b)) / Math.sqrt(va + vb);
  const df = (va + vb) ** 2 / (va ** 2 / (a.length - 1) + vb ** 2 / (b.length - 1));
  return { t, df };
};

const byArm = new Map();
for (const e of entries) {
  const c = JSON.parse(await readFile(path.join(RUNS_DIR, e.file), "utf8"));
  // Prefilled turns are never pushed, so every scored turn here is generated.
  const turns = c.turns.filter((t) => t.m);
  if (!turns.length) continue;
  const rec = byArm.get(e.arm) ?? { echo: [], cb: [], names: [], dlg: [], words: [] };
  rec.echo.push(mean(turns.map((t) => t.m.echo5per100w)));
  rec.cb.push(turns.filter((t) => t.m.hasCallback).length / turns.length);
  rec.names.push(mean(turns.map((t) => t.m.carriedNames)));
  rec.dlg.push(mean(turns.map((t) => t.m.dialoguePct)));
  rec.words.push(mean(turns.map((t) => t.m.words)));
  byArm.set(e.arm, rec);
}

const arms = [...byArm.keys()].sort();
const ctrl = arms.find((a) => a.includes(controlKey)) ?? arms[0];
const C = byArm.get(ctrl);
console.log(`batch ${ts} · ${entries.length} chains · control = ${ctrl}\n`);
const pad = (s, n) => String(s).padEnd(n);
console.log(pad("arm", 22) + pad("echo5 mean±sd", 18) + pad("vs ctrl", 16) + pad("callback", 12) + pad("names/turn", 12) + "dialogue%");
for (const a of arms) {
  const r = byArm.get(a);
  const t = a === ctrl ? null : welch(r.echo, C.echo);
  const delta = a === ctrl ? "—" : `${(mean(r.echo) - mean(C.echo) >= 0 ? "+" : "")}${(mean(r.echo) - mean(C.echo)).toFixed(1)}${t ? ` (t=${t.t.toFixed(2)})` : ""}`;
  console.log(
    pad(a, 22) +
    pad(`${mean(r.echo).toFixed(1)} ± ${sd(r.echo).toFixed(1)} (n${r.echo.length})`, 18) +
    pad(delta, 16) +
    pad(`${(100 * mean(r.cb)).toFixed(0)}%`, 12) +
    pad(mean(r.names).toFixed(2), 12) +
    `${mean(r.dlg).toFixed(1)}%`,
  );
}
console.log(`\nRead echo5 WITH the callback columns: echo down + callback flat = real win;`);
console.log(`both down = the arm is suppressing deliberate callbacks, which is a regression.`);
console.log(`|t| < ~2 at these n means the arms are not distinguishable — report that, don't pick a winner.`);
