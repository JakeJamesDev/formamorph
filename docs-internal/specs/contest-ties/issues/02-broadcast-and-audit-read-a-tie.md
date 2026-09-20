# 02: Broadcast and Audit Read a Tie

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

**Parent:** [Contest Ties](../spec.md)

**Work tree:** the FormamorphServer repo.

**What to build:** The results broadcast writes one line per place. Worlds that share a place are joined on that line: "First place: A by X and B by Y", and with three or more, "A by X, B by Y and C by Z". The audit snippet for an announcement uses the same form, and its target user is the author of the first 1st-place world by position. A podium edit writes one audit row per world whose place changed, which includes a world that joined or left the podium. A change of position alone writes nothing. The existing body clamp handles an extreme tie; no new cap is needed.

- [ ] A tied announce posts one broadcast with one line per place and the tied names joined
- [ ] A podium with no ties produces the same broadcast text as before
- [ ] The announcement audit snippet uses the joined form
- [ ] An edit that adds a second 1st-place world writes an audit row for that world, and for any world the edit moved
- [ ] An edit that changes nothing, or only the order inside a place, writes no audit row
- [ ] The server's own gates are green, and the test run time is stated
