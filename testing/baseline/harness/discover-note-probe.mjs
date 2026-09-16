// Character-note probe: A/B of the discover-entity request. Arm A is the request as of a baseline commit
// (the old first-note prompt and message, and the old rewrite prompt and message). Arm B is the request the
// shipped discover pass builds now, one prompt and one template for both. Each case is standard prose that
// names a character the world never defined; rewrite cases add later material that revises the first
// impression. The reply goes through the shipped cleaner before scoring.
//
// Metrics per reply: empty after cleaning, "you"/"your" in the note, sentence count outside 2-3, the name
// missing, a prompt label echoed in the raw reply, cut by the cap, words. Rewrite cases add: follows the
// later material (its keyword appears) and keeps the stale trait (the revised keyword appears).
//
// Unpinned stage: no temperature is sent, so the endpoint's own value applies, as in the app.
//
// Usage:  node discover-note-probe.mjs [--endpoint URL] [--model default] [--runs 12] [--max 200]
//                                      [--base acedfd76] [--seed 7] [--only name] [--rewrites] [--arms A,B]
//                                      [--out file]

import { writeFile, mkdtemp } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const HARNESS = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HARNESS, "../../..");
const args = process.argv.slice(2);
const val = (f, d = null) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const endpoint = val("--endpoint", "https://api.lyonade.net/v1/chat/completions");
const model = val("--model", "default");
const runs = Number(val("--runs", "12"));
const maxTokens = Number(val("--max", "200"));
const base = val("--base", "acedfd76");
const seed = val("--seed");
const only = val("--only");
const arms = val("--arms", "A,B").split(",");
const out = val("--out");
const token = val("--token", process.env.PROBE_TOKEN || "");
const concurrency = Number(val("--concurrency", "4"));

// Arm B: the shipped pass and cleaner, bundled so the probe calls them rather than copying them.
const tmp = await mkdtemp(path.join(os.tmpdir(), "fm-discover-"));
const entry = path.join(tmp, "entry.ts");
await writeFile(entry, [
  `export { discoverEntityPass } from '@/lib/turnPipeline/turnPasses';`,
  `export { emptyTurnMaterial } from '@/lib/turnPipeline/turnPlan';`,
  `export { cleanDiscoveredDescription, DISCOVER_NAME_LABEL, DISCOVER_PASSAGE_LABEL, DISCOVER_LATER_LABEL } from '@/lib/runtimeCharacters';`,
  `export { defaultDiscoverEntityPrompt, defaultDiscoverEntityUserPrompt } from '@/components/game/GamePrompts';`,
].join("\n"));
const bundle = path.join(tmp, "bundle.mjs");
await build({
  entryPoints: [entry], outfile: bundle, bundle: true, format: "esm", platform: "node", logLevel: "silent",
  alias: { "@": path.join(REPO, "src") },
});
const lib = await import(`file://${bundle.replace(/\\/g, "/")}`);

// Arm A: the baseline prompts, read from the baseline commit. Its two messages were assembled in code as
// below (turnPasses.discoverUserMessage and discoveredRegen.buildRegenUserMessage at that commit).
const baseSource = execFileSync("git", ["show", `${base}:src/components/game/GamePrompts.ts`], { cwd: REPO, encoding: "utf8" });
const grabBase = (name) => {
  const at = baseSource.indexOf(`${name} = \``);
  if (at === -1) throw new Error(`missing ${name} at ${base}`);
  const from = baseSource.indexOf("`", at) + 1;
  return baseSource.slice(from, baseSource.indexOf("`;", from));
};
const OLD_DISCOVER = grabBase("defaultDiscoverEntityPrompt");
const OLD_REGEN = grabBase("defaultRegenEntityPrompt");
const OLD_LABELS = ["The passage they appeared in:", "The passage they first appeared in:", "What the story has shown of them since:"];
const armA = (c) => c.later
  ? {
    system: OLD_REGEN,
    user: [`Character name: ${c.name}`, `The passage they first appeared in:\n${c.passage}`, `What the story has shown of them since:\n${c.later.join("\n\n")}`].join("\n\n"),
  }
  : { system: OLD_DISCOVER, user: `Character name: ${c.name}\n\nThe passage they appeared in:\n${c.passage}` };

const armB = (c) => {
  const input = {
    action: "", isGameStarted: true, destinationCount: 0, locationCount: 1, hasCurrentLocation: true,
    settings: { describeCharacters: true, concurrentTurnRequests: true },
    prompts: { discoverEntity: lib.defaultDiscoverEntityPrompt, discoverEntityUser: lib.defaultDiscoverEntityUserPrompt },
  };
  const material = {
    ...lib.emptyTurnMaterial({ action: "", effectiveAction: "", turnId: "t", baseCtx: {}, destinations: [] }),
    narration: c.passage,
    subject: { name: c.name, laterMaterial: c.later },
  };
  const request = lib.discoverEntityPass.buildRequest(input, material);
  return { system: request.systemPrompt, user: request.messages[0].content };
};
const NEW_LABELS = [lib.DISCOVER_NAME_LABEL, lib.DISCOVER_PASSAGE_LABEL, lib.DISCOVER_LATER_LABEL];

const CASES = [
  {
    name: "Tamsin",
    passage: 'A girl of perhaps twelve slips out from behind the fish barrels, barefoot, a gull feather tucked behind one ear. "You\'re not from the Landing," says Tamsin, squinting up at you. "Nobody from the Landing wears boots that clean." She holds out a grubby palm, as if a toll were owed.',
  },
  {
    name: "Brother Oswin",
    passage: "The chapel door opens before you knock. Brother Oswin stands in the gap, a broad man gone soft at the middle, his grey habit patched at both elbows. He looks past you at the road, then at the sky, and only then at your face. \"Travelers come at dusk for one of two reasons,\" he says mildly, and steps aside to let you in.",
  },
  {
    name: "Keel",
    passage: "At the far end of the bar a woman with a shaved head and a sailor's tattoos sits with her back to the wall. The others call her Keel. She has not touched her drink; she is watching the door, and when you come in her eyes go to your hands before they go anywhere else.",
  },
  {
    name: "Master Pell",
    passage: "The ropewalk is loud with the creak of the twisting frames. Master Pell moves among his apprentices with a cane he never leans on, rapping a knuckle here, correcting a grip there. He notices you at the door, frowns at the interruption, and waves you in without breaking his count.",
  },
  {
    name: "the Widow Ash",
    passage: "The house at the end of the lane has every shutter closed. When the door finally opens, the Widow Ash peers out: tiny, white-haired, wrapped in three shawls, a ring of heavy keys at her belt. \"If it's about the rent, he's dead,\" she says, \"and if it's about the dog, it bit him first.\"",
  },
  {
    name: "Dace",
    passage: "You hear the ferry before you see it. The ferryman's boy, Dace, stands at the bow with a long pole, lanky and sunburnt, singing something off-key to the rhythm of his strokes. He grins when he sees you waiting and shouts that the crossing costs double after dark.",
  },
  {
    name: "Corva",
    passage: "Corva runs the stall by the well, a cheerful, round-faced woman who calls every customer love and presses a free bun on anyone who looks tired. She laughs at your accent and asks where you're headed.",
    later: [
      "Corva was seen at midnight handing a sealed letter to a rider in the colors of the Magistrate. When you asked her about it she went quiet and cold, and said a stall needs friends in high places.",
      "Corva warned you, without her usual smile, to stop asking about the missing ledgers. Her hand stayed on the knife she uses to cut bread.",
    ],
    followRe: /informant|spy|magistrate|authorit|power|politic|cold|guarded|secret|warn|threat|knife|facade|conceal|beneath|hidden|dangerous/i,
    staleRe: /\bcheerful\b/i,
  },
  {
    name: "Hobb",
    passage: "Hobb, the old ferryman, sits hunched in his boat, a blanket over his knees. He moves slowly and speaks slower, and he takes your coin with a hand that trembles.",
    later: [
      "Hobb vaulted the rail of his own boat and hauled two men out of the flood current, one under each arm, without so much as a grunt.",
      "The trembling, Hobb admitted, was for show: travelers tip a frail old man better than a strong one.",
    ],
    followRe: /strong|strength|\bact|feign|pretend|for show|decept|sly|shrewd|canny|facade|conceal|beneath|hidden|capable|powerful/i,
    staleRe: /\bfrail\b/i,
  },
  {
    name: "Ysolde",
    passage: "Ysolde is the innkeeper's daughter, quiet and shy, who keeps her eyes on the floorboards and slips away to the kitchen whenever anyone speaks to her.",
    later: [
      "Ysolde stood on a table in the common room and argued down three drunk soldiers until they paid their bill and left.",
    ],
    followRe: /bold|fierce|confident|outspoken|stood|argu|assert|sharp|courage|spirit|backbone|steel|forceful|determin/i,
    staleRe: /\bshy\b/i,
  },
  {
    name: "Garrick",
    passage: "A tall guardsman named Garrick checks your papers at the gate. His uniform is spotless and his manner is correct, if chilly.",
    later: [
      "Garrick lost his post after the fire. You found him drinking alone at the docks in a stained coat, and he told you he had never wanted the uniform.",
    ],
    followRe: /former|once|dismiss|lost|disgrace|drink|stained|no longer|fallen|disillusion|never wanted/i,
    staleRe: /\bspotless\b/i,
  },
]
  .filter((c) => !only || c.name.toLowerCase().includes(only.toLowerCase()))
  .filter((c) => !args.includes("--rewrites") || c.later);

async function call(system, user, runSeed) {
  const body = {
    model,
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
    max_tokens: maxTokens,
    reasoning_effort: "none",
    ...(runSeed !== null ? { seed: runSeed } : {}),
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      const json = await res.json();
      const choice = json.choices?.[0] ?? {};
      return { text: choice.message?.content ?? "", cut: choice.finish_reason === "length" };
    } catch (error) {
      if (attempt === 2) return { text: "", cut: false, error: String(error) };
    }
  }
}

const sentences = (text) => (text.match(/[^.!?]+[.!?]+(["')\]]*)(\s|$)/g) ?? []).length;

function score(c, raw, cut) {
  let note = lib.cleanDiscoveredDescription(raw, c.name);
  for (const label of OLD_LABELS) {
    const at = note.indexOf(label);
    if (at !== -1) note = note.slice(0, at).trim();
  }
  const n = sentences(note);
  const firstName = c.name.replace(/^the /i, "").split(" ").pop();
  return {
    empty: !note,
    you: /\byou(r|rs|rself)?\b/i.test(note),
    range: note ? n < 2 || n > 3 : false,
    noName: note ? !note.toLowerCase().includes(firstName.toLowerCase()) : false,
    echo: [...OLD_LABELS, ...NEW_LABELS].some((label) => raw.includes(label)),
    cut,
    words: note.split(/\s+/).filter(Boolean).length,
    ...(c.later ? { follows: c.followRe.test(note), stale: c.staleRe.test(note) } : {}),
    note,
  };
}

const jobs = [];
for (const c of CASES) {
  for (const arm of arms) {
    const req = arm === "A" ? armA(c) : armB(c);
    for (let r = 0; r < runs; r++) jobs.push({ c, arm, req, runSeed: seed !== null ? Number(seed) + r : null });
  }
}

// Warm-up, so a cold model load does not land on the first case.
await call("Reply with one word.", "Ready?", null);

const results = [];
let next = 0;
await Promise.all(Array.from({ length: concurrency }, async () => {
  while (next < jobs.length) {
    const job = jobs[next++];
    const reply = await call(job.req.system, job.req.user, job.runSeed);
    results.push({ case: job.c.name, arm: job.arm, rewrite: !!job.c.later, error: reply.error, raw: reply.text, ...score(job.c, reply.text, reply.cut) });
  }
}));

const rate = (rows, key) => `${rows.filter((r) => r[key]).length}/${rows.length}`;
const mean = (rows, key) => (rows.reduce((s, r) => s + r[key], 0) / Math.max(1, rows.length)).toFixed(1);
console.log(`endpoint ${endpoint} model ${model} runs ${runs} base ${base}`);
for (const c of CASES) {
  for (const arm of arms) {
    const rows = results.filter((r) => r.case === c.name && r.arm === arm);
    const extra = c.later ? ` follows ${rate(rows, "follows")} stale ${rate(rows, "stale")}` : "";
    console.log(`${c.name.padEnd(14)} ${arm}  empty ${rate(rows, "empty")} you ${rate(rows, "you")} range ${rate(rows, "range")} noName ${rate(rows, "noName")} echo ${rate(rows, "echo")} cut ${rate(rows, "cut")} words ${mean(rows, "words")}${extra}`);
    if (args.includes("--verbose")) rows.forEach((r) => console.log(`    ${r.note}`));
  }
}
for (const scope of ["first", "rewrite"]) {
  for (const arm of arms) {
    const rows = results.filter((r) => r.arm === arm && (scope === "rewrite") === r.rewrite);
    if (!rows.length) continue;
    const extra = scope === "rewrite" ? ` follows ${rate(rows, "follows")} stale ${rate(rows, "stale")}` : "";
    console.log(`TOTAL ${scope.padEnd(7)} ${arm}  empty ${rate(rows, "empty")} you ${rate(rows, "you")} range ${rate(rows, "range")} noName ${rate(rows, "noName")} echo ${rate(rows, "echo")} cut ${rate(rows, "cut")} words ${mean(rows, "words")}${extra} errors ${rate(rows, "error")}`);
  }
}
if (out) await writeFile(out, JSON.stringify(results, null, 2));
