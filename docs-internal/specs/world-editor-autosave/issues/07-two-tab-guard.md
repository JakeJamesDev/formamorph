# 07: Two-Tab Guard

Status: ready-for-agent
Blocked by: 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: cross-tab signaling has no prior art in the repo, and a wrong pause either loses work or overwrites it.

Parent: [World Editor Auto Save spec](../spec.md)

## What to build

Auto save makes a stale tab overwrite newer work without a click. A tab now notices when its open world is saved in another tab.

- Each successful save of a world announces itself to other tabs on the same origin.
- A tab with that world open in the editor pauses auto save and shows a notice with **Reload** and **Keep Mine**.
  - **Reload** loads the other tab's save into this editor.
  - **Keep Mine** resumes auto save; the next save overwrites the other tab's copy.
- A manual save in the paused tab counts as Keep Mine.
- The notice follows the design system; a new visual pattern needs the user's approval.

Rulings: Q15, Q18.

## Acceptance criteria

- [ ] Saving a world in one tab pauses auto save in another tab with that world open, and shows the notice.
- [ ] Reload loads the other tab's save; Keep Mine resumes and the next save wins.
- [ ] Tabs with different worlds open are not affected.
- [ ] A Playwright test drives two pages on one profile.
- [ ] The pause is proven to bite by reinstating the bug.
- [ ] Changelog fragment written.
