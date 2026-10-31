# 15: Tools and Test Bench Staleness

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: each claim is checked against source across World Tools and the Test Bench.

## What to build

Bring these pages in line with the app on `main`: [Tools](../../../../docs/Tools.md), [Test-Bench](../../../../docs/Test-Bench.md).

List each page's checkable claims: control and tab names, steps, limits, defaults, file formats, shortcuts, what a setting does. Check each one in source or in the dev-router preview. Fix what is wrong, remove what is gone, and add a short mention of shipped behavior that belongs on the page and is missing. Leave correct text as it is: ticket 16 owns the wording.

Spec: Implementation Decisions, "Truth source", "Staleness pass", "Headings and anchors".

## Acceptance criteria

- [x] Every control, tab and setting name on the pages matches its on-screen label: each label grepped in component source; "switch" for the mode Select fixed
- [x] Every default and limit the pages state matches the source: Tool call cap 4, 6 requests, 1 s script timeout, roll and recall limits, name rule checked in `src/lib/tools`
- [x] No page describes a removed feature: none found; the `tool_use` flag name was wrong, now `trained_for_tool_use`
- [x] Shipped behavior on each page's subject has at least a short mention: Recheck, Ollama capability, `items`, Templates, World Tool Try It, World Tool Edit/Delete, source repairs, Retry Check, Check Again, remembered seen state
- [x] A renamed or removed heading updates every anchor table that names it; the docs tests are green: no heading changed; prepare's test gate
- [x] No code change beyond anchor tables; a page/code contradiction where the code looks wrong is named under Landed: diff holds two docs pages and this ticket
- [x] Landed lists any missing page, stale ADR, or contradicting UI label found on the way

## Landed

**Not verified:** none.

**For you:**
- Unnamed dictionary entries: Tools.md and ScriptsGuide said "an entry with no name has no key", but code keys it under `""` (`src/lib/loreToggles.ts:20`, `src/lib/statCodeExecutor.ts:945`), so several unnamed entries collide. The spec session ruled the code looks wrong; the sentence is removed from Tools.md, and ScriptsGuide line 970 is routed to ticket 13.
- Test Bench Opening tab: the Testing as/at bar shows there (`benchTabs.ts` `usesLens: true`), but Opening ignores the **at** pick and uses its own **Starting Location** (`src/lib/testBench/opening.ts:201`). The page now says so; the visible-but-ignored **at** list may want a UI fix.
- No missing page or stale ADR found.
