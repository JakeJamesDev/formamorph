# 07 — An Object offers no weights and no eye

Status: done
Type: task
Spec: ../followup-spec.md (issue 3)

## Task

In `PlaceholderManager.tsx`, gate the chip-path `onChipClick`, the multiline `weight` prop and the eye
toggle on `kind !== 'object'`, matching the shared-row branch that already does so. Roll stays.

## Acceptance

- An Object with 3 values: no weight pop-out on chip click, no stepper in box view, no eye, Roll present.
- Switching the same placeholder to Wildcard restores all three.
- `PlaceholderManager.test.tsx` covers both states.

## Answer

Shipped. `PlaceholderManager` derives one `weighable` flag from `placeholderIsChoice(editing)` and gates the
chip-path `onChipClick`, the multiline `weight` prop, the eye and the shared-row `onOpen` on it. Declaring an
Object also closes an open weight pop-out and turns the chance reveal off, since an Object has no eye to turn
it back off with. Roll stays. Six tests in `PlaceholderManager.test.tsx` cover the Object state, the switch
back to Wildcard, and the two transitions. Verified in jsdom only; the spec's live screenshots are still to
be re-taken.
