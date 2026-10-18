# 04: World Tool Templates

Status: done
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: a new slot type, a second surface in the template dialog, and ten built-ins that write through the World Tool sandbox.

## What to build

A World Tool's Script box gets a **Templates** button. It opens the same dialog with kind World Tool and the Tool's current timing, and the menu follows a timing change (Q6, Q7). A new `param` slot picks one of the Tool's Parameters and fills its quoted name. With no Parameters, the field says to add one and blocks Insert. Authors save, export and import World Tool templates in the same library and pack. The ten World Tool built-ins in the spec ship with their listed timings, and the runs-clean test covers them through the Try It runner. The Scripts guide documents the menu and the Parameter slot. CONTEXT.md gains **Template**.

Spec: Q4, Q6, Q7, Q12; stories 17–21, 23.

## Acceptance criteria

- [ ] A World Tool box lists only World Tool templates for its timing; a stat box never lists them
- [ ] The Parameter slot lists the draft's Parameters and blocks Insert with none
- [ ] Each World Tool built-in passes the runs-clean test at each listed timing
- [ ] A saved World Tool template exports and imports in a v2 pack with its kind
- [ ] Scripts guide and CONTEXT.md updated; changelog fragment written; four gates green
