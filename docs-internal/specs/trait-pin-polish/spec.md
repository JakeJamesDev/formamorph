# Trait Pin Polish — off-list pins are legal, and the pin value field gets a real dropdown

Status: ready-for-agent

## Problem Statement

Pinning a placeholder to a value outside its authored list is a deliberate design choice — the trait editor's pin value field is free text precisely so a "Redhead" trait can name a shade nobody else rolls — and it works in play. But the Test Bench contradicts the design in two places: the World Doctor rule `trait-pin-invalid` reports an off-list pin as a broken error, and the Bench lens shows a red "isn't one of its values" line under the Testing-as selector when the chosen PC carries one. An author who used the feature as intended is told their world is broken.

Separately, the pin value field's suggestions come from a native browser datalist — the only one in the app — so its dropdown renders in OS-native chrome that matches no other dropdown in the product.

## Solution

The Test Bench stops calling off-list pins broken: the rule and the lens flag only pins that name a placeholder that no longer exists (a real dangling reference that silently never applies). The pin value field keeps free text but swaps its native datalist for an app-styled combobox — type anything, or pick from the placeholder's authored values, in a dropdown that looks like every other popover list in the app.

## User Stories

1. As a world author, I want to pin a placeholder to a value its list doesn't carry, so that a trait can force a one-off value nobody else rolls.
2. As a world author, I want the World Doctor to stay quiet about off-list pins, so that using the feature as designed doesn't flag my world as broken.
3. As a world author, I want the World Doctor to still flag a pin whose placeholder no longer exists, so that a pin that silently never applies doesn't hide from me.
4. As a world author, I want the Bench lens to apply an off-list pin without a red warning, so that testing as that PC reads the same as playing it.
5. As a world author, I want the Bench lens to still call out a pin at a deleted placeholder, so that I learn why the pinned value never shows up in resolved text.
6. As a world author, I want the fix action for broken pins to keep working for dangling pins, so that one click still cleans up what is genuinely broken.
7. As a world author, I want the pin value field to keep accepting free text, so that nothing I could type before becomes untypeable.
8. As a world author, I want the pin value field to suggest the placeholder's authored values, so that pinning an on-list value doesn't require remembering its exact spelling.
9. As a world author, I want those suggestions to filter as I type, so that a long value list narrows to what I'm after.
10. As a world author, I want picking a suggestion to fill the field, so that one click finishes the pin.
11. As a world author, I want the suggestion dropdown styled like the app's other dropdowns, so that the trait editor doesn't break theme with OS-native chrome.
12. As a world author, I want the suggestion dropdown to work in both themes, so that it doesn't glow white in dark mode the way the native list does.
13. As a world author, I want typing to keep focus in the field while suggestions show, so that the dropdown never interrupts my typing.
14. As a world author, I want to scroll the suggestion list with the wheel inside the editor dialog, so that a long list is reachable (the dialog's scroll lock must not eat the wheel).
15. As a world author, I want a pin at a placeholder with no authored values to behave like any other pin, so that a valueless placeholder can still be pinned.
16. As a world author editing on mobile, I want the suggestion dropdown usable by touch, so that pin editing isn't desktop-only.
17. As a keyboard user, I want to move through suggestions with arrow keys and accept with Enter, so that the combobox is operable without a pointer.
18. As a screen-reader user, I want the field and its suggestions exposed with proper combobox semantics, so that the control announces itself correctly.
19. As a player, I want a trait's off-list pin applied during play exactly as before, so that nothing about runtime behavior changes.
20. As a developer, I want the broken-pin vocabulary to carry only reasons that are actually broken, so that dead reason branches don't survive in the types.

## Implementation Decisions

- The `trait-pin-invalid` Test Bench rule keeps only its missing-placeholder branch; the value-not-offered branch is removed. Its summary line is reworded to name only what it now checks (pins naming a placeholder that doesn't exist). The rule's id, severity, section, and advanced flag are unchanged, so seen-state and dismissals carry over.
- The lens's broken-pin detection drops its missing-value branch to match. The `BrokenPin` reason union narrows to the single remaining reason (or the field goes away entirely — implementer's call, whichever leaves the cleaner type), and the describe helper keeps only the missing-placeholder sentence.
- Runtime pin application is untouched: active traits already apply pins verbatim, which is the behavior the Bench must mirror.
- A new single-value `Combobox` joins the shared ui components: a text input anchored to a popover suggestion list built from the cmdk Command primitives already shipped for the multi-select. Free text is first-class — the field's value is always exactly what was typed unless a suggestion is clicked.
- The combobox popover must not steal focus from the input on open, and must survive the editor dialog's scroll lock (the multi-select's modal-popover treatment is the precedent; a non-portaled popover is the fallback).
- The trait editor's pin value row swaps its input-plus-datalist for the Combobox, fed by the selected placeholder's authored values. The datalist and its per-row ids go away, leaving the app datalist-free.
- Suggestions filter by substring on the typed text; an empty field shows the full list. No value is preselected, and Enter with no highlighted suggestion keeps the typed text.
- No world or save export shape is touched by any of this.

## Testing Decisions

- Tests assert external behavior at existing pure seams: the rules pass (`runRules`) and the lens builder (`buildLens` / the broken-pin describe helper). Prior art: the existing Test Bench rules and lens test suites.
- Rule tests flip rather than vanish: an off-list pin now asserts zero findings (the mechanic still fires — the world still contains the off-list pin — the expectation changes because the design says it's legal); a dangling pin still asserts one error. The stripped-world case (placeholder with no values array) asserts a pin there is clean instead of broken.
- Lens tests mirror the same flip: off-list pin produces no broken-pin line and the pin still lands in the applied pins map; dangling pin still produces its line.
- The Combobox gets component-boundary tests: renders the typed value, filters suggestions, click fills the field, free text not in the list is kept. Prior art: the existing ui component tests (input, textarea, dialog).
- TraitManager gets a manager-level wiring test proving the pin row renders the Combobox with the selected placeholder's values as suggestions and writes edits through. Prior art: the existing manager tests (StatManager). Depth is bounded by what cmdk/Radix allow in jsdom — render and value assertions are the floor; popover-driving is best-effort per the known Radix-in-jsdom limits.

## Out of Scope

- Any change to how pins apply at runtime, to pin data shape, or to world/save export shape.
- Restyling the Bench lens selectors (they already use the shared select component; their small size variant is a deliberate density choice).
- Adopting the Combobox anywhere beyond the pin value field — other candidates are follow-up work.
- Weighted-value or placeholder-pool validation rules; only the trait-pin rule changes.

## Further Notes

- The trait editor's own code comment documents the off-list design ("a trait may pin a value the list doesn't carry"), and the user has verified off-list pins work in play — the Bench is the part that's wrong, twice, in the rule and the lens.
- The value-check removal shrinks what `trait-pin-invalid` reports, so worlds previously showing that error may drop findings; that's the point, and no migration or version concern follows.
