# 04: Settings, Sign-In and Model-Folder Choice

Status: done
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: fill-missing rules across localStorage and one main-process file, registered against ticket 02's interface.

## What to build

The merge also brings over settings, sign-in and the model-folder choice. All three copy only what the folder lacks (Q5, Q9).

- **Settings and sign-in** are localStorage keys. A key the folder already has stays. A key only AppData has is copied, sign-in included. Caches and device-local UI state follow Q10 and stay behind.
- **The model-folder choice** lives in a main-process file in the profile. Each field the folder lacks takes the AppData value. Ticket 05 reads the result to find where models go.
- Settings and sign-in run first in the merge, as the smallest category (Q14).

## Acceptance criteria

- [x] Engine tests: a folder key stays, a missing key is copied, and a signed-in AppData copy signs in a signed-out folder. (`settings.test.ts` settings block; goes red when the folder snapshot is emptied)
- [x] Tests: a folder model-folder choice stays, and a missing one takes the AppData value. (`profileMergeModelFolder.test.mjs`; red when the keep-the-folder line is removed)
- [x] Settings applied by the merge take effect without a restart, or the result screen asks for one. (Q26: result screen shows **Restart** when a settings key was copied; `ProfileMergeDialog.test.tsx`)
- [x] A test fails when the fill-missing guard is removed. (both guards put back and watched fail; settings run first, `merge order` test)
- [x] A changelog fragment covers settings and sign-in. (`docs-internal/changelog.d/launcher-profile-merge-04.md`)

## Landed

**Not verified**

- The real `session.fromPath` read of localStorage and `app.relaunch()` never ran in a packaged Windows build. No machine run exercised either; they are covered by review only.
- A copied bundled-Avatar "seeded" flag could stop a re-seed if the folder's Avatar store lacks the record. Q24 copies seen flags, so I left it.

**For you**

- On a Windows machine with settings only in AppData, start through the launcher, merge, and check the **Restart** button on the result screen: after it, the endpoint and sign-in match the AppData copy.
- Check the model-folder choice carried over: open the local model screen and read the download folder.
- Check the new result row and **Restart** copy at `#dev?modal=profileMerge&tab=result`.
