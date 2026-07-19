// Dump the worst dialogue-collapse case for human reading: for a turn, generate several plans+narrations under
// each template (shipped A / slot B), pick the sample with the FEWEST voiced characters, and print the full
// plan and narration so a person can judge whether "collapse" is real (3 present, 1 talks) or a metric artifact.
//   node spot-collapse.mjs "D:/Downloads/stalled.json" --turn 14 --tries 5

import { readFileSync } from "node:fs";
import { parseArgs, callMessages, grab, parsePlan } from "./planner-probe-lib.mjs";

const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith("--"));
const num = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? Number(argv[i + 1]) : d; };
const opts = parseArgs(process.argv);
const TURN = num("--turn", 14);
const TRIES = num("--tries", 5);

const turns = JSON.parse(readFileSync(file, "utf8"));
const t = turns[TURN];
const think = t.requests.find((r) => r.type === "thinking");
const narr = t.requests.find((r) => r.type === "narration");

const SHIPPED = grab("defaultThinkingPrompt");
function buildSlot() {
  const edits = [
    ["Beats: <two to four sentences of what happens this turn as the scene continues - the physical actions and, in quotation marks, the words the present characters actually speak aloud>",
      "Beats: <two to four sentences of the physical actions and reactions that happen this turn as the scene continues>\nLines:\n- <name> - \"<the words this character speaks aloud this turn>\" (or (silent) if they truly say nothing)"],
    ["- The Beats are what the world and the other characters do and say - their grounded physical reactions and the words they speak aloud, in quotation marks, consistent with the Cast above. Characters present keep speaking as the scene continues; don't reduce them to silent motion. Never write the outcome of the player's own action, their thoughts, or their next move.",
      "- The Beats are the grounded physical actions and reactions that happen this turn - what the world and the characters physically do, consistent with the Cast above. Never write the outcome of the player's own action, their thoughts, or their next move.\n- Lines carries the spoken words: give one entry for each present character who could react this turn, their actual words aloud in quotation marks and in their own voice. Mark a character (silent) only when they genuinely say nothing - a scene with several people present normally has several of them speaking, not one voice carrying it alone."],
    ["- Output exactly one Scene line, one Cast list, and one Beats - no narration, no choices, no stat talk, nothing else.",
      "- Output exactly one Scene line, one Cast list, one Beats, and one Lines list - no narration, no choices, no stat talk, nothing else."],
  ];
  let c = SHIPPED; for (const [f, tt] of edits) c = c.replace(f, tt); return c;
}
const SLOT = buildSlot();
const rerender = (sys, tmpl) => {
  const S = "## Game World", E = "Respond in exactly this format:";
  return tmpl.slice(0, tmpl.indexOf(S)) + sys.slice(sys.indexOf(S), sys.indexOf(E)).trimEnd() + "\n\n" + tmpl.slice(tmpl.indexOf(E));
};
const castNames = (p) => parsePlan(p).cast.split("\n").map((l) => l.replace(/^\s*[-*]\s*/, "").split(" - ")[0].trim())
  .filter((n) => n && !/player character/i.test(n)).map((n) => n.replace(/\s*\(.*$/, "").trim()).filter(Boolean);
function voiced(p) {
  const names = castNames(p), beats = parsePlan(p).beats || p, spk = new Set();
  for (const s of beats.split(/(?<=[.!?])\s+/)) { if (!/"[^"]{2,}"/.test(s)) continue; for (const n of names) { const f = n.split(/\s+/)[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); if (f.length > 1 && new RegExp(`\\b${f}\\b`).test(s)) spk.add(n); } }
  return spk.size;
}

async function worst(tmpl) {
  let best = null;
  for (let r = 0; r < TRIES; r++) {
    const planMsgs = think.messages.map((m) => (m.role === "system" ? { ...m, content: rerender(m.content, tmpl) } : m));
    const plan = (await callMessages({ ...opts, temp: 0.4, repPen: 1, maxTokens: 256, seed: opts.seed + r }, planMsgs)).trim();
    const nmsgs = narr.messages.map((m) => ({ ...m }));
    for (let k = nmsgs.length - 1; k >= 0; k--) { if (nmsgs[k].role !== "user") continue; const at = nmsgs[k].content.indexOf("\nScene:"); if (at >= 0) nmsgs[k].content = nmsgs[k].content.slice(0, at + 1) + plan; break; }
    const text = (await callMessages({ ...opts, temp: 0.7, maxTokens: 512, seed: opts.seed + r }, nmsgs)).trim();
    const v = voiced(plan), present = castNames(plan).length;
    if (!best || v < best.v) best = { plan, text, v, present };
  }
  return best;
}

console.log(`WORST COLLAPSE · turn ${TURN} · action: ${(t.action || "").slice(0, 90)}\n(${TRIES} tries each, showing the fewest-voiced sample)\n`);
for (const [label, tmpl] of [["A = SHIPPED planner", SHIPPED], ["B = SLOT planner", SLOT]]) {
  const w = await worst(tmpl);
  console.log(`\n${"#".repeat(88)}\n${label} — present ${w.present}, voiced ${w.v}\n${"#".repeat(88)}`);
  console.log(`\n--- PLAN ---\n${w.plan}`);
  console.log(`\n--- NARRATION ---\n${w.text}`);
}
