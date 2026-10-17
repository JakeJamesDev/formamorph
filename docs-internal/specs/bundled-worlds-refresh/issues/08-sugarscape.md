# 08: Refresh Sugarscape

Status: done
Blocked by: 01, 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Spec: ../spec.md (Q1, Q3, Q4, Q6, Q8; Feature assignment)

## What to build

**Sugarscape Survival** plays better on the cloud model and shows its assigned features, with its premise kept: title, hook, and core cast.

- **Assigned features:** A script ticks hunger. Min/max picks on trait groups. Opening weights.
- **Common to every world:** `openings`, `imageTags` on every location and entity, `introReadme` for trait guidance, `readme` for play only.
- **Content pass:** rework the system prompt, lore, entities, locations, and pacing to the prompt-writing guide. Add, rewrite, or cut freely within the premise. No new art.
- Follow the `bundled-worlds` skill: read stripped copies, edit by script, preserve ids and images, validate references.

## Acceptance criteria

- [x] The world's row is in the shared coverage table and passes.
- [x] The shared suite passes for this world, including the old-save check.
- [x] Every script uses full variable names (no one-character names), is split into explained sections, and comments each section's logic (Q16).
- [x] Every placeholder name is in title case with spaces, like a proper noun (Q17).
- [x] Per-world tests cover each script's effect on its stat and each gate that must hold.
- [x] The probe (01) shows no structural regression and a rubric win over the pre-refresh revision, with 5 or more runs per arm. Numbers go in this ticket's comments.
- [x] Existing art is re-encoded to WebP through the app's fix (Q14), and the world's Test Bench row in the shared suite is empty.
- [x] Fingerprints are regenerated. No changelog edit.
- [x] Four gates are green. The stripped diff is ready for review.

## Comments

**What changed.**

- **Hunger script.** Craving has an After the AI script on The Cursed. Each turn it adds a step: base 3, Appetite (Grazer −1, Glutton +2, Iron Will −2), Pantry Tricks (Hearty Appetite −1, Sugar Rush +1), stomach (below 10% of max Fullness +2, at 70% or more −1, read as a share so Glutton's bigger stomach is fair), and Gritted Teeth −4 with a floor of −1, so Craving always falls while it holds. Craving's regen is 0, and the six craving regen rows left the traits, so the script is the only thing that climbs it. The AI only lowers it on eating.
- **Pick counts.** Appetite and Build take exactly one pick (min 1, max 1). Pantry Tricks takes up to two.
- **Openings.** Four world openings in Sundaelora, weighted 3 / 3 / 2 / 1. The original wake-up action keeps its id. New: a gummy-pool action, a Cookie Brawler narration, and the rare mid-bite narration (about one game in nine).
- **Content.** New system prompt (tone line, nine narrator rules, the speech rule last). Readme split: play first, then `How this world is built`, as Drone and Emberwatch do. Intro readme carries the trait guidance. New entity: **The Daylight Seam**, the exit object at the Stalefront. Wayposts now stand at the root location, Sundaelora, the Shores and the Dunes. Lorebook entries rewritten as positive contracts ("Wonka-logic" is gone). Placeholders renamed **Curse Origin**, **Curse Fixation**, **Odd Detail**. `imageTags` on every location and entity, the persona included.
- **Art.** Five creature images re-encoded through the app's `image-not-webp` fix in Chromium: 5 converted, 0 kept (PNG 2673 KB → WebP 1051 KB decoded).

**Tests.** `sugarscapeWorld.test.ts`: 12 tests (picks: 3; hunger tick: 9). A mutation script broke 17 parts of the world file one at a time (every script line, the Gritted Teeth floor, raw-unit Fullness, `return step`, each group's min or max, Craving regen, a trait regen row restored). All 17 failed the suite. `scripts/testSelection.mjs` maps the world file to the new test, and the owner-tree parity snapshot is regenerated (only The Cursed's entries change).

**Probe (Q8).** Cloud `default`, worktree vs `ace2e0204`, arms interleaved, one batch each. Rubric: transcripts re-blinded under shuffled ids and scored by a separate agent that never saw the key, 0–2 on five items (opening turn, 2nd person present, world-fact fidelity, advancement, premise shown).

| Batch | Runs/arm | Structure (both arms) | New | Old | Change before the next batch |
|---|---|---|---|---|---|
| 1 | 8 | 0 faults, choices and stat 24/24 | 65/80 | 52/80 | Craving's description said "a script raises it", and the stat pass raised Craving +5 on 16 of 24 new-arm turns (old 0). Rewritten to lower-on-eating, unchanged otherwise. |
| 2 | 8 | 0 faults, 24/24 | 44/64 | 44/64 | Items 2–5 only (3 new runs drew an authored page one the scorer had no text for). Both arms invented scenery. Added the region-features line. |
| 3 | 10 | 0 faults, 30/30 | **81/100** | **67/100** | Landed text. Authored page one scored from its text. |

- **Landed batch:** new wins 7 runs, loses 2, ties 1. Per item, new vs old: opening 19 vs 15, tense 19 vs 17, fidelity 17 vs 14, advancement 11 vs 10, premise 15 vs 11.
- **Stat pass:** the eat turn lowers Craving on 10 of 10 new runs vs 7 of 10 old. A stray +5 on the opening turn remains on 3 of 10 new runs (old 0); the script adds its step on top.
- **Open faults, both arms:** invented scenery (shortbread hills, candy-colored skies), a gummy bear that groans or squeaks, a tense slip on some turns. Advancement scores 1 on almost every turn in both arms.

**Review fold-ins (after the probe).** Gritted Teeth promised "Craving falls each turn", but a Glutton's step stayed positive under it; the script now floors the step at −1 while it holds, with a Glutton test. The finale instruction lives in two places instead of four (the system prompt and the Daylight Seam), and both end on the first bite of savory food. Toggle copy lost its "while this is on" preamble; "furthest" became "farthest". Not changed: the reviewer's threshold-unit finding (Health, Stamina and Fullness already use percent), and moving the advance rule last (the speech rule holds the last slot in every refreshed world; worth its own probe).

**Gates.** The first run failed two side files, the test-selection trigger for the new `?raw` import and the owner-tree parity snapshot. Both fixed; the second run passed all four (351 s).
