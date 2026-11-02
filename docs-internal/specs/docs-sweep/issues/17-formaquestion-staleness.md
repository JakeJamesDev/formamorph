# 17: Formaquestion Staleness

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: each claim is checked against source across Formaquestion, its settings, the Mascot, and the help window.

## What to build

Bring these pages in line with the app on `main`: [Formaquestion](../../../../docs/Formaquestion.md).

List each page's checkable claims: control and tab names, steps, limits, defaults, file formats, shortcuts, what a setting does. Check each one in source or in the dev-router preview. Fix what is wrong, remove what is gone, and add a short mention of shipped behavior that belongs on the page and is missing. Leave correct text as it is: ticket 18 owns the wording.

Spec: Implementation Decisions, "Truth source", "Staleness pass", "Headings and anchors".

## Acceptance criteria

- [x] Every control, tab and setting name on the pages matches its on-screen label: each bold label checked against its source string (Memory Summaries, Duplicate, More Actions, Close, the Mascot-off line)
- [x] Every default and limit the pages state matches the source: `helpSettings.ts` `DEFAULT_HELP_SETTINGS`, `windowBox.ts` scale and placement, `helpPresets.ts` options
- [x] No page describes a removed feature: the Mascot row on the Mascot tab dropped; Add New Preset in the endpoint editor replaced by Duplicate
- [x] Shipped behavior on each page's subject has at least a short mention: Read the World row, Editor World and Game World prompts, Code Insert, Copy, Sources fold, landing ring, mascot Undo/Redo and layers, AI World Search
- [x] A renamed or removed heading updates every anchor table that names it; the docs tests are green: no heading changed; `src/lib/docs` 310 tests green
- [x] No code change beyond anchor tables; a page/code contradiction where the code looks wrong is named under Landed: the diff is `docs/Formaquestion.md` only
- [x] Landed lists any missing page, stale ADR, or contradicting UI label found on the way

## Landed

**Not verified:** none. Claims were checked in source and tests, not in the dev-router preview.

**For you:**
- The Insert tooltip, [CodeInsert.tsx:13](../../../../src/components/formaquestion/CodeInsert.tsx), says "a stat's Code tab". The stat tab's label is **Scripts** (`src/views/statPanelTabs.ts`). This contradicts the UI label; the page follows the tab.
- A stale code comment, `src/lib/formaquestion/helpSettings.ts:87`, says the session sends the preset's "three texts". The preset has eight.
- No missing page or stale ADR found.
- Ticket 18 (wording): the Standards review flagged judgment calls in new lines (element types on first mention, "characters, places" vs entity and location terms in untouched text).
