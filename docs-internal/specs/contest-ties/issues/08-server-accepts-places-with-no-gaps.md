# 08: Server Accepts Places With No Gaps

Status: ready-for-human
Status note: built in FormamorphServer commit d0df7ce (server base 5efeb05); unpushed
Base: 000ba0ef
Blocked by: 01
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

**Parent:** [Contest Ties](../spec.md)

**Work tree:** the FormamorphServer repo. Copy the current spec from the client repo first; the server copy still states the old rule.

**What to build:** A tie no longer removes a place. Ticket 01 built competition ranking (1, 1, 3). The user then decided that staff, not a ranking rule, choose how many winners a contest has. The podium validator now accepts a podium when its places run from 1 with no gaps: each placement, in place order, has the same place as the one before it or that place plus 1, and no place is above 3. The rule and its example table are in the spec under "Ranking rule". Nothing else in ticket 01 changes: the schema, the position order, the entry guards, and the DTO stay as built.

- [x] `1,1,2`, `1,1,2,3`, `1,1,1`, `1,2,3,3,3`, and `1,1,2,2,3` are stored and returned
- [x] `1,1,3`, `1,3`, and `2` are refused with 400, and the refusal text describes a gap, not a skipped place
- [x] A place above 3 is still refused at the column and at the route
- [x] Ticket 01's tests that assert competition ranking are replaced, and the new guard is proven to fail when its rule is removed
- [x] The broadcast and the audit from ticket 02 read a `1,1,2` podium correctly (one test)
- [x] The server's own test suite is green, and the run time is stated

## Comments

**2026-09-20, handover.** The validator rule is `hasNoGaps` in `src/controllers/eventController.js`. The refusal reads "A podium runs from first place down with no gap between places".

- Tests: the spec example table drives the accept and refuse cases in `tests/contestEntries.test.js`. The accept table checks the stored rows and the returned places.
- Guard proof: with the rule changed to accept any rising place, 4 tests failed (`1,3`, `1,1,3`, `1,1,1,3`, and the edit with `1,3,3`). The rule was then restored.
- Broadcast and audit read `1,1,2` as "First place: A and B" plus "Second place: C", one test each.
- Place above 3: the column test in `tests/placementTies.test.js` and the route test needed no change.
- Server suite: 1670 tests pass in 29.7 s wall time.
- Ticket 07 worked in the same two files at the same time. The commit holds ticket 08 hunks only; ticket 07 changes stay uncommitted in the work tree.
- Spec drift to fix: user story 19 still says the archive never holds 1, 1, 2. Under the no-gap rule that podium is valid.
