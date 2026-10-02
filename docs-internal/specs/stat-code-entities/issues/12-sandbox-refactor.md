# 12: Sandbox refactor

Status: done
Base: 888f11cc
Blocked by: 06, 11
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Parent: [Stat Code Entities spec](../spec.md)

## What to build

Structural cleanups from the effort review, with no behavior change. It runs after 06 and 11 so it refactors the final shape once.

## Acceptance criteria

- [x] The `entities` and `dictionaries` preludes come from one shared read-only entry-map factory, and their write readers share one row parser.
- [x] The run's warnings come from one table that maps each result field to its message, not from repeated `console.warn` blocks.
- [x] The type that carries traits, entities, the library and the scene is renamed to say what it holds. Values that always travel together (the keyed entities, the persona, the index) travel as one type.
- [x] GameViewer no longer builds the stat code placeholder set inline. A helper next to the books-in-play helper builds it, and the effect's dependency list shrinks.
- [x] The full suite passes with no test changes beyond imports and renames. The four gates are green.
