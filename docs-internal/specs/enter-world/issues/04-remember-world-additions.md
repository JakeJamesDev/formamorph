# 04: Remember library defaults per world

Status: ready-for-agent
Blocked by: 03
Recommended model: GPT-6 Astra (`gpt-6-astra`)
Reasoning effort: high

## Parent

[Enter World spec](../spec.md), including the original pre-prototype distinction between usual world additions and overrides for one game.

## What to build

Players explicitly save their library configuration for a local world and find it restored on future entries, including after restart. They can still experiment for one game without replacing those defaults. Saving none is a durable preference.

Model rationale: absence versus explicit none, source identity, changed content, and persistence failure paths need careful state and data-contract reasoning.

## Acceptance criteria

- [ ] Add Use these additions for future games to the working Library Additions section. Save only on this explicit action; ordinary editing and starting affect the current draft, not future defaults.
- [ ] Persist references/preferences under stable local world identity, separately from authored world content, using existing local persistence conventions. Include entity references, library dictionary references, world-dictionary enablement overrides, and complete dictionary order.
- [ ] Preserve source-qualified IDs and distinguish no saved record from explicitly saved empty selections. New library items stay off; new authored dictionaries follow authored defaults unless configured.
- [ ] Restore defaults on entry and across restart. Two worlds remain independent. Traits and starting location continue to seed from their existing defaults, not these preferences.
- [ ] Reconcile missing/renamed records by identity without crashing or choosing unrelated content. Preserve surviving dictionary order and prevent ID collisions across sources.
- [ ] Cancel discards unsaved changes but does not undo an explicit save already completed. Report save success only after persistence succeeds; failures leave the draft available for retry.
- [ ] Remembered defaults drive the same runtime-copy finalization as one-game edits. Existing saves and library originals remain independent; exported worlds contain no personal preference record or newly imposed library dependencies.
- [ ] Quick Start remains the existing authored-default bypass. This ticket does not silently redefine it to consume remembered setup.

## Verification

- Through normal MainMenu entry and real local persistence, save defaults, close/reopen or remount, and assert restored UI and final start payload. Repeat for explicit none and a second world.
- Cover unsaved override followed by start, explicit save followed by cancel, restart, new/missing/renamed content, mixed-source ordering, all-off dictionaries, and persistence failure without false success.
- Use existing persistence/finalization seams for precise isolation cases; no parallel fake implementation of reconciliation. Prove guards fail when their behavior is reverted.
- Run the integrated entry regression checks available at implementation time as well as focused persistence checks. Time test runs and investigate lingering handles.

## Scope boundary

No personal trait/location presets, server APIs, cloud sync, published dependency/add-on behavior, authored export changes, or rewriting saves. Ticket 05 is independent once 02 exists.
