# Trailer storyboard

Parent: [Trailer spec](spec.md) · Ticket: [03 Storyboard](issues/03-storyboard.md)

**At a glance**

| Cut | Size | Length | Shots |
|---|---|---|---|
| Wide (Steam) | 1920x1080, 60 fps | 64.45 s (3,867 frames) | 19 |
| Tall (social) | 1080x1920, 60 fps | 50.20 s (3,012 frames) | 14 |

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

**Transitions:** `fade` (30 f) inside a section, `wipe` (36 f) between sections, `cut` (0 f) inside the loop. A transition overlaps the end of its shot, so a shot's start is the previous start plus its duration minus its outgoing transition.

| Shot | Start | Frames | Type | Copy | Source frame | Camera | Out |
|---|---|---|---|---|---|---|---|
| W01 | 0.00 s | 150 | kinetic | Type any action. | C01 blurred (plate) | still | cut |
| W02 | 2.50 s | 150 | typed | The AI narrates. | C02a → C02b | full frame, drift up | cut |
| W03 | 5.00 s | 60 | title | wordmark only | C01 blurred (plate) | still; ends on the bare plate | cut |
| W04 | 6.00 s | 300 | frame | An AI text RPG. / Play any world you can imagine. | C01 | full frame, drift right | wipe |
| W05 | 10.40 s | 360 | typed | Type any action. / The narrator continues the story. | C02a → C02b | full frame, drift up | fade |
| W06 | 15.90 s | 220 | frame | Every turn updates your stats. | C02b, as a clip of the live stat-bar animation | zoom to the stat bars | fade |
| W07 | 19.07 s | 210 | frame | Talk to anyone you meet. | C03 | static crop on the entity card, drift right | fade |
| W08 | 22.07 s | 242 | frame | Chat with anyone in your library. | C04 | full frame, drift down | wipe |
| W09 | 25.50 s | 175 | kinetic | Build your own world. | C05 blurred (plate) | still | fade |
| W10 | 27.92 s | 240 | frame | Place locations on a map. | C05 | full frame, drift right | fade |
| W11 | 31.42 s | 240 | frame | Write who lives there. | C06 | static crop on the entity profile, drift right | fade |
| W12 | 34.92 s | 250 | frame | Let players pick a race and a class. | C07 | full frame, drift down | fade |
| W13 | 38.58 s | 242 | frame | Ask Morphie for help at any step. | C08 | zoom to the help answer | wipe |
| W14 | 42.02 s | 305 | frame | Download hundreds of worlds from the community. | C09 | full frame, drift down | fade |
| W15 | 46.60 s | 187 | frame | Enter contests. Share what you make. | C10 | slight crop that keeps the whole podium callout, drift down | wipe |
| W16 | 49.12 s | 160 | kinetic | Use any AI model. | C11 blurred (plate) | still | fade |
| W17 | 51.28 s | 310 | frame | Play in your browser or offline on your desktop. | C11 | static crop on the model field, drift down | fade |
| W18 | 55.95 s | 180 | frame | Pick a 3D avatar. | C12, as a clip of the idle animation | full frame, drift left | fade |
| W19 | 58.45 s | 360 | title | wordmark · AI text RPG · formamorph.ai | title card stage | backdrop holds one zoom and drifts left; wordmark settles | end |

Total: **3,867 frames, 64.45 s**, under the 90 s target.

**Camera (Q22, Q23, Q26):** every move runs at a constant rate. Only W06 and W13 zoom during the shot. Every other frame shot holds one zoom and drifts about 3% of the frame over its length. A full frame sits at zoom 1.05 so the drift has room.

**Text (Q25):** each line takes 0.5 s to enter and 0.5 s to leave on a gentle curve, then holds at least 1.5 s (Q17).

---

## 3. The microtrailer loop (0–6 s)

Steam cuts its looping microtrailer from the first 6 seconds of the first trailer. Frames 0–359 are built to loop on their own.

```
frame 0 ──── 150 ──────────── 300 ──── 359 │ 360
plate        game frame        wordmark   plate │ W04
"Type any    types, narration   lands,     (same as │
 action."    streams in         dissolves  frame 0) │
```

- **Seam:** frame 0 and frame 359 both show the bare blurred library plate (C01), with no text. The loop has no visible jump.
- **No cross-scene transition inside the loop.** Each shot fades its own content in and out over the plate, so the 360-frame block is exact.
- **Frame 360:** W04 starts from that same plate with a cut, so the full trailer also runs on without a jump. The loop's plate holds at W04's opening zoom and position.
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
| T01 | 0.00 s | W01 | 150 | relayout | | cut |
| T02 | 2.50 s | W02 | 150 | recapture | C02a-tall → C02b-tall. Full frame, drift up. | cut |
| T03 | 5.00 s | W03 | 60 | relayout | Loop seam as in the wide cut. | cut |
| T04 | 6.00 s | W04 | 300 | crop | Window on the center tile column, drift right. | wipe |
| T05 | 10.40 s | W05 | 360 | recapture | C02a-tall → C02b-tall. Full frame, drift up. | fade |
| T06 | 15.90 s | W06 + W07 | 240 | stack | Stat bars above, zooming like W06 (Q26). Entity card below, static crop. | fade |
| T07 | 19.40 s | W08 | 242 | crop | The chat column is already narrow. Drift right. | wipe |
| T08 | 22.83 s | W09 | 175 | relayout | | fade |
| T09 | 25.25 s | W10 | 240 | crop | Window on the map center, drift right. | fade |
| T10 | 28.75 s | W11 + W12 | 277 | stack | Entity profile above, Blueprint list below. Both drift. | wipe |
| T11 | 32.77 s | W14 + W15 | 312 | stack | World grid above, podium below. Both drift. | wipe |
| T12 | 37.37 s | W16 | 160 | relayout | | fade |
| T13 | 39.53 s | W17 | 310 | crop | Window on the model field, drift right. | fade |
| T14 | 44.20 s | W19 | 360 | relayout | | end |

**Dropped:** W13 (Morphie) and W18 (avatar). Total: **3,012 frames, 50.20 s**, under the 60 s that every social platform accepts.

A crop window, a stack pane and a recapture hold one zoom and drift about 3% of their area, except the T06 stats pane.

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
| C12 | — | modal `avatar` | graphite dark | 2 | 1600x900 | none | the default avatar, a clip of the idle animation on a stepped clock |

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
