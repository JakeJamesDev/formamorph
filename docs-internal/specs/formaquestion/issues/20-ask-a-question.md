# 20: Ask a question

Status: done
Base: 7faccf49
Blocked by: 16
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

## What to build

A player types a question in Formaquestion and the connected AI answers from the docs. This is the tracer bullet for the AI path: one question, one answer, on every endpoint. It builds test seam 2 of the spec.

**Help session.** A module with no React and no gameplay coupling. In: the question, the AI settings snapshot, the Docs Index and a cancel signal. Out: a stream of answer events, then the sources. It uses the existing AI Request Spec and AI Stream; it adds no second request path.

**Request kind.** A new editor request kind (Q9): fixed prompt, active endpoint, reasoning off, no Settings tab. Pin its temperature and penalties explicitly.

**Retrieval mode.** The session runs the Docs Index search on the question and puts the top sections in the prompt (Q10). This ticket ships retrieval mode for every endpoint; ticket 22 adds the lookup function for capable ones. One request per question, never a retry.

**Help prompt.** Read the prompt writing guide first. Positive contract: answer from the given sections; give numbered steps; use the exact control names from the sections. No example values a small model can copy.

**In the window:**

- Ticket 16 shipped the Search and Guide tabs only. Add **Ask** as the first tab in the narrow layout, and the conversation in the wide layout's pane (Q33).
- An ask field and Send. The answer streams as formatted markdown through the existing streaming renderer, used directly.
- A stop control ends the stream and keeps the text so far.
- Under the answer, the sections that were sent to the model are listed as sources. A click opens one in the reader (Q8).
- With no AI connected, the ask field runs the docs search and shows the sections (Q7).
- When the request fails, the standard error toast with Error Details shows, and the window shows the docs search results for the question.
- The default cloud endpoint is allowed, under the same limits as gameplay (Q12).

Ask before you choose how many sections go into a request if the Docs Index constant does not settle it.

Report probe numbers for the prompt with an in-batch no-docs control. Ticket 26 sets the bar; this ticket states the numbers only.

Recommended model rationale: a new AI call, a new prompt and the seam every later ticket tests through.

## Acceptance criteria

- [x] With a fake fetch, a question produces exactly one request whose prompt holds the retrieved sections, and the session yields the streamed answer and the sources
- [x] The request uses the new editor kind: active endpoint, reasoning off, pinned samplers
- [x] The request carries no world or save data; a test asserts on the request body
- [x] Stop ends the stream, keeps the partial answer and leaves no request open
- [x] No AI connected: the ask field shows docs search results and sends nothing
- [x] A failed request shows the error toast with details, and the window shows search results
- [x] Sources open in the reader
- [x] Unmount during a stream cancels it; the test run exits 0
- [x] Probe numbers with an in-batch control are in the handover, per the `probe` skill
- [x] Changelog: folded into the Formaquestion In Progress entry
- [x] Four gates green

## Comments

**Built.** A player asks a question on the **Ask** tab, and the connected AI answers from the docs.

| File | Role |
|---|---|
| `src/lib/formaquestion/helpSession.ts` | `askHelp`: one question in, answer events and the sources out. `helpSections`: the retrieval. No React |
| `src/lib/formaquestion/helpPrompt.ts` | The fixed help prompt and the one user message |
| `src/types/ai.ts`, `src/lib/reasoningEffort.ts`, `src/lib/promptSamplers.ts` | The `help` editor request kind: active endpoint, reasoning off, temperature 0.2, penalty 1 |
| `src/components/formaquestion/useHelpChat.ts` | The conversation of the one instance: ask, stop, the no-AI check, the failure toast |
| `src/components/formaquestion/useHelpAi.ts` | The AI settings snapshot and the reachability check, for the window |
| `src/components/formaquestion/AskParts.tsx` | Conversation, question bubble, answer, source link, question field |
| `src/components/formaquestion/readerLinks.tsx` | The docs-link renderer, shared by the reader and the answers |
| `src/lib/useAiReachable.ts` | New `enabled` option, so nothing checks the AI before the window opens |
| `testing/baseline/harness/help-probe.cli.ts`, `testing/baseline/help-cases.json` | The help probe and its 18 questions |

**Rulings from the spec session (2026-10-01).** All five as recommended; 1 to 3 are in the spec.

- Sections per request: always the top hit, then more in rank order while the docs text stays under 12,000 characters, at most 5. `HELP_DOCS_CHAR_BUDGET` and `HELP_SECTION_LIMIT`.
- "No AI connected" is the app's reachability check. A cached "blocked" gets one fresh check on Send. "Still checking" sends. The default cloud endpoint counts as connected.
- A new window opens on **Ask**, with or without an AI. On the mobile sheet, focus still goes to the sheet (Q46).
- Until ticket 24, the prompt says to tell the player that the guide does not cover the question.
- The window keeps each question and answer of this app run in a list. A request holds only its own question. Ticket 21 adds history, Clear and the app-root store.

**Picks made here.**

- 🌡️ Pins: temperature 0.2 and repetition penalty 1. A penalty above 1 rewords the control names that a step repeats.
- 🧢 Answer cap: 800 tokens (`HELP_MAX_TOKENS`).
- 🔗 A docs link that the model copies into an answer opens in the reader, through the reader's own link renderer.
- 📜 The conversation stays at its end while an answer comes in, unless the player scrolled up.
- ✍️ The question in progress is part of the window's view state, so it survives a tab change and a close.
- 🔌 The connection toast's link opens the **Connect Your Own AI** page in the reader.
- 🧪 The window tests mock `useHelpAi`, which is the seam between the window and the app's settings providers. `useHelpAi` has its own test.

**Probe numbers.** Cloud default (`default`, Aphrodite, Gemma build), 18 questions, 6 runs per arm, one batch of 216 requests, the app's pins. Arms: the shipped prompt and the no-docs control, which has the same role and answer rules and no guide text.

| Questions | Arm | n | Keyed names | All names | In bold | Numbered steps | Declined | Invented names | Tokens in / out |
|---|---|---|---|---|---|---|---|---|---|
| Covered, right section sent | shipped | 60 | 100% | 100% | 100% | 100% | 0% | 0.00 | 1,527 / 155 |
| | no docs | 60 | 5% | 0% | 3% | 100% | 0% | 0.65 | 113 / 90 |
| Covered, right section NOT sent | shipped | 36 | 11% | 0% | 8% | 58% | 44% | 0.00 | 1,923 / 115 |
| | no docs | 36 | 26% | 17% | 24% | 100% | 0% | 1.47 | 117 / 95 |
| Covered, all | shipped | 96 | 67% | 63% | 66% | 84% | 17% | 0.00 | 1,675 / 140 |
| | no docs | 96 | 13% | 6% | 10% | 100% | 0% | 0.96 | 114 / 92 |
| Not covered | shipped | 12 | – | – | – | 0% | 100% | 0.00 | 1,438 / 13 |
| | no docs | 12 | – | – | – | 100% | 0% | 1.75 | 113 / 93 |

- 📌 **Tokens per question (for ticket 26):** about 1,675 in and 140 out on average. The largest request in the batch was 2,685 tokens in. The endpoint's window is 10,750.
- 🔎 **Retrieval is the weak part.** The right section reached the model for 10 of 16 covered questions: 8 of 8 in the guide's own words, 2 of 8 in a player's words. "Back up everything before I reinstall", "redo the last turn", "put my world on the community page", "make a folder", "let the AI call a tool" and "bring a world file into the game" all missed. With the wrong sections, the model declines 44% of the time and answers a different task the rest of the time. This is the keyword search of ticket 15, not the prompt. Ticket 22 (lookup mode) and ticket 26 (search fixes) own it.
- ✏️ **One prompt change came from the probe.** The first wording said "keep the answer short". It cut the 13-step LM Studio task at step 6. An earlier batch ran both wordings side by side, with the right section sent, n=60 each: all keyed names in 80% of answers for the first wording and in 100% for the shipped one.
- 🚫 The no-docs control invents steps for every question, covered or not. The shipped prompt declined both uncovered questions in 12 of 12 runs, and named no control that is not in the docs.
- ⚠️ The probe adds `reasoning_effort: "none"` to the app's body, as every probe here does. The app sends its off signal only where its capability record allows one. The live check below used the app's own body.

**Guards bite.** 48 mutations, one at a time, each restored and checked. Every one fails a test.

| Area | Mutations |
|---|---|
| Help session | Top hit not kept; no budget; limit 8; reasoning shown while streaming and at the end; empty answer accepted; Stop reported as a normal end; signal not passed; sources not reported; wrong request kind; no answer cap; question or sections left out; extra question-dependent text in the request; no pins |
| Conversation hook | No cancel on unmount; toast after unmount; no fresh check; reachability ignored; "still checking" treated as blocked; no toast; failure leaves the question open; a second question while busy; a question before the docs load; Stop waits for the check; Stop during the check reads as no AI |
| AI settings hook | Default cloud endpoint checked; default cloud endpoint follows the check; check runs with the window closed |
| Window | Empty question sent; Stop does nothing; Shift+Enter sends; question stays after Send; answer links not rewritten; no Sources; no docs search on no-AI or failure; a partial answer still says "did not answer"; the no-match line claims a match; an empty result list shows; wide pane ignores Back to Conversation; wide search field takes the cursor; opens on Search; draft outside the view; no scroll follow; follow ignores the player's scroll; AI check on before the window opens |
| Reachability hook | Check runs while disabled |

The first run found three mutations that failed nothing: a toast after unmount, the busy guard in the hook, and the AI check before the window opens. Each has a test now.

**Coverage** on the new modules, lines and branches: `helpPrompt.ts`, `readerLinks.tsx`, `GuideBody.tsx`, `AskParts.tsx`, `useHelpChat.ts` and `useHelpAi.ts` 100%. `helpSession.ts` 100% of lines and 94% of branches (the finish reason of an empty answer when the server sent none).

**Review fold-in.** The two reviewers found these, each fixed test-first:

| Finding | Fix |
|---|---|
| Stop did nothing while the fresh check of a silent server ran | Stop ends the wait at once |
| The default cloud endpoint got the same check as any endpoint (ruling 2) | It counts as connected and gets no check |
| "These guide sections match your question" showed above "No sections match" | The line says when no section matches, and no list shows |
| A stream that failed after some text said "The AI did not answer" | It says "The answer did not finish" and keeps the text |
| The docs named the field **Question**, which is not on the screen | The field's name and its placeholder are both **Ask a Question** |
| A status line sat inside the conversation log, so it could be read twice | The line is plain text; the log announces it |
| A test compared the sources with the function under test | It checks the count and the request body |

Also from the review: one shared open-reply fixture and one shared idle `useHelpAi` stub for tests; a named status type; `showsReader` in place of a second `reading`; the probe narrows a caught error, has one aggregation, and its control now has the shipped answer rules. A test shows that a `javascript:` link in an answer renders no link.

Left as they are: `help` stays in the editor request kinds (Q9); a connection failure shows the app's standard connection toast, which has no Error Details; "under 12,000 characters" is implemented as "at most 12,000".

**Playwright** (`e2e/formaquestion.spec.ts`, 28 pass on desktop and mobile): three new tests. A question typed above Settings gets one answer and its source opens in the reader. A 40-step answer leaves the conversation at its end with the field in view. A closed endpoint shows the docs search and sends no request with the question. The older tests now open on Ask and go to **Search** where they need it.

**Live check.** On the `dev-demo-ai` preview, "How do I make a backup?" got the five steps and five sources from the Demo AI, above an open event dialog. "How do I earn achievements?" got "The guide does not cover how to earn achievements." Neither question caused a failed request.

**Not covered.**

| Item | State |
|---|---|
| Send while a game turn generates (Q16) | Ticket 21. Today a help question can run beside a turn |
| Follow-ups, Clear, the app-root store, AI Language | Ticket 21 |
| The general-knowledge flag and its marker | Ticket 24 |
| A local model (Cydonia) | Not run. Cloud only, per the test-target policy |
| An endpoint that refuses `repetition_penalty` | UNVERIFIED. The pin is sent to every endpoint, as the planner's pin is |
| A real screen reader on the conversation log | UNVERIFIED. The log has `aria-busy` while an answer comes in |
| An answer cut at the 800-token cap | It ends with no mark. The longest answer in the probe was 426 tokens, and none reached the cap |
| Reasoning off on a model that reasons by default, with every reasoning switch off | The app sends no reasoning field then, for this kind as for every other. Not probed |
