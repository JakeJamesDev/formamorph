// Over-fire probe — the false-positive guard for the fuse dialogue rule (B+fuse ship candidate).
// Fuse says "the more physical the moment, the more they voice it"; this checks it does NOT inject
// speech where there is nobody to speak. Cases: truly empty scenes (solo action, no entities) and a
// mute-companion scene (an animal present). Correct result: quote count ~0 in both arms; any quotes
// in the fuse arm beyond the shipped arm = over-fire. User turns are bare first-person (format B,
// matching the candidate config).
//
//   node overfire-probe.mjs [--endpoint URL] [--model default] [--runs 6] [--max 500] [--only ford]
//
// The fuse arm applies the same replacement the format-arms probe ships (it matches the live bullet).

import { QUOTE_RE, grab } from "./planner-probe-lib.mjs";

const args = process.argv.slice(2);
const argVal = (f, d = null) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const endpoint = argVal("--endpoint", "https://api.lyonade.net/v1/chat/completions");
const model = argVal("--model", "default");
const runs = Number(argVal("--runs", "6"));
const maxTokens = Number(argVal("--max", "500"));
const only = argVal("--only");
const token = argVal("--token", process.env.PROBE_TOKEN || "");
const verbose = args.includes("--verbose");

const WORLD = "A quiet river-country of fens, fords, and half-abandoned waystations. Travel is slow, weather is real, and most dangers are mundane - deep water, rotten timber, cold nights.";
const TRAIT = "- **Identity:** Wren, a traveling mapmaker";

const FUSE_RULE = "- Characters speak through what they do: their actual words land as quoted dialogue woven into their movements, and the more physical the moment, the more they voice it - urging, teasing, asking for what they want next. Their words respond to what the player just said or did and carry the scene onward.\n";

function fillSystem(narr, entitiesMd, location) {
  return narr
    .replaceAll("<LENGTH GUIDANCE>", "Write at most 6 short paragraphs.")
    .replaceAll("<MARKDOWN GUIDANCE>", "Write plain prose - no headings, lists, or tables.")
    .replaceAll("<WORLD DESCRIPTION>", WORLD)
    .replaceAll("<DICTIONARY|before>", "N/A")
    .replaceAll("<STATS DESCRIPTION|descriptions.markdown>", "N/A")
    .replaceAll("<TRAITS DESCRIPTION|markdown>", TRAIT)
    .replaceAll("<NOTES>", "None")
    .replaceAll("<LOCATION|markdown>", `- **name:** ${location}`)
    .replaceAll("<LOCATION|sublocations.summary.markdown>", "N/A")
    .replaceAll("<LOCATION|reachable.summary.markdown>", "N/A")
    .replaceAll("<ENTITIES|markdown>", entitiesMd)
    .replaceAll("<ENTITIES|sublocations.markdown>", "N/A")
    .replaceAll("<ENTITIES|reachable.summary.markdown>", "N/A")
    .replaceAll("<DICTIONARY>", "N/A");
}

const SHIPPED = grab("defaultSystemPrompt");
const FUSED = SHIPPED.replace(/- When characters are present, they speak[^\n]*\n/, FUSE_RULE)
  .replace(/ending on a concrete image, action, or spoken line/, "ending on a spoken line or concrete image");
if (FUSED === SHIPPED) throw new Error("fuse patterns did not match the live prompt");

// Empty and mute scenes: physical, effortful actions with NOBODY to talk to — fuse's exact over-fire bait.
const CASES = [
  {
    name: "ford",
    entities: "N/A",
    location: "The Gloamwater Ford",
    prev: "The ford is wider than it looked from the rise, the water running fast and gray over a bed of slick stones. Your breath fogs. On the far bank, willows lean over the current; nothing moves but the water.",
    action: "I hitch my pack higher, take the tar-black guide rope in both hands, and haul myself into the current.",
  },
  {
    name: "ruin-climb",
    entities: "N/A",
    location: "The Broken Stair",
    prev: "The watchtower's stair has sheared away, leaving a chimney of tumbled blocks. High above, a gap of pale sky shows through the fallen roof. The stones are furred with moss and cold under your palms.",
    action: "I wedge my boot into the first gap and start to climb, testing each block before I trust it.",
  },
  {
    name: "night-camp",
    entities: "N/A",
    location: "A Fen Hummock",
    prev: "The light is gone by the time you find dry ground - a low hummock ringed by black water. Wind moves in the reeds. Your hands ache with cold as you unroll your kit.",
    action: "I strike sparks into the tinder and shelter the little flame with my body until it takes.",
  },
  {
    name: "mute-mule",
    entities: "- **Bracken** (Animal): A shaggy pack-mule, patient and footsore, who has carried Wren's gear since spring.",
    location: "The Corduroy Causeway",
    prev: "The causeway's split logs are half-sunk and greasy with rain. Bracken balks at the first gap, ears flat, hooves planted. The mule's flanks heave; the load shifts as he backs a step.",
    action: "I brace my shoulder against Bracken's haunch and heave, guiding his hooves onto the sound timber.",
  },
  {
    name: "cold-swim",
    entities: "N/A",
    location: "The Drowned Cellar",
    prev: "The cellar is flooded to the waist, black water skinned with dust. Somewhere under it, the strongbox the notice described. Your lantern light swings over the surface; the cold comes through your boots at the first step.",
    action: "I fill my lungs, duck under the freezing water, and feel along the sunken shelves.",
  },
];

async function call(sys, c) {
  const messages = [
    { role: "system", content: sys },
    { role: "user", content: "START GAME" },
    { role: "assistant", content: c.prev },
    { role: "user", content: c.action }, // format B: bare first-person action
  ];
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(endpoint, {
    method: "POST", headers,
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, reasoning_effort: "none", stream: false }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return ((await res.json()).choices?.[0]?.message?.content ?? "").trim();
}

const cases = CASES.filter((c) => !only || c.name === only);
console.log(`overfire — ${cases.length} cases × ${runs} runs × shipped/fuse · ${model} @ ${endpoint}`);

for (const c of cases) {
  const row = { shipped: { q: 0, turns: 0, w: 0 }, fuse: { q: 0, turns: 0, w: 0 } };
  const jobs = [];
  for (let r = 0; r < runs; r++)
    for (const [arm, sys] of [["shipped", fillSystem(SHIPPED, c.entities, c.location)], ["fuse", fillSystem(FUSED, c.entities, c.location)]])
      jobs.push(call(sys, c).then((text) => {
        const quotes = text.match(QUOTE_RE) || [];
        row[arm].q += quotes.length;
        row[arm].turns += quotes.length ? 1 : 0;
        row[arm].w += (text.match(/\S+/g) || []).length;
        if (verbose && quotes.length) console.log(`  [${c.name} ${arm}] ${quotes.join(" · ").slice(0, 160)}`);
      }).catch((e) => console.error(`  [${c.name} ${arm}] ${e.message}`)));
  await Promise.all(jobs);
  const fmt = (a) => `quotes ${a.q} (turns ${a.turns}/${runs}, words ${Math.round(a.w / runs)})`;
  console.log(`${c.name.padEnd(11)} shipped: ${fmt(row.shipped)}   fuse: ${fmt(row.fuse)}`);
}
