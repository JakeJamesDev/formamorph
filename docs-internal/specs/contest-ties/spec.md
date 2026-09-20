# Spec: Contest Ties — Shared Places on the Podium

Status: ready-for-agent
Spec session: Spec: Contest Ties — Shared Places on the Podium

## Problem Statement

A contest podium holds one world per place. Entries in the live contest have equal like counts, and staff have no honest way to announce the result. They must pick one of two equal worlds for 1st place and move the other down. The database, the server validator, the client types, and the Podium dialog all make a shared place impossible.

The Podium dialog also hides the standings. Its entry grid is in catalog order, so staff cannot see which entries lead or which entries are level.

## Solution

Staff can give the same place to two or more worlds. A tie never removes a place. Places run 1st, 2nd, 3rd with no gaps, and staff decide how many worlds hold each one: two worlds in 1st place are followed by 2nd place (1, 1, 2, 3). No limit applies to how many worlds share a place, so staff alone decide how many winners a contest has.

Staff decide ties by judgment. The server does not compare like counts, so staff can also share a place after they discount suspect likes.

Tied worlds get identical treatment: the same metal badge and the plain place label, with no tie marker. Within a place, the world whose listing was published first shows first.

In the Podium dialog, the podium is an ordered list. Each row below the first has a **Tie With Above** toggle. The dialog derives every place from the list, so staff cannot build an invalid podium. The entry grid sorts by likes, highest first, and marks entries whose like counts are equal.

## User Stories

1. As an admin, I want to give 1st place to two worlds, so that a tied contest has an honest result.
2. As an admin, I want to share 2nd or 3rd place in the same way, so that a tie anywhere on the podium has one answer.
3. As an admin, I want any number of worlds to share a place, so that a five-way tie does not stop me.
4. As an admin, I want 2nd and 3rd place to stay available after a tie (1, 1, 2, 3), so that I decide how many winners a contest has and no ranking rule decides it for me.
5. As an admin, I want a **Tie With Above** toggle on each podium row below the first, so that I make a tie with one action.
6. As an admin, I want the dialog to derive the places from my list, so that I cannot build a podium with a gap by mistake.
7. As an admin, I want a world added after 3rd place to share 3rd place, so that no click is refused and no 4th place exists.
8. As an admin, I want 1, 2, 3, 3 to be allowed, so that a tie for 3rd place does not cost a world its place.
9. As an admin, I want the entry grid sorted by likes, highest first, so that I see the standings while I judge.
10. As an admin, I want entries with equal like counts marked in the grid, so that I see every tie before I announce.
11. As an admin, I want to share a place between worlds with different like counts, so that I can correct for likes I do not trust.
12. As an admin, I want the click-to-place interaction to stay, so that judging a contest with no ties works as it does today.
13. As an admin, I want to clear a row and have the rows below close up with their places derived again, so that a removal never leaves a gap.
14. As an admin, I want the announcement preview to show the tie as the broadcast will write it, so that I see the message before players do.
15. As an admin, I want **Edit Podium** to open with the published ties intact, so that a small correction does not drop a tie.
16. As an admin, I want to add a tie to a podium that is already announced, so that I can correct a result that missed one.
17. As an admin, I want a podium edit to stay silent and audited, so that a correction is accountable but is not news.
18. As an admin, I want the audit log to record each world whose place changed, so that an edit to a shared place is fully traceable.
19. As an admin, I want the server to refuse an invalid podium from any client, so that the archive never holds 1, 1, 2.
20. As an admin, I want the entry guards to apply to every tied world (contest entry, not quarantined, not my own), so that a tie is not a way around them.
21. As an admin, I want the Events tab one-liner to read correctly for a tied contest, so that the list does not name one winner of two.
22. As a contest entrant, I want my world to share a place when the result is level, so that an arbitrary pick does not move me down.
23. As a contest entrant, I want my shared 1st place to carry the same gold badge and "1st Place" label as a sole win, so that a tie is a full honor.
24. As a player, I want the podium band to show every placed world with its own plate, so that a tied result is readable at a glance.
25. As a player, I want the podium band to wrap to more rows when many worlds placed, so that the layout holds at any count.
26. As a player, I want tied worlds shown in a fixed, neutral order, so that the order does not read as a hidden ranking.
27. As a player, I want the contest bar to say "2 worlds tied for 1st" when that is the result, so that the summary is true.
28. As a player, I want the contest bar to keep "Won by …" when one world won, so that a normal contest reads as before.
29. As a player, I want the event banner and the acknowledge modal to state the tie, so that the first thing I read about the result is correct.
30. As a player, I want the results broadcast to name every tied world on one line for that place, so that one message gives the full result.
31. As a player, I want place badges on cards and details to work for every tied world, so that each one is findable as a podium world.
32. As a player with a downloaded copy of a tied world, I want the badge on my library card, so that my copy shows the honor too.
33. As a player, I want the decided contest's entry list to start with the podium in place order, with tied worlds in their stored order, so that the list matches the band.
34. As a player, I want entries with equal likes to keep a stable order in the list, so that the list does not change between visits.
35. As a player, I want a tied world that was later deleted to keep its place and position in the archive, so that the record stays complete.
36. As a player on an older desktop build, I want badges to keep working after a tie is announced, so that my client does not break.
37. As a developer, I want the dev event sample to include a shared place, so that every dev surface shows a tie.

## Implementation Decisions

**Ranking rule**

- A podium is a list of placements. Each placement has a place of 1, 2, or 3. The `ContestPlace` type stays `1 | 2 | 3`.
- A podium is valid when its places run from 1 with no gaps (dense ranking). Sort the placements by place. The first place must be 1. Each later placement has the same place as the one before it, or that place plus 1. Any place above 3 is invalid. Examples: `1,1,2` valid; `1,1,2,3` valid; `1,1,1` valid; `1,2,3,3,3` valid; `1,1,2,2,3` valid; `1,1,3` invalid (gap); `2` invalid; `1,3` invalid. This replaces competition ranking (1, 1, 3), which tickets 01 and 04 built first; tickets 08 and 09 make the change.
- One place per world stays a hard rule. One world per place is removed.
- The rule is one pure function on each side: the server validator and a client helper that derives places from the dialog's list. The two must agree; tests on both sides use the same example table.

**Server: schema**

- A new idempotent migration step rebuilds the placements table. The primary key changes from (event, place) to (event, world reference). Because the world reference goes null when a listing is deleted, the step must keep rows with a null world reference distinct; use a surrogate row key or a key on (event, place, position) if the null case makes the world-based key unsafe. The `place IN (1, 2, 3)` check stays. The unique (event, world) rule stays.
- A new integer `position` column holds the order inside a place, from 0. Existing rows get position 0.
- The step follows the ordered step list that runs at boot, and it must be safe to run twice.

**Server: write path**

- The podium validator keeps its shape checks and the per-world entry guards. It drops the three-entry cap, the "one world per place" refusal, and the contiguity refusal. It adds the ranking check with one 400 refusal. It iterates over the sent entries, not over place numbers.
- The validator sorts worlds that share a place by the listing's publish time, earliest first, and assigns `position`. Staff list order has no effect on the stored order.
- The wholesale replace (delete all, insert all, one transaction) stays.
- Reads order by place, then position. This covers the single-event read and the batched list read.

**Server: API contract**

- The placements DTO shape does not change: `{ place, worldId, worldName, authorName }`, ordered by place then position. `place` values can repeat. `position` is not sent; the array order carries it.
- The request shape does not change. A client sends `{ place, worldId }` per world, and places can repeat.

**Server: broadcast and audit**

- The results broadcast writes one line per place. Worlds that share a place are joined on that line: "First place: A by X and B by Y"; with three or more, "A by X, B by Y and C by Z". The existing body clamp (4,000 characters) handles an extreme tie.
- The audit snippet for an announcement uses the same joined form. Its target user is the author of the first 1st-place world by position.
- A podium edit writes one audit row per world whose place changed, including a world that joined or left the podium. A change of position alone writes nothing.

**Client: Podium dialog**

- The draft is an ordered list of rows, each with a world id and a tied-with-above flag. The first row's flag is always off. A pure helper derives the place of each row by the ranking rule.
- The fixed three-slot strip becomes a list of rows. Each row shows its derived place with the metal plate, the world name, a clear button, and (below the first row) the **Tie With Above** toggle.
- A world can join the draft when some valid place exists for it. A click appends the row untied when its derived place would be 3 or lower. An untied row takes the place of the row above plus 1, so from 1, 1, 1 a fourth click gives 1, 1, 1, 2. When the last row already holds 3rd place, the new row joins tied with it: from 1, 2, 3 a click gives 1, 2, 3, 3. Every podium the ranking rule accepts is reachable by clicks and toggles. A tied append always fits, because it shares the last row's place, so a click on an unplaced entry is never refused and the podium has no size limit. Only the toggle refuses. A toggle that would push any row past 3rd place is refused, which includes switching off the tie on such a row.
- The announcement preview uses the server broadcast's own labels ("First place", "Second place", "Third place"), not the badge labels, because the preview must match the message players receive.
- Click-to-place stays: a click on an unplaced entry appends it, a click on a placed entry trades it with the row below, and a click on the last row removes it. The tied flag stays with the row position, not with the world, so a trade never changes the shape of the podium. Removal has one exception: when the removed row opened a run (its flag was off) and the next row was tied to it, the next row becomes the opener and its flag goes off. The survivors of a run keep their place; they never join the run above. From 1, 2, 2, removing the first 2nd-place world leaves 1, 2.
- The dialog shows tied rows in publish-time order, so it matches what the server will store. After every action, a pure function sorts the world ids inside each run of rows that share a place by the listing's `created_at`, earliest first. A missing time sorts last and keeps its relative order. Because a trade inside a run would be sorted straight back, a click on a placed world trades it with the first row below its run, and a click on a world in the last run removes it.
- Edit mode seeds the draft from the published placements with their places, and sets the tied flag where two neighbors share a place. The signature that guards the re-seed includes the places, not only the ids.
- The announcement preview uses the joined-line form.
- The entry grid sorts by likes, highest first, with publish time as the tiebreaker. An entry whose like count equals another entry's count shows a tie marker next to its count.
- The dialog copy changes to describe the toggle. It follows the project help-copy pattern.

**Client: player surfaces**

- The podium band becomes a flat wrapping row. Each card has its own plate. Cards follow the array order. React keys use the world id with an index fallback, never the place.
- Four one-line surfaces name only the 1st-place world today: the contest bar status line, the event banner, the acknowledge modal title, and the admin Events tab one-liner. With one 1st-place world they do not change. With two or more they show a count: "N worlds tied for 1st". The contest bar keeps its "· N more placed" suffix, where N counts the worlds below 1st place. One shared helper returns the 1st-place worlds so the four surfaces cannot drift.
- The tie forms, with N as the count of 1st-place worlds and M as the count of worlds below 1st:
  - Contest bar status line: `N worlds tied for 1st · M more placed` (the suffix only when M is above 0).
  - Event banner line: `Results announced — N worlds tied for 1st`.
  - Acknowledge modal title: `N Worlds Tied for 1st`. It is a title, so it takes title case. The other three are status lines and stay in sentence case.
  - Admin Events tab one-liner: `N worlds tied for 1st (+M more)`. The `1st Place:` prefix is dropped on a tie, because it repeats the place.
- The decided-contest entry order pins the podium in array order and adds publish time as the tiebreaker for the like-count sort.
- Place lookup by world, the badge-pair lookup, and the place badges need no change. They already look up by world.
- The dev event sample gets a shared place.

**Compatibility**

- Released desktop and itch builds read a repeated place without error. Badges work per world. Their gold-only surfaces name one of the tied worlds. This is accepted.
- No export shape changes. Placements are never written to a world export or a save envelope.
- The server deploys first. The website client follows. The live contest is not announced until both are live.

## Testing Decisions

- A good test asserts what a caller observes at the seam. Each guard must fail when its rule is removed; prove that once per guard.
- **Server HTTP seam** (supertest against the in-memory database; prior art: the contest entries suite's announce and edit blocks). Cover: the ranking example table (valid and invalid), a tie stored and returned in publish-time order, no cap on worlds per place, a fourth world refused when its place would be 4, one place per world still refused, every entry guard applied to a tied world, the joined broadcast line, an edit that adds a tie, one audit row per world that moved, and no audit row for a position-only change. Replace the tests that assert one world per place, contiguity, and the three-entry cap.
- **Server schema seam** (prior art: the event placements migration suite). Cover: two rows with the same place accepted, the `position` column, existing rows migrated with position 0, the step safe to run twice, a deleted world's row kept with its place and position, and the place check still refusing 4.
- **Client pure-lib seam** (primary; prior art: the contests, server-events, and admin-events unit tests). Cover: the place-derivation helper against the same example table, the 1st-place helper, the status lines for one winner and for a tie, the entry order with a shared place, and the publish-time tiebreaker.
- **Client component seam** (RTL with service mocks; prior art: the Podium dialog suite and the badge rendering tests). Cover: the toggle makes a tie and the places derive again, a toggle or click that would pass 3rd place is refused, a trade keeps the podium shape, clear closes the gap, edit mode opens with ties intact, the request body carries repeated places, the grid sorts by likes and marks equal counts, the preview shows the joined line, and the band renders N cards with no duplicate-key warning. Replace the "never lets one world hold two places" style tests that assert the old slot model where they conflict; keep the one-place-per-world assertion.
- **E2E**: extend the contest journey with one tied announce that shows on the band and on a card badge. This runs outside the four gates. The tied announce replaces the journey's existing announce, because a contest announces once: one contest, one announce, driven through the Podium dialog. Where the seeded contest has enough entries, the podium is 1, 1, 2, so the same run proves a shared place and a sole place. The untied-only podium is covered at the component and lib seams, not in the journey.

## Out of Scope

- A place above 3rd, competition ranking (1, 1, 3), or a podium with a gap.
- A server check that tied worlds have equal like counts.
- A tie marker in any player-facing label or badge.
- A real contest-entry timestamp on listings. Publish time stands in for it.
- A broadcast on podium edits.
- A new API field or a compatibility shim for released clients.
- Automatic podium suggestions from the standings.
- A sort or tie marker on any surface other than the Podium dialog's entry grid.

## Further Notes

- This spec supersedes the "Strict podium" decision and the "Ties, shared places" out-of-scope line in the contest-podium spec. Every other decision in that spec stands.
- The live contest has entries with equal like counts and is not announced. This work unblocks that announcement.
- The changelog entry belongs in the In-Progress section, user-facing bucket.
- Suggested tickets: 01 server schema and validator; 02 server broadcast and audit; 03 client ranking helper, types, and one-line surfaces; 04 Podium dialog; 05 podium band and entry order; 06 E2E. Tickets 01–02 block the deploy; 03–05 depend only on the DTO contract above.
