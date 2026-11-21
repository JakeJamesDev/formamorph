# 01: Time on Openings

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

An author can choose the time of day a story starts. The spec covers this in Q21–Q23, Q25 and Q26. It needs no weather code and works with Weather off.

- **Shape.** An Opening gains an optional Time, a daypart. The world gains an optional Default Time, outside the Weather block. Entity Openings (Others and Self) share the field.
- **Resolution.** New Game resolves the start time: the drawn Opening's Time → Default Time → the opening-time pass reading page one → the shipped default start hour. The shipped default opening reads Default Time. A daypart is stored as its start hour from the story clock's daypart table.
- **Pass skip.** When a time is authored, the opening turn's plan leaves out the opening-time pass, and the start hour is set before page one is written, so page one's clock line carries it.
- **Redraw.** A page-one redraw resolves the time again from the newly drawn Opening.
- **Editor.** A Time picker per Opening row (empty = world default) and a Default Time picker in the World Editor. Both get dev-route coverage.
- **Docs.** The Openings and world settings wiki pages describe both fields.

## Acceptance criteria

- [ ] A New Game on an Opening with Time "night" starts at night's start hour, and the plan holds no opening-time pass.
- [ ] An Opening with no Time uses Default Time; with neither, the opening-time pass runs as it does today.
- [ ] A page-one redraw onto an Opening with another Time changes the start hour.
- [ ] An Opening Action with an authored Time sends page one a clock line at that daypart.
- [ ] Tests at the New Game opening and plan seams cover each step of the order, and each guard bites when its bug returns.
- [ ] Frames `.scratch/frames/opening-time-light.png` and `.scratch/frames/opening-time-dark.png` show the Opening row and the Default Time picker at a desktop width.
- [ ] Changelog fragment written.

For you: start a world from an Opening Action with Time set to night and read page one in the game view.

⚠️ Export shape: Openings gain Time; the world gains Default Time.
