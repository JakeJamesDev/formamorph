# 05: Client: Supporter Copy library entries

Status: done
Blocked by: 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Model rationale: wires ticket 04's rule into library records and the add-to-world paths.

Scope note (R20): ticket 04 owns the library-entry marker type and the rule for it, add-to-world included. This ticket wires the surfaces.

## Parent

[spec.md](../spec.md) — Timed Supporter Content and Supporter Worlds.

## What to build

Save to Library from a Supporter Copy writes a library entry with its own local-only Supporter Copy marker and the source world's id (R7). The entry's export and publish are disabled with a tooltip, in the library editors and the Main Menu publish paths, and an Avatar carried over with it follows the same rule. The entry can be added only to its source world; every other world's add path shows it disabled (R9). Formaquestion's AI Context export is disabled with the reason while the open world is a Supporter Copy (R24).

## Acceptance criteria

- [x] Saving an entity and a dictionary from a Supporter Copy writes marked library entries; saving from a plain world writes none. (`librarySources.supporterCopy.test.ts`, `useLibraryLinking.supporterCopy.test.tsx`)
- [x] A marked entry's export and publish are disabled with a tooltip; an Avatar carried with it is blocked the same way. (`EntityEditorModal.supporterCopy.test.tsx`, `EditorModalShell.test.tsx`, `librarySources.supporterCopy.test.ts`)
- [x] A marked entry can be added to its source world and is disabled in every other world's add path. (`AddFromLibraryModal`, `EnterWorldLibrary`, `PersonaPicker`, `PersonaRow` tests)
- [x] Formaquestion's AI Context export is disabled with the reason while a Supporter Copy is open, and enabled otherwise. (`Formaquestion.aiContext.test.tsx`)
- [x] Each guard is shown to bite by reinstating the bug. Each new guard went red when its code was reverted, except where noted under Not verified.


## Landed

**Not verified**

- No live-preview frames of the disabled states. Each is a DOM read in a component test; none was seen in a browser.
- `EnterWorldFlow` fills `blockedReason` on library personas and filters the persona preselect; no test drives that wiring. The pickers it feeds are tested.
- Enter World's Player Avatar list (`CharacterCustomization`) and its Avatar-library step still list marked Avatars. Picking one there is a display choice and is not embedded in an export, so I left it. Say if R26 should cover it.
- A Supporter Copy world may still write into a marked item from another world. R27 only blocks unmarked items.

**For you**

- For you: read the tooltips on the disabled library actions and the add rows ("You can only add this to the Supporter world it came from"), in the Library tile menu, the entity and dictionary editors, Add Entity, Add Dictionary and Enter World's Library Additions.
- A library Avatar saved with a Supporter Copy entity is marked. Its Export and Publish in the Avatar details window are disabled, and the entity Avatar dropdown lists it disabled.
- Formaquestion's AI Context export is disabled while a Supporter world is open, and for any question asked there afterward.
