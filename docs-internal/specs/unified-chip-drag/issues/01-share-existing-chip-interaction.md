# 01: Share Existing Chip Insertion and Drag Behavior

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: GPT-5.6 Sol (`gpt-5.6-sol`)
Reasoning effort: high

## Parent

[Unify Placeholder and Prompt Chip Drag and Drop](../spec.md)

## What to build

World authors keep the World Editor's existing palette insertion and chip movement, while prompt authors keep click insertion and in-field movement. These production paths share the interaction foundations needed to fix both screens together. This preparatory refactor must be demonstrable through both real screens before prompt palette dragging is enabled in ticket 02.

Use the World Editor as the baseline. Consolidate the already-shared editor node and drag handler with source setup, insertion targeting, feedback, and cleanup. Keep content rules in the existing chip vocabularies and editor history. Callers register content and destination capabilities; they do not copy gesture handlers or branch on screen names.

## Acceptance criteria

- [ ] Characterize existing World Editor palette insertion and placed-chip movement, plus Settings → Prompts click insertion and placed-chip movement. Record supported same-family destinations and independently reproduced baseline flaws with their screen, gesture, expected result, and actual result.
- [ ] Both real screens use the shared interaction for their existing capabilities. The extracted behavior serves production paths immediately rather than existing only as unused infrastructure.
- [ ] Shared code owns source setup, payload transfer, drag appearance, insertion indicators, drop dispatch, and cleanup. World Editor palette-to-many-fields and prompt toolbar-to-own-field targeting are represented through registration, with click targets distinct from actual drop destinations.
- [ ] World Editor palette dragging creates exactly one fresh placement in the eligible destination, including an unfocused or empty field. Click insertion still respects the intended field and caret; beginning a drag does not leave an extra click insertion behind.
- [ ] Existing placements move before, between, and after text without duplication or loss. A Placeholder Chip retains its placement identity, World or Unique mode, reference, and path; new placements follow existing creation rules. Ownership, scope, and cycle restrictions remain enforced.
- [ ] Prompt movement preserves variants and exact prepend/append whitespace. The highlight, pill, and conditional text stay together, using the approved Preview tint. Chip options and affix-input focus remain usable.
- [ ] Cancellation, unsupported or outside drops, and returning to the original position preserve the document appropriately, clear feedback, and leave the next drag independent.
- [ ] Undo/redo and reopen restore the committed content. Read-only and Preview states reject editing through drag; ordinary selection, typing, and existing keyboard/mobile insertion alternatives still work.

## Verification

Establish one reusable browser interaction contract with thin adapters for the real World Editor and Settings → Prompts. Adapters may route, seed ordinary content, and find controls; they must not implement gestures, hit testing, mutations, or serialization. Exercise the existing shared capabilities on both screens and the current World Editor palette path. Settings palette dragging is explicitly completed in ticket 02, not reported as passing here.

- [ ] Drive real pointer gestures and normal controls, asserting visible placement and committed authored content. Cover empty fields, start/middle/end positions, and wrapped text. Use static DOM geometry and computed styles for feedback; invented caret ranges and direct handler calls are not drag evidence.
- [ ] Verify realistic desktop and narrow/fullscreen layouts, applicable feedback colors in both themes, and existing insertion alternatives. Check the destination of the next keystroke where focus matters.
- [ ] Extend component and codec coverage for content fidelity and restrictions without moving geometry assertions out of the browser contract. Measure changed-module coverage, time every test run, and show each new guard fails when its protected defect or divergence is reintroduced.
- [ ] Pass typecheck, lint, the standard test suite, build, and the focused browser checks. Update the code graph and the In Progress changelog entry for this slice.

## Boundaries and handoff

Ticket 02 consumes this shared source and targeting behavior to enable prompt palette dragging. Preserve both PromptField and ChipInput host contracts where the common code serves them. Production-backed showcase examples must continue to use production components.

Do not introduce new data formats, exports, migrations, prompt wording, resolution behavior, cross-family transfers, cross-editor moves, touch activation, or keyboard-drag features. Preserve supported destinations established during characterization. Sortable-list collision and clamping rules are not a caret-insertion contract; no drag-library migration or unrelated drag refactor is required.

Record baseline UX flaws for the later improvement pass. If a reproduced flaw blocks the core integrity criteria, surface that dependency before expanding scope; do not weaken tests or simplify away the trigger.

## Model rationale

GPT-5.6 Sol with high reasoning is recommended for this bounded refactor of existing production seams and its characterization tests. The work needs careful tracing of editor state and caller contracts; it does not require choosing a new interaction design. [Model reference](https://developers.openai.com/api/docs/models/gpt-5.6-sol).
