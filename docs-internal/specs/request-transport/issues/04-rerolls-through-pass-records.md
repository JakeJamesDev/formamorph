# 04: Re-Rolls Through The Pass Records

Status: done
Blocked by: 01, 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Recommended model rationale: a contained swap of two builders for two pass-record calls with a seeded material; the characterization tests from 01 define the target.

## What to build

The choices and stats re-rolls build their requests with the choices and stat-updates pass records over the standalone pass input and a turn material seeded with the re-roll's context values, scene entity tokens, the action as the effective action, the narration and the stat snapshot. Each re-roll sets `quiet` to false explicitly, so its status label ("Generating Choices…", "Generating Stats…") shows as today. The two hand-built builders are deleted, and the two matching characterization tests go with them.

Changelog fragment, Minor → Added → ⚙️: re-rolled choices and stats show their Request Anatomy in the AI-context viewer.

## Acceptance criteria

- [ ] A choices re-roll and a stats re-roll send the same prompt, messages and cap as a live turn's pass, with `quiet` false.
- [ ] A mounted test asserts the re-roll status label.
- [ ] The AI-context viewer shows Request Anatomy for a re-roll.
- [ ] Dropping the explicit `quiet: false` turns the label test red.
- [ ] Four gates green.
