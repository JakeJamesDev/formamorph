// Planner probe #3 — ENTITY-ATTRIBUTE FIDELITY. Reproduces the session defect where an authored, defining
// entity trait (there: Sarah's "SEX: Futanari") was dropped by the planner turn after turn, so it narrated a
// generic body until the player forced it. This probe uses SFW distinctive traits (a prosthetic arm, wings, a
// scar): each is in the planner's ENTITIES context, and the player's action makes it directly relevant. A
// faithful planner surfaces the authored trait in its Scene/Cast/Beats; a lossy one defaults to generic.
// Metric per run: trait surfaced (any of the trait's `must` cues appears in the plan).
//
// Includes one negative control (`irrelevant-trait`) where the trait need NOT appear — a fix must not shoehorn
// the trait into every unrelated turn.
//
// Usage:  node planner-entity-fidelity-probe.mjs [--model cydonia-24b-v4.3@q4_k_m] [--runs 3] [--only wings]

import {
  parseArgs, renderThinkingSys, buildThinkingUser, callPlanner, parsePlan, printOut,
} from "./planner-probe-lib.mjs";

const WORLD = "A grounded, character-driven roleplay. Characters have specific, authored physical features that are true every scene and must be honored when relevant.";
const LOC = "Sarah's apartment";

const CASES = [
  {
    name: "prosthetic-arm",
    entity: { name: "Sarah", description: "AGE: 27. A warm, confident woman. Her left arm below the elbow is a sleek matte-black robotic prosthetic; the joints whir faintly when she moves it.", type: "Person" },
    action: "I take her left hand in both of mine and slowly run my thumb across the back of it.",
    must: ["prosthetic", "robotic", "matte-black", "matte black", "metal", "synthetic", "joints", "whir"],
    note: "The hand the player touches IS the prosthetic — the plan must reflect it, not a warm human hand.",
  },
  {
    name: "wings",
    entity: { name: "Sarah", description: "AGE: 27. Confident and warm. She has a pair of large charcoal-gray feathered wings that fold against her back.", type: "Person" },
    action: "I step behind her and reach out to rest my hands where her shoulders meet her back.",
    must: ["wing", "wings", "feather", "feathered", "plumage"],
    note: "Reaching for her upper back means meeting the wings — the plan should surface them.",
  },
  {
    name: "throat-scar",
    entity: { name: "Sarah", description: "AGE: 27. Striking and self-possessed. A long pale scar runs from just below her left ear down the side of her throat.", type: "Person" },
    action: "I cup the side of her face and tilt it toward the light to look at her closely.",
    must: ["scar", "scarred", "pale line", "old wound"],
    note: "Looking closely at her face/throat should surface the authored scar.",
  },
  {
    name: "irrelevant-trait",   // NEGATIVE CONTROL — trait need not appear for an unrelated action
    entity: { name: "Sarah", description: "AGE: 27. Confident and warm. She has a pair of large charcoal-gray feathered wings that fold against her back.", type: "Person" },
    action: "I ask her what time the last bus leaves.",
    must: ["wing", "wings", "feather"],
    note: "CONTROL: a mundane logistics question — the plan need NOT force the wings in.",
    control: true,
  },
];

const opts = parseArgs(process.argv);
const pick = CASES.filter((c) => !opts.only || c.name.includes(opts.only));
console.log(`Planner ENTITY-ATTRIBUTE FIDELITY · ${opts.endpoint} · "${opts.model}" · ${pick.length} case(s) · ${opts.runs} run(s)/case\n`);

const totals = { runs: 0, surfaced: 0, controlRuns: 0, controlSurfaced: 0 };
for (const c of pick) {
  const sys = renderThinkingSys({ world: WORLD, playerTrait: "Jessica, an adult woman", location: LOC, entities: [c.entity] });
  const user = buildThinkingUser("", c.action);
  let hit = 0;
  console.log(`\n######## ${c.name} — ${c.note}`);
  for (let r = 0; r < opts.runs; r++) {
    let out, err = null;
    try { out = await callPlanner({ ...opts, seed: opts.seed + r }, sys, user); }
    catch (e) { err = String(e.message || e); }
    totals.runs++;
    if (err) { console.log(`  #${r + 1} ERROR: ${err}`); continue; }
    const hay = out.toLowerCase();
    const surfaced = c.must.some((m) => hay.includes(m.toLowerCase()));
    if (c.control) { totals.controlRuns++; if (surfaced) totals.controlSurfaced++; }
    else { if (surfaced) { hit++; totals.surfaced++; } }
    const label = c.control ? (surfaced ? "forced-in" : "omitted (ok)") : (surfaced ? "SURFACED" : "DROPPED ");
    console.log(`  #${r + 1} ${label}`);
    console.log(printOut(out));
  }
  if (!c.control) console.log(`  -> ${c.name}: surfaced ${hit}/${opts.runs}`);
}
const nonControl = totals.runs - totals.controlRuns;
console.log(`\n==== trait surfaced ${totals.surfaced}/${nonControl} relevant runs · control forced-in ${totals.controlSurfaced}/${totals.controlRuns} (lower is better) ====`);
