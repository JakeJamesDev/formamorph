# 09: Editor Data Staleness

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: each claim is checked against source across stats, Items and Item Copies, and traits and Blueprints.

## What to build

Bring these pages in line with the app on `main`: [World-Editor-Stats](../../../../docs/World-Editor-Stats.md), [World-Editor-Items](../../../../docs/World-Editor-Items.md), [World-Editor-Traits](../../../../docs/World-Editor-Traits.md).

List each page's checkable claims: control and tab names, steps, limits, defaults, file formats, shortcuts, what a setting does. Check each one in source or in the dev-router preview. Fix what is wrong, remove what is gone, and add a short mention of shipped behavior that belongs on the page and is missing. Leave correct text as it is: ticket 10 owns the wording.

Spec: Implementation Decisions, "Truth source", "Staleness pass", "Headings and anchors".

## Acceptance criteria

- [x] Every control, tab and setting name on the pages matches its on-screen label (checked in source: item and trait panel tab lists, the requirement picker's list order, the Add to *entity* button, and the Test Bench Issues tab)
- [x] Every default and limit the pages state matches the source (the default descriptor bands in `statDescriptors.ts`, Settings Prompts gated by Advanced mode, the name match that trims only the ends)
- [x] No page describes a removed feature (removed: the Stats tab gate on entity traits and the Detach stat-stripping confirmation, both gone since 2026-10-10; and the two-time-conditions example)
- [x] Shipped behavior on each page's subject has at least a short mention (new Stats section "Blueprint Stats and Links", ruled by the spec session; item and trait panel tabs; trait link Scripts override; three trait Test Bench warnings)
- [x] A renamed or removed heading updates every anchor table that names it; the docs tests are green (no heading renamed or removed; `src/lib/docs` tests: 317 green)
- [x] No code change beyond anchor tables; a page/code contradiction where the code looks wrong is named under Landed (the diff is docs only)
- [x] Landed lists any missing page, stale ADR, or contradicting UI label found on the way

## Landed

**Not verified**: none.

**For you**:
- Code that looks wrong: the Test Bench warning for a global trait that needs an entity's target says "Pick You or an entity as the owner", but the owner option is labeled **Persona** (`src/lib/testBench/rules.ts:2558`). Its summary also says "an entity's item" where it means a trait, group or stat (`rules.ts:2554`).
- Code that looks wrong: the `TraitManager` JSDoc says the stat sections show only on a persona or where the trait already has stat effects (`src/managers/TraitManager.tsx:138`). The Stats tab always shows.
- Code that looks wrong: the `seedItemCopies` comment says "a hidden placement stays its own row" (`src/lib/inventory/index.ts:72`), but hidden rows stack with hidden rows (`index.ts:88`). The page follows the code.
- "Replace which image?" dialog (the spec session's scope add): items are not a one-image field. The item image uses `EntityImageWidget` with `slots={Infinity}` (`src/managers/ItemManager.tsx:274`, `src/managers/EntityFields.tsx:357`), as entity, location and map images do. An unlimited gallery always keeps an empty slot (`src/managers/ImageTagsField.tsx:252`), so `placeGenerated` never opens the dialog (`:291-300`). No production field passes a finite `slots`, so the dialog is reachable only from tests and the dev-route. The Items page gets no mention, and `imageReplace` stays mapped to World-Editor-Entities. Removing or keeping the dialog is your call.
- Missing page: no other page covers stat Blueprints and links. The new Stats section is the only coverage.