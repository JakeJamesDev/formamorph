# Spec: Formaquestion Mascot

Status: ready-for-agent
Spec session: formaquestion-mascot — spec

## Problem Statement

Formaquestion is a plain chat window. The answer arrives as text, and nothing in the window reacts to the player: not while the pick request runs, not while the model reasons, not when the answer lands. The pause before the first token reads as a stall.

The author has drawn a character for the window, with eyes, mouths, eyebrows and arms as separate layers. There is no way to show it, no way to make it react to the answer, and no way for a player to bring a character of their own.

The minimal chat layout from the window prototype, a bare column with no frame, exists only on its branch.

## Solution

Formaquestion gets an optional **Mascot**: a layered character that stands beside the chat. It waves when the window first opens in an app load, shows a thinking face from the moment a question is sent until the answer's first word, and takes the face the AI picks for its answer through a function call. A Voice line in the prompt makes the answers match the face.

The mascot is a **rig** the player can change: a base image and an ordered list of layers. Each layer is an **expression** (one at a time, the AI's to pick) or a **state** (any number stacked), and each holds a list of overlay images drawn in order on top of the base. A **Mask** crop defines a head-only view for narrow screens and for a desktop toggle.

A **Mascot** tab in Formaquestion Settings holds the switch, the rig editor, the three picks (Initial, Idle, Thinking), the Mask and the Voice. A rig exports as a `.webp` card that shows its Initial look and carries the whole rig inside.

With the mascot on, the window uses the minimal chrome: the chat column alone, the mascot as its own floating piece to the left, and the guide reader as a floating piece to the right when a source name is clicked. The mascot is on by default. Formaquestion is unreleased, so no player loses a layout they had.

## Rulings

Settled with the user on 2026-10-03. A later ruling that refines an earlier one names it.

| # | Ruling |
|---|---|
| Q1 | The AI controls expressions only, through one function call. States are the player's and the app's |
| Q2 | The base image carries no rule about arms. The default rig's base is armless by the author's choice; a player may use a full base and skip arm overlays |
| Q3 | Rig images live in a store, not in the settings value. Refined by Q13 |
| Q4 | A face the AI set holds until the next question |
| Q5 | Mascot on implies the minimal chrome. One switch |
| Q6 | A rig has a Mask: a crop that defines the head-only view |
| Q7 | The Thinking pick selects one expression and one state |
| Q8 | An Initial pick selects the look the mascot shows the first time it appears in an app load. The default rig waves |
| Q9 | The Initial look holds until the first question |
| Q10 | "First time" means once per app load |
| Q11 | Expressions and states are one ordered list, with a kind per row. List order is draw order across both kinds |
| Q12 | Last call wins within an answer. No call limit row |
| Q13 | Rig images live in a new IndexedDB store on the shared helper. The rig in the settings value holds image ids |
| Q14 | On desktop the mascot is its own floating piece, left of the chat column, outside it |
| Q15 | The mascot is on by default |
| Q16 | A rig exports as a `.webp` card that renders the Initial look, with the rig in the image metadata, as an entity card does |
| Q17 | With the mascot on, the guide reader opens as its own floating piece |
| Q18 | When the answer streams and the AI made no call, the face goes to Idle at the first content token. Reasoning text keeps Thinking |
| Q19 | Overlays are drawn stretched to the base size |
| Q20 | The Mask is set by dragging a box on the rig preview |
| Q21 | A pick that names a disabled layer is kept, draws nothing for that layer, and the tab shows a warning. The pick dropdowns list enabled layers only |
| Q22 | A chip in the help prompt, like Markdown Guidance, sends a Voice line while the mascot is on and nothing while it is off. Off sends today's prompt exactly |
| Q23 | A source-name click opens the reader piece, right of the chat |
| Q24 | Mobile shows the masked head left of the pill row. Desktop toggles head and full from the pill |
| Q25 | The chip's text is the Voice field on the Mascot tab |
| Q26 | The chip is a prompt change. Proof is the help bar run, mascot on against mascot off, on cloud |
| Q27 | The card carries every layer image in full |
| Q28 | Default on applies to everyone. Formaquestion has never shipped, so there is no migration |
| Q29 | The Voice travels in the card with the rig |
| Q30 | Thinking holds until the first content token. A face call before that is stored and shows when the text starts. Refines Q12 and Q18 |
| Q31 | A face change plays a transition. The transition mode and its tuning are part of the rig and travel in the card. The defaults are settled by a prototype first |
| Q32 | The default rig ticket 01 ships is provisional: twelve composite word-named faces, three arm states, and a drafted Voice. The user tunes the real defaults in-app once the tab exists, and a follow-up ticket extracts those settings into code. No extra UI for authoring defaults |
| Q33 | Expressions are composite whole faces, one row each. A part the arm must cover (the :O mouth under the thinking hand) rides in the arm state, because one row cannot sit both under and over another row. The format stays a flat list |
| Q34 | The minimal chrome's pill is grip, today's ⋮ menu (Clear Conversation, AI Context, Settings) and Close; the head toggle joins it in its ticket. Until the reader piece lands, a docs request with the mascot on opens the heading in the wiki, as with the window unmounted |
| Q35 | The mascot's prompt text is the **Voice**, never Persona, which the glossary holds for the player-slot entity. The landed rig field is renamed in the Voice chip ticket; nothing shipped |
| Q36 | The Initial look ends on the first send and on nothing else. A dialog's close-and-reopen, or the player closing and reopening the window, keeps it. Refines Q9 and Q10. Superseded by bubble-chat-style Q28: the Initial look shows whenever no exchange exists, so Clear Conversation brings it back |
| Q37 | The Voice chip sits in both the Answer and the Lookup prompt of the Default preset, as its own paragraph after the intro line and before the rules; never in the Pick prompt. Token `<VOICE>`, label Mascot Voice |
| Q38 | Rig editor details: the preview draws Idle, or the base plus one layer's overlays while that row is expanded; removing the base returns to the bundled base; a new layer is an enabled expression with no overlays, named and kinded in its expanded body; the URL field is hidden on this tab; Reset confirms, removing a layer or an overlay does not |
| Q39 | The Voice chip frames the Voice with fixed lines in code: a "speak in this voice" lead and a line that keeps the answer first and the guide's control names. Off or empty still sends nothing. The bar run compares mascot on and off inside one batch, with the no-docs control. Refines Q22, Q26 and Q37 after the first run missed the bar (off 77.1%, on 74.4%, bar 75%) |
| Q40 | The head view sits left of the pill at the top of the column on both desktop and mobile, at a fixed height (96px desktop, 64px mobile) with width from the Mask's aspect. The desktop toggle is one pill button before the ⋮ menu. Its memory is its own device key beside the window box. No Clear Mask control: Reset restores the default Mask. Refines Q24 |
| Q41 | The Voice chip passed the bar (on 77.9%, off 76.7%) but uncovered questions miss the Not in Guide flag more often under it (24% against 10%), with more invented names and longer answers. Default on stays; a follow-up ticket adds a framing line that keeps the marker rule, measured in one batch |
| Q42 | A pick keeps its layer when that layer changes kind. The layer still draws, the dropdown shows its name as unlisted, and no warning shows. Q21's warning covers blank faces only |
| Q43 | Transition details: Dissolve has a duration only (default 250 ms, the Jelly range); the default rig uses Jelly at the prototype's defaults and keeps both modes' tuning; a restart mid-transition eases from the current frame with no jump; the tab's Play runs Thinking to the preview's look; range-end tests check the dip and peak only where the tuning is above 0: at squash 0 there is no dip before the peak, though the settle still swings around 1; at overshoot 0 the curve stays at or below 1 |
| Q44 | Card details: bundled images embed as bytes too, identical images once; the gate is a kind marker and an integer version, with the app version written beside them; import replaces the rig only, never the mascot switch, and confirms like Reset; parse refuses the whole card on any bad field and names its path; a pick naming a missing layer is allowed |
| Q45 | The Voice framing's wording is not fixed by Q39; its intent is: no chatty opener, the guide's names, the marker rule unbroken, and never "in your words". Ticket 16 may merge the ordering into one line and runs both candidates as arms in its one batch |
| Q46 | Ticket 16's batch: today's framing 75.9% with a 14% missed flag; merged line 72.6%; added marker line 73.4% with a 54% missed flag, because the marker was named in words and the reader matches the bracketed token only. No framing change ships. The flag gap on 50 questions reads as batch drift. Closes Q41 |

## User Stories

### Seeing the mascot

1. As a player, I want a character beside the help chat, so that the window feels alive.
2. As a player, I want the character to wave the first time the window opens, so that the first open feels like a greeting.
3. As a player, I want the character to show it is thinking from the moment I send a question, so that the pause before the answer reads as work and not a stall.
4. As a player, I want the thinking face to stay while the model reasons, so that a long reasoning pass does not look frozen.
5. As a player, I want the character to take a face that fits its answer, so that the answer has a tone.
6. As a player, I want that face to stay until I ask again, so that I can read the answer with the face that goes with it.
7. As a player, I want the character to settle to a rest face when the answer starts and the AI picked none, so that the thinking face does not outlive the thinking.
8. As a player, I want the character to change its face at once when the AI calls for it, so that the face and the text arrive together.
9. As a player, I want the character to work on an endpoint that takes no function calls, so that I still get the wave, the thinking and the rest faces.
10. As a player on a phone, I want to see the character's head beside the chat controls, so that it fits the narrow layout.
11. As a desktop player, I want to switch between the full character and its head, so that I can give the chat more room.
12. As a player, I want the character off, so that the help window is a plain chat again.

### The minimal chrome

13. As a player with the mascot on, I want the chat as a bare column with no frame, so that the character stands beside it.
14. As a player, I want the chat column, the character and the reader to be separate pieces, so that clicks between them reach the app.
15. As a player, I want to drag the window by the pill, so that the chat, the character and the reader move together.
16. As a player, I want the guide reader to open beside the chat when I click a source name, so that I can read the section the answer came from.
17. As a player, I want to close the reader piece on its own, so that the chat and the character stay.
18. As a player, I want the window to open and close with the same motion as before, so that the chrome change feels like the same window.

### Customizing the rig

19. As a player, I want a Mascot tab in Formaquestion Settings, so that every mascot control is in one place.
20. As a player, I want a switch for the mascot, so that I decide whether it shows.
21. As a player, I want to replace the base image, so that I can bring my own character.
22. As a player, I want a list of layers with a name, a kind and a switch each, so that I can see the whole rig at a glance.
23. As a player, I want to reorder layers, so that I control what draws on top.
24. As a player, I want each layer to hold a list of overlay images in order, so that one expression can combine eyes, a mouth and an arm.
25. As a player, I want to add, remove and reorder overlays inside a layer, so that I can build an expression from parts.
26. As a player, I want to mark a layer as an expression or a state, so that the AI sees only the faces.
27. As a player, I want to disable a layer without deleting it, so that I can take a face out of the AI's reach and bring it back later.
28. As a player, I want a live preview of the rig, so that I see what a layer draws.
29. As a player, I want to choose the Initial, Idle and Thinking looks from my own layers, so that the app's moments use my faces.
30. As a player, I want a warning when a pick names a layer I disabled, so that I know why the face is blank.
31. As a player, I want to draw the Mask by dragging a box on the preview, so that the head view shows the part I choose.
32. As a player, I want a Voice field, so that the answers sound like my character.
33. As a player, I want to reset the rig to the default, so that I can start over.
34. As a player, I want my images to survive a reload and a large rig, so that the browser's small settings storage does not lose them.

### Transitions

46. As a player, I want the face to change with a motion, so that a swap does not look like a glitch.
47. As a player, I want a plain cross-fade, so that a calm character stays calm.
48. As a player, I want a jelly bounce, where the character squashes, stretches past its height and settles, so that it feels alive.
49. As a player, I want to tune the bounce's duration, squash, overshoot and settle, so that I can make it subtle or wild.
50. As a player, I want to preview the transition on the tab, so that I can tune it without asking a question.
51. As a player, I want no transition, so that the face swaps at once.
52. As a player who turned off motion in my system, I want the face to swap at once, so that the app respects that choice.
53. As a player, I want the transition to travel with my mascot in the card, so that the character arrives with its motion.

### Sharing a rig

35. As a player, I want to export my mascot as an image file that shows it, so that I can share it in one file.
36. As a player, I want to import a mascot card, so that I can use a character someone else made.
37. As a player, I want the import to bring the Voice and the picks with the art, so that the character arrives whole.
38. As a player, I want an import to replace my rig all at once or not at all, so that a bad file leaves my rig alone.
39. As a player, I want an import of a bad file to say what is wrong, so that I can fix the file.

### The AI side

40. As a player, I want the AI to know it has a face and which faces exist, so that it picks one that fits.
41. As a player, I want the AI's answers to match the character's voice, so that the face and the words agree.
42. As a player with the mascot off, I want the help prompt to be exactly what it is today, so that the mascot costs nothing when off.
43. As a player with a custom help preset, I want to add the mascot chip to my prompt, so that my preset gets the Voice too.
44. As a developer, I want each face call in the AI Context trace, so that I can see when the model used it.
45. As a developer, I want proof that the Voice chip does not hurt answer quality, so that default on is safe.

## Implementation Decisions

### Mascot module

- One new pure module holds the rig model, its codec and its composition. It has no React and no DOM.
- A rig is a base image reference, an ordered list of layers, a Mask, three picks and a Voice text. A layer has an id, a name, a kind (expression or state), an enabled switch and an ordered list of image references. An image reference is an id in the mascot image store, or a bundled asset name for the default rig. A pick holds a layer id for its expression and a layer id for its state, either of which may be empty.
- The composition is one pure function. It takes the rig, the phase (initial, thinking, answering) and the AI's expression, and returns the ordered list of images to draw: the base, then the overlays of each active layer in list order. Active means: in the initial phase, the Initial pick's two layers; in the thinking phase, the Thinking pick's two layers; in the answering phase, the AI's expression if set, else the Idle pick's expression, plus the Idle pick's state in both cases. A disabled layer is never active. The function carries no other rule (Q2, Q11, Q21).
- The codec reads a stored rig field by field. A bad layer drops; a bad pick clears; a missing Mask reads as the whole base. The default rig is the fallback for a missing or unreadable value.
- The warning rule is a pure function: the picks that name a disabled or missing layer.
- The default rig is built from bundled assets cut from the author's layered file. Its Voice text lives in code. The provisional rig (Q32, Q33): three arm states, Wave = [Wave, No Thinking], Rest = [No Wave, No Thinking], Thinking = [:O, No Wave, Thinking arm]; twelve composite faces with word names (Happy, Excited, Surprised, Pondering, Confused, Sad, Sleepy, Smitten, Dizzy, Wink, Flustered, Unimpressed); picks Initial = (none, Wave), Idle = (none, Rest), Thinking = (Pondering, Thinking). States first in the list, then the faces. The real defaults come from the user's in-app tuning, extracted by a later ticket.

### Transition

- The rig holds a transition: a mode and its tuning. Modes: None, Dissolve, Jelly. The default rig's mode and tuning come from the prototype (Q31).
- Dissolve cross-fades the old composition into the new one over a duration.
- Jelly scales the whole mascot from its bottom center while the composition swaps: a squash below normal, a stretch past normal, then a settle back with a yoyo, over a short duration. Its tuning is duration, squash, overshoot and settle count. The composition swap lands at the squash, so the new face stretches up.
- A transition plays on every composition change: initial to thinking, thinking to a face, a face call during an answer, a face to thinking on the next send. A change during a running transition restarts it from the current frame.
- The transition is one pure timing function, from elapsed time and tuning to a scale and an opacity, so the prototype, the tab preview and the window share it and a test can sample it.
- The system's reduced-motion preference forces None. The tab says so when it applies.
- The transition and its tuning travel in the card (Q31). A card from an earlier version without one reads as the default.
- A prototype settles the Jelly defaults and the tuning ranges before the ticket, on its own branch, with a standalone page that plays the swap on the default rig under sliders.
- **Jelly ruling (ticket 10, 2026-10-03).** Settled on the prototype page at `prototype/jelly-transition` (`src/prototype/jelly/`, `/jelly.html` on a Vite dev server at that checkout). Ticket 11 lifts `jellyTiming.ts`, adds the opacity output and the None and Dissolve modes, and keeps the Jelly curve as it is. "Scale" in the Jelly test wording means the height scale; the width moves the other way.
  - Defaults: duration 450 ms, squash 0.18, overshoot 0.12, settle count 2.
  - Ranges: duration 150–1200 ms (step 10), squash 0–0.5 (step 0.01), overshoot 0–0.5 (step 0.01), settle count 0–4 (step 1).
  - Shape: the run splits into `2.5 + settle` half-cycles of equal length. The first eases the height from 1 to `1 − squash` (cosine). The second eases from the dip to `1 + overshoot` (cosine); the composition swaps at its start, so the new face stretches up. The settle swings are a damped cosine from the overshoot, with 5% of the overshoot left on the last swing, and a final quarter swing lands at 1. The width moves against the height by a fixed 0.5 of the height offset. Opacity stays 1. Past the duration the frame is the rest frame.
  - At the defaults: dip to 82% at 100 ms, peak at 112% at 200 ms, rest at 450 ms.

### Help settings

- The help settings value gains the mascot switch and the rig. The mascot switch defaults to on (Q15). The settings codec parses the rig through the mascot codec.
- The three picks and the Voice are part of the rig, not separate device settings, so the card carries them (Q29).

### Mascot image store

- A new IndexedDB store on the shared helper holds player images by id, as the model store does. It is not a cache: nothing drops it. Add returns a new id; get returns the blob; delete removes one. A bundled asset is never in the store.
- The tab turns a stored image into an object URL for the preview and revokes it on unmount. The window does the same for the drawn images.
- Removing an overlay or a layer deletes images that no other layer references.

### Help session

- The help session gains one fixed function, the face call, offered beside the guide lookup and the help dice roll while the mascot is on and at least one expression is enabled. Its one parameter is the face name, with the enabled expressions' names as the enum. The capability gate of ADR-0008 applies: on an endpoint that takes no functions, nothing is offered and the window's phases still run.
- Its handler yields a new session event that names the face. The answer events are unchanged. The trace records the call as it records every tool round, so AI Context shows it.
- A new help chip stands for the Voice. While the mascot is on, the chip sends the rig's Voice text; while it is off, or the Voice is empty, it sends nothing and leaves no blank line, as Markdown Guidance does. The Default help preset's Answer and Lookup prompts gain the chip, as a paragraph after the intro line (Q37). A custom preset that lacks the chip sends no Voice (no chip, no injection).
- The question carries the mascot switch and the Voice, as it carries every other setting: the session reads no context.
- The reserved-name rule of ADR-0010 covers the face call's name, through the fixed-function list.

### Window

- The window owns the mascot phase. Sending a question sets thinking and clears the AI's expression. A face event stores the AI's expression and changes nothing else. The first answer event with content text sets answering, and the stored expression shows then; with none stored, Idle shows (Q18, Q30). The window starts in the initial phase and leaves it on the first send, never on a close or reopen (Q8–Q10, Q36). The phase lives in the mounted window, which lives for the app load.
- Turning the mascot off or on while the window is open swaps the chrome in place. The conversation and the phase carry over.
- The thinking phase covers the pick request, the prefill and the reasoning text, because the session yields nothing until the pick is done and reasoning arrives without content text (Q18).
- With the mascot on, the window renders the minimal chrome: the prototype's chat column, taken from the prototype branch. The frame, the title bar, the tabs and the resize grip do not render. The pill holds the drag grip, today's ⋮ menu (Clear Conversation, AI Context, Settings), the head toggle and Close (Q34).
- The mascot piece stands left of the column at the base's aspect, scaled to the column's height. The head view draws the Mask crop. The desktop head toggle is remembered per device with the window box. On mobile the head sits left of the pill row and there is no full view.
- The reader piece opens right of the column on a source-name click, shows the guide reader, and closes with its own button. Source names are links again in the minimal chrome.
- The three pieces share one window box. The box widens by the mascot's width and the reader's width while each shows, and the stored box is the column's.
- With the mascot off, the window is unchanged.

### Mascot tab

- A fifth tab, Mascot, after Tools. It reports its Surface and gets a dev-route entry.
- Rows: the switch; the Voice field; the rig preview with the Mask drag; the base image; the layer list; the three picks; the transition mode with its tuning and a Play button that runs it on the preview; Export, Import and Reset.
- The layer list is a reorderable list. Each row shows the name, the kind, the switch and its overlays. Expanding a row shows the overlay list, itself reorderable, with add and remove.
- Image upload reuses the existing image upload control. A file goes to the mascot image store; a link is refused, because the store holds blobs.
- The pick dropdowns list enabled layers only, filtered by kind. A warning row names the picks that point at a disabled or missing layer (Q21).
- The Mask drag draws a box on the preview and stores it in base pixels. A canceled pointer (a touch scroll) drops the box; a drag under 16 base pixels on either side counts as a press and keeps the Mask. A Head View row shows the live head preview.
- Reset restores the default rig and deletes the player's images.

### Mascot card

- The card is a `.webp` that renders the Initial composition, with the rig in the image metadata as the entity card does. The metadata holds a marker, a version, the rig with every image as base64 (Q27), the picks and the Voice.
- Parse is strict and names the bad field. Import replaces the whole rig or nothing: images go to the store first, the rig applies last.
- The card is an export shape. A version field guards it from the first release.

### Shape and settings

- The help settings value gains two fields. No world, save or help preset file changes shape. The mascot card is a new export shape.
- The mascot switch has no environment twin.

## Testing Decisions

A good test calls a module through its public operations and asserts on what a player observes: the request that leaves the app, the events that come back, the images the window draws, the stored value after a reload. It does not assert on internal data layout.

Three seams:

- **Help session (existing seam).** Drive it with the fake fetch option and a settings value. Cover: the face call offered only with the mascot on and only on an endpoint that takes functions; its enum equals the enabled expression names and changes when a layer is disabled; the Voice chip text in the request body with the mascot on, and the body byte-equal to today's with it off; a face call yields the face event, and a second call in one answer yields a second; the trace records the call. Prior art: the help session tests and the tool loop tests.
- **Mascot module (new seam).** Pure tests of the composition: each phase draws the right overlays in list order; a disabled layer draws nothing; the AI's expression replaces the Idle expression and keeps the Idle state; an empty pick draws the base alone. The codec: a bad layer drops and the others stay; a missing value reads as the default rig; a rig without a transition reads as the default's. The warning rule. The timing function: None is a step; Dissolve ends at full opacity; Jelly starts and ends at scale one, dips below one, passes above one, and settles within its duration, for the default tuning and the range ends. The card: a round trip through build and parse, transition included; a file with an unknown version or a bad field is refused by name. Prior art: the help settings codec tests, the preset file tests, the entity card tests, the stat bar animation tests.
- **Window and tab (component seam).** Thin tests: the initial look on the first open and not on the second; thinking on send; Idle at the first content token with no call; a face event before any content text keeps Thinking and the face shows at the first content token; the next send clears it; the pill toggle swaps full and head; the tab lists layers in order, the kind, the switches and the warning; the pick dropdowns hide disabled layers; Reset restores the default. Tests that mount Formaquestion keep the one mocked seam to the settings providers.

Other checks:

- The image store gets a small test on the shared IndexedDB helper, as the model store has: add, get, delete, and a reload keeps the blob.
- Playwright covers what jsdom cannot: the Mask drag, the three pieces side by side, the reader piece opening from a source name, the mobile head, the open motion with the mascot on, and the transition itself by per-frame sampling of the mascot's painted scale, because the Browser pane does not composite. Reduced motion under emulation swaps at once.
- Each guard is proven: reinstate the old behavior and confirm the test fails.
- Unmount during a stream leaves no timer, fetch or object URL behind; the suite's exit code is the check.
- The Voice chip is a prompt change. The help bar run goes out twice on cloud, mascot on and mascot off, with its in-batch control, and the on run must hold the bar (Q26). The probe harness gains the mascot switch and the Voice as inputs, as it takes the other help settings. The face call's description is new prompt text too, so the local arm reports how often the model sets a face on a plain help question.
- The source scan of the surface registry covers the new tab.

## Out of Scope

- The AI setting states, or a face mid-sentence through text markers. Function calls only (Q1).
- Blinking, idle motion, lip sync, or motion inside a layer. The transition moves the whole mascot on a face change and nothing else.
- More than one rig per device. Reset and import replace the one rig.
- Sharing a rig through the community server.
- A Voice that changes the game's narration. The chip is a help chip.
- The minimal chrome as a choice with the mascot off (Q5).
- A head view that is not a crop: a second rig for the head.
- Pointing art. The layered file holds no pointing layer.

## Further Notes

- The default rig's layers are cut from the author's layered file with a GIMP 3.x script. Every procedure call in that script is verified against the installed version before it runs; the 2.10 forms hang the console.
- The prototype branch holds the minimal chat column and the window pieces. The port takes its layout, not its mock data.
- The session yields nothing until the pick request is done. Thinking therefore starts in the window on send, not from a stream event. A later effort that wants a distinct face for the pick request needs a session event for it.
- The composition function is the one place that decides what draws. The renderer takes its list and draws it. No other module reads a layer's kind.
- The Jelly prototype runs before its ticket, through the prototype flow: a standalone page with the default rig, sliders for duration, squash, overshoot and settle, and a button that swaps the face. Its output is the default tuning, the slider ranges, and the timing function's shape. Watching it is the user's job; the page prints the sampled scale per frame so the shape is on record. Dissolve and None need no prototype.
