# 11: Effort review fixes

Status: done
Base: 374c3362
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Parent: [Stat Code Entities spec](../spec.md)

## What to build

Behavior and copy fixes from the effort review: Q30–Q32, plus comment and completion-copy cleanups.

## Acceptance criteria

- [x] A stat that a trait switched off reads as a real entry with `enabled: false`. A write to it is dropped and reported (Q30).
- [x] An entity with an empty code name is not listed in `entities`, and the editor warns the author to name it (Q31).
- [x] A write to `clock` or `clock.previous` is dropped and reported as a read-only write (Q32).
- [x] The `dictionaries` completion text says it lists dictionaries in play, not every dictionary in the world (Q29).
- [x] Completion text uses one form for boolean fields ("True when…"), on traits, entities and stats.
- [x] The editor's leftover `personaTraits` input is folded into `entities`, so the editor has one source for persona and entity names.
- [x] TSDoc blocks this effort added are cut to the tight-line standard. Design reasons and spec Q-numbers leave the code comments.
- [x] Tests at `runStatCodeTurn` and the analysis seam, each shown to bite. The changelog line is in In Progress.
