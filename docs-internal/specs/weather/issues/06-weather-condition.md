# 06: Weather Condition

Status: ready-for-human
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

- [x] Condition and image Visibility tests cover each kind, Clear, a Sheltered player (still holds), outside play and the read after the weather step. `traitGates.weather.test.ts`: each kind, Clear, Sheltered, Default Weather outside play, settle with a per-commit weather, location, entity and item images. `weatherPass.test.ts` reads the gate after a commit where a script set the weather, and after the nightfall rule changed a set. No automated test covers GameViewer's own wiring of the weather into the gate (see Not verified).
- [x] A location image gated on Rain shows only while it rains, in the preview through the dev hook. `fixture=weatherCondition` with `__fmDev.weather(...)`: backdrop is the rain art at rain only, dry art at clear, snow and storm.
- [x] The Test Bench finding bites when its trap returns. Reinstated the bug (the outside-the-list filter never matches): 2 of its 4 tests went red; restored and grepped.
- [x] Frames `.scratch/frames/weather-condition-light.png` and `.scratch/frames/weather-condition-dark.png` show the picker at a desktop width. 1280 × 800, Availability tab of a trait.
- [x] Changelog fragment written.

⚠️ Export shape: Requirement Rows gain the Weather Condition kind.

## Landed

**Not verified**
- The Condition's read after the weather step in a real turn. The read is the committed weather state, which `gatedWorld` carries as it carries the daypart. Only the dev hook, not a model turn, moved the weather in the preview.
- The Test Bench rule in the app's panel. Unit tests cover it.
- The editor's Add Requirement list in the preview. The chip and its kinds are in the frames; the list entry is covered by a component test.

**For you**
- World Editor, a trait's Availability tab, Add Requirement: check that **Weather** shows only while the world's Weather is on, and that its chip reads well beside the Time of Day chip.
- Open Test Bench with a trait gated on a kind you then take off the allowed list: check the new warning reads clearly.
- Not done: the starting trait state (the first settle at New Game), the library entity editor and the Enter World flow read Clear, not the Default Weather. The World Editor, Test Bench lens and entity mirror read Default Weather. Say if you want the rest fed too.
