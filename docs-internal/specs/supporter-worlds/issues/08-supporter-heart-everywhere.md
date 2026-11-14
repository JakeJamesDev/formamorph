# 08: Client: Supporter heart on the Mascot tab and Formamorph AI

Status: ready-for-human
Blocked by: 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: applies ticket 04's shared mark to a known set of surfaces.

## Parent

[spec.md](../spec.md) — Timed Supporter Content and Supporter Worlds.

## What to build

The Patreon Mark from ticket 04 (the shared Design System pattern) becomes the standard mark for a Patreon item (R22). In the Mascot tab, a Supporter-only Mascot shows the heart in place of the lock icon, both before and after it is installed. The Formamorph AI preset shows the heart wherever its name appears in a list or picker, for every account state. Other lock icons in the app (traits, routines, read-only values, feedback threads) are not Patreon items and stay as they are.

## Acceptance criteria

- [x] The Mascot tab's Supporter-only entries show the heart, and no lock icon, both before and after the install; the screen-reader label is kept. DOM read on the dev router with a stubbed catalog: locked row has 1 mark, no `.lucide-lock`, text "(Locked)" kept; installed rows render the mark when `mascot.supporter` is set (code path, no installed fixture).
- [x] Every list or picker that names the Formamorph AI preset shows the heart; the landing names each surface. `EndpointRouteField.test.tsx` "Patreon Mark" cases; DOM read of the Text preset select.
- [x] No non-Patreon lock icon changes. Diff touches only the Mascot tab's one `Lock`.
- [ ] Frames `.scratch/frames/mascot-tab-heart.png` and `.scratch/frames/formamorph-ai-heart.png`, light and dark, at a desktop width.

For you: check that the heart reads well next to the Formamorph AI preset name.

## Landed

Surfaces with the heart (R22, R31): the Mascot tab's Preset select (uninstalled and installed Supporter Mascots); the Text preset select in Settings and in Formaquestion Settings' Endpoint tab; the preset rows, the Use Active Endpoint row (while Formamorph AI is active) and the Same-as rows of every route picker, in Settings (per-prompt) and in the Endpoint tab. The "Edit Formamorph AI (Active Endpoint)" heading stays plain. Select rows carry no tooltip, only the label.

**Not verified**
- Frames in the light theme: the browser pane cannot switch the app theme. Only `.scratch/supporter-worlds-08/frames/mascot-tab-heart-dark.png` and `.scratch/supporter-worlds-08/frames/formamorph-ai-heart-dark.png` exist (file names carry `-dark`).
- An installed Supporter Mascot row in the live app: no fixture installs one; covered by the same markup as the locked row.

**For you**
- Check that the heart reads well next to the Formamorph AI preset name: `.scratch/supporter-worlds-08/frames/formamorph-ai-heart-dark.png`.
- Check the light theme on the Mascot tab and the Text preset select.
