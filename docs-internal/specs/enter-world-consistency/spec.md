# Enter World — consistent lists, responsive details, and motion

Status: ready-for-agent

## Problem Statement

The redesigned Enter World workspace needs consistent choice controls and a more readable way to inspect library additions. Separate dictionary selection and ordering make the player manage the same items in different places. Keeping Categories, a list, and details alongside each other also leaves too little horizontal space in portrait layouts.

Players need familiar World Editor rows, clear inclusion states, readable details, themed scrolling, and reliable navigation animations. The prototype exposed an entry defect: details could flash into view instead of sliding, especially when switching to a different item. Reaching the correct final screen is insufficient.

## Solution

Adopt variant C's composition for Enter World. Use the World Editor's compact rows for entities and a single ordered dictionary list. Inspecting an item and including it in the game are independent actions. Full names, descriptions, artwork, inclusion controls, and dictionary ordering actions belong in details.

Adapt to available container width in three stages: Categories beside a split list/detail workspace; collapsed Categories above split panes; then collapsed Categories above a full-width list or detail pane with Back. Preserve the current draft while the layout changes.

Use shared themed scrolling and the World Editor's 200ms detail-entry/exit treatment. Every opening must show a continuous transition, including the first item and every different-item selection. Respect reduced motion and preserve keyboard focus without scrolling the animation container.

## User Stories

1. As a player, I want familiar choice controls, so that I understand how to configure my game.
2. As a player, I want selected and disabled states to remain legible, so that I can distinguish my choices in every theme.
3. As a player, I want entities presented in compact editor-style rows, so that I can scan the available additions.
4. As a player, I want one ordered dictionary list, so that inclusion and order stay visible together.
5. As a player, I want dictionary source labels, so that I can distinguish world content from library additions.
6. As a player, I want to inspect a row without changing inclusion, so that reading details does not alter my game.
7. As a player, I want a checkbox to change inclusion without switching the inspected item, so that selection remains predictable.
8. As a player, I want inclusion changes synchronized between rows and details, so that both views tell me the same thing.
9. As a player, I want full names and descriptions in details, so that compact row truncation does not hide necessary information.
10. As a player, I want artwork and missing-art fallbacks, so that additions remain recognizable with incomplete metadata.
11. As a player, I want search to filter additions without clearing choices, so that finding an item does not undo setup.
12. As a player, I want dictionary drag ordering, so that I can arrange narrator input directly.
13. As a keyboard or touch user, I want Move Up and Move Down actions, so that ordering does not require dragging.
14. As a player, I want disabled dictionaries to retain their place, so that enabling one restores it at the expected position.
15. As a player on a wide screen, I want Categories, rows, and details visible together, so that I can compare and navigate efficiently.
16. As a player in portrait, I want Categories to collapse before content becomes cramped, so that the list and details stay readable.
17. As a player in a narrow workspace, I want full-width details and Back, so that reading does not require horizontal scrolling.
18. As a player resizing the workspace, I want my draft, search, and inspected item retained, so that resizing does not restart setup.
19. As a player returning from details, I want my list position restored, so that I can continue where I left off.
20. As a keyboard user, I want focus to enter details and return to the inspected name, so that navigation remains understandable.
21. As an assistive-technology user, I want inactive panes excluded from navigation, so that offscreen controls do not interrupt the flow.
22. As a player, I want first entry and every subsequent item switch to animate without a blank interval, so that navigation feels continuous.
23. As a player reopening the same item, I want the same entry behavior as opening a different one, so that navigation is consistent.
24. As a player who prefers reduced motion, I want transitions skipped while navigation still works, so that the flow respects my preference.
25. As a player using a custom palette or font, I want rows, details, and scrollbars to inherit it, so that Enter World belongs to the rest of the app.
26. As a player, I want Introduction, Cancel, and the primary continuation action to remain reachable, so that I can finish or leave from any category.
27. As a player, I want the existing trait, location, Avatar, and saved-addition behavior preserved, so that this UI change does not change my game setup contracts.

## Implementation Decisions

- This is a follow-up to the existing Enter World redesign. Retain its category hierarchy, ratios, optional exclusive-choice deselection, Introduction access, explicit saved-additions behavior, and stable primary footer action. Consistency work includes shared checkbox styling, semantic surfaces, functional heading capitalization, and explicit dictionary enabled state.
- Reuse production `EditorRow`, `EditorRowList`, and `ScrollArea`. World Editor rows are the agreed reference for this surface; this does not declare a universal list standard or authorize unrelated editor changes.
- Keep Entities and Dictionaries as distinct sections. Combine world and library dictionaries into one ordered list with source metadata. Keep source-qualified identity so identical underlying IDs do not collide.
- Maintain inspection separately from inclusion and single-pane visibility. Back closes details without clearing the inspected identity. Resizing changes presentation, not domain choices.
- Preserve inclusion, order, search, inspected identity, and surviving scroll positions across width transitions. Opening and returning from a single-pane detail must preserve list scroll. Normal browser clamping when a larger pane no longer overflows is acceptable.
- Filter presentation only. Reordering filtered dictionaries changes the visible items' relative positions while retaining hidden items in their existing slots. Move Up/Down operates on the complete dictionary order and exposes boundary-disabled actions.
- Use container width, not orientation or device identity, to choose layout. C's starting thresholds are 72rem of dialog width for the Categories sidebar and 44rem of library width for split panes. Keep layout and navigation behavior driven by the same threshold decisions. Verify around both boundaries with long text and supported fonts.
- Each library pane owns a bounded shared scroll viewport with the themed thumb and its content gutter. Keep the header, Categories control, and continuation action reachable outside library scrolling.
- On narrow layouts, details slide in from the right over the list; the list shifts left by one quarter of its width. Back reverses this over 200ms. Retain both pane instances and an opaque detail surface; inactive panes are inert and excluded from accessibility navigation.
- Focus the detail heading on entry and restore focus to the opener on Back without browser auto-scrolling. Provide a sensible visible fallback if the original opener no longer exists.
- Prepare replacement content offscreen before beginning entry. The prototype separates content replacement from opening across rendering frames. Production may use an equivalent approach that proves continuous visible motion; it must cancel pending work on replacement or unmount and must not introduce a fixed artificial delay.
- Preserve the shared drag infrastructure and its established invariants: stable sortable identities, translation without scale, and shared drag interaction behavior. Keep application-specific ordering semantics in Enter World.
- Integrate into the existing production workspace and draft owner. No new persistence schema, API, export shape, or game-finalization contract is needed. Prototype callbacks and sample data are not production implementations.

## Testing Decisions

- The user confirmed two existing boundaries: the real Enter World browser flow as the primary boundary, supplemented by workspace component tests for selection and ordering. Reuse these rather than adding a new lower-level testing interface.
- Extend the existing stateful workspace harness to verify independent inspection/inclusion, synchronized detail and row choices, source-ID collisions, filtered ordering, disabled items, boundary actions, and preservation of existing trait/location behavior. Assert user-observable outcomes rather than internal state setters or component structure.
- Extend the existing Enter World browser scenario to exercise the production flow at wide, portrait-tablet, and phone sizes, plus both sides of the container thresholds. Prior art includes the existing World Editor drag tests and shared frame-sampling utilities.
- Cover first opening, Back, reopening the same item, switching to another dictionary, and switching between an entity and dictionary. Repeat switches in both directions, including different content heights, long descriptions, missing artwork, and loaded artwork.
- Verify intermediate visible frames, not just computed transition duration, transforms, or the final screen. Capture the visible pane during entry and exit; fail on a blank interval or an immediate replacement without the required movement. Pair motion evidence with content visibility and focus/scroll evidence. The prototype's successful position traces did not disprove the user's visible-flash report.
- Verify Back retains list scroll and returns focus; hidden controls cannot receive keyboard input; focus does not scroll the animation container. Exercise pending entry cancellation and resizing during navigation.
- Verify inclusion, dictionary order, search, and inspected identity survive resizing, and that no horizontal page overflow or inaccessible footer appears. Use actual scrolling content rather than shortening fixtures to avoid overflow.
- Check dark and light themes, a representative alternate palette/font, and reduced motion in a real browser. Reduced motion must keep the same navigation and accessibility outcomes without sliding.
- Retain the existing draft/finalization regression coverage. This UI must pass the same real selection/order data into game entry and explicit saved-additions actions.
- Prove the relevant guards fail when the defect is reinstated. Do not alter fixtures to suppress the trigger. Time every test run and report wall time. Static checks and prototype screenshots do not establish production behavior.

## Out of Scope

- A new app-wide list standard or broad World Editor redesign.
- Changes to Avatar customization, gameplay UI, Introduction content, Quick Start, or save loading.
- New library synchronization, dependencies, defaults schema, or persistence semantics.
- Shipping variant controls, sample content, tracing, or prototype-only routes as player UI.
- Implementation ticket decomposition, release changes, or production implementation during this spec-writing task.

## Further Notes

- This spec supersedes the earlier Enter World spec's exclusion of dedicated portrait-tablet optimization for this workspace. Other existing contracts remain authoritative.
- Reference: variant C on branch `prototype/enter-world-consistency`, captured at commit `c2dd648a`. Run `npm run prototype:enter-world` in that worktree and open [C](http://127.0.0.1:5181/?variant=C#dev?modal=enterWorld).
- The prototype branch contains the iteration record and captures under `docs-internal/specs/enter-world/consistency-prototype.md`. [Original Enter World spec](../enter-world/spec.md) supplies unchanged draft, persistence, and finalization contracts.
- The latest staging change is the candidate entry treatment. The request to specify these changes selects the direction; it does not replace production verification of the different-item animation defect.
- Follow the repository Design System and design-authority ADR. Use the Writing Guide for functional labels and accessible names. Historical prototype writing and reduced-motion checks were incomplete; do not carry forward an unsupported compliance claim.
