# Spec: Formaquestion Pass Two

Status: done
Status note: Closed 2026-10-04. Tickets 01–24 done; last landing 9b4df326. Closed without gates.
Spec session: formaquestion-pass-two — spec

## Problem Statement

The first pass of Formaquestion settings and the Mascot shipped as plain settings tabs. The Mascot tab reads like a list of rows, its live preview is a small strip at the top, the mask is set by drawing a box from scratch, and the transition controls with their Play button sit at the bottom of a long scroll where the preview is out of view. The layer list gives no read on what a layer does to the base. The mascot has one size, and it always stands left of the chat even when the chat is on the left edge of the screen.

The Endpoint tab stacks Answer and Pick as two full rows, then shows a preset editor with its own select. That select follows Answer until it is touched, then stops following it, so it reads as a second way to pick a route.

The Prompts tab lacks the Edit | Preview tabs that gameplay prompts have, and only the Answer prompt has options.

Lookup Mode (`read_guide`) is off by default, and nothing on the tab says why a player would turn it on.

The minimal chrome is tied to the Mascot switch: no way to pin it on or off. Its column has no resize grip, text is hard to read over busy screens, and its size is shared with the full window. Both chats lose the player when they scroll up through history: nothing brings them back to the end.

## Solution

**Mascot tab.** A two-column tab: a pinned live preview on the left, the rig controls scrolling on the right (stacked on mobile). The preview shows what is selected: a layer row shows the base plus that layer's overlays, a clicked overlay shows the base plus that overlay alone. The Mask is an editable box on the preview with eight edge handles and a center move grip, faded until hover on desktop and always drawn on touch. The transition mode, its tuning and Play sit on the preview widget. A Scale slider beside the preview sets the mascot's size as a percent of the base's pixel size, or Auto, which fits the mascot to the chat's height. Auto is the default.

**Mascot placement.** The mascot stands on the side of the chat with more free screen. It flips when the window crosses the middle, and the head on the pill moves to the same end.

**Chat Style.** Auto, Minimal or Full, on the General tab and in the pill's ⋮ menu. Auto is today's rule: minimal while the Mascot is on. Full with the Mascot on floats the mascot beside the full frame. Minimal gets a corner resize grip. Each style keeps its own width and height; the position is shared.

**Minimal readability.** A prototype shows three treatments side by side: a scrim with an opacity slider behind the column, shadows on the bubbles, and a text halo. The user picks from frames; the pick becomes a setting that applies whenever the minimal chrome renders.

**Scroll arrow.** Both chats show a small down-arrow button when the end is more than half a viewport away. A click scrolls to the end and resumes following.

**Endpoint tab.** Answer and Search share one row. The editor below loses its select: it always edits the preset Answer resolves to, under a heading that names it. Add copies that preset and moves Answer to the copy.

**Prompts tab.** Every prompt gets the Edit | Preview tabs. Search (formerly Pick, Q49) and Lookup gain their own Options (temperature, penalty, Max Output), with defaults equal to today's pins.

**Lookup Mode.** Off by default, as before this effort: the flip to on (Q6) was measured in ticket 13 and reversed (Q52). The capability gate skips it where the endpoint refuses functions. The help copy states when it runs and what it costs.

Mascot ticket 14 (extract the tuned defaults) stays held until the tab redesign lands, so the user tunes once on the new tab.

## Rulings

Settled with the user on 2026-10-04 (Q1–Q24 of the grill; Q7, Q18–Q20, Q23, Q24 belong to the `help-take-me-there` spec).

| # | Ruling |
|---|---|
| Q1 | Two efforts: this spec, and `help-take-me-there` for navigation |
| Q2 | The tab redesign lands before mascot ticket 14. The user tunes the rig on the new tab |
| Q3 | Scale is a device setting beside the window box, never in the card |
| Q4 | The Endpoint editor loses its select and always edits the preset Answer resolves to. Add copies it and moves Answer to the copy |
| Q5 | Pick and Lookup get sampler and Max Output options. Reopens Q58 of the settings spec. The preset file changes shape |
| Q6 | Lookup Mode defaults to on, from the MeroMero numbers. No new probe before the flip |
| Q8 | Minimal readability is picked from a prototype of three treatments: scrim with opacity, bubble shadows, text halo |
| Q9 | Chat Style Full with the Mascot on floats the mascot beside the full frame |
| Q10 | Chat Style lives on the General tab and in the ⋮ menu |
| Q11 | Minimal and Full each keep their own width and height. The position is shared |
| Q12 | The mascot takes the side with the wider free gap and flips when the window crosses the middle. The pill head follows |
| Q13 | The scroll arrow shows when the end is more than half a viewport away |
| Q14 | The Mascot tab is two columns: pinned preview left, controls right; stacked on mobile |
| Q15 | A clicked overlay previews the base plus that overlay alone. A selected layer previews the base plus all its overlays |
| Q16 | Mask handles fade until hover on desktop and stay visible on touch |
| Q17 | Scale is a percent of the base's pixel size, plus Auto. Set by a slider on the tab |
| Q21 | Auto fits the masked mascot to the chat's height and follows resizes. Default Auto; 50% is a slider stop |
| Q25 | Under Full, the mobile sheet draws no mascot (ticket 02) |
| Q26 | Under Full on desktop, the whole mascot stands beside the frame; the stored head view is ignored and returns under minimal (ticket 02) |
| Q27 | Chat Style is one row in a new first "Window" section of the General tab, an OptionSwitcher Auto / Minimal / Full. Hint: "Sets how the window looks. Auto is Minimal with the Mascot on" (row hints are plain text and capped at 12 words; no UI jargon) (ticket 02) |
| Q28 | The ⋮ menu order in both chromes: Clear Conversation, separator, a "Chat Style" label with three radio items (current checked), separator, AI Context, Settings (ticket 02) |
| Q29 | Readability (ticket 01, resolves Q8): the treatment is a Scrim, a rounded panel of the app background color at a set opacity behind the whole minimal column, inset 0.75rem beyond it. Setting: opacity 0–100% in steps of 5, default 60%. Bubble shadows and the text halo are rejected. Prototype on branch `prototype/readability` (9b2754ea), page `/readability.html`, launch entry `proto-readability` on 5247 |
| Q30 | The stored window box has never shipped, so no old-shape read (constraint: no compat for an unreleased form). An old or unreadable box reads as nothing and the window opens at the default box (ticket 02) |
| Q31 | Mascot tab split at lg (1024px). Under it the preview widget comes first and the whole tab scrolls as one; at lg and wider the preview column is pinned and only the controls scroll. Refined from md on evidence: just above md the dialog is ~770px, the controls column 358px, and layer rows overflow with names at 0–5px; at lg the dialog sits at its 900px cap (ticket 06) |
| Q32 | Expansion is selection on the Mascot tab: a layer row's click expands and selects it, collapsing returns the preview to Idle; an overlay click (row or thumbnail) selects it and expands its layer; a second click on the selected overlay returns to the layer; removing the selected overlay falls back to the layer (ticket 06) |
| Q33 | The help preset file has never shipped, so its version stays 1 and the shape changes in place with no reader for the earlier form. A file without the Pick or Lookup block fails naming the block (ticket 09) |
| Q34 | Option blocks need no Compare or Reset buttons: the per-field Custom checkboxes are the reset and restore the Default's values. Compare to Default stays a text diff (ticket 09) |
| Q35 | The pinned preview column may scroll only when the screen is too short to hold it (at 1366×768: 559px for 574px of content). It never clips a row and the preview height stays 240px (ticket 06) |
| Q36 | Under a percent, the head view draws the Mask crop at that share of its natural pixel height. Auto keeps the head's fixed height. The mobile sheet keeps its own head height and ignores Scale. The head clamps to the column height: it is the compact view and never grows past the chat's box (ticket 04) |
| Q37 | A percent mascot stays bottom-aligned with the column and rises above it. Its height clamps to the room from the column's bottom edge up to the screen margin, so the column never moves for it; width clamps to the free room beside the column at the base's aspect (ticket 04) |
| Q38 | Ticket 04 ships the Scale slider as one self-contained component inserted once beside the current preview; ticket 06's preview widget is its final home, and the later landing moves it (ticket 04) |
| Q39 | Frame review of ticket 06 (user, 2026-10-04): Formaquestion Settings on a phone picks its tab from a dropdown, not a tab strip |
| Q40 | Play on the preview widget alternates between the current look and the Thinking look, so each press plays a transition both ways (ticket 06) |
| Q41 | The phone sheet's header is 56px (ticket 06) |
| Q42 | On a phone, Settings and AI Context slide over the help sheet, which waits under them; the shielded layer sinks under dialogs and is inert while covered (ticket 06) |
| Q43 | The whole Mask box interior is the move area; the center grip is the visible, focusable keyboard target; only a press outside the box draws a new one (ticket 07) |
| Q44 | Arrow keys on a side handle move its own axis only; corners and the center grip move on both. Each key press commits to the rig at once, with no draft (ticket 07) |
| Q45 | The preview's Head View sits in a fixed 128px slot; a wide Mask's preview head shrinks to fit that width, shorter than its usual height. Without the fixed slot, a width change mid-drag slid the centered preview up to 70px under the pointer. The window's head view is unchanged (ticket 07, user) |
| Q46 | Q6 reopens on evidence: ticket 28's re-probe after the keyword work had retrieval at 48 of 48 complete (1,653 tokens in) against lookup's 45 of 48 (3,090), and ADR 0009 shipped the lookup off on that. Q6 rested on ticket 22's older numbers. The default stays on until ticket 13 re-probes on today's docs; the result decides, and ADR 0009 is amended to match (user, 2026-10-04) |
| Q47 | Ticket 13's arms both run through the help session with today's default settings; the only difference is the lookup switch. Tokens are reported per request kind (pick, face, answer). Harness edits are in the ticket's scope; "no code change" means product code (ticket 13) |
| Q48 | The readability setting is labeled **Backdrop**, a 0–100% slider. Hint: "Shades the screen behind the chat so the text stands out". "Scrim opacity" stays the field's code name only (user, 2026-10-04) |
| Q49 | The request where the AI chooses guide sections is **Search** everywhere the player sees it: Search Endpoint, the Search prompt and its options, AI Context. The General tab switch becomes **AI Search**. "Pick" leaves player-facing copy; code names may follow (user, 2026-10-04) |
| Q50 | Search section hints: Keyword Search "Matches the words in your question to guide sections"; AI Search "Asks your AI to choose the sections before answering. One extra request."; Semantic Search "Finds sections by meaning, not exact words. Downloads a small model once." Search Endpoint hint: "Runs the search request. A small, fast model is enough." (user, 2026-10-04) |
| Q51 | The Mascot tab's controls column drops the label column: the Base Image and the layer list take the full column width under their own headings, so layer rows have room for names and overlays (user, 2026-10-04) |
| Q52 | Lookup Mode's default goes back to off (ticket 13's probe: both arms 48 of 48, lookup +7% tokens in, no outcome changed; the set is at the ceiling, so lookup stays a hedge the player turns on). Ticket 16 flips it and amends ADR 0009. Resolves Q6 and Q46 (user, 2026-10-04) |
| Q53 | Mascots are presets, like help prompt presets: a dropdown at the top of the Mascot tab with Delete, Duplicate, Rename, Import, Export and Reset. The Default mascot is read-only and follows the code, so a player on it gets every change; Duplicate makes an editable copy. Reset puts the selected custom mascot back to the Default's rig and drops its own images, after a confirm; hidden on Default (user, 2026-10-04) |
| Q54 | A card import adds a new mascot instead of replacing the current one. The card gains a name field; export writes the mascot's name, import reads it and falls back to the file name, and a name already in use gets a numbered suffix. The card has never shipped, so the shape changes in place (user, 2026-10-04) |
| Q55 | The Mascot tab edits a draft. Save and Cancel sit in the footer; the preview shows the draft while the window keeps the saved mascot; images are dropped only at Save; switching mascots or closing with a dirty draft asks first. Undo and redo over the draft (Ctrl+Z, Ctrl+Shift+Z, drags and typing coalesce) come as a second small ticket (user, 2026-10-04) |
| Q56 | The draft model is built inside ticket 17, so presets stand on it from the start (user, 2026-10-04) |
| Q57 | Reset acts on the draft: one undoable step, nothing deleted until Save. It needs no confirm dialog, since Undo and Cancel both revert it. Refines Q53 (user, 2026-10-04) |
| Q58 | The mascot preset row's buttons are icon-only, as the Prompts tab's row already is: ghost icon buttons with a tooltip and an accessible name each. The tooltip states the full function in the help voice, not one word: Duplicate "Make an editable copy of this mascot", Rename "Rename this mascot", Delete "Delete this mascot and its images", Import "Add a mascot from a card", Export "Save this mascot as a card", Reset "Put this mascot back to the Default". Reset uses the shared reset icon (user, 2026-10-04) |
| Q59 | Ticket 17 details: Duplicate and Import prompt on a dirty draft like the select, Delete does not (its own confirm covers the draft); the import confirm is dropped since an import only adds, Delete keeps its confirm; Export writes the draft under the saved name; Rename and the Mascot switch write the store at once, outside the draft; Save and Cancel render only on the Mascot tab and are disabled while clean or on Default; on Default the rig controls, Mask handles and tuning sliders are disabled, Play works, and a line with a Duplicate button says it is read-only; Duplicate names the copy "<name> (copy)"; the store field is `mascotPresets` { activeId, mascots: [{ id, name, rig }] } and the old single rig field goes with no reader (ticket 17) |
| Q60 | The Mascot switch sits in a fixed row under the preset row, above the two columns and outside both scrollers, so it reads as its own device setting and not part of the selected mascot (user, 2026-10-04) |
| Q61 | Both Mascot tab columns scroll through the shared ScrollArea per the Design System's Scrollbars standard (10px arrowless track, reserved gutter), not native overflow (user, 2026-10-04) |
| Q62 | The Mascot tab gets a full-screen view like Settings → Prompts and Tools: the same morph shell and the same "View full screen" icon button, placed at the end of the preset row; the whole tab (preset row, switch row, both columns, footer) fills the screen, and Exit returns it in place (user, 2026-10-04) |
| Q63 | Ticket 19's AC: the shared scrollbar shows at 1280×700 and not at 1920×1200. Measured at 1600×900 the preview viewport is 493px for a 744px widget (Scale and transition rows grew it past Q35's 574px), so the preview scrolls on every common desktop. Q35 stands; whether the widget shrinks is open for the user (ticket 19) |
| Q64 | Ticket 20 builds on the preset-header effort: the Mascot tab's hand-rolled preset row becomes the shared preset header (icon actions at md, ⋯ menu below, confirms inside), "View full screen" is a header action, and the morph goes through the shared panel shell that preset-header ticket 09 extracted for the Formaquestion Prompts tab. Refines Q58 and Q62 (user, 2026-10-04) |
| Q65 | The shared preset header gains an optional per-action tooltip. The short label stays the accessible name and the ⋯ menu text; the tooltip shows the Q58 sentence where set. Only the Mascot header sets them; the Prompts and endpoint headers keep their short tooltips (ticket 20) |
| Q66 | Export stays available on the Default mascot, as the shared header keeps it on built-in presets. Refines Q53 and Q58 (ticket 20) |
| Q67 | In full screen the Mascot tab's columns split 1/3 preview, 2/3 controls; docked it keeps the 22rem preview column. The Prompts tab's full screen keeps its layout. The shared panel shell no longer shows its title row on either tab; the title stays the window's accessible name and the header's toggle, reading "Exit full screen", is the way out (user, 2026-10-04) |
| Q68 | The Mascot switch moves to the General tab's Window section, first: Mascot, Chat Style, Backdrop. The switch row ticket 19 added to the Mascot tab comes out (user, 2026-10-04) |
| Q69 | With the Mascot off, the Mascot tab shows one line, "The Mascot is off. Turn it on in General" with a link to the General tab, above the preset row, and everything else on the tab is disabled: select, header actions, preview controls, editor and footer. The link is the one action (user, 2026-10-04; refined by Q72) |
| Q70 | The ⋮ menu gets no Mascot entry. Mascot on/off is a settings-only choice (user, 2026-10-04) |
| Q71 | The off-state link is a tab change, so a dirty draft goes through the unsaved prompt first (user, 2026-10-04) |
| Q72 | Nothing but the line stays usable while the Mascot is off (user, 2026-10-04) |
| Q73 | The Image endpoint tab takes the same off state: Enable Image Generation stays on the tab, and with it off everything below stays mounted and disabled with the same one-line note, instead of unmounting (user, 2026-10-04) |
| Q74 | The image reachability badge gets a fixed slot, constant height and reserved width in every state, so a toggle or a probe rerun never shifts the rows around it (user, 2026-10-04) |
| Q75 | The Settings off state, everywhere: the scroll window hides while its rows stay mounted and disabled, the frame keeps its size, and one status text sits centered in it, plain muted text, no chip, no overlay, with a status region always mounted. Copy is a status sentence then a recovery sentence that quotes the control's label: "Image generation is off. Select “Enable Image Generation” to turn it on." Mascot: "The Mascot is off. Enable it in “General” to customize it.", with General a link that lands on the Mascot row with the Landing Pulse and focuses the switch (user, 2026-10-04, replaces "Select “General” to turn it on"). Replaces the one-line note in Q69 and Q73 (user, ticket 23, 2026-10-04, landed 003acb1c) |
| Q76 | The preset header disables too while the feature is off, on the Mascot tab and the Image tab alike. Only the switch itself (General for Mascot, the tab's checkbox for Image) stays usable. Image needs a follow-up to match (user, 2026-10-04) |
| Q51a | Ticket 14's layout is confirmed from the desktop mockup: two columns, preview left, controls right, with Base Image and Layers full width under their own headers (user, 2026-10-04) |

## User Stories

1. As a player, I want the Mascot tab to show the mascot large and always in view, so that I see every change as I make it.
2. As a player, I want the preview to follow the layer I select, so that I know what the layer adds to the base.
3. As a player, I want to click an overlay and see the base with only that overlay, so that I can tell overlays apart.
4. As a player, I want to drag the Mask's edges and corners, so that I can trim one side without redrawing the box.
5. As a player, I want to drag the Mask from its middle, so that I can move the crop without changing its size.
6. As a player, I want the Mask handles to fade when my pointer is away, so that they do not cover the preview.
7. As a player on a touch screen, I want the handles always drawn, so that I can find them without a hover.
8. As a player, I want the transition controls and Play next to the preview, so that I can watch what I tune.
9. As a player, I want a Scale slider for the mascot, so that it takes the room I want on my screen.
10. As a player, I want an Auto scale that fits the chat's height, so that the mascot matches the window without my tuning.
11. As a player, I want my scale kept on this device and out of the card, so that an imported rig keeps my size.
12. As a player, I want the mascot to stand where there is room, so that it never hangs off the screen edge beside the chat.
13. As a player, I want the pill's head to move to the mascot's side, so that the two read as one piece.
14. As a player, I want to choose Auto, Minimal or Full chat style, so that the chrome is what I like, not what the Mascot switch implies.
15. As a player, I want the style choice in the ⋮ menu too, so that I can swap without opening settings.
16. As a player with Full and the Mascot on, I want the mascot beside the full frame, so that I keep its reactions with the full chrome.
17. As a player, I want a resize grip on the minimal column, so that I can size it like the full window.
18. As a player, I want each style to remember its own size, so that a swap does not shrink or stretch the other.
19. As a player, I want the window to stay where it was when I swap styles, so that it does not jump.
20. As a player, I want the minimal chat readable over a busy screen, so that the text separates from what is behind it.
21. As a player, I want to adjust how strong that separation is, so that it suits my screen.
22. As a player, I want a down arrow when I scroll up, so that I return to the newest answer with one click.
23. As a player, I want the arrow to leave when I am near the end, so that it never covers the latest text.
24. As a player, I want Answer and Pick on one row, so that the Endpoint tab is short.
25. As a player, I want the editor to edit the preset Answer uses, so that there is one way to choose a route.
26. As a player, I want the editor heading to name the preset, so that I know what I am editing.
27. As a player, I want Add to copy the current preset and move Answer to the copy, so that I can tune a variant without losing the original.
28. As a player, I want Edit | Preview on every help prompt, so that I see the chips resolved as the model does.
29. As a player, I want options on the Pick and Lookup prompts, so that I can tune every request the window sends.
30. As a player, I want the new options in my exported preset file, so that a shared preset carries them.
31. As a player with a preset file from before, I want it to import, so that my prompts are not lost.
32. As a player on a local model, I want Lookup Mode on from the start, so that I get the better answers without finding the switch.
33. As a player on the cloud endpoint, I want nothing to change, so that my requests stay the same.
34. As a player, I want the Lookup row to say when it runs and what it costs, so that I can decide to turn it off.
35. As a player who prefers reduced motion, I want the Mask handles and the arrow to appear without animation, so that the tab respects my setting.
36. As a player on mobile, I want the preview above the controls, so that the tab fits the sheet.
37. As a player who uses a keyboard, I want the Mask box adjustable with arrow keys from a focused handle, so that I can set it without a pointer.
38. As the author, I want ticket 14 to wait for the redesign, so that I tune the rig once.
39. As a player, I want the Chat Style and scale to survive a reload, so that the window opens as I left it.
40. As a player, I want the ⋮ menu's style choice and the General tab row to agree, so that the two never fight.

## Implementation Decisions

### Window layout module

- The layout module gains a side: the mascot stands on whichever side of the column has the wider free gap in the viewport, measured from the column's edges to the screen margin. The reader piece takes the other side. Ties keep the current side, so a drag that crosses the middle flips once. The pill's head is drawn at the mascot's end of the pill row.
- The layout takes a scale value: a percent of the base's pixel size, or Auto. Auto sizes the masked mascot to the column's height (or the full frame's height under Full), as today. A percent sizes it to that share of the base's natural pixel height, at the base's aspect, clamped to the screen. The head view scales with it. The slider runs from 25% to 150% with Auto as its leading stop; the default is Auto (Q21).
- The stored window box becomes a size per style and one position: `{ x, y, minimal: { w, h }, full: { w, h } }`. The reader opens from the stored box as before. The minimal size keeps today's narrow cap. The box has never shipped, so an old or unreadable value reads as nothing and the window opens at the default box (Q30).
- The scroll-arrow rule is a pure function of the viewport's scroll position, height and scroll height: shown when the end is more than half a viewport height away (Q13).
- Scale and the head toggle are device values beside the window box, outside the help settings value and outside the card (Q3).

### Help settings

- The help settings value gains `chatStyle: 'auto' | 'minimal' | 'full'`, default `auto`. The chrome rule is one pure function of the style and the mascot switch: Auto is minimal while the Mascot is on; Minimal and Full pin. Full with the Mascot on renders the mascot piece beside the full frame (Q9). Minimal with the Mascot off renders the column alone.
- The Lookup switch defaults to off (Q52, after the Q6 flip and ticket 13's probe). The gate (`settings.lookup && takesFunctions`) is unchanged; the cloud endpoint refuses functions, so its requests are byte-equal to today's. ADR 0009 carries the dated amendment.
- The General tab gains a Chat Style row; the ⋮ menu lists the same three choices with the current one marked (Q10). Both write the one field.
- The readability treatment is the Scrim (Q29), labeled **Backdrop** to the player (Q48): a help settings field `scrimOpacity`, 0–100 in steps of 5, default 60, beside Chat Style. The window draws a rounded panel of the app background at that opacity behind the whole minimal column, inset 0.75rem beyond it, whenever the minimal chrome renders. 0 draws nothing.

### Help presets and the preset file

- A help preset's options become one block per prompt: Answer, Search (Pick in code until renamed, Q49) and Lookup each hold temperature, repetition penalty and Max Output. The Default preset's Search and Lookup options follow the code and equal today's pinned values for those requests. A custom preset stores all three (Q5).
- The preset file carries the three blocks at version 1; the file has never shipped, so no earlier form is read (Q33). **Export-shape change: remind the user in the response.**
- The help session reads each request's options from its own block. The per-field Custom checkboxes restore the Default's values; no block-level Compare or Reset (Q34).

### Prompts tab

- Every prompt field renders with the Edit | Preview tabs the gameplay editor has, with the help chips resolved from the current settings (the marker, the Voice, the pick limit, the lookup function). The Values tab stays absent: help prompts have no placeholder values.
- Each prompt row gets an Options sub-row with the shared per-prompt controls, as Answer has today.

### Endpoint tab

- Answer and Pick render in one row of two route fields. Pick keeps its Same as Answer choice.
- The editor has no select. It edits the preset the Answer route resolves to, under a heading "Edit <preset name>" that changes with Answer; with Follow Active, it edits the active preset and the heading says so. Add copies that preset, moves Answer to the copy, and the editor follows. Delete, where the shared editor allows it, moves Answer to Follow Active (Q4).

### Mascot presets

- The help settings value's single rig becomes a mascot preset store: an active id and the player's custom mascots, each a named rig. The Default mascot is virtual, read from the code, never stored, so it follows every release (Q53). The window, the face call's enum and the card export read the active mascot.
- The top row of the Mascot tab is the preset row the Prompts tab has: a select listing Default and the custom mascots, then Duplicate and Import always, and Rename, Delete, Export and Reset on a custom mascot only. Every button is icon-only with a tooltip and an accessible name, as that row's are (Q58). The Default's controls below the row are read-only, as the Default help prompts are.
- Duplicate copies the rig and shares its image ids. Delete and Reset remove images no remaining mascot references. Import adds a mascot named from the card or the file, with a numbered suffix on a clash, and selects it (Q54).
- The card carries the mascot's name (Q54). Export-shape change: the card and the help settings value, both unreleased, change in place.
- Scale and the head toggle stay device values, outside the presets.

### Mascot draft

- The tab edits a draft of the selected mascot, one immutable value. Save writes it to the store and then deletes images no mascot references; Cancel drops it. The preview and the Head View render the draft; the window, the face call and AI Context render the saved mascot until Save (Q55).
- A dirty draft blocks a mascot switch, a tab change and the dialog's close behind the unsaved-changes prompt the World Editor uses: Save, Discard, or stay.
- Uploads go to the image store at once so the draft can show them; an upload the player then cancels away is deleted with the other unreferenced images at the next Save or Cancel.
- Reset replaces the draft with the Default's rig: one step, no confirm (Q57). Delete acts on the store and keeps its confirm; Import only adds, so it has none (Q59).
- Undo and redo (follow-up ticket) are a history of draft snapshots. A slider drag or a typed run is one step, closed at pointer-up or blur; Reset is one step. Save clears the history.

### Mascot tab

- Above the columns: the preset row (Q60 as refined by Q68: the switch lives on General). With the Mascot off, the tab takes the Settings off state (Q75): the preset header disables (Q76), the columns' window hides with its rows mounted and disabled, and the centered status text carries the link to General. The link is a tab change and runs the dirty-draft prompt (Q71). The "View full screen" icon button ends the preset row (Q62).
- Each column is a ScrollArea with a flex-resolved height (Q61). The preview column scrolls only when the screen is too short (Q35).
- The preset row is the shared preset header (Q64). Full screen reuses the shared panel shell and morph hook the Formaquestion Prompts tab hosts: the tab's root is the morph source, the shell wraps the whole tab, and Exit hands the panel back in place with focus on the toggle. The dialog's own tabs and footer stay out of the full-screen view; Save and Cancel travel with the tab since they belong to it.
- The tab is two columns from the modal's wide layout: the preview column is fixed and does not scroll; the controls column scrolls. Under the mobile breakpoint the preview sits above the scrolling controls (Q14).
- The preview widget holds: the composed mascot at the preview height, the Mask box, the Scale slider, the transition mode, its tuning rows and Play, and the Head View thumbnail. The transition rows leave the bottom of the tab.
- The preview composition is a pure function of the selection: no selection shows the Idle composition; a selected layer row shows the base plus that layer's overlays; a selected overlay shows the base plus that overlay alone (Q15). Selecting is a click on the row or thumbnail; the selection is tab state and clears when the tab closes.
- The Mask box is an editable rectangle in base pixels with eight handles (four corners, four sides) and a center move grip. A corner drag moves two edges; a side drag moves one; the center drag moves the box. The box stays inside the base and above a minimum size. The handles and grip are at low opacity until the pointer hovers the box or a drag runs; on a coarse pointer they stay at full opacity (Q16). A focused handle moves one base pixel per arrow key, ten with Shift. Reduced motion drops the fade.
- The existing pointer-drag hook drives every handle; drawing a new box from scratch stays available on a press outside the box, as today.
- The Scale slider writes the device value. The preview does not scale with it; the window does.

### Window

- The chrome rule replaces the mascot-implies-minimal condition. A style change while the window is open swaps the chrome in place; conversation and phase carry over.
- The minimal column gets the same corner resize grip as the full frame, writing the minimal size (Q11).
- The mascot piece and the head on the pill take the side the layout module returns (Q12). Under Full, the mascot piece stands beside the frame at the frame's height under Auto scale.
- Both conversation scrollers render the scroll arrow when the rule says so. The arrow is a small round button at the bottom center of the viewport, above the input. A click scrolls to the end and sets following; the arrow leaves when following resumes.
- The readability treatment applies whenever the minimal chrome renders, under Auto or Minimal.

### Prototype

- The readability prototype runs on the prototype flow: a page that renders the minimal column over three busy backgrounds (light screen, dark screen, scene image) with the scrim at a slider, the bubble shadows, and the text halo as three columns. The user picks from frames. The pick, its range and its default go into this spec as a ruling before the ticket that ships it.

### Shape and settings

- The help settings value gains `chatStyle` and the readability setting. The device window box changes shape (local storage, migrated on read). The help preset file changes shape and bumps its version. The mascot card does not change.
- `chatStyle` and the readability setting have no environment twins.

## Testing Decisions

A good test calls a module through its public operations and asserts on what a player observes: the pieces' places on the screen, the stored value after a reload, the request that leaves the app, the rows and controls on the tab. It never asserts on internal layout.

Seams:

- **Window layout module (existing, pure).** The side rule: a column near the right edge puts the mascot left; near the left edge, right; a tie keeps the side; the reader takes the other side. Scale: Auto equals the column height; a percent equals that share of the base's pixel height; both clamp to the screen. The stored box: a size per style, one position, the old shape reads into both. The scroll-arrow rule at the threshold and both sides of it. Prior art: the window box tests.
- **Help settings codec and preset file (existing).** `chatStyle` and the readability setting round-trip; a missing value reads as the default; Lookup defaults off (Q52). The preset file: three option blocks round-trip; an older file imports with the Default's Pick and Lookup values; a bad block is named. Prior art: the help settings tests, the preset file tests.
- **Help session (existing, fake fetch).** The pick request carries the preset's Pick options; the lookup request carries the Lookup options; the Default preset sends today's values byte-equal. Lookup on by default offers the function on a function-taking endpoint and nothing on the cloud endpoint, body byte-equal to today's. Prior art: the help session presets and lookup tests.
- **Component seam (Formaquestion mount, settings tabs).** The chrome for each style and mascot pairing; the ⋮ menu and the General row write one value; the minimal column renders the grip; the scroll arrow renders past the threshold and a click scrolls to the end; the Endpoint editor heading follows Answer and Add moves Answer; Pick and Lookup show Options; every prompt shows Edit and Preview; the Mascot tab preview follows a selected layer and a clicked overlay; the handles render; a handle drag through the pointer hook changes one edge; the warning and pick rows still render. Tests that mount Formaquestion keep the one mocked seam to the settings providers. Prior art: the mascot tab, endpoint tab and prompts tab tests.
- **Playwright.** The handle fade on hover and its absence on a coarse pointer; the mascot flip while the column is dragged across the middle; the minimal resize grip; the per-style size after a reload; the arrow's painted position above the input. The Browser pane does not composite, so motion claims use per-frame sampling.

Other checks:

- Each guard is proven: reinstate the old behavior and confirm the test fails.
- Unmount during a drag or a stream leaves no timer or listener; the suite's exit code is the check.
- The surface registry source scan still covers the tabs.
- The Lookup default flip is not a prompt change. The help bar run stays valid for the cloud, whose requests are byte-equal. Ticket 13 re-probes the local arm on today's docs (Q46).

## Out of Scope

- Take Me There and any navigation from an answer: the `help-take-me-there` spec.
- A Cydonia lookup probe. Ticket 13 re-probed on MeroMero only (Q46, Q52).
- Replacing the AI Search request with the lookup function on function-calling endpoints. Discussed, not measured; a later probe effort if wanted.
- A scale or side in the mascot card. Both are device values (Q3).
- A player-chosen side. The wider gap decides (Q12).
- Mascot ticket 14's extraction. It runs after this effort on the new tab (Q2).
- Idle motion, blinking, or new transition modes.
- Changes to the game chat's scroller beyond the arrow.

## Further Notes

- The settings spec's Q58 (Answer-only options) is superseded by Q5 here.
- The mascot spec's Q5 (mascot implies minimal) is refined: Auto keeps that rule; Minimal and Full pin.
- The Endpoint editor's old select existed so a player could edit a preset other than Answer's. After Q4 that path is Settings → Endpoint, which edits every preset.
- The readability prototype ships first; its ruling lands in this spec before the ticket that builds the setting.
- **Unverified (ticket 23):** hiding the off-state window with `display:none` may reset its scroll position when the feature comes back on. No test covers it.
- **Probe shares count failed runs (ticket 13):** the help probe's shares now use every run as the denominator, failed runs included. Totals from earlier tickets excluded failed runs, so compare across tickets only when both batches had none.
- **Open gap (ticket 09):** the Preview tab shows an empty line where an empty Voice chip sits, while the request drops that line. Closing it means line-dropping in the shared prompt field preview, which gameplay prompts also use. Named, not built; needs the user's call.
- The Lookup row copy, in the help voice: it runs on endpoints that accept functions, reads guide sections during the answer, and roughly quadruples input tokens per question.
