# 07: Refresh Slime

Status: done
Blocked by: 01, 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Spec: ../spec.md (Q1, Q3, Q4, Q6, Q8; Feature assignment)

## What to build

**Slime Outbreak** plays better on the cloud model and shows its assigned features, with its premise kept: title, hook, and core cast.

- **Assigned features:** A script drives infection spread. A hidden-mode trait for the strain. Keep the rolled entity name (Q7).
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

- **Spread script.** **Assimilation** on The Resident has an After the AI script, "Infection Spread". It adds 2 points per story hour, +1 once the turn started at 40 or more, +1 at half of max Panic or more, −1 for the Night-Shift Nurse, −2 while Fight It is on, never below 0. The stat and those two traits lost their Assimilation regen, so the script is the one place the spread lives. Fight It's copy says it slows the spread, which the script does; a calm nurse below 40 who fights it stops it.
- **Hidden strain (user ruling: option B).** One Hidden trait, **Strain**, always active on The Resident. Its AI text holds the **Strain** placeholder, which rolls one of four strains per playthrough. It changes narration, not numbers.
- **Test Bench fix (user ruling).** The bench's chip list skipped an entity's own trait and group text, which play primes. It flagged the Strain placeholder as unused, and its Fix would have deleted it. The list in `rules.ts` now matches the priming pass; a rules test covers both fields.
- **Placeholders (Q17).** `signoff` → **Broadcast Sign-Off**, `rumor` → **Outbreak Rumor**, `neighbor` → **Neighbor**, slots `name`/`habit` → **Name**/**Habit**. Slot chips route by name, case-sensitively, so every `:sname`/`:shabit` path in the neighbor's text follows. The rolled neighbor stays (Q7).
- **Content.** New system prompt (setting, narrator job, seven rules, the tone line last). Readme split: trait guidance in `introReadme`; goal, stats and Fight It in `readme`, then a short "How this world is built". Two new narration openings join the kept action opening. New entities: **Hollis Pratt** at the Night Pharmacy (knows the cure's reagents) and **The Loudspeakers** at Ashburn. `imageTags` on Ashburn and The Resident; lore entries tightened.
- **Art.** Green Slime re-encoded to lossless WebP through the app's fix in Chromium (302 KB → 131 KB as base64). Slime's open-findings row is gone.

**Tests.** `slimeWorld.test.ts`: 16 tests (spread script, strain, neighbor slots, openings). A mutation script broke 15 parts of the world one at a time (every script line, the strain's mode and chip, both neighbor slot paths, the openings). All 15 failed the suite. The bench test failed before the `rules.ts` fix.

**Gates.** The first run failed two shared tests, both from this ticket's content: the owner-tree parity snapshot (`__parity__/ownerTreeLinks.json`), which records each bundled entity's lists, and the test-selection check, which wants a path trigger for the new `slime.json?raw` import. The snapshot diff touches only Slime's Resident; the trigger now maps `slime.json` to `slimeWorld.test.ts`.

**Review fold-ins.** Fight It's three texts said the spread stops; they now say it slows. The bench uses an `everyTraitGroup` helper beside `everyTrait`. The neighbor test picks its variant by id and checks each variant's own habit lands. The probe ran before these edits.

**Probe (Q8).** Cloud `default`, Slime, worktree vs `ace2e0204`, 8 runs per arm, one interleaved batch:

| Arm | Runs | Turns | Empty | Token leaks | Reasoning leaks | Placeholders | Choices ok | Stat ok | Flagged | Errors |
|---|---|---|---|---|---|---|---|---|---|---|
| worktree | 8 | 24 | 0 | 0 | 0 | 0 | 24/24 | 24/24 | 0 | 0 |
| ace2e0204 | 8 | 24 | 0 | 0 | 0 | 0 | 24/24 | 24/24 | 0 | 0 |

- **Structure:** no metric is worse on the new arm.
- **Rubric:** transcripts re-blinded under shuffled ids and scored by a subagent with no key, 0–2 on five items (opening, 2nd person present, world-fact fidelity, advancement, the change shown clinically). New **63/80** vs old **52/80**. Paired by run: new wins 6, loses 1, ties 1.
- **What moved:** the old arm contradicted the geography in 4 of 8 runs (the harbor "a dead end", the Works "across the city divide"). The new arm headed for "the outskirts" once, and once had a slime yield to a warm body.
- **Still open:** two new runs never name the Works or the cure on turn 1. Blinding is partial: the new openings mark the arm.
