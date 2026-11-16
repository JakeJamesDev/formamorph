# 21: Streaming Colors Fallback

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

Spec Q74 (1): when the model can't read quotes as fast as the stream brings them, the turn stops gating quotes and colors after narration, as before Q72, so the reveal keeps today's even pace.

- **The decision:** compare the device's carried run time (ticket 18 keeps it across turns) with the measured arrival rate. When the model can't keep up, the turn falls back. Pick the rule and its threshold from measurements, and record them in the ticket.
- **Once per turn:** a turn may switch to the fallback once, at any point, and never back. After the switch, the pacer runs as today's, and quotes color at narration end with the full-turn reading.
- **Quotes already read** before the switch keep their streamed colors.
- **Unchanged:** a GPU device (runs of 17–119 ms) never falls back on the test scripts.
- **Changelog:** fold into the unreleased Character Mentions entries.

## Acceptance criteria

- [ ] Fake 1.25 s run, probe passage and 12-line dialogue, `steady` script. At 100 tokens/s the turn falls back, and its longest word gap and reveal time match today's pacer within 10%. Ticket 18 measured 68 ms and 3.5 s for today at 100 tokens/s on the probe. The test is proved by removing the fallback.
- [ ] At 50 tokens/s with the same run, the turn keeps streaming colors, with no word gap over 150 ms (ticket 18's bar).
- [ ] With a 60 ms run, no turn falls back at 25, 50 or 100 tokens/s.
- [ ] A turn that falls back mid-way keeps its already-colored quotes and never re-enters gating.
- [ ] Report the threshold, and a table of longest word gap and reveal time for each speed, before and after.
