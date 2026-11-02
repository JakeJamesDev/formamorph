# 04: Licenses Tab

Status: done
Blocked by: 01, 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

A pure parser and a list, with one cross-platform fetch to prove.

## What to build

The Credits dialog gains a **Licenses** tab. It reads the shipped notices file when the tab first opens, relative to the build's base path, so it works offline on web, desktop and the APK. Entries show as collapsed rows, with Bundled assets first, then software, and a filter by name. Only an expanded row mounts its text.

Import the pure notices parser that ticket 03 owns (ruling T03-5), and build no second parser. The Vite plugin also serves the file in dev, so the dev route and preview work.

Rulings: Q8, Q15.

## Acceptance criteria

- [x] A test runs the imported parser on the real file: sections in order, every entry named and non-empty, Game Icons and eSpeak NG present. (`LicensesPanel.test.tsx`: section order test and the every-entry test)
- [x] The file loads only when the tab first opens, tested by counting fetches. (0 reads before opening, 1 after two opens; removing the `wanted` guard turns it red)
- [x] Filtering by a package name finds it, and a name with no match shows an empty message. (filter test)
- [x] A row expands to its full license text, and collapsed rows mount no text. Measured by a DOM read on the real file. (0 `pre` closed, 1 open equal to the entry text; 373 rows and 0 `pre` on the dev route)
- [x] A failed read shows a message and a way to try again. (404 then Try Again test)
- [x] The tab works on the dev route and from a production build served locally. The desktop path `app://local` and the APK web root are checked by reading how each serves `dist/`, or by running them. (dev route and `preview-dist` both showed 373 rows; `electron/main.cjs` maps `app://local/<path>` to `dist/<path>`; `capacitor.config.ts` has `webDir: 'dist'`; neither was run)
- [x] The How to Play topic names the tab. (`docs/How-to-Play.md`, Credits topic)
- [x] A changelog fragment is added. (`docs-internal/changelog.d/credits-04-licenses-tab.md`)
- [ ] Frames at 1366 and 375, both themes: `.scratch/frames/licenses-tab-light.png`, `.scratch/frames/licenses-tab-dark.png`, `.scratch/frames/licenses-tab-mobile.png`. (Three frames stored; the pane rendered desktop at 800 px, and mobile is dark only.)

For you: scroll and filter feel on the real list at mobile width.

## Landed

**Not verified**

- Frames at 1366 in both themes and 375 in light: the browser pane rendered desktop at 800 px wide, and the mobile frame is dark only.
- The `app://local` and APK paths: read from source, not run.

**For you**

- Scroll and filter feel on the real list at mobile width.
- Frames: `.scratch/credits-04/frames/licenses-tab-light.png`, `.scratch/credits-04/frames/licenses-tab-dark.png`, `.scratch/credits-04/frames/licenses-tab-mobile.png`.
