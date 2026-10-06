# 15: Picker Memoization and Harness Step

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Recommended model rationale: local memoization in four pickers plus one harness step.

## What to build

The four Select pickers that list locations or personas (Connect To, Starting Location, the Openings starting-location filter, Start Persona) memoize their options and items on the lists they depend on (Q13). No change to look, positioning, typeahead or keyboard behavior. Add a `picker` step to the editor-speed harness: type in a field while a location's Presence tab is open, then open Connect To. If the step misses Q1, report it to the spec session before doing more.

## Acceptance criteria

- [ ] Typing in another field does not re-render the Connect To items (render-count test).
- [ ] Each picker still opens, positions to the selected item, filters by typeahead, and selects by keyboard (existing tests pass).
- [ ] Harness `picker` step exists and reports at 6x.
- [ ] Four gates green.
