# 05: Story Card

Status: done
Blocked by: 01, 02, 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Model rationale: a new Pager slot, the card in both layouts, and the effort's E2E run.

**What to build:** after five completed turns on the Demo AI, a card with Morphie appears once under the latest narration and above the choices, in the Chat and Pages layouts. **See Levels** opens the scene, and **Keep Playing** returns to the turn with nothing lost. **Not Now** dismisses the card for good. After that, the Demo AI badge opens the scene.

This is the first ticket that lets a player reach the scene, so the offer's availability rule ships here: never in a build without hosted AI, for a pledged player, or on a non-Demo endpoint.

- [x] One host opens the scene from anywhere in the app, and it stays open across a view change. This ticket owns it, and tickets 06, 07 and 11 use it with no second copy. `RoadSceneHost.test.tsx`: "opens from anywhere", "stays open across a view change".
- [x] Chat places the card through `latestFooter`. The Pager gains a slot under the latest page's narration, above the choices, and Pages uses it (Q19). A `storyCard` slot in the Pages narration in GamePanels (Q-ruling), with `GamePanels.chatLayout.test.tsx` for both layouts and the E2E box reads.
- [x] The card never takes focus, and the choices and input stay usable while it shows. `GameViewer.storyCard.test.tsx` "sits under the narration"; E2E activeElement read.
- [x] The card appears once through the rules module, and Not Now is recorded per device. `useDemoAIOffer.test.tsx`; "Not Now closes it for good", "a reload after it shows".
- [x] The badge and the longer Demo AI dialog open the scene where the offer is available. The badge opens the dialog, and its See Levels opens the scene (Q-ruling). "after Not Now, the badge dialog still opens the scene"; E2E.
- [x] A build without hosted AI shows no card and no See Levels. A test guards this, and removing the check fails it (Q6). `GameViewer.storyCard.noHosted.test.tsx`; removing the build check or the community check each fails it.
- [x] One Playwright run goes from a fresh profile through the intro, Play Emberwatch, five turns on a stubbed endpoint, the card and the scene. `e2e/first-time-flow.spec.ts`, desktop project, two runs of each test green.
- [x] Frames at `.scratch/frames/card-chat-1280.png`, `.scratch/frames/card-pages-1280.png` and `.scratch/frames/card-pages-375.png`, in both themes. Light frames carry `-light`.
- [x] The scene's surface entry moves from the `dev` exclusion to a docs target, and that docs section describes the offer and the scene. `road` and `storyCard` target How-to-Play, "The Formamorph AI Offer"; `docsCoverage.test.ts`.
- [x] A changelog fragment states what changed for the player. `docs-internal/changelog.d/first-time-flow-05.md`.

## Landed

**Not verified**
- Nothing in the list above. The E2E ran on the desktop Playwright project; 375 is a frame only. The GameViewer tests hold Pages, and Chat is held by the panel test and one E2E on a real fifth turn. `RoadSceneHost`'s mount gate in `App.tsx` has no test of its own, and the offer's own check covers the same build.
- The existing E2E suite against the first-run step (spec session's request): no spec needed a seed. The step needs a missing intro record, and every app spec seeds it through `openApp`, `tileDrag` or its own init script. This comes from reading the specs: the full run did not finish. It stops at load on `anonymous-likes`, `authoring-tour` and `opening-narration`, and the other 73 specs passed my 100-minute limit with no results. A sample of one spec per seed path gave 5 passed, 4 skipped and 6 failed: `enter-world` 2, `main-menu-context-menu-reference` 3, `rich-list-reference` 1. None of the six failure pages shows the step. I did not check whether those six also fail before this ticket.

**For you**
- For you: the card's wording, and whether five turns feels right, in a real game on the Demo AI.
- The card at `#dev?view=gameViewer&fixture=whiteRoom&modal=storyCard`. Frames: `.scratch/first-time-flow-05/frames/card-chat-1280.png`, `.scratch/first-time-flow-05/frames/card-pages-1280.png`, `.scratch/first-time-flow-05/frames/card-pages-375.png`, and the `-light` set beside them.
- The new line and See Levels in the Demo AI dialog: "Formamorph AI is a stronger AI with no setup, and your support on Patreon includes it."
- A release between tickets 05 and 06 would send Support on Patreon straight to the Patreon page, and a release before ticket 10 would ship the scene's placeholder text.
- This makes the scene reachable, so the draft scene copy from ticket 04 now needs your approval before a release.
