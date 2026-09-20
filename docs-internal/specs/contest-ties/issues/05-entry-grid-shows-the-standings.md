# 05: Entry Grid Shows the Standings

Status: ready-for-human
Status note: Built in commits `c614abcf` and `c13513dc` (unpushed). The standings sort is `standingsOrder` / `tiedLikeCounts` in `src/lib/contests.ts`; the shared-place run order is `orderTiedRows` in `src/lib/podiumRanking.ts`. Three rulings came from the spec session: the run-order line is in scope with mechanism (a), a click steps a world to the next place down because a trade inside a run would be sorted straight back, and the `clearRow` promotion defect belongs to this unit. Eleven guards were each proved to fail when its rule is removed. Four gates green: typecheck 0, lint 0 errors, build 25.4 s, 11,918 tests pass in 125.6 s. Three suite failures are foreign and reproduce without this unit: two in `src/services/WorldStorageService.test.ts` from the anonymous-likes session's uncommitted service work, and one load-timeout in `src/components/modals/SettingsModal.promptOptions.test.tsx` that passes in isolation. Not deployed — a live save still needs ticket 01 on the server.
Base: 43b0faaf
Blocked by: 04
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

**Parent:** [Contest Ties](../spec.md)

**What to build:** The Podium dialog's entry grid shows the standings. Entries sort by likes, highest first, with listing publish time as the tiebreaker. An entry whose like count equals another entry's count shows a tie marker next to its count, so staff see every tie before they announce. Blocked entries keep their place in the sort and stay disabled with their reason. The podium list shows tied rows in publish-time order when that data is on the entry record, so the dialog matches what the server stores.

This ticket waits for 04 only because both edit the dialog.

- [x] The grid sorts by likes descending, then publish time
- [x] Rows that share a place show in publish-time order, earliest first, matching what the server stores
- [x] Every entry that shares its like count with another entry shows the tie marker; an entry with a unique count shows none
- [x] The marker has an accessible name and does not rely on color alone
- [x] Blocked entries sort with the rest and stay disabled
- [x] The sort is a pure function with its own unit test
- [x] UI verified through the dev router with static evidence, in both themes
- [x] Changelog In-Progress entry added; four gates green, test run time stated
