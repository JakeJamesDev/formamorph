# 31: Lookup mode off by default

Status: done
Base: 2242003f
Blocked by: 28
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Every help question uses retrieval mode, on every endpoint. The lookup path stays in the code and its tests, switched off (Q53).

After ticket 27 fixed the search, ticket 28 measured on MeroMero: retrieval 48/48 complete at 1,653 tokens in on average; lookup 45/48 at 3,090, with one new regression. The user chose to keep lookup mode but off by default.

- One named constant in the help session switches lookup mode on. It ships off. It is not a player setting (Q9) and not in any preset or export.
- With it off, the help session never offers the lookup function, on any endpoint, and does not run the capability check for it.
- With it on, behavior is exactly ticket 28's. The existing lookup tests run with it on, so the path stays proven.
- The help probe's `--lookup` arm keeps working, so a later run can compare the arms again.
- Update ADR-0009: the decision stands, the shipped default is off, and why, with ticket 28's numbers.
- Update the docs page for Formaquestion if it says the AI looks up sections.

Recommended model rationale: a small switch and a record update.

## Acceptance criteria

- [ ] With the constant off, a request on a tool-capable endpoint offers no lookup function; a test asserts it
- [ ] With the constant on, the lookup tests pass unchanged
- [ ] The constant is not a setting and appears in no preset or export
- [ ] The probe's `--lookup` arm still runs
- [ ] ADR-0009 records the default and the numbers
- [ ] The Formaquestion docs page matches the shipped behavior
- [ ] Four gates green
