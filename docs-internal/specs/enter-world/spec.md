# Enter World: unified setup and remembered library additions

Status: ready-for-agent
Status note: The unified prototype was accepted on September 7, 2026, after removal of its navigation shadow. Testing boundaries were confirmed during spec creation. This specifies production implementation; the prototype remains a design reference.

## Problem Statement

Players repeatedly choose library content whose relevance to a world rarely changes. Owning one unrelated entity or dictionary adds a mandatory screen. An intentionally empty selection is forgotten just as readily as a populated one.

Enter World compounds this with sequential screens and a second sequence inside trait groups. Revisiting pickers can reconstruct their local defaults rather than retain the complete setup. Players cannot freely review choices while keeping a clear, stable action to start.

## Solution

Enter World opens one workspace with directly accessible Starting Traits, Starting Location, and Library Additions. One draft survives category navigation, reopening Introduction, and the separate Avatar handoff.

Library additions start from personal defaults remembered for this local world, including explicit none. Ordinary edits affect this game. **Use these additions for future games** explicitly saves the configuration as this world's defaults. Owning or acquiring library content never introduces another mandatory step.

Desktop uses one compact navigation column beside wide content. Trait nesting remains permanently expanded and indented. Groups with direct traits are selectable; groups containing only descendants are organizational labels. Empty branches and empty General are omitted.

Phone portrait uses **Categories** to expand the same hierarchy inline above the content. Selecting a category collapses navigation. The bar and list share a contrasting background and stronger bottom border. Expansion/collapse takes 150 ms and pushes content through normal layout; reduced motion disables animation. There is no shadow, select popup, or drawer.

## User Stories

1. As a player, I want one setup workspace, so that configuring a game feels like one task.
2. As a returning player, I want my usual additions preselected per world, so that I do not repeat familiar decisions.
3. As a player, I want an empty configuration remembered, so that unrelated content never interrupts that world.
4. As a player, I want new library items left off, so that downloads do not change existing configurations.
5. As a player, I want one-game overrides, so that experiments do not replace my usual setup.
6. As a player, I want an explicit save-defaults action, so that I control when a change becomes permanent.
7. As a player, I want defaults isolated by local world identity, so that configuring one world does not affect another.
8. As a player sharing a world, I want personal preferences excluded from its export, so that sharing does not impose my library.
9. As a player, I want fresh independent copies for new games, so that gameplay does not modify library originals.
10. As a player resuming a save, I want its content retained, so that later defaults and library edits do not rewrite it.
11. As a player, I want direct category navigation, so that I can review choices without a Next/Back sequence.
12. As a player, I want every draft choice retained, so that navigation does not erase selections or dictionary order.
13. As a desktop player, I want compact navigation and generous content width, so that hierarchy does not crowd choices.
14. As a phone player, I want Categories to expand beneath its control, so that its behavior is predictable.
15. As a phone player, I want category selection to close navigation, so that choices regain the available space.
16. As a phone player, I want a distinct navigation background and bottom boundary, so that browsing and editing are visually separate.
17. As a player sensitive to motion, I want reduced motion respected, so that navigation does not require animation.
18. As a player, I want arbitrary-depth authored nesting preserved, so that the world's organization stays understandable.
19. As a player, I want branches always visible, so that selecting a category has only one purpose.
20. As a player, I want container-only groups shown as labels, so that they do not imply direct choices.
21. As a player, I want empty groups and General omitted, so that I do not encounter dead destinations or 0/0 rows.
22. As a player, I want compact selected/available counts such as 1/3, so that I can spot choices and current selections.
23. As a player, I want counts to cover each group's own traits, so that opening it shows the advertised choices.
24. As a player, I want exclusive traits shown as radios and other traits as checkboxes, so that I can predict replacement behavior.
25. As a player, I want clicking a selected trait radio to clear it, so that optional exclusive choices retain their existing behavior.
26. As a player, I want authored trait defaults and ordering preserved, so that setup starts from the intended baseline.
27. As a player, I want descriptions and stat effects available, so that I can understand choices before selecting them.
28. As a player, I want placeholder text to reflect draft traits, location, and starting stats, so that setup describes the game I will enter.
29. As a player, I want stable Rolls within setup, so that navigation and Introduction do not reshuffle the world.
30. As a player, I want Random and valid starting locations preserved, so that I retain existing location choices.
31. As a player, I want portraits and dictionary covers, so that I can recognize familiar library content quickly.
32. As a player, I want usable missing-art rows, so that an absent image does not prevent selection.
33. As a player, I want library search and clear source sections, so that I can locate additions and distinguish them from world content.
34. As a player, I want dictionary enablement and ordering retained, so that redesigning setup does not change narrator input.
35. As a player, I want a full markdown Introduction before setup when enabled, so that long guidance remains readable.
36. As a player, I want to reopen Introduction without losing choices, so that I can consult it during setup.
37. As a player, I want readme visibility preferences respected, so that dismissed introductions do not return.
38. As a player, I want a stable Start game or Continue to Avatar action, so that I can finish from any category.
39. As a player, I want a compact header and quieter Cancel, so that more space belongs to choices.
40. As a player using Avatar customization, I want its existing editor and my setup preserved, so that this redesign does not alter avatar creation.
41. As a player canceling setup, I want the draft discarded and session ended, so that the next entry starts cleanly.
42. As a player using Quick Start or loading a save, I want existing bypass behavior, so that setup is not inserted into those paths.
43. As a keyboard or touch user, I want reachable controls and no focusable hidden categories, so that I can complete setup without a pointer.

## Implementation Decisions

### Entry lifecycle and one draft

- Replace the sequential trait, location, entity, and dictionary pickers in normal entry. Reuse MainMenu's entry boundary and session/start contracts; the throwaway route is not the production entry point.
- Own selected trait IDs, starting-location choice, entity IDs, dictionary enablement, and dictionary ordering above category rendering. Remounting a category must not reset it. Returning from Avatar restores the draft and useful navigation state.
- Begin the Placeholder Session before resolving Introduction and setup text. Rolls stay stable through category/readme/Avatar navigation. Cancel discards the draft and ends the session; later entry begins a fresh session. Preserve Pin precedence and starting-stat calculations.
- Seed traits from authored defaults and location from existing Random behavior. Do not persist personal trait/location defaults across games.
- Open the first meaningful category: populated General or first populated trait group, otherwise useful location or library content. Omit empty trait sections. A world with nothing to configure retains a clear finish path without a mandatory library review or empty General page.
- Preserve starting-location eligibility and fallback rules, including one or no flagged starting locations. Random does not acquire optional-trait click-to-clear semantics.
- Finalization uses the existing game-start contract and prevents duplicate starts during library resolution. Pass the same finalized draft through the existing Avatar flow when needed.
- Keep Quick Start's bypass and authored-default behavior, and keep save loading separate. Removing or redefining Quick Start was discussed but not decided.

### Navigation and presentation

- Use the accepted layout and app typography/color tokens, with compact active rows consistent with the prompt editor. No large navigation tiles, nested tab bars, breadcrumbs, or second group browser.
- Desktop has a comfortably sized navigation column and wide scrolling content. Use multiple trait-choice columns only when width supports them.
- Render nonempty branches in authored order at arbitrary depth. Indentation must not consume all label width or impose a semantic depth limit. No trait branch has a chevron or collapse interaction.
- A group with direct traits opens those traits even when it also has children. A group with only descendants is noninteractive text. General exists only for actual ungrouped traits; branches without choices anywhere below them are hidden.
- Counts cover direct selected/available traits and display bare numbers such as 1/3. No visible Selected or Folder labels. Retain an accessible ratio explanation. Container-only labels have no count; counts update immediately.
- Phone Categories retains its single disclosure chevron and current-category label. Its inline list has bounded scrolling; choosing a destination collapses it. Keep the contrasting background and bottom border, without shadow. Animate expansion/collapse for 150 ms; honor reduced motion and exclude collapsed content from focus/accessibility navigation.
- Keep a compact world-name header, Introduction action, and Cancel. Introduction may use an accessible icon on phones. The primary action stays reachable above safe-area insets and outside content scrolling. No prototype controls ship.
- Preserve authored group descriptions, trait descriptions, stat-effect previews, and trait order. Parent-group descriptions must remain accessible even when their group is a noninteractive label; the prototype's omission is not permission to discard authored guidance.
- Exclusive groups use independent radio groups. Selecting a different trait replaces the applicable selection through existing trait rules; activating the selected radio again clears it. Indicator and row each activate exactly once. Nonexclusive traits remain checkboxes. There is no Clear choice button.

### Remembered library additions

- Persist personal preferences by stable local world identity, separately from authored content, using existing local persistence conventions. No server API or world-export schema change is required.
- Store entity references, library dictionary references, world dictionary enablement overrides, and dictionary order. Qualify references by source so matching world/library IDs cannot collide. Store preferences rather than duplicated library payloads.
- Distinguish absent preferences from explicitly saved none. First use leaves library items off and honors authored world-dictionary defaults. Saving none stays none when the library grows.
- Ordinary edits affect the draft only. **Use these additions for future games** explicitly saves selections, enablement, and order, including empty selections. Starting does not implicitly save defaults. Cancel discards unsaved edits but does not undo a completed explicit defaults save.
- Reconcile preferences with current IDs on entry. New library items remain off. Missing items cannot crash entry or resolve to unrelated records. New authored dictionaries follow authored defaults unless configured. Retain surviving reference order; renames do not lose associations.
- Personal selections are separate from published dependencies, add-on compatibility, and source synchronization in the linked-world-content effort. Remembering an item does not declare it required by the world.
- Present **Entities**, **Library dictionaries**, and **Included with this world**, with recognizable artwork, names, available descriptions, and missing-art fallbacks. Use Entities in production; the prototype's Characters copy is narrower than the supported content.
- Search does not clear selections or reorder items. Filtered-out selections still belong to the finalized draft.
- Preserve existing enable/disable and reordering of world and library dictionaries together. Default order is world dictionaries then library dictionaries; the prototype's library-only Move up control is not a new restriction. Support phone touch and keyboard ordering as well as desktop.
- Finalize selected library content through existing independent-copy behavior: fresh entity IDs, fresh library dictionary/entry IDs, stable authored dictionary IDs. Entities join the starting location through the existing entry path. Existing saves retain their content.
- Preserve skipped customization versus explicitly empty finalized dictionaries: turning everything off must not restore authored books through a fallback. Missing library records remain safely skippable under the existing finalization contract.
- Confirm saving only after persistence succeeds. Keep the editable draft available on save/resolution failure and preserve source records.

### Introduction and Avatar

- Reuse the full markdown Introduction modal, rich formatting, and placeholder resolution. Open it automatically before choices when nonempty and enabled, including zero-trait worlds. It remains an overlay, not a blurb or category.
- Preserve the shared per-world readme flag and Show Readme on entry control. Explicit reopening from setup does not silently change that flag. Gameplay readme timing and save-load behavior remain unchanged.
- Avatar customization itself stays unchanged. Adapt only entry/return wiring. The primary action reads Continue to Avatar when required, otherwise Start game.

## Testing Decisions

These boundaries were confirmed by the user during spec creation. Test observable behavior at the highest existing boundary that proves each contract, not prototype state variables or CSS internals.

- **Primary boundary:** real MainMenu entry and game-start output. Extend its existing harness with real app providers and in-memory IndexedDB. Enter through normal UI, configure, revisit categories, reopen Introduction, and assert the final payload or Avatar handoff. Keep orchestration real; isolate external network/rendering dependencies only as necessary.
- **Focused existing boundaries:** selection finalization, local preference persistence, entry sequencing, readme visibility, starting-location resolution, and Placeholder Session. Prior art includes dictionary-selection finalizer, persistent-state codec, trait-picker, readme, and Placeholder Session tests. Add a narrow preference adapter only if production needs it; no broad new engine seam.
- **Draft/traits:** deep nesting, mixed direct traits and children, empty General/branches, direct counts, exclusive replacement and click-again clearing, nonexclusive selections, row/indicator activation without double toggles, defaults, authored ordering, descriptions, and retention across category/Avatar navigation.
- **Persistence/isolation:** different defaults in two worlds; explicit none; restart/reopen; one-game overrides; explicit saving followed by cancel; new/missing/renamed items; source-ID collisions; all dictionaries off; full reordering; save failures without false success; fresh runtime copies and unchanged source records/existing saves.
- **Existing contracts:** Introduction first and resolved, shared hide flag, absent Introduction, Quick Start/save-load bypass, gameplay readme unchanged, Avatar/no-Avatar paths, cancellation/re-entry, stable Rolls, and live trait/location/stat Pins including restoration after deselection.
- **Browser validation:** normal entry on desktop and phone portrait, including 360–390 px phones and a deep authored hierarchy. Check long text, art fallbacks, keyboard/touch, safe areas, reachable primary action, inline scrolling, selection-triggered collapse, hidden controls, both themes, and reduced motion. Use browser checks for layout/animation rather than brittle DOM geometry tests.
- Prove important guards fail when their behavior is reverted. Do not weaken fixtures or suppress real mechanics to get green results. Time every test run and report wall time; investigate lingering processes. Historical prototype checks do not prove production persistence or finalization.

## Out of Scope

- Avatar editor, gameplay UI, and world-authoring trait organization redesigns.
- Phone landscape and dedicated tablet optimization; desktop and phone portrait are priorities, tablets low priority.
- Quick Start redesign/removal and personal trait/location presets.
- Published dependencies, add-on review, library synchronization, cloud preference sync, and automatic relevance recommendations.
- Authored world/export format changes, exported personal library dependencies, and rewriting existing saves.
- Shipping prototype samples, controls, console dumps, or its development-only route as production UI.
- Release/version changes or implementation ticket decomposition in this spec-writing task.

## Further Notes

- Accepted visual primary source: `prototype/enter-world`, commit `16d6c0b9`. [Prototype record](prototype.md). The accepted result includes shadow removal; earlier screenshots are not authoritative where they conflict with this spec.
- The initial idea placed Library additions beside Play with a separate customization path. The unified workspace supersedes that placement but retains personal per-world defaults, explicit none, occasional overrides, and independent runtime copies.
- B won the first comparison, but its tabs and sidebar tiles were not final. Later decisions superseded the dropdown/drawer, collapsible branches, visible Selected/Folder labels, Clear choice action, and shadow.
- The prototype stores defaults in memory and simulates starting. Production must supply persistence, full dictionary ordering, stat effects, placeholder-aware text, and real Avatar/game entry through existing contracts.
- Related contracts: [Introduction and Gameplay readmes](../intro-readme/spec.md), [Placeholder Session lifecycle](../../designs/placeholder-session/design.md), and [linked world content](../linked-world-content/spec.md). This adds reopening Introduction during setup, not a gameplay reopen surface.
