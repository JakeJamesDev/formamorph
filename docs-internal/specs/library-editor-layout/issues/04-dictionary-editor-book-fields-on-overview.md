# 04: Dictionary Editor: Book Fields on Overview

Status: ready-for-agent
Blocked by: 01, 02
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

**Parent:** [Library Editor Layout](../spec.md)

**What to build:** In the library dictionary editor, Overview holds everything about the book: Tags, Cover Image, Name, Description, and Enabled. The Dictionary tab shows entries only, with a + button at the top of the list, and the editor opens on the first entry.

**Rationale for the model:** the tree gains a mode that hides its root row while drag, duplicate, and delete keep working. Drag-and-drop trees in this codebase have known traps. A strong model at high effort.

## Acceptance criteria

- [ ] Overview holds Tags, Cover Image, Name, Description, and Enabled. At `sm` and up it uses two columns: Tags and cover on the left, the three fields on the right.
- [ ] A rename on Overview raises the rename offer, and placeholder paths follow the new name.
- [ ] The library editor no longer mounts the book panel. The World Editor still does.
- [ ] The entry tree has a mode that hides the book row and shows its entries at the top level. Entry order, drag, duplicate, and delete work as before. The World Editor's tree keeps its book nodes.
- [ ] A + icon button sits at the top of the entry list, with the size, style, and position of the World Editor's list add button. The two hosts share the button row where that is practical. It adds an entry and selects it.
- [ ] The modal opens on the Dictionary tab with the first entry selected. An empty book selects nothing and shows a hint beside the + button.
- [ ] The entry panel's Details and Matching strip does not change, and the existing entry tabs tests pass with only the book-node case rewritten.
- [ ] The Playwright widths spec from ticket 02 also covers the Dictionary tab and Overview.
- [ ] All four gates pass, and `graphify update .` has run.
