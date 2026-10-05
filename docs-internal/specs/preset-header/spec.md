# Spec: Preset Header

Status: done
Status note: Closed 2026-10-04. Tickets 01-10 done, last landing 42386bf5. Closed without gates.
Spec session: preset-header — spec

## Problem Statement

Settings and Formaquestion Settings each have a Prompts tab and an Endpoint tab, and each tab has a preset header: a label, a preset select, and the actions on the active preset. Four headers exist today and no two match. The Settings Prompts header shows text buttons on desktop and a ⋯ menu on narrow screens. The Formaquestion Prompts header shows icon-only buttons with tooltips and wraps on narrow screens. The text endpoint editor and the image endpoint header show text buttons at every width. Each header also offers a different action set: only Formaquestion has Duplicate and an Import icon, only Settings has Publish, and the endpoint headers have no Import or Export at all.

The per-prompt endpoint route fields show whether the chosen endpoint answers. The three preset selects that pick an endpoint do not: the text endpoint preset select, the image endpoint preset select, and the in-game image preset picker.

Reset and Compare sit in three places. Settings puts one "Reset <Prompt>" button in the modal footer and has no Compare. Its stacked Messages view puts a small Reset at the right of each label row. Formaquestion puts "Compare to Default" and "Reset to Default" at the right of the label row, where they overlap the label at phone width.

Full screen on Settings Prompts lifts the whole panel, rail and footer included. Full screen on a Formaquestion prompt lifts the one edit box.

## Solution

One shared preset header. Icon-only buttons with tooltips at `md` and up, the ⋯ menu below `md`. Every header offers the same action list, minus Import and Export on endpoint presets and minus Publish outside Settings Prompts. The select keeps its "Add New Preset…" row. "Import Preset…" leaves the select and becomes an icon.

The reachability badge appears under the text endpoint preset select, the image endpoint preset select, and the in-game image preset picker. Image providers are probed only where a free list request exists.

Reset and Compare appear on both modals with short labels and icons, Reset left of Compare, Compare at the right edge. A single prompt on screen puts them in the modal footer. Stacked prompts keep them at the right of each label row.

Formaquestion full screen lifts the whole Prompts tab through the same shell Settings uses.

The pattern lands in the Design System with a showcase reference.

## Rulings

Settled with the user on 2026-10-04.

| # | Ruling |
|---|---|
| Q1 | All four headers adopt the shared component: Settings Prompts, the text endpoint editor in both modals, the image endpoint header, Formaquestion Prompts |
| Q2 | Icons at `md` and up. Below `md` the ⋯ menu holds every action. Formaquestion gains the menu |
| Q3 | The badge goes under the text endpoint preset select and the image endpoint preset select |
| Q4 | Lands as a spec with tickets |
| Q5 | Image probes run where a free GET exists: ComfyUI, InvokeAI, A1111, OpenAI on desktop. NovelAI and OpenAI on web show no badge |
| Q6 | The in-game image preset picker gets the same badge |
| Q7 | Every header offers the full action set |
| Q8 | Endpoint presets get no Import or Export: the file would carry a token |
| Q9 | "Add New Preset…" stays in the select beside the Duplicate icon |
| Q10 | "Import Preset…" leaves the Settings select. Import is an icon in the file group |
| Q11 | The Compare and Reset overlap at phone width is fixed by the move in Q13–Q15 |
| Q12 | Publish stays on Settings Prompts |
| Q13 | Both modals use "Reset" and "Compare" with icons. The confirm dialog names the prompt |
| Q14 | Reset and Compare join this spec with their own tickets |
| Q15 | Right-aligned everywhere. Reset left of Compare, Compare at the right edge. One prompt on screen: the modal footer. Stacked prompts: the right of each label row, as Settings Messages does today |
| Q16 | Formaquestion full screen lifts the whole Prompts tab through the Settings shell |
| Q17 | The image endpoint Tag Prompt is out of scope. Reset and Compare cover prompt-preset surfaces only: the Settings prompt tabs, the Messages view, and Formaquestion (ticket 07 intent question, spec session) |
| Q18 | In Formaquestion full screen, the Options view shows the field's "Exit full screen" toggle, same icon, label and position, only while in full screen. A touch player has no Escape key (ticket 09 intent question, spec session) |

## User Stories

1. As a player, I want the preset header to look the same in Settings and Formaquestion Settings, so that I learn it once.
2. As a player, I want the header actions as icons on desktop, so that the preset name has room.
3. As a player, I want a tooltip on each icon, so that I know what it does before I click.
4. As a player on a phone, I want one ⋯ button that holds every action, so that the header fits on one row.
5. As a player, I want Duplicate on every preset header, so that I can start a copy of any preset with one click.
6. As a player, I want Rename, Reset and Delete on every editable preset, so that each header manages its preset the same way.
7. As a player, I want Import and Export on prompt presets in both modals, so that I can move help presets and gameplay presets the same way.
8. As a player, I want no Export on an endpoint preset, so that my API token never lands in a file.
9. As a player, I want "Add New Preset…" in the select, so that I can name a new preset as I create it.
10. As a player, I want Import as an icon rather than a select row, so that the select lists presets only.
11. As a player, I want a built-in preset to offer only Duplicate, Import and Export, so that I cannot change a preset that updates with each release.
12. As a player, I want a confirm before Reset and Delete, so that one click cannot lose my edits.
13. As a player, I want focus to return to the button or the ⋯ menu when I cancel a confirm, so that the keyboard keeps its place.
14. As a player, I want the text endpoint preset select to say whether the chosen endpoint answers, so that I find a down server before a turn fails.
15. As a player, I want the image endpoint preset select to say whether the image server answers, so that I set up image generation with proof.
16. As a player, I want the in-game image preset picker to show the same badge, so that I pick a working server mid-play.
17. As a player, I want a badge that says the server answers but lacks my model, so that I fix the model name rather than the URL.
18. As a player, I want a Recheck link on the badge, so that I can test again after I start a server.
19. As a player, I want no probe to cost money, so that a paid cloud endpoint is never billed for a check.
20. As a player, I want no badge where the provider offers no free check, so that the header never claims what it cannot prove.
21. As a player, I want the bundled engine preset to show no badge, so that a preset with no URL is not called unreachable.
22. As a player, I want Reset and Compare on every editable prompt in both modals, so that I can see and undo my edits the same way.
23. As a player, I want Reset left of Compare with Compare at the right edge, so that the pair sits in the same place on every prompt.
24. As a player, I want Reset and Compare in the modal footer when one prompt is on screen, so that the editor keeps its height.
25. As a player, I want Reset and Compare at the right of each label row when prompts stack, so that each box carries its own pair.
26. As a player, I want Reset and Compare disabled when my text equals the default, so that the buttons tell me whether I changed anything.
27. As a player, I want the Compare dialog to show a diff against the default text, so that I see what I changed.
28. As a player on a phone, I want the Formaquestion prompt label to stay readable, so that no button covers it.
29. As a player, I want Formaquestion full screen to lift the whole Prompts tab, so that I can switch prompts without leaving full screen.
30. As a player, I want full screen to return focus to the button that opened it, so that the keyboard keeps its place.
31. As a contributor, I want the pattern in the Design System with a live reference, so that the next header is built on it.
32. As a contributor, I want one action list that every header renders, so that an added action reaches every surface.

## Implementation Decisions

**Shared header component.** One component renders a label, the preset select, and an ordered action list. Desktop (`md` and up) renders icon-only ghost buttons with tooltips: destructive actions left of the select, file actions right. Below `md` the existing ⋯ menu renders the same list by section, destructive last. The menu component moves beside the header component. The action list builder gains `duplicate` and `import` and is the one source of actions for every surface. Each surface passes its handlers; a handler absent from the surface removes the action.

**Action set per surface.** Prompt presets (Settings, Formaquestion): Duplicate, Rename, Import, Export, Publish (Settings only), Reset, Delete. Endpoint presets (text, image): Duplicate, Rename, Reset, Delete. A built-in preset keeps Duplicate, Import and Export. Duplicate makes "<name> (copy)" and selects it. "Add New Preset…" stays as the last select row and asks for a name. The "Import Preset…" select row is removed.

**Formaquestion Prompts header.** Rebuilt on the shared component. It gains Reset, which resets the active preset's three prompts and their options after a confirm. Its per-prompt Reset moves per Q15.

**Text endpoint editor.** Its header renders the shared component in both modes: with the select in Settings, and with the heading plus the action icons in Formaquestion. The Add button in heading mode becomes the Duplicate icon.

**Image endpoint header.** Rebuilt on the shared component with Duplicate, Rename, Reset and Delete. Delete stays hidden while one preset remains.

**Reachability on endpoint selects.** The text endpoint preset select and the image endpoint preset select render the reachability badge under the select for the active preset. The in-game image preset picker renders the same badge. The engine preset passes `enabled: false`.

**Image probe.** A provider-keyed probe beside the text probe. ComfyUI reads its node info. InvokeAI reads its model list. A1111 reads its model list. OpenAI reads its model list through the desktop bridge and is disabled in the web build. NovelAI is disabled. A provider with a model list reports "Reachable, but no model" when the configured model is absent. The hook's session cache keys on provider, endpoint and model, so the Settings select and the in-game picker share one answer.

**Reset and Compare.** Both buttons use short labels with icons. Reset confirms with a dialog that names the prompt. Compare opens a shared diff dialog, lifted out of Formaquestion, fed the default text by the caller. Both disable when the text equals the default and hide on a built-in preset. Single-prompt surfaces (Settings prompt tabs, Formaquestion) render the pair in the modal footer, right-aligned. Stacked surfaces (Settings Messages) render the pair at the right of each label row, where Reset sits today.

**Full screen.** The prompts shell moves out of the Settings modal into a shared component. The Formaquestion Prompts tab hosts a morph and passes it to each field, as Settings does. The field's own overlay stays as the fallback for a caller that passes no host.

**Design System.** A "Pattern: Preset Header" section with composition, production mapping, responsive behavior, state reference (editable, built-in, narrow, each reachability state) and writing review. A showcase reference renders the header in both widths and every state.

## Testing Decisions

A good test drives the rendered surface the way a player does and asserts what the player sees: which buttons exist, their order, what a confirm does, what the badge says. No test reads component internals.

- The shared header: a rendered test of the action list, the desktop order, the ⋯ menu contents, the built-in subset, and focus return after a canceled confirm. Prior art: the Settings preset menu test.
- Each surface: its existing rendered-tab test keeps behavior assertions (duplicate, rename, delete, reset, import, export) and drops any assertion on button text or placement that the shared test covers.
- Image probe: fetch-mocked unit tests per provider, including the disabled providers and the missing-model state. Prior art: the text probe test.
- Hook cache: the existing hook test extends to the provider key.
- Badges: rendered-tab tests assert the badge text under each of the three selects with a mocked probe.
- Reset and Compare: rendered-tab tests on both modals assert the pair's placement, order, disabled state and the confirm.
- Full screen: Playwright per-frame sampling in the fullscreen morph spec, extended to the Formaquestion Prompts tab. The jsdom pane does not composite, so no motion claim comes from it.
- Design System: the design-system e2e smoke covers the new reference.

## Out of Scope

- Import and Export for endpoint presets (Q8).
- Publishing help presets (Q12).
- A NovelAI probe through its subscription endpoint (Q5).
- Any change to preset file shapes. The help preset file and the prompt preset file keep their fields.
- The World Editor's prompt fields, which keep the field-level fullscreen fallback.

## Further Notes

- The probe sends list requests only, never a completion, so no paid endpoint bills tokens. A gateway that hides its model list reads as "Didn't answer". The route fields accept this today.
- Reset in the Formaquestion header is new behavior for help presets. It resets prompts and options together, matching the Settings "Reset every prompt" confirm.
- Frames from the grill: `.scratch/preset-header/` holds the three phone-width captures that settled Q2.
- Q18 focus return: a docked Options view has no toggle, so the shell returns focus to the current rail row instead (ticket 09).
- Dev-route finding (ticket 09): `formaquestionSettings` keeps the help window on screen over its settings. With the window visible, the full-screen trip stalls one frame of about 260 ms. A player never reaches that state, because the window's menu hides the window while Settings is open, so the morph e2e takes the menu path. The route is unchanged. A follow-up may hide the window on that route.
