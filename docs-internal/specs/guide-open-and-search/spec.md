# Spec: Guide Open and Search

Status: done
Status note: Closed 2026-10-11. Tickets 01–10 done; last landing 8dfb914a8. Closed red: src/components/prompt/CodeArea.test.tsx (failed once under full load, passed 3 of 3 alone; not this effort's code).
Spec session: guide-open-and-search — spec

## Problem Statement

Players report that the help buttons are gone. The Formaquestion window is small, and a player who wants to read the docs at length has no larger view. A player who prefers the wiki has no way to reach it from the app.

The Guide search also feels strict. It matches whole word roots only, so:

- a partial word finds nothing while the player types ("plac" before "placeholder");
- a typo finds nothing ("placholder");
- a question in the player's own words misses a section that uses other words.

Semantic Search exists for the Ask tab, but it is off by default, the Search tab never uses it, and few players find its switch.

## Solution

- **Open Guide** opens the Guide full screen: the search and contents rail on the left, the reader on the right. It is in the ⋮ menu and, in the Full chrome, on a title-bar button (Q26).
- **Open Wiki** opens the wiki page and heading the reader shows, or the wiki home with no section open. It confirms first, with a **Don't Ask Again** checkbox. It is in the ⋮ menu and in the full-screen Guide header.
- The keyword search matches partial words and close spellings, on the Search tab and in Ask.
- The Search tab merges Semantic Search with the keyword search, the same way Ask does.
- On first open, a card in the help window offers Semantic Search as recommended. The player picks **Turn On** or **No Thanks**. When the model is already on the device, Semantic Search turns on with no card.
- In Wide View and the full-screen Guide, **< >** Back and Forward buttons move through the reader's view history, as in a browser.
- A press, a focus move or Escape in the help window no longer closes a popup or dialog below it, such as a select in Settings or Settings itself (Q23, Q29).

## Rulings

Settled with the user on 2026-10-11.

| # | Ruling |
|---|---|
| Q1 | Open Guide shows the Guide reader full screen. Ask and Search stay in the small window |
| Q2 | Open Wiki opens the wiki page and heading the reader shows; the wiki home with no section open |
| Q3 | Search gets partial words, close spellings (A) and meaning match (B). A first-open offer asks the player to turn on Semantic Search, marked as recommended |
| Q4 | Ask uses meaning match too. The probes re-run and must meet the Q16 bar |
| Q5 | No Thanks is final. The card never shows again |
| Q6 | The existing Semantic Search switch in the help window's General settings stays the one control |
| Q7 | With the switch on and the model not ready, search uses keywords alone, with no notice |
| Q8 | The full-screen Guide holds the rail (search field and contents) and the reader |
| Q9 | Superseded by Q26. Open Guide is in the ⋮ menu and on an expand button in the Guide tab header |
| Q10 | Partial words and close spellings apply to the Ask tab's keyword source too |
| Q11 | When the model is already on the device, the card does not show and Semantic Search turns on |
| Q12 | Every undecided player sees the card, new and existing. A player who set the switch already is decided |
| Q13 | Open Wiki confirms every time, with a Don't Ask Again checkbox |
| Q14 | The offer is a card at the top of the help window, not a modal. The player can ask while it shows |
| Q15 | A switch in the help window's General settings turns the wiki confirm back on |
| Q16 | Ask probes with fuzzy keywords and Semantic Search on match or beat 77.5% answer quality and 93% Take Me There on the cloud model |
| Q17 | A card left unanswered shows again on the next open |
| Q18 | The full-screen Guide header has an Open Wiki button |
| Q19 | Wide View and the full-screen Guide show Back and Forward buttons. Each reader change is a history entry: a section opened from any place, and in Wide View a switch to the conversation |
| Q20 | Back and Forward restore the scroll position the entry had |
| Q21 | Alt+Left / Alt+Right and the mouse back and forward buttons also move through history, while the input is in the help window |
| Q22 | One history, in memory with the Guide view. It survives a close and a change between layouts, clears on reload, and holds at most 50 entries |
| Q23 | A press, a focus move or Escape inside the help window never closes a popover, select or menu outside it. A popup inside the help window still closes as today |
| Q24 | The fix is ticket 08 in this spec |
| Q25 | Turn On marks the offer decided at once. The card stays only while the download runs or has failed, with the switch's progress and Retry, and hides when the model is ready. After a reload, a failed download shows no card; Retry lives in the Settings switch |
| Q26 | Replaces Q9's "Guide tab header": in the Full chrome, an Open Guide icon button sits in the title bar beside Wide View and ⋮, in both layouts. Minimal and Bubble have the ⋮ item only |
| Q27 | Open Guide opens on the reader piece's section in Minimal and Bubble, else the Guide view's section. On close, the full screen's section goes back to both |
| Q28 | The full screen shares the whole Guide view: query, open pages and section. With no section open, the reader pane shows an empty-state hint beside the rail |
| Q29 | Q23 extends to dialogs: the dialog, drawer and alert-dialog wrappers also ignore Escape from the help layer. Escape in help never closes an app dialog below it. Help-owned dialogs, which cover the layer, keep their Escape |
| Q30 | Fuzzy keywords try prefixes first. Close spellings apply only when no indexed word starts with the query word, so "plac" never leads with "plan". A typo that is also the start of another word gets no correction |
| Q31 | A query word with a digit never expands: version numbers and counts match exactly |
| Q32 | Ticket 06 runs three arms in each batch: as shipped with Semantic on, the control (fuzzy off, Semantic off), and fuzzy-only. 5 runs per arm in each of two batches |
| Q33 | Q16's 93% Take Me There applies to the live route of each answer (its first non-lead source), as no regression against the in-batch control. The offline route probe re-runs as a check |
| Q34 | The probe builds section vectors from the current docs in memory. The shipped vectors file is rebuilt at release, not in ticket 06 |
| Q35 | In the full-screen Guide, Back and Forward skip conversation entries and land on the nearest section entry. A button is disabled when no section entry is left in its direction |
| Q36 | Ruled by the user in the ticket 06 session: Q16 is met. Answer quality 77.4% against the 77.5% bar counts, since the in-batch control runs 73.9% today (+3.5). Route hit 67.5% vs control 67.6%; offline route probe 93%. Ask's semantic source keeps a similarity floor of 0.45, tuned on the known set only |
| Q37 | Accepted as built: the Minimal and Bubble reader piece does not record history. Those chromes show no Back or Forward. Amends Q19 |
| Q38 | Accepted as built: the wiki confirm is an app alert dialog, and the help window sinks below it while it shows |
| Q39 | Accepted as built: a card with a failed download has a Dismiss button that hides it. Retry stays in the Settings switch |
| Q40 | Review follow-ups: ticket 09 adds this effort to the player docs; ticket 10 checks hover cards, the chip typeahead and Base UI popups under help, and adds a dev route for the wiki confirm |
| Q41 | Recorded by the spec session as built, not ruled by the user: Back to the conversation does not restore its scroll (it follows its newest message); full screen also skips the section it already shows; the floor batches replaced the fuzzy-only arm with an unfloored arm |
| Q42 | Page chip typeaheads (the `{` chip typeahead and tag suggestions) move from z-70 to z-60: above dialogs and popovers, below the help window, so they never draw over help or take its presses. Base UI tooltips closing on an outside press or Escape is not a leak (WCAG 1.4.13). The app uses no hover cards |
| Q43 | The wiki confirm gets its own docs section, "The Wiki Confirm", routed to the confirm and mapped from it. "How to Open the Wiki" keeps its route to the help window |

## User Stories

1. As a player, I want an Open Guide item in the ⋮ menu, so that I can read the docs in a large view.
2. As a player in the Full chrome, I want an Open Guide button in the title bar, so that I find the large view without the ⋮ menu.
3. As a player, I want the full-screen Guide to keep the search field and contents, so that I can move between sections without going back to the small window.
4. As a player, I want the full-screen Guide to open on the section I was reading, so that I do not lose my place.
5. As a player, I want closing the full-screen Guide to return me to the small window on the same section, so that I keep my place both ways.
6. As a player, I want Escape to close the full-screen Guide, so that it acts like other full-screen views.
7. As a player, I want an Open Wiki item in the ⋮ menu, so that I can read the docs in my browser.
8. As a player, I want Open Wiki to open the page and heading I am reading, so that I land on the same text.
9. As a player with no section open, I want Open Wiki to open the wiki home, so that the item always works.
10. As a player, I want a confirm before the app opens my browser, so that I do not leave the app by accident.
11. As a player who uses the wiki often, I want a Don't Ask Again checkbox, so that the confirm stops slowing me down.
12. As a player who checked Don't Ask Again, I want a switch in help Settings to turn the confirm back on, so that the choice is not permanent.
13. As a player in the full-screen Guide, I want an Open Wiki button in its header, so that I do not need the ⋮ menu.
14. As a desktop player, I want Open Wiki to open my system browser, so that the wiki does not replace the app window.
15. As an Android player, I want Open Wiki to open my browser, so that the app stays where I left it.
16. As a player typing in the search field, I want results for a partial word, so that results show before I finish the word.
17. As a player who makes a typo, I want the close spelling to match, so that one wrong letter does not hide every result.
18. As a player, I want exact matches to rank above close spellings, so that a correct word still finds its own section first.
19. As a player, I want a short query to stay strict, so that two letters do not match half the docs.
20. As a player who types a question in my own words, I want the Search tab to find sections by meaning, so that I find the section without knowing its words.
21. As a player, I want Search tab results to show as I type without lag, so that meaning match does not slow the field.
22. As a player asking a question in Ask, I want the keyword source to match close spellings, so that a typo in my question still finds the right docs.
23. As a player opening help for the first time, I want a card that offers Semantic Search, so that I know the option exists.
24. As a player, I want the card to say Semantic Search is recommended and improves help, so that I can decide quickly.
25. As a player, I want the card to say it downloads a small model once, so that I know the cost.
26. As a player who picks Turn On, I want the download to start and show progress, so that I know it is working.
27. As a player whose download fails, I want a way to retry, so that one failure does not end the feature.
28. As a player who picks No Thanks, I want the card never to return, so that I am not asked again.
29. As a player who closes help without picking, I want the card to show again next time, so that the choice is still mine to make.
30. As a player, I want to ask a question while the card shows, so that the card does not block help.
31. As a player who already has the model for semantic memory, I want Semantic Search to turn on with no card, so that I am not asked about a download that does not happen.
32. As an existing player who already set the Semantic Search switch, I want no card, so that my choice stands.
33. As an existing player who never touched the switch, I want to see the card once, so that I learn the feature exists.
34. As a player who refused, I want the Semantic Search switch in help Settings to still work, so that I can change my mind.
35. As a player offline on web with the switch on and no model, I want search to keep working with keywords, so that help never breaks.
36. As a player whose model is still downloading, I want search to use keywords until it is ready, so that I do not wait.
37. As a player on mobile, I want the full-screen Guide to fill the screen, so that it reads well on a small display.
38. As a player using the Bubble or Minimal chat style, I want the same menu items and card, so that every style offers the same help.
39. As a keyboard player, I want every new control to be reachable and labeled, so that I can use them without a mouse.
40. As a docs maintainer, I want the semantic vectors to stay in sync with the docs, so that meaning match never ranks a stale section.
41. As a player in Wide View or the full-screen Guide, I want Back and Forward buttons, so that I can return to a section I read before.
42. As a player, I want Back to return me to where I was in that section, so that I do not scroll again.
43. As a player in Wide View, I want Back to return from a section to the conversation, so that one history covers both.
44. As a player, I want Alt+Left and Alt+Right to move through history, so that the browser keys work.
45. As a player with a mouse, I want its back and forward buttons to move through history, so that they act as in a browser and never leave the app.
46. As a player, I want the history to survive closing the window and switching to full screen, so that I keep my trail.
47. As a player at the start or end of my history, I want the matching button disabled, so that I know there is nowhere to go.
48. As a player who goes back and then opens a new section, I want the forward entries dropped, so that history acts as in a browser.
49. As a player with a Settings popup open, I want a click in the help window to leave the popup open, so that help never changes the screen below it.
50. As a player, I want Escape in the help window to act on help only, so that it never closes a popup below it.
51. As a player, I want a popup inside the help window to still close when I click elsewhere in help, so that help's own menus act as before.

## Implementation Decisions

- **Docs Index keyword search** gains partial-word and close-spelling matching. A query term with no exact match expands to vocabulary terms that start with it, or that are one edit away (two for long words). An expanded term counts for less than an exact one. A short term (under the existing two-letter floor, plus a minimum for expansion) does not expand. The index builds its vocabulary once. The ranking rules stay as they are: hub penalty, What's New lead, favored page, changelog last.
- **Fuzzy matching is on for every caller.** Ask's keyword source, the docs lookup function and the Ask fallback get it with the Search tab (Q10).
- **The Search tab uses the help session's merged search.** The rank-fusion search that Ask uses today becomes a function the Search tab calls, with the sources Keyword and Semantic. AI Search stays off for the Search tab. It costs a request per keystroke.
- **Semantic ranking on the Search tab** runs after a short pause in typing. The keyword results show at once, and the merged results replace them when the semantic ranking returns. Every semantic hit needs a minimum similarity, so a nonsense query still reads "No sections match". The Search tab and Ask each have their own floor (Ask's is Q36).
- **The semantic source never starts a download** (as today). It runs only when the model is on the device and the switch is on.
- **Help settings** gain two fields:
  - the Semantic Search offer state: undecided, or decided. A player who flips the switch is decided.
  - a wiki confirm flag, on by default.
  Both live in the help settings store on the device. No world or save export shape changes.
- **The offer card** shows at the top of the help window when the offer is undecided and the switch is off. On open, if the model is already on the device, the switch turns on and the offer becomes decided with no card. Turn On marks the offer decided and starts the existing download through the Semantic Search switch; the card then follows the download (Q25). A failed download shows Retry and a Dismiss button that hides the card (Q39). No Thanks marks the offer decided. Closing the window unanswered leaves it undecided.
- **Open Guide** uses the existing full-screen morph that the Mascot and Prompts settings tabs use. The full-screen view renders the Guide tab's rail and reader. It shares the Guide view state, so the open section and open pages carry both ways.
- **Open Wiki** builds the URL from the wiki base and the reader's section id. The section id already follows the wiki's anchor rule; a split section's part suffix drops. One shared function opens external links. Desktop already routes `window.open` to the system browser. Android needs a check that `window.open` leaves the WebView, and a fix if it does not.
- **The wiki confirm** is an app alert dialog, with the target page named, Open and Cancel, and the Don't Ask Again checkbox. The help window sinks below it while it shows (Q38).
- **The ⋮ menu** gains Open Guide and Open Wiki in both chromes.
- **Reader history** joins the Guide view state: a list of entries (a section id, or the conversation) with scroll positions, and a cursor. A reader change pushes an entry and drops the forward entries. Back and Forward move the cursor and do not push. History records the Full chrome's reader; the Minimal and Bubble reader piece does not record (Q37). The buttons show only in Wide View and the full-screen Guide. The mouse side buttons are caught inside the help window, so they never reach the app's own route history.
- **Outside-press guard for popups:** the popover, select and context-menu wrappers ignore an outside press or Escape whose target is in the shielded layer, when their own content is outside the layer. Content inside the layer keeps today's dismissal. The guard lives beside `ignoreLayerPress` and keeps that module import-free for the account site bundle. The dialog, drawer and alert-dialog wrappers also ignore Escape from the layer (Q29). The layer already stops focus moves.
- **The glossary** entry for Search Source changes: the Search tab uses Keyword and Semantic.

## Testing Decisions

- A good test drives the public behavior: a query in, ranked section ids out; a click in, a rendered state out. It does not read internal state or private functions.
- **Docs Index search** (prior art: the docs index tests): partial words, close spellings, exact-over-fuzzy order, the short-term floor, and that expansion keeps the hub and What's New rules. Each guard is proven to bite by reinstating the strict match.
- **Help session search** (prior art: the help session sources tests, with a fake embedder): the Search tab's merged ranking, the keyword-only fallback when the model is not on the device, and the similarity floor.
- **Help settings** (prior art: the help settings tests): defaults, parse of stored values, and that a switch flip marks the offer decided.
- **Formaquestion component** (prior art: the landing tests): the ⋮ items in both chromes, the title-bar Open Guide button, the full-screen Guide keeping its section both ways, the card's three outcomes, the silent turn-on when the model is cached, the wiki confirm and its Don't Ask Again path, and the URL for a section, a split section and no section.
- **Reader history** (prior art: the Formaquestion component tests): push, Back, Forward, forward entries dropped on a new open, the 50-entry cap, scroll restored, the keys and mouse buttons, and history kept across a close and a layout change.
- **Outside-press guard** (prior art: the shielded-layer and context-menu tests): a press, focus move and Escape in the layer leave an outside popup open; a press in the layer still closes a popup inside it; a press elsewhere still closes both. Each guard proven to bite.
- **Probes**: the help retrieval and baseline probes on the cloud model, with fuzzy keywords and Semantic Search on, against the Q16 bar. In-batch controls with today's ranking.
- **UI verification** through the dev-router for the card, the full-screen Guide and the confirm, in both themes. The confirm's dev route is ticket 10.

## Out of Scope

- AI Search on the Search tab.
- Bundling the embedding model into the desktop or Android build.
- Changing the semantic model or the section vector format.
- Restoring the old per-screen help buttons.
- A wiki inside the app other than the Guide.

## Further Notes

- The semantic model and its cache are shared with semantic memory. One download serves both.
- The section vectors ship with the app. Docs edits must regenerate them, as today.
- New copy (card, menu items, confirm, settings switch) gets a copy-sweep pass.
- **Open:** with the floor, follow-up questions trail the control (70% vs 77%, 10 questions, two batches). Not yet probed further.
- **Release:** 24 shipped section vectors are stale; ticket 06 lists them. Rebuild with `npm run build:help-vectors` before release.
