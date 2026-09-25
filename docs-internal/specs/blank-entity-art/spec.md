# Spec: Blank Entity Art

Status: ready-for-agent
Status note: 5 tickets. Ticket 04 lives in FormamorphServer at `docs-internal/specs/blank-entity-art/issues/04-placeholder-flag-and-backfill.md`. The look was approved from the mock on 2026-09-24.

## Problem Statement

An entity with no picture looks different on every surface, and none of them fits the app:

| Surface | What shows today |
|---|---|
| Library grid | A flat gray box |
| Library detailed view | A **Globe** icon, which is the world icon |
| Community Creations card, details window, profile tabs | A purple silhouette PNG, the same for every entity |
| Exported character card | Initials on a color picked from the name |

Every blank entity looks alike, so a grid of them reads as "missing image" rather than as a set of characters.

The community silhouette has a second problem. At publish time, the server copies its placeholder PNG into the listing's own thumbnail ([worldController.js:512](../../../../FormamorphServer/src/controllers/worldController.js)). The client then cannot tell the placeholder apart from real art.

## Solution

One generated picture, **Morph art**, replaces all four. It is drawn in the browser from a seed, so each entity gets its own picture, and the same entity always gets the same one.

- **The letter.** The entity's first letter, in the app font, made of goo. It tilts 4–9° left or right.
- **Letter drops.** 3–4 round swells on the letter's outermost points. They never reach into a hole or an open mouth, so every letter stays readable.
- **Clusters.** 2–3 separate goo shapes in the open space: a **puddle** (one irregular body) or a **pinch-off** (a body pulling away from a smaller one).
- **Shading.** Each shape is shaded as one body with one gradient, never as the circles that build it.
- **Color.** One of 8 fixed hues, picked from the entity's id, on a background tinted to match. Light and dark themes each have their own lightness.

The server marks a listing published without art with a `placeholder` flag. The client draws Morph art for a flagged listing instead of its stored thumbnail. A one-time backfill flags the listings that already carry the silhouette.

The working mock is [prototype/blank-art.js](prototype/blank-art.js). It is the reference for every value below.

## User Stories

1. As a player browsing Community Creations, I want blank entities to look like distinct characters, so the grid does not read as broken images.
2. As a player, I want a downloaded entity to look the same in my library as on its community card, so I can recognize it.
3. As an author, I want my blank entity to look like it belongs in the app, in light and dark themes, so publishing without art is not a penalty.
4. As an author, I want an exported character card of a blank entity to carry the same picture, so it looks the same wherever it is shared.

## Implementation Decisions

**Seed.** Two seeds, both run through Murmur3's 32-bit finisher before use. Without it, names that start alike ("Slime …") give near-identical first draws, and 10 of 13 letters tilted the same way in the mock.

| Seed source | Decides |
|---|---|
| **Id**: the listing id when there is one (a library record's `sourceId`), else the local entity id | Hue |
| **Name** | Letter, tilt, drops, clusters |

The hue follows the id, so two entities that share a name still differ.

**Letter.** The first letter or number of the name after chips resolve (`describePlaceholders`, as the export card does). Letters are uppercased. A name with no letter or number uses `?`.

**Geometry.** SVG `viewBox` 0 0 200 300, `preserveAspectRatio="xMidYMid slice"`.

| Part | Values |
|---|---|
| Hues | 172, 198, 222, 262, 322, 8, 38, 138. Second hue = first + 22° |
| Background | `hsl(hue 32% L)` → `hsl(hue2 26% L)`, diagonal. L = 19/10 dark, 90/81 light |
| Body / edge color | `hsl(hue 50% 58|60%)` / `hsl(hue2 48% 50|54%)` (dark\|light) |
| Goo filter | `feGaussianBlur stdDeviation 4`, then alpha `× 22 − 9` |
| Letter | App font, weight 800, 118 px, 2 px round stroke, anchored at (100, 236), rotated about (100, 195) |
| Letter drops | 3–4 drops, radius 10–15, at least 40 apart. Only on rim pixels within 6 px of the letter's bounding box. A drop is refused when its radius + 4 covers more than 4 empty pixels inside the letter's convex hull. |
| Clusters | 2–3 per card, dealt from a shuffled `[puddle, split]` deck plus one repeat. Size 0.75–1.25×. Puddle: one lump, R 17. Pinch-off: lumps R 13 and R 8, 19 apart. |
| Lump | 40-point outline, radius wobbled by harmonics 2, 3 and 5, stretched 0.7–1.3× and turned |
| Cluster fit | Every part inside x 8–192, y 96–292 (clear of the name scrim). At least 24 px from the letter and 22 px from other clusters; 16 and 14 after 150 failed tries. |

**Letter mask.** The drops and the cluster fit read the letter's real pixels. The letter is drawn to an offscreen canvas in the same font, size, stroke and tilt. The mask depends on the font, so the art waits for `document.fonts.ready` and redraws when the **Font** setting changes. Masks are cached by letter, font and tilt.

**Shading.** Each shape is drawn in white inside a goo-filtered `<mask>`, and one rectangle fills the mask with a gradient sized to that shape. Filter, mask and gradient ids are unique per instance (`useId`).

**Modules.**

| Module | Job |
|---|---|
| `src/lib/placeholderArt.ts` | Pure generator. Takes the seeds, the letter and a letter-mask reader. Returns the shapes, colors and gradients. No DOM. |
| `src/lib/letterMask.ts` | Draws a letter to a canvas and returns its pixel reader. Caches masks. |
| `EntityPlaceholderArt` component | Renders the SVG. Fills its parent. Used wherever an entity has no picture. |

**Server contract.** A listing carries `placeholder: true` when the server supplied its thumbnail. The flag is set when an entity is published without a thumbnail. It is cleared when an update sends one. The backfill flags existing entity rows whose stored thumbnail matches the placeholder PNG. Details are in ticket 04.

**Export card.** The generated WebP card of a blank entity bakes in Morph art at 480 × 720, in place of the initials image. The art is drawn with the dark-theme colors, so a card does not depend on the theme of the device that made it.

## Testing Decisions

- The generator is pure, so it is tested without a DOM. A synthetic mask stands in for a font.
- Tests assert behavior, never literal SVG strings:
  - the same seeds give the same art
  - the hue follows the id alone
  - 8,000 random ids spread across all 8 hues
  - tilts split both ways
  - no drop reaches into a counter or an open mouth (masks shaped like an O and a C)
  - every cluster part stays inside the frame and clear of the letter
- Each guard is proven by reinstating its bug.
- Surfaces are checked in the preview at real widths, in both themes.

## Out of Scope

- Avatars. The server keeps using the silhouette for them.
- Dictionaries and prompts keep their current art.
- Character cards already exported keep their initials image.
- In-game surfaces. An entity without a picture shows no portrait in play today, and that does not change.

## Further Notes

- **No world or save export-shape change.** The listing gains a server field (`placeholder`), which is an API shape change only.
- The backfill runs against live data. The user runs it after the server deploys.
