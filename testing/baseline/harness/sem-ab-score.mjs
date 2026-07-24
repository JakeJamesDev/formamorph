// Sem A/B scorer (T5 gate): objective metrics over semQA/semQB run dumps (../runs/semQ*.json).
// Probe checks match by ACTION TEXT (not index) so script edits don't shift them; each check greps
// the probe turn's narration response for planted-fact tokens the action itself never says:
//   C1 compass (pack check)      -> compass | cracked lid          (planted turn 2)
//   C2 destination (say aloud)   -> Harrowgate | survey-house | autumn fair  (planted turn 1)
//   C3 survey-seal (prove it)    -> seal | silver                  (planted turn 32)
// Plus: 8-gram repeat pairs across all narration responses (repetition mass), final narration
// request size in chars, and digest count riding the final recap (band pressure / cap effect).
//
// Usage:  node sem-ab-score.mjs [fileGlobSubstring ...]   (default: all semQ runs)

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const RUNS_DIR = path.resolve(HARNESS_DIR, "../runs");

const CHECKS = [
  { key: "C1-compass", action: "I go through my pack piece by piece", re: /compass|cracked lid/i },
  { key: "C2-dest", action: "I tell the ferryman it has to be tomorrow", re: /harrowgate|survey.?house|autumn fair/i },
  { key: "C3-seal", action: "how anyone will know the finished map is truly mine", re: /\bseal\b|\bsilver\b/i },
];

const grams = (text, n = 8) => {
  const words = text.toLowerCase().replace(/[^a-z' ]+/g, " ").split(/\s+/).filter(Boolean);
  const out = new Set();
  for (let i = 0; i + n <= words.length; i++) out.add(words.slice(i, i + n).join(" "));
  return out;
};

const filters = process.argv.slice(2);
const files = (await readdir(RUNS_DIR))
  .filter((f) => f.startsWith("semQ") && f.endsWith(".json"))
  .filter((f) => !filters.length || filters.some((s) => f.includes(s)))
  .sort();

const rows = [];
for (const f of files) {
  const dump = JSON.parse(await readFile(path.join(RUNS_DIR, f), "utf8"));
  const narrOf = (e) => e.requests?.find((r) => r.type === "narration");
  const row = { file: f, checks: {}, gram8: 0, worst8: 0, finalReq: 0, finalDigests: 0 };

  for (const c of CHECKS) {
    const entry = dump.find((e) => e.action && e.action.includes(c.action));
    if (!entry) { row.checks[c.key] = "n/a"; continue; }
    const resp = narrOf(entry)?.response ?? "";
    row.checks[c.key] = c.re.test(resp) ? "PASS" : "fail";
  }

  // 8-gram repeat pairs across narration responses (count of response pairs sharing any 8-gram).
  const sets = dump.map((e) => narrOf(e)?.response).filter(Boolean).map((t) => grams(t));
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      let shared = 0;
      for (const g of sets[i]) if (sets[j].has(g)) shared++;
      if (shared > 0) { row.gram8++; row.worst8 = Math.max(row.worst8, shared); }
    }
  }

  const last = [...dump].reverse().find((e) => narrOf(e));
  const lastNarr = narrOf(last);
  if (lastNarr) {
    row.finalReq = JSON.stringify(lastNarr.messages).length;
    // Digests ride the recap assistant message as "story so far" sentences; count assistant
    // messages' total chars as the band-mass proxy and the recap's sentence count as digests.
    const recap = lastNarr.messages.find((m) => m.role === "assistant" && /now you are at/i.test(m.content));
    row.finalDigests = recap ? (recap.content.match(/(?<=^|\. )You /g) || []).length : 0;
  }
  rows.push(row);
}

console.log(`file`.padEnd(58) + CHECKS.map((c) => c.key.padEnd(12)).join("") + `8gr-pairs  worst  finalReq  digests`);
for (const r of rows) {
  console.log(
    r.file.slice(0, 56).padEnd(58) +
    CHECKS.map((c) => String(r.checks[c.key]).padEnd(12)).join("") +
    String(r.gram8).padStart(6) + "     " + String(r.worst8).padStart(3) +
    String(r.finalReq).padStart(10) + String(r.finalDigests).padStart(8),
  );
}

// Pooled per arm/model (file prefix up to the timestamp).
const groups = new Map();
for (const r of rows) {
  const key = r.file.replace(/-\d{4}-.*$/, "");
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(r);
}
console.log(`\nPooled:`);
for (const [key, g] of groups) {
  const pass = (ck) => `${g.filter((r) => r.checks[ck] === "PASS").length}/${g.length}`;
  const avg = (fn) => Math.round(g.reduce((s, r) => s + fn(r), 0) / g.length);
  console.log(
    key.padEnd(30) +
    CHECKS.map((c) => `${c.key} ${pass(c.key)}`.padEnd(16)).join("") +
    ` 8gr avg ${avg((r) => r.gram8)}  req avg ${avg((r) => r.finalReq)}  digests avg ${avg((r) => r.finalDigests)}`,
  );
}
