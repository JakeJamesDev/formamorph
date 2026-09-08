# 05: Connect the Project Skill and Verify the Complete Workflow

Status: ready-for-human
Blocked by: 01 — Establish STE Writing Guidance; 03 — Add the Markdown Editing Reference; 04 — Add the Community Card Reference
Recommended model: GPT-6 Astra (`gpt-6-astra`)
Reasoning effort: high

**Model rationale:** Integrate cross-session instructions, visual references, STE evidence, and approval boundaries without introducing contradictory sources of authority. This is a workload recommendation, not a ticket-specific benchmark or an automatic model switch. See the [official model catalog](https://developers.openai.com/api/docs/models/all); recheck availability when starting.

## What to Build

A fresh UI task can discover the project design skill, choose an approved pattern, use the real showcase and guide, and produce review evidence or a contextual new-pattern proposal.

## Acceptance Criteria

- [x] Create a discoverable project skill for UI work and prototypes using the supported skill mechanism and applicable skill-authoring guidance; do not edit user-managed agent instructions.
- [x] Direct the workflow through the authoritative guide, applicable pattern, production components, and live verification. Link shared sources rather than duplicating visual values or an independent styling system.
- [x] Integrate the writing guide from 01 into the overall design reference and review all new functional showcase copy by role. Record rule/dictionary evidence and any unresolved compliance limits.
- [x] Preserve the scope boundary: user-authored content and generated stories retain their own voice; existing-screen alignment is planned separately.
- [x] Require agents to verify established patterns themselves; require user approval of new patterns shown in a representative desktop/mobile app context before adoption.
- [x] Demonstrate an established-pattern task and a new-pattern proposal through the skill workflow, with evidence that references are found and the appropriate verification or approval step is reached. Do not implement an unapproved pattern as a demonstration.
- [x] Check the guide and showcase agree across all three approved references, including states, responsive adaptations, theme/font inheritance, component mappings, and copy guidance. Resolve integration gaps within this scope.
- [x] Confirm dev-router access and development-only isolation remain intact. Each preceding ticket's tests remain required; this ticket is not a deferred testing bucket.
- [x] Validate skill and documentation links. If code changes are needed, run all four gates, time tests, and update the knowledge graph; perform final static UI verification across the completed showcase.
- [x] Record the tooling change in the In-Progress changelog and leave the foundation ready for review without redesigning another screen.

## Verification

Walk the two agreed task scenarios from skill discovery to outcome. Review the live complete showcase and STE evidence against the guide; use behavior checks for any integration fixes and avoid tests that simply repeat instruction text.

## Coordination and Scope

02 is a transitive dependency through 03 and 04. This slice makes the complete design workflow usable across sessions; it does not start bulk adoption or authorize new visual patterns.

Follow the confirmed foundation scope: no app-wide redesign, palette replacement, bulk copy rewrite, version bump, or export-shape change.

## Parent

[Design System Foundation spec](../spec.md)

## Comments

### Implementation review — September 7, 2026

- Added the discoverable project `design-system` skill without editing user-managed instructions. The official skill validator passes. An independent skill walkthrough reached established-pattern verification and the new-pattern approval boundary; no unapproved pattern was implemented.
- Connected the guide to all functional-copy roles and the [workflow/copy review](../../../designs/design-system/workflow-review.md). Corrected new showcase labels, explanations, and local status copy. Full STE compliance remains unclaimed: the record names label-grammar and dictionary/technical-term review limits.
- Fixed combined-navigation overflow at phone width. The real browser guard fails when the 8rem column minimum returns (408px content in 390px); restored desktop/mobile checks pass. New labels wrap inside a height-adaptive navigation row.
- Static live verification covered all three references at 1280×844 and 390×844, light/dark, applicable states, and inherited production purple/Lexend styling. This includes ticket 04's missing light-theme evidence. Captures: `.scratch/design-workflow/`; route `#dev?modal=designSystem`.
- Gates: typecheck exit 0 (13.63 s), lint exit 0 (10.59 s), full tests exit 0 (8,521 passed, 3 skipped; 57.83 s), build exit 0 (14.84 s). The first full test run took 54.49 s and failed three child-process launches with sandbox EPERM; an unrestricted rerun passed. Aggregate test time was 326.73 s across workers versus 57.83 s wall time; no idle-tail gap was demonstrated.
- Focused coverage: 31 tests passed in 6.51 s; showcase statements/lines 100%, branches 85%, functions 75%. Browser runs: initial red 1.84 s, stale-server red 1.79 s, first green 8.01 s, mutation red 1.87 s, restored desktop/mobile green 3.58 s. Final static behavior checks additionally exercised valid context input, local Unlike completion, and update focus.
- Both review axes completed. Corrected the standards findings (bold changelog lead, missing evidence artifact, stale inventory text). The spec reviewer confirmed source discovery and approval routing. A proposed changelog fold referred to an entry inside released history; this ticket adds only to In Progress.
- All 40 local links across the skill, visual guide, writing guide, and review record resolve. Production output contains none of the showcase component/fixture markers. Graph update completed (10,866 nodes); parser warnings include existing Gradle files and another task's in-progress Enter World test.
- No version, defaults, world/save export shape, or other screen design changed in this ticket. The user approved a combined 04/05 commit on September 8, 2026. The combined changelog entry stays in In Progress; the preceding card edit to released history was restored before committing.

### Pre-commit verification — September 8, 2026

After the other tasks' commits landed, the current checkout passed typecheck (13.25 s), lint (12.31 s), the full suite (8,573 passed, 3 skipped; 54.68 s), and production build (16.34 s), all exit 0. The suite's aggregate test execution was 340.36 s across workers; its 54.68 s wall time did not demonstrate an idle tail. Only the approved design-system 04/05 files enter the combined commit.
