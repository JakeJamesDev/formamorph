# 01: Narrated-Move Probe

Status: ready-for-agent
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

- [ ] The probe runs both sets on the cloud default model and reports carried moves found out of 10 and false moves out of 10, per scene and in total.
- [ ] The bar is applied: at least 9 of 10 carried narrations move the player, and at most 1 of 10 stay narrations does.
- [ ] If the reused request meets the bar, the ticket records the numbers and ticket 04 reuses it as is.
- [ ] If it misses, the ticket adds a narrated-move prompt that follows the prompt-writing guide (positive contracts, no example values). It probes that prompt against the reused one in the same batches and records both sets of numbers. Ticket 04 then uses the new prompt.
- [ ] No scene in the probe comes from a private world or play log.

For you: read a few of the carried narrations the probe counts as misses, in the probe's output, and judge whether a player would say they moved.
