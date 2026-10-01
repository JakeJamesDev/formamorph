# 11: Effort review fixes

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Parent: [Stat Code Entities spec](../spec.md)

## What to build

Behavior and copy fixes from the effort review: Q30–Q32, plus comment and completion-copy cleanups.

## Acceptance criteria

- [ ] A stat that a trait switched off reads as a real entry with `enabled: false`. A write to it is dropped and reported (Q30).
- [ ] An entity with an empty code name is not listed in `entities`, and the editor warns the author to name it (Q31).
- [ ] A write to `clock` or `clock.previous` is dropped and reported as a read-only write (Q32).
- [ ] The `dictionaries` completion text says it lists dictionaries in play, not every dictionary in the world (Q29).
- [ ] Completion text uses one form for boolean fields ("True when…"), on traits, entities and stats.
- [ ] The editor's leftover `personaTraits` input is folded into `entities`, so the editor has one source for persona and entity names.
- [ ] TSDoc blocks this effort added are cut to the tight-line standard. Design reasons and spec Q-numbers leave the code comments.
- [ ] Tests at `runStatCodeTurn` and the analysis seam, each shown to bite. The changelog line is in In Progress.
