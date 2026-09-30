# 10: Open a community card from the keyboard

Status: ready-for-human
Status note: Hit area is the frame click, not a ::after; the frame already covers the card.
Base: 352cc927
Blocked by: 09
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Contained accessibility change to one card; the stretched-button pattern is standard, but the inner controls must keep working.

## What to build

Spec Q12. A keyboard user can reach and open every community card. Today the card frame is a plain element with a click handler, and only the controls inside it take focus, so a card can't be opened without a pointer. The card's title becomes a real button that opens the details window, and its hit area covers the card (the stretched-button pattern). The inner controls (like, download, hide, and the rest) stay separate buttons above it, so no control is nested inside another.

Blocked by 09 because both change how focus enters a card, and 09's keyboard dwell prefetch must start from this button too.

## Acceptance criteria

- [ ] Tab reaches each card's open button; Enter and Space open the details window.
- [ ] A click anywhere on the card that is not an inner control still opens it, as today.
- [ ] Inner controls keep their own action and never open the card.
- [ ] The open button's accessible name is the listing's name.
- [ ] No interactive element is nested inside another.
- [ ] Keyboard focus on the open button starts ticket 09's dwell prefetch.
- [ ] Tests at the card seam cover each rule and fail when it is removed.
