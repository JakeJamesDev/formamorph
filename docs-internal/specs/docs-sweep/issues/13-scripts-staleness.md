# 13: Scripts Staleness

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: each claim is checked against source across scripts and their timings, stat code, and the script surface.

## What to build

Bring these pages in line with the app on `main`: [ScriptsGuide](../../../../docs/ScriptsGuide.md), [StatCodeGuide](../../../../docs/StatCodeGuide.md).

List each page's checkable claims: control and tab names, steps, limits, defaults, file formats, shortcuts, what a setting does. Check each one in source or in the dev-router preview. Fix what is wrong, remove what is gone, and add a short mention of shipped behavior that belongs on the page and is missing. Leave correct text as it is: ticket 14 owns the wording.

Spec: Implementation Decisions, "Truth source", "Staleness pass", "Headings and anchors".

## Acceptance criteria

- [x] Every control, tab and setting name on the pages matches its on-screen label: checked in component source (template menus, Variable menu, Try It, Advanced-only settings)
- [x] Every default and limit the pages state matches the source: `scriptSandbox.ts` limits, `settingsAdvancedData.ts` defaults, switch depth 8, item depth 3
- [x] No page describes a removed feature: no stale global or retired form; the dice-independence claim removed (Q-b)
- [x] Shipped behavior on each page's subject has at least a short mention: item Scripts tab, Items menu group, Overview writes, error bullets per section (Q-c), whole-entry pin (Q-a), memory and stack caps (Q-d)
- [x] Every global, function and timing the guides name exists in the script surface, and every one the surface exposes is documented: inventory of `statCodeSurface.ts` against the whole page; `persona.items` and verbs, `owner.items` and item placeholders added
- [x] A renamed or removed heading updates every anchor table that names it; the docs tests are green: no heading changed; `src/lib/docs`, quick-reference, guide-link and formaquestion suites green (1,673 tests)
- [x] No code change beyond anchor tables; a page/code contradiction where the code looks wrong is named under Landed: docs only
- [x] Landed lists any missing page, stale ADR, or contradicting UI label found on the way

## Landed

**Not verified**

- Nothing unticked. Claims were checked in source, not in the dev-router preview.

**For you**

- Code looks wrong (Q16): `Math.random` is reseeded only on read-only (user Tool) runs (`src/lib/statCodeExecutor.ts:1704`, `:2084`). QuickJS seeds from the clock, so two stat scripts that start in one millisecond can draw the same numbers. The page's claim that dice stats roll independently is removed with no replacement.
- Contradicting UI label: the world **Scripts** tab hint says "During a game, the persona's scripts run before other entities'" (`src/managers/useWorldScriptsAdapter.tsx:236`). Stat owners run in authored order (`entityStatOwners`, `src/lib/entityStats.ts:199`), as the page says.
- Stale editor completion text: `unpin()` says "The rolled value applies again" (`src/lib/statCodeSurface.ts:216`). The code restores the next pin in rank, as the page says.
- StatCodeGuide is the moved-to stub ruled by Scripts Q55; nothing to change.
- The **Items** word in the Variable menu list dropped "what does the Variable menu hold?" out of that section's top 3; the section's keyword line gained "variable menu".
- Scope add from ticket 15 (spec session): removed "An entry with no name has no key." from Dictionaries › Entries. Ticket 15 names the bug.
- Edited sections leave their help vectors stale until the close rebuild (Q7).
