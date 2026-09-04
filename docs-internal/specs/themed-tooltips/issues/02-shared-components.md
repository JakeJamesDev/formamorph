# 02 — Shared components sweep

Status: done
Blocked by: 01

Convert the shared chrome that centralizes many tooltips at once:

- Editor row actions (`EditorRow` action `title` + `metaTitle`) — one edit covers most editor surfaces.
- Utility components, prompt field chrome, and any other shared component exposing a `title`-ish prop.
- Apply the spec's three buckets (tooltip+aria-label / tooltip only / aria-label only). Non-interactive carriers become focusable.
- Triggers must forward refs (Base UI `render` prop).

Static-frame evidence on a representative editor surface, both themes. Gates green.

## Comments

**What was converted.** `EditorRow` (grip, checkbox, meta, actions) · `UtilityComponents` (image remove,
URL commit, remote badge, sound remove, model remove) · `PromptField` · `CodeArea` · `Chip` ·
`TokenChip` · `EditableChip` · `PlaceholderText` · `PlaceholderPaletteBar` · `ReadOnlyNotice` ·
`SettingsRows` (both markers) · `AiGenerateButton` · `TagHistoryButtons` · `ImageZoomViewer` ·
`GenerateImageButton` · `PlaceBadges` · `WorldDetails` · `useVrmCustomization` · `scroll-area` marks.

**Prop rename, for later tickets.** `Chip` and `TokenChip` take `tip`, not `title`. Three
`CommunityFilterBar` call sites and one `RequestAnatomyView` call site were renamed with them.
`EditableChip` was smuggling a `title` through `dragProps` onto the chip span; it now passes `tip`.

**Focusability rule as applied.** The spec's "non-interactive carriers become focusable" was read as: a
*discrete marker* whose tip is its only content takes `tabIndex={0}` — the Experimental flask, the
Recommended sparkle, the linked-image badge, and `EditorRow`'s meta (only while it has a tip). *Dense
repeated inline content* does not: chips and placeholder pills run dozens to a list, their visible text
carries the meaning, and the prompt editor's chips sit inside a contenteditable where an added tab stop
is a regression. `ReadOnlyNotice` also stays unfocusable — its row holds a real button, and a tab stop
wrapped around one reads as a control that does nothing. Follow this split in tickets 03 and 04.

**Third bucket applied once.** `CodeArea`'s insert menus wear their label beside the icon, so they kept
`aria-label` and lost the tip rather than repeating the visible word. `PromptField`'s insert palette
drops its tip while inert for the same reason.

**Lint.** `Checkbox` and `PopoverTrigger` were added to `REF_SAFE_COMPOSED_CHILDREN`.

**Two triggers on one button.** `<Tip><PopoverTrigger asChild><button/></PopoverTrigger></Tip>` works:
the trigger merges onto `PopoverTrigger`, which passes both sets of props down through its own
`asChild`. Verified live — the chevron carries `aria-haspopup="dialog"` and
`data-base-ui-tooltip-trigger`, opens its tip on focus, and opens its menu on click.

**Wrapper tests added** (not per-site tests — these are the seams the sweep leans on and ticket 01 did
not pin): the child keeps its own ref, and a tip composes over a Radix `asChild` trigger. Both proved by
mutation.

**Test relocations.** Three suites queried a `title` the sweep removed.
`UtilityComponents.imageUrl.test.tsx` now focuses the badge and reads the tip — the behavior that
replaced the attribute, and it fails if the tab stop is removed. `EditorRow.test.tsx` and the two
placement suites re-locate by role name or visible text, assertions untouched.

**Live proof.** World Editor stats and dictionary trees, viewport 1440×900. Action tip measured off
computed styles in both themes — dark `bg rgb(29,32,37)` / `fg rgb(244,244,246)` / `border
rgb(55,59,67)`, light `rgb(252,252,253)` / `rgb(26,29,35)` / `rgb(221,223,228)`, each matching its
`--popover` / `--popover-foreground` / `--border` token; `text-helper` 14px both. Grip carries
`aria-label="Drag to reorder"` with dnd-kit's own `tabIndex 0` and no `title`. Meta raises "Entries" on
hover. Tabbing to the Experimental flask opens its tip with `data-instant="focus"`.

**Gates.** typecheck 0 · lint 0 errors (2 pre-existing tsdoc warnings in `localNetworkEmbed.ts`) ·
6864 tests pass in 41.6 s · build 16.7 s. Playwright e2e also run: 68 passed, 26 skipped, 3.7 min — it
locates the fullscreen and split-toggle buttons by accessible name, so it is the proof that Base UI
applies the tip as the name in a real browser.

**Left for tickets 03/04.** `RevealAnimationDemo` (no importers), `AiSetupGate` (its `title=` are
component props, not DOM), and every view-level surface: SettingsModal, MainMenu,
CommunityCreationsBrowser, GameViewer, GamePanels, MemoryManagerModal, the community cards and filter
bar, `EditorFindBar`, and the editor instruments.
