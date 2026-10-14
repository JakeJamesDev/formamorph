# 10: Prompt UI

Status: ready-for-agent
Blocked by: 14
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: builds the pattern ticket 14's prototype got approved, a choice-row reuse, and a new history card.

## What to build

The pending-prompt store gets its UI, built to the pattern the user approved on ticket 14's prototype (see the spec's Prototype heading). `confirm` and an `ask` with up to four options show as a choice row under the narration (Q17). `askText` and a longer `ask` open one small dialog with the question as its title, as approved. `player.tell` renders a message card in the turn column, saved with history, never in a request (Q16, Q23). `player.toast` shows a toast. A prompt during a turn holds the turn until answered.

Spec: Q16, Q17, Q23, stories 14, 15.

## Acceptance criteria

- [ ] A confirm shows two choice buttons under the narration and the script reads the pick
- [ ] An ask with five options opens the dialog with a dropdown; askText opens it with a text field
- [ ] A tell card pages with its turn, survives save and load, and a test proves it is absent from the next request
- [ ] Escape on the dialog cancels the script as ticket 09 specifies
- [ ] Dev routes exist for the dialog and the card; both themes checked
- [ ] Four gates green

## Blocked by

- 14 — Prompt UI Prototype

## Comments

Handoff from ticket 09 (landed as b26c63efb): the pending-prompt store is `scriptPrompts` in `src/lib/scriptPrompts.ts` with `pending()`, `subscribe(listener)`, `answer(id, value)` and `cancel(id)`. Requests carry labels only; an `ask` answers with an option index, or a list of indexes with `multiple`; `tell` and `toast` answer with `undefined`. Until a listener subscribes, asks cancel at once (Q45). Prompts arrive one at a time (Q45).
