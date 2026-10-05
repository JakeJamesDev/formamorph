# 05: Badge under the text endpoint select

Status: done
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The text endpoint preset select shows whether the active preset answers.

- The reachability badge renders under the select in both modals, for the preset the editor edits. It shows the four states and the Recheck link as the route fields do.
- The engine preset shows no badge.
- The badge shares the session cache with the route fields, so a preset probed on one surface is not probed again on the other.

Spec: Q3; Implementation → Reachability on endpoint selects.

Recommended model rationale: reuse of an existing badge and hook on one more select.

## Acceptance criteria

- [ ] The badge appears under the text preset select in Settings and in the Formaquestion Endpoint tab.
- [ ] The engine preset shows no badge.
- [ ] A rendered test asserts the badge text with a mocked probe.
- [ ] Changelog line under In Progress.
