# 06: World Editor Mobile Header And Sections Bar

Status: ready-for-agent
Blocked by: 05
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Recommended model rationale: touches the mobile header, a shared bar used by two hosts, and deletes a help-topic store with its doc references; broad but mechanical.

## What to build

The World Editor's mobile header reads: back, Find, the Test Bench, the Mode Select (Q27). The `?` is gone on mobile too, and the World Editor's entries in the help-topic store are deleted, along with docs and help copy that point at the `?` (Q9).

The Sections bar draws the rail's grouping: a plain line between groups and no captions (Q19), so its order and splits match the rail's. Mobile keeps its footer with Export World, Optimize Images in Advanced, and Save (Q25).

The Design System's Sections Bar pattern and showcase show lines instead of captions. Changelog fragment: its own lead on the mobile editor header and Sections bar (Q37).

From the prototype branch `prototype/world-editor-tabs` (final commit `dbe3c035`, Community header `54a3e233`); launch entry `proto-world-editor-tabs`, port 5245. Mobile settled in commits `40d2329c` and `685642a7`.

## Acceptance criteria

- [ ] Mobile header holds back, Find, Test Bench and the Mode Select, with no `?`, and fits at 360px without overflow.
- [ ] The Sections bar's tab order and line positions match the desktop rail's, with no captions.
- [ ] No World Editor help topic remains in the store, and no doc or help copy mentions the editor's `?`.
- [ ] The mobile footer still holds Export World and Save, and Optimize Images in Advanced.
- [ ] Guard bites: drawing a caption in the Sections bar turns the grouping test red.
- [ ] Design System Sections Bar entry updated; changelog fragment written.
- [ ] Gates green.

## Blocked by

- 05
