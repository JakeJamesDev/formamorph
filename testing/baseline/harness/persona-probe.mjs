// Persona chip probe. Compares the two ways a player can say who they are:
//   A: the prompts at --source-a (default: the working tree's git base), identity written into a trait —
//      how a player names themselves before the Persona chip exists.
//   B: the working-tree prompts, the same identity as a persona filling the <PERSONA> chip; traits empty.
// Same name, pronouns and description in both arms, so the prompt wiring is the only variable.
//
// Metrics, per stage:
//   narration  stranger-name  a character who was never told says the player's name (want 0)
//              third-person   the narrator names the player outside a quote (want 0; second person holds)
//              intro-name     the player's name reaches the page when the action states it (positive control)
//              npc-spoke / pc-tic / bold / words — regression checks from dialogue-unbaited-probe
//   choices    I-lines        options that start with "I " (want all) · name-in-options (want 0)
//   summary    you            digests written in second person (want all) · name (want 0)
//   thinking / director   pc-first       Cast opens with "Player Character" (want all) · pc-recast (the player's name
//                             cast as a separate bullet, want 0)
//
// Usage:  node persona-probe.mjs [--endpoint URL] [--model default] [--runs 3] [--aux-runs 3]
//                                [--source-a FILE] [--only narration|choices|summary|thinking|director] [--arm A|B]
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HARNESS_DIR, "../../..");
const args = process.argv.slice(2);
const argVal = (f, d = null) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const endpoint = argVal("--endpoint", "https://api.lyonade.net/v1/chat/completions");
const model = argVal("--model", "default");
const runs = Number(argVal("--runs", "3"));
const auxRuns = Number(argVal("--aux-runs", "3"));
const only = argVal("--only");
const armOnly = argVal("--arm");
const token = argVal("--token", process.env.PROBE_TOKEN || "");
const seed = argVal("--seed");

const PROMPTS = "src/components/game/GamePrompts.ts";
const sourceB = await readFile(path.join(REPO_ROOT, PROMPTS), "utf8");
const sourceA = argVal("--source-a")
  ? await readFile(argVal("--source-a"), "utf8")
  : execFileSync("git", ["show", `${argVal("--base", "HEAD")}:${PROMPTS}`], { cwd: REPO_ROOT, encoding: "utf8" });

const grabFrom = (source) => (name) => {
  const at = source.indexOf(name + " = `");
  if (at === -1) throw new Error("missing " + name);
  const from = source.indexOf("`", at) + 1;
  return source.slice(from, source.indexOf("`;", from)).trimEnd();
};

const { world, playerTrait, location } = JSON.parse(
  await readFile(path.resolve(HARNESS_DIR, "../planning-cases.json"), "utf8"),
);

// The one identity both arms carry. The trait text names the player; the persona holds the same facts.
const PERSONA = {
  name: "Wren",
  pronouns: "she/her",
  description: "A travel-worn mapmaker with silver hair and ink-stained hands, soft-spoken and observant.",
};
const personaBlock = `- **${PERSONA.name}**\n  - **pronouns:** ${PERSONA.pronouns}\n  - **description:** ${PERSONA.description}\n`;
const personaName = `${PERSONA.name} (${PERSONA.pronouns})`;

// Affix-aware render, as lib/promptTemplate does it: a blank value drops the placement and its affixes.
const TOKEN_RE = /<([A-Z][A-Z ]+?)(?:\|([a-z.]+))?(?:\|pre="([^"]+)")?(?:\|post="([^"]+)")?>/g;
const render = (template, values) =>
  template.replace(TOKEN_RE, (match, base, variant, pre, post) => {
    const key = variant ? `<${base}|${variant}>` : `<${base}>`;
    const value = values[key] ?? values[`<${base}>`];
    if (value === undefined) return match;
    if (!pre && !post) return value;
    return value.trim() === "" || value === "N/A" ? "" : `${pre ?? ""}${value}${post ?? ""}`;
  });

const renderEntities = (entities) =>
  entities.map((e) => `- **${e.name}**\n  - **description:** ${e.description}\n  - **type:** ${e.type}`).join("\n");

function contextValues(arm, c) {
  const persona = arm === "B";
  return {
    "<LENGTH GUIDANCE>": "Aim for two to four tight paragraphs; land the moment and stop.",
    "<LANGUAGE>": "",
    "<WORLD DESCRIPTION>": world,
    "<DICTIONARY|before>": "N/A",
    "<DICTIONARY>": "N/A",
    "<STATS DESCRIPTION|descriptions.markdown>": "- **Resolve:** steady",
    "<TRAITS DESCRIPTION|markdown>": persona ? "N/A" : `- **Identity:** ${playerTrait}`,
    "<PERSONA|markdown>": persona ? personaBlock : "N/A",
    "<PERSONA|name>": persona ? personaName : "N/A",
    "<PERSONA|name.markdown>": persona ? personaName : "N/A",
    "<NOTES>": "None",
    "<LOCATION|markdown>": `- **name:** ${location}`,
    "<LOCATION|summary.markdown>": `- **name:** ${location}`,
    "<LOCATION|sublocations.summary.markdown>": "N/A",
    "<LOCATION|reachable.summary.markdown>": "N/A",
    "<ENTITIES|markdown>": renderEntities(c.entities),
    "<ENTITIES|summary.markdown>": renderEntities(c.entities),
    "<ENTITIES|sublocations.markdown>": "N/A",
    "<ENTITIES|sublocations.summary.markdown>": "N/A",
    "<ENTITIES|reachable.summary.markdown>": "N/A",
    "<ACTIVE CHARACTER GUIDANCE>": "Keep the cast small, usually one to 3 besides the player.",
    "<PLAYER ACTION>": c.action,
    "<NARRATION>": c.prevNarration,
  };
}

// Strangers: nobody here has been told the player's name. `intro` is the positive control.
const CASES = [
  {
    name: "tavern-arrival",
    entities: [{ name: "Tomas", description: "The barkeep, wiping down mugs behind the counter.", type: "Person" }],
    prevNarration: "The tavern is low and warm, a few patrons hunched over their cups. Behind the counter, a heavyset barkeep works a rag around the rim of a mug, glancing up as the door swings shut behind you.",
    action: "I cross to the bar and set my pack down on a stool.",
  },
  {
    name: "gate-guard",
    entities: [{ name: "Halvard", description: "A gate guard in a mud-spattered tabard, spear butt planted in the dirt.", type: "Person" }],
    prevNarration: "The hamlet's gate is little more than two posts and a swung-back hurdle. A guard leans on his spear beneath it, watching the road, his eyes tracking you as you come up the rise.",
    action: "I walk up to the gate and slow my pace, letting him see my empty hands.",
  },
  {
    name: "market-browse",
    entities: [{ name: "Pell", description: "A fruit-seller arranging his stall, calling prices to no one in particular.", type: "Person" }],
    prevNarration: "The market is thinning as the light goes. At one stall a wiry man stacks bruised apples into a careful pyramid, straightening the topmost fruit with a fussy sort of pride.",
    action: "I stop at the stall and ask what he wants for the last of the apples.",
  },
  {
    name: "shared-table",
    entities: [{ name: "Ysolde", description: "Another traveler taking the last free seat at the common table.", type: "Person" }],
    prevNarration: "A woman in road-stained wool sets her bowl down across from you and swings a leg over the bench, the only free seat left in the crowded room. She pulls back her hood, catches your eye across the table, and reaches for the salt.",
    action: "I nod to her and ask where she's headed.",
  },
  {
    name: "ferry-boarding",
    entities: [{ name: "Oskar", description: "A river ferryman working a rope crossing; paid, and about to cast off.", type: "Person" }],
    prevNarration: "The ferryman pockets your coin without counting it and turns to the mooring rope, working the knot loose with two thick fingers. He glances back over his shoulder at you, then at the flat brown water.",
    action: "I step aboard and ask how long the crossing takes.",
  },
  {
    name: "intro",
    intro: true,
    entities: [{ name: "Sedge", description: "A weathered fisherwoman mending a net on the jetty.", type: "Person" }],
    prevNarration: "Out on the jetty a woman sits on an upturned crate, a great tangle of net across her knees. She looks up as your boots sound on the boards and lets the needle rest.",
    action: "I tell her my name and ask for hers.",
  },
];

const SAMPLER = { summary: { temperature: 0 }, thinking: { temperature: 0.4, repetition_penalty: 1 } };

// `run` offsets the seed, so repeat runs are distinct samples and run r pairs across arms.
async function call(stage, sys, messages, maxTokens, run = 0) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const body = {
    model, messages: [{ role: "system", content: sys }, ...messages], max_tokens: maxTokens,
    reasoning_effort: "none", stream: false, ...(SAMPLER[stage] ?? {}),
  };
  if (seed) body.seed = Number(seed) + run;
  const res = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const j = await res.json();
  return (j.choices?.[0]?.message?.content ?? "").trim();
}

const NAME_RE = new RegExp(`\\b${PERSONA.name}\\b`, "g");
const QUOTE_RE = /("[^"]{2,}"|[“][^”]{2,}[”])/g;
const PC_TIC_RE = /(silver hair|silver of your hair|silver in your hair|ink[- ]stain\w*|ink beneath|mapmaker|map[- ]?case|cartographer)/gi;
const BOLD_RE = /\*\*[^*]+\*\*/g;
const words = (t) => (t.match(/\b[\w'’-]+\b/g) || []).length;

function scoreNarration(out, c) {
  const quotes = [...out.matchAll(QUOTE_RE)];
  const inQuotes = quotes.reduce((n, m) => n + ((m[0].match(NAME_RE) || []).length), 0);
  const all = (out.match(NAME_RE) || []).length;
  // A quote the player speaks is the only place the player's own name belongs before anyone learns it.
  const npcQuotes = quotes.filter((m) => !/\byou\b/i.test(out.slice(Math.max(0, m.index - 40), m.index)));
  const npcName = npcQuotes.reduce((n, m) => n + ((m[0].match(NAME_RE) || []).length), 0);
  return {
    strangerName: c.intro ? 0 : (npcName > 0 ? 1 : 0),
    thirdPerson: all - inQuotes > 0 ? 1 : 0,
    introName: c.intro ? (all > 0 ? 1 : 0) : 0,
    npcSpoke: npcQuotes.length > 0 ? 1 : 0,
    pcTic: (out.match(PC_TIC_RE) || []).length,
    bold: (out.match(BOLD_RE) || []).length,
    words: words(out),
  };
}

const STAGES = {
  narration: {
    sys: (grab) => grab("defaultSystemPrompt"),
    user: (grab, c) => render(grab("defaultNarrationUserPrompt"), { "<PLAYER ACTION>": c.action }),
    history: (c) => [{ role: "assistant", content: c.prevNarration }],
    cases: CASES,
    runs,
    max: 380,
    score: scoreNarration,
  },
  choices: {
    sys: (grab) => grab("defaultChoicesPrompt"),
    user: (grab, c) => render(grab("defaultChoicesUserPrompt"), { "<NARRATION>": c.prevNarration }),
    cases: CASES.filter((c) => ["shared-table", "gate-guard"].includes(c.name)),
    runs: auxRuns,
    max: 200,
    score: (out) => {
      const lines = out.split("\n").map((l) => l.trim()).filter(Boolean);
      return {
        iLines: lines.length ? lines.filter((l) => /^I\b/.test(l)).length / lines.length : 0,
        nameInOptions: (out.match(NAME_RE) || []).length > 0 ? 1 : 0,
      };
    },
  },
  summary: {
    sys: (grab) => grab("defaultSummaryPrompt"),
    user: (grab, c) => render(grab("defaultSummaryUserPrompt"), { "<PLAYER ACTION>": c.action, "<NARRATION>": c.prevNarration }),
    cases: CASES.filter((c) => ["ferry-boarding", "market-browse"].includes(c.name)),
    runs: auxRuns,
    max: 120,
    score: (out) => ({
      you: /\byou(r)?\b/i.test(out) ? 1 : 0,
      name: (out.match(NAME_RE) || []).length > 0 ? 1 : 0,
    }),
  },
  // The precall planner: the same Cast contract as the director, over the story so far.
  thinking: {
    sys: (grab) => grab("defaultThinkingPrompt"),
    user: (_grab, c) => c.action,
    history: (c) => [{ role: "assistant", content: c.prevNarration }],
    cases: CASES.filter((c) => ["shared-table", "tavern-arrival"].includes(c.name)),
    runs: auxRuns,
    max: 260,
    score: (out) => STAGES.director.score(out),
  },
  director: {
    sys: (grab) => grab("defaultDirectorPrompt"),
    user: (grab, c) => render(grab("defaultDirectorUserPrompt"), { "<PLAYER ACTION>": c.action, "<NARRATION>": c.prevNarration }),
    cases: CASES.filter((c) => ["shared-table", "tavern-arrival"].includes(c.name)),
    runs: auxRuns,
    max: 260,
    score: (out) => {
      const bullets = out.split("\n").map((l) => l.trim()).filter((l) => l.startsWith("- "));
      return {
        pcFirst: /^- Player Character\b/i.test(bullets[0] ?? "") ? 1 : 0,
        pcRecast: bullets.slice(1).some((b) => new RegExp(`^- ${PERSONA.name}\\b`).test(b)) ? 1 : 0,
      };
    },
  },
};

const arms = { A: grabFrom(sourceA), B: grabFrom(sourceB) };
console.log(`Persona probe · ${endpoint} · "${model}" · narration ${runs}/case · aux ${auxRuns}/case\n`);
await call("narration", "Reply with OK.", [{ role: "user", content: "warm up" }], 4).catch(() => {});

const summary = {};
for (const [stageName, stage] of Object.entries(STAGES)) {
  if (only && only !== stageName) continue;
  for (const arm of ["A", "B"]) {
    if (armOnly && armOnly !== arm) continue;
    const grab = arms[arm];
    const totals = {};
    let n = 0;
    for (const c of stage.cases) {
      for (let r = 0; r < stage.runs; r++) {
        const values = contextValues(arm, c);
        const sys = render(stage.sys(grab), values);
        if (arm === "B" && !sys.includes(PERSONA.name)) throw new Error(`${stageName}: arm B carries no persona`);
        let out;
        try {
          out = await call(stageName, sys, [...(stage.history?.(c) ?? []), { role: "user", content: stage.user(grab, c) }], stage.max, r);
        } catch (e) { console.log(`  ${stageName} ${arm} ${c.name} #${r + 1} ERROR ${e.message}`); continue; }
        const s = stage.score(out, c);
        n++;
        for (const [k, v] of Object.entries(s)) totals[k] = (totals[k] ?? 0) + v;
        console.log(`  ${stageName} ${arm} ${c.name} #${r + 1} ${JSON.stringify(s)}`);
        console.log(out.split("\n").filter(Boolean).map((l) => "      " + l).join("\n"));
      }
    }
    summary[`${stageName} ${arm}`] = { n, ...Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, +(v / Math.max(n, 1)).toFixed(2)])) };
  }
}
console.log("\n==== means per run (flags are rates) ====");
for (const [k, v] of Object.entries(summary)) console.log(`${k.padEnd(14)} ${JSON.stringify(v)}`);
