# 08: Server Accepts Places With No Gaps

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

**Parent:** [Contest Ties](../spec.md)

**Work tree:** the FormamorphServer repo. Copy the current spec from the client repo first; the server copy still states the old rule.

**What to build:** A tie no longer removes a place. Ticket 01 built competition ranking (1, 1, 3). The user then decided that staff, not a ranking rule, choose how many winners a contest has. The podium validator now accepts a podium when its places run from 1 with no gaps: each placement, in place order, has the same place as the one before it or that place plus 1, and no place is above 3. The rule and its example table are in the spec under "Ranking rule". Nothing else in ticket 01 changes: the schema, the position order, the entry guards, and the DTO stay as built.

- [ ] `1,1,2`, `1,1,2,3`, `1,1,1`, `1,2,3,3,3`, and `1,1,2,2,3` are stored and returned
- [ ] `1,1,3`, `1,3`, and `2` are refused with 400, and the refusal text describes a gap, not a skipped place
- [ ] A place above 3 is still refused at the column and at the route
- [ ] Ticket 01's tests that assert competition ranking are replaced, and the new guard is proven to fail when its rule is removed
- [ ] The broadcast and the audit from ticket 02 read a `1,1,2` podium correctly (one test)
- [ ] The server's own test suite is green, and the run time is stated
