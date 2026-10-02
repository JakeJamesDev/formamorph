# 05: Shared Sorts

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

**Parent:** [Feedback List Search and Filters](../spec.md)

**Work tree:** the FormamorphServer repo first, then this repo. The client part ships only after the user deploys the server.

**What to build:** A staff member sorts Bugs by Oldest or Recently active (Q10, Q13). Suggestions offer the same sorts plus Most voted (Q14). Users get Sort on every tab and both scopes (Q15). Defaults stay: staff Suggestions on Most voted, user Suggestions on Newest, Bugs on Newest (Q17).

The server whitelist adds `oldest` (created first) and `active` (`updated_at` latest first). Every sort ends on the newest tiebreak. `votes` on Bugs falls back to newest. The presentation module holds one sort list with labels and a per-type function for the sorts each type offers.

- [ ] Server: `oldest` and `active` return the expected order with the tiebreak; `votes` on Bugs falls back to newest
- [ ] Client: staff Bugs shows Sort with Newest, Oldest, Recently active
- [ ] Client: Suggestions show those three plus Most voted
- [ ] Client: users see Sort on Bugs and Suggestions, in Mine and Everyone's
- [ ] Client: default sorts match Q17
- [ ] Server tests over supertest; client tests at the tab seam
- [ ] Changelog line under In Progress (client); the deploy log is the user's
