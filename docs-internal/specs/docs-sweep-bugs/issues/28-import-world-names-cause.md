# 28: World Import Names the File and the Cause

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: sets the shared report and the copy that ticket 29 reuses.

## What to build

A failed world import reads "Imported 0 worlds (1 skipped)." The file name and the cause go only to the console, even when storage is full. Ruling Q23: one skipped file shows its name and the cause. Several skipped files keep the count, and **View Details** lists each file with its cause. Text the app wrote for the player shows on the line. A raw parser or storage message stays in **View Details**, behind a written line.

This ticket owns the shared import report. Ticket 29 moves the other kinds onto it.

Spec: Q23. Evidence: the error audit after this spec's close.

## Acceptance criteria

- [x] A test that imports one bad world file fails today (only the count), then passes with the file name and the cause: `names a lone malformed file and its cause`, red before the build, and a real worker read in the preview
- [x] Several skipped files show the count, and View Details lists each file and cause (test): `keeps the count for several skipped files`, and the Error Details text in the preview
- [x] A storage failure on one world names the file, and its raw message is only in View Details (test): `names the file when storage is full`; a real `DOMException` thrown from `storeWorld` in the preview; reinstating the raw line turned three tests red
- [x] A clean import of several files keeps today's summary, and a lone success still shows no toast (test): `keeps the summary for a clean batch`, `shows no toast for a lone success`
- [x] The new copy follows the Writing Guide; the copy sweep ran on it: 0 notices on `importFiles.ts` and the fragment, plus a hand read
- [x] A changelog fragment under Minor / Fixed / 👤: `docs-internal/changelog.d/docs-sweep-bugs-28.md`

## Landed

**Not verified**

- A real full disk. The quota failure was a real `DOMException` thrown from `storeWorld` in the preview, not IndexedDB running out of space.

**For you**

- Read the toast when importing a bad `.json` from **Import World**: `.scratch/docs-sweep-bugs-28/frames/world-import-toasts.jpg`.
- A world import where nothing was imported now raises a red error toast. A partial import stays a yellow warning. Say if you want both yellow.
- A long file name breaks mid-word inside the toast (same frame). Say if you want it shortened instead.
