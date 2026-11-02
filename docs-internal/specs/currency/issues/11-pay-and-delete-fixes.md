# 11: Pay and Delete Fixes

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Three small fixes from the close review, each with a clear ruling and a test seam that already exists.

## What to build

- **Delete confirm:** deleting any Persona or entity whose own stat backs a Currency shows a confirm that names the Currency. Today a plain Persona skips it, and the Currency becomes Name Only with no warning.
- **Bare price with an item:** a pay with item Silver and price 5 means 5 Silver. Today it charges 5 Copper. A money word in `currency` keeps working as it does, and a real conflict stays refused.
- **Played entities:** a played entity's name counts as the player in a pay or buy, for every played entity. Today a second played entity's name reads as blank, so its payment is income and costs it nothing.

Rulings: Q79, Q80, Q81.

## Acceptance criteria

- [x] Deleting a plain Persona or entity whose own stat backs a Currency shows a confirm naming it. A delete that affects no Currency shows no new confirm. Tests go through the UI path, not `removeEntity` alone. (`WorldEditor.currencyDeletes.test.tsx`, Q79 block, through the Entities tab Delete button)
- [x] A pay with item Silver and price 5 moves 5 Silver. A pay with item Gold and price "5 Silver" behaves as a named conflict under Q50. A test fails when each is reverted. (`pass.buy.test.ts`, Q80 block; shown with Gold and Shell, the test world's coins)
- [x] A second played entity paying is charged, and the same name as a seller or buyer works. A test fails when the name stops resolving. (`GameViewer.pay.test.tsx` Q81: the Custom Persona entity pays beside a library persona. Seller and buyer share `partyOf`, so one name path covers all three.)
- [x] Each fix's guard is proved by reinstating its bug. (All three tests failed with the fix reverted: 2 Q80, 2 Q79, 1 Q81.)
- [ ] The pay probe, cloud default, shows no case falling against its in-batch control. The numbers are in the landing.
- [x] Docs match, and a changelog fragment exists only if a released surface changed. (`docs/World-Editor-Items.md` line 234; Currency is unreleased, so no fragment)

For you: delete a Persona whose own stat backs a Currency. Does the confirm read clearly?

## Landed

**Not verified**
- The pay probe on the cloud default. No prompt text changed: the fixes sit in the parser's reading of `item` and in the player-name list. I ran no probe.

**For you**
- Delete a Persona whose own stat backs a Currency. Does the confirm read clearly? (World Editor, Entities tab)
