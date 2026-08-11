# Stat Code Templates — design spec

Templates for the Dynamic Value Calculation sandbox: a shipped built-in set plus a user-created
local library, applied through parameterized fill-in forms.

## Template model

```ts
interface StatCodeTemplate {
  id: string;          // crypto.randomUUID(); built-ins use stable literal ids
  name: string;
  description: string; // shown in the picker; names BOTH uses of merged templates
  code: string;        // JS with inline slots
}
```

No world/save shape changes. User templates live in a new IndexedDB store (global across
worlds); built-ins are a bundled constant, read-only, with **Duplicate to My Templates**.

## Slot syntax

Slots are written inline in the code body and parsed to derive the fill-in form:

```
{{name:type}}            required, no default
{{name:type=default}}    prefilled
```

| type | Form control | Generates |
|---|---|---|
| `stat` | dropdown of the current world's stats | the exact stat name as a quoted string |
| `number` | numeric input | the number literal |
| `daypart` | dropdown of the six dayparts | quoted daypart string |
| `choice(a\|b\|…)` | dropdown of the listed options | the option verbatim (used for operators/directions) |
| `text` | free text input | verbatim (escape hatch) |

Rules:
- Repeated `{{name:…}}` with the same name = one form field, substituted everywhere.
  First occurrence defines type/default; later occurrences may be bare `{{name}}`.
- Parser is a plain regex pass; malformed slots surface as a form-level error, not a crash.
- Insertion is **one-way**: the form generates ordinary editable JS into the textarea; no
  template linkage is stored on the stat.

## Built-in roster (8)

Merged design: signed rates and comparison/direction slots collapse mirror-image pairs.
Every template must be Test-Code-verified against the real QuickJS sandbox before shipping.

| # | Name | Slots | Code sketch |
|---|---|---|---|
| 1 | Weighted Blend | `a:stat`, `b:stat`, `weight:number=0.5` | `aVal*w + bVal*(1-w)` — weight 0.5 = plain average |
| 2 | Inverse of a Stat | `source:stat` | source's `max - value`, read from the found stat's own max |
| 3 | Threshold Flag | `source:stat`, `op:choice(>=\|<=)`, `threshold:number` | `return sourceVal op threshold ? max : min` (uses this stat's own min/max, not hardcoded 0/100) |
| 4 | Per-Turn Change | `rate:number=-5` | `value + rate * deltaHours` — negative drains (hunger), positive fills (growth) |
| 5 | Timer | `total:number=24`, `direction:choice(down\|up)` | fraction `elapsedHours/total`, clamped; down = `1 - fraction`; scaled to this stat's range |
| 6 | Daypart Modifier | `base:stat`, `when:daypart=night`, `bonus:number=20` | `baseVal + (daypart === when ? bonus : 0)` |
| 7 | Random Per-Turn Roll | — | `(Math.random() * 100 + elapsedHours) % 100` scaled to range; comment warns a second random stat in the same world correlates |
| 8 | Regen Toward Target | `target:number`, `rate:number=0.1` | `value + (target - value) * rate * deltaHours` — target = max gives soft-cap regen |

Sandbox facts the code must respect:
- 4, 6, 7, 8 name a clock var → self-qualify for the every-turn run gate. 1–3 are derived
  stats and correctly run only on stat change. 5 uses `elapsedHours` → every turn.
- Rate templates (4, 8) override the `regen` field; their descriptions say "leave Regen at 0."
- All lookups via `stats.find(s => s.name === '…')?.value ?? 0` with the generated name string
  (the stat picker exists to kill name typos).
- Must `return` a number; host clamps to min/max, so templates don't re-clamp except where
  the math itself needs it (Timer's fraction).

## Storage & sharing

- **User store:** its own `statTemplatesDB` database (store `templates`, key path `id`) via the
  existing `idb` helper. Global, not exported with worlds. It gets a separate database rather than
  a store inside `worldsDB` because adding one there means a version bump, and
  `WorldStorageService` opens that database pinned at version 1 — it would then fail to open.
- **Export/import:** standalone template-pack file
  `{ formamorphTemplates: 1, templates: StatCodeTemplate[] }`. Import merges by id
  (re-id on collision with a differing body). This is a new file format, not a world/save
  shape change.

## UI

**Entry point:** a `Templates` button beside Test Code in `src/managers/StatManager.tsx`
(Dynamic Value Calculation section). Opens a dialog:

- **Left:** template list, sectioned **Built-in** / **My Templates**; name + one-line description.
- **Right:** full description, code preview (slots visibly highlighted), and the parameter
  form (one control per unique slot, defaults prefilled, stat pickers populated from the
  current world).
- **Insert** replaces the code field (confirm if the field is non-empty), closes the dialog,
  and clears any prior Test Code result.
- **Manage:** New / Edit / Delete for user templates; Duplicate on built-ins; Import / Export
  buttons for the pack file. Template editing is a name + description + code textarea —
  slots typed by hand per the syntax above, with a live "form preview" so authors see what
  their slots produce.
- New modal → `devRoutes.ts` entry + drift-guard test.

## Build order

1. Slot parser + substitution (`src/lib/statCodeTemplates.ts`) + unit tests
2. Built-in pack, each verified via the sandbox executor in a node-env test
3. IndexedDB store + import/export
4. Dialog + StatManager wiring + devRoute
5. Four gates + `graphify update .`

## Round 2 — dialog rework (BUILT 2026-08-10, all four gates green)

User testing of the first build found six issues; the fixes below. Review also found: the import
file input never resets (same file can't be imported twice), Delete has no confirm, slot names
render as raw camelCase labels, and `stat` slots offer the stat being edited.

### Layout (mobile overflow · desktop height · frozen footer)

Adopt the `EditTextModal` height pattern:

- `DialogContent` gets `max-w-3xl h-[85dvh]` plus `dialogFullHeightMobile` (full height on
  mobile, matching every other full-page editor). Height is now **fixed**, not content-driven —
  this alone fixes "too tall on mobile" and "too short on desktop."
- Internal structure becomes three rows: header / body (`flex-1 min-h-0`) / **frozen footer**.
  The footer holds Duplicate-or-Edit/Delete + Insert Code, so the action buttons never reflow
  with the selected template.
- Left list: `ScrollArea` fills the row height (`h-full`, dropping the fixed `h-72`); right pane
  scrolls independently (`overflow-y-auto`). The code preview grows with the pane instead of
  capping at `max-h-40`.
- Mobile (single column): list collapses to a `Select`-style template picker above the form, so
  the picker + form + preview stack fits and scrolls.

### Library controls (New / Import / Export feel bolted on)

Move all three into the list, where the library actually lives:

- **New** becomes a dashed **+ New Template** row at the end of the My Templates section — the
  list-native affordance for "add one of these."
- **Import / Export** become two icon buttons on the "My Templates" section header row
  (Upload/Download icons, tooltipped). One system: everything about the library is in the list;
  everything about the *selected* template is in the right pane and footer.

### Template editor (Edit | Preview + real creation-form preview)

Replace the "Fields this template will ask for:" sentence with the familiar tab pair:

- **Edit tab:** name, description, code.
- **Preview tab:** the *actual* creation interface — the same slot-form component and generated-
  code preview the picker shows, live against the current world's stats. Malformed slots render
  the form-level error exactly as an author would hit it. This is free: `SlotField` + the
  preview pane already exist; the tab just mounts them on the draft.

### Edit | Preview belongs to the field, not the dialog

`CodeArea` takes an optional `preview` node and, given one, grows the same Edit | Preview pair a markdown
`PromptField` has — tabs sit above the field, and full screen opens **side by side** whenever the window
can give each pane `MIN_PANE_WIDTH`, with a `Columns2`/`Square` toggle back to one pane at a time. It
reuses `resolveLayout` + `usePromptSplitMode`, so the split preference is one setting shared with the
prompt fields rather than a second one to learn.

The template editor therefore has no tabs of its own: name and description stay put, and the code field
carries the pair, with the creation form as its preview.

### Full screen grows out of the field (BUILT 2026-08-10)

`useMorphFullscreen` (`src/lib/useMorphFullscreen.ts`) is a FLIP: the overlay is laid out at full size,
transformed back onto the source textarea's rect, then released, so only `transform` animates. 260ms in
on `cubic-bezier(0.2, 0, 0, 1)`, 190ms out. The inline field stays mounted underneath, which is what makes
the return trip a fresh measurement rather than a remembered rect.

- The box morphs; the **contents cross-fade** (`animate-in fade-in-0 delay-100`). Scaling the children
  with the box reads as the text stretching — the container-transform rule.
- `DialogContent` gained an `unanimated` prop. Radix's stock `zoom-in-95`/`slide-in-*` rewrite `transform`
  every frame, so a caller's own FLIP is erased as fast as it is written.
- Exit is ours to sequence: `mounted` stays true through `leaving` and only drops when the trip settles,
  since Radix would otherwise unmount the element mid-shrink.
- **The entering trip starts from the ref callback, not the layout effect.** Radix portals the content in,
  so `DialogContent`'s ref lands *after* the parent's layout effect — `boxEl.current` is still null there.
  This is what made it one-directional: leaving measured a long-attached box and worked; entering measured
  nothing, fell through to `settle()`, and never animated at all. Verified by instrumenting the running
  app (`hasBox: false` on `entering`, true on `leaving`) rather than reasoned about. The first jsdom test
  missed it by attaching `boxRef` before calling `open()` — an ordering React never produces.
- **The release waits for a painted frame** (double `requestAnimationFrame`). Layout is not paint: a
  transition declared alongside an element's first style computation does not run.
- **The settle timer is armed before the frame, not inside it.** A hidden tab suspends rAF entirely, so a
  settle chained off the release never fires and the overlay sits parked on top of the field for good.
  Landing early costs the animation, not the end state. Found by the preview pane doing exactly this.
- A `setTimeout` settles it, not `transitionend` — a transition that never fires (background tab, display
  change) would strand the overlay mid-shrink with no way back.
- Degrades to a plain mount under `prefers-reduced-motion`, or when the source has no area (the Preview
  tab unmounts the textarea, so this is reachable, not theoretical).

Not yet applied to `PromptField`'s own full screen — deliberately one surface first.

### Code editing affordances (undo / redo / fullscreen / toolbar)

**Toolbar layout follows `PromptField`'s chrome exactly** (verified against it, not invented): a left
group that wraps — caption, then the insert menus — and a right group holding Undo, Redo, a
`mx-0.5 w-px self-stretch bg-border` rule, then the full-screen toggle last. Labels match too
(`Edit full screen` / `Exit full screen`).

**Full screen raises an overlay containing only the editor**, never grows the host panel. The hosted
mode originally specced (caller grows its own dialog) was built and then removed: it moved the dialog's
own buttons out from under the author, and the same button then meant two different things depending on
where the field sat.

**Mobile height, the bug that made this urgent:** `dialogFullHeightMobile` is a `max-sm:` rule, so an
unscoped `h-[85dvh]` beside it wins on width alone. The dialog then measured a viewport unit that
ignores the on-screen keyboard, and the fields under it were crushed to nothing. The desktop height is
now `sm:`-scoped, and `viewportSizing.test.ts` guards the pairing. The field also keeps a `min-h`
floor rather than `min-h-0`, so what remains scrolls instead of collapsing.

**Decided 2026-08-10: a small `CodeArea` component** — textarea + toolbar. Undo/redo via an own
debounced-snapshot history stack (the `ImageTagsField` precedent; native textarea undo breaks
on programmatic writes like Insert). Fullscreen toggles the dialog through `dialogFullHeight`
(the `EditTextModal` precedent). Toolbar = history pair, fullscreen, plus the *guidance* piece:
an **Insert Slot** menu (pick a type → `{{name:type}}` at the caret, caret on `name`) and an
**Insert Variable** menu listing the six clock vars and a `stats.find(...)` lookup snippet.
**StatManager's own code box adopts `CodeArea` in the same change** (its Insert Variable menu,
minus the slot menu — slots are template syntax, not stat-code syntax). PromptField-with-a-code-
mode was considered and rejected: suppressing chip/markdown/vocabulary behavior in a heavily-
shared Lexical component is bigger and riskier than a contained new control.

### Small fixes riding along

- Reset the import `<input type=file>` value after reading, so the same file imports twice.
- **Delete gets a confirm dialog** (decided over an undo toast — matches the app's other
  destructive ops).
- **Insert over a non-empty code field gets a confirm dialog** ("Replace the existing code?"),
  restoring the original spec's call; the notice-line-only behavior that shipped is replaced.
- Humanize slot names for form labels (`ratePerHour` → "Rate Per Hour") to meet title case.
- `stat` slots list every stat *except* the one being edited.
- Deduplicate the user-list sort (sort once where the list is derived).

## Open questions (decided)

- Merged 8-template roster over the literal 11 (mirror pairs collapse via signed slots) — decided 2026-08-10.
- One-way generate, inline slot syntax, local-global storage + pack file, built-ins read-only — interview 2026-08-10.
