# 03: Refresh Drone

Status: done
Blocked by: 01, 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Spec: ../spec.md (Q1, Q3, Q4, Q6, Q8; Feature assignment)

## What to build

**Reincarnated to Another World as a Cute Assault Drone** plays better on the cloud model and shows its assigned features, with its premise kept: title, hook, and core cast.

- **Assigned features:** Scripts drive Mobility and Firepower (move the legacy `code` into scripts). Trait gates: chassis modules need a chassis. Min/max picks on the chassis and module groups.
- **Common to every world:** `openings`, `imageTags` on every location and entity, `introReadme` for trait guidance, `readme` for play only.
- **Content pass:** rework the system prompt, lore, entities, locations, and pacing to the prompt-writing guide. Add, rewrite, or cut freely within the premise. No new art.
- Follow the `bundled-worlds` skill: read stripped copies, edit by script, preserve ids and images, validate references.

## Acceptance criteria

- [x] (Follow-up) Every script uses full variable names (no one-character names), is split into explained sections, and comments each section's logic (Q16).
- [x] (Follow-up) Every placeholder name is in title case with spaces, like a proper noun (Q17). `designation`, `threat` and `origin` are now **Designation**, **World Threat** and **Past Life**.
- [x] The world's row is in the shared coverage table and passes.
- [x] The shared suite passes for this world, including the old-save check.
- [x] Per-world tests cover each script's effect on its stat and each gate that must hold.
- [x] The probe (01) shows no structural regression and a rubric win over the pre-refresh revision, with 5 or more runs per arm. Numbers go in this ticket's comments.
- [x] Existing art is re-encoded to WebP through the app's fix (Q14), and the world's Test Bench row in the shared suite is empty.
- [x] Fingerprints are regenerated. No changelog edit.
- [x] Four gates are green. The stripped diff is ready for review.

## Comments

**What changed.**

- **Build.** Chassis takes exactly one pick (min 1, max 1). Each module group takes up to two. Each chassis now has three modules; Ram Plate, Solar Skin and Repair Nanites are new. Every module requires its own chassis (same owner).
- **Scripts.** Mobility and Firepower stay After the AI scripts, now read against each stat's max, so Health's 30% line and the Power share follow the chassis. They also read the build: Scout +10 and Siege −15 Mobility, Evasion Thrusters +15 Mobility, Assault +5, Overcharged Rounds +10, Recon Optics +5 and Siege Cannon +15 Firepower. Three modules whose effect contradicted their name (Overcharged Rounds gave Power regen, Evasion Thrusters gave Health regen, Recon Optics gave Power regen) now drive the scripts instead.
- **Openings.** The world's one boot-up action moved (same id) to the Demon Frontier. Each starting region now has a narration and an action opening that puts its local character in front of the drone. Ser Halden moved to the Demon Frontier, where his border forts are.
- **Content.** New system prompt (tone line, five rules, the speech rule last). New readme with a `How this world is built` section, following Emberwatch. New intro readme with chassis guidance. New entity: the **Mossback Sentinel**, a precursor war machine at the root location that talks to the drone in light. `imageTags` on every location and entity. Tiamat's art re-encoded to lossless WebP (2479 KB PNG → 951 KB).
- **Shared test.** `statLookupMigration.test.ts` now reads the pre-refresh worlds through `preRefreshWorld`, per the ticket 02 ruling on tests that need a legacy shape. Its assertions are unchanged.

**Tests.** `droneWorld.test.ts`: 15 tests. A mutation script broke 17 parts of the world file one at a time (two gates removed, one gate pointed at the wrong chassis, the Chassis min, a module group max, and every script line, including raw-unit Health and Power reads). All 17 failed the suite.

**Probe (Q8).** Cloud `default`, Drone, worktree vs `ace2e0204`, 5 runs per arm, one interleaved batch:

| Arm | Runs | Turns | Empty | Token leaks | Reasoning leaks | Placeholders | Choices ok | Stat ok | Flagged | Errors |
|---|---|---|---|---|---|---|---|---|---|---|
| worktree | 5 | 15 | 0 | 0 | 0 | 0 | 15/15 | 15/15 | 0 | 0 |
| ace2e0204 | 5 | 15 | 0 | 0 | 0 | 0 | 15/15 | 15/15 | 0 | 0 |

No structural regression. Rubric, scored on the blind labels before reading `key.json` (5 probes per run: scene grounding, 2nd person present, name discipline, world-fact fidelity, advancement; pass 1, partial 0.5): **worktree 21.5 / 25, ace2e0204 17.5 / 25.**

- The old arm's turn 1 re-narrates one generic boot-up everywhere, so turn 2's "stranger" is invented: a behemoth in three of five runs, with no location anchor in two.
- Old-arm fidelity misses: Vael called "he", a dragon with ochre scales (Tiamat is silver), a drone with "multiple optical sensors".
- New-arm misses: Vael named before she introduces herself (run 3), a "twin-barreled turret" (run 2), past-tense choices on one turn (run 4), one stray bold word (run 1).
- Blinding is partial: the new openings make the arm easy to guess from turn 1.

**Review fold-ins.** The kept Frontier opening now says "My optic", to match the one-optic drone. The readme's play section holds only stats; the speech line moved to the intro readme, and the cast line was cut. Two AI lines became positive ("speaks only with its body", "stays rooted in its hillside"). New strings use straight apostrophes. The Drone test shares one trait-world setup, and the lookup-migration test keys the pre-refresh worlds by id. The probe ran before these text edits.

**Gates.** The first run had two load timeouts in files this ticket doesn't touch: `SettingsModal.promptOptions.test.tsx` (5 s test timeout) and `GameViewer.bundledSaves.test.tsx` for Emberwatch (a `findByRole` with the default 1 s wait). Both pass alone, and the second run was all green (458 s).
