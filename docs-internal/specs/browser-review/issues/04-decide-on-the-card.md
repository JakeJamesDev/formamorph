# 04: Decide On The Card

Status: done
Blocked by: 02, 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Model note: wires the hook into the browser with row patching and re-sync
Reasoning effort: high

## What to build

A pinned card has a check that approves in one click and an X that rejects through the same flow as the Review tab. The card then moves where the spec's user stories 11–13 say. See the spec's **Card** and **After a decision** modules.

## Acceptance criteria

- [x] The check and X show only on pinned cards the viewer may decide; not on the viewer's own listing or on an author the viewer can't moderate. (`decideOnCard` test "offers the check and X only…"; mutation bit)
- [x] The check approves at once; the card leaves the pinned group and joins the normal list. ("approves at once…", "approves an update under its pending name…")
- [x] The X on a new listing opens the quarantine-days dialog, then the composer; the card leaves the pinned group and shows under Quarantined. ("rejects a new listing…"; dialog seen in the dev route)
- [x] The X on an update opens the confirm, then the update-rejection composer; the card returns to its live face in its normal slot. ("rejects an update…")
- [x] The check and X are disabled while a decision is in flight. ("disables the check and X…", `RemoteWorldCard.review` test)
- [x] A conflict drops the card with the toast; a contest lock keeps it pinned with the toast. ("drops the card…", "keeps a contest-locked update…")
- [x] The catalog re-syncs after each decision. (re-sync count in each `decideOnCard` case; `useCatalogSync` "a re-sync after a change made here")
- [x] The changelog fragment from 03 covers approve and reject on the card. Its own entry in the Browser Review group, 51bbeccae.
- [x] Frames: `.scratch/frames/card-decide-light.png` and `.scratch/frames/card-decide-dark.png` at 1280px wide. (1280px viewport; the pane saves them scaled to 800px)

For you: approve and reject one listing each from the browser against a live server.

## Landed

**Not verified**
- Changelog: the spec session folds approve and reject on the card into the 03 entry after landing (ruling 1).

**For you**
- For you: approve and reject one listing each from the browser against a live server.
- Check the colors of the check and X on a pinned card: `.scratch/browser-review-04/frames/card-decide-light.png` and `.scratch/browser-review-04/frames/card-decide-dark.png`.

Notes: a conflict drops the row but leaves an open details view as it was. A decision that lands after the browser closes skips the re-sync; the next open loads the catalog.
