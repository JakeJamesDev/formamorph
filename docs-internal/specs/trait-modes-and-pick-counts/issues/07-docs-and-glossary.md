# 07: Docs and glossary

Status: ready-for-human
Base: 11ff21f1
Blocked by: 02, 03, 06
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

Rationale: prose only, against shipped behavior.

Parent: [Trait Modes and Pick Counts spec](../spec.md)

## What to build

An author can read how pick counts and trait modes work in the wiki. The glossary has the new terms.

## Acceptance criteria

- [x] The wiki trait pages describe the count presets, the three modes, curses via Always On with a requirement, and the Test Bench rules. They follow human doc formatting.
- [x] Any mention of exclusive groups reads as "Up to One".
- [x] `CONTEXT.md` has entries for Always On, Hidden (trait) and Pick Count, with Avoid lists.
- [x] `copy-sweep` passes on the changed docs.
