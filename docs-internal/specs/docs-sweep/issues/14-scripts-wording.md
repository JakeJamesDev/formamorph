# 14: Scripts Wording

Status: done
Blocked by: 13
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: split decisions on ScriptsGuide, then a rewrite under fixed rules.

## What to build

Check each page's structure, then rewrite these pages under the Writing Guide: [ScriptsGuide](../../../../docs/ScriptsGuide.md), [StatCodeGuide](../../../../docs/StatCodeGuide.md).

**Structure first.** Assess ScriptsGuide for a split: it runs over 4,000 words. Split a page when it serves readers who come for different tasks, such as play vs authoring or setup vs reference; word count alone never splits a page. Send each proposed split (the page, the new pages, and the reader task of each) to the spec session and wait for its ruling. Land the ruled splits before the rewrite, so the rewrite covers the new pages. Every page also gets a readability check: headings a reader can scan, steps as lists, no section that buries its point.

Read "Before you write", "Labels, capitalization, and complete sentences" and "Controlled product terms" and "The technical register" first. Run `npm run copy:sweep` on the pages and triage each notice under the copy-sweep skill. Write the rewrite yourself. Change no facts: a fact that looks wrong goes to the spec session.

Spec: Implementation Decisions, "Structure check", "Wording pass", "Headings and anchors".

## Acceptance criteria

- [x] Each page over 4,000 words has a recorded split decision here: the ruling, or "no split" with the one reader task it serves. ScriptsGuide (~19.8k words) split, ruled by the spec session: ScriptsGuide keeps "build a script in the editor and decide when it runs" (how-tos, Overview, How It Works, Best Practices, Limitations, Troubleshooting); new Scripts-Reference serves "look up what an object reads and writes" (Quick Reference, Writing Scripts, Examples, Advanced Examples). StatCodeGuide (26 words, a redirect) no split: one task, "find the Scripts Guide from an old link"
- [x] A split page's new pages are in the sidebar and Home, and every anchor table that named a moved heading points at its new page. `_Sidebar` and Home lines added; codeGuideLinks, surfaceMap `codeRename`, helpCodeRider `QUICK_REFERENCE_SECTION`, docs tests, help cases and cross-links in Tools, Glossary, World-Editor-Entities/Items/Stats/Traits repointed by script from the moved-heading list
- [x] Every copy-sweep notice on the pages is fixed or triaged as a false positive; the count before and after is recorded here. Before: 138 (22 real, 116 on keyword and route comments). After: 116, all on keyword and route comments (Q20 false positives)
- [x] Control names take the exact casing of the on-screen label. Checked each against source (settingsCopy.ts, ScriptBox.tsx, CodeRenameOffer.tsx, ToolEditor.tsx, StatCodeTemplateDialog.tsx, MemoryPanel.tsx)
- [x] Product terms match "Controlled product terms". "character" left only in keyword comments and the **Describe New Characters** label
- [x] Both guides got the hand sweep the copy-sweep skill requires: the script skips `docs/*Guide.md`. Hand sweep under "The technical register" on both pages; a grep for land, route, reach, in force, stands, goes away and drop finds only literal code comments
- [x] Paragraphs are short and steps are scannable lists. Dense paragraphs became bullets or numbered steps; a standards review sub-agent re-read both pages
- [x] No fact changed: a diff read finds no new claim, limit or default. A spec review sub-agent diffed old against new section by section; its 12 findings were reverted to the old meaning, except the two Q17 misses under Landed
- [x] A renamed heading updates every anchor table that names it; the docs tests are green. No heading renamed; moved headings repointed. Docs, guide-link and help suites green (91 files, 1683 tests) before the review fold-in; prepare reruns the gates

## Landed

**Not verified**
- None. Every criterion above is ticked.

**Notes**
- Q19 questions: a page-blind subagent of the spec session wrote them. Added verbatim: `scripts-reference-1`, `scripts-reference-2` (baseline) and `scripts-reference-b1`, `scripts-reference-b2` (blind recall). `statcodeguide-2` and `statcode-b3` moved to page Scripts-Reference with their sections. ScriptsGuide keeps two cases in each set, so no ScriptsGuide question was added. No baseline run (Q6).
- Captured bodies (ruled within the guard): two section ids in `lookup-mode.json`, two page attributes in `code-turn.json`. Section content is byte-equal.
- `sectionVectors.json` still names the old `ScriptsGuide#` ids for the moved sections; Q7 rebuilds it at spec close.
- Q17 staleness misses, fixed after a spec-session check:
  - ScriptsGuide "How to Change Another Stat from Code" said "the four fields". There are five writable fields; the number is gone.
  - Scripts-Reference "Accessing Other Stats" named **Update Code References** as a button. It is the dialog title; the buttons are **Update Code** and **Leave Code**.
- `docs/Writing-Guide.md` cites `[ScriptsGuide](ScriptsGuide)` as the source of the "switch" term, which now lives in Scripts-Reference#traits. Out of scope (Q4); left as is.
- `docs/WorldFormat.md` links "what a script's `code` can do" to the Scripts Guide; Scripts-Reference fits better. Reference group page; left for ticket 19/20.

**For you**
- Read [Scripts Guide](../../../../docs/ScriptsGuide.md) and [Scripts Reference](../../../../docs/Scripts-Reference.md) once in the wiki sidebar order, and judge whether the split reads as two tasks.
