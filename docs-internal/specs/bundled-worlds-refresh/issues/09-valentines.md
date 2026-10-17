# 09: Refresh Valentines

Status: done
Blocked by: 01, 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Spec: ../spec.md (Q1, Q3, Q4, Q6, Q8; Feature assignment)

## What to build

**Valentines Survival** plays better on the cloud model and shows its assigned features, with its premise kept: title, hook, and core cast.

- **Assigned features:** A script drives Agility (move the legacy `code` into scripts). Keep the rolled entity name (Q7).
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
- [ ] Four gates are green. The stripped diff is ready for review.

## Comments

**What changed.**

- **Agility script.** The After the AI script on The Student is rewritten in sections. Agility = 30 + 70 × (Stamina share of max) − 40 × (Sugar share of max), plus 20 while **All-Out Sprint** is on, clamped to 0–100. Shares keep Star Athlete's bigger tank and each Constitution's stomach fair. The script reads `owner.traits`; the world-level `traits` never saw the toggle, which the new test caught.
- **All-Out Sprint** now drains Stamina (regen −10), so "much faster, but Stamina drains" holds for every build.
- **Health cut.** Nobody gets hurt in this world, and its descriptors talked about wounds and death. Old saves still load (Q10).
- **Openings.** Four world openings. The original action keeps its id. New: Hana in the doorway (narration), the fan-club group chat (action, stays in the classroom), and Kenta's PA call (narration).
- **New entities.** **Kenta Ishida**, the Broadcast Club announcer, at Ashburn High (heard everywhere through the PA). **Sora Amagi**, a rooftop regular with her own unsent chocolate. Both clear the two `location-no-entities` rows.
- **Content.** New system prompt (tone line, ten narrator rules, the speech rule last). Readme split: play first, then `How this world is built`. Intro readme carries the trait guidance. Stamina and Sugar descriptors rewritten for the world. Lorebook entries rewritten as positive contracts, plus **The Broadcast Club** entry. Placeholders renamed **Best Friend**, **Front-Page Rumor**, **Guard Post**. Capitalized alias twins for the swarm and the best friend. `imageTags` on every location and entity.
- **Art.** Hana's PNG re-encoded through the app's `image-not-webp` fix in Chromium: 1 converted, 0 kept (786 KB → 412 KB). The two JPEGs stay (ticket 06 ruling).

**Tests.** `valentinesWorld.test.ts`: 9 tests (Agility script: 8; Sprint drain: 1). A mutation script broke 12 parts one at a time (floor, raw Stamina, raw Sugar, Sugar weight, the Sugar line, the Sprint line, the burst size, world-level `traits`, rounding, returning the AI's value, Sprint regen −6, Sweet Tooth's max). All 12 failed the suite. `scripts/testSelection.mjs` maps the world file to the test; the owner-tree parity snapshot is regenerated (only The Student's entries change); `bundledPlayerStats.test.ts` drops Health from the Student's stats.

**Probe (Q8).** Cloud `default`, worktree vs `ace2e0204`, arms interleaved. Rubric: transcripts re-blinded under shuffled ids with the authored opening filled in, scored by a separate agent that never saw the key, 0–2 on five items (opening, 2nd person present, fidelity, advancement, premise shown).

| Batch | Runs/arm | Structure (both arms) | New | Old | Change before the next batch |
|---|---|---|---|---|---|
| 1 | 8 | 0 faults, choices and stat 24/24 | 58/80 | 48/80 | The first scoring pass had no authored openings (a blind-copy bug); rescored. New arm dropped the "then bolt" half of action 2 and gendered the player twice. Added a follow-through line and a no-title line; Hana's opening states the rule. |
| 2 | 8 | 0 faults, 24/24 | 48/80 | 51/80 | The four lowest new runs all drew the "slip into the hallway" opening, which the probe's fixed "duck behind the desks" action contradicts. Replaced it with the group-chat opening, which stays in the classroom. Hana keeps after her delivery. |
| 3 | 10 | 0 faults, 30/30 | **67/100** | **61/100** | Landed text. |

- **Landed batch, per item, new vs old:** opening 18 vs 10, tense and POV 11 vs 15, fidelity 15 vs 19, advancement 12 vs 10, premise 11 vs 7.
- **Where new loses:** the narrator writes a "Thank you" line for the player after Kenta's PA opening (2 runs) and after Hana's doorway opening (1 run); one narrated opening ran in past tense; Hana steps aside or points out a route in 2 of 3 doorway runs.
- **Open faults, both arms:** purple, solemn prose more than comedic panic; the rule rarely stated in play; one bite read as enough; the shoe lockers drift into the classroom.

**Review fold-ins (after the probe).** The no-title line lost its negative tail ("Everyone speaks to the player as you."). Agility descriptors moved to third person like Stamina and Sugar. Every em dash and curly quote in the world became plain text. The script comment says "base", not "floor", since Sugar can pull Agility under 30; the test title follows. Coach Daizen also stands in the Gymnasium, since Guard Post can roll "the gym doors". The test helper throws when the script never ran, instead of falling back to the input. Not changed: splitting the multi-clause prompt bullets (every refreshed world uses them; that needs its own probe), and a shared harness for the three world tests (a follow-up).

**Review diff.** `npm run strip-worlds` on the base (`fc0953988`) and the new file; the stripped diff is 121 insertions, 83 deletions.
