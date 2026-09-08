# 01: Implement Short Tile Menus And Compact Group Selection

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: GPT-6 Astra (`gpt-6-astra`)
Reasoning effort: high

## What to build

Implement the approved tile context menu and searchable group picker with real library operations. Deliver the compact selection-list pattern, its guide section, and a production-backed showcase in the same slice.

The approved source is `prototype/tile-group-picker` at `47ed367b`: text-only group shortcuts, compact destination rows, and negative-left/positive-right footer actions. The prototype's local state and hard-coded styling are not production architecture.

## Model rationale

Astra is recommended for the interaction-heavy integration: preserve library identity and mutation semantics while coordinating menu teardown, dialog focus, validation, responsive overflow, and isolated demonstration callbacks. High effort is appropriate for the cross-component behavior review.

## Acceptance criteria

- [ ] Retain applicable Tile Size, group-tile, removal, and deletion behavior. Keep the individual-world Add To Group section bounded to the first three eligible destinations in existing order, excluding the current group from direct move shortcuts.
- [ ] Existing destinations are text-only, aligned with the label column, and truncated to one line. Preserve full accessible names. Use shared tooltips if needed; do not use native title tooltips as the accessibility solution.
- [ ] Follow shortcuts with FolderPlus + Create New Group… and FolderSearch + Add To Group…. The latter is last in its section; destructive Delete stays separated below.
- [ ] Menu labels are brief. Explanations belong outside the menu. Ordinary desktop/mobile menus fit without routine scrolling; short heights, zoom, and enlarged fonts must not make actions unreachable. Any necessary fallback uses the shared scrollbar treatment.
- [ ] Add To Group… opens a dialog naming the world with Find a Group, the full destination list, and grouped Cancel | Create New Group… footer actions.
- [ ] Search filters names without reordering groups. Show an empty-result state. Full names wrap in the picker; the current assignment has selected styling and a check.
- [ ] Introduce a reusable compact row for simple choices: 32px minimum height, 8px horizontal and 6px vertical padding, no inter-row gap, and no reserved grip, icon, metadata, or action columns. Preserve native keyboard activation and visible focus. Let typography and wrapped names increase height when necessary.
- [ ] Choosing a group uses stable production identifiers, updates assignment, and closes the picker. Choosing the current group is a no-op assignment. Opening, Cancel, Close, and Escape do not mutate the library.
- [ ] Both creation entry points offer a naming dialog with Cancel | Create Group. Reject blank and trimmed case-insensitive duplicate names without modifying existing duplicate-named groups. Create and assign through existing production operations; do not add a storage schema or use names as identity.
- [ ] Search receives focus after menu teardown; dismissal returns focus to a valid opener. Preserve right-click, touch access, Shift+F10/Context Menu key, keyboard selection, and relevant disabled states.
- [ ] Use the shared 10px arrowless scrollbar within the bounded picker pane. Search and footer stay outside the scrolling content.
- [ ] Replace the demonstration composition with a production-backed showcase using isolated fixtures/callbacks. It must not mutate stored worlds, call endpoints, or ship the prototype route in production.
- [ ] Add guide sections for short context menus, compact lists, and the group-picker composition, including states and mobile behavior. Keep shared visual values in production components. Preserve STE role review and authored names.
- [ ] Pass typecheck, lint, tests, build, and live UI verification. Time each test run, apply the project test-quality requirements, update the code graph after code changes, and add the appropriate In-Progress changelog entry.

## Verification

Extend existing menu and library-operation behavior coverage at the user-facing seam. Exercise zero/few/many groups, first-three eligibility/order, long names, existing duplicate names, search/no results, create validation, selection, no-op assignment, and cancellation. Check preserved group-tile and size/removal/delete behavior.

Use static desktop/mobile frames, DOM evidence, both themes, and representative palette/font settings. Check focus transfer, independent pane scrolling, viewport-edge placement, short heights, zoom, and enlarged text. Do not weaken fixtures to avoid overflow. Review new copy separately against the Writing Guide; prototype checks do not certify STE compliance.

## Coordination and scope

No blocker on tickets 02 or 03: the scrollbar and dialog primitives already exist, and the approved footer order is settled. Ticket 01 owns menu/picker and compact-row composition; ticket 02 owns richer list references and the scrollbar standard; ticket 03 owns the general footer standard. Coordinate guide, registry, and shared primitive edits rather than overwriting concurrent changes. Check ongoing Enter World row work before introducing a competing primitive.

Do only necessary prefactoring before integration. No bulk migration of other lists, sorting in the picker, palette replacement, version bump, or export change.

## Parent

[Design Standards Additions](../spec.md).