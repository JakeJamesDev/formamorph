# 03: Semantic Search Offer Card

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

On first open, the help window offers Semantic Search (Q3, Q5, Q11, Q12, Q14, Q17).

- Help settings gain an offer state: undecided or decided. A player who flips the Semantic Search switch is decided. Existing players who never touched the switch are undecided.
- When the offer is undecided and the switch is off, a card shows at the top of the help window in every chat style. It marks Semantic Search as recommended, says it improves help, and says it downloads a small model once.
- **Turn On** starts the existing download through the Semantic Search switch, with its progress and Retry. **No Thanks** marks the offer decided; the card never returns.
- Closing the window without a pick leaves the offer undecided; the card shows on the next open.
- On open, if the model is already on the device, the switch turns on and the offer becomes decided with no card.
- The player can ask a question while the card shows.

No world or save export shape changes: the fields live in the help settings store.

Spec: Implementation Decisions → Help settings; The offer card.

Recommended model rationale: settings fields and a card on existing switch and download plumbing.

## Acceptance criteria

- [ ] Card shows when undecided and off; hides after Turn On, No Thanks, or a manual switch flip.
- [ ] No Thanks persists across reloads; an unanswered close does not.
- [ ] A cached model turns the switch on with no card.
- [ ] Stored settings from before this ticket parse as undecided, or decided when the switch was on.
- [ ] Card verified through the dev-router in both themes and the Bubble and Minimal styles; copy-sweep pass.
- [ ] Changelog fragment written; four gates green.
