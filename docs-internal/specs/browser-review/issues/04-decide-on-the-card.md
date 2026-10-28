# 04: Decide On The Card

Status: ready-for-agent
Blocked by: 02, 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Model note: wires the hook into the browser with row patching and re-sync
Reasoning effort: high

## What to build

A pinned card has a check that approves in one click and an X that rejects through the same flow as the Review tab. The card then moves where the spec's user stories 11–13 say. See the spec's **Card** and **After a decision** modules.

## Acceptance criteria

- [ ] The check and X show only on pinned cards the viewer may decide; not on the viewer's own listing or on an author the viewer can't moderate.
- [ ] The check approves at once; the card leaves the pinned group and joins the normal list.
- [ ] The X on a new listing opens the quarantine-days dialog, then the composer; the card leaves the pinned group and shows under Quarantined.
- [ ] The X on an update opens the confirm, then the update-rejection composer; the card returns to its live face in its normal slot.
- [ ] The check and X are disabled while a decision is in flight.
- [ ] A conflict drops the card with the toast; a contest lock keeps it pinned with the toast.
- [ ] The catalog re-syncs after each decision.
- [ ] The changelog fragment from 03 covers approve and reject on the card.
- [ ] Frames: `.scratch/frames/card-decide-light.png` and `.scratch/frames/card-decide-dark.png` at 1280px wide.

For you: approve and reject one listing each from the browser against a live server.
