# 02: Supporters Tab

Status: ready-for-human
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Crosses the bundle boundary and the age gate, and it changes a site page and the game together.

## What to build

The Credits dialog gains a **Supporters** tab with the live wall. It shows only with `COMMUNITY_ENABLED` on and the age gate already accepted. Opening Credits never prompts. If acceptance goes away while the tab is selected, the dialog falls back to Credits.

The wall becomes one component that the game's tab and the site's `/supporters` page both render. It fetches on mount, with no cache, and has loading, failed, empty and ready states. The failed state offers a way to try again. The empty state holds the Patreon link. The host decides what a name does: the site links to `/u/<name>`, and the game calls `openProfile`. The component imports no context.

Rulings: Q4, Q5, Q6, Q7, Q12, Q13, Q16.

## Acceptance criteria

- [x] With community on and the gate accepted, the tab shows the wall in the server's order. `CreditsDialog.test.tsx`; mutation: rows sorted by name goes red.
- [x] With the gate not accepted, the tab is absent and no prompt opens. Accepting it adds the tab with no reload. Tested. `CreditsDialog.test.tsx`; mutations: attested check dropped, prompt on open.
- [x] With community off, the tab is absent. `CreditsDialog.test.tsx`; mutation: community check dropped.
- [x] Selecting a name in the game opens the in-app profile, and on the site it opens `/u/<name>`. Tested in both hosts. `CreditsDialog.test.tsx` with the real profile dialog in `MainMenu.credits.test.tsx`; `SupportersPage.test.tsx`.
- [x] A failed fetch shows a message and a working try-again action. An empty wall shows the Patreon link. Both hosts; mutation: Try Again never reads.
- [ ] Closing the dialog during a fetch leaves no state write and no unhandled error.
- [x] `SupportersPage.test.tsx` still passes against the shared component, and the page keeps its layout and subtitle. Existing cases unchanged; a new case reads the heading and subtitle.
- [x] `site/bundleBoundary.test.ts` passes, with the component on its allow list and scan list, and the ceiling raised with its comment. Ceiling 75.
- [x] `CONTEXT.md`'s **Supporters wall** entry and the How to Play topic match.
- [x] A changelog fragment is added. `docs-internal/changelog.d/credits-02.md`.
- [x] Frames at 1366, both themes, with a dev fixture: `.scratch/frames/supporters-tab-light.png`, `.scratch/frames/supporters-tab-dark.png`. Playwright on `fixture=supporters`; the tier titles are fixture values.

For you: the tab with real supporters, once a build reaches the live wall.

## Landed

**Not verified**

- Closing the dialog during a fetch leaves no state write: the unhandled-error half is tested, and the code guards both writes with `useMountedRef`. React 18 ignores a write after unmount in silence, so no test can see the write.

**For you**

- The tab with real supporters, once a build reaches the live wall. Main Menu → **Credits** → **Supporters**.
- Frames: `.scratch/credits-02/frames/supporters-tab-light.png`, `.scratch/credits-02/frames/supporters-tab-dark.png`, `.scratch/credits-02/frames/supporters-tab-mobile.png`.
- The tab's loading and failure lines read "Loading supporters…" and "Could not load the list of supporters." on the site and in the game. The tab's label is **Supporters**, so they don't say "Supporters wall". The account page's "See the Supporters wall" link stays.
