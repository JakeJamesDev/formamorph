# 02: Enable Prompt Palette Dragging Through Shared Behavior

Status: ready-for-agent
Blocked by: 01
Recommended model: GPT-6 Astra (`gpt-6-astra`)
Reasoning effort: high

## Parent

[Unify Placeholder and Prompt Chip Drag and Drop](../spec.md)

## What to build

Prompt authors can drag a variable from the Settings → Prompts toolbar into an eligible text field, just as world authors drag a Placeholder Chip from the World Editor palette. Both screens use the shared interaction delivered by ticket 01, including feedback, targeting, cancellation, and history. The same browser checks prove that later fixes reach both screens.

Enable the prompt toolbar through the shared palette-source and receiving-vocabulary contracts. Preserve the toolbar's existing click alternative and field scope. Remove superseded screen-specific interaction code as part of this integration, while retaining legitimate layout and content differences.

## Acceptance criteria

- [ ] A prompt palette drag inserts one placement into the actual eligible destination, including an unfocused and an empty editor. The palette remains reusable, and dragging does not also commit a click insertion.
- [ ] Click insertion still uses the intended field and caret. Shared registration preserves World Editor palette-to-many-fields behavior and prompt toolbar-to-own-field behavior without accepting a different token family or enabling new transfer destinations.
- [ ] Both screens use the same source lifecycle, transfer, insertion indicator, drag appearance, target eligibility, drop dispatch, and cleanup. Screen adapters supply capabilities and content rather than independent implementations of these behaviors.
- [ ] Existing placements move to the start, middle, and end of text, including wrapped text, without leaving a copy behind. Palette insertion and placed-chip movement remain distinct operations.
- [ ] Cancellation, outside and unsupported drops, and returning to the original position preserve content appropriately and clear feedback. The following gesture starts independently.
- [ ] Undo/redo restore insertion and movement states. Saved or reopened content contains exactly the committed placements and surrounding text.
- [ ] Placeholder moves retain identity, World or Unique mode, reference, and path. Palette insertion retains fresh-placement rules, ownership, scope, and cycle restrictions.
- [ ] Prompt moves retain content/detail/format selections and byte-exact affix whitespace. Persona's highlight, pill, and conditional text move as one placement; an absent Persona still omits the conditional section from generated output. Chip options and typing in affix inputs remain functional.
- [ ] Read-only fields and Preview cannot be changed through the shared drop path. Normal selection, typing, focus, and existing keyboard/mobile click-insertion alternatives remain usable.
- [ ] Production-backed showcase examples and the design guide describe the shared behavior and use the production implementation. Keep the approved highlight-only appearance and existing Preview tint.

## Verification

Complete the reusable browser contract from ticket 01 against both real screens. The same assertions must cover insertion, movement, cancellation, undo, and content preservation; use small content-specific assertions for the two chip families. A shared fixture with screen smoke checks is insufficient.

| Area | Required evidence on both screens |
| --- | --- |
| Insertion and targeting | Real palette gestures into unfocused and empty fields; one placement per drag; click insertion preserves caret and target. |
| Movement and feedback | Real gestures at start, middle, and end positions in ordinary and wrapped text; static geometry and styles confirm insertion feedback. |
| Ending and recovery | Cancel, outside/unsupported drop, and return to origin; unchanged content where appropriate, cleared feedback, independent next gesture. |
| History and persistence | Normal undo/redo controls and reopen or reload verify authored content, not only the rendered chip. |
| Content boundaries | Placeholder identity/mode/reference/path and restrictions; prompt variants, exact affixes, and empty-Persona omission. |
| Protected states and layouts | Read-only and Preview rejection, desktop and narrow/fullscreen layouts, both applicable themes, and existing input alternatives. |

- [ ] Adapters only handle routing, fixtures, and selectors. Browser gestures determine the caret; tests do not invent a drop range or call handlers as proof of dragging.
- [ ] Use component and codec tests for content rules that do not need geometry. Verify actual focus and the destination of subsequent typing where relevant.
- [ ] Measure changed-module coverage and time every test run. Reintroduce each guarded defect or divergence, confirm the intended guard fails, then restore the code. Keep real mechanics and meaningful fixtures intact.
- [ ] Pass typecheck, lint, the standard test suite, build, and the complete focused browser contract. Update the code graph and the In Progress changelog entry for the completed unification.

## Boundaries

This ticket completes unification, not the later UX redesign. Preserve the World Editor baseline and supported destinations characterized in ticket 01. Record independently reproduced remaining flaws; surface any flaw that blocks core integrity before expanding scope.

Do not change exports, storage shapes, versions, migrations, prompt text, placeholder resolution, chip data models, palette grouping, or layouts. Do not add cross-editor moves, cross-family insertion, new touch or keyboard-drag systems, activation thresholds, auto-scroll, or new drop previews. Unrelated sortable lists, trees, library tiles, and the Locations Canvas stay outside this work.

## Model rationale

GPT-6 Astra with high reasoning is recommended for integrating native browser gestures with editor targeting and history, then proving parity across two real screens with different content rules. The additional reasoning capacity is useful for tracing failures across browser geometry, state, and persistence. [Model reference](https://developers.openai.com/api/docs/models/gpt-6-astra).
