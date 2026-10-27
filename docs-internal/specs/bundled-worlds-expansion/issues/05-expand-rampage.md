# 05: Expand Rampage

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Spec: ../spec.md (Q4, Q5, Q7, Q8, Q9, Q16, Q20; Size table; Feature assignment)

## What to build

**City Rampage** grows from 6 locations and 9 entities to at least 12 and 16, shows its assigned features, and plays at least as well on the cloud model. The premise holds: title, hook, and the named core cast stay (Q20). Rampage keeps Alert Level's script, the Berserk toggle, and the mutation traits.

- Grow Neonspire into a city: a stadium, the bridge, the subway, the refinery, a suburb, each with its defenders and bystanders.
- A Tool with a live write: the AI logs a landmark the creature destroys, which pins a memory and raises Destruction. The world still plays without it.
- A script that reads the current location's exits to pace the military pursuit, so the chase follows the map.
- **Assigned features:** World Tool with a live write. Script reading exits.
- **Common to every world:** every new location joins the graph by parent or by a Connection with Travel Hints both ways. Every new entity lists its locations and sets `knownIn` where the AI should know of it elsewhere. Lore grows with the map: each new region gets at least one dictionary entry. At least one chip in a Pronouns, Travel Hint or Relationship label field where a roll reads naturally (Q8).
- **Art direction (Q16):** write the world's art-direction line, booru-style, naming medium, palette and mood and never a subject. Put it in this ticket's comments and the spec's Comments. Write `imageTags` for every new location and entity in the same vocabulary.
- **Readme:** "How this world is built" names the features this world now shows.
- Rewrites are allowed where they improve the world (Q4). Follow the `bundled-worlds` skill: read stripped copies, edit by script, preserve ids and existing images, validate every reference. Every new script, Tool handler included, follows the house style.

## Acceptance criteria

- [x] The world has at least 12 locations and 16 entities, every one with `imageTags`, and the stripped diff is ready for review. 13 and 21; the build script checks `imageTags`; diff at `.scratch/bundled-worlds-expansion-05/frames/rampage-stripped.diff`.
- [ ] The world's coverage row claims `tools`, `scriptExits`, `newFieldChips`, and the shared suite is green, including the old-save check at both revisions. The row claims `scriptExits` and `newFieldChips`; `tools` left it by spec ruling (see Comments). `bundledWorlds.test.ts` green; `GameViewer.bundledSaves.test.tsx` rampage rows pass at the pre-refresh and pre-expansion revisions.
- [x] Per-world tests cover each new script's effect, each Tool handler's write, and each gate that must hold, and each is shown to bite by breaking the world file once. `rampageWorld.test.ts`: Pursuit (8) and the Subway Line roll (1); eight world-file mutations, each red (see Comments). The world ships no Tool.
- [x] The probe shows no structural regression and a rubric win or tie over the pre-expansion revision, with 5 or more runs per arm. Numbers go in this ticket's comments. Batch 5, 10 per arm, on the final text: structural tie, rubric 46 to 43.
- [ ] The art-direction line is in this ticket's comments and the spec's Comments. In the comments; sent to the spec session to fold into the spec.
- [x] Fingerprints are regenerated. No changelog fragment: ticket 01's entry covers every world (Q14). `npm run fingerprints` after the last world edit; no fragment.
- [x] Every location has a `canvasPosition` matching the lore, shown in `.scratch/frames/rampage-canvas.png` for the root Group and one frame per child Group, 1280 wide, light theme (Q25). Frames at `.scratch/bundled-worlds-expansion-05/frames/rampage-canvas*.png`, captured with Playwright at 1280 × 900.

## Landed

**Not verified**

- The coverage row does not claim `tools`: the cloud model spills reasoning when this world's Tool is offered on narration or choices, and the stat-pass schema blocks the call (spec ruling f). Drone still shows `tools`.
- The art-direction line is not yet in the spec's Comments: the spec session folds it in from the landing message.
- No cloud run shows a `log_landmark` call in play, since the world ships without it.

**For you**

- For you: read one transcript per opening and judge whether the new places feel like the same world. Final batch, worktree arm: `.scratch/bundled-worlds-expansion-05/frames/rampage-sunset-run1-A.md`, `.scratch/bundled-worlds-expansion-05/frames/rampage-action-run2-A.md`, `.scratch/bundled-worlds-expansion-05/frames/rampage-vasquez-run8-A.md`.
- Judge the thin-turn pattern against the old world's twin runs: `.scratch/bundled-worlds-expansion-05/frames/rampage-thin-run5-A.md` beside `rampage-thin-run5-B-old.md`, and `rampage-thin-run9-A.md` beside `rampage-thin-run9-B-old.md`, in the same folder.
- Check the map reads as the lore: the bay south, downtown and Old Town either side of the river, the base north-west. `.scratch/bundled-worlds-expansion-05/frames/rampage-canvas.png` and the five Group frames beside it.
- Skim the stripped world diff: `.scratch/bundled-worlds-expansion-05/frames/rampage-stripped.diff`.

## Comments

**Art direction (Q16).** `semi-realistic digital painting, cinematic concept art, dramatic high angle, giant scale perspective, hazy daylight, drifting dust and smoke, muted concrete gray and slate blue palette, rust red accents, tense disaster movie mood, high detail`. Matched to the stored root backdrop and thumbnail.

**Rulings (spec session).** Q1: the stateful Pursuit (a hidden stat, Last Sighting and Pursuit Roads pinned from code), distinct from Alert Level. Q2: `log_landmark` On Call, +5 Destruction, once per landmark. Q3: Harbor District stays the one start with its three openings. Then, on new evidence: the Tool to the stat pass (a); then to the choices prompt with one replay round, else (f), land without `tools`, which happened; then the Pursuit line as pressure, as the last rubric lever; then Q25, map positions.

**What changed.**

- **Map.** Seven new places, each nested under its district: Ferry Terminal (Harbor District); Spire Tower, Metro Underground, Harborgate Bridge (Downtown Core); Neonspire Stadium (Old Town); Bayline Refinery (Industrial Yards); Cedar Hollow (Fort Bastion). Nesting keeps the siblings to the five districts, so the exits read as roads.
- **Connections.** Six new, hints both ways: Old Town–Metro, Downtown–Bridge, Bridge–Old Town, Old Town–Stadium, Old Town–Cedar Hollow, Fort–Cedar Hollow. Two old legs now read back the other way ("down the waterfront boulevard", "down the highway interchange").
- **Chip.** A new world placeholder, **Subway Line**, with one placement on both tunnel legs, the Metro's description and its lore entry.
- **Cast.** Twelve new entities: Navy Destroyer, Last Ferry, Rooftop Missile Team, Stranded Commuters, Combat Engineers, Stalled Drivers, Stadium Crowd, Refinery Fire Crew, Artillery Battery, Cedar Hollow Evacuees, Dr. Lena Sorensen, Captain Theo Ward. General Vasquez and Channel 8 set Known In to the city; Ward is Known In nowhere, so his name never brings Aegis-One forward. Vasquez gained pronouns.
- **Pursuit.** A hidden world stat with a Before the AI script: +3 per road in while the creature holds a place, halved on a move, the city root skipped as a road. It pins Last Sighting and Pursuit Roads, read from the leg that points back. Locked against the AI.
- **System prompt.** One Pursuit line: "Pursuit is how tightly the military has the creature boxed in, and Alert Level is how large the response is. The military has the creature's position fixed at {Last Sighting}. Each turn, one unit of the tier Alert Level names reaches the creature by one of these roads: {Pursuit Roads}. Show it arrive and act."
- **Lore.** One Dossier entry per new place. Evacuation Protocol and The Flinch updated.
- **Map positions (Q25).** North up: the bay south, a river between Downtown Core (west bank) and Old Town (east bank), the yards west along the bay, the base north-west. Each place's AI description gained one direction sentence so the words and the map agree.

**Lore-key fix (983f22e5f).** Keys on new entries fired into almost every turn: `metro` matched "metropolis" in the city's summary, `tank farm` matched the yards' summary, and "weakness" in Sorensen's summary pulled in The Flinch. The keys are now proper names, Sorensen's summary is reworded, and the Sorensen and Ward lore entries are gone, since they only repeated their entity text.

**Why the world ships without a Tool.** Cloud `default`, `reasoning_effort: "none"`, non-streamed replays of captured requests, Tool offered against not, interleaved. The no-Tool arm was clean every time.

| Prompt | Case | Spills | Calls | Reply usable |
|---|---|---|---|---|
| Narration, as shipped | vague opening | 7 of 10 | 3 of 10 | |
| Narration, Drone's `lock_target` | vague opening | 0 of 6 | 0 of 6 | |
| Narration, bare one-line Tool | vague opening | 0 of 6 | 0 of 6 | |
| Narration, as shipped | plain roar | 0 of 8 | 8 of 8 (false) | |
| Narration, as shipped | Spire Tower torn down | 0 of 6 | 6 of 6 | |
| Narration, scoped to the player's action | opening / Spire Tower | 5 of 8 / 0 of 8 | 3 of 8 / 8 of 8 | |
| Narration, `enum` of landmark names | opening / roar | 6 of 8 / 1 of 6 | 3 of 8 / 5 of 6 | |
| Stat pass, strict json_schema | Spire Tower, two wordings | 0 of 12 | 0 of 12 | 12 of 12 JSON |
| Stat pass, no schema | Spire Tower | 0 of 4 | 4 of 4 | |
| Choices | plain roar | 6 of 6 | 0 of 6 | 0 of 6 lists |
| Choices | Spire Tower torn down | 0 of 6 | 6 of 6 | 6 of 6 lists |

- On narration, every wording that calls on a real landmark also weighs a call on a vague turn, and the weighing spills. Wordings that never spill never call.
- **Stat-pass schema finding:** under the strict `json_schema` the app sends to the cloud, the model never calls a Tool on the stat pass (0 of 6 per wording); without it, 4 of 4. This is new evidence about the stat pass, not only about this Tool.
- The On Call script, ready for the follow-up to lift. It needs a Top Stories Object placeholder (two authored stories, `roll: false`) and the chip in Channel 8's description:

```js
// Log Landmark: the AI calls log_landmark when the creature destroys a named landmark. The call pins the loss as
// a memory, adds a landmark bonus to Destruction, and puts the loss at the top of Channel 8's stories.
// The stat pass still scores the smash itself. The bonus here is on top of it.
const landmarkBonus = 5;

// 1. Read the landmark. args.landmark is the name the AI passed. Drop the spaces around it and a final period.
const landmarkName = String(args.landmark).trim().replace(/\.+$/, "").trim();
if (!landmarkName) return "No landmark was named, so nothing was logged. Write the narration.";

// 2. Log each landmark once. The pinned memories hold the landmarks of earlier turns. Top Stories holds the
//    latest falls, this turn's among them, because a memory pinned this turn lands only when the turn ends.
//    Compare in lower case, because the AI may write the name with different capitals each time.
const memoryPrefix = "The creature destroyed " + landmarkName + " in ";
const storyLine = "the fall of " + landmarkName;
const topStories = placeholders["Top Stories"];
const loggedBefore = memories.some((memory) => memory.custom && memory.text.toLowerCase().startsWith(memoryPrefix.toLowerCase()));
const loggedThisTurn = topStories.value.some((story) => story.toLowerCase() === storyLine.toLowerCase());
if (loggedBefore || loggedThisTurn) {
  return landmarkName + " is already logged. Nothing changed. Write the narration.";
}

// 3. Pin the loss as a memory, so every later request carries it. It names where the creature stood,
//    so the ruin stays on the map.
memories.pin(memoryPrefix + location.name + ".");

// 4. Add the landmark bonus. Destruction only climbs, and it stops at its max.
const destruction = stats.Destruction;
destruction.value = Math.min(destruction.value + landmarkBonus, destruction.max);

// 5. Put the loss at the top of Channel 8's stories. The news keeps the three latest falls, newest first.
//    Before the first fall, Top Stories holds the authored stories, which are not falls, so keep only falls.
const earlierFalls = topStories.value.filter((story) => story.startsWith("the fall of "));
topStories.pin([storyLine, ...earlierFalls].slice(0, 3));

// 6. Answer with the new total, so the narration and the damage agree.
return "Logged " + landmarkName + ". Destruction is now " + destruction.value + ". Write the narration.";
```

**Tests.** `rampageWorld.test.ts` gains nine: eight for Pursuit's climb at a hub, at a dead end and at the suburb, the halving on a move, the landing from the bay, the road names by the leg back, the rolled tunnel road, the AI lock; and one Subway Line roll across both legs, the Metro and its lore. Mutations, one at a time, each red: 2 Pursuit a road; no halving; the outbound hint for the leg back; Cedar Hollow moved under the city; the city counted as a road; no Last Sighting pin; Pursuit open to the AI; one tunnel leg on a unique roll. The test turn reads pins through the play pin walk (`ownerPins`).

**Probe (Q9).** Cloud `default`, worktree against `2f45261a5`, interleaved; rubric scored blind before the key (grounding, second person present, name discipline, world-fact fidelity, advancement; pass 1, partial 0.5).

| Batch | World text | Runs per arm | Leaks (worktree / old) | Stat ok (worktree / old) | Rubric mean (worktree / old) | Thin turns (worktree / old) |
|---|---|---|---|---|---|---|
| 1 | Tool on narration, before the review fold-ins | 5 | 0 / 0 | 15/15 / 15/15 | 4.10 / 4.50 | not counted |
| 2 | Tool on narration | 10 | 8 / 0 (4 token, 4 reasoning) | 30/30 / 30/30 | not scored | |
| 3 | no Tool | 10 | 0 / 0 | 30/30 / 30/30 | 4.40 / 4.75 | 3 runs / 0 |
| diagnostic | no Tool; arms: without the Pursuit line, with it, old | 8 | 0 / 0 / 0 | all ok | 4.57 / 4.69 / 4.38 | 2 / 5 / 0 |
| 4 | lore-key fix | 10 | 0 / 0 | 29/30 / 30/30 | 4.45 / 4.60 | 7 / 4 |
| 5 | Pursuit line as pressure (final text) | 10 | 0 / 0 | 30/30 / 30/30 | 4.60 / 4.30 | 6 / 2 |

- **Pooled on the final text:** batch 5 only, 4.60 against 4.30 per run. A win. Batch 5 flags: 1 on the worktree arm, 2 on the old.
- The batch 4 stat miss is model-side: on one opening the reply left the required "Global Stats" object out under the strict schema. The worktree arm was 60 of 60 across batches 2 and 3.
- The diagnostic's first run on the no-line arm was a harness `page.goto` timeout, so that arm has 7 runs.
- Thin turns stay the one pattern on the new world: short turns with no new pressure, mostly on turn 3 ("roar at the chopper, head downtown"). The old world's misses are the beast speaking and civilians harmed; the new world's are milder.
