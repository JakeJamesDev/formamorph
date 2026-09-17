# Placeholder Values Tab — Spec

Status: ready-for-agent
Status note: written from the prototype on branch `prototype/placeholder-inline-edit` (files beside this spec); the prototype settled the mechanism and the interaction rules

A third tab on every placeholder-capable prose field: **Edit | Values | Preview**. On the Values tab every
chip expands in place into its drawn value. A header above each value names the placeholder, shows which
value is open, and walks the values with chevrons. Typing inside a value edits the placeholder itself, so
every field that uses it follows.

## Problem Statement

An author who reads a field full of chips cannot see what the text says without opening Preview, and
Preview is read-only. To fix one word inside a placeholder's value the author leaves the field, opens the
Placeholders tab, finds the placeholder, finds the value, edits it, and comes back. A field that uses five
placeholders means five round trips. The author never sees the value in the sentence it lives in while
editing it, so the edit reads wrong in context as often as not.

## Solution

- **A Values tab** sits between Edit and Preview on every field that already earns a Preview tab. It
  shows the field's text with every chip expanded into the value Preview drew for it.
- **Each open value carries a header** above its first line: the placeholder's name, the open value's
  label, a chevron each way, and nothing else. The header of the value that holds the caret shows
  everything. Every other header is compact: name and chevrons, label on hover.
- **Typing inside a value edits that placeholder's value text.** The field's own text never changes on
  this tab. Every chip of that placeholder in every field shows the new text.
- **Chevrons walk the placeholder's values** and move the shared preview roll with them, so Preview and
  every other field agree.
- **Edge typing needs no setting.** A character at either end goes into the value. Whitespace at either
  end waits: a following character keeps it inside, a caret exit drops it outside the value. Arrow keys
  step into a value from either side and out the other side.
- **Reroll keeps working** on the Values tab and redraws every open value.

## User Stories

1. As a world author, I want a Values tab on a prose field, so that I can read the field with its placeholders resolved while I edit.
2. As a world author, I want every chip open at once on that tab, so that I never expand or collapse chips one by one.
3. As a world author, I want each open value to show the same text the Preview tab shows, so that the two tabs never disagree.
4. As a world author, I want to type inside an open value and have the placeholder's value change, so that I fix a value in the sentence it lives in.
5. As a world author, I want an edit made on the Values tab to show in every other field that uses the placeholder, so that one fix reaches everywhere.
6. As a world author, I want the field's own stored text to stay the same while I edit on the Values tab, so that the chips survive and the token string never gains value text.
7. As a world author, I want a header above each open value that names its placeholder, so that I know what I am editing.
8. As a world author, I want the header to show which value is open, so that I know where I am in the list.
9. As a world author, I want chevrons on the header, so that I can step to the previous or next value without leaving the field.
10. As a world author, I want a chevron step to move the shared preview roll, so that Preview and every other field show the value I stepped to.
11. As a world author, I want the chevrons to wrap around at both ends, so that I never hit a dead end.
12. As a world author, I want the full header only on the value that holds the caret, so that a field with many open values stays readable.
13. As a world author, I want a compact header to show its value label on hover, so that the compact form hides nothing for good.
14. As a world author, I want headers never to overlap on one line, so that every header stays readable.
15. As a world author, I want headers to stay inside the field's box, so that a panel edge or the screen edge never clips them.
16. As a world author, I want a value that wraps across lines to read as one shape, so that I see where a value starts and ends.
17. As a world author, I want a clear mark on the value that holds the caret, so that I know whether my next keystroke edits a value or the field.
18. As a world author, I want a character typed at the end of a value to go into the value, so that I can extend a value without a mode switch.
19. As a world author, I want punctuation at the end of a value to stay inside the value, so that a value can end with a period or a comma.
20. As a world author, I want a space typed at the end of a value followed by a word to keep both inside, so that I can add words to a value.
21. As a world author, I want a space typed at the end of a value followed by an arrow key or a click elsewhere to land outside the value, so that I can separate a value from the next word.
22. As a world author, I want the same rules at the start of a value, so that both ends feel the same.
23. As a world author, I want the caret to land after a dropped space, so that I can keep typing the field text.
24. As a world author, I want a value never to start or end with whitespace, so that the placeholder's value list stays clean.
25. As a world author, I want an arrow key at the edge of a value to step out of it, so that I can reach the field text with the keyboard.
26. As a world author, I want an arrow key beside an open value to step into it, so that I can reach a value with the keyboard.
27. As a world author, I want Backspace on an empty value to do nothing, so that I never delete a chip by accident from inside it.
28. As a world author, I want Delete at the end of a value to pull nothing in, so that field text never joins a value by accident.
29. As a world author, I want a line break inside a value to work even on a one-line field, so that a value can hold a paragraph.
30. As a world author, I want a click outside a value to drop any pending edge whitespace, so that a value never keeps a trailing space.
31. As a world author, I want a chevron step or a tab switch to drop pending edge whitespace, so that no exit path leaks a space.
32. As a world author, I want Reroll to redraw every open value, so that the tab behaves like Preview.
33. As a world author, I want the Values tab to open only once the field holds a chip, so that a field without chips offers nothing empty.
34. As a world author, I want the Values tab absent when the world has no placeholders, so that a plain text field stays plain.
35. As a world author, I want the tab to fall back to Edit when the last chip leaves the text, so that a disabled tab is never the active one.
36. As a world author, I want the same placeholder placed twice with the same drawn value to open once and mirror once, so that two copies never fight over one caret.
37. As a world author, I want a mirrored copy to update live as I type in the editable copy, so that the mirror never lags.
38. As a world author, I want two Unique placements of the same placeholder to open on their own values, so that Unique keeps its meaning on this tab.
39. As a world author, I want an Object chip to open on its first value with chevrons walking the rest, so that I can edit each value of an Object in place.
40. As a world author, I want a Variable chip to open on its one value with the chevrons hidden, so that a one-value placeholder shows no dead controls.
41. As a world author, I want a chip inside a value to show as a chip, so that nested placeholders stay visible and are not flattened.
42. As a world author, I want undo inside a value to undo my value edit, so that a slip is one keystroke away from fixed.
43. As a world author, I want the Values tab to take Edit's seat in the split view, so that I can edit values beside the Preview.
44. As a mobile author, I want a swipe to reach the Values tab, so that the tab works on a phone.
45. As a world author, I want a read-only field to show the Values tab with values I cannot type into, so that reading works where editing does not.
46. As a world author, I want the flyout menu on a chip to offer "Edit value", so that I can reach one value in one click.
47. As a world author, I want "Edit value" to switch to the Values tab and place the caret in that chip's value, so that the flyout path lands me where I asked.
48. As a world author, I want the Edit tab to behave exactly as it does today, so that the new tab changes nothing I already know.
49. As a world author, I want double-click rename on the Edit tab to stay as it is, so that the two gestures never collide.
50. As a world author, I want the Values tab to use the same colors as the chip it replaces, so that I can match a value to its chip at a glance.
51. As a world author, I want the tab to respect reduced motion, so that nothing animates when I asked for none.
52. As a world author, I want the tab to work in both themes, so that the outline and headers stay readable in light and dark.
53. As a world author, I want a value edit to save through the same path as the Placeholders tab, so that discard and history behave the same.
54. As a world author, I want a pinned value typed off the list to show as read-only text, so that I see what a pin forces without editing a value that does not exist.

## Implementation Decisions

### Mechanism

- **One Lexical editor, one text.** The Values tab is the same chip editor with every chip in expanded
  mode. The field's stored token string never changes on this tab. This is the prototype's settled finding:
  one editor keeps one selection and one undo stack.
- **Lexical named slots** carry each open value. The chip stays a decorator node and hosts an editable,
  shadow-isolated slot mounted into its own chrome. The chip's text content stays the token, so the
  serializer needs no change. Lexical 0.50 provides slots; the version bump is already on main.
- The slot value is a shadow-root container, not a bare paragraph, so Enter inserts a line break inside a
  value even in a one-line field.
- **Programmatic focus must target the slot island itself**, not the editor root. A slot's blur never
  reaches the editor's blur command, so the exit logic listens to focus leaving the editor root and
  ignores moves that stay inside it.

### Which value opens, and what a chevron does

- **The preview rolls store decides.** Each chip opens on the value the shared rolls store holds for its
  placement: World placements share one roll per placeholder, Unique placements roll per placement. A chip
  with no roll yet is drawn on open, as Preview does today.
- **A chevron step writes a specific roll** to the store for that placement. This is a directed reroll. The
  store gains one operation for it: set the roll for one placement to one value id.
- **The store keys rolls by value id, not text.** Today it drops a roll whose text left the pool. An edit on
  the Values tab changes the text of the rolled value, so a text-keyed roll would go stale on the next read
  and the open value would jump. Keying by id keeps the open value stable through its own edit.
- An Object chip opens on its first value; chevrons walk the values in order. A Variable chip opens on its
  one value and hides the chevrons. Chevrons wrap.
- The chevron order is the placeholder's value order. Pins are not slots.
- **A pinned chip hides its chevrons.** A draw pin masks the roll before it is read, so a step would change
  nothing the author sees. The chip opens on the pinned value, which is what Preview shows; a pinned Object
  opens on the pin, not on its first value. The header marks the value as pinned. A pinned chip never
  writes a roll. The state is read from the draw each time, so the chevrons return when the pin source
  goes away.
- A pin that names a value id opens editable and writes through as usual. A pin whose value is typed off
  the list has no value id to edit, so it opens read-only.

### Writing through

- An edit inside a slot updates that placeholder's value text through the bound placeholder store, the
  same store the chips use to rename. No new provider.
- The write is debounced to the editor's update cadence, not per keystroke, and the store update carries the
  same placeholder with one value's text changed. Value ids, weights, pins and ownership never change.
- Trimming: the stored value text never starts or ends with whitespace. Pending edge whitespace lives
  only in the slot until an exit drops it into the field text.
- A store change from elsewhere (another field, the Placeholders tab) refills every slot that does not hold
  the caret. The slot with the caret refills on exit.

### Duplicates

- A placeholder placed twice in one field with the same drawn value opens once. The first placement in
  document order is editable; every later placement with the same value id is a read-only mirror that
  re-renders from the store as the editable copy writes.
- Unique placements with different drawn values are independent editable slots, because they hold different
  value ids.

### Edge typing

The prototype settled these rules; they replace any setting.

- A character or punctuation typed at either end of a value goes into the value.
- Whitespace at either end is a pending exit. A following character keeps it in the value. A caret exit
  drops it outside: trailing whitespace lands after the chip, leading whitespace before it, and the caret
  lands after the dropped text.
- "At the edge" means anywhere inside the edge whitespace run, so a space just typed at the start needs one
  ArrowLeft, not two.
- Caret exits: arrow keys and Home/End, a click elsewhere in the field, focus leaving the editor, a chevron
  step, a tab switch, Reroll.
- Arrow keys step into an open value from the outside and out the other side. Lexical does not move the
  caret out of a slot on its own, so the editor implements the exit.
- Backspace on an empty value does nothing. Delete at the end of a value pulls nothing in.

From the prototype, the exit decision as a pure rule (trimmed):

```ts
// slotText: the open value; caret: offset inside it; edge run = /^[ \t]+/ or /[ \t]+$/
type Exit = { before: string; after: string; value: string };
function ejectWhitespace(slotText: string): Exit {
  const before = slotText.match(/^[ \t]+/)?.[0] ?? '';
  const after = slotText.match(/[ \t]+$/)?.[0] ?? '';
  return { before, after, value: slotText.slice(before.length, slotText.length - after.length) };
}
// atEnd(caret) = caret >= slotText.length - after.length; atStart(caret) = caret <= before.length
```

### Header and shape

- Each open value shows a floating header above its first line fragment. The header holds the placeholder's
  name, the open value's label, a chevron each way. It carries the chip's identity color.
- Only the header of the value that holds the caret is full. Every other header is compact: name and
  chevrons, with the label as a hover title. Collision never drives compaction.
- Headers lay out in one editor-wide pass after every update and whenever a header resizes. A header stays
  inside the editor's box. When two headers meet on one line, the left one slides to the right end of its
  own value's first line if that end is free, then the right one tries the same, and as a last resort the
  left one is pushed away.
- The header's bottom corners are square where the value's first line runs beneath it and rounded past the
  line's ends.
- The outline is one traced shape around all of a value's line fragments, drawn as an overlay. Consecutive
  lines join into one shape only where they overlap horizontally; a wrap that leaves no overlap splits the
  shape. The shape's top-left corner is square under the header. The layout keeps a few pixels of space
  on either side of the value so the outline never covers the neighbor's text.
- The line that holds a header is pushed down by an empty inline spacer at the value's start, so the header
  never covers the line above and never adds a line break opportunity.
- The value that holds the caret shows a stronger ring and fill, and its header brightens.
- The look follows the design guide and showcase; this spec fixes behavior, and the visual pass gets user
  approval in app context, mobile form included.

### Tabs, split, and mobile

- The tab strip becomes three tabs: Edit, Values, Preview. Values shares Preview's gates: present when the
  world has placeholders, enabled when the text holds a chip. When the gate closes on an active Values tab,
  the field lands on Edit.
- Split view pairs an editing tab with Preview. Values may take Edit's seat. The split's shared scroll
  anchor works the same for both.
- Mobile swipe order is Edit, Values, Preview, with three dots.
- Prompt fields in Settings do not get the Values tab: their chips are prompt variables with no authored
  values to edit.
- One-line name fields keep no tabs and stay token-only.
- A read-only field shows the Values tab with slots that accept no input.

### Chip flyout

- The chip's flyout on the Edit tab gains an "Edit value" item. It switches the field to the Values tab and
  places the caret at the end of that chip's value. Nothing else in the flyout changes. Double-click rename
  stays as it is.

### Undo

- Edits inside a slot are part of the editor's history, so the field's undo and redo apply to them. The
  store write follows the editor's state, so an undo writes the previous text back.

## Testing Decisions

A good test drives the field the way an author does and asserts what the author sees or what the world
receives. It never reads Lexical node internals or asserts pixel positions in jsdom.

**Component seam: the placeholder field under a bound placeholder store and rolls provider.** Rendered in
jsdom with Testing Library, as the Preview tests do today. Edits inside a slot are driven through a
discrete editor update, the way the paste tests construct nodes. Cases:

- The Values tab appears and enables under the same gates as Preview, and falls back to Edit when the last
  chip leaves.
- Every chip opens on the value the rolls store holds, and the text between chips is the field's text.
- Typing in a slot calls the store's placeholder update with only that value's text changed, and the
  field's change callback never fires.
- A chevron step sets the store's roll for that placement, and Preview then shows that value.
- Two World placements of one placeholder open one editable slot and one mirror; two Unique placements with
  different rolls open two editable slots.
- A Variable chip shows no chevrons. An Object chip opens on its first value.
- A store change from outside refills a slot that does not hold the caret.
- A read-only field renders slots that accept no input.
- "Edit value" in the flyout switches the tab and focuses that chip's slot.

**Pure seam: the edge-typing rules.** A small module with no DOM: given the slot text and caret offset,
say whether the caret is at the start or end edge and what an exit ejects. Tested like the prompt field's
state module. Cases: leading and trailing runs, a caret anywhere inside a run, a value that is only
whitespace, no whitespace at all, punctuation at an end, empty value.

**Browser seam: Playwright, outside the four gates.** Header seating and compaction, slide and push
fallbacks, the traced outline splitting on a non-overlapping wrap, island focus after a programmatic expand,
blur dropping pending whitespace. These need a real caret and layout, and the preview pane cannot move a
caret with synthetic keys.

Prior art: the prompt field Preview tests, the variable node paste tests, the prompt field state tests, and
the e2e suite.

## Out of Scope

- Editing a placeholder's weights, pins, kind, ownership or value order from the Values tab.
- Adding or deleting values from the Values tab. The chevrons walk what exists.
- The Values tab on Settings prompt fields and on one-line name fields.
- Editing a pinned off-list value.
- Expanding one chip at a time on the Edit tab. The prototype tested it; the tab replaced it.
- Copy and paste of an expanded value as a value. Copying inside a slot copies plain text.
- Any change to the stored world shape. Placeholders, values and fields keep their shapes.

## Further Notes

- The prototype lives beside this spec on branch `prototype/placeholder-inline-edit`. Its `slot-float-shape`
  treatment is the look to build; the other treatments are comparison fodder.
- Two reports from the prototype stayed unreproduced: a space after a period once left the value, and once
  the first character of a value could not be deleted. The prototype logs every refill to help find them.
  Treat both as open questions during implementation, not as known bugs.
- Never clear then append inside an inline element that cannot be empty: Lexical removes it the moment it
  empties. This bit the region path in the prototype; the slot path avoids it, and the rule still applies to
  any inline element work nearby.
- Moving a slot container while it holds focus blurs it; restore focus when it lands on the body.
- No export shape changes. No version bump.
