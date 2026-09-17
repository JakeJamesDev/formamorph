# 05: Edge Typing and Keyboard Entry

Status: ready-for-human
Base: 2530b8df
Blocked by: 03
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high
Type: task
Spec: ../spec.md (Edge typing)

Model rationale: the subtlest behavior in the feature; selection, focus and command-priority traps in Lexical.

## What to build

The author types at either end of an open value without choosing a mode, and moves in and out of values
with the arrow keys.

- A character or punctuation typed at either end goes into the value.
- Whitespace at either end is a pending exit. A following character keeps it in the value. A caret exit
  drops it outside: trailing whitespace lands after the chip, leading whitespace before it, and the caret
  lands after the dropped text.
- "At the edge" means anywhere inside the edge whitespace run.
- Caret exits: arrow keys and Home/End, a click elsewhere in the field, focus leaving the editor, a chevron
  step, a tab switch, Reroll.
- An arrow key beside an open value steps into it, and out the other side. Lexical does not move the caret
  out of a slot on its own, so the editor implements the exit.
- Backspace on an empty value does nothing. Delete at the end of a value pulls nothing in.
- Enter inside a value inserts a line break, even in a one-line field.
- A slot's blur never reaches the editor's blur command. Listen to focus leaving the editor root and ignore
  moves that stay inside it.

The rules live in a pure module with no DOM. From the prototype, trimmed:

```ts
type Exit = { before: string; after: string; value: string };
function ejectWhitespace(slotText: string): Exit {
  const before = slotText.match(/^[ \t]+/)?.[0] ?? '';
  const after = slotText.match(/[ \t]+$/)?.[0] ?? '';
  return { before, after, value: slotText.slice(before.length, slotText.length - after.length) };
}
// atEnd(caret) = caret >= slotText.length - after.length; atStart(caret) = caret <= before.length
```

Two prototype reports stayed unreproduced: a space after a period once left the value, and once the first
character of a value could not be deleted. Watch for both while building; do not treat them as known bugs.

## Acceptance criteria

- [x] Unit tests on the pure module cover: leading and trailing runs, a caret anywhere inside a run, a value that is only whitespace, no whitespace, punctuation at an end, an empty value.
- [x] "word" + space + "word" at the end of a value keeps all of it in the value.
- [x] "word" + space + ArrowRight leaves the space in the field text after the chip, with the caret after it.
- [x] The same holds mirrored at the start of a value.
- [x] A click elsewhere, focus leaving the editor, a chevron step, a tab switch and Reroll each drop pending whitespace outside.
- [x] ArrowRight before an open value enters it at its start; ArrowLeft after one enters at its end.
- [x] Backspace on an empty value and Delete at a value's end change nothing.
- [x] Enter inside a value adds a line break and the field text is unchanged. The one-line case is unreachable: a one-line field is `ChipInput`, which has no Values tab.
- [x] Playwright covers the arrow entry and exit and the blur exit, since jsdom cannot move a caret.
- [x] Changelog In-Progress entry added. Four gates green.

## Notes on finish

- Both unreproduced prototype reports have a regression test. The period-and-space one is covered in
  `PlaceholderField.edges.test.tsx`; the undeletable first character is covered in jsdom and in e2e.
- Home and End leave the value in a browser, so they drop pending whitespace through the refill path
  rather than through a key handler. `e2e/open-value-edges.spec.ts` proves both.
- A chevron step and a reroll now refill the value that holds the caret, which ticket 03 spared. Without
  that, neither drops the pending whitespace and both keep showing the old value.
- Gates on finish: typecheck 0 errors, lint 0 errors in this ticket's files, test 10,665 pass in 74s,
  build 16.9s. `e2e/open-value-edges.spec.ts` 8 pass, desktop only.
