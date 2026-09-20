# 02: Broadcast and Audit Read a Tie

Status: ready-for-human
Status note: Built in the FormamorphServer repo, commits `31bf955` and `85be1ad` (unpushed). All 1,616 server tests pass in 57 s wall time. The server repo has no lint or typecheck gate; its test suite is the gate. No changelog entry: the broadcast wording only changes once staff can build a tie, which is tickets 03-05 in the client repo. Not deployed.
Base: d1785716
Blocked by: 01
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

**Parent:** [Contest Ties](../spec.md)

**Work tree:** the FormamorphServer repo.

**From 01:** both paths are already reachable and already lossy. `podiumSnippet` and `podiumBroadcast` emit one "First place:" line per tied world instead of joining them, and the edit route's audit loop is still `for (const place of PLACES)` with a `.find` by place, so an edit that ties a place logs one holder and silently drops the co-holder's row. The shipped client cannot build a tie until 03–05, so the window is API-only, but it is open from the moment 01 deploys.

**What to build:** The results broadcast writes one line per place. Worlds that share a place are joined on that line: "First place: A by X and B by Y", and with three or more, "A by X, B by Y and C by Z". The audit snippet for an announcement uses the same form, and its target user is the author of the first 1st-place world by position. A podium edit writes one audit row per world whose place changed, which includes a world that joined or left the podium. A change of position alone writes nothing. The existing body clamp handles an extreme tie; no new cap is needed.

- [x] A tied announce posts one broadcast with one line per place and the tied names joined
- [x] A podium with no ties produces the same broadcast text as before
- [x] The announcement audit snippet uses the joined form
- [x] An edit that adds a second 1st-place world writes an audit row for that world, and for any world the edit moved
- [x] An edit that changes nothing, or only the order inside a place, writes no audit row
- [x] The server's own gates are green, and the test run time is stated
