# 07: No World Behind a Library Editor

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

**Parent:** [Library Editor Layout](../spec.md)

**What to build:** A library editor cannot read or write the last loaded world. The main menu mounts both library modals inside the app-wide GameData provider, so three widgets inside them still reach that world: the placeholder manager's owner names, placement letters, and pin popover; the placeholder field's pin rows and pin writers; and the book panel's rename code name. Each library modal puts a null GameData override around its body, so every optional GameData read inside returns nothing.

**Rationale for the model:** the override changes what every widget in two modals sees, and one of the reads is a write path into a world. The test must load a real world around the modal. A strong model at high effort.

## Acceptance criteria

- [ ] Each library modal wraps its body in a null GameData override. No widget gets a prop or a flag for this.
- [ ] A widget that requires GameData, not the optional read, still fails loudly inside a library modal. The override does not hide a wrong mount.
- [ ] Inside a library modal, a placeholder pin offers no trait, location, or stat target, and no pin row names a thing from the loaded world.
- [ ] Pin data that a library item already carries stays in the item through open, edit, and save. The editor does not strip it.
- [ ] One test per modal renders it inside a loaded world with traits, locations, stats, and placeholders. It proves that no world name shows in the pin surfaces and that an edit in the modal calls no world writer. Each test fails when the override is removed.
- [ ] The World Editor's pins, owner names, and rename offer work as before, and their tests pass untouched.
- [ ] No changelog entry unless a user-visible fault is reproduced first. If one is, it folds into the entry from ticket 01.
- [ ] All four gates pass, and `graphify update .` has run.
