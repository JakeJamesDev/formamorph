# 01: Narrated-Move Probe

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: it judges cloud probe numbers that decide whether the narrated-move check needs a prompt of its own.

## What to build

Evidence that Suggest mode's post-narration location request can tell when the narration has taken the player somewhere, before ticket 04 wires it into Auto mode (Q8, Q9).

The existing location-router probe gains two sets of neutral, made-up scenes. Each scene has a current place, its reachable destinations, a player action, and a narration.

- **Carried:** the narration takes the player into a reachable place without the action asking for it. Cover being carried, dragged, led, pushed, and an opening that starts inside a child place. Include narrations that name the place only by description (for example "her hut"), never by its exact name.
- **Stay:** the narration only looks toward a place, talks about it, or has another character come or go, and the player stays.

The probe sends the reused request on the cloud default model with in-batch controls, 10 runs per set.

## Acceptance criteria

- [x] The probe runs both sets on the cloud default model and reports carried moves found out of 10 and false moves out of 10, per scene and in total. `testing/baseline/harness/location-narrated-probe.cli.ts`, 10 carried and 8 stay scenes, 10 runs, table below.
- [x] The bar is applied: at least 9 of 10 carried narrations move the player, and at most 1 of 10 stay narrations does. Applied to set totals as rates (spec ruling); the probe prints MEETS or MISSES per arm.
- [ ] If the reused request meets the bar, the ticket records the numbers and ticket 04 reuses it as is. Not taken: the reused request misses.
- [x] If it misses, the ticket adds a narrated-move prompt that follows the prompt-writing guide (positive contracts, no example values). It probes that prompt against the reused one in the same batches and records both sets of numbers. Ticket 04 then uses the new prompt. `defaultNarratedMovePrompt` and `defaultNarratedMoveUserPrompt` in `GamePrompts.ts`, not wired (ruling Q2); numbers below.
- [x] No scene in the probe comes from a private world or play log. All three worlds and 18 scenes in `testing/baseline/location-narrated-cases.json` are written for the probe.

For you: read a few of the carried narrations the probe counts as misses, in the probe's output, and judge whether a player would say they moved.

## Probe results

Cloud default model, 10 runs, both arms and the 12 router gold cases (control) in every batch. Reused = the shipped location-change prompts as Suggest mode sends them after the narration. Narrated = the new prompt pair, sent through the same `locationSuggest` pass record.

| Set | Reused | Narrated | Bar |
|---|---|---|---|
| Carried moves found | 10/100 (10%) | 100/100 (100%) | >= 90% |
| Stay false moves | 10/80 (12.5%) | 10/80 (12.5%) | <= 10% |
| Control right | 111/120 | 110/120 | none |

`thrown-out` and `rowed-across` are held out: written after the prompt, with verbs it does not list. Both score 10/10 on the narrated arm.

- **The reused request cannot see the narration.** `defaultLocationChangeUserPrompt` renders only `<PLAYER ACTION>`, so the narration value the pass supplies never reaches the model. Its one carried hit (`dragged`, 10/10) comes from the action alone.
- **The narrated prompt misses the stay bar by one scene.** All 10 false moves are `look-toward`, deterministic. The user ruled to land with it, and ticket 04 uses it.
- **The cue is the threshold, not the look.** In `look-toward` the action is "I wait by the foot of the ladder", and the longhouse is reached by a ladder. The same action with a bland narration moved the player 5 of 5 runs. The same narration with "I wait on the walkway" moved them 0 of 5. Two wording fixes (a threshold line; "in it" for "inside or at it") changed nothing.
- **This is a router miss first.** The reused (router) prompt moves on that action alone 10 of 10, so in Auto mode the router moves the player before the narration, and Q7 skips the post-narration check on that turn. It is a follow-up of its own.
- Per-scene counts: narrated hits every carried scene 10/10 and has 0/10 false moves on every stay scene but `look-toward`. Reused finds only `dragged`.
- Control: the narrated prompt moves on `summon-other` 10/10 (waving a vendor over, no narration); the reused prompt moves on `pointing-at` 9 of 10.
- The threshold diagnostic (5/5 and 0/5) was an ad-hoc run of variant scenes through `--cases`; it is not in the committed set.

For ticket 04:

- The narrated prompt answers a stay with the current location's name, which `matchLocationResponse` reads as no move. Its whole-word fallback would read a current name that contains a destination's name (a place named after its parent plus a word) as a move. No probe world has that case.
- The probe calls `locationSuggest.buildRequest` directly. That pass's `isDue` excludes the opening, so the opening result says nothing about the pass gate.

## Landed

**Not verified**

- The reused-request branch: the reused request missed the bar, so the narrated prompt branch applies.

**For you**

- For you: read a few of the carried narrations the probe counts as misses, in the probe's output, and judge whether a player would say they moved. Every narrated-arm carried scene passed, so the misses are the reused arm's; run `npx vite-node testing/baseline/harness/location-narrated-probe.cli.ts -- --runs 1` and read its `misses:` list, or the scenes in `testing/baseline/location-narrated-cases.json`.
- Judge whether `look-toward` (waiting at the foot of the longhouse ladder) should count as staying in the village. The probe treats it as a stay.
- The probe is a new file beside `location-router-probe.mjs` rather than an extension of it. The old probe still sends to the local test server and does not render the prompt's headed blocks; the new one runs its gold cases as the control.
