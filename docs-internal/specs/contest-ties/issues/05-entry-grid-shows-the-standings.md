# 05: Entry Grid Shows the Standings

Status: ready-for-agent
Blocked by: 04
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

**Parent:** [Contest Ties](../spec.md)

**What to build:** The Podium dialog's entry grid shows the standings. Entries sort by likes, highest first, with listing publish time as the tiebreaker. An entry whose like count equals another entry's count shows a tie marker next to its count, so staff see every tie before they announce. Blocked entries keep their place in the sort and stay disabled with their reason. The podium list shows tied rows in publish-time order when that data is on the entry record, so the dialog matches what the server stores.

This ticket waits for 04 only because both edit the dialog.

- [ ] The grid sorts by likes descending, then publish time
- [ ] Every entry that shares its like count with another entry shows the tie marker; an entry with a unique count shows none
- [ ] The marker has an accessible name and does not rely on color alone
- [ ] Blocked entries sort with the rest and stay disabled
- [ ] The sort is a pure function with its own unit test
- [ ] UI verified through the dev router with static evidence, in both themes
- [ ] Changelog In-Progress entry added; four gates green, test run time stated
