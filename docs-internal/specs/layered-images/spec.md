# Spec: Layered Images

Status: ready-for-agent
Spec session: layered-images — spec

## Problem Statement

An entity, location or item shows one whole image at a time: the first image in its gallery whose Visibility rule holds. Art that varies along more than one axis multiplies. A character with 3 outfits, 4 expressions and a wounded state needs 24 full images, and every new outfit means drawing every expression again. A location that should show rain, night or fire over its backdrop needs a full copy for each mix. Authors either give up the variation or describe it in text.

## Solution

A **Layered Image** is a new kind of Media List entry. It stacks **Layers** from bottom to top. Each Layer holds **Variants**, which are plain Media List images, and shows one of them at a time: the first Variant whose Visibility rule holds, or nothing. Any entity gallery slot, location image slot or item image slot links a Layered Image the way it links a plain image. Gallery order and gallery Visibility rules keep working above it.

Each Layer has an opacity, a tint color, a blend mode (Normal, Multiply, Screen, Add) and a transition (None, Dissolve, Jelly) reused from the Mascot. Scripts can set a Layer's Variant, opacity and tint per subject. Authors build Layered Images in the Media tab with a live preview. The Test Bench flags size mismatches and pictures that can go blank. The full rig travels with library entities, publish and character cards.

## Rulings

Settled in the grill, 2026-11-20. Research: `docs-internal/notes/image-layering-research/notes.md`. A ruling reopens on new evidence, never on a new opinion.

| Q | Ruling |
|---|---|
| Q1 | A Layered Image is a Media List entry. Any image slot links it like a plain image, so gallery order, Visibility rules and sharing still work. |
| Q2 | A Layer with no visible Variant shows nothing. |
| Q3 | The bottom Layer sets the canvas. Every Variant draws stretched to it. The editor warns on a size or aspect mismatch. |
| Q4 | First version ships per-Layer opacity, tint and blend mode. PSD import is out. |
| Q5 | Outside play, each Layer shows its first Variant, rules ignored. Flattened to one PNG where a file is needed. |
| Q6 | Slots: entity galleries, location images, item images. Not `player.show` or the Map Background. |
| Q7 | A Variant Condition with no owner reads the showing subject: the entity, the persona for a location, the instance owner for an item. |
| Q8 | Tint is one color per Layer. Scripts can set it per subject. |
| Q9 | Blend modes: Normal, Multiply, Screen, Add. |
| Q10 | Scripts set a Layer's Variant, opacity and tint per subject (per Generic instance, per Item Instance). A set value beats rules until cleared. |
| Q11 | Flat only, no nesting. Expressions work across poses only while every pose keeps the head at the same pixels. |
| Q12 | The full rig travels everywhere: library, publish and character cards. |
| Q13 | Built in the Media tab: Layers bottom to top, the gallery cog rule popover per Variant, a live preview with a Preview As entity picker. |
| Q14 | Scripts name a Layer by its name (unique in the rig) and a Variant by its Media List image name. Renames rewrite scripts. |
| Q15 | Test Bench flags a Variant size or aspect mismatch, a bottom Layer that can be empty, and a rule naming a missing trait or stat. |
| Q16 | Variant changes reuse the Mascot transition: None, Dissolve, Jelly, with the same tuning sliders and ranges. Default Dissolve. |
| Q17 | The transition is set per Layer. Dissolve fades that Layer. Jelly squashes the whole picture. |
| Q18 | Plain image swaps keep their current behavior. |
| Q19 | With reduced motion on, Jelly plays as Dissolve. |
| Q20 | Several Layers change in one commit: one squash, with the topmost changed Jelly Layer's tuning. Dissolve Layers fade during it. |
| Q21 | Words: Layered Image, Layer, Variant. |
| Q22 | The Mascot keeps its own "layer" (one named look). The glossary scopes the two meanings by context. No Mascot copy changes. |

## User Stories

**Authoring the rig**

1. As a world author, I want to create a Layered Image from the Media tab, so that I can build a character's picture from parts.
2. As a world author, I want to name a Layered Image like any Media List entry, so that slots and scripts can find it.
3. As a world author, I want to add, rename, reorder and delete Layers, so that I control what draws over what.
4. As a world author, I want Layer names unique within one Layered Image, so that a script name always means one Layer.
5. As a world author, I want to add Variants to a Layer by picking or importing Media List images, so that I reuse art I already have.
6. As a world author, I want to reorder Variants in a Layer, so that I control which one wins when several rules hold.
7. As a world author, I want each Variant to take a Visibility rule through the same cog popover as gallery images, so that I already know how to use it.
8. As a world author, I want a badge on each Variant that has a rule and a summary sentence under the selected one, so that I can read the logic at a glance.
9. As a world author, I want a Variant with no rule to always be visible, so that a plain base needs no setup.
10. As a world author, I want a Layer with no visible Variant to show nothing, so that I can make a hat that comes off.
11. As a world author, I want separate Layers such as Hair (Back) and Hair (Front), so that hair can sit behind a hat and in front of a collar.
12. As a world author, I want to set each Layer's opacity, so that I can make ghosts, blush or faint effects.
13. As a world author, I want to set each Layer's tint color, so that one hair drawing serves several hair colors.
14. As a world author, I want to set each Layer's blend mode to Normal, Multiply, Screen or Add, so that shadows and glows look right.
15. As a world author, I want to set each Layer's transition to None, Dissolve or Jelly with the Mascot's tuning sliders, so that changes feel alive.
16. As a world author, I want a new Layer to default to Dissolve, so that changes look smooth without setup.
17. As a world author, I want a live preview of the stack while I edit, so that I see the result at once.
18. As a world author, I want a Preview As picker that evaluates rules for a chosen entity, so that I can check what a character will show in play.
19. As a world author, I want a warning when a Variant's size or aspect differs from the bottom Layer, so that I catch drift before players see it.
20. As a world author, I want every Variant drawn stretched to the bottom Layer's canvas, so that parts line up when the art shares a canvas.

**Linking the rig**

21. As a world author, I want to link a Layered Image into an entity gallery slot, so that the character shows the composed picture.
22. As a world author, I want a gallery slot that links a Layered Image to keep its own Visibility rule, so that I can switch between a human rig and a wolf rig.
23. As a world author, I want to link one Layered Image from several entities, so that every Goblin shares one rig.
24. As a world author, I want a shared rig's ownerless Conditions to read the entity that shows it, so that each Goblin's wounds show on its own picture.
25. As a world author, I want to link a Layered Image into a location's image slot, so that rain, night or fire can lay over the backdrop.
26. As a world author, I want a location rig's ownerless Conditions to read the persona, as location rules do today, so that location art follows the player.
27. As a world author, I want to link a Layered Image into an item's image slot, so that an enchanted sword can glow.
28. As a world author, I want an item rig's ownerless Conditions to read the instance's owner, as item rules do today, so that wear states follow who holds it.
29. As a world author, I want the Media tab's Used By to list every slot that links a Layered Image and every Layered Image that uses an image as a Variant, so that I know what a change touches.
30. As a world author, I want removing an image that a Layered Image uses to list that use in the confirm, so that I never break a rig by accident.

**Scripts**

31. As a world author, I want a script to set a Layer's Variant by Layer name and image name, so that a story beat can change an outfit.
32. As a world author, I want a script to set a Layer's opacity and tint, so that a potion can fade a character or dye their hair.
33. As a world author, I want a script's setting to beat the Variant rules until the script clears it, so that scripted changes stick.
34. As a world author, I want a script to clear a Layer's setting, so that rules take over again.
35. As a world author, I want script settings kept per Generic instance and per Item Instance, so that two guards can wear different helmets.
36. As a world author, I want a script that names a missing Layer or image to stop with an error that names it, so that I can fix the typo.
37. As a world author, I want renaming a Layer or a Variant's image to rewrite my scripts, so that renames never break them.
38. As a world author, I want a script to read a Layer's current Variant, opacity and tint, so that logic can depend on what shows.
39. As a world author, I want a script's whole-image setter to accept a Layered Image's name, so that a script can switch rigs.

**Play**

40. As a player, I want a character's picture to follow the story through its Layers, so that the art matches what happened.
41. As a player, I want Variants re-evaluated at each turn commit, so that the picture changes with the story's state.
42. As a player, I want a changed Dissolve Layer to fade, so that an expression change reads as smooth.
43. As a player, I want a changed Jelly Layer to squash the whole picture once, so that a change feels lively without stacked motion.
44. As a player, I want several Layers changing together to make one squash, so that the picture never wobbles twice.
45. As a player with reduced motion on, I want Jelly to play as Dissolve, so that the picture never bounces.
46. As a player, I want composed pictures everywhere a plain image shows in play (entity panel, mention cards, image viewer, location backdrop, item views), so that the art is consistent.
47. As a player paging back through history, I want the composed picture of the viewed turn, so that past scenes look as they did.
48. As a player, I want a reload to show the same scripted Layer settings, so that a save keeps the look.
49. As a mobile player, I want layered pictures to stay smooth, so that play does not stutter.

**Outside play and portability**

50. As a player browsing the library, I want a Layered Image to show each Layer's first Variant, so that I see the character's default look.
51. As a world author, I want listings, setup screens and card pixels to use the same first-Variant picture, so that every surface agrees.
52. As a world author, I want a library entity to carry its full rig, so that adding it to another world keeps every Layer.
53. As a world author, I want publish to carry the full rig, so that downloaders get the working layers.
54. As a world author, I want a character card to embed the full rig in its Formamorph data and the flattened picture as its pixels, so that other apps show a picture and Formamorph keeps the layers.
55. As a world author, I want a flattened picture to apply opacity, tint and blend mode, so that it matches the live view.
56. As a world author importing a card or library entity, I want the rig and its images to join my Media List with merged duplicates, so that bytes are not stored twice.

**Test Bench**

57. As a world author, I want the Test Bench to flag a Variant whose size or aspect differs from the bottom Layer, so that I find drift.
58. As a world author, I want the Test Bench to flag a bottom Layer that can be empty, so that a picture never goes blank by surprise.
59. As a world author, I want the Test Bench to flag a Variant rule that names a missing trait or stat, so that broken rules surface.
60. As a world author, I want the Test Bench to flag a Layered Image with no Layers, so that an empty entry is not linked by mistake.
61. As a world author, I want the Test Bench to log script Layer writes with names and values, so that I can trace what a script changed.

## Implementation Decisions

**Data model**

- The Media List entry kind grows from image and sound to image, sound and layered. A layered entry has no data URL of its own. It holds an ordered list of Layers, bottom first.
- A Layer has an id, a name (unique within the entry), an opacity (0–1, default 1), an optional tint color (absent = no tint), a blend mode (default Normal), a transition (the Mascot transition shape, default Dissolve with the Mascot's default tuning) and an ordered list of Variants.
- A Variant is a link to a Media List image entry plus an optional Visibility rule (Requirement Rows). It never links a layered or sound entry (Q11).
- Gallery links, location image links and item image links stay as they are. A link whose media id names a layered entry shows a composed picture.
- The save's media overrides gain per-subject Layer settings: for each subject (entity, Generic instance, location, Item Instance), keyed by layered entry id and Layer id, an optional Variant media id, opacity and tint. Absent means rules and authored values apply.
- No migration. The shape is new and unreleased, so no compat code is written.

**Resolution (the core module)**

- One deep module resolves a layered entry for one subject into a resolved stack: per Layer, the chosen Variant's image data (or none), opacity, tint, blend mode and transition.
- It takes the entry, the Media List, a rule-state reader for the subject and the subject's Layer settings. A script setting beats the rules (Q10). Otherwise the first Variant whose rule is empty or has a holding row wins. Otherwise the Layer is empty (Q2).
- The existing visibility functions for entities, locations and items return this resolved stack in place of image data when the visible link is layered. Each keeps its existing bearer logic, so Q7 needs no new rule code.
- An outside-play mode resolves each Layer to its first Variant with rules and settings ignored (Q5).
- A flatten function draws a resolved stack to one bitmap at the bottom Layer's size, applying opacity, tint and blend mode. Cards, thumbnails and any surface that needs one file use it.

**Rendering**

- One shared picture component draws a resolved stack: one image per non-empty Layer, stretched to the canvas, with CSS opacity and blend mode. Add maps to `plus-lighter`. Tint multiplies the Layer by its color and keeps the Layer's alpha.
- The component diffs the previous stack against the next per Layer. A changed Dissolve Layer fades from its old Variant to its new one. If any changed Layer is Jelly, the whole picture plays one squash with the topmost changed Jelly Layer's tuning (Q20), while Dissolve Layers fade during it.
- Transition timing reuses the Mascot's pure timing function and tuning ranges. Reduced motion turns Jelly into Dissolve (Q19).
- Every in-play surface that draws an entity, location or item image routes a layered link through this component. The location backdrop keeps its own compositor layer, with the stack inside it.
- Performance: measure stacked full-size Layers on a mobile-width realistic device profile. If it stutters, draw the settled stack as one flattened bitmap cached by the stack's state, and use separate Layer elements only during a transition.

**Scripts**

- Entity, persona, Generic instance, location and Item Instance script entries gain a `layers` member keyed by Layer name. Each Layer exposes a settable variant (by image name), opacity and tint, and clearing each one restores rules or authored values.
- `layers` addresses the Layered Image the subject shows now. A Layer name not in it, or an image name that is not one of that Layer's Variants, stops the script with an error that names it.
- Writes flow through the existing media-override write path, so they land at commit, save with the turn and undo with it.
- The existing whole-image setter accepts a layered entry's name (story 39).
- Renaming a Layer or a Variant's image rewrites script text through the existing Media List rename tooling.

**Editor**

- The Media tab gets a New Layered Image action and a layered entry editor: the Layer list bottom to top (drag to reorder), per-Layer settings, per-Variant pick or import, the gallery cog rule popover per Variant, a live preview and a Preview As entity picker.
- The preview evaluates rules for the picked entity through the same core module, at the world's starting state.
- Slot pickers (the Choose popover from the Shared Media List effort) list layered entries next to images, with a composed thumbnail.
- Used By counts Variant uses as uses, and delete confirms list them.
- Every new screen and modal gets a dev-route entry.

**Portability**

- The portable form (library entity, card, publish) embeds a layered entry with its Variant images embedded and named, following the Shared Media List rule: embedded is portable, ids are the world form, convert at the boundary.
- Character cards carry the flattened outside-play picture as their PNG pixels and the full rig in their Formamorph data (Q12).
- Import merges byte-identical images, as Media List import does today.

**Test Bench**

- New rule findings: Variant size or aspect mismatch with the bottom Layer; a bottom Layer that can resolve empty; a Variant rule that names a missing trait or stat; a layered entry with no Layers.
- Script Layer writes show as log lines with Layer, field and value.

## Testing Decisions

- Good tests check behavior at the module's public face. They call it with a small world and read the result. They never assert internal structure or mirror the code.
- **Seam 1, the core:** the existing visibility functions for entities, locations and items, given fixture worlds with layered links. They cover first-wins Variant choice, empty Layers, script settings beating rules, cleared settings, each subject's bearer (Q7), per-Generic-instance and per-Item-Instance settings, and outside-play mode. Prior art: the visibility rule tests and the Shared Media List override tests.
- **Seam 2, scripts:** the existing script-runner tests. They cover `layers` reads and writes, errors for missing names, rename rewrites and the whole-image setter with a layered name. Prior art: the media-name member tests.
- **Seam 3, portability:** the existing library, card and publish round-trip tests. A rig survives a round trip with names intact and duplicates merged, and a card's pixels match the flattened picture.
- **Seam 4, Test Bench:** the existing Test Bench rule tests, one per new finding, each proved to bite by reinstating the trap.
- **Seam 5, transitions:** the Mascot transition's pure timing function, extended only if per-Layer frames need it. The diff that picks which Layers fade and which tuning squashes is tested as a pure function of two resolved stacks.
- UI: the verify-ui skill on dev routes, static frames and DOM reads. Motion claims use Playwright per-frame sampling.

## Out of Scope

- PSD import.
- Nested Layered Images, and per-pose placement of a face rig (Q11).
- Per-Variant draw order, per-Variant offsets or anchors, and clipping masks.
- Blend modes beyond Normal, Multiply, Screen and Add.
- Layered Images in `player.show`, the Map Background, world cover and dictionary covers (Q6).
- Transitions for plain image swaps (Q18).
- Any change to the Mascot rig or its copy (Q22).

## Further Notes

- ⚠️ **Export shape:** the world file (new Media List kind), the save file (per-subject Layer settings), library entities and character cards (embedded rig) all change.
- The Mascot rig is prior art for the stacked drawing and the transition. Its "layer" is a named look, not a slot (Q22).
- `layers` addressing the shown rig is a spec-session call, not a grill ruling. It reopens if the user wants writes to target a named rig.
- Copy for the editor and Test Bench follows the Writing Guide, written from a facts list in the user's words.
