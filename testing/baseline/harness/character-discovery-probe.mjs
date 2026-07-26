// Character-discovery probe — plays a REAL authored world as a session and reports what the
// narration-name extractor (src/lib/characterCandidates.ts) would make of it.
//
// Why it exists: the extractor's rules were tuned against one world's prose. This runs real worlds
// through real models and produces the two lists needed to judge the rules honestly:
//
//   PROMOTED   — names the rules would turn into characters. Precision lives here.
//   NEAR-MISS  — every other capitalized run the narration contained, with the reason it was rejected
//                and its evidence. RECALL lives here, and it is deliberately enumerated with the rules
//                OFF: scoring only against my own output would measure precision forever and never
//                find a missing rule.
//
// Authored entities/locations/lore are excluded exactly as the app excludes them, so what remains is
// only newly invented characters — the thing under test.
//
//   node character-discovery-probe.mjs --world praetoria-academy --model cydonia-lmstudio [--turns 30]
//                                      [--seed 7] [--out runs/disc-x.json] [--verbose]
//
// Sessions self-drive: each turn asks for choices and plays one, so the transcript is the model's own
// story rather than a scripted walk. `--nudge N` inserts a "seek out someone new" action every N turns
// when the natural rate of invented characters is too low to measure; nudged turns are tagged in the
// output so they are never silently pooled with natural ones.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { grab, callMessages } from "./planner-probe-lib.mjs";
import { build } from "esbuild";
import os from "node:os";

const HARNESS = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HARNESS, "../../..");
const WORLD_DIR = path.join(REPO, "testing/authored-worlds");

// Import the SHIPPED extractor rather than mirroring it — a hand-copied parser is exactly how the
// milestone probe drifted from lib/milestoneMemory and reported a parser the app doesn't have. Node
// can't resolve the lib's extensionless TS import chain, so bundle it to a temp ESM file first.
const BUNDLE = path.join(os.tmpdir(), `fm-charcands-${process.pid}.mjs`);
await build({
  entryPoints: [path.join(REPO, "src/lib/characterCandidates.ts")],
  outfile: BUNDLE, bundle: true, format: "esm", platform: "node", logLevel: "silent",
  alias: { "@": path.join(REPO, "src") },
});
const { extractCharacterCandidates, collectCandidateEvidence, mergeCandidateEvidence } =
  await import(`file://${BUNDLE.replace(/\\/g, "/")}`);

const argv = process.argv.slice(2);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const num = (f, d) => Number(val(f, d));
const verbose = argv.includes("--verbose");

const WORLD_NAME = val("--world", "praetoria-academy");
const MODEL_LABEL = val("--model", "cydonia-lmstudio");
const TURNS = num("--turns", 30);
const SEED = num("--seed", 7);
const NUDGE_EVERY = num("--nudge", 0);
const OUT = val("--out", null);

const profiles = JSON.parse(await readFile(path.join(HARNESS, "profiles.json"), "utf8"));
const cfg = profiles.models.find((m) => m.label === MODEL_LABEL);
if (!cfg) throw new Error(`model label '${MODEL_LABEL}' not in profiles.json`);
const OPTS = {
  endpoint: cfg.endpointUrl ?? profiles.endpointUrl,
  model: cfg.modelName ?? MODEL_LABEL,
  token: cfg.apiToken ?? profiles.apiToken ?? "",
  maxTokens: 400,
  seed: SEED,
  temp: 0.8, // narration runs warm in the app; a cold sampler would under-produce new characters
};

// ── World loading ───────────────────────────────────────────────────────────────────────────────
// These files are 8-70 MB, almost entirely base64 images. Strip anything image-shaped on the way in.
function stripImages(node) {
  if (Array.isArray(node)) return node.map(stripImages);
  if (node && typeof node === "object") {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      if (/^(image|thumbnail|sound|model|blob|data)$/i.test(k)) continue;
      if (typeof v === "string" && v.length > 4000) continue;
      out[k] = stripImages(v);
    }
    return out;
  }
  return node;
}

const raw = JSON.parse(await readFile(path.join(WORLD_DIR, `${WORLD_NAME}.json`), "utf8"));
const world = stripImages(raw);
const overview = world.worldOverview ?? world;
const entities = world.entities ?? [];
const locations = world.locations ?? [];
const traits = world.traits ?? [];
const stats = world.stats ?? [];
const dictEntries = (world.dictionaries ?? []).flatMap((d) => d.entries ?? []);

// Exclusions mirror GameViewer's `characterExclusions`, split the same way: people carry the surname
// rule, everything else does not. Keep this in sync by hand.
const clean = (xs) => xs.map((n) => String(n ?? "").trim()).filter(Boolean);
const EXCLUSIONS = {
  characters: clean(entities.map((e) => e.name)),
  terms: clean([
    ...locations.map((l) => l.name),
    ...stats.map((s) => s.name),
    ...traits.map((t) => t.name),
    ...dictEntries.flatMap((e) => [e.name ?? "", ...[].concat(e.key ?? [], e.secondaryKeys ?? [])]),
  ]),
};

// ── Prompt assembly (live text from GamePrompts.ts, so edits there reach this probe) ────────────
const START = locations[0] ?? { name: "Unknown", description: "" };
const here = entities.filter((e) => (START.entities ?? []).includes(e.id));
const md = (xs, f) => (xs.length ? xs.map(f).join("\n") : "N/A");

const SYS = grab("defaultSystemPrompt")
  .replaceAll("<LENGTH GUIDANCE>", "Write at most 4 short paragraphs.")
  .replaceAll("<MARKDOWN GUIDANCE>", "Write immersive, flowing prose.")
  .replaceAll("<WORLD DESCRIPTION>", overview.description ?? overview.name ?? "")
  .replaceAll("<DICTIONARY|before>", "N/A")
  .replaceAll("<DICTIONARY>", "N/A")
  .replaceAll("<STATS DESCRIPTION|descriptions.markdown>", md(stats, (s) => `- **${s.name}:** ${s.description ?? ""}`))
  .replaceAll("<TRAITS DESCRIPTION|markdown>", md(traits.slice(0, 3), (t) => `- **${t.name}:** ${t.description ?? ""}`))
  .replaceAll("<NOTES>", "N/A")
  .replaceAll("<LOCATION|markdown>", `- **name:** ${START.name}\n- **description:** ${START.description ?? ""}`)
  .replaceAll("<LOCATION|sublocations.summary.markdown>", "N/A")
  .replaceAll("<LOCATION|reachable.summary.markdown>", "N/A")
  .replaceAll("<ENTITIES|markdown>", md(here, (e) => `- **${e.name}**\n  - **description:** ${e.aiDescription ?? e.description ?? ""}`))
  .replaceAll("<ENTITIES|sublocations.markdown>", "N/A")
  .replaceAll("<ENTITIES|reachable.summary.markdown>", "N/A");

const CHOICES_SYS = grab("defaultChoicesPrompt");
const OPENING = "I take in my surroundings and get on with my day.";
const NUDGE = "I go looking for someone I haven't met yet, and strike up a conversation.";

// ── Session ─────────────────────────────────────────────────────────────────────────────────────
const history = [];
const turns = [];
let action = OPENING;

for (let t = 0; t < TURNS; t++) {
  const nudged = NUDGE_EVERY > 0 && t > 0 && t % NUDGE_EVERY === 0;
  if (nudged) action = NUDGE;
  let narration = "";
  try {
    narration = await callMessages(OPTS, [
      { role: "system", content: SYS },
      ...history.slice(-12),
      { role: "user", content: action },
    ]);
  } catch (e) {
    console.error(`[turn ${t}] ${e.message}`);
    break;
  }
  if (!narration) break;
  history.push({ role: "user", content: action }, { role: "assistant", content: narration });
  turns.push({ turn: t, action, nudged, narration });
  if (verbose) console.log(`\n[${t}${nudged ? " NUDGE" : ""}] ${action}\n  ${narration.slice(0, 160).replace(/\s+/g, " ")}…`);
  else process.stdout.write(nudged ? "!" : ".");

  // Next action = one of the model's own choices, so the session goes where the story goes.
  try {
    const raw = await callMessages({ ...OPTS, maxTokens: 200 }, [
      { role: "system", content: CHOICES_SYS },
      { role: "user", content: narration },
    ]);
    const picks = raw.split("\n").map((l) => l.replace(/^[-*\d.)\s]+/, "").trim()).filter((l) => l.length > 8);
    action = picks.length ? picks[t % picks.length] : "I carry on with what I was doing.";
  } catch {
    action = "I carry on with what I was doing.";
  }
}
process.stdout.write("\n");

// ── Scoring ─────────────────────────────────────────────────────────────────────────────────────
// Rules ON: what the app would promote, accumulated turn by turn exactly as GameViewer does — each
// turn extracts against the CURRENT known set, and anything promoted joins it.
const known = [...EXCLUSIONS.characters];
const promoted = [];
let acc = new Map();
for (const { turn, narration } of turns) {
  acc = mergeCandidateEvidence(acc, collectCandidateEvidence(narration));
  for (const name of extractCharacterCandidates("", { ...EXCLUSIONS, characters: known }, acc)) {
    if (!promoted.some((p) => p.name === name)) {
      promoted.push({ name, firstTurn: turn, evidence: acc.get(name) });
      known.push(name);
    }
  }
}

// Rules OFF: every capitalized run the narration contained, so misses are visible. This is the
// labeling universe — the list a human marks up — and it must not be filtered by the rules under test.
const allText = turns.map((t) => t.narration).join("\n");
const rawRuns = new Map();
for (const sentence of allText.split(/(?<=[.!?])["'*_)\]”’]*\s+|\n+/)) {
  for (const m of sentence.matchAll(/\b[A-Z][A-Za-z]*(?:['’][A-Za-z]+)?(?:\s+[A-Z][A-Za-z]*(?:['’][A-Za-z]+)?){0,2}/g)) {
    const name = m[0].trim();
    if (name.length < 2) continue;
    const rec = rawRuns.get(name) ?? { name, total: 0, mid: 0, sample: "" };
    rec.total++;
    if (!/^[\s"'“”*_([]*$/.test(sentence.slice(0, m.index))) rec.mid++;
    if (!rec.sample) rec.sample = sentence.trim().slice(0, 140);
    rawRuns.set(name, rec);
  }
}
const promotedNames = new Set(promoted.map((p) => p.name));
const excludedAll = [...EXCLUSIONS.characters, ...EXCLUSIONS.terms].map((s) => s.toLowerCase());
const nearMiss = [...rawRuns.values()]
  .filter((r) => !promotedNames.has(r.name))
  .filter((r) => !excludedAll.includes(r.name.toLowerCase()))
  .filter((r) => r.total >= 2) // one-off capitalizations are noise, not candidates
  .sort((a, b) => b.mid - a.mid || b.total - a.total);

const modelRoot = await fetch(OPTS.endpoint.replace(/\/chat\/completions$/, "/models"), {
  headers: OPTS.token ? { Authorization: `Bearer ${OPTS.token}` } : {},
}).then((r) => r.json()).then((j) => j.data?.[0]?.root ?? j.data?.[0]?.id ?? "?").catch(() => "?");

console.log(`\n==== ${WORLD_NAME} · ${MODEL_LABEL} (${modelRoot}) · ${turns.length} turns · seed ${SEED} ====`);
console.log(`world cast: ${EXCLUSIONS.characters.length} authored characters, ${EXCLUSIONS.terms.length} other terms\n`);
console.log(`PROMOTED (${promoted.length}) — precision is judged here:`);
for (const p of promoted) {
  const e = p.evidence ?? {};
  console.log(`  turn ${String(p.firstTurn).padStart(2)}  ${p.name.padEnd(28)} ${e.titled ? "titled" : `mid ${e.mid}`}  "${(rawRuns.get(p.name)?.sample ?? "").slice(0, 90)}"`);
}
console.log(`\nNEAR-MISS (${nearMiss.length}) — recall is judged here; rules were OFF for this list:`);
for (const r of nearMiss.slice(0, 40)) {
  console.log(`  ${r.name.padEnd(28)} mid ${String(r.mid).padStart(2)}/${String(r.total).padStart(2)}  "${r.sample.slice(0, 90)}"`);
}
if (nearMiss.length > 40) console.log(`  … ${nearMiss.length - 40} more (see --out)`);

if (OUT) {
  const file = path.isAbsolute(OUT) ? OUT : path.join(HARNESS, "..", OUT);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify({
    world: WORLD_NAME, model: MODEL_LABEL, modelRoot, seed: SEED, turns: turns.length,
    nudgeEvery: NUDGE_EVERY, exclusions: EXCLUSIONS, promoted, nearMiss, transcript: turns,
  }, null, 2));
  console.log(`\nwrote ${file}`);
}
