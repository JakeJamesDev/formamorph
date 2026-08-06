# Placeholders in Names — Design Memo

Extension of the Placeholders feature (`docs-internal/placeholders-design.md`): placeholder chips become legal inside **name fields**, not just description/prompt text. Spec agreed 2026-08-06; no code yet.

## Scope — the seven name surfaces

| Surface | Field | Notes |
|---|---|---|
| Entity name | `Entity.name` | The headline case |
| Entity aliases | `Entity.aliases[]` | Tag chips; mixed inline text+chip per tag |
| Location name | `GameLocation.name` | |
| Stat name | `Stat.name` | Highest blast radius — matched by name everywhere |
| Trait name | trait node `name` | Trait picker + prompt references |
| Dictionary entry name | entry `name` | Goes into the AI prompt |
| Dictionary keywords | `key` / `secondaryKeys` arrays | Activation matching runs on resolved keywords |

**Explicitly out (deferred):** world name/title, scene-image tags, `worldOverview.description`/readme (still excluded from the base feature too).

## Decisions

- **Wildcard modes: both allowed.** World = one shared roll (same identity everywhere it's placed); Unique = per-placement roll — the motivating case is one "Tavernkeeper Names" wildcard naming two different tavern keepers in different towns. Chip popout behaves exactly as in text fields.
- **Missing/empty placeholder resolves to `""`**, same as text fields — even if that leaves a nameless entity. No fallback, no delete-blocking. A future **world linter** (natural home: the world-doctor effort, `docs-internal/world-doctor-spec.md`) warns about it; not built here.
- **Resolved-name collisions** (two entities rolling the same name in a save): no prevention, no reroll. Runtime matching picks deterministically (first match in iteration order). Warning is also the future linter's job. *(User expressed no preference; this is the recommendation consistent with the linter decision.)*
- **Author-time matching tools use preview rolls.** The activation tester and AI-context dictionary highlighting have no save; they resolve via the existing preview machinery (`buildPlaceholderPreview` / `primeRolls` in `src/lib/placeholders.ts`) — one consistent roll per open, clearly a simulation.

## Editor UI

- **Single-line chip field**: a new variant of `PlaceholderField` (`src/components/prompt/PromptField.tsx` under the hood) — chips inline, Enter/newline disabled, no toolbar, no Edit/Preview tabs. Replaces the plain `Input` on all seven surfaces.
- **Tag lists** (`src/components/KeywordChips.tsx`, used by aliases + dictionary keywords + placeholder values): each tag's input becomes the single-line chip field too, so a tag can mix text and chips ("Old {TavernName} keeper"). Heaviest UI slice. Placeholder *values* themselves stay plain (no nesting — unchanged rule).
- **Editor lists, dropdowns, trait tree, search show author preview** — resolved names (Variable→value, Wildcard→preview roll), same spirit as the Preview pane. Includes `WorldEditor.tsx` item search (`src/views/WorldEditor.tsx:341`), stat pickers (`src/managers/TraitManager.tsx`, `StatUpdatesManager.tsx`), and anywhere else a raw `item.name` renders in the editor.

## Insert UX — typeahead + editor-level palette

Decided from an interactive mock-up (2026-08-06). The per-field always-visible Insert row (`VariableToolbar` in `PromptField.tsx`) **goes away for placeholder fields** — with many placeholders it costs 1–2 wrapped rows per field, untenable once every name input and alias tag is a chip field. Applies to ALL PlaceholderFields (new single-line + existing multi-line); the settings prompt chip editor (static `<…>` family) keeps its toolbar unchanged.

**B — `{` typeahead (primary insert path):** typing `{` in any chip-capable field opens an inline autocomplete over placeholder names at the caret; continue typing to filter, Enter/click inserts the chip, Esc cancels, Backspace past the `{` dismisses. Discoverability: empty chip fields carry a ghost hint ("… `{` inserts a placeholder"). Wildcard World/Unique mode is still chosen on the inserted chip's pop-out, unchanged.

**D — editor-level palette (visible companion):** ONE sticky strip at the top of each manager panel (right-hand editing pane in WorldEditor tabs; modal body in the library editors) listing all the world's placeholder chips — not repeated per field. Click a chip → insert at the caret of the last-focused chip field; drag-into-field also works. Wraps to extra lines when the list is long. Collapsible to a single "Placeholders ▸" button; collapsed state is a **global editor preference** (localStorage), one setting across the world editor. The strip doubles as at-a-glance documentation of what placeholders exist while authoring.

Panels with no chip-capable field focused yet default the palette's target to the first chip field; the focused target is visually indicated. If the world defines zero placeholders, neither the strip nor the hint renders (matches the existing `hasPlaceholders` gating in `PlaceholderField.tsx`).

## Runtime — the real work

Names are compared as raw strings all over gameplay. Every matching/consumption site must see the **resolved** name (same save rolls the player and AI see). Known sites:

- **Entity presence/participation**: `matchNames` callers — `src/views/GameViewer.tsx`, `src/lib/stagedPlanning.ts`, the visitor pull in `src/lib/locationContext.ts` (also its `byLowerName` map at `locationContext.ts:219`).
- **Stat matching**: AI-reply stat changes and stat-code result matching by `stat.name.toLowerCase()` — `GameViewer.tsx:761,1162,1243,2383`; stat bars/drain maps in `src/components/game/GamePanels.tsx` (`recentStatChanges` etc. keyed by lowercased name).
- **QuickJS stat sandbox**: the exposed `name` field is the resolved name.
- **Scene entities / image tags**: `src/lib/sceneTags.ts` matches on names/aliases; `GamePanels.tsx:111` file↔scene-entity name matching.
- **Dictionary activation**: keyword matching runs on resolved keywords; per-save-varying activation is accepted behavior.
- **AI context**: `buildContextValues` and friends already run `resolvePH` — audit that every name string flowing into `GamePrompts.ts` passes through it (entity lists, stat lists, trait names, dictionary entry names).

**Approach**: don't sprinkle `resolvePH` at every comparison — derive a resolved read-only view (memoized selector over world + `placeholderRolls`) and make the matching sites consume it. Gameplay still never writes GameDataContext (hard constraint #5); this is derivation, not mutation. Roll priming (`primeRolls` at save activation) already covers eager availability; name tokens just join the primed set.

## Portability / compatibility

- **No export-shape change**: tokens live inside existing string fields. But worlds/cards authored with name-placeholders show raw `{{ph:…}}` text in app versions predating this feature — a version-gating consideration for the user at release time.
- `collectUsedPlaceholders` / `remapPlaceholderIds` (entity-card + dictionary export/import, `src/lib/entityFile.ts` etc.) extend to scan name, aliases, and keyword fields so carried defs stay complete.

## Suggested slices

1. **Core plumbing**: token support in the seven fields' storage paths + resolved-view derivation + runtime matching sites consume it. (Ship-blocking correctness.)
2. **Editor UI**: single-line chip field + swap-in on plain-name surfaces + author-preview in lists/search + the `{` typeahead and per-panel palette strip (Insert rows removed from placeholder fields).
3. **Tag lists**: mixed-inline chips in `KeywordChips` (aliases, keywords).
4. **Author-time tools**: activation tester + AI-context highlighting on preview rolls; export/import scanning.

## Open questions

- Discovered/runtime entities (`runtimeCharacters.ts`) keep plain-string names — no tokens ever minted at runtime. (Assumed; flag if wrong.)
- Sorting in editor lists: sorts by preview-resolved name (assumed, follows the display decision).
