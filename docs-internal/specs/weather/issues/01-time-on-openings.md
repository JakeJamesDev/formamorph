# 01: Time on Openings

Status: ready-for-human
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

- [x] A New Game on an Opening with Time "night" starts at night's start hour, and the plan holds no opening-time pass. (`openings.test.ts` "takes the drawn opening first"; `planTurn.test.ts` "leaves the opening-time pass out"; `computeTurnCommit.test.ts` "keeps an authored start hour")
- [x] An Opening with no Time uses Default Time; with neither, the opening-time pass runs as it does today. (`openings.test.ts` fallback and null cases; `planTurn.test.ts` pass present when `startHourSet` is false)
- [ ] A page-one redraw onto an Opening with another Time changes the start hour.
- [x] An Opening Action with an authored Time sends page one a clock line at that daypart. (`liveScene.test.ts` "reads the Opening Time on the first Time chip")
- [x] Tests at the New Game opening and plan seams cover each step of the order, and each guard bites when its bug returns. (Mutated: dropped the pass skip and swapped the Time/Default Time order; each went red.)
- [x] Frames `.scratch/frames/opening-time-light.png` and `.scratch/frames/opening-time-dark.png` show the Opening row and the Default Time picker at a desktop width. (Pane width 800.)
- [x] Changelog fragment written.

For you: start a world from an Opening Action with Time set to night and read page one in the game view.

⚠️ Export shape: Openings gain Time; the world gains Default Time.

## Landed

**Not verified**
- A page-one redraw onto an Opening with another Time changes the start hour. The redraw and New Game wiring in `GameViewer.tsx` (`setStartHour(authoredStartHour(...))`) has no test: the view is too large to mount. The resolver, the plan skip and the commit are tested; the wiring is read, not run.
- The Default Time picker was framed at the pane's 800 px width. A wider window was not framed.

**For you**
- Start a world from an Opening Action with Time set to night and read page one in the game view.
- Regenerate page one onto an Opening with a different Time (or none) and check the clock line follows.
