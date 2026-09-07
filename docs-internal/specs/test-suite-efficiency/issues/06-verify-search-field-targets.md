# 06: Verify Search Targets Against Rendered Fields

Status: ready-for-agent

**Parent:** [Test Suite Efficiency and Trust](../spec.md)

**Blocked by:** None (can start immediately).

## What to Build

Editor search tests prove that a search result identifies the correct rendered field. Replace the weak check that hardcoded captions occur somewhere among manager source files.

Use real search-target collection and rendered field identification/navigation. Cover the ambiguous case where player-facing and AI-facing fields contain identical text, so matching by text alone cannot satisfy the test.

## Acceptance Criteria

- [ ] Verify the actual relationship between collected search targets and their corresponding rendered fields, including captioned and plain-input field categories relied on by the current guard.
- [ ] A scenario with identical text in distinct fields selects or identifies the intended field using its real identity, not a matching caption found in an unrelated panel.
- [ ] Changes to the relevant collector, field identity, or manager consumer reach the appropriate tests through imports or an explicit selection mapping.
- [ ] Assertions observe DOM identity, selection, or focus behavior available in the test environment. Do not claim scrolling geometry or visual layout from jsdom.
- [ ] Replace superseded source-caption checks only after the stronger guards work; preserve intentional editor caption consistency requirements.
- [ ] Temporarily misroute a target or break field identification and confirm the expected test fails. Restore and verify production code and measure coverage on any production module changed for testability.
- [ ] Retain production user interaction and field ownership contracts; large editor-search refactors require a separate proposal.
- [ ] Complete typecheck, lint, the full test suite, and build; report test wall time and exit status. Update the developer-tooling changelog and code graph as applicable.

## Coordination

Coordinate manager/field harness edits with editor architecture and UI performance work. Give ticket 09 any filesystem dependencies that cannot be represented through normal production imports. Browser-only evidence belongs to the separate Playwright task.
