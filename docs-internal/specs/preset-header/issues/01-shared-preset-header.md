# 01: Shared preset header on Settings Prompts

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The Settings Prompts preset header renders from one shared component that every other header will reuse.

- The component takes a label, the preset select, and an ordered action list. At `md` and up it renders icon-only ghost buttons with tooltips: destructive actions left of the select, file actions right. Below `md` the existing ⋯ menu renders the same list by section, destructive last. The menu component moves beside the header component.
- The action list builder gains `duplicate` and `import`. A handler the surface does not pass removes the action. A built-in preset keeps Duplicate, Import and Export.
- Settings Prompts adopts it: Duplicate appears, Import becomes an icon, the "Import Preset…" select row goes, "Add New Preset…" stays as the last select row. Publish stays where the action list puts it.
- The existing preset menu test moves to the component and asserts the order, the menu contents, the built-in subset, and focus return after a canceled confirm. The Settings test keeps behavior only.

Spec: Q1, Q2, Q7, Q9, Q10, Q12; Implementation → Shared header component, Action set per surface.

Recommended model rationale: a shared component with a responsive split, a moved menu, and a test migration across two files.

## Acceptance criteria

- [ ] Settings Prompts shows icon buttons with tooltips at `md` and up, and only the ⋯ button below `md`, with Duplicate and Import present.
- [ ] The "Import Preset…" row is gone from the select and "Add New Preset…" remains.
- [ ] A built-in preset offers Duplicate, Import and Export only.
- [ ] The component test covers order, menu contents, the built-in subset and focus return; the Settings test still passes on behavior.
- [ ] Changelog line under In Progress.
