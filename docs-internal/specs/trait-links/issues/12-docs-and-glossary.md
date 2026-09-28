# 12: Docs and glossary

Status: ready-for-human
Base: 3cb80813
Blocked by: 09 — Linked traits in AI context; 10 — Links across library and import; 11 — Test Bench link rules
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: low

Rationale: writing over finished behavior. No logic.

Parent: [Trait Links spec](../spec.md)

## What to build

An author can read how links, Templates, Custom Persona, persona-only entities, and per-bearer gates and pins work, in the wiki's voice. The glossary carries the effort's terms.

## Acceptance criteria

- [ ] The traits wiki page gains sections for links, Templates, Custom Persona, Detach, and per-bearer requirements and pins, with the RPG class example.
- [ ] The persona page covers persona-only entities and Custom Persona.
- [ ] `CONTEXT.md` gains Link, Bearer and Original with the spec's definitions.
- [ ] The In-Progress changelog entries for tickets 01–11 are folded into one lead per user-facing subject where the guard allows.
- [ ] Every doc follows the Writing Guide and never references agent files.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Add the In-Progress changelog entry, update the code graph, and complete the shared-code side-effect scan.
