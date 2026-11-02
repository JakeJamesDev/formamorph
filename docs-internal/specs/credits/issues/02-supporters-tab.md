# 02: Supporters Tab

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Crosses the bundle boundary and the age gate, and it changes a site page and the game together.

## What to build

The Credits dialog gains a **Supporters** tab with the live wall. It shows only with `COMMUNITY_ENABLED` on and the age gate already accepted. Opening Credits never prompts. If acceptance goes away while the tab is selected, the dialog falls back to Credits.

The wall becomes one component that the game's tab and the site's `/supporters` page both render. It fetches on mount, with no cache, and has loading, failed, empty and ready states. The failed state offers a way to try again. The empty state holds the Patreon link. The host decides what a name does: the site links to `/u/<name>`, and the game calls `openProfile`. The component imports no context.

Rulings: Q4, Q5, Q6, Q7, Q12, Q13, Q16.

## Acceptance criteria

- [ ] With community on and the gate accepted, the tab shows the wall in the server's order.
- [ ] With the gate not accepted, the tab is absent and no prompt opens. Accepting it adds the tab with no reload. Tested.
- [ ] With community off, the tab is absent.
- [ ] Selecting a name in the game opens the in-app profile, and on the site it opens `/u/<name>`. Tested in both hosts.
- [ ] A failed fetch shows a message and a working try-again action. An empty wall shows the Patreon link.
- [ ] Closing the dialog during a fetch leaves no state write and no unhandled error.
- [ ] `SupportersPage.test.tsx` still passes against the shared component, and the page keeps its layout and subtitle.
- [ ] `site/bundleBoundary.test.ts` passes, with the component on its allow list and scan list, and the ceiling raised with its comment.
- [ ] `CONTEXT.md`'s **Supporters wall** entry and the How to Play topic match.
- [ ] A changelog fragment is added.
- [ ] Frames at 1366, both themes, with a dev fixture: `.scratch/frames/supporters-tab-light.png`, `.scratch/frames/supporters-tab-dark.png`.

For you: the tab with real supporters, once a build reaches the live wall.
