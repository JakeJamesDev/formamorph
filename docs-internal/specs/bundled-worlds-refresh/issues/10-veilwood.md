# 10: Refresh Veilwood

Status: done
Blocked by: 01, 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Spec: ../spec.md (Q1, Q3, Q4, Q6, Q8; Feature assignment)

## What to build

**Veilwood** plays better on the cloud model and shows its assigned features, with its premise kept: title, hook, and core cast.

- **Assigned features:** Trait gates. An always-on curse trait. Opening weights.
- **Common to every world:** `openings`, `imageTags` on every location and entity, `introReadme` for trait guidance, `readme` for play only.
- **Content pass:** rework the system prompt, lore, entities, locations, and pacing to the prompt-writing guide. Add, rewrite, or cut freely within the premise. No new art.
- Follow the `bundled-worlds` skill: read stripped copies, edit by script, preserve ids and images, validate references.

## Acceptance criteria

- [x] The world's row is in the shared coverage table and passes.
- [x] The shared suite passes for this world, including the old-save check.
- [x] Every script uses full variable names (no one-character names), is split into explained sections, and comments each section's logic (Q16). (Veilwood has no script; none is assigned.)
- [x] Every placeholder name is in title case with spaces, like a proper noun (Q17).
- [x] Per-world tests cover each script's effect on its stat and each gate that must hold.
- [x] The probe (01) shows no structural regression and a rubric win over the pre-refresh revision, with 5 or more runs per arm. Numbers go in this ticket's comments.
- [x] Each animated GIF becomes an animated WebP with the same frame count and per-frame timing, shown in comments. (Two truncated GIFs keep every frame that decodes; user ruling below.)
- [x] Existing art is re-encoded to WebP through the app's fix (Q14), and the world's Test Bench row in the shared suite is empty.
- [x] Fingerprints are regenerated. No changelog edit.
- [x] Four gates are green. The stripped diff is ready for review.

## Comments

**Rulings (user, via AskUserQuestion).** The curse and gates as proposed, with Move Quietly gated on Stress, not Stamina: Test Bench's `trait-gate-reads-own-stat` flagged the Stamina gate, because the trait drains Stamina and would flicker. Truncated GIFs: make the encoder tolerant. The per-turn settle parity test skips worlds with stat Conditions.

**What changed.**

- **Curse (Automatic).** **The Veil's Hold**, in a new **Curse** group on The Wanderer, has no requirements, so it is always on. It holds the rule that every path but east bends back, and it carries Predator Attention's +2 regen (the stat's own regen is now 0).
- **Gates.** **Veil Sight** is Automatic and requires Toxin at 75% or more (percent, so Iron Stomach's 125 max reads fairly). It holds the hallucination rule. **Move Quietly** requires Stress below 75%, and the cascade switches it off and back on.
- **Pick counts.** Constitution and Temperament take exactly one. Instincts takes any number.
- **Openings.** Four, weighted 3 / 3 / 2 / 1. The original action keeps its id. New: a moth-wake action, the hunter's-scream narration, and the rare footprints narration (the curse made visible, about one game in nine).
- **Content.** New system prompt (tone line, narrator rules, the speech rule last). Readme split: play first, then `How this world is built`. Intro readme carries the trait guidance and names the curse. Stat descriptions rewritten as contracts. Mushroom effects in a fixed `When eaten:` line. New entity: **The Surveyor's Journal** at the camp. Lantern Moths now stand at the root location, and the Dread Crawler at the Drowned Hollow. Placeholders renamed **Lost Surveyor**, **Way In**, **Strange Detail**. `imageTags` on every location and entity.
- **Art.** All seven GIFs re-encoded through the app's `image-not-webp` fix in Chromium, lossless.

| Image | GIF | WebP | Frames | Delays |
|---|---|---|---|---|
| Ember Speckle | 522 KB | 443 KB | 40 → 40 | 100 ms, identical |
| Midnight Shimmer | 551 KB | 470 KB | 40 → 40 | 100 ms, identical |
| Ember Spire | 453 KB | 376 KB | 40 → 40 | 100 ms, identical |
| Night Veil | 540 KB | 458 KB | 40 → 40 | 100 ms, identical |
| Dread Crawler | 579 KB | 496 KB | 40 → 40 | 100 ms, identical |
| Cerulean Vex | 817 KB | 393 KB | 26 → 25 | 100 ms each |
| Shadow Raptor | 855 KB | 433 KB | 25 → 24 | 100 ms each |

Counts and delays read with sharp; loop 0 and size unchanged. Cerulean Vex and Shadow Raptor are truncated: Chromium's `ImageDecoder` throws "Unexpected end of image" on the last frame, so the fix used to keep both GIFs. `src/lib/imageEncode.ts` now encodes the frames before the first one that fails to decode, and keeps the source when fewer than two decode. Every kept frame of both is pixel-identical to the GIF's (max channel difference 0).

**Tests.** `veilwoodWorld.test.ts`: 10 tests (picks 3, curse 2, Veil Sight 2, Move Quietly 3). A mutation script broke 11 parts of the world file one at a time (curse mode, its attention row, attention regen restored, Veil Sight threshold, unit and gate, Move Quietly gate and operator, each group's min or max, an Instincts cap). All 11 failed the suite. `imageEncode.test.ts`: 3 tests; removing the decode catch and the two-frame floor each fails its test. `bundledPlayerStats.test.ts` lists the curse's loose-stat row; `perTurnSettle.parity.test.ts` runs on the worlds without stat Conditions and asserts some remain. `scripts/testSelection.mjs` maps the world to its test; owner-tree parity snapshots regenerated.

**Probe (Q8).** Cloud `default`, worktree vs `ace2e0204`, arms interleaved, one batch each. Rubric: transcripts re-blinded under shuffled ids, authored page one inserted, scored by a separate agent that never saw the key, 0–2 on five items (opening, 2nd person present, world-fact fidelity, advancement, premise).

| Batch | Runs/arm | Structure | New | Old | Change before the next batch |
|---|---|---|---|---|---|
| 1 | 8 | 0 faults, 24/24 both | 56/80 | 60/80 | Satiety said "raise it when the player eats", against the Speckle's hunger cost. The Crawler was not at the Drowned Hollow, so its blindness never reached the narrator there. Fixed both. |
| 2 | 8 | **new stat 20/24**, old 24/24 | 73/80 | 62/80 | The longer Satiety line broke the stat reply on the eat turn (Global Stats block dropped). Shortened it. |
| 3 | 10 | 0 faults, 30/30 both | 88/100 | 88/100 | Tie (2 W, 2 L, 6 T). Speckle hunger and invented Crawler senses remained. Clearer `When eaten:` line; Crawler "sound and movement are its only senses". |
| 4 | 12 | 0 faults, 36/36 both | **101/120** | **96/120** | Landed text. |

- **Landed batch:** new wins 5 runs, loses 3, ties 4. Per item, new vs old: opening 22 vs 22, tense 24 vs 24, fidelity 14 vs 12, advancement 18 vs 14, premise 23 vs 24.
- **The margin is narrow.** Batch 3 tied, and scorer leniency drifts between batches (batch 3 scored both arms near the ceiling).
- **Open faults, both arms:** the Speckle's hunger cost is shown in about 1 run in 5; the Crawler gets heat, scent or eyes on some runs; turn 3 often restates the freeze; generated openings reuse one "turn a full circle, sliver of daylight" shape.

**Review fold-ins (after the probe).** Veil Sight's text listed sample hallucinations a small model could parrot; it now asks for one false sight or sound built from the scene. The encoder comment names any failed decode, not only truncation. The world test shares one stat-setting helper. Not changed: the percent-threshold finding (all five Wanderer stats already use percent); the serial commas and the tone line the system prompt shares with the constant lore entry (both are in the probed text); the extra fingerprint from the branch's first commit. Veil Sight only fires at high Toxin, so the probe never exercised its new text.
