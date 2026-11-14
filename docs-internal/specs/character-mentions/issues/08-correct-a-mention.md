# 08: Correct a Mention

Status: ready-for-agent
Blocked by: 04, 07
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

The player fixes a wrong link at the place where it shows.

- **Entry points:** "Wrong character?" on a colored quote or a mention hover card. It opens a pick list of the cast (Player View names) plus "Nobody in the cast".
- **Correction:** a correction is (turn id, mention span, entity id or none).
  - The correction is saved with the turn and overlays that turn's reading.
  - Colors, links and In Scene update at once.
- **Prototype:** follow variant A on `prototype/character-mentions` (spec, Further Notes). "Wrong character?" swaps the card's content for the pick list, titled "Who said this?" for a quote and "Who is this?" for a mention, with a back button. Picking closes the card.
- **Local only:** corrections work without an account and stay on the device in this ticket. Ticket 10 adds contributing.
- **Export shape:** save turns gain corrections. The change is additive and the shape has not shipped, so no compatibility code is needed.
- **Changelog:** a fragment for the feature.

## Acceptance criteria

- [ ] Correcting a quote's speaker changes its color at once. Correcting a mention changes its link and card.
- [ ] "Nobody in the cast" unlinks the mention.
- [ ] Corrections survive save, reload, and undo/redo of other turns.
- [ ] Frames: `.scratch/frames/correct-pick.png`, light and dark.
