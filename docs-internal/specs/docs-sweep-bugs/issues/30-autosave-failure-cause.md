# 30: Autosave Failure Says Why

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: one save path returns its cause to one message, under the Writing Guide.

## What to build

A failed autosave reads "Autosave failed — your manual saves still work." The cause goes only to the console, and the save call returns a plain `false`. Manual saves write to the same store, so with full storage the promise is likely false. Ruling Q25: the message drops that promise and carries the cause. Full storage says the storage is full and what the player can do. Any other failure shows a written line with the cause in **View Details**. The message still shows once until an autosave succeeds again.

Read how the app's other storage-full message works first, and reuse its check.

Spec: Q25. Evidence: the error audit after this spec's close.

## Acceptance criteria

- [x] A test with a quota error on an autosave fails today (the old sentence), then passes with the storage-full message (`says the storage is full on a quota error`; it ran red before the `putSaveRecord` commit fix)
- [x] A test with another error shows a written line and the cause in View Details (`shows a written line with the cause in View Details`)
- [x] No autosave failure message claims that manual saves still work (test: `never claims that manual saves still work`)
- [x] The message shows once across repeated failures and shows again after a success then a new failure (test)
- [x] A manual save's failure message is unchanged (test: `keeps its own message`)
- [x] The new copy follows the Writing Guide; the copy sweep ran on it (`npm run copy:sweep`: 2 files, 0 notices)
- [x] A changelog fragment under Minor / Fixed / 👤 (`docs-internal/changelog.d/docs-sweep-bugs-30.md`)

## Landed

**Not verified**

- No mutation run of the once-only guard. The re-arm case is covered by one test.

**For you**

- Fill a browser's storage, then play one turn with Autosave on. Read the toast: "Formamorph cannot autosave the game. The storage is full. Delete saves you no longer need to free space."
- The storage-full toast stays open until closed (`autoClose: false`), like the world-save storage-full toast. The spec does not rule on it. Say if it should close on its own.
- The cause fix: `putSaveRecord` in `src/components/modals/dbUtils.ts` resolved at the put request, not at commit. A full disk reported success, so the quota message could never show. It now waits for the commit, which also makes a manual save fail visibly on a full disk.
