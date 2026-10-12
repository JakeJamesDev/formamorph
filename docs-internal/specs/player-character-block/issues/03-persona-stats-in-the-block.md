# 03: Persona Stats in the Block

Status: done
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: chip code across the live and authored scenes, a new chip axis, a reversal of an earlier ruling, and the probe that decides whether "Other Stats" reads as the player's.

Parent: [Player Character Block spec](../spec.md)

## What to build

The played persona's own stats render inside its block, nested after its traits as the Entities chip nests a cast member's stats, laid out by the persona's own stat groups. The Stats chip holds the world's player stats only. A persona stat whose plain name clashes with a world stat keeps the numbered key the stat request gives it. Rulings Q4, Q5 (stats half), Q8, Q9, Q10.

The Persona chip gains a Stats toggle with the Entities chip's shape: on by default, the off state drops the stats field, every saved token keeps rendering with stats. Summary content lists trait names on one line and keeps the stats block.

In the narration, choices and storyboard prompts, the Stats chip's header becomes `Other Stats` and the chip moves after Persona and Other Traits. The continuity planner, director and character pass send the Persona chip with No Stats and carry no Stats chip (Q20). The choices prompt's Persona chip switches from Name to Summary content (Q7). The stat request prompt and the text pass are untouched. This reverses Q75 of the entity-stats spec for the narration, choices and planning prompts; that spec gets a note pointing here.

## Acceptance criteria

- [ ] Through the chip values map, from a scene with a played persona that owns stats: the Persona chip's Markdown, Simple and XML values nest the stats after the traits; the Stats chip holds the world stats alone; a clashing name carries its numbered key in both; the off state of the new axis drops the stats field; a persona with no stats shows no stats field; a null persona yields the none placeholder.
- [ ] The live scene and the authored scene both feed the persona's stats to the Persona chip; the authored scene passes the Custom Persona entity's stats under the None rule. The chip editor shows the new Stats toggle on the Persona chip.
- [ ] The narration, choices and storyboard prompts carry `Other Stats` after Other Traits, the other three Persona prompts send No Stats (Q20), and the choices prompt sends the Persona chip's Summary content, asserted as the existing persona prompt tests assert headers and variants.
- [ ] The stat request prompt, its schema keys and the text pass render byte-identical to before this ticket.
- [ ] A narration and a choices probe on the default endpoint with ticket 02's prompt as the in-batch control, at least 6 runs per arm, scoring the existing name-leak and stat-tabulation checks plus whether the narrator lets the player's stats shape outcomes and whether choices fit the player's stats and traits. The report states the numbers; the user rules on the shipped wording from it.
- [ ] A note on Q75 in the entity-stats spec points to this effort.
- [ ] Changelog fragment written.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.

## Probe result

`testing/baseline/harness/persona-block-stats-probe.cli.ts`, default endpoint (`default`, Gemma 4 build), 2026-10-11. Sedge Landing with a played library persona nobody knows, who owns one trait (Hedge Herbalist) and two stats: Calm 10 (Rattled) and a Resolve that clashes with the world's, keyed "Resolve (2)". `control` is ticket 02's prompts: Player Stats before the block, the persona's stats in that chip, the choice writer on Name. `block` is this ticket. Arms interleave run by run.

| Check | narration: control | block | choices: control | block | storyboard: control | block |
|---|---|---|---|---|---|---|
| player-name ↓ | 0/162 | 0/162 | 0/48 | 0/48 | — | — |
| npc-name-leak ↓ | 74/162 | 79/162 | — | — | — | — |
| stat-tabulation ↓ | 0/162 | 0/162 | — | — | 0/48 | 0/48 |
| numeral-leak ↓ | 0/162 | 0/162 | 0/48 | 0/48 | 0/48 | 0/48 |
| numbered-name ↓ | 0/162 | 0/162 | 0/48 | 0/48 | 0/48 | 0/48 |
| label-leak ↓ | 0/162 | 0/162 | 0/48 | 0/48 | 0/48 | 0/48 |
| rattled ↑ (stats shape the output) | 20/162 | 15/162 | 18/48 | 17/48 | 0/48 | 1/48 |
| trait-fit ↑ (the herbalist trait shows) | 14/162 | 11/162 | 7/48 | 3/48 | 0/48 | 0/48 |
| contract ↑ | — | — | 48/48 | 48/48 | — | — |

Three batches pooled: 12 runs per case twice, then 30 per narration case. The block's stats carry their numbers (`10/100 (Rattled)`), as the Entities chip renders an entity's, while the old Stats chip sent the descriptor alone. No arm leaked a numeral, a label or a numbered key.

`rattled` and `trait-fit` are keyword proxies and read loose: `rattled` matched an NPC's anxious look and "not wavering", and `trait-fit` matched a generic satchel and moss gathered as kindling. Control choices scored trait-fit while their prompt held no trait text at all. Narration `rattled` read 11/72 vs 5/72 over the first two batches; the 90-run batch read 9/90 vs 10/90, so that gap was drift. The proxies show no change in either direction they can resolve.

The continuity planner, the director and the character pass send the persona block with No Stats and carry no Stats chip (Q20), so their bodies match ticket 02 apart from the token, and they are not probed here.

The stat request's byte-identity guard is an inline snapshot of the schema prompt, the text pass and the schema, recorded at base before any source change, with a played persona that owns a clashing stat.

Guard proof: each rule reinstated alone turned its tests red. Persona stats left in the Stats chip failed 4 tests; the block on unkeyed names, 3; No Stats ignored, 2; the authored scene with no persona, 1; the Persona chip without its Stats axis, 2; the choices prompt back on Name, 9; the narration Stats chip back to "Player Stats", 1; the planner and director Persona chips back on Stats, 2; the Open Chat narration prompt in the old order, 1; its choices prompt back on Name, 1.
