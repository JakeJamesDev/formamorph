# 05: World Editor App Bar

Status: ready-for-human
Blocked by: 01, 02, 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Recommended model rationale: moves the desktop header to an editor-wide bar, adds a stored-world fact to the store, and moves world actions out of the footer; touches tour anchors and Take Me There targets.

## What to build

On desktop an editor-wide **app bar** spans both panes above the panel group, with the tour bar under it (Q18, Q22). Left to right: the back button, **World Editor**, and the save state; Find and the Test Bench centered on the window; the Mode Select (ticket 01) with "Just the essentials" and "Every tool and field"; in Simple an Export World icon, in Advanced a world-actions menu with Export World and Optimize Images (with its progress label); then Save. The world's name is not shown. The bar's side columns share the leftover width equally so the center group sits on the window's center line.

The save state reads "Saved" or "Unsaved changes", and shows nothing for a world that has never been stored (Q23). The saved baseline is not the signal: a new world gets one before its first save. The store exposes whether the world is stored, and the bar reads that.

The desktop `?` is gone (Q5). The list card's former header row is gone on desktop, and its footer keeps only the tab's own actions on Entities and Dictionary, drawing nothing elsewhere (Q25). Tour anchors (`save`, `test-bench`, `editor-mode`), the editor-mode tutorial and the Take Me There targets for Find and the mode control move with their controls.

The Design System guide gains "Pattern: Surface App Bar" with a showcase entry. The World Editor guide drops the footer Save and Export and names the bar. Changelog fragment: the lead **The World Editor and Community Creations move their sections to a collapsible side rail.** and a sentence on the editor's app bar.

From the prototype branch `prototype/world-editor-tabs` (final commit `dbe3c035`, Community header `54a3e233`); launch entry `proto-world-editor-tabs`, port 5245. Bar settled in commits `a90901fb` and `d48f4161`.

## Acceptance criteria

- [ ] Desktop app bar holds back, title, save state, Find, Test Bench, Mode Select, Export or the menu, and Save, in that order, with no `?`.
- [ ] Find and Test Bench sit on the window's center line.
- [ ] Simple shows the Export icon; Advanced shows the menu with Export World and Optimize Images, and both export paths download the world.
- [ ] A brand-new world shows no save state; after Save it shows "Saved"; after an edit "Unsaved changes".
- [ ] The footer is absent on Overview and holds only the tab's actions on Entities and Dictionary.
- [ ] The Authoring Tour steps that point at Save, the Bench and the mode still land; the editor-mode tutorial anchors on the select; Take Me There to Find and to the mode lands.
- [ ] Guard bites: showing "Saved" on a never-stored world turns the save-state test red.
- [ ] Design System and World Editor guides updated; changelog fragment written.
- [ ] Gates green.

## Blocked by

- 01, 02, 04
