# 04: Focus Tiers In The Request Inspector

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: a read-only view of a record ticket 02 already stores.

## What to build

A player debugging a Focused turn opens the request inspector (AI Context view) and sees why an entity got little detail (Q19).

- The narration request's view lists each classified entity with its Focus Tier: Focus, Mentionable or Unused.
- A turn that fell back to the full roster says so, with the reason: the call failed or the reply did not parse.
- Turns in other Thinking Modes show nothing new.
- No game UI outside the inspector changes. Copy follows the Writing Guide; the view follows the Design System.

## Acceptance criteria

- [ ] A Focused turn's inspector lists every classified entity with its tier.
- [ ] A fallback turn shows that it fell back and why.
- [ ] A turn in another mode shows no tier section.
- [ ] Frames of the inspector at a desktop width in both themes: `.scratch/frames/focus-tiers-light.png`, `.scratch/frames/focus-tiers-dark.png`, plus `.scratch/frames/focus-fallback-light.png`.
