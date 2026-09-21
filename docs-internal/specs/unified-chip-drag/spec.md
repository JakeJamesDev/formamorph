# Spec: Unify Placeholder and Prompt Chip Drag and Drop

Status: ready-for-agent
Status note: Unification only; the author confirmed shared browser checks through both real screens.
Spec session: 01a0c120-20d3-73b3-b469-3c0269c75b6b

## Problem Statement

Dragging Placeholder Chips in the World Editor feels better than dragging prompt-variable chips in Settings → Prompts. Both interactions have UX issues, but fixing them independently would create two versions of the same behavior and let later improvements drift between screens.

The immediate task is unification. The author wants the World Editor interaction to be the starting point for both surfaces, then wants to identify and improve the remaining issues once there is one shared implementation.

The current code already shares the editor node and in-field drop handler. The difference is partly outside that handler: the World Editor has a draggable placeholder palette and shared field targeting, while the Settings prompt toolbar provides click-to-insert and does not enable the same palette-drop path. Treat this as consolidation of the whole interaction, rather than replacement of two independent editors.

## Solution

Provide one chip insertion and movement interaction for World Editor text fields and Settings → Prompts. Authors can drag from the palette into an eligible field, reposition an existing chip, and use the existing click-to-insert alternative. Feedback and drag lifecycle come from shared code, with the World Editor's current interaction as the baseline.

Preserve the differences that describe content rather than gestures. A Placeholder Chip keeps its identity, World or Unique mode, and reference to its Placeholder. A prompt-variable chip keeps its selected detail, format, and conditional prepend/append text. Sharing the interaction does not make those content types interchangeable.

After this consolidation, later UX fixes must change the common implementation and pass the same interaction checks on both screens.

## User Stories

1. As a world author, I want Placeholder Chips to retain their familiar drag interaction, so that consolidation does not make the World Editor harder to use.
2. As a prompt author, I want to drag chips from the prompt toolbar into the editor, so that inserting a prompt variable works like inserting a Placeholder Chip.
3. As an author, I want to drop a palette chip into an eligible field without first clicking that field, so that dragging itself identifies the destination.
4. As an author, I want click-to-insert to remain available, so that dragging is optional.
5. As an author, I want clicking an insertion control to preserve the intended text position, so that a chip enters the field where I was editing.
6. As an author, I want a palette drag to create one placement while leaving the palette available, so that I can reuse the same chip source.
7. As an author, I want dragging an existing placement to move it, so that rearranging text does not create another copy.
8. As an author, I want the dragged chip to have consistent visual feedback on both screens, so that I can recognize the same interaction.
9. As an author, I want the insertion indicator to follow the same rules on both screens, so that I can interpret the intended drop position consistently.
10. As an author, I want to insert chips at the start, middle, or end of text, so that layout does not dictate where dynamic content can go.
11. As an author, I want empty fields and wrapped text to remain usable drop targets, so that the interaction works with ordinary documents.
12. As an author, I want to cancel a drag without losing the original placement, so that exploring a destination is reversible.
13. As an author, I want an unsupported or outside drop to leave my authored content intact, so that a missed drop does not damage it.
14. As an author, I want drag feedback to clear when the gesture ends, so that the next interaction starts from a clean state.
15. As an author, I want undo and redo to operate on the resulting insertion or move, so that I can recover through the editor's existing history.
16. As a world author, I want a moved Placeholder Chip to keep its placement identity and World or Unique mode, so that rearranging text does not change which Roll it uses.
17. As a world author, I want newly inserted Placeholder Chips to follow the existing placement-creation rules, so that separate placements remain distinct where required.
18. As a world author, I want placeholder ownership, scope, and existing insertion restrictions preserved, so that unification does not change which references my fields can use.
19. As a prompt author, I want an affixed chip to move with its complete conditional text, so that a heading cannot be separated from the value that controls it.
20. As a prompt author, I want detail and format selections to survive a move, so that rearranging the prompt does not change the requested content.
21. As an author, I want read-only fields and Preview to retain their protection from edits, so that drag support does not bypass those states.
22. As an author, I want saved or reopened content to contain exactly the placements I committed, so that a successful drag is not merely a visual change.
23. As a mobile or keyboard user, I want the existing insertion alternatives and editing behavior preserved, so that consolidating pointer dragging does not remove my way to edit.
24. As a maintainer, I want one shared interaction suite exercised against both surfaces, so that a later fix cannot quietly reach only one of them.
25. As a maintainer, I want content-specific behavior expressed through the existing chip vocabulary, so that new chip families do not require copies of the drag implementation.

## Implementation Decisions

- **Scope the common interaction to chips in authored text.** Include palette sources, existing placements, and eligible text-field destinations. Sortable placeholder lists, entity lists, trees, library tiles, and the Locations Canvas are different interactions.
- **Consolidate existing modules.** Reuse the shared chip node, chip drag plugin, editor history, and chip vocabulary. Bring the prompt variable toolbar and placeholder palette onto shared insertion and drag-source behavior. Keep their legitimate layout and content differences.
- **Use the World Editor baseline.** Characterize its current palette-to-field and in-field interactions before changing them. Bring Settings → Prompts to that baseline; do not replace the better interaction with the smaller Settings implementation.
- **Own the gesture lifecycle in one place.** Shared code controls source setup, payload transfer, drag feedback, insertion indicators, drop dispatch, and cleanup. Callers supply content and destination capabilities rather than copied handlers or screen-name branches.
- **Keep copy and move distinct.** Palette insertion creates a placement through the receiving vocabulary's existing insertion contract. Moving an existing placement preserves its data and identity. A drag must not also trigger an unintended click insertion.
- **Keep target selection shared but correctly scoped.** The World Editor can offer one palette for several fields; a prompt toolbar can target its own editor. This difference belongs in target registration, not separate insertion implementations. A drop selects its actual eligible destination independently of the remembered click target.
- **Preserve content boundaries.** Placeholder references, placement identity, World/Unique behavior, ownership and existing restrictions stay with the placeholder vocabulary. Prompt-variable variants and affixes stay with the prompt vocabulary. Do not make a field accept another token family merely because the transfer mechanism is shared.
- **Preserve the complete prompt placement.** Its highlight, pill, and conditional prepend/append text remain one movable unit. Use the existing Preview tint and preserve the affix-input focus fix. Do not reopen the chosen highlight-only design.
- **Retain existing editor contracts.** Keep read-only and Preview restrictions, click insertion, normal text selection, chip options, undo/redo, and existing mobile/fullscreen behavior. The source document changes only through the existing editor mutation and serialization paths.
- **Do not force text dragging through sortable-list mechanics.** The accepted shared-drag architecture establishes the principle of one owner for interaction invariants. Its list collision, clamping, and hover rules are not automatically appropriate for caret-based text insertion. Reuse only compatible foundations; no drag-library migration is required.
- **Avoid speculative gesture expansion.** Do not add cross-editor moves, cross-family insertion, new touch activation rules, or a new keyboard-drag system. Preserve any currently supported same-family destination behavior established during characterization.
- **Preserve storage and output.** No export-shape changes, migrations, version changes, prompt wording changes, or changes to placeholder resolution. Untouched text round-trips identically; deliberate moves change placement order only.
- **Make future drift visible.** Both production surfaces use the shared interaction, and their production-backed showcase examples reference that implementation. Later fixes belong there and in the common behavior tests.

## Testing Decisions

**Confirmed primary boundary:** one reusable browser interaction contract executed through the real World Editor and real Settings → Prompts. Small setup adapters may choose the route, seed ordinary local content, and identify the palette and field. They must not implement insertion, movement, hit testing, or serialization themselves. The author selected both real screens rather than a shared editor fixture with screen smoke checks.

**Test externally visible behavior.** Drive real pointer gestures and normal editor controls; assert the visible destination and committed authored content. Inspect static DOM geometry and computed styles where feedback matters. Do not infer correct drag behavior from a handler call, a simulated drop with an invented caret range, or a final screenshot alone.

| Area | Required evidence |
| --- | --- |
| Palette insertion | Both surfaces accept a drag into an eligible field, including an unfocused and an empty field; one gesture creates one placement. |
| Click alternative | Insertion retains its intended target and caret; beginning a drag does not commit an extra click insertion. |
| Movement | A placement moves before, between, and after surrounding text; the original is not left behind. |
| Feedback | Equivalent gestures use the shared drag appearance and insertion indicator in realistic, wrapped text. |
| Ending a gesture | Cancellation, outside drops, and a return to the original position preserve content appropriately and clear feedback. A subsequent gesture is independent. |
| History and persistence | Undo/redo restore the document state; reopen or reload retains the committed result. |
| Placeholder fidelity | A move preserves placement identity, mode, and reference; insertion follows existing fresh-placement rules and restrictions. |
| Prompt fidelity | A move preserves variants and exact affix whitespace; empty Persona still omits the conditional section from generated output. |
| Protected states | Read-only fields and Preview cannot be edited through the shared drop path. |
| Layout and input | Desktop, narrow/fullscreen layouts, both themes where feedback colors apply, and existing keyboard/mobile insertion alternatives remain usable. |

**Existing seams and prior art:** the production PromptField and ChipInput hosts, the shared chip drag plugin, the placeholder palette's insertion-target tests, prompt editor serialization and affix-editing tests, and the app's Playwright dev-router setup. Existing editor-list drag tests demonstrate real-browser geometry checks; use their testing approach without treating list displacement as a text-caret contract. The open-value editing browser tests demonstrate checking actual focus and the destination of the next keystroke.

Keep component and codec tests for content rules that do not require geometry. Prefer extending the existing tests over exposing new low-level production APIs for testing. Browser setup may create a local world or duplicate a built-in preset, but must exercise production editing paths afterward.

Measure changed-module coverage and time every test run. Reintroduce the defect or divergence protected by each new guard and confirm that the intended test fails, then restore the code. Run the standard typecheck, lint, test, and build gates, plus the focused browser contract. Update the graph and changelog when implementation ships.

**Existing flaws are not blanket authorization to redesign.** Record independently reproduced baseline issues with their screen, gesture, expected result, and actual result for the later UX pass. Do not hide them by simplifying fixtures or weakening tests. If an issue prevents the shared interaction from meeting the core integrity requirements above, surface that dependency before expanding implementation scope. Unification is complete when both surfaces use the common behavior and the agreed checks pass, not when every possible drag UX improvement has shipped.

## Out of Scope

- The subsequent UX improvement pass: new drop previews, altered spacing, new activation thresholds, new auto-scroll behavior, or other as-yet-undescribed interaction changes.
- Reordering Placeholder definitions or values as list items, editor trees, library tiles, and unrelated drag systems.
- Redesigning the World Editor or Settings layouts, palette grouping, chip appearance, or the approved affix highlight.
- Unifying placeholder and prompt-variable data models, resolution rules, or available options.
- New cross-editor or cross-family transfer behavior, copying linked content between worlds, or changing imports and exports.
- New touch or keyboard-drag features beyond preserving the existing alternatives and supported behavior.
- Prompt text changes, model probes, gameplay behavior, version changes, and migrations.
- Implementing this spec or generating implementation tickets as part of the current spec-writing task.

## Further Notes

This spec records the sequence settled in the discussion: use the World Editor interaction as the starting point, consolidate it with prompt-chip dragging, then improve the remaining issues through the shared implementation. The author has not yet enumerated those later issues; they are deliberately not invented here.

The Persona highlight work exposed the difference but does not limit the shared interaction to Persona. The implementation must cover the supported prompt-variable and Placeholder Chip families.

The existing shared editor-drag decision applies as an architectural principle, while its sortable-list mechanics remain outside this scope. The repository design-authority decision still applies: production components and their showcase are the reference, and a genuinely new visual treatment needs a separate decision.
