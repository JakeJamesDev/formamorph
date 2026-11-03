# 05: Story Card

Status: ready-for-agent
Blocked by: 01, 02, 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Model rationale: a new Pager slot, the card in both layouts, and the effort's E2E run.

**What to build:** after five completed turns on the Demo AI, a card with Morphie appears once under the latest narration and above the choices, in the Chat and Pages layouts. **See Levels** opens the scene, and **Keep Playing** returns to the turn with nothing lost. **Not Now** dismisses the card for good. After that, the Demo AI badge opens the scene.

This is the first ticket that lets a player reach the scene, so the offer's availability rule ships here: never in a build without hosted AI, for a pledged player, or on a non-Demo endpoint.

- [ ] One host opens the scene from anywhere in the app, and it stays open across a view change. This ticket owns it, and tickets 06, 07 and 11 use it with no second copy.
- [ ] Chat places the card through `latestFooter`. The Pager gains a slot under the latest page's narration, above the choices, and Pages uses it (Q19).
- [ ] The card never takes focus, and the choices and input stay usable while it shows.
- [ ] The card appears once through the rules module, and Not Now is recorded per device.
- [ ] The badge and the longer Demo AI dialog open the scene where the offer is available.
- [ ] A build without hosted AI shows no card and no See Levels. A test guards this, and removing the check fails it (Q6).
- [ ] One Playwright run goes from a fresh profile through the intro, Play Emberwatch, five turns on a stubbed endpoint, the card and the scene.
- [ ] Frames at `.scratch/frames/card-chat-1280.png`, `.scratch/frames/card-pages-1280.png` and `.scratch/frames/card-pages-375.png`, in both themes.
- [ ] The scene's surface entry moves from the `dev` exclusion to a docs target, and that docs section describes the offer and the scene.
- [ ] A changelog fragment states what changed for the player.

For you: the card's wording, and whether five turns feels right, in a real game on the Demo AI.
