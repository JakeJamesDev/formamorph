# 02: Frame Capture Pipeline

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rationale: follows the existing title-card capture script and the e2e dev-router path; the work is a deterministic script plus a diff check.

Parent: [Trailer spec](../spec.md)

## What to build

A capture script in the trailer package poses app screens through the dev-router and writes PNGs the scenes import.

- Runs against a dev server the way the e2e runner does: its own port, file watching off, so a peer edit never reloads a capture mid-run.
- A capture list names each shot: view, modal or tab, viewport, theme, device scale 2, and the fixed demo world and seed it poses. The same list yields the same PNGs on every run.
- Captured PNGs are committed as source assets beside the scenes. Check their size before committing.
- A diff mode compares a fresh capture against the committed PNG and reports which shots changed. That is the guard against UI drift between renders.
- The proof's two frame scenes switch from store shots to captured frames.

Rulings: Q5.

## Acceptance criteria

- [ ] One command captures every shot in the list into the package; a second run produces identical files.
- [ ] The diff mode names every shot whose fresh capture differs from the committed one.
- [ ] The proof renders from captured frames instead of store shots.
- [ ] The capture run never reloads on a peer edit (watching off) and never touches the user's own dev server.
