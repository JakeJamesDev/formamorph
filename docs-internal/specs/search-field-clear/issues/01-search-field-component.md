# 01: Search Field Component

Status: in-progress
Base: b86de44d
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Recommended model rationale: a shared primitive extraction from a dense component, a new ui component with a prop contract the other four tickets depend on, a migration under an existing test net, and a Design System pattern with a showcase reference.

## What to build

A shared **Search Field**: a search icon, the text box, and a **Clear Search** X that shows only while the box holds text. Selecting the X empties the box, applies the empty value at once, and returns the cursor to the box. The native browser cancel button never shows.

The field is built on a `FieldWithTrailing` primitive extracted from the Find bar: a relative wrapper with a focus-within ring that hosts trailing cells. The base `Input` stays a bare input element. The field takes `className` for the wrapper, `inputClassName` for the input, the input `size` variant, and an `onClear` override that defaults to calling `onChange` with an empty string. Where a host adds its own trailing cells, the X is the innermost cell (Q7).

The feedback list search migrates onto the field first. Its tests stay green and gain a case for focus return after clear.

The Design System gains a **Search Field** pattern, and the showcase gains a `SearchFieldReference` with a dev route. The Find bar section's two "Clear search" mentions update to **Clear Search** (Q6).

Changelog fragment: the lead for the effort, under Minor, Added, player. It is the effort's only entry (Q13).

## Acceptance criteria

- [ ] `SearchField` renders no X when empty, an X named **Clear Search** when text is present, and hides the WebKit cancel pseudo-element.
- [ ] Escape on a non-empty field does not clear it; a host dialog still closes (Q12).
- [ ] Selecting the X calls `onClear` or, by default, `onChange('')`, and focus lands on the input.
- [ ] The `size` variant sets the field height and scales the icon and X.
- [ ] The Find bar still passes its tests after the `FieldWithTrailing` extraction.
- [ ] The feedback search tests pass unchanged, plus the new focus-return case.
- [ ] The Design System pattern and the showcase reference exist; the reference renders in both themes.
- [ ] Four gates green.
