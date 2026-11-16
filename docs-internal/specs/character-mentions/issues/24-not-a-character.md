# 24: Not a Character

Status: ready-for-human
Blocked by: 23
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Spec Q75 (2, 3): a player can mark a mention link as not a person.

- **Pick list:** for a mention, "Wrong character?" shows a "Not a Character" row below "Not Listed". The row is mentions only; "Who said this?" for a quote is unchanged.
- **Effect:** the pick removes the link and the card from that span, and In Scene and memory read the corrected reading as they do for other corrections.
- **Storage:** a correction of kind `nonMention`, with no entity, in the turn's corrections. A contribution sends it as is. The staff Mentions tab shows it as "Not a Character".
- **Writing Guide:** add "Not a Character" to the entity row's exceptions in `docs/Writing-Guide.md`, beside the Character Mentions setting and the "Wrong character?" action (the user's pick).
- **Changelog:** fold into the unreleased Character Mentions entries.

## Acceptance criteria

- [x] Picking "Not a Character" on a linked mention removes its link and card, and the choice survives a reload. The test is proved by reinstating the missing row. (`MentionCards.test.tsx` "removes a mention link and its card…"; hiding the row and the `nonMention` branch each turned it red, then restored.)
- [x] The correction is stored and sent with kind `nonMention` and a null entity. "Not Listed" still stores a null `mention`. (`correctionContribution.test.tsx` "sends a non-mention with its kind…")
- [x] Quotes show no "Not a Character" row. (`MentionCards.test.tsx` "marks a mention as no person…")
- [x] The staff tab shows "Not a Character" for the new kind. (`MentionsTab.test.tsx`)
- [x] Frames of the pick list with the new row, in light and dark, for the user. (one frame, both themes side by side)

## Landed

**Not verified:** none beyond the For-you list. The jsdom tests ran green on the touched files; prepare runs the full gates.

**For you:**
- Look at the pick list frame: `.scratch/character-mentions-24/frames/pick-list-not-a-character-light-dark.jpg`.
- Export-shape: saves and contributions gain correction kind `nonMention` (additive). Server ticket 23 must be deployed first.
