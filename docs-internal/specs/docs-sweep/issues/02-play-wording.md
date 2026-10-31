# 02: Play Wording

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: split decisions on How-to-Play, then a rewrite under fixed rules.

## What to build

Check each page's structure, then rewrite these pages under the Writing Guide: [Home](../../../../docs/Home.md), [How-to-Play](../../../../docs/How-to-Play.md), [Starting-a-Game](../../../../docs/Starting-a-Game.md), [Library](../../../../docs/Library.md), [Saves-and-Backup](../../../../docs/Saves-and-Backup.md), [Install-on-Android](../../../../docs/Install-on-Android.md).

**Structure first.** Assess How-to-Play for a split: it runs over 4,000 words. Split a page when it serves readers who come for different tasks, such as play vs authoring or setup vs reference; word count alone never splits a page. Send each proposed split (the page, the new pages, and the reader task of each) to the spec session and wait for its ruling. Land the ruled splits before the rewrite, so the rewrite covers the new pages. Every page also gets a readability check: headings a reader can scan, steps as lists, no section that buries its point.

Read "Before you write", "Labels, capitalization, and complete sentences" and "Controlled product terms" first. Run `npm run copy:sweep` on the pages and triage each notice under the copy-sweep skill. Write the rewrite yourself. Change no facts: a fact that looks wrong goes to the spec session.

Spec: Implementation Decisions, "Structure check", "Wording pass", "Headings and anchors".

## Acceptance criteria

- [x] Each page over 4,000 words has a recorded split decision here: the ruling, or "no split" with the one reader task it serves. How-to-Play: no split (spec-session ruling). One reader task: playing a game in progress. Its 4,340 words include the keyword comments; the prose is about 3,500.
- [x] A split page's new pages are in the sidebar and Home, and every anchor table that named a moved heading points at its new page. No split, so nothing to add.
- [x] Every copy-sweep notice on the pages is fixed or triaged as a false positive; the count before and after is recorded here. `npm run copy:sweep` on the six pages: 243 before, 228 after. 220 notices sit on keyword and route HTML comments, which are search terms: false positives. Prose notices: 23 before, 8 after. The 8 left are quoted UI strings (*Viewing turn n of total — history*, *Move to …?*, *Enjoying …?*, *Turned off …, because of …*, *Game saved as …*, **Loading…**) and the **Character** tab and **Character Customization** labels.
- [x] Control names take the exact casing of the on-screen label. Read against source for the history banner and the mobile **Character** tab; no label text changed.
- [x] Product terms match "Controlled product terms". "phone" became "Android device"; "visual editor" became World Editor; no "picture" or "character" in prose.
- [x] Paragraphs are short and steps are scannable lists. Long paragraphs split into bullets or steps: TTS options, inventory details, Quick Start, dictionary tags, the Avatar step, update details, Autosave.
- [ ] No fact changed: a diff read finds no new claim, limit or default. Two reviews read the diff; the changes listed under Landed are deliberate.
- [x] A renamed heading updates every anchor table that names it; the docs tests are green. No heading changed. Docs suites (11 files, 374 tests) green.

## Landed

**Not verified**

- "No fact changed" stays unticked on purpose. Stale facts the wording pass fixed (Q17 staleness misses):
  - Home intro said Formamorph "runs entirely in the browser" and games "stay on your own machine and model". It now names the browser, the desktop app and Android, says worlds and saves stay on the device, and says the connected AI receives what you send (spec-session ruling).
  - Home caution box said Community Creations shows worlds "unmoderated". The word is gone; "as-is" stays (spec-session ruling). A conditional review line belongs to ticket 05.
  - Install-on-Android's update check said "a few times a day". It now reads "on start, then every few hours", as Saves-and-Backup says. Source: `CHECK_INTERVAL_MS` (3 h) and a check on mount in `src/hooks/useUpdateChecker.ts`.

**For you**

- Read Home's new intro and caution box on the wiki: they are the two ruled fact changes.
