# Spec: Launcher Profile Merge

Status: ready-for-agent
Spec session: launcher-profile-merge — spec

## Problem Statement

A Windows player reported that **Update & Restart** failed with *Not a launcher build (FORMAMORPH_ROOT unset)*.

- The Windows build is a Go launcher at the install root and the Electron app in its `app` folder. The launcher sets the root and starts the app. The app keeps its data and local models beside the root.
- A taskbar pin of the running window, or a shortcut made inside `app`, starts the inner exe directly. That start has no root. Its data falls back to the default Chromium profile in AppData, and the update cannot be applied.
- Commit `051b3307f` hands every direct start to the launcher and points new taskbar pins at it. Two gaps remain:
  - **The player is never told.** The window closes and opens again, and the player keeps using the old pin.
  - **The AppData data is stranded.** The existing one-time copy runs only when the folder's profile is empty. A player who used both starts sees only the folder's data. Their worlds, saves, entities, Avatars, settings and local models in AppData disappear from view.

## Solution

- **A notice on every direct start.** Before any window opens, a Windows message box says to start Formamorph from the main `Formamorph.exe` and names its full path. It has **OK** and **Show in Folder**. After the box closes, the app restarts through the launcher.
- **A merge offer in the launcher start.** When the AppData profile holds data that was never merged, a dialog opens over the main menu. It lists, per category, what is new, what replaces the folder's copy, and what is kept. The buttons are **Merge**, **Not Now** and **Don't Merge**.
- **Newer wins.** For an item both sides hold, the copy with the newer stamp stays. On equal or missing stamps, the folder's copy stays. Data with no stamps copies only what the folder lacks.
- **A locked, ordered merge with progress.** The dialog shows progress and cannot be closed while the merge runs. The smallest items go first and local models go last. An error or a force quit then loses the least.
- **Safe to repeat.** The merge is marked done only when it finishes. An interrupted merge is offered again on the next start, and items already copied now tie and stay. The AppData profile is never deleted.

## Rulings

- **Q1 Trigger:** offer the merge on each launcher start while the AppData profile holds unmerged data. A finished merge or **Don't Merge** ends the offer for good.
- **Q2 Ties:** equal or missing stamps keep the folder's copy.
- **Q3 Leftover:** a finished merge leaves the AppData profile in place. Only a marker stops the offer.
- **Q4 Notice:** a native message box before any window, on every direct start. It names the exact exe path and has **OK** and **Show in Folder**. Then the app restarts through the launcher.
- **Q5 Settings:** settings and sign-in copy only the keys the folder lacks.
- **Q6 Local models:** AppData local models move into the folder's models directory. A file the folder already has stays, and the AppData file is left alone.
- **Q7 Prompt:** a per-category summary (new / replaces yours / kept) with **Merge**, **Not Now** and **Don't Merge**. **Not Now** asks again on the next start.
- **Q8 Interrupt:** the done marker is written only on a full finish. The next start offers the merge again.
- **Q9 Unstamped stores:** stat templates, the Mascot image and the model-folder choice copy only what the folder lacks.
- **Q10 Caches:** the community catalog, thumbnails, remote images, supporter content and memory embeddings stay behind.
- **Q11 Placement:** the offer and the progress dialog open over the main menu as soon as the launcher start loads. The menu reloads its lists when the merge finishes.
- **Q12 Newer wins:** library items compare by their library revision (last edit, else download, else creation). Saves compare by their saved timestamp.
- **Q13 Scope:** worlds, saves, entities (Personas included), dictionaries, Avatars, settings, sign-in, stat templates, the Mascot image, the model-folder choice and local models.
- **Q14 Progress:** each category shows a progress bar. The dialog blocks closing while the merge runs. The order runs smallest to largest, with local models last.
- **Q15 Seams:** one merge engine, the launcher handoff module, and the model move module (see Testing Decisions).
- **Q16 Save order:** imported saves go to the end of the folder's save order. (Stated in the grill summary; the user moved to the spec without objection.)

## User Stories

1. As a Windows player who starts Formamorph from a taskbar pin, I want to be told which exe to use, so that I can fix my pin.
2. As a Windows player, I want the notice to show the full path of the main exe, so that I can find it without searching.
3. As a Windows player, I want a **Show in Folder** button on the notice, so that I can pin the right exe at once.
4. As a Windows player who ignores the notice, I want the app to open anyway after I close it, so that I can still play.
5. As a Windows player who starts the right exe, I want no notice, so that a correct start stays quiet.
6. As a player with data in two places, I want Formamorph to offer to bring it together, so that I do not lose my worlds and saves.
7. As a player, I want to see what the merge will do before it starts, so that I can decide with the facts.
8. As a player, I want counts of new, replacing and kept items per category, so that I know how much changes.
9. As a player, I want the newer copy of a world, save, entity, dictionary or Avatar to win, so that my latest work survives.
10. As a player, I want my folder's copy to stay when the age is unknown, so that an old copy never replaces my main install.
11. As a player, I want settings I already have to stay as they are, so that the merge does not undo my setup.
12. As a player, I want endpoints and settings that only the other copy has to come over, so that I do not set them up twice.
13. As a player signed in only in the other copy, I want that sign-in to come over, so that I stay signed in.
14. As a player, I want my Personas to come over with my entities, so that my player characters are not lost.
15. As a player, I want my Avatars to come over, so that my characters keep their 3D models.
16. As a player, I want my stat templates and Mascot image to come over when I lack them, so that small customizations survive.
17. As a player with downloaded local models in AppData, I want them moved beside the main exe, so that the model list shows them again.
18. As a player, I want a model I already have in the folder to stay, so that a large file is never overwritten.
19. As a player, I want a progress bar for each category, so that I know the merge is working.
20. As a player, I want the dialog to stay open while the merge runs, so that I cannot change data halfway.
21. As a player, I want small items to go first, so that an early stop still brings over most of my things.
22. As a player whose merge stopped partway, I want it offered again on the next start, so that I can finish it.
23. As a player, I want a repeated merge to skip what already came over, so that a retry is fast and safe.
24. As a player, I want **Not Now** to ask again on my next start, so that I can merge later.
25. As a player, I want **Don't Merge** to stop the offer for good, so that I am not asked again.
26. As a player, I want the AppData copy left in place after the merge, so that I can recover something if I need to.
27. As a player, I want imported saves to appear in my save list without reordering my existing saves, so that my list stays familiar.
28. As a player, I want the main menu to show the merged data at once, so that I need no restart.
29. As a player, I want the merge to say which items it could not bring over and why, so that I know what to check.
30. As a player who never used AppData, I want no offer, so that a clean install stays quiet.

## Implementation Decisions

- **Notice in the launcher handoff module.** The handoff module gains the notice step. The direct-start path shows a synchronous native message box before the app is ready, then spawns the launcher and exits. The dialog and spawn are injected so tests run without Electron. **Show in Folder** reveals the launcher in Explorer, then the handoff continues.
- **Source profile access.** The launcher start reads the AppData profile through a session opened on that directory (`session.fromPath`, available in the pinned Electron 42.5.0). A hidden window on that session runs on the same app origin, so its IndexedDB and localStorage are the AppData copies. The AppData instance never runs.
- **Unmerged-data detection.** The main process decides whether to offer: the AppData profile exists, holds any merged store, is not the folder's own profile, and carries no done or declined marker. The marker lives in the AppData profile directory, so it travels with the data it describes.
- **One merge engine.** A pure module takes two snapshots and returns a plan. Each snapshot lists, per category, the items with their id, stamp and size. The plan holds new, replace and keep lists per category, ordered smallest first. A second step applies the plan through an injected storage interface and reports progress per category. It writes each item before it reads the next.
  - Stamped categories (worlds, saves, entities, dictionaries, Avatars) follow Q12 and Q2.
  - Unstamped categories (settings keys, stat templates, the Mascot image, the model-folder choice) follow Q5 and Q9: fill missing only.
  - The existing Backup & Restore conflict split and record writers are reused where they fit. Avatars and stat templates get writers alongside them.
- **Category order.** Settings and sign-in, the model-folder choice, stat templates, dictionaries, entities, the Mascot image, Avatars, worlds, saves, then local models. Within a category, the smallest items go first. The engine computes the order from sizes; this list is the expected result for typical data, not a hard-coded sequence.
- **Local models.** The existing model move module moves them and already never overwrites. It gains a smallest-first order. Its skip reasons feed the merge result.
- **Save order.** Imported saves append to the folder's save order.
- **Dialog.** A new modal over the main menu, opened on the launcher start when the main process reports unmerged data. It has three states: the offer (summary and three buttons), the run (locked, progress per category), and the result (counts, skipped items with reasons, **Done**). It follows the Design System and gets a dev-route entry for each state.
- **Markers.** **Don't Merge** writes the declined marker at once. A full finish writes the done marker. **Not Now** writes nothing.
- **Export shape.** The world and save `.json` shapes do not change.

## Testing Decisions

- Tests check behavior at the seam, never internals. A test feeds snapshots in and reads the plan or the storage writes out.
- **Merge engine (main seam).** Cases: newer wins on each stamped category; an equal stamp and a missing stamp keep the folder's copy; fill-missing for each unstamped category; smallest-first order inside a category and across categories; a run interrupted after N writes and resumed writes only what is left; save order appends; progress reports reach 100% per category. Prior art: the Backup & Restore conflict split and apply tests.
- **Launcher handoff.** A fake dialog and spawn prove the notice shows on a direct start, names the launcher path, and still hands off after either button. No notice shows on a launcher start. Prior art: the existing handoff tests and the leave-prompt test with an injected dialog.
- **Model move.** Temp folders prove smallest-first order and that an existing file stays on both sides. Prior art: the existing model move tests.
- **Dialog.** The dev-route renders each state. DOM reads confirm the locked run state has no close control and does not close on Escape.
- Each guard is proven by putting its bug back and watching its test fail.

## Out of Scope

- A merge between two launcher installs, or from a portable or AppImage copy.
- Two-way sync. Data moves only from AppData into the folder.
- Deleting or cleaning up the AppData profile.
- Caches (Q10).
- macOS and Linux. Their builds have no inner exe to start by mistake.
- Code signing and SmartScreen.

## Further Notes

- Commit `051b3307f` already has the handoff and the taskbar relaunch details. This effort builds on it.
- The first-start copy in the profile setup still runs when the folder's profile is empty. It copies whole stores and does not merge. With this merge in place, the planner decides whether that copy stays or is replaced by a first merge.
