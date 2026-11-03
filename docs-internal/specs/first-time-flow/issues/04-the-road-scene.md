# 04: The Road Scene

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Model rationale: the effort's main visual surface, with animation timing, SVG motion and a mobile layout the prototype left unsolved.

**What to build:** the full-screen scene, reached through its dev route. A fire stands at the newest story moment on a path of moments, and Morphie stands beside it and watches. Picking Spark, Flame or Beacon changes the fire, Morphie's look and how much of the path is lit. The scene states what each level's support includes. **Keep Playing** and **Support on Patreon** are stubs for later tickets to wire.

This ticket owns the scene, its level table and the fire. The prototype is on branch `prototype/first-time-flow`, and the approved Patreon art in the main checkout's `.scratch/tier-art/` shows the target composition and Morphie's exact layers. Rewrite the prototype's code.

Jelly tuning from the prototype, to tune by eye:

```ts
const CHANGE_JELLY = { durationMs: 560, squash: 0.2, overshoot: 0.16, settle: 2 };
const ENTER_JELLY = { durationMs: 480, squash: 0.14, overshoot: 0.09, settle: 2 };
```

- [ ] Morphie's looks match Q26 and use her existing layers, unmirrored. The offer always uses Morphie, whatever the player's active Mascot (Q20).
- [ ] Each level has its own fire per Q25, as inline SVG with no new image files.
- [ ] A level change plays the Jelly on Morphie only, through `mascotTransitionAt`. Playwright per-frame samples show the height's dip and peak, the swap at the dip, an interrupted change landing on the last pick, and no transform on any widget.
- [ ] Reduced motion swaps at once and stops the fire's motion, proven by a test.
- [ ] Level names come from the existing tier-names module, and prices come from `prices` on the same reply (integer US cents, Q35). A missing field or a `null` price hides the price and breaks nothing, because a server may not have deployed ticket 03 or filled the setting yet. The scene shows no turn counts or allowance amounts.
- [ ] The scene is always dark, whatever the app theme, and the fire uses one warm light color.
- [ ] On a mobile width the text and the road don't overlap, and every action is reachable. Frames at `.scratch/frames/road-1280.png` and `.scratch/frames/road-375.png`, one set per level.
- [ ] The scene has a `surface` entry and a dev route.
- [ ] The side-by-side block renders from fixed data with placeholder text, ready for ticket 10.

No changelog fragment here: ticket 05 is the first that lets a player reach the scene.

For you: the Jelly's feel and the fire's motion, in your own browser on the scene's dev route.
