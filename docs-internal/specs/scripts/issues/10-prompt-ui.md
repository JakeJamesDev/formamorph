# 10: Prompt UI

Status: done
Blocked by: 14
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: builds the pattern ticket 14's prototype got approved, a choice-row reuse, and a new history card.

## What to build

The pending-prompt store gets its UI, built to the pattern the user picked on ticket 14's prototype, B3, the **inline prompt line** (see the spec's Prototype heading and Q17). Every prompt kind is a left-ruled italic line in the turn column under the narration, the control under the question, text-link actions. `confirm` and a short `ask` are pill buttons that answer on one press; a five-plus `ask` is an inline dropdown; a multiple `ask` is toggle pills plus OK; `askText` is a text field plus OK with Enter. Cancel is a text link; Escape cancels while focus is inside the prompt (Q15); a global Escape is this ticket's call. `player.tell` is the same line with text alone, saved with history, never in a request (Q16, Q23). `player.toast` is the app toast. A prompt during a turn holds the turn until answered. The same line mounts in the editor's Test Code and Test Bench (Q49). This ticket writes the Design System entry for the inline prompt line.

Spec: Q15, Q16, Q17, Q23, Q49, the Prototype heading, stories 14, 15.

## Acceptance criteria

- [ ] A confirm shows two pill buttons under the narration and the script reads the pick
- [ ] An ask with five options shows the inline dropdown; a multiple ask shows toggle pills plus OK; askText shows the text field and Enter submits
- [ ] A tell line pages with its turn, survives save and load, and a test proves it is absent from the next request
- [ ] Cancel, and Escape with focus inside the prompt, cancel the script as ticket 09 specifies
- [ ] The editor's Test Code and Test Bench answer askText, a long ask and a multiple ask through the same line
- [ ] The Design System has the inline prompt line with a dev-router showcase; dev routes exist for each kind; both themes checked
- [ ] Four gates green

## Blocked by

- 14 — Prompt UI Prototype

## Comments

Handoff from ticket 09 (landed as b26c63efb): the pending-prompt store is `scriptPrompts` in `src/lib/scriptPrompts.ts` with `pending()`, `subscribe(listener)`, `answer(id, value)` and `cancel(id)`. Requests carry labels only; an `ask` answers with an option index, or a list of indexes with `multiple`; `tell` and `toast` answer with `undefined`. Until a listener subscribes, asks cancel at once (Q45). Prompts arrive one at a time (Q45).

From ticket 11 (Q49): Test Code and the Test Bench run prompts on a per-run prompt store the editor subscribes to. `askText` and a longer `ask` cancel there until this ticket mounts its dialog in the editor as well as in play.

From ticket 11: each editor run's prompt host is `editorPromptRun()` in `src/lib/editorScriptPrompts.ts`, with the lifecycle hook `useEditorPromptRun()` in `src/lib/useEditorPromptRun.ts`. The host sends only `fitsChoiceRow` requests to the store (a confirm, or a single ask of four options or fewer) and rejects askText, an ask of five or more and any multiple ask as `PromptCanceled`. To add the dialog: route those kinds to the store too, and mount the dialog beside `ScriptPromptChoices` in `ScriptBox.tsx` and `IssuesInstrument.tsx` (StatCodeCheck). `ChoicePress` takes the row index as a second argument.
