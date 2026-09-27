# Design System Reference Sync

Status: ready-for-agent
Spec session: design-system-reference-sync — spec

## Problem Statement

The Design System guide and its live showcase are the visual authority for Formamorph. An author of a new screen reads a pattern, opens its reference, and copies what they see. Six of the thirteen references no longer match production or the guide:

- **Panel Tab Strip.** The entity panel now has five tabs. The reference still labels it "Three Tabs", and its Traits and Openings tabs open an empty panel. The guide's tab table and its width math describe three tabs.
- **Grouped Context Actions.** The guide says Delete sits alone in the final section. Production now puts item actions in that section, before Delete: Check for Updates on entities and dictionaries, Publish on avatars, and the default-persona action on persona entities. The reference passes only Delete, so the section it shows is not the one players see.
- **Aligned Settings Stack.** The Display and Output examples are written by hand. They have drifted from the Settings dialog: Narration Size sits in the wrong section, the Turn Extras hint differs, and newer rows are missing. The guide says the examples reuse the production rows.
- **Narration Turn.** The guide describes the Pages action line and the Stats panel's Edit Stats and Re-generate Stats pair. The reference shows neither.
- **Built-in Placeholder chips.** The reference palette shows Player Name only. Character Name, and its Preview as the owning entity's name, appear in neither the reference nor the guide.
- **Image-Led Community Creation Cards.** Production draws Morph art for a listing the server flags as a stand-in. The reference fixture has no image, so it reaches Morph art through the no-image branch and never shows the flagged path.

A reader who trusts these references builds the wrong thing. A reader who spots the gaps stops trusting the showcase.

## Solution

Each drifted reference shows what production does today, and the guide says the same thing.

- The Panel Tab Strip reference shows the five-tab entity strip with a body for every tab. The guide's table and width notes match the registries.
- The Grouped Context Actions rule changes: the item's own actions form the last section, each with an icon, and Delete is last in it. The reference shows that section with every item action.
- The Settings reference renders the production Display and Output sections against local, non-persisting state. It cannot drift from the Settings dialog again.
- The Narration Turn reference shows the Pages action line and the Stats panel action pair, both from production components.
- The Prompt Chips reference shows Character Name in the palette and its owner-name Preview. The guide records that rule.
- The Community Cards reference shows a flagged stand-in listing drawing Morph art.

## User Stories

### Panel Tab Strip

1. As a UI author, I want the entity strip in the reference to show all five production tabs, so that I design against the real width case.
2. As a UI author, I want every tab in every reference strip to open a body that says what it holds, so that switching tabs shows a real change.
3. As a UI author, I want the section heading to state the entity strip's real tab count, so that the reference does not contradict what it renders.
4. As a UI author, I want the guide's tab table to list Profile, Descriptions, Traits, Openings, and Placeholders for the entity panel, so that I know the current grouping.
5. As a UI author, I want the guide to say which entity tabs are Advanced-only and which ones the library entity editor lifts onto its top strip, so that I know why its sub-strip shows fewer.
6. As a UI author, I want the guide's width figures to match the five-tab strip at 375px and in the half-width pane, so that the label breakpoints are justified by current numbers.
7. As a UI author, I want the guide to say which strip shares the stat panel's width case, so that the reason the stat strip is left out stays true.
8. As a maintainer, I want a test that fails when a panel registry gains a tab with no reference body, so that the next added tab cannot open an empty panel.
9. As a maintainer, I want a test that fails when a reference heading's tab count disagrees with its registry, so that the heading cannot go stale again.

### Grouped Context Actions

10. As a UI author, I want the rule to say that the item's own actions form the last section, so that I place Check for Updates, Publish, and similar actions correctly.
11. As a UI author, I want the rule to say Delete is last in that section, keeps its trash icon and destructive color, and opens a confirmation, so that destructive placement stays predictable.
12. As a UI author, I want the rule to say each item action carries an icon, so that item actions stay apart from set rows.
13. As a UI author, I want the reference to show a persona entity's real final section, Check for Updates, the default-persona action, and Delete, so that I see the section players see.
14. As a UI author, I want each item action in the reference to report a local outcome, so that I can confirm the row runs without touching my library.
15. As a UI author, I want the reference sample to show only the item actions its kind has in production, so that no action appears on an item it would never appear on.
16. As a maintainer, I want the default-persona menu item built once and shared by the Main Menu and the reference, so that its label and icon cannot drift.
17. As a maintainer, I want a test that opens the reference menu and asserts the last section's order ends in Delete, so that the rule is enforced on the reference.
18. As a UI author, I want the guide's state table to describe the new final section, so that the Destructive state row matches the rule.

### Aligned Settings Stack

19. As a UI author, I want the Settings reference to render the production Display section, so that its sections, rows, order, hints, and controls are the ones players see.
20. As a UI author, I want the Settings reference to render the production Output section, so that Turn Extras, Reasoning, Tools, Memory, Time, Lore, Characters, Choices, and Performance match production.
21. As a UI author, I want to switch the reference between Simple and Advanced, so that I can inspect both row sets.
22. As a player, I want changing a control in the reference to leave my real settings untouched, so that browsing the showcase never changes my game.
23. As a player, I want the Theme control in the reference to leave my app theme untouched, so that the showcase does not repaint the app.
24. As a player, I want turning on semantic memory or semantic lore in the reference to start no model download, so that the showcase never uses my bandwidth or disk.
25. As a UI author, I want the reference to report a local outcome where production would download or call out, so that I can see the control ran.
26. As a UI author, I want the Live Sample for palette and font to remain in the reference, outside the production section, so that I can still judge theme and font inheritance.
27. As a UI author, I want the Control States card to remain, so that Default, Selected, Disabled, Focus, Validation, and Overflow stay demonstrated.
28. As a player, I want the Settings dialog to behave exactly as before, so that the extraction changes nothing I use.
29. As a maintainer, I want the Settings dialog and the reference to render the same section components, so that a new row in production appears in the reference without extra work.
30. As a UI author, I want the guide's production mapping to name the Display and Output section components, so that I know what to reuse.

### Narration Turn

31. As a UI author, I want the reference's latest page to show the Pages action line, so that I see the player's text with its primary left rule and muted foreground.
32. As a UI author, I want the action line in the reference to open its own menu, separate from the card's menu, so that I can confirm the two menus stay apart.
33. As a UI author, I want the action line's menu actions to come from the production player action list, so that the reference and the game cannot drift.
34. As a UI author, I want the reference to show the Stats panel's Edit Stats and Re-generate Stats pair, each with its tooltip, so that I see where stat regeneration lives.
35. As a UI author, I want the reference to show Re-generate Stats disabled on a past turn, so that I see the history restriction.
36. As a maintainer, I want the action line and the Stats panel pair to be production components that both the game and the reference render, so that the reference uses no copy of their markup.
37. As a player, I want the Pages layout and the Stats panel to behave exactly as before, so that the extraction changes nothing I use.

### Built-in Placeholder chips

38. As a UI author, I want the reference palette to show Character Name as well as Player Name, so that I see both Built-in chips with their mark.
39. As a UI author, I want the reference to include a field owned by a sample entity, so that Character Name has an owner there.
40. As a UI author, I want the reference's Preview to show Character Name as the owning entity's name, so that I see the owner-name rule.
41. As a UI author, I want the guide to say that Character Name previews as the owner's name, a blank name or a field with no owner keeps the label, and Player Name keeps its label, so that the rule is written down.

### Community Cards

42. As a UI author, I want the reference to include an entity listing the server flags as a stand-in, so that I see Morph art drawn in place of the stored file.
43. As a UI author, I want the no-image entity fixture to stay, so that both routes to Morph art remain visible.
44. As a UI author, I want the guide to say a flagged stand-in listing draws Morph art and never fetches its stored file, so that the rule is written down.

### Showcase and guide

45. As a maintainer, I want each changed reference's description to still say what it shows and where to act, so that the showcase stays usable without the guide open.
46. As a maintainer, I want new reference copy reviewed by role against the Writing Guide, with unverified items listed in each pattern's Writing review, so that copy limits stay on record.
47. As a maintainer, I want the showcase registry test to still find every reference, so that no reference drops out during the change.

## Implementation Decisions

- **Scope.** Six references and their guide sections change: Panel Tab Strip, Grouped Context Actions, Aligned Settings Stack, Narration Turn, Built-in Placeholder chips (in Focused Markdown Authoring), and Image-Led Community Creation Cards. The other seven references stay as they are.
- **Panel Tab Strip reference.** The entity strip keeps rendering the full production registry, which is the World Editor's Advanced set. Body text stays one map per registry, and it gains entries for Traits and Openings. The heading becomes "Five Tabs". The sections stay in descending tab count: five, four, three, two.
- **Panel Tab Strip guide.** The table lists Entity as Profile · Descriptions · Traits · Openings · Placeholders. Openings and Placeholders are Advanced-only. The library entity editor moves Traits and Placeholders onto its own top strip, so its Entity sub-strip shows Profile, Descriptions, and Openings. Width figures are measured again at 375px and in the half-width pane between `md` and `xl`, and replace the three-tab figures. The label breakpoints themselves do not change unless the measurements show a label now fits or overflows where it did not before. The sentence that leaves the stat strip out now names the trait strip as its width twin: both have three equal columns.
- **Grouped Context Actions rule.** The rule changes as follows:
  - The item's own actions form the final section.
  - Each item action carries an icon.
  - Delete is last in that section, keeps its trash icon and destructive color, and opens the existing confirmation.
  - Arranging sections (Tile Size, grouping) stay above it.
  - Separators still divide kinds, not topics.
- **Default-persona action.** The Set as Default Persona / Clear Default Persona menu item moves out of the Main Menu into a production builder next to the tile menu. The Main Menu and the reference both call it.
- **Context Menu reference.** The sample becomes a persona entity, so its final section is Check for Updates, the default-persona action, then Delete. No library kind has Check for Updates, Publish, and the persona action together, so the reference shows no Publish. The guide names Publish as an item action in text. Entity tiles have no Publish, although the entity editor has one; adding it is a separate product decision. The sample is shown with the production card treatment the Main Menu uses for that kind. Each item action writes a local status line. The existing Tile Size, grouping, picker, and deletion demonstrations stay.
- **Settings extraction.** The Display and Output tab bodies move out of the Settings dialog into two production section components.
  - Each section reads a settings source with the same member names as the Settings context value. The Settings dialog passes the live context. The reference passes a local in-memory source built from the settings defaults.
  - Effects that leave the page go through that source: theme persistence, embedding-model load and dispose, and any other effect the sections trigger. The reference's source supplies local handlers that write a status line.
  - The nested dialogs the Display section opens (font tuning, reveal animation, theme preview) take the same source, defaulting to the live context, so a dialog opened from the reference writes no real settings. The extraction ticket threads it; the reference ticket only wires. Embedding download state stays owned by the dialog, because inactive tab bodies unmount, and reaches the Output section through the source.
  - The sections take the Simple/Advanced mode as input. The reference offers the production mode control.
  - The Settings dialog keeps its tabs, mode state, and every behavior. The extraction is a pure move.
- **Settings reference.** The Display and Output cards render the extracted sections. Theme Preview and the quote color field read token values from the live page, so a Theme change in the reference reseeds the preview and its caption but does not recolor it; that is accepted, since nothing is written. The Live Sample moves out of the Appearance section into its own block, because the section is now production. The Control States card is unchanged.
- **Narration Turn extraction.** Two inline Pages pieces become production components that the game and the reference both render:
  - the action line: the player's text, its left rule, and its own menu fed by the player action list;
  - the Stats panel action pair: Edit Stats and Re-generate Stats, with tooltips, bound to the viewed turn, and disabled on past turns and while a reply or scene render runs.
- **Narration Turn reference.** The latest page shows the action line above the narration. The Stats panel pair is shown twice: once for the latest turn with both actions enabled, and once for a past turn with Re-generate Stats disabled. Actions write to the existing status line.
- **Prompt Chips reference.** It adds a field owned by a sample entity with a non-blank name. The palette shows both Built-in chips. Preview shows Character Name as that name. The guide's Built-in Placeholder chips section gains the owner-name Preview rule.
- **Community Cards reference.** It adds an entity fixture flagged as a stand-in, with a stored thumbnail value. The card must draw Morph art for it and must not show the stored file. The guide adds one line for the flagged path.
- **Export shape.** No world or save export shape changes.

## Testing Decisions

- **What a good test is here.** Render the reference, or the production section, and assert what a user can observe through roles, accessible names, and text. Do not assert markup structure or class names. Each new guard must be shown to fail once, by reintroducing its bug, before it counts.
- **Panel Tab Strip.** The reference test iterates every panel registry the reference renders. Every tab must open a non-empty body, and every heading's count must equal its registry's length. Prove the guard bites by removing one body entry. The existing width e2e specs stay the width check.
- **Context Menu.** The reference test opens the menu and asserts that the final section holds the item actions in order and ends in Delete. It asserts that each item action writes its local status. The existing test that asserts no persistence also covers the new actions.
- **Settings sections.** The existing Settings dialog tests must pass unchanged, which proves the move is pure. The showcase test for the Settings reference asserts that changing Display and Output controls writes no persistent settings and no theme. With the embedding loader mocked, turning on semantic memory in the reference must not call it. The existing "exercises production controls without writing persistent settings" test is the prior art.
- **Narration Turn.** The reference test asserts that the action line opens its own menu with the player actions, and that a right-click on it does not open the card's menu. It asserts Re-generate Stats is enabled on the latest turn and disabled on the past turn. The existing Pages parity test and the Pages and Chat game tests must pass unchanged.
- **Prompt Chips.** A reference test asserts that the palette lists Player Name and Character Name under Built-in, and that Preview shows the sample owner's name for Character Name.
- **Community Cards.** The reference test asserts that the flagged fixture renders Morph art and no image with the stored thumbnail.
- **Showcase registry.** The existing showcase test continues to find all thirteen references.
- **Gates.** All four gates pass, `graphify update .` is run, and the UI is verified in the live showcase at desktop and 375px in both themes.

## Out of Scope

- The two places where production departs from the Aligned Settings Stack rule: the Theme row uses a plain toggle group instead of the responsive option switcher, and Narration Size uses a plain slider instead of the value slider. These are follow-ups; the extraction moves them unchanged.
- The Endpoints, Prompts, Tools, and Audio tabs of the Settings dialog.
- A Chat-layout demonstration in the Narration Turn reference.
- The community details window's portrait layout. It is not part of any pattern.
- The seven references with no drift: Markdown, Find, Code Templates, Locations, Rich Lists, Footer Actions, and Prompt Navigation.
- Aligning other screens with any rule. Existing-screen alignment is separate work.

## Further Notes

- The inventory that produced this spec compared each reference's last commit against production commits since, then checked the live showcase. The drift table lives in the spec session's transcript.
- The Settings dialog is about 3,300 lines. The extraction is the largest item here and the one most likely to collide with other sessions. Check for parallel sessions on the Settings dialog before starting it.
- The Pages host was mid-edit by another session when this spec was written. Check for parallel sessions on it before the Narration Turn extraction.
- The showcase is a dev-only route, so this work needs a 🛠️ changelog entry only.
