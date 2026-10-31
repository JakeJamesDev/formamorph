# 11: Editor Text Staleness

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: each claim is checked against source across dictionaries, placeholders, linked content, narration formatting, and the prompt chip editor.

## What to build

Bring these pages in line with the app on `main`: [World-Editor-Dictionary](../../../../docs/World-Editor-Dictionary.md), [World-Editor-Placeholders](../../../../docs/World-Editor-Placeholders.md), [LinkedContent](../../../../docs/LinkedContent.md), [TextFormatting](../../../../docs/TextFormatting.md), [Prompts](../../../../docs/Prompts.md).

List each page's checkable claims: control and tab names, steps, limits, defaults, file formats, shortcuts, what a setting does. Check each one in source or in the dev-router preview. Fix what is wrong, remove what is gone, and add a short mention of shipped behavior that belongs on the page and is missing. Leave correct text as it is: ticket 12 owns the wording.

Spec: Implementation Decisions, "Truth source", "Staleness pass", "Headings and anchors".

## Acceptance criteria

- [x] Every control, tab and setting name on the pages matches its on-screen label (each page's claims checked against src; every new bolded label grepped in src by the review)
- [x] Every default and limit the pages state matches the source (letter order, Max Output list, Include Stats scopes, Inventory `N/A`, recursion cap 3, Semantic Lore model)
- [x] No page describes a removed feature (Discard Changes in the World Editor became Exit Without Saving; no other gone feature found)
- [x] Shipped behavior on each page's subject has at least a short mention (Entity Location prompt, chips-by-prompt table per spec-session ruling, lorebook import formats, Reroll, Autosave write-back, bundled-content checkbox, toolbar shortcuts)
- [x] A renamed or removed heading updates every anchor table that names it; the docs tests are green (no heading changed; affected tests green in the review gates)
- [x] No code change beyond anchor tables; a page/code contradiction where the code looks wrong is named under Landed (diff is docs/ only)
- [x] Landed lists any missing page, stale ADR, or contradicting UI label found on the way

## Landed

Copy sweep on the five pages: 174 notices before, 174 after. Triage is ticket 12's.

**Not verified**

- None.

**For you**

- [src/lib/helpTopics.ts:392](../../../../src/lib/helpTopics.ts) says an imported world's copy of a source you hold always arrives as a local replacement. The code makes it one only when the file's content differs (`src/lib/worldBundle.ts:97`). The page now follows the code.
- [src/lib/helpTopics.ts:354](../../../../src/lib/helpTopics.ts) describes View Changes as "your value and the author's". The dialog labels the sides **This world** and **Library**, or the file's name.
- The linked-row 🔗 marker never shows **Link pending save**; only the footer button's tip does (`src/components/ContentLinkStatus.tsx:16` passes no pending list). The code may be wrong; the page follows it.