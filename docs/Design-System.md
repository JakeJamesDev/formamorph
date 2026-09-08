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

## Functional writing

Keep setting descriptions to one sentence, third person, and no more than 12 words. Put necessary additional detail behind `HintInfo`. Do not claim ASD-STE100 compliance from length or tone alone; use the vocabulary, grammar, meaning, and evidence process in the [Writing Guide](Writing-Guide.md).

Apply that guide by role to all three patterns: settings labels and information, markdown toolbar names and instructions, and card action names and status messages. Accessible text receives the same review as visible text. World introductions, creation titles, descriptions, and tags are authored content; these samples retain their own voice. Existing production copy is not certified by reuse in the showcase.

The foundation's [review record](../docs-internal/designs/design-system/workflow-review.md) records copy findings, evidence limits, and the two workflow demonstrations. Existing-screen alignment remains separate work.

## UI and prototype workflow

The project `design-system` skill routes UI changes and prototypes here. Use the applicable named pattern and its production components, then inspect the result through the live reference. Agents verify established patterns themselves and report desktop/mobile states, theme/font inheritance, interaction results, and static evidence.

For a new pattern, show a proposal inside a representative Formamorph app screen at desktop and mobile sizes. Keep it separate from the approved registry until the user approves that concrete proposal. Record the approval with the artifacts before adoption.

The reference navigation uses equal flexible columns. Labels can wrap on narrow screens so every reference remains reachable without horizontal page scrolling.

## Adding an approved pattern

The live shell renders `DESIGN_SYSTEM_REFERENCES` from [`DesignSystemShowcase.tsx`](../src/views/DesignSystemShowcase.tsx). Add one definition with an ID, label, description, and production-backed component; the reference navigation and responsive shell update from that registry.

Add a matching `## Pattern:` section here with its purpose, density, desktop/mobile behavior, component mapping, and applicable states. Demonstrate a new visual pattern inside a representative Formamorph screen at desktop and mobile sizes, then get product approval before adding it to this reference.

Keep the guide and registry synchronized when an approved reference changes; retain the existing shell and shared semantic values.
