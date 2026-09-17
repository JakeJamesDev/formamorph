# 05: Edge Typing and Keyboard Entry

Status: ready-for-agent
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

- [ ] Unit tests on the pure module cover: leading and trailing runs, a caret anywhere inside a run, a value that is only whitespace, no whitespace, punctuation at an end, an empty value.
- [ ] "word" + space + "word" at the end of a value keeps all of it in the value.
- [ ] "word" + space + ArrowRight leaves the space in the field text after the chip, with the caret after it.
- [ ] The same holds mirrored at the start of a value.
- [ ] A click elsewhere, focus leaving the editor, a chevron step, a tab switch and Reroll each drop pending whitespace outside.
- [ ] ArrowRight before an open value enters it at its start; ArrowLeft after one enters at its end.
- [ ] Backspace on an empty value and Delete at a value's end change nothing.
- [ ] Enter inside a value adds a line break and the field text is unchanged.
- [ ] Playwright covers the arrow entry and exit and the blur exit, since jsdom cannot move a caret.
- [ ] Changelog In-Progress entry added. Four gates green.
