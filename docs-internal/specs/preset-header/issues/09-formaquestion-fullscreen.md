# 09: Formaquestion full screen

Status: done
Blocked by: 08
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

Full screen on a Formaquestion prompt lifts the whole Prompts tab.

- The prompts shell leaves the Settings modal for a shared component.
- The Formaquestion Prompts tab hosts a morph and hands it to each field. The header, the rail, the editor and the footer ride into the overlay. Focus returns to the button that opened it.
- The field's own overlay stays as the fallback for a caller that passes no host.

Spec: Q16; Implementation → Full screen.

Recommended model rationale: a shell extraction across two modals plus per-frame Playwright sampling for the motion claim.

## Acceptance criteria

- [ ] Full screen on a Formaquestion prompt shows the header, rail, editor and footer in the overlay.
- [ ] Settings full screen behaves as before.
- [ ] The fullscreen morph e2e spec samples the Formaquestion trip per frame.
- [ ] Changelog line under In Progress.
