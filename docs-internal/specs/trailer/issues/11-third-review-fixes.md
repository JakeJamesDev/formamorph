# 11: Third Review Fixes

Status: ready-for-human
Blocked by: 10
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: three new captures (reveal clip, Change Location dialog, engine panel), a storyboard reorder, a new subject-region check, and a by-eye pass on every changed shot.

Parent: [Trailer spec](../spec.md)

## What to build

The user's third review, from frames of the Floating cards render. Each item is a ruling.

- **Loop (Q30).** Cut W02 and T02. The loop is "Type any action." then the wordmark for about 2.5 s, inside 360 frames. Frames 0 and 359 still match.
- **Narration reveal (Q31).** W05 and T05 play a captured clip of the real narration reveal in the card, the way the stats clip is captured: drive a turn from a canned reply, step the animation frame by frame. The typed panel sits below the card. A re-run produces the same clip.
- **No zooms (Q32, Q38).** Remove the stats and Morphie zooms; those cards open framed on their subject. Add a `subject` region per shot to the capture list and make the render check fail any frame where the region is not wholly inside the card's visible area. Apply the check to every card.
- **Map (Q33).** Recapture the canvas after Auto Arrange All with edge labels hidden. If the editor has no toggle for the labels, hide them in the capture through the page, and say so in the ticket.
- **Travel shot (Q34).** New shot after the map: the Change Location dialog in play, caption "Travel there and meet who lives there." Add it to the storyboard (§2 and §4), the capture list and both cuts. Tall cut: decide whether it stacks or stands alone, per the storyboard's rules.
- **Contest (Q35).** One placement badge per world in the capture mock. Recapture.
- **Desktop (Q36).** Recapture on the built-in engine panel with a model loaded. The capture must not download a model; use the smallest fixture or a mocked ready state, and say which.
- **End card (Q37).** The call to action becomes "Play free at formamorph.ai" with the address in the accent color, no dot. It still meets Q17 and Q25.
- Re-render both cuts, update the storyboard's durations and totals, and look at every changed shot on the contact sheets before calling it done.

## Acceptance criteria

- [ ] W02 and T02 are gone; the wordmark holds about 2.5 s; both 6 s loops pass.
- [ ] W05 and T05 play a captured narration reveal clip with the panel below the card; a second capture run gives an identical clip.
- [ ] No card changes zoom; the render check reports every shot's subject region as in frame for its whole hold and fails one that is not.
- [ ] The map shot shows boxes and arrows with no overlapping labels.
- [ ] The travel shot exists in both cuts after the map, with its caption, and the storyboard order is map, travel, profile, blueprints.
- [ ] Every world in the contest shot has one badge.
- [ ] The desktop shot shows the built-in engine panel, model ready.
- [ ] The end card reads "Play free at formamorph.ai" with the address in the accent color.
- [ ] Every line still passes hold, rate, enter and exit; the Steam checks still pass; storyboard totals match the renders.

## Notes

- **Map labels (Q33).** The editor has no switch for the travel-rule labels on the canvas. The capture hides them through the page: the `canvas` shot's `hide` list sets `.react-flow__edgelabel-renderer` to hidden.
- **Desktop (Q36).** The capture uses a mocked ready state, not a model file. The `desktopEngine` setup in `captureSetups.mjs` stands in for the desktop bridge with a model already loaded. Nothing loads or downloads.
- **Travel, tall cut (Q34).** The travel shot stacks under the map as T09, like the other adjacent pairs.
- **Visible area (Q39).** The check fails a subject outside the card's crop, or under a caption pill or the typed panel. It does not count the card's tilt, and it does not check depth cards.
