# 02: Enable Prompt Palette Dragging Through Shared Behavior

Status: ready-for-human
Status note: Implemented and reviewed; all four gates and the complete browser contract pass. Proceeding from ticket 01 was explicitly authorized.
Base: 205383d9b5b394a298581042dda33aa16b6f86dc
Blocked by: 01
Recommended model: GPT-6 Astra (`gpt-6-astra`)
Reasoning effort: high

## Parent

[Unify Placeholder and Prompt Chip Drag and Drop](../spec.md)

## What to build

Prompt authors can drag a variable from the Settings → Prompts toolbar into an eligible text field, just as world authors drag a Placeholder Chip from the World Editor palette. Both screens use the shared interaction delivered by ticket 01, including feedback, targeting, cancellation, and history. The same browser checks prove that later fixes reach both screens.

Enable the prompt toolbar through the shared palette-source and receiving-vocabulary contracts. Preserve the toolbar's existing click alternative and field scope. Remove superseded screen-specific interaction code as part of this integration, while retaining legitimate layout and content differences.

## Acceptance criteria

- [x] A prompt palette drag inserts one placement into the actual eligible destination, including an unfocused and an empty editor. The palette remains reusable, and dragging does not also commit a click insertion.
- [x] Click insertion still uses the intended field and caret. Shared registration preserves World Editor palette-to-many-fields behavior and prompt toolbar-to-own-field behavior without accepting a different token family or enabling new transfer destinations.
- [x] Both screens use the same source lifecycle, transfer, insertion indicator, drag appearance, target eligibility, drop dispatch, and cleanup. Screen adapters supply capabilities and content rather than independent implementations of these behaviors.
- [x] Existing placements move to the start, middle, and end of text, including wrapped text, without leaving a copy behind. Palette insertion and placed-chip movement remain distinct operations.
- [x] Cancellation, outside and unsupported drops, and returning to the original position preserve content appropriately and clear feedback. The following gesture starts independently.
- [x] Undo/redo restore insertion and movement states. Saved or reopened content contains exactly the committed placements and surrounding text.
- [x] Placeholder moves retain identity, World or Unique mode, reference, and path. Palette insertion retains fresh-placement rules, ownership, scope, and cycle restrictions.
- [x] Prompt moves retain content/detail/format selections and byte-exact affix whitespace. Persona's highlight, pill, and conditional text move as one placement; an absent Persona still omits the conditional section from generated output. Chip options and typing in affix inputs remain functional.
- [x] Read-only fields and Preview cannot be changed through the shared drop path. Normal selection, typing, focus, and existing keyboard/mobile click-insertion alternatives remain usable.
- [x] Production-backed showcase examples and the design guide describe the shared behavior and use the production implementation. Keep the approved highlight-only appearance and existing Preview tint.

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

- [x] Adapters only handle routing, fixtures, and selectors. Browser gestures determine the caret; tests do not invent a drop range or call handlers as proof of dragging.
- [x] Use component and codec tests for content rules that do not need geometry. Verify actual focus and the destination of subsequent typing where relevant.
- [x] Measure changed-module coverage and time every test run. Reintroduce each guarded defect or divergence, confirm the intended guard fails, then restore the code. Keep real mechanics and meaningful fixtures intact.
- [x] Pass typecheck, lint, the standard test suite, build, and the complete focused browser contract. Update the code graph and the In Progress changelog entry for the completed unification.

## Boundaries

This ticket completes unification, not the later UX redesign. Preserve the World Editor baseline and supported destinations characterized in ticket 01. Record independently reproduced remaining flaws; surface any flaw that blocks core integrity before expanding scope.

Do not change exports, storage shapes, versions, migrations, prompt text, placeholder resolution, chip data models, palette grouping, or layouts. Do not add cross-editor moves, cross-family insertion, new touch or keyboard-drag systems, activation thresholds, auto-scroll, or new drop previews. Unrelated sortable lists, trees, library tiles, and the Locations Canvas stay outside this work.

## Implementation Evidence

- Prompt toolbars bind the shared palette source to their editor registration. The receiver checks that scope and the offered vocabulary before inserting. World palettes retain their shared destinations.
- The reusable browser contract now exercises both real screens for palette insertion, movement, cancellation, history, persistence, Preview, wrapped text, fullscreen, focus, and both themes. Content tests preserve Placeholder identity/path/mode and exact prompt variants/affixes.
- Crossing between fields reproduced stale insertion feedback; the shared handler now clears it. Layout limitations remain recorded in [the baseline](../baseline.md).
- The production showcase adds shared Placeholder editors alongside the existing conditional-Persona example. Copy review found no new issues; existing PromptField notices were outside this change.

| Check | Result | Wall time |
| --- | --- | --- |
| Typecheck | Exit 0 | 18.4 s |
| Lint | Exit 0; one existing WorldOverviewManager Fast Refresh warning | 20.9 s |
| Standard `npm run test` | Exit 0; 12,157 passed, 3 skipped | 106.9 s |
| Production build | Exit 0; existing chunk-size warning | 19.9 s |
| Final browser contract | 38 passed; 34 native-drag mobile cases skipped | 183.1 s |
| Prompt/vocabulary component coverage run | 451 passed | 16.9 s |

The browser run uses the repository's desktop and mobile projects with only its app server enabled; unrelated website servers are omitted. Native drag checks run on desktop; existing tap insertion runs on mobile. Native gestures determine the caret. Narrow fullscreen and both themes are checked with static DOM geometry and screenshots.

| Changed module | Line coverage | Branch coverage |
| --- | --- | --- |
| chipDragSource | 100% | 92.85% |
| ChipDrag | 94% | 80.48% |
| ChipInsertTarget | 77.88% | 88.23% |
| PromptField | 91.91% | 87.16% |
| chipVocabulary | 98.37% | 90.70% |
| PromptChipsReference | 0% in component run; exercised by browser contract | 0% in component run |

Eight isolated mutations each failed the intended guard: editor scope (3.18 s), required scope (3.20 s), offered vocabulary (2.26 s), known family (3.25 s), source binding (4.22 s), draggable source (17.46 s), receiving vocabulary (17.86 s), and cross-field feedback cleanup (17.49 s). Sources were restored byte-for-byte before the final passing runs.

The unrestricted standard-suite timeout recorded for ticket 01 did not recur in this run. No export shapes, versions, defaults, prompt wording, or persistence formats changed.

### Closing Review

- Standards: one minor ticket-metadata ordering finding, corrected. No implementation findings.
- Spec: added direct cross-field targeting and existing keyboard/touch insertion checks through both production screens. Settings uses its toolbar; World fullscreen uses its existing typeahead. No new input systems were added.
- The code graph update completed (14,356 nodes, 43,288 edges). Its preexisting Gradle parse warnings do not concern these TypeScript changes.

Three additional mutations failed the new assertions: requiring destination focus (16.96 s), removing toolbar click insertion on desktop/mobile (29.56 s), and removing typeahead insertion on desktop/mobile (27.83 s). Each source was restored exactly. Repeated typecheck passed in 22.2 s; the added browser-test lint check passed in 2.4 s.

The initial supplemental browser run passed four cases and skipped one native-drag mobile case in 40.4 s, but the Settings mobile setup clicked a chip instead of editable prose. A fullscreen-only adjustment still failed that setup in 23.6 s. Clicking measured prose coordinates fixed the setup; both Settings keyboard/touch cases then passed in 19.2 s. Assertions and the real mobile layout stayed intact.

## Model rationale

GPT-6 Astra with high reasoning is recommended for integrating native browser gestures with editor targeting and history, then proving parity across two real screens with different content rules. The additional reasoning capacity is useful for tracing failures across browser geometry, state, and persistence. [Model reference](https://developers.openai.com/api/docs/models/gpt-6-astra).
