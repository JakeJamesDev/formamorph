// NOWLINE-PARENT probe — does naming the containing place in the recap's now-line help, and does the
// wording cost anything? The now-line is prose-like and sits in the highest-recency slot, so the real risk
// is not that the model ignores it but that it PARROTS it back as scene-setting.
//
// Two arms over real test worlds (locations, parents and descriptions are read from the world JSON, never
// invented, so the wording is judged against names authors actually write):
//   A  plain   — "Now you are at X, with … present; the scene is already underway."
//   B  parent  — "Now you are at X, in Y, with … present; …"
//
// Cases split deliberately:
//   * sub-located cases (sedge-landing, mothers-struggles, fantasy-futanari) — the clause fires
//   * CONTROL cases (blackrue-waystation, vane-hollow) — top-level locations, no parent. The two arms are
//     asserted byte-identical without spending a call: most worlds have no hierarchy at all, and the change
//     must be a no-op for them. This is the false-positive guard.
//
// Metrics, per arm:
//   ECHO      the narration restates the now-line as scene-setting ("You are at X, in Y…") — the failure
//             this wording could introduce. Lower is better.
//   MISPLACED the narration puts the scene somewhere other than the stated location. Lower is better.
//   REGION    the narration uses the containing place's name at all — diagnostic, not a score: using it is
//             the point, but a scene that never needs it is not wrong.
//   plus words / dialogue rate as the regression check.
//
// The now-line text comes from the REAL defaultNowLinePrompt and the REAL gameClock/locationContext
// renderers, so editing the prompt is all that is needed between runs.
//
//   node nowline-parent-probe.mjs --runs 3
//   node nowline-parent-probe.mjs --endpoint https://api.lyonade.net/v1/chat/completions --model default --runs 6

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { parseArgs, callMessages, grab } from "./planner-probe-lib.mjs";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HARNESS_DIR, "../../..");
const args = process.argv.slice(2);
const argVal = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const ONLY = argVal("--only", null);
const ARM = argVal("--arm", null);
const VERBOSE = args.includes("--verbose");
const opts = parseArgs(process.argv, { runs: "3" });
// Judged on the free cloud endpoint so scoring is identical whichever tier generated the prose.
const JUDGE = { endpoint: "https://api.lyonade.net/v1/chat/completions", model: "default", token: "" };

// The real template renderer, so the probe assembles the now-line exactly as the app does. Bundled (not
// just transpiled) because promptTemplate pulls in the token grammar and the N/A placeholder.
const load = async (rel) => {
  const out = await build({
    entryPoints: [path.join(REPO_ROOT, rel)],
    bundle: true, format: "esm", write: false, platform: "neutral", logLevel: "silent",
  });
  const code = out.outputFiles[0].text;
  return import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
};
const tpl = await load("src/lib/promptTemplate.ts");

const SYS = grab("defaultSystemPrompt");
const NOW_LINE = grab("defaultNowLinePrompt");
const RECAP = grab("defaultRecapUserPrompt");
const cases = JSON.parse(await readFile(path.join(HARNESS_DIR, "../nowline-parent-cases.json"), "utf8"))
  .filter((c) => !ONLY || c.id === ONLY);

const worldCache = new Map();
async function loadWorld(file) {
  if (!worldCache.has(file)) {
    worldCache.set(file, JSON.parse(await readFile(path.join(HARNESS_DIR, "..", file), "utf8")));
  }
  return worldCache.get(file);
}

/** Resolve a case to the real location record, its parent, and the entities authored there. */
async function resolve(c) {
  const w = await loadWorld(c.world);
  const locs = (w.locations ?? []).filter((l) => l && l.id);
  const loc = c.location ? locs.find((l) => l.name === c.location) : locs.find((l) => !l.parentId);
  if (!loc) throw new Error(`${c.id}: no location "${c.location}" in ${c.world}`);
  const parent = loc.parentId ? locs.find((l) => l.id === loc.parentId) : undefined;
  const entities = (w.entities ?? []).filter((e) => (loc.entities ?? []).includes(e.id));
  return { world: w, loc, parent, entities };
}

const describe = (x) => (x?.aiDescription || x?.description || "").trim();
const renderEntities = (es) =>
  es.length ? es.map((e) => `- **${e.name}**\n  - **description:** ${describe(e)}`).join("\n") : "N/A";

/** The now-line for one arm. Arm A simply withholds the parent value, which is exactly what the app does
 *  at a top-level location — so "no parent" and "arm A" are the same code path, not a special case. */
function nowLineFor({ loc, parent, entities }, withParent) {
  return tpl.renderPromptTemplate(NOW_LINE, {
    "<LOCATION|name>": loc.name,
    "<LOCATION|parent.name>": withParent && parent ? parent.name : "N/A",
    "<ENTITIES|inscene.name>": entities.length ? entities.slice(0, 2).map((e) => e.name).join(", ") : "N/A",
    "<TIME>": "N/A",
  });
}

function messagesFor(r, c, withParent) {
  const sys = SYS
    .replaceAll("<LENGTH GUIDANCE>", "Aim for two to four tight paragraphs; land the moment and stop.")
    .replaceAll("<MARKDOWN GUIDANCE>", "Write plain prose - no headings, lists, or tables.")
    .replaceAll("<WORLD DESCRIPTION>", r.world.systemPrompt || r.world.description || "")
    .replaceAll("<DICTIONARY|before>", "N/A")
    .replaceAll("<STATS DESCRIPTION|descriptions.markdown>", "- **Resolve:** steady")
    .replaceAll("<TRAITS DESCRIPTION|markdown>", "N/A")
    .replaceAll("<NOTES>", "N/A")
    .replaceAll("<LOCATION|markdown>", `- **name:** ${r.loc.name}\n- **description:** ${describe(r.loc)}`)
    .replaceAll("<LOCATION|sublocations.summary.markdown>", "N/A")
    .replaceAll("<LOCATION|reachable.summary.markdown>", "N/A")
    .replaceAll("<ENTITIES|markdown>", renderEntities(r.entities))
    .replaceAll("<ENTITIES|sublocations.markdown>", "N/A")
    .replaceAll("<ENTITIES|reachable.summary.markdown>", "N/A")
    .replaceAll("<DICTIONARY>", "N/A");
  // The band is a stand-in recap: enough for the now-line to have something to close.
  const recap = `You arrived here not long ago and have been getting your bearings.\n\n${nowLineFor(r, withParent)}`;
  return [
    { role: "system", content: sys },
    { role: "user", content: RECAP },
    { role: "assistant", content: recap },
    { role: "user", content: c.action },
  ];
}

const rx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Echo is checked in code, not judged: the question is whether the now-line's own PHRASING reaches the
// page, which is exact. An earlier judge-based version scored every scene that merely named its location —
// i.e. all good narration — as an echo, and was discarded as useless.
function echoes(passage, r) {
  return (
    /now you are at/i.test(passage) ||
    /scene is already underway/i.test(passage) ||
    new RegExp(`${rx(r.loc.name)}\\s*,\\s*in\\s+${rx(r.parent.name)}`, "i").test(passage)
  );
}

const JUDGE_SYS = `You check a passage of story prose against a statement of where the scene takes place. Reply with exactly one word:
misplaced - the passage puts the scene somewhere other than the stated location.
fine - it does not.
Output only that one word.`;

async function judge(passage, where) {
  const out = await callMessages({ ...JUDGE, maxTokens: 6, seed: 7, temp: 0 }, [
    { role: "system", content: JUDGE_SYS },
    { role: "user", content: `Where the scene is: ${where}\n\nPassage:\n${passage}` },
  ]);
  return /misplaced/i.test(out) ? "misplaced" : "fine";
}

const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : "n/a");

// --- control: no model calls needed, the two arms must render identically -----------------------------
const resolved = new Map();
for (const c of cases) resolved.set(c.id, await resolve(c));
const controls = cases.filter((c) => !resolved.get(c.id).parent);
let controlFails = 0;
for (const c of controls) {
  const r = resolved.get(c.id);
  const a = nowLineFor(r, false);
  const b = nowLineFor(r, true);
  const same = a === b;
  if (!same) controlFails++;
  console.log(`CONTROL ${same ? "OK  " : "FAIL"} ${c.id.padEnd(11)} ${same ? "arms identical (no parent)" : `A: ${a}\n                        B: ${b}`}`);
}
console.log(`control: ${controls.length - controlFails}/${controls.length} unchanged — worlds with no hierarchy are untouched\n`);

const live = cases.filter((c) => resolved.get(c.id).parent);
for (const c of live) console.log(`  ${c.id.padEnd(11)} ${nowLineFor(resolved.get(c.id), true)}`);
console.log(`\nmodel ${opts.model} · runs ${opts.runs} · judge ${JUDGE.model}\n`);

await callMessages({ ...opts, temp: 0, maxTokens: 4 }, [{ role: "user", content: "ping" }]).catch(() => {});

for (const [arm, withParent] of [["A plain ", false], ["B parent", true]]) {
  if (ARM && !arm.startsWith(ARM)) continue;
  const tally = { misplaced: 0, fine: 0 };
  let words = 0, dialogue = 0, region = 0, echo = 0, n = 0;
  for (const c of live) {
    const r = resolved.get(c.id);
    for (let i = 0; i < opts.runs; i++) {
      const out = await callMessages({ ...opts, temp: 0.7, maxTokens: 600 }, messagesFor(r, c, withParent));
      tally[await judge(out, nowLineFor(r, withParent))]++;
      if (echoes(out, r)) echo++;
      words += out.split(/\s+/).filter(Boolean).length;
      if (/["“”]/.test(out)) dialogue++;
      if (out.includes(r.parent.name)) region++;
      n++;
      if (VERBOSE) console.log(`    ${arm}#${n} ${c.id}\n${out}\n`);
    }
  }
  console.log(`${arm}  ECHO ${pct(echo, n)} · MISPLACED ${pct(tally.misplaced, n)} · REGION named ${pct(region, n)} · ${Math.round(words / Math.max(1, n))}w · dialogue ${pct(dialogue, n)}`);
}
