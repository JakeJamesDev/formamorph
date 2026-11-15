# 07: Client: Supporter Copy sync

Status: done
Blocked by: 01, 05, 06
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Model rationale: a new step in the existing check, with injected fetch and clock and well-defined rules.

## Parent

[spec.md](../spec.md) — Timed Supporter Content and Supporter Worlds.

## What to build

The Supporter content module's check gains a world step beside the Mascot sync. On a good check that says the account doesn't qualify, it removes every Supporter Copy of that account, worlds and library entries, and keeps saves (R6, R12). On a good check that qualifies, it keeps copies whose listing is current or expired (ticket 01's list) and removes the rest (R4). Base Q39's account rules apply: another account's Supporter Copies are not shown while it is signed in, and that account's first good check removes them. Base Q6's 7-day offline window applies.

## Acceptance criteria

- [x] A check that says the account doesn't qualify removes every Supporter Copy world and library entry of that account; its saves remain. `supporterCopySync.test.ts`: "removes every copy of an account that no longer qualifies"; the sync only calls the delete methods of the world and library stores, and a world delete drops the world and metadata records only.
- [x] A qualifying check keeps copies of current and expired listings and removes a copy whose listing is in neither list. "keeps copies of current and expired listings and removes one in neither list".
- [x] Another account's copies are hidden while it is signed in and removed on that account's first good check. "removes another account's copies on the signed-in account's first good check"; the `LibraryStore` and `WorldStorageService` tests cover the hiding.
- [x] Copies stay through failed checks inside 7 days and are removed after. "keeps copies through failed checks inside 7 days and removes them after".
- [x] Each guard is shown to bite by reinstating the bug. Account match, expired list, window removal, entitlement parse guard, stored-read guard, per-record catch and both listing filters each failed their test when reinstated.

## Landed

**Not verified**
- A Supporter Copy that is open in play when the sync deletes it: no test. `deleteWorld` announces the delete, as for any delete.
- The listings refresh after an account switch: hidden copies leave a list on the next load, not at the switch.
- The server must deploy ticket 01 first: a check now fails when the answer lacks the `expired` list.
- Expired Mascot items still drop at a good check, as before; this ticket covers worlds and library entries.

**For you**
- Sign in as a Supporter, download a Supporter world, then sign in as another account: the world is absent from Worlds. Check its first good check removes it.
