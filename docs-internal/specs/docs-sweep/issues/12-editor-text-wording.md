# 12: Editor Text Wording

Status: done
Blocked by: 11
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: split decisions on Prompts, then a rewrite under fixed rules.

## What to build

Check each page's structure, then rewrite these pages under the Writing Guide: [World-Editor-Dictionary](../../../../docs/World-Editor-Dictionary.md), [World-Editor-Placeholders](../../../../docs/World-Editor-Placeholders.md), [LinkedContent](../../../../docs/LinkedContent.md), [TextFormatting](../../../../docs/TextFormatting.md), [Prompts](../../../../docs/Prompts.md).

**Structure first.** Assess Prompts for a split: it runs over 4,000 words. Split a page when it serves readers who come for different tasks, such as play vs authoring or setup vs reference; word count alone never splits a page. Send each proposed split (the page, the new pages, and the reader task of each) to the spec session and wait for its ruling. Land the ruled splits before the rewrite, so the rewrite covers the new pages. Every page also gets a readability check: headings a reader can scan, steps as lists, no section that buries its point.

Read "Before you write", "Labels, capitalization, and complete sentences" and "Controlled product terms" first. Run `npm run copy:sweep` on the pages and triage each notice under the copy-sweep skill. Write the rewrite yourself. Change no facts: a fact that looks wrong goes to the spec session.

Spec: Implementation Decisions, "Structure check", "Wording pass", "Headings and anchors".

## Acceptance criteria

- [x] Each page over 4,000 words has a recorded split decision here: the ruling, or "no split" with the one reader task it serves — Prompts (4,915 words): spec session ruled a split on 2026-10-31. Prompts keeps presets, the prompts, surfaces and world prompts (reader task: manage presets). New Prompt-Chips takes The Chip Editor, Chip Options, The Inventory Chip and the two chip how-tos (reader task: control what a chip sends). The other four pages are under 4,000 words; no split, ruled.
- [x] A split page's new pages are in the sidebar and Home, and every anchor table that named a moved heading points at its new page — _Sidebar under Prompts, Home row; Glossary, Persona-Authoring, World-Editor-Entities/Placeholders/Stats, surfaceMap `chipOptions` and bundledDocsIndex.test.ts repointed. A grep for the moved slugs under `Prompts#` finds only sectionVectors.json (rebuilt at close, Q7).
- [x] Every copy-sweep notice on the pages is fixed or triaged as a false positive; the count before and after is recorded here — before: 174 on 5 pages (139 in keyword/route comments, 35 in prose). After: 147 on 6 pages (141 in comments, false positives per Q20; 6 in prose: 5 ellipses inside on-screen labels such as **Add From Library…**, and the **Character Name** chip label).
- [x] Control names take the exact casing of the on-screen label — icon buttons named per Q12 (**Add to Dictionary**, **Add to Placeholders**, **Add entry**, **Add to Entities**), each grepped in src/managers.
- [x] Product terms match "Controlled product terms" — "nobody" for entities and "the AI knows" removed; "image" kept.
- [x] Paragraphs are short and steps are scannable lists — long paragraphs on Dictionary, Placeholders, LinkedContent and TextFormatting became lists; the letter order on Placeholders is a numbered list.
- [x] No fact changed: a diff read finds no new claim, limit or default — own read plus a spec-axis review subagent; see Landed for one wording to glance at.
- [x] A renamed heading updates every anchor table that names it; the docs tests are green — headings renamed by case only, slugs unchanged; src/lib/docs and help case tests: 334 green.

## Landed

**Not verified**

- None.

**For you**

- Prompt-Chips, "Chip Options" bullets: "A bare chip sends what it sent before" now reads "A chip with no picks sends its default text", because docs state current behavior. Check it says what you mean.
- The four Prompt-Chips help questions were written by a page-blind subagent (Q19). No baseline run (Q6).
- Wording pass also named the + button on Placeholders (ticket 10 scope add) and on Dictionary and LinkedContent, per Q12.
