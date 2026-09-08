# Formamorph Design Standards Additions

Status: ready-for-agent
Status note: The user approved the revised tile menu and group picker and requested this specification. Implementation is a follow-up.

## Problem Statement

The design-system foundation and its reference extensions are complete from the agents' perspective, but review exposed gaps in the rules. The context-menu example scrolls and does not sufficiently match the main-menu reference. Listing every group and wrapping long names makes a quick-action menu grow without a useful bound.

Simple group selection also inherited the World Editor's larger rows and reserved control space, even though it needs no sorting or secondary controls. Scrollbars vary, and a picker footer reversed the established negative-left, positive-right button order. Without explicit standards, future sessions can repeat these choices.

## Solution

Extend the repository guide and production-backed showcase with four related standards: short context actions, appropriate list density, shared scrollbars, and consistent paired-action order. Implement the approved tile-menu/group-picker flow using production library operations, then replace its demonstration-only composition with a production-backed reference.

| Standard | Required outcome |
| --- | --- |
| Short context menus | Brief labels, bounded quick actions, and a separate chooser for an unbounded collection |
| Compact selection lists | Text-first rows with no space reserved for absent controls |
| Lists with controls or metadata | World Editor and Save/Load examples retain useful information and actions at an appropriate density |
| Scrollbars | The thicker World Editor treatment: 10px vertical track, rounded thumb, no up/down chevrons |
| Paired footer actions | Negative on the left; acceptance or continuation on the right |

These are additions to the existing app-wide foundation. Settings Display/Output, the markdown toolbar and split buttons, community cards, Find, Locations Canvas, and Code Templates remain approved references. Do not recreate their completed tickets.

## User Stories

1. As a user, I want a short context menu, so that I can scan its actions quickly.
2. As a user, I want concise labels instead of explanatory prose in menus, so that the menu remains compact.
3. As a user, I want long group names truncated in the menu, so that they do not widen it or create multiline actions.
4. As a user, I want up to three existing group shortcuts, so that common destinations remain directly available.
5. As a user, I want the shortcuts to follow the existing group order, so that their placement is predictable.
6. As a user, I want existing group shortcuts to be text-only, so that repetitive folder icons do not add noise.
7. As a user, I want distinct icons for Create New Group and Add To Group, so that I can distinguish actions from destinations.
8. As a user, I want Add To Group at the end of its menu section, so that I can find the full chooser consistently.
9. As a user, I want a searchable group picker, so that all destinations remain accessible when there are many groups.
10. As a user, I want the picker to show full group names, so that truncated shortcuts do not force me to guess.
11. As a user, I want a compact list of destinations, so that more choices fit in the same space.
12. As a user, I want list space reserved only for content and controls that exist, so that a simple picker does not resemble a sortable editor.
13. As a user, I want the current group indicated, so that I can recognize the current assignment.
14. As a user, I want selecting a destination to update the world tile and close the picker, so that the action is direct.
15. As a user, I want Cancel and Escape to preserve the current group, so that opening a picker has no side effects.
16. As a user, I want to create a named group from either entry point, so that organizing a world does not require a detour.
17. As a user, I want clear handling of blank names and duplicate names, so that I do not accidentally create an ambiguous destination.
18. As a keyboard user, I want menu access, focused search, keyboard activation, and predictable focus return, so that I can complete the flow without a pointer.
19. As a touch user, I want the menu and picker to fit the available screen and remain usable, so that mobile keeps the same visual identity.
20. As a user, I want the thicker scrollbar without arrow buttons, so that scrolling controls are consistent across app surfaces.
21. As a user, I want long lists to scroll within their pane while actions remain reachable, so that navigation does not move the whole dialog.
22. As a user, I want Cancel or decline on the left and the affirmative action on the right, so that familiar button placement prevents mistakes.
23. As an author, I want World Editor lists to retain their useful controls, so that compact selection does not remove editing capabilities.
24. As a user, I want Save/Load lists to retain useful save information and actions, so that standardization does not reduce my ability to choose a save.
25. As an implementer, I want both compact and richer list references in the guide and showcase, so that I can select density by purpose.
26. As a reviewer, I want the showcase to exercise production components with isolated data, so that visual approval predicts the shipped result.
27. As a user, I want functional copy to retain the existing STE review requirements, so that brevity does not excuse unclear or misleading language.

## Implementation Decisions

### Authority and adoption

- Extend the authoritative design guide and live showcase together. The existing project skill must discover the new standards through the guide; change its workflow only if a real gap remains.
- The approved prototype is a visual and interaction source, not production-ready code to copy wholesale. Its hard-coded palette, sample data, name-based identity, and URL switch are demonstration mechanics.
- Apply the standards to new work immediately after integration. Align the scoped tile-menu/picker flow and its showcase in this implementation. Inventory other existing violations for planned passes; this spec does not authorize a broad simultaneous redesign.
- Add production-backed World Editor and Save/Load list examples. Their approval as reference families does not imply that every current detail is immutable or that every list needs their controls.

### Short context actions

- Keep context menus to short action labels and section labels. Do not place full explanations, sentences, or instructional prose inside the menu. Necessary explanations belong in the relevant dialog or help surface.
- Bound collections by design. A menu must not grow with the total number of groups; moving overflow to a chooser is the primary solution, rather than giving the entire collection a scrollbar.
- For an individual world tile, retain the Tile Size section and checked size where the current layout supports size changes. Retain existing group-tile, removal, and deletion semantics in their applicable contexts.
- The Add To Group section shows at most the first three eligible destinations in existing order. Preserve current eligibility rules, including excluding the current group from direct move shortcuts. Show fewer entries when fewer are available; do not pad the section.
- Existing destination rows have no folder icons. Keep their text aligned with the menu's label column, and truncate long names on one line. Preserve access to the full name through accessible naming and the picker; use the shared tooltip if a tooltip is needed.
- Follow shortcuts with FolderPlus + Create New Group… and then FolderSearch + Add To Group…. Add To Group… is last in this section. Delete remains separated below, with its destructive treatment and trash icon.
- Keep ordinary desktop and portrait-mobile menus free of routine scrolling. Preserve reachability at exceptional short heights, browser zoom, and enlarged fonts: do not hide actions or clip the menu to manufacture a no-overflow result. Use the shared scrollbar for any necessary accessibility fallback; document that boundary in the reference.

### Group picker and production behavior

- Add To Group… opens a small dialog naming the affected world, followed by Find a Group, a bounded compact list, and footer actions.
- Search filters available groups by name without changing their underlying order. Empty results show a concise status while Cancel and Create New Group remain available.
- Show full names in the picker, wrapping when needed. Indicate the current group through selected treatment and a check. Selecting an existing destination updates the world assignment through the production library operation and closes the dialog; selecting the current group is a no-op assignment.
- Cancel, Close, and Escape perform no group mutation. Opening the menu or picker also performs no mutation.
- Create New Group… is available from the menu and picker. A naming dialog offers Cancel and Create Group. Blank names cannot be submitted; the approved prototype also prevents case-insensitive duplicates after trimming. Integrate this behavior without renaming, merging, or invalidating existing saved groups that already share names.
- Creating a group adds the new group and assigns the world through the existing production operations. Preserve stable group identifiers; do not use the prototype's group-name string as persistent identity.
- Search receives focus after the context menu has closed. Dialog dismissal returns focus to a valid opener. Preserve right-click, Shift+F10/Context Menu key, touch access, keyboard activation, and visible focus.
- The showcase uses controlled fixtures and callbacks. Actual library changes belong only to the production flow, not demonstration interactions.

### List density

- Introduce a reusable compact selection-row pattern for lists of choices without sorting, editing actions, or secondary metadata. Use native interactive semantics and shared theme, typography, selection, and focus treatments.
- The approved baseline is a 32px minimum row height, 8px horizontal padding, 6px vertical padding, and no gap between rows. Typography can determine a larger actual height; long names wrap instead of being clipped in the picker.
- Do not reserve grip, folder, action, or metadata columns when those elements are absent. Do not inherit a 56px editor-row floor merely to obtain its visual treatment.
- Keep selected state visible without depending on color alone. A current-selection check is state feedback, not an additional action control.
- Preserve meaningful controls and metadata in World Editor and Save/Load lists. Document these as separate density/composition choices. Do not force richer rows into the compact pattern or introduce sorting into a simple chooser.
- Define mobile behavior explicitly, including wrapping and usable touch targets. Do not reintroduce control-column padding as a mobile adaptation.

### Scrollbars

- Use the World Editor list scrollbar as the shared appearance source: a 10px vertical track, rounded theme-derived thumb, and no native or custom up/down chevrons.
- Reuse the shared scroll-area behavior where it fits. Native text editors or other specialized scrollers must preserve their scrolling and selection behavior while matching the appearance where supported; do not replace them blindly with a nested scroll container.
- Keep a content gutter so the thumb does not obscure text. Scroll long list contents within a bounded pane; keep search and footer actions outside that pane.
- Preserve wheel, touch, keyboard, focus-reveal, and existing horizontal scrolling where required. Do not hide overflow or reduce fixture content to claim visual conformity.
- Document the standard app-wide. Bring the picker and new list references into compliance in this scope; list other scrollers needing later alignment and any platform limitations explicitly.

### Footer action order

- Paired actions follow negative | positive: Cancel or decline on the left, acceptance or continuation on the right. Keep the pair together in the footer's action area.
- Apply this to Cancel | Create New Group…, Cancel | Create Group, and Cancel | Delete. Semantic destructive styling remains appropriate for Delete even though it confirms the operation.
- If the shared mobile footer stacks the pair, retain its affirmative-above-Cancel adaptation. At widths where the pair fits horizontally, preserve left-to-right order. Keyboard order must remain coherent with the chosen layout.
- Do not infer button hierarchy from color alone or let an implementation reorder actions to suit incidental markup.

### Writing and data boundaries

- Keep the full ASD-STE100 target, copy-role review, and existing terminology rules. Menu brevity is a composition rule, not certification that a label fragment complies with the standard.
- User-authored world and group names retain their voice. Do not rewrite them to meet menu length or dictionary rules.
- No world/save export changes, schema migrations, new API, version bump, or new storage subsystem are required.

## Testing Decisions

The previously confirmed boundary remains authoritative: use the real showcase for integrated UI verification, existing behavior tests for meaningful regressions, and separate STE review. No new lower-level testing seam or new interview is required.

- **Primary seam:** Exercise the production tile menu, picker, and list references through their user-facing host. Reuse the existing library-operation callbacks and isolated showcase fixtures.
- **Prior art:** Extend existing library tile menu and organization-operation tests as needed. Retain shared scroll-area, dialog, editor-row, Save/Load, and dev-route coverage where affected.
- **Behavior:** Cover zero/few/many groups, first-three eligibility and ordering, long and duplicate names, search/no results, moving a world, creating a group, validation, current-group selection, and cancellation with no mutation. Confirm group-tile and size/delete/removal actions remain intact.
- **Focus and access:** Check mouse, keyboard, and touch opening; search autofocus after menu teardown; Enter/Space activation; Escape dismissal; valid focus return; selected and disabled states.
- **Visual review:** Inspect static desktop/mobile frames in both themes and representative palette/font settings. Compare the approved menu and picker composition, compact row density, long-name wrapping, scrollbar gutter and arrows, and negative/positive button placement.
- **Overflow:** Exercise realistic large lists, narrow widths, viewport edges, short heights, enlarged text, and browser zoom. Verify all actions remain reachable and the picker pane scrolls independently. DOM dimensions support these checks but do not prove visual quality alone.
- **Reference isolation:** Demonstration interactions must not change stored worlds/saves, call endpoints, or register a production-only debug route. References must use the same production components as the implemented feature.
- **Test quality:** Add tests for external behavior and meaningful regressions. Do not write markup mirrors or weaken fixtures to remove the condition that revealed a bug. Time each run and report elapsed time.
- **Implementation completion:** Run typecheck, lint, tests, and production build; perform live UI verification and separate writing review. Refresh the code graph and add the appropriate In-Progress changelog entry for implementation, not for this specification-only task.

## Out of Scope

- Implementing UI or rewriting the approved prototype during this specification task.
- Reopening completed foundation/reference tickets for Settings, Markdown, community cards, Find, Locations Canvas, or Code Templates.
- Replacing all app lists with compact rows or removing useful editor/save controls.
- Bulk migration of every scrollbar or dialog in one pass; unscoped surfaces receive an inventory for follow-up.
- Sorting, drag-and-drop, bulk group management, or extra controls in the compact picker.
- Replacing the theme system, fonts, component library, or establishing an external design authority.
- Applying STE to authored content, certifying unreviewed copy, changing exports, or bumping versions.

## Further Notes

- Parent: [Design System Foundation](../design-system/spec.md). Its [main-menu context-menu ticket](../design-system/issues/09-main-menu-context-menu-reference.md) records the review that led to this extension.
- Authority: [Design System guide](../../../docs/Design-System.md), [Writing Guide](../../../docs/Writing-Guide.md), and [repository design authority decision](../../../docs/adr/0008-design-authority-in-repository.md).
- Approved artifact: branch `prototype/tile-group-picker`, commit `47ed367b`. The user's approval applies to the revision with text-only shortcuts, compact picker rows, and corrected footer order.
- Prototype source and evidence live in `docs-internal/prototypes/tile-groups/README.md` on that branch. In its worktree, run `npm run prototype:tile-groups` and open [the direct preview](http://127.0.0.1:5174/?prototype=tile-groups#dev?modal=designSystem).
- Source map: [production tile menu](../../../src/components/library/LibraryTileContextMenu.tsx), [shared scrollbar](../../../src/components/ui/scroll-area.tsx), [World Editor row](../../../src/components/EditorRow.tsx), [Save/Load dialog](../../../src/components/modals/LoadGameDialog.tsx), and [shared footer](../../../src/components/ui/dialog.tsx).
- Prototype checks established search, selection, cancellation, creation, focus handoff, and representative mobile fit. They do not replace production integration tests or complete cross-platform and STE review.
- Other work is already aligning library rows in the Enter World flow. Coordinate shared row/footer changes with that effort; this spec owns the standard and picker/reference additions, not a second competing row implementation.
