# 08: Long Saves, Anchoring Fallback, Mobile, and Close-Out

Status: ready-for-agent
Blocked by: 02, 03
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

Spec: `docs-internal/specs/chat-layout/spec.md`

## What to build

Chat stays fast and steady on a save of a thousand turns, on a browser with no scroll anchoring, and on a
small screen with the on-screen keyboard open. This ticket also ships the changelog entry.

## Acceptance criteria

- [ ] Playwright: a save of 1000 turns opens at the bottom with a small mounted count, and a submit still pins.
- [ ] Playwright: no programmatic scroll writes occur during a wheel scroll through history with native anchoring on.
- [ ] Which engines have no scroll anchoring is verified from a live source, with the source named in the hand-over. On those engines the virtualizer's own scroll correction stays on. Feature detection selects the path, not a user agent string.
- [ ] With the on-screen keyboard open on a mobile viewport, the pin and the Jump button use the visual viewport, per the mobile keyboard rule.
- [ ] At a narrow width the action and choice bubbles, the icon row, and the Jump button fit with no horizontal scroll.
- [ ] Heap and mount time for the 1000-turn case are recorded in the hand-over, measured on real narration with images, not the prototype's short text.
- [ ] One In Progress changelog entry in the user-facing bucket, with a bold lead that stands alone.
- [ ] Four gates green, and the e2e run time is stated.
