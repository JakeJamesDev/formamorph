# 16: Tools and Test Bench Wording

Status: ready-for-agent
Blocked by: 15
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: a rewrite under fixed rules, with the facts already settled by ticket 15.

## What to build

Check each page's structure, then rewrite these pages under the Writing Guide: [Tools](../../../../docs/Tools.md), [Test-Bench](../../../../docs/Test-Bench.md).

**Structure first.** No page here runs over 4,000 words, so no split is expected; propose one only when a page plainly serves two reader tasks. Split a page when it serves readers who come for different tasks, such as play vs authoring or setup vs reference; word count alone never splits a page. Send each proposed split (the page, the new pages, and the reader task of each) to the spec session and wait for its ruling. Land the ruled splits before the rewrite, so the rewrite covers the new pages. Every page also gets a readability check: headings a reader can scan, steps as lists, no section that buries its point.

Read "Before you write", "Labels, capitalization, and complete sentences" and "Controlled product terms" first. Run `npm run copy:sweep` on the pages and triage each notice under the copy-sweep skill. Write the rewrite yourself. Change no facts: a fact that looks wrong goes to the spec session.

Spec: Implementation Decisions, "Structure check", "Wording pass", "Headings and anchors".

## Acceptance criteria

- [ ] Each page over 4,000 words has a recorded split decision here: the ruling, or "no split" with the one reader task it serves
- [ ] A split page's new pages are in the sidebar and Home, and every anchor table that named a moved heading points at its new page
- [ ] Every copy-sweep notice on the pages is fixed or triaged as a false positive; the count before and after is recorded here
- [ ] Control names take the exact casing of the on-screen label
- [ ] Product terms match "Controlled product terms"
- [ ] Paragraphs are short and steps are scannable lists
- [ ] No fact changed: a diff read finds no new claim, limit or default
- [ ] A renamed heading updates every anchor table that names it; the docs tests are green
