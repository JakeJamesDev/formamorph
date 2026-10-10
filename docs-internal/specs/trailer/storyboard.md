# Trailer storyboard

Parent: [Trailer spec](spec.md) · Ticket: [03 Storyboard](issues/03-storyboard.md)

**At a glance**

| Cut | Size | Length | Shots |
|---|---|---|---|
| Wide (Steam) | 1920x1080, 60 fps | 83.83 s (5,030 frames) | 20 |
| Tall (social) | 1080x1920, 60 fps | 59.92 s (3,595 frames) | 14 |

The first 6 seconds (frames 0–359) are a standalone silent loop in both cuts.

---

## 1. Feature list

Ranked by what sells the app to a Steam visitor who reads the copy without sound. Sources: the landing page tagline ([hosting/index.html](../../../hosting/index.html)) and [docs/Changelog.md](../../../docs/Changelog.md).

| Rank | Feature | Source | Shots | Pick |
|---|---|---|---|---|
| 1 | Type any action, an AI narrator writes what happens | Landing, 2.0 | W05 | ✅ |
| 2 | Play authored worlds: the bundled set and the library | Landing, 2.15 | W04 | ✅ |
| 3 | Build your own world: map canvas, travel, entities, stats | Landing, 2.11, 2.13 | W09–W11 | ✅ |
| 4 | Hundreds of community worlds | Landing, 2.9, 2.19 | W14 | ✅ |
| 5 | Any AI model, in the browser or offline on desktop | Landing, 2.0.1 | W16–W17 | ✅ |
| 6 | Stats that every turn updates | 2.12 | W06 | ✅ |
| 7 | Entities with art you meet in play | 2.0.1 | W07 | ✅ |
| 8 | Races, classes and traits (Blueprints, Personas) | 3.0.0, 3.1.0 | W12 | ✅ |
| 9 | Open Chat: talk with any entity from the library | 3.0.0 | W08 | ✅ |
| 10 | Formaquestion help window and Morphie | 3.2.0 | W13 | ✅ |
| 11 | Community contests and events | 2.14 | W15 | ✅ |
| 12 | 3D VRM avatars | 2.5, 2.18 | none | ✂️ cut on review (Q60): out of place beside the other features |
| 13 | Memory: milestones, diary, Memory Manager | 2.6, 2.7 | none | ✂️ |
| 14 | Scene images every turn (InvokeAI) | 2.8 | none | ✂️ needs an image fixture |
| 15 | Character cards and SillyTavern lorebook import | 2.0.1 | none | ✂️ a file dialog does not film well |
| 16 | Themes and light/dark | 2.0.1 | none | ✂️ one palette keeps the cut coherent |
| 17 | Android and mobile layouts | 2.3, 2.17 | the tall cut itself | ✂️ |
| 18 | Text to Speech voices | 2.8 | none | ✂️ the trailer is silent (Q3, Q4) |
| 19 | AI tools, Test Bench, Authoring Tour, undo | 2.13, 3.1.0, unreleased | none | ✂️ authoring polish, low pull |

---

## 2. Wide cut (16:9)

**Arc:** loop hook → the promise → play → build → share → run anywhere → close.

**Look:** the Floating cards language (Q27, Q28). Slow glowing blobs drift on one dark stage under the whole cut. Each UI shot is a tilted glass card that rises on a spring, floats on a bob and fades as it drifts away, over a dimmed depth card. Headlines rise word by word in Lexend in the Design System's type roles; captions are glass pills.

**Scene types:** `kinetic` headline · `frame` card over a captured PNG · `turn` the captured narration reveal on a card, with the typed player line on a panel below it · `title` wordmark or end card.

**Joins (Q29):** `overlap` (30 f) inside a section, `section` (36 f) between sections, `cut` (0 f) inside the loop. A join is a plain overlap: the outgoing scene leaves by its own exit while the next one springs in. It overlaps the end of its shot, so a shot's start is the previous start plus its duration minus its outgoing join.

| Shot | Start | Frames | Dense | Type | Copy | Source frame | Camera | Out |
|---|---|---|---|---|---|---|---|---|
| W03 | 0.00 s | 360 |  | title | goo wordmark only | stage only | none; starts and ends on the bare stage | cut |
| W04 | 6.00 s | 300 |  | frame | An AI text RPG. / Play any world you can imagine. | C01 | full frame | section |
| W05 | 10.40 s | 360 |  | turn | Type any action. / The narrator continues the story. | C02c, a clip of the live narration reveal | static crop on the narration | overlap |
| W06 | 15.90 s | 220 |  | frame | Every turn updates your stats. | C02b, as a clip of the live stat-bar animation | static crop on the stat bars | overlap |
| W07 | 19.07 s | 210 |  | frame | Talk to anyone you meet. | C03 | static crop on the entity card | overlap |
| W08 | 22.07 s | 242 |  | frame | Chat with anyone in your library. | C04 | full frame | section |
| W09 | 25.50 s | 175 |  | kinetic | Build your own world. | stage only | none | overlap |
| W10 | 27.92 s | 240 |  | frame | Place locations on a map. | C05 | full frame | overlap |
| W11 | 31.42 s | 240 |  | frame | Write who lives there. | C06 | static crop on the entity profile | overlap |
| W10b | 34.92 s | 270 |  | frame | Then travel there and meet them. | C13 | static crop on the dialog | overlap |
| W12a | 38.92 s | 212 |  | kinetic | Traits shape who you play. | stage only | none | overlap |
| W12 | 41.95 s | 305 |  | frame | Define your world and everyone in it, your way. | C07 | full frame | overlap |
| W13a | 46.53 s | 176 |  | kinetic | Need help? Just ask. | stage only | none | overlap |
| W13 | 48.97 s | 380 |  | frame | Ask your AI guide Morphie for help at any time. | C08, a clip: Morphie thinks, then the answer streams in | static crop on Morphie and the answer | section |
| W14 | 54.70 s | 305 |  | frame | Download hundreds of worlds from the community. | C09 | full frame | overlap |
| W15 | 59.28 s | 383 | ✅ | frame | Share your ideas with the community. / Compete with other creators. | C10 | slight crop that keeps the whole podium callout | section |
| W16 | 65.07 s | 350 |  | kinetic | Use any AI model. / Run it fully local, with no extra software to install. | stage only | none | overlap |
| W17 | 70.40 s | 310 |  | frame | Play in your browser or offline on your desktop. | C11 | static crop on the engine panel | overlap |
| W19 | 75.07 s | 376 |  | title | wordmark, then its pop · AI text RPG · Play free at formamorph.ai | C01 and C02b on two depth cards | full frames; everything holds to the last frame | end |

Total: **4,880 frames, 81.33 s**, under the 90 s target. W01, W02 and W18 are cut (Q30, Q40, Q60). The authoring order is map, profile, travel, the traits card, blueprints (Q43). A title card with the letter `a` sits before the shot it introduces (W12a, W13a).

**Camera (Q22, Q32):** no card zooms or pans. Each card holds one crop for its whole shot; the card's spring, bob and exit drift are the motion.

**Subject (Q38, Q39):** each capture has a subject region, the part that carries its point. The render check fails a shot whose subject leaves the card's crop, or sits under a caption pill or panel, on any frame.

**Opening card (Q49, Q53, Q55):** the wordmark coalesces from goo blobs, as the app's first-run intro does, in the wordmark's white and gradient. Once the letters settle, the blobs shrink away, outer ones first, and leave the crisp letters. The letters hold, then leave before frame 359.

**End card (Q37, Q59):** the wordmark springs in. Then F, o, r, m and a each grow and shrink back in turn, one beat each, and "morph" does the same as one unit, a little larger. Every glyph settles at its normal size. The tagline and the call to action enter after the pop. The call to action is a pill with no dot. "formamorph.ai" is in the accent color.

**Dense cards (Q48):** a card whose subject holds more than one thing the eye must find is marked ✅ in the Dense column. It holds at least 5 s after it lands, and the render check fails one that holds less. The contest podium is the one dense card.

**Text (Q25):** each line takes 0.5 s to enter and 0.5 s to leave on a gentle curve, then holds at least 1.5 s (Q17).

**Typed panel (Q54):** in W05 and T05 the panel enters on the clip frame that shows the first narration word. The capture measures that frame and writes it as `firstWord` beside each clip in `marketing/trailer/captures.json`; both clips show it on frame 2. The player line types in from there, then the caption enters.

---

## 3. The microtrailer loop (0–6 s)

Steam cuts its looping microtrailer from the first 6 seconds of the first trailer. Frames 0–359 are built to loop on their own.

```
frame 0 ─────────────────────────────── 359 │ 360
stage   goo coalesces, dissolves into   stage │ W04
        the letters, holds, leaves      (same as │
                                        frame 0) │
```

- **Seam:** frame 0 and frame 359 both show the bare blob stage, with no card and no text. The blobs repeat every 359 frames, so the two frames match and the loop has no visible jump (Q28).
- **One shot:** the title card W03 is the whole loop (Q40, Q51, Q55). The goo coalesces, dissolves into the crisp letters, holds and leaves over the stage, so the 360-frame block is exact.
- **Frame 360:** W04's card springs in over the same stage with a cut, so the full trailer also runs on without a jump.
- **Message in 6 s:** the name. W04 says what the app is right after.

---

## 4. Tall cut (9:16)

Derived shot by shot from the wide cut. Four treatments:

| Treatment | Meaning |
|---|---|
| **relayout** | Kinetic and title scenes place their own content for `tall` (spec scene model). |
| **crop** | The card fills the width and shows a 3:4 window of the wide capture. |
| **stack** | Two wide captures on two cards, one above the other. Both caption pills show. |
| **recapture** | A native 540x960 capture at scale 2 (1080x1920) in the app's mobile layout, on the card above the typed panel. |

| Tall | Start | From | Frames | Dense | Treatment | Notes | Out |
|---|---|---|---|---|---|---|---|
| T03 | 0.00 s | W03 | 360 |  | relayout | The whole loop, as in the wide cut. | cut |
| T04 | 6.00 s | W04 | 300 |  | crop | Window on the center tile column. | section |
| T05 | 10.40 s | W05 | 360 |  | recapture | C02c-tall, the reveal clip, on the top part of the mobile view. | overlap |
| T06 | 15.90 s | W06 + W07 | 240 |  | stack | Stat bars above, static crop. Entity card below, static crop. | overlap |
| T07 | 19.40 s | W08 | 242 |  | crop | The chat column, on a squarer card so the whole column fits. | section |
| T08 | 22.83 s | W09 | 175 |  | relayout |  | overlap |
| T09 | 25.25 s | W10 | 240 |  | crop | The whole map, on a card at the stack cards' shape. | overlap |
| T10 | 28.75 s | W11 + W10b | 290 |  | stack | Entity profile above, travel dialog below. Both hold. | overlap |
| T10a | 33.08 s | W12a | 212 |  | relayout |  | overlap |
| T10b | 36.12 s | W12 | 311 |  | crop | Window on the Blueprint list. | section |
| T11 | 40.70 s | W14 + W15 | 403 | ✅ | stack | World grid above, podium below. Both hold. | section |
| T12 | 46.82 s | W16 | 160 |  | relayout | "Use any AI model." alone: the second line does not hold on mobile (Q58). | overlap |
| T13 | 48.98 s | W17 | 310 |  | crop | The engine panel, on a squarer card. | overlap |
| T14 | 53.65 s | W19 | 376 |  | relayout |  | end |

**Dropped:** W01 and W02 (Q30, Q40), Morphie with its title card (W13a, W13); the avatar (W18) left both cuts (Q60). Total: **3,595 frames, 59.92 s**, under the 60 s that every social platform accepts.

**Authoring order (Q43, Q51):** the traits card parts the Blueprint shot from the rest, so the map stands alone, the profile and the travel shot stack as a pair, and the Blueprint shot stands alone after the card.

Every crop window, stack card and recapture holds one crop for the whole shot (Q32).

The tall cut shares the scene set with the wide cut, not its timeline.

> 💡 Why recapture the gameplay shots: a 9:16 crop of a 1600x900 capture is about 500 CSS px wide. That cuts the narration column mid-line. The mobile layout is the real product on a vertical screen.

---

## 5. Capture list

Format per ruling Q8: the spec's field list. Ticket 05 copies these rows into ticket 02's capture list.

| ID | View | Modal / tab | Theme | Scale | Viewport | World | Seed / fixture |
|---|---|---|---|---|---|---|---|
| C01 | mainMenu | tab `worlds` | graphite dark | 2 | 1600x900 | the eight default worlds in the library | none |
| C02b | gameViewer | mode `pages`, after the turn | graphite dark | 2 | 1600x900 | Drone | [site-game.json](../../../scripts/fixtures/site-game.json): action, narration, choices, stat changes |
| C02c | gameViewer | mode `pages`, a clip of the turn: the screen before it, then the live narration reveal | graphite dark | 2 | 1600x900 | Drone | site-game.json: opening only, the narration from a canned reply |
| C02b-tall | gameViewer | as C02b | graphite dark | 2 | 540x960 | Drone | as C02b |
| C02c-tall | gameViewer | as C02c | graphite dark | 2 | 540x960 | Drone | as C02c |
| C03 | gameViewer | tab `entities`, Tiamat open | graphite dark | 2 | 1600x900 | Drone | site-game.json |
| C04 | gameViewer | mode `chat` | graphite dark | 2 | 1600x900 | Brinewell, the Authoring Tour's world, built from the tour's own code (Q42) | [trailer-chat.json](../../../scripts/fixtures/trailer-chat.json): three exchanges with Maren at the Tidewell |
| C05 | — | modal `worldEditor`, tab `locations`, subtab `canvas`, after **Auto Arrange All** | graphite dark | 2 | 1600x900 | Veilwood | travel-rule labels hidden (below) |
| C06 | — | modal `worldEditor`, tab `entities`, subtab `profile` | graphite dark | 2 | 1600x900 | Veilwood | an entity with art selected |
| C07 | — | modal `worldEditor`, tab `traits`, subtab `details` | graphite dark | 2 | 1600x900 | Emberwatch | a race Blueprint selected |
| C08 | mainMenu | the help window, a clip: Morphie thinks, then the answer streams in and she turns to idle (Q47) | graphite dark | 2 | 1600x900 | none | a canned answer, held while she thinks for 0.75 s, then streamed at about 12 words a second, on a stepped clock |
| C09 | — | modal `community`, tab `world` | graphite dark | 2 | 1600x900 | none | pinned listing data (see below) |
| C10 | — | modal `community`, the **Contest** tab, podium | graphite dark | 2 | 1600x900 | none | pinned listing data and one decided contest, so each world has one badge |
| C11 | — | modal `settings`, tab `endpoints`, subtab `text`, **Built-In Engine** | graphite dark | 2 | 1600x900 | none | a mocked desktop bridge with a model loaded and ready (below) |
| C12 | — | modal `avatar` | graphite dark | 2 | 1600x900 | none | deferred (Q60): the default avatar, a clip of the idle animation on a stepped clock |
| C13 | gameViewer | the **Change Location** dialog, from the **Location** tab | graphite dark | 2 | 1600x900 | Drone | site-game.json |

**Capture risks for tickets 02 and 05**

- C08 calls the help AI. [captureSiteShots.mjs](../../../scripts/captureSiteShots.mjs) uses the live endpoint for its help shot, so the answer drifts. C08 needs a canned answer.
- C09 reads live server data. The listings change between runs, so the drift guard fires on every capture. It needs a route mock or a recorded response. C10 is already deterministic: the dev-router's `tab=contest` serves canned contests.
- C02c films a live turn. The narration lands on real network time, so the page clock pauses first, and each animation the reveal starts is seeked to that clock. A second run gives the same clip.
- C03 uses Tiamat, the one Drone entity with art (checked 2026-10-08).
- C05: the editor has no switch for the travel-rule labels on the canvas, so the capture hides them through the page (`.react-flow__edgelabel-renderer`).
- C11: the engine panel needs the Electron shell, which the dev-router capture does not run. The capture mocks the desktop bridge with a model already loaded and ready, so nothing loads or downloads.
- C12 renders WebGL. It needs the title card's frozen-time approach to be deterministic.

---

## 6. Copy check

Every line above is written for the copy sweep in ticket 07.

- **STE:** one idea per line, active voice, common words, no metaphor. The longest lines (W13, W16) have 10 words.
- **Positive contract:** each line says what you can do. No line names a rival or a missing feature.
- **Terms:** no line says "character". W07, W08, W11 and W12 avoid the noun with "anyone", "who" and "everyone". "Blueprint" stays off screen because new players do not know the term.
- **Claims to verify before the final render:** "hundreds of worlds" (W14) matches the landing page. Ticket 07 checks the live count.
- **For the copy sweep:** W04 says "AI text RPG" and the end card says "AI text roleplay". W05 says "Type". Ticket 07 picks one term for each pair.

---

## 7. Rulings

The user approved this storyboard on 2026-10-08. The rulings are Q9–Q13 in the [spec](spec.md).
