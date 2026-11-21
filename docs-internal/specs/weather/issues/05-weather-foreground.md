# 05: Weather Foreground

Status: ready-for-agent
Blocked by: 03, 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A short full-screen effect plays when the weather the player experiences changes. The spec covers this in Q4, Q6, Q8, Q15 and Q16 and the Rendering section.

- **Trigger.** Ticket 03's Weather Change, when it may fire foreground. The weather view's foreground half (ticket 04's function) decides the effect.
- **Effects.** One per kind, a few seconds each: Rain (droplets on the glass), Snow (flakes settling), Storm (one lightning flash, under three flashes per second), Bright Sun (a sunbeam sweep). Clear has none.
- **Layer.** One full-screen layer above the game view, ignoring pointer input, never over open dialogs. A new effect replaces a playing one.
- **Rules.** Never on load, New Game or a redraw. OS reduced motion turns it off.
- **Setting.** A Weather Foreground switch, default on.
- **Dev hook.** The dev hook from ticket 02 can fire a foreground effect for verification.
- **Docs.** The Settings wiki page describes the switch.

## Acceptance criteria

- [ ] Weather view tests cover load versus change, Clear, Shelter, the switch off and reduced motion.
- [ ] Playwright per-frame sampling shows each effect starts, ends within its length, a second change replaces the first, and Storm stays under three flashes per second.
- [ ] Clicks and typing reach the game while an effect plays.
- [ ] Frames `.scratch/frames/weather-fg-<kind>-light.png` and `.scratch/frames/weather-fg-<kind>-dark.png` show each effect mid-play at desktop and mobile widths.
- [ ] Changelog fragment written.

For you: trigger each change in play, step out of a Sheltered location into rain, and judge the feel and length of each effect.
