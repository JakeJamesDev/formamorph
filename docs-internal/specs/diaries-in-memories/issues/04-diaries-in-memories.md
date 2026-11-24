# 04: Diaries in Memories

Status: ready-for-human
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The player can read every character's diary in the Memories window (spec Q3, Q4, Q5, Q11, Q12). Editing comes in ticket 05; this ticket is the view.

- **Navigation.** A vertical Tabs root drives the selection: the shared Nav Rail on desktop, the Sections bar on mobile, with the same groups. Group one is **Story**; group two is one **"<Name>'s Diary"** per diary name, in order of first appearance, entity or not. The prototype's C4 shows it (`prototype/diary-view`).
- **Diary view.** Entries oldest first. Each shows its turn and the turn's memory above it. Script lines show read-only with a Script badge. "Nothing notable" entries hide behind a **Show Hidden Entries** toggle, which takes the filter row's place on a diary. Search looks only in the open diary. Add Memory stays on Story. The header count names the open view.
- **Character Diaries off.** The diary group shows when the save has entries, with a note that new entries are off. A fresh game shows no diary group.
- **Reading.** Entries read through the layer, so the view already honors the diary changes ticket 05 writes.
- **Dev router.** `memoryManager` takes a diary target, and a `diaries` boot fixture seeds digests, diaries and a script diary line. Lift the prototype's canned turns.
- **Shape.** This ticket owns the diary list reader the view and ticket 05 share, and the route that opens Memories on a diary, which ticket 06 uses.
- Update the Memories help topic and the Memory wiki page with the diary view.

## Acceptance criteria

- [x] Memories lists Story, then one diary per character with entries, in first-appearance order; a new character's row appears without moving the others. (`diaryView.test.ts` "keeps every row in place when a new name appears"; `MemoryManagerModal.diaries.test.tsx` "lists Story, then one diary…")
- [x] On mobile the same list is the Sections bar, and it scrolls when long. (jsdom "on mobile, lists the same sections…"; Playwright DOM read with 23 rows: Sections list 1141 px in 364 px, scrolls to the last row; desktop rail 893 px in 572 px)
- [x] A diary lists its entries with turn and memory context; script lines show read-only and marked. (jsdom "lists a diary's entries oldest first…", "shows script lines with a Script badge and no controls")
- [x] Show Hidden Entries shows quiet entries, dimmed; off, they're hidden. (jsdom "hides quiet entries until Show Hidden Entries is on…"; mutation-tested)
- [x] Search on a diary matches only that diary's entries. (jsdom "searches only the open diary's entries"; mutation-tested)
- [x] With Character Diaries off, a save with entries shows its diaries and the note; a save without shows Story alone. (jsdom "with Character Diaries off…", "shows Story alone…")
- [x] `#dev?view=gameViewer&fixture=diaries&modal=memoryManager` reaches a diary through the route's diary target. (`&diary=Bram` opens Bram's Diary through `openMemories`; DOM read: one dialog, Bram's Diary selected, 5 entries; jsdom "opens from a Memories request on its diary, once per request")
- [x] Frames `.scratch/frames/diaries-desktop.png` (1440×900) and `.scratch/frames/diaries-mobile.png` (375×812, Sections bar open), both themes. (Playwright; light frames carry `-light`)
- [x] The help topic and the wiki page describe diaries in Memories. (`game.memoryManager` topic; `docs/Memory.md` "Character Diaries in Memories")
- [x] A changelog fragment under Added: read characters' diaries in Memories. (`docs-internal/changelog.d/diaries-in-memories-04.md`, Topic Character Diaries)

## Landed

**Not verified**

- Nothing left unticked. The route's tab switch in `LeftPanel` and `GameViewer.openMemories` (drawer and mobile panel) has no jsdom test; it was checked live through the dev route on desktop only.

**For you**

- For you: whether first-appearance order and the turn-memory context line read well with a real cast (`fixture=diaries`, then a long save of your own).
- The rail shows only when the save has a diary; without one, Memories looks as before. Check that it reads right when the first diary appears. Frames: `.scratch/diaries-in-memories-04/frames/diaries-desktop.png`, `diaries-desktop-light.png`, `diaries-mobile.png`, `diaries-mobile-light.png`, `diaries-desktop-longcast.png`, `diaries-mobile-longcast.png`.
- The diary rows use the `NotebookPen` icon, because `BookOpen` is the dictionary's element icon.
