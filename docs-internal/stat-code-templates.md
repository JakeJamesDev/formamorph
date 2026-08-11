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

## Open questions (decided)

- Merged 8-template roster over the literal 11 (mirror pairs collapse via signed slots) — decided 2026-08-10.
- One-way generate, inline slot syntax, local-global storage + pack file, built-ins read-only — interview 2026-08-10.
