// RE-DIGEST harness — regenerate every turn's memory digest with a candidate summary prompt, so a change to
// the summary prompt is testable before it ships. The digest is what the banded history feeds to BOTH the
// narrator (non-plan mode) and the planner recap (plan mode), so its voice/register is load-bearing.
//
// For each turn it re-fires the SUMMARY pass (system = defaultSummaryPrompt, user = defaultSummaryUserPrompt
// filled with the turn's real action + narration, summary sampler temperature 0) and scores the fresh digest
// for the freeze/deferral register that we traced the collapse to. A/B by pointing --prompts at two source
// files (HEAD snapshot vs working tree), per the "static A, iterate B" pattern.
//
//   A: node redigest-probe.mjs <export> --prompts <HEAD-snapshot GamePrompts.ts>
//   B: node redigest-probe.mjs <export>                         # defaults to the repo working tree
//   emit a re-digested export for downstream plan/narration probes:  --out <file.json>
//
// Usage:
//   node redigest-probe.mjs "D:/Downloads/ai-context-long session.json" [--prompts <file>] [--out <file>] [--from 0 --to 49]

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, FREEZE_RE, DEFER_RE, callMessages } from "./planner-probe-lib.mjs";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HARNESS_DIR, "../../..");

const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith("--")) || null;
if (!file) { console.error("Provide an ai-context export path as the first argument."); process.exit(1); }
const strArg = (f, d = null) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const numArg = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? Number(argv[i + 1]) : d; };
const promptsFile = strArg("--prompts", path.join(REPO_ROOT, "src/components/game/GamePrompts.ts"));
const outFile = strArg("--out");
const from = numArg("--from", 0);
const to = numArg("--to", Infinity);
const opts = parseArgs(process.argv);

// Self-contained template grab (not the lib's fixed-source one) so --prompts can point anywhere.
const promptSrc = await readFile(promptsFile, "utf8");
const grab = (name) => {
  const at = promptSrc.indexOf(name + " = `");
  if (at === -1) throw new Error(`missing ${name} in ${promptsFile}`);
  const s = promptSrc.indexOf("`", at) + 1;
  return promptSrc.slice(s, promptSrc.indexOf("`;", s));
};
const SUMMARY_SYS = grab("defaultSummaryPrompt");
const SUMMARY_USER = grab("defaultSummaryUserPrompt");

const raw = JSON.parse(await readFile(file, "utf8"));
const turns = Array.isArray(raw) ? raw : Object.values(raw);
const reqOf = (t, ty) => t.requests?.find((r) => r.type === ty);
const narrationOf = (t) => reqOf(t, "narration")?.response || "";
const oldDigestOf = (t) => (reqOf(t, "summary")?.response || "").trim();

/** Re-fire the summary pass for one turn with the loaded prompt (summary sampler: temperature 0). */
async function redigest(t) {
  const user = SUMMARY_USER
    .replaceAll("<PLAYER ACTION>", t.action || "")
    .replaceAll("<NARRATION>", narrationOf(t));
  return (await callMessages({ ...opts, temp: 0, maxTokens: 128 }, [
    { role: "system", content: SUMMARY_SYS },
    { role: "user", content: user },
  ])).trim();
}

const label = promptsFile.includes("A_") || argv.includes("--prompts") ? "A (baseline)" : "B (candidate)";
console.log(`RE-DIGEST · ${file}`);
console.log(`prompt source: ${promptsFile}  [${label}] · "${opts.model}"\n`);

const newDigests = new Array(turns.length).fill(null);
const totals = { n: 0, freeze: 0, defer: 0, len: 0, oldFreeze: 0, oldLen: 0, nothing: 0, narr: 0 };
for (let i = from; i <= Math.min(to, turns.length - 1); i++) {
  const t = turns[i];
  if (!reqOf(t, "summary")) continue; // only turns that carried a digest
  let digest;
  try { digest = await redigest(t); }
  catch (e) { console.log(`${String(i).padStart(3)}  ERROR: ${String(e.message || e)}`); continue; }
  newDigests[i] = digest;
  const old = oldDigestOf(t);
  const freeze = (digest.match(FREEZE_RE) || []).length;
  const oldFreeze = (old.match(FREEZE_RE) || []).length;
  const defer = DEFER_RE.test(digest) ? 1 : 0;
  const narr = narrationOf(t).length || 1;
  const comp = (l) => `${((1 - l / narr) * 100).toFixed(0)}%`;
  totals.n++; totals.freeze += freeze; totals.defer += defer; totals.len += digest.length;
  totals.oldFreeze += oldFreeze; totals.oldLen += old.length; totals.narr += narr;
  if (/^nothing notable$/i.test(digest)) totals.nothing++;
  console.log(`── turn ${i} · freeze ${oldFreeze}→${freeze}${defer ? " · DEFER" : ""} · compaction ${comp(old.length)}→${comp(digest.length)} (${old.length}→${digest.length} of ${narr}) · ${(t.action || "").slice(0, 40)}`);
  console.log(`   OLD: ${old}`);
  console.log(`   NEW: ${digest}`);
}

console.log(`\n==== ${totals.n} digests [${label}] ====`);
console.log(`freeze/digest ${(totals.oldFreeze / totals.n).toFixed(2)} → ${(totals.freeze / totals.n).toFixed(2)}  (old → new)`);
console.log(`mean compaction ${((1 - totals.oldLen / totals.narr) * 100).toFixed(1)}% → ${((1 - totals.len / totals.narr) * 100).toFixed(1)}%  (higher = tighter; both vs mean narration ${Math.round(totals.narr / totals.n)} chars)`);
console.log(`mean length ${Math.round(totals.oldLen / totals.n)} → ${Math.round(totals.len / totals.n)} chars · deferrals ${totals.defer} · nothing-notable ${totals.nothing}`);

if (outFile) {
  // Emit a re-digested export: swap each turn's stored summary AND rebuild each thinking request's recap
  // (the "Earlier events:" block) by substituting old digest text with new, so downstream plan/narration
  // probes see the new memory. Multi-line digests are handled by whole-string replace.
  const clone = JSON.parse(JSON.stringify(turns));
  const swap = new Map(); // old digest -> new digest
  clone.forEach((t, i) => { if (newDigests[i]) { const o = oldDigestOf(turns[i]); if (o) swap.set(o, newDigests[i]); } });
  for (const t of clone) {
    for (const r of t.requests || []) {
      if (r.type === "summary" && swap.has((r.response || "").trim())) r.response = swap.get(r.response.trim());
      if (r.type === "thinking") {
        const u = r.messages?.find((m) => m.role === "user");
        if (u) for (const [o, nw] of swap) if (u.content.includes(o)) u.content = u.content.replace(o, nw);
      }
    }
  }
  await writeFile(outFile, JSON.stringify(clone));
  console.log(`\nwrote re-digested export → ${outFile}  (feed to planner-replay-probe.mjs / narration eval)`);
}
