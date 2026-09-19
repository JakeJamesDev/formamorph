# 01: Own Placeholder Store for Library Editors

Status: ready-for-human
Status note: Built in "Give Library Editors Their Own Placeholder Store". The `inWorld` prop is removed: the modal store has no world lists, so the scoped section cannot bind there. Open follow-up: three components in the modals still read the world through `useGameDataOptional()` (`PlaceholderManager` pin names, `PlaceholderField` pin rows and writers, `DictionaryBookManager` rename code name).
Base: c53f7b6c
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

**Parent:** [Library Editor Layout](../spec.md)

**What to build:** Each library editor reads and writes only its own placeholders. The entity editor and the dictionary editor each give their own placeholder store to their whole body, not only to the Placeholders tab. The entry tree, the chip fields, and the palette then all read the item's own pool, and the app-wide world store cannot reach into the modal.

**Rationale for the model:** store identity decides whether every chip field rebuilds on each keystroke. The memo and its proof are easy to get wrong, and the failure is a silent slowdown. A strong model at high effort.

## Acceptance criteria

- [x] The carried pool keeps its identity while neither of its two source lists changes. This lands before the provider widens.
- [x] Each library modal provides its own store around its whole body. The store has no world lists.
- [x] A keystroke in an entry value or an entity field does not change the modal's store instance. A test proves it, and the test fails when the memo is removed.
- [x] An entry name or keyword that holds a chip shows the book's placeholder name in the library tree, while the surrounding world holds a different placeholder. A test renders the modal inside the real GameData provider.
- [x] A placeholder created from a field inside a library modal goes to that item and changes no world.
- [x] The scoped Placeholders section cannot bind inside a library modal, and the test that guards the single surface still passes.
- [x] The `inWorld` prop on the book panel is removed if the store change makes it unnecessary. If it stays, the ticket states why in its status note.
- [x] The changelog's In Progress section gains or extends one user-facing Fixed entry for the chip labels, folded with the entry from the guard fix.
- [x] All four gates pass, and `graphify update .` has run.
