# 04: Memory And Diary Writes

Status: done
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: three calls on top of ticket 03's staging and precedence, touching the memory stores.

## What to build

Every script can add a line to the turn's memory, add a pinned memory, and add a diary line for an entity (Q8, Q16). A turn memory line is found by recall and does not ride every request. A pinned memory rides every request, as a Memory Manager memory does. A diary line names an entity the world has; an unknown entity throws (Q14). The writes stage with the turn, so a regenerate drops them. A code memory line for the turn beats the digest pass for the same turn only where they write the same field (Q15).

Spec: Q8, Q14, Q15, Q16; stories 20–22.

## Acceptance criteria

- [ ] A turn memory line from a Script is found by recall on a later turn and is absent from the next request's pinned memories
- [ ] A pinned memory from a Script rides the next request
- [ ] A diary line lands in the named entity's diary; an unknown entity fails the script
- [ ] Regenerate drops all three
- [ ] Changelog fragment written
- [ ] Four gates green

## Blocked by

- 03 Location, Clock And Discovery Writes
