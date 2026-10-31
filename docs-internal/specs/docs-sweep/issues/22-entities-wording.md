# 22: Entities in Game Wording

Status: ready-for-human
Blocked by: 21
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: a rewrite under fixed rules, with the facts already settled by ticket 21.

## What to build

Check the page's structure, then rewrite this page under the Writing Guide: [Entities](../../../../docs/Entities.md) ("Entities in Game").

**Structure first.** The page runs under 4,000 words, so no split is expected; propose one only when it plainly serves two reader tasks. Word count alone never splits a page. Send a proposed split (the page, the new pages, and the reader task of each) to the spec session and wait for its ruling. The page also gets a readability check: headings a reader can scan, steps as lists, no section that buries its point.

Read "Before you write", "Labels, capitalization, and complete sentences" and "Controlled product terms" first. Pipeline words (planner, cast, pass) never go in: the page uses "cast" in its intro and a heading. Run `npm run copy:sweep` on the page and triage each notice under the copy-sweep skill. Write the rewrite yourself. Change no facts: a fact that looks wrong goes to the spec session.

Spec: Implementation Decisions, "Structure check", "Wording pass", "Headings and anchors".

## Acceptance criteria

- [x] The page has a recorded split decision here: "no split" with the one reader task it serves, or the ruling. No split (1,801 words): one reader task, understanding and managing the entities in a game while playing. Three headings renamed for scanning and to drop "cast": "How to Remove a Cast Member" → "How to Remove an Entity from Your Game", "Removing One" → "Removing an Entity", "When It's Quiet" → "When the List Stays Short".
- [x] Every copy-sweep notice on the page is fixed or triaged as a false positive; the count before and after is recorded here. 37 before, 32 after. Fixed 5: four long sentences, one filler ("actually"). Left 32: 30 on keyword and route comments (Q20); 2 term-character on the on-screen labels **Characters**, **Describe New Characters** and **Character Diaries**.
- [x] Control names take the exact casing of the on-screen label. Checked in source: `EntityListRow.tsx` tooltips (`Following you`, `Remove ${label}`), `GamePanels.tsx` dialog title, `settingsCopy.ts`, `EnterWorldWorkspace.tsx`, `EnterWorldFlow.tsx`. The trash button follows Q12.
- [x] Product terms match "Controlled product terms". "Cast" is gone from the intro, headings and body; no "character" for an entity; no "someone"/"nobody" for an entity.
- [x] Paragraphs are short and steps are scannable lists. The footprints mark became its own step; the stranger line its own paragraph.
- [x] No fact changed: a diff read finds no new claim, limit or default. Spec-axis review read the old and new page sentence by sentence; its two meaning shifts (the **Describe New Characters** first-time default, "no setting changes it") were restored.
- [x] A renamed heading updates every anchor table that names it; the docs tests are green. `help-baseline-cases.json` and `help-recall-blind-cases.json` follow; no other reference outside `sectionVectors.json`, which the spec close rebuilds (Q7). Docs tests green (347 tests).

## Landed

**Not verified**

- Nothing left unticked.

**For you**

- The help vectors still hold the old section ids `Entities#how-to-remove-a-cast-member`, `#removing-one` and `#when-its-quiet`. The spec close rebuilds them (Q7).
- Other pages still describe this page with "cast" in their link lines: [How-to-Play.md:418](../../../../docs/How-to-Play.md), [Personas.md:185](../../../../docs/Personas.md), [Starting-a-Game.md:224](../../../../docs/Starting-a-Game.md). Out of this ticket's page; a later wording fix.
- "plain narration with no planning" (Entities, "Entities the Story Invents") keeps "planning" because it names the Thinking mode. Read whether it passes as a player word.
