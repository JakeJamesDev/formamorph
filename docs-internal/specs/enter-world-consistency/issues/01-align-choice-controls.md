# 01: Align Enter World Choice Controls

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: GPT-5.6 Luna (`gpt-5.6-luna`)
Reasoning effort: high

## Parent

[Enter World consistency spec](../spec.md).

## What to build

Players configure traits and starting location with consistent shared controls, semantic surfaces, and functional headings while keeping the existing Enter World selection and continuation behavior.

Model rationale: bounded presentation work using established components, with existing behavior tests to protect subtle optional-choice semantics.

## Acceptance criteria

- [ ] Use shared checkbox styling and consistent exclusive-choice styling, including legible selected, unselected, disabled, hover, and keyboard-focus states.
- [ ] Preserve optional exclusive-choice deselection: activating the selected optional choice clears it, and choosing another selects only that choice. Preserve ratios and trait/location effects.
- [ ] Apply semantic surfaces, typography roles, and functional heading capitalization from the Design System and Writing Guide. Preserve authored content's voice and avoid unsupported writing-compliance claims.
- [ ] Keep the existing category hierarchy, Introduction access, Cancel, and primary continuation action. Preserve current setup through Introduction and existing Avatar/no-Avatar paths.
- [ ] Verify keyboard interaction and realistic long text at desktop and phone sizes; controls remain readable and the continuation action stays reachable.
- [ ] Verify dark/light appearance and representative alternate palette/font inheritance.
- [ ] Extend the existing workspace component tests for observable choice behavior and preserve the existing real Enter World browser regressions. Prove relevant selection guards fail when the defect returns.
- [ ] Complete applicable project gates and UI evidence, reporting elapsed test time. Do not alter persistence, exports, game finalization, or prototype comparison controls.

## Coordination

This ticket can start independently of 02. Coordinate edits to the shared workspace so parallel work does not overwrite either slice. Its scope is choice controls outside the library rows; 02 owns library row/detail styling.
