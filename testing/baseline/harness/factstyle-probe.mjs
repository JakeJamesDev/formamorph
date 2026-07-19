// FACT-ADHERENCE STYLE probe — does the XML prompt preset help a model USE the context it's given
// (facts, names, positions, relationships, counts) better than the Default (Markdown) preset? Same
// scenario, same seeds, same model; section style is the ONLY variable.
//
// Faithful assembly: chip bodies rendered through the REAL context builders in each format, headings
// wrapped by the REAL `restyle` (fill-then-restyle, exactly like GameViewer). Two surfaces:
//   planner    — defaultThinkingPrompt (Scene/Cast/Beats). Tests cast fidelity + name-reveal discipline.
//   narration  — defaultSystemPrompt (the main story prose). Tests fact adherence + name-spoiler restraint.
//
// NOT auto-graded on quality: this dumps every full output (paired md|xml per seed) to a run file so a
// human judges adherence. Light auto-flags only flag mechanical red flags to speed the read.
//
//   node_modules/.bin/vite-node testing/baseline/harness/factstyle-probe.mjs -- --model cydonia-24b-v4.3@q4_k_m --runs 3
//
// The scenario (ground truth the output is judged against):
//   • Toll is THREE copper per head. Skiff tied at the THIRD piling. Lantern on a hooked post. Fog.
//   • Maera — ferrywoman, age 44, TWO fingers missing left hand, iron-shod pole. NAME ALREADY HEARD.
//   • Corwin — the hooded traveler on a crate, wrapped bundle on his knees. Maera's YOUNGER BROTHER.
//     NAME NOT HEARD → planner must render "Corwin (the hooded traveler)"; narration must NOT print "Corwin".
//   • Deggan (halberd) + Rulf (ledger) — TWO Vael toll-guards. Names NOT heard. Count must stay 2.
//   • Player acts on Maera + the hooded traveler only → the two guards must NOT be dropped from the Cast.

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { restyle } from "@/lib/sectionStyle";
import { buildLocationContext, buildEntityContext } from "@/lib/locationContext";
import { buildTraitContext } from "@/lib/traitTree";
import { buildStatContext } from "@/lib/statContext";
import { parseArgs, grab, buildThinkingUser, callMessages, parsePlan } from "./planner-probe-lib.mjs";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const opts = parseArgs(process.argv, { runs: "3" });
const RUNS = Math.max(1, opts.runs);
const STYLES = ["markdown", "xml"];

// ── Scenario ──────────────────────────────────────────────────────────────────────────────────────────
const WORLD = "A grim medieval kingdom of river crossings and toll roads. Grounded, low-magic; people are wary of strangers and coin is scarce.";
const TRAITS = [{ id: "identity", name: "Identity", aiDescription: "You are Aldric, a road-worn courier carrying a sealed letter for the Vael magistrate.", groupId: null, order: 0 }];
const STATS = [
  { name: "Coin", value: 4, min: 0, max: 20, description: "Money on hand.", descriptors: [{ threshold: 25, description: "nearly broke" }, { threshold: 100, description: "getting by" }] },
  { name: "Resolve", value: 70, min: 0, max: 100, description: "Composure under pressure.", descriptors: [{ threshold: 40, description: "shaken" }, { threshold: 100, description: "steady" }] },
];
const STAT_PIECES = { values: true, status: true, meaning: true };
const LOCATION = {
  name: "Blackreed ferry landing",
  entities: ["maera", "corwin", "deggan", "rulf"],
  aiSummary: "The Blackreed ferry dock on the Vael's east bank; fog, a lantern on a hooked post, a skiff at the third piling, a toll box (three copper per head).",
  aiDescription: "A short wooden dock on the east bank of the River Vael, wreathed in cold river fog. A single lantern hangs from a hooked post at the dock's head. A flat-bottomed ferry skiff is tied at the third piling. A toll box is nailed to the dock rail; the posted crossing toll is three copper per head.",
};
const ENTITIES = [
  { id: "maera", name: "Maera", type: "Person", aiSummary: "Ferrywoman of Blackreed; two fingers missing on her left hand; leans on an iron-shod pole. Name already heard.", aiDescription: "The ferrywoman of Blackreed crossing, age 44. The last two fingers of her left hand are missing from an old rope accident; she leans on a long iron-shod pole. She is the older sister of the hooded traveler Corwin. She has already told the player her name." },
  { id: "corwin", name: "Corwin", type: "Person", aiSummary: "A hooded traveler on a crate with a wrapped bundle; Maera's younger brother. The player has NOT heard his name.", aiDescription: "A hooded traveler waiting for the ferry, age 38. A long cloth-wrapped bundle rests across his knees and he keeps one hand on it. He is Maera the ferrywoman's younger brother. The player has NOT heard his name and knows him only as the hooded traveler." },
  { id: "deggan", name: "Deggan", type: "Person", aiSummary: "A Vael toll-guard in a green tabard, leaning on a halberd. Name not heard.", aiDescription: "A toll-guard of Vael in a green tabard, posted at the toll box, leaning on a halberd. The player has not heard his name." },
  { id: "rulf", name: "Rulf", type: "Person", aiSummary: "A Vael toll-guard in a green tabard, thumbing a leather ledger. Name not heard.", aiDescription: "A toll-guard of Vael in a green tabard, posted at the toll box, thumbing a leather ledger. The player has not heard his name." },
];
const RECAP = "Your boots find the last plank of the Blackreed dock as the ferry noses in out of the fog. The ferrywoman plants her iron-shod pole and steps half onto the boards. \"Maera,\" she says, tapping her chest with a hand short its last two fingers. \"Three copper the crossing, same as always.\" Behind her a hooded traveler sits on an upturned crate, a long wrapped bundle across his knees, and says nothing. At the toll box by the rail, two green-tabarded guards of Vael watch you come — one leaning on a halberd, the other thumbing a ledger. The lantern on its hooked post throws a wet circle of light over the whole dock.";
const ACTION = "I drop three copper into the toll box, then turn to the hooded traveler and ask where he's bound.";

const HIDDEN_NAMES = ["Corwin", "Deggan", "Rulf"];

// ── Prompt templates (raw; strip CR so restyle's line-anchored header regex matches the in-app LF text) ──
const clean = (s) => grab(s).replace(/\r/g, "");
const THINK = clean("defaultThinkingPrompt");
const SYS = clean("defaultSystemPrompt");
const MARKDOWN_ON = `## Formatting\n- Write immersive, flowing prose - never a list, menu, or table.\n- Reach for Markdown emphasis where it genuinely lands: **bold** the single most important noun of the moment (a threat, a key object, a revealed name) and *italicize* a sharp inner thought, sound, or stressed word - because the moment earns it, not to fill a quota.`;

function fmtOf(style) { return style === "xml" ? "xml" : "markdown"; }

function plannerSys(style) {
  const fmt = fmtOf(style);
  const filled = THINK
    .replaceAll("<WORLD DESCRIPTION>", WORLD)
    .replaceAll("<TRAITS DESCRIPTION|markdown>", buildTraitContext(TRAITS.map((t) => t.id), TRAITS, [], fmt))
    .replaceAll("<LOCATION|summary.markdown>", buildLocationContext(LOCATION, { preferSummary: true, format: fmt }))
    .replaceAll("<LOCATION|sublocations.summary.markdown>", "N/A")
    .replaceAll("<LOCATION|reachable.summary.markdown>", "N/A")
    .replaceAll("<ENTITIES|summary.markdown>", buildEntityContext(LOCATION, ENTITIES, { preferSummary: true, format: fmt }))
    .replaceAll("<ENTITIES|sublocations.summary.markdown>", "N/A")
    .replaceAll("<ENTITIES|reachable.summary.markdown>", "N/A")
    .replaceAll("<NOTES>", "None");
  return restyle(filled, style);
}

function narrationSys(style) {
  const fmt = fmtOf(style);
  const filled = SYS
    .replaceAll("<LENGTH GUIDANCE>", "Aim for two to four tight paragraphs; land the moment and stop.")
    .replaceAll("<MARKDOWN GUIDANCE>", MARKDOWN_ON)
    .replaceAll("<WORLD DESCRIPTION>", WORLD)
    .replaceAll("<DICTIONARY|before>", "N/A")
    .replaceAll("<STATS DESCRIPTION|descriptions.markdown>", buildStatContext(STATS, STAT_PIECES, fmt))
    .replaceAll("<TRAITS DESCRIPTION|markdown>", buildTraitContext(TRAITS.map((t) => t.id), TRAITS, [], fmt))
    .replaceAll("<NOTES>", "None")
    .replaceAll("<LOCATION|markdown>", buildLocationContext(LOCATION, { preferSummary: false, format: fmt }))
    .replaceAll("<LOCATION|sublocations.summary.markdown>", "N/A")
    .replaceAll("<LOCATION|reachable.summary.markdown>", "N/A")
    .replaceAll("<ENTITIES|markdown>", buildEntityContext(LOCATION, ENTITIES, { preferSummary: false, format: fmt }))
    .replaceAll("<ENTITIES|sublocations.markdown>", "N/A")
    .replaceAll("<ENTITIES|reachable.summary.markdown>", "N/A")
    .replaceAll("<DICTIONARY>", "N/A");
  return restyle(filled, style);
}

// ── Light mechanical flags (aids, not verdicts) ──
function narrationFlags(text) {
  const f = [];
  for (const n of HIDDEN_NAMES) if (new RegExp(`\\b${n}\\b`).test(text)) f.push(`NAME-SPOILER:${n}`);
  if (/\b(what (do|would|will) you|choose one|your options?|options?:|pick one)\b/i.test(text)) f.push("OFFERS-CHOICES");
  if (/(^|\n)\s*[-*]?\s*(coin|resolve|hp|stat)\s*:?\s*[+-]?\d/i.test(text)) f.push("STAT-TABULATION");
  if (!/\byou\b|\byour\b/i.test(text)) f.push("NO-2ND-PERSON");
  return f;
}
function plannerFlags(text) {
  const f = [];
  const cast = parsePlan(text).cast;
  const lines = cast.split("\n").filter((l) => /^\s*[-*]/.test(l)).length;
  // Expect 5 cast lines: Player + Maera + hooded traveler + 2 guards. Fewer = someone dropped.
  if (lines && lines < 5) f.push(`CAST-THIN:${lines}/5`);
  // Hidden name printed WITHOUT a parenthetical alias next to it = a reveal leak.
  for (const n of HIDDEN_NAMES) {
    const re = new RegExp(`\\b${n}\\b(?![^\\n]*\\()`, "");
    if (re.test(cast)) f.push(`NAME-LEAK:${n}`);
  }
  return f;
}

// ── Run ──
let calls = 0;
const call = (args, msgs) => { calls++; return callMessages(args, msgs); };
const t0 = Date.now();
const dump = [];
const line = (s = "") => { dump.push(s); };

console.log(`FACT-ADHERENCE STYLE · "${opts.model}" · runs ${RUNS} · markdown vs xml\n`);
line(`FACT-ADHERENCE STYLE PROBE · model "${opts.model}" · runs ${RUNS} · ${new Date().toISOString()}`);
line(`Scenario ground truth: toll 3 copper · skiff at 3rd piling · Maera (named, 2 fingers) · hooded traveler=Corwin (HIDDEN, Maera's brother) · 2 guards Deggan/Rulf (HIDDEN)`);
line(`Action: ${ACTION}\n`);

// warm-up (load the model once)
await call({ ...opts, maxTokens: 8, temp: 0.4, seed: opts.seed }, [{ role: "user", content: "hi" }]).catch(() => {});

const tally = { planner: { markdown: 0, xml: 0 }, narration: { markdown: 0, xml: 0 } };

for (let r = 0; r < RUNS; r++) {
  const seed = opts.seed + r;
  for (const surface of ["planner", "narration"]) {
    for (const style of STYLES) {
      let out = "", flags = [];
      if (surface === "planner") {
        const sys = plannerSys(style);
        out = await call({ ...opts, maxTokens: 320, temp: 0.4, seed }, [
          { role: "system", content: sys },
          { role: "user", content: buildThinkingUser(RECAP, ACTION) },
        ]);
        flags = plannerFlags(out);
      } else {
        const sys = narrationSys(style);
        out = await call({ ...opts, maxTokens: 420, temp: 0.7, seed }, [
          { role: "system", content: sys },
          { role: "assistant", content: RECAP },
          { role: "user", content: `Player action: ${ACTION}` },
        ]);
        flags = narrationFlags(out);
      }
      if (flags.length) tally[surface][style]++;
      const tag = flags.length ? "⚠ " + flags.join(",") : "✓ clean";
      console.log(`seed ${seed} · ${surface.padEnd(9)} · ${style.padEnd(8)} · ${tag}`);
      line(`\n${"=".repeat(90)}`);
      line(`SEED ${seed} · ${surface.toUpperCase()} · ${style.toUpperCase()} · ${tag}`);
      line("=".repeat(90));
      line(out);
    }
  }
}

const mins = ((Date.now() - t0) / 60000).toFixed(1);
console.log(`\nmechanical red-flag counts (lower = better; NOT the whole story — read the dump):`);
for (const s of ["planner", "narration"]) console.log(`  ${s.padEnd(9)}  markdown ${tally[s].markdown}/${RUNS}   xml ${tally[s].xml}/${RUNS}`);

await mkdir(path.join(HARNESS_DIR, "../runs"), { recursive: true });
const outfile = path.join(HARNESS_DIR, `../runs/factstyle-${opts.model.replace(/[^\w.-]/g, "_")}-${Date.now()}.txt`);
await writeFile(outfile, dump.join("\n"), "utf8");
console.log(`\n(${calls} model calls · ${mins} min)\nfull paired dump → ${path.relative(process.cwd(), outfile)}`);
