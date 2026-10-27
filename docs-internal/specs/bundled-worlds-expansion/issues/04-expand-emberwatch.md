# 04: Expand Emberwatch

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Spec: ../spec.md (Q4, Q5, Q7, Q8, Q9, Q16, Q20; Size table; Feature assignment)

## What to build

**Emberwatch** grows from 7 locations and 9 entities to at least 14 and 18, shows its assigned features, and plays at least as well on the cloud model. The premise holds: title, hook, and the named core cast stay (Q20). Emberwatch keeps its Blueprints, gates, and the race and class defaults each persona choice carries.

- Grow the keep and the town: a market, the walls, a healer, the road out, and the barrow's deeper chambers.
- A chapel Tool with a live write: prayer moves Faith and adds a memory line. The world still plays without it.
- Relationship labels on the cast: who serves, rivals, or owes whom. A chip where a label carries a rolled name.
- A script that enables a barrow or faction lore entry when a stat or trait crosses its threshold.
- **Assigned features:** World Tool with a live write. Relationship labels. Script control of lore.
- **Common to every world:** every new location joins the graph by parent or by a Connection with Travel Hints both ways. Every new entity lists its locations and sets `knownIn` where the AI should know of it elsewhere. Lore grows with the map: each new region gets at least one dictionary entry. At least one chip in a Pronouns, Travel Hint or Relationship label field where a roll reads naturally (Q8).
- **Art direction (Q16):** write the world's art-direction line, booru-style, naming medium, palette and mood and never a subject. Put it in this ticket's comments and the spec's Comments. Write `imageTags` for every new location and entity in the same vocabulary.
- **Readme:** "How this world is built" names the features this world now shows.
- Rewrites are allowed where they improve the world (Q4). Follow the `bundled-worlds` skill: read stripped copies, edit by script, preserve ids and existing images, validate every reference. Every new script, Tool handler included, follows the house style.

## Acceptance criteria

- [x] The world has at least 14 locations and 18 entities, every one with `imageTags`, and the stripped diff is ready for review. 15 and 19; `.scratch/bundled-worlds-expansion-04/frames/emberwatch-stripped.diff`.
- [ ] The world's coverage row claims `tools`, `relationships`, `scriptLore`, `newFieldChips`, and the shared suite is green, including the old-save check at both revisions. The row claims `relationships`, `scriptLore`, `newFieldChips`; `tools` dropped by ruling (see Landed). Shared suite green, old-save check included.
- [x] Per-world tests cover each new script's effect, each Tool handler's write, and each gate that must hold, and each is shown to bite by breaking the world file once. `emberwatchWorld.scripts.test.ts` (Founders' Pact script, Lost Sentry roll) and the map test in `emberwatchWorld.test.ts`; six world-file mutations, each failing its named test. No Tool ships.
- [x] The probe shows no structural regression and a rubric win or tie over the pre-expansion revision, with 5 or more runs per arm. Numbers go in this ticket's comments. Decision batch, 10 runs per arm: structural tie, rubric 44.5 vs 43.5.
- [ ] The art-direction line is in this ticket's comments and the spec's Comments. In the comments; sent to the spec session to fold into the spec.
- [x] Fingerprints are regenerated. No changelog fragment: ticket 01's entry covers every world (Q14). `npm run fingerprints` after the last world edit; no fragment.
- [x] Every location has a `canvasPosition` matching the lore (Q25), shown in `.scratch/frames/emberwatch-canvas.png` for the root Group and one frame per child Group, 1280 wide, light theme. Playwright at 1280×900, light: `emberwatch-canvas.png`, `emberwatch-canvas-keep.png`, `emberwatch-canvas-barrow.png`; the map test pins the north-south order and the west road.

For you: read one transcript per opening and judge whether the new places feel like the same world.

## Landed

**Not verified**

- The coverage row does not claim `tools`. By the spec session's ruling the chapel Tool was tried on narration first and the world lands Tool-free when it spills: `offer_prayer` spilled 3 of 10 opening replays against 0 of 10 without it, with no call. Drone keeps the set's `tools` coverage. The Tool script is in the comments.
- The art-direction line is not yet in the spec's Comments: the spec session folds it in from the landing message.

**For you**

- Read one transcript per opening and judge whether the new places feel like the same world. Worktree arm, final decision batch: action opening `.scratch/bundled-worlds-expansion-04/frames/emberwatch-run5-A-action-opening.md`; authored openings `.scratch/bundled-worlds-expansion-04/frames/emberwatch-run7-A-authored-opening.md` and `.scratch/bundled-worlds-expansion-04/frames/emberwatch-run1-A-authored-opening.md` (in run 1 the narrator turns the watchtower into a captain's solar).
- Check the map against the text: `.scratch/bundled-worlds-expansion-04/frames/emberwatch-canvas.png`, `.scratch/bundled-worlds-expansion-04/frames/emberwatch-canvas-keep.png`, `.scratch/bundled-worlds-expansion-04/frames/emberwatch-canvas-barrow.png`.
- Skim the stripped world diff: `.scratch/bundled-worlds-expansion-04/frames/emberwatch-stripped.diff`.

## Comments

**Art direction (Q16).** `painterly fantasy illustration, oil painting texture, muted earth tones, slate gray and heather green palette, warm ember orange accents, dramatic chiaroscuro lighting, low drifting mist, somber heroic mood, high detail`.

**Rulings (spec session).** Narration is the chapel Tool's first try, and a spill there lands the world Tool-free. An After the AI world script switches The Founders' Pact at Renown 70, two-way, on change, with a by-design row. Lost Sentry rolls per game and Mara Venn's label to the captain carries it. Plan accepted: 15 locations, 19 entities. Q25: every location gets a lore-true `canvasPosition`.

**What changed.**

- **Map.** Eight new places. Root: The Boundary Wall, Riverside Market, The Herbwife's Cottage, The Frontier Road. Under the keep: The Smithy, The Captain's Hall. Under the barrow: The Hall of Shields, The Sorcerer's Vault. The sally gate now opens from the wall, so the watchtower reaches the field through it, and the barrow's mouth leads to the Hall of Shields before the stair to the Bier Chamber. Two original hints that read the same both ways now read as the way back.
- **Canvas (Q25).** North is up: river and market, square, keep, wall, then the barrow far north. The tavern is west of the square, the chapel east, the tower and the road west of the keep. Direction words went into nine AI descriptions and four hints so map and text agree.
- **Cast.** Ten new entities: Bram Oakes, Sergeant Ilsa Marr, Bryony Fenn, Jory Pike, Mara Venn, Reeve Godric Holt, Hob Wainwright (random presence, road or market), The Shade of Maelis (Known In nowhere), Cold Lights (Known In tower and wall), Grave Hounds (Known In road and field). Blackwell also stands in his hall. The core nine stay.
- **Relationships.** Fifteen rows. A row pulls its other end into every scene where either end stands, so the first draft's five rows into Blackwell crowded the keep's prompt with Ilsa, Mara, Godric, Bram and Hesk. The final rows join people who share a place, except Mara's chip row to the captain, which the ruling names.
- **Lore.** One entry per new place (The Boundary Wall, Cold Iron, The River Market, The Grave Chill, The Frontier Road, The Hall of Shields, The Sorcerer's Vault), and The Founders' Pact, shipped off. The Old Kings and The Garrison were reworded: the town's story of Haldren dying in battle now stands against the pact's truth, and the Garrison names the lost sentry.
- **Script.** One world script, After the AI: Renown 70 or more sets The Founders' Pact on, below 70 off, writing only on change.
- **Prompt.** One line in the system prompt: what Sergeant Marr, Mara Venn and Reeve Holt want.

**Tests.** `emberwatchWorld.scripts.test.ts`: the pact ships off, switches on at 70, stays off at 69, switches off again below 70, and writes nothing when it already matches; one Lost Sentry roll across Mara's label, her description, the sergeant's and the Garrison entry. `emberwatchWorld.test.ts`: every location placed, the north-south order and the west road, the readme names each new feature, and the Test Bench raises only the pact's by-design finding. Mutations, one at a time, each failing its named test: threshold `>` for `>=`; the entry kept on once on; the on-change guard removed; the pact shipped on (also fails both Test Bench tests); the Garrison chip rolled unique; Mara's label chip removed (also fails `shows newFieldChips`).

**The chapel Tool, not shipped.** Cloud `default`, the captured opening narration request, interleaved, 10 per arm: with `offer_prayer` 3 spills and 0 calls; without it 0 spills. The Tool, for a later try once the app handles native reasoning around Tool offers:

- Description: "Purpose: Record a prayer the player makes at the Ember's brazier in the Chapel of the Ember, so the prayer raises their Faith. / Use when: The player prays at the chapel's brazier. Call it before you write the narration. / Input: intention — what the player prays for, in a few words. / Output: A short confirmation. Then write the narration." One optional string parameter `intention`; timing After the AI; Reply "The prayer is heard. Write the narration."; offered to narration.

```js
// Offer Prayer: a prayer at the Ember's brazier raises the played character's Faith once a day and becomes a memory.
// The world plays without this Tool: Faith still regenerates, and the narrator can still move it.

// 1. Answer only at the chapel. The Ember's flame burns in its brazier, so a prayer anywhere else changes nothing here.
if (location.name === "Chapel of the Ember") {
  // 2. Answer one prayer a day. Each answered prayer leaves a memory with the same words in it,
  //    so a memory with those words from today means the Ember has already answered.
  const prayerWords = "prayed at the Ember's brazier";
  const prayedToday = memories.some((memory) => memory.day === clock.day && memory.text.includes(prayerWords));

  if (!prayedToday) {
    // 3. Raise Faith by 15, inside its range. Faith is a Blueprint stat, so the persona owns its own copy,
    //    and the larger max a Paladin or a Cleric carries stays in force.
    const faith = persona.stats.Faith;
    faith.value = Math.min(faith.max, faith.value + 15);

    // 4. Keep the prayer as a memory, with what the player prayed for when the AI sent it.
    const intention = String(args.intention ?? "").trim();
    memories.add(persona.name + " " + prayerWords + (intention ? " for " + intention : "") + ".");
  }
}
```

Its tests passed before it came out: Faith +15 at the chapel with the memory line, a plain memory with no intention, nothing elsewhere, one prayer a day (day 2 counts again). Mutations bit for the location guard, the once-a-day guard and the amount. The clamp mutation failed nothing, because the runtime clamps a stat write to its range anyway.

**Probe (Q9).** Cloud `default`, Emberwatch, worktree vs `2f45261a5`, interleaved, Tools on. Rubric scored blind by a subagent before the key: scene grounding, 2nd person present, name discipline, world-fact fidelity, advancement; pass 1, partial 0.5.

| Batch | World | Runs/arm | Turns | Empty | Token leaks | Reasoning leaks | Placeholders | Choices ok | Stat ok | Flagged | Rubric worktree | Rubric 2f45261a5 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | first draft | 8 | 24 / 24 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 24/24 / 24/24 | 24/24 / 24/24 | 0 / 0 | 33.5 / 40 | 39 / 40 |
| 2 | after review fold-ins | 10 | 30 / 30 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 30/30 / 30/30 | 30/30 / 30/30 | 0 / 0 | 41.5 / 50 | 45 / 50 |
| 3 (decision) | final | 10 | 30 / 30 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 30/30 / 30/30 | 30/30 / 30/30 | 1 / 1 | **44.5 / 50** | **43.5 / 50** |

- Batch 1: the worktree drew the action opening 3 times and the old world 0 times. The narrator then walked into the new Captain's Hall, and the scripted turn 2 ("I ask the guard where the captain is") read against a scene that already held the captain. On matched openings the arms were 4.75 vs 4.88 per run.
- Batch 2 showed the cause: the narration prompt grew from about 16,500 to 22,500 characters, much of it the five relationship rows into Blackwell pulling their owners into the keep. Worktree-only misses were a two-captains muddle and invented officers. The trim brought the prompt to about 20,900 (+33%).
- Batch 3, the final world: openings near balanced (3 generated openings in the worktree arm, 4 in the old); tense discipline and advancement favor the worktree, grounding and fidelity the old world. One worktree run names Bram Oakes before any introduction; he stands in The Smithy, a sub-location of the start.
- Shared misses: sea air in inland country, turn 3 dusk scenes with nothing to act on, turn 2 replaying an approach turn 1 already made.
- New places used in play: the Captain's Hall in 8 of 10 worktree runs, the smithy, the wall bell, the founders' records.
