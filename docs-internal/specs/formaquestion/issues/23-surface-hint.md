# 23: Surface hint in the request

Status: ready-for-agent
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
