# Spec: Formaquestion, In-App Help That Answers from the Docs

Status: done
Spec session: formaquestion — spec
Status note: Closed 2026-10-03. All 54 tickets landed; ticket 54 (1806dcfc) passed the 75% bar at 77.5% grounded-correct over two batches (Q86). Open misses live in the Backlog section and need new tickets; they do not reopen this spec. History: ticket 37 failed the 80% bar (51.3%); 38 demotes hub sections, 40 explained six regressions, 41 and 42 fix them (Q69), and 39 then compares recall approaches on a blind set for the user's pick (Q67). 32 and 33 are follow-ups from the effort review; 32 and 34–36 fix the search misses from ticket 26's baseline, and 37 measures the result against the bar (Q59). 33 runs after the search tickets. 29 and 30 are follow-ups from the ticket 23 and 24 reviews; 31 ships lookup mode off (Q53). 27 fixes search in player words and 28 tunes lookup mode; both gate 26. 01 gates the docs tickets 02–12, which run in parallel; 13 closes coverage. 14 (prototype) and 15 gate the window (16). 26 sets the probe bar and waits for 13, 22, 23, 24, 27 and 28.

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
| Q37 | Escape does nothing to the window. F1, the Close control and a press on the Help tab close it; the tab toggles, as in the approved prototype (ticket 16) |
| Q38 | The launcher says **Help**. The window title says Formaquestion |
| Q39 | The launcher stays above open dialogs, in the window's layer |
| Q40 | The chip typeahead keeps painting above the window |
| Q41 | The layering approach is approved: one shielded host on `<body>` at z-65, and the dialog, alert dialog and drawer wrappers ignore presses and focus inside it. Ticket 14's Answer is the build reference |
| Q42 | Ten new visual patterns from ticket 14 are approved and go to the Design System as a proposal: the nine listed there, plus the movable edge tab (pattern 10). Pattern 11 is variant D and is not proposed |
| Q43 | Only the tab snaps to an edge. The window moves freely, stays whole on the screen, and does not follow the tab (ticket 14) |
| Q45 | The Guide contents list has one collapsible row per page. Its expander is a small plain chevron with no outline and no hover fill (user, in ticket 16) |
| Q46 | On the mobile sheet, opening moves focus to the sheet, not to a text field, so the on-screen keyboard opens only when the player taps a field. The Android back action closes Formaquestion first whenever it is open (ticket 17) |
| Q47 | Keyword search gets authored player keywords on every how-to section, plus word stemming (ticket 27). Ticket 20 measured 2 of 8 player-worded questions finding the right section |
| Q48 | Lookup mode stays. The default cloud endpoint rejects tool calls, so it serves local models with tool support. On MeroMero it answered 81% completely against 63% for retrieval, at 4.6 times the input tokens (ticket 22) |
| Q49 | The lookup prompt starts with every search hit under the retrieval budget, not the best hit only (ticket 28) |
| Q50 | The lookup prompt drops the contents list, and a re-probe must show the scores hold; otherwise the list comes back (ticket 28) |
| Q51 | The surface hint uses a table of exact UI labels per surface id, not names derived from ids (ticket 29) |
| Q52 | A flagged answer keeps its general-knowledge marker in the follow-up history (ticket 30) |
| Q53 | Lookup mode stays in the code but ships off: every question uses retrieval. After ticket 27, retrieval scored 48/48 and lookup 45/48 at about twice the tokens. Refines Q48 (ticket 31) |
| Q54 | The 5-section cap and the character budget cover the whole docs block, the surface section included, and count it once (ticket 32) |
| Q55 | The budget fix waits for ticket 26, so the baseline measures one build; it lands as ticket 32 and re-runs the "here" cases |
| Q56 | The review's standards smells go in one refactor ticket with no behavior change, after ticket 26 (ticket 33) |
| Q57 | The probe's two-per-page rule covers the guide pages only. Two "what's new" questions cover the changelog, scored on source and flag, with no keyed facts (ticket 26 ruling) |
| Q58 | Grounded-correct needs all four checks: keyed facts present, forbidden facts absent, the right section among the sources, flag correct. A key may list several acceptable sections; an answer correct from an unlisted section is reported in its own column (ticket 26 ruling) |
| Q59 | The pass bar: 80% grounded-correct on the default cloud model, over English task, "here" and follow-up questions together. Ticket 26 measured 44–50%; 92% when the right section reaches the model (ticket 37) |
| Q60 | Follow-ups from the baseline: "here" questions also search the surface's page (ticket 32), guide sections rank above the changelog (34), follow-ups weight the earlier answer's page (35), filler words do not match (36) |
| Q61 | Questions written in another language get no ticket now and stay out of the bar. The lookup arm on a local model waits until after the search fixes |
| Q62 | The changelog ranks in a hard tier: for any question that does not ask what's new, every matching guide section ranks above every matching changelog section, with no tuned weight. A what's-new question puts the released changelog sections first, newest first, even without a word match. One ranking serves the Search tab, the help session and the lookup (ticket 34 ruling) |
| Q63 | A what's-new question leads with the newest release's sections that hold text, in page order; heading-only sections are skipped. A question that names a version leads with that release instead. Guide hits follow, then older-release hits in the changelog tier. Refines Q62 (ticket 34 ruling) |
| Q64 | A follow-up's own search multiplies the score of sections on the previous answer's topic page by 2: the page of its first source that is not the surface lead, else the lead's page. A flagged answer favors no page. It is a weight, not a tier, so a real topic change still wins. The combined previous-plus-follow-up search gets no weight. The help history carries each answer's sources (ticket 35 ruling) |
| Q65 | A follow-up after a what's-new question keeps the release lead through the combined search, for now. No baseline case covers it, so it stays an open finding. Ticket 37 keeps ticket 26's set unchanged; a later ticket adds the case and decides on numbers (ticket 35 ruling) |
| Q66 | Ticket 34 is accepted although follow-ups fell 40% → 16% on the cloud model; the keyed section still reached the model and a nearby guide section drew it away. Ticket 37 measures 32 and 34–36 together, and its worst-question list drives any fix |
| Q67 | Ticket 37 failed the bar: 51.3%. The right section reaches the model for 60% of answers, and the bar needs about 93%. Before any product change, one ticket measures section recall on a fresh blind question set: keyword (control), semantic, hybrid, AI-picked sections and a bigger word map. The user picks from the numbers (ticket 39) |
| Q68 | Hub sections rank below specific ones (ticket 38). The six questions that fell while their right section still arrived get a cause each (ticket 40). Answers that say the guide does not cover a question, with no flag, get no ticket now |
| Q69 | Ticket 40: all six regressions came from the sections sent, not model drift. Ticket 34 replaced changelog sections the model ignored with guide sections that look like answers. Fixes: ticket 38's hub rule, a score floor for extra sections (ticket 41), and screen words ignored on "here" questions (ticket 42). Ticket 39 measures after them |
| Q70 | The score floor measures each search against its own best matched hit: the combined follow-up search against its own top. Always kept: the top hit, the favored follow-up hit, the what's-new lead sections and the surface section. On-page how-tos are exempt too: their keys score as low as 0.045 of the top hit and reach the block only through the on-page step (reopened on ticket 41's data). The share is chosen by a two-arm probe, 0.2 and 0.35 against no floor, not by "drops no keyed section"; the handover names the keys a chosen share drops. It is a search option the help session passes; the Search tab and the lookup pass none (ticket 41 ruling) |
| Q71 | All three recall sources ship, merged by reciprocal rank fusion: keyword with the word map in the docs (ticket 43), AI picks, and semantic (ticket 44). Each has a named on/off constant; keyword and AI picks default on, semantic off. A later Formaquestion settings page, outside this effort, will flip them, so none is a player setting yet. Ticket 39: 84% blind recall@5 for the defaults |
| Q72 | The 80% bar stays. The best measured mix projects to about 75%, so pronoun follow-ups get the next fix (ticket 45), then the bar runs again (ticket 46) |
| Q73 | Ticket 44 rulings. The floor applies only when keyword is the one source on; a merged ranking has none, as ticket 39 measured. A what's-new question keeps the release lead ahead of the merged ranking, still makes its one pick request, and the pick list stays guide-only. Section vectors are a committed generated file from a script, loaded only when semantic runs; a gate test fails on a model mismatch, while a section whose text changed is left out of the semantic ranking and does not fail the gates. "On the device" means the model files are in the browser cache: a help question loads them from there and never downloads |
| Q74 | Ticket 44 shipped the sources: 73% grounded-correct against 61% keyword-only, but "here" questions fell 98% → 82%. A pick that fails or gives nothing leaves keyword as the one ranking, so the floor applies. Ticket 47 finds a rule that keeps "here" questions on the screen. The vector script runs before each release, a step the user owns |
| Q75 | The embedding worker loads with no request to a third-party host: the ONNX runtime binary is bundled for Semantic Memory and Formaquestion alike (ticket 48) |
| Q76 | The pick request carries the newest earlier answer's text, flagged or not, with no mark: it reads the answer only to learn what a follow-up points to. Q64's no-page rule for flagged answers is about sources, not the pick (ticket 45 ruling) |
| Q77 | The "here" rule may use the question's own words: picks count only on the screen's page when the question says "here", "this" or "these". Words that point at the screen are a stated signal, like the filler and screen words of tickets 36 and 42. In the app every question has an open screen, so the recall probe gains a screen option and ticket 46 reports task recall over an open screen beside the bar (ticket 47 ruling) |
| Q78 | Over an open screen, task recall@5 fell to 54–62% against 79% with none. The screen's page how-tos join only when the question says here/this/these; the screen's section still leads (ticket 49). The bar stays as Q59 defines it, with open-screen numbers reported beside it. Ticket 49 skips the answer probe: no baseline case with a screen lacks here/this/these, so both arms send the same blocks; the recall probe over three screens is its evidence (ticket 49 ruling) |
| Q79 | Ticket 46 failed the bar at 75.5% over two batches; blind recall@5 is 87.9%. The bar stays at 80%. One more round: section-level misses (ticket 50), answers that use a sibling section (51), page-level misses (52), then a third bar run (53). Keys stay unchanged, including `memory-2` and `home-1`. Every fix is a stated rule checked on the blind set, never fitted to the known questions |
| Q80 | Reopens Q73 on ticket 50's evidence: the keyword source ranks only the hits above its score floor before the merge, so pick runs of a page's sections cannot push out keyword's top hits. The merged ranking still has no floor, and the on-page how-to step still skips it. It ships only if the live probes hold blind recall (ticket 50 ruling). Live result: blind recall fell 87.9% → 87.0% with the floor rule and 86.6% with the contraction rule too, follow-up grounded-correct fell 76% → 70%, and the bar held at 73–74%. Neither rule ships; both stay recorded as measured alternatives |
| Q81 | A keyword line may hold a feature's core term (a single word or a standard term that names the feature, such as "function calling" or "random") even when a known question uses it. Phrases from a known question stay banned. Each such line is named in the handover as found through the known set, and the blind set is the check (ticket 52 ruling) |
| Q82 | Ticket 52 fixed two of the eight page misses (blind recall@5 86.0% → 89.4%). The other six stay open into ticket 53, named in its handover: five pick misses where the AI picks another page, and `world-editor-placeholders-2`, where the stemmer splits "randomly" from "random". Page summaries in the pick list and a wrong-page parse rule did not hold the blind set |
| Q83 | No help-prompt change ships from ticket 51. Of four variants over 12 runs, the best (a heading list of the sent sections) scored +0.9 ± 1.9 points on the bar, inside drift. A prompt change ships on a measured gain, not on passing the guard. The cause is word overlap between the question and a sibling section's names, not position. All four stay recorded as measured alternatives (ticket 51 ruling) |
| Q84 | Three bar runs held at 74.5–75.5% (tickets 46 and 53), and round three gained nothing net. The bar is now 75%, replacing Q59's 80%. Two keys gain the section they are answered right from: `memory-2` and `world-editor-openings-2`, reopening Q79's key ruling on ticket 53's evidence. Ticket 54 fixes the `here-make-tool` regression, applies the keys, rescores tickets 46 and 53, and measures the final bar. Then the spec closes. Open misses go to the backlog below, with no further bar runs |
| Q85 | Ticket 54 ships no fix for `here-make-tool` or `tools-2`. Ticket 52's line was not the cause: the pick reply varies between a how-to and its reference section, and a newer `Formaquestion#tools` keyword line takes `tools-2`'s slot. Both go to the Backlog, and the bar is judged as built (ticket 54 ruling) |
| Q86 | Ticket 54 passes the 75% bar: 77.5% over two batches with the new keys (77.3%, 77.7%). The effort's acceptance is met. New losses from other pages' pick lines go to the Backlog |
| Q44 | Variant D, the frameless chat overlay, is out of scope. The user has later plans for it. The prototype branch keeps it as the reference (ticket 14) |

The [Formaquestion Settings spec](../formaquestion-settings/spec.md) replaces Q9 (fixed prompt, endpoint and reasoning; no Settings tab) and Q71 (the search sources are constants, not player settings).

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
37. As a player whose request failed, I want the app's standard failure toast, so that I can fix the problem: the connection guide when the server cannot be reached, and Error Details for any other failure.
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
  - **Lookup mode:** the request offers a docs lookup function. The prompt carries the search hits under the retrieval budget and the section mapped to the current surface, with no contents list (Q49, Q50). The model fetches more sections by search words or by a shown section id.
  - **Retrieval mode:** the app runs the keyword search on the question and puts the top sections in the prompt. No function is offered.
- The choice is not a retry. A request never goes out twice. This keeps the "no runtime fallback" rule of ADR-0008.
- The docs lookup is not a Tool (Q30). It never appears in the Tools tab, no preset enables it, and the Output → Tools switch does not affect it. It uses the same capability gate as Tools. A new ADR records this.
- Retrieval sends ranked sections under a character budget, not a fixed count: always the top hit, then more while the docs block stays under the budget, up to a maximum count. Both numbers are named constants; ticket 26's probes can tune them (ticket 20 ruling).
- The budget and the maximum count cover the whole docs block, the surface section included. The surface section counts once, even when the search also finds it (Q54, ticket 32).
- "No AI connected" means the app's existing reachability check reports the active endpoint blocked. On Send, a cached "blocked" gets one fresh check first. The default cloud endpoint always counts as connected (ticket 20 ruling).
- A fresh window opens on the Ask tab, with or without an AI (ticket 20 ruling).
- The session reports which sections reached the model. In lookup mode the sources are the fetched sections in fetch order, then the prompt's own sections, with no duplicates. The lookup call limit is a named constant in the help session; no Tools setting affects it (ticket 22 ruling). Lookup calls get their own docs budget, the same size as the prompt's, so the prompt's search hits never leave the calls empty (ticket 28 ruling). Those become the answer's sources.
- An answer is flagged as general knowledge when no docs section supports it. The prompt gives the model a positive contract for this case, and the session derives the flag from a marker the model must emit, not from the answer's wording.
- History is capped by exchange count. Fetched section text from earlier exchanges is not resent; only the question and answer text is.
- The language directive is the same one narration uses (Q11).
- Attachments reuse the existing image intake and its cap. The attach control shows only when the Image Attachments setting is on, which is the app's signal that the model reads images (Q28, ticket 25 ruling). Images go on the current question only.
- The session takes a cancel signal. The window cancels on unmount and guards every async write.

### Current surface

- A small production registry holds the ids of the open screen, dialog and tab. Screens and dialogs report to it. It replaces nothing in the dev router; it shares the dev router's id vocabulary so one list names every surface.
- A surface map ties each player-facing surface id to one docs section. The help session uses it for the screen hint. The coverage test uses it as its input.
- Surfaces that players never see are on an explicit exclusion list.
- "Help for This Screen" (ticket 18 ruling): the window itself never reports a Surface, so the item describes what is under it. The item follows the Surface live while the window is open. The lookup walks from the deepest open tab out to the dialog, then the screen, and takes the first mapped id; an excluded id on that walk shows nothing. The item is pinned as the first row of the Search tab while the query is too short, of the Guide contents, and of the wide rail. A display state (narration layout) and an inline card (the Like prompt) stay mapped for coverage but never report, so they never hide the screen's own help.
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
- A failed request shows the app's shared AI-failure toast, the same as in play: an unreachable server gets "Couldn't reach your AI server." with **Fix connection →**, which opens the Connect Your Own AI page in the reader; any other failure gets Error Details. The window shows the docs search for the question.
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
- An editable help prompt, a help endpoint route or a help Settings tab (Q9). This is now in scope: see the [Formaquestion Settings spec](../formaquestion-settings/spec.md).
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

## Backlog

Open after the bar closed at 75% (Q84). No ticket is written. Each needs a stated rule checked on the blind set.

| Gap | Questions (ticket 53) | What was tried |
|---|---|---|
| 🔎 Search misses: the AI picks another page, or keyword ranks a sibling | `library-2`, `prompts-1`, `statcodeguide-2`, `memory-1`, `personas-1`, `follow-default-make`, `entities-2`, `persona-authoring-2`, `world-editor-openings-4`, `worldformat-3`, `world-editor-dictionary-1` | Page summaries in the pick list, a wrong-page parse rule (52), a keyword floor before the merge and contraction tokens (50). None held the blind set |
| 🔤 Stemmer split: "randomly" and "random" stem apart | `world-editor-placeholders-2` | Not tried |
| 🧭 Model answers from a sibling section that shares the question's words | `follow-backup-restore`, `saves-and-backup-2`, `formaquestion-1`, `glossary-1`, `statcodeguide-3`, `world-editor-entities-2`, `world-editor-stats-1` | Four prompt variants (51), all inside drift |
| 🖥️ Task recall over an open screen trails no screen by 7–19 points | Recall probe, three screens | Q77 and Q78 gates |
| 🌐 Questions in another language | 8 questions; AI picks lifted them to 75–80% | Out of the bar (Q61) |
| 🧪 Semantic source: built, off, never measured live in the app | – | Ticket 39 offline only |
| 🔁 A follow-up after a what's-new question keeps the release lead | No baseline case | Q65 |
| 💾 Portable Electron build loses the model cache under a long exe path | – | Found in ticket 48 |
| 🎲 The pick reply names a reference section instead of its how-to, so the how-to misses the on-page step | `here-make-tool` | Found in ticket 54; the reply shifts with other pages' pick lines |
| 📄 A newer docs section's keyword line takes a keyed section's slot and draws the answer | `tools-2` (`Formaquestion#tools` over `Tools#endpoints-without-tool-support`; co-occurrence only, no ablation) | Found in ticket 54 |
| 🔀 The pick list is a shared input: new lines on one page move picks on other pages | `library-1` 10/10 → 0/10 and `follow-group-add` 7/10 → 0/10 after new `Formaquestion.md` lines; `here-make-tool` | Found in ticket 54. Any docs ticket should run the recall probe before it lands |
