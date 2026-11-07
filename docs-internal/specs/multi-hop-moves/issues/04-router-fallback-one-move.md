# 04: Router Fallback Matches One-Move Places Only

Status: ready-for-agent
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

- [ ] A router reply that contains a far place's name inside other words moves nobody, and an exact far name still moves the player there, in matcher tests. The guard is shown to fail with the old rule back.
- [ ] A router reply that contains a one-move place's name inside other words still matches, as today.
- [ ] The router probe and the location-narrated probe on the cloud default model show router controls and the far set no worse than before. The numbers go in the ticket's `## Landed` section.
