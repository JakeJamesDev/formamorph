# 08: "Edit Value" in the Chip Flyout

Status: ready-for-human
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

- [x] The flyout shows Edit value on a placeholder chip in a field that has the Values tab.
- [x] Picking it activates the Values tab and focuses that chip's value with the caret at its end.
- [x] For a mirrored placement the caret lands in the editable copy.
- [x] Prompt-variable chips and read-only fields show no such item.
- [x] Double-click rename and every existing flyout item behave as before.
- [x] A component test covers the tab switch and focus target.
- [x] Changelog In-Progress entry added. Four gates green.

## Comments

Implemented in `d92e81ed`. Four gates green: typecheck 0, lint 0, test 10678 passed / 3 skipped in 72s, build 16.8s.

Two decisions worth carrying forward:

- **The item is Edit-tab only.** The ticket said "on the Edit tab", and that turns out to be load-bearing
  rather than descriptive. On the Values tab the field's own chips are open and carry no flyout, so the only
  chips left with one sit *inside* an open value. Their own value never opens, so the item would have been a
  button that does nothing. `PromptField` withholds `ask` while the Values tab is open.
- **The focus half is a browser claim.** jsdom will not focus a `contentEditable` island, so
  `PlaceholderField.editValue.test.tsx` asserts the caret's landing place and `e2e/edit-value-flyout.spec.ts`
  asserts that the next keystroke reaches the value. A mutation run showed `island.focus()` alone is not
  what carries the keyboard — Lexical's own selection reconcile does it in this path — so the call is kept
  as the explicit move onto a separate editing host, not because a test distinguishes it.

Open, not fixed here: a field whose loaded world is swapped underneath it without unmounting keeps showing a
value edit from the old world, because `PlaceholderField.unrendered` and `OpenValuesPlugin.ownWrites` are
per-field refs with no world identity. Only reproducible through the dev router so far. Filed separately.
