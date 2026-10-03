# Spec: Formaquestion Settings

Status: done
Spec session: formaquestion-settings — spec
Status note: Done on 2026-10-03. Tickets 01–19 landed; the last landing is bf73bc91. Gates green on 2026-10-03.

## Problem Statement

Formaquestion has no settings. Every part of a help question is fixed in code:

| Fixed today | Effect on the player |
|---|---|
| The endpoint is the active one | A player cannot send help questions to a different model than the game uses |
| Reasoning is off | A reasoning model cannot think about a hard question |
| The search sources are constants | Semantic search and lookup mode exist, and no player can turn them on |
| The prompts are fixed text | A power user cannot change how answers read |
| The answer reveal uses narration's pace | The help text does not follow the player's own choice |
| The request is not visible | A wrong answer cannot be traced to a search miss or a prompt fault |
| The sources chips always show | A long conversation fills with chip rows |

The developer has the same problem as the power user: to debug an answer, the only tools are the probe scripts.

## Solution

A gear in the Formaquestion header opens **Formaquestion Settings**, a modal the size of the Settings modal with four tabs:

| Tab | What the player sets |
|---|---|
| **General** | Reasoning, the search sources, the open screen, the answer reveal, the AI Context button |
| **Endpoint** | The endpoint for answers and the endpoint for AI Picks |
| **Prompts** | The help prompt preset: a read-only Default, and the player's own copies |
| **Tools** | The functions the answer request can call: the guide lookup, the catalog Tools, and the player's own Formaquestion Tools |

An **AI Context** button in the header shows each request of each question, in the same popup design as the game view.

On each answer, the **Sources** list and the **Thinking** block collapse. Each remembers the player's last choice for later answers.

Every default equals the behavior of today. A player who never opens the settings sees no change, except the collapse control.

## Rulings

Settled with the user on 2026-10-02. A later ruling that refines an earlier one names it.

| # | Ruling |
|---|---|
| Q1 | The settings open from a gear in the Formaquestion header. Refined by Q18 |
| Q2 | The tools section lists Formaquestion's own functions. Widened by Q33 and Q34 |
| Q3 | The help endpoint is a device setting of its own, outside the prompt presets |
| Q4 | Ticket 46 of the Formaquestion effort runs first. This effort keeps the defaults that the bar run measures |
| Q5 | Reasoning is an effort select, default Off |
| Q6 | AI Picks, Semantic Search and Lookup Mode get switches. Keyword gets one too (Q40) |
| Q7 | The answer reveal has its own setting. Refined by Q17 and Q29 |
| Q8 | Help prompts work as the gameplay prompts do: a read-only Default that takes updates, and custom copies the player duplicates and edits. All three prompts are editable: answer, pick, lookup |
| Q9 | Formaquestion has its own preset list. A change of the gameplay prompt preset does not change help |
| Q10 | A help preset holds the three prompts. Every other setting is a device setting that applies to every preset. **Amended by Q58:** the prompts' request options belong to the preset too |
| Q11 | A custom help preset exports to a file and imports from one. No community sharing |
| Q12 | Lookup Mode is the switch of the guide lookup function on the Tools tab. There is one control |
| Q13 | AI Context is one button in the Formaquestion header. It shows every question of the conversation |
| Q14 | A switch on the General tab shows the AI Context button. Default off |
| Q15 | AI Context shows a Search block for each question: each source's ranking, the merged order and the sections sent |
| Q16 | With reasoning on, the reasoning text shows in a collapsed Thinking block on the answer |
| Q17 | The answer reveal copies the Narration Reveal row: the same button and the same dialog |
| Q18 | The settings are a modal the size of the Settings modal, with tabs. A view inside the help window is too cramped |
| Q19 | AI Context is a separate popup with the design of the game view's AI Context |
| Q20 | The Thinking block follows the Sources rule (Q46), with its own stored default |
| Q21 | Semantic Search downloads its embedding model when the switch goes on, with progress on the row |
| Q22 | The mobile sheet gets the settings and AI Context |
| Q23 | A custom prompt has a Compare to Default action that reuses the prompt diff viewer |
| Q24 | No action resets everything. Reset exists only where the regular Settings has it: the endpoint and the prompt |
| Q25 | The tabs are General, Endpoint, Prompts and Tools |
| Q26 | The Endpoint tab holds the full text-endpoint editor, on the same presets as the regular Settings, plus a Follow Active choice |
| Q27 | AI Picks has its own endpoint |
| Q28 | The reasoning control applies to the answer request only. The pick request stays at reasoning off |
| Q29 | The reveal values of help start at narration's defaults. They never follow narration's values |
| Q30 | The help window stays above the settings modal and above AI Context, as above every dialog |
| Q31 | The first tab is General |
| Q32 | The pick endpoint defaults to Same as Answer |
| Q33 | The Tools tab uses the Tools layout, and the player can add custom Tools. A dedicated player can make Formaquestion a chat assistant |
| Q34 | Formaquestion Tools are a separate list from the gameplay Tools |
| Q35 | The Tools tab lists the catalog Tools, all off by default. Replaced by Q47 |
| Q36 | A Tool in a help question reads the open world, else an empty snapshot |
| Q37 | The Tools switch in Settings → Output does not apply to Formaquestion. The check that the endpoint takes function calls stays |
| Q38 | Formaquestion Tools import and export with the existing Tool pack file |
| Q39 | An exported help preset file holds the three prompts, plus the player's Formaquestion Tools and their switches |
| Q40 | Keyword Search gets a switch, default on, so every source can be off |
| Q41 | When no docs section reaches the model, the user message is the bare question, and the answer gets no general-knowledge flag |
| Q42 | A Use the Open Screen switch, default on, controls the screen section and the screen line |
| Q43 | The answer prompt gets sampler fields and a Max Output field in its Options, with the per-prompt controls. The defaults stay 0.2, 1 and 800. **Amended by Q58:** they are preset fields, not device settings |
| Q44 | A History Length field sets how many earlier exchanges a request carries. Default 4 |
| Q45 | These stay as they are: the marker strip, the language suffix, the fixed window copy, the game turn lock. The conversation does not persist through a reload |
| Q46 | Sources: each answer owns its open state. A click changes that answer only, and it also sets the default for later answers. The default is stored on the device. An answer takes the default when its sources arrive. Nearest Sections shares the default. There is no settings row |
| Q47 | The catalog Tools are worded for narration: they name an entity list, a scene and a story that a help request does not have. The Tools tab lists the guide lookup, a help-worded dice roll that is off by default, and the player's own Tools. The four lookups (entity, location, dictionary entry, recall) are not listed. Replaces Q35 |
| Q48 | The Formaquestion endpoint editor never changes the game's active endpoint. Its preset select chooses the preset to edit, as view state of the tab, and it starts on the preset that answers resolve to. Add New Preset adds to the shared list and opens the new preset in the editor; it changes no route. The Answer Endpoint and Pick Endpoint selects are the only controls that change where help requests go. An edit to a preset's fields still applies everywhere that preset is used, the game included. From the ticket 01 session; follows from Q3 and story 18 |
| Q49 | The "Same as Answer" row of the Pick Endpoint select is built in ticket 07. Ticket 01 changes no behavior and adds no row |
| Q51 | Q41 fires on the settings, not on a search result. A question goes bare and unflagged only when no part of the request can carry a section: Keyword, AI Picks and Semantic are off, the guide lookup is not offered (off, or the endpoint does not take function calls), and Use the Open Screen is off or the open screen maps to no section. A search that runs and finds nothing keeps today's empty guide block and the forced flag, as story 61 needs. Player Tools do not count as a source. From the ticket 05 session |
| Q52 | On the mobile sheet, a full-screen dialog opened from Formaquestion (the settings modal, AI Context) hides the sheet while it is open, and closing it brings the sheet back as it was. The sheet is hidden, not unmounted: the conversation, the scroll place and a streaming answer continue. Q30 holds on desktop. Refines Q22 and Q30. From the ticket 05 session |
| Q53 | The device settings are one stored value with a field-by-field codec, stored by a hook of its own that writes only on a change and survives blocked storage, not by the app's persistent-state helper. Later tickets add their fields to that value. History Length takes 0 to 20. From the ticket 05 handover |
| Q54 | Ticket 07's routing details. (a) Images: the Image Attachments switch stays the only gate; no endpoint is checked for vision, and ticket 07's "image attachments check" line was wrong. (b) The bundled engine is wanted while the answer route or the pick route resolves to it, with the window open or closed, as for a pinned game prompt. (c) A reachability badge shows only for a route that names a preset; Follow Active and Same as Answer show none, and the Ask tab's "no AI" state covers them. From the ticket 07 session |
| Q55 | Ticket 09's reasoning details. (a) The help reasoning row keeps the Global level, as a game prompt does. The stored default is the shipped help default: switch off, level Global, budget 75%. With the switch off, the answer request sends reasoning off whatever Settings → Output → Native Reasoning says, so the measured default holds (Q4, Q5). (b) The Thinking block shows any reasoning text that arrives, native or inline, also with the setting off, because an endpoint that refuses off still reasons. Refines Q16. (c) A vLLM-dialect endpoint before its first reply shows the full field, as the Output row does; only a model ruled out shows the unavailable note. (d) The General row has its own label, Reasoning, its own description and an ⓘ that explains Global; the shared field takes its copy as props. From the ticket 09 session |
| Q56 | "Follow Active" is the spec's name for the concept, not UI text. Both help selects show the row text the Settings select uses, "Use Active Endpoint (<name>)", so one concept has one term. The pick select's extra row reads "Same as Answer (<name>)". Docs use the UI text. From the ticket 07 session |
| Q57 | Help's reveal timing is computed per answer from the default pace and help's own minimums, and passed to the renderer as a prop. There is no second stored timing value and no help pacer. From the ticket 10 session |
| Q58 | The answer options (temperature 0.2, repetition penalty 1, Max Output 800) belong to the help preset, not the device settings. The Default preset shows them read-only, so each release updates them for players on it, and a duplicate copies them. They show as an Options row nested under Answer in the Prompts rail. Reverses Q10 and Q43 for these three fields. **The rule for every later ticket: a setting that shapes a prompt's request (samplers, caps, and any option a prompt gains) belongs to the preset, shows in that prompt's Options row, and the Default preset shows it read-only. Settings of the window, the endpoint routing, the sources and the switches stay device settings.** A ticket that adds a prompt option follows this rule and does not ask again. The preset file carries them (ticket 17). The user's ruling, made in the ticket 13 session (e8b2f425) |
| Q59 | Max Calls per Request is a property of a function, as it is of every Tool, not a prompt option under Q58. The guide lookup's limit is a device setting beside its switch (default 3, range 1 to 20), edited on the Tools tab only. A Formaquestion user Tool keeps its limit on the Tool. The preset file carries the fixed functions' limits with their switches (ticket 17). From the ticket 14 session |
| Q60 | Ticket 15's Tool details. (a) A name conflict on import follows the existing Tool pack rule in both lists: the Tool is skipped and named in the message. No rename. This also applies to the Tools inside a help preset file (ticket 17). (b) A Tool made in Formaquestion carries an empty Offered To into a pack, so a gameplay import shows it under No Prompts until the player picks. (c) The Formaquestion Tools and their switches are fields of the help settings value (Q53). The editor's open world is the world in the editor, unsaved edits included. The world-text line always shows on the tab. Fixed function names are refused as Tool names at save, import and copy. From the ticket 15 session |
| Q61 | Ticket 16's roll details. (a) The help roll's Max Calls per Request is a device setting beside its switch (Q59), range 1 to 20, default 4: the app's default Tool call limit, which the catalog roll gets today, so a roll behaves the same in both places. (b) Roll on and lookup off sends the retrieval prompt with the roll offered; both on sends the lookup prompt with both functions, the lookup first. The roll is not a source for Q51's bare question. From the ticket 16 session |
| Q62 | Ticket 18's AI Context details. (a) The popup has the game view's Export button, reusing its export: Q19 reuses the in-game design, and story 51 needs a bug report to carry what AI Context shows. (b) The Search block shows each source's top 10 and the merged top 10 for each query a question runs (a follow-up runs two). Every section that reached the model is listed and marked, also when it ranks below 10. (c) Cards are titled with the UI labels, "AI Picks" and "Answer", not the request kind. From the ticket 18 session |
| Q63 | Ticket 15's review details. (a) A Tool the player makes or saves new in Formaquestion starts on, as in the regular Tools tab; an imported Tool starts off. The docs say so. Refines "default off" in ticket 15. (b) When the in-game World Editor is open over a game, help Tools read the editor's world, the screen on top; the game's world returns when the editor closes. The newest mounted world source wins. From the ticket 15 session |
| Q50 | The answer samplers join the help settings value in ticket 13, not ticket 04. They are a request-kind pin today that the pick request shares, so they need a call-level sampler override; ticket 13 adds the field, the override and the controls together, and the pick request keeps the pin. From the ticket 04 session |

### Rulings of the Formaquestion spec that this effort replaces

| Old ruling | Change |
|---|---|
| Q9: fixed prompt text, the active endpoint, reasoning off, no Settings tab | Replaced by Q3, Q5, Q8 and Q18 here. The defaults keep the old behavior |
| Q2: a request carries no world data | Holds by default. A Tool that the player turns on can read the open world (Q36) |
| Q30: the docs lookup is an app-internal function, outside the Tool catalog | Holds. The lookup shows on the Tools tab as a fixed row. The player cannot edit or delete it |
| Q71: the search sources are constants, not player settings | Replaced by Q6 and Q40 |
| Out of scope: an editable help prompt, a help endpoint route, a help Settings tab | In scope here |

## User Stories

### Opening the settings

1. As a player, I want a gear in the Formaquestion header, so that I can find the settings from the help window.
2. As a player, I want the settings in a modal as large as the Settings modal, so that the controls are not cramped.
3. As a player, I want the help window to stay usable above the settings modal, so that I can change a setting and ask a question to see the effect.
4. As a mobile player, I want the same settings from the mobile sheet, so that my device has them too.
5. As a player, I want tabs named General, Endpoint, Prompts and Tools, so that the layout matches the Settings modal I know.

### General

6. As a player with a reasoning model, I want a reasoning effort select for help answers, so that the model can think about a hard question.
7. As a player, I want reasoning Off by default, so that answers stay fast.
8. As a player, I want the effort list to match what my help endpoint supports, so that I do not pick an effort it refuses.
9. As a player, I want a switch for AI Picks with its cost stated, so that I can trade one request for speed.
10. As a player, I want a switch for Semantic Search, so that I can find sections by meaning.
11. As a player, I want the Semantic Search row to show download progress and a failed state, so that I know when the source is ready.
12. As a power user, I want a switch for Keyword Search, so that I can turn every source off.
13. As a power user, I want a Use the Open Screen switch, so that my questions do not carry the open screen.
14. As a player, I want an Answer Reveal row with the same button and dialog as Narration Reveal, so that I set the help text's animation the same way.
15. As a player, I want the help reveal values to be separate from narration's, so that a change to one does not change the other.
16. As a player, I want a History Length field, so that a long conversation keeps more or fewer earlier exchanges.
17. As a power user, I want a switch that shows the AI Context button, so that the debug control appears only when I ask for it.

### Endpoint

18. As a player, I want to choose the endpoint for help answers, so that help can use a different model than the game.
19. As a player, I want Follow Active as the default, so that help uses my game endpoint until I change it.
20. As a player, I want the same endpoint presets as the regular Settings, so that I set up an endpoint once.
21. As a player, I want to add, rename, edit, delete and reset an endpoint preset from this tab, so that I do not leave Formaquestion Settings to fix an endpoint.
22. As a player, I want a reachability state on the chosen endpoint, so that I know when help cannot reach it.
23. As a power user, I want a separate endpoint for AI Picks, so that a small fast model picks sections and a larger one writes answers.
24. As a player, I want the pick endpoint to default to Same as Answer, so that one choice is enough.
25. As a player, I want the "no AI" state of the Ask tab to follow the help endpoint, so that the message is true for the model that answers.

### Prompts

26. As a player, I want a Default help preset that I cannot edit, so that I get each improved prompt with each release.
27. As a power user, I want to duplicate the Default preset and edit my copy, so that I can change how answers read.
28. As a power user, I want to edit the answer prompt, the pick prompt and the lookup prompt, so that every request is mine to change.
29. As a power user, I want the parts that the app reads back to be chips, so that I cannot remove them by accident.
30. As a power user, I want Compare to Default on each custom prompt, so that I see what a new release changed.
31. As a power user, I want to reset a custom prompt to the default text, so that I can start again.
32. As a power user, I want sampler fields and Max Output for the answer prompt, so that a chat use is not flat or cut short.
33. As a power user, I want to rename and delete my presets, so that the list stays clean.
34. As a power user, I want to export a preset to a file and import one, so that I can move a setup between devices or give it to a friend.
35. As a power user, I want the file to carry my Formaquestion Tools and their switches, so that one file makes a full custom assistant.
36. As a player, I want my help preset to stay when I change the gameplay prompt preset, so that the two do not affect each other.

### Tools

37. As a player with a local model, I want a switch for the guide lookup function, so that the model reads more sections when it needs them.
38. As a player, I want the Tools tab to say when my endpoint does not take function calls, so that I know why a switch has no effect.
39. As a power user, I want to see the guide lookup's description and parameters, so that I know what the model can call.
40. As a power user, I want to add my own Formaquestion Tools with the Tool editor I know, so that I can extend what the assistant does.
41. As a power user, I want a dice roll in the list, off by default and worded for a chat, so that the assistant can roll without a Tool I write.
42. As a power user, I want a Tool to read the world I have open, so that the assistant can answer about my world.
43. As a power user, I want Try It on a Formaquestion Tool, so that I can test a handler before I send a question.
44. As a power user, I want to import and export Tool packs here, so that a gameplay Tool can move to Formaquestion and back.
45. As a player, I want my Formaquestion Tools kept apart from my gameplay Tools, so that a help Tool never goes to a game prompt.

### AI Context

46. As a power user, I want an AI Context button in the header, so that I can see what the app sent for each question.
47. As a power user, I want each request shown as the game view shows it, so that I read one familiar layout.
48. As a power user, I want the pick request, the answer request and each tool round listed for each question, so that I can find which step went wrong.
49. As a power user, I want a Search block for each question, so that I can see why a section won or lost.
50. As a power user, I want the endpoint, the samplers and the reasoning state on each request, so that I can confirm my settings applied.
51. As the developer, I want a bug report to include what AI Context shows, so that I can reproduce a wrong answer.

### Answers

52. As a player, I want to collapse the Sources list of an answer, so that a long conversation is shorter.
53. As a player, I want a click to change that answer only, so that the conversation does not jump.
54. As a player, I want later answers to start in the state I last chose, so that I set it once.
55. As a player, I want that choice to persist through a reload, so that I do not set it again.
56. As a player, I want the collapsed header to show the count, so that I know sources exist.
57. As a player, I want a Thinking block on an answer when reasoning is on, so that I can read how the model reasoned.
58. As a player, I want the Thinking block to follow the same collapse rule with its own default, so that Sources and Thinking are independent.

### Plain chat

59. As a power user, I want a question with every source off and the open screen off to go to the model as the bare question, so that the model sees no empty guide block.
60. As a power user, I want no "not from the guide" notice when no section was sent, so that a chat answer is not marked as a fault.
61. As a player with the defaults, I want the notice to stay when the guide does not cover my question, so that I still know when an answer is general knowledge.

## Implementation Decisions

### Help settings module

- One new pure module holds the Formaquestion settings: the device settings, the help preset store and the Formaquestion Tool list. It has no React.
- The device settings are: answer endpoint id, pick endpoint id, reasoning effort and budget, the four source switches, Use the Open Screen, History Length, the function and Tool switches, the AI Context switch, the reveal values, the Sources default and the Thinking default.
- The device settings are one stored value with one codec that falls back field by field: a bad field reads as its default, and the other fields keep their stored values. A small hook of its own stores it. It writes only on a change and survives blocked storage, because the window opens with storage blocked in tests and writes nothing until the player changes something. Every later ticket adds its fields to this value and codec, the Sources and Thinking defaults included (Q53).
- History Length takes 0 to 20 exchanges. A stored value outside that range reads as the default (Q53).
- Defaults live with the other settings defaults. Each default equals the constant it replaces. The constants in the help session become the defaults of this module.
- None of these settings has an environment twin.
- None of these settings is exported, synced or shared, except through the preset file (Q39).

### Help presets

- The preset store follows the gameplay prompt preset store: built-in presets are read-only and read their text from code, and user presets hold edited text. There is one built-in preset, Default.
- A preset holds three texts (answer, pick, lookup) and the answer options: temperature, repetition penalty and Max Output (Q58). A prompt counts as edited when its text differs from the default text.
- The answer prompt and the lookup prompt name the general-knowledge marker and the lookup function through chips. The pick prompt's reply-format rules are a chip. The chip vocabulary is a new, small vocabulary for the prompt editor.
- The user message of each request stays built by the app. It is not editable.
- Compare to Default reuses the prompt diff viewer.
- The preset file is a new export shape. It carries a version field, the preset name, the three texts, the answer options, the Formaquestion user Tools and the Tool switches. It carries no endpoint, no token and no other device setting.
- Import adds the Tools to the Formaquestion list under the existing Tool import plan (a Tool whose name the list holds is skipped and named, Q60), and applies the switches of the Tools it added and of the fixed functions.

### Help session

- The help session takes its settings as one value in the question. It reads no setting from a constant and no setting from a context. The window passes the stored settings; tests and probes pass their own.
- The answer request and the pick request resolve their endpoints from the help settings: a preset id, Follow Active, or Same as Answer for picks. The resolver is the pure endpoint resolver that per-prompt routing uses.
- The rule that forces reasoning off for every editor request kind no longer covers the answer request. The answer request reads the help reasoning setting. The pick request stays at off.
- The answer request reads its samplers and its Max Output from the active help preset (Q58).
- When the settings leave no way for a section to reach the model, the user message is the question alone, and the answer is not flagged (Q41, scoped by Q51). A search that runs and misses keeps the empty guide block and the flag.
- Use the Open Screen off removes the screen section and the screen line. The Surface is still read for AI Context.
- The answer request offers the functions that are on: the guide lookup, the help dice roll and Formaquestion user Tools.
- The help dice roll is a fixed function of Formaquestion. It reuses the catalog roll's handler and parameters, and it has its own description with no narration words. The gameplay catalog roll is unchanged. The capability check of the answer endpoint decides whether any function is sent. With no function sent, the request is a plain retrieval request.
- The Output → Tools switch is not read.
- Tool handlers run on a Tool Snapshot of the open world when a world is open, else on an empty snapshot. The window supplies the snapshot.
- The session reports a trace for AI Context: the search result of each source, the merged order, the sections sent, each request body with its endpoint details, each tool round, the reasoning text and the response. The trace is an added event; the answer events are unchanged.
- The reasoning text reaches the window as part of the answer events, for the Thinking block.

### Shared components taken out of the Settings modal

Each of these is inline or private in the Settings modal today. Each becomes a shared component that both modals use, with no behavior change in the Settings modal.

- The text-endpoint editor: preset select, fields, add, rename, delete, reset.
- The endpoint select with Follow Active, and the reachability badge.
- The per-prompt reasoning field, the sampler fields and the Max Output field.
- The Tools list and read view. The Tools tab component takes its Tool lists, its switches and its handlers as props already; the Formaquestion tab passes its own. The "Offered To" field does not show for Formaquestion Tools, because one request takes them.
- The AI Context request card and its record type, taken out of the game view. The game view and Formaquestion both draw it.

### Formaquestion Settings modal

- A regular dialog with the Settings modal's size classes and four tabs. It reports its Surface and its tabs to the surface registry, and it has a dev-route entry.
- The help window stays above it through the existing shielded layer. The modal needs no layering work.
- The guide lookup row is first on the Tools tab, then the help dice roll. Each is read-only apart from its switch and its call limit.
- The Semantic Search switch starts the model download. The row shows progress, ready and failed. A failed download leaves the source off.
- The Answer Reveal row uses the reveal dialog with a settings source for help's values.

### Reveal

- The help answer reads help's reveal values, not narration's.
- The reveal timing store is one module-level value, written by the game view's sentence pacer. Help has no pacer, so its timing is computed, not stored: the default pace, floored by help's own minimum duration and stagger. The help answer passes it to the markdown renderer as a prop. Help never reads or writes the game's store, and a test guards that (Q57).

### AI Context popup

- A regular dialog with the game view's AI Context layout. It lists the questions of the conversation, newest first. Each question holds its Search block and its request cards.
- The window keeps the traces in memory with the conversation. Clear removes them. They do not persist.
- Traces are recorded always. The switch only shows the button.

### Answer blocks

- The Sources list and the Thinking block are collapsible. Each answer stores its own open state for each block.
- A click sets that answer's state and writes the device default for that block.
- An answer takes the Sources default when its sources arrive, and the Thinking default when its first reasoning text arrives.
- Nearest Sections uses the Sources default.

### Docs and records

- The Formaquestion docs page gains a section for each tab, and how-to sections for the common tasks. The surface map gains the new Surface ids.
- The glossary entry for Formaquestion changes: it can read the open world through a Tool the player turns on. The entry for Tool changes: Formaquestion Tools are a separate list, switched on the device. The entry for Search Source changes: the switches are player settings.
- A new ADR records that Formaquestion Tools are switched per device and are not preset-scoped, as an exception to the Tools ADR. The capability gate of that ADR stays.

### Shape and settings

- No change to the world or save export shape.
- One new export shape: the help preset file, version 1.
- The Tool pack file shape is unchanged.

## Testing Decisions

A good test here calls a module through its public operations and asserts on what a player observes: the request that leaves the app, the events that come back, the stored value after a reload. It does not assert on internal data layout.

Three seams, all existing or one level above existing code:

- **Help session (existing seam).** Drive it with the fake fetch option and a settings value. Cover: each endpoint choice for answers and picks; reasoning on the answer request and off on the pick request; each source switch; every source off with the open screen off sends the bare question and no flag; a section sent keeps the flag rules; samplers, Max Output and History Length in the request body; a custom prompt in the request; functions sent only when the endpoint takes them; a user Tool round against a snapshot; the trace events. Prior art: the help session tests and the tool loop tests.
- **Help settings module (new seam).** Pure tests: defaults equal the old constants; a bad stored value falls back; duplicate, edit, rename, delete and reset of a preset; the Default preset refuses edits; the preset file round trip; import of a file with a Tool name conflict; a file with an unknown version is refused. Prior art: the prompt preset store tests and the Tool pack tests.
- **Window and modal (component seam).** Thin tests: the gear opens the modal; each tab renders its controls from the settings; the Sources and Thinking rules (a click changes one answer, later answers take the default, the default survives a remount); the AI Context button follows its switch. Tests that mount Formaquestion keep the one mocked seam to the settings providers.

Other checks:

- The Settings modal's existing tests stay green after each extraction. An extraction ticket changes no behavior.
- The source scan of the surface registry covers the new dialog and tabs.
- Playwright covers what jsdom cannot: the help window above the settings modal and above AI Context, a select inside the modal while the window is open, and the mobile sheet.
- Each guard is proven: reinstate the old behavior and confirm the test fails.
- Unmount during a stream leaves no timer or fetch behind; the suite's exit code is the check.
- The help dice roll's description is new prompt text, so it ships with probe numbers: how often the model calls it when the player asks for a roll, and how often it calls it on a plain help question. The default cloud endpoint rejects functions, so this probe runs on the local arm.
- No other prompt text changes in this effort. The probe harness passes the default settings and must report the same numbers as the ticket 46 run, within the batch drift.

## Out of Scope

- A conversation that persists through a reload.
- Community sharing of help presets.
- An editable user message template.
- A second built-in help preset.
- New functions beyond the guide lookup and the help dice roll, such as Take Me There.
- Help-worded lookups for the open world (list and get functions for entities, locations and dictionary entries). A power user can write these as Formaquestion Tools.
- A change to any default. The bar of the Formaquestion effort stays tied to the defaults.
- Editable window copy ("Ask a Question", the empty-state line).
- A way to send a question while a game turn runs.
- Variant D, the frameless chat overlay.

## Further Notes

- The default cloud endpoint rejects every request that carries a function. On it, the Tools tab has no effect, and the tab says so.
- The pick request has a 150-token reply cap. A custom pick prompt that asks for a different reply shape breaks the pick; the app then falls back to the other sources, as it does for a failed pick today.
- A custom answer prompt that drops the marker chip removes the general-knowledge notice for covered questions too. That is the power user's choice.
- With Tools on and a world open, a help request can carry world text to the help endpoint. The Tools tab states this next to the first Tool the player turns on.
- Two ADR files carry the number 0008 today. The new ADR takes the next free number.
- New docs text moves the keyword ranking. The bundled-docs ranking test that expects the Settings Output section for a question about what that section holds sits one rank from its edge, and ticket 18's first draft of an AI Context section, with the words "settings", "output" and "holds", pushed it out of the top five. A fall of that test is a real search regression for players, not a wording problem: report it with the ranks, and do not reword a correct section only to keep the test green.
- Ticket 18 moved the game view's AI Context export into a shared export button and a pure export helper. The game's export file is unchanged; Formaquestion's writes one entry per question, with the question and its trace.
