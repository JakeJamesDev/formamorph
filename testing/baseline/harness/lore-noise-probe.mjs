// Lore-noise probe — the cost-asymmetry test behind SEMANTIC_LORE_THRESHOLD. The embedding probe
// (semantic-lore-probe.mjs) can say how OFTEN semantic lore fires wrongly; only a model can say whether a
// wrong lore line actually costs anything. If the narrator quietly ignores irrelevant lore, precision is
// cheap and the threshold should be tuned for recall; if it seizes on it and writes the wrong world,
// precision is expensive and the threshold should stay high.
//
// Two arms per case, same action, same seed:
//   clean — the correct lore entry only
//   noisy — the correct entry PLUS the wrong entry semantic lore actually picks at ~0.37-0.42
// The noise entries are not invented: they are the top-scoring WRONG entry per action, taken from
// vane-hollow.json by the same embedding the app uses (see the pair list in the header of each case).
//
// Metric: UPTAKE — does the narration import the noise entry's distinctive content? Uptake in the noisy arm
// that is absent from the clean arm is the wrong lore actually landing in the story. The clean arm is the
// false-positive guard: uptake there means the regex is catching ordinary prose, not the injection.
//
// Usage:  node lore-noise-probe.mjs [--endpoint URL] [--model default] [--runs 3] [--only skystone]

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HARNESS_DIR, "../../..");
const args = process.argv.slice(2);
const argVal = (f, d = null) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const endpoint = argVal("--endpoint", "https://api.lyonade.net/v1/chat/completions");
const model = argVal("--model", "default");
const runs = Number(argVal("--runs", "3"));
const maxTokens = Number(argVal("--max", "400"));
const only = argVal("--only");
const token = argVal("--token", process.env.PROBE_TOKEN || "");

const world = JSON.parse(await readFile(path.resolve(HARNESS_DIR, "../vane-hollow.json"), "utf8"));
const ENTRIES = new Map(world.dictionaries.flatMap((b) => b.entries).map((e) => [e.id.replace(/^dict-/, ""), e]));

// action → (correct entry, wrong entry the embedding actually ranks top among non-expected), with a regex
// for the noise entry's distinctive content. Ordered by how close the wrong entry sits to firing.
const CASES = [
  { name: "springflood", want: "springflood", noise: "snowhouse", sim: 0.42,
    action: "I ask what happens to the lower galleries once the snow melts.",
    control: "I look for one of the stone refuges along the road to wait out the weather.",
    uptake: /\b(refuge|shelter(s|ed)?|waystation|snow house|stocked|firewood|fuel)\b/i },
  { name: "skystone", want: "skystone", noise: "whitedeath", sim: 0.41,
    action: "I ask about the iron that came down burning onto the high slopes.",
    control: "I ask how many were buried when the slope came down last spring.",
    uptake: /\b(avalanche|snowslide|the slide|buried alive|slope (came down|gave way))\b/i },
  { name: "shadowdays", want: "shadowdays", noise: "hollowwinds", sim: 0.38,
    action: "I ask why every tool goes down when the sun is eaten at noon.",
    control: "I brace as the cold pours off the icefield hard enough to knock me flat.",
    uptake: /\b(icefield|katabatic|wind(s)? (pour|come down|knock)|gale)\b/i },
  { name: "widowspurse", want: "widowspurse", noise: "bondlabor", sim: 0.38,
    action: "I ask what a household is owed when a man does not come back up.",
    control: "I ask how long a man must work underground to buy back his freedom.",
    uptake: /\b(indenture(d)?|bond(ed)? labor|creditor|work(ing)? off (a|the|his|her) debt)\b/i },
  { name: "observatory", want: "observatory", noise: "longvisitor", sim: 0.38,
    action: "I climb to the round-roofed house on the summit ridge where they watch the stars.",
    control: "I ask about the tailed star that returns once in a lifetime.",
    uptake: /\b(comet|tailed star|sixty-one|returns every)\b/i },
  { name: "oretram", want: "oretram", noise: "tithe", sim: 0.37,
    action: "I watch the buckets running down the mountain on their steel line.",
    control: "I ask what cut comes off the top before any crew sees payment.",
    uptake: /\b(tithe|levy|cut (taken )?off the top|audited)\b/i },
];

const source = await readFile(path.join(REPO_ROOT, "src/components/game/GamePrompts.ts"), "utf8");
const grab = (name) => {
  const at = source.indexOf(name + " = `");
  if (at === -1) throw new Error("missing " + name);
  const from = source.indexOf("`", at) + 1;
  return source.slice(from, source.indexOf("`;", from));
};
const SYS = grab("defaultSystemPrompt");
const USER = grab("defaultNarrationUserPrompt");

/** Mirrors buildDictionaryContext: "Name: value" per entry, in array order. */
const loreBlock = (ids) =>
  ids.map((id) => { const e = ENTRIES.get(id); return `${e.name || e.key[0]}: ${e.value}`; }).join("\n");

const renderSys = (c, arm) => {
  // control = the noise entry alone, asked about directly. It exists to prove the uptake regex can fire at
  // all: a 0/0 result is only meaningful once the metric is shown to bite.
  const ids = arm === "noisy" ? [c.want, c.noise] : arm === "control" ? [c.noise] : [c.want];
  return SYS
    .replaceAll("<WORLD DESCRIPTION>", world.worldOverview.description)
    .replaceAll("<DICTIONARY|before>", "N/A")
    .replaceAll("<DICTIONARY>", loreBlock(ids))
    .replaceAll("<STATS DESCRIPTION|descriptions.markdown>", "- **Vigor:** Winded\n- **Standing:** Outsider")
    .replaceAll("<TRAITS DESCRIPTION|markdown>", "- **Identity:** the lowland company's surveyor")
    .replaceAll("<NOTES>", "None")
    .replaceAll("<LOCATION|summary.markdown>", "- **name:** The Shaft Head")
    .replaceAll("<LOCATION|sublocations.summary.markdown>", "N/A")
    .replaceAll("<LOCATION|reachable.summary.markdown>", "N/A")
    .replaceAll("<ENTITIES|summary.markdown>", "- **Bracken** - Foreman of the second gallery. (Person)")
    .replaceAll("<ENTITIES|sublocations.summary.markdown>", "N/A")
    .replaceAll("<ENTITIES|reachable.summary.markdown>", "N/A")
    .replace(/<[A-Z][A-Z |.a-z]*>/g, "N/A"); // any remaining slot this probe does not model
};
const renderUser = (c, arm) => USER.replaceAll("<PLAYER ACTION>", arm === "control" ? c.control : c.action).replace(/<[A-Z][A-Z |.a-z]*>/g, "N/A");

async function call(sys, user, seed) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(endpoint, {
    method: "POST", headers,
    // Narration is unpinned in PROMPT_SAMPLER_PINS, so send no temperature — the endpoint's own config applies.
    body: JSON.stringify({ model, messages: [{ role: "system", content: sys }, { role: "user", content: user }], max_tokens: maxTokens, reasoning_effort: "none", seed, stream: false }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const j = await res.json();
  return (j.choices?.[0]?.message?.content ?? "").trim();
}

const pick = CASES.filter((c) => !only || c.name.includes(only));
console.log(`Lore-noise probe · ${endpoint} · "${model}" · ${pick.length} case(s) · ${runs} run(s)/arm`);
console.log(`Arms: clean (correct lore only) vs noisy (correct + the wrong entry the embedding picks)\n`);
await call(renderSys(pick[0], "clean"), "warm up", 1).catch(() => {});

const T = { clean: 0, noisy: 0, control: 0, cleanUptake: 0, noisyUptake: 0, controlUptake: 0, errs: 0 };
for (const c of pick) {
  console.log(`\n######## ${c.name}  (noise: ${c.noise} @ sim ${c.sim})`);
  for (const arm of ["clean", "noisy", "control"]) {
    let uptake = 0, n = 0;
    for (let r = 0; r < runs; r++) {
      let out;
      try { out = await call(renderSys(c, arm), renderUser(c, arm), 1000 + r); }
      catch (e) { T.errs++; console.log(`  ${arm} #${r + 1} ERROR ${String(e.message || e).slice(0, 80)}`); continue; }
      n++;
      const hit = c.uptake.test(out);
      if (hit) uptake++;
      const m = out.match(c.uptake);
      console.log(`  ${arm.padEnd(5)} #${r + 1} ${hit ? `UPTAKE("${m[0]}")` : "clean"}  ${out.replace(/\s+/g, " ").slice(0, 96)}`);
    }
    T[arm] += n;
    T[arm + "Uptake"] += uptake;
    console.log(`  → ${arm}: ${uptake}/${n} uptake`);
  }
}

const rate = (a, b) => (b ? `${((100 * a) / b).toFixed(0)}%` : "n/a");
console.log(`\n================ TOTAL (${model})`);
console.log(`  clean arm uptake: ${T.cleanUptake}/${T.clean}  (${rate(T.cleanUptake, T.clean)})   <- guard: should be ~0`);
console.log(`  noisy arm uptake: ${T.noisyUptake}/${T.noisy}  (${rate(T.noisyUptake, T.noisy)})   <- the cost of a false fire`);
console.log(`  control uptake:   ${T.controlUptake}/${T.control}  (${rate(T.controlUptake, T.control)})   <- must be HIGH, else the metric is dead`);
if (T.control && T.controlUptake === 0) console.log(`  !! control never fired — the uptake regexes do not bite; the noisy result is meaningless.`);
if (T.errs) console.log(`  errors: ${T.errs}`);
