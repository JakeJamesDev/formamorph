// Model screen: run one candidate through the gate world with shipped default prompts, score the objective
// axes, and emit a one-page card + append to a deduped leaderboard. Prose quality is left as a slot for an
// in-session Claude read (or a future --judge flag) — the auto axes need no judge.
//
// Usage:  node screen.mjs --model <label> [--no-run] [--file <dump.json>]
//   --model    model label as it appears in profiles.json (required)
//   --no-run   skip the baseline run; score the newest existing screen-<label> dump
//   --file     score a specific dump file instead of running / searching
//   --seeds N  aggregate the newest N dumps (pair with: baseline --profile screen --model X --repeat N)

import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { scoreDump, aggregateScores } from "./screenScore.mjs";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HARNESS_DIR, "../../..");
const RUNS_DIR = path.resolve(HARNESS_DIR, "../runs");
const BOARD_JSON = path.resolve(HARNESS_DIR, "../leaderboard.json");
const BOARD_MD = path.resolve(HARNESS_DIR, "../leaderboard.md");

const args = process.argv.slice(2);
const argVal = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const model = argVal("--model");
const noRun = args.includes("--no-run");
const fileArg = argVal("--file");
const seeds = Math.max(1, parseInt(argVal("--seeds") ?? "1", 10) || 1);
if (!model) { console.error("screen.mjs: --model <label> is required"); process.exit(1); }

const bar = (pct) => { const n = Math.round(pct / 20); return "▓".repeat(n) + "░".repeat(5 - n); };

function runBaseline() {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    console.log(`▶ screening ${model} — running gate world (shipped prompts)…`);
    const child = spawn("node", [path.join(HARNESS_DIR, "run.mjs"), "--profile", "screen", "--model", model],
      { cwd: REPO_ROOT, shell: false, stdio: "inherit" });
    child.on("exit", (code) => code === 0 ? resolve(Date.now() - started) : reject(new Error(`run.mjs exited ${code}`)));
    child.on("error", reject);
  });
}

/**
 * Newest dump for this model. `after` (ms) guards against scoring a stale dump: when the baseline run fails
 * it writes nothing, and without this we'd silently score the previous run and report it as fresh — which
 * once produced a bogus "engine" score that was really an old Ollama result.
 */
function newestDumps(after = 0, count = 1) {
  const safe = model.replace(/[^a-z0-9-]/gi, "-");
  const files = readdirSync(RUNS_DIR).filter((f) => f.startsWith(`screen-${safe}-`) || f.startsWith(`screen-${model}-`));
  if (!files.length) throw new Error(`no screen-${model} dump in ${RUNS_DIR} — run without --no-run first`);
  const picked = files.sort().slice(-count).map((f) => path.join(RUNS_DIR, f));
  if (after && statSync(picked.at(-1)).mtimeMs < after) {
    throw new Error(`the run produced no new dump for ${model} (newest is from before this run) — the run failed; not scoring a stale dump`);
  }
  if (picked.length < count) {
    throw new Error(`asked for ${count} seeds but only ${picked.length} dump(s) exist for ${model}`);
  }
  return picked;
}

const score = (dump) => scoreDump(JSON.parse(readFileSync(dump, "utf8")));

function card(s, latencyMs) {
  const dateStr = new Date().toISOString().slice(0, 10);
  const perTurn = latencyMs ? `${(latencyMs / (10000 * s.n)).toFixed(1)}s/turn (${(latencyMs / 1000).toFixed(0)}s total)` : "— (scored --no-run)";
  const pct = (v) => `${Math.round(v)}%`;
  // With several seeds the spread matters more than the mean: this screen has been seen to swing ~10 points
  // and flip the routing gate between identical runs.
  const spread = s.n > 1 ? `  (${s.n} seeds, objective ${s.objMin}–${s.objMax})` : "  (1 seed — directional only)";
  return `## ${model} — screened ${dateStr}
TIER: ${s.tier}   |   objective ${s.objective}/100${spread}

GATES
  uncensored ......... ${s.willingnessPass ? "PASS" : `⚠ REVIEW (${s.refus}/${s.gateDen} narrator-voice refusal markers — confirm in-session)`}
  location routing ... ${s.locGate ? "PASS" : "FAIL"} (${pct(s.locAcc)} correct)  [hard gate]
SCORED
  restraint (no-op) .. ${bar(s.restraint)} ${pct(s.restraint)} of no-op turns stayed empty
  stat direction ..... ${bar(s.statDir)} ${pct(s.statDir)} Vigor↓ on combat/injury
  choices format ..... ${bar(s.format)} ${pct(s.format)} clean option blocks
  prose .............. — (fill in-session: read the dump)
  latency ............ ${perTurn}`;
}

function updateBoard(s) {
  const dateStr = new Date().toISOString().slice(0, 10);
  const board = existsSync(BOARD_JSON) ? JSON.parse(readFileSync(BOARD_JSON, "utf8")) : [];
  const rec = { model, date: dateStr, tier: s.tier, objective: s.objective, seeds: s.n,
    spread: s.n > 1 ? `${s.objMin}–${s.objMax}` : "—",
    restraint: Math.round(s.restraint), statDir: Math.round(s.statDir), format: Math.round(s.format), locAcc: Math.round(s.locAcc), refusals: s.refus };
  const next = board.filter((r) => r.model !== model).concat(rec);
  const rank = (t) => t === "S" ? 0 : t === "A" ? 1 : t === "B" ? 2 : t === "C" ? 3 : 4;
  next.sort((a, b) => rank(a.tier) - rank(b.tier) || b.objective - a.objective);
  writeFileSync(BOARD_JSON, JSON.stringify(next, null, 2), "utf8");
  const rows = next.map((r) => `| ${r.model} | ${r.tier} | ${r.objective} | ${r.spread ?? "—"} | ${r.seeds ?? 1} | ${r.restraint} | ${r.statDir} | ${r.format} | ${r.locAcc}% | ${r.refusals} | ${r.date} |`).join("\n");
  const md = `# Model screen leaderboard

Auto-generated by \`npm run screen -- --model <label>\` (gate world, shipped default prompts). Objective score
weights restraint 35 / stat-direction 30 / choices-format 35. Location routing is the one hard gate; refusal
markers are a ⚠ review flag (confirm in-session). Prose is judged separately in-session.

**Read the spread, not just the mean.** Identical back-to-back runs have swung a model's objective by ~10
points and even flipped the routing gate, so a 1-seed row is directional only. Multi-seed rows come from
\`npm run baseline -- --profile screen --model <label> --repeat 3\` then \`npm run screen -- --model <label>
--seeds 3 --no-run\`. Restraint reads ~0 for every model — that axis is mis-calibrated against the shipped
prompt arm; don't act on it. Method: [GATE-PROBE.md](GATE-PROBE.md).

| Model | Tier | Obj | Spread | Seeds | Restraint | StatDir | Format | LocAcc | Refusals | Screened |
|---|---|---|---|---|---|---|---|---|---|---|
${rows}
`;
  writeFileSync(BOARD_MD, md, "utf8");
}

const runStart = Date.now();
const latencyMs = fileArg || noRun ? null : await runBaseline();
const dumps = fileArg ? [path.resolve(fileArg)] : newestDumps(latencyMs === null ? 0 : runStart, seeds);
const s = aggregateScores(dumps.map(score));
console.log("\n" + card(s, latencyMs) + "\n");
updateBoard(s);
console.log(`→ leaderboard updated: ${path.relative(REPO_ROOT, BOARD_MD)}`);
