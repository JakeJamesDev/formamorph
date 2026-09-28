# 02: Entity panel tabs fill the pane

Status: ready-for-human
Base: 34bca08a
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Rationale: a contained layout change in the detail host with a clear visual done-state and no new behavior.

Parent: [Entity Traits Mirror spec](../spec.md)

## What to build

The entity panel's **Traits** and Placeholders tabs take the pane's real height. The Placeholders list fills the pane at any window height, with its toolbar in place and its list scrolling inside. On mobile the pushed entity panel does the same. The other entity tabs and every other detail panel keep their natural height and the pane's scroll. Rulings Q8, Q18, Q20.

## Acceptance criteria

- [x] The detail host switches per tab: the entity **Traits** and Placeholders tabs render in a flex column with a definite height; every other panel keeps the pane's scroll area.
- [x] The Placeholders tab's viewport-based fallback height is removed and the tab reads the pane's height instead.
- [x] Inside the mobile push, the same two tabs get the same definite height.
- [x] The Profile, Descriptions and Openings tabs scroll as before at natural height.
- [x] A bench test asserts the switch: the two filled tabs sit in a flex column, and a non-filled tab still sits in the scroll area.
- [x] Static frames from the dev-router show the Placeholders tab filling the pane on desktop and inside the mobile push.

## Completion checks

- [x] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [x] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
- [x] No export-shape change; say so in the response.
- [x] Add the In-Progress changelog entry, update the code graph, and complete the shared-code side-effect scan.
