# 04: Remember library defaults per world

Status: ready-for-human
Blocked by: 03
Recommended model: GPT-6 Astra (`gpt-6-astra`)
Reasoning effort: high

## Parent

[Enter World spec](../spec.md), including the original pre-prototype distinction between usual world additions and overrides for one game.

## What to build

Players explicitly save their library configuration for a local world and find it restored on future entries, including after restart. They can still experiment for one game without replacing those defaults. Saving none is a durable preference.

Model rationale: absence versus explicit none, source identity, changed content, and persistence failure paths need careful state and data-contract reasoning.

## Acceptance criteria

- [x] Add Use these additions for future games to the working Library Additions section. Save only on this explicit action; ordinary editing and starting affect the current draft, not future defaults.
- [x] Persist references/preferences under stable local world identity, separately from authored world content, using existing local persistence conventions. Include entity references, library dictionary references, world-dictionary enablement overrides, and complete dictionary order.
- [x] Preserve source-qualified IDs and distinguish no saved record from explicitly saved empty selections. New library items stay off; new authored dictionaries follow authored defaults unless configured.
- [x] Restore defaults on entry and across restart. Two worlds remain independent. Traits and starting location continue to seed from their existing defaults, not these preferences.
- [x] Reconcile missing/renamed records by identity without crashing or choosing unrelated content. Preserve surviving dictionary order and prevent ID collisions across sources.
- [x] Cancel discards unsaved changes but does not undo an explicit save already completed. Report save success only after persistence succeeds; failures leave the draft available for retry.
- [x] Remembered defaults drive the same runtime-copy finalization as one-game edits. Existing saves and library originals remain independent; exported worlds contain no personal preference record or newly imposed library dependencies.
- [x] Quick Start remains the existing authored-default bypass. This ticket does not silently redefine it to consume remembered setup.

## Verification

- Through normal MainMenu entry and real local persistence, save defaults, close/reopen or remount, and assert restored UI and final start payload. Repeat for explicit none and a second world.
- Cover unsaved override followed by start, explicit save followed by cancel, restart, new/missing/renamed content, mixed-source ordering, all-off dictionaries, and persistence failure without false success.
- Use existing persistence/finalization seams for precise isolation cases; no parallel fake implementation of reconciliation. Prove guards fail when their behavior is reverted.
- Run the integrated entry regression checks available at implementation time as well as focused persistence checks. Time test runs and investigate lingering handles.

## Scope boundary

No personal trait/location presets, server APIs, cloud sync, published dependency/add-on behavior, authored export changes, or rewriting saves. Ticket 05 is independent once 02 exists.

## Comments

Implemented September 8, 2026. Preferences use a separate localStorage key per local world, with source-qualified entity/dictionary references and full dictionary order. Saving is explicit and reports success only after storage returns. Normal entry reconciles current content; Quick Start stays unchanged. A remembered lone dictionary remains editable after library content is removed.

- **Gates:** typecheck exit 0 (11.90s), lint exit 0 (10.40s), 8,571 tests passed / 3 skipped, exit 0 (52.33s), build exit 0 (14.33s). An initial full run failed three subprocess tests because Node was absent from PATH; adding the bundled Node directory resolved them without test changes.
- **Focused checks:** 47 tests passed (23.68s with coverage). Preference module: 100% statements, branches, functions, and lines. Workspace: 99.64% lines / 95.09% branches. MainMenu: 65.08% lines / 60.47% branches through the entry tests; unrelated menu operations are outside this slice.
- **Regression proof:** nine mutations failed their intended tests: ignoring saved records, selecting new entities, ignoring enablement, duplicating order, dropping new books, dropping entity source qualification, reversing order, swallowing persistence errors, and saving implicitly on start. Runs took 1.47–1.58s each for reconciliation and 10.48s / 10.68s for MainMenu. Original sources were restored exactly. The lone-dictionary regression failed before its fix (12.14s), then passed.
- **UI:** verified through the live `enterWorld` dev route at 1280×860 and 375×812. Saved none survived reload. The save action stayed within the viewport, measured 44px high on phone, and keyboard navigation reached Search. Static frames covered dark Graphite/System and light Blue/Lexend; display settings were restored afterward. The shared outline Button follows the showcase Control States reference.
- **Copy review:** the button retains the ticket's exact wording. Success/error text uses the Writing Guide's technical persistence meaning of “save” (rule 1.12); additions names the selections in this section. Full STE dictionary admission for that noun remains unverified; no broader compliance claim is made.
- **Review:** standards review found no actionable violations; spec review found the lone-dictionary bypass, now fixed and regression-tested. No outstanding findings. Exported world/save shapes and versions are untouched.
