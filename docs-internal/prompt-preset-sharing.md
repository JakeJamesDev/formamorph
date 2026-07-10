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
- [ ] **Slice 2 — Export/import file + share-code codec.** Serialize a preset (texts+style+tuning) to `.json` and base64 code, with a stamped app version + a preset-format marker. Round-trip parse with graceful unknown-key drop.
- [ ] **Slice 3 — Import UI.** Export/import buttons in Settings → Prompts (next to add/delete/rename); import dialog: texts-only vs texts+tuning, overwrite-vs-keep-both on name clash, older/newer-version warning.
- [ ] **Slice 4 — Chip raw-text fallback hardening.** Ensure the chip renderer renders unknown tokens as literal text (never crash/blank) — the compat contract.

## Notes / risks

- **New shareable format** (like character cards) → net-new `.json`/code artifact, not a world/save change, so no app version bump for it; but its shape is then kept stable. Stamped version = app version (2.1.0).
- **Security:** shared prompts are plain text (no code), but a system prompt could be adversarial — import is user-initiated (like importing a world). Consider a subtle "review imported preset" note for the Steam build. Low priority.
- **Behavior change from slice 1:** switching presets now swaps tuning (was text-only). Surfaced in the changelog.
