# Media Tab

Status: done
Spec session: media-tab — spec
Status note: closed 2026-10-24. Tickets 01–12 done; last landing b7c4f0ddd. Review: spec text corrected; its one gap became ticket 12. Gates green on 2026-10-24.

## Problem Statement

A world's heavy files are spread across the World Editor. Entity images, sounds and 3D Models sit on each entity's panel. Location backgrounds and ambient sounds sit on each location. The thumbnail and Background Music sit in the Overview, next to the Avatar store. Dictionary thumbnails sit on each book.

An author can't see all of it in one place. The Publish Size bar in the World Doctor gives one number, but nothing shows which files make it up. An author near the limit has to open every entity and location to find the heavy ones. Optimize Images is one icon in the app bar, in Advanced mode only, and it says nothing about what it will shrink.

Visibility rules have the same problem. They live in a narrow column on the entity Profile tab. An entity with many gallery images and many rules is hard to read and hard to edit there.

## Solution

The World Editor gets a **Media** tab, beside Overview in the Nav Rail, in both editor modes. It is a view over the world's media, not a new store: every file stays on the entity, location, dictionary or world that holds it, and the export shape does not change.

- A gallery of cards shows every media item in the world. By default the cards sit in sections by parent (World, Entities, Locations, Dictionaries), and the sections follow the author's own entity groups and location nesting. A toggle groups by type instead (Images, Sounds, 3D Models, Avatars).
- Each card shows a thumbnail, the name of the entity, location or book it belongs to, and its stored size, or a **Linked** badge for an image that is a URL. Each section header shows its total.
- An entity's gallery images stack into one card with a count. Its sound and 3D Model are their own cards under the same name.
- One header row holds a slim Publish Size meter and four icon controls: grouping, **Largest First**, a filter, and **Optimize Images**.
- Clicking an entity's or location's image opens one panel for it: the gallery widget frames the image, and the framed image's size, **Replace**, **Download**, **Remove** and Visibility rule editor sit below. Clicking a strip tile frames that image.
- Clicking any other card opens its item panel: a large preview, its size, its actions, and **Go to <name>**.
- The Avatar store moves here from the Overview. Each Avatar is one card in its own section and lists the entities that use it.
- Optimize Images moves from the app bar into the tab, in both modes.
- The over-limit Publish Size finding opens the Media tab.

## User Stories

### Finding the tab

1. As an author, I want a Media tab beside Overview, so that I find the world's files without opening each entity.
2. As a Simple-mode author, I want the Media tab too, with every media kind, so that I can see and manage my world's size without switching modes.
3. As an author on mobile, I want the Media tab in the Sections bar, so that it works the same as the other tabs.

### Seeing everything

4. As an author, I want every image, sound, 3D Model and Avatar in the world shown as cards in one gallery, so that nothing heavy is hidden.
5. As an author, I want the world thumbnail and Background Music in a World section, so that the world's own files are in the gallery too.
6. As an author, I want each entity's images, sound and 3D Model under that entity's name, so that I see what one entity costs.
7. As an author, I want each location's background and ambient sound under that location's name, so that I see what one location costs.
8. As an author, I want each dictionary's thumbnail in a Dictionaries section, so that book covers count too.
9. As an author, I want only media that exists in the gallery, so that empty slots don't make it long.
10. As an author, I want the sections to follow my entity groups and location nesting, so that the gallery reads like the rest of the editor.
11. As an author, I want an entity's images stacked into one card with a count, so that a big gallery doesn't flood the grid.
12. As an author, I want an entity's sound and 3D Model as their own cards, so that a filter or a size sort still shows them.
13. As an author, I want to group by type instead, so that I can see all sounds or all images together.
14. As an author grouping by type, I want each card to name the entity or location it belongs to, so that I know where it lives.
15. As an author, I want author order by default, so that the gallery matches the other tabs.
16. As an author, I want **Largest First**, so that the heaviest files come first in each section.

### Sizes

17. As an author, I want every card to show its size, so that I know which files are heavy.
18. As an author, I want a stack to show the total of its images, so that I see what an entity's gallery costs.
19. As an author, I want every section header to show its total, so that I see where the weight sits.
20. As an author, I want sizes to add up to the Publish Size figure, so that the numbers agree with the publish limit.
21. As an author, I want a linked image to show a Linked badge in place of a size, so that I know it costs no bytes.
22. As an author, I want an over-budget size marked, so that I see which images Optimize Images would shrink.
23. As an author, I want a slim Publish Size meter in the header row, so that I see the total against the limit without losing space.
24. As an author, I want the World Doctor to keep its full bar, so that quick triage still shows it.
25. As an author, I want the over-limit finding to open the Media tab, so that I land where I can fix it.

### Header and filters

26. As an author, I want the header to take one row, so that the gallery gets the space.
27. As an author, I want to filter to linked or embedded images, so that I can find the uploads that cost bytes.
28. As an author, I want to filter to images that have Visibility rules, so that I can review every rule in one place.
29. As an author, I want to filter to images over their size budget, so that I see what Optimize Images would shrink.
30. As an author, I want an active filter to name itself on its button, so that I know the gallery is narrowed.

### Entity and location panel

31. As an author, I want clicking an entity's stack or image to open one panel for that entity, so that its gallery and the framed image's details sit together.
32. As an author, I want clicking a strip tile to frame that image and show its details, so that I move through the gallery without going back to the grid.
33. As an author, I want the framed image's size, budget, Replace, Download and Remove under the gallery, so that I act on the image I see.
34. As an author, I want the framed image's Visibility rule editor under the gallery, so that long rules are readable.
35. As an author, I want to reorder gallery images and use Make Primary in the panel, so that I set the order the rules work through.
36. As an author, I want Generate with AI in the panel, so that I can add an image while I review the gallery.
37. As an Advanced-mode author, I want Image Tags in the panel, so that I can fix the tags Generate uses without leaving the tab.
38. As a Simple-mode author, I want the panel to follow the same mode rules as the entity panel, so that a control never appears in one place and not the other.
39. As an author, I want the panel to show which Avatar the entity picks, so that I can jump to the Avatar.
40. As an author, I want **Go to <name>** on the panel, so that I can edit the rest of the entity there.

### Other items

41. As an author, I want clicking a sound, 3D Model, thumbnail or Avatar card to show a large preview, so that I know which file it is.
42. As an author, I want to hear a sound in its panel, so that I can check it without entering play.
43. As an author, I want to orbit a 3D Model or an Avatar in its panel, so that I can check it without entering play.
44. As an author, I want an entity's sound or 3D Model panel to link back to the entity, so that I can reach its gallery.

### Actions

45. As an author, I want to replace a file in place, so that its position and Visibility rules stay.
46. As an author, I want to download an embedded file, so that I can keep or edit it outside Formamorph.
47. As an author, I want Download on a linked image to open its URL, so that I can reach the source.
48. As an author, I want to remove a media item from the tab, so that I can trim the world without leaving it.
49. As an author, I want a removal to be undoable through editor history, so that a slip costs nothing.
50. As an author, I want **Go to <name>** to open the entity, location, dictionary or Overview field that holds the item, so that I can edit the rest of it there.

### Visibility rules

51. As an author, I want the Profile tab to keep its rule editor and cog, so that I can set a rule while I author the entity.
52. As an author, I want a rule edited in either place to show in the other at once, so that there is one truth.
53. As an author, I want images with rules marked on their cards, so that I see which images are conditional.

### Avatars

54. As an author, I want the world's Avatars in their own section, so that I manage them with the other heavy files.
55. As an author, I want each Avatar to show once, so that its file counts once in every total.
56. As an author, I want an Avatar's panel to list the entities that use it, so that I know what a change touches.
57. As an author, I want to add an Avatar from a file or from my Avatar library in the Avatars section, so that Avatars still have a way in.
58. As an author, I want to rename an Avatar in the tab, so that the entity dropdown reads well.
59. As an author, I want to replace an Avatar's file and keep its id, so that every entity keeps its pick.
60. As an author, I want deleting an Avatar to name the entities that use it, so that I know what changes.
61. As an author, I want the Overview to lose its Avatar section, so that the store has one home.
62. As an author, I want each entity's Avatar dropdown to stay on the entity, so that picking an Avatar is still one step.

### Optimize Images

63. As an author, I want Optimize Images in the Media tab header, so that I shrink files where I see their sizes.
64. As a Simple-mode author, I want Optimize Images too, so that I can fix a size problem without switching modes.
65. As an author, I want the app bar to lose the Optimize Images button, so that the action has one home.
66. As an author, I want sizes and the meter to update when Optimize Images finishes, so that I see what it saved.

### Behavior across the editor

67. As an author, I want every edit in the tab to be one editor history step with a clear label, so that undo works like everywhere else.
68. As an author, I want a history reveal of a Media tab edit to return me to the tab, so that I see what changed.
69. As an author, I want the tab to stay responsive in a world with many images, so that opening it doesn't stall the editor.
70. As an author, I want to filter to entities, locations and a world thumbnail that have no image, so that I can fill every gap from one place without blank cards in the default view.
71. As an author, I want a background image behind the Locations canvas that players also see on the Map, so that my world map art frames the places I arranged.
72. As an author, I want the map background to be a gallery with Visibility rules, so that the map can change as the story changes.

## Implementation Decisions

- **No export-shape change from the tab itself (01–06).** The tab reads and writes the existing fields: `worldOverview.thumbnail`, `worldOverview.bgm`, `worldOverview.vrmStore`, entity gallery images with their rows, entity `sound` and `model`, location `backgroundImage` and `ambientSound`, and dictionary `thumbnail`. Tickets 07 and 08 change the shape: a new time Condition kind in rule rows (additive, unreleased), and location `images` replacing `backgroundImage` with a migration (Q47). Ticket 10 adds an optional `worldOverview.mapBackground`: a rule-bearing gallery with one shared frame and opacity (additive, unreleased).
- **Time Condition (07, Q50–Q52).** A Condition kind in the shared Requirement Rows that holds a set of dayparts and holds while the story clock's daypart is in the set. No bearer, no day number, no hour. It reads the clock at the per-turn snapshot traits settle on, after the turn's time passes, with the AI clock on or off. Trait gates and both image rule hosts offer it; character cards carry it; authoring lenses read it at the opening hour.
- **Location galleries (08, Q47–Q49).** A location's `backgroundImage` becomes `images`, the entity gallery shape with rule rows; `migrateWorld` moves the old field into slot 0, idempotently. A row with no bearer reads the played persona. Play shows the first visible image, or no backdrop when none passes (Q65). The location panel and the Media image panel host the gallery with its rules.
- **A media index module, pure and DOM-free.** One function takes a world and returns its items: kind, parent, slot, stored size, linked flag, budget, over-budget flag, rule rows and, for Avatars, their users. Helpers group by parent (following entity groups and location nesting) or by type, sort, filter, and total. The World Editor and Optimize Images both read it, through one per-kind parent table (read, write, cap, rule host, go-to target) from ticket 12. It grows out of the current world image slot list, which covers images only.
- **Optimize Images reads the index.** Dictionary thumbnails join the images it shrinks, under the thumbnail budget. This is a spec default: the grill named the gap but did not rule on it.
- **Stored size** is the UTF-8 byte length of the value as it sits in the world JSON, the same measure as the Publish Size bar. A linked image counts its URL's bytes in totals and shows the Linked badge in place of a figure. A section total is the sum of its items. An Avatar counts once, in the Avatars section.
- **Size budget** applies to images only, from the image caps by kind (thumbnail, entity, background, and map at 2560 px and 2.5 MB). The flag checks stored bytes only, since nothing decodes to list, so an image Optimize would shrink for its dimensions alone shows no mark. Sounds, 3D Models and Avatars have no budget, so the over-budget filter never matches them. An over-budget size shows in the warning color.
- **Tab placement.** A new tab value in the editor tab list, ungrouped, after Overview, in both modes. It needs a dev-router entry.
- **Modes (Q26).** Every media kind, its card and its actions show in both modes, Avatars, 3D Models and Ambient Sound included. Inside the image panel the gallery widget keeps its own mode rules (Image Tags in Advanced only).
- **Layout (P1).** The standard master-detail list editor, with the mobile list row. The list side is a gallery: sections of square cards in an auto-fill grid. A section is a group-like folder (World, World › Avatars, World › Map Background, Entities, each entity group, Locations, each location with children, Dictionaries); an entity's or location's items fold into the nearest section rather than making one of their own. A section header shows its path and total, and clicking it opens a section summary (kind breakdown and largest items; the Avatars section also holds **Upload Avatar…** and **Copy From Library**).
- **Cards (P2).** A card shows the thumbnail (a kind icon for sounds, 3D Models and Avatars), the parent's name (the slot name for world media), the size or Linked badge, and a rules badge for an image with rules. Thumbnails load lazily and never decode to measure.
- **Stacks (P3).** An entity's or location's images form one card when there are two or more: the primary image, a count badge, two offset sheets behind it, and the images' total. Sounds and 3D Models never join a stack; each is its own card under the parent's name. A parent with one image shows a plain card. In type grouping the same stacking applies inside Images.
- **Image panel (P4).** Clicking a stack, or a card for an entity's, location's or Map Background image, opens one panel per parent. Its header holds the name, image count and total, the picked Avatar as a link (entities only; spec default for Q16 in the gallery), and **Go to <name>**. Below it, the existing gallery widget, with reorder, Make Primary, Generate with AI and Image Tags under its existing mode rules. Below that, the framed image's details: slot name, size, budget, over-budget badge, **Replace**, **Download** and **Remove**, then the framed image's Visibility rule editor. Clicking a strip tile frames that image and switches the details; the add tile frames the empty slot for upload. A stack opens framed on its primary. There is no separate item panel and no file list for gallery images.
- **Gallery widget changes (P7).** The widget gains an optional controlled frame (the framed index and a change callback) and an option to hide the strip's rule cog. The Media tab uses both and hides the cog, since its rule editor sits below. The Profile tab passes neither and keeps the cog.
- **Item panel.** For world media, sounds, 3D Models, dictionary thumbnails and Avatars: a large preview by kind (image viewer, the shared sound player, the 3D Model viewer, the Avatar viewer), its size, its actions, and **Go to <name>**. An entity's sound or 3D Model titles itself `<entity> › <slot>`, and the entity name opens the image panel.
- **Header (P5).** One row: a slim Publish Size meter with its "N MB / 100 MB" readout fills the left; then icon buttons for grouping (by parent or by type), **Largest First**, a filter popover (All Media, Linked, Embedded, Has Visibility Rules, Over Size Budget, No Images from ticket 09; an active filter shows its name on the button), and **Optimize Images**. It replaces the full Publish Size bar in the tab; the World Doctor keeps its full bar.
- **Flat detail (P6).** The detail sections sit on the panel with spacing only, no outlined boxes or dividers, matching the other editor panels.
- **Grouping toggle and size sort** are view state, remembered per device like other editor view toggles. They never reach the world.
- **Copy names the parent.** The jump action reads **Go to <name>**, with the entity, location or dictionary name, or **Go to Overview** for world media. Copy never says "owner"; that word is a glossary term for traits, stats and placeholders.
- **Actions.** Replace keeps the slot, its rows and its gallery position. Download saves embedded bytes under a name built from the parent and slot, and opens the URL for a linked image. Remove deletes the field or the gallery entry as one history step.
- **Visibility rule editor.** The same Requirement Row editor the Profile tab uses. Both hosts write the same rows.
- **Avatars move.** The Overview's Avatar store section leaves the Overview. Its controls (add from file, copy from the Avatar library, rename, delete with the users named) move to the Avatar panel and the Avatars section summary. Replace is new: it swaps the file, recomputes the hash, and keeps the id. The entity Avatar dropdown stays on the entity panel. The Overview layout from the overview voice pass loses its Avatar item.
- **Optimize Images moves.** The app bar button leaves. The tab's header icon runs the same action, with its progress (a spinner on the icon), its history step label, and its downscale consent dialog, in both modes.
- **The over-limit finding** opens the Media tab instead of the Overview. This changes the publish-size effort's ticket 04 behavior.
- **History.** Each edit records one history step through the editor's existing recorder, labeled like other editor steps. History reveal maps Media tab edits to the tab and the selected card.
- **Performance.** Sizes come from string lengths; nothing decodes to list. Card thumbnails load lazily, and previews render only in the open panel.

## Testing Decisions

- A good test drives the public surface and reads the result: the index's output for a world, or the world the mounted editor writes after a user action. Tests do not read component state or internal helpers.
- **Seam 1: the media index.** Unit tests feed authored worlds and assert the items and groupings: every kind found, parents and sections right, an Avatar counted once with its users, linked images flagged, stored sizes that sum to the publish measure of the same world, budget flags against the image caps, filters and both sort orders. Prior art: the publish limits tests and the world image optimize tests.
- **Seam 2: the World Editor.** The shared World Editor bench harness mounts the real editor over real providers. Tests open the Media tab in both modes and assert: the tab shows in Simple and Advanced; an entity's images form one stack while its sound is its own card; a stack opens the image panel framed on the primary, and a strip click switches the framed details; Remove, Replace, reorder and Make Primary write the world and undo in one step; a rule edited in the tab shows on the Profile tab; the strip cog is hidden in the tab and present on the Profile tab; the Overview has no Avatar section; Avatars, 3D Models and Ambient Sound show and act in Simple; Avatar add, rename, Replace and delete work from the tab and keep entity picks; the app bar has no Optimize Images button and the tab's action runs in Simple; Image Tags show in Advanced only; the over-limit finding lands on the Media tab. Prior art: the World Editor bench suites, the app bar suite, the entity panel suite and the gallery widget suites.
- Each guard is proven to bite: reinstate the bug (an Avatar counted twice, a sound folded into a stack, a missing dictionary thumbnail, a mode gate removed) and watch the test fail.

## Out of Scope

- A shared media store with ids, and any de-duplication of identical files. That is an export-shape change.
- Visibility rules on anything but gallery images (entity, location and, from 10, Map Background galleries).
- Time Conditions on the day number or an hour (Q52).
- Adding images, sounds or 3D Models from the tab, except through the image panel's gallery (upload or Generate with AI) and an empty world slot's upload (Q56). Avatars are the one other kind the tab adds.
- An unused-Avatars filter.
- Scene images, action attachments, library entities and the Model Library. They live outside the world.
- Moving the thumbnail, Background Music, location or entity upload fields out of their current panels.
- Editor Find results that point into the Media tab.
- The tree, size-table and cluster layouts the prototype rejected.

## Further Notes

- **Prototype.** Branch `prototype/media-tab`, last commit `71a3c4e5d`, worktree `.claude/worktrees/prototype-media-tab`, launch entry `proto-media-tab` (port 5234). Variants: A tree, B size table, C gallery with stacks (winner), D gallery with clusters. The question was what the Media tab's list and detail should look like on a heavy world (Fantasy Futanari, 66 MB). Verdict: C, with one image panel per entity (P4), sounds and 3D Models as their own cards (P3), a one-row header (P5), and flat detail sections (P6). The prototype's media index and switcher are throwaway; tickets rebuild them.
- **Q26.** The Overview's Avatar section, entity 3D Models and location Ambient Sound are Advanced-only today. In the Media tab, Simple-mode authors see and manage all of them, so the tab is the whole inventory in either mode and its totals match the Publish Size figure. Their fields on the entity and location panels keep their current mode rules.
- The glossary needs a **Media tab** entry, and a note that a media item's holder is named in copy by its name, never as its owner.
- Two efforts that already landed change here: the entity-avatars effort's Overview section (Q5) and publish-size ticket 04's landing target (Q20). If either is still unreleased, the changelog folds this change into that entry rather than adding one.
- Rulings Q1–Q25 from the grill, in short: view not store (Q1); both modes (Q2, reopened in Q5); beside Overview (Q3); all world media (Q4); Avatars move in (Q5, Q25); rules editable in both places (Q6); Optimize moves in, both modes (Q7, Q9); size meter mirrored, now slim (Q8, P5); parent grouping with a type toggle (Q10); master-detail (Q11); Replace, Download, Remove, Go to (Q12); only Avatars added here (Q13); three filters (Q14); groups mirrored (Q15); Avatars once with references (Q16); author order with size sort (Q17); Generate and Image Tags on the parent panel (Q18, Q24); reorder and Make Primary (Q19); finding opens Media (Q20); named Media (Q21); stored size (Q22); parent panel, now the image panel (Q23, P4); every kind in both modes (Q26).
- Ticket 01 intent rulings, 2026-10-24: Avatar panels show **Go to Overview** until 06 (Q27); 01 builds **Used By** as read-only entity links, and 06 reuses it (Q28); the list search filters cards by parent name and slot name, with "No media matches" when empty (Q29); a section summary lists the top 5 items as `<name> › <slot>` with size, and a click selects that card (Q30); section paths read "Entities › Group › Subgroup", ungrouped entities fold into "Entities", and a location with children makes its own "Locations › Parent" section (Q31); Download names files `<parent> <slot>.<ext>` from the data URL MIME, world media under "World", Avatars as `<name>.vrm` or `.glb` (Q32); the help window's surface map points the Media tab at `World-Editor-Media.md` (Q33); a card's rules badge reads "N rules" or "1 rule" (Q34); a stack's total shows in the warning color when any of its images is over budget (Q35); a stack's rules badge sums the rule rows across its images, and under a filter a stack forms from the images that pass it, so its count and total follow the filter (Q36).
- Ticket 02 intent rulings, 2026-10-24: the header row sits above the list's search row, which keeps its own row as in the other list tabs, and Optimize Images joins the header row in 03 (Q37, the user's call); Linked, Has Visibility Rules and Over Size Budget match images only, while Embedded matches every item that isn't a linked image (Q38). Largest First sorts cards by the card's size, so a stack sorts by its total, and it sorts within each section while sections keep author order. Under a filter, section totals and summaries follow the filtered items, a section with no match disappears, and search and filter both apply. Type sections run Images, Sounds, 3D Models, Avatars, and empty ones are left out. The meter reads the Test Bench's worker-measured publish bytes and shows "Measuring…" until the first result.
- Ticket 04 intent rulings, 2026-10-24: history labels read "<Replace|Remove> <Slot>: <parent name>", and world media drop the name ("Remove Thumbnail"), matching the Avatar steps; a dictionary's slot reads "Cover Image", the book panel's label, on cards, panels and labels alike (Q39). When a Media-origin step's card is gone after undo or redo, the reveal opens the Media tab with no selection (Q40). Replace takes a file only, so a linked image becomes embedded through the downscale consent; there is no paste-a-link path in the item panel (Q41).
- Added scope, 2026-10-24 (the user's call): locations get galleries with Visibility rules, replacing `backgroundImage` through a migration (Q47); a location rule's bearer-less rows read the played persona (Q48); no visible location image shows the default background (Q49, replaced by Q65); a time Condition joins the shared rows (Q50), testing a set of dayparts (Q51) and not the day number (Q52). Tickets 07 and 08.
- Ticket 06 intent ruling, 2026-10-24: the Avatars section (World › Avatars, or the Avatars type section) always shows, header-only when empty, so the first Avatar can be added; with no media at all it shows under the empty-state hint. Under an active filter or search it follows the normal rule and shows only with matching cards (Q53).
- Added scope, 2026-10-24 (the user's call): a **No Images** option joins the single-select filter popover; it shows only blank cards, never in the default view (Q54). Blank cards cover entities with no gallery image, locations with no image, and an empty world thumbnail; dictionaries without a Cover Image are left out (Q55). A blank card shows the parent's or slot's name and no size; an entity or location card opens the image panel framed on its add slot, and a world slot opens its item panel with an upload control; an upload moves the card out of the filtered view (Q56, spec default). Ticket 09 builds it, blocked by 05. Ticket 09 intent ruling: the world has no background field, so the world thumbnail is the only world blank card (Q59).
- Ticket 08 intent ruling, 2026-10-24: on a location image, the trait page's bearer-less choice reads "Persona" in place of "Same Owner", with no separate Persona row, and the stat picker's first section is "Persona Stats"; Global and named-entity sections stay as for entities (Q60).
- Ticket 07 intent rulings, 2026-10-24: a time chip has no Not flip, since the set covers it (Q61); the Requires picker's "Time of Day" section adds a chip preset to Night, with six daypart toggles in clock order, at least one on (Q62); the summary lists dayparts in clock order with each run starting after a gap, joined with commas and a final "or" ("Shown while evening or night") (Q63, revised); authoring lenses read the default opening hour (8:00, morning), and in play a rule reads the daypart of the turn on screen, a paged-back turn included (Q64).
- Rulings, 2026-10-24 (the user's calls): a location with no visible image paints no backdrop, whether it has no images or every image fails its rules, as today; the default background shows only with no current location (Q65, replaces Q49). The daypart chip uses the segmented toggle group as a multi-select, a new design-system form (Q66).
- Ticket 08 review ruling, 2026-10-24: the warning that the primary image ignores its rule outside play shows for entities only, and the tour's In Game preview paints a location's slot 0 without rules (Q67).
- Added scope, 2026-10-24 (the user's calls): a world may hold one optional **Map Background** image behind the Locations canvas, shown on the player's in-game Map too (Q68). It sits at a stored canvas position and size; an **Adjust Background** toggle on the canvas lets the author drag it and resize it by its corners at a fixed aspect ratio, and it is locked otherwise (Q69). The Media tab holds it as a World › Map Background card with Replace, Download and Remove, and a blank card under No Images; the canvas context menu adds **Set Background Image…** and **Adjust Background** (Q70). The author sets an opacity, stored in the world and used by canvas and Map alike (Q71), from a slider in a small panel shown while Adjust is on, beside **Remove** (Q72). Its size budget is its own: 2560 px and 2.5 MB (Q73). Spec defaults: a first upload covers the locations' bounding box; each drag, resize or opacity release is one history step; the Media card's jump reads **Go to Locations**. Ticket 10 builds it. This is an additive, unreleased export-shape change.
- Added scope, 2026-10-24 (the user's calls): the Map Background is a gallery with Visibility rules, so the map can change with the story (Q74). Every image shares one frame (position, size, opacity) and fits inside it at its own aspect ratio, so a swap lines up with the locations (Q75). Spec defaults: a bearer-less row reads the played persona, as on locations (Q48); play shows the first visible image and none when no image passes; the canvas and other authoring lenses show slot 0; the Media tab stacks it and its image panel edits each image's rule. This narrows the Out of Scope line on Visibility rules.
- Ticket 10 intent rulings, 2026-10-24: the canvas menu reads **Set Background Image…** with an empty gallery and **Replace Background Image…** otherwise, which swaps slot 0 and keeps its rule and the frame (Q76); Adjust's **Remove Image** removes slot 0, and the frame and opacity go with the last image (Q77); with no locations, a first image from the canvas covers the visible area, and one from the Media tab gets a frame 1280 canvas units wide at its aspect ratio, centered on the origin (Q78); Adjust works embedded and in full screen (Q79); the Media section is World › Map Background, with cards named "Map Background" using the entity gallery's slot names (Q80); a first image starts at 100% opacity (Q81).
- Ticket 10 review rulings, 2026-10-24 (the user's calls): the canvas's Set/Replace card shows the Map Background gallery widget as it is (reorder, the remove x on the framed image, an add tile) in place of the bare upload box, so an image can be removed from the canvas (Q82). While Adjust is on, the location boxes and arrows draw above the map but take no pointer, so a press anywhere on the map grabs it; the corner handles draw above the boxes (Q83). Ticket 11 builds both. Ticket 11 intent ruling: a first image into an empty gallery switches the card to Adjust; later adds, removes and reorders keep the gallery open (Q84).
- Ticket 05 review rulings, 2026-10-24: with the cog hidden, a strip tile keeps its rule badge and label (Q57); removing an entity's only image closes the panel back to the gallery, like ticket 04's Remove, and Replace swaps a sole image in place (Q58).
- Ticket 05 intent rulings, 2026-10-24: Make Primary is the gallery's drag-to-front, with no button (Q42); the image panel links a world Avatar pick to its card, shows a library pick's name as plain text, and shows nothing for User's Default, and Avatar item ids keep the form `world:world:avatar:<id>` (Q43); hiding the strip's cog also hides the framed-rule summary line, while the primary-image cover warning stays (Q44); the add tile's empty frame shows no details until an upload lands, then the frame follows the new image (Q45); gallery steps read "Replace Image 3: <name>" and "Remove Image 3: <name>", Replace keeps the image's rules and position, and after Remove the frame stays on the same index, clamped (Q46).
- Prototype rulings P1–P8, in short: gallery layout (P1); cards (P2); image-only stacks, other kinds as their own cards (P3); one image panel per parent, no file list (P4); one-row header (P5); no outlines (P6); controlled frame and hideable cog on the gallery widget (P7); C over A, B and D (P8).
