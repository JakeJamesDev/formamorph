# Placeholder Values Tab — Follow-Up Spec

Status: ready-for-human
Base: 7db25536
Status note: all six fixes built and reviewed — the first five in `e859440c` and `ede64f5c`, "Pins are stops" in `e73dda38` with its review folded in after. Parent spec is `spec.md` beside this file. Two spec checks have no running test and need a human call: story 49 (the caret visible at a value's edges) needs pixel sampling, and story 21 (focus leaving the editor) could not be driven in a browser. Story 63's discard and history are shared with the Pins section through one write path (`commitPinSource`) but have no test of their own. Ticket 07 of the parent spec still awaits visual approval, and the pager changes the header's content, so that approval belongs after this.

Six fixes to the Values tab and the chip flyout: every pin on a placeholder is a stop the chevrons reach
and an editable text, a header click makes its value active, the header becomes a pager whose controls
never move, only the active value carries an outline, and the World | Unique control shows read-only where
a chip can only ever be World.

## Problem Statement

An author who uses the Values tab hits six rough spots.

- A placeholder with no values of its own, held at a value by a pin, opens **locked** and reads "No
  Values". The pin is the only value that placeholder has, and the author cannot fix a word in it without
  hunting for the trait, location, stat band or value that carries the pin.
- The chevrons walk only the placeholder's own values. A pin a trait or a location lays is a value the
  placeholder takes in play, and the author cannot step to it, read it in the sentence, or edit it there.
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

- **Pins are stops.** The chevrons walk the placeholder's own values, then every pin on it, one stop per
  source, labeled by that source. A placeholder with no values opens on its first pin. Typing in a pin stop
  rewrites the pin's own text on its source, whether that is a trait, a location, a stat band or another
  placeholder's value. The pinned placeholder gains no value. Preview and every other field show the stop
  the author stepped to.
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

1. As a world author, I want a placeholder that has no values but is pinned by a trait, a location, a stat band or a value to open on that pin, editable, so that I can fix the pinned text where I read it.
2. As a world author, I want an edit to a pin stop to change the pin's own text on its source, so that the placeholder does not gain a value it never had.
3. As a world author, I want every chip that reads that pin to show my edit, so that one fix reaches everywhere.
4. As a world author, I want a placeholder that has values to offer its pins as stops after them, so that every pin on a placeholder is reachable from any field that uses it.
5. As a world author, I want a pin that names a listed value to be that value's stop and to keep writing to the value, so that nothing that works today changes and no stop repeats.
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
32. As a world author, I want a chip whose draw a pin decides to open on that pin's stop with the pager showing, so that I see which pin holds it and can still step to the other stops.
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
54. As a world author, I want a pin stop's label to name its source, such as "Pinned by Trait: Sworn", so that I know whose pin I am reading.
55. As a world author, I want the counter to count values and pins together, so that `4/6` tells me there are two pins after four values.
56. As a world author, I want a step onto a pin stop to show that pin in Preview and in every other field, so that the tabs and fields never disagree.
57. As a world author, I want a step off a draw-laid pin to show the stepped stop, so that the pin never traps the chevrons.
58. As a world author, I want a Variable that has pins to show the pager, so that its pins are reachable.
59. As a world author, I want two chips that read the same pin stop to open once and mirror once, so that two copies never fight over one caret.
60. As a world author, I want an emptied pin to stay an empty pin, so that clearing text never deletes a pin behind my back.
61. As a world author, I want undo inside a pin stop to restore the pin's text, so that a slip is one keystroke from fixed.
62. As a world author, I want a pin stop to be read-only in a read-only field, so that reading works where editing does not.
63. As a world author, I want a pin edit to save through the same path as the pin editors on the source, so that discard and history behave the same.

## Implementation Decisions

### Pins are stops

- **The stop list** of a placeholder is its own values in order, then every pin that targets it, in the
  order the world's pin rows already give: strongest source kind first, authored order within a kind. The
  pin rows come from the existing pin-row seam, which already names each pin's source, its authored name
  and its plain-text label.
- A pin that names a listed value id is not its own stop. It collapses into that value's stop, and an edit
  there writes to the value, as today. A pin with text and no value id is a stop of its own, whatever kind
  of source carries it.
- **Which stop a chip opens on:** the stop the author stepped to, else the pin the draw laid, else the
  draw's roll, else the first stop. Chosen-first is what makes an Object's arrows work: its draw ignores a
  step between its values. A chip whose draw a pin decides opens on that pin's stop. A placeholder with no values opens on
  its first pin. No values and no pins stays locked and reads "No Values".
- **A chevron step chooses a stop.** The rolls store's directed set widens from "this value id" to "this
  stop": a value id, or a pin named by its source and its target. The draw reads a chosen pin stop before
  it reads any pin the draw itself lays, so a step off a draw-laid pin shows the stepped stop, and Preview
  and every other field show it too. World placements share the choice per placeholder; Unique placements
  keep it per placement. A reroll clears the choice.
- **Editing a pin stop writes to the pin's text on its source**, through the same world update the
  source's own pin editor uses: a trait's pins, a location's pins, a stat band's pins or a value's pins. The
  pin's target stays. The pin gains no value id. The target placeholder's value list stays as it is. The
  edit reaches the world through the bound placeholder store's owner, so discard and history behave as
  they do for the pin editors.
- The identity that decides mirroring for a pin stop is the pin itself: source, target placeholder, and
  the pin's place on that source. Two chips that read the same pin stop open one editable copy and one
  mirror, by the existing rule.
- The trim rule holds: stored pin text never starts or ends with whitespace. An emptied pin stays as an
  empty-text pin; this spec removes nothing.
- The parent spec's rules "a pin whose value is typed off the list opens read-only" and "a pinned chip
  hides its chevrons" are both replaced by this section. A pinned chip shows the pager and its pin's stop.
- No export shape changes: a pin's text is an existing field on every source.

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
- No pager when there is one stop or none: a Variable with no pins, a placeholder with no values and no
  pins. Those headers read `Name` and `Name · No Values`. The mark shows in both forms, since it is state
  and not detail. A Variable with pins shows the pager. A chip whose draw a pin decides shows the pager
  when it has more than one stop; a Variable pinned to its own single value has one, and shows none.
- The counter counts values and pins together, values first. A pin stop's verbose label names its source
  in the pin row's plain-text form: "Pinned by Trait: Sworn", "Pinned by Location: Fen", "Pinned by
  Hunger ≤ 20", "Pinned by Mood = calm". The row's own label is the whole of it; no source kind gets a
  special spelling. A draw-laid pin the author has not stepped off keeps a "Pinned"
  mark in the compact form, since it is state.
- The counter carries an accessible name of the form "Value X of Y" on a value stop and "Pin X of Y" on a
  pin stop. The chevrons keep their names.
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

- A placeholder with no values pinned by a trait opens on that pin, editable; typing updates the pin's
  text on the trait and adds no value to the placeholder. The same for a location, a stat band and a value
  as the source.
- A placeholder with values lists its pins as stops after them; stepping past the last value reaches the
  first pin, and the counter reads values plus pins.
- A pin that names a listed value adds no stop and still writes to the value.
- A chip whose draw a pin decides opens on that pin's stop with the pager; a step off it shows the stepped
  stop in this field and in Preview.
- No values and no pin stays locked and reads "No Values".
- Two chips that read one pin stop open one editable copy and one mirror.
- A header press on an inactive value makes it the active one and lands the caret at its end.
- A chevron step leaves the stepped value active, with the caret inside it.
- A header press on a mirror and on a locked value makes it active with no caret; a press on another header
  moves the mark; a caret in the field text clears it.
- The compact header holds name, pager and no verbose label; the active header adds the verbose label after
  the right chevron. A Variable with no pins and an empty placeholder with no pins show no pager; a
  Variable with pins shows it, and so does a pinned chip with more than one stop.
- The counter reads "Value X of Y" to assistive technology.

**Component seam: the chip flyout.** Prior art: the variable node label and paste tests, and the edit-value
flyout test.

- A Variable chip's flyout shows World | Unique, World selected, items disabled, with the help line.
- A plain Object chip gets the same. A Wildcard chip's control still switches the token's mode.
- A token stored as Unique on a Variable shows Unique selected, read-only, and the token is unchanged.
- A prompt-variable chip shows no mode control.

**Pure seam: the draw and the rolls store.** Prior art: the placeholder resolver's tests and the rolls
store's tests. The open-value draw reports the source of a pin it lays; a chosen pin stop is read before a
draw-laid pin; a reroll clears the choice; play-time resolution returns the same text as before.

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

- Removing a pin, adding a pin, or turning a pin into a listed value, from the Values tab.
- Changing which pin wins in play. A pin stop is a view for reading and editing; the play-time pin order
  does not change.
- Adding or deleting values from the Values tab.
- Changing what the verbose label says. See Further Notes.
- Any change to header placement, to how the outline is traced, or to the edge-typing rules. Only the
  outline's paint changes.
- Any change to the stored world shape or to any stored token.

## Further Notes

- Open gap, carried over from the parent spec: a Unique chip nested inside another value gets no pager
  even when pins reach it, because a Unique drill has no placement key to step under. Not fixed here.
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
- "Pins are stops" replaces the first version of this spec's pin fix, which covered only a pin laid by
  another placeholder's value and put trait, location and stat pins out of scope. That cut was mine, and
  the user's original pitch for the feature was "swap between each value, including pins". The value-pin
  path already built stays valid as one kind of source.
- Ticket 07 of the parent spec still awaits the user's visual approval. The pager changes the header's
  content, so that approval should happen after this spec lands, not before.
