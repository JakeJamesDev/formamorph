# 04: Currency Deletes

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Follows the existing Slot and Body delete pattern closely.

## What to build

Deleting anything a Currency uses follows the Slot and Body pattern: never blocked, a confirm names what is affected, and the references clear in one step.

- Deleting a backing stat leaves a name-only Currency.
- Deleting a coin item removes its row. The last coin leaves a name-only Currency.
- Deleting a Currency clears `currencyId` from its items, and the confirm gives the item count.

Item prices stay in the first two cases.

Rulings: Q22.

## Acceptance criteria

- [ ] Each delete shows its confirm only when something references the target, and names the Currency or the item count.
- [ ] Each delete's cleanup runs in one undo step. A test fails when the cleanup is removed.
- [ ] Deleting the base coin leaves the Currency valid under ticket 02's rules. The ticket records the rule it chose in its landing.
- [ ] A Blueprint stat's delete covers Currencies that back onto it.
- [ ] Frames of the confirm for a stat and for a Currency, in both themes at 1366: `.scratch/frames/currency-delete-stat-light.png`, `currency-delete-stat-dark.png`, `currency-delete-light.png`, `currency-delete-dark.png`.
- [ ] Docs name the delete behavior where they describe Currencies, and a changelog fragment exists.
