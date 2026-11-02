# 20: Reference Wording

Status: done
Blocked by: 19
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: split decisions on WorldFormat, then a rewrite under fixed rules.

## What to build

Check each page's structure, then rewrite these pages under the Writing Guide: [WorldFormat](../../../../docs/WorldFormat.md), [Glossary](../../../../docs/Glossary.md), [_Sidebar](../../../../docs/_Sidebar.md).

**Structure first.** Assess WorldFormat for a split: it runs over 4,000 words. Split a page when it serves readers who come for different tasks, such as play vs authoring or setup vs reference; word count alone never splits a page. Send each proposed split (the page, the new pages, and the reader task of each) to the spec session and wait for its ruling. Land the ruled splits before the rewrite, so the rewrite covers the new pages. Every page also gets a readability check: headings a reader can scan, steps as lists, no section that buries its point.

Read "Before you write", "Labels, capitalization, and complete sentences" and "Controlled product terms" first. Run `npm run copy:sweep` on the pages and triage each notice under the copy-sweep skill. Write the rewrite yourself. Change no facts: a fact that looks wrong goes to the spec session.

Carried from ticket 10: the Glossary's Link row says it "reads the Blueprint live", which is figurative, and the Global Stat and Global Trait rows say "No one owns it". Reword both under the Writing Guide.

Carried from ticket 19:
- Word the twelve Glossary rows it added: Presence, Movement, Known In, Known Here, Relationship, Stranger Name, Stat Link, Item, Item Copy, Starting Items, Slot, Body.
- WorldFormat's Bodies section says "Library characters and characters the AI adds". Use the controlled term (entity).
- Two "In play" phrases in the new WorldFormat text. Use "during the game".

Spec: Implementation Decisions, "Structure check", "Wording pass", "Headings and anchors".

## Acceptance criteria

- [x] Each page over 4,000 words has a recorded split decision here: the ruling, or "no split" with the one reader task it serves. WorldFormat (10,449 words): no split, accepted by the spec session. Its one reader task: edit a world file by hand, or write a tool that reads or writes one. Glossary (3,384) and _Sidebar are under the bar.
- [x] A split page's new pages are in the sidebar and Home, and every anchor table that named a moved heading points at its new page. No split, so nothing moved.
- [x] Every copy-sweep notice on the pages is fixed or triaged as a false positive; the count before and after is recorded here. 57 before, 50 after. Fixed: 2 "In play", 2 "live", 1 long sentence, 1 "characters". The 50 left are false positives: 45 on `<!-- keywords -->` and route comments (search terms and the `-->` arrow), 5 ellipses inside JSON samples and `{ "value": … }` shapes.
- [x] Control names take the exact casing of the on-screen label. Movement and Presence options read against `src/lib/entityPresenceCopy.ts`. The `{{char}}` chip is **Entity Name** (`builtinPlaceholders.ts:94`), renamed on every docs page (Q25).
- [x] Product terms match "Controlled product terms". "Characters" → entity, "character card" → entity card, "No one owns it" → "It has no owner".
- [x] Paragraphs are short and steps are scannable lists. Pages were already table and list shaped; one long sentence and one packed `owner` bullet split.
- [x] No fact changed: a diff read finds no new claim, limit or default. Two review agents read the diff; each reworded row matches the WorldFormat field it restates.
- [x] A renamed heading updates every anchor table that names it; the docs tests are green. Grep finds no anchor table outside `sectionVectors.json` (close rebuilds it, Q7). The docs tests run in prepare's gates, which refuse a red landing.

## Landed

**Not verified**

- Nothing left unticked.

**For you**

- Staleness misses, fixed here under Q25: the `{{char}}` chip was still "Character Name" on Persona-Authoring (Personas group; heading now "The Entity Name Chip") and on World-Editor-Placeholders, World-Editor-Entities, World-Editor-Openings and World-Editor-Traits (Editor text and Editor groups).
- Code comments still call the chip "Character Name": `src/lib/chipValues/authoredScene.ts`, `chipScene.ts`, `liveScene.ts`, `newGameOpening.ts`, `ownedTraitsInPlay.ts`, `persona.ts`, `placeholders.ts`, `resolveWorldNames.ts`. Out of scope for a docs ticket.
- The Writing Guide's timing row still says "in play" ("When a Trait Switches runs when a trait turns on or off in play"). The guide is a rule source, out of scope.
- WorldFormat's Stat Changes note says "Apps older than this change don't read `"global"`". It names no version, and docs state current behavior only. The fix needs the version number.
