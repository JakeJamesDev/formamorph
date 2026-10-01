# Spec: Formaquestion, In-App Help That Answers from the Docs

Status: ready-for-agent
Spec session: formaquestion — spec
Status note: 26 tickets in issues/. 01 gates the docs tickets 02–12, which run in parallel; 13 closes coverage. 14 (prototype) and 15 gate the window (16). 26 sets the probe bar and waits for 13, 22, 23 and 24.

## Problem Statement

A player who does not know how to do something in Formamorph has two options today. They can read a short **?** help topic, when the screen has one. Or they can leave the app and search the GitHub wiki.

Both options fail often:

| What the player tries | What goes wrong |
|---|---|
| A **?** help topic | Only 17 topics exist. The Main Menu, Settings, the Library and Community Creations have none |
| The wiki | It needs a network and a browser. Nothing is bundled into the desktop or Android builds |
| A docs page | About 20 feature areas have no page: How to Play, Settings, Prompts, Tools, saves, the Library, Community Creations, Avatars, the Test Bench, image generation |
| A page that exists | About 25 statements are stale or contradict another page. The world format reference is far behind the real format |
| A task question ("how do I make a Blueprint?") | Most pages describe features. Only 3 of 19 pages give steps |

Formamorph already connects to an AI. That AI knows nothing about Formamorph, so it cannot help the player use the app.

## Solution

**Formaquestion** is a help window that the player can open on every screen. It holds the full player guide, a search over the guide, and a field to ask a question in plain words.

- The player opens it with a fixed button or with F1. The window floats, the player can move it, and it stays usable while a dialog is open.
- The player asks a question. The connected AI reads the matching docs sections and answers with steps that use the exact control names.
- Each answer lists the docs sections it came from. A click shows the section in the window.
- Formaquestion knows which screen, dialog and tab the player has open, so "how do I add one here?" works.
- When no AI is connected, or the request fails, the window shows the matching docs sections. Help works with no AI at all.
- The player can browse every docs page in the window, offline.

The docs become complete and correct as part of this effort. A test then keeps every player-facing screen tied to a docs section.

## Rulings

| # | Ruling |
|---|---|
| Q1 | One global help chat, not a field inside each help popover |
| Q2 | A request carries the docs and the current screen, dialog and tab. It carries no world data |
| Q3 | Formaquestion only answers. It does not navigate or edit. A production deep-link map is a later effort |
| Q4 | The docs get an audit pass, and a coverage test keeps them tied to the app |
| Q5 | A conversation with follow-ups. The request keeps only the last few exchanges |
| Q6 | Messages stay until the app closes. Nothing is stored |
| Q7 | With no AI connected, or after a failed request, the window shows a docs search |
| Q8 | Each answer lists its source sections, and they open in the window |
| Q9 | The help prompt is an editor request kind: fixed text, the active endpoint, reasoning off, no Settings tab |
| Q10 | On a model with no tool support, the app finds sections by keyword and puts them in the prompt |
| Q11 | Answers follow the AI Language setting. Control names stay in English |
| Q12 | Formaquestion runs on the default cloud endpoint under the same limits as gameplay |
| Q13 | The window floats and the player can move it |
| Q14 | Web, desktop and Android all get it. On mobile it is a full-screen sheet |
| Q15 | For a question the docs do not cover, the AI answers from general knowledge, and the answer carries a flag |
| Q16 | Send is unavailable while a game turn generates. Docs search still works |
| Q17 | Full docs coverage, docs tickets first: every stale claim fixed and every missing page written |
| Q18 | The index holds docs only. Help topics stay out, and this effort corrects them |
| Q19 | The index also holds the recent changelog, the world format reference and a new glossary page |
| Q20 | Each docs page keeps its reference text and gains "How to…" sections |
| Q21 | The window stays usable above every dialog |
| Q22 | A fixed button on every screen, plus F1 |
| Q23 | Coverage test: the surface map, plus help-topic links and docs links that must resolve. No settings-label check |
| Q24 | A fixed question set runs first as a baseline. The user sets the pass bar from those numbers |
| Q25 | The reader has a contents list of every docs page |
| Q26 | "Learn more" in a help topic opens the reader, not the wiki |
| Q27 | The feature name is **Formaquestion** |
| Q28 | The player can attach screenshots through the existing attachment intake |
| Q29 | Three test seams: the docs index, the help session, the coverage test |
| Q30 | The docs lookup is an app-internal function call, outside the Tool catalog. A new ADR records it |
| Q31 | 26 tickets: paired docs pages share a ticket; the known-gaps list shrinks ticket by ticket and ticket 13 deletes it |
| Q32 | The Formaquestion tickets run beside the docs tickets. Only the probe baseline waits for complete docs |
| Q33 | Window A is one design at two widths. Narrow (400px): three tabs, Ask, Search and Guide. Wide (720px): a rail with search and contents beside the conversation or the reader. A **Wide View** button in the title bar swaps them, and the resize grip crosses the same line at 560px. The search text, the open section and the conversation carry over. The mobile sheet uses the narrow layout. Refines Q13 (ticket 14) |
| Q34 | The launcher is a tab in the window's top layer. The player can drag it: it stays flat on the nearest screen edge (any of the four) and follows the pointer along it. Its label turns with the edge and is never upside down. A press with no move opens the window. The tab's place is stored per device. The default place is the right edge at mid height. Refines Q22 (ticket 14) |
| Q35 | The window zooms out of the tab and back, wherever the tab is. The mobile sheet slides in from the tab's edge. Reduced motion shows and hides at once. Durations are 200ms open and 150ms close (ticket 14) |
| Q36 | With the window open and focus elsewhere, F1 moves focus into the window; a second F1 closes it |
| Q37 | Escape does nothing to the window. Only F1 and the Close control close it |
| Q38 | The launcher says **Help**. The window title says Formaquestion |
| Q39 | The launcher stays above open dialogs, in the window's layer |
| Q40 | The chip typeahead keeps painting above the window |
| Q41 | The layering approach is approved: one shielded host on `<body>` at z-65, and the dialog, alert dialog and drawer wrappers ignore presses and focus inside it. Ticket 14's Answer is the build reference |
| Q42 | Ten new visual patterns from ticket 14 are approved and go to the Design System as a proposal: the nine listed there, plus the movable edge tab (pattern 10). Pattern 11 is variant D and is not proposed |
| Q43 | Only the tab snaps to an edge. The window moves freely, stays whole on the screen, and does not follow the tab (ticket 14) |
| Q44 | Variant D, the frameless chat overlay, is out of scope. The user has later plans for it. The prototype branch keeps it as the reference (ticket 14) |

## User Stories

### Opening the window

1. As a player, I want a help button in the same place on every screen, so that I always know where help is.
2. As a player, I want F1 to open and close Formaquestion, so that I can reach help without the mouse.
3. As a player on mobile, I want Formaquestion to open as a full-screen sheet, so that it is readable on a small screen.
4. As a player, I want to move the window, so that it does not cover the controls I work with.
5. As a player, I want the window to remember its position and size on my device, so that I place it once.
6. As a player, I want the window to stay inside the screen after a resize, so that I never lose it.
7. As a player inside Settings or another dialog, I want to type in Formaquestion while the dialog stays open, so that I can ask about the setting in front of me.
8. As a player, I want to click and type in the dialog behind the window, so that I can follow the steps while I read them.
9. As a player, I want Escape to close the top dialog and leave Formaquestion open, so that I do not lose my answer.
10. As a player, I want the window to stay open when I change screens, so that the steps stay in view.
11. As a keyboard user, I want focus to move into the window when it opens and back when it closes, so that I do not lose my place.

### Asking a question

12. As a new author, I want to ask "how do I make a Blueprint?" and get numbered steps, so that I can do it without reading a whole page.
13. As a player, I want the steps to use the exact names of tabs and buttons, so that I can find them.
14. As a player, I want the answer to stream as it is written, so that I can start reading at once.
15. As a player, I want to stop an answer, so that a wrong direction does not waste time.
16. As a player, I want to ask a follow-up such as "and then?", so that I do not restate the question.
17. As a player on a small model, I want old exchanges left out of the request, so that the context does not overflow.
18. As a player, I want my conversation to stay while the app is open, so that I can close the window, do the steps and come back.
19. As a player, I want a control that clears the conversation, so that a new topic starts clean.
20. As a player, I want the conversation gone after I close the app, so that nothing about my questions is stored.
21. As a player, I want Formaquestion to know which screen, dialog and tab I have open, so that "what does this tab do?" works.
22. As a player, I want the request to carry no data from my world or my save, so that help never sends my content anywhere new.
23. As a player who set an AI Language, I want answers in that language, so that help matches the rest of the app.
24. As a player who set an AI Language, I want control names left in English, so that they match what I see on screen.
25. As a player with a vision model, I want to attach a screenshot to a question, so that I can ask "what is this?".
26. As a player whose model cannot read images, I want the attach control to be absent, so that I do not send an image that is ignored.
27. As a player, I want Send to be unavailable while a game turn generates, so that help never slows my narration.
28. As a player, I want a short reason next to an unavailable Send, so that I know why I must wait.

### Answers the player can check

29. As a player, I want each answer to list the docs sections it used, so that I can check it.
30. As a player, I want to click a source and read that section in the window, so that I stay in the app.
31. As a player, I want a clear flag on an answer that did not come from the docs, so that I know it can be wrong about Formamorph.
32. As a player, I want a general answer to "what is a sampler?" even when the docs do not cover it, so that I am not left with nothing.
33. As a player, I want the nearest docs sections shown under a flagged answer, so that I have a next place to look.
34. As a player, I want Formaquestion to tell me when the docs do not cover my question, so that I do not follow invented steps.

### Help with no AI

35. As a new player with no AI connected, I want to search the guide in Formaquestion, so that I can find how to connect one.
36. As a player whose request failed, I want the matching docs sections shown in place of an error only, so that I still get help.
37. As a player whose request failed, I want the error toast with its details, so that I can fix the connection.
38. As a player on a model with no tool support, I want an AI answer all the same, so that my model choice does not remove the feature.
39. As a player on the default cloud endpoint, I want Formaquestion to work before I set anything up, so that I get help when I need it most.
40. As an offline player on desktop or Android, I want the full guide in the app, so that I do not need the wiki.

### Reading the guide

41. As a player, I want a contents list of every docs page, so that I can browse the guide.
42. As a player, I want search results to show the page and the section heading, so that I can pick the right one.
43. As a player, I want links between docs pages to open in the reader, so that I do not leave the app.
44. As a player, I want a link to an outside site to open in my browser, so that the reader shows only the guide.
45. As a player, I want "Learn more" in a **?** help topic to open that section in Formaquestion, so that the long version is one click away.
46. As a player, I want to ask what changed in the current version, so that I learn about new features.
47. As an author who edits world files by hand, I want to ask about a field in the world format, so that I do not read the whole schema.
48. As a player, I want a glossary of Formamorph terms, so that I learn what Blueprint, Opening and Persona mean.

### Docs that are complete and correct

49. As a player, I want a How to Play page, so that the basics of a turn are written down.
50. As a player, I want a Starting a Game page, so that the Enter World steps are in one place.
51. As a player, I want a Settings page that covers every tab and section, so that I can look up any setting.
52. As a player, I want a Prompts page, so that I understand presets, per-prompt endpoints and reasoning.
53. As a player, I want a Tools page, so that I can define and try a Tool.
54. As a player, I want a saves and backup page, so that I know how my progress is kept.
55. As a player, I want a Library page, so that I understand tabs, folders and the board.
56. As a player, I want a Community Creations page, so that I understand publishing, Likes, comments, Reports and contests.
57. As a player, I want an Avatars page, so that I can load and customize a VRM avatar.
58. As a player, I want an image generation page, so that I can connect an image provider.
59. As an author, I want a Test Bench page, so that I can use its Instruments.
60. As an author, I want the Traits page to agree with the app on where Requires and Link To are, so that the steps work.
61. As an author, I want the world format reference to match the real format, so that a hand-edited world loads.
62. As a player, I want two docs pages never to contradict each other, so that I can trust either.
63. As a player, I want each page to have "How to…" sections with numbered steps, so that I can follow a task.
64. As a player, I want the **?** help topics to agree with the docs, so that short help and long help say the same thing.

### Keeping it current

65. As a developer, I want a test that fails when a new screen, dialog or tab has no docs section, so that the docs cannot fall behind silently.
66. As a developer, I want a test that fails when a help topic links a docs heading that does not exist, so that "Learn more" never opens nothing.
67. As a developer, I want a test that fails on a broken link between docs pages, so that the reader never hits a dead link.
68. As a developer, I want an explicit list of surfaces that players never see, so that the coverage test skips staff and dev screens on purpose.
69. As a developer, I want a fixed help question set with keyed facts, so that a prompt change comes with numbers.
70. As a wiki reader, I want the wiki to keep publishing from the same docs, so that the web guide and the in-app guide are the same text.

## Implementation Decisions

### Docs index

- The player docs are bundled into the app at build time as raw markdown. The index loads lazily, on the first open of Formaquestion, so the start bundle does not grow.
- The index splits each page into sections at its headings. A section has a stable id made from the page name and the heading anchor. Those anchors are the same ones the wiki uses.
- The index includes every player guide page, the world format reference, the new glossary page, and the released changelog sections of the current minor series (Q19).
- The index excludes the design system page, the writing guide, the sidebar file and the rest of the changelog.
- A section over the size limit splits at its sub-headings, then at block boundaries (list items, paragraphs, table rows) into parts. An item still over the limit splits at its nested items, recursively, and each part repeats the item's lead line, as a split table repeats its header row. A cut with a marker is only the fallback for one block with nothing to split at; the real-docs test asserts no section is cut. Part 1 keeps the section id; later parts add `-part-N` and show as "(Part N)". Getting the base id returns every part in order. Part ids and the headings built for released changelog blocks are index-only and never linked from the wiki side (ticket 15 ruling).
- The index has three operations: list the contents, search by keyword, and get sections by id. Search is a plain keyword ranking that runs in the app. It does not use embeddings and does not need a model.
- The same search serves three uses: the no-AI fallback (Q7), keyword retrieval for models with no tool support (Q10), and the nearest sections under a flagged answer (Q15).
- The help topics are not in the index (Q18).

### Help session

- The help session is a module with no React and no gameplay coupling. It takes the question, the capped history, the current surface, attachments, the AI settings snapshot and the docs index. It yields answer events.
- It builds on the existing AI Request Spec, AI Stream and tool loop. It does not add a second request path.
- The request kind is a new editor request kind (Q9). It follows the active endpoint, has a fixed prompt, forces reasoning off and has no Settings tab. Its temperature and penalties are pinned explicitly.
- Two modes, chosen before the request from the endpoint's known capability:
  - **Lookup mode:** the request offers a docs lookup function. The prompt carries the contents list and the section mapped to the current surface. The model fetches the sections it needs.
  - **Retrieval mode:** the app runs the keyword search on the question and puts the top sections in the prompt. No function is offered.
- The choice is not a retry. A request never goes out twice. This keeps the "no runtime fallback" rule of ADR-0008.
- The docs lookup is not a Tool (Q30). It never appears in the Tools tab, no preset enables it, and the Output → Tools switch does not affect it. It uses the same capability gate as Tools. A new ADR records this.
- The session reports which sections reached the model. Those become the answer's sources.
- An answer is flagged as general knowledge when no docs section supports it. The prompt gives the model a positive contract for this case, and the session derives the flag from a marker the model must emit, not from the answer's wording.
- History is capped by exchange count. Fetched section text from earlier exchanges is not resent; only the question and answer text is.
- The language directive is the same one narration uses (Q11).
- Attachments reuse the existing image intake and its cap. The attach control shows only when the active model accepts images (Q28).
- The session takes a cancel signal. The window cancels on unmount and guards every async write.

### Current surface

- A small production registry holds the ids of the open screen, dialog and tab. Screens and dialogs report to it. It replaces nothing in the dev router; it shares the dev router's id vocabulary so one list names every surface.
- A surface map ties each player-facing surface id to one docs section. The help session uses it for the screen hint. The coverage test uses it as its input.
- Surfaces that players never see are on an explicit exclusion list.
- Surface id vocabulary (ticket 01 ruling): a screen or dialog id is its bare dev-router view or modal name. A tab id is `<ledger key>.<tab>` for every tab-ledger entry, which matches the help-topic namespace. A ledger key that is not a view or modal gets only its tab ids. Router states such as layout, publish kind and event start or end are surfaces too. The Authoring Tour steps all map to one Authoring Tour heading. Exclusion reasons are `staff` and `dev`. A dev-router entry that exposes a dialog players see is a surface, never `dev`. A surface maps only to a heading that explains it; otherwise it is a known gap. The known-gaps list is grouped by owning ticket.
- The map reads the id lists as plain data; it never calls a dev-only function, so it works in production builds.

### Window

- One window instance lives at the app root, outside every dialog's inert scope and focus trap, and above every dialog layer (Q21). The prototype must prove this with our dialog library before any other window ticket starts.
- The window has three parts: the conversation with the ask field, the search results, and the reader with its contents list.
- On desktop sizes it floats and can be moved and resized. On mobile it is a full-screen sheet and handles the on-screen keyboard.
- Position and size are a per-device convenience in browser storage. They are not a setting, not in a preset and not in any export.
- The conversation lives in memory at the app root, so it outlives the window and ends with the app (Q6).
- The answer text streams through the existing streaming markdown renderer, used directly.
- The fixed button and the floating window are new visual patterns. Both need the user's approval and a design-system entry before adoption.
- F1 toggles the window (Q36). F1 and the launcher are inactive while the first-run intro animation covers the Main Menu. Tutorial popovers and Authoring Tour steps do not block F1 (ticket 16 ruling).
- The window is built in slices: ticket 16 ships the Search and Guide tabs, and ticket 20 adds the Ask tab and the conversation. Below the mobile breakpoint, until ticket 17, the launcher hides, F1 does nothing, and an open window hides with its state kept.
- Send is unavailable while a turn generates (Q16). The window reads that state; it does not join the Turn Pipeline.
- A failed request shows the standard error toast with Error Details, and the window shows the docs search for the question.
- "Learn more" in a help topic opens the window's reader at the linked section (Q26). The wiki URL builder stays for links outside the app.

### Docs work

- Every stale and contradictory statement from the audit is fixed against the code, not against the changelog.
- New pages: How to Play, Starting a Game, Settings, Prompts, Tools, Saves and Backup, Library, Community Creations, Avatars, Image Generation, Test Bench, Glossary. Account and troubleshooting topics go on the page that owns the screen.
- Every page gains "How to…" sections with numbered steps and exact control names (Q20). Reference text stays.
- How-to shape (ticket 02 ruling): one `##` heading per task, "How to <Verb> <Object>" in Title Case, so each task is its own section and anchor. The how-to sections sit together after "Why it exists" (or after the intro on a page without one), above the reference. A page's "Getting started" section folds into them and is removed when it only repeats them. Steps are numbered, with control names in bold.
- The world format reference is rewritten from the current world types.
- The glossary is written for players from the internal glossary. It leaves out developer terms.
- The seven help topics with no docs link get one. The stale help topics are corrected.
- Docs follow the writing guide. One ticket per page.
- A task has one how-to section. A feature page owns the how-tos for its feature, even when the control sits in Settings or another screen. A screen page holds a how-to only when no feature page owns that task. Other pages name the place in one line and link it. A link to a page that does not exist yet is left out; ticket 13 adds it.
- Docs use the UI's verb **download** for getting a listing. **Install** is only the glossary noun: one copy of the app's local storage, the actor behind an Anonymous Like.
- The term is **Profile Image**, matching the UI; the internal glossary renames its "Profile Picture" entry (ticket 13 ruling).
- Many surfaces may map to one heading when it explains each of them, for example a table with one row per prompt that says what the prompt does. A row with only a name does not count.

### Shape and settings

- No change to the world or save export shape.
- No new setting and no new default with an environment twin.
- New glossary terms for the internal glossary: Formaquestion, Docs Index, Surface.

## Testing Decisions

A good test here calls the module through its public operations and asserts on what a player would observe: the sections found, the request that leaves the app, the answer events. It does not assert on internal data layout.

- **Docs index (seam 1).** Feed fixture markdown; assert on sections, ids, search ranking and lookup. One test runs against the real bundled docs and asserts that every page splits into at least one section.
- **Help session (seam 2).** Drive it with the AI Stream's fake fetch option. Cover: lookup mode with a function call round; retrieval mode on an endpoint with no tool support; exactly one request per question in both modes; sources reported; the general-knowledge flag; the history cap; the language directive; the surface hint; attachments; cancel; a failed request. Prior art: the existing AI Stream and tool loop tests, and the tool runner tests.
- **Coverage test (seam 3).** Assert that every player-facing surface id maps to a docs heading that exists, that every help topic links a heading that exists, and that every link between docs pages resolves. Prove each guard bites: remove a heading and a map entry in a scratch run and confirm the test fails. Prior art: the dev router test that checks the tab registry, and the site bundle boundary test.
- **Window.** A thin component test for the three parts and the unavailable Send. Playwright covers what jsdom cannot: typing in the window while a dialog is open, typing in the dialog behind it, Escape order, drag, and the mobile sheet. Static frames and DOM reads only.
- **Help prompt.** A fixed question set with keyed facts for each docs page, run on the default cloud model with an in-batch no-docs control, 5 to 12 runs per arm. The first run is a baseline. The user sets the pass bar from it (Q24). No bar is set in this spec.
- Unmount during a stream must leave no timer or fetch behind; the suite's exit code is the check.

## Out of Scope

- Navigation from an answer ("Take Me There") and the production deep-link map it needs (Q3).
- Variant D, the frameless chat overlay, for the user's later plans (Q44). Reference: branch `prototype/formaquestion-window`, commit `f11cfe43`.
- Any edit to a world, a save or a setting by the AI.
- Reading the player's world or save to answer a question (Q2).
- Stored conversation history.
- An editable help prompt, a help endpoint route or a help Settings tab (Q9).
- Embedding-based search.
- An MCP server for outside AI apps.
- A docs-gap report to the server.
- A check that every settings label appears in the docs (Q23).
- Translated docs.
- The wiki workflow's publication of the design system page and the writing guide. It is a separate decision.

## Further Notes

- The audit found the docs gap larger than the feature. The docs tickets carry most of the effort, and they have value even before the window ships: the wiki improves with each one.
- The surface registry is the first production record of what the player has open. The later deep-link effort can build on it.
- The default cloud model ignores `seed` and drifts between batches, so every probe batch needs its own control.
- Small models can invent steps when a section is thin. The "How to…" sections are the main defense, and the sources list lets the player check.
- Two ADR files carry the number 0008 today. The new ADR takes the next free number.
