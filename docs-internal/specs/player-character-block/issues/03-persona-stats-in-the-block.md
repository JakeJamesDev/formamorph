# 03: Persona Stats in the Block

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: chip code across the live and authored scenes, a new chip axis, a reversal of an earlier ruling, and the probe that decides whether "Other Stats" reads as the player's.

Parent: [Player Character Block spec](../spec.md)

## What to build

The played persona's own stats render inside its block, nested after its traits as the Entities chip nests a cast member's stats, laid out by the persona's own stat groups. The Stats chip holds the world's player stats only. A persona stat whose plain name clashes with a world stat keeps the numbered key the stat request gives it. Rulings Q4, Q5 (stats half), Q8, Q9, Q10.

The Persona chip gains a Stats toggle with the Entities chip's shape: on by default, the off state drops the stats field, every saved token keeps rendering with stats. Summary content lists trait names on one line and keeps the stats block.

In the six default prompts, the Stats chip's header becomes `Other Stats` and the chip moves after Persona and Other Traits. The choices prompt's Persona chip switches from Name to Summary content (Q7). The stat request prompt and the text pass are untouched. This reverses Q75 of the entity-stats spec for the narration, choices and planning prompts; that spec gets a note pointing here.

## Acceptance criteria

- [ ] Through the chip values map, from a scene with a played persona that owns stats: the Persona chip's Markdown, Simple and XML values nest the stats after the traits; the Stats chip holds the world stats alone; a clashing name carries its numbered key in both; the off state of the new axis drops the stats field; a persona with no stats shows no stats field; a null persona yields the none placeholder.
- [ ] The live scene and the authored scene both feed the persona's stats to the Persona chip; the authored scene passes the Custom Persona entity's stats under the None rule. The chip editor shows the new Stats toggle on the Persona chip.
- [ ] The six default prompts carry `Other Stats` after Other Traits, and the choices prompt sends the Persona chip's Summary content, asserted as the existing persona prompt tests assert headers and variants.
- [ ] The stat request prompt, its schema keys and the text pass render byte-identical to before this ticket.
- [ ] A narration and a choices probe on the default endpoint with ticket 02's prompt as the in-batch control, at least 6 runs per arm, scoring the existing name-leak and stat-tabulation checks plus whether the narrator lets the player's stats shape outcomes and whether choices fit the player's stats and traits. The report states the numbers; the user rules on the shipped wording from it.
- [ ] A note on Q75 in the entity-stats spec points to this effort.
- [ ] Changelog fragment written.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
