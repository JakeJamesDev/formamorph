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

## Writing in settings

Keep setting descriptions to one sentence, third person, and no more than 12 words. Put necessary additional detail behind `HintInfo`. Do not claim ASD-STE100 compliance from length or tone alone; use the vocabulary, grammar, meaning, and evidence process in the [Writing Guide](Writing-Guide.md).

## Adding an approved pattern

The live shell renders `DESIGN_SYSTEM_REFERENCES` from [`DesignSystemShowcase.tsx`](../src/views/DesignSystemShowcase.tsx). Add one definition with an ID, label, description, and production-backed component; the reference navigation and responsive shell update from that registry.

Add a matching `## Pattern:` section here with its purpose, density, desktop/mobile behavior, component mapping, and applicable states. Demonstrate a new visual pattern inside a representative Formamorph screen at desktop and mobile sizes, then get product approval before adding it to this reference.

The community card ticket extends this registry and guide. It does not need a new showcase shell or another token set.
