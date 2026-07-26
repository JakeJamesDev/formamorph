// NOTES-DUPLICATION probe — the player's standing notes reach the narration TWICE: once as the system
// prompt's `## Important Player Notes` section, once as a clause in the recap's now-line. The second copy
// was never measured; it was inherited from the hardcoded now-line. This asks whether it earns its place.
//
// Three arms, replaying real narration turns from a session dump whose notes carry a load-bearing frame
// fact ("Sarah and I are roleplaying. Sarah is pretending to be Alice." — forgetting it is exactly the
// roleplay-identity-inversion failure the now-line was built to fix):
//   A  both      system section + now-line clause (what ships today)
//   B  system    system section only (now-line clause dropped)
//   C  nowline   now-line clause only (system section blanked to N/A)
//
// The now-line is synthesized here rather than read from the dump — the dump predates it, same as
// now-line-probe.mjs does with --append.
//
// Scored by a judge (the fact-retention-probe pattern): per generated passage, does it CONTRADICT the
// note, merely stay CONSISTENT with it, or never touch it? Headline is contradiction rate; the
// "engaged" rate (passages that actually act on the note) is the diagnostic that separates "obeys" from
// "never came up". Word count rides along as the regression check.
//
//   node notes-duplication-probe.mjs --runs 3
//   node notes-duplication-probe.mjs --endpoint https://api.lyonade.net/v1/chat/completions --model default --runs 6

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, callMessages } from "./planner-probe-lib.mjs";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const argVal = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const DUMP = argVal("--dump", path.join(HARNESS_DIR, "../runs/close-session.json"));
const TURNS = Number(argVal("--turns", "6"));
const ONLY = argVal("--arm", null);
const VERBOSE = args.includes("--verbose");
// The judge always runs on the free cloud endpoint, so scoring stays identical across generation tiers.
const JUDGE = { endpoint: "https://api.lyonade.net/v1/chat/completions", model: "default", token: "" };
const opts = parseArgs(process.argv, { runs: "3" });

const dump = JSON.parse(await readFile(DUMP, "utf8"));
const NOTES_HEAD = "## Important Player Notes";

/** The narration request of a turn, plus its note text and location name, when it carries real notes. */
function usable(turn) {
  const req = turn.requests?.find((r) => r.type === "narration");
  const messages = req?.messages;
  if (!Array.isArray(messages) || messages[1]?.content !== "Recap the story so far.") return null;
  const sys = messages[0]?.content ?? "";
  const note = sys.split(NOTES_HEAD)[1]?.split("\n##")[0]?.trim();
  if (!note || note === "N/A") return null;
  const location = sys.split("## Current Location")[1]?.match(/name:\s*(.+)/)?.[1]?.trim() ?? "here";
  return { messages, note, location };
}

const candidates = dump.map(usable).filter(Boolean);
if (candidates.length === 0) throw new Error("dump carries no notes-bearing narration turn with a recap");
// Evenly spaced across the notes-bearing stretch, so the sample isn't all one scene.
const step = Math.max(1, Math.floor(candidates.length / TURNS));
const cases = Array.from({ length: TURNS }, (_, i) => candidates[i * step]).filter(Boolean);

const NOTE = cases[0].note;
console.log(`${cases.length} turns · note: "${NOTE.replace(/\s+/g, " ").slice(0, 80)}"`);
console.log(`model ${opts.model} · runs ${opts.runs} · judge ${JUDGE.model}\n`);

/** Build one arm's messages: the system section and the now-line clause are switched independently. */
function armMessages({ messages, note, location }, { inSystem, inNowLine }) {
  const out = messages.map((m) => ({ ...m }));
  if (!inSystem) {
    out[0].content = out[0].content.replace(
      new RegExp(`(${NOTES_HEAD}\\n)[\\s\\S]*?(?=\\n##)`),
      `$1N/A\n`,
    );
  }
  const clause = inNowLine ? ` The player's own notes hold true: ${note}` : "";
  out[2].content = `${out[2].content}\n\nNow you are at ${location}; the scene is already underway.${clause}`;
  return out;
}

const ARMS = [
  ["A both   ", { inSystem: true, inNowLine: true }],
  ["B system ", { inSystem: true, inNowLine: false }],
  ["C nowline", { inSystem: false, inNowLine: true }],
];

const JUDGE_SYS = `You check a passage of story prose against a standing note about the story. Reply with exactly one word:
contradicts - the passage states or clearly implies something the note rules out.
engaged - the passage is consistent with the note AND visibly acts on it.
untouched - the passage neither acts on the note nor contradicts it.
Output only that one word.`;

async function judge(passage, note) {
  const out = await callMessages({ ...JUDGE, maxTokens: 6, seed: 7, temp: 0 }, [
    { role: "system", content: JUDGE_SYS },
    { role: "user", content: `Note: ${note}\n\nPassage:\n${passage}` },
  ]);
  const w = out.toLowerCase();
  return w.includes("contradict") ? "contradicts" : w.includes("engaged") ? "engaged" : "untouched";
}

const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : "n/a");

for (const [arm, cfg] of ARMS) {
  if (ONLY && !arm.startsWith(ONLY)) continue;
  const tally = { contradicts: 0, engaged: 0, untouched: 0 };
  let words = 0, n = 0;
  for (const c of cases) {
    for (let r = 0; r < opts.runs; r++) {
      const out = await callMessages({ ...opts, temp: 0.7, maxTokens: 600 }, armMessages(c, cfg));
      const verdict = await judge(out, c.note);
      tally[verdict]++;
      words += out.split(/\s+/).filter(Boolean).length;
      n++;
      if (VERBOSE) console.log(`    ${arm}#${n} ${verdict} (${out.split(/\s+/).length}w)`);
    }
  }
  console.log(`${arm}  contradicts ${pct(tally.contradicts, n)} (${tally.contradicts}/${n}) · engaged ${pct(tally.engaged, n)} · untouched ${pct(tally.untouched, n)} · ${Math.round(words / Math.max(1, n))}w avg`);
}
