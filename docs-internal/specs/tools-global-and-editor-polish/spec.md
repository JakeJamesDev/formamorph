# Global Tools and Tool Editor Polish

Status: ready-for-agent
Spec session: tools-global-and-editor-polish — spec

Two slices. Slice 1 is editor polish with no stored-shape change. Slice 2 moves Tool definitions out of prompt presets. Slice 1 ships first as its own unit.

## Problem Statement

A Tool is written inside one prompt preset. A player who wants the same Tool on two presets copies it, and every later fix must be made twice. The Tool editor asks for the same "Enabled" bit that the list row already shows. The "Offered To" field is a grid of fourteen checkboxes that does not match how the World Editor picks from a list. In full screen the Try It panel stays at its docked width, so most of the window is empty.

## Solution

**Slice 1.** "Offered To" becomes the same multi-select the World Editor uses for entities, with Select All shown. When every prompt is checked, the control shows "All Prompts" instead of a chip per prompt. The Enabled checkbox leaves the editor. The list row keeps the switch. In full screen the Try It panel takes one third of the width.

**Slice 2.** Tools become one global list in settings. A Tool's definition, parameters, handler, call limit, and Offered To list are written once. Each prompt preset holds one enabled bit per Tool. Built-in presets hold these bits as player state. Built-in Tools open in the same editor with definition fields locked and Offered To editable. A preset export embeds a copy of the Tools it enables, and import merges them into the global list by name.

## User Stories

1. As a player, I want to pick prompts for a Tool from a dropdown, so that the editor matches the rest of the app.
2. As a player, I want a Select All row in that dropdown, so that I can offer a Tool everywhere in one click.
3. As a player, I want Select All to clear the list when everything is checked, so that "none" is one click too.
4. As a player, I want the control to read "All prompts" when every prompt is checked, so that I do not scan fourteen chips.
5. As a player, I want the editor to stop asking for Enabled, so that I set that bit in one place.
6. As a player, I want the list row's switch to keep working during an edit, so that removing the checkbox loses nothing.
7. As a player, I want Try It to take one third of the window in full screen, so that the sample output has room.
8. As a player, I want the docked editor layout unchanged, so that slice 1 does not move what I know.
9. As a player, I want to write a Tool once, so that every preset can use it.
10. As a player, I want a switch per Tool on each preset, so that I turn a Tool on for a preset in one click.
11. As a player, I want a Tool's Offered To list to live on the Tool, so that I do not re-enter it per preset.
12. As a player, I want a new Tool enabled only on the preset I am on, so that it does not leak into presets it was not written for.
13. As a player, I want other presets to list the new Tool switched off, so that I can turn it on there later.
14. As a player, I want to flip a Tool's switch on a built-in preset, so that I do not copy a preset just to enable a lookup.
15. As a player, I want built-in presets to keep their shipped Tool switches as defaults, so that a fresh install behaves as it did.
16. As a player, I want built-in prompt text to stay read-only, so that enabling a Tool never edits a built-in preset.
17. As a player, I want to open a built-in Tool in the editor, so that I see its definition in the same place as my own.
18. As a player, I want a built-in Tool's definition fields locked, so that I cannot break a shipped lookup.
19. As a player, I want to change a built-in Tool's Offered To list, so that I can send it to more prompts.
20. As a player, I want the Tools tab to keep its preset selector, so that I choose whose switches I am editing.
21. As a player, I want the Tools tab to list every Tool under one preset, so that I see what that preset can call.
22. As a player, I want deleting a Tool to remove it from every preset, so that no preset keeps a switch for a Tool that is gone.
23. As a player, I want a preset export to carry copies of the Tools it enables, so that a preset I share still works.
24. As a player, I want a preset import to add Tools I do not have, so that a shared preset works without setup.
25. As a player, I want a preset import to match Tools I already have by name, so that I do not get duplicates.
26. As a player, I want a name collision to keep my local Tool, so that an import never replaces what I wrote.
27. As a player, I want the imported preset to enable the matched local Tool, so that the preset still calls something.
28. As a player, I want the Tool pack import and export to keep working, so that I can share Tools without a preset.
29. As a player, I want a request to receive only Tools that are enabled on the active preset and offered to that prompt, so that behavior matches the switches.
30. As a player, I want the global Tools switch to still override everything, so that one switch turns Tools off.
31. As a player, I want the endpoint notice to keep working, so that I know when a Tool will not be sent.
32. As a player, I want the "No prompts" summary in the list row to reflect the Tool's own list, so that the list matches the editor.

## Implementation Decisions

### Slice 1: editor polish

- "Offered To" uses the shared multi-select component. Select All stays visible. The option order is the request-kind order the editor uses today.
- The multi-select gains an `allSelectedLabel` prop. When it is set and every option is selected, the trigger shows that text as one chip in place of the per-option chips. The World Editor entity picker does not adopt it in this spec.
- The Offered To control uses "All Prompts" as that label, in Title Case like every chip and badge. The empty placeholder is "No Prompts" for the same reason.
- The Enabled checkbox and its handler leave the editor. The draft still carries the bit so a save does not change it. The list row switch stays the only place the bit changes.
- In full screen the editor grid becomes a two-track layout of two parts editor and one part Try It, with the current 22rem floor as the Try It minimum. The docked layout keeps its fixed Try It track.
- No stored shape changes. No changelog user story is needed beyond an In-Progress entry.

### Slice 2: global Tools

- The `Tool` type loses `enabled`. Definition, parameters, handler, empty result, call limit, and `offeredTo` stay on it.
- A global user Tool list lives in settings alongside the preset store. The preset type loses `tools`.
- The catalog stays as shipped constants. A global catalog override map holds `offeredTo` and an optional call limit per catalog id. Editing a built-in Tool's Availability tab writes that map. Definition fields are locked in the editor for catalog Tools.
- Each preset holds a Tool enabled map keyed by Tool id, for catalog and user Tools alike. A missing key means off.
- Built-in presets hold enabled maps as player state, stored beside the preset store keyed by preset id. The shipped override constants become the default enabled bits for those presets. Prompt text on built-in presets stays read-only.
- Creating a Tool sets its bit on the active preset only.
- Deleting a Tool removes its id from every preset's enabled map.
- Copying a preset copies its enabled map.
- The offer function takes the global Tool view, the active preset's enabled map, and the global Tools switch. It returns the Tools enabled on that preset and offered to the request kind.
- Preset export embeds a copy of each enabled user Tool. Import adds an embedded Tool whose name is unknown to the global list with a fresh id, and enables it on the imported preset. An embedded Tool whose name matches a local Tool is dropped, and the imported preset enables the local one. Catalog Tools embed nothing.
- There is no migration and no legacy import branch. Tools never released, so presets that hold Tools in local storage lose them.
- The `Tool` type's `enabled` bit drops from Tool packs. A pack carries definitions only.
- ADR-0008 is amended in place: the first Decision bullet becomes "A Tool is defined once in settings and enabled per prompt preset. A world author cannot ship a Tool." The endpoint gating bullets and the Consequences stand. The Tool entry in the domain glossary says the same.
- Preset export shape changes. The response that lands this slice says so.
- Follow-up (ticket 06): the Availability tab goes away. Offered To and Max Calls per Request live on the read page beside Enabled and write live, with no Save step. A user Tool writes its definition; a catalog Tool writes the global catalog override. Built-in Tools have no Edit action, and the editor's locked mode is removed. The label is "Max Calls per Request" because the value is a limit. No stored shape changes.
- Rulings folded from ticket 05: a community preset download stores through the same import path as a file import, so it merges embedded Tools by name the same way. An embedded Script Tool the import will add stays switched on, because the sandbox is read-only and time-limited; the import shows a warning before the player confirms, and the download path shows the same warning where it reports success. A name collision adds nothing and shows no warning; a catalog Tool counts as a local match, so an embedded Tool with a built-in name is dropped and the catalog Tool is switched on for the imported preset. On the wire, `SharedPreset.tools` holds copies of the enabled user Tools and `enabledTools` stays catalog-only.
- Rulings folded from ticket 02: the global list persists under its own key beside the preset store, and each preset stores `enabledTools` as a map of Tool id to boolean. Until ticket 05 lands, a shared preset drops Tool definitions and carries its enabled map filtered to catalog ids; import keeps catalog ids only. A Tool pack import joins the global list switched off on every preset; New Tool and Duplicate count as creation and switch on for the active preset only. Ticket 02 keeps today's built-in preset gates (New Tool, Import, Duplicate blocked; switch disabled) for ticket 03 to lift; Edit and Delete of a user Tool stay available on a built-in preset because the definition is global. Per-preset catalog Offered To overrides go away in ticket 02; catalog Tools use the shipped list until ticket 04 adds the global override.

## Testing Decisions

A good test drives the seam from outside and asserts what a player would see or what a request would carry. It does not read component state or private helpers.

- **Preset store, pure.** The global Tool list, the enabled maps for user and built-in presets, create-on-active-only, delete-from-all, copy carries the map, and the codec round trip. Prior art: the existing Tool store tests on the preset module.
- **Offer, pure.** Enabled plus offered plus global switch. Prior art: the existing offer tests.
- **Pack and preset import, pure.** Embed on export, add-unknown and keep-local-on-collision, catalog Tools embed nothing. Prior art: the existing pack plan tests.
- **ToolsTab render harness.** Slice 1: the multi-select opens with Select All, checking all shows "All prompts", the editor renders no Enabled checkbox, the full-screen grid class differs from the docked one. Slice 2: the list switch works on a built-in preset, a built-in Tool opens with locked fields and an editable Offered To, and Delete clears the row from a second preset. Prior art: the existing ToolsTab jsdom tests.
- Every guard must fail when its behavior is removed. The test-bar skill applies.

## Out of Scope

- Adopting `allSelectedLabel` in the World Editor entity picker.
- Per-preset Offered To overrides.
- A prompt at import time for name collisions.
- Tools in worlds.
- Any change to endpoint capability gating.
- A version bump.

## Further Notes

- Slice 1 lands first as one commit with no shape change. Slice 2 follows as its own unit and includes the ADR amendment.
- The four gates, `graphify update .`, and an In-Progress changelog entry apply to each slice.
