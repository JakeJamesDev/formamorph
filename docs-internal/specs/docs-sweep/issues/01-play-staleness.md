# 01: Play Staleness

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: each claim is checked against source across the main menu, the Library board, GameViewer, saves and backup, and the Android build.

## What to build

Bring these pages in line with the app on `main`: [Home](../../../../docs/Home.md), [How-to-Play](../../../../docs/How-to-Play.md), [Starting-a-Game](../../../../docs/Starting-a-Game.md), [Library](../../../../docs/Library.md), [Saves-and-Backup](../../../../docs/Saves-and-Backup.md), [Install-on-Android](../../../../docs/Install-on-Android.md).

List each page's checkable claims: control and tab names, steps, limits, defaults, file formats, shortcuts, what a setting does. Check each one in source or in the dev-router preview. Fix what is wrong, remove what is gone, and add a short mention of shipped behavior that belongs on the page and is missing. Leave correct text as it is: ticket 02 owns the wording.

Spec: Implementation Decisions, "Truth source", "Staleness pass", "Headings and anchors".

## Acceptance criteria

- [x] Every control, tab and setting name on the pages matches its on-screen label (each label grepped in component source; source text, not CSS caps, per Q11)
- [x] Every default and limit the pages state matches the source (Autosaves Kept 1–20 in `autosave.ts`, 4 images, 1568 px, 15 turns, minSdk 24)
- [x] No page describes a removed feature (no GONE claims found)
- [x] Shipped behavior on each page's subject has at least a short mention (In Progress and 3.5.x changelog read against each page)
- [x] A renamed or removed heading updates every anchor table that names it; the docs tests are green (no heading changed; `src/lib/docs` + `codeGuideLinks` 345/345 green)
- [x] No code change beyond anchor tables; a page/code contradiction where the code looks wrong is named under Landed (docs-only diff)
- [x] Landed lists any missing page, stale ADR, or contradicting UI label found on the way

## Landed

**Not verified:** none. Claims were checked in source; no dev-router frames were taken.

**For you:**

- Code looks wrong (pages describe current behavior; nothing changed in code):
  - On a Mac, **Download** opens the `.dmg` in the browser, but the main-menu footer likely moves to a progress bar that never fills (`electron/updater.cjs` sends no progress on macOS; `useUpdateChecker.ts` still enters `downloading`). Not run on a Mac.
  - The update dialog's title reads **You're up to date** while a download runs or waits (`UpdateDialog.tsx`, only the `available` phase gets its own title).
  - A drag makes a Group named *New Group* with no unique-name check (`operations.ts` `createGroupFromItem`), while **Create New Group** requires a unique name. Its comment "No drag gesture makes one" is stale too.
- Contradicting sources: the README still links the github.io demo (main build, community off); Home now links formamorph.ai/play/ per the spec session's ruling.
- The changelog's Inventory entry says "Give lists people in the scene first"; the later Scene Presence entry and the code list only the scene. Both are unreleased, so the older lead may want a fold.
- Unconfirmed figure: "about 90 MB" on Install-on-Android comes only from a code comment in `UpdatePlugin.kt`; nothing measures the APK.
- Formamorph AI's allowance warnings in play have no mention on How-to-Play; they belong to Connect-Your-Own-AI (ticket 03).
- No missing page or stale ADR found.
