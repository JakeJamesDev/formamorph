# Spec: First-Time Flow

Status: ready-for-agent
Spec session: first-time-flow — spec
Status note: Grilled 2026-11-03 (Q1–Q28). Prototype verdict: Scene A, The Road. Eleven tickets. Blocked at runtime by the Formamorph AI release, so the offer must stay off in a build without it.

A new player reaches a first story in one click. A player on the Demo AI, or on a desktop with 8 GB of VRAM or less, learns about Formamorph AI through Morphie and a scene worth looking at, not through a popup they close at once. Spans both repos: the client and FormamorphServer.

## Problem Statement

The intro ends at the main menu, and a new player must find a world and walk through the Enter World steps before the first turn. Then the first game entry on the Demo AI opens a five-paragraph dialog before any play.

A player on the Demo AI meets a small model and may blame the app or the world for flat narration. A desktop player with little VRAM can download a model too weak to give a good experience. Neither player learns that a Supporter pledge includes a stronger AI. The only path today is a locked preset in AI settings.

## Solution

**First run.** The intro ends on one step with Morphie: **Play Emberwatch** on the right and **Browse Worlds** on its left. Play skips the Enter World steps and opens the game. A desktop player with no working AI sees AI setup first. An event dialog waits until this step is done.

**First game entry.** A short, non-blocking line replaces the Demo AI dialog on entry. The Demo AI badge still opens the longer explanation.

**The offer.** After five completed turns on the Demo AI, a card with Morphie appears once, under the latest narration and above the choices, in both the Chat and Pages layouts. **See Levels** opens the scene. After that, only the Demo AI badge opens it.

**The scene.** A full-screen, always-dark scene called The Road. A fire stands at the newest story moment, and its light reaches back along a path of story moments. Morphie stands beside it and watches, and her interest grows with the fire. Spark, Flame and Beacon each light more of the path. Each level has its own fire and its own look on Morphie. Changing level plays a Jelly on Morphie only, and the new level swaps in at the dip. Below the road, one fixed scene written by both AIs sits side by side.

**Low VRAM.** On desktop at 8 GB or less, AI setup leads with Formamorph AI, its See Levels opens the same scene, and the local model download stays below it.

**Locked preset.** A player who selects Formamorph AI in AI settings with no access sees a panel with Morphie, the fire and the three levels, in place of plain text and a button. See Levels opens the same scene.

**After Support on Patreon.** A guided checklist takes the player through sign-in with the 18+ check, the pledge, the Patreon link and the switch to Formamorph AI. The checklist reads real state, so a finished step shows as finished. The fire beside Morphie grows with each step.

## Rulings

| Q | Ruling |
|---|---|
| Q1 | The offer first shows after some play, not on entry. |
| Q2 | After the intro, the flow offers a one-click start into one bundled world. |
| Q3 | A story card leads into a full-screen scene. |
| Q4 | Formamorph AI leads AI setup at 8 GB of VRAM or less (a reported total up to 8,500 MB). User reason: models that fit 8 GB are too weak for a good experience. |
| Q5 | Copy keeps "your support includes" and states each level's perks plainly. [Supporter Tier Names](../supporter-tier-names/spec.md) Q3 stands. |
| Q6 | The offer appears on web, desktop and Android, never on Steam. |
| Q7 | The card appears after 5 completed Demo AI turns. |
| Q8 | The card appears once on its own. After that, only the Demo AI badge opens the scene. |
| Q9 | A short line replaces the Demo AI dialog on first entry. The badge keeps the longer explanation. |
| Q10 | Support on Patreon opens a guided checklist: sign in with the 18+ check, pledge, link Patreon, switch. |
| Q11 | Emberwatch is the one-click first world. |
| Q12 | The scene shows one fixed scene written by both AIs, side by side. No free trial turns. |
| Q13 | Existing Demo AI players also see the card once, after their next 5 turns. |
| Q14 | We count anonymous totals per funnel step, with no player ID. |
| Q15 | The low-VRAM lead is a card in AI setup that opens the same scene. Local download stays below it. |
| Q16 | The scene uses real Morphie art with code-driven motion. |
| Q17 | The first-run step has Play Emberwatch as the main action and Browse Worlds beside it. |
| Q18 | A prototype came before this spec, and Scene A, The Road, won. |
| Q19 | The Pages layout shows the same card under the latest page's narration, above the choices. |
| Q20 | The offer always uses Morphie, even for a player with a custom Mascot. |
| Q21 | Play Emberwatch skips the Enter World steps, as Quick Start does. The world's readme still appears in the game. |
| Q22 | Event dialogs wait until the first-run step is done. |
| Q23 | The confirm action sits on the right, following Paired Footer Actions in the Design System. |
| Q24 | The Jelly plays on Morphie only, never on widgets. |
| Q25 | Each level has its own fire, not a plain circle: Spark twinkles, Flame has layered moving tongues and embers, Beacon is a tall flame in a brazier with rays. |
| Q26 | Morphie watches the fire and never holds it. Her interest grows with the level, using her existing layers: Spark has resting arms and a small "o" mouth, Flame has a hand to her chin, wide eyes and a small "o" mouth, and Beacon has resting arms, heart eyes and an open mouth. Her art stays unmirrored, so she faces left, toward the fire. No blush and no wave. No new art. |
| Q27 | Selecting Formamorph AI with no access shows an inline panel in AI settings with Morphie, the fire and the three levels. See Levels opens the scene. Selecting the preset never opens the scene by itself. |
| Q28 | The panel shows for a signed-out player, a player without the 18+ check, and a signed-in player with no pledge. Support on Patreon opens the checklist, which starts at the first unfinished step. Every other preset state keeps today's text. |
| Q29 | The entry line shows while narration is on the Demo AI and the seen key is unset. Showing it sets the key, so it appears on one game entry per device and stays until the player leaves that game view. When the AI gate is due, the line and the key wait for a later entry. Ticket 01 ruling. |
| Q30 | The line states a fact about the Demo AI, so it ignores hosted availability and pledge. Only the card and the AI setup lead use those. Ticket 01 ruling. |
| Q31 | A counted turn is one that follows a player action. The opening never counts, whether the AI or the author wrote it, so "five turns" means five player actions in every world. Rollback then a new action counts. A regenerate or a loaded save does not. Ticket 01 ruling. |
| Q32 | The first-run rule takes the intro-seen record as read at launch, plus the first-run step's own record, because the intro writes its record when it ends. A replayed intro never makes the step due. Ticket 01 ruling. |
| Q33 | A first-entry readme opens at once, as it does for returning players, without waiting for the reachability probe. A failed probe opens the gate over it. Ticket 01 ruling. |
| Q34 | Opening the longer dialog from the badge sets the seen key, so that player never sees the entry line. Ticket 01 ruling. |
| Q35 | The tier-names reply keeps its title keys and adds a sibling `prices` field: integer cents per tier key, `null` when unknown, in the campaign's US dollars with no currency code. Prices refresh by the same rule as titles. Ticket 03 ruling. |
| Q36 | Play Emberwatch uses the stored world. If the seeder hasn't stored it yet, Play starts from the bundled copy, and a save from that game must still reach the same world id. If the player deleted Emberwatch, the step offers Browse Worlds only, so a deletion stays respected. Ticket 02 ruling. |
| Q37 | Play, Browse Worlds, Escape and an outside click all close the first-run step and mark it seen. Ticket 02 ruling. |
| Q38 | The scene states each level's perks with the "Your support includes" list from the approved Patreon text, and leaves out the Fantasy Futanari block and the 18+ line. Copy may land as a draft while no player can reach the scene; the user approves it before release. Ticket 04 ruling. |
| Q39 | The road carries no story text: lit moments, the fire and Morphie only, as in the approved art. The scene opens on Flame, and the locked preset panel uses the same default. Ticket 04 ruling. |
| Q40 | With no level names from the server, the scene falls back to Spark, Flame and Beacon from its level table, because three levels reading "Member" can't be told apart. The "Member" fallback stands everywhere else. Ticket 04 ruling. |
| Q41 | Funnel steps on the wire are `offer_shown`, `see_levels`, `patreon_click` and `checklist_finished`, at `POST /api/funnel/:step`, with an in-memory per-IP limiter that stores no IP. The totals read at `GET /api/funnel` is admin-only, newest day first, because these are business numbers. The privacy line needs no re-accept unless the user says otherwise. Ticket 08 ruling. |
| Q42 | The card's seen key is set when it first renders, after the fifth turn's reveal ends. It stays under the latest narration in that game view until Not Now, See Levels, or leaving the view, and nothing brings it back. Ticket 05 ruling. |
| Q43 | The badge always opens the longer dialog, and the dialog's See Levels opens the scene where the offer is available. This refines Q8 and keeps Q9. Ticket 05 ruling. |
| Q44 | A pledged player is one whose hosted state has a known tier, or whose preset state is ready, warned or exhausted. A pledged player signed out on this device counts as not pledged. Availability is a hosted URL plus community accounts on. Until ticket 06, Support on Patreon opens the Patreon page. Ticket 05 ruling. |
| Q45 | Lit counts and level lines come from how much story each window holds before a memory drops (latest turns plus kept summaries), because every level keeps the same latest turns word for word. Level lines speak of main events, and one line says every level keeps the latest scenes word for word. No turn counts show. Ticket 10 ruling. |
| Q46 | The sample block shows the player's action above the two replies. The pair stays honest even if the gap is small, and the user decides whether a small gap keeps the block. Ticket 10 ruling. |
| Q48 | The samples must be real turns: the shipped Demo AI preset and Formamorph AI's real request path, played through the app, including one turn where the player speaks to no one. A replay with changed request fields doesn't count. Any skew found gets named, because it may be a pipeline bug. User ruling. |
| Q49 | The scene ships Pair 3, the later turn, unedited: a player presses a character on an earlier line. The block renders its italics. User ruling. |
| Q50 | Formamorph AI gets the same sampler sliders as other endpoints, and they start on the model's published values: Temperature 1.0, Top-p 0.95, Top-k 64, with Repetition Penalty and Min-p off. Probes found no reason to prefer another set. Extra Parameters stay closed. User ruling. |
| Q51 | A player sets Formamorph AI's max output anywhere up to the server's cap. Blocking a lower value was bad UX, and the cap still holds. User ruling. |
| Q52 | The low-VRAM lead hides for a pledged player (Q44), through a pledged fact in the rules module. It shows only in the bundled-engine choose step, for both setup reasons and both the short and Show-all views. Its one action is See Levels, and the text below it stays as it is. Ticket 07 ruling. |
| Q53 | The checklist renders in the scene's body under the mounted stage, with no new dialog. The fire shows progress, not the player's level: Spark at 0-1 finished steps, Flame at 2-3, Beacon at 4. No self-reported pledge: the pledge step finishes only when a link shows a tier. Opening the Patreon page is a per-device record that makes Link Patreon the main action. A link with no tier finishes the link step and returns the main action to the pledge. Ticket 11 calls one exported opener. Switch selects the preset and closes the scene, and Finish Later writes nothing. Ticket 06 ruling. |
| Q54 | When thinking is off for the active model and a call starts thinking, or its stream fails before any reply text, the proxy stops it and retries once, unseen by the client. The retry stays off the turn call cap and the player's allowance, and on the recorded spend. Full-turn runs showed these calls almost never end cleanly and can lose a turn. User ruling. |
| Q47 | The offer sells two things, in this order: more turns each week, the biggest reason to upgrade, then large worlds and long stories together. Formamorph trims context on purpose so long stories stay consistent, and a larger window means a large world still has room for memory. Copy never sells memory alone. Copy says "more turns" with no numbers. User ruling. Q55 replaces this. |
| Q55 | The offer sells a stronger AI: stronger than the Demo AI and than a model that fits 8 GB, with no setup. How much story a level holds is a feature, listed as a perk and never the pitch. "More turns" compares levels only, never Formamorph AI against a local model or the Demo AI, because a local model has no weekly limit. The road's art stays, and no text says what its light means. Replaces Q47 and the level-line part of Q45. User ruling. |
| Q60 | Offer copy names the strength as narration quality and consistency. Longer surfaces follow one order: narration quality, then allowance against lower levels, then context against lower levels. Short cards leave context out. User ruling. |
| Q61 | Supporting development is a reason to pledge in its own right, and the perks are the extra. The scene leads with it, and one line above Support on Patreon speaks to a player on the fence. Short cards end with one clause on it. Copy states the fact and never guilts. Narration quality still leads the perks. User ruling. |
| Q56 | Formamorph AI's sliders and Max Output show in Advanced mode only, as on every other endpoint. Simple mode shows the status panel only. Ticket 12 ruling. |
| Q57 | For the proxy retry, thinking is off only when a model entry says so: `reasoning.enabled` false or `reasoning.effort` `none`. A missing field counts as on and never triggers a thinking stop. On a thinking-on model, a thinking frame ends the hold and is forwarded, and nothing retries after it. Ticket 13 ruling. |
| Q58 | Each attempt gets a fresh idle timer, with no new setting. The turn limit and the day's pause are checked before the retry. If either blocks it, no retry goes out and the answer is `upstream_error`. Ticket 13 ruling. |
| Q59 | A stopped attempt, including a failed second attempt, costs no allowance and counts on the recorded spend. The admitted call keeps its one turn-cap slot and per-minute count even if both attempts fail, so resent failed calls stay limited. Only the retry is free of those limits. Ticket 13 ruling. |

## User Stories

1. As a new player, I want one clear next step after the intro, so that I don't have to work out where to begin.
2. As a new player, I want to start Emberwatch with one click, so that I reach a story before I lose interest.
3. As a new player who wants to choose, I want Browse Worlds beside Play, so that I can look around first.
4. As a new player, I want no event dialog over my first step, so that I see one thing at a time.
5. As a player with event news waiting, I want the event dialog when I next reach the main menu, so that I still see the news.
6. As a new desktop player with no working AI, I want AI setup before the first-run step, so that Play leads to a story that works.
7. As a returning player, I want to never see the first-run step again, so that the app doesn't treat me as new.
8. As a player on the Demo AI, I want a short line on entry and no dialog, so that I can start playing at once.
9. As a player on the Demo AI, I want the badge to keep the longer explanation, so that I can read it when I am curious.
10. As a player on the Demo AI, I want the card only after a few turns, so that I know what the game is before I see an offer.
11. As a player in the Chat layout, I want the card under the latest narration, so that it sits in the story's flow.
12. As a player in the Pages layout, I want the same card under the latest page's narration, so that I don't miss it on the default layout.
13. As a player, I want the choices and input to stay usable while the card shows, so that the card never blocks my turn.
14. As a player, I want Not Now to dismiss the card for good, so that I'm not asked again.
15. As a player who dismissed the card, I want the Demo AI badge to open the scene, so that I can come back when I'm ready.
16. As an existing Demo AI player, I want the card once after my next five turns, so that I learn about the option.
17. As a player already pledged, I want no offer, so that I'm not asked for what I already give.
18. As a player on my own endpoint, I want no offer, so that my setup is left alone.
19. As a player on the scene, I want to see what each level includes, so that I understand what the levels change.
20. As a player changing levels, I want Morphie to react, so that the choice feels alive.
21. As a player, I want each level's fire to look different, so that the names read at a glance.
22. As a player, I want the page's widgets to hold still, so that I can keep reading while Morphie moves.
23. As a player, I want to read the same scene from both AIs, so that I can judge the difference myself.
24. As a player, I want the scene to state what my support includes, so that I know what I get before I leave for Patreon.
25. As a player with a custom Mascot, I want Morphie to host the offer, so that the fire and the pose fit together.
26. As a player with reduced motion on, I want the scene without the Jelly or moving fire, so that it is comfortable to use.
27. As a mobile player, I want the scene laid out for my screen, so that the text and the road don't overlap.
28. As a player, I want Keep Playing to return me to my turn with nothing lost, so that looking at the scene costs nothing.
29. As a player starting the checklist, I want to see every step before I begin, so that I know what is involved.
30. As a signed-out player, I want sign-in and the 18+ check as the first step, so that I don't pay and then fail the check.
31. As a player who left for Patreon, I want the checklist to pick up where I was when I return, so that I don't start over.
32. As a player who pledged but didn't link, I want the link step to show as next, so that I get what my support includes.
33. As a player who finishes the checklist, I want to switch to Formamorph AI and return to my story, so that I can use it at once.
34. As a player who stops partway, I want Finish Later, so that I can go back to my story without losing progress.
35. As a desktop player with 8 GB of VRAM or less, I want Formamorph AI first in AI setup, so that I don't download a weak model by mistake.
36. As a desktop player with 8 GB or less, I want the local download still available, so that the choice stays mine.
37. As a desktop player with more than 8 GB, I want a local model to stay the lead, so that I'm not steered away from what runs well.
38. As a Steam player, I want no offer, so that I never see a path that can't work on my build.
39. As the developer, I want anonymous totals for each funnel step, so that I can tell whether the flow works without tracking anyone.
40. As a player, I want the privacy policy to state what is counted, so that I can trust the count.
41. As a player who selects Formamorph AI with no access, I want to see what the levels include right there, so that I understand why it's locked and what to do next.
42. As a player browsing presets, I want selecting one to stay inside AI settings, so that a full-screen scene doesn't interrupt me.

## Implementation Decisions

**Rules module.** One pure module owns what shows next and takes plain facts as input: intro seen, first-run step seen, narration on the Demo AI, Demo AI turn count, card seen, pledged or locked hosted state, hosted availability in this build, and total VRAM. It answers whether the first-run step is due, whether the card is due, whether the entry line shows, and whether AI setup leads with Formamorph AI. GameViewer and MainMenu only pass facts in and render the answer.

**Device records.** First-run step seen, the Demo AI turn count, and card seen are per-device records beside the existing Demo AI seen key. **No world or save export shape changes.**

**Turn count.** The count rises on a new committed turn while the Demo AI writes the narration, in any world. A regenerate does not count, although `turnCommitNonce` also rises on one, so the count needs its own signal from the turn commit. The count stops once the card has shown. A player whose existing Demo AI seen key is set starts at zero (Q13).

**Availability.** The offer appears only where hosted AI can work: the build has a hosted URL and community accounts on. No Steam flag exists in the code today. A Steam build must leave hosted AI off, and a test guards the rule.

**Who never sees it.** A player on a non-Demo endpoint, a pledged player, and a build without hosted AI. A pledged player on the Demo AI keeps the existing switch-once behavior from Hosted state.

**First-run step.** A surface over the main menu, shown when the intro ends. Event dialogs hold on it, with the same `held` mechanism they use for the intro and the age gate. Tutorial popovers hold too. A desktop player with no working AI sees the existing AI gate first. Browse Worlds closes the step and stays on the menu. The step doesn't open for a player who already has the intro-seen record.

**One-click entry.** No exported one-call entry exists today; Quick Start acts on the selected world inside the Enter World flow. Play Emberwatch needs an entry by bundled world id that reuses Quick Start's defaults and ends in the same start-game path. The world's readme still queues in the game (Q21).

**Entry line.** The Demo AI dialog leaves the entry order (`nextEntryDialog`). The order becomes the AI gate, then the readme. The short line renders in the narration area and needs no dismissal. The badge still opens the existing dialog, and the dialog gains See Levels where the offer is available.

**Card.** One component rendered in both layouts. Chat places it through `latestFooter`. Pages has no such slot, so the Pager gains one under the latest page's narration, above the choices. The card never takes focus and never blocks input.

**Scene.** A full-screen surface with a `surface` entry and a dev route, forced to dark tokens so the light reads. The fire uses one warm light color, not the theme accent. Level data lives in one table: lit moments, fire width, light radius and the level's line. Names come from the existing tier-names module. Each level's price comes from Patreon through the same server route as its title, so a price change needs no build; the ticket confirms the field on Patreon's Tier resource. The scene shows no turn counts or allowance amounts.

**Jelly.** Reuses `mascotTransitionAt`, the shared timing function, with new tuning. The prototype's values (from the prototype; tune by eye):

```ts
const CHANGE_JELLY = { durationMs: 560, squash: 0.2, overshoot: 0.16, settle: 2 };
const ENTER_JELLY = { durationMs: 480, squash: 0.14, overshoot: 0.09, settle: 2 };
```

A value swaps at `jellyDipMs`. An interrupted run starts from the height on screen. Timers carry the swap and the rest, so a suspended animation frame can't strand an old level. Reduced motion swaps at once and drops the fire's motion.

**Fire.** Inline SVG with code-driven motion and no new image files. Flame and Beacon morph between outlines with matching path commands, in three layers. The fire stands on its own, and the prototype's fire at her hand does not ship (Q26). The approved Patreon tier art shows the target composition.

**Side-by-side sample.** Two real, unedited model outputs for one Emberwatch moment, captured once and shipped as fixed text. The Demo AI and Formamorph AI samples come from the same prompt. Picks must be honest: typical outputs, not the Demo AI's worst. The user approves the pair.

**Level lines.** Each line states what the level adds: a stronger AI with no setup on Spark, then more turns on Flame and Beacon (Q55). Room for larger worlds is a perk, stated plainly. The road's lit counts are art, and no text ties them to story held.

**Checklist.** Reads `AuthService`, `useAgeGate`, `PatreonService.getStatus()` and the hosted state through `useSettings().hostedAi`. It re-reads on focus, as `PatreonSection` does. Each action reuses the existing path: `requireAttestation`, the Patreon page, `startLink`, and `selectTextEndpointPreset`, which already records the preset to switch back to. On a build that can't open Patreon inside the app, the existing `openExternal` path applies.

**Low-VRAM lead.** AI setup reads `useVramStats` on desktop. The lead card shows at a total of 8,500 MB or less, whatever `tierForVram` groups it in, because that function puts cards up to 14 GB in one group. An unknown VRAM keeps today's layout. Above the limit, Formamorph AI stays available and does not lead.

**Locked preset panel.** Replaces the reason text and button in `HostedPresetStatus` for the Q28 cases. It reuses the scene's level table and fire, with no second copy.

**Anonymous totals (FormamorphServer).** A public POST route takes one step name from a fixed list: offer shown, See Levels, Patreon click, checklist finished. It increments a per-day total and stores no IP, install ID or account. It uses a per-route limiter, following `likeLimiter`. The client sends each step once per device. A failed send is dropped. The privacy policy text in the server gains a line, and the user approves its wording. The route deploys before the client ships.

**Button order.** Every pair follows Paired Footer Actions: negative first in the DOM and on the left, affirmative on the right from `sm` up, affirmative on top below that.

**Copy.** All wording a player sees first goes to the user for approval, written per the Writing Guide. The prototype's copy is draft. "Your support includes" stays (Q5). Copy never uses "hosted tier".

## Testing Decisions

A good test calls the real rules or renders the real surface, and asserts what a player would see. Each guard is proven by removing it once. Nothing shapes the scenario so a rule can't fire.

**Seam 1: the rules module.** The main seam. Table tests cover every due and never-due case: the fifth turn and not the fourth, a regenerate not counted, an existing player starting at zero, a pledged player, a non-Demo endpoint, a build without hosted AI, 8,500 MB against 8,501 MB, and unknown VRAM.

**Seam 2: rendered surfaces.** Prior art: `DemoAINotice.test.tsx`, `AiSetupGate.test.tsx`, `entryDialogOrder.test.ts` and the GamePanels chat tests.
- The first-run step: the two actions and their order, and an event dialog held behind it.
- The entry order without the Demo AI dialog, and the badge still opening it.
- The card in both layouts, with input still usable, and Not Now.
- The scene: each level's lit count and fire, and only Morphie's element moving.
- The checklist against each real state, including a return from Patreon with the pledge done and the link not done.
- AI setup's lead card on each side of the limit.

**Seam 3: the server route.** Prior art: `anonymousLikes.test.js`. A known step increments today's total, an unknown step is refused, the limiter bites, and nothing identifying is stored.

**Motion.** Playwright samples per frame, as the prototype did: the height's dip and peak, the swap at the dip, an interrupted change, and no transform on any widget. The Browser pane can't verify motion. Test only after the menu settles, because a loading menu in the dev build starves the frames.

**E2E.** One Playwright run from a fresh profile through the intro, Play Emberwatch and the game view. Use a stubbed endpoint for the five turns.

## Out of Scope

- Hosted image generation, free trial turns, and Steam subscriptions.
- Reading VRAM in a browser. Web keys on Demo AI use only.
- Choosing a recommended world per player.
- Tier prices and allowances: [Formamorph AI](../hosted-ai/spec.md) and [Weekly Allowance](../weekly-allowance/spec.md).
- Renaming the internal tier keys.
- Scene B and Scene C, except as a reference on the prototype branch.

## Further Notes

- **Prototype:** branch `prototype/first-time-flow`, commit `f0ad275ba`, launch entry `prototype-first-time-flow` on port 5263, `/?ft=sceneA#dev?view=mainMenu`. It answered "what should this look like?" and Scene A won. Throwaway, so it gets a rewrite: its story card sits on a stand-in feed and its samples are placeholder text.
- **Release order:** the Formamorph AI release comes first, with release blocker 04 (tier titles in Patreon) and 05 (weekly budgets) clear.
- **Names:** Spark, Flame and Beacon come from the Patreon titles through the existing tier-names module. The user sets them in Patreon.
- **Economics:** tier economics never enter this spec or the tickets.
- No export shape changes. No version change.
