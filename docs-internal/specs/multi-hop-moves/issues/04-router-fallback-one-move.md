# 04: Router Fallback Matches One-Move Places Only

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: one matcher rule with tests, and a probe run on cases that already exist.

## What to build

An odd router reply that only contains a far place's name never moves the player there (R2).

- The router's reply matcher keeps its substring fallback for places one move away.
- A place more than one move away matches only an exact reply: case, outer spaces, a leading article and markdown aside, as the exact match reads today.
- The Narrated Move matcher is unchanged.
- Docs that describe how a router reply is read say what changed.

## Acceptance criteria

- [x] A router reply that contains a far place's name inside other words moves nobody, and an exact far name still moves the player there, in matcher tests. The guard is shown to fail with the old rule back. `matchRouterResponse` tests in `locationMatch.test.ts`, plus a mounted-game test in `GameViewer.multiHopMoves.test.tsx`. With the old rule back in the matcher, 3 tests fail. With the far list dropped in GameViewer, the mounted-game test fails.
- [x] A router reply that contains a one-move place's name inside other words still matches, as today. Matcher test "still finds a one-move place inside other words", and the yard turn in the mounted-game test.
- [x] The router probe and the location-narrated probe on the cloud default model show router controls and the far set no worse than before. The numbers go in the ticket's `## Landed` section. The location-narrated probe's new router arm, 10 runs (Q3 ruling).

## Landed

Cloud default model, 10 runs per scene, `location-narrated-probe.cli.ts` router arm. Each reply is scored by both rules.

| Set | Substring rule (before) | Router matcher (after) |
|---|---|---|
| Router controls, right | 360/380, 20 wrong moves | 360/380, 20 wrong moves |
| Far set, right | 1/70, 20 wrong moves | 1/70, 20 wrong moves |

- The two rules agree on every reply: the model always answered with a bare name or NONE. The prose case is guarded by the tests, not the probe.
- The router reads the action alone, so the far set's low score is the router prompt, not the matcher: most far actions do not name the far place.
- The narrated arms in the same run meet the Q10 bar: far 100%, unlisted moved 0%, carried 100%, stay moved 12.5%, control 60.5%.

**Not verified**
- `location-router-probe.mjs` was not rerun: every place on its lists is one move away, so the new rule reads its replies exactly as the old one.

**For you**
- Nothing to judge in play: the change shows only on a router reply in prose.
