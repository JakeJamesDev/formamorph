# 06: Library Editor Docs

Status: ready-for-human
Status note: Docs in WorldEditor.md "In the library" sections and the book panel table. The chip label fix keeps its own Fixed entry rather than folding into the library editor entry; confirm which the spec meant.
Base: 08a71c91
Blocked by: 03, 04, 05
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: medium

**Parent:** [Library Editor Layout](../spec.md)

**What to build:** The docs and the changelog describe the new layout of both library editors and the World Editor's book panel tabs.

**Rationale for the model:** human-facing docs in the project's voice. The project rule is a strong model for docs, never a smaller one. Medium effort is enough.

## Acceptance criteria

- [ ] Every docs page that names the library entity editor's tabs describes Entity and Placeholders, with Tags beside the fields.
- [ ] Every docs page that names the library dictionary editor describes Overview with the book's fields, and an entries-only list with a + button. No page tells the reader to select the dictionary in the tree of the library editor.
- [ ] The World Editor dictionary docs describe the book panel's Details and Placeholders tabs.
- [ ] The changelog's In Progress section has one user-facing entry for the two library editors and one for the book panel tabs. Each bold lead stands alone.
- [ ] No page names a version, and no page references agent files.
- [ ] All four gates pass.
