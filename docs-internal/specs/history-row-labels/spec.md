# History Row Labels

Status: ready-for-agent
Spec session: history-row-labels — spec

## Problem Statement

The World Editor's History popover lists each Step as one flat label, such as "Edit Location Arcadia - Royal Castle: Description". The row truncates that string at its end. The end is usually the field, which is the part that tells two rows apart. Three edits to one location's description, background image and ambient sound all read "Edit Location Arcadia - Royal Cas…".

The label also gives no sign of which words are the author's. "Remove Placeholder PM1 Tags" can mean a field called Tags or a placeholder called "PM1 Tags". "Edit Stat Level" reads like a field called Level, not a stat named Level.

The list scrolls in a native browser scrollbar. That does not match the Design System's scrollbar standard.

## Solution

- **The label is split into parts:** verb, type, name and field. Each part is styled and truncated on its own.
- **Two lines per row.** The first line shows the record's name in italics, followed by the field as a small bordered chip. The second line shows the verb and type, smaller and muted.
- **Only the name truncates.** The verb, the type and the field chip always show in full. A long name gives up its space first.
- **A row with no name stays on one line**, for example "Reorder Stats", "Edit Traits", or a labeled operation such as "Import Lorebook".
- **A dedicated row tip shows the whole label.** It has the same order and styling as the row: the italic name, the field chip, then the muted verb and type. It never truncates, and the name wraps.
- **The popover is wider:** 20rem instead of 18rem.
- **The list scrolls in the shared ScrollArea**, with the arrowless 10px thumb from the Design System.

The prototype that settled this is on branch `prototype/history-labels` at commit `0f0cdae0`, launch entry `proto-history-labels` (port 5253). Toggles live in a floating bar and in the URL (`hl=`, `sep=`, `hw=`). The chosen set is the prototype's default. Open it at `#dev?view=mainMenu&modal=worldEditor&history=open`.

## User Stories

### Reading a row

1. As an author, I want each History row to show the field it changed, so that I can tell apart several edits to one record.
2. As an author, I want the field to stay visible on a long record name, so that truncation never hides the part that differs between rows.
3. As an author, I want the record's name set apart from the label's fixed words, so that I can see which words are mine.
4. As an author, I want "Edit Stat" plus a stat named "Level" to read as a stat named Level, so that I don't take the name for a field.
5. As an author, I want the name to be the most prominent text in the row, so that I find a record by scanning names.
6. As an author, I want the verb and type muted on a second line, so that they give context without competing with the name.
7. As an author, I want the field shown as a small chip, so that it reads as a property of the record, not part of its name.
8. As an author, I want Add, Edit, Remove and Reorder to keep their words, so that the row says what happened in plain language.
9. As an author, I want a row with no record name (for example "Reorder Stats") on one line, so that it doesn't repeat its own words.
10. As an author, I want a labeled operation (for example "Import Lorebook") shown as its label, so that a multi-slice operation reads as one action.
11. As an author, I want a World overview edit to read as World plus its field (for example the Description chip), so that overview edits look like every other row.
12. As an author, I want a dictionary entry edit to say Entry, not Dictionary, so that I know an entry changed and not the book.
13. As an author, I want a placeholder Copy edit to name the Copy, so that I can find the edited Copy.

### Truncation and the tip

14. As an author, I want a long name to end in an ellipsis, so that the row stays one width.
15. As an author, I want to hover a row and see the whole label, so that I can read a name the row cut off.
16. As an author, I want the tip to look like the row, so that I don't have to translate between two formats.
17. As an author, I want the tip to wrap a long name instead of cutting it, so that I can read all of it.
18. As an author, I want the tip to open beside the list, so that it doesn't cover the rows I'm comparing.
19. As an author, I want the tip to use the app's themed tooltip look in both themes, so that it fits the rest of the editor.

### Undone rows and markers

20. As an author, I want undone rows still dimmed, so that I can see where the cursor stands.
21. As an author, I want the muted verb and type to dim along with an undone row, so that a muted part never looks brighter than the rest of its row.
22. As an author, I want the current row's Now marker kept, so that I can see where I am.
23. As an author, I want the Saved marker kept between rows, so that I can see where I last saved.
24. As an author, I want the World opened head row unchanged, so that I can still jump back to the start.

### Scrolling

25. As an author, I want the History list to scroll with the editor's own scrollbar, so that it matches every other list.
26. As an author, I want the list capped at half the screen height, so that a long history doesn't run off the screen.
27. As an author, I want the current row scrolled into view when the list opens, so that I don't have to search for it.
28. As an author, I want wheel and touch scrolling to work in the list inside the editor dialog, so that I can reach old Steps.

### Accessibility

29. As a screen reader user, I want each row announced in the label's natural order ("Edit Entity, name, Player Description"), so that the two-line layout doesn't scramble the sentence.
30. As a screen reader user, I want undone rows still announced as undone, so that I know which Steps a click restores.
31. As a keyboard user, I want a truncated row's tip to open on focus as well as on hover, so that I get the same information without a mouse.
34. As an author, I want no tip on a row that already shows in full, so that hovering the list doesn't repeat what I can read (Q1).

### Mobile

32. As a mobile author, I want the same row layout in the History icon's popover, so that the list reads the same on every device.
33. As a mobile author, I want the popover to stay inside the screen at its new width, so that no row runs off the edge.

## Implementation Decisions

- **Label parts are a pure function.** The History label module gains `stepLabelParts(step)`, which returns the parts. `stepLabel(step)` stays and joins them, and its output does not change, byte for byte. Every existing caller of the flat string keeps working: the Undo and Redo tips, tests, and any announcement. The shape below comes from the prototype:

  ```ts
  export interface StepLabelParts {
    verb: string;          // Add · Edit · Remove · Reorder, or a batch label in full
    type?: string;         // singular or plural slice type name; "Entry" for a book's entry
    slice?: SliceName;
    name?: string;         // the record's own name; empty names become undefined
    field?: string;        // already resolved through the field labels
  }
  ```

  A labeled Step (`step.label`) returns `{ verb: label }` with no other parts.
- **The History view carries parts.** The view's rows become `StepLabelParts`, not strings. The world history hook maps Steps through `stepLabelParts`. The design-system reference builds its rows the same way.
- **The row renders the parts.** A named row has two lines. Line one is the name (italic, `min-w-0 truncate`), then the field chip (`shrink-0`). Line two is the verb and type at the meta size. A nameless row has one line: verb, type, then the field chip when there is one. The row keeps `MENU_ROW`, the Now marker, the `(undone)` screen-reader text and `aria-current`.
- **Muting uses opacity, not a gray color.** The verb, type and separators use reduced opacity. Undone rows are dimmed by color at the row, so a gray on a child would show brighter than its dimmed row. Opacity stacks with the row's dimming. A nameless row is not muted.
- **The row's accessible name is the joined label.** The row button gets `aria-label` set to `stepLabel` text, so assistive technology reads the natural sentence, not the visual line order.
- **The row tip is History's own, not the shared `Tip`.** The shared `Tip` takes a string only, and its text also becomes the control's accessible name. The History row tip uses the Base UI tooltip parts directly (Root, Trigger, Portal, Positioner, Popup), which the app's tooltip module already exports. It opens on the left side. It renders the same parts and styling with no truncation: the name wraps (`break-words`), the chip wraps to the next line when needed, and the popup is 18rem wide at most. It takes the provider's shared delay.
- **Popover width is 20rem**, keeping the existing `max-w-[90vw]` cap for narrow screens.
- **The list scrolls in `ScrollArea` with `max-h-[50vh]` on the ScrollArea itself.** This replaces the native `overflow-y-auto` box, and the file's `scroll-guard: allow popover-list` comment is removed. The popover is not portaled (`portal={false}`), so the dialog's wheel lock does not intercept it. The prototype checked this live: the viewport was capped at 325px over 656px of content and scrolled, with no native scroller left.
- **New visual pattern.** The two-line row with an italic name and a field chip is a new pattern. The user approved it in the prototype review on 2026-10-08. The Design System reference for History controls shows it.

## Testing Decisions

- A good test drives the public surface and asserts what an author sees or what assistive technology reads. It never asserts class names, element counts or the internal order of spans.
- **Seam 1, the label function.** The existing History label tests cover `stepLabelParts` for every Step shape: keyed record edit with a field; add and remove; nested placeholder Copy; dictionary entry ("Entry"); World overview with one field and with several fields; multi-record edit (plural type, no name); reorder; labeled batch; and an empty-name record (no name part). One test per shape also asserts that `stepLabel` equals the joined parts, which pins the unchanged flat text. Prior art: the History label tests next to the label module.
- **Seam 2, the rendered History list.** The HistoryControls design-system reference tests and the World Editor history tests drive the real popover. They assert:
  - a named row's accessible name is the full joined label;
  - the name and field are both present for a long name;
  - a nameless row renders its verb and type once;
  - undone rows still carry the undone text;
  - hovering or focusing a truncated row opens a tip that contains the full, untruncated name and the field, and a row shown in full opens none (Q1). jsdom has no layout, so the truncation check is driven through a stubbed measurement.

  Prior art: the existing History popover tests in both files.
- **Prove the guards bite.** Reinstate the old flat `{label}` span and confirm the accessible-name and field-present tests fail. Reinstate the native scroll box and confirm the scroll guard fails without its allow comment.
- **Live check through `verify-ui`.** Use the `history=open` dev route at a realistic viewport, in both themes, since muting changes color. Check one long name, one nameless row and one undone row.

## Out of Scope

- Merging consecutive edits to the same record and field into one row.
- Verb icons, verb colors and type icons. The prototype tried them, and they were not chosen.
- Middle truncation of names.
- The scroll guard and Design-System doc changes that stop native popover scrollers from coming back: the sample allow comment the doc shows, the `popover-list` category, and a sweep of the other 9 files that carry it. Those are a separate decision.
- Widening the shared `Tip` to accept rich content.

## Further Notes

- **Q1 (2026-10-08): the row tip opens only when the row is truncated.** A row whose name and field show in full gets no tip, on hover or on focus. Its accessible name already carries the full label.
- The prototype branch stays as the primary source. Its sample rows (long names, long fields, nameless and labeled Steps) are a good fixture set for the render tests.
- No export shape changes. History Steps are session-only.
