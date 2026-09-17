# 08: "Edit Value" in the Chip Flyout

Status: in-progress
Base: 98811e10
Blocked by: 05
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium
Type: task
Spec: ../spec.md (Chip flyout)

Model rationale: one menu item wired to behavior the earlier tickets built.

## What to build

On the Edit tab, a placeholder chip's flyout gains an **Edit value** item. Picking it switches the field to
the Values tab and places the caret at the end of that chip's open value. One click takes the author from a
chip to typing in its value.

- The item shows only where the Values tab exists and is enabled, and only on an editable field.
- If that chip is a mirror on the Values tab, the caret goes to the editable copy of the same value.
- Nothing else in the flyout changes. Double-click rename stays as it is.
- The item's copy follows the flyout's existing voice and title case.

## Acceptance criteria

- [ ] The flyout shows Edit value on a placeholder chip in a field that has the Values tab.
- [ ] Picking it activates the Values tab and focuses that chip's value with the caret at its end.
- [ ] For a mirrored placement the caret lands in the editable copy.
- [ ] Prompt-variable chips and read-only fields show no such item.
- [ ] Double-click rename and every existing flyout item behave as before.
- [ ] A component test covers the tab switch and focus target.
- [ ] Changelog In-Progress entry added. Four gates green.
