# 19: Reference Staleness

Status: done
Blocked by: 02, 04, 06, 08, 10, 12, 14, 16, 18
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: each claim is checked against source across the world export shape, the glossary terms the other pages settled, and the wiki nav.

## What to build

Bring these pages in line with the app on `main`: [WorldFormat](../../../../docs/WorldFormat.md), [Glossary](../../../../docs/Glossary.md), [_Sidebar](../../../../docs/_Sidebar.md).

It waits for every other wording ticket, so the Glossary and the format page match the terms those pages settled (Q5).

Carried from ticket 08: Home still describes entities as "people, creatures and things", but the editor pages say "a person, a creature, an object or a fixture". Make Home and the Glossary match the editor pages.

Carried from the splits: the sweep added eight pages (Account, Feedback, Endpoint-Settings, World-Editor-Blueprints, Prompt-Chips, Scripts-Reference, Formaquestion-Settings, Formaquestion-Mascot). Check that `_Sidebar` lists each one next to its parent page in a reading order, and that the Glossary links point at the page that now holds each term.

Carried from ticket 14: WorldFormat links "what a script's `code` can do" to the Scripts Guide. Point it at Scripts-Reference.

List each page's checkable claims: control and tab names, steps, limits, defaults, file formats, shortcuts, what a setting does. Check each one in source or in the dev-router preview. Fix what is wrong, remove what is gone, and add a short mention of shipped behavior that belongs on the page and is missing. Leave correct text as it is: ticket 20 owns the wording.

Spec: Implementation Decisions, "Truth source", "Staleness pass", "Headings and anchors".

## Acceptance criteria

- [x] Every control, tab and setting name on the pages matches its on-screen label: new bold names grepped to their label strings in source (`entityPresenceCopy.ts`, `EntityFields.tsx`, `ItemEffectsFields.tsx`, `WorldEditor.tsx:1316`)
- [x] Every default and limit the pages state matches the source: checked against `src/types/world.ts`, `src/types/ai.ts`, `blankWorld.ts`, `migrateWorld`
- [x] No page describes a removed feature: "Export World on the Overview tab" moved to the Save menu; "Only the player has stats" replaced
- [x] Shipped behavior on each page's subject has at least a short mention: WorldFormat sections for Items, Starting Items, World Tools, Stat Groups, Stat Links; Glossary rows below
- [x] Every Glossary term matches the word the swept pages use; a term no page uses any more is removed or named under Landed: Entity, Formaquestion, Tool, Condition and Blueprint rows fixed; no term found unused
- [x] WorldFormat matches the current world export shape field by field: every field of the world types compared by a review subagent, none missing
- [x] A renamed or removed heading updates every anchor table that names it; the docs tests are green: no heading renamed; `vitest run src/lib/docs` 313 passed
- [x] No code change beyond anchor tables; a page/code contradiction where the code looks wrong is named under Landed: docs only
- [x] Landed lists any missing page, stale ADR, or contradicting UI label found on the way

## Landed

**Not verified:** none.

**For you:**
- Rulings Q22–Q24 applied: full field tables in [WorldFormat](../../../../docs/WorldFormat.md); Glossary rows added; Home fixed.
- Glossary rows added, for ticket 20 to word: Presence, Movement, Known In, Known Here, Relationship, Stranger Name, Stat Link, Item, Item Copy, Starting Items, Slot, Body. Stat Group was left out: no page uses it as a name.
- Glossary rows fixed: Entity (now "an object or a fixture"), Formaquestion (world reading is the **Read the World** setting, not a Tool), Tool (World Tool scripts can change the story), Condition (adds item and time of day), Blueprint (adds stats).
- WorldFormat: the migration note said "the last six rows" are version-gated; only four are (`migrateWorld`). Rows reordered so the gated four come last. An entity `startingLocationId` row added.
- WorldFormat's Scripts section lost the `stat code` keyword. With the new sections, it outranked the Scripts pages for "stat code" and failed the `bundledDocsIndex` "player who still says stat code" test. The Scripts Guide keeps the synonym.
- Play staleness miss: [Home](../../../../docs/Home.md) entity row said "people, creatures and things".
- Missing coverage: no page describes the **Known In** control itself. World-Editor-Entities names it and its effect; World-Editor-Locations mentions it only on the canvas entity card. The Glossary row links World-Editor-Entities#locations.
- For ticket 20: WorldFormat's Bodies section still says "Library characters and characters the AI adds" (term-character).
- Copy sweep on the four pages: 53 notices before, 60 after. The new ones are keyword comments (Q20), JSON `…` notation, and two "In play" phrases.
