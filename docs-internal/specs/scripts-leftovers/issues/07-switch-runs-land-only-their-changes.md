# 07: Switch Runs Land Only Their Changes

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: async race logic in play, nested runs, and a real-prompt test.

## What to build

A trait-switch run lands only the traits it changed (Q3). The run records the trait state it started from. When it lands, it applies only the traits whose state the run changed. A trait the player toggles while the run is open, for example while a `player.*` prompt is up, keeps the player's state. When the run and the player change the same trait, the player's toggle wins (Q8). A nested switch run lands the same way. Toggle runs and persona-change runs both use it.

## Acceptance criteria

- [ ] A toggle made while a switch run holds a real prompt open survives the run's landing.
- [ ] The run's own changes to other traits still land.
- [ ] When the run and the player change the same trait, the player's state stands.
- [ ] A nested switch run lands only its own changes.
- [ ] The test holds the prompt open with a real script; it does not remove the prompt to dodge the race.
- [ ] Guards fail when landing goes back to setting the whole trait state.
