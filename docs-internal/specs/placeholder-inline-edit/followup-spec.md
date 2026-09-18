# Placeholder Values Tab — Follow-Up Spec

Status: in-progress
Base: 1bdc2b16
Status note: five fixes found in the first hands-on pass of the shipped Values tab; parent spec is `spec.md` beside this file

Five fixes to the Values tab and the chip flyout: an off-list pin becomes editable, a header click makes
its value active, the header becomes a pager whose controls never move, only the active value carries an
outline, and the World | Unique control shows read-only where a chip can only ever be World.

## Problem Statement

An author who uses the Values tab hits five rough spots.

- A placeholder with no values of its own, held at a value by a pin, opens **locked**. The pin is the only
  value that placeholder has in this draw, and the author cannot fix a word in it without hunting for the
  value that carries the pin.
- A click on a value's header does not make that value active. The header of an inactive value ignores the
  click. A chevron click on the active value loses the caret, so its header drops to the compact form and
  the line reflows under the pointer.
- The right chevron sits after the value label, and the label changes width from value to value. The
  author clicks the right chevron, the header resizes, and the chevron moves out from under the pointer.
- Every open value carries an outline, and the active one carries a bright, thick one. A field with several
  chips is busy to read, and the thick line sits on the value's edge, where it hides the caret at the start
  and end of the value.
- The chip flyout hides the World | Unique control on a Variable. The chip **is** World, and cannot be
  Unique, but nothing on the flyout says so. The author cannot tell a hidden control from a missing one.

## Solution

- **An off-list pin opens editable.** Typing in it rewrites the pin's own text on the value that carries
  the pin. The pinned placeholder gains no value. Every chip that reads that pin follows.
- **A press anywhere on a header makes its value active.** The caret lands at the end of the value. After
  a chevron step the caret is back in the stepped value, so the header stays in its active form. A value
  that cannot take a caret (a mirror, a locked value, a read-only field) becomes active by the click alone.
- **The header is a pager.** Compact, on every inactive value: the placeholder's name, then a left
  chevron, the position as `X/Y`, and a right chevron. Active: the same, then the verbose value label after
  the right chevron. The name and the counter keep their width from step to step, so neither chevron moves
  when the author steps, and the active form only grows to the right.
- **The World | Unique control always shows on a placeholder chip.** Where the chip can only be World, the
  control shows World selected, read-only, with a line that says why.
- **Only the active value carries an outline, and it is the quiet one.** An inactive value keeps its light
  fill and its header and loses its line. The active value takes the thin line inactive values carry today.
  The bright, thick active line goes away.

## User Stories

1. As a world author, I want a placeholder that has no values but is held by a pin to open editable, so that I can fix the pinned text where I read it.
2. As a world author, I want an edit to an off-list pin to change the pin's own text, so that the placeholder does not gain a value it never had.
3. As a world author, I want every chip that reads that pin to show my edit, so that one fix reaches everywhere.
4. As a world author, I want a pin typed off the list on a placeholder that does have values to open editable too, so that every off-list pin behaves the same.
5. As a world author, I want a pin that names a listed value to keep writing to that value, so that nothing that works today changes.
6. As a world author, I want a placeholder with no values and no pin to stay locked and say "No Values", so that I know there is nothing to edit.
7. As a world author, I want an off-list pin that I empty to stay an empty pin, so that clearing text never deletes a pin behind my back.
8. As a world author, I want undo inside an off-list pin to restore the pin's text, so that a slip is one keystroke from fixed.
9. As a world author, I want two chips that read the same off-list pin to open once and mirror once, so that two copies never fight over one caret.
10. As a world author, I want a click on an inactive value's header to make that value active, so that the header is a handle and not dead space.
11. As a world author, I want that click to put the caret at the end of the value, so that I can type at once.
12. As a world author, I want a chevron click to keep its value active, so that the header does not shrink under my pointer.
13. As a world author, I want the caret back inside the value after a step, so that I can step and then type.
14. As a world author, I want pending edge whitespace dropped outside the value when I step, as it is today, so that the header fix changes no typing rule.
15. As a world author, I want a click on a mirror's header to make the mirror active, so that I can read its full header.
16. As a world author, I want a click on a locked value's header to make it active, so that I can read why it is locked.
17. As a world author, I want a header click in a read-only field to show the active header, so that reading works where editing does not.
18. As a world author, I want only one value active at a time, so that the field never shows two verbose headers.
19. As a world author, I want a value that holds the caret to win over a value made active by a click, so that the header follows where I type.
20. As a world author, I want a click in the field text to leave no value active, so that every header is compact when I edit the field itself.
21. As a world author, I want focus leaving the editor to leave no value active, so that a field I am not using stays quiet.
22. As a world author, I want a header click never to move the field's scroll position, so that the text stays where I was reading.
23. As a world author, I want the header to read name, left chevron, position, right chevron, so that the controls step the number they sit around.
24. As a world author, I want the position shown as `X/Y`, so that I know where I am and how many values exist.
25. As a world author, I want both chevrons to stay exactly where they are when I step, so that I can click through values without chasing the button.
26. As a world author, I want the counter's digits to keep one width, so that `9/10` and `10/10` do not shift the right chevron.
27. As a world author, I want the verbose value label only on the active value, so that inactive headers stay short.
28. As a world author, I want the verbose label after the right chevron, so that a long label never moves a control.
29. As a world author, I want the compact header to keep the verbose label as a hover tip, so that compact hides nothing for good.
30. As a world author, I want a header going from compact to active to grow only to the right, so that nothing left of the label moves when I click.
31. As a world author, I want a Variable's header to show its name with no pager, so that a one-value placeholder shows no dead controls.
32. As a world author, I want a pinned chip's header to show its name and a Pinned mark with no pager, so that I know a pin decides the value and a step would do nothing.
33. As a world author, I want a locked value's header to keep its lock mark, so that read-only stays visible in the compact form.
34. As a world author, I want a "No Values" header to say so in the compact form, so that an empty placeholder never looks like a broken one.
35. As a world author, I want headers still to stay inside the field and off each other, so that the pager changes the content and not the layout rules.
36. As a screen reader user, I want the chevrons to keep their names and the counter to read as "value X of Y", so that the pager is understandable without sight.
37. As a world author, I want the flyout of a Variable chip to show World | Unique with World selected, so that I know this chip is the same everywhere in the world.
38. As a world author, I want that control read-only on a Variable, so that I am not offered a choice that changes nothing.
39. As a world author, I want a line under the read-only control that says why, so that I know what would unlock it.
40. As a world author, I want a plain Object chip to get the same read-only World control, so that every placeholder chip answers the World-or-Unique question.
41. As a world author, I want the control to unlock the moment the placeholder gains a second value or becomes able to draw, so that the flyout follows the placeholder.
42. As a world author, I want a Wildcard chip's control to work as it does today, so that the fix changes nothing that already works.
43. As a world author, I want a chip left Unique from when its placeholder could draw to show Unique selected and read-only, so that the control tells the truth about the stored token.
44. As a world author, I want the read-only control in a read-only field to look as it does today, so that there is one disabled look.
45. As a world author, I want prompt-variable chips in Settings to be unaffected, so that the fix stays on placeholder chips.
46. As a world author, I want an inactive value to show no outline, so that a field with many chips reads as text and not as boxes.
47. As a world author, I want an inactive value to keep its light fill and its header, so that I still see where each value starts and ends.
48. As a world author, I want the active value to carry one thin outline, so that I know which value I am in without a loud frame.
49. As a world author, I want to see the caret at the very start and the very end of a value, so that I know where my next keystroke lands.
50. As a world author, I want the caret to stand out against the value's fill, so that a chip's color never hides it.
51. As a world author, I want a value made active by a header click to carry the same thin outline, so that active looks the same however I got there.
52. As a world author, I want a wrapped active value to keep one contiguous outline, so that the quieter look loses none of the shape's meaning.
53. As a world author, I want the outline to read in both themes, so that the quiet line is never invisible in dark or light.

## Implementation Decisions

### Off-list pins write to the pin

- An off-list pin is a pin with text and no value id. In an editor draw, pins come only from the values of
  other placeholders that the draw has picked, so the pin's home is always a placeholder value the bound
  placeholder store can update.
- The open-value draw reports, for a pinned chip, **which value laid the pin**: the carrying placeholder's
  id and the carrying value's id. The draw-pin record holds that source beside the text. Play-time
  resolution does not change.
- The field builds the write path from that source: a write replaces the text of the pin entry for this
  placeholder on the carrying value, through the same store update the value write-through uses. The pin's
  placeholder id stays. The pin gains no value id. The pinned placeholder's value list stays as it is.
- The identity that decides mirroring for an off-list pin is the pin itself: carrying placeholder, carrying
  value, pinned placeholder. Two chips that read the same pin open one editable copy and one mirror, by the
  existing rule.
- A pin that names a listed value keeps today's path and writes to that value.
- The trim rule holds: stored pin text never starts or ends with whitespace. An emptied pin stays as an
  empty-text pin; this spec removes nothing.
- The parent spec's line "a pin whose value is typed off the list opens read-only" is replaced by this
  section. A pinned chip still shows no pager and never writes a roll.
- No export shape changes: a pin's text is an existing field.

### Active value

- A value is **active** when it holds the caret, or when its header took the last press and no value holds
  the caret. At most one value is active per field. The caret wins.
- A press on the header of a value that can take a caret puts the caret at the end of that value, through
  the same focus path "Edit Value" uses: focus the value's own editing island, then set the selection.
- A press on the header of a value that cannot take a caret (mirror, locked, read-only field) marks it
  active by click. That mark clears when any value takes the caret, when the caret moves into the field
  text, when another header is pressed, and when focus leaves the editor.
- The header still swallows the mouse press, so the browser never moves the caret on its own; the editor
  places it. The field's scroll position does not move.
- A chevron step keeps its value active. The step refills the value, as today, and then the caret returns
  to the end of the refilled value. Pending edge whitespace is dropped outside first, as today.
- The active mark drives the verbose header and the outline (see "Outline"), in place of today's caret
  mark. A value active by click shows the header and the outline, and no caret.

### Header as a pager

- Compact: `Name ‹ X/Y ›`. Active: `Name ‹ X/Y › · Verbose label`. A lock mark, when present, sits after
  the pager and before the verbose label.
- `X/Y` uses tabular figures, and the counter reserves the width of `Y/Y`, so the right chevron holds its
  place across every step of one placeholder.
- The verbose label is the value label the field already supplies. It is last so that its length never
  moves a control. The compact form keeps it as the hover tip and for assistive technology.
- No pager when there is nothing to step: a Variable, a pinned chip, a placeholder with no values. Those
  headers read `Name`, `Name · Pinned`, `Name · No Values`. The mark shows in both forms, since it is state
  and not detail.
- The counter carries an accessible name of the form "Value X of Y". The chevrons keep their names.
- The one-pass header layout, the box clamp, the slide and push rules, the corner rules and the traced
  outline do not change. The pager changes what a header holds, not where it goes.

### Outline

- **Inactive:** the traced shape draws its fill and no line. The fill keeps today's inactive strength. The
  header stays, so a value still reads as a value.
- **Active:** the traced shape takes today's inactive look whole: the thin line, mixed from the chip color
  and the foreground token, and the same light fill. The fill does not change between the two states, so
  activating a value adds a line and nothing else.
- Today's active look is removed: the thick line, the stronger fill, and the header's bright ring and
  brightness lift. The verbose header and the thin line mark the active value.
- The caret inside a value takes the foreground color, not the chip color. A chip-colored caret on a
  chip-tinted fill has too little contrast, and a thin line at the edge no longer covers it.
- The shape is still traced for every open value, since the fill needs it. Tracing, splitting on a wrap
  with no overlap, the square corner under the header, and the redraw triggers do not change.
- One rule still carries both themes. No rule animates.

### World | Unique on every placeholder chip

- The placeholder chip vocabulary offers the mode control for every known placeholder chip, and reports
  whether it is read-only. It is read-only when no roll can differ per placement: a Variable, and a plain
  Object none of whose values reach a Wildcard.
- The flyout renders a read-only control with its stored mode selected and its items disabled, and a help
  line under it that says why and what unlocks it. The line's copy follows the flyout's help voice.
- The stored token is shown as it is. A chip whose token says Unique shows Unique selected, read-only. The
  fix rewrites no tokens.
- A Wildcard's control is unchanged. Prompt-variable chips are unchanged.

## Testing Decisions

A good test drives the field the way an author does and asserts what the author sees or what the world
receives. It reads no Lexical node internals and asserts no pixel positions in jsdom.

The three seams of the parent spec carry all five fixes. No new seam.

**Component seam: the placeholder field under a bound placeholder store and rolls provider.** Prior art:
the field's write-through, duplicates, chevrons and edit-value tests.

- A placeholder with no values held by an off-list pin opens editable; typing updates the pin's text on the
  carrying value and adds no value to the pinned placeholder.
- An off-list pin on a placeholder that has values opens editable. A pin that names a listed value still
  writes to the value.
- No values and no pin stays locked and reads "No Values".
- Two chips that read one off-list pin open one editable copy and one mirror.
- A header press on an inactive value makes it the active one and lands the caret at its end.
- A chevron step leaves the stepped value active, with the caret inside it.
- A header press on a mirror and on a locked value makes it active with no caret; a press on another header
  moves the mark; a caret in the field text clears it.
- The compact header holds name, pager and no verbose label; the active header adds the verbose label after
  the right chevron. A Variable, a pinned chip and an empty placeholder show no pager.
- The counter reads "Value X of Y" to assistive technology.

**Component seam: the chip flyout.** Prior art: the variable node label and paste tests, and the edit-value
flyout test.

- A Variable chip's flyout shows World | Unique, World selected, items disabled, with the help line.
- A plain Object chip gets the same. A Wildcard chip's control still switches the token's mode.
- A token stored as Unique on a Variable shows Unique selected, read-only, and the token is unchanged.
- A prompt-variable chip shows no mode control.

**Pure seam: the draw.** Prior art: the placeholder resolver's tests. The open-value draw reports the
carrying placeholder and value for an off-list pin, and play-time resolution returns the same text as
before.

**Browser seam: Playwright, outside the four gates.** Prior art: the open-value header and edge specs.

- Both chevrons keep their screen position across steps through values whose verbose labels differ in
  length, including a step from `9/10` to `10/10`.
- A header going from compact to active moves nothing left of the verbose label.
- A header press lands real keyboard input in that value. A chevron step then a keystroke types into the
  stepped value.
- A header press does not scroll the field.
- An inactive value's shape has no visible line; the active value's shape has the thin one. Checked from
  computed styles on static frames, in both themes.
- With the caret at the start and at the end of an active value, the caret is visible in a static frame.

## Out of Scope

- Editing a pin laid by a trait, a location or a stat descriptor. An editor draw never reads those.
- Removing a pin, or turning an off-list pin into a listed value, from the Values tab.
- Adding or deleting values from the Values tab.
- Changing what the verbose label says. See Further Notes.
- Any change to header placement, to how the outline is traced, or to the edge-typing rules. Only the
  outline's paint changes.
- Any change to the stored world shape or to any stored token.

## Further Notes

- The verbose label today reads "Value N", which repeats the counter's `X`. With the pager in place it adds
  little. This spec keeps it and moves it last, so a richer label can replace it later with no layout work.
  What that label should say is the user's call.
- The plain Object case in the World | Unique fix is an extension of the user's Variable report, made on
  the same reasoning: the chip can only be World, and the flyout should say so. Drop story 40 and the
  Object clause if Objects should keep today's hidden control.
- Two parts of the outline fix go past the user's words, on the same reasoning. The header's bright ring
  and brightness lift go with the bright line, since they are the same loud active look. The caret takes
  the foreground color, since a chip-colored caret on a chip-tinted fill is the other way the caret gets
  lost. Drop either if the user wants only the line changed.
- Ticket 07 of the parent spec still awaits the user's visual approval. The pager changes the header's
  content, so that approval should happen after this spec lands, not before.
