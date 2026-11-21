# 06: Weather Condition

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Traits and image Visibility rules can react to the weather. The spec covers this in Q27 and the Weather Condition section.

- **Condition.** A new Condition kind beside the Time Condition: holds while the World Weather is one of a chosen set (Clear included). No owner, no Not. It reads the World Weather, not the experienced weather.
- **Reading.** Once per turn commit, after ticket 03's final weather step. Outside play it reads Default Weather, or Clear when unset.
- **Editor.** A picker and text following the Time Condition's, offered while Weather is on.
- **Test Bench.** A finding for a Weather Condition naming a kind outside the allowed list.
- **Docs.** The Requirements wiki page describes the Condition, and `CONTEXT.md` gets the Weather Condition entry.

## Acceptance criteria

- [ ] Condition and image Visibility tests cover each kind, Clear, a Sheltered player (still holds), outside play and the read after the weather step.
- [ ] A location image gated on Rain shows only while it rains, in the preview through the dev hook.
- [ ] The Test Bench finding bites when its trap returns.
- [ ] Frames `.scratch/frames/weather-condition-light.png` and `.scratch/frames/weather-condition-dark.png` show the picker at a desktop width.
- [ ] Changelog fragment written.

⚠️ Export shape: Requirement Rows gain the Weather Condition kind.
