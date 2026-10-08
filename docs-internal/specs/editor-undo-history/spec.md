# Editor Undo, Redo and History

Status: ready-for-agent
Spec session: editor-undo-history — spec

## Problem Statement

The World Editor has no undo. An author who deletes a stat, drops a thumbnail, removes a list item, or changes a world setting has one way back: reopen the world without saving and lose every edit since the last save. Only two corners remember anything. The Locations Canvas keeps its own stack for canvas edits, and each prompt field keeps Lexical's stack for its own text. Neither reaches the rest of the editor, and Ctrl+Z over a stat list does nothing.

Every field writes to the world as the author types, so a slip is in the world the moment it happens. The author cannot see what changed, cannot step back through it, and cannot tell where the last save sits in the run of edits.

## Solution

- **One stack for the world.** Every write to the open world's data lands in the world context. A history layer watches the committed world and records each change as a Step: the slice it rewrote, as it was and as it became. Undo writes the earlier records back; redo writes the later ones. The Locations Canvas's own stack becomes a client of this one, so the canvas and the lists share one Ctrl+Z.
- **Steps that match intent.** A typed run is one Step until the author pauses. A slider drag is one Step from press to release. An operation that rewrites several slices at once is one Step. Nothing the author would call one action takes two presses to undo.
- **Chords everywhere in the editor.** Ctrl+Z undoes. Ctrl+Y and Ctrl+Shift+Z redo. A focused prompt field undoes its own text first and hands the press to the world when its own stack is empty. A dialog over the editor suppresses the chords.
- **A History popover.** The app bar carries a split control: Undo, Redo, and a chevron that opens the list. The list shows every Step, the current one marked, undone Steps dimmed, and a Saved marker where the author last saved. Clicking any row moves the world to that point.
- **The editor shows what came back.** An undo opens the tab of the record it restored and selects it.

The prototype that settled the app-bar layout is on branch `prototype/editor-history-bar` at commit `ba8acd8c`, launch entry `proto-editor-history-bar`, variants switched with `proto=A|B|C` in the `#dev` hash. Desktop takes variant B, mobile takes variant A's header.

## User Stories

### Undo and redo

1. As an author, I want Ctrl+Z to undo my last edit anywhere in the editor, so that a slip costs one press.
2. As an author, I want Ctrl+Y and Ctrl+Shift+Z to redo, so that the chord I know from other editors works here.
3. As an author, I want removing any record in any of the world's twelve slices (stats, locations, connections, entities, entity groups, traits, trait groups, stat updates, books and entries, placeholders, placeholder groups, overview fields) to be undoable, so that a wrong delete is not a reload.
4. As an author, I want adding or removing an image, a thumbnail, a VRM or a BGM to be undoable, so that a wrong drop is not a reload.
5. As an author, I want a change to a world setting on the Overview tab to be undoable, so that settings are as safe as lists.
6. As an author, I want a drag that moved several locations on the Locations Canvas to undo in one press, so that the canvas keeps the one-step feel it has today.
7. As an author, I want a reorder in a list to undo in one press and restore the old order, so that I can try an order and step back.
8. As an author, I want removing a trait that also dropped its Links to undo in one press, so that a cascade is one action both ways.
8a. As an author, I want an undone delete to put the record back where it was in the list, so that undo restores order as well as content.
9. As an author, I want Optimize Images to undo in one press, so that a whole pass is one action.
10. As an author, I want a run of typing in one field to undo as one Step, so that I do not press once per letter.
11. As an author, I want a slider drag to undo to the value before I pressed, so that undo never walks through every tick of the drag.
12. As an author, I want a new edit after some undos to drop the undone Steps, so that history stays one line I can read.
13. As an author, I want the last 100 Steps kept, so that a long session still has a deep history without growing without end.
14. As an author, I want undo to work when the editor is open during play, so that a slip mid-session is as safe as one in the menu.
15. As an author, I want the stack to clear when I close the editor, so that an old world's history never applies to a new one.

### Text fields

16. As an author, I want Ctrl+Z inside a prompt field to undo my typing in that field first, so that the field behaves as a text editor does.
17. As an author, I want the press to fall through to the world when the field has nothing left to undo, so that one chord reaches everything from one place.
18. As an author, I want Ctrl+Z inside a plain input bound to the world to undo through the world stack, so that the History list and the field agree.
18a. As an author, I want Ctrl+Z inside a filter box or the search field to keep the browser's own undo, so that an input that is not the world behaves as any input does.
18b. As an author, I want Ctrl+Z to do nothing while I am composing with an IME, so that a composition is never cut in half.
19. As an author, I want a field's own undo to never show up as a Step in History, so that the list only holds what I did.
19a. As an author, I want a world undo that restores text into the field I am in to not become a text-undo entry, so that the next Ctrl+Z moves on instead of undoing the undo.

### History popover

20. As an author, I want Undo and Redo buttons in the app bar, so that I can undo without a keyboard.
21. As an author, I want the buttons disabled when there is nothing to undo or redo, so that the state is visible at a glance.
22. As an author, I want a tooltip on each button that names the chord, so that I learn the shortcut from the control.
23. As an author, I want a chevron beside Undo and Redo that opens the History list, so that the three sit as one control.
24. As an author, I want each Step labeled with the action, the type, the record's name and the field when one field changed, so that I can pick a target row without guessing.
25. As an author, I want the current Step marked, so that I know where I stand.
26. As an author, I want undone Steps shown dimmed below the current one, so that I can see what redo would bring back.
27. As an author, I want to click any row and have the world move to that point, so that a jump of ten Steps is one click.
28. As an author, I want a Saved marker in the list, so that I can see which Steps are not yet saved.
29. As an author, I want saving to leave the stack alone, so that I can undo past a save and the world simply reads as dirty again.
30. As an author, I want the list to scroll inside the popover when it is long, so that the popover never outgrows the window.
31. As an author on mobile, I want one History icon in the header, so that the header keeps its room for the controls it has.
32. As an author on mobile, I want Undo and Redo at the head of the History popover, so that both are two taps away without a keyboard.

### The editor follows undo

33. As an author, I want an undo on another tab to switch to that tab and select the record, so that I see what came back.
33a. As an author, I want an undo that removes the selected record to clear the selection on that tab, so that the panel never shows a record that is gone.
33b. As an author, I want an undo of a connection edit to open the Locations tab and select the connection on the canvas, so that a connection is revealed where it lives.
33c. As an author, I want an undo of an overview field to open the Overview tab, so that world settings are revealed too.
34. As an author, I want an undo of a canvas move to show the move on the canvas and in the list, so that both surfaces agree.
35. As an author, I want a field I am editing to show the restored text after an undo, so that the panel never lags the world.
36. As an author, I want the chords to do nothing while a dialog is open over the editor, so that the world never changes behind a dialog.
37. As an author, I want the canvas's existing Ctrl+Z to keep working, so that nothing I know about the canvas changes.
37a. As an author in the Authoring Tour, I want my edits recorded but the chords and the pill disabled until the tour ends, so that the tour's own steps are never undone by accident.

### Authoring tools that must not change

38. As an author, I want library book and entity editors to behave as they do today, so that the world stack never records edits to a library item.
39. As an author, I want Test Bench findings to update after an undo as they do after any edit, so that the Bench never shows a stale world.
40. As an author, I want the dirty flag to follow undo, so that Save enables and disables as the world matches or leaves the baseline.
41. As an author, I want the Design System showcase's canvas to keep its own isolated stack, so that the showcase never records into an open world.
42. As an author, I want the Formaquestion mascot tab's undo to keep working, so that the shared chord helper's move changes nothing there.

## Implementation Decisions

### Rulings

| # | Ruling |
|---|---|
| Q1 | A focused Lexical field undoes first. When its own stack is empty, the press falls through to the world stack. |
| Q2 | One stack. The canvas history module generalizes into the editor history; the canvas records through it. |
| Q3 | One effort: the stack, the chords and the History view. |
| Q4 | The stack clears when the editor closes, including the in-game dialog. Opening another world clears it. |
| Q5 | World data only. Editor preferences (snap, grid, pane widths, rail state, selection, mode) are never Steps. |
| Q6 | Undo and redo reveal the record they touched: switch to its tab and select it. |
| Q7 | Linear history. A new edit after undos drops the future. |
| Q8 | The stack keeps 100 Steps. |
| Q9 | Typing merges into one Step until a pause of 1000 ms. The module takes the pause as a parameter. |
| Q10 | A plain input bound to the world with focus: the world stack owns Ctrl+Z and the browser's native undo is suppressed. Inputs not bound to the world (filter boxes, Search World, the find bar) keep native undo and the listener yields. |
| Q11 | Writes in one event-loop tick fold into one Step. Async operations wrap in an explicit labeled batch. |
| Q12 | The History view is an app-bar popover. |
| Q13 | Undo works in-game with the same behavior. |
| Q14 | Save adds a marker to the list and clears nothing. Discard runs only on exit, from the editor's own close and from the in-game host's close, and both clear the stack, so it needs no rule. |
| Q15 | Desktop: variant B, the split pill (Undo, Redo, chevron) at the head of the app bar's end slot. Mobile: variant A's header, one History icon whose popover carries Undo and Redo in its head. |
| Q16 | Labels: action, type, name, and the field when one field changed. "Edit Stat Hunger: Description", "Remove Location Docks". |
| Q17 | The app bar was prototyped before the spec. |
| Q18 | Chords are suppressed while a surface opened after the editor is on the surface registry. The in-game host dialog is opened before the editor and never suppresses. |
| Q19 | Drags are one Step through an explicit group begin and end. Keyboard nudges and stepper clicks follow the pause rule. |
| Q20 | Undone Steps are shown dimmed and clickable. |
| Q21 | During the Authoring Tour, Steps and Saved markers are recorded, but the chords, the pill, the popover and reveal are disabled until the tour ends. |

### The history module

- The canvas history module becomes the editor history module. A Step carries one or more slice edits, each the slice's records as they were and as they became, plus the slice's id order on both sides. The Formaquestion mascot tab keeps the chord helper it imports from this module.
- **Restore is order-aware.** Undo rebuilds the slice in the Step's earlier id order, puts each touched record back as it was, drops the ones the Step added, and keeps every untouched record where it stands now. A reorder undoes to the old order; an undone delete returns the record to its old place. An edit to another record made between a Step and its undo survives, as it does on the canvas today.
- Eleven slices are record arrays. The overview slice is one object: its Steps store the object whole on both sides and restore by field.
- The module keeps `record`, `undo`, `redo`, and gains `jumpTo` for the list, `beginGroup` and `endGroup` for drags, and the Saved marker. Merge precedence, highest first: an open group swallows every write until it ends; a keyed write merges into the previous Step when the key matches and that Step is younger than the pause; writes committed in one tick fold into one Step. A folded Step carries the key of its first write, so a keyed run merges into it.
- The list's head row, World opened, is fixed. It is not a Step, does not count toward the cap, and jumping to it restores the loaded baseline.
- Labels are a pure function of a Step and its key: the action, the type name of the slice, the record's display name, and the field's label when the key names one field. A Copy placeholder edit inside an entity or a book is keyed to the placeholder, so it labels as the placeholder, not the owner. Overview Steps label as "Edit World: Field". The field-label table lives beside the module.
- The stack is held by the world provider for the open world and cleared on editor close. The Design System showcase's canvas gets an isolated instance. It is session memory only. No world or save shape changes.

### The recorder

- Every action is a deferred React setter, so nothing can be captured around the call. The recorder runs after commit: a layout effect in the world provider diffs the twelve committed slices against the last snapshot it recorded, by reference, and records what changed. It therefore sees every write, including the ones that do not go through the actions object: the Links-follow pass that rewrites entities a render after a trait or placeholder write, the placeholder list setter, and the dictionary store's own setters.
- Writes carry intent to the recorder through a small side channel set before the setter runs: a merge key (record id and field), an explicit group or batch label, or a flag. The Links-follow pass folds into the Step of the write that caused it. Save's link stamps are flagged and never recorded; undo past a Saved marker compares against the stamped baseline by content, so a restored unstamped record that matches by content reads clean. Undo and redo writes are flagged.
- The recorder arms after load sets the baseline and disarms before discard and close. Load, save, discard, metadata and ownership calls never record; save adds the marker.
- Merge keys: a per-record update names the record and its one changed field. The function-taking entity edit and a partial overview update derive the field from the keys that changed, one key means a field key, more means none. Whole-slice setters carry a key only when the caller passes one, as the canvas does for travel hints and must for keyboard nudges.
- Optimize Images runs as an explicit batch labeled as such, opened after its dialog closes.
- The provider exposes the history through one hook: can undo, can redo, the Steps with the cursor and markers, and undo, redo, jump. The pill, the popover, and the tests read it there.
- The library's book and entity editors use their own stores and never reach the recorder.

### Chords and focus

- One capture-phase listener in the editor reads the chord. It yields when a surface opened after the editor is on the surface registry, when the tour is running, when the event is composing, when the active element is an input not bound to the world, and when the active element is a Lexical field that reports it can undo in the asked direction.
- A Lexical field reports whether it can undo and redo, and marks the writes its own history makes by reading the historic tag on the update. The recorder treats a marked write as a cursor move on the Step it matches by key and content, and as a plain write otherwise, so a field's undo never appears in the list and a fall-through lands where the field left the text.
- A world undo or redo that restores a field's value rebuilds the field with Lexical's history-merge tag, so the restore never becomes a text-undo entry.
- A world-bound plain input gets its default prevented so the browser's native undo never runs.
- The canvas's own chord reader is removed; the shared listener serves it.

### Reveal

- A Step records the ids it touched. After undo or redo the editor opens the tab that owns the first touched record and selects it, through the same reveal path the find bar and Take Me There use. A touched record that is gone clears that tab's selection. A connection reveals the Locations tab and selects the connection on the canvas. An overview field reveals the Overview tab. Reveal is skipped while the tour runs.

### App bar

- Desktop: a split pill at the head of the end slot, before the mode select. Three joined faces: Undo, Redo, and a chevron that opens the popover. Each face carries a tooltip naming the chord. Faces disable at empty boundaries.
- Mobile: one History icon in the header, between the mode select and the Bench. Its popover head holds Undo and Redo.
- The popover lists World opened, every Step, the Saved marker, and the dimmed future, with the current Step marked. Rows use the menu row style and the list scrolls inside the popover. The popover is not portaled, like the Bench popover, so it works inside the in-game dialog.
- The split pill is a new visual pattern approved through the prototype. The Design System gets the pattern entry and the showcase a reference.

### Dev route

- `#dev?modal=worldEditor&history=open` opens the popover. The route registry lists it.

## Testing Decisions

A good test drives the seam an author would and asserts what the author would see: the world's records after undo, the button state, the list rows, the selected record. Tests never read the stack's internal arrays and never assert on a wrapper's call count.

Three seams, no new ones:

1. **The history module**, called directly. Record, undo, redo, jump, order-aware restore (reorder, delete returns to its place, an interleaved edit survives), merge by key and pause, group begin and end, precedence, the cap, the Saved marker, labels. Prior art: the canvas history tests.
2. **The world context provider.** Render the provider, write through actions, undo through the exposed history hook, read the world back. The Links-follow fold, same-tick folding, explicit batches, flagged writes, load arming the recorder, save's marker and stamps, and the canvas's whole-slice commits with and without a key. Prior art: the context's actions and save-baseline tests.
3. **The rendered editor bench.** Chords from a list, from a world-bound input, from a filter box, from a Lexical field with and without its own history, under a surface opened above the editor, in the in-game host, and during the tour. Lexical is driven through the composer's undo command and update calls, since jsdom does not simulate contenteditable input. The split pill's disabled states and tooltips. The popover's rows, the Saved marker, the dimmed future, row click. Reveal after undo on another tab, and the cleared selection for a gone record. Bench findings after an undo, with the pass's debounce advanced. Prior art: the Ctrl+S save shortcut test and the tour tests on the editor bench.

Canvas drag itself is not driven in jsdom. The canvas's recording is proved at seam 2 through its commit path, and in the browser through the existing Playwright canvas suite.

Every guard proves it bites: a test that a drag is one Step fails when the group is removed; a test that a field's undo is not a Step fails when the historic tag is ignored; a test that a reorder undoes fails when restore ignores order.

## Out of Scope

- Branching history. A new edit drops the future.
- History for the library's book and entity editors.
- Undo for editor preferences: snap, grid, pane widths, rail state, mode, selection.
- Persisting the stack across editor close, reload, or in the world or save file.
- Undo inside gameplay (narration, turns). The game has its own rewind.
- A History panel hosted like the Test Bench. The popover is the view.

## Further Notes

- The pause rule and the gesture rule follow the convention other editors settled on: continuous controls commit one entry on release; typing coalesces by time. The research links are in the grilling transcript.
- Two stacks touch in one place: a Lexical field's history-driven writes, and the history-merge rebuild on restore. That sync is the riskiest piece and deserves its own ticket.
- A review agent read the first draft against the code; its findings shaped the recorder, the order-aware restore, the Lexical rules and Q21.
- Images are inline base64 strings shared by reference between Steps, so the 100-Step cap bounds memory near one world copy plus the changed images.
