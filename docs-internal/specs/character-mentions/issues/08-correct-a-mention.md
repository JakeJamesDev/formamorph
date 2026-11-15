# 08: Correct a Mention

Status: ready-for-human
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

- [x] Correcting a quote's speaker changes its color at once. Correcting a mention changes its link and card. (`MentionCards.test.tsx` "a correction on a played turn"; live preview DOM read: Kessa's quote went from `--speaker-2` to `--speaker-1` on picking Mira.)
- [x] "Nobody in the cast" unlinks the mention. The label is "Someone Else" per Q58. ("unlinks a mention with "Someone Else"", in the card tests and in `mentionCorrections.test.ts`.)
- [ ] Corrections survive save, reload, and undo/redo of other turns. Save and reload: `GameplayContext.mentionCorrections.test.tsx`. Undo/redo: unit-level only (see Not verified).
- [x] Frames: `.scratch/frames/correct-pick.png`, light and dark. (`correct-pick.png` holds light and dark side by side; `correct-pick-light.png` and `correct-pick-dark.png` hold each one.)

## Landed

**Not verified**
- Undo/redo of other turns: `pruneByNarration` keeps a turn's corrections while its narration stays in the history (`mentionCorrections.test.ts`). No test drives a real rollback or redo through GameViewer.

**For you**
- The pick list in a real turn: open a colored quote or a name's card, click "Wrong character?", and pick someone. Use `#dev?view=gameViewer&fixture=speakerQuotes` with Character Mentions on.
- Keyboard: Tab to a name, press Enter, and pick. Focus returns to the name.
- Narration now remounts when its reading changes, so colors also show when a reading lands after its turn is on screen. Watch for any flicker on the newest turn when its reading arrives.
