# Bundled Worlds Refresh

Status: done
Status note: Closed 2026-10-17: tickets 01–10 landed, last landing 6a4d158cf. Closed without gates.
Spec session: bundled-worlds-refresh — spec

## Problem Statement

The bundled worlds are the first thing a new player plays and the first example a new author opens. Six of the eight were last modernized for 2.14. Since then Formamorph gained scripts, trait gates, trait modes, min/max picks, stat toggles, openings with weights, and blueprints. No bundled world uses scripts, trait modes, stat toggles, min/max picks, or opening weights. Only Emberwatch uses blueprints and gates.

Seven worlds also store fields in a legacy shape (exclusive trait groups, `openingCue`, plain-string placeholder values, stat code in the old `code` box, flat `requires` arrays). Load-time migration rewrites them on every load, so the files no longer show an author what the editor saves.

The writing was authored for older prompts. It has not been probed on the cloud model most players use. Emberwatch has no lorebook and no `imageTags`.

## Solution

Refresh all eight bundled worlds: Drone, Emberwatch, Open Chat, City Rampage, Slime Outbreak, Sugarscape Survival, Valentines Survival, and Veilwood.

- Each world file is saved in the current shape, then authored on top of that.
- Each world keeps its title, hook, and core cast (Q1). Prompts, lore, entities, locations, and pacing can be rewritten, added, or cut.
- Each world uses the modern features that fit its premise. Across the set, every major feature appears at least once (Q6).
- Each world proves on the cloud model that it plays at least as well as the old version (Q8).

## Rulings

- **Q1** Scope is feature modernization and a content rewrite. Each world keeps its premise: title, hook, and core cast.
- **Q2** All eight worlds are in scope. Emberwatch and Open Chat meet the same bar as the rest.
- **Q3** Claude drafts the content. Each ticket lands `ready-for-human`, and the user reviews the stripped diff.
- **Q4** No new art. New locations and entities get `imageTags` only. Image visibility rules wait for a later art effort and are out of the coverage goal.
- **Q5** Each world file is run through `migrateWorld` and saved in the current shape before authoring, in one mechanical ticket for all eight. The migrations stay for user files.
- **Q6** Features fit each world, and the set covers every major feature. The approved assignment is in the table below.
- **Q7** Rolled placeholder names on entities stay (the Drone persona, one Slime entity, one Valentines entity).
- **Q8** The first ticket builds a shared world probe. A world passes when it shows no structural regression, wins on the baseline rubric over the old world in the same batch, and has 5 or more runs per arm on the cloud endpoint.
- **Q9** Emberwatch gets a lorebook (keep, barrow, factions) and `imageTags` on every location and entity.
- **Q10** A save of the old world revision must load against the new world and play a turn. Drift (a cut entity or stat drops) is accepted. No compat code.
- **Q11** The changelog gets one Major entry. The shape ticket adds it, and the world tickets add no entry of their own.
- **Q12** One ticket per world. Each lands as one commit with its regenerated fingerprints.

### Feature assignment (Q6)

Every world: current shape on disk, `openings` (no `openingCue`), `imageTags` on every location and entity.

| Feature | Worlds |
|---|---|
| Scripts | Rampage (Alert Level), Valentines (Agility), Drone (Mobility, Firepower), Slime (infection spread), Sugarscape (hunger tick) |
| Trait gates | Drone (modules need a chassis), Veilwood, Emberwatch (kept) |
| Trait modes | Slime (hidden strain), Veilwood (always-on curse) |
| Min/max picks | Drone, Sugarscape |
| Stat toggles | Rampage (Berserk) |
| Opening weights | Veilwood, Sugarscape |
| Blueprints | Emberwatch only |

## User Stories

1. As a new player, I want each bundled world to open on a strong, specific scene, so that my first turn shows what Formamorph can do.
2. As a new player, I want the narration to stay on the world's premise and voice, so that each world feels distinct.
3. As a new player on the default cloud model, I want the bundled worlds tuned for that model, so that they play well where most players play.
4. As a new player, I want stats that change in ways I can follow, so that the numbers mean something in the story.
5. As a new player, I want trait picks that explain themselves before play, so that I know what I am choosing.
6. As a new player, I want the gameplay readme to cover only what I need while playing, so that it stays short.
7. As a returning player, I want several openings in a world, so that a replay starts somewhere new.
8. As a returning player, I want weighted openings in Veilwood and Sugarscape, so that some starts are rare.
9. As a returning player, I want rolled names to stay, so that each playthrough keeps its variety.
10. As a returning player with a save of an old bundled world, I want that save to load and play a turn, so that the refresh does not strand my run.
11. As a returning player, I want my deleted bundled worlds to stay deleted, so that the refresh does not restore what I removed.
12. As a Drone player, I want chassis modules to unlock only with the right chassis, so that my build is coherent.
13. As a Drone player, I want Mobility and Firepower driven by scripts, so that they follow my build without the AI guessing.
14. As a Drone and Sugarscape player, I want min and max pick counts on trait groups, so that the creator stops me from an invalid build.
15. As a Rampage player, I want Alert Level to escalate through a script, so that the military response paces itself.
16. As a Rampage player, I want Berserk as a stat toggle, so that I can switch it on and off in play.
17. As a Slime player, I want the infection to spread through a script, so that the clock is real.
18. As a Slime player, I want a hidden strain trait, so that part of my infection is a surprise.
19. As a Sugarscape player, I want hunger to tick through a script, so that the curse pressures every turn.
20. As a Valentines player, I want Agility driven by a script, so that dodging admirers follows the rules.
21. As a Veilwood player, I want an always-on curse trait and gated traits, so that the forest's rules hold.
22. As an Emberwatch player, I want a lorebook for the keep, the barrow, and the factions, so that the narrator stays consistent about them.
23. As an Open Chat player, I want the blank stage to stay blank and still play better, so that my library entity leads the scene.
24. As a new author, I want each bundled world stored in the shape the editor saves, so that I can learn from the file and the editor alike.
25. As a new author, I want every major feature shown in at least one bundled world, so that I have a working example of each.
26. As a new author, I want each world's readme to name the features it shows, so that I know where to look.
27. As a new author, I want `imageTags` on every location and entity, so that image generation has prompts to start from.
28. As the user reviewing a ticket, I want an image-stripped diff of the world, so that I can read the change without base64 noise.
29. As the user reviewing a ticket, I want probe numbers against the old world, so that I can judge the change by evidence.
30. As a ticket agent, I want one shared probe for every world, so that every world is judged the same way.
31. As a ticket agent, I want a shared structural test suite, so that a world cannot land in a legacy shape or with a broken reference.
32. As a ticket agent, I want the feature coverage checked in a test, so that the set keeps covering every major feature.
33. As a maintainer, I want fingerprints regenerated with each world, so that the seeder and the publish check know every revision.
34. As a maintainer, I want one changelog entry for the refresh, so that the release notes stay short.

## Implementation Decisions

- **Shape first.** One ticket saves `migrateWorld(world)` to disk for all eight worlds, with no content change. World tickets edit content only. The stored `version` stamp follows what `migrateWorld` writes.
- **Edits by script.** World files are edited by parsing, changing, and re-serializing. Ids and existing images are preserved. Every reference (connections, owners, placeholder tokens, trait groups, gates, script stat names) is validated before saving. The `bundled-worlds` project skill holds the procedure and the strip tool (`npm run strip-worlds`).
- **Readme split.** `introReadme` holds trait guidance and shows before trait picks. `readme` holds stat behavior, toggles, and the win condition, and shows on entering play.
  - Ticket 07 ruling (user, option B): Slime's strain is one always-on Hidden trait, "Strain", on The Resident. Its AI text holds a rolled "Strain" placeholder, so the strain varies in narration per replay. The spread script does not read it.
  - Ticket 07 (user): the Test Bench now counts an entity's own trait text as a chip-bearing text, so a placeholder used only there is not flagged as unused. The fix ships in ticket 07.
  - Ticket 10 ruling: Veilwood's curse is The Veil's Hold, always on, and it carries Predator Attention's regen. Its gates are Move Quietly (needs Stress below 75%; a Stamina gate would flicker because the trait drains Stamina) and Veil Sight (on at Toxin 75% or more, and holds the hallucination rule). No pick-time gates. Four openings weighted 3/3/2/1.
  - Ticket 10 ruling (user): the animated-WebP encoder tolerates a truncated GIF. It encodes the frames that decode and stops at the first broken one. Ticket 10 ships this app fix with a test.
  - Ticket 05 ruling: Open Chat keeps one opening, because a library entity's openings replace the world pool (story 23 over story 7). It gets no lore and no entities. Its content pass covers the system prompt, location text, opening and tone values, Style trait text, readmes, and imageTags.
  - Ticket 04 and 06 rulings: any world may follow its play part with a "How this world is built" authoring section that names the features it shows (story 26). The play part comes first, stands alone, and states the win condition.
  - Ticket 06 ruling (user-confirmed): Q14 converts only what the app's fix converts. JPEG is left as it is by design, because a lossless WebP copy grows and a lossy one costs quality.
- **Q16 (user): showcase code.** The bundled worlds are example worlds first. Readability beats efficiency. No script uses a one-character variable name. A script is split into sections the way you would explain it to someone in steps, and each section carries a comment that explains its logic, not only a header comment.
- **Q17 (user): placeholder names.** Placeholder names use title case and spaces, written like a proper noun: `Player Character`, `Placeholder Name`. Never lowercase or camelCase names.
- **Threshold units.** A stat whose max a trait changes uses percent thresholds on its descriptors.
- **Prompts.** World prompt text follows the prompt-writing guide: positive contracts, no example values a small model can parrot.
- **Fingerprints.** Each world ticket regenerates the bundled fingerprints and commits them with the world. A rebase conflict in the fingerprint file is resolved by regenerating it, never by hand.
- **World probe (first ticket).** The existing world-narration probe is extended:
  - It accepts every bundled world and an arm list, where an arm is the working-tree world or a git revision of it.
  - It runs arms interleaved in one batch on the cloud endpoint, so each batch carries its own control.
  - It reports structural metrics per arm: stat pass validity, token and reasoning leaks, choices parse, placeholder tokens left unresolved.
  - It writes transcripts for rubric scoring against the baseline rubric.
  - It drives the real dev build through the baseline harness (Playwright, `window.__baseline`), so prompts, sampler pins, and script timings are the app's own. It adds `reasoning_effort: "none"` at the network route. It replaces the old hand-rendered world-narration probe.
  - It takes its dev-server port from a flag or env var and never reuses a server it did not start, so world tickets can probe in parallel.
  - Open Chat uses the bundled test card as its lead entity in both arms.
  - It runs world, trait, and entity scripts at their real timings, so script-paced stats move. The old arm loads through `migrateWorld`, so its legacy stat code runs as scripts. (Ticket 01 ruling.)
  - The default "before" arm is `ace2e0204`, the last commit before any refresh ticket.
- **No shape change.** The refresh changes world content only. It adds no field to the world or save export shape.
- **No art.** No new images. Visibility rules are out.

## Testing Decisions

- A good test loads a bundled world the way the seeder loads it and checks behavior a player or author sees. It never asserts on authored prose.
- **Shared suite.** One Vitest suite runs over every bundled world, in the pattern of the existing bundled gates test:
  - Current shape: `migrateWorld` changes nothing but what it always stamps.
  - The Test Bench reports no finding on any rule.
  - Coverage: across the set, each feature in the assignment table appears in at least one world.
  - Old saves: a save made against the world's revision before the refresh loads against the new world and commits one turn without error. The fixture is built from that revision in the test, not stored as a copy.
- Ticket 02 rulings (from the user):
  - The old-save fixture reads each world at `ace2e0204` with `git show`. The CI test job fetches that rev at depth 1. A missing rev fails, never skips. No stored copies.
  - Ticket 02 applies only the rules' own sync fixes (image-mislabeled, alias-self-duplicate, alias-leading-article). Every other finding sits in a per-world open list in the shared suite, matched exactly. Each world ticket empties its row.
  - The old-save check asserts that a save with a cut stat still loads and plays a turn (Q10). It bites against a reinstated crash in the load path.
  - **Q13 (user):** `world-oversized-images` is ignored. The shared suite excludes it, so no row lists it.
  - **Q14 (user):** World tickets re-encode their existing art to WebP through the app's own `image-not-webp` fix, run in Chromium (it needs `ImageDecoder` for GIF frames). This is a format change, not new art. Veilwood's GIFs are animated: its ticket proves each WebP keeps the source's frame count and per-frame timing before it lands. An image the encoder's grow-guard keeps goes to the spec session, never forced.
  - Tests that need a legacy shape (the box-code migration test, for example) read the pre-refresh worlds through the same git helper, because no bundled world stores a legacy shape after ticket 02.
  - **Q15 (user):** Open Chat's location keeps no entities; that is the point of the world. Its `location-no-entities` finding stays in Open Chat's row for good. Every other row ends empty.
  - Each coverage row lists its world's Q6 features (Open Chat's list is empty). The set check turns on once all eight rows exist.
- **Per-world tests** only for world-specific behavior, as Emberwatch has today (a gate that must hold, a script's effect on its stat).
- Guards must bite: each shared check is shown to fail once with the old file or a broken reference.
- Prior art: the bundled gates test, the Emberwatch world test, the Open Chat world test, the bundled fingerprint test.
- Probe evidence (Q8) goes in each ticket's comments: arms, run counts, structural metrics, and the rubric result.

## Out of Scope

- New art, image generation, and image visibility rules (a later art effort).
- Background music.
- New bundled worlds, or cutting a world.
- Changes to the world or save export shape.
- Changes to load-time migrations.
- Local-model probes, unless a ticket shows the cloud results cannot decide.

## Further Notes

- Feature-gap audit (2026-10-16): no world uses scripts, trait modes, stat toggles, statUpdates, min/max picks, or opening weights. Stale stored fields: exclusive groups in all eight; `openingCue` and string placeholder values in six; legacy stat `code` in Drone, Rampage, and Valentines (already on the `owner.stats` route); flat `requires` in Emberwatch.
- Every location and every Custom Persona lacks `imageTags` today.
- The August 2.14 refresh left new locations and entities without art and unprobed. This effort closes the probe gap, not the art gap.
