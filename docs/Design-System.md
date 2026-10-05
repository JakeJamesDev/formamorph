# Formamorph Design System

This guide and the live showcase are the visual authority for Formamorph. They document approved patterns; they do not authorize an app-wide redesign.

> **Open the live reference:** run the development app, then open `#dev?modal=designSystem` or call `window.__fmDev.goto(undefined, { modal: 'designSystem' })`.

The showcase uses production components and local demonstration state. It does not save preferences or call an endpoint, and its lazy route is excluded from production builds.

## Visual foundations

Use semantic values from the app. Do not sample colors from screenshots; HDR and display processing can change them.

| Foundation | Approved source | Use |
| --- | --- | --- |
| Color | [`src/index.css`](../src/index.css) | Use `background`, `foreground`, `card`, `muted`, `accent`, `border`, `input`, `ring`, and semantic status tokens. Palettes override every value except the semantic status tokens, which come from the base light and dark blocks and stay constant across palettes. |
| Typography | [`tailwind.config.js`](../tailwind.config.js) and [`typography.tsx`](../src/components/ui/typography.tsx) | Choose the role: `display`, `heading`, `title`, `body`, `label`, `helper`, or `meta`. Use `Hint`, `FieldError`, `SectionTitle`, and `Meta` for secondary text. |
| Font | [`src/index.css`](../src/index.css) defines `--app-font`, [`SettingsContext.tsx`](../src/contexts/SettingsContext.tsx) sets it, and [`tailwind.config.js`](../tailwind.config.js) puts it in the sans stack. The font registry stays in [`settingsDefaults.ts`](../src/contexts/settingsDefaults.ts). | Inherit `--app-font`. Production font choices and per-font tuning remain authoritative. |
| Borders and radius | [`src/index.css`](../src/index.css) | Use `border`, `input`, and `--radius`; use `h-hairline` or `w-hairline` for dividers. |
| Spacing | Production component classes | Compose the existing 4-unit rhythm: 1rem between rows and 1.5rem between sections in settings surfaces. |
| Focus | Production controls in [`src/components/ui`](../src/components/ui) | Keep the shared two-pixel inset `ring` treatment. Do not replace it with a palette-specific outline. |

Cards use `card` rather than inventing a second panel color. Destructive, success, warning, and information states keep their semantic colors across palettes.

## Pattern: Aligned Settings Stack

**Purpose:** Make a mixed settings form easy to scan while giving controls most of the horizontal space.

**Density:** Comfortable. Sections have 1.5rem between them; rows within a section have 1rem. Controls keep their production heights and typography roles.

### Composition

- Group related rows with a small uppercase section title and a hairline divider.
- At `sm` and wider, use a 1:3 label/control grid. Right-align labels and keep controls left-aligned.
- Below `sm`, stack the label above the control and left-align both.
- Put a short description below its control or beside a checkbox. Keep necessary detail behind the information control.
- Use several suitable widget types. Do not convert every setting into the same control for visual uniformity.
- Use the responsive option switcher for mutually exclusive choices: segmented options at `sm` and wider, a select below `sm`.
- Keep long values inside the control column. Select triggers truncate instead of widening the row.

### Production mapping

| Need | Component |
| --- | --- |
| Section heading and divider | `Section` in [`SettingsRows.tsx`](../src/components/SettingsRows.tsx) |
| Label/control alignment | `Row` and `RowLabel` in [`SettingsRows.tsx`](../src/components/SettingsRows.tsx) |
| Checkbox plus description | `CheckRow` in [`SettingsRows.tsx`](../src/components/SettingsRows.tsx) |
| Segmented desktop / select mobile | `OptionSwitcher` in [`SettingsRows.tsx`](../src/components/SettingsRows.tsx) |
| Slider plus current value | `ValueSlider` in [`SettingsRows.tsx`](../src/components/SettingsRows.tsx) |
| Optional detail | `HintInfo` in [`SettingsRows.tsx`](../src/components/SettingsRows.tsx) |
| Inputs and choices | `Input`, `Checkbox`, `Slider`, `Select`, and `ToggleGroup` in [`src/components/ui`](../src/components/ui) |
| Display tab body | `DisplaySettingsSection` in [`DisplaySettingsSection.tsx`](../src/components/modals/DisplaySettingsSection.tsx) |
| Output tab body | `OutputSettingsSection` in [`OutputSettingsSection.tsx`](../src/components/modals/OutputSettingsSection.tsx) |
| What a section reads and writes | `SettingsSource` in [`settingsSource.ts`](../src/components/modals/settingsSource.ts) |
| Simple/Advanced switch | `SettingsModeSwitch` in [`SettingsModeSwitch.tsx`](../src/components/modals/SettingsModeSwitch.tsx) |

### State reference

| State | Treatment |
| --- | --- |
| Default | Show a valid initial value with the normal border and text roles. |
| Selected | Use the production selected fill, foreground, and shadow. Do not add a second selection mark unless the control already has one. |
| Disabled | Keep the value readable, reduce opacity, and explain why it is unavailable when the reason is not evident. |
| Focus | Use the shared visible focus ring. Keyboard focus must not rely on hover. |
| Validation | Set `aria-invalid`, connect the message with `aria-describedby`, and use `FieldError`. |
| Overflow | Constrain the control column and preserve the full value through its menu, title, or detail view. |

The live Settings reference renders the production Display and Output sections and the Simple/Advanced switch. A local source built from the settings defaults backs them, so a change writes no settings and no theme. Where Settings would save a theme or load the embedding model, the reference writes a status line. The Live Sample shows the reference theme, palette, and font in its own block. The Control States card shows all six states.
Open `#dev?modal=designSystem&tab=settings`.

### Writing review

- Section, row, hint, and switch copy comes from the production components, so the reference and Settings cannot drift. Reuse does not certify that copy as fully ASD-STE100 compliant.
- **Unverified:** the card descriptions, the Live Sample description, and the three status lines have terminology review only; vocabulary and grammar evidence is not recorded.

## Pattern: Focused Markdown Authoring

**Purpose:** Keep long-form source editing dense while making the rendered result one clear switch away.

**Density:** Compact controls, comfortable content. Toolbar buttons use the production 1.75rem control height and one-unit gaps; the editor uses the `label` text role (0.875rem, 1.25rem line height) with 0.75rem horizontal and 0.5rem vertical surface padding, plus a substantial scrollable work area.

### Composition

- Put the field label above the toolbar so the complete toolbar can use the control row.
- Keep common inline actions visible: bold, italic, strikethrough, inline code, and blockquote.
- Group highlight, heading, list, and insertion choices as split buttons. The face runs the current action; the chevron opens the group.
- Keep each split button visually joined, including its internal divider. Put the formatting group at the left and history at the row end; one hairline separates history from the view controls.
- Put Edit and Preview in one two-option selector. The selected view uses the shared active-tab treatment.
- Use realistic content that includes headings, links, emphasis, lists, tasks, quotes, tables, and code. Keep the editing area bounded so long prose demonstrates vertical overflow.
- Keep demonstration text in local component state. A reference editor must not save authored data or call an endpoint.

### Production mapping

| Need | Component |
| --- | --- |
| Editor, toolbar, history, fullscreen, and views | `PromptField` with `markdown` in [`PromptField.tsx`](../src/components/prompt/PromptField.tsx) |
| Markdown operations and selected-text ranges | [`markdownToolbar.ts`](../src/lib/markdownToolbar.ts) and [`promptFieldState.ts`](../src/components/prompt/promptFieldState.ts) |
| Rendered output | `MarkdownRenderer` in [`MarkdownRenderer.tsx`](../src/components/game/MarkdownRenderer.tsx) |
| Split-button dropdown | `Popover` in [`src/components/ui`](../src/components/ui) |
| Edit/Preview selector | `Tabs` in [`src/components/ui`](../src/components/ui) |
| Tooltips and focus names | `Tip` in [`tooltip.tsx`](../src/components/ui/tooltip.tsx) |

### Split-button behavior

The face starts with the first action in its group. Choosing a dropdown item applies it and makes it the face's current action for the rest of that mounted editor session. Toolbar presses retain editor focus and selection, so formatting applies to the selected text and leaves the transformed range selected.

### Responsive behavior

At desktop widths, the toolbar stays compact and wraps only when its container requires it. A sufficiently wide full-screen editor can place Edit and Preview side by side. At mobile widths, controls wrap without horizontal page overflow; tapping the inline editing surface opens the production full-screen editor, where Edit and Preview become swipeable panes with position dots.

### State reference

| State | Treatment |
| --- | --- |
| Selected | Edit or Preview uses the shared active-tab fill and foreground. Text selection remains visible while a toolbar action runs. |
| Disabled | Formatting and history controls disable in Preview; undo and redo also disable when their stacks are empty. |
| Focus | Toolbar controls and tabs use the shared focus ring; the editable surface keeps its native caret and selection. |
| Overflow | The editor and preview scroll inside their bounded surface. Tables keep their own overflow behavior rather than widening the page. |

The live Markdown reference reuses the complete production editor. It demonstrates the compact groups, separators, split-button current actions, long-content overflow, local editing, and rendered preview without a showcase-only toolbar.

### Conditional prompt text

In prompt editors, a chip's prepend and append text appears inline with its exact spaces and line breaks. Show a highlighted `↵` only on otherwise empty affix lines, without adding it to the stored text. Highlight that text with the chip's color using `TINT_MARK_CLASS` and `tintMarkStyle` from [`previewTint.ts`](../src/lib/previewTint.ts), the same translucent treatment used in Preview. Preserve the surrounding text color. Do not add a section label or side rule.

The highlight and pill belong to one token. Selecting either opens the chip's options; editing Prepend or Append keeps focus in that input. Removing or dragging the chip includes its affixes. Spaces retain their spacing without a colored mark; newline markers use the affix highlight. The highlight's tooltip identifies the empty-value condition, and the options explain it on mobile. Read-only presets show the same text with disabled options.

Every prompt-variable chip offers a single-line **Header** above any Prepend/Append controls. Use the selected Format for a level-two Markdown heading, an uppercase Simple label, or paired XML tags. Keep raw Header text in the placement. Show generated boundaries with the same conditional highlight and chip options; move, copy, or remove the whole placement together.

Chips without body formatting show **Format** only while Header contains nonblank text. The first Header uses Simple, independent of the preset's style. Format changes the heading and wrappers while preserving the body. Clearing Header hides Format and remembers its selection through editing and sharing. Placeholder Chips keep their existing controls.

Consecutive headed chips share one authored line break. Automatic header spacing stays attached to its chip in Edit, with a `↵` marker on otherwise empty lines, and supplies section spacing in Preview and the AI request. Header, Prepend, Append, and XML closing tags remain visible in Edit. Removing a chip from a sequence removes its empty line. A Header adds one blank line between rendered sections; a chip without a Header adds no section spacing. Blank values and the exact `N/A` sentinel omit the whole headed section. Content and affix whitespace remain authored text.

Persona, Location and Entities use plain text for Name, including in Preview. Disable Format for Name only when Header is blank, through the shared read-only axis pattern. Clearing Header retains Format and affixes.

Open `#dev?modal=designSystem&tab=prompt-chips` for the production-backed [Prompt Chips reference](../src/components/design-system/PromptChipsReference.tsx). Its local sample covers Header, present and absent Persona values, and read-only editing without saving settings or calling a model.

### Built-in Placeholder chips

Built-in Placeholders (**Player Name**, **Character Name**) keep the chip shape and accent. Each carries a leading `Sparkles` icon from [`BuiltinMark`](../src/components/prompt/BuiltinMark.tsx) in the palette, the `{` menu, and the field.

A blueprint chip keeps the chip shape and its placeholder's accent. It carries a leading `Link2` icon from [`BlueprintMark`](../src/components/prompt/BlueprintMark.tsx) in the same three places, because it reads each bearer's own copy. The showcase's **Blueprint Chips** card shows it.

- The palette and the `{` menu list them first, under a quiet **Built-in** heading.
- A placed Built-in chip opens no pop-out. Its tooltip says what it becomes.
- A palette chip that the focused field refuses stays in place, dimmed, so the strip doesn't reflow.

Preview reads each Built-in chip by one rule:

| Chip | Preview shows |
| --- | --- |
| **Character Name** | The owning entity's name |
| **Character Name**, blank owner name or no owner | Its label |
| **Player Name** | Its label |

The Prompt Chips reference's placeholder palette sits over a sample entity, Oren, so it lists both Built-in chips. Its Entity Description field belongs to Oren, and its Preview shows Character Name as Oren. Description and Notes are world text, so Character Name stays dimmed while one of them holds focus.

### Shared chip insertion and movement

Drag a palette chip into an editable field to create one placement at the drop caret. Drag a placed chip within its field to move it, including its conditional text. Click insertion remains available at the remembered caret. Undo and Redo restore each committed operation.

| Palette | Eligible fields |
| --- | --- |
| World Editor Placeholders | Registered placeholder fields in the current panel, including unfocused and empty fields |
| Prompt toolbar | Its own prompt field and its offered prompt variables |

Both use the same drag image, insertion indicator, drop handling, and cleanup. Cancellation and unsupported drops preserve the document. Read-only fields and Preview reject edits; placed chips do not move between fields or token families.

The Prompt Chips reference includes production prompt and placeholder editors with local state. Use its empty Notes field to check palette targeting, and its Read-Only control to check protected states. Shared behavior lives in [the drag source](../src/components/prompt/chipDragSource.ts), [field registration](../src/components/prompt/ChipInsertTarget.tsx), and [drop handling](../src/components/prompt/ChipDrag.tsx). Both real screens run [the same browser contract](../e2e/chipInteraction.ts).

### Writing review

- The Built-in Placeholder chips Preview rule and the reference note use short active sentences and the guide's terms: entity, owner, label, Preview.
- “Entity Description” is a field label in title case. “Oren” and “Oren keeps the lamp lit.” are sample content and keep their own voice.
- **Unverified:** the rest of this pattern's copy predates this review and has terminology review only.

## Pattern: Image-Led Community Creation Cards

**Purpose:** Let readers scan community creations through their artwork while keeping the name, author, summary, social proof, and secondary actions easy to find.

**Density:** Compact. Artwork dominates the first impression; the details beneath it fit a description, one three-part count row, and up to two rows of tags before an overflow disclosure.

### Composition

- Keep the creation title and author on its thumbnail over the shared title scrim. A long title expands to three lines on hover and keeps its full value in a tooltip when clipped.
- Put a concise description below the art, then align likes, downloads, and comments across one row.
- Put tags after counts. Show two rows in the resting card and disclose the remainder on hover rather than making every card taller.
- Keep the contextual download control in the art’s top-right corner. Other secondary actions remain in their established contextual placements.
- Give entities and Avatars the split layout. Their art is tall, so it sits at 2:3 on the left and the text sits on the right. The title and author move to the top of the art, and the art’s actions move to its bottom-right corner. A split card is about twice as wide, so the Entity and Avatar grids show three per row on wide screens, two on medium screens and one on phones.
- Give an entity or Avatar with no image its Morph art (`EntityPlaceholderArt`): its first letter in goo, in a hue picked from its id. Never a gray box or an icon.
- Give an entity or Avatar listing that the server flags as a stand-in its Morph art too. The card never fetches or shows the stored file.
- Use controlled callbacks in the showcase. The reference never opens a listing, publishes, downloads, deletes, or changes a like outside its local state.

### Production mapping

| Need | Component |
| --- | --- |
| Frame, artwork, title scrim, author, and description | `WorldCardShell` in [`WorldCardShell.tsx`](../src/components/WorldCardShell.tsx) |
| Stacked or split layout per art aspect | `cardLayoutFor` in [`thumbAspect.ts`](../src/lib/thumbAspect.ts) |
| The same card in the library's detailed view | `WorldCardFace` in [`WorldCardFace.tsx`](../src/components/WorldCardFace.tsx) and `LibraryGroupTile` in [`LibraryGroupTile.tsx`](../src/components/library/LibraryGroupTile.tsx) |
| Art for an entity with no image or a flagged stand-in | `EntityPlaceholderArt` in [`EntityPlaceholderArt.tsx`](../src/components/EntityPlaceholderArt.tsx) |
| Community counts, tags, and contextual actions | `RemoteWorldCard` in [`RemoteWorldCard.tsx`](../src/components/community/RemoteWorldCard.tsx) |
| Favorite selection and pending state | `LikeButton` in [`LikeButton.tsx`](../src/components/community/LikeButton.tsx) |
| Tag density and overflow | `CardTags` in [`WorldDetails.tsx`](../src/components/WorldDetails.tsx) |

### Responsive behavior

At desktop widths, cards form a two-column reference grid. At narrower widths they stack at one column while preserving the image-first order, count row, wrapping tags, and minimum touch targets. Title expansion and image actions retain keyboard access; a focused image action becomes visible with the shared focus ring even without hover.

### State reference

| State | Treatment |
| --- | --- |
| Selected | A liked creation uses the production filled heart and pressed state. Selecting a card reports the local selected listing. |
| Disabled | A pending favorite callback disables the production heart until the local callback completes. |
| Focus | Thumbnail actions reveal on keyboard focus and use the shared ring. |
| Overflow | Titles clamp in the resting card and expand up to three lines on hover; a tooltip preserves clipped titles. Long author names truncate inside the art. Tags disclose after two rows. |
| Loading | The Entity and Avatar grids load with split-card skeletons, so it keeps its shape when the listings arrive. |
| Action | The update action and favorite callback report local outcomes only. |
| Hidden count | A contest entry's count shows as a dash until staff announce the winners. The heart stays pressable, and a tooltip says when the likes will show. |
| Private count | The author and staff see the number, with a tooltip that says only they see it. |

The live Community cards reference uses the production card and shell with neutral, controlled fixtures. It covers long titles, descriptions, tags, counts, selected likes, pending actions, keyboard focus, and update affordances without touching community data. The Like Counts row shows a public, a private, and a hidden count, and a hidden count that stays pressable. One Avatar card shows the split layout. Another Avatar card is a flagged stand-in and shows Morph art. Two entity cards show Morph art: one has no image, and one is a flagged stand-in with a stored thumbnail.

### Writing review

- The flagged stand-in line in Composition and the reference description use short active sentences and the guide's terms: entity, Morph art, stand-in.
- The stand-in fixture's name, description, and tags are sample content and keep their own voice.
- **Unverified:** the rest of this section's copy predates this review and has terminology review only.

## Pattern: Compact Find Utility Bar

**Purpose:** Search and replace across a structured editor without taking over the editing workspace.

**Density:** Compact. The floating bar keeps its search, options, counter, navigation, and close actions on one row. Replace expands beneath search without changing the surrounding editor layout.

### Composition

- Place the bar over the upper-left of a bounded editor workspace. Keep enough document context visible to show which field receives the current match.
- Join Match Case and Match Whole Word to the search input. Their pressed fills show option state without adding separate labels to the row.
- Keep Previous Match, Next Match, and Close Find as separate actions. Do not combine navigation into one split control.
- Put replacement in an expandable second row. Align its input with search and keep Replace and Replace All together at the row end.
- Show the match position and total beside navigation at desktop widths. Move the counter below the controls on narrow screens so the search input keeps useful width.
- Show the current tab, item, and field as a compact breadcrumb when room permits. The editor itself remains the visible source of truth for replacement results.
- Confirm Replace All before changing text. Keep the result notice factual and based on the completed action.

### Production mapping

| Need | Component |
| --- | --- |
| Search, options, navigation, replacement, and confirmation | `EditorFindBar` in [`EditorFindBar.tsx`](../src/components/editor/EditorFindBar.tsx) |
| Search targets, matching, text splices, and grouped writes | [`worldSearch.ts`](../src/lib/worldSearch.ts) |
| Field and Chip reveal in the authored editor | [`editorFieldFocus.ts`](../src/lib/editorFieldFocus.ts) |
| Production host and keyboard shortcuts | `WorldEditor` in [`WorldEditor.tsx`](../src/views/WorldEditor.tsx) |
| Isolated interactive reference | `FindBarReference` in [`FindBarReference.tsx`](../src/components/design-system/FindBarReference.tsx) |

### Keyboard and focus behavior

The production editor opens Find with Ctrl+F and Find and Replace with Ctrl+H. The search input receives focus when the bar opens. Enter moves to the next match, Shift+Enter moves to the previous match, and Escape closes the bar. Expanding Replace and selecting navigation actions leave focus on the action that ran. A host must return focus to a stable opener when the bar closes; the live reference demonstrates that behavior.

### Responsive behavior

At desktop widths, the bar shows the counter and current-field breadcrumb in the floating surface. At mobile widths, it uses the same controls and grouping, moves the counter beneath the main row, hides the breadcrumb, and stays inside the editor width. The editor context stacks its section list above the local fields without horizontal page overflow. Long queries and document values remain constrained by their inputs.

### State reference

| State | Treatment |
| --- | --- |
| Empty | Navigation and replacement actions are disabled; no field is selected. |
| Matches | The counter reports the current result and total; the sample marks the field that contains it. |
| No matches | The counter uses the destructive text color and navigation remains disabled. |
| Options | Match Case and Match Whole Word use their production pressed states and immediately restart navigation at the first result. |
| Boundary | Previous from the first match wraps to the last; Next from the last wraps to the first. |
| Replace | The disclosure adds the joined replacement row; Replace changes one result and Replace All requires confirmation. |
| Focus | Search receives opening focus; disclosure and navigation retain action focus; closing returns focus to the reference opener. |

The live Find reference uses the production bar and matching code against local component state. Search, navigation, option changes, and replacements update a realistic sample document without using authored-world storage or the clipboard.

### Writing review

The new description states the reference purpose. Action labels use the production Find and Replace terminology, and dynamic status text reports the selected field or the completed local action. Sample names and prose are authored content and keep their own voice. Accessible names receive the same role review as visible controls. Standalone label-fragment grammar remains unverified under the Writing Guide, and reuse here does not certify the existing production Find, replacement, confirmation, or notice copy as fully ASD-STE100 compliant.

## Pattern: Code Template Selection and Detail

**Purpose:** Help an author choose a stat Code Template, supply its parameters, inspect the generated code, and insert the result.

**Density:** Dense and task-focused. The dialog reserves one bounded window for a categorized library and a scrollable detail pane. Fields use the production control height and compact two-column grid where width permits; the generated code remains close to the parameters that change it.

### Composition

- Put Built-In and My Templates in a categorized sidebar at desktop widths. Use one template selector on mobile so the detail pane keeps useful width.
- Keep the selected template's name and explanation above its parameter form. Use the template declaration as the source of fields and defaults.
- Put required stat choices and numeric parameters in the same form. Pick a stat, trait, entity or placeholder with the [Breadcrumb Picker](#pattern-breadcrumb-picker). Keep a short fixed set, such as a daypart, in a Select. Show validation beside the affected field and connect it to the control's accessible description.
- Update the generated code preview as parameter values change. Keep the preview bounded and scrollable for long code.
- Freeze the footer below the scrolling panes. Keep Duplicate or Edit and Delete beside Insert Code according to template ownership.
- Disable Insert Code while any slot is missing or invalid. Ask for confirmation before replacing existing stat code.

### Production mapping

| Need | Component |
| --- | --- |
| Dialog shell, categorized library, detail pane, parameter form, and footer actions | `StatCodeTemplateDialog` in [`StatCodeTemplateDialog.tsx`](../src/components/modals/StatCodeTemplateDialog.tsx) |
| Slot parsing, defaults, validation, and generated code | [`statCodeTemplates.ts`](../src/lib/statCodeTemplates.ts) |
| Personal-template persistence and share packs | [`StatTemplateStorageService.ts`](../src/services/StatTemplateStorageService.ts) |
| Code editing and syntax preview | `CodeArea` and `HighlightedCode` in [`src/components/prompt`](../src/components/prompt/) |
| Production host and insertion target | `StatManager` in [`StatManager.tsx`](../src/managers/StatManager.tsx) |
| Isolated interactive reference | `CodeTemplatesReference` in [`CodeTemplatesReference.tsx`](../src/components/design-system/CodeTemplatesReference.tsx) |

### Responsive and overflow behavior

At desktop widths, the fixed-height dialog uses a 15rem library beside the detail pane. The panes scroll independently, so long template names, explanations, forms, and generated code do not move the footer. At mobile widths, the dialog fills the usable viewport, replaces the sidebar with a selector, stacks parameter fields, and keeps actions wrapping within the footer.

### State reference

| State | Treatment |
| --- | --- |
| Selected | The active desktop library item uses the shared accent fill; the mobile selector shows the same template. |
| Missing | An unanswered required stat shows `Required`, sets `aria-invalid`, and keeps insertion disabled. |
| Invalid | An unusable number shows `Must be a number`; the preview stays runnable while insertion remains disabled. |
| Valid | Completed values remove inline errors, update the preview, and enable Insert Code. |
| Focus | Dialog controls use the shared focus ring, and keyboard opening moves focus into the dialog. |
| Overflow | The library, detail pane, and generated code stay bounded and scroll rather than widening the dialog. |
| Action | Insert Code closes the dialog after writing generated code to the host callback. Personal-template and file actions use their supplied storage boundaries. |

The live Code Templates reference passes neutral sample stats and an in-memory personal-template repository to the production dialog. Insert Code updates a visible local sample target. Duplicate, edit, delete, import, and export remain available, but their reads, writes, and file transfers stay inside the mounted reference and never use the author's template database or files.

### Writing review

New reference instructions name the visible “Open Code Templates” action and local outcome messages report only completed demonstration changes. Code Template, stat, parameter, and generated code retain their product or technical meanings; sample stat names and template prose are authored demonstration content. Accessible labels keep validation in descriptions rather than changing field names. Standalone label-fragment grammar and complete technical-term admission remain unverified under the Writing Guide. Reuse does not certify the existing production dialog copy as fully ASD-STE100 compliant, and code tokens and stat sandbox semantics are unchanged.

## Pattern: Bounded Spatial Workspace

**Purpose:** Edit spatial relationships while keeping nested containment distinct from authored travel.

**Density:** Compact floating controls around a large, bounded work area. Group frames contain their children; labels and arrows share the remaining space rather than becoming a separate list.

### Composition and production mapping

| Need | Production source and treatment |
| --- | --- |
| Work area and fullscreen | [`LocationCanvas.tsx`](../src/managers/LocationCanvas.tsx): embedded view with zoom/fit controls; fullscreen adds the toolbar, search, and minimap. Drag, nesting, and the context menu's Auto Arrange work in the embedded view. |
| Nested Groups | [`locationCanvas.ts`](../src/lib/locationCanvas.ts): measured frames around child locations, including nested Groups. Containment is the frame itself, never a line. |
| Connection hierarchy | [`FloatingEdge.tsx`](../src/components/FloatingEdge.tsx) and [`canvasEdges.ts`](../src/lib/canvasEdges.ts): muted dashed arrows for implicit sibling travel; solid primary-colored arrows for authored Connections, one arrow per direction. An authored Connection replaces that pair's implicit navigation. |
| Floating tool groups | `CanvasToolbar` in the canvas: arrangement, alignment/distribution, grid/snap, Connection Style, then undo/redo, separated by hairlines. |
| Search and reveal | `LocationSearch`: names plus ancestry, keyboard result selection, and viewport reveal of deeply nested locations. |
| Zoom and orientation | [`CanvasControls.tsx`](../src/components/CanvasControls.tsx): zoom in, zoom out, and fit; the canvas supplies the fullscreen button. The fullscreen minimap also pans and navigates. |
| Manual arrangement and history | [`locationArrange.ts`](../src/lib/locationArrange.ts), [`locationAlign.ts`](../src/lib/locationAlign.ts), and [`canvasHistory.ts`](../src/lib/canvasHistory.ts): explicit edits, with a whole arrangement restored in one undo step. |
| Isolated reference | [`LocationsCanvasReference.tsx`](../src/components/design-system/LocationsCanvasReference.tsx): the production workspace with local locations, Connections, history, and preferences. |

Opening, zooming, or fitting the canvas never rewrites manual positions. Auto Arrange acts on the selected Group, or a selected child's Group; Auto Arrange All acts recursively when nothing is selected. Preserve these scopes and the existing drag/nesting and touch gestures. These are authoring commands, not background layout behavior.

### Responsive behavior and states

The reference keeps the embedded canvas inside a bounded editor panel. At desktop widths, fullscreen places search at the upper left, tool groups along the top, zoom controls at the lower left, and the minimap at the lower right. On phones, the toolbar scrolls horizontally and search moves beneath it. Use full screen and search/reveal when the whole-map overview makes names too small to read.

| State | Treatment |
| --- | --- |
| Selected | Nodes keep the production ring; selected authored arrows thicken and open the Connection inspector with that arrow's Travel Hint box focused. Each arrow of a pair takes clicks only on its own outer side. |
| Disabled | Undo/redo disable at empty history boundaries; alignment needs two locations and distribution needs three. |
| Focus | Search and toolbar controls retain shared focus styling and accessible names. |
| Overflow | Long node names truncate; search rows truncate too. Only the reference's selected-location output exposes the complete name. Long Connection labels clamp in the overview and expand on selection/hover; the inspector holds the full travel hint. |
| Local edits | Moving, arranging, and editing Connections use the real handlers. Fullscreen preserves local history; leaving the reference discards the sample session. |

The reference preserves production density and panel placement. Dense labels can overlap the graph, and the floating Connection inspector can cover other controls at narrow widths; close it to return to those controls. These are reference limitations to review, not patterns to copy into new surfaces without judgment. Theme, palette, font, reduced-motion handling, and touch behavior come from production. Detailed checks and writing limits live in the [review record](../docs-internal/designs/design-system/locations-canvas-review.md).

## Pattern: Grouped Context Actions

**Purpose:** Keep related actions close to the item they affect without crowding its resting surface.

**Rule:**

- Every row is one of two kinds. A row that answers "which one?" belongs to a titled set. A row that does something belongs to a flat action set.
- A title is the flyout handle. A titled set can fold into a flyout. The title becomes the flyout label.
- Action rows never fold. They carry an icon to stay apart from set rows.
- Separators divide kinds, not topics.
- Arranging sections, such as Tile Size and grouping, come first.
- The item's own actions form the final section. Check for Updates, Publish, and the default-persona action are item actions.
- Each item action carries an icon. Delete is last in the final section.
- A context-dependent action section sits where the fixed action section sits. It keeps its icons.

**Density:** Compact. Menu rows use the production label size and padding; section labels use the smaller meta role. The group shortcuts are bounded, so ordinary menus do not need scrolling.

### Composition

- Start with the reversible preference section. Tile Size uses one radio group and keeps the selected-size checkmark visible.
- Align destination text with the action-label column, without repeating folder icons. Keep full accessible names and truncate shortcuts on one line; the picker exposes their full text.
- Label the grouping section Add To Group. Show the first three eligible Groups in existing order, excluding the current Group before taking three.
- Follow shortcuts with FolderPlus + Create New Group… and FolderSearch + Add To Group…. The full chooser is last in this section. Keep explanations in the dialog or help.
- Separate meaning changes with semantic separators: preference, grouping, and the item's own actions.
- End with the item's own actions. Each tab offers only the actions that apply to its items.
- Put Delete last in that section. Keep its production trash icon and destructive color. Delete opens the existing confirmation.
- Keep Group names in their authored voice. Group tiles retain Open Group and Delete Group; assigned items retain Remove From Group in a separate section.

### Production mapping

| Need | Component |
| --- | --- |
| Full tile-triggered composition | `LibraryTileContextMenu` in [`LibraryTileContextMenu.tsx`](../src/components/library/LibraryTileContextMenu.tsx) |
| Main Menu host, Group membership, and tile preferences | `LibraryTileGrid` in [`LibraryTileGrid.tsx`](../src/components/library/LibraryTileGrid.tsx) and `useLibraryTiles` in [`useLibraryTiles.ts`](../src/lib/useLibraryTiles.ts) |
| Default-persona action and its card badge | `DefaultPersonaMenuItem` and `DefaultPersonaBadge` in [`DefaultPersona.tsx`](../src/components/library/DefaultPersona.tsx) |
| Menu primitives, checkmarks, focus, dismissal, and touch hold | [`context-menu.tsx`](../src/components/ui/context-menu.tsx) |
| Destructive confirmation and cancellation | `ConfirmDialog` in [`ConfirmDialog.tsx`](../src/components/ConfirmDialog.tsx), controlled by [`MainMenu.tsx`](../src/views/MainMenu.tsx) |
| Isolated reference | [`MainMenuContextMenuReference.tsx`](../src/components/design-system/MainMenuContextMenuReference.tsx) |
| Canvas menu, the pattern's second production instance | `canvasMenuSections` in [`canvasMenu.ts`](../src/lib/canvasMenu.ts) and `LocationCanvas` in [`LocationCanvas.tsx`](../src/managers/LocationCanvas.tsx). Right-click the canvas in the existing [`LocationsCanvasReference.tsx`](../src/components/design-system/LocationsCanvasReference.tsx). |

### Responsive behavior

On desktop, right-click a tile or focus it and use Shift+F10 or the Context Menu key. Arrow keys move through actions, Enter activates one, and Escape closes the menu and restores focus to the tile. A primary click outside dismisses the menu without activating what is underneath.

On a touch screen, press and hold the tile. Moving the held finger far enough to begin a drag closes the menu; tapping outside dismisses it. Radix positions the bounded menu inside viewport edges. At short heights, enlarged text, or zoom, the shared ScrollArea keeps every action reachable with the same arrowless scrollbar as the picker.

### State reference

| State | Treatment |
| --- | --- |
| Default | The menu is closed and the tile keeps the Main Menu entity card treatment. |
| Checked | The selected Tile Size row has `aria-checked="true"` and the production checkmark. |
| Disabled | No current action uses a disabled row. While a world tile loads, production omits Delete instead of presenting an unavailable destructive action. |
| Focus | Keyboard opening focuses the first action; arrow navigation uses the shared focus fill and text treatment. Closing with Escape restores focus to the trigger. |
| Overflow | Long Group names truncate without losing their accessible names. Group count cannot grow the menu beyond three shortcuts. Exceptional-height overflow uses ScrollArea. |
| Destructive | Delete is last in the item-action section and opens the existing confirmation. Cancel keeps the item; Confirm removes it. |

The live reference uses the production menu against the production entity card face. The sample is a persona entity, so its final section shows Check for Updates, the default-persona action, and Delete. Tile size, Group selection, Group creation, removal, update checks, the default persona, deletion, and restoration stay in mounted React state. The sample never reads or writes Main Menu preferences, library records, storage, account data, or authored worlds.

### Writing review

- **Unverified:** “Right-click the sample entity. On a touch screen, press and hold the sample entity. For keyboard access, focus the sample entity. Press Shift+F10 or the Context Menu key.” gives one action per sentence and names its target, but complete technical-term admission for “Right-click,” “touch screen,” “keyboard,” Shift+F10, and Context Menu is not recorded.
- **Unverified:** “Restore the local sample to continue.” states the next local step, and “Restore Sample” names its action. “Grouped library tile actions” is a compact selector phrase. Vocabulary and grammar evidence is not recorded.
- **Unverified:** status cases are “The tile size is small/medium/large.”, “The sample group is {Group name}.” or “The sample is not in a group.”, “Check for Updates has not run.” or “Check for Updates ran on the local sample.”, “The sample is/is not the default persona.”, and “The local sample is available/deleted.” Each is one statement in the present or past simple tense. Vocabulary and grammar evidence is not recorded; interpolated Group names are user-authored fixtures and retain their own voice.
- **Unverified:** the accessible label “Sample entity: Mara Venn” has terminology and formatting review only; standalone label-fragment grammar is outside the listed evidence. “Mara Venn” is a fixture name and keeps its own voice.

Tile Size, Add To Group, Create New Group, Remove From Group, Check for Updates, Set as Default Persona, Clear Default Persona, Default, Delete, Delete Character, Cancel, and Confirm reuse production copy so the reference and Main Menu cannot drift. The confirmation says “character” where the terminology rule says “entity”; the reference keeps it for parity. Reuse does not certify those labels or the confirmation as fully ASD-STE100 compliant. In particular, the existing Delete label remains unchanged for production parity; this ticket does not perform the app-wide terminology decision that would be required before replacing it.

## Pattern: Compact Selection Lists

**Purpose:** Choose one destination from a simple list without reserving room for absent controls.

Use [`CompactSelectionRow`](../src/components/ui/compact-selection-row.tsx) for simple choices. Its production values are the authority: 32px minimum height, 8px horizontal and 6px vertical padding, with no inter-row gap. Typography and wrapped names can increase row height. Do not add empty grip, icon, metadata, or action columns. Rich editor and save rows keep their useful controls and distinct density.

| State | Treatment |
| --- | --- |
| Default | Native button; full name wraps and long unbroken text remains inside the row. |
| Selected | Primary fill, contrasting text, pressed state, and an inline check. Only the selected row needs the check's space. |
| Focus | Shared inset ring; Tab reaches choices and Enter or Space activates them. |
| Disabled | Native disabled behavior and reduced opacity. |
| Empty | A concise status occupies the pane; actions remain available. |

On mobile, preserve the same text-first row and minimum height. Wrapping increases the touch area instead of clipping names. Sorting and secondary row actions belong to richer lists, not this pattern.

## Pattern: Searchable Group Picker

**Purpose:** Keep an unbounded destination list out of the quick-action menu.

[`LibraryGroupPicker`](../src/components/library/LibraryGroupPicker.tsx) composes the shared Dialog, Input, CompactSelectionRow, ScrollArea, and DialogFooter. It names the affected item, focuses Find a Group after menu teardown, and shows all Groups in their existing order. Search filters names without sorting. The current assignment has selected styling and a check; choosing it closes without an assignment write.

- Choosing another row moves the item by stable Group ID and closes the dialog. Existing duplicate names remain distinct destinations.
- Cancel, Close, and Escape leave the library unchanged and return focus to the opener. A grid that loses its original tile provides a focus fallback.
- Create New Group… opens the naming form from either entry point. Blank names and trimmed case-insensitive duplicates are rejected; corrections can be submitted with Create Group.
- Keep search and footer outside the bounded destination pane. The pane uses the shared 10px arrowless scrollbar and reserved gutter. At exceptionally short heights or enlarged text, the outer shared scroller also reveals dialog controls.
- Keep Cancel before Create in markup and together in the footer. The shared mobile footer stacks the affirmative action above Cancel; desktop places Cancel to its left.

### Production and verification mapping

| Need | Source |
| --- | --- |
| Menu and focus handoff | [`LibraryTileContextMenu.tsx`](../src/components/library/LibraryTileContextMenu.tsx) |
| Assignment and named creation | [`useLibraryTiles.ts`](../src/lib/useLibraryTiles.ts), [`operations.ts`](../src/lib/libraryOrganization/operations.ts) |
| Isolated live composition | [`MainMenuContextMenuReference.tsx`](../src/components/design-system/MainMenuContextMenuReference.tsx) |
| Behavior and storage round trip | [`LibraryGroupFlow.test.tsx`](../src/components/library/LibraryGroupFlow.test.tsx) |

Open `#dev?modal=designSystem&tab=context-menu&subtab=picker` or use `subtab=create` for the naming form. These routes use local demonstration state and production components. They do not change stored library data or ship a prototype route.

New functional labels and error/status sentences follow the [Writing Guide](Writing-Guide) by role. Authored names retain their voice. The [review record](../docs-internal/designs/design-system/group-picker-review.md) records behavior evidence and unresolved STE limits; brevity does not certify label grammar.

## Pattern: Breadcrumb Picker

**Purpose:** Pick one item from a list of world content, and show where each item lives.

**When to use it:** Lists of world content (stats, traits, entities, placeholders) use the Breadcrumb Picker. A short fixed option set, such as a daypart, keeps Select.

It differs from the Searchable Group Picker. That pattern is a Dialog for an unbounded destination list with create and rename. The Breadcrumb Picker is a popover form control.

### Composition

- **Trigger.** A field that looks like a Select trigger. It shows the picked name, or the slot's prompt such as "Pick a trait…". A caller can supply its own trigger, such as an outline button. That popover has a fixed width of 20rem.
- **Search.** The search field always shows. It matches a row's name and its full breadcrumb, with no sorting.
- **Rows.** Rows keep the order of the matching editor tab. A group is never a row. It shows only as a breadcrumb segment.
- **Hint.** A row can carry a right-aligned hint that is not a location. A hint never collapses and has no tooltip.
- **Caller page.** A caller can replace the list with its own page, such as Add Requirement's bearer page.
- **Check column.** A picker with a value reserves a check column. Every row that holds the value shows a check.

### Row layout and collapse

- The name comes first and keeps its width up to about 65% of the row. Past that it truncates.
- The breadcrumb sits right-aligned in meta text and truncates.
- One or two segments show in full. Three or more show as `First › … › Last`. The rule counts segments, never width.
- A hover tooltip on the row shows the full path. A row with no breadcrumb has no tooltip.
- A world row with no group shows `World`. A list with no groups, such as stats, shows no breadcrumb.

### States

| State | Treatment |
| --- | --- |
| Default | The trigger shows the prompt in muted text. Rows list their breadcrumbs. |
| Picked | The trigger shows the name. Each row that holds the value shows a check, so a name shared by two owners shows two checks. |
| Disabled | A disabled row stays visible, dimmed, and can't be picked. A disabled field doesn't open. |
| Empty | The list says "Nothing to pick". |
| No matches | The list says "No matches". |

### Keyboard and responsive behavior

Arrow keys move through rows, Enter picks the row, and Escape closes the picker with no change. A field trigger's popover matches the trigger width, with a minimum of 16rem, and stays inside the viewport. Long lists scroll inside the popover.

### Production mapping

| Need | Component |
| --- | --- |
| Trigger, popover, list, rows, collapse and tooltip | `BreadcrumbPicker` in [`breadcrumb-picker.tsx`](../src/components/ui/breadcrumb-picker.tsx) |
| Code Template slots | `StatCodeTemplateDialog` in [`StatCodeTemplateDialog.tsx`](../src/components/modals/StatCodeTemplateDialog.tsx) |
| Add Requirement (reference build) | [`TraitRequiresField.tsx`](../src/components/editor/TraitRequiresField.tsx) |
| Isolated reference | [`BreadcrumbPickerReference.tsx`](../src/components/design-system/BreadcrumbPickerReference.tsx) |

Open `#dev?modal=designSystem&tab=breadcrumb-picker`. The reference uses sample traits and local state. It never reads or writes a world.

### Writing review

Prompts such as "Pick a trait…" and the "Nothing to pick" and "No matches" lines are functional copy with no period. Sample names are authored content and keep their own voice. This review is local. It does not certify STE compliance.

## Pattern: Lists With Controls or Metadata

**Purpose:** Preserve the information and actions needed to identify, edit, order, and manage complex items.

**Density:** Content-led. Rich rows can use the World Editor's 56px floor, inter-row spacing, grip, metadata, selection, and actions. Save rows grow when names wrap and keep their timestamp, game time, reorder grip, and actions. Do not compress either family into the 32px compact-selection pattern.

### Choose the composition by purpose

| List purpose | Composition |
| --- | --- |
| Choose one simple destination | Use `CompactSelectionRow`. Do not reserve absent control columns or add sorting. |
| Edit or order authored items | Use `SortableList`, `SortableRow`, and `EditorRow`; preserve selection, metadata, duplicate/delete controls, and the detail editor. |
| Choose and manage saved progress | Use `SaveList`; preserve the save name, timestamp, game time, Auto state, ordering, load/select action, export, and delete. |

Keep controls that change the collection outside its scrolling pane when they must remain reachable. The live Save/Load reference keeps Save Name and Save above the list; the World Editor reference keeps the selected item's editor beside or below the list. Do not nest a second vertical scroller merely to imitate a scrollbar.

### Production mapping

| Need | Component |
| --- | --- |
| World Editor row, selection, metadata, and actions | [`EditorRow.tsx`](../src/components/EditorRow.tsx) |
| World Editor sorting and item actions | [`SortableList.tsx`](../src/components/SortableList.tsx) |
| Save metadata, ordering, selection, export, and delete | [`SaveList.tsx`](../src/components/modals/SaveList.tsx) and [`LoadGameDialog.tsx`](../src/components/modals/LoadGameDialog.tsx) |
| Bounded list viewport | [`scroll-area.tsx`](../src/components/ui/scroll-area.tsx) |
| Isolated interactive examples | [`RichListReferences.tsx`](../src/components/design-system/RichListReferences.tsx) |

### Responsive behavior

At desktop widths, an editor list can sit beside its detail controls, and the two reference families can share a two-column showcase row. At mobile widths, the references stack. The selected-item editor follows its list, while Save Name and Save stack above the save pane. Long authored names truncate only where a trailing editor control must remain visible; save names wrap because their metadata and actions identify a distinct saved state. Keep every action inside the card width and retain useful touch targets.

### State reference

| State | Treatment |
| --- | --- |
| Selected | Editor rows use the production primary fill and keep their controls legible. Editing changes the selected local item. |
| Disabled | Busy save rows and their export actions retain production disabled behavior; do not remove metadata to simplify the state. |
| Focus | Rows, grips, inputs, and icon actions keep visible shared focus. Keyboard selection reveals the active item in the bounded pane. |
| Long content | Editor names truncate before actions; save names wrap above their metadata. Accessible names preserve the complete authored value. |
| Overflow | Long collections scroll inside one bounded pane. Adjacent editors, Save Name, Save, and status remain reachable outside it. |
| Action | Editing, duplication, deletion, saving, loading, exporting, and sorting use controlled callbacks in the live reference. They change mounted sample state only. |

The Rich Lists reference uses the same production row components as World Editor and Save/Load. Its fixtures contain long names, realistic types, timestamps, game time, and an Autosave. It never reads or writes authored worlds, saved games, IndexedDB, local storage, files, or endpoints.

### Writing review

The reference descriptions, control labels, dynamic status, and accessible action names were reviewed by role through the [Writing Guide](Writing-Guide). Authored character, location, and save names retain their voices. Standalone label grammar, complete technical-term admission, reused production copy, and dynamic substitutions remain unverified; the [review record](../docs-internal/designs/design-system/rich-lists-scrollbars-review.md) records those limits.

## Standard: Scrollbars

Use [`ScrollArea`](../src/components/ui/scroll-area.tsx) for bounded vertical content when it preserves the surface's behavior. It is the shared World Editor appearance: a 10px vertical track, rounded theme-derived thumb, no up/down chevrons, and an 11px viewport gutter so the overlay thumb does not obscure content.

- Keep one vertical scrolling owner per pane. Preserve wheel, touch, keyboard, and focus-reveal behavior.
- Give the pane a definite height, a flex-resolved height, or a maximum height on the `ScrollArea` itself. The root is a flex column, so its viewport stops at that height. A maximum height on an ancestor works only through a flex column down to the `ScrollArea`, such as `flex-1 min-h-0` on it.
- Keep search, primary inputs, and footer actions outside the list viewport when they must remain reachable while the collection scrolls.
- Preserve horizontal scrolling where content requires it. The shared viewport assumes vertical content and forces its content wrapper to block layout; do not apply it blindly to code, tables, or other horizontal scrollers.
- Native text editors, editable regions, canvases, virtualizers, drag lists, and popover-hosted scrollers can have selection, autoscroll, wheel-lock, or focus contracts. Match the appearance only where supported, and do not wrap them in a nested ScrollArea to hide native chrome.
- Use `type="always"` when the scrollbar itself communicates that a bounded reference can scroll. Other production surfaces can retain the component's normal visibility behavior.
- Set `focusable` when the pane holds only text, such as a policy or a code view. Keyboard users can then tab to the pane and scroll it with the arrow keys.
- Put a fixed or absolute frame on a wrapper element. Radix sets the root's `position` inline, so a position class on `ScrollArea` has no effect.

The [scrollbar and list inventory](../docs-internal/designs/design-system/rich-lists-scrollbars-review.md) groups remaining native and specialized surfaces by limitation. It is follow-up scope, not authorization for an app-wide migration.

### Scroll guard

A test, [`scrollGuard.test.ts`](../src/lib/scrollGuard.test.ts), fails when a source file under `src` holds a native overflow scroller (`overflow-auto`, `overflow-y-auto`, `overflow-x-auto`, `overflow-scroll`, or the inline style). The file passes only when it carries one allow comment. Importing `ScrollArea` exempts nothing, so a file that mixes both needs the comment too. The check works per file, so one comment covers every native scroller in that file. Put the comment on its own line. The end of the file keeps it clear of other edits:

```ts
// scroll-guard: allow popover-list: popover-hosted; dialog scroll lock can intercept wheel input
```

The name after `allow` is one row of the table below. The text after the colon says why this file relies on it.

| Name | Exception |
| --- | --- |
| `native-editor` | Editors and editable regions bound to the scrolling element |
| `popover-list` | Lists hosted in a popover |
| `horizontal` | Toolbars, tables, and code blocks that scroll sideways |
| `canvas` | Canvases that own wheel input |
| `drag-list` | Drag lists and virtualizers that need the native scrolling ancestor |
| `responsive-columns` | One pane that becomes two independent columns |
| `migration-candidate` | New work only, never a backlog: a native pane that moves to `ScrollArea` once its behavior is checked |

Remove the comment when the file holds no native scroller.

## Pattern: Paired Footer Actions

**Purpose:** Make acceptance predictable by keeping a negative action before its affirmative partner.

**Density:** Compact. Keep the pair together in the footer action area; unrelated navigation or utility actions need their own justified grouping.

### Composition

- Order a pair as negative | affirmative: Cancel or decline on the left, then acceptance or continuation on the right.
- Keep the pair together. Do not place unrelated controls between the negative and affirmative actions.
- Treat placement and color as separate semantics. A destructive affirmative action keeps the destructive variant in the right-hand confirmation position.
- Preserve existing labels and operation semantics. This rule changes neither what an action does nor whether it requires confirmation.
- Put the negative action before the affirmative action in keyboard order. Do not use visual ordering to create a keyboard sequence that disagrees with the controls.

### Production mapping

| Need | Component |
| --- | --- |
| Ordinary dialog pair and responsive layout | `DialogFooter`, `DialogClose`, and `Button` in [`src/components/ui`](../src/components/ui/) |
| Destructive confirmation pair | `AlertDialogFooter`, `AlertDialogCancel`, and `AlertDialogAction` in [`alert-dialog.tsx`](../src/components/ui/alert-dialog.tsx) |
| Isolated acceptance and deletion examples | [`FooterActionOrderReference.tsx`](../src/components/design-system/FooterActionOrderReference.tsx) |
| Existing alignment follow-up and copy review | [Footer action order review](../docs-internal/designs/design-system/footer-action-order-review.md) |

### Responsive and keyboard behavior

At `sm` and wider, the shared footer renders the negative action on the left and the affirmative action on the right. Below `sm`, the shared reverse-column layout puts the affirmative action above the negative action. Keep negative-first DOM order so Tab reaches Cancel or decline before acceptance or continuation at every size. When a footer intentionally constrains available width, add reverse wrapping to that footer so long labels or enlarged text put the affirmative line above the negative line. Buttons keep their labels intact, and the footer must remain inside the dialog without horizontal page overflow.

Closing through Cancel, Escape, or the close control changes no data and returns focus to a valid opener. Confirmation changes only the operation named by the dialog. The live reference keeps both outcomes in mounted sample state and never writes authored worlds, saves, library data, or settings.

### State reference

| State | Treatment |
| --- | --- |
| Disabled | Keep acceptance disabled until its required input is valid. Cancellation remains available unless an operation cannot safely stop. |
| Focus | Both actions use the shared visible focus ring. Closing returns focus to the reference opener. |
| Canceled | Cancel and Escape close the dialog without changing the sample state. |
| Confirmed | The affirmative action closes the dialog and updates only its local sample state. |
| Destructive | Delete keeps the destructive fill and confirmation semantics in the affirmative position. |
| Overflow | The pair stacks before labels force horizontal page overflow; controls remain reachable with enlarged text. |

The live Footer Actions reference demonstrates Cancel | Create Group and Cancel | Delete with production dialogs and footer controls. A constrained example uses the established Download and Embed — Works Offline label to demonstrate wrapping. Create Group starts disabled, keyboard focus moves through the negative-first action order, and the destructive example preserves its semantic treatment.

### Writing review

The reference descriptions and local status messages were reviewed by copy role against the Writing Guide. Behavior claims were exercised against the isolated callbacks. Standalone label grammar, complete vocabulary admission, and reused production labels remain unverified; the [review record](../docs-internal/designs/design-system/footer-action-order-review.md) lists those limits. Reuse does not certify the production copy as fully ASD-STE100 compliant.

## Functional writing

Keep setting descriptions verb-first or in second person, no more than 12 words, with no period on a one-sentence line. Put necessary additional detail behind `HintInfo`. Do not claim ASD-STE100 compliance from length or tone alone; use the vocabulary, grammar, meaning, and evidence process in the [Writing Guide](Writing-Guide).

### Field help order

A field reads top to bottom as label, help, control. The label names the field. The `Hint` sits directly under the label and says what the field does, in one line, using only labels and registered terms as the [Writing Guide's help-line test](Writing-Guide) requires. The control comes last. A `HintInfo` goes beside the label, never under the control. A control never has a `Hint` after it, so a reader always knows what a field is before reaching it, and a tall control never pushes its own explanation out of view.

Two placements sit beside a control instead of above it:

- A checkbox row puts its caption after the box and its `Hint` inline after the caption, as the trait panel's Enabled by Default does.
- A status line under a list, such as an entry count or a band's covered range, is not help. It stays after what it reports on.

Apply that guide by role to all approved patterns: settings labels and information, markdown toolbar names and instructions, card action names and status messages, Find controls and status text, Code Template fields, validation and actions, and context-menu instructions, action labels and local status. Accessible text receives the same review as visible text. World introductions, creation titles, descriptions, tags, and sample Group names are authored content; these samples retain their own voice. Existing production copy is not certified by reuse in the showcase.

The foundation's [review record](../docs-internal/designs/design-system/workflow-review.md) records copy findings, evidence limits, and the two workflow demonstrations. Existing-screen alignment remains separate work.

## Pattern: Panel Tab Strip

**Purpose:** Split one editor detail panel's fields into named tabs, so a long panel fits one screen without hiding anything behind a scroll.

**Rule:**

- The strip is one row of equal columns. Every tab gets the same width, whatever its label's length.
- Each tab carries an icon and a name. The name is always on `aria-label`, so it reaches assistive technology and role queries whether or not it is drawn.
- The label gives way to its icon wherever the pane is narrow. The icon never shrinks.
- The strip is named, because the editor's own strip is on the same screen and can carry a tab of the same name.
- The strip is a fixed header row. Only the tab's body scrolls, below it, so the tabs never leave the panel.
- Mode-only tabs are filtered out of the registry before the strip renders, not disabled in place.

**Density:** Compact. The strip is 40px tall at every width. Labels use the production label role; hiding one does not change the strip's height, so the panel below it does not move.

### Composition

- One registry per panel holds the tabs in order, with the value, name, icon, and any mode flag. The strip renders from it and the dev-router ledger is guarded against it.
- The chosen tab belongs to the editor, not the panel. These panels remount per selected item, so panel-held state would reset down the list.
- When the chosen tab is unavailable in the current mode, the panel shows its first tab.

Each panel groups its fields by what kind of thing they are:

| Panel | Tabs | Advanced only |
| --- | --- | --- |
| Entity | Profile · Descriptions · Traits · Openings · Placeholders | Openings, Placeholders |
| Location | Details · Presence · Media · Pins | Pins |
| Stat | Details · Descriptors · Code | Descriptors, Code |
| Trait | Details · Stats · Pins | Pins |
| Dictionary entry | Details · Matching | Matching |

The library entity editor lifts Traits and Placeholders onto its own top strip, so its Entity sub-strip shows Profile, Descriptions, and Openings.

Two panels can lose their strip: Simple mode leaves the stat panel and the dictionary entry panel a single tab, which is no choice to offer, so each renders that body bare.

The dictionary entry panel splits by cadence rather than height. The panel is not tall, but its matching rules are set once and then sit between the keywords and the value on every later visit. Details holds Name, Trigger Keywords, and Value; Matching holds the rules. Whole Words and Case-Sensitive stay on Details on purpose: they are the only two matching switches Simple mode shows, they modify the keywords they sit under, and keeping them there is what leaves Simple one tab.

It is also the only one of the five with two hosts. The World Editor holds its tab in the editor's per-panel slot; the library's dictionary editor has no such slot and holds it in modal state for as long as the modal is open.

A tab name may repeat across panels, and may match a tab on the editor's own strip. The strip's own name keeps them apart: the trait panel's Stats tab and the editor's Stats tab both read as "Stats", and only "Trait Fields" says which strip you are on.

### Production mapping

| Need | Component |
| --- | --- |
| The strip itself | `PanelTabsList` in [`panel-tabs.tsx`](../src/components/ui/panel-tabs.tsx) |
| Tab, list, and panel primitives | [`tabs.tsx`](../src/components/ui/tabs.tsx) |
| Five-tab instance and its registry | `EntityManager` in [`EntityManager.tsx`](../src/managers/EntityManager.tsx) and [`entityPanelTabs.ts`](../src/views/entityPanelTabs.ts) |
| Five-tab location instance and its registry | `LocationManager` in [`LocationManager.tsx`](../src/managers/LocationManager.tsx) and [`locationPanelTabs.ts`](../src/views/locationPanelTabs.ts) |
| Instance whose tab name the editor also uses | `TraitManager` in [`TraitManager.tsx`](../src/managers/TraitManager.tsx) and [`traitPanelTabs.ts`](../src/views/traitPanelTabs.ts) |
| Instance that drops its strip in Simple mode | `StatManager` in [`StatManager.tsx`](../src/managers/StatManager.tsx) and [`statPanelTabs.ts`](../src/views/statPanelTabs.ts) |
| Two-tab instance, mounted by two hosts | `DictionaryManager` in [`DictionaryManager.tsx`](../src/managers/DictionaryManager.tsx) and [`dictionaryPanelTabs.ts`](../src/views/dictionaryPanelTabs.ts) |
| Its second host | `DictionaryEditorModal` in [`DictionaryEditorModal.tsx`](../src/components/modals/DictionaryEditorModal.tsx) |
| Entity strip in a second host, with Traits and Placeholders on the host's own strip | `EntityEditorModal` in [`EntityEditorModal.tsx`](../src/components/modals/EntityEditorModal.tsx), from `ENTITY_EDITOR_SUBTABS` |
| Isolated reference | [`PanelTabStripReference.tsx`](../src/components/design-system/PanelTabStripReference.tsx) |
| Width coverage | [`entity-panel-widths.spec.ts`](../e2e/entity-panel-widths.spec.ts) |

### Responsive behavior

The pane holding these panels is not monotonic in viewport width. Below `md` the panel is the full-width detail sheet. At `md` the editor splits and the panel takes half of it. A 767px window therefore gives the panel about 715px, and an 820px window gives it about 347px.

So the label steps on at `sm`, off at `md`, and on again at `xl`. The entity strip's five tabs get 63px each in a 375px sheet. "Placeholders", the longest label, is 106px wide with its icon. Two tabs in the same sheet get 157px each, which is why the dictionary entry strip is the one case the label would fit. It hides anyway, because a strip that keeps its labels at a width where its neighbors drop theirs reads as a different control.

The same shortfall returns in the half-width pane between `md` and `xl`: the five tabs get 62px at 768px, 68px at 820px, and 88px at 1024px. At `xl` they get 114px, so "Placeholders" fits with less side padding. Between `sm` and `md` they get 116px to 141px.

A container query would state this directly. `@tailwindcss/container-queries` is not a dependency, and these two breakpoints track the layout's own `md` switch exactly.

The library entity editor is the one host with other breakpoints. Its strip sits beside a Tags column, so the strip is narrow until `lg` and then only widens. It passes `labelClassName="hidden lg:inline"` to `PanelTabsList`. The [`library-editor-widths.spec.ts`](../e2e/library-editor-widths.spec.ts) check fails if a drawn label overflows its trigger.

### State reference

| State | Treatment |
| --- | --- |
| Default | The first tab is selected and its body is the only one mounted. |
| Selected | The active trigger takes the background, foreground, and shadow from the shared tab primitive. |
| Disabled | No tab is disabled. A tab the current mode does not offer is absent from the registry instead. |
| Focus | Arrow keys move between tabs and the shared inset focus ring marks the active one. |
| Overflow | Below `sm` and between `md` and `xl`, the label is hidden rather than truncated or wrapped. The icon keeps its full size. |

The live reference renders four of the five production strips against their own registries. It leaves the stat panel out because that strip's width case is the trait panel's, three equal columns, and the reference exists to show the widths. It holds the chosen tab in mounted React state and never reads or writes authored worlds, saves, library data, or preferences.

### Writing review

- Tab names come from the four production registries, so the reference and the editor cannot drift. Reuse does not certify those names as fully ASD-STE100 compliant.
- **Unverified:** the section headings "Five Tabs" (entity and location), "A Tab Name the Editor Also Uses", and "Two Tabs, Two Hosts", and the four `Meta` lines, have terminology review only; vocabulary and grammar evidence is not recorded.
- **Unverified:** the entity bodies for Traits and Openings, "The entity's own traits and groups, each one opening on the editor's Traits tab" and "The entity's openings, drawn when a player starts at one of its locations", and the location body for Openings, "The location's openings, drawn when a game starts at this location", have terminology review against the production tab contents only; vocabulary and grammar evidence is not recorded.

## Pattern: Narration Turn

**Purpose:** Show one turn of the story the same way in the Pages and Chat layouts, so a turn's actions and its scene image controls cannot differ between them.

**Rule:**

- One card renders a turn's narration in both layouts. The card owns its surface, its right-click menu, and its action row.
- One action list feeds the row and the menu. Every row icon is also a menu item, and **More** opens that menu for the menu-only actions. **Generate Scene Image** is available only in **More** and the context menu in Pages and Chat.
- The row is absent while the turn streams and when the list is empty. It does not show disabled icons in place of a live turn.
- **Re-generate Stats** sits to the right of **Edit Stats** in the Stats panel, with a tooltip on each button. It also remains in the narration menus. The panel disables regeneration on past turns and while a reply or scene render is running.
- A turn with no scene image shows no plate. There is no empty box.
- Choices in Pages are unnumbered rows. Choices in Chat are unsent bubbles. Both take the same press handlers. **Re-generate Choices** waits for the latest turn to have narration; it remains available after a turn returns no choices. **Jump to Latest** stays hidden before the opening narration.

**Density:** Comfortable. The card uses the narration text size the player sets. The action row and the plate controls are compact icon buttons with tooltips.

### Composition

The three parts, in reading order for Pages:

| Part | Holds | Notes |
| --- | --- | --- |
| **Turn Card** | The plate, the action line, the reasoning block, the narration, then the action row | The caller supplies the body. Chat puts the plate under the narration and keeps the action bubble outside the card. |
| **Scene Plate** | One turn's images, newest in view | A click zooms. Hover or focus within shows previous, the count, next, and delete. One image shows delete only. |
| **Choice rows** | Unnumbered choices, then a Continue action; an inset muted line with centered, muted “or” separates them | Continue and **Re-generate Choices** share a segmented row with a muted vertical divider and no separate icon-button border. Re-generate sits below the choices when Continue is hidden. No rule appears when Continue is the only choice. |

- The action row starts with the turn number, then the icon actions, then **More** for the menu-only actions.
- The action line in Pages is the player's text with a left rule in the primary color and the muted foreground. It is upright, so the player's italics and quote color show. It has its own right-click menu, and that event does not reach the card's menu.
- A right-click on selected text keeps the browser menu.
- The plate takes its box size from the image header, so the text below does not move when the image decodes.

### Production mapping

| Need | Component |
| --- | --- |
| Card surface, menu wrapper, and action row | `TurnCard` in [`TurnCard.tsx`](../src/components/game/TurnCard.tsx) |
| Icon row and right-click menu | [`BubbleActionRow.tsx`](../src/components/game/BubbleActionRow.tsx) and [`BubbleMenu.tsx`](../src/components/game/BubbleMenu.tsx) |
| The action lists: narration, player action, and choices | `bubbleActions`, `playerBubbleActions`, and `choicesActions` in [`bubbleActions.ts`](../src/lib/bubbleActions.ts) |
| Scene image with zoom, browse, and delete | `ScenePlate` in [`ScenePlate.tsx`](../src/components/game/ScenePlate.tsx) |
| Choice rows | `ChoiceRows` in [`ChoiceRows.tsx`](../src/components/game/ChoiceRows.tsx) |
| Chat's bubble choices and the shared choice text | `ChatChoices` and `ChoiceText` in [`ChatChoices.tsx`](../src/components/game/ChatChoices.tsx) |
| Pages action line with its own menu | `ActionLine` in [`ActionLine.tsx`](../src/components/game/ActionLine.tsx) |
| Stats panel's **Edit Stats** and **Re-generate Stats** pair | `StatsActions` in [`StatsActions.tsx`](../src/components/game/StatsActions.tsx) |
| Pages host | [`GamePanels.tsx`](../src/components/game/GamePanels.tsx) |
| Chat host | [`ChatNarration.tsx`](../src/components/game/ChatNarration.tsx) |
| Layout parity guard | [`GamePanels.pagesCard.test.tsx`](../src/components/game/GamePanels.pagesCard.test.tsx) |
| Isolated reference | [`NarrationTurnReference.tsx`](../src/components/design-system/NarrationTurnReference.tsx) |

### Responsive behavior

The card and the rows fill the narration column at every width. Long choice text wraps inside its row. The action row stays on one line; the full latest-page row, four icons and **More**, fits the card in a 375px window. The plate is at most 18rem tall and never wider than the card.

On a touch screen, a long press opens the card's menu, and a long press on a choice row appends it. The plate controls show when focus is on one of them, so Tab from the image reaches them without a pointer.

### State reference

| State | Treatment |
| --- | --- |
| Default | Card on `bg-card` with a border. Rows on the panel with a divider between them. Plate controls hidden. |
| Hover | A row takes a light primary tint. The plate shows its controls. |
| Selected | A staged choice, or the choice taken on a past page, takes the primary fill. Its quoted text inherits the fill's foreground for contrast. |
| Disabled | Past-page rows are disabled and dimmed, except the choice taken. An action whose job cannot start is disabled in the row and in the menu. **Previous image** and **Next image** disable at the ends. |
| Busy | The action whose own job runs shows a spinner in place of its icon. |
| Live | The turn streams, so the card has no action row and no menu actions. |
| Focus | Rows, icons, and plate controls use the shared inset focus ring. On a selected row the ring takes the primary foreground. |
| Empty | No image: no plate. No actions: no row. No choices and no choices action: no block. |
| Destructive | **Rewind to Here** is the last menu section and opens the existing confirm. |

The live reference renders the production card, plate, action line, rows, and Stats panel pair with the production action lists. The latest page shows the action line above the narration, with its own menu. The pair appears on both pages: both actions work on the latest turn, and both are disabled on the past turn. Its handlers write to a local status line. It never calls an endpoint, draws an image, or reads or writes a save.

### Writing review

- Action labels come from the action builders, and the plate's names come from `ScenePlate`, so the reference and the game cannot drift. Reuse does not certify those labels as fully ASD-STE100 compliant.
- **Unverified:** the headings "Latest Page" and "Past Page", their two `Meta` lines, the status line, and **Restore Images** have terminology review only; vocabulary and grammar evidence is not recorded.
- The pair's labels and tooltips come from `StatsActions`, and the action line's menu from `playerBubbleActions`, so the reference and the game cannot drift.
- **Unverified:** the description's "Right-click a card or the action line for its menu", the past page's "The Stats panel actions are disabled", and the "Stats Panel" label have terminology review only; vocabulary and grammar evidence is not recorded. The sample action text is creative prose and exempt.

## Pattern: Nested Prompt Navigation

**Purpose:** Show the active prompt section while retaining the surrounding prompt list.

- Use the production [PromptNavigationRail](../src/components/modals/PromptNavigationRail.tsx) in Settings.
- The active destination uses the shared [CompactSelectionRow](../src/components/ui/compact-selection-row.tsx) primary fill and foreground, with `showCheck={false}`.
- An open parent has a quiet accent tint and medium weight while a child is selected. Clicking the parent opens Anatomy and makes that parent the active destination.
- Indent child rows and use the smaller `text-meta` size without a connector line. Keep only the current prompt's children open.
- Use uppercase section headings with hairline dividers. Rows wrap long names and retain the shared inset focus ring.
- The rail stays a flex column with a bounded, shrinkable viewport. Long lists scroll independently of the editor; contain wheel scrolling at the rail's ends.
- Below `md`, Settings uses its combined prompt/section selector instead of the rail.
- `aria-current="true"` identifies only the current destination. Navigation buttons do not expose toggle states.

The [live reference](../src/components/design-system/PromptNavigationReference.tsx) uses the production rail with all prompt labels and local selection state in a short container.
Open `#dev?modal=designSystem&tab=prompt-navigation`.
The reference's mobile section selector previews the current prompt's sections; Settings retains its complete combined selector.

### Writing review

Prompt and section labels reuse the production registry. The reference's title and selector label name their controls; it adds no instructional prose.

## Pattern: Bearer Flyouts

**Purpose:** Pick one entity from the world's entity groups without leaving the Traits tab.

This pattern differs from two others on purpose. Its entity list sits inside the **+** menu, unlike the Searchable Group Picker, because each level stays short. Its rows keep a check column in a held-state flyout, unlike Compact Selection Lists, so entity rows and group rows align.

- 🧭 **One level at a time.** The flyout shows one entity group level. A group row carries a folder icon and a trailing chevron, and opens that group's level. A group with no entity anywhere below it has no row.
- ⬅️ **Back row.** Above the rows, a Back row with an arrow names the level you're on. It returns one level. On the top level of a menu drill-in, it names the menu row that opened the list and returns to the menu.
- 👤 **Custom Persona icon.** The entity with the Custom Persona mark sits in its Entities-tab place and carries its own icon.
- ✅ **Check column.** A flyout that shows held state starts every row with a check column, so group rows and entity rows align. A held entity reads checked and dimmed, and can't be picked.
- Rows use the menu's row size and padding. Long names wrap. The list scrolls inside the popover when it outgrows the space.

| Instance | Where | After a pick |
| --- | --- | --- |
| **Add Trait to Entity** / **Add Group to Entity** | The Traits tab's **+** menu drills in | The popover closes and the new row is selected |
| **Link To…** | Right-aligned at the top of a world trait's or group's Details, and beside a selected link's Linked-from line, in Advanced | The popover stays open and the row turns checked |

### Production mapping

| Need | Component |
| --- | --- |
| Levels, Back row, check column | `BearerList` in [`BearerPicker.tsx`](../src/managers/BearerPicker.tsx) |
| Rows and levels | `bearerChoices` in [`bearerChoices.ts`](../src/lib/bearerChoices.ts) |
| Menu row | `MENU_ROW` in [`menuRow.ts`](../src/components/menuRow.ts) |
| Link button | `LinkToBearerButton` in [`BearerPicker.tsx`](../src/managers/BearerPicker.tsx) |
| **+** menu drill-in | `traitsMenu` in [`WorldEditor.tsx`](../src/views/WorldEditor.tsx) |
| Isolated reference | [`BearerFlyoutReference.tsx`](../src/components/design-system/BearerFlyoutReference.tsx) |

Open `#dev?modal=designSystem&tab=bearer-flyouts`. The reference uses sample entities and local state. It never reads or writes a world.

### Responsive behavior

The same levels work on desktop and on a phone. Nothing opens to the side, so a narrow panel never clips a level. Each level's Back row takes focus as it opens.

## Pattern: Blueprint Overrides

**Purpose:** Show which fields of a link or copy differ from its blueprint, and return them to it.

- ↺ **Field Reset.** An overridden field ends its label row in a ghost **Reset** button with a rotate icon. A field that reads its blueprint live has no Reset. Each Reset's accessible name adds the field, such as "Reset Requires".
- ⚠️ **Stale marker.** When the blueprint changed a field after the override was made, a warning-colored "Blueprint changed" line with a warning icon sits just left of that field's Reset. It shows on the details panel only, never in the tree.
- 🧊 **Frozen footer.** Below every panel tab, **Reset to Blueprint** sits on the left and is unavailable while nothing is overridden. The host's own actions, such as **Link To…** and **Edit Blueprint**, sit on the right.
- Read-only fields keep their normal look, with editing off.

### Production mapping

| Need | Component |
| --- | --- |
| Field Reset, stale marker, label row, footer | `FieldReset`, `LabelRow` and `BlueprintFooter` in [`BlueprintReset.tsx`](../src/components/editor/BlueprintReset.tsx) |
| Trait link panel and footer | `LinkedTraitManager` and `LinkFooter` in [`TraitLinkPanel.tsx`](../src/managers/TraitLinkPanel.tsx) |

## Pattern: Travel Hint Pair

**Purpose:** Edit a two-way Connection's two Travel Hints, one for each direction, or use one hint for both.

- 📚 **Two stacked boxes.** Each box edits one direction and carries that direction in its label. A link copies the top box into the bottom box.
- 🔗 **Vertical link toggle.** A ghost button sits to the right of both boxes and spans their full height. Its icon, turned upright, is a chain (`link`) when linked and a broken chain (`unlink`) when unlinked. Its tooltip names what a click does: **Link Travel Hints** or **Unlink Travel Hints**.
- 🔒 **Linked.** The top box writes both directions. The bottom box is read-only, muted, and shows the top box's text. Screen readers hear that it copies the first Travel Hint.
- ✏️ **Unlinked.** Both boxes are editable. Unlinking restores the text the bottom box had before the last link.
- ➡️ **One-way.** One box and no toggle. Switching to two-way adds the second box, linked.

The link state is never saved. The pair opens linked when both hints are equal, and reads the state again when the hints change somewhere else, such as an undo.

| Instance | Box labels |
| --- | --- |
| Canvas inspector | An arrow icon plus the destination name. Clicking an arrow on the canvas focuses its box. |
| Location panel's Connections list | **To** *partner* for the trip out, **From** *partner* for the trip in |

### Production mapping

| Need | Component |
| --- | --- |
| Boxes, toggle, link memory | `TravelHintPair` in [`TravelHintPair.tsx`](../src/components/editor/TravelHintPair.tsx) |
| Link and unlink rewrites, opening state | `withLink`, `withUnlink` and `hintsLinked` in [`connectionEditing.ts`](../src/lib/connectionEditing.ts) |
| Canvas inspector | `ConnectionInspector` in [`LocationCanvas.tsx`](../src/managers/LocationCanvas.tsx) |
| Location panel | [`LocationConnections.tsx`](../src/managers/LocationConnections.tsx) |
| Isolated reference | [`TravelHintPairReference.tsx`](../src/components/design-system/TravelHintPairReference.tsx) |

Open `#dev?modal=designSystem&tab=travel-hints` for linked, unlinked, and one-way samples in local state. The **Locations** tab's quay-to-garden pair has different hints, so its arrow labels sit on their outer sides.

## Pattern: Formaquestion Window

**Purpose:** Keep help in view while the player works. The window is not a dialog: it does not dim the app, it does not take the keyboard, and it stays usable above every dialog.

> 📝 **Proposal.** The user approved these patterns on the ticket 14 prototype (2026-10-01). The table at the end shows which ones production has today.

**Density:** Compact. The title bar is 40px tall. Lists use the Compact Selection Lists rows.

### Composition

- 🏷️ **Help tab.** A launcher that stays flat against one of the four screen edges and is round on its inner side. Its label reads top to bottom on the right edge, bottom to top on the left edge, and left to right on the top and the bottom. It is never upside down. A press opens or closes the window. A drag, or an arrow key while the tab has focus, moves it. The tab shows the accent fill while the window is open.
- 🪟 **Floating window.** A title bar with the name, **Wide View**, a **⋮** menu and **Close**. **Wide View** keeps one icon and stays lit while on. The menu holds **Clear Conversation**, the **Chat Style** radio items (**Auto**, **Bubble**, **Minimal**, **Full**), the **Mascot Position** radio items (**Beside**, **Below**, **Auto**), **AI Context** and **Settings**, in that order in every chrome. The mobile-size sheet and the bubble chrome leave out **Mascot Position**: the sheet draws no mascot, and Bubble places the mascot itself. It renders in the window's layer, and hangs from the corner of the button that has room, so it always comes from the button. **Close** is a bare X in the dialog style. A dialog opened from the menu closes the window and reopens it on close. The title bar moves the window. A grip at the bottom right corner resizes it. The window stays whole on the screen. Only the tab snaps to an edge.
- ↔️ **Two widths.** Narrow (400px) shows one part at a time behind three tabs: **Ask**, **Search** and **Guide**. Wide (720px) shows a rail with search and contents beside the conversation or the reader. **Wide View** swaps them, and the grip crosses the same line at 560px. The conversation, the search text and the open section carry over.
- 💬 **Conversation.** A scrolling log of questions and answers above the question field. It stays at its end while an answer comes in, unless the player scrolled up. The question field is one line and grows with its text while focused, as the game's action box does.
- 🙋 **Question bubble.** The player's question, right-aligned on `muted`, with an 8-unit left margin so it never spans the full width.
- 📝 **Answer.** Markdown through the streaming renderer, with no bubble. A `Meta` line says **Stopped** under an answer the player ended.
- 📋 **Code block.** A fence in an answer or a guide page is the highlighted block with a ghost icon button, **Copy**, at the right of its header row. Copy confirms with a **Copied** tip above the button, in the tooltip style, that fades out after about a second. It also opens on tap and on keyboard activation, and a failed copy shows **Couldn't copy** the same way. No toast shows. An answer's block also has **Insert**, a ghost icon button beside Copy. It opens an inline menu with the open stat's name as a `Meta` header and two ghost rows, **Before the AI** and **After the AI**, that the arrow keys move between. The row the fence's slot tag names has the accent fill and focus when the popover opens. With no stat panel open, Insert is dimmed with `aria-disabled` and a tip that says what to open. The panel's replace confirm makes the window step aside as the window's own dialogs do. Code blocks outside the window have no controls.
- 🔗 **Source link.** A small bordered chip under an answer: the page in the muted color, a chevron, then the section in the foreground color. Chips wrap, under a `Meta` label **Sources**. A press opens the section in the reader.
- ⌨️ **Question field.** A two-row text area with an icon button beside it. The button is **Send**, and it is **Stop** in the outline variant while an answer comes in. While a game turn generates, **Send** is unavailable and a helper line under the field says why.
- 🔎 **Search result row.** The section name at label weight, the page as `Meta`, and a two-line excerpt in the helper role. The wide rail leaves out the excerpt.
- 📖 **Reader.** The page as `Meta`, the section name, the body, then an **On This Page** list. In the narrow layout a **Contents** row above it goes back to the list. In the wide layout a **Back to Conversation** row above it shows the conversation again.
- 📚 **Contents.** One collapsible row per page, with its sections as Compact Selection Lists rows.

### Minimal chrome

Under **Chat Style** **Minimal**, the window drops its frame and shows three separate pieces over the app: the mascot, the column and the reader. A style change while the window is open swaps the chrome in place, with no zoom. The column and the reader take presses. The mascot does not. A press in a gap between the pieces reaches the app.

- 💊 **Pill.** The chrome on top. A round, bordered `background` pill at the top right of the column, with a drag grip, the **⋮** menu, **Show Head Only** and **Close**. On a mobile-size screen the pill has no grip and no head button. The grip moves all three pieces. Every button is round, bare and `muted-foreground`, and fills with `accent` on hover.
- 🧍 **Mascot piece.** Left of the column, as tall as the column, at the base's aspect, with its feet on the column's bottom edge. It has no box, no border and no shadow. The head view is the same piece, cropped by the Mask, left of the pill. It is 96px tall on a desktop and 64px on a mobile-size screen.
- 💬 **Column.** The conversation as bubbles over the app, up to 400px wide, with no frame, no title bar and no tabs. Older bubbles fade out at the top. No scroll bar shows. The framed window's corner grip sits in a strip under the ask pill, clear of **Send**, and resizes the column.
- 🙋 **Question bubble.** On the `primary` fill with `primary-foreground` text, right-aligned, with a flat bottom right corner and a 40px left margin. The framed window's question bubble uses `muted`.
- 📝 **Answer bubble.** The answer sits in a bubble on `popover` with a border, left-aligned, with a flat bottom left corner and a 24px right margin. The framed window draws its answer with no bubble.
- ⌨️ **Ask pill.** The question field and **Send** in one rounded pill, in the `shadow-lg` role, with the inset focus ring around the whole pill.
- 📖 **Reader piece.** Right of the column, 8px away, as tall as the column. A `popover` card with a border and a **Close Reader** button in its own top bar. It closes alone. The column and the mascot stay.
- 🌫️ **Shadow.** The pill, the bubbles and the reader have `shadow-md`, which separates them from the app. The ask pill has `shadow-lg`. The mascot has none.
- 🧍 **Mascot beside the frame.** Under **Full** with the mascot on, the whole mascot stands left of the framed window, as tall as it, with its feet on the frame's bottom edge. The head view does not apply. The mobile sheet draws no mascot under **Full**.
- 📱 **On a mobile-size screen.** The sheet fills the screen over a dim, blurred backdrop. The bubbles sit on the backdrop, and the head view is left of the pill. A source name opens the guide section in the wiki, not in a reader piece.

### Bubble chrome

Under **Chat Style** **Bubble**, or **Auto** with the mascot on, the mascot speaks the newest answer. Bubble places the minimal chrome's pieces, tokens, radii, shadows and Backdrop around the mascot. The tail and the strip are its only additions. With the mascot off, or on the mobile sheet, it draws the minimal chrome.

- 💬 **Answer bubble.** The assistant bubble with no tail corner, and a tail of the same `popover` fill and border that points at the mascot's head. Its bottom edge sits at the bottom of the head. It fits the answer up to the screen margin, then scrolls in a `ScrollArea`. While it scrolls, the whole bubble fades out at the top, box and all, as the minimal column's bubbles do. It holds the answer and the open **Thinking** text.
- 🎚️ **Strip.** Under the bubble: round `background` chevron buttons at both ends, and between them the **Thinking** toggle, a **Sources** button that opens the source links in a popover, and **Take Me There**. **Sources** takes the **Thinking** toggle's leading chevron, which turns up toward the popover while it is open.
- 🙋 **Question and ask pill.** The question bubble, read-only, then the ask pill, level with the mascot's feet.
- 💊 **Pill.** Over the mascot's head, inside its bounds. The mascot's body moves the window too. The chat grip sets the chat's room, as the minimal grip sets its box. It sits on the room's corner that faces the most open space. The Backdrop fills the room, and the bubble fits its answer at the room's bottom. The tail draws under the bubble. The mascot's own grip sits on its top corner on the bubble side and sets its **Scale**.
- 🫥 **Pill fade.** The pill and the mascot's grip show when the window opens and hide after one second, with a 300ms opacity fade. The fade masks the whole bubble piece, box included. The chat grip sits outside the bubble, so it stays in view. They return while the pointer is over the mascot or a piece, while keyboard focus is inside a piece, and while the **⋮** menu is open. A hidden piece takes no presses. On a touch screen they stay up. With reduced motion, they show and hide with no transition.
- 🪞 **Sides.** The bubble stands on the mascot's side that faces the screen's middle. Past the middle, the group mirrors with no transition.
- 🧑 **Head view.** One column: the bubble with its tail down, the head and the pill, the strip, the question, the ask pill.

### Layering

The tab and the window render in the shielded layer, one host on `<body>` at z-65. That is above dialogs, popovers and selects (z-50), and under the chip typeahead (z-70) and tooltips (z-80).

- A dialog, an alert dialog and a drawer treat a press or focus in the layer as inside them. They do not close and do not take focus back.
- An overlay that the window opens must render inside the layer: use `portal={false}`. An overlay portaled to `<body>` lands under the window.
- Escape belongs to the dialog behind the window. It never closes the window.

### Motion

The window zooms from 75% and fades in over 200ms, and goes back over 150ms. The fixed point of the zoom is the center of the Help tab. Reduced motion shows and hides it at once. Put `transition-none` beside the duration classes: a `duration-*` class also sets the transition duration, and a drag would then ease each step.

The mobile sheet slides in from the edge that holds the Help tab, with the same durations.

### Production mapping

| Need | Component |
| --- | --- |
| The layer, and the guards the dialog wrappers use | [`shielded-layer.ts`](../src/components/ui/shielded-layer.ts) |
| Help tab look per edge, and the placed tab | `EdgeTabButton` and `EdgeTab` in [`EdgeTab.tsx`](../src/components/formaquestion/EdgeTab.tsx) |
| Tab place, drag and arrow-key moves | [`tabPlace.ts`](../src/lib/formaquestion/tabPlace.ts) |
| Window frame | [`FormaquestionFrame.tsx`](../src/components/formaquestion/FormaquestionFrame.tsx) |
| Window place, a size per chat style, and the two widths | [`windowBox.ts`](../src/lib/formaquestion/windowBox.ts) |
| Narrow and wide layouts | [`GuideBody.tsx`](../src/components/formaquestion/GuideBody.tsx) |
| Search field, result rows, contents, reader | [`GuideParts.tsx`](../src/components/formaquestion/GuideParts.tsx) |
| Conversation, question bubble, answer, not-from-the-guide notice, source link, question field | [`AskParts.tsx`](../src/components/formaquestion/AskParts.tsx) |
| Code block toolbar | `CodeSnippet` in [`CodeSnippet.tsx`](../src/components/formaquestion/CodeSnippet.tsx) |
| Copy confirm tip | `FlashTip` in [`tooltip.tsx`](../src/components/ui/tooltip.tsx) |
| The one instance, F1, focus and motion | [`Formaquestion.tsx`](../src/components/formaquestion/Formaquestion.tsx) |
| Minimal chrome: pill, bubbles, ask pill | `MinimalChat` in [`MinimalChat.tsx`](../src/components/formaquestion/MinimalChat.tsx) |
| Mascot piece and head view | [`MascotPiece.tsx`](../src/components/formaquestion/MascotPiece.tsx) |
| Reader piece | [`ReaderPiece.tsx`](../src/components/formaquestion/ReaderPiece.tsx) |
| Piece boxes beside the column or the frame | `windowLayout` in [`windowBox.ts`](../src/lib/formaquestion/windowBox.ts) |
| Isolated reference | [`FormaquestionReference.tsx`](../src/components/design-system/FormaquestionReference.tsx) |

Open `#dev?modal=designSystem&tab=formaquestion` for the tab on each edge, a sample window, a sample mobile sheet and the three pieces of the minimal chrome in local state. The samples have no AI: a question you send there shows the docs search state. Open `#dev?modal=formaquestion` on any screen for the real one.

### Responsive behavior

Below the `md` breakpoint the window is a full-screen sheet in the narrow layout.

- The sheet and the tab fill the visible area (`.app-viewport`), so the on-screen keyboard shrinks the sheet and moves the tab up with the app.
- The sheet has no frame lines, no Wide View, no drag and no resize, and stores no place. Its title bar is 48px, and Close fills that height as a 48px touch target.
- The sheet pads for the system bars with the safe-area insets.
- Focus goes to the sheet, not to the search field, so no keyboard opens until the player selects a field.
- The tab hides while the sheet is open, and focus returns to it on close.
- The Android back action closes the sheet or the window before any dialog under it. Escape still never closes it.

### State reference

| State | Treatment |
| --- | --- |
| Closed | The tab only. `aria-expanded` is false. |
| Open | The tab has the accent fill. Focus goes to the question field, or to the sheet on mobile. |
| No question yet | A centered hint in the conversation. |
| Answer in progress | A helper line until the first words, then the text as it comes in. **Stop** takes the place of **Send**. |
| Stopped | The text so far, then a `Meta` line. |
| Not from the guide | Pattern 5 above the answer: a `warning`-tinted box with a warning `Info` icon and `text-helper` copy. **Nearest Sections** takes the place of **Sources**, with the same source links. It shows from the first words once the answer carries the marker. |
| Game turn in progress | **Send** is unavailable, with a helper line under the field. The player can still type, search and read. |
| No AI, or a failed request | One helper line that says why, then the search result rows for the question. With no matching section, the line says so and no rows show. A failed request also shows the standard error toast, and keeps the text that came before the failure. |
| Loading | A status line in place of the content while the docs load. |
| Load failed | A line that says so, and **Try Again**. |
| Too few letters | A hint in place of the results. |
| No match | A status line that quotes the search text. |
| Wide, no section | The conversation in the reader's place. |
| Focus | The shared inset ring on every control, the tab included. |

### Approved patterns

| # | Pattern | In production |
| --- | --- | --- |
| 1 | Fixed launcher above every layer | ✅ |
| 2 | Floating window with two widths | ✅ |
| 3 | Full-screen sheet for a non-modal surface, on mobile | ✅ |
| 4 | Source link: a "Page › Heading" chip under an answer | ✅ |
| 5 | Not-from-the-guide notice above an answer | ✅ |
| 6 | Question bubble: the player's question, right-aligned on `muted` | ✅ |
| 7 | Search result row | ✅ |
| 8 | Reader with an On This Page list and a Back row | ✅ |
| 9 | Send reason: a help line under the field when Send is unavailable | ✅ |
| 10 | Movable edge tab | ✅ |
| 11 | Minimal chrome: pill, floating pieces, bubbles on `primary` and `popover` | ✅ |

A pattern that is not built gets its composition and its reference here when its production component lands.

### Writing review

**Help**, **Formaquestion**, **Ask**, **Search**, **Guide**, **Wide View**, **Close**, **Contents**, **Back to Conversation**, **On This Page**, **Introduction**, **Ask a Question**, **Send**, **Stop**, **Stopped**, **Sources**, **Nearest Sections**, **Clear**, **Try Again**, **Show Head Only**, **Show Full Mascot**, **Close Reader**, **Copy** and **Insert** are labels in Title Case. The hints and status lines are one sentence with no period. The not-from-the-guide notice is two sentences, so each has a period. The line above the docs search in a conversation is two sentences, so each has a period. With no matching section it is one sentence. The tab's tooltip is two sentences, so each has a period. Docs text in the reader is authored content and keeps its own voice. This review is local; it does not certify STE compliance.

## Pattern: Filter Row With Filters Popover

**Purpose:** Search and filter a paged list with only the controls a reader uses most on the row.

**Density:** Compact. One row holds search, the main filters, and a **Filters** button. Less-used filters wait in a popover.

### Composition

- 🔎 **Search first.** The search bar grows to fill the row. Its clear button returns the full list at once.
- 🎛️ **Main filters next.** Each viewer keeps its most-used filters on the row at fixed widths.
- 🧰 **Filters last.** An outline button with a filter-list icon, the **Filters** label, and a count badge. Actions such as a file button follow it.
- 🔢 **Badge.** It counts the hidden filters that differ from their defaults. No badge shows when all are at their defaults. A changed filter on the row never counts.
- 📋 **Popover.** It aligns to the button's end and renders inline, not portaled. The hidden filters sit in it as labeled selects. A divider follows, then a ghost **Reset Filters** button with a rotate icon at the left.
- ↩️ **Reset.** It returns every filter to its default, the ones on the row included, and goes back to page 1. It keeps the search text. It is disabled when every filter is at its default.
- ♿ **Accessible name.** The button is **More Filters**, or **More Filters, N changed** while the badge shows.

| Viewer | On the row | In Filters |
| --- | --- | --- |
| Staff queue | Search, Status, Sort | Category |
| User tab | Search, scope, then the file button after Filters | Status, Category, Sort |

### Production mapping

| Need | Component |
| --- | --- |
| Rows, Filters button, popover, Reset | `StaffFilterRow` and `UserFilterRow` in [`FeedbackFilterRow.tsx`](../src/components/menu/FeedbackFilterRow.tsx) |
| Filter state, badge count, Reset | `useFeedbackFilters` in [`useFeedbackFilters.ts`](../src/components/menu/useFeedbackFilters.ts) |
| Defaults per viewer and branch | `staffFilterDefaults` and `userFilterDefaults` in [`feedbackPresentation.ts`](../src/lib/feedbackPresentation.ts) |
| Search bar | [`FeedbackSearchInput.tsx`](../src/components/menu/FeedbackSearchInput.tsx) |
| Production hosts | [`FeedbackQueueTab.tsx`](../src/components/menu/FeedbackQueueTab.tsx) and [`MyFeedbackTab.tsx`](../src/components/menu/MyFeedbackTab.tsx) |
| Isolated reference | [`FeedbackFilterRowReference.tsx`](../src/components/design-system/FeedbackFilterRowReference.tsx) |

### Responsive behavior

At `sm` and wider, everything shares one row. Below `sm`:

- Search takes its own row.
- The staff Status and Sort share two equal columns.
- **Filters** shows its icon only, with the badge on its top-right corner.
- The file button shows its icon only. Its label stays for screen readers.

### State reference

| State | Treatment |
| --- | --- |
| Defaults | No badge. **Reset Filters** is disabled. |
| Row filter changed | No badge. **Reset Filters** is enabled. |
| Hidden filter changed | The badge shows the count. The name adds "N changed". |
| After Reset | Every filter is at its default, the list is on page 1, and the search text stays. |

Open `#dev?modal=designSystem&tab=filter-row` for the staff and user rows in local state.

### Writing review

The labels follow AP title case: **Filters**, **More Filters**, and **Reset Filters**. The count in the accessible name changes with the state, so it is status text, not a lecture. The select names keep their production wording.

## Pattern: Supporter Flair

Supporter Flair marks an account that supports the project on Patreon. It is a proposal until the user approves it. No surface uses it yet.

### Composition

- 🎨 **Two tier tokens.** `--supporter` is coral. `--supporter-plus` is magenta. Both stay the same in every palette, so a palette never blurs a tier against its own primary color.
- 🏷️ **Badges.** A pill with an icon. Supporter has a heart on a light tint. Supporter+ has a sparkle, a stronger tint, and an outline, so the tiers differ by shape and not only by hue.
- 🔤 **Names.** The name takes its tier color. Use no other change to the name.
- 🖼️ **Profile Image ring.** A ring in the tier color with a gap to the image. The ring is 1 pixel at the two small sizes, 2 pixels at the middle sizes, and 3 pixels at the largest size.
- 🧭 **Beside staff.** The staff badges stay square text tags in blue, green, and the palette's primary. A pill with an icon never reads as a staff tag.

### When to use it

- Show the flair wherever other people see a name: listings, comments, feedback, and profiles.
- Show no flair on a staff account. The staff badge wins.
- Show no flair on a stored name snapshot, such as a contest podium.
- Do not use the tier colors for anything else. They mean support and nothing more.

### States

The badge, the name color, and the ring are static. They have no hover, focus, or disabled state. A name that opens a profile keeps the focus ring of `UserName`.

### Contrast

Each token meets 4.5:1 as text on the background, card, popover, muted, accent, and secondary surface of every palette, in both modes. It meets the same ratio under its strongest badge tint. [`supporterTokens.test.ts`](../src/lib/supporterTokens.test.ts) reads [`src/index.css`](../src/index.css) and checks every palette. The High Contrast accent and secondary fills are mid grays that no hue clears, so the check skips those two.

The Admin badge takes the palette's primary color. In Rose and Bubble Gum the primary is near the Supporter+ hue, so the two tags can look alike there. The outline and the icon keep them apart.

### Production mapping

| Part | Source |
| --- | --- |
| Tokens | [`src/index.css`](../src/index.css) and [`tailwind.config.js`](../tailwind.config.js) |
| Tier labels and styles, ring classes | [`supporterFlair.ts`](../src/lib/supporterFlair.ts) |
| Badge | `SupporterBadge` in [`SupporterBadge.tsx`](../src/components/SupporterBadge.tsx) |
| Staff badge for comparison | `RoleBadge` in [`RoleBadge.tsx`](../src/components/RoleBadge.tsx) |
| Profile Image | `UserAvatar` in [`UserAvatar.tsx`](../src/components/UserAvatar.tsx), with `supporterRing` as its `className` |

Open `#dev?modal=designSystem&tab=supporter-flair` for the light and dark panels side by side.

### Writing review

The badge labels are **Supporter** and **Supporter+**. Copy says Profile Image, never avatar.

## Pattern: Preset Header

**Purpose:** Pick a preset and act on it with the same controls on every preset surface.

**Density:** Compact. One row holds the label, the preset select and the actions. A reachability badge sits under the row, and the Reset and Compare pair sits with its prompt.

### Composition

- 🏷️ **Label and select.** The label reads **Preset**. The select lists the presets, then a separator, then **Add New Preset…** as its last row. It has no Import row. A surface that picks the preset elsewhere, such as the Formaquestion **Endpoint** tab, shows a heading in place of the label and select.
- 🔘 **Icons at `md` and up.** Each action is a ghost icon button with a tooltip. Destructive actions sit left of the select, with Delete outermost. File actions sit right of it. A panel that opens full screen ends the file actions with **View full screen**, which reads **Exit full screen** while the panel is full screen.
- ⋯ **One menu below `md`.** A single **Preset Actions** button holds every action. File actions come first, then a separator, then the destructive ones in red.
- ✋ **Confirm first.** Reset and Delete open a confirm that names the preset. A surface whose Reset Undo or Cancel can revert, such as the Formaquestion **Mascot** tab, resets with no confirm. A surface can title its own confirm. Cancel returns focus to the icon, or to the **Preset Actions** button when the menu opened the confirm.
- 🟢 **Badge.** An endpoint preset select shows whether its server answers, under the select. The row carries one dot, one line and **Recheck**.
- ↩️ **Reset and Compare.** The pair sits right-aligned, Reset left of Compare. One prompt on screen puts it in the modal footer. Stacked prompts put a smaller pair at the right of each label row.

| Surface | Actions, in menu order |
| --- | --- |
| Settings → Prompts | Duplicate, Rename, Import, Export, Publish (when the account can publish), Reset, Delete |
| Formaquestion → Prompts | Duplicate, Rename, Import, Export, Reset, Delete |
| Formaquestion → Mascot | Duplicate, Rename, Import, Export, View full screen, Reset (no confirm), Delete |
| Text endpoint, in both modals | Duplicate, Rename, Reset, Delete |
| Image endpoint | Duplicate, Rename, Reset, Delete. Delete hides while one preset remains. |

An endpoint preset has no Import or Export, because the file would carry an API token. A built-in preset keeps only Duplicate, Import, Export and View full screen where the surface offers them. A surface that passes no handler for an action drops that action from both widths.

### Production mapping

| Need | Component |
| --- | --- |
| Row, icons, confirm and focus return | `PresetHeader` in [`PresetHeader.tsx`](../src/components/presetHeader/PresetHeader.tsx) |
| The ⋯ menu | `PresetHeaderMenu` in [`PresetHeaderMenu.tsx`](../src/components/presetHeader/PresetHeaderMenu.tsx) |
| The one action list | `presetHeaderActions` in [`presetHeaderActions.ts`](../src/lib/presetHeaderActions.ts) |
| Badge | `EndpointReachabilityBadge` and `EndpointReachabilityView` in [`EndpointReachabilityBadge.tsx`](../src/components/modals/EndpointReachabilityBadge.tsx) |
| Probes | [`useEndpointReachable.ts`](../src/lib/useEndpointReachable.ts), [`probe.ts`](../src/lib/imageGen/probe.ts) |
| Reset and Compare | `PromptResetCompare` in [`PromptResetCompare.tsx`](../src/components/prompt/PromptResetCompare.tsx), its words in [`promptResetCompareCopy.ts`](../src/components/prompt/promptResetCompareCopy.ts) |
| Compare dialog | `PromptCompareDialog` in [`PromptCompareDialog.tsx`](../src/components/prompt/PromptCompareDialog.tsx) |
| Production hosts of the header | [`SettingsModal.tsx`](../src/components/modals/SettingsModal.tsx), [`FormaquestionPromptsTab.tsx`](../src/components/formaquestion/FormaquestionPromptsTab.tsx), [`FormaquestionMascotTab.tsx`](../src/components/formaquestion/FormaquestionMascotTab.tsx), [`TextEndpointEditor.tsx`](../src/components/modals/TextEndpointEditor.tsx) |
| Production hosts of the badge | The three above, and [`GenerateImageButton.tsx`](../src/components/GenerateImageButton.tsx) for the in-game image preset |
| Production host of the pair | [`SettingsModal.tsx`](../src/components/modals/SettingsModal.tsx) |
| Isolated reference | [`PresetHeaderReference.tsx`](../src/components/design-system/PresetHeaderReference.tsx) |

Build a new preset header from `presetHeaderActions` and `PresetHeader`. Do not draw a row of buttons by hand.

### Responsive behavior

- The header switches at `md`. `PresetHeader` takes `layout="wide"` or `layout="narrow"` to pin one form. Only the reference uses it, so both forms show at one viewport size.
- The select takes the free width and shrinks first. The label, the icons and the ⋯ button keep their size.
- The Reset and Compare pair on a label row wraps under the label when the row is too narrow, and stays right-aligned. It never covers the label.
- A badge line stays on one row. A long line truncates, and **Recheck** keeps its size.

### State reference

| State | Treatment |
| --- | --- |
| Editable | The full action set of the surface. |
| Built-in | Duplicate, Import, Export and View full screen only. No Rename, Reset or Delete. |
| Narrow | One **Preset Actions** button. The menu lists every action of the wide row. |
| One image preset | Delete hides until a second preset exists. |
| Heading form | A heading takes the place of the label and select. The same icons or menu follow it. |
| Checking | A pulsing gray dot, **Checking…**, and a disabled **Recheck**. |
| Reachable | A green dot and **Reachable**. |
| Missing model | A yellow dot and **Reachable, but no "name"**, or **Reachable, but no model** when the preset has no model name. |
| Unreachable | A red dot and **Didn't answer**. |
| Not checked | A gray dot and **Not checked**. |
| No badge | The Built-In Engine, NovelAI, the OpenAI image provider in the web build, and an image preset with image generation off. The row shows nothing. |
| Pair, edited | Reset and Compare are enabled. |
| Pair, at default | Reset and Compare are disabled. |
| Pair, built-in preset | The pair is hidden. |

The probe asks for a model list or node info and never sends a prompt, so no check costs credits. Open `#dev?modal=designSystem&tab=preset-header` for the header in both widths, every badge state, and the pair in the modal footer and on label rows. The sample actions change only local text.

### Writing review

The labels are **Preset**, **Duplicate**, **Rename**, **Import**, **Export**, **Publish**, **Reset**, **Delete**, **Preset Actions**, **Add New Preset…**, **Recheck** and **Compare**, all in Title Case. **View full screen** and **Exit full screen** keep the sentence case of the editor's own full-screen toggles. An icon's tooltip is its label, unless the surface passes a longer tip: the **Mascot** tab's tips say what each action does, such as "Make an editable copy of this mascot". The Reset and Compare tooltips are one sentence with no period. The badge lines are status text: one word or phrase, and the missing model name changes with the preset. Each confirm names what it changes, the preset or the prompt, and says "This can't be undone." The reference sample text and status lines were checked against the Writing Guide by copy role. This review does not certify the production confirm text as ASD-STE100 compliant.

## Pattern: Landing Pulse

**Purpose:** Point the eye at one row after a **Take Me There** landing, or after a link that jumps to a setting, such as the Mascot tab's off-state link to **General**. The ring runs once and stops.

> ✅ **Approved.** The user approved this pattern in the reference (2026-10-04). Production: Take Me There landings in the Settings dialog, on the game screen (the action box, the page buttons and the **Export Story** format buttons) and in the World Editor, the jump from a prompt's anatomy to a Messages field, and the Mascot tab's off-state link to the Mascot row of Formaquestion Settings → General.

**Density:** None of its own. The ring draws outside the row's box and changes no layout.

### Composition

- 🎯 **One row.** The ring goes on the whole row: the label, the control and its hint. It never goes on a section or a tab.
- ⭕ **Ring.** A 2px border in the `ring` color, 4px outside the row, drawn by a pseudo-element on the row. It is absolutely placed, so it moves nothing, and it grows by `transform` and fades by `opacity`, so it runs on the compositor, sub-pixel, and a busy main thread never stalls it. The row is `position: relative` while the ring shows. Use the pattern on rows that do not position their own children against the row.
- ⏱️ **Pulse.** 1500ms in all. The ring holds for the first 40%, then grows to 10px out and fades to clear. It runs once, and the class leaves the row when the animation ends.
- ♿ **Reduced motion.** The same ring, still, for the same 1500ms. Then it goes away at once.
- 🛑 **Canceled.** When the row hides mid-pulse, the class comes off with the animation.
- ⌨️ **Focus.** The landing focuses the row's control, not the label's ⓘ button. A row of buttons focuses its first enabled button, or its first live link button, such as a pager's. Where a control draws a select and a segmented group and hides one per width, focus goes to the one on screen. The control's own inset focus ring then sits inside the landing ring.
- 🔁 **Repeat.** A second landing on the same row restarts the pulse from the start.
- 📏 **Room.** The pulse reaches 12px past the row. Give the row at least that much padding inside its scroll area, or the fade clips. `landingRoom` on `ScrollArea` adds it and keeps the rows in place. A target row keeps a 12px scroll margin, so a scroll to an edge leaves the same room.

### Production mapping

| Need | Component |
| --- | --- |
| Add the class, restart it, take it off on animation end | `pulseLanding` in [`landingPulse.ts`](../src/lib/landingPulse.ts) |
| The control to focus | `landingControl` in [`landingPulse.ts`](../src/lib/landingPulse.ts) |
| The ring, the pulse and the still ring | `.landing-pulse` and `.landing-ring` in [`index.css`](../src/index.css) |
| Wait for the row, scroll, focus and pulse once per request | `useLanding` in [`useLanding.ts`](../src/lib/surface/useLanding.ts) |
| Mark a row as a target | The `target` prop of `Row`, `CheckRow` and the other shared rows, from `targetAttribute` in [`surfaceTargets.ts`](../src/lib/surface/surfaceTargets.ts) |
| Find a target's row | `findTargetRow` in [`surfaceTargets.ts`](../src/lib/surface/surfaceTargets.ts) |
| Room for the ring in a scroll area | `landingRoom` on `ScrollArea` in [`scroll-area.tsx`](../src/components/ui/scroll-area.tsx) |
| Isolated reference | [`LandingPulseReference.tsx`](../src/components/design-system/LandingPulseReference.tsx) |

`pulseLanding` reads the system's reduced-motion setting, and a caller can pass `reducedMotion` to choose. It returns a cancel for unmount.

Open `#dev?modal=designSystem&tab=landing-pulse` for a sample Settings tab in both themes. Pick a **Target Row**, check **Reduced Motion** for the still ring, then press **Play Landing** in either theme.

### Responsive behavior

- At `sm` and wider, the ring wraps the label column and the control column as one row.
- Below `sm`, the row stacks, and the ring wraps the label, the control and the hint.
- The ring and its pulse are the same at every width.

### State reference

| State | Treatment |
| --- | --- |
| Idle | No ring. The row has no landing class. |
| Pulse | The `landing-pulse` class: the ring holds, then grows and fades. |
| Reduced motion | The `landing-ring` class: the ring holds without movement, then goes away. |
| Ended | The class is off the row. A later landing adds it again. |
| Canceled | The row hid mid-pulse. The class is off the row. |
| Repeat | The pulse restarts from the start. One end takes the class off. |
| Focus | The control's inset focus ring shows inside the landing ring. |

### Writing review

The pattern adds no player-facing text. The reference labels **Play Landing**, **Target Row** and **Reduced Motion** are Title Case. The row labels and hints come from the production Settings copy. The card description is one sentence with a period, as the other references have. This review is local; it does not certify STE compliance.

## UI and prototype workflow

The project `design-system` skill routes UI changes and prototypes here. Use the applicable named pattern and its production components, then inspect the result through the live reference. Agents verify established patterns themselves and report desktop/mobile states, theme/font inheritance, interaction results, and static evidence.

For a new pattern, add a reference to the showcase registry and show it inside a representative Formamorph app screen at desktop and mobile sizes. The showcase is where the user approves it. Until the approval note is on its section here, the pattern is a proposal and no production surface adopts it.

The reference navigation uses equal flexible columns that wrap into additional rows. Every tab keeps enough width for its label, so all references remain readable and reachable without horizontal page scrolling.

## Adding an approved pattern

The live shell renders `DESIGN_SYSTEM_REFERENCES` from [`DesignSystemShowcase.tsx`](../src/views/DesignSystemShowcase.tsx). Add one definition with an ID, label, description, and production-backed component; the reference navigation and responsive shell update from that registry.

Add a matching `## Pattern:` section here with its purpose, density, desktop/mobile behavior, component mapping, and applicable states. Mark it a proposal until the user approves it in the showcase, then record the approval on the section before any production surface adopts it.

Keep the guide and registry synchronized when an approved reference changes; retain the existing shell and shared semantic values.
