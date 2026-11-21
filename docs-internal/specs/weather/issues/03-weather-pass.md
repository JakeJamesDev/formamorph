# 03: Weather Pass

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The narration changes the weather, and the narrator stays consistent with it. The spec covers this in Q1, Q4, Q7, Q10, Q11, Q15, Q24 and the Weather Pass, Turn Commit and narrator sections.

- **Pass.** A new turn pass beside the clock pass, run every turn while Weather is on. Input: narration, current World Weather, allowed kinds, daylight. Bright Sun is not offered at night. Output: "no change" or one offered kind, structured like the clock reading, with a text fallback. An answer outside the offered set reads as no change. Samplers pinned in the per-prompt samplers.
- **Page one.** On the opening turn the pass reads page one only when no weather was authored (ticket 02's resolution).
- **Turn Commit.** The commit carries the resulting World Weather in this order: pass answer, nightfall rule (Bright Sun → Clear when the turn ends at night), a hook point for script sets (ticket 07), final weather. This ticket owns that order.
- **Turn Landing.** Applies the weather through the effects port and reports a Weather Change when the experienced weather changes, with whether it may fire foreground: not on the opening turn, not from the nightfall rule, not into Clear or Shelter. The stat re-roll mode is a named skip.
- **Narrator.** The scene context gets one weather line while Weather is on, and page one gets the resolved weather.
- **Probes.** The pass prompt and the narrator line ship with probe numbers on the cloud default, with in-batch controls, including metaphor, past-tense and reported-weather traps.
- **Docs.** The world settings wiki page says the narration drives weather within the allowed kinds.

## Acceptance criteria

- [ ] Turn Pipeline tests with a fake request adapter cover: no change, each kind, an out-of-set answer, Bright Sun offered only in daylight, nightfall from Bright Sun, a move into and out of Shelter, the opening turn and the stat re-roll skip. Each guard bites when its bug returns.
- [ ] An authored start weather leaves the page-one Weather Pass out of the plan; an unset one includes it.
- [ ] Probe results for the pass and the narrator line are recorded in the ticket's Landed section, with run counts per arm.
- [ ] Changelog fragment written.

For you: play a few turns in an opted-in world, let a storm roll in, and check the narration keeps it.
