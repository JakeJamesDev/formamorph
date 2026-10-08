# Trailer storyboard

Parent: [Trailer spec](spec.md) · Ticket: [03 Storyboard](issues/03-storyboard.md)

**At a glance**

| Cut | Size | Length | Shots |
|---|---|---|---|
| Wide (Steam) | 1920x1080, 60 fps | 63.05 s (3,783 frames) | 19 |
| Tall (social) | 1080x1920, 60 fps | 47.80 s (2,868 frames) | 14 |

The first 6 seconds (frames 0–359) are a standalone silent loop in both cuts.

---

## 1. Feature list

Ranked by what sells the app to a Steam visitor who reads the copy without sound. Sources: the landing page tagline ([hosting/index.html](../../../hosting/index.html)) and [docs/Changelog.md](../../../docs/Changelog.md).

| Rank | Feature | Source | Shots | Pick |
|---|---|---|---|---|
| 1 | Type any action, an AI narrator writes what happens | Landing, 2.0 | W01–W02, W05 | ✅ |
| 2 | Play authored worlds: the bundled set and the library | Landing, 2.15 | W04 | ✅ |
| 3 | Build your own world: map canvas, entities, stats | Landing, 2.11, 2.13 | W09–W11 | ✅ |
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

**Look:** graphite palette, dark theme, every frame (matches the title card). Kinetic text uses Lexend in the Design System's type roles.

**Scene types** (ticket 04): `kinetic` text card · `frame` camera over a captured PNG · `typed` prompt-then-narration · `title` card (ticket 01).

**Transitions:** `fade` (15 f) inside a section, `wipe` (18 f) between sections, `cut` (0 f) inside the loop. A transition overlaps the end of its shot, so a shot's start is the previous start plus its duration minus its outgoing transition.

| Shot | Start | Frames | Type | Copy | Source frame | Camera | Out |
|---|---|---|---|---|---|---|---|
| W01 | 0.00 s | 120 | kinetic | Type any action. | C01 blurred (plate) | still | cut |
| W02 | 2.00 s | 180 | typed | An AI narrator writes what happens. | C02a → C02b | push toward the input, then the narration | cut |
| W03 | 5.00 s | 60 | title | wordmark only | C01 blurred (plate) | still; ends on the bare plate | cut |
| W04 | 6.00 s | 300 | frame | An AI text RPG. / Play any world you can imagine. | C01 | slow pan across the world tiles | wipe |
| W05 | 10.70 s | 360 | typed | Write any action. / The narrator continues the story. | C02a → C02b | zoom from the input up to the narration | fade |
| W06 | 16.45 s | 210 | frame | Every turn updates your stats. | C02b | zoom to the stat bars | fade |
| W07 | 19.70 s | 210 | frame | Talk to anyone you meet. | C03 | zoom to the entity card and its art | fade |
| W08 | 22.95 s | 210 | frame | Chat with anyone in your library. | C04 | push in on the chat column | wipe |
| W09 | 26.15 s | 120 | kinetic | Build your own world. | C05 blurred (plate) | still | fade |
| W10 | 27.90 s | 240 | frame | Place locations on a map. | C05 | pan across the map canvas | fade |
| W11 | 31.65 s | 240 | frame | Write who lives there. | C06 | zoom to the entity profile | fade |
| W12 | 35.40 s | 240 | frame | Let players pick a race and a class. | C07 | pan across the Blueprint list | fade |
| W13 | 39.15 s | 210 | frame | Ask Morphie for help at any step. | C08 | push in on the help window | wipe |
| W14 | 42.35 s | 240 | frame | Download hundreds of worlds from the community. | C09 | slow pan down the world grid | fade |
| W15 | 46.10 s | 180 | frame | Enter contests. Share what you make. | C10 | zoom to the podium | wipe |
| W16 | 48.80 s | 120 | kinetic | Use any AI model. | C11 blurred (plate) | still | fade |
| W17 | 50.55 s | 240 | frame | Play in your browser or offline on your desktop. | C11 | pan across the endpoint form | fade |
| W18 | 54.30 s | 180 | frame | Pick a 3D avatar. | C12 | slow push on the avatar | fade |
| W19 | 57.05 s | 360 | title | wordmark · AI text roleplay · formamorph.ai | title card stage | still, wordmark settles | end |

Total: **3,783 frames, 63.05 s**, under the 90 s target.

---

## 3. The microtrailer loop (0–6 s)

Steam cuts its looping microtrailer from the first 6 seconds of the first trailer. Frames 0–359 are built to loop on their own.

```
frame 0 ──── 120 ──────────── 300 ──── 359 │ 360
plate        game frame        wordmark   plate │ W04
"Type any    types, narration   lands,     (same as │
 action."    streams in         dissolves  frame 0) │
```

- **Seam:** frame 0 and frame 359 both show the bare blurred library plate (C01), with no text. The loop has no visible jump.
- **No cross-scene transition inside the loop.** Each shot fades its own content in and out over the plate, so the 360-frame block is exact.
- **Frame 360:** W04 starts from that same plate with a cut, so the full trailer also runs on without a jump.
- **Message in 6 s:** the action (W01), the result (W02), the name (W03). A viewer of the loop alone gets what the app does and what it is called.

---

## 4. Tall cut (9:16)

Derived shot by shot from the wide cut. Four treatments:

| Treatment | Meaning |
|---|---|
| **relayout** | Kinetic and title scenes place their own content for `tall` (spec scene model). |
| **crop** | The frame camera follows a 9:16 window inside the wide capture. |
| **stack** | Two wide captures, each cropped to 1080x960, one above the other. Both lines of copy show. |
| **recapture** | A native 540x960 capture at scale 2 (1080x1920) in the app's mobile layout. |

| Tall | Start | From | Frames | Treatment | Notes | Out |
|---|---|---|---|---|---|---|
| T01 | 0.00 s | W01 | 120 | relayout | | cut |
| T02 | 2.00 s | W02 | 180 | recapture | C02a-tall → C02b-tall. Narration stays readable. | cut |
| T03 | 5.00 s | W03 | 60 | relayout | Loop seam as in the wide cut. | cut |
| T04 | 6.00 s | W04 | 300 | crop | Window on the center tile column. | wipe |
| T05 | 10.70 s | W05 | 360 | recapture | C02a-tall → C02b-tall. | fade |
| T06 | 16.45 s | W06 + W07 | 240 | stack | Stat bars above, entity card below. | fade |
| T07 | 20.20 s | W08 | 210 | crop | The chat column is already narrow. | wipe |
| T08 | 23.40 s | W09 | 120 | relayout | | fade |
| T09 | 25.15 s | W10 | 240 | crop | Window on the map center. | fade |
| T10 | 28.90 s | W11 + W12 | 240 | stack | Entity profile above, Blueprint list below. | wipe |
| T11 | 32.60 s | W14 + W15 | 240 | stack | World grid above, podium below. | wipe |
| T12 | 36.30 s | W16 | 120 | relayout | | fade |
| T13 | 38.05 s | W17 | 240 | crop | Window on the endpoint form. | fade |
| T14 | 41.80 s | W19 | 360 | relayout | | end |

**Dropped:** W13 (Morphie) and W18 (avatar). Total: **2,868 frames, 47.80 s**, under the 60 s that every social platform accepts.

The tall cut shares the scene set with the wide cut, not its timeline.

> 💡 Why recapture the gameplay shots: a 9:16 crop of a 1600x900 capture is about 500 CSS px wide. That cuts the narration column mid-line. The mobile layout is the real product on a vertical screen.

---

## 5. Capture list

Format per ruling Q8: the spec's field list. Ticket 05 copies these rows into ticket 02's capture list.

| ID | View | Modal / tab | Theme | Scale | Viewport | World | Seed / fixture |
|---|---|---|---|---|---|---|---|
| C01 | mainMenu | tab `worlds` | graphite dark | 2 | 1600x900 | the eight default worlds in the library | none |
| C02a | gameViewer | mode `pages`, before the turn | graphite dark | 2 | 1600x900 | Drone | [site-game.json](../../../scripts/fixtures/site-game.json): opening only |
| C02b | gameViewer | mode `pages`, after the turn | graphite dark | 2 | 1600x900 | Drone | site-game.json: action, narration, choices, stat changes |
| C02a-tall | gameViewer | as C02a | graphite dark | 2 | 540x960 | Drone | as C02a |
| C02b-tall | gameViewer | as C02b | graphite dark | 2 | 540x960 | Drone | as C02b |
| C03 | gameViewer | tab `entities`, Tiamat open | graphite dark | 2 | 1600x900 | Drone | site-game.json |
| C04 | gameViewer | mode `chat` | graphite dark | 2 | 1600x900 | Open Chat | new fixture: three exchanges with one library entity |
| C05 | — | modal `worldEditor`, tab `locations`, subtab `canvas` | graphite dark | 2 | 1600x900 | Veilwood | none |
| C06 | — | modal `worldEditor`, tab `entities`, subtab `profile` | graphite dark | 2 | 1600x900 | Veilwood | an entity with art selected |
| C07 | — | modal `worldEditor`, tab `traits`, subtab `details` | graphite dark | 2 | 1600x900 | Emberwatch | a race Blueprint selected |
| C08 | — | modal `formaquestion`, tab `ask`, mode `narrow` | graphite dark | 2 | 1600x900 | none | new fixture: one answered question |
| C09 | — | modal `community`, tab `world` | graphite dark | 2 | 1600x900 | none | pinned listing data (see below) |
| C10 | — | modal `community`, tab `contest`, podium | graphite dark | 2 | 1600x900 | none | pinned listing data (see below) |
| C11 | — | modal `settings`, tab `endpoints`, subtab `text` | graphite dark | 2 | 1600x900 | none | the default endpoint preset |
| C12 | — | modal `avatar` | graphite dark | 2 | 1600x900 | none | the default avatar, frozen pose as in the title card |

**Capture risks for tickets 02 and 05**

- C08 calls the help AI. [captureSiteShots.mjs](../../../scripts/captureSiteShots.mjs) uses the live endpoint for its help shot, so the answer drifts. C08 needs a canned answer.
- C09 reads live server data. The listings change between runs, so the drift guard fires on every capture. It needs a route mock or a recorded response. C10 is already deterministic: the dev-router's `tab=contest` serves canned contests.
- C02a and C02a-tall have no existing pose. `captureSiteShots.mjs` poses only the state after the turn.
- C03 uses Tiamat, the one Drone entity with art (checked 2026-10-08).
- W17's "offline on your desktop" copy sits over the web endpoint form. The desktop engine panel needs the Electron shell, which the dev-router capture does not run.
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
