# 05: Shared Sorts

Status: done
Status note: Client `22d8db3a`, review fold-in `46ecbcc8`; server `c330882`, tiebreak fix `ff7587e`. The sort seam and tab wiring landed in ticket 03's commit `83625b11`.
Base: 773f369a
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

**Parent:** [Feedback List Search and Filters](../spec.md)

**Work tree:** the FormamorphServer repo first, then this repo. The client part ships only after the user deploys the server.

**What to build:** A staff member sorts Bugs by Oldest or Recently active (Q10, Q13). Suggestions offer the same sorts plus Most voted (Q14). Users get Sort on every tab and both scopes (Q15). Defaults stay: staff Suggestions on Most voted, user Suggestions on Newest, Bugs on Newest (Q17).

The server whitelist adds `oldest` (created first) and `active` (`updated_at` latest first). Every sort ends on the newest tiebreak. `votes` on Bugs falls back to newest. The presentation module holds one sort list with labels and a per-type function for the sorts each type offers.

- [x] Server: `oldest` and `active` return the expected order with the tiebreak; `votes` on Bugs falls back to newest
- [x] Client: staff Bugs shows Sort with Newest, Oldest, Recently active
- [x] Client: Suggestions show those three plus Most voted
- [x] Client: users see Sort on Bugs and Suggestions, in Mine and Everyone's
- [x] Client: default sorts match Q17
- [x] Server tests over supertest; client tests at the tab seam
- [x] Changelog line under In Progress (client); the deploy log is the user's
