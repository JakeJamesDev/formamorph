# 04: The Road Scene

Status: ready-for-human
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

- [x] Morphie's looks match Q26 and use her existing layers, unmirrored. The offer always uses Morphie, whatever the player's active Mascot (Q20). `RoadScene.test.tsx`: "lights its moments and shows its own fire and look", "never mirrors Morphie"; the scene reads no Mascot setting.
- [x] Each level has its own fire per Q25, as inline SVG with no new image files. `RoadFire.tsx`; frames per level.
- [x] A level change plays the Jelly on Morphie only, through `mascotTransitionAt`. Playwright per-frame samples show the height's dip and peak, the swap at the dip, an interrupted change landing on the last pick, and no transform on any widget. `e2e/road-scene.spec.ts`: "a change dips, peaks and swaps at the dip", "an interrupted change lands on the last pick".
- [x] Reduced motion swaps at once and stops the fire's motion, proven by a test. "swaps at once with no transform", "stops the motion of the %s fire", e2e "reduced motion swaps at once".
- [x] Level names come from the existing tier-names module, and prices come from `prices` on the same reply (integer US cents, Q35). A missing field or a `null` price hides the price and breaks nothing, because a server may not have deployed ticket 03 or filled the setting yet. The scene shows no turn counts or allowance amounts. "RoadScene prices" and `tierNames.test.tsx` "prices"; "shows no turn count or allowance amount".
- [x] The scene is always dark, whatever the app theme, and the fire uses one warm light color. e2e "stays dark under the light theme"; `FIRE_LIGHT`.
- [x] On a mobile width the text and the road don't overlap, and every action is reachable. Frames at `.scratch/frames/road-1280.png` and `.scratch/frames/road-375.png`, one set per level. e2e layout tests at both widths; frames named `road-<width>-<level>.png`.
- [x] The scene has a `surface` entry and a dev route. `surface="road"` and `#dev?modal=road&tab=<tier>`; excluded as `dev` until ticket 05 (Q-ruling on the surface entry).
- [x] The side-by-side block renders from fixed data with placeholder text, ready for ticket 10. `ROAD_SAMPLES`; "renders the side-by-side block".

No changelog fragment here: ticket 05 is the first that lets a player reach the scene.

## Landed

**Not verified**
- Nothing in the list above. Motion ran on the desktop Playwright project only, with the viewport set to 375 for the mobile layout test.

**For you**
- For you: the Jelly's feel and the fire's motion, in your own browser on the scene's dev route.
- Approve the draft copy, including the headline and the perks list, on `#dev?modal=road`. The level lines and the side-by-side text stay placeholders for ticket 10. A release between tickets 05 and 10 would ship those placeholders.
- Judge the road with no story text over it, which changes the prototype. Frames: `.scratch/first-time-flow-04/frames/road-1280-flame.png`, `.scratch/first-time-flow-04/frames/road-375-flame.png`, and the spark and beacon sets beside them.
- At the Jelly's peak the top of her hair clips at the stage's edge for a few frames, about 30 stage units. Lower `overshoot` or move her down if it shows.
- The dots and the light fade over about half a second after the swap. Tell us if the Jelly should be the only motion.
- The Help tab stays over the scene, as it does on every view, in its white style.
