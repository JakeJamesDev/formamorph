# 04: Find And Bench Land On The Owning Tab

Status: ready-for-human
Status note: Landed as d3dcd0f8. Typecheck, lint and build are clean and the graph is updated; the gates run against the working tree, which also carries two neighboring sessions' in-flight work. The full test run has 4 failures in `AddEntityModal.test.tsx` and `AddDictionaryModal.test.tsx`, which arrived with the linked-world-content commit and are unrelated to this unit.
Base: e16d4a91
Blocked by: 03
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: medium

A contained change to two navigation paths that already exist; the subtlety is ordering the tab switch before the reveal timer.

## What to build

Navigating to a Find hit inside an entity opens the tab that holds the field, then rings the field as today. The entity manager takes the same focus-field hint the Overview panel already takes. Field keys map to tabs: `name`, `aliases[n]`, `type`, `imageTags` open Profile; `playerDescription`, `aiDescription`, `aiSummary` open Descriptions. Replace keeps working on fields in a hidden tab because it edits the record, not the DOM.

The editor's item navigation gains an optional tab hint. Bench findings pass none and land on the persisted tab. The top-level Placeholders tab's owner-node Open passes Placeholders, so it lands on the entity's Placeholders tab.

## Acceptance criteria

- [x] From Profile, a Find hit in AI-Facing Description opens Descriptions and rings the field.
- [x] From Descriptions, a Find hit in Image Tags opens Profile and rings the field; a hit in an alias rings the chip.
- [x] Replace on a field in a hidden tab changes the record.
- [x] Owner-node Open lands on the entity's Placeholders tab.
- [x] Bench Open on an entity finding lands on the entity with the persisted tab.
- [x] World Editor bench-harness tests cover each case; the find-focus suite still passes.
- [x] Four gates green; graph updated.

## Blocked by

- 03 — Tabbed Entity Panel

## Comments

### Code review against `Base:` (2026-09-09)

One hard finding, fixed before handover.

- **Two stray lines in the commit.** Three sessions were editing `WorldEditor.tsx` at once, so this unit was staged as a filtered patch to keep a neighbor's in-flight work out of it. The filter folded a neighbor's removed `LocationManager` line back into context but missed two of their added lines, so the committed file did not parse. The working tree was always correct, which is why the gates passed: **they ran against the tree, not against the commit.** Fixed and amended; every file in the commit is now parsed from its committed blob, and the only remaining difference between the commit and the tree is the neighbors' own hunks.

Findings recorded and not acted on, with reasons:

- **The focus-field shape has no name.** `{ fieldKey: string }` is now written inline in `WorldDetailsManager`, `EntityManager` and `LocationManager`, while `WorldEditor` holds the wider `{ fieldKey: string; itemId: string | null }`. A named type in `src/types` is the right answer. It is deferred because two of those three files are mid-edit in other sessions right now, and a half-adopted type is worse than none.
- **Three shapes for one field-key decision.** `entityTabForField` is a map; `WorldDetailsManager` still answers the same question with two `if`-cascades. Folding those into the same idiom is worth doing, in that file's own unit.
- **`navigateToBenchItem` does not pair its arguments.** `('dictionary', id, 'placeholders')` type-checks. Enforcing the pairing needs an overload plus a cast, which this project's conventions push against, and a mis-pairing sets an entity tab nobody is looking at. Left as is.
- **Returning to the same entity while Find is open re-opens the hit's tab.** The item-id guard covers other items only, so the panel's mount applies a hint that is still current. That reads as coherent rather than wrong: the bar still holds that hit and the field still wears its ring. Recorded as deliberate.
