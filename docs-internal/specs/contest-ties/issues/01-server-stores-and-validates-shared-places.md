# 01: Server Stores and Validates Shared Places

Status: ready-for-human
Status note: Built in the FormamorphServer repo, commits `347b566` and `845b210` (unpushed). Key chosen: (event_id, place, position). All 1,596 server tests pass in 37 s wall time. Not deployed — the deploy log in `docs-internal/server.md` is the user's to write.
Base: 6f797f86
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

**Parent:** [Contest Ties](../spec.md)

**Work tree:** the FormamorphServer repo. It holds a copy of the spec at the same path.

**What to build:** An admin can announce or edit a podium where two or more worlds share a place. The server accepts a podium only when its places follow competition ranking (1, 1, 3), with no place above 3 and no limit on worlds per place. The server stores worlds that share a place in listing publish-time order, earliest first, and returns them in that order. The placements DTO and the request shape do not change; `place` values can repeat.

The placements table is rebuilt in a new idempotent migration step. The key can no longer be (event, place). The world reference goes null when a listing is deleted, so choose a key that keeps those rows distinct: a surrogate row key, or (event, place, position). State the choice in the commit body. A new `position` column holds the order inside a place.

The validator keeps its shape checks and every per-world entry guard. It drops the three-entry cap, the "one world per place" refusal, and the contiguity refusal, and it adds one ranking refusal. The ranking rule and its example table are in the spec under "Ranking rule".

- [ ] A podium of `1,1,3`, `1,1,1`, and `1,2,3,3,3` is stored and returned; `1,1,2`, `2`, and `1,1,1,3` are refused with 400
- [ ] A place above 3 is refused at the column and at the route
- [ ] The same world in two placements is still refused
- [ ] Every entry guard (not an entry, quarantined, own entry) refuses a tied world the same way it refuses a sole one
- [ ] Worlds that share a place come back in publish-time order, whatever order the request used
- [ ] The single-event read and the batched list read both order by place, then position
- [ ] The migration keeps existing podiums with position 0, and a second run changes nothing
- [ ] A tied world that is deleted later keeps its row, its place, and its position
- [ ] The tests that assert one world per place, contiguity, and the three-entry cap are replaced, and each new guard is proven to fail when its rule is removed
- [ ] The server's own gates are green, and the test run time is stated
