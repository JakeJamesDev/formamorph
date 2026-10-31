# 04: AI and Settings Wording

Status: done
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: split decisions on Settings, then a rewrite under fixed rules.

## What to build

Check each page's structure, then rewrite these pages under the Writing Guide: [Connect-Your-Own-AI](../../../../docs/Connect-Your-Own-AI.md), [Settings](../../../../docs/Settings.md), [Image-Generation](../../../../docs/Image-Generation.md), [Memory](../../../../docs/Memory.md), [Avatars](../../../../docs/Avatars.md).

**Structure first.** Assess Settings for a split: it runs over 4,000 words. Split a page when it serves readers who come for different tasks, such as play vs authoring or setup vs reference; word count alone never splits a page. Send each proposed split (the page, the new pages, and the reader task of each) to the spec session and wait for its ruling. Land the ruled splits before the rewrite, so the rewrite covers the new pages. Every page also gets a readability check: headings a reader can scan, steps as lists, no section that buries its point.

Read "Before you write", "Labels, capitalization, and complete sentences" and "Controlled product terms" first. Run `npm run copy:sweep` on the pages and triage each notice under the copy-sweep skill. Write the rewrite yourself. Change no facts: a fact that looks wrong goes to the spec session.

Carried from ticket 03: Settings' Output section is about 6,100 characters with its comments, near the 6,000-character prose limit where the bundled Docs Index splits a section. Growing it splits the section and fails the `Settings#output` hub tests. Keep it under the limit, or split it under a new heading and update the hub.

Spec: Implementation Decisions, "Structure check", "Wording pass", "Headings and anchors".

## Acceptance criteria

- [x] Each page over 4,000 words has a recorded split decision here: the ruling, or "no split" with the one reader task it serves. Settings (4,534 words) split, per the spec-session ruling: Settings keeps Display, Output and Data (set preferences); the new Endpoint-Settings ("🔌 Endpoint Settings") holds the Endpoints tab (connect and tune an AI server). The other four pages are under 4,000 words and don't split; the Blender section stays on Avatars (ruling).
- [x] A split page's new pages are in the sidebar and Home, and every anchor table that named a moved heading points at its new page. `_Sidebar` and Home rows added; surfaceMap.ts, Glossary, Prompts, Image-Generation and help-surface-probe.cli.ts repointed. Grep finds no moved `Settings#` anchor outside sectionVectors.json (rebuilt at close, Q7).
- [x] Every copy-sweep notice on the pages is fixed or triaged as a false positive; the count before and after is recorded here. 194 before, 179 after (six pages). Prose notices 20 → 5. Left: `--` in the `#the-backup--restore-dialog` anchor and the `--api` flag, and the **Character Customization** screen label (×3). The rest sit on keyword and route comments: false positives (ruling).
- [x] Control names take the exact casing of the on-screen label. Labels unchanged; a review read them against settingsCopy.ts and LocalModelModal.tsx.
- [x] Product terms match "Controlled product terms". "picture" → image, "character" → entity in prose; "Point at" and "drive" reworded.
- [x] Paragraphs are short and steps are scannable lists. Long paragraphs became lists across all six pages; the Formamorph AI sign-up and the Avatar license fix are now numbered steps.
- [x] No fact changed: a diff read finds no new claim, limit or default. A spec-axis review compared old and new text; the moved Endpoints content keeps every limit, default and value list. "It starts at one" for **Autosaves Kept** now reads "The default is 1" (`AUTOSAVE_SLOTS = 1`).
- [x] A renamed heading updates every anchor table that names it; the docs tests are green. No heading renamed. Engine Memory and Context, Flash Attention and Context Overflow are `##` on the new page so each stays its own index section. Docs, surface and help-case suites green.

## Landed

**Not verified**

- None. No help baseline run (Q6).

**For you**

- Read the new [Endpoint Settings](../../../../docs/Endpoint-Settings.md) page and the shorter [Settings](../../../../docs/Settings.md) page: the split is the one structural change.
- The new page's questions were written by a page-blind subagent: blind recall `endpoint-settings-b1` and `-b2`, baseline `endpoint-settings-1` and `-2`. The spare "the AI that came with the desktop app is slow" replaced "my game forgets the early part of the story", which fits Memory better.

**Notes**

- `sectionVectors.json` still holds the old `Settings#endpoints` … `#tag-prompt` ids until `build:help-vectors` at spec close (Q7).
- Staleness misses: none found.
