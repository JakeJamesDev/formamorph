# Spec: Formaquestion Intents

Status: ready-for-agent
Spec session: formaquestion-intents — spec

## Problem Statement

Every Formaquestion question gets the same large request: the guide sections, the world block, the code rider when a keyword or an open Code tab says so, and every fixed function and Formaquestion Tool. Small talk waits for a docs search it does not need. A "what's a stat?" asked on a Code tab carries the script baggage. A question about the world's lore carries guide sections it does not use.

Formaquestion also cannot help an author build. It reads the open world (ADR-0014), but an author who asks "make me a gate guard for this town" gets a description to copy by hand. Code answers already show the better pattern: the reply streams in the Mascot's voice, and the fenced code block in it has an **Insert** button that writes into the World Editor.

## Solution

An **Intent Classifier** reads each question first and gives it one **Intent**. Each Intent sends its own request, which carries only the context that Intent needs:

- **Chat**: small talk, not about Formamorph. The Mascot replies in her voice, with no docs and no world.
- **Help**: a Formamorph question with no code. The docs and the world, with no script baggage.
- **Code**: script and stat-code questions. Today's full request.
- **World**: a question about the open world or its lore. The world block, with no docs.
- **Create**: a request to make an entity. In the World Editor, the reply streams in her voice and holds one or more fenced entity blocks. Each block renders as a card with **Copy** and **Add**. Add puts the entity in the open world and selects it.

When the label is unclear or fails to parse, the question gets today's full request. The Intent Classifier and creation each have a setting. Both default to on only once their probe bars pass.

## Rulings

Settled with the user on 2026-10-30 and 2026-10-31 in the grill. Q40–Q67 came from an intent review of Q1–Q39. The grill said "router" and "route"; the glossary words are **Intent Classifier** and **Intent** (Q69).

| # | Ruling |
|---|---|
| Q19 | Intents: Chat, Help, Code, Create, and World (Q44). The fallback is today's full request |
| Q20 | An unclear label or a parse failure gets the full request |
| Q21 | A question with two asks takes one Intent: the ask mentioned first wins. A rider tells the Mascot the player asked for two things and she can handle one at a time for now |
| Q22 | The Intent Classifier reads the question plus the last exchange |
| Q23 | The Intent Classifier runs alongside the two pick requests |
| Q24 | The Code Intent replaces the `isCodeTurn` keyword check. The keywords stay on the fallback only |
| Q25 | The Intent Classifier is its own prompt kind, with its own sampler pins and endpoint. Its endpoint defaults to the pick endpoint |
| Q26 | Chat sends the answer prompt, the Mascot Voice, the history and the face call only |
| Q27 | Help is the full request without the code rider, the script home line, the code test and the Quick Reference pin. Code and the fallback stay as the full request |
| Q29 | Intent bar: at least 90% correct Intents, at most 2% Formamorph questions given Chat, no drop on the help baselines (Q60) |
| Q32 | The Intent Classifier is a setting. Off sends the full request every time |
| Q33 | The chosen Intent shows in the AI context viewer only |
| Q2, Q41, Q45 | Add works in a World Editor only, the in-game World Editor included |
| Q30, Q46 | Create on any other screen gets a refusal in her voice, on the Chat request with a refusal rider |
| Q5 | An entity block holds a name and an AI description only. Every other field keeps the blank-entity default |
| Q55 | The player description stays blank for now |
| Q56 | A new entity lands at the root, as the editor's own Add does |
| Q28 | The Create request carries the world's name and description, the existing entity names, and two sample entities |
| Q35 | Create streams her reply with fenced entity blocks on every endpoint, with no Tools and no schema. The probe keeps a strict-schema draft request as a control arm only |
| Q36 | A card has **Copy** and **Add**. There is no Discard: a card you ignore is a discard |
| Q10 | A card is read-only. You edit the entity in the World Editor after Add |
| Q11, Q53 | Add opens the Entities panel when it is not showing, then selects the new entity |
| Q7 | After Add, her next request carries a one-line note of the entity added |
| Q37 | A name that matches an existing entity keeps Add enabled, with a warning tip |
| Q38 | The block uses labeled lines, Name and AI Description |
| Q39, Q42 | Every entity block in a reply gets its own card. "A guard and a merchant" is one Create ask |
| Q34 | A follow-up such as "make him older" writes a new block in a new reply. The old card stays in the history |
| Q50, Q51, Q64 | Cards render on any reply, with or without the Intent Classifier. The full request carries the entity rider in a World Editor while creation is on |
| Q52 | Add writes to whatever world is open, even if the card came from another world |
| Q8 | Create bar: at least 90% of create asks given Create, at most 5% of other questions given Create, at least 90% of blocks valid (Q61) |
| Q15 | A path that fails its bar stays off |
| Q16 | Creation is a setting |
| Q43 | The Intent Classifier and creation settings default to on only after their bars pass. Until then they default to off |
| Q44, Q48 | World sends the answer prompt, the Mascot Voice, the history, the world block and, in game, the story so far. No guide and no docs lookup |
| Q49 | With no world open, World stays a label. Her reply says no world is open |
| Q47 | An open Code or Scripts tab no longer forces Code. The Intent Classifier sees the Surface and decides |
| Q54, Q65 | Each Formaquestion Tool has a multiselect of the Intents it goes to. Fixed functions follow the Intent design |
| Q66, Q67 | A Tool's Intents default to Help, Code and World. Tools saved before this change load with that default |
| Q57 | Create is its own prompt kind with its own sampler pins. Its endpoint defaults to the Answer Endpoint |
| Q58 | The Intent Classifier and Create prompts are editable in the help preset, like the answer prompt |
| Q59 | One more request per question is accepted, hosted tier included |
| Q60 | "No drop" means within the in-batch control's own spread, at most 3 points |
| Q61 | A valid block has a non-empty Name and an AI Description of 1–4 sentences, and no other fields |
| Q62 | At least 80% of Create drafts fit the world and its tone, by hand grade |
| Q63 | Intent Classifier latency: at most 1.5 s at the median on the cloud default |
| Q40 | The Formaquestion glossary entry is amended, and an ADR records that Formaquestion may add to the world in a World Editor |
| Q68 | Test seams: `askHelp`, a pure entity-block parser, the World Editor bench, and three probes |
| Q69 | Glossary words: Intent Classifier and Intent. "Route" stays a dev-router word |

**Superseded in the grill:** Q1, Q3, Q4, Q6, Q9, Q12, Q13, Q14, Q17, Q18, Q31 (Tool call, schema ladder, Discard, one draft per reply, reply field). The rows above hold the rulings that replaced them.

## User Stories

### Intents

1. As a player, I want small talk with the Mascot to come back fast, so that chatting with her doesn't wait on a docs search.
2. As a player, I want a plain Formamorph question to skip the script baggage, so that the answer focuses on what I asked.
3. As a player, I want a script question to keep the code rider and the code test, so that code answers stay as good as they are today.
4. As a player, I want a question about my world's lore to read my world without guide sections, so that the answer is about my world.
5. As a player, I want "what's a stat?" asked on a Code tab to get a Help answer, so that the screen I am on doesn't decide what I meant.
6. As a player, I want a short follow-up such as "yes, do it" to keep the Intent of the last exchange, so that the conversation flows.
7. As a player, I want the Mascot to tell me when I asked for two things, so that I know to ask the second one next.
8. As a player, I want the first thing I asked for to be the one she handles, so that the order I wrote in is respected.
9. As a player, I want an unclear question to get today's full answer, so that the Intent Classifier never makes an answer worse than today.
10. As a player, I want a world question asked with no world open to get a clear reply that no world is open, so that I know why she can't answer.
11. As a player, I want to turn the Intent Classifier off, so that I can get today's behavior when I compare or debug answers.
12. As a player, I want to see the chosen Intent in the AI context viewer, so that I can check why an answer looked the way it did.
13. As a player, I want to point the Intent Classifier at a small, fast endpoint, so that it adds little wait.
14. As a player, I want the extra request to run alongside the picks, so that a Help, Code or World answer doesn't wait longer than today.
15. As a player, I want to edit the Intent Classifier prompt in the help preset, so that I can tune it for my model.

### Creating entities

16. As an author, I want to ask the Mascot for an entity in plain chat, so that I don't need to learn a command.
17. As an author, I want her reply to stream in her voice with the draft in it, so that it feels like her code answers.
18. As an author, I want each draft to show as a card with the name and the AI description, so that I can read it at a glance.
19. As an author, I want to click Add to put the entity in my world, so that I don't copy text field by field.
20. As an author, I want Add to open the Entities panel and select the new entity, so that I see it and can edit it at once.
21. As an author, I want to ignore a card I don't like, so that turning one down takes no click.
22. As an author, I want to say "make him older" and get a new draft, so that I can refine before I add.
23. As an author, I want several drafts from one ask ("a guard and a merchant"), so that I can add a small cast at once.
24. As an author, I want drafts that fit my world's setting and tone, so that they need little rework.
25. As an author, I want drafts that use my world's naming style and avoid names I already use, so that the cast stays consistent.
26. As an author, I want a warning when a draft's name matches an existing entity, so that I don't add a duplicate by accident.
27. As an author, I want Copy on the card, so that I can paste the text somewhere else.
28. As an author, I want Add to go through the editor's undo, so that I can take it back.
29. As an author, I want the Mascot to know what I added, so that she doesn't offer the same entity again.
30. As an author, I want creation to work on every endpoint, so that an endpoint without Tools or schemas can still draft.
31. As an author, I want creation to work in the World Editor opened from a game, so that I can build while I play-test.
32. As a player, I want a create ask on any other screen to get a clear reply in her voice, so that I know to open the World Editor.
33. As an author, I want a card on a screen with no World Editor to show why Add is unavailable, so that a card from the history doesn't fail silently.
34. As an author, I want cards to work with the Intent Classifier off, so that turning it off doesn't cost me creation.
35. As an author, I want to turn creation off, so that the Mascot only answers when I want her to.
36. As an author, I want to edit the Create prompt in the help preset, so that I can tune drafts for my model.

### Formaquestion Tools

37. As a player with Formaquestion Tools, I want to choose which Intents each Tool goes to, so that Chat stays fast and my Tools reach the questions that need them.
38. As a player with existing Tools, I want them to keep reaching Help, Code and World, so that my setup keeps working.
39. As a player, I want the Tool's Intent list to work like the Offered To list of a world Tool, so that I already know how to use it.

## Implementation Decisions

### Intent Classifier (Q19–Q25, Q32, Q33, Q47, Q49, Q59, Q63)

- A new help prompt kind runs the Intent Classifier. It has its own sampler pins (pinned explicitly, per the convention for new AI calls) and its own endpoint setting, defaulting to the pick endpoint through the existing help endpoint routing.
- Input: the question, the last exchange, and the Surface. The labels it may give: Chat, Help, Code, World, Create. All five apply on every screen (Q30, Q49).
- Output: a strict schema with one enum field where the endpoint accepts schemas, else a prompted label that the app checks. Anything that is not exactly one known label falls back to the full request (Q20).
- The output also says whether the question holds a second ask of another Intent. That sets the Q21 rider.
- It runs alongside the guide pick and the world pick. The answer request starts once all three return. Chat drops both picks; Create drops the guide pick; World drops the guide pick.
- The chosen Intent and the classifier request are recorded for the AI context viewer. Nothing shows on the reply.
- Off, or with no Answer Endpoint, every question gets the full request with no classifier request.

### Requests per Intent (Q24, Q26, Q27, Q44, Q46, Q48, Q49)

| Intent | Guide | World block | Story (game) | Code rider + home line + code test + Quick Reference | Docs lookup | Prompt kind |
|---|---|---|---|---|---|---|
| Chat | — | — | — | — | — | help |
| Help | ✔ | ✔ | ✔ | — | ✔ | help |
| Code | ✔ | ✔ | ✔ | ✔ | ✔ | help |
| World | — | ✔ | ✔ | — | — | help |
| Create (World Editor) | — | Create context (Q28) | — | — | — | create |
| Create (elsewhere) | — | — | — | — | — | help, Chat request + refusal rider |
| Fallback | today's full request; code rider from `isCodeTurn` | | | | | help |

- The Help Request Plan (ticket 01) covers the answer request only; whether the picks go out is the classifier's call (ticket 02). It holds each choice after the settings and endpoint gates, so an Intent only narrows it and never re-checks the endpoint. Its riders are today's code rider (home line and code-test line included) and world rules, plus a slot ticket 02 fills (two-ask, no-world).
- Every Intent carries the answer prompt with the Mascot Voice, the history and the face call. Roll rides every Intent but Create while it is on.
- Code no longer comes from `isCodeTurn` except on the fallback (Q24, Q47).
- World with no world open sends no world block and a rider that says so.
- The Q7 note rides the next answer request of any Intent, and the classifier reads it through the last exchange.

### Create request (Q5, Q28, Q35, Q38, Q57, Q64)

- Its own prompt kind, with sampler pins set by the probe. Its endpoint defaults to the Answer Endpoint.
- It carries the Create prompt (editable, Q58), the Mascot Voice, the history, the world's name and description, the names of every entity, and two sample entities with their AI descriptions. The samples are the first two entities, in editor order, that have an AI description.
- The reply streams as a normal answer. The entity rider names the block format:

  ````
  ```entity
  Name: <name>
  AI Description: <text, may run several lines>
  ```
  ````

- With the Intent Classifier off, the full request carries the same entity rider in a World Editor while creation is on (Q64).

### Entity block parser (Q38, Q61)

- One pure function turns a fenced block's text into `{ name, aiDescription }` or a list of problems. It is the only reader of the format: the card and the probe both call it.
- Valid: a non-empty Name, an AI Description of 1–4 sentences, no other labels. Labels match case-insensitively; the AI Description runs to the fence end.
- An invalid block renders as a plain code block with Copy.

### Entity card (Q10, Q11, Q36, Q37, Q39, Q50–Q53)

- The answer's markdown renders `entity` fences through the existing snippet seam, as a card in place of a code block. Every `entity` fence in any reply gets a card (Q51). While the fence streams, the card shows what has arrived.
- The card shows the name and the AI description, read-only, with **Copy** and **Add**.
- Add needs a World Editor that is open now; elsewhere it is disabled, with a tip that names why. It writes to the open world, wherever the card came from (Q52).
- Add builds the entity from the blank-entity default with the block's name and AI description, places it at the root (Q56), and adds it through the editor's normal path, so editor undo records it. It then opens the Entities panel if needed and selects the entity.
- A name that matches an existing entity keeps Add enabled, with a warning tip (Q37).
- The World Editor registers the add action beside its read source in the help world registry. The game registers none, so the game side cannot write.
- After Add, the next help request carries one line that names the entity added (Q7).

### Formaquestion Tools (Q54, Q65–Q67)

- Each Formaquestion Tool gets a multiselect of Intents in the Tool editor, the same control a Tool uses for the prompts it goes to. The prompt list holds prompt kinds, not Intents, so a Formaquestion Tool gains an optional Intent list. An absent list reads as the default: Help, Code and World (Q66, Q67). A gameplay Tool never carries one.
- The fallback request offers every Tool that is on.
- This amends ADR-0010, which says the help request has no "Offered To" to choose.

### Settings and help preset (Q16, Q25, Q32, Q43, Q57, Q58)

- New help settings: the Intent Classifier switch, the creation switch, the Intent Classifier endpoint and the Create endpoint. Both switches default to off until their bars pass; the probe ticket flips each default only on a pass (Q43, Q15).
- With the Intent Classifier off, the creation switch still works (Q50).
- The help preset gains two prompts, the Intent Classifier prompt and the Create prompt. A preset file without them loads with the built-in defaults.

### Docs and glossary (Q40, Q69)

- CONTEXT.md: amend the Formaquestion entry (it may add to the world in a World Editor through a card); add **Intent Classifier** and **Intent**.
- New ADR: Formaquestion may add to the open world in a World Editor, through an action the player clicks. It covers Code Insert and Take Me There too, which already act on the editor.
- Player docs: the help pages on Formaquestion describe creation, the Intent Classifier setting and the Tool's Intent list. Copy follows `docs/Writing-Guide.md`.

## Testing Decisions

- Tests check behavior at a seam, not internals: what goes into each request body, what the parser returns, and what the world holds after Add. A guard must fail when its bug comes back (`test-bar` skill).
- **`askHelp` (existing seam):** with a stubbed classifier reply, each Intent's body holds exactly its row of the table above; an invalid label gives the full request; the two-ask rider; Tools follow their Intent list and the empty-list default; the switch off sends no classifier request; the Q7 note; the refusal rider off-editor; World with no world. Prior art: the `helpSession.*.test.ts` family with `src/test/helpFixtures.ts`.
- **Entity-block parser (new pure seam):** valid and invalid shapes per Q61, multi-line descriptions, case of labels, extra labels. Prior art: `help-baseline-score.test.ts`.
- **World Editor bench:** a card's Add puts the entity in the world at the root, selects it, and undo removes it; disabled off-editor; the duplicate tip. Prior art: `WorldEditor.codeInsert.test.tsx`.
- **Help preset file and Tool pack:** a file without the two prompts or a Tool's Intent list loads with defaults; a file with them round-trips. Prior art: `helpPresetFile.test.ts`.
- **Intent probe (Q29, Q63):** a labeled corpus with per-Intent cases, two-ask messages, follow-ups that only resolve through the last exchange, create asks off-editor, lore questions, and non-English questions. Enough Help, Code and World cases (about 150) to measure the 2% Chat bar. Reports accuracy, misroutes to Chat, and median latency. Cloud default first, with an in-batch control, per the probe skill.
- **Create probe (Q8, Q35, Q61, Q62):** arms are the fenced block in the streamed reply and a strict-schema draft request as the control. Scores: valid blocks per Q61, and a hand grade for fit to the world and its tone. The ≤5% false-Create rate comes from the Intent probe.
- **Help baselines (Q29, Q60):** `help-baseline`, `help-recall` and the world-question probe, run with the Intent Classifier on and off in one batch. A drop beyond the control's spread, or more than 3 points, fails.

## Out of Scope

- Editing or deleting existing entities.
- Creating places, items, traits, stats, dictionary entries or any other part of a world.
- Fields beyond name and AI description, including the player description.
- An editable card, or a Discard action.
- Creation in game, the main menu or the library.
- Running two Intents for one question.
- Showing the Intent on the reply.

## Further Notes

- Export shape: the help preset file gains the Intent Classifier and Create prompts. The help settings value gains two switches and two endpoints. A Formaquestion Tool gains an optional Intent list, which the help settings value, the help preset file's Tool copy and the Tool pack file all carry. That changes the pack shape that ADR-0010 kept fixed. World and save exports don't change.
- The Create bar's first two numbers depend on the Intent Classifier. With it off, creation relies on the entity rider in the full request, which only the help baselines measure.
- The two pick requests still run for Chat and Create (Q59). If spend becomes a problem, a later change can skip them once the label is known.
- The in-game World Editor already saves and autosaves the authored world, so Add there follows the same path as in the standalone editor.
