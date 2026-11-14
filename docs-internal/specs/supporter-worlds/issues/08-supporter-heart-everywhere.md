# 08: Client: Supporter heart on the Mascot tab and Formamorph AI

Status: ready-for-agent
Blocked by: 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: applies ticket 04's shared mark to a known set of surfaces.

## Parent

[spec.md](../spec.md) — Timed Supporter Content and Supporter Worlds.

## What to build

The Patreon Mark from ticket 04 (the shared Design System pattern) becomes the standard mark for a Patreon item (R22). In the Mascot tab, a Supporter-only Mascot shows the heart in place of the lock icon, both before and after it is installed. The Formamorph AI preset shows the heart wherever its name appears in a list or picker, for every account state. Other lock icons in the app (traits, routines, read-only values, feedback threads) are not Patreon items and stay as they are.

## Acceptance criteria

- [ ] The Mascot tab's Supporter-only entries show the heart, and no lock icon, both before and after the install; the screen-reader label is kept.
- [ ] Every list or picker that names the Formamorph AI preset shows the heart; the landing names each surface.
- [ ] No non-Patreon lock icon changes.
- [ ] Frames `.scratch/frames/mascot-tab-heart.png` and `.scratch/frames/formamorph-ai-heart.png`, light and dark, at a desktop width.

For you: check that the heart reads well next to the Formamorph AI preset name.
