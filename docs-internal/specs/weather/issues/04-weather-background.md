# 04: Weather Background

Status: ready-for-agent
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

- [ ] Weather view tests cover Sheltered, the switch off, reduced motion and each kind.
- [ ] With the dev hook set to each kind, frames `.scratch/frames/weather-bg-<kind>-light.png` and `.scratch/frames/weather-bg-<kind>-dark.png` show it at desktop and mobile widths.
- [ ] Playwright per-frame sampling shows Storm flashes stay under three per second, and the canvas stops drawing on Clear, in Shelter and when the page is hidden.
- [ ] Frame-time numbers on the mobile profile are recorded in the ticket's Landed section.
- [ ] Changelog fragment written.

For you: watch each kind in play on desktop and on the Android build, and judge whether it reads well behind the panels.
