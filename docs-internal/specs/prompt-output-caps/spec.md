# Prompt Output Caps

Status: ready-for-agent
Spec session: Prompt Output Caps

## Problem Statement

A player can set one output limit: the endpoint's Max Output, which the narration call follows. Every other call sends a cap that lives in code. The precall planner gets 256 tokens, the director 320, a diary entry 80, the turn digest 200, and the player cannot see or change any of them. A player who moves to a model that writes longer plans, or who wants a shorter digest, has no control.

Three calls send no cap at all. Choices, Stat Updates and Location Change run to the endpoint's limit. On an endpoint with no Max Output override, that limit is whatever the server allows, so a verbose model can spend hundreds of tokens on a stat line. On such an endpoint the Reasoning Budget also collapses to zero for those calls, because the budget is a percent of a cap that does not exist.

Two calls have no place in Settings. Milestone Select and Discover Entity have a request type, a temperature pin and a reasoning tier, but no Prompts tab. Their prompt text is a constant. A player who wants to tune them has nowhere to go, and the AI Context viewer's jump to the owning prompt dead-ends on both.

One tab is wired to the wrong prompt. The Scene Tags tab's per-prompt Options read and write narration's tuning, because the tab is missing from the tab-to-request map. Its own temperature pin is unreachable from the UI.

## Solution

Every gameplay prompt that has a tab gains a Max Output row in its Options panel, beside the sampler and reasoning rows. The row is off by default and reads Auto with the shipped value. Switched on, a slider sets the cap in tokens. The value lives on the prompt preset, locks under a built-in preset, and travels in a shared preset.

The three uncapped calls gain shipped caps. Choices gets a fixed value and a row. Stat Updates and Location Change get caps that the Turn Plan computes from the world, with no row: the stat cap scales with the world's stat count, and the location cap scales with the longest destination name.

Milestone Select and Discover Entity become full Prompts tabs. Each gets a system prompt and a user template on the preset, a pass record so the Request Anatomy hub can draw it, and a Max Output row. The discover prompt and the player-triggered rewrite prompt merge into one, since they differ by one clause that is inert when no later material is present. The dead non-incremental milestone prompt goes.

The Scene Tags tab gets its map entry, and a drift guard makes sure no rail tab can miss one again. The Reasoning Budget readout gains the token result of its percent, so the link between the two rows is visible.

## User Stories

1. As a player, I want to see the output cap each prompt sends, so that I know why a plan or a digest stops where it does.
2. As a player, I want to raise the cap on the precall planner, so that a model that writes fuller plans is not cut mid-sentence.
3. As a player, I want to lower the cap on the turn digest, so that my long-term memory stays terse on a verbose model.
4. As a player, I want the cap row to read Auto with the shipped value when it is off, so that I know what the app sends without switching anything on.
5. As a player, I want the row switched off to send the shipped value, so that turning it on and off again leaves behavior unchanged.
6. As a player, I want the slider to keep my custom value while the row is off, so that I can compare the shipped value against mine by toggling.
7. As a player, I want the cap in tokens, not a percent of narration, so that raising narration length does not silently raise the diary.
8. As a player, I want a cap row on Choices, so that a model that pads its options is stopped before the last choice is lost.
9. As a player, I want Stat Updates to stop at a size that fits my world's stats, so that a verbose model cannot spend the endpoint's whole limit on stat lines.
10. As a player, I want Location Change to stop at a size that fits my longest destination name, so that the reply is never cut before the name ends.
11. As a player on an endpoint with no Max Output override, I want the Reasoning Budget to work on Choices, so that my percent is not a percent of nothing.
12. As a player, I want the Reasoning Budget readout to show the token result, so that I see what 25% of this prompt's cap means.
13. As a player, I want the Reasoning Budget token readout to follow the Max Output row, so that a change to one is visible in the other at once.
14. As a player on a built-in prompt preset, I want the cap row locked with the read-only notice, so that I know to duplicate the preset before editing.
15. As a player, I want my cap overrides to travel in a shared preset, so that a preset tuned for one model carries its caps with its samplers.
16. As a player importing a shared preset from an older app, I want the missing cap map treated as all Auto, so that the import succeeds.
17. As a player importing a shared preset with a malformed cap, I want that entry dropped and the rest kept, so that one bad value does not block the import.
18. As a player, I want a Milestone Select tab under Memory, so that I can read and edit the prompt that decides which digests survive.
19. As a player, I want a Discover Entity tab under Story after Character, so that I can read and edit the prompt that writes a discovered character's note.
20. As a player, I want one discover prompt for both the first note and the rewrite, so that the two notes read alike and I edit one text.
21. As a player, I want the milestone user template to expose the remembered and new moment lists as chips, so that I can reword the framing around them.
22. As a player, I want the reply-format lines of the milestone request kept out of the template, so that an edit cannot break the parser that reads Keep, Forget and Weight.
23. As a player, I want the discover user template to expose the name, the first passage and the later material as chips, so that I can reword the framing around them.
24. As a player, I want the later-material chip to vanish when there is none, so that a first note and a rewrite share one template.
25. As a player, I want the Request Anatomy hub to draw a Milestone Select request, so that I see its assembled shape under my live settings.
26. As a player, I want the Request Anatomy hub to draw a Discover Entity request with the fan-out caption, so that I know it runs once per discovered character.
27. As a player, I want a click on a milestone or discover run in the AI Context viewer to jump to its tab, so that the jump no longer dead-ends.
28. As a player, I want the Milestone Select tab hidden when memory digests are off, so that the rail shows only prompts that can send.
29. As a player, I want the Discover Entity tab hidden when describe-characters is off, so that the rail shows only prompts that can send.
30. As a player, I want the Scene Tags tab's Options to tune Scene Tags, so that a temperature I set there does not change narration.
31. As a player, I want Time Passed and Opening Time left without a cap row, so that I cannot break their one-word parsers by accident.
32. As a player, I want Stat Updates and Location Change left without a cap row, so that the Options panel does not offer a control that gains nothing.
33. As a player, I want the Narration tab left without a cap row, so that narration keeps following the endpoint's Max Output as it does now.
34. As a player, I want the AI Context viewer to show the cap a request went out with, so that I can confirm my override reached the wire.
35. As a player, I want the Auto readout on Choices to show the new shipped value, so that the first cap on Choices is not a surprise.
36. As a player on a reasoning endpoint that takes a token budget, I want the cap change to move the budget it sends, so that the budget stays a share of the cap.
37. As a player on Anthropic's endpoint, I want the budget kept below my custom cap, so that a low cap does not produce a rejected request.
38. As a player with the concurrent turn requests setting on, I want the discover fan-out to use the same prompt and cap as the serial path, so that both paths behave alike.
39. As a player, I want the milestone selector to keep its silent, between-turns behavior, so that adding a tab does not change when it runs.
40. As a player, I want a custom cap on Thinking to reach the planner in staged mode too, so that both planning modes honor it.
41. As a player, I want each of Director, Character and Storyboard to carry its own cap, so that raising one stage does not raise the others.
42. As a world author, I want the choices cap probed on both reference tiers before it ships, so that the last choice is not cut on the average model.
43. As a world author, I want the merged discover prompt probed on both reference tiers, so that the note quality does not regress on either.
44. As a developer, I want every rail tab guarded to have a tab-to-request entry, so that the Scene Tags bug cannot recur.
45. As a developer, I want every rail tab guarded to have an anatomy hub, so that a new tab cannot land without one.
46. As a developer, I want the shipped caps in one table beside the pass records, so that the sizing rationale stays with the code that sends it.
47. As a developer, I want the dead non-incremental milestone prompt removed, so that no one mistakes it for the live one.

## Implementation Decisions

### The cap row

- The row sits in the per-prompt Options panel between the Endpoint row and the Native Reasoning row. It copies the sampler row shape: a checkbox that enables the override, a label, a hint, a slider, and a readout.
- Off is Auto. The slider is dimmed and pinned at the shipped value; the readout reads `Auto · N tok`. On, the slider is live and the readout reads `N tok`.
- The slider runs 8 to 2048 in steps of 8.
- The row appears on Thinking, Director, Character, Storyboard, Summary, Diary, Choices, Scene Tags, Milestone Select and Discover Entity. It does not appear on Narration, Stat Updates, Location Change, Time Passed or Opening Time.
- The row is preset-scoped, the same as the sampler rows: locked with the read-only notice under a built-in preset, editable on a user preset.
- The Reasoning Budget readout gains the resolved cap's token result: `25% · 80 tok`. It reads the row's resolved cap, custom or shipped.
- Readouts size to their content and never wrap. The slider absorbs the difference. A fixed readout width wraps under a wide monospace UI font such as JetBrains Mono. (Ruled after a preview check.)

### Storage

- The prompt preset record gains a `maxOutput` map: request type to `{ custom: boolean, value: number }`, partial, absent entries meaning Auto. It sits beside the sampler map and the reasoning budget map, with the same accessors, the same writers, and the same built-in short-circuit to an empty map.
- The shared preset format carries the map under the same name, omitted when empty. The parser drops malformed entries one by one and keeps the rest, clamping the value to the slider's range. Format version stays at 1; the field is additive.
- The preset text keys gain four entries: the milestone system prompt, the milestone user template, the discover system prompt and the discover user template. Shipped defaults come from the canonical prompts. The section-style restyle and the share filter pick them up without change.

### Resolution

- The AI Request Spec resolves the cap in this order: the prompt's custom override when on, else the call's internal cap, else the target's Max Output. The cap source label follows: a custom override is `internal`.
- The reasoning budget scales from the resolved cap, so a custom cap moves the budget with it. The Anthropic under-cap rule keeps applying against the resolved cap.

### Shipped caps

- The pass cap table gains Choices at 256.
- Stat Updates gets a computed cap of 16 tokens per stat plus 16, from the plan input's stat count.
- Location Change gets a computed cap of the longest destination name's estimated tokens plus 8, from the material's destination list. The estimate uses the pipeline's existing token estimator.
- Both computed caps live in the pass records' request builders, so the Turn Plan carries a number and the AI Request Spec sees no difference from a fixed cap.
- Milestone Select's cap moves from the view into the pass cap table, at its current 300.
- Every other shipped cap keeps its value.

### Two new tabs

- Milestone Select joins the Memory group between Summary and Diary. Discover Entity joins the Story group after Character.
- Milestone Select gates on memory digests. Discover Entity gates on describe-characters. Both availability flags feed the rail, the tab-to-request map, the anatomy hub and the drift guards.
- Each tab has a System Prompt editor and a User Message editor. Each gets a description line in the rail's description table, within its length rule.
- Section headers live in the block chips, not in affixes. The affix design reserves affixes for one short in-sentence value, and its 40-character single-line editor guards that. A block chip renders its header plus its body, or the empty string when it has nothing, so a section vanishes whole. The rendered user message is trimmed. Headers are therefore not player-editable; the text around the chips is. (Ruled from the tickets' intent questions.)
- The milestone user template exposes two block chips: the remembered moments and the new moments. Each renders its header and its numbered list, kept first, numbered continuously, with the new-moments header carrying "oldest first" only on a first run, so both shapes stay byte-identical to today's message. Code appends the reply-format lines (Keep, Forget, Weight, or Keep alone on a first run) after the rendered template. The parser contract does not enter the template. No prompt-text change, so no probe.
- The discover user template exposes three chips: the character's name as a plain in-sentence value behind a literal "Character:" label, and two block chips for the passage they first appeared in and the later material. Both block chips vanish when empty, so a first note and a rewrite use one template and one system prompt, and a rewrite with no later material sends the first-note message byte for byte. Both use the rewrite's "first appeared in" wording; the merged-prompt probe covers that wording change.
- The discover system prompt and the rewrite system prompt merge into one text that names the later material as optional and says it outranks the first impression. The rewrite constant goes.
- The non-incremental milestone prompt and its unused user-message builder go.
- Milestone Select gets a pass record with a between-turns caption, fixture material for the hub (a canned kept list and fresh list), and the Low reasoning tier, the same as Summary. The view's selector call builds its request through the record so the two never drift.
- Discover Entity's pass record moves to the labeled request form, tiled from the preset's system prompt and user template, so it carries anatomy. The view's serial drainer and the concurrent fan-out both go through it.
- The AI Context viewer's tab-for-request map gains both types. The comment that names them as absent by design goes.

### Scene Tags fix

- The tab-to-request map gains the Scene Tags entry. A drift guard asserts every grouped tab has an entry, so the map can never fall behind the rail.

### Changelog

- One 👤 entry under In Progress covering the cap row, the two tabs and the Scene Tags fix.

### Export shape

- The shared prompt preset gains `maxOutput` and four text keys. All additive. The world and save shapes do not change.

## Testing Decisions

A good test drives a public seam with plain values and asserts what leaves it: the spec that reaches the wire, the request a pass builds, the preset that survives a round-trip, the row the panel renders. It never reads a private map or a constant to check it against itself.

Seams, highest first:

- **AI Request Spec builder.** A custom cap reaches `max_tokens`; Auto falls to the pass cap; a custom cap under a built-in preset is ignored; the reasoning budget scales from the resolved cap; the cap source reads `internal` for a custom override. Prior art: the sampler and pin tests in the spec builder's test file.
- **Pass records' request builders.** Choices sends 256; the stat cap grows with the stat count; the location cap grows with the longest destination; the milestone record numbers both lists and appends the format lines; the discover record renders the later-material section only when present; both records carry anatomy. Prior art: the caps table and the sources table in the pass records' test file.
- **Preset store and share round-trip.** The map persists, locks under a built-in, folds into a user preset, survives export and import, and drops a malformed entry. Prior art: the tuning tests and the share tests.
- **Settings modal rendered with real providers.** The row reads Auto with the shipped value, unlocks on the checkbox, keeps its value across a toggle, shows the read-only notice under a built-in; the budget readout shows the token result; the Scene Tags tab edits its own tuning; each new tab renders its two editors. Prior art: the reasoning-row tests for the modal.
- **Drift guards.** Every grouped tab has a tab-to-request entry, an anatomy hub, a description, a label, and an availability flag. The jump test inverts: both new types now resolve to a tab. Prior art: the prompt group tests and the anatomy preview tab sweep.
- **Probes.** The choices cap at 256 on both reference tiers, counting replies cut before the last choice. The merged discover prompt on both tiers against the current one, per the prompt-writing guide's A/B bar.

## Out of Scope

- A cap row on Narration, Stat Updates, Location Change, Time Passed or Opening Time.
- Caps expressed as a percent of the endpoint's Max Output.
- Per-prompt slider ranges.
- Exposing the three editor helpers (summarize, bridge description, image tag prompt), which send fixed caps through their own fetch.
- The capability probe's one-token request.
- Routing the milestone selector through the Turn Pipeline's runner. It keeps its between-turns trigger in the view and only builds its request through the new record.
- A Preview surface for the two new tabs beyond what the anatomy hub gives every tab.

## Further Notes

- The shipped caps were sized per call by output shape, not derived from a narration cap. The git history shows them arriving at different times with no shared formula. This is why the row stores tokens, not a ratio.
- The reasoning-budget collapse on uncapped calls is closed for Choices by its shipped cap and for Stat Updates and Location Change by their computed caps. Narration keeps the existing behavior: on an endpoint with no Max Output override its budget is zero, which is unchanged by this spec.
- The two computed caps are deliberately hidden. Their inputs come from the world, so a user value would be right for one world and wrong for the next.
- Merging the discover and rewrite prompts is a prompt-text change to a probed prompt, so it ships with probe evidence, not on reasoning alone.
