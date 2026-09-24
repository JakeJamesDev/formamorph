# Spec: Default Stat Descriptors Follow a Rename

Status: ready-for-agent
Status note: no tickets; the spec is the unit. Found by the Authoring Tour's ticket 07. The user chose this fix (option A) on 2026-09-23.

## Problem Statement

When an author adds a stat in the World Editor, the app gives it three default descriptors, built from the stat's name at that moment: "New Stat is low", "New Stat is medium" and "New Stat is high". The name at that moment is almost always "New Stat".

Renaming the stat does not update them. After a rename to "Sea Change":

- Narration reads `Sea Change: New Stat is low`, because narration sees the descriptor, never the number.
- The player sees "New Stat is low" on the stat row in game.

Simple mode hides the Descriptors tab, so an author in Simple can neither see the stale text nor fix it. Every world built in the editor is exposed, and the author never finds out.

## Solution

A default descriptor follows the stat's name. When a stat is renamed, each descriptor whose text is still exactly a default built from the old name is rebuilt from the new name. A descriptor the author has edited is never touched.

| Before rename | After renaming "New Stat" → "Sea Change" |
|---|---|
| New Stat is low | Sea Change is low |
| New Stat is medium | Sea Change is medium |
| Barely holding on *(author-edited)* | Barely holding on |

## User Stories

1. As an author who renames a new stat, I want its default descriptors to use the new name, so that narration and players never see "New Stat".
2. As an author in Simple mode, I want this to happen without seeing the Descriptors tab, so that a hidden field never carries wrong text.
3. As an author who edited a descriptor, I want my text left alone on a rename, so that the app never overwrites what I wrote.
4. As an author who edited only one of the three defaults, I want the other two to still follow the name, so that each descriptor is judged on its own.
5. As an author typing a new name one letter at a time, I want the descriptors to follow every keystroke, including a moment where the name is empty, so that the final text matches the final name.
6. As an author using find and replace on a stat name, I want the descriptors to follow too, so that every rename path behaves the same.
7. As an author who discards editor changes, I want the descriptors to roll back with the name, so that discard stays the whole undo.
8. As a player, I want the stat row's descriptor to name the stat I see, so that the game does not show a placeholder name.

## Implementation Decisions

- **One builder for the default descriptors.** Adding a stat and the rename rule both take the default texts and thresholds from the same function, so the pattern that is recognized can never drift from the pattern that is created.
- **The rule is pure.** It takes the stat before and after an update and returns the descriptors to store. It changes only descriptors whose text exactly equals the default built from the previous name. The match is exact: no case folding, no trimming.
- **It runs in the one place every rename passes through:** the world data context's stat update. The editor's name field, find and replace, and the Authoring Tour's **Use Example** all use that update.
- **A no-op returns the same descriptors,** so an update that renames nothing causes no extra change.
- **No migration.** Worlds that already hold stale defaults are not rewritten. Rewriting shipped worlds is the project owner's call, and this fix does not make it.
- **No world or save export-shape change.** Descriptors keep their current shape.

## Testing Decisions

- Test external behavior: rename a stat and read its descriptors back. Assert nothing about how the rule is called.
- **Pure rule:** default descriptors follow a rename; an edited descriptor stays; a mix follows per descriptor; a rename through an empty name still ends correct; an update without a rename returns the same array.
- **Through the World Editor Bench harness:** add a stat, type a new name in the name field, and check that the stored descriptors follow. One test covers find and replace on the stat name.
- **Guards must bite:** prove the main test by removing the rule and watching it fail.
- Prior art: the stat manager tests, the World Editor Bench suites, and the find and replace tests.

## Out of Scope

- Repairing worlds that already hold stale defaults. A possible follow-up is a World Doctor rule, "a default descriptor names a different stat", with a one-click fix the author applies. That is not a migration, and it is the user's call.
- Stats created outside the editor (imports, default worlds).
- Changing the default texts or thresholds.
- Showing descriptors in Simple mode.

## Further Notes

- The Authoring Tour shows narration's real stat text in its In Play pane. Once this fix is on the tour branch, the tour's Stats step reads `Sea Change: Sea Change is low` with no change to the tour.
- Changelog: one 👤 Fixed entry in the In Progress section.
