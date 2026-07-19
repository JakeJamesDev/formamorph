// Spot-check: for a few turns, generate a cast-plan narration and show which durable facts the fact-retention
// judge scored dropped, alongside the full text and the recorded narration — so a human can tell REAL fact loss
// from valid plan divergence (the metric can't).
//   node spot-castplan.mjs "D:/Downloads/stalled.json" --turns 8,13,15 [--runs 1]

import { readFileSync } from "node:fs";
import { parseArgs, callMessages, grab } from "./planner-probe-lib.mjs";

const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith("--"));
const strArg = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const opts = parseArgs(process.argv);
const TURNS = strArg("--turns", "8,13,15").split(",").map(Number);
const RUNS = Number(strArg("--runs", "1"));

const turns = JSON.parse(readFileSync(file, "utf8"));
const req = (t, ty) => t.requests?.find((r) => r.type === ty);

// Casting candidate = shipped planner + the 2 edits (kept in sync with narration-format-probe).
const THINK = grab("defaultThinkingPrompt");
const CAND = (() => {
  const edits = [
    ["the words the present characters actually speak aloud>",
      "a spoken line from each present character who is engaged, so the scene is carried by their voices>"],
    ["their grounded physical reactions and the words they speak aloud, in quotation marks, consistent with the Cast above. Characters present keep speaking as the scene continues; don't reduce them to silent motion.",
      "their grounded physical reactions and, in quotation marks, the words they speak aloud, consistent with the Cast above. When more than one character is present and engaged, give each of them a spoken line of their own this turn, in their own voice - the scene runs on several people talking, not narration around one speaker. End the Beats on something happening - a character's action or line that carries the scene forward on its own momentum."],
  ];
  let c = THINK; for (const [f, t] of edits) { if (!c.includes(f)) throw new Error("edit target missing"); c = c.replace(f, t); }
  return c;
})();
function rerenderPlanner(sys) {
  const S = "## Game World", E = "Respond in exactly this format:";
  return CAND.slice(0, CAND.indexOf(S)) + sys.slice(sys.indexOf(S), sys.indexOf(E)).trimEnd() + "\n\n" + CAND.slice(CAND.indexOf(E));
}
async function castNarr(t, seed) {
  const th = req(t, "thinking"), nr = req(t, "narration");
  const planMsgs = th.messages.map((m) => (m.role === "system" ? { ...m, content: rerenderPlanner(m.content) } : m));
  const plan = (await callMessages({ ...opts, temp: 0.4, repPen: 1, maxTokens: 256, seed }, planMsgs)).trim();
  const nmsgs = nr.messages.map((m) => ({ ...m }));
  for (let k = nmsgs.length - 1; k >= 0; k--) { if (nmsgs[k].role !== "user") continue; const at = nmsgs[k].content.indexOf("\nScene:"); if (at >= 0) nmsgs[k].content = nmsgs[k].content.slice(0, at + 1) + plan; break; }
  const text = await callMessages({ ...opts, temp: 0.7, maxTokens: 512, seed }, nmsgs);
  return { plan, text };
}

const EXTRACT_SYS = `You extract the durable facts a passage of a story establishes, for a memory system. List 3 to 6 concrete, checkable [state] facts (a decision, admission, revealed trait, position, relationship shift, object, or commitment) - most important first, only what the passage explicitly states. Format each line: [state] <fact>. Nothing else.`;
const JUDGE_SYS = `You check whether a passage preserves a list of facts. It preserves a fact if it conveys the same thing, explicitly or by clear implication - same words not required. For each numbered fact reply on its own line "<n>: yes" or "<n>: no". Only those lines.`;
async function extract(text) {
  const o = await callMessages({ ...opts, temp: 0, maxTokens: 240 }, [{ role: "system", content: EXTRACT_SYS }, { role: "user", content: text }]);
  return o.split("\n").map((l) => l.replace(/^\[state\]\s*/i, "").trim()).filter((l) => l && !/^\[/.test(l));
}
async function judge(facts, text) {
  const list = facts.map((f, i) => `${i + 1}. ${f}`).join("\n");
  const o = await callMessages({ ...opts, temp: 0, maxTokens: 200 }, [{ role: "system", content: JUDGE_SYS }, { role: "user", content: `Facts:\n${list}\n\nPassage:\n${text}` }]);
  const yes = new Set(); for (const m of o.matchAll(/(\d+)\s*:\s*(yes|no)/gi)) if (/yes/i.test(m[2])) yes.add(Number(m[1]));
  return facts.map((f, i) => ({ f, kept: yes.has(i + 1) }));
}

for (const i of TURNS) {
  const t = turns[i];
  const recorded = (req(t, "narration")?.response || "").trim();
  const facts = await extract(recorded);
  console.log(`\n${"=".repeat(90)}\nTURN ${i} · action: ${(t.action || "").slice(0, 80)}`);
  for (let r = 0; r < RUNS; r++) {
    const { text } = await castNarr(t, opts.seed + r);
    const verdict = await judge(facts, text);
    console.log(`\n-- run ${r} · durable facts (from RECORDED narration) --`);
    verdict.forEach(({ f, kept }) => console.log(`   ${kept ? "KEPT " : "DROP "} ${f}`));
    console.log(`\n-- CASTPLAN narration --\n${text.trim()}`);
  }
  console.log(`\n-- RECORDED narration (reference) --\n${recorded.slice(0, 900)}${recorded.length > 900 ? " …" : ""}`);
}
