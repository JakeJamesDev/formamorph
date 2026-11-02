# 04: Currency Deletes

Status: ready-for-human
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

- [x] Each delete shows its confirm only when something references the target, and names the Currency or the item count. (`WorldEditor.currencyDeletes.test.tsx`: each delete with a confirm and without)
- [x] Each delete's cleanup runs in one undo step. A test fails when the cleanup is removed. (`GameDataContext.intent.test.tsx` "Currency deletes in the history"; removing the six cleanup calls turned 12 tests red)
- [x] Deleting the base coin leaves the Currency valid under ticket 02's rules. The ticket records the rule it chose in its landing. (Rule below)
- [x] A Blueprint stat's delete covers Currencies that back onto it. ("covers a Blueprint stat" test)
- [x] Frames of the confirm for a stat and for a Currency, in both themes at 1366: `.scratch/frames/currency-delete-stat-light.png`, `currency-delete-stat-dark.png`, `currency-delete-light.png`, `currency-delete-dark.png`. (Dev fixture `items`, 1366x768 emulation)
- [x] Docs name the delete behavior where they describe Currencies, and a changelog fragment exists. (`docs/World-Editor-Items.md` "Deleting money", `docs-internal/changelog.d/currency-04-currency-deletes.md`)

## Landed

Base coin rule (Q41): deleting the coin worth 1 drops only that row. The Currency stays coin-backed with its other rows and shows ticket 02's hint. Only deleting the last row makes it Name Only.

Cleanup runs in the delete action itself. `lostStatIds` finds the stat ids a delete removes, and `withoutBackingStats` makes their Currencies Name Only. `removeStat`, `removeStatGroup` (Blueprints), `removeEntity` and `editEntity` call it. A Blueprints removal keeps a Currency whose stat id survives on the Persona's detached copy.

**Not verified**
- A library copy's update or unlink (`useLibraryLinking.tsx`) and the raw setters in the Test Bench and `AvatarStore.tsx` replace entities or items without cleanup. An unlink is not a delete (Q40); the rest are not author deletes.
- Hosts of `EntityStatsEditor` other than the World Editor (the library editor) have no Currency, so they pass no confirm.
- The stored frames are JPEG data saved under `.png` names, from the Browser pane's screenshot.

**For you**
- Open Items, then Currencies, and delete a Currency that has items: the confirm gives the item count.
- Open Stats and delete the stat that backs a Currency, or a Persona's own stat: the confirm says it makes the Currency Name Only.
- Open Items and delete a coin: the confirm says it removes the coin row, or makes the Currency Name Only for the last coin.
- Check the wording of "makes Credits Name Only" in the confirms.
