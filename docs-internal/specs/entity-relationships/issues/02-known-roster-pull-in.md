# 02: Known Roster Pull-In

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

The behavior that answers the original problem: an absent relative is known. It changes roster precedence logic and needs a probe, so it needs careful reasoning.

## What to build

When Tera is in the here roster or the in-scene roster, Kate joins **Entities Known Here** with her summary, even though she isn't present or known by place. Kate's relationship line prints once, so the narrator knows who she is and why she matters.

## Acceptance criteria

- [ ] Each entity in the here or in-scene roster pulls the other end of each of its relationships into the known roster.
- [ ] One hop only: entities in the sublocation, reachable and known rosters pull no one in.
- [ ] The pull-in ignores Known In, Nowhere included.
- [ ] Precedence holds: a pulled entity that a higher scope lists stays there and isn't listed again.
- [ ] A pulled entity renders like any known entity: summary only, no traits, no stats.
- [ ] The known roster's header text is unchanged.
- [ ] Chip-value tests cover each rule above, and each guard is proven to bite.
- [ ] A cloud probe runs an in-batch A/B, relationship off vs on, and reports whether narration uses the absent relative correctly without putting them in the scene. Numbers go in the response.
