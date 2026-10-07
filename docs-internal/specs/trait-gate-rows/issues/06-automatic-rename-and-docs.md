# 06: Automatic rename and docs

Status: ready-for-agent
Blocked by: 03, 04, 05
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

Rationale: docs, glossary and message copy once the behavior is final; no logic.

Parent: [Trait Gate Rows spec](../spec.md)

## What to build

The written word catches up. Always On becomes Automatic in `CONTEXT.md`, the Glossary, the World Editor: Traits page, help docs and Test Bench messages (Q3). The Traits page's Requirements section describes rows, **And**, **Or Another Way** and Not, and the player's lock line. The glossary gains **Requirement Row** and **Condition**, with Not as a flag on a Condition (Avoid: exclusion, negation, rule). Released changelog entries keep their text; code identifiers are not renamed.

## Acceptance criteria

- [ ] `CONTEXT.md`: Always On entry renamed Automatic with Always On under Avoid; Requirement Row and Condition entries added; the Requirement entry updated.
- [ ] Glossary and the Traits wiki page updated for Automatic, rows, And, Or Another Way, Not and the lock line. Route lines and surface anchors still resolve; the docs tests pass.
- [ ] Test Bench rule messages and any help-doc line that say Always On say Automatic. The help retrieval tests still pass.
- [ ] Persona Authoring and any other wiki page naming Always On updated.
- [ ] Changelog: the fragments from 02 to 05 fold into one In Progress entry under Added, 👤, with a bold lead that states subject, surface and outcome by itself (`changelog-lead-guard`).
- [ ] Gates green: `typecheck`, `lint`, `test`, `build`.

## Comments
