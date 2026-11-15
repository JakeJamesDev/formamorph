# 04: Client: Supporter Copy rule on worlds

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Model rationale: one pure rule threaded through many surfaces (Main Menu, World Editor, Media tab, backup, crash export); a missed one is a leak.

## Parent

[spec.md](../spec.md) — Timed Supporter Content and Supporter Worlds.

## What to build

A world record can carry a local-only Supporter Copy marker (listing id, account id, revision), kept like `sourceId` and never part of world data. One pure function answers whether an action is allowed on a world: world export, entity card export, dictionary export, Duplicate, Publish, media Download, backup, crash-recovery export, Save to Library (R7). This ticket owns the marker type and the function; tickets 05 and 06 import them. Every world surface reads the function: blocked buttons show disabled with a tooltip, and the world card shows a Supporter badge (R14). The backup bundle and the crash-recovery export leave Supporter Copies out (R15). Check whether a save export carries world media; if it does, message the spec session.

## Acceptance criteria

- [x] The rule function is tested for every action on a Supporter Copy and on a plain world. `supporterCopy.test.ts`, world and library-entry targets, 30 cases.
- [x] On a fixture Supporter Copy, world export, entity card export, dictionary export, Duplicate, Publish and Media tab Download are disabled with a tooltip in the Main Menu and the World Editor. `MainMenu.supporterCopy.test.tsx` (hover reads each tooltip) and `WorldEditor.supporterCopy.test.tsx` (Save menu, Export Entity…, Export Dictionary…, Media Download); plain-world controls stay enabled. The editor also blocks with "Checking this world" until the marker read answers. The in-game AI Context Export is blocked too (R23): `GameViewer.supporterCopy.test.tsx`.
- [x] The world card shows the Supporter badge only on a Supporter Copy. `MainMenu.supporterCopy.test.tsx`; the badge is the shared Patreon Mark (R21, R22), in the Design System doc and the `patreon-mark` showcase tab.
- [x] The backup bundle and the crash-recovery export omit a Supporter Copy and keep plain worlds. `backup.test.ts`, `BackupRestoreDialog.supporterCopy.test.tsx` (listed disabled, never selected), `RootCrashScreen.test.tsx` and `WorldEditor.supporterCopy.test.tsx` (Export World disabled with the reason as text, R19).
- [x] The marker survives a World Editor save and never appears in an exported world. `WorldStorageService.test.ts` ("keeps the Supporter Copy marker across an editor save").
- [x] Save export is checked for world media, and the finding is stated in the landing. A save holds the world's books in full, base64 thumbnails included. Per R17, saves of a Supporter Copy are stamped and can't be exported or backed up: `GameplayContext.supporterCopy.test.tsx`, `LoadGameDialog.test.tsx`, `SaveList.test.tsx`, `backup.test.ts`.
- [x] Each guard is shown to bite by reinstating the bug. 39 mutations, each failing its own test; the one that stayed green (the save row's own click guard) got a direct test.
- [x] Frames `.scratch/frames/supporter-copy-menu.png` and `.scratch/frames/supporter-copy-editor.png`, light and dark, at a desktop width. Plus `-dark` variants, `supporter-copy-card(-dark).png` and `patreon-mark-reference.png`, at 1440×900.

For you: read the tooltip and badge copy in the Main Menu.

## Landed

**Not verified**

- Publish World's disabled state in a live preview: it shows only when signed in, so the frames lack it. The Main Menu test covers it.
- Formaquestion's own AI Context Export is not guarded. When it reads the open world, its trace holds excerpts of that world. R23 named the game view's export only.

**For you**

- For you: read the tooltip and badge copy in the Main Menu. [supporter-copy-menu.png](../../../../.scratch/supporter-worlds-04/frames/supporter-copy-menu.png), [supporter-copy-card.png](../../../../.scratch/supporter-worlds-04/frames/supporter-copy-card.png).
- The disabled Duplicate World and Export World buttons read dim but close to enabled in dark mode, the existing disabled style: [supporter-copy-menu-dark.png](../../../../.scratch/supporter-worlds-04/frames/supporter-copy-menu-dark.png).
- The Patreon Mark at both sizes and on a card: `#dev?modal=designSystem&tab=patreon-mark`, [patreon-mark-reference.png](../../../../.scratch/supporter-worlds-04/frames/patreon-mark-reference.png).
- The storage-full toast and the crash screen state "You can't export a Supporter world" in place of Export World.
