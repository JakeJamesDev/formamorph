// Scores the `directives[]` field the restate modes produced but the flag-based backtest never read.
//
// Different signal from flag-hunting: not "what does the model complain about" but "what survives when
// it compresses the prompt to its 8 most binding rules". A constraint that falls out of the ranked list
// is one that isn't landing.
//
// Absence only means something against a paired control, so every defect is scored as a contrast:
//   shipped arm → does the SHIPPED wording appear in directives?
//   defect arm  → does the DEFECTIVE wording appear in directives?
// A useful detector keeps the shipped text and drops the defective one. A model that drops both is
// just compressing, and absence carries no information.
//
// Usage: node restate-directives-score.mjs ../runs/restate-backtest-*.json

import { readFile } from "node:fs/promises";
import { DEFECTS } from "./restate-cases.mjs";

const files = process.argv.slice(2);
if (!files.length) throw new Error("pass one or more raw restate-backtest JSON files");

// The post-fix counterpart of each defect span, as it reads in the shipped prompt. null = this defect
// has no measurable directive counterpart (see notes at the bottom of the report).
const SHIPPED_SPAN = {
  "D1-fuse": "Characters speak through what they do: their actual words land as quoted dialogue woven into their movements",
  "D2-format-A": null, // user-message framing, never a directive
  "D3a-stats-preamble": null, // defect ADDS a line; measured on the defect arm alone
  "D3b-digest-tense": "second-person, present-tense sentences on a single line: what you do",
  "D4-closing-voice": null, // clause survives in the user slot on this arm — not a clean absence test
  "D5-asking": "urging, teasing, voicing what they want next",
  "D6-vague-combo": "What the story has established stays true: where everyone is, what they hold and wear",
  "D7-user-voice": null, // clause survives in the system prompt on this arm — same problem
};

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

function overlaps(text, span) {
  const a = norm(text), b = norm(span);
  if (!a || !b) return false;
  const shorter = Math.min(a.length, b.length);
  const l = lcs(a, b);
  return l >= 25 || (shorter >= 12 && l >= 0.7 * shorter);
}

const present = (directives, span) => (directives ?? []).some((d) => overlaps(d, span));

const rows = [];
for (const f of files) {
  const j = JSON.parse(await readFile(f, "utf8"));
  for (const r of j.results) if (!r.error && Array.isArray(r.directives) && r.directives.length) rows.push({ ...r, target: j.target });
}

const cells = [...new Set(rows.map((r) => `${r.target}/${r.mode}`))].sort();
const rate = (n, d) => (d ? `${n}/${d}` : "-");

console.log("\n### Does the constraint survive compression into directives[]?\n");
console.log(`| defect | ${cells.map((c) => `${c} — shipped kept | ${c} — defective kept`).join(" | ")} |`);
console.log(`|---|${cells.map(() => "---|---|").join("")}`);

for (const d of DEFECTS) {
  const shippedSpan = SHIPPED_SPAN[d.id];
  const defectSpan = d.span.split("\n|")[0];
  const cols = [];
  for (const k of cells) {
    const shippedArm = rows.filter((r) => `${r.target}/${r.mode}` === k && r.arm.startsWith("SHIPPED"));
    const defectArm = rows.filter((r) => `${r.target}/${r.mode}` === k && r.arm === d.id);
    cols.push(shippedSpan ? rate(shippedArm.filter((r) => present(r.directives, shippedSpan)).length, shippedArm.length) : "n/a");
    cols.push(rate(defectArm.filter((r) => present(r.directives, defectSpan)).length, defectArm.length));
  }
  console.log(`| ${d.id} | ${cols.join(" | ")} |`);
}

console.log("\n### Directive-list shape (is compression even happening?)\n");
console.log("| tier/mode | arms | mean directives | mean chars/directive |");
console.log("|---|---|---|---|");
for (const k of cells) {
  const rs = rows.filter((r) => `${r.target}/${r.mode}` === k);
  const n = rs.reduce((a, r) => a + r.directives.length, 0) / rs.length;
  const len = rs.flatMap((r) => r.directives).reduce((a, d) => a + String(d).length, 0) / rs.flatMap((r) => r.directives).length;
  console.log(`| ${k} | ${rs.length} | ${n.toFixed(1)} | ${len.toFixed(0)} |`);
}

console.log(`\nrows with directives: ${rows.length}`);
console.log("n/a = no measurable counterpart: D2 is user-message framing; D3a's defect ADDS a line;");
console.log("D4/D7 remove the voice clause from one slot while it survives in the other, so its absence");
console.log("from a ranked list cannot be attributed to the edit.");
