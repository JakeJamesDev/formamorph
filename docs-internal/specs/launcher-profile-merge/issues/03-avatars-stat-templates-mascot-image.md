# 03: Avatars, Stat Templates and Mascot Image

Status: done
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: three categories registered against an interface ticket 02 defines, with a writer for each.

## What to build

The merge also brings over Avatars, stat templates and the Mascot image.

- **Avatars** follow newer wins by library revision. Equal or missing stamps keep the folder's copy (Q12, Q2).
- **Stat templates and the Mascot image** have no stamps. They copy only what the folder lacks (Q9).
- Each category shows in the offer's summary and gets its own progress bar. Avatars are large, so the engine's smallest-first order places them after the small categories (Q14).

## Acceptance criteria

- [x] Engine tests: an Avatar follows newer wins and the tie rule. (`localCategories.test.ts` Avatars block: newer replaces and a repeat run ties; equal and missing stamps keep; creation-only stamp ties on repeat)
- [x] Engine tests: a stat template or Mascot image the folder already holds stays, and a missing one is copied. (`localCategories.test.ts`, with the bytes and type of a Mascot image checked after the copy)
- [x] The offer summary and the run list the three categories (DOM read on the dev-route). (`#dev?modal=profileMerge&tab=offer`: all three rows; `tab=run`: 7 bars, 0 buttons; jsdom test too)
- [x] A test fails when the fill-missing guard is removed. (hiding the folder's templates and images from the plan turns both tests red; dropping the editedAt fill and the legacy-id skip each turn one test red)
- [x] A changelog fragment covers the added categories, or the ticket 02 entry's group gets a new entry. (`docs-internal/changelog.d/launcher-profile-merge-03.md`)

Spec session rulings: Q27 skips the retired default Avatar id; Q28 copies every missing Mascot image id, orphans included.

## Landed

**Not verified**

- The real `session.fromPath` reader never ran in a packaged Windows build here. The reader's size and base64 paths run only against fake IndexedDB (`electron/profileMergeSource.test.mjs`); the Electron `executeJavaScript` hand-over of a large base64 string is by review only.
- A flat (pre-library) Avatar carries `addedAt`, which the reader does not send as a stamp. Such an Avatar copies when the folder lacks it and is otherwise kept.

**For you**

- On a Windows machine with Avatars, stat templates and Mascot images in AppData, start through the launcher, merge, and check that the Avatar library, the stat template list and the Mascot picture list show them.
- Check the offer rows in the dev route `#dev?modal=profileMerge&tab=offer`.
