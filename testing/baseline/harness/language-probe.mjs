// Language probe — A/B for the AI Language directive's wording and placement.
//
// Arm "label" is the shipped-until-now form: a bare `Narration language: X` line dropped in before the
// backward-compat lore append, so a world with lore buries it mid-prompt. Arm "imperative" is the new form:
// an imperative sentence appended after every other append, so it is the prompt's last line. Choices get the
// same treatment (`Choice language: X` vs `Write all choices in X.`).
//
// Both arms fire the REAL narration and choices prompts (defaultSystemPrompt / defaultChoicesPrompt) filled
// from the tracked planning-cases fixture, and the turn is chained the way the game chains it: narration
// first, then choices over that narration. The metric is what the player sees — is the text in the target
// language — scored by exclusive stopword counts, never by asking a model.
//
// Usage:
//   node language-probe.mjs                                   # cloud default endpoint, 12 runs/arm
//   node language-probe.mjs --endpoint http://127.0.0.1:1234/v1/chat/completions \
//                           --model cydonia-24b-v4.3@q4_k_m --runs 3

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HARNESS_DIR, "../../..");

const args = process.argv.slice(2);
const argVal = (f, d = null) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const endpoint = argVal("--endpoint", "https://api.lyonade.net/v1/chat/completions");
const model = argVal("--model", "default");
const runs = Number(argVal("--runs", "12"));
const maxTokens = Number(argVal("--max", "400"));
const token = argVal("--token", process.env.PROBE_TOKEN || "");
const langsArg = (argVal("--langs", "French,Spanish")).split(",").map((s) => s.trim());

const { world, playerTrait, location, cases } = JSON.parse(
  await readFile(path.resolve(HARNESS_DIR, "../planning-cases.json"), "utf8"),
);

const source = await readFile(path.join(REPO_ROOT, "src/components/game/GamePrompts.ts"), "utf8");
const grab = (name) => {
  const at = source.indexOf(name + " = `");
  if (at === -1) throw new Error("missing " + name);
  const from = source.indexOf("`", at) + 1;
  return source.slice(from, source.indexOf("`;", from));
};
const SYS = grab("defaultSystemPrompt");
const CHOICES = grab("defaultChoicesPrompt");
const CHOICES_USER = grab("defaultChoicesUserPrompt");

const MARKDOWN_ON = `## Formatting
- Write immersive, flowing prose - never a list, menu, or table.
- Reach for Markdown emphasis where it genuinely lands: **bold** the single most important noun of the moment (a threat, a key object, a revealed name) and *italicize* a sharp inner thought, sound, or stressed word - because the moment earns it, not to fill a quota.`;

// The backward-compat lore append: a prompt with no dictionary chip gets its activated lore added after the
// whole template. This is what used to sit *after* the language line — the burial the new placement fixes.
const LORE_BLOCK = `## Lore

The Rope Ferry: The crossing is worked hand over hand along a tarred rope strung bank to bank. It carries four standing, or two and a handcart, and it will not run once the current picks up after rain.

The Landing Bell: A cracked bell on the leaning post is rung twice for a crossing and three times for trouble. Nobody has rung it three times in living memory.`;

const renderEntities = (entities) =>
  entities?.length
    ? entities.map((e) => `- **${e.name}**\n  - **description:** ${e.description}\n  - **type:** ${e.type}`).join("\n")
    : "N/A";

const fillCommon = (text, c) =>
  text
    .replaceAll("<WORLD DESCRIPTION>", world)
    .replaceAll("<DICTIONARY|before>", "N/A")
    .replaceAll("<STATS DESCRIPTION|descriptions.markdown>", "- **Resolve:** steady\n- **Coin:** light")
    .replaceAll("<TRAITS DESCRIPTION|markdown>", `- **Identity:** ${playerTrait}`)
    .replaceAll("<NOTES>", "None")
    .replaceAll("<LOCATION|markdown>", `- **name:** ${location}`)
    .replaceAll("<LOCATION|summary.markdown>", `- **name:** ${location}`)
    .replaceAll("<LOCATION|sublocations.summary.markdown>", "N/A")
    .replaceAll("<LOCATION|reachable.summary.markdown>", "N/A")
    .replaceAll("<ENTITIES|markdown>", renderEntities(c.entities))
    .replaceAll("<ENTITIES|summary.markdown>", renderEntities(c.entities))
    .replaceAll("<ENTITIES|sublocations.markdown>", "N/A")
    .replaceAll("<ENTITIES|sublocations.summary.markdown>", "N/A")
    .replaceAll("<ENTITIES|reachable.summary.markdown>", renderEntities(c.reachableEntities))
    .replaceAll("<DICTIONARY>", "N/A");

const renderNarrationSys = (c) =>
  fillCommon(SYS, c)
    .replaceAll("<LENGTH GUIDANCE>", "Aim for two to four tight paragraphs; land the moment and stop.")
    .replaceAll("<MARKDOWN GUIDANCE>", MARKDOWN_ON);

/** The two arms, as the two builders differ only in wording and in where the directive lands. */
const ARMS = {
  label: {
    narration: (base, lang) => `${base}\n Narration language: ${lang}\n\n${LORE_BLOCK}`,
    choices: (base, lang) => `${base}\n Choice language: ${lang}`,
  },
  imperative: {
    narration: (base, lang) => `${base}\n\n${LORE_BLOCK}\n\nWrite all narration in ${lang}.`,
    choices: (base, lang) => `${base}\n\nWrite all choices in ${lang}.`,
  },
};

// --- Language identification -------------------------------------------------------------------
// Exclusive function-word sets: a word appears in at most one set, so a shared token ("la", "de", "que")
// can never tip the count. Classification is the argmax, and a run with too few hits stays unclassified
// rather than being credited to whichever set scraped one match.
const STOPWORDS = {
  English: `the and is of to in that it you your with for on as but from this are was were she he they his her
    their at by into what when there about then will has have been back out up down`,
  French: `le les des du est une dans pour qui vous elle avec pas ses aux plus mais votre cette très tout sur
    il ne où déjà encore vers chez sous comme quand alors leur leurs nous sont était ces cet moi toi lui
    avant après ainsi`,
  Spanish: `el los las y para con sus al más pero hacia muy ya también está están hay sobre por del cuando
    donde cómo ellos ellas nosotros era eran esta este esos esas antes después así aunque sólo`,
};
const SETS = Object.fromEntries(
  Object.entries(STOPWORDS).map(([k, v]) => [k, new Set(v.split(/\s+/).filter(Boolean))]),
);

/** Which of the known languages a passage is written in, or null when nothing scores high enough. */
function identify(text) {
  const tokens = (text.toLowerCase().match(/[a-zà-öø-ÿ']+/g) || []);
  const counts = Object.fromEntries(Object.keys(SETS).map((k) => [k, 0]));
  for (const t of tokens) for (const [lang, set] of Object.entries(SETS)) if (set.has(t)) counts[lang]++;
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  // A clear winner needs both an absolute floor and a margin: near-ties are unclassified, not guessed.
  if (ranked[0][1] < 4 || ranked[0][1] < ranked[1][1] * 1.5) return { lang: null, counts };
  return { lang: ranked[0][0], counts };
}

// The standing narration metrics, so a language win that costs the format contract is visible.
const flags = (text) => {
  const f = [];
  if (/\b(what (do|would|will) you|choose one|choose from|your options?|options?:|pick one|que (choisis|fais)-tu|tus opciones)\b/i.test(text) ||
      /^\s*(\d+[.)]|[-*])\s+.+\?$/m.test(text)) f.push("OFFERS-CHOICES");
  if (/(^|\n)\s*[-*]?\s*(resolve|coin|hp|health|résolu|résolution|pièces|monedas)\s*:?\s*[+-]?\d/i.test(text)) f.push("STAT-TABULATION");
  return f;
};

async function call(sys, messages) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    // Narration and choices are both unpinned in the app — the endpoint's own sampler decides.
    body: JSON.stringify({ model, messages: [{ role: "system", content: sys }, ...messages], max_tokens: maxTokens, stream: false }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  return (j.choices?.[0]?.message?.content ?? "").trim();
}

// Self-check: the scorer has to place three known passages before any arm's number means anything.
const SCORER_CHECK = [
  ["English", "The lantern swings on the leaning post and you feel the boards give under your weight."],
  ["French", "La lanterne se balance sur le poteau penché et vous sentez les planches céder sous votre poids."],
  ["Spanish", "El farol se balancea sobre el poste inclinado y sientes que las tablas ceden bajo tu peso."],
];
const scorerOk = SCORER_CHECK.every(([want, text]) => identify(text).lang === want);
console.log(`Scorer self-check: ${scorerOk ? "✓ all three reference passages placed" : "✗ MISCLASSIFIED — numbers below are void"}`);
if (!scorerOk) for (const [want, text] of SCORER_CHECK) console.log(`  want ${want} → got ${identify(text).lang}`, identify(text).counts);

const CASE = cases.find((c) => c.name === "carry-forward-all") ?? cases[0];
console.log(`\nLanguage probe · ${endpoint} · model "${model}" · case "${CASE.name}" · ${runs} run(s)/arm · langs ${langsArg.join(", ")}\n`);

const narrationBase = renderNarrationSys(CASE);
const choicesBase = fillCommon(CHOICES, CASE);
const results = [];

for (const lang of langsArg) {
  for (const [armName, arm] of Object.entries(ARMS)) {
    const jobs = Array.from({ length: runs }, async () => {
      const narration = await call(arm.narration(narrationBase, lang), [
        { role: "assistant", content: CASE.prevNarration },
        { role: "user", content: CASE.action },
      ]);
      const choices = await call(arm.choices(choicesBase, lang), [
        { role: "user", content: CHOICES_USER.replaceAll("<NARRATION>", narration) },
      ]);
      return { narration, choices };
    });
    const settled = await Promise.all(jobs.map((p) => p.catch((e) => ({ error: String(e.message || e) }))));
    for (const r of settled) {
      if (r.error) { results.push({ lang, arm: armName, error: r.error }); continue; }
      results.push({
        lang,
        arm: armName,
        narrationLang: identify(r.narration).lang,
        choicesLang: identify(r.choices).lang,
        // Narration only: offering the player choices is what the choices pass is for.
        flags: flags(r.narration),
        sample: r.narration.slice(0, 90).replace(/\s+/g, " "),
      });
    }
  }
}

const rate = (rows, pred) => (rows.length ? rows.filter(pred).length / rows.length : 0);
const pct = (n) => `${(n * 100).toFixed(0)}%`;

console.log("| target | arm | n | narration in target | choices in target | both | errors | flagged |");
console.log("|---|---|---|---|---|---|---|---|");
for (const lang of langsArg) {
  for (const armName of Object.keys(ARMS)) {
    const all = results.filter((r) => r.lang === lang && r.arm === armName);
    const ok = all.filter((r) => !r.error);
    console.log(
      `| ${lang} | ${armName} | ${ok.length} | ${pct(rate(ok, (r) => r.narrationLang === lang))} ` +
      `| ${pct(rate(ok, (r) => r.choicesLang === lang))} ` +
      `| ${pct(rate(ok, (r) => r.narrationLang === lang && r.choicesLang === lang))} ` +
      `| ${all.length - ok.length} | ${ok.filter((r) => r.flags.length).length} |`,
    );
  }
}

console.log("\nFirst line of each run, for eyeballing:");
for (const lang of langsArg) {
  for (const armName of Object.keys(ARMS)) {
    console.log(`\n--- ${lang} / ${armName} ---`);
    for (const r of results.filter((x) => x.lang === lang && x.arm === armName)) {
      if (r.error) { console.log(`  ERROR ${r.error}`); continue; }
      console.log(`  [narr:${r.narrationLang ?? "?"} choices:${r.choicesLang ?? "?"}${r.flags.length ? " ⚠" + r.flags.join(",") : ""}] ${r.sample}`);
    }
  }
}
