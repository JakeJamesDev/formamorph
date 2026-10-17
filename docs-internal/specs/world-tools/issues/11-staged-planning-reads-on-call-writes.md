# 11: Staged Planning Reads On Call Writes

Status: done
Blocked by: 10
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: staged planning builds several prompts from one context snapshot, and the fix must keep turns without On Call writes byte-equal.

## What to build

With staged planning on, the planning passes that run after the director request still read the context built before it. An On Call write made during the director request (a stat, trait, clock, location or discover write) never reaches them, which breaks Q38. After this ticket, every staged planning pass built after an On Call landing reads the live turn state, as Narration does since ticket 10 (Q52). A turn with no On Call landing sends byte-equal requests.

Spec: Q38, Q44, Q52, Q55.

## Acceptance criteria

- [ ] With staged planning on, a director On Call `location.move` makes the next staged pass's prompt name the new location
- [ ] A director On Call stat write shows in the next staged pass's stat values
- [ ] A turn with no On Call landing sends byte-equal staged requests; a test proves it
- [ ] The guard bites when the staged pass reads the pre-call context again
- [ ] Changelog fragment written
- [ ] Four gates green

## Blocked by

- 10 Mid-turn Clock Advance
