# 05: Connect the Project Skill and Verify the Complete Workflow

Status: ready-for-agent
Blocked by: 01 — Establish STE Writing Guidance; 03 — Add the Markdown Editing Reference; 04 — Add the Community Card Reference
Recommended model: GPT-6 Astra (`gpt-6-astra`)
Reasoning effort: high

**Model rationale:** Integrate cross-session instructions, visual references, STE evidence, and approval boundaries without introducing contradictory sources of authority. This is a workload recommendation, not a ticket-specific benchmark or an automatic model switch. See the [official model catalog](https://developers.openai.com/api/docs/models/all); recheck availability when starting.

## What to Build

A fresh UI task can discover the project design skill, choose an approved pattern, use the real showcase and guide, and produce review evidence or a contextual new-pattern proposal.

## Acceptance Criteria

- [ ] Create a discoverable project skill for UI work and prototypes using the supported skill mechanism and applicable skill-authoring guidance; do not edit user-managed agent instructions.
- [ ] Direct the workflow through the authoritative guide, applicable pattern, production components, and live verification. Link shared sources rather than duplicating visual values or an independent styling system.
- [ ] Integrate the writing guide from 01 into the overall design reference and review all new functional showcase copy by role. Record rule/dictionary evidence and any unresolved compliance limits.
- [ ] Preserve the scope boundary: user-authored content and generated stories retain their own voice; existing-screen alignment is planned separately.
- [ ] Require agents to verify established patterns themselves; require user approval of new patterns shown in a representative desktop/mobile app context before adoption.
- [ ] Demonstrate an established-pattern task and a new-pattern proposal through the skill workflow, with evidence that references are found and the appropriate verification or approval step is reached. Do not implement an unapproved pattern as a demonstration.
- [ ] Check the guide and showcase agree across all three approved references, including states, responsive adaptations, theme/font inheritance, component mappings, and copy guidance. Resolve integration gaps within this scope.
- [ ] Confirm dev-router access and development-only isolation remain intact. Each preceding ticket's tests remain required; this ticket is not a deferred testing bucket.
- [ ] Validate skill and documentation links. If code changes are needed, run all four gates, time tests, and update the knowledge graph; perform final static UI verification across the completed showcase.
- [ ] Record the tooling change in the In-Progress changelog and leave the foundation ready for review without redesigning another screen.

## Verification

Walk the two agreed task scenarios from skill discovery to outcome. Review the live complete showcase and STE evidence against the guide; use behavior checks for any integration fixes and avoid tests that simply repeat instruction text.

## Coordination and Scope

02 is a transitive dependency through 03 and 04. This slice makes the complete design workflow usable across sessions; it does not start bulk adoption or authorize new visual patterns.

Follow the confirmed foundation scope: no app-wide redesign, palette replacement, bulk copy rewrite, version bump, or export-shape change.

## Parent

[Design System Foundation spec](../spec.md)
