# 07: Docs and glossary

Status: ready-for-agent
Blocked by: 02, 03, 06
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

Rationale: prose only, against shipped behavior.

Parent: [Trait Modes and Pick Counts spec](../spec.md)

## What to build

An author can read how pick counts and trait modes work in the wiki. The glossary has the new terms.

## Acceptance criteria

- [ ] The wiki trait pages describe the count presets, the three modes, curses via Always On with a requirement, and the Test Bench rules. They follow human doc formatting.
- [ ] Any mention of exclusive groups reads as "Up to One".
- [ ] `CONTEXT.md` has entries for Always On, Hidden (trait) and Pick Count, with Avoid lists.
- [ ] `copy-sweep` passes on the changed docs.
