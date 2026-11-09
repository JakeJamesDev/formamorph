# 01: Prompt Status Rows

Status: ready-for-human
Blocked by: none
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: a contained UI swap in one manager, with the tab state, Find and history reveal already in place.

## What to build

The Custom Prompts tab swaps its Narration/Choices/Stats sub-tabs for a list of status rows (Q9). Each row holds the prompt's checkbox, the prompt name, and a Custom or Default label. Clicking a row selects that prompt and shows its field and footer below the list. The checkbox toggles the prompt without changing the selection. The selected kind stays the editor's `OverviewPlace.kind`, so the remembered place, Find and undo reveal keep working.

Spec: Q6, Q7, Q9. Mock: `.scratch/overview-right-tabs/status-rows-mock.html`.

## Acceptance criteria

- [x] Custom Prompts shows three rows with a checkbox, the name, and Custom/Default; no sub-tab strip (manager and editor-bench tests)
- [x] Clicking a row opens that prompt; clicking its checkbox toggles it and keeps the selection (test; mutation "checkbox also selects" went red)
- [x] Off keeps the text and shows Default (test; mutation "kept text shows Custom" went red)
- [x] Find and undo still open the right prompt (existing editor-bench Find and history tests, moved to the rows)
- [x] Keyboard: rows reachable and selectable; checkbox has an accessible name per prompt ("Use Narration Prompt")
- [ ] Docs and Design System updated; changelog fragment written (docs done; no fragment, see Landed)
- [x] Gates green; frames in both themes

## Landed

The selected prompt shows a "<Kind> Prompt" caption under the list, as in the mock. Undo of a checkbox on an unselected row returns to the prompt that was open, since the Origin records the place the author saw; the toggled row's highlight still lands in the list.

**Not verified**
- The Playwright helper in `e2e/app.ts` (new checkbox name) was not run.
- A click on the checkbox gutter padding does nothing; the mock selected the row there.

**For you**
- Frames: `.scratch/overview-right-tabs-01/frames/status-rows-dark.jpg` and `status-rows-light.jpg`.
- The unreleased changelog line "Each prompt and the openings have a checkbox at the top" is stale. A fragment can only add an entry, so it is fixed on main after this lands.
