# Rich lists and scrollbars review

Ticket [02](../../specs/design-system-additions/issues/02-list-references-and-scrollbars.md) adds production-backed World Editor and Save/Load references and publishes the shared scrollbar standard. This record separates verified reference behavior, functional-copy limits, and later alignment work.

## Production agreement

| Reference | Production source retained | Isolated behavior |
| --- | --- | --- |
| World Editor List | `SortableList` → `SortableRow` → `EditorRow`; 56px row floor, selection, metadata, grip, Duplicate, Delete | Rename, select, duplicate, delete, and reorder operate on mounted character/location fixtures. |
| Save and Load List | `SaveList`, extracted from `LoadGameDialog`; wrapped name, timestamp, game time, Auto tag, grip, load/select, export, delete, and complete disabled semantics | Save, load, export, delete, and reorder operate on mounted save fixtures and local status. |
| Both | `ScrollArea`; 10px vertical track, rounded `border` thumb, 11px viewport gutter, no arrow controls | Long fixtures overflow a 16rem pane; controls and status remain outside the viewport. |

The extraction changes no save data, save-file shape, persistence operation, or production ordering rule. `LoadGameDialog` supplies the same records and callbacks to `SaveList` that its former internal row composition received, and merges reordered manual saves back into their full list so a hidden autosave keeps its persisted slot.

## Density decision

Rich rows carry controls or metadata that help users identify and manage an item. They retain their content-led height and control columns. `CompactSelectionRow` is only for a simple choice with no sorting, edit actions, or secondary metadata. A compact chooser must not gain sorting, and a rich row must not lose useful controls to meet the compact floor.

On mobile, the World Editor sample stacks its selected-item editor below the bounded list. Save Name and Save stack above their bounded pane. Names and metadata remain complete; the fixtures are not shortened to avoid overflow.

## Scrollbar and list alignment inventory

### Shared vertical ScrollArea: already aligned

| Surface group | Examples | Status |
| --- | --- | --- |
| World Editor and Enter World panes | `WorldEditor`, `EnterWorldLibrary`, editor instruments | Shared vertical behavior; keep drag autoscroll, selection reveal, and the 11px gutter. |
| Settings and library panes | `SettingsModal`, `LibraryTileGrid`, `LocalModelModal`, `ThemePreviewDialog` | Shared vertical behavior; verify a definite flex height when changing ancestors. |
| Game and community panels | `GamePanels`, `TraitsTab`, `CommunityCreationsBrowser`, account lists | Shared vertical behavior; no migration needed in this ticket. |

### Native vertical scrollers: focused migration candidates

| Surface | Observed limitation | Follow-up action |
| --- | --- | --- |
| `LoadGameDialog` list host | Native `overflow-y-auto` can show OS arrow buttons; DnD requires the scrolling ancestor and a definite height. | Convert only with a browser regression for wheel, touch, keyboard focus reveal, and drag autoscroll. Reuse `SaveList`; do not nest scrollers. |
| Dialog bodies (`EventFormDialog`, `FeedbackDialog`, `FeedbackEditDialog`, `PolicyDialog`, `SentMessagesDialog`, `AgeGateDialog`) | Native full-dialog scrolling gives platform-dependent chrome and can move footer actions. | Review each dialog's header/footer ownership; migrate content panes individually where controls can remain outside. |
| Local content panes (`FontTuneDialog`, `ChangelogEntryDialog`, `RevealAnimationDemo`, `PodiumDialog`, `BackupRestoreDialog`) | Ordinary native vertical overflow differs visually from the shared list track. | Confirm each pane has a definite height, then replace the single scrolling owner where behavior is otherwise simple. |
| Small editor utilities (`PlaceholderSectionList`, `TriggersInstrument` preview) | Compact native panes can show arrow buttons and tight gutters. | Verify keyboard reveal and drag/drop targets before adopting the shared pane. |

### Specialized or multi-axis scrollers: preserve behavior first

| Surface | Observed limitation | Required decision or evidence |
| --- | --- | --- |
| `PromptField`, markdown/code editors, textareas, editable regions | Caret, selection, native editing, and horizontal overflow are coupled to the scrolling element. | Match supported native appearance without a nested vertical wrapper; test selection, IME, keyboard reveal, and horizontal scroll. |
| `WorldDetails` responsive columns | One native pane on mobile becomes two independent native columns on desktop. | Design and test a breakpoint-aware owner before migration. |
| Popover lists (`command`, `multi-select`, `SuggestionList`, `ChipTypeahead`, `DrillPicker`) | Dialog scroll lock can intercept wheel input; some lists own active-descendant focus. | Verify overlay-in-overlay wheel, touch, and keyboard behavior before changing the scroller. |
| Horizontal toolbars, tables, and code blocks | The shared ScrollArea viewport currently assumes vertical block content. | Retain existing horizontal scrolling or add an explicit multi-axis design; do not reuse the vertical-only wrapper blindly. |
| Spatial/model canvases | Wheel input controls pan or zoom rather than document scrolling. | Keep canvas ownership; scrollbar alignment is not applicable. |

## Functional-copy review

Reviewed scope: new visible and accessible strings in `RichListReferences.tsx` and `SaveList.tsx`. Production tooltips `Drag to reorder`, `Export save`, and `Delete save` are reused. Character, location, and save names are authored fixtures and remain outside the functional-copy policy.

| String family | Role and behavior evidence | Verdict |
| --- | --- | --- |
| World Editor List; Save and Load List; Selected Name; Save Name; Save | Headings, labels, and action identifiers name their visible controls. | Terminology/formatting reviewed; standalone label-fragment grammar remains unverified. |
| Rich rows keep sorting, metadata, selection, and item actions. | Reference description matches the rendered World Editor row composition. | Reviewed against visible behavior; full vocabulary admission remains unverified. |
| Save rows keep timestamps, game time, ordering, and row actions. | Reference description matches the rendered save row composition. | Reviewed against visible behavior; full vocabulary admission remains unverified. |
| Editing a {character/location} sample.; Select an item. | Dynamic status describes current local selection only. | Behavior reviewed; fixture type substitutions remain bounded to the two rendered nouns. |
| Select a save to load it.; Saved/Loaded/Prepared/Deleted “{save name}”. | Instruction and completion statuses change only after their local callbacks run. | Behavior reviewed; technical verb meanings and authored substitutions remain unverified. |
| Load/Select/Export/Delete save “{save name}” | Accessible action identifiers distinguish the target row and retain the authored name verbatim. | Target identity reviewed; standalone-label grammar, Delete terminology, and complete technical-term admission remain unverified. |

Source review route: [Writing Guide](../../../docs/Writing-Guide.md), based on ASD-STE100 Issue 9. Sections 1–6, 8, and 9 apply; section 7 is not applicable because the references contain no safety procedure. Reused production copy is not certified by its appearance in the showcase.

**Verdict: reviewed against listed evidence with unresolved limits; not full STE compliance.** Standalone labels, technical verbs, dynamic authored substitutions, and existing production strings retain the guide's explicit unresolved boundary.

## Verification evidence

| Check | Observed evidence |
| --- | --- |
| Local behavior | Vitest exercises editor selection/rename/duplicate/delete and save/load/export/delete without storage writes. Production tests separately verify keyboard row selection, metadata, per-row callbacks, keyboard-safe disabled behavior, and filtered ordering that preserves a hidden autosave. |
| Targeted coverage | Five focused suites pass 35 tests in 12.15s with 97.98% aggregate statement/line coverage. `RichListReferences.tsx` and `saveOrdering.ts` have 100% statement/function/line coverage; `EditorRow.tsx` has 98.34% statement/line coverage; `SaveList.tsx` has 94.28%; and the showcase has 99.41%. |
| Regression sensitivity | Replacing the filtered-order merge with the visible subset made the hidden-autosave guard fail in 2.44s; restoring the merge returned the suite to green. An earlier export-result mutation likewise failed on the expected local status. |
| Desktop and mobile layout | Playwright passed the 1280×860 desktop and touch-enabled 375×812 profiles. Cards share a row only on desktop, stack on mobile, and produce no page-level horizontal overflow. |
| Scroll input and focus reveal | Real wheel input scrolls each independent pane. A Chromium touch sequence scrolls the mobile editor pane. Tab and Shift+Tab traverse visible focus rings on the editor grip and selection control, then Tab navigation through every save row reveals the final off-screen action inside its viewport. |
| Sorting and actions | Pointer drag changes save order. Rename, duplicate, delete, Save, Load, and Export produce the expected local result; blank Save Name disables Save. |
| Scrollbar structure | Each pane has one shared viewport and one vertical scrollbar. Computed values are a 10px track, 11px right gutter, 9999px rounded thumb, and zero button descendants. |
| Long content | The long autosave row stays within its client width, keeps complete accessible names and metadata, and does not force horizontal page overflow. |
| Theme, palette, font, and enlarged text | Light and dark modes passed with the Forest palette, Atkinson Hyperlegible, and a 20px root font on both viewport profiles. Selected rows and scrollbar thumbs remain distinguishable from their card surface. |

The complete rich-list browser matrix passed 8 tests in 30.79s. Static screenshots and DOM measurements support the interaction evidence; they are not treated as proof on their own.
