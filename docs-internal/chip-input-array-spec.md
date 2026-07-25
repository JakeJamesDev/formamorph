# Chip inputs → real arrays (spec)

**Status:** implemented (gates green) — pending the version/migration decision in §6
**Motivation:** dictionary keywords are stored as a comma-joined string, so any keyword containing a comma is unenterable and silently splits on reload. With `useRegex` shipped this is a correctness bug — `\d{2,3}`, `(a|b),\s*c`, and `[, ]` are all impossible to author today.

**Goal:** the delimiter disappears from the data model. A chip is one array element, holding any character. The only way to create a chip is pressing **Enter**.

---

## 1. Data model

| Field | Today | After |
|---|---|---|
| `DictionaryEntry.key` | `string` (comma-joined) | `string[]` |
| `DictionaryEntry.secondaryKeys` | `string \| undefined` | `string[] \| undefined` |
| `Entity.aliases` | `string[]` | unchanged |
| `Placeholder.values` | `string[]` | unchanged |
| world tags / image tags | `string[]` | unchanged |

> ⚠️ **Export-shape change.** `key` and `secondaryKeys` change type in exported world JSON and in any world stored in IndexedDB. This needs a migration and is very likely a version bump — a user decision, not an implementation detail. Old exports opened in a new build and new exports opened in an old build are both real cases to think through before this ships.

### Migration

Add to `migrateWorld` in [version.ts](../src/lib/version.ts). Presence-based and idempotent, matching the existing migration style:

```
key:           string → split(',').map(trim).filter(Boolean)
               already an array → untouched
               missing/empty → []
secondaryKeys: same, but empty result → undefined (stays optional)
```

Applies to every entry of every book in `world.dictionaries`. `migrateWorld` already runs at both import boundaries and centrally in `GameDataContext.loadWorldData`, so no new call sites.

Bundled worlds in `src/defaultworlds/` carry the old shape (e.g. `drone.json` has `"secondaryKeys": "ruin,dungeon,vault"`). They can either be rewritten to arrays or left to the migration — rewriting is cleaner, since they're ours.

### Consumers to update

| File | Change |
|---|---|
| [dictionaryUtils.ts:17](../src/lib/dictionaryUtils.ts:17) | delete `splitKeys`; `parseKeywords` returns `entry.key ?? []`; secondary reads the array directly |
| [dictionaryUtils.ts:372](../src/lib/dictionaryUtils.ts:372) | `e.name \|\| e.key` label fallback → `e.key[0]` |
| [DictionaryManager.tsx:25-48](../src/managers/DictionaryManager.tsx:25) | drop both join/split pairs; pass arrays straight through |
| [DictionaryTree.tsx:63](../src/managers/DictionaryTree.tsx:63) | `entry.key` display fallback → `entry.key[0]` |
| [semanticDictionary.ts:28](../src/lib/semanticDictionary.ts:28) | embedding text needs `entry.key.join(', ')` |
| [lorebookImport.ts:68-70](../src/lib/lorebookImport.ts:68) | drop the `.join(', ')` — `asKeywordList` already returns an array |
| `dictionaryFile` round-trip | verify export/import preserves arrays |
| `turnBanding.ts` | no change (goes through `parseKeywords`) |

**`name` mirroring wrinkle:** `handleKeyChange` currently sets `name` to the same joined string as `key`. `name` stays a `string` display label — keep deriving it as `arr.join(', ')` so the tree label is unchanged. Worth confirming this is still wanted at all, since a keyword list is a poor name.

---

## 2. Input model

Applies to `KeywordChips` (dictionary keys, secondary keys, placeholder values, entity aliases) and `TokenAutocomplete` (world tags, image tags, filters).

| Action | Behavior |
|---|---|
| **Enter** | commit the buffer as one chip, verbatim except outer trim |
| **Typed `,`** | inserts a literal comma — no longer commits |
| **Backspace on empty buffer** | pop the last chip (unchanged) |
| **Blur with non-empty buffer** | commit (unchanged) |
| **Tab** | commit, then move focus |
| **Escape** | clear the buffer without committing |

Remove: the `e.key === ','` branch in [KeywordChips.tsx:47](../src/components/KeywordChips.tsx:47), and the comma-splitting in `TokenAutocomplete.handleInput` ([TokenAutocomplete.tsx:130](../src/components/TokenAutocomplete.tsx:130)). `splitChipInput` in [Chip.tsx:15](../src/components/Chip.tsx:15) survives only as the paste helper (§3).

**Dedup** stays as-is: case-sensitive in `KeywordChips` (per-entry `caseSensitive` makes distinct-case keywords meaningful), case-insensitive in `TokenAutocomplete`.

**Mobile:**
- Guard `e.nativeEvent.isComposing` before committing — Android IMEs emit keyCode 229 mid-composition and can double- or non-commit.
- Set `enterKeyHint="enter"` so the soft keyboard labels the key sensibly.

**Copy update** — [DictionaryManager.tsx:67](../src/managers/DictionaryManager.tsx:67) currently reads "press comma or Enter to add it." Becomes "press Enter to add it. Tap or double-click to edit…".

---

## 3. Paste

Single-line `<input>` strips newlines before `onChange` fires, so this needs an explicit `onPaste` handler reading `clipboardData.getData('text')` and calling `preventDefault()`.

| Clipboard content | Result |
|---|---|
| **Multi-line** | one chip per non-empty line, trimmed |
| **Single line** | types into the buffer as usual — editable, committed with Enter |

Newlines are safe to split on unconditionally: no regex pattern contains a literal newline. A single-line paste deliberately does *not* become a chip: pasting `3}` into a half-typed `\d{2,` has to behave like a text field.

### The split offer

The offer keys off the **committed chip**, not off the paste, so it covers typed and pasted values alike. When a chip is committed **and** it contains `", "` (comma + space) **and** `offerCommaSplit` is on, render a one-shot inline affordance below the field:

> `Split into 3?`

- It's a **button**, not automatic. A regex or a legitimately comma-bearing alias (`Elizabeth, Queen of Grayhold`) is never silently destroyed — the worst case is an offer you ignore.
- Clicking replaces the chip in place with its `", "`-split segments, preserving position in the list.
- It dismisses on: click, next keystroke in the buffer, next paste, another commit, or removal of any chip. Not on blur — clicking the offer blurs the input, so it is handled on `mousedown`.
- No timers — nothing disappears on its own.
- Keyboard-reachable and labeled (`aria-label="Split pasted value into 3 keywords"`).

`", "` over bare `","` because it's meaningfully stricter for near-zero cost: it spares `{2,3}` quantifiers and `a,b` compact lists, while still catching the human-formatted lists people actually paste. It does **not** spare `[, ]` character classes or prose alternations — hence the `useRegex` suppression and the click.

**Paste into an existing chip (edit mode) is always literal.** You're editing one value; splitting there makes no sense, and the offer never appears.

`useRegex` is only known to `DictionaryManager`, so this arrives as an optional prop:
`KeywordChips({ …, offerCommaSplit = true })` — passed `false` for the regex case. Placeholder values and aliases keep the default.

---

## 4. Tap-to-edit

`EditableChip` currently only enters edit mode on `onDoubleClick` ([EditableChip.tsx:96](../src/components/EditableChip.tsx:96)), which is unreachable on touch — mobile users can add and delete chips but never fix one. That's worse now that a chip may hold a fiddly regex.

**Change:** add an `onClick` that enters edit mode when `e.pointerType === 'touch'` (or the click carries no pointer type but the device reports a coarse pointer). Desktop keeps double-click, so a single mouse click still does nothing and drag-to-reorder is unaffected.

Drag conflict is already handled — `PointerSensor` uses `activationConstraint: { distance: 5 }`, so a tap that doesn't move never starts a drag.

The chip's `title="Double-click to edit"` should become something device-neutral, e.g. `"Tap to edit"` / `"Double-click to edit"` chosen the same way, or just "Edit".

---

## 5. Tests

| Area | Case |
|---|---|
| migration | old string → array; already-array untouched (idempotent); empty/missing → `[]` / `undefined`; runs on nested book entries |
| input | Enter commits; typed comma stays literal; Backspace pops; blur commits; Escape clears |
| regex | a keyword `\d{2,3}` survives a save/load round-trip and still matches |
| paste | multi-line → N chips; single-line → 1 literal chip; `", "` offer appears, splits on click, dismisses on keystroke |
| paste | offer suppressed when `useRegex` is on; offer never appears in chip-edit mode |
| tap-to-edit | touch pointer click opens the editor; mouse click does not; drag still reorders |
| existing | `dictionaryUtils.test.ts` `parseKeywords` cases need rewriting — they currently assert comma-splitting |
| existing | `lorebookImport.test.ts` asserts `secondaryKeys` is the string `'b'`; becomes `['b']` |

---

## 6. Open questions

1. **Version bump + migration timing** — user's call. Does this ride an existing bump or force one?
2. **`name` mirroring** — keep deriving the entry name from the keyword list, or decouple them?
3. **Bulk-add path** — if pasting lists turns out to be common, a dedicated "paste a list" textarea in the dictionary panel is a cleaner home than the chip input. Out of scope here; noted as a follow-up.
