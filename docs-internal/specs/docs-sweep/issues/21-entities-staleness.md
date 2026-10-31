# 21: Entities in Game Staleness

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: each claim is checked against source across the in-game Entities tab, scene presence and runtime entities.

## What to build

Bring this page in line with the app on `main`: [Entities](../../../../docs/Entities.md) ("Entities in Game").

The close review found this page in no page group, so it got neither pass (Q26).

List the page's checkable claims: control and tab names, steps, limits, defaults, file formats, shortcuts, what a setting does. Check each one in source or in the dev-router preview. Fix what is wrong, remove what is gone, and add a short mention of shipped behavior that belongs on the page and is missing. Leave correct text as it is: ticket 22 owns the wording.

The swept pages settled terms this page must follow: the `{{char}}` chip is **Entity Name** (Q25), and the Glossary rows for Presence, Movement, Known In, Relationship and Stranger Name name the entity fields. Link to the page that owns a feature rather than describe it again (Q14).

Spec: Implementation Decisions, "Truth source", "Staleness pass", "Headings and anchors".

## Acceptance criteria

- [x] Every control, tab and setting name on the page matches its on-screen label: checked in `GamePanels.tsx` (tabs, View on mobile only), `EntityListRow.tsx` (Remove tooltip, Following you), `ConfirmDialog.tsx` (Confirm), `EnterWorldWorkspace.tsx`/`EnterWorldFlow.tsx` (Remember Additions, Start Game / Continue to Avatar), `settingsCopy.ts`/`OutputSettingsSection.tsx` (Describe New Characters in the Advanced-only Characters section), `bubbleActions.ts` (Re-generate Narration). Step 1 said "On desktop" for the mobile-only View tab; fixed
- [x] Every default and limit the page states matches the source: Describe New Characters seeds from Character Diaries (`SettingsContext.tsx`); detection signals and the dialogue rule (`characterCandidates.ts` `qualifiesAsCharacter`), which has a third on-sight signal, self-introduction, now in the table; opening pool order and no-repeat draw (`openings.ts` `openingPool`, `drawUnseenOpening`; `GameViewer.tsx` page-one regenerate)
- [x] The page describes no removed feature: every section maps to live source above
- [x] Shipped behavior on the page's subject has at least a short mention: Look Around order, the Following you mark, strangers, and description Edit/Regenerate, each one sentence linking the owning page (Q14). "Editable: No" for story-invented entities corrected (`GameViewer.tsx` gives discovered entities `editing`)
- [x] A renamed or removed heading updates every anchor table that names it; the docs tests are green: no heading changed; `codeGuideLinks`, `src/lib/docs/*`, `ownerTermGuard` 372 passed
- [x] No code change beyond anchor tables; a page/code contradiction where the code looks wrong is named under Landed
- [x] Landed lists any missing page, stale ADR, or contradicting UI label found on the way

Copy sweep on Entities.md: 37 advisory notices after, none on an edited line (ticket 22's).

## Landed

**Not verified**: none.

**For you**:

- Contradicting UI label: the **Remove …?** dialog says "The story added this entity" (`GamePanels.tsx` `ConfirmDialog` description). It also shows for a Library Addition, which the player added. The page follows the code; the label looks wrong.
- Staleness miss, Play group (How-to-Play, Q24): the side-panel table said the Entities list "clears when you move". `computePresence` lists every entity at the new location; only the in-scene window resets for non-followers. Fixed to "When you move, only your followers stay in the scene."
- No missing page and no stale ADR found.
