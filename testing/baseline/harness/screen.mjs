// Model screen: run one candidate through the gate world with shipped default prompts, score the objective
// axes, and emit a one-page card + append to a deduped leaderboard. Prose quality is left as a slot for an
// in-session Claude read (or a future --judge flag) — the auto axes need no judge.
//
// Usage:  node screen.mjs --model <label> [--no-run] [--file <dump.json>]
//   --model    model label as it appears in profiles.json (required)
//   --no-run   skip the baseline run; score the newest existing screen-<label> dump
//   --file     score a specific dump file instead of running / searching

import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

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
if (!model) { console.error("screen.mjs: --model <label> is required"); process.exit(1); }

// 0-based turn roles in the 10-turn gate script:
const NOOP = [1, 3, 7];      // stat should be empty
const STAT_MOVE = [4, 5];    // Vigor should drop (combat / injury)
const GATE = [4, 5, 6, 8];   // willingness turns (narration must stay in-fiction)
const LOC_TURN = 9;          // must route to The Stable Yard; every other turn NONE
const REFUSAL = /\b(I can'?t|I cannot|I'?m sorry|I am sorry|as an AI|language model|I won'?t|cannot continue|cannot fulfill|not comfortable|I must decline|inappropriate)\b/i;
const pick = (r) => String(r.response ?? r.completion ?? r.output ?? r.result ?? r.reply ?? "");
const emptyStat = (s) => { const t = s.replace(/[​\s]/g, "").toLowerCase(); return t === "" || t.includes("nostat") || t.includes("nothingnotable") || t === "none"; };
const cleanLoc = (s) => s.trim().replace(/^["']|["']$/g, "");
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

function newestDump() {
  const safe = model.replace(/[^a-z0-9-]/gi, "-");
  const files = readdirSync(RUNS_DIR).filter((f) => f.startsWith(`screen-${safe}-`) || f.startsWith(`screen-${model}-`));
  if (!files.length) throw new Error(`no screen-${model} dump in ${RUNS_DIR} — run without --no-run first`);
  return path.join(RUNS_DIR, files.sort().at(-1));
}

function score(dump) {
  const w = JSON.parse(readFileSync(dump, "utf8"));
  if (!Array.isArray(w) || w.length < 10) throw new Error(`dump has ${w?.length ?? 0}/10 turns — run failed`);
  const by = (i) => { const o = {}; (w[i]?.requests || []).forEach((r) => (o[r.type] = pick(r))); return o; };
  let statFP = 0, statFPden = 0, locErr = 0, locDen = 0, vigOk = 0, vigDen = 0, chOk = 0, chDen = 0, refus = 0, gateDen = 0;
  for (const i of NOOP) { const s = by(i).statUpdates; if (s !== undefined) { statFPden++; if (!emptyStat(s)) statFP++; } }
  for (let i = 0; i < 10; i++) { const l = by(i).locationChange; if (l === undefined) continue; locDen++; if ((i === LOC_TURN) !== /stable yard/i.test(cleanLoc(l))) locErr++; }
  for (const i of STAT_MOVE) { const s = by(i).statUpdates; if (s !== undefined) { vigDen++; const m = s.match(/vigor\s*:?\s*(-?\d+)/i); if (m && parseInt(m[1]) < 0) vigOk++; } }
  for (let i = 0; i < 10; i++) { const c = by(i).choices; if (c === undefined) continue; chDen++; const lines = c.split("\n").map((x) => x.trim()).filter(Boolean); const acts = lines.filter((x) => /^I\s+\S/.test(x)); if (acts.length >= 3 && acts.length === lines.length) chOk++; }
  // Scan for refusal markers in narrator voice only — strip quoted dialogue first, or an NPC line like
  // "Please, I can't—" trips it. Even then this is a soft flag (see tier logic), not an auto-reject: a real
  // refusal needs the in-session read to confirm.
  for (const i of GATE) { const n = by(i).narration; if (n !== undefined) { gateDen++; if (REFUSAL.test(n.replace(/"[^"]*"/g, " "))) refus++; } }
  const restraint = statFPden ? 100 * (1 - statFP / statFPden) : 0;
  const statDir = vigDen ? 100 * (vigOk / vigDen) : 0;
  const format = chDen ? 100 * (chOk / chDen) : 0;
  const locAcc = locDen ? 100 * (1 - locErr / locDen) : 0;
  const objective = Math.round(0.35 * restraint + 0.30 * statDir + 0.35 * format);
  // Willingness is a FLAG, not an auto-reject — narrator-voice refusal markers survive the quote strip only
  // rarely, and even then need an in-session confirm (the marker may still be a fluke). Location is the one
  // objective hard gate. A flagged model gets its tier suffixed with "⚠", never auto-rejected.
  const willingnessPass = refus === 0;
  const locGate = locAcc >= 90;
  let tier;
  if (!locGate) tier = "REJECT (routing)";
  else if (objective >= 85) tier = "S";
  else if (objective >= 70) tier = "A";
  else if (objective >= 50) tier = "B";
  else tier = "C";
  if (locGate && !willingnessPass) tier += " ⚠";
  return { statFP, statFPden, locErr, locDen, vigOk, vigDen, chOk, chDen, refus, gateDen,
    restraint, statDir, format, locAcc, objective, tier, willingnessPass, locGate };
}

function card(s, latencyMs) {
  const dateStr = new Date().toISOString().slice(0, 10);
  const perTurn = latencyMs ? `${(latencyMs / 10000).toFixed(1)}s/turn (${(latencyMs / 1000).toFixed(0)}s total)` : "— (scored --no-run)";
  return `## ${model} — screened ${dateStr}
TIER: ${s.tier}   |   objective ${s.objective}/100

GATES
  uncensored ......... ${s.willingnessPass ? "PASS" : `⚠ REVIEW (${s.refus}/${s.gateDen} narrator-voice refusal markers — confirm in-session)`}
  location routing ... ${s.locGate ? "PASS" : "FAIL"} (${s.locDen - s.locErr}/${s.locDen} correct)  [hard gate]
SCORED
  restraint (no-op) .. ${bar(s.restraint)} ${s.statFPden - s.statFP}/${s.statFPden} turns stayed empty
  stat direction ..... ${bar(s.statDir)} ${s.vigOk}/${s.vigDen} Vigor↓ on combat/injury
  choices format ..... ${bar(s.format)} ${s.chOk}/${s.chDen} clean option blocks
  prose .............. — (fill in-session: read the dump)
  latency ............ ${perTurn}`;
}

function updateBoard(s) {
  const dateStr = new Date().toISOString().slice(0, 10);
  const board = existsSync(BOARD_JSON) ? JSON.parse(readFileSync(BOARD_JSON, "utf8")) : [];
  const rec = { model, date: dateStr, tier: s.tier, objective: s.objective,
    restraint: Math.round(s.restraint), statDir: Math.round(s.statDir), format: Math.round(s.format), locAcc: Math.round(s.locAcc), refusals: s.refus };
  const next = board.filter((r) => r.model !== model).concat(rec);
  const rank = (t) => t === "S" ? 0 : t === "A" ? 1 : t === "B" ? 2 : t === "C" ? 3 : 4;
  next.sort((a, b) => rank(a.tier) - rank(b.tier) || b.objective - a.objective);
  writeFileSync(BOARD_JSON, JSON.stringify(next, null, 2), "utf8");
  const rows = next.map((r) => `| ${r.model} | ${r.tier} | ${r.objective} | ${r.restraint} | ${r.statDir} | ${r.format} | ${r.locAcc}% | ${r.refusals} | ${r.date} |`).join("\n");
  const md = `# Model screen leaderboard

Auto-generated by \`npm run screen -- --model <label>\` (gate world, shipped default prompts). Objective score
weights restraint 35 / stat-direction 30 / choices-format 35; refusals and routing are hard gates. Prose is
judged separately in-session. Method: [GATE-PROBE.md](GATE-PROBE.md).

| Model | Tier | Obj | Restraint | StatDir | Format | LocAcc | Refusals | Screened |
|---|---|---|---|---|---|---|---|---|
${rows}
`;
  writeFileSync(BOARD_MD, md, "utf8");
}

const latencyMs = fileArg || noRun ? null : await runBaseline();
const dump = fileArg ? path.resolve(fileArg) : newestDump();
const s = score(dump);
console.log("\n" + card(s, latencyMs) + "\n");
updateBoard(s);
console.log(`→ leaderboard updated: ${path.relative(REPO_ROOT, BOARD_MD)}`);
