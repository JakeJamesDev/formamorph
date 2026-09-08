# 09: Add the Main Menu Context Menu Reference

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: GPT-5.6 Sol (`gpt-5.6-sol`)
Reasoning effort: high

**Model rationale:** This is a bounded production-component integration with keyboard behavior, preference and data isolation, documentation, and visual verification. Sol is an appropriate choice for that combined implementation work. This is a workload recommendation, not a model switch or ticket-specific benchmark. See the [official model catalog](https://developers.openai.com/api/docs/models/all); recheck availability when starting.

## What to Build

A reviewer can open the main-menu context menu on a sample item in the live design showcase, change local choices, and inspect the Grouped Context Actions pattern against its guide section.

## Acceptance Criteria

- [ ] Add the actual main-menu context-menu composition to the existing development-only showcase, shown against a representative sample tile or item. Reuse production menu components and behavior rather than creating a visually similar standalone menu.
- [ ] Document the Grouped Context Actions pattern: purpose, compact density, section labels, aligned option text, checkmark space, semantic separators, and a separate final destructive-action section.
- [ ] Preserve the approved reference's Tile Size choices, selected-size checkmark, Add To Group section, group choices, Create New Group action, and Delete action with its icon and semantic color, subject to current production applicability.
- [ ] Make demonstrated choices produce visible local outcomes. Keep tile-size preferences, group changes, group creation, and deletion isolated from real settings, library items, storage, and account data.
- [ ] Preserve current production confirmation and cancellation behavior for destructive actions. Do not invent a confirmation flow or remove an existing safeguard solely for the showcase.
- [ ] Verify pointer opening, supported keyboard opening/navigation, activation, selected-state semantics, Escape/outside dismissal, and appropriate focus restoration through real menu behavior.
- [ ] Include applicable default, checked, disabled, focus, and overflow states, with realistic long group labels and enough content to exercise viewport constraints without making the default reference needlessly large.
- [ ] Show the menu in representative main-menu context at desktop and mobile sizes. Verify current touch access, viewport-edge positioning, scrolling, and dismissal where supported; document limitations and propose any newly required visual pattern before adopting it.
- [ ] Use existing theme, typography, spacing, and focus treatments. Verify both light/dark appearances and representative font/palette inheritance with static frames and DOM evidence; do not sample HDR screenshot colors.
- [ ] Review new functional labels, accessible names, descriptions, and status text through the Writing Guide and record evidence limits for reused copy. Sample user-authored group names retain their own voice.
- [ ] Add the matching guide section, production mapping, responsive behavior, and state reference together with the showcase registry entry. Confirm the existing design-system skill discovers the reference through the guide; modify the skill only for a demonstrated workflow gap.
- [ ] Before showcase integration, perform only necessary prefactoring for production reuse and isolated callbacks. Retain relevant existing menu behavior tests and add meaningful regression or isolation checks without mirroring markup.
- [ ] Pass all four implementation gates, time test runs, update the knowledge graph after code changes, perform live UI verification, and append an appropriate In-Progress changelog entry.

## Verification

Exercise real menu interactions against a controlled sample. Confirm selected-size changes, group actions, and deletion/cancellation affect only local demonstration state. Verify keyboard selection and dismissal separately from appearance. Use static desktop/mobile evidence for alignment, grouping, semantic destructive treatment, focus, long labels, and viewport constraints.

## Coordination and Scope

The design-system foundation already exists. This ticket has no new dependency on tickets 06–08; coordinate their shared guide and showcase registration edits before concurrent work.

The user approved adding the main-menu example after reviewing this single-ticket proposal. That approval does not endorse every context menu elsewhere in the app. Preserve the reference's established composition; name adjacent defects rather than silently redesigning unrelated menus. No app-wide redesign, new palette, bulk copy rewrite, version bump, or export-shape change belongs to this ticket.

## Parent

[Design System Foundation spec](../spec.md). This ticket extends the original reference set with the user-approved main-menu context menu; the parent spec and other tickets remain unchanged by this addition.

## Follow-up prototype: short tile menu and group picker

**Question:** Does a menu with the first three group shortcuts, text-only group shortcuts and distinct action icons, and a searchable Add To Group dialog feel right in Formamorph?

**Verdict:** Pending user review. The prototype does not approve a new pattern or change production library behavior.

**Artifact:** `prototype/tile-group-picker`, commit `db14beb3`. The runnable source, launch notes, and desktop/mobile evidence are in `docs-internal/prototypes/tile-groups/README.md` on that branch.

**Run:** In `C:/Users/benny/.codex/worktrees/45c8/formamorph`, run `npm run prototype:tile-groups`, then open [the local preview](http://127.0.0.1:5174/?prototype=tile-groups#dev?modal=designSystem).

The prototype reuses the context-menu primitives, compact text rows, shared 10px scrollbar, and dialog controls. Search, keyboard selection, cancellation, creation, focus handoff, and mobile overflow were checked. TypeScript/scoped lint passed in 16.4 seconds; the production build passed in 15.8 seconds. Full writing and cross-palette/font review remain implementation work. All sample state is temporary.