# 02: Weather State and Authoring

Status: done
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

## What to build

A world can turn Weather on, and a game holds one World Weather from its start. The spec covers this in Q2, Q3, Q5, Q6, Q13, Q14, Q24 and Q25. Changes during play come in ticket 03.

- **Shape.** The world gains a Weather block: on switch, allowed kinds (subset of Rain, Snow, Storm, Bright Sun) and optional Default Weather. An Opening gains an optional Weather. A location gains an optional Sheltered flag. The save gains the current World Weather; absent reads as Clear.
- **Start resolution.** Opening Weather → Default Weather → Clear. It reuses ticket 01's start resolution path: the authored start-hour resolver in the Openings module and its New Game and redraw wiring in the game view. The page-one read is ticket 03's. A redraw resolves again. Ticket 01 left the view wiring untested because the view is too large to mount, so a redraw that resets the weather needs a seam a test can reach.
- **Experienced weather.** One shared helper returns the weather the player experiences: the World Weather, or none in a Sheltered location. Tickets 03, 04 and 05 use it; this ticket owns it.
- **Editor.** A Weather section in the World Editor (switch, allowed kinds, Default Weather). Sheltered in the location editor while Weather is on. A Weather picker per Opening row, listing only allowed kinds, hidden while Weather is off.
- **Test Bench.** Findings for an Opening Weather or Default Weather outside the allowed list.
- **Dev hook.** A dev-only hook reads and sets the World Weather, behind `import.meta.env.DEV`.
- **Docs.** The world settings, location and Openings wiki pages describe the new fields.

## Acceptance criteria

- [x] A New Game on an Opening with Weather Storm saves Storm; with no Opening Weather it saves Default Weather; with neither it saves Clear. (`openings.test.ts` "saves the Opening Weather, then Default Weather, then Clear", through `applyResolvedStart`)
- [x] Saving and loading keeps the World Weather. (`GameplayContext.weather.test.tsx`)
- [x] The experienced weather helper returns none in a Sheltered location and the World Weather elsewhere. (`weather.test.ts`)
- [x] The Opening Weather picker never offers a kind outside the allowed list, and the Test Bench flags one left behind after the list changes. Each finding bites when its trap returns. (`OpeningsPanel.weather.test.tsx`, `rules.weather.test.ts`; picker filter, redraw reset and Default Weather finding each went red when reinstated)
- [x] Frames `.scratch/frames/weather-authoring-light.png` and `.scratch/frames/weather-authoring-dark.png` show the World Editor Weather section at a desktop width. (Dev-router frames, Weather on, Rain allowed)
- [x] Changelog fragment written.

## Landed

**Not verified**
- The two `GameViewer.tsx` call sites of `applyResolvedStart` (New Game, redraw) have no test, because the view is too large to mount. The seam itself is tested.
- The Weather picker on an Opening row, the Sheltered checkbox and the Test Bench row were not looked at in the browser. The picker and rule are covered by tests only.
- The frame files hold JPEG bytes under a `.png` name (the Browser pane saves JPEG).

**For you**
- Overview tab: check the Weather block reads right in both themes (`.scratch/weather-02/frames/weather-authoring-light.png`, `.scratch/weather-02/frames/weather-authoring-dark.png`).
- Location editor, Details tab: **Sheltered** shows only while Weather is on.
- Openings tab: an expanded card shows **Weather** beside **Time**, listing only allowed kinds.
- Export shape changed: world `weather`, location `sheltered`, Opening `weather`, and the save's `weather`.
- Default Weather hint says nothing about the unset case yet; ticket 03 adds the page-one read.

⚠️ Export shape: the world gains the Weather block, Sheltered on locations and Weather on Openings; the save gains the World Weather.
