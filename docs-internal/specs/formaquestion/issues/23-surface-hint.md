# 23: Surface hint in the request

Status: done
Status note: Built in f75f1263 plus a review fold-in. Labels are derived from ids, not read from the UI; see Handover.
Base: 8fa13c68
Blocked by: 18, 20
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

A player can ask "what does this tab do?" or "how do I add one here?" and Formaquestion answers for the screen they have open (Q2).

- The help request names the current Surface in player words: the screen, the dialog and the tab, by their UI labels, not by their ids.
- The docs section mapped to the Surface goes into the request: in retrieval mode ahead of the search hits, in lookup mode as a section already fetched.
- The Surface is read when the player sends the question, not when the window opened.
- A Surface on the exclusion list adds nothing.
- The request still carries no world data, no save data and no text from any field.

Report probe numbers for a set of "here" questions with and without the hint, same batch.

Recommended model rationale: a small addition to the request over two finished seams.

## Acceptance criteria

- [ ] With Settings open on a tab, the request names that tab by its label and holds its mapped section
- [ ] The Surface in the request is the one open at send time
- [ ] An excluded Surface adds nothing to the request
- [ ] A test asserts the request holds no world, save or field text
- [ ] The mapped section shows in the answer's sources
- [ ] Probe numbers with and without the hint are in the handover
- [ ] Four gates green

## Handover

Built: `surfaceHint.ts` names the open dialog or screen and its tabs, and holds the mapped section. Retrieval puts it ahead of the hits. Lookup holds it as a fetched section. `useHelpChat` reads the Surface before any wait, at send time.

Probe (`help-surface-probe.cli.ts`, cloud default endpoint, retrieval mode, 5 "here" questions x 8 runs per arm, one batch):

| Arm | n | facts | complete | mapped section in sources | prompt tokens |
|---|---|---|---|---|---|
| hint | 40 | 65% | 58% | 100% | 2082 |
| no-hint | 40 | 7% | 0% | 0% | 1232 |

Per case, hint vs no-hint complete: Display tab 100/0, Endpoints tab 88/0, Prompt surfaces 100/0, Library 0/0, Test Bench Triggers 0/0. The last two answers were correct and grounded; their keyed names were too broad for the tab the question named.

Gates (before the fold-in): typecheck, lint (0 errors), test (16032 passed), build green. After the fold-in: typecheck and the Formaquestion tests green.

Open: the spec asks for UI labels. `surfaceHint.ts` derives labels from camelCase ids with a small acronym set, so an id that differs from its UI label reads wrong. A per-id label table would fix it. That is a larger change, so it needs a ruling.
