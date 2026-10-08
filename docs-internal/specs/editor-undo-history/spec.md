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
| Q14 | Save adds a marker to the list and clears nothing. Discard runs only on exit, and the editor's unmount on either host clears the stack, so it needs no rule. |
| Q15 | Desktop: variant B, the split pill (Undo, Redo, chevron) at the head of the app bar's end slot. Mobile: variant A's header, one History icon whose popover carries Undo and Redo in its head. |
| Q16 | Labels: action, type, name, and the field when one field changed. "Edit Stat Hunger: Description", "Remove Location Docks". |
| Q17 | The app bar was prototyped before the spec. |
| Q18 | Chords are suppressed while a surface opened after the editor is on the surface registry, read as "the registry's top dialog is not the editor". The in-game host dialog is opened before the editor and never suppresses. |
| Q19 | Drags are one Step through an explicit group begin and end. Keyboard nudges and stepper clicks follow the pause rule. |
| Q20 | Undone Steps are shown dimmed and clickable. |
| Q21 | During the Authoring Tour, Steps and Saved markers are recorded, but the chords, the pill, the popover and reveal are disabled until the tour ends. |
| Q22 | Merge rules only merge; none splits. Order: open group, then key match within the pause, then same tick. A keyed write with a non-matching key in the same tick folds into that tick's Step, which keeps its first write's key. |
| Q23 | A key or tick merge never crosses the Saved marker. Undo, redo and jump seal the top Step, so the next write starts a new one. An open group still swallows. |
| Q24 | When the cap drops the oldest Step, its edits fold into the next Step's undo, label unchanged, so the World opened row still restores the loaded baseline. |
| Q25 | Modals opened from the editor that report no surface (image replace, code rename offer, Replace All confirm) get surface ids, and the listener also yields to any open modal above the editor as a backstop. Ticket 05. |
| Q26 | A write that changes several fields of one record keeps the record key with no field. A typed rename that also rewrites descriptors merges as one Step, labeled with the record alone. |
| Q27 | A dictionary entry edit is keyed to the entry, not its book, and labels as "Edit Entry <name>: <field>". Labels name the thing the author edited, as for Copy placeholders. |
| Q28 | Continuous controls: the Slider and ColorPicker primitives open a group on press and close it on release as a transition-priority update, when a world is open. They read a gesture leaf the world provider fills after load, so the account site bundle never pulls the recorder. Optimize Images batches around the apply only, after its prompt resolves. Ticket 04 owns the stamp flag; ticket 08 owns the Saved marker and the content compare. Entry field labels follow the editor's own labels ("Value"). |
| Q29 | A marked (field-history) write whose key matches the top applied Step but whose content matches neither side merges into that Step regardless of the pause: no new Step, no cursor move, the Step's after follows the field. A marked write that reaches the Step's before moves the cursor back; a field redo that reaches the next Step's after moves it forward. A sealed top blocks the merge only; a cursor move on a matching side still happens. No key match: a plain write. The list never grows during a field's own undo or redo. |
| Q30 | World-bound plain inputs opt in with a `data-world-field` attribute. An unmarked input keeps native undo and the listener yields, so a missed input keeps today's behavior. |
| Q31 | One-line chip fields (record names, placeholder names) are Lexical fields and follow Q1, not Q10. Q10 covers the plain inputs only, including number boxes, pronouns, entity type, book name and description, group names, world name and author, travel hints, openings, trait and placeholder values, and scan depth. Ticket 05's stat-name criterion reads as the stat's Max box. |
| Q32 | A world restore into a field clears the field's own undo and redo stacks as well as rebuilding with the merge tag. The tag alone left stale redo entries that turned the next Ctrl+Y into a plain write. |
| Q33 | A field's own undo moves the cursor only past a Step that holds that field alone. Otherwise it merges into the Step (Q29), so a Step's other edits (a tick fold, Links-follow) never stay in the world while the Step reads as undone. |
| Q34 | Q6 stands on mobile: a reveal in the Locations canvas view selects the location and pushes its detail panel over the canvas, as a tap does. The e2e canvas test closes the panel after each undo. |
| Q35 | A reveal of a location already in the canvas's multi-selection keeps the whole selection. A location outside it replaces the selection, as today. An undo of a group command never collapses the author's selection. |
| Q36 | A field-driven cursor move seals the top Step (Q23), and the seal records its origin. The Q29 join ignores a seal a field move set, so a field walk through Lexical's finer entries never grows the list. A plain keyed or tick merge respects every seal. A field join that cuts Steps drops a Saved marker on them. |

### The history module

- The canvas history module becomes the editor history module. A Step carries one or more slice edits, each the slice's records as they were and as they became, plus the slice's id order on both sides. The Formaquestion mascot tab keeps the chord helper it imports from this module.
- **Restore is order-aware.** Undo rebuilds the slice in the Step's earlier id order, puts each touched record back as it was, drops the ones the Step added, and keeps every untouched record where it stands now. A reorder undoes to the old order; an undone delete returns the record to its old place. An edit to another record made between a Step and its undo survives, as it does on the canvas today.
- Eleven slices are record arrays. The overview slice is one object: its Steps store the object whole on both sides and restore by field.
- The module keeps `record`, `undo`, `redo`, and gains `jumpTo` for the list, `beginGroup` and `endGroup` for drags, the Saved marker, and the helpers tickets 05 and 08 added: the field-move cursor rule, the moved-text set, the stamped-record swap, the slice diff, the write key and the edit combiner. Merge precedence, highest first: an open group swallows every write until it ends; a keyed write merges into the previous Step when the key matches and that Step is younger than the pause; writes committed in one tick fold into one Step. A folded Step carries the key of its first write, so a keyed run merges into it.
- The list's head row, World opened, is fixed. It is not a Step, does not count toward the cap, and jumping to it restores the loaded baseline.
- Labels are a pure function of a Step and its key: the action, the type name of the slice, the record's display name, and the field's label when the key names one field. A Copy placeholder edit inside an entity or a book is keyed to the placeholder, so it labels as the placeholder, not the owner. Overview Steps label as "Edit World: Field". The field-label table lives beside the module.
- The stack is held by the world provider for the open world and cleared on editor close. The Design System showcase's canvas gets an isolated instance. It is session memory only. No world or save shape changes.

### The recorder

- Every action is a deferred React setter, so nothing can be captured around the call. The recorder runs after commit: a layout effect in the world provider diffs the twelve committed slices against the last snapshot it recorded, by reference, and records what changed. It therefore sees every write, including the ones that do not go through the actions object: the Links-follow pass that rewrites entities a render after a trait or placeholder write, the placeholder list setter, and the dictionary store's own setters.
- Writes carry intent to the recorder through a small side channel set before the setter runs: a merge key (record id and field), an explicit group or batch label, or a flag. The Links-follow pass folds into the Step of the write that caused it. Save's link stamps are flagged and never recorded; the stamped records are swapped into every Step by reference, so an undo past the Saved marker restores stamped records and the existing dirty check reads them clean. Undo and redo writes are flagged.
- Two save edges: a write that merges into the Step the save read leaves the marker unplaced, and an edit that lands while the save runs places the marker at the pre-save cursor without sealing.
- The recorder arms after load sets the baseline; disarm runs at load. The stack clears through the editor's unmount effect on both hosts. Load, save, discard, metadata and ownership calls never record; save adds the marker.
- Merge keys settle at commit: a writer names the record, and the recorder takes the one changed field or drops it when more changed (Q26). A linked copy's link mark does not count, so a linked entity's typed run stays one Step. Whole-slice setters carry a key only when the caller passes one, as the canvas does for travel hints and for keyboard nudges, whose key carries the selected ids as a list.
- The field-move check (Q33) compares every field the Step changed by content, since a rename's descriptors are rebuilt objects.
- Optimize Images runs as an explicit batch labeled as such, opened after its dialog closes.
- The provider exposes the history through one store, read through a subscribing hook (can undo, can redo, the Steps with the cursor and markers) and a stable-identity moves hook (undo, redo, jump), with an optional form for hosts outside a world. The pill, the popover, and the tests read it there.
- The library's book and entity editors use their own stores and never reach the recorder.

### Chords and focus

- One capture-phase listener in the editor reads the chord. It yields when a surface opened after the editor is on the surface registry, when the tour is running, when the event is composing, when the active element is an input not bound to the world, and when the active element is a Lexical field that reports it can undo in the asked direction.
- A Lexical field reports whether it can undo and redo, and marks the writes its own history makes by reading the historic tag on the update. The mark carries its tick, so a mark from a field outside the world never keys a later write. The recorder treats a marked write by Q29 and Q33, so a field's undo never appears in the list and a fall-through lands where the field left the text.
- A world undo or redo that restores a field's value rebuilds the field with Lexical's history-merge tag and clears the field's own stacks (Q32). Restored text is detected by string set: every string in every changed field on both sides of the move.
- A world-bound plain input gets its default prevented so the browser's native undo never runs.
- The listener is one hook. Its modal backstop reads the DOM: an open dialog or alert dialog later in the page, outside the key's layer, that is not a popover and not marked non-modal. Radix sets no aria-modal, and aria-hidden misses the editor root because the library keeps every container of a live region visible. A full-screen window that edits the world carries `data-world-window` and counts as its own layer, so chords stay live in the full-screen Locations Canvas and stop when a modal opens over it.
- The canvas's own chord reader is removed; the shared listener serves it.

### Reveal

- A Step records the ids it touched. After undo or redo the editor opens the tab that owns the revealed record and selects it, through the same reveal path the find bar and Take Me There use. Inside a Step the keyed slice leads, then add and remove edits, then slice order. A jump reveals the Step nearest the landing cursor, falling back inward.
- A touched record that is gone ends with that tab's selection cleared: reveal opens the tab, and each list editor drops a selection it no longer holds. A list editor that kept a stale id would break story 33a.
- A connection reveals the Locations tab and selects the connection on the canvas. A book edit selects the changed entry, else the book. An overview field reveals the Overview tab. Stat updates and tabs the mode hides reveal nothing. Reveal is skipped while the tour runs.

### App bar

- Desktop: a split pill at the head of the end slot, before the mode select. Three joined faces: Undo, Redo, and a chevron that opens the popover. Each face carries a tooltip naming the chord. Faces disable at empty boundaries.
- Mobile: one History icon in the header, between the mode select and the Bench. Its popover head holds Undo and Redo.
- The popover lists World opened, every Step, the Saved marker, and the dimmed future, with the current Step marked. Rows use the menu row style and the list scrolls inside the popover. The popover is not portaled, like the Bench popover, so it works inside the in-game dialog.
- The split pill is a new visual pattern approved through the prototype. The Design System gets the pattern entry and the showcase a reference.

### Dev route

- `#dev?modal=worldEditor&history=open` opens the popover. The route registry lists it.

## Testing Decisions

A good test drives the seam an author would and asserts what the author would see: the world's records after undo, the button state, the list rows, the selected record. Tests never read the stack's internal arrays and never count the recorder's commits.

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
- A review agent read the first draft against the code; its findings shaped the recorder, the order-aware restore, the Lexical rules and Q21. A second review at close compared the spec with the landed code; its findings reworded Q29, the recorder, chords and reveal sections and filled the Backlog.
- Images are inline base64 strings shared by reference between Steps, so the 100-Step cap bounds memory near one world copy plus the changed images.
- Prototype: branch `prototype/editor-history-bar` at `ba8acd8c`, worktree kept on disk. Cut the junction before any removal.
- Ticket 08's release gate is satisfied: it landed before any release carried ticket 02 (3.0.1 predates the effort).

## Backlog

- Groups do not nest: a drag during an open batch closes the batch early. A second press before the first drag's close commits shares one group. Both need sub-frame timing.
- Restored-text detection is a string set. The empty string and short values are in it after most moves, so a Lexical field rebuilt to one of them before the next recorded write is treated as restored and loses its own stacks.
- A write that merges into the Step the save read leaves the Saved marker unplaced.
- Mobile 390px no-wrap and both-theme frames for the pill and popover are unproved in jsdom; capture Playwright frames when the app bar next changes.
- The other full-screen shells (prompt and code fields, the panel shell) do not carry `data-world-window`, so a world chord that falls through from one of them in full screen is still dropped.
- Marquee selection counted 3 of 4 nodes on desktop once at close (the canvas e2e marquee case). It did not reproduce in 11 runs (6 alone, 5 in the full suite) on 2026-10-08. Cause not found. A suspect, UNVERIFIED: the marquee is drawn before the canvas's first fit settles, so a box sits outside the pane.
- Q21: the tour test proves the chords are off; it does not show the Step recorded during the tour.
- Story 4: entity image and BGM undo are covered only through the thumbnail reveal test.
