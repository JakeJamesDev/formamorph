# 05: Weather Foreground

Status: done
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

- [x] Weather view tests cover load versus change, Clear, Shelter, the switch off and reduced motion. `weatherView.test.ts`, "the weather view foreground" (12 cases); the reduced-motion, switch, no-foreground-change and moved-on guards each went red when removed. `WeatherForeground.test.tsx` covers replace, end, and a change that arrived with nothing to play.
- [x] Playwright per-frame sampling shows each effect starts, ends within its length, a second change replaces the first, and Storm stays under three flashes per second. `e2e/weather-foreground.spec.ts`, desktop and mobile, 16 passed.
- [x] Clicks and typing reach the game while an effect plays. Same spec: a real click on the action box and typing, with the effect showing.
- [x] Frames `.scratch/frames/weather-fg-<kind>-light.png` and `.scratch/frames/weather-fg-<kind>-dark.png` show each effect mid-play at desktop and mobile widths. `WEATHER_FRAMES=1` run of the spec, on a held clock; mobile frames end in `-mobile`.
- [x] Changelog fragment written: `docs-internal/changelog.d/weather-05.md`.

## Landed

The weather view's input `previous` became `change` (the landed Weather Change, or null on load, New Game, a redraw and paging). The change helper already decides opening turn and nightfall, so the view only adds the switch, reduced motion and what shows now. The spec's Rendering section still says "the previous experienced weather".

The effect canvas sits inside the game view at `z-40` with no pointer input; dialogs portal above it. Lengths: Rain 3.5 s, Snow 4 s, Storm 1.6 s (one flash, over by 0.6 s), Bright Sun 3 s.

Dev hook: `__fmDev.fireWeather('storm')` sets the World Weather the way a script set does and fires the foreground. Ticket 02's `__fmDev.weather()` still sets it with no change, as before.

Playwright measures the canvas element, which mounts one frame before the effect clock and leaves up to three frames after its last clear. The length check allows four frames for that.

**Not verified**

- Every criterion is ticked. The Bright Sun case runs at noon: the White Room fixture's clock reads midnight, where Bright Sun correctly plays nothing.

**For you**

- Trigger each change in play, step out of a Sheltered location into rain, and judge the feel and length of each effect.
- Storm is the shortest at 1.6 s. Say if it should linger.
- Bright Sun is faint over the light theme: `.scratch/weather-05/frames/weather-fg-brightSun-light.png`. The others: `.scratch/weather-05/frames/weather-fg-rain-dark.png`, `.scratch/weather-05/frames/weather-fg-storm-dark.png`, `.scratch/weather-05/frames/weather-fg-snow-light-mobile.png`.
- Settings → Display → Weather has the new **Weather Foreground** switch.
