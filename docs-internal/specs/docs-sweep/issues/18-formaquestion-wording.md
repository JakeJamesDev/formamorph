# 18: Formaquestion Wording

Status: ready-for-human
Blocked by: 17
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: split decisions on Formaquestion, then a rewrite under fixed rules.

## What to build

Check each page's structure, then rewrite these pages under the Writing Guide: [Formaquestion](../../../../docs/Formaquestion.md).

**Structure first.** Assess Formaquestion for a split: it runs over 4,000 words. Split a page when it serves readers who come for different tasks, such as play vs authoring or setup vs reference; word count alone never splits a page. Send each proposed split (the page, the new pages, and the reader task of each) to the spec session and wait for its ruling. Land the ruled splits before the rewrite, so the rewrite covers the new pages. Every page also gets a readability check: headings a reader can scan, steps as lists, no section that buries its point.

Read "Before you write", "Labels, capitalization, and complete sentences" and "Controlled product terms" first. Run `npm run copy:sweep` on the pages and triage each notice under the copy-sweep skill. Write the rewrite yourself. Change no facts: a fact that looks wrong goes to the spec session.

Carried from ticket 17's review: the new lines name element types on first mention, and untouched text says "characters, places" where the controlled terms are entity and location. Bring both under Controlled product terms.

Carried from ticket 06: Formaquestion calls its ⋮ button "the **⋮** menu". Its tooltip and accessible name are **More Actions**, and Community-Creations now uses that name. Match it (Q12).

Spec: Implementation Decisions, "Structure check", "Wording pass", "Headings and anchors".

## Acceptance criteria

- [x] Each page over 4,000 words has a recorded split decision here: the ruling, or "no split" with the one reader task it serves. Formaquestion (14,630 words with comments) splits three ways, ruled by the spec session 2026-10-31 (Q10):
  - **Formaquestion**: get help while you use the app (ask, search, the Guide, the window and its chat styles, AI Context, mobile, the **Help** tab).
  - **Formaquestion-Settings** ("⚙️ Formaquestion Settings"): set up and tune the AI behind help (General, Endpoint, Prompts, Tools and their how-tos).
  - **Formaquestion-Mascot** ("🧸 Formaquestion Mascot"): make, customize and share a mascot (the Mascot tab). The three chat-style paragraphs moved to The Window as Chat Styles (ruling).
- [x] A split page's new pages are in the sidebar and Home, and every anchor table that named a moved heading points at its new page. `_Sidebar` (nested under Formaquestion) and Home rows added; surfaceMap.ts (`formaquestionSettings`, `formaquestionCompare`, `formaquestionSettings.*`), bundledDocsIndex.test.ts (7 cases), Glossary "Search Source" and the in-page links repointed. A link script finds no `Formaquestion#` link to a moved heading outside sectionVectors.json (rebuilt at close, Q7).
- [x] Every copy-sweep notice on the pages is fixed or triaged as a false positive; the count before and after is recorded here. Before: 171 on 1 page (21 in prose). After: 153 on 3 pages, 0 in prose; every one sits on a keyword or route comment (Q20 false positives).
- [x] Control names take the exact casing of the on-screen label. A review read the bold labels against source (formaquestionSettingsTabs.ts, presetHeaderActions.ts, settingsTabs.ts). The ⋮ button is **More Actions** per Q12; preset header actions are named as icon buttons, with the Mascot tab's tooltips in its table.
- [x] Product terms match "Controlled product terms". "characters, places" → entities, locations; "in play" → during the game; status lines and "note that" reworded.
- [x] Paragraphs are short and steps are scannable lists. Long paragraphs became bullets or tables: the Ask wait lines, Take Me There, Back and Forward, Help for This Screen, Backdrop, Mascot Scale, The Window history, Chat Styles, the General notes, chip rules, the preset file, My Tools, the Mascot Presets and The Rig.
- [ ] No fact changed: a diff read finds no new claim, limit or default. Two reviews read the diff; the Q17 fixes under Landed are the deliberate changes.
- [x] A renamed heading updates every anchor table that names it; the docs tests are green. No heading renamed; moved H3/H4 headings kept their wording and slugs. Docs and harness suites (25 files, 709 tests) green.

## Landed

**Not verified**

- No fact changed: two reviews and a word-level diff found no new claim. Two readings remain a judgment: "How to Make Your Own Mascot" is a new how-to built from facts already on the page, and the Mascot tab's tooltips now show in its table (read from MASCOT_COPY.tips).

**For you**

- Read the three pages on the wiki once it publishes: [Formaquestion](../../../../docs/Formaquestion.md), [Formaquestion-Settings](../../../../docs/Formaquestion-Settings.md), [Formaquestion-Mascot](../../../../docs/Formaquestion-Mascot.md).

**Notes**

- Q17 staleness misses fixed (spec-session rulings): the help Endpoint tab's copy button is **Duplicate**, not "Add New Preset"; the Settings tab is **Endpoints**, not "AI Endpoints"; the "window stays above the settings" bullet is gone (the window waits closed).
- Contradicting UI label: the help Endpoint tab's hint says "AI Endpoints tab" (`ENDPOINT_COPY.followsActive`, formaquestionSettingsTabs.ts:200). The Settings tab is **Endpoints**. Ticket 03 found the same in the Settings Prompts tab.
- The Q19 help cases (2 blind, 2 baseline each for Formaquestion-Settings and Formaquestion-Mascot) were written by a page-blind subagent and added verbatim. The questions came before the new Mascot how-to. Formaquestion keeps 2 + 2 cases, so no spares were used. No baseline run (Q6).
- sectionVectors.json still names 22 old `Formaquestion#` ids; `build:help-vectors` at close rebuilds them (Q7).
