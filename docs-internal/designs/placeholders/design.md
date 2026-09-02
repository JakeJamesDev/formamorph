# Placeholders — design spec

Author-defined named values dropped into world text as inline chips. Two behaviors, **inferred from how many values the author adds** (no type toggle):

- **Variable** (1 value) — a fixed value reused across the world; edit it in one place, it updates everywhere. Authoring convenience / DRY.
- **Wildcard** (2+ values) — a random value, so a world feels varied without the author writing every case. Each chip picks *which* random via a **World | Unique** popout.

Umbrella name (feature + tab + concept): **Placeholders**.

---

## Data model

### Authored (world) — new export-shape field

```ts
interface Placeholder {
  id: string;          // crypto.randomUUID(), stable — chips reference this, not the name
  name: string;        // author-facing label shown on the chip
  values: string[];    // 1 => Variable, 2+ => Wildcard, 0 => empty/missing
}
interface World {
  // ...
  placeholders?: Placeholder[];
}
```

`values` uses the existing **`KeywordChips`** input (from `DictionaryManager.tsx`) — same UX as dictionary keywords.

### In-text chip token

Each placement is an inline chip in the Lexical editor, serialized to a token string carrying three parts:

```
placeholderId + mode + placementId
```

- **mode** — `world` (default) or `unique`. Stored on every chip; the popout only *surfaces* when the referenced placeholder has 2+ values (a Variable has nothing to randomize).
- **placementId** — a `crypto.randomUUID()` minted when the chip is inserted, stable for the life of that placement. Only meaningful for `unique` mode (it keys the per-spot roll), but minted for every chip so a Variable→Wildcard→Unique transition needs no retrofit.

Exact delimiter is an implementation detail finalized against the chip infra (below); it must be collision-resistant against authored prose and distinct from prompt tokens (`<ENTITIES>` etc.).

### Save — new export-shape field

Frozen rolls for this playthrough:

```ts
interface SaveObject {
  // ...
  placeholderRolls?: {
    world?: Record<string, string>;   // placeholderId -> rolled value (shared across all World chips)
    unique?: Record<string, string>;  // placementId   -> rolled value (per-spot)
  };
}
```

Variables need no roll (resolve straight from the authored value). Rolls are written **lazily** on first resolution and frozen; **New Game** starts empty (re-rolls), **Continue** keeps them.

---

## Behavior

### Resolution (the core)

A single pure pass, applied everywhere authored text surfaces:

```ts
resolvePlaceholders(text, { placeholders, rolls, setRoll }): string
```

For each chip token in `text`:
1. Look up the placeholder by `id`. Missing or `values.length === 0` → resolve to **`""`** (empty string).
2. `values.length === 1` (Variable) → that value.
3. `values.length >= 2` (Wildcard):
   - `mode === 'world'` → `rolls.world[id]` if present; else roll uniformly, `setRoll` to persist, use it.
   - `mode === 'unique'` → `rolls.unique[placementId]` if present; else roll uniformly, persist, use it.

The **resolved value** is what the player sees *and* what the AI receives — same roll feeds both, so they always agree. The placeholder name/token never appears at runtime.

### Where it's applied

Resolve at every boundary that emits authored text:

- **Player display:** entity/location/world descriptions + summaries, dictionary entries → wherever `MarkdownRenderer` / detail panels show authored text.
- **AI context:** `buildEntityContext` (`locationContext.ts`), the world-description assembly, and dictionary injection — resolve before the text is folded into the prompt via `renderPromptTemplate`.

Resolution runs **during gameplay only** (needs the save's rolls). In the editor, chips render as their name (design-time), not resolved.

### Fields that accept placeholders (chip toolbar shown)

Entity descriptions + summaries, location descriptions + summaries, world description, dictionary entries — both AI- and player-facing variants.

---

## UI

### Placeholders tab (per-world)

A new `activeTab === 'placeholders'` in `WorldEditor.tsx`, reusing the existing list-tab pattern (like entities/dictionaries):

- Left: the world's placeholder list — dnd reorder, duplicate, delete (mirror `SortableTree`/list conventions already used).
- Right: `PlaceholderManager` edits the selected item — **name** field + **values** (`KeywordChips`). A live hint reflects inferred type: *"1 value → fixed"* / *"2+ values → random"*.

### Chip toolbar + inline editor

Reuse the prompt-chip infra: `PromptField.tsx` (Lexical) + `VariableNode.tsx` (chip node with `token`, `decodeVariant`/`encodeVariant`/`withVariant` for the axis popout).

- A **palette toolbar** above each accepting field lists the world's placeholders; click inserts an inline chip at the cursor (default `mode: world`, fresh `placementId`).
- Inline chips: dnd within the text, `x` to remove.
- **World | Unique popout** on a chip (only when the placeholder has 2+ values), mirroring the prompt-chip axis popout, with **secondary descriptive text** per option ("World — same value everywhere this playthrough" / "Unique — its own value here").
- A chip whose placeholder was deleted or has 0 values renders as **"missing/empty"** so the author notices.

**Infra work:** the current chip system keys tokens to a *static* variable registry (`variableForToken`, `variableAxes`). Placeholders are *dynamic* (per-world, author-defined), so the chip node must resolve a placeholder token against the current world's `placeholders`, and expose the World|Unique axis only when `values.length >= 2`. This is the main non-trivial extension.

---

## Export-shape / migration

**Additive** to both world (`placeholders`) and save (`placeholderRolls`). Both are new fields → **requires user version/migration sign-off** (per hard constraint #2). Old worlds/saves lack them → treated as no placeholders / no rolls (all resolution is a no-op on text with no chips). `migrateWorld` / `migrateSave` need only tolerate their absence — no data rewrite.

---

## Build slices (each: four gates green, own tests)

1. **Model + resolver.** `Placeholder` type, `World.placeholders`, `placeholderRolls` on the save, and the pure `resolvePlaceholders` + token encode/decode. Unit-tested hard (Variable, World shared, Unique per-spot, lazy roll + freeze, missing/empty → ""). No UI yet.
2. **Editor tab.** Placeholders list tab + `PlaceholderManager` (name + `KeywordChips`), dnd/duplicate/delete. Reachable via `devRoutes.ts`.
3. **Chip editor extension.** Dynamic placeholder tokens in `PromptField`/`VariableNode`; palette toolbar; World|Unique popout gated on value count.
4. **Wire resolution.** Apply `resolvePlaceholders` at the player-display and AI-context boundaries; thread the save's rolls + lazy `setRoll`.
5. **Field rollout.** Add the chip toolbar to each accepting field (entity/location/world/dictionary, both variants).

---

## Open questions / risks

- **Token delimiter** — must not collide with authored prose or prompt `<...>` tokens; finalize against the chip serialization in slice 1.
- **Lazy roll + `setRoll` plumbing** — resolution is called from render paths; persisting a new roll must go through the gameplay save state (GameplayContext), not the authored world (authored world is immutable in play, hard constraint #5). The resolver takes a `setRoll` callback so pure resolution stays side-effect-free and the caller owns persistence.
- **Determinism** — lazy rolls mean a World placeholder's value is fixed by whichever chip renders first; fine (uniform random either way). If we ever want reproducible seeds, revisit toward eager rolling at New Game.
- **Nested placeholders** (a value containing another chip) — **out of scope v1** (flat values only).
- **Weighting** — uniform only (v1).

---

## Testing

- Resolver unit tests (slice 1): the truth table above, plus idempotent re-resolution and roll-freeze across calls.
- Editor drift-guard for the new tab (`devRoutes.ts`).
- An integration check that a Wildcard resolves identically in player display and AI context for the same save (same roll).

---

# Slice 6 — Export/import portability (entity + dictionary)

A standalone entity card or dictionary file whose text contains `{{ph…}}` chips must carry the placeholder
definitions it uses, so the chips still resolve when imported into a different world (or held in the library).

## Shape — one representation everywhere

`placeholders?: Placeholder[]` **on the object** (`Entity` + the dictionary unit `Dictionary`). Used identically
for the export file and the in-app item — no separate envelope key, no sidecar store:

- **Populated** only for a standalone/library item carrying its own defs.
- **Empty/absent** while the item lives in a world (`World.placeholders` is authoritative there).

Additive export-shape change to the entity card (`EntityCardData`) and dictionary file (`DictionaryFile`) —
they already project the object's fields, so the field just rides along. **Needs a user version/migration
sign-off.** Absent = none (`migrate*` untouched).

## Export — bundle the used defs

At export, scan the item's text for chips, resolve each referenced id against the **available** defs (the
world's `placeholders` for a world item; the item's own `placeholders?` for a library item), and set the
exported object's `placeholders?` to just those.

- New pure helper `collectUsedPlaceholders(texts: string[], available: Placeholder[]): Placeholder[]` —
  the subset of `available` whose ids appear as tokens in `texts`.
- `buildEntityCardData(entity, available)` scans `player/aiDescription` + `aiSummary`; `buildDictionaryFile(book, available)` scans every entry `value`.
- Callers: `downloadEntity` (WorldEditor) passes the world's placeholders; the library export passes `entity.placeholders`.

## Import — carry, then absorb

- **Parse** (`parseEntityCardData` / `parseDictionaryFile`): read `placeholders?` onto the new object (alongside the fresh-id remint they already do).
- **Into the library** (MainMenu `EntityEditorModal`): nothing extra — `placeholders?` persists on the object.
- **Into a world** (the two `onAdd` sites: WorldEditor entity + dictionary): **absorb** before adding.

### Absorb (pure core)

`absorbPlaceholders(carried: Placeholder[], worldPlaceholders: Placeholder[]): { toAdd, idMap }`:

- For each `carried` def: a **perfect match** in `worldPlaceholders` (same `name` AND `values`) → map its id to
  the match's id. Else → a new def `{ id: crypto.randomUUID(), name, values }` (fresh id, collision-proof) added
  to `toAdd`, and map the old id → the new id.
- `idMap` covers every carried id → its resolved world id.

Caller then: `toAdd.forEach(addPlaceholder)`; **remap the item's tokens** via `remapPlaceholderIds(text, idMap)`
across its text fields; and **clear** the item's `placeholders?` (now global). Applies whether importing a card
into the world or promoting a library item into one.

- New pure helper `remapPlaceholderIds(text, idMap): string` — rewrites `{{ph:<old>:<mode>:<pid>}}` →
  `{{ph:<new>:<mode>:<pid>}}` (mode + placementId preserved), leaving unknown ids untouched.

## Scope / assumptions

- **Standalone export only.** Whole-world export is unchanged — it already carries all of `World.placeholders`.
- **Scanned fields:** entity `player/aiDescription` + `aiSummary`; dictionary book = every entry `value`.
- Dictionary unit is the **book** (`Dictionary`); its `placeholders?` aggregates all its entries' used defs.
- No nesting / weighting (v1, unchanged).

## Testing

- `collectUsedPlaceholders`: only referenced defs bundled; unreferenced world placeholders excluded.
- `absorbPlaceholders`: perfect-match reuse; near-match (same name, different values) → new def; idMap correctness.
- `remapPlaceholderIds`: rewrites matched ids, preserves mode/placementId, leaves unknown/absent ids alone.
- Round-trip: export an item using a Wildcard → import into a fresh world → its chip resolves to that world's (newly-absorbed) placeholder.
