# 07: Editor Core Staleness

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: each claim is checked against source across the World Editor shell and the location, entity, opening and media managers.

## What to build

Bring these pages in line with the app on `main`: [WorldEditor](../../../../docs/WorldEditor.md), [World-Editor-Overview](../../../../docs/World-Editor-Overview.md), [World-Editor-Locations](../../../../docs/World-Editor-Locations.md), [World-Editor-Entities](../../../../docs/World-Editor-Entities.md), [World-Editor-Openings](../../../../docs/World-Editor-Openings.md), [World-Editor-Media](../../../../docs/World-Editor-Media.md).

List each page's checkable claims: control and tab names, steps, limits, defaults, file formats, shortcuts, what a setting does. Check each one in source or in the dev-router preview. Fix what is wrong, remove what is gone, and add a short mention of shipped behavior that belongs on the page and is missing. Leave correct text as it is: ticket 08 owns the wording.

Spec: Implementation Decisions, "Truth source", "Staleness pass", "Headings and anchors".

## Acceptance criteria

- [x] Every control, tab and setting name on the pages matches its on-screen label: about 580 claims checked in source (tab files, label strings, tooltips); every mismatch fixed
- [x] Every default and limit the pages state matches the source: budgets (`mediaParents.ts`), weight box rounding, Nearby Through Connections default, Optimize choices
- [x] No page describes a removed feature: none found; the false claims (search on every tab, Replace which image? on entities, the narrator-only full text) are rewritten to the code
- [x] Shipped behavior on each page's subject has at least a short mention: Scripts/Tools tabs, Slots, Persona Items, Items tabs, Known Here, Relationships, full-screen canvas tools, World Media, Optimize choices
- [x] A renamed or removed heading updates every anchor table that names it; the docs tests are green: no heading changed; docs tests 365/365 green
- [x] No code change beyond anchor tables; a page/code contradiction where the code looks wrong is named under Landed: docs only
- [x] Landed lists any missing page, stale ADR, or contradicting UI label found on the way

## Landed

`npm run copy:sweep` on the six pages: 186 notices before, 186 after, same categories. The wording is ticket 08's.

**Not verified:**

- Media, "Each change is one undo step" in the image panel: rule edits and the Map Background gallery write as ordinary edits, not labeled Steps. Not run in the app.
- Overview, a linked image works offline "after you've seen it once": not traced in source. Left as written.
- Openings, "The AI copies the style and length of page one": model behavior, not checkable in source.

**For you:**

- Code looks wrong (pages describe the code; nothing changed in code):
  - **Search World** skips the Items, Scripts, Tools and Media tabs (`worldSearch.ts` collects no item, script or tool text). WorldEditor now says so.
  - **Optimize Images** scans and re-encodes Map Background images, but `applyDownscaled` in `WorldEditor.tsx` copies back only the thumbnail from the overview, so the map results are dropped. The page lists only what gets applied.
  - Entity card import drops the **Self** mark on openings (`cardOpening` in `entityFile.ts`), so Self openings come back as Others. No test covers it. The Openings page says only that openings and weights travel, which holds.
  - In Simple mode, the Media tab offers **Upload Avatar…**, but the entity **Avatar** dropdown is Advanced only. Media now says so.
  - The **Custom Persona** entity's Others openings never draw, but its Others/Self switch still shows.
- `src/lib/docs/surfaceMap.ts` maps `imageReplace` (**Replace which image?**) to World-Editor-Entities, but every entity, location and map gallery is unlimited, so only a one-image field such as an item's image opens it. Items (ticket 09) may want the mention.
- A hidden `#load-world` file input in `WorldEditor.tsx` has nothing that opens it.
- No missing page or stale ADR found.
