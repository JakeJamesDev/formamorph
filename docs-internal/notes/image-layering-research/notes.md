# Image Layering: Research

Status: needs-triage

Research for layered images: several images drawn as one picture, each part driven by game state. It is the input for a grill, not a spec.

## 🧭 Where we start

- Entities, locations, items and the Map Background each hold an ordered gallery of Media List images.
- Each image can carry a **Visibility rule** (Requirement Rows). In play, the **first visible image wins**.
- A script override shows first (`src/lib/imageVisibility.ts`).
- Gap: an outfit × expression × wound cast needs one full image per combination.

## 🟢 Easy-to-author systems

| System | Model | Praised | Complaints |
|---|---|---|---|
| **Ren'Py `layeredimage`** | `always` layers; `group` = one-of attributes with a `default`; `if/elif` picks by game state, first true wins | "Groups are slots, attributes are flags" | No default → blank sprite; conflicting-attribute errors; drift from per-layer zoom and mixed canvas sizes |
| **TyranoScript** `chara_layer` | Part (eyes, mouth) → variants; first variant is the default; z-index per part | Simple swaps of several parts at once | No conditions |
| **Picrew** | Parts → layers → items × colors on one fixed canvas; one part can span front and back layers | Palettes recolor linked parts | Every color is its own image: items × layers × colors |
| **SillyTavern expressions** | One whole sprite per emotion; costume = folder swap | Zero setup | No layering, so outfit × emotion explodes |
| **RPG Maker MZ generator** | Numbered part files per category, gradient hue | Quick | Brittle file naming |
| **Twine / SugarCube** | Hand-written stacked `<img>` with z-index | Flexible | Hair over clothing is hard |

## 🔴 Powerful systems

| System | Model | Pain |
|---|---|---|
| **Spine** | Slot shows one attachment or none; slot list = draw order; **skins** map slots to attachments and combine at runtime; tint, two-color tint, 4 blend modes | Draw order is per slot, so hair needs front and back slots; clipping is CPU-costly |
| **Live2D / Inochi2D** | PSD-first; one layer = one part; draw order 0–1000; clipping masks by ID; multiply/screen color | PSD masks must be applied, blend modes import wrong |
| **Unity Sprite Library** | Category → Label → Sprite; a Resolver picks per renderer; **Variants** inherit and override labels | PSD importer drops blend modes |
| **Photoshop layer comps** | Saved visibility, position, appearance sets | Break on reorder; don't nest through smart objects |
| **RimWorld apparel** | Fixed semantic layers; hats hide hair by a flag | No "above hair, under hat" |
| **CSS** | `mask-image` is Baseline since Dec 2023; blend modes and filters exist | Each full-size layer costs a decoded bitmap (w × h × 4 bytes) |

## 🔁 What every system shares

1. **A slot shows exactly one variant, or none.** This is the core idea everywhere.
2. **Each slot has a default.** A missing default is Ren'Py's top complaint.
3. **Selection by condition, first match wins.** This is our Visibility rule already.
4. **One shared canvas.** Offsets and anchors are where drift bugs start.
5. **Draw order belongs to the slot, not the variant.** The universal fix for hair and hats is two slots: Hair (Back) and Hair (Front).

## ⚖️ Middle ground

**Take (cheap, high value):**

- 🧱 **Layers** with one-of semantics, ordered bottom to top.
- 🖼️ Each layer holds variants from the Media List. Each variant keeps today's Visibility rule. First visible wins. A layer can show nothing.
- 📐 **One canvas.** Every variant draws at the base layer's size. The editor warns on a size mismatch.
- 🌫️ **Per-layer opacity.**
- 📜 **Script control** per layer, through the same override model scripts use for images today.

**Leave for later (power-tier pain):**

- Per-variant draw order, clipping masks, offsets and anchors, blend modes.
- Per-layer tint (Picrew shows the demand; Live2D artists prefer hand-drawn recolors).
- PSD import. No official Ren'Py importer exists. A layer-group → layer, layer → variant mapping is possible later.

**Performance:** 5–8 full-size layers per entity should be fine on desktop. Mobile is unmeasured. Flattening the active stack to one bitmap, cached by the stack's state, is the fallback.

## ❓ Open questions for the grill

- Is a layered image one gallery entry beside plain images, or does it replace the gallery?
- Which subjects get layers first: entities only, or locations too (weather, time of day)?
- What shows outside play (library, cards, listings): each layer's first variant?
- Does an image sent to the AI go flattened?
- Does a layered image live on the Media List as a reusable entry, so two entities can share one rig?

## 🔗 Sources

- Ren'Py: https://www.renpy.org/doc/html/layeredimage.html
- TyranoScript: https://tyrano.jp/tag/
- Picrew: https://support.picrew.me/en/?p=1640
- SillyTavern: https://docs.sillytavern.app/extensions/expression-images/
- RPG Maker MZ: https://rpgmakerofficial.com/product/MZ_help-en/01_01_01_05.html
- SugarCube: https://twinery.org/questions/962/how-can-we-layer-images-in-sugarcube-2-18
- Spine: https://esotericsoftware.com/spine-skins · https://en.esotericsoftware.com/forum/d/9634
- Live2D: https://docs.live2d.com/en/cubism-editor-manual/psd-import
- Unity: https://docs.unity3d.com/Packages/com.unity.2d.animation@10.1/manual/SL-Resolver.html
- RimWorld: https://rimworldwiki.com/wiki/Apparel_layers
- CSS masks: https://developer.mozilla.org/en-US/docs/Web/CSS/mask-image
- Compositor cost: https://web.dev/stick-to-compositor-only-properties-and-manage-layer-count/
