# 05: Personas and Community Staleness

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: each claim is checked against source across personas and the community browser, listings and the account site.

## What to build

Bring these pages in line with the app on `main`: [Personas](../../../../docs/Personas.md), [Persona-Authoring](../../../../docs/Persona-Authoring.md), [Community-Creations](../../../../docs/Community-Creations.md).

List each page's checkable claims: control and tab names, steps, limits, defaults, file formats, shortcuts, what a setting does. Check each one in source or in the dev-router preview. Fix what is wrong, remove what is gone, and add a short mention of shipped behavior that belongs on the page and is missing. Leave correct text as it is: ticket 06 owns the wording.

Spec: Implementation Decisions, "Truth source", "Staleness pass", "Headings and anchors".

## Acceptance criteria

- [x] Every control, tab and setting name on the pages matches its on-screen label: each claim grepped to its literal in `src/` (about 320 claims over the three pages)
- [x] Every default and limit the pages state matches the source: client and FormamorphServer limits read (publish sizes, comment 4000, changelog 100, mentions, username rule, 7-day deletion)
- [x] No page describes a removed feature: none found; the false website-download sentence is removed (ruling B)
- [x] Shipped behavior on each page's subject has at least a short mention: Review and Quarantine, Re-download World, download Retry, feedback sorts and default filters, Similar Questions, thread locks, Mascot publish, Starts at, World Only hiding None
- [x] A renamed or removed heading updates every anchor table that names it; the docs tests are green: no heading renamed, one added; docs tests 193/193 green
- [x] No code change beyond anchor tables; a page/code contradiction where the code looks wrong is named under Landed: `git diff --stat` holds only the three pages and this ticket
- [x] Landed lists any missing page, stale ADR, or contradicting UI label found on the way: see below

## Landed

Copy sweep: 145 notices before, 144 after. Wording is ticket 06's.

**Not verified**

- SillyTavern's own labels (**Persona Management**, **Backup**, `personas_<date>.json`, `User Avatars`) are external to this repo; left as written.
- "A world entity you stop playing comes back to the cast on the next turn": the cast filter is confirmed, the turn timing is not traced.

**For you**

- Code bug (ruling B): on formamorph.ai, prompt preset and Mascot listings get a device-download button that saves a dictionary-shaped `.json` (`src/lib/useDeviceDownload.ts:51-67`, `RemoteWorldCard.tsx:229`, `RemoteWorldDetailsModal.tsx:556`). The page no longer claims either way.
- Server setting: the rename gate in **Choose a New Username** is written in its on state; `username_rename_gate` ships off (`FormamorphServer/src/config/settings.js:48`), and when on it blocks every write, not only the four the page names.
- Server setting: **Review and Quarantine** is written in its on state; `listing_review` ships off.
- Possible code bug: a world whose only persona is a Custom Persona, with no traits, one starting location and no library additions, may skip Enter World and never offer the **Name** field (`src/lib/enterFlow.ts:70-75`, `src/lib/customPersona.ts:13`). Not run.
- Contradicting UI label: the empty **Personas** library filter says "select the Persona checkbox on its Profile tab" (`src/views/MainMenu.tsx:2153`). The control is a **Cast** | **Playable** toggle, and Profile is a sub-tab of **Entity**.
- Missing mention for a later ticket: Formaquestion Settings is reached from the Formaquestion window; Community-Creations names it in two tables without the path.
