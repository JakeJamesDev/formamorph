# 07: World Script Templates

Status: done
Blocked by: 06
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: a third template kind, a new name slot, and eight built-ins that write through the world surface.

## What to build

A world script's box gets a **Templates** button (Q15). The template kind gains `worldScript`, with Script timings, and its menu follows the box's timing. A new `location` name slot picks one of the world's locations. The eight world-script drafts in the spec ship with their listed timings, and the runs-clean test covers them through the Test Code runner. Authors save, export and import world-script templates in the same library and v2 pack. The Scripts guide documents the menu.

Spec: Q15; follow-ups section.

## Acceptance criteria

- [ ] A world script box lists only `worldScript` templates for its timing; stat and World Tool boxes never list them
- [ ] The `location` slot lists the world's locations and fills a quoted name
- [ ] Each world-script built-in passes the runs-clean test at each listed timing
- [ ] A saved world-script template round-trips through a v2 pack with its kind
- [ ] Export-shape reminder in the landing response (new `kind` value); changelog fragment written; four gates green
