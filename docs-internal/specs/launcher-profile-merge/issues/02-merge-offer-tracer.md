# 02: Merge Offer Tracer

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: it sets the merge engine's category interface that tickets 03–05 build on. It also opens a second profile through `session.fromPath`, which this codebase has never used.

## What to build

The first complete merge path for worlds, saves, entities (Personas included) and dictionaries.

- **Offer detection (Q1, Q3, Q8).** On a Windows launcher start, the main process reports unmerged data when the AppData profile exists, is not the folder's own profile, holds any of these stores, and has no done or declined marker. The markers live in the AppData profile directory.
- **Reading the AppData profile.** A hidden window on a session opened with `session.fromPath` reads the AppData copies on the same app origin. The AppData instance never runs.
- **The merge engine.** A pure module takes two snapshots (id, stamp and size per item, per category) and returns a plan: new, replace and keep per category, smallest first. A second step applies the plan through injected storage, writes each item before it reads the next, and reports progress per category. Newer wins by library revision, and saves use their saved timestamp (Q12). Equal or missing stamps keep the folder's copy (Q2). Imported saves append to the save order (Q16). This ticket owns the category interface that later tickets register against. Reuse the Backup & Restore conflict split and writers where they fit.
- **The dialog (Q7, Q11, Q14).** A modal over the main menu with three states. The offer shows the summary per category and **Merge**, **Not Now** and **Don't Merge**. The run is locked and shows a progress bar per category. The result shows counts, skipped items with reasons, and **Done**. The menu reloads its lists afterward. Each state gets a dev-route entry. Use the Design System and the Writing Guide.
- **Markers.** **Don't Merge** writes the declined marker. A full finish writes the done marker. **Not Now** writes nothing.

## Acceptance criteria

- [x] Engine tests: newer wins in each of the four categories; an equal and a missing stamp keep the folder's copy; new items are added; the order is smallest first. (`engine.test.ts` planMerge block; the tie guard goes red when `>` becomes `>=`)
- [x] Engine test: a run stopped after N writes and run again writes only the rest, and the plan then shows nothing to replace. (`resumes a stopped run with only the rest, and nothing then replaces`)
- [x] Engine test: imported saves land after the folder's existing saves in the save order. (`appendedSaveOrders` block; red when the append order flips)
- [x] The offer is not reported when a marker exists, when the AppData profile is missing or empty, or on a non-launcher start. (`electron/profileMerge.test.mjs`. Per Q22 a done marker now lists merged categories and re-offers only categories it lacks; the hook tests cover that)
- [x] The locked run state has no close control and ignores Escape and an outside click (DOM read on the dev-route). (Playwright on `#dev?modal=profileMerge&tab=run`, both themes: 0 buttons, still open after Escape and an outside click; jsdom test too)
- [x] Frames `.scratch/frames/merge-offer.png`, `.scratch/frames/merge-run.png` and `.scratch/frames/merge-result.png` show the three states at 1280×800 in light and dark. (light left, dark right)
- [x] The done marker is written only after the last category finishes. **Don't Merge** writes the declined marker. (`useProfileMerge` tests)
- [x] The world and save `.json` shapes do not change. (no export code touched; the merge copies stored records. Imported saves drop the device-local `isAutosave` per Q23, which the export already strips)
- [x] A changelog fragment covers the merge. (`docs-internal/changelog.d/launcher-profile-merge-02.md`)

For you: on a Windows machine with data in both profiles, start through the launcher, merge, and check the main menu lists.

## Landed

**Not verified**

- The real `session.fromPath` reader never ran in a packaged Windows build here. No machine run read a real AppData profile; the reader is covered only by review.

**For you**

- For you: on a Windows machine with data in both profiles, start through the launcher, merge, and check the main menu lists.
- Check the dialog copy and layout: `.scratch/launcher-profile-merge-02/frames/merge-offer.png`, `merge-run.png`, `merge-result.png` (light left, dark right).
- Check the new docs section **The Merge Your Other Data Dialog** in [Saves-and-Backup.md](../../../../docs/Saves-and-Backup.md).
- Close the window while the offer shows, and confirm the process exits (the hidden reader window closes with the main window).
