// Rescore saved restate-backtest raw results under the current matcher, without re-spending calls.
// Exists because the first matcher had no absolute overlap floor: a 3-char quote ("N/A") shared a run
// with every span in the prompt, so control-hit counts were fiction. Any future matcher change reruns
// through here so old and new numbers stay comparable.
//
// Usage: node restate-rescore.mjs ../runs/restate-backtest-*.json

import { readFile } from "node:fs/promises";
import { DEFECTS, CONTROL_SPANS } from "./restate-cases.mjs";

const files = process.argv.slice(2);
if (!files.length) throw new Error("pass one or more raw restate-backtest JSON files");

const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

function lcs(a, b) {
  if (!a || !b) return 0;
  let best = 0;
  let prev = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) { cur[j] = prev[j - 1] + 1; if (cur[j] > best) best = cur[j]; }
    }
    prev = cur;
  }
  return best;
}

function overlaps(quote, span) {
  const a = norm(quote), b = norm(span);
  if (!a || !b) return false;
  const shorter = Math.min(a.length, b.length);
  const l = lcs(a, b);
  return l >= 25 || (shorter >= 12 && l >= 0.7 * shorter);
}

const D7_RE = /\b(final|last|current|user)\s+(message|turn|slot|prompt|line)\b|\bno (instruction|guidance|direction)\b/i;

const all = [];
for (const f of files) {
  const j = JSON.parse(await readFile(f, "utf8"));
  for (const r of j.results) all.push({ ...r, target: j.target });
}

const rows = all.filter((r) => !r.error);
for (const r of rows) {
  const d = DEFECTS.find((x) => x.id === r.arm);
  const flags = Array.isArray(r.flags) ? r.flags : [];
  r.hit = d
    ? d.bareUserArm
      ? flags.some((f) => D7_RE.test(`${f.quote ?? ""} ${f.issue ?? ""}`))
      : flags.some((f) => d.span.split("\n|").some((sp) => overlaps(f.quote, sp)))
    : false;
  r.controlHits = CONTROL_SPANS.filter((c) => flags.some((f) => overlaps(f.quote, c.span))).map((c) => c.id);
}

const cells = [...new Set(rows.map((r) => `${r.target}/${r.mode}`))].sort();

console.log("\n### Stage 1 · sensitivity — hits / runs (defect flagged)\n");
console.log(`| defect | ${cells.join(" | ")} |`);
console.log(`|---|${cells.map(() => "---|").join("")}`);
for (const d of DEFECTS) {
  const c = cells.map((k) => {
    const rs = rows.filter((r) => `${r.target}/${r.mode}` === k && r.arm === d.id);
    return rs.length ? `${rs.filter((r) => r.hit).length}/${rs.length}` : "-";
  });
  console.log(`| ${d.id} | ${c.join(" | ")} |`);
}
console.log(`| **caught ≥1×** | ${cells.map((k) => `**${DEFECTS.filter((d) => rows.some((r) => `${r.target}/${r.mode}` === k && r.arm === d.id && r.hit)).length}/8**`).join(" | ")} |`);
console.log(`| **majority of runs** | ${cells.map((k) => {
  const n = DEFECTS.filter((d) => {
    const rs = rows.filter((r) => `${r.target}/${r.mode}` === k && r.arm === d.id);
    return rs.length && rs.filter((r) => r.hit).length > rs.length / 2;
  }).length;
  return `**${n}/8**`;
}).join(" | ")} |`);

console.log("\n### Stage 2 · specificity — flags raised on the SHIPPED prompt\n");
console.log("| arm | tier/mode | flags per run | KEEP-surface flags per run | KEEP surfaces flagged |");
console.log("|---|---|---|---|---|");
for (const arm of ["SHIPPED-narration", "SHIPPED-summary"]) {
  for (const k of cells) {
    const rs = rows.filter((r) => `${r.target}/${r.mode}` === k && r.arm === arm);
    if (!rs.length) continue;
    const flags = rs.reduce((a, r) => a + (r.flags?.length ?? 0), 0) / rs.length;
    const ctl = rs.reduce((a, r) => a + r.controlHits.length, 0) / rs.length;
    const which = [...new Set(rs.flatMap((r) => r.controlHits))];
    console.log(`| ${arm} | ${k} | ${flags.toFixed(1)} | ${ctl.toFixed(1)} | ${which.join(", ") || "none"} |`);
  }
}
console.log(`\nrows scored: ${rows.length} (errors excluded: ${all.length - rows.length})`);
