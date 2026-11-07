# 01: Elsewhere for Narrated Move

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: a prompt change, one answer in the reply matcher and a new probe set, with no new move path.

## What to build

When the story takes the player somewhere that is not on the list, the game leaves them where they are (Q2, Q9).

- The Narrated Move request gets an Elsewhere answer: the player's body left for a place that is not on the list.
- Elsewhere moves nobody. In Auto mode the player stays. In Suggest mode no move is offered.
- The router keeps NONE and gets no Elsewhere answer.
- The location-narrated probe gains an **unlisted** set: narrations that carry the player to a place that is not on the list (today, any place more than one move away). It runs beside the existing sets on the cloud default model.
- Docs that describe the Narrated Move request and its answers say what Elsewhere does.

## Acceptance criteria

- [ ] A Narrated Move reply of Elsewhere leaves the player at the current location in Auto mode, in a turn-runner test with fake replies.
- [ ] A Narrated Move reply of Elsewhere gives no move offer in Suggest mode, in a turn-runner test with fake replies.
- [ ] The router's reply rule and its NONE answer are unchanged.
- [ ] Probe numbers on the cloud default model, 10 runs per scene: unlisted at most 10% moved, carried still at least 90% moved, stay still at most the current rate, router controls unchanged. The numbers go in the ticket's `## Landed` section.

For you: in a live Auto-mode turn, a walk to a place more than one move away leaves you where you are, and the next turns are not out of step.
