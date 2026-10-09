# Trailer storyboard

Parent: [Trailer spec](spec.md) · Ticket: [03 Storyboard](issues/03-storyboard.md)

**At a glance**

| Cut | Size | Length | Shots |
|---|---|---|---|
| Wide (Steam) | 1920x1080, 60 fps | 68.45 s (4,107 frames) | 19 |
| Tall (social) | 1080x1920, 60 fps | 51.03 s (3,062 frames) | 13 |

The first 6 seconds (frames 0–359) are a standalone silent loop in both cuts.

---

## 1. Feature list

Ranked by what sells the app to a Steam visitor who reads the copy without sound. Sources: the landing page tagline ([hosting/index.html](../../../hosting/index.html)) and [docs/Changelog.md](../../../docs/Changelog.md).

| Rank | Feature | Source | Shots | Pick |
|---|---|---|---|---|
| 1 | Type any action, an AI narrator writes what happens | Landing, 2.0 | W01, W05 | ✅ |
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
| 12 | 3D VRM avatars | 2.5, 2.18 | W18 | ✅ |
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

| Shot | Start | Frames | Type | Copy | Source frame | Camera | Out |
|---|---|---|---|---|---|---|---|
| W01 | 0.00 s | 150 | kinetic | Type any action. | stage only | none | cut |
| W03 | 2.50 s | 210 | title | wordmark only | stage only | none; ends on the bare stage | cut |
| W04 | 6.00 s | 300 | frame | An AI text RPG. / Play any world you can imagine. | C01 | full frame | section |
| W05 | 10.40 s | 360 | turn | Type any action. / The narrator continues the story. | C02c, a clip of the live narration reveal | static crop on the narration | overlap |
| W06 | 15.90 s | 220 | frame | Every turn updates your stats. | C02b, as a clip of the live stat-bar animation | static crop on the stat bars | overlap |
| W07 | 19.07 s | 210 | frame | Talk to anyone you meet. | C03 | static crop on the entity card | overlap |
| W08 | 22.07 s | 242 | frame | Chat with anyone in your library. | C04 | full frame | section |
| W09 | 25.50 s | 175 | kinetic | Build your own world. | stage only | none | overlap |
| W10 | 27.92 s | 240 | frame | Place locations on a map. | C05 | full frame | overlap |
| W10b | 31.42 s | 270 | frame | Travel there and meet who lives there. | C13 | static crop on the dialog | overlap |
| W11 | 35.42 s | 240 | frame | Write who lives there. | C06 | static crop on the entity profile | overlap |
| W12 | 38.92 s | 250 | frame | Let players pick a race and a class. | C07 | full frame | overlap |
| W13 | 42.58 s | 242 | frame | Ask Morphie for help at any step. | C08 | static crop on the help answer | section |
| W14 | 46.02 s | 305 | frame | Download hundreds of worlds from the community. | C09 | full frame | overlap |
| W15 | 50.60 s | 187 | frame | Enter contests. Share what you make. | C10 | slight crop that keeps the whole podium callout | section |
| W16 | 53.12 s | 160 | kinetic | Use any AI model. | stage only | none | overlap |
| W17 | 55.28 s | 310 | frame | Play in your browser or offline on your desktop. | C11 | static crop on the engine panel | overlap |
| W18 | 59.95 s | 180 | frame | Pick a 3D avatar. | C12, as a clip of the idle animation | full frame | overlap |
| W19 | 62.45 s | 360 | title | wordmark · AI text RPG · Play free at formamorph.ai | C01 and C02b on two depth cards | full frames; everything holds to the last frame | end |

Total: **4,107 frames, 68.45 s**, under the 90 s target. W02 is cut (Q30); W10b is the travel shot (Q34).

**Camera (Q22, Q32):** no card zooms or pans. Each card holds one crop for its whole shot; the card's spring, bob and exit drift are the motion.

**Subject (Q38, Q39):** each capture has a subject region, the part that carries its point. The render check fails a shot whose subject leaves the card's crop, or sits under a caption pill or panel, on any frame.

**End card (Q37):** the call to action is a pill with no dot. "formamorph.ai" is in the accent color.

**Text (Q25):** each line takes 0.5 s to enter and 0.5 s to leave on a gentle curve, then holds at least 1.5 s (Q17).

---

## 3. The microtrailer loop (0–6 s)

Steam cuts its looping microtrailer from the first 6 seconds of the first trailer. Frames 0–359 are built to loop on their own.

```
frame 0 ──── 150 ───────────────────── 359 │ 360
stage        wordmark springs in,      stage │ W04
"Type any    holds about 2.5 s,        (same as │
 action."    leaves                    frame 0) │
```

- **Seam:** frame 0 and frame 359 both show the bare blob stage, with no card and no text. The blobs repeat every 359 frames, so the two frames match and the loop has no visible jump (Q28).
- **No cross-scene join inside the loop.** Each shot brings its own content in and out over the stage, so the 360-frame block is exact.
- **Frame 360:** W04's card springs in over the same stage with a cut, so the full trailer also runs on without a jump.
- **Message in 6 s:** the action (W01), then the name (W03) (Q30). A viewer of the loop alone gets what the player does and what the app is called.

---

## 4. Tall cut (9:16)

Derived shot by shot from the wide cut. Four treatments:

| Treatment | Meaning |
|---|---|
| **relayout** | Kinetic and title scenes place their own content for `tall` (spec scene model). |
| **crop** | The card fills the width and shows a 3:4 window of the wide capture. |
| **stack** | Two wide captures on two cards, one above the other. Both caption pills show. |
| **recapture** | A native 540x960 capture at scale 2 (1080x1920) in the app's mobile layout, on the card above the typed panel. |

| Tall | Start | From | Frames | Treatment | Notes | Out |
|---|---|---|---|---|---|---|
| T01 | 0.00 s | W01 | 150 | relayout | | cut |
| T03 | 2.50 s | W03 | 210 | relayout | Loop seam as in the wide cut. | cut |
| T04 | 6.00 s | W04 | 300 | crop | Window on the center tile column. | section |
| T05 | 10.40 s | W05 | 360 | recapture | C02c-tall, the reveal clip, on the top part of the mobile view. | overlap |
| T06 | 15.90 s | W06 + W07 | 240 | stack | Stat bars above, static crop. Entity card below, static crop. | overlap |
| T07 | 19.40 s | W08 | 242 | crop | The chat column, on a squarer card so the whole column fits. | section |
| T08 | 22.83 s | W09 | 175 | relayout | | overlap |
| T09 | 25.25 s | W10 + W10b | 290 | stack | Map above, travel dialog below. Both hold. | overlap |
| T10 | 29.58 s | W11 + W12 | 277 | stack | Entity profile above, Blueprint list below. Both hold. | section |
| T11 | 33.60 s | W14 + W15 | 312 | stack | World grid above, podium below. Both hold. | section |
| T12 | 38.20 s | W16 | 160 | relayout | | overlap |
| T13 | 40.37 s | W17 | 310 | crop | The engine panel, on a squarer card. | overlap |
| T14 | 45.03 s | W19 | 360 | relayout | | end |

**Dropped:** W02 (Q30), W13 (Morphie) and W18 (avatar). Total: **3,062 frames, 51.03 s**, under the 60 s that every social platform accepts.

**Travel (Q34):** the tall cut stacks the travel shot under the map, as it stacks the other adjacent pairs, so the cut gains no shot.

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
| C04 | gameViewer | mode `chat` | graphite dark | 2 | 1600x900 | Open Chat | new fixture: three exchanges with one library entity |
| C05 | — | modal `worldEditor`, tab `locations`, subtab `canvas`, after **Auto Arrange All** | graphite dark | 2 | 1600x900 | Veilwood | travel-rule labels hidden (below) |
| C06 | — | modal `worldEditor`, tab `entities`, subtab `profile` | graphite dark | 2 | 1600x900 | Veilwood | an entity with art selected |
| C07 | — | modal `worldEditor`, tab `traits`, subtab `details` | graphite dark | 2 | 1600x900 | Emberwatch | a race Blueprint selected |
| C08 | — | modal `formaquestion`, tab `ask`, mode `narrow` | graphite dark | 2 | 1600x900 | none | new fixture: one answered question |
| C09 | — | modal `community`, tab `world` | graphite dark | 2 | 1600x900 | none | pinned listing data (see below) |
| C10 | — | modal `community`, the **Contest** tab, podium | graphite dark | 2 | 1600x900 | none | pinned listing data and one decided contest, so each world has one badge |
| C11 | — | modal `settings`, tab `endpoints`, subtab `text`, **Built-In Engine** | graphite dark | 2 | 1600x900 | none | a mocked desktop bridge with a model loaded and ready (below) |
| C12 | — | modal `avatar` | graphite dark | 2 | 1600x900 | none | the default avatar, a clip of the idle animation on a stepped clock |
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

- **STE:** one idea per line, active voice, common words, no metaphor. The longest line (W17) has 9 words.
- **Positive contract:** each line says what you can do. No line names a rival or a missing feature.
- **Terms:** no line says "character". W07, W08 and W11 avoid the noun with "anyone" and "who". "Blueprint" stays off screen because new players do not know the term; W12 says "race and class".
- **Claims to verify before the final render:** "hundreds of worlds" (W14) matches the landing page. Ticket 07 checks the live count.
- **For the copy sweep:** W04 says "AI text RPG" and the end card says "AI text roleplay". W01 says "Type" and W05 says "Write". Ticket 07 picks one term for each pair.

---

## 7. Rulings

The user approved this storyboard on 2026-10-08. The rulings are Q9–Q13 in the [spec](spec.md).
