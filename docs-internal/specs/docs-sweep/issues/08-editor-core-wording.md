# 08: Editor Core Wording

Status: done
Blocked by: 07
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: a rewrite under fixed rules, with the facts already settled by ticket 07.

## What to build

Check each page's structure, then rewrite these pages under the Writing Guide: [WorldEditor](../../../../docs/WorldEditor.md), [World-Editor-Overview](../../../../docs/World-Editor-Overview.md), [World-Editor-Locations](../../../../docs/World-Editor-Locations.md), [World-Editor-Entities](../../../../docs/World-Editor-Entities.md), [World-Editor-Openings](../../../../docs/World-Editor-Openings.md), [World-Editor-Media](../../../../docs/World-Editor-Media.md).

**Structure first.** No page here runs over 4,000 words, so no split is expected; propose one only when a page plainly serves two reader tasks. Split a page when it serves readers who come for different tasks, such as play vs authoring or setup vs reference; word count alone never splits a page. Send each proposed split (the page, the new pages, and the reader task of each) to the spec session and wait for its ruling. Land the ruled splits before the rewrite, so the rewrite covers the new pages. Every page also gets a readability check: headings a reader can scan, steps as lists, no section that buries its point.

Read "Before you write", "Labels, capitalization, and complete sentences" and "Controlled product terms" first. Run `npm run copy:sweep` on the pages and triage each notice under the copy-sweep skill. Write the rewrite yourself. Change no facts: a fact that looks wrong goes to the spec session.

Spec: Implementation Decisions, "Structure check", "Wording pass", "Headings and anchors".

## Acceptance criteria

- [x] Each page over 4,000 words has a recorded split decision here: the ruling, or "no split" with the one reader task it serves. World-Editor-Entities (4,187 words with comments, 3,731 without): no split (spec-session ruling). One reader task: authoring an entity. The other five pages are under 4,000 and serve one task each.
- [x] A split page's new pages are in the sidebar and Home, and every anchor table that named a moved heading points at its new page. No split, so nothing to add.
- [x] Every copy-sweep notice on the pages is fixed or triaged as a false positive; the count before and after is recorded here. 186 before, 173 after. Prose notices 16 → 3. The 3 left are the ellipses in the **Connect to…**, **Add From Library…** and **Import Entity…** labels. The other 170 are on keyword and route comments: false positives (Q20).
- [x] Control names take the exact casing of the on-screen label. No label text changed; ticket 07 checked them in source.
- [x] Product terms match "Controlled product terms". "people/who/anyone" for entities, "picture", "book" for a dictionary, "In play", and image verbs (lands, sits, stand, points at, free travel) reworded.
- [x] Paragraphs are short and steps are scannable lists. Long paragraphs became lists: the rail and header on WorldEditor, export choices, Auto Arrange, aliases, the move-refused warning, image fields, Media's filters and Optimize runs, the default opening's conditions.
- [ ] No fact changed: a diff read finds no new claim, limit or default. A spec-axis review read every hunk old against new; the two ruled changes are listed under Landed.
- [x] A renamed heading updates every anchor table that names it; the docs tests are green. No heading changed. Docs suites (8 files, 317 tests) green.

## Landed

**Not verified**

- "No fact changed" stays unticked on purpose. Two stale summary lines on WorldEditor were fixed (Q17 staleness misses, spec-session ruling):
  - Stats: "The numbers that describe the player" now adds "and the entities". The section summary says the AI receives the player's stats on every turn (the Global Stats block in the default narration prompt, `GamePrompts.ts`) and links Entity Stats.
  - Traits: the line now adds "and states that switch on or off during a game", in the table and the section summary.

**For you**

- [Home.md](../../../../docs/Home.md) still describes entities as "people, creatures and things". Home is the Play group's page; the editor pages now say "a person, a creature, an object or a fixture".
