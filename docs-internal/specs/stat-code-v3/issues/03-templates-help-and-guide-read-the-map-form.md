# 03: Templates, Help, And Guide Read The Map Form

Status: ready-for-human
Base: f8b199db
Blocked by: 01
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

A mechanical move of every taught sample to the map form, with the template sandbox tests as the check. Sonnet at medium effort.

## What to build

Every place the app teaches a stat lookup shows the map form and only the map form. The eleven built-in template lookups become `stats[{{slot:stat}}]`, since the stat slot already expands to a quoted name; the `id` lookups become `self`. Both help samples and every guide sample move likewise. The guide shows `Object.values(stats)` once, for the average-of-all formula, and no longer mentions `find`. Template descriptions and the guide's "handle missing stats" advice are reworded for a blank entry that reads zero instead of `undefined`.

## Acceptance criteria

- [x] No built-in template, help sample, or guide sample contains `stats.find`
- [x] Every built-in template runs in the sandbox under the map and returns what it did before
- [x] The guide shows the map form, bracket syntax for a spaced name, and `Object.values(stats)` for iteration
- [x] The guide's missing-stat advice describes the blank entry
- [x] Help copy follows the two-layer settings-copy rule
- [x] Four gates green; graph updated

## Blocked by

- 01 — Stats Becomes A Name-Keyed Map

## Comments

**2026-09-11, implementation notes.**

- **Scope moved out, per the orchestrating session and ticket 01's own session.** 01 already rewrote the 11 built-in template lookups (`src/lib/statCodeTemplates.ts`) to `stats[{{slot:stat}}]` / `self`, and the 4 bundled-world code strings. This ticket did not touch them — only descriptions, both help samples, every guide sample, `Object.values(stats)`, and the missing-stat advice, as scoped.
- **Scope moved in, per ticket 01's session.** Two more teaching spots that throw under the map, flagged by 01: the insert-menu snippets in [`src/lib/codeSnippets.ts`](../../../../src/lib/codeSnippets.ts) ("Another stat's value" → `stats["Health"].value`; "This stat's value" → `self.value`, since it's the trivial map read now) and their assertions in [`CodeArea.test.tsx`](../../../../src/components/prompt/CodeArea.test.tsx:122); and the sample template code in [`CodeTemplatesReference.tsx:55`](../../../../src/components/design-system/CodeTemplatesReference.tsx:55).
- **`currentStatId` / `STAT_FIELDS.id`.** Already resolved on disk by the time this ticket started — `SANDBOX_UNDOCUMENTED_GLOBALS` already excludes `currentStatId` from completions and `STAT_FIELDS.id`'s description never mentioned it. No action needed here.
- **Average of Multiple Stats → Average of All Stats.** The guide's two-stat average example is repurposed into an all-stats average over `Object.values(stats)`, which is where the guide's one `Object.values` teaching point lives. No other file references that heading.
- **Left alone.** `StatCodeTemplateDialog.test.tsx:83` still pastes an old-form `stats.find(...)` string into the slot-detection test — it never executes the code (only tests `{{slot}}` parsing), so it's not a teaching surface and doesn't collide with the acceptance line's built-in-template/help/guide scope. `docs/Changelog.md`'s v2-era entry describing the old `stats.find` typo bug is historical documentation of what shipped, not a live sample — left untouched. The `stats.find`/`s.stats.find` hits in `TraitSelectionModal.tsx`, `traitRuntime.test.ts`, `GameplayContext.traitRoundTrip.test.tsx`, and `statCodeExecutor.ts` are unrelated arrays (component props, runtime state, the executor's own internal `statsData`), not the sandbox `stats` map.
- **Changelog.** The v3 feature already has one consolidated 🚧 In Progress bullet (`docs/Changelog.md`, under "Stat code can set its own bounds…") written ahead of the per-ticket work landing; it already states the map form, `Object.values(stats)`, and the migration. No separate entry added for this ticket.
- **Collision handling.** 03 was blocked by 01 (stats-becomes-a-map). While waiting, tickets 02, 05, and 07 started running concurrently in the same working tree. 05 was actively staging edits to `docs/StatCodeGuide.md` and `helpTopics.ts` — the two files this ticket also needed — so non-overlapping files (`codeSnippets.ts`, `CodeTemplatesReference.tsx`, `CodeArea.test.tsx`, template descriptions) were done first; the guide/help edits started only after 05 committed (`14f61168 Add Delta To Stat Code`).
