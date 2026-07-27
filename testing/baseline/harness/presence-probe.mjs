// PRESENCE probe — does correcting the now-line's "with … present" list stop the story writing in a
// character who was only ever talked about?
//
// The now-line names whoever the previous turn recorded as a participant. That list was built by matching
// entity names against the whole narration, so a character another character merely MENTIONED counted as
// standing in the room — and the story, told they were present, wrote them in again, which named them
// again. Two arms over real test worlds, both lists built by the REAL shipped helpers (bundled from src,
// so this probe also fails if the call sites stop using them):
//   A  mention  — findEntityNames(narration)                                     (the old parse)
//   B  prose    — scenePresentHere(findEntityNames(stripQuotedSpeech(narration))) (prose-only + location)
//
// Cases are deliberate positive triggers, like bold-probe's pivots: each prior turn has a present
// character speak an absent character's name. That is the situation under test, not a fair sample of prose.
//
// Metrics, per arm:
//   PHANTOM  the off-scene character appears in the new narration. This is the score. Lower is better.
//   VOICE    the character who IS present gets quoted dialogue — the regression check. Higher is better.
//   plus words, as a shape check.
//
// Controls (no model calls — the arms are compared as rendered):
//   prose        a second present character who ACTS in prose must survive both arms. Must pass.
//   spoken-only  a present character named ONLY inside dialogue. The arms differ by design: this is the
//                measured cost of prose-only presence. In play the 3-turn presence window carries her;
//                a single-turn probe has no window, so this is the worst case, not the expected one.
//
//   node presence-probe.mjs --runs 3 --turns 5
//   node presence-probe.mjs --endpoint https://api.lyonade.net/v1/chat/completions --model default --runs 6

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
const TURNS = parseInt(argVal("--turns", "5"), 10);

// Real modules, bundled so the probe measures the shipped parse rather than a restatement of it.
// Platform node + the `@/` alias, because the presence parse pulls in real deps (pluralize, the SCOWL
// word lists) and cross-imports `@/types`.
const load = async (rel) => {
  const out = await build({
    entryPoints: [path.join(REPO_ROOT, rel)],
    bundle: true, format: "esm", write: false, platform: "node", logLevel: "silent",
    alias: { "@": path.join(REPO_ROOT, "src") },
    loader: { ".json": "json" },
  });
  return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString("base64")}`);
};
const tpl = await load("src/lib/promptTemplate.ts");
const em = await load("src/lib/entityMatch.ts");
const lc = await load("src/lib/locationContext.ts");
const rc = await load("src/lib/runtimeCharacters.ts");

const SYS = grab("defaultSystemPrompt");
const NOW_LINE = grab("defaultNowLinePrompt");
const RECAP = grab("defaultRecapUserPrompt");
const cases = JSON.parse(await readFile(path.join(HARNESS_DIR, "../presence-cases.json"), "utf8"))
  .filter((c) => !ONLY || c.id === ONLY);

const worldCache = new Map();
async function loadWorld(file) {
  if (!worldCache.has(file)) {
    worldCache.set(file, JSON.parse(await readFile(path.join(HARNESS_DIR, "..", file), "utf8")));
  }
  return worldCache.get(file);
}

/** Resolve a case to its location, the entities authored there, and the world's full cast. */
async function resolve(c) {
  const w = await loadWorld(c.world);
  const locs = (w.locations ?? []).filter((l) => l && l.id);
  const loc = locs.find((l) => l.name === c.location);
  if (!loc) throw new Error(`${c.id}: no location "${c.location}" in ${c.world}`);
  const hereIds = loc.entities ?? [];
  return { world: w, loc, locs, hereIds, all: w.entities ?? [], here: (w.entities ?? []).filter((e) => hereIds.includes(e.id)) };
}

/** The text each arm's parses read: the whole narration, or its prose only. */
const readable = (text, arm) => (arm === "A" ? text : em.stripQuotedSpeech(text));

/** The participant list each arm would record for the prior turn — the real helpers, not a restatement. */
function namesFor(r, c, arm) {
  const found = em.findEntityNames(readable(c.prior, arm), r.all);
  return arm === "A" ? found : lc.scenePresentHere(found, r.all, r.hereIds);
}

/**
 * Whoever the bring-them-over path would anchor here off this turn, via the REAL selectReachableVisitors.
 * This is the mechanism that actually drove the reported failure: a character named once inside dialogue
 * was relocated into the room and stayed, roster description and all, for every turn after.
 */
function visitorsFor(r, c, arm) {
  return rc.selectReachableVisitors(
    em.findEntityNames(readable(c.prior, arm), r.all, { partial: false }),
    r.loc, r.locs, r.all, r.hereIds,
  );
}

const describe = (x) => (x?.aiDescription || x?.description || "").trim();
const renderEntities = (es) =>
  es.length ? es.map((e) => `- **${e.name}**\n  - **description:** ${describe(e)}`).join("\n") : "N/A";

function nowLineFor(r, names) {
  return tpl.renderPromptTemplate(NOW_LINE, {
    "<LOCATION|name>": r.loc.name,
    "<LOCATION|parent.name>": "N/A",
    "<ENTITIES|inscene.name>": names.length ? names.join(", ") : "N/A",
    "<TIME>": "N/A",
  });
}

function messagesFor(r, c, names, roster) {
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
    .replaceAll("<ENTITIES|markdown>", renderEntities(roster))
    .replaceAll("<ENTITIES|sublocations.markdown>", "N/A")
    .replaceAll("<ENTITIES|reachable.summary.markdown>", "N/A")
    .replaceAll("<DICTIONARY>", "N/A");
  return [
    { role: "system", content: sys },
    { role: "user", content: RECAP },
    { role: "assistant", content: `${c.prior}\n\n${nowLineFor(r, names)}` },
    { role: "user", content: c.action },
  ];
}

const rx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const named = (text, name) => new RegExp(`\\b${rx(name.split(/\s+/)[0])}\\b`).test(text);
// Quoted speech attributed near the present character's name — the regression check that a corrected
// list doesn't simply empty the room.
const voiced = (text, name) => /["“”]/.test(text) && named(text, name);
const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : "n/a");

const resolved = new Map();
for (const c of cases) resolved.set(c.id, await resolve(c));

// --- controls: compared as rendered, no model calls ---------------------------------------------------
const controls = cases.filter((c) => c.control);
for (const c of controls) {
  const r = resolved.get(c.id);
  const a = namesFor(r, c, "A");
  const b = namesFor(r, c, "B");
  const keptA = a.includes(c.alsoPresent);
  const keptB = b.includes(c.alsoPresent);
  const verdict = c.control === "prose"
    ? (keptA && keptB ? "OK  " : "FAIL")
    : (keptA && !keptB ? "COST" : keptB ? "OK  " : "????");
  console.log(`CONTROL ${verdict} ${c.id.padEnd(15)} ${c.alsoPresent} kept — A:${keptA} B:${keptB}   [A: ${a.join(", ") || "none"} | B: ${b.join(", ") || "none"}]`);
}
console.log();

const live = cases.filter((c) => !c.control);
for (const c of live) {
  const r = resolved.get(c.id);
  console.log(`  ${c.id.padEnd(9)} A: ${nowLineFor(r, namesFor(r, c, "A"))}`);
  console.log(`  ${"".padEnd(9)} B: ${nowLineFor(r, namesFor(r, c, "B"))}`);
}
console.log(`\nmodel ${opts.model} · runs ${opts.runs}\n`);

await callMessages({ ...opts, temp: 0, maxTokens: 4 }, [{ role: "user", content: "ping" }]).catch(() => {});

// The failure is a LOOP, not a single turn: the arm's parse reads each turn's own output to build the next
// turn's now-line, so a phantom that gets written in once is then reported present, which writes it in
// again. One turn cannot show this — arm A scored 0% phantom at --turns 1 on both targets — so the probe
// chains `--turns` of it, re-parsing with the arm under test each time, exactly as the app does.
for (const arm of ["A mention", "B prose  "]) {
  if (ARM && !arm.startsWith(ARM)) continue;
  let phantom = 0, voice = 0, words = 0, n = 0, chains = 0, everPhantom = 0, pulled = 0, quotes = 0, namedPresent = 0;
  for (const c of live) {
    const r = resolved.get(c.id);
    for (let i = 0; i < opts.runs; i++) {
      let prior = c.prior;
      let names = namesFor(r, { ...c, prior }, arm[0]);
      // Visitors persist once anchored, exactly as `discoveredEntities` does in play.
      const visitors = new Map();
      let hit = false;
      for (let t = 0; t < TURNS; t++) {
        for (const v of visitorsFor(r, { ...c, prior }, arm[0])) visitors.set(v.id, v);
        const roster = [...r.here, ...visitors.values()];
        // Narration is unpinned in promptSamplers, so no temperature is sent in the app; 0.7 stands in for
        // a typical endpoint default and is held identical across arms.
        const out = await callMessages(
          { ...opts, temp: 0.7, seed: 7 + i * 31 + t, maxTokens: 600 },
          messagesFor(r, { ...c, prior }, [...new Set([...names, ...visitors.values()].map((x) => x.name ?? x))], roster),
        );
        if (named(out, c.offscene)) { phantom++; hit = true; }
        if (voiced(out, c.present)) voice++;
        if (/["“”]/.test(out)) quotes++;
        if (named(out, c.present)) namedPresent++;
        words += out.split(/\s+/).filter(Boolean).length;
        n++;
        if (VERBOSE) console.log(`    ${arm} ${c.id} run${i + 1} turn${t + 1} roster[${roster.map((e) => e.name).join(", ")}]
${out}
`);
        prior = out;
        names = namesFor(r, { ...c, prior }, arm[0]);
      }
      chains++;
      if (hit) everPhantom++;
      if (visitors.size) pulled++;
    }
  }
  console.log(`${arm}  PHANTOM ${pct(phantom, n)} of turns (${phantom}/${n}) · CHAINS touched ${pct(everPhantom, chains)} (${everPhantom}/${chains}) · PULLED into roster ${pct(pulled, chains)} · VOICE ${pct(voice, n)} (dialogue ${pct(quotes, n)} × named ${pct(namedPresent, n)}) · ${Math.round(words / Math.max(1, n))}w`);
}
