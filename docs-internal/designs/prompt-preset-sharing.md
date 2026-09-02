# Prompt Preset Sharing — Design Memo

> Internal design note (not wiki-published). Feature: export/import prompt presets so users can share them. Interview-locked; being built slice by slice. Version **2.1.0** (in development).

## What a preset is (post–slice 1)

`PromptPreset = { id, name, values: <15 prompt texts>, style: 'markdown'|'labels', samplers?, reasoning?, verbatim? }`. Built-ins (Default/Simple) are virtual and carry **no tuning** (resolve to shipped defaults; setters no-op). User presets own their tuning. `src/lib/promptPresets.ts`.

## Locked decisions (interview)

| Aspect | Decision |
|---|---|
| **Transport** | Both — `.json` file *and* a copy-paste share code (base64) |
| **Contents** | 15 prompt texts + section style + per-prompt tuning (samplers, reasoning, verbatim) |
| **Tuning model** | **Preset-scoped** (done in slice 1) — switching presets swaps tuning too |
| **Version** | Stamp current app version always (like saves/worlds); on import **warn** if older/newer but **import as-is** — no hard block |
| **Chip/compat** | Unmatched chips → rendered as **raw text**; unknown options/keys → **ignored** |
| **Import** | New preset (overwrite option on name clash); recipient chooses **texts only** vs **texts + tuning** |
| **Built-in tuning / migration** | Built-ins stay pristine (default tuning, locked); existing custom tuning migrates onto user presets; a user on a built-in with custom tuning reverts to defaults there (accepted) |

## Slice status

- [x] **Slice 1 — Preset-scoped tuning + migration (done).** Tuning moved onto `PromptPreset`; `SettingsContext` derives/sets through the active preset (public API unchanged); `migratePromptTuning()` folds legacy global tuning onto user presets once (`foldTuningIntoUserPresets`, non-overwriting, non-default verbatim only), retires old keys behind `_promptTuningMigrated`. Unit-tested (`promptPresets.tuning.test.ts`); migration verified live. Settings-store change, **not** export shape.
- [x] **Slice 2 — Export/import codec (done).** `src/lib/promptPresetShare.ts`: `buildSharedPreset` → `serializeSharedJson` / `serializeSharedCode` (UTF-8-safe base64, `FMPRESET1:` prefix), and `parseSharedJson` / `parseSharedCode` → `{ ok, preset, sourceAppVersion, warnings }`. Stamps `kind`/`formatVersion`(1)/`appVersion`; sanitize keeps only known text keys + well-typed tuning, drops the rest with a warning; version/format mismatch warns but imports as-is. Empty tuning maps omitted. Unit-tested (round-trip, unicode, junk rejection, unknown-key drop, version + newer-format warnings, malformed-tuning drop).
- [x] **Slice 3 — Export/import UI (done).** `PresetShareDialogs.tsx`: `ExportPresetDialog` (share code + `.json` download) and `ImportPresetDialog` (file/paste → preview name + warnings → texts-only vs +tuning, overwrite-vs-keep-both). Wired via an Export button + `Import Preset…` Select sentinel; context `exportActivePreset`/`importPreset` (`addFullPreset`/`replacePreset`). Export materializes the selected preset incl. built-ins. Round-trip verified live. Interview: Import-in-dropdown / Export button / one export dialog / guided import dialog / built-ins exportable / import name editable + default +tuning.
- [x] **Slice 4 — Chip raw-text fallback (done; already satisfied, now locked).** The contract was already met by design: `parsePromptTemplate`'s `TOKEN_RE` matches only registry tokens (known base + known variant), so any foreign `<…>` stays a `text` segment — in the editor (`appendSegments` → text nodes, never a chip), the preview (`PreviewPane`), and runtime (`renderPromptTemplate` leaves unmatched tokens untouched). `VariableChip` never sees an unknown token, and even guards its registry lookups (`variable ? … : []`), so no crash. Added explicit cross-version regression tests (`promptTemplate.test.ts` → "cross-version import compat"): foreign base + foreign variant survive parse/serialize/render as literal text, mixed prompts keep known chips. No behavior change — hardening + lock.

## Notes / risks

- **New shareable format** (like character cards) → net-new `.json`/code artifact, not a world/save change, so no app version bump for it; but its shape is then kept stable. Stamped version = app version (2.1.0).
- **Security:** shared prompts are plain text (no code), but a system prompt could be adversarial — import is user-initiated (like importing a world). Consider a subtle "review imported preset" note for the Steam build. Low priority.
- **Behavior change from slice 1:** switching presets now swaps tuning (was text-only). Surfaced in the changelog.
