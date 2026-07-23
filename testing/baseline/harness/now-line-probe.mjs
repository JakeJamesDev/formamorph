// Now-line probe — does a deterministic "where things stand" closing sentence on the recap block fix
// mid-scene anchoring? Replays a REAL turn's narration context from a session dump, in two arms:
//   A  shipped   — the recap exchange exactly as dumped
//   B  now-line  — the same recap with the proposed closing line appended (--append)
// Reference failures (close-session.json): turn 7 = full scene reset (model wrote an arrival scene
// over a live conversation); turn 35 = roleplay-frame identity inversion. Outputs are printed for
// judging - the failure modes (re-greeting, arrival framing, who-is-Alice confusion) are semantic.
//
// Usage: node now-line-probe.mjs --dump ../runs/close-session.json --turn 7 --append "<line>" [--runs 5] [--arm A|B]

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const argVal = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const ENDPOINT = argVal("--endpoint", "https://api.lyonade.net/v1/chat/completions");
const MODEL = argVal("--model", "default");
const RUNS = parseInt(argVal("--runs", "5"), 10);
const ONLY = argVal("--arm", null);
const DUMP = argVal("--dump", path.join(HARNESS_DIR, "../runs/close-session.json"));
const TURN = parseInt(argVal("--turn", "7"), 10);
const APPEND = argVal("--append", "");
if (!APPEND) throw new Error("--append <now-line text> is required");

const dump = JSON.parse(await readFile(DUMP, "utf8"));
const base = dump[TURN - 1]?.requests?.find((r) => r.type === "narration")?.messages;
if (!base) throw new Error(`no narration request at turn ${TURN}`);
if (base[1]?.content !== "Recap the story so far.") throw new Error("dump lacks the recap exchange (pre-recap build?)");

const withLine = base.map((m, i) => (i === 2 ? { ...m, content: `${m.content}\n\n${APPEND}` } : m));
const ARMS = { A: base, B: withLine };
console.log(`turn ${TURN} · final action: ${base[base.length - 1].content.split("\n")[0].slice(0, 90)}`);
console.log(`appended line (arm B): ${APPEND}\n`);

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

await complete([{ role: "user", content: "ping" }]).catch(() => {});
for (const [arm, messages] of Object.entries(ARMS)) {
  if (ONLY && arm !== ONLY) continue;
  for (let r = 0; r < RUNS; r++) {
    const out = await complete(messages);
    console.log(`--- ${arm}#${r + 1} (${out.split(/\s+/).length}w)\n${out}\n`);
  }
}
