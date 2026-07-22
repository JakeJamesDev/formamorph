// Digest-framing probe — narration-length collapse mechanism.
//
// A Profile Q run showed narration collapsing from ~140 to ~40-60 words/turn once milestone digests
// dominate the history: digests ride as user/assistant pairs, so the model sees many short "own"
// responses and imitates their length. This probe replays a REAL collapsed turn's context (turn 18
// of a Q run dump: 9 one-liner digest pairs + 4 full turns + a question action) in three shapes:
//
//   A  paired    — the dump's messages verbatim (today's shape; reproduces the collapse)
//   B  grouped   — digest pairs merged into ONE assistant block after the first user action
//                  (grouping without reframing)
//   C  recap     — user "Recap the story so far." + the same merged block as the reply
//                  (recap-question framing: short style attributed to a different task)
//
// Same digest content in all arms; the only variable is message shape. Measures response length
// (the collapse signal) plus quoted dialogue (the T18 failure also dropped the NPC's answer).
//
// Usage: node digest-framing-probe.mjs --endpoint <url> --model <id> [--runs 5] [--only A|B|C]
//        [--dump ../runs/<Q-run>.json] [--turn 18]

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const argVal = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const ENDPOINT = argVal("--endpoint", "https://api.lyonade.net/v1/chat/completions");
const MODEL = argVal("--model", "default");
const RUNS = parseInt(argVal("--runs", "5"), 10);
const ONLY = argVal("--only", null);
const DUMP = argVal("--dump", path.join(HARNESS_DIR, "../runs/Q-gemma4-e4b-cloud-2026-07-22T12-00-31-834Z.json"));
const TURN = parseInt(argVal("--turn", "18"), 10);

const words = (s) => s.split(/\s+/).filter(Boolean).length;

// --- build the three arms from the real dump ---
const dump = JSON.parse(await readFile(DUMP, "utf8"));
const base = dump[TURN - 1]?.requests?.find((r) => r.type === "narration")?.messages;
if (!base) throw new Error(`no narration request at turn ${TURN} in ${DUMP}`);

// Split history into digest pairs vs full turns: a digest is an assistant message under 60 words.
// base = [system, u,a, u,a, ..., finalUser]
const system = base[0];
const finalUser = base[base.length - 1];
const pairs = [];
for (let i = 1; i + 1 < base.length; i += 2) pairs.push({ user: base[i], assistant: base[i + 1] });
const firstFull = pairs.findIndex((p) => words(p.assistant.content) >= 60);
if (firstFull < 1) throw new Error("context shape unexpected: no digest region / no full turns");
const digestPairs = pairs.slice(0, firstFull);
const fullPairs = pairs.slice(firstFull);
const mergedRecap = digestPairs.map((p) => p.assistant.content.trim()).join(" ");
console.log(`base: turn ${TURN}, ${digestPairs.length} digest pairs + ${fullPairs.length} full turns; merged recap ${words(mergedRecap)}w`);
console.log(`final action: ${finalUser.content.split("\n")[0]}`);

const flat = (ps) => ps.flatMap((p) => [p.user, p.assistant]);
const ARMS = {
  A: [system, ...flat(digestPairs), ...flat(fullPairs), finalUser],
  B: [system, digestPairs[0].user, { role: "assistant", content: mergedRecap }, ...flat(fullPairs), finalUser],
  C: [system, { role: "user", content: "Recap the story so far." }, { role: "assistant", content: mergedRecap }, ...flat(fullPairs), finalUser],
};

// --- run ---
// Narration is sampler-unpinned: send no temperature so the endpoint default applies (matches the app).
async function complete(messages) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, messages, max_tokens: 600, stream: false, reasoning_effort: "none" }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const j = await res.json();
  return (j.choices?.[0]?.message?.content ?? "").trim();
}

await complete([{ role: "user", content: "ping" }]).catch(() => {}); // warm-up

const summary = [];
for (const [arm, messages] of Object.entries(ARMS)) {
  if (ONLY && arm !== ONLY) continue;
  const rows = [];
  for (let r = 0; r < RUNS; r++) {
    const out = await complete(messages);
    rows.push({
      words: words(out),
      sentences: out.split(/(?<=[.!?…])\s+/).filter(Boolean).length,
      dialogue: /"/.test(out),
      short: words(out) < 80,
    });
    console.log(`  ${arm} run ${r + 1}: ${rows[r].words}w ${rows[r].sentences}s dialogue=${rows[r].dialogue}`);
  }
  const mean = (k) => Math.round(rows.reduce((s, x) => s + x[k], 0) / rows.length);
  summary.push({
    arm,
    meanWords: mean("words"),
    minWords: Math.min(...rows.map((x) => x.words)),
    maxWords: Math.max(...rows.map((x) => x.words)),
    shortRuns: rows.filter((x) => x.short).length + "/" + rows.length,
    dialogueRuns: rows.filter((x) => x.dialogue).length + "/" + rows.length,
  });
}
console.log(`\n== ${MODEL} @ ${ENDPOINT}  (turn ${TURN}, ${RUNS} runs/arm)`);
console.table(summary);
