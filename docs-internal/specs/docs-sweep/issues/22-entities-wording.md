# 22: Entities in Game Wording

Status: ready-for-agent
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

- [ ] The page has a recorded split decision here: "no split" with the one reader task it serves, or the ruling
- [ ] Every copy-sweep notice on the page is fixed or triaged as a false positive; the count before and after is recorded here
- [ ] Control names take the exact casing of the on-screen label
- [ ] Product terms match "Controlled product terms"
- [ ] Paragraphs are short and steps are scannable lists
- [ ] No fact changed: a diff read finds no new claim, limit or default
- [ ] A renamed heading updates every anchor table that names it; the docs tests are green
