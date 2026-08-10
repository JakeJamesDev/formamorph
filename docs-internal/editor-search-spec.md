# World Editor Search & Replace — Spec

Find any text across every authored field in the World Editor, step through matches in place, and replace with text **or a Placeholder chip**. Interviewed and agreed 2026-08-09; **built the same day** — this doc is now the record of what shipped.

**Where it lives:** [worldSearch.ts](src/lib/worldSearch.ts) (inventory + matcher, pure) · [EditorFindBar.tsx](src/components/editor/EditorFindBar.tsx) (the bar) · [editorFieldFocus.ts](src/lib/editorFieldFocus.ts) (locate, scroll, mark) · wiring in [WorldEditor.tsx](src/views/WorldEditor.tsx) · tests in [worldSearch.test.ts](src/lib/worldSearch.test.ts).

## Placement & Chrome

- A **magnifier icon button** in the editor's `headerBar` (next to Save/Export cluster in `WorldEditor.tsx`).
- Clicking it — or **Ctrl+F** anywhere in the World Editor — opens a **floating find bar** overlaying the top-right of the content area (browser/VS Code style popover). No layout space consumed when closed.
- **Ctrl+H** opens the bar with the replace row already expanded. **Esc** closes.
- Ctrl+F overrides browser find only while the World Editor is mounted.

## Find Bar Layout

```
┌──────────────────────────────────────────────┐
│ 🔍 [search input......]  Aa  W   3 / 23  ‹ › ✕│
│ ⇄ [replace input... | {chip picker}]  [Replace] [All] │
└──────────────────────────────────────────────┘
```

- **Aa** = match-case toggle (default off → case-insensitive). **W** = whole-word toggle.
- No regex mode.
- **Match counter** ("3 / 23") updates live as you type, **debounced ~200 ms** — worlds are small enough to scan in memory.
- Replace row hidden by default; a disclosure toggle (or Ctrl+H) reveals it.

## Search Scope

**In:** every authored string field across all tabs — world overview text, stat names/descriptions, entity fields, location text, trait text, dictionary entry text — **plus string-array fields** (dictionary keys, entity aliases, image tags).

**Out:**
- **Stat code** (the QuickJS editors) — excluded.
- **Placeholder chip internals** — chips are stored as `{{ph:id:mode:placementId}}` tokens ([placeholders.ts:31](src/lib/placeholders.ts:31)). Search runs over the **literal segments** of `parsePlaceholderText()`, never raw stored strings, so token guts can't match and a match can never straddle a chip.

## Match Navigation

- **Enter / F3** = next match; **Shift+Enter / Shift+F3** = previous. Wraps around.
- Stepping to a match **navigates the editor**: switches to the owning tab, selects/expands the owning item in its tree, scrolls the field into view, and **highlights the matched text** in the field.
- Highlight style: a temporary selection/mark on the matched range; fades or clears on next edit or step.

## Replace

Two replacement modes, switched by a **toggle in the replace row**:

### Text mode
Plain string replaces the matched range.

### Placeholder mode
- The replace input becomes a **placeholder picker**: lists existing placeholders, plus a **"Create…"** row that mints a new one inline (name defaulted from the search text) without leaving the bar.
- Each replacement inserts a chip token via `encodePlaceholderToken` with a **fresh `placementId` per occurrence**; mode (World/Unique) follows the picker's chip settings, same as manual insertion.
- **Fields that can't render chips are skipped** and the completion summary reports how many were skipped and where. (Names/aliases/keywords already take chips per the placeholder-names feature — verify at build time; the skip path may end up dead but stays specified.)

### Actions
- **Replace** — replaces the current highlighted match, steps to next.
- **Replace All** — first shows a confirmation: *"Replace 23 matches across 9 fields?"* — then commits in one pass.
- **Undo**: none beyond the editor's existing model — writes go through the normal GameDataContext setters and **Discard Changes** is the rollback, same as any edit. No snapshot/toast.

## Implementation Notes

- **Match model**: a scan produces `{ tab, itemId, fieldPath, start, end }[]` from a single walk of the world object using the same field inventory the editor renders. Array fields address as `fieldPath[index]`.
- **Navigation** reuses existing tab state ([worldEditorTabs.ts](src/views/worldEditorTabs.ts)) and tree selection; scrolling via `scrollIntoView` after the tab/item render settles.
- Writes go through the managers' existing write-through setters — search never touches world JSON directly, and **gameplay/GameDataContext boundaries are untouched** (editor-only feature, no export-shape change).
- Rescan after any replace (offsets shift); the debounced live scan already covers this.
- Dev-router: the find bar should be reachable via `__fmDev.goto` (modal/flag entry in `devRoutes.ts`) for UI verification.

## Changed During The Build

Three things the spec got wrong, found by verifying in the live editor:

1. **The marker can't be a text selection.** A browser paints a selection only in the *focused* control, so highlighting the match meant focusing the field — which redirected the author's typing out of the search box on every keystroke. The hit is now marked without taking focus: an amber ring on the field, plus a `::highlight()` range inside prose fields (the Highlight API reaches contenteditable text nodes; it cannot reach an `<input>`'s internals).
2. **The field lookup needs the field's whole value, not the matched word.** Several fields on one panel routinely contain the same word, so matching on the word alone always marked whichever rendered first. Candidates are now scored by how much of their text matches the target's, with an exact match winning outright.
3. **Replace All has to merge per record.** Every updater replaces the whole object, so two matches in two fields of one entity, written separately, each undid the other — one edit silently lost. Edits now fold onto a single copy of each record and commit once. Guarded by a test.
4. **The ring has to be inset.** An `outline` sits outside the box, where the panels' ScrollArea `overflow: hidden` clips it — so it showed only on fields that already had a border of their own. It's `box-shadow: inset` now, which nothing can clip and which needs no border on the field.
5. **Plain fields get a mirror.** `::highlight()` reaches contenteditable text nodes but not an `<input>`'s internals, so a copy of the control's text is laid over it with the match marked and everything else transparent. It is anchored in the field's **own wrapper**, made a containing block for the purpose: `offsetParent` is frequently outside the scrolling viewport, and an absolute child follows its containing block rather than its DOM parent, so anchoring there left the mark behind whenever the panel scrolled.

The bar sits at the **top left** of the editor area — the detail pane holds most of what a search finds and it is the right-hand half.

## Round 3 — Built 2026-08-10

Five fixes, causes confirmed by reproduction before any code changed:

1. **Stale highlight while typing.** The navigate effect re-fires on `fieldKey`/`itemId`/`start` only ([EditorFindBar.tsx:73](../src/components/editor/EditorFindBar.tsx:73)); extending the query ("cit" → "city") keeps the same start, so the marker keeps the old length and never re-reveals. Fix: include the matched text in the effect's identity so every query change re-reveals.
2. **Ctrl+F / Ctrl+H also opens browser find.** The shortcut listener is bubble-phase on `window` ([WorldEditor.tsx:182](../src/views/WorldEditor.tsx:182)); when focus sits in a component that stops keydown propagation (Lexical fields do), our `preventDefault` never runs. Fix: register with `capture: true`.
3. **Aa / W toggles show no state.** They're Radix `ToggleGroupItem`s in a `type="multiple"` group that's never given a `value`, so Radix's own always-off state overrides the hand-set `data-state` — they never render pressed. Fix: replace with a real split button — two segments sharing a border with a separator between, an enabled segment turning `bg-primary text-primary-foreground`.
4. **Placeholder-replace in Values/Tags silently does nothing.** Confirmed with the user: the field was Placeholder Values. `replaceCurrent` on a non-chip field gets `insert === null` and just steps ([EditorFindBar.tsx:95](../src/components/editor/EditorFindBar.tsx:95)) — with one match, visibly nothing. (Chip-capable chip lists are fine: verified live that an alias becomes a mixed chip-in-chip tag.) Fix: **notice + step** — the bar shows "*<Field>* can't hold a chip — skipped", mirroring Replace All's report.
5. **Double-click renames a placeholder chip.** Committing an inline edit renames the placeholder itself, everywhere. Wired through a new optional `ChipVocabulary.rename`, supplied by `usePlaceholderChipVocabulary` — a hook that reads whatever `PlaceholderStore` is bound, so no field has to thread an updater down to its chips and chips outside an editor are simply not renameable. Two things this turned up:
   - The Values chips were broken for a reason unrelated to renaming: `PlaceholderManager` wrapped a chip in `PopoverAnchor` **only while its weight pop-out was open**, so the first click replaced the chip's DOM node and the second landed on a different element. Every chip now gets the same wrapper and the pop-out hangs off a `virtualRef`.
   - The palette inserts on mouse-down, so the first half of a double-click had already dropped a chip into the claimed field. `ChipInsertTarget` now also exposes `undo`, and the rename takes that insert back through the field's own history. Waiting to see whether a second click arrives was rejected: it would delay every insert to serve the rarer gesture.

   Single click keeps its meanings (World/Unique pop-out; weights pop-out). KeywordChips *tags* keep double-click-edits-the-tag — deliberately unchanged.

## Settled Calls

1. **Placeholder-replace mode hides in Simple editor mode** — consistent with the `advancedOnly` Placeholders tab. Simple mode gets text replace only.
2. Jumping to a match **auto-expands collapsed tree ancestors and leaves them expanded** — no expansion-state restore on close.
3. **No scope filter, permanently** — whole-world search only.
