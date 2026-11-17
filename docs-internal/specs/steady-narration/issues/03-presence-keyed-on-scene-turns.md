# 03: Presence Keyed on Scene Turns

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Presence recomputes only when the recent scene turns' content changes, not on every history write (Q6).

- Presence derives the recent scene turns and memoizes them by a plain content key. It does not build a generic stable-map helper; ticket 02 owns that one.
- A history write that leaves the recent scene turns unchanged, such as a background pass result, leaves presence unchanged.

## Acceptance criteria

- [ ] A history change outside the recent scene turns keeps presence the same object.
- [ ] A change to a recent scene turn's text gives a new presence.
- [ ] Reverting to a plain history dependency makes the first test fail.
- [ ] Existing presence tests pass unchanged.
