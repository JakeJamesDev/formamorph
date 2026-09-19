// World persona probe. The player plays one of the world's own entities, and the scene holds entities whose
// text names that entity. Both arms use the working-tree prompts and the same persona block:
//   A: the block alone, as a library persona renders it.
//   B: the block plus the known-person line from src/lib/personaContext.ts.
// So the line is the only variable.
//
// Metrics, per stage:
//   narration  known        an NPC says the persona's name in dialogue (want up: they know this person)
//              familiar     the prose shows the NPC knows the player (recognizes, usual, again, your brother…)
//              tie          the output names the tie the NPC's text holds (brother, debt, table, post)
//              stranger     an NPC treats the player as someone new (want 0)
//              third-person the narrator names the persona outside a quote (want 0; second person holds)
//              npc-spoke / words — regression checks
//   director / thinking   pc-first   Cast opens with "Player Character" (want all)
//                         pc-recast  the persona's name cast as a separate bullet (want 0)
//
// Usage:  node world-persona-probe.mjs [--endpoint URL] [--model default] [--runs 3] [--aux-runs 3]
//                                      [--only narration|director|thinking] [--arm A|B] [--seed N]
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
const auxRuns = Number(argVal("--aux-runs", "3"));
const only = argVal("--only");
const armOnly = argVal("--arm");
const token = argVal("--token", process.env.PROBE_TOKEN || "");
const seed = argVal("--seed");

const prompts = await readFile(path.join(REPO_ROOT, "src/components/game/GamePrompts.ts"), "utf8");
const grab = (name) => {
  const at = prompts.indexOf(name + " = `");
  if (at === -1) throw new Error("missing " + name);
  const from = prompts.indexOf("`", at) + 1;
  return prompts.slice(from, prompts.indexOf("`;", from)).trimEnd();
};
// The line as the app writes it, read from source so the probe cannot drift from it.
const lineSource = await readFile(path.join(REPO_ROOT, "src/lib/personaContext.ts"), "utf8");
const lineTemplate = lineSource.match(/knownPersonaLine = \(name: string\): string =>\s*`([^`]+)`/)?.[1];
if (!lineTemplate) throw new Error("missing knownPersonaLine");
const knownLine = (name) => lineTemplate.replaceAll("${name}", name);

const { world } = JSON.parse(await readFile(path.resolve(HARNESS_DIR, "../planning-cases.json"), "utf8"));

const PERSONA = {
  name: "Maren",
  pronouns: "she/her",
  description: "The harbor's pilot, weathered and sure-footed, who has guided boats past the shoals since she was young.",
};
const personaBlock = (arm) =>
  `- **${PERSONA.name}**\n  - **pronouns:** ${PERSONA.pronouns}\n  - **description:** ${PERSONA.description}\n`
  + (arm === "B" ? `${knownLine(PERSONA.name)}\n` : "");
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
  return {
    "<LENGTH GUIDANCE>": "Aim for two to four tight paragraphs; land the moment and stop.",
    "<LANGUAGE>": "",
    "<WORLD DESCRIPTION>": world,
    "<DICTIONARY|before>": "N/A",
    "<DICTIONARY>": "N/A",
    "<STATS DESCRIPTION|descriptions.markdown>": "- **Resolve:** steady",
    "<TRAITS DESCRIPTION|markdown>": "N/A",
    "<PERSONA|markdown>": personaBlock(arm),
    "<PERSONA|name>": personaName,
    "<PERSONA|name.markdown>": personaName,
    "<NOTES>": "None",
    "<LOCATION|markdown>": `- **name:** ${c.location}`,
    "<LOCATION|summary.markdown>": `- **name:** ${c.location}`,
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

// Each NPC's authored text names the persona with one tie. `tie` matches that tie in the output.
const CASES = [
  {
    name: "net-shed",
    location: "The Net Shed",
    entities: [{ name: "Tobin", description: "Maren's younger brother, who mends nets in the shed and never finishes a job on time.", type: "Person" }],
    prevNarration: "The net shed smells of tar and wet rope. A young man sits cross-legged among the coils, a half-mended net across his lap, and looks up as the door scrapes open.",
    action: "I step inside and ask him how the mending is going.",
    tie: /\b(brother|sister|sibling|little brother|big sister)\b/i,
  },
  {
    name: "harbor-office",
    location: "The Harbor Office",
    entities: [{ name: "Old Brisk", description: "The harbormaster. He owes Maren for the night she brought his boat in through a storm, and has never let her pay for a drink since.", type: "Person" }],
    prevNarration: "The harbor office is one cramped room of ledgers and tide charts. An old man in a salt-stiff coat squints over a logbook, then lifts his head at the sound of the door.",
    action: "I walk up to the desk and ask him what the tide is doing tonight.",
    tie: /\b(owe[sd]?|storm|debt|drink|brought (my|his) boat)\b/i,
  },
  {
    name: "tavern-table",
    location: "The Drowned Lantern",
    entities: [{ name: "Wendel", description: "The tavern keeper, who keeps Maren's usual table by the window clear every evening.", type: "Person" }],
    prevNarration: "The tavern is half full and loud with dockhands. Behind the bar, a round-faced man is drying a cup, and he catches sight of you over the heads of the crowd.",
    action: "I push through the crowd to the bar and ask him how the night is going.",
    tie: /\b(usual|table|window|the regular|your seat|your spot)\b/i,
  },
  {
    name: "rival-pier",
    location: "The Long Pier",
    entities: [{ name: "Hask", description: "A pilot who lost the harbor pilot's post to Maren and has not forgiven it.", type: "Person" }],
    prevNarration: "Wind drags at the flags along the long pier. A lean man coiling a line at the end of it straightens up, sees you coming, and his mouth goes flat.",
    action: "I walk to the end of the pier and ask him if the channel is clear.",
    tie: /\b(post|pilot'?s? (job|post|place)|took|stole|lost|forgive|forgiven)\b/i,
  },
];

const SAMPLER = { thinking: { temperature: 0.4, repetition_penalty: 1 } };

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
const FAMILIAR_RE = /\b(recogni[sz]\w*|familiar|usual|as always|again|welcome back|old friend|your (brother|sister)|knows you|known you|back so soon|evening,? (pilot|maren))\b/i;
const STRANGER_RE = /\b(stranger|who are you|new (here|in town|face)|never seen you|don'?t know you|what'?s your name|your name\?)\b/i;
const words = (t) => (t.match(/\b[\w'’-]+\b/g) || []).length;

function scoreNarration(out, c) {
  const quotes = [...out.matchAll(QUOTE_RE)];
  const inQuotes = quotes.reduce((n, m) => n + ((m[0].match(NAME_RE) || []).length), 0);
  const all = (out.match(NAME_RE) || []).length;
  const npcQuotes = quotes.filter((m) => !/\byou\b/i.test(out.slice(Math.max(0, m.index - 40), m.index)));
  const npcText = npcQuotes.map((m) => m[0]).join(" ");
  return {
    known: (npcText.match(NAME_RE) || []).length > 0 ? 1 : 0,
    familiar: FAMILIAR_RE.test(out) ? 1 : 0,
    tie: c.tie.test(out) ? 1 : 0,
    stranger: STRANGER_RE.test(npcText) ? 1 : 0,
    thirdPerson: all - inQuotes > 0 ? 1 : 0,
    npcSpoke: npcQuotes.length > 0 ? 1 : 0,
    words: words(out),
  };
}

const castScore = (out) => {
  const bullets = out.split("\n").map((l) => l.trim()).filter((l) => l.startsWith("- "));
  return {
    pcFirst: /^- Player Character\b/i.test(bullets[0] ?? "") ? 1 : 0,
    pcRecast: bullets.slice(1).some((b) => new RegExp(`^- \\**${PERSONA.name}\\b`).test(b)) ? 1 : 0,
  };
};

const STAGES = {
  narration: {
    sys: () => grab("defaultSystemPrompt"),
    user: (c) => render(grab("defaultNarrationUserPrompt"), { "<PLAYER ACTION>": c.action }),
    history: (c) => [{ role: "assistant", content: c.prevNarration }],
    runs,
    max: 380,
    score: scoreNarration,
  },
  director: {
    sys: () => grab("defaultDirectorPrompt"),
    user: (c) => render(grab("defaultDirectorUserPrompt"), { "<PLAYER ACTION>": c.action, "<NARRATION>": c.prevNarration }),
    runs: auxRuns,
    max: 260,
    score: castScore,
  },
  thinking: {
    sys: () => grab("defaultThinkingPrompt"),
    user: (c) => c.action,
    history: (c) => [{ role: "assistant", content: c.prevNarration }],
    runs: auxRuns,
    max: 260,
    score: castScore,
  },
};

console.log(`World persona probe · ${endpoint} · "${model}" · narration ${runs}/case · aux ${auxRuns}/case\n`);
await call("narration", "Reply with OK.", [{ role: "user", content: "warm up" }], 4).catch(() => {});

const summary = {};
for (const [stageName, stage] of Object.entries(STAGES)) {
  if (only && only !== stageName) continue;
  for (const arm of ["A", "B"]) {
    if (armOnly && armOnly !== arm) continue;
    const totals = {};
    let n = 0;
    for (const c of CASES) {
      for (let r = 0; r < stage.runs; r++) {
        const sys = render(stage.sys(), contextValues(arm, c));
        if (sys.includes(knownLine(PERSONA.name)) !== (arm === "B")) throw new Error(`${stageName}: arm ${arm} has the wrong line state`);
        let out;
        try {
          out = await call(stageName, sys, [...(stage.history?.(c) ?? []), { role: "user", content: stage.user(c) }], stage.max, r);
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
