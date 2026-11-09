# 01: Prompt Status Rows

Status: ready-for-agent
Blocked by: none
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: a contained UI swap in one manager, with the tab state, Find and history reveal already in place.

## What to build

The Custom Prompts tab swaps its Narration/Choices/Stats sub-tabs for a list of status rows (Q9). Each row holds the prompt's "Use This Prompt" checkbox, the prompt name, and a Custom or Default label. Clicking a row selects that prompt and shows its field and footer below the list. The checkbox toggles the prompt without changing the selection. The selected kind stays the editor's `OverviewPlace.kind`, so the remembered place, Find and undo reveal keep working.

Spec: Q6, Q7, Q9. Mock: `.scratch/overview-right-tabs/status-rows-mock.html`.

## Acceptance criteria

- [ ] Custom Prompts shows three rows with a checkbox, the name, and Custom/Default; no sub-tab strip
- [ ] Clicking a row opens that prompt; clicking its checkbox toggles it and keeps the selection
- [ ] Off keeps the text and shows Default
- [ ] Find and undo still open the right prompt
- [ ] Keyboard: rows reachable and selectable; checkbox has an accessible name per prompt
- [ ] Docs and Design System updated; changelog fragment written
- [ ] Gates green; frames in both themes
