# Formamorph Design System

This guide and the live showcase are the visual authority for Formamorph. They document approved patterns; they do not authorize an app-wide redesign.

> **Open the live reference:** run the development app, then open `#dev?modal=designSystem` or call `window.__fmDev.goto(undefined, { modal: 'designSystem' })`.

The showcase uses production components and local demonstration state. It does not save preferences or call an endpoint, and its lazy route is excluded from production builds.

## Visual foundations

Use semantic values from the app. Do not sample colors from screenshots; HDR and display processing can change them.

| Foundation | Approved source | Use |
| --- | --- | --- |
| Color | [`src/index.css`](../src/index.css) | Use `background`, `foreground`, `card`, `muted`, `accent`, `border`, `input`, `ring`, and semantic status tokens. All supported light/dark palettes override these values. |
| Typography | [`tailwind.config.js`](../tailwind.config.js) and [`typography.tsx`](../src/components/ui/typography.tsx) | Choose the role: `display`, `heading`, `title`, `body`, `label`, `helper`, or `meta`. Use `Hint`, `FieldError`, `SectionTitle`, and `Meta` for secondary text. |
| Font | [`settingsDefaults.ts`](../src/contexts/settingsDefaults.ts) | Inherit `--app-font`. Production font choices and per-font tuning remain authoritative. |
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
| Approved compositions | Display and Output in [`SettingsModal.tsx`](../src/components/modals/SettingsModal.tsx) |

### State reference

| State | Treatment |
| --- | --- |
| Default | Show a valid initial value with the normal border and text roles. |
| Selected | Use the production selected fill, foreground, and shadow. Do not add a second selection mark unless the control already has one. |
| Disabled | Keep the value readable, reduce opacity, and explain why it is unavailable when the reason is not evident. |
| Focus | Use the shared visible focus ring. Keyboard focus must not rely on hover. |
| Validation | Set `aria-invalid`, connect the message with `aria-describedby`, and use `FieldError`. |
| Overflow | Constrain the control column and preserve the full value through its menu, title, or detail view. |

The live Settings reference shows all six states. Its Display and Output examples reuse the same rows, options, theme registries, font registries, and controls as production.

## Pattern: Focused Markdown Authoring

**Purpose:** Keep long-form source editing dense while making the rendered result one clear switch away.

**Density:** Compact controls, comfortable content. Toolbar buttons use the production 1.75rem control height and one-unit gaps; the editor keeps a 1rem internal text rhythm and a substantial scrollable work area.

### Composition

- Put the field label above the toolbar so the complete toolbar can use the control row.
- Keep common inline actions visible: bold, italic, strikethrough, inline code, and blockquote.
- Group highlight, heading, list, and insertion choices as split buttons. The face runs the current action; the chevron opens the group.
- Keep each split button visually joined, including its internal divider. Separate formatting, history, and view groups with vertical hairlines.
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

## Pattern: Image-Led Community Creation Cards

**Purpose:** Let readers scan community creations through their artwork while keeping the name, author, summary, social proof, and secondary actions easy to find.

**Density:** Compact. Artwork dominates the first impression; the details beneath it fit a description, one three-part count row, and up to two rows of tags before an overflow disclosure.

### Composition

- Keep the creation title and author on its thumbnail over the shared title scrim. A long title expands to three lines on hover and keeps its full value in a tooltip when clipped.
- Put a concise description below the art, then align likes, downloads, and comments across one row.
- Put tags after counts. Show two rows in the resting card and disclose the remainder on hover rather than making every card taller.
- Keep the contextual download control in the art’s top-right corner. Other secondary actions remain in their established contextual placements.
- Use controlled callbacks in the showcase. The reference never opens a listing, publishes, downloads, deletes, or changes a like outside its local state.

### Production mapping

| Need | Component |
| --- | --- |
| Frame, artwork, title scrim, author, and description | `WorldCardShell` in [`WorldCardShell.tsx`](../src/components/WorldCardShell.tsx) |
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
| Overflow | Titles clamp in the resting card and expand up to three lines on hover; a tooltip preserves clipped titles. Tags disclose after two rows. |
| Action | The update action and favorite callback report local outcomes only. |

The live Community cards reference uses the production card and shell with neutral, controlled fixtures. It covers long titles, descriptions, tags, counts, selected likes, pending actions, keyboard focus, and update affordances without touching community data.

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
- Put required stat choices and numeric parameters in the same form. Show validation beside the affected field and connect it to the control's accessible description.
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

## Functional writing

Keep setting descriptions to one sentence, third person, and no more than 12 words. Put necessary additional detail behind `HintInfo`. Do not claim ASD-STE100 compliance from length or tone alone; use the vocabulary, grammar, meaning, and evidence process in the [Writing Guide](Writing-Guide.md).

Apply that guide by role to all approved patterns: settings labels and information, markdown toolbar names and instructions, card action names and status messages, Find controls and status text, and Code Template fields, validation, and actions. Accessible text receives the same review as visible text. World introductions, creation titles, descriptions, and tags are authored content; these samples retain their own voice. Existing production copy is not certified by reuse in the showcase.

The foundation's [review record](../docs-internal/designs/design-system/workflow-review.md) records copy findings, evidence limits, and the two workflow demonstrations. Existing-screen alignment remains separate work.

## UI and prototype workflow

The project `design-system` skill routes UI changes and prototypes here. Use the applicable named pattern and its production components, then inspect the result through the live reference. Agents verify established patterns themselves and report desktop/mobile states, theme/font inheritance, interaction results, and static evidence.

For a new pattern, show a proposal inside a representative Formamorph app screen at desktop and mobile sizes. Keep it separate from the approved registry until the user approves that concrete proposal. Record the approval with the artifacts before adoption.

The reference navigation uses equal flexible columns. Labels can wrap on narrow screens so every reference remains reachable without horizontal page scrolling.

## Adding an approved pattern

The live shell renders `DESIGN_SYSTEM_REFERENCES` from [`DesignSystemShowcase.tsx`](../src/views/DesignSystemShowcase.tsx). Add one definition with an ID, label, description, and production-backed component; the reference navigation and responsive shell update from that registry.

Add a matching `## Pattern:` section here with its purpose, density, desktop/mobile behavior, component mapping, and applicable states. Demonstrate a new visual pattern inside a representative Formamorph screen at desktop and mobile sizes, then get product approval before adding it to this reference.

Keep the guide and registry synchronized when an approved reference changes; retain the existing shell and shared semantic values.
