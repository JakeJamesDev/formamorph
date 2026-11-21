# 04: Weather Background

Status: done
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The current weather draws all the time behind the panels. The spec covers this in Q6, Q8, Q9, Q18 and Q20 and the Rendering and Settings sections.

- **Weather view.** One pure function: World Weather, Sheltered, daylight, both switches, OS reduced motion and the previous experienced weather → background kind and mode (full, calm or none) and an optional foreground effect. This ticket builds the background half and the function's shape; ticket 05 fills the foreground half.
- **Overlay.** One 2D canvas element between the location backdrop and the panels, on its own compositor layer, ignoring pointer input. One effect per kind: Rain, Snow, Storm (rain plus distant flashes under three per second), Bright Sun (light shafts). Clear draws nothing. It stops drawing when it shows nothing or the page is hidden.
- **Rules.** Hidden in a Sheltered location. Shows with Location Background off and under desktop Hide UI. OS reduced motion gives the calm mode.
- **Setting.** A Weather Background switch, default on, with its default in the settings defaults.
- **Performance.** Measured on a mobile-width realistic device profile; the particle count scales down on small screens.
- **Docs.** The Settings wiki page describes the switch.

## Acceptance criteria

- [x] Weather view tests cover Sheltered, the switch off, reduced motion and each kind. `weatherView.test.ts`, plus Weather off, Bright Sun at night and `isDaylight`; each guard reinstated red.
- [x] With the dev hook set to each kind, frames `.scratch/frames/weather-bg-<kind>-light.png` and `.scratch/frames/weather-bg-<kind>-dark.png` show it at desktop and mobile widths. Headless Chromium on the White Room fixture: 1440×900 plain, `-mobile` (Pixel 7) and `-art` (location art) variants of each.
- [x] Playwright per-frame sampling shows Storm flashes stay under three per second, and the canvas stops drawing on Clear, in Shelter and when the page is hidden. 60 s of Storm, 3601 frames: 15 flashes, at most 2 in any second, by the DEV counter and by top-row canvas alpha alike. 0 frames in 2 s on Clear, in a Sheltered start location and with `document.hidden` set; 120 again once shown.
- [x] Frame-time numbers on the mobile profile are recorded in the ticket's Landed section.
- [x] Changelog fragment written. `docs-internal/changelog.d/weather-04.md`.

## Landed

The setting sits in a Weather group in Display settings. The weather view is `src/lib/weatherView.ts`; ticket 05 fills its `foreground`. `isDaylight` in `src/lib/weather.ts` is the one daylight test, for ticket 03 to import. The White Room dev fixture now has Weather on and a Sheltered Observation Alcove.

On a past page the background reads that turn (Q28): its snapshot's `weather`, its location's Sheltered flag and its game time for daylight. The snapshot already stored `weather` (ticket 02 writes it, omitting Clear), so no new field and no save-shape change; a snapshot with none reads Clear. `viewWeather` in GameplayContext serves it. The canvas draws under the Background Fade (Q29): image `-z-10`, weather `-z-[9]`, fade `-z-[8]`.

Also fixed: `loadWorldData` dropped the world's `weather` block and `defaultTime` on every load (a defect in landed tickets 01 and 02), so Weather always read as off in play and the next save wrote the loss to disk. A load round-trip test covers both fields.

**Mobile frame times.** Headless Chromium, Pixel 7 profile (412×915 at DPR 2.625; the canvas caps at 1.5), CPU slowed 4×, location art on, 8 s of rAF deltas per kind at noon:

| Weather | Frames | Median | p95 | Frames over 20 ms |
|---|---|---|---|---|
| None (Clear) | 438 | 16.7 ms | 16.8 ms | 2 |
| Rain | 439 | 16.7 ms | 16.8 ms | 2 |
| Snow | 476 | 16.7 ms | 16.7 ms | 1 |
| Storm | 474 | 16.7 ms | 16.7 ms | 6 |
| Bright Sun | 474 | 16.7 ms | 16.8 ms | 7 |

Particle counts scale with screen area: rain draws 108 drops on that phone and caps at 320 on a desktop. Headless Chromium rasterizes in software, so a real phone GPU may differ.

**Not verified**

- The calm mode in a real browser with OS reduced motion on. The view test and the effect test cover it (calm Storm runs no flashes).
- Paging and the fade in the browser. The frames predate both; `GameplayContext.weather.test.tsx` and `LocationBackdrop.test.tsx` cover them.
- The canvas with **Location Background** off in the browser. It mounts outside that switch's branch in GameViewer, and the plain frames show the same color path.

**For you**

- Watch each kind in play on desktop and on the Android build, and judge whether it reads well behind the panels.
- Judge both themes, with and without location art: `.scratch/weather-04/frames/weather-bg-rain-light.png`, `-dark`, `-art` and `-mobile` variants for each kind.
- Bright Sun is subtle over bright art: `.scratch/weather-04/frames/weather-bg-brightSun-light-art.png`. Say if the shafts should be stronger.
- Hide UI with snow: `.scratch/weather-04/frames/weather-bg-snow-dark-hide-ui.png`.
