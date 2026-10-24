# 📦 World Editor: Media
<!-- keywords: files, assets, images, sounds, 3d models, avatars, file size, heavy world, publish size, what makes my world big, gallery -->
<!-- route: worldEditor.media -->

> 🛠️ Part of the [World Editor](WorldEditor) guide.

The **Media** tab shows every image, sound, 3D Model and Avatar in your world, with its size. Use it to find what makes a world heavy. It sits under **Overview**, in Simple and Advanced mode.

Every file stays where you added it: on the entity, location, dictionary or Overview. The tab only shows them in one place.

## How to Find the Heaviest Files
<!-- keywords: big world, too large, publish limit, 100 mb, file size, largest, heavy, what takes space, shrink world -->
<!-- route: worldEditor.media#list-toolbar -->

1. Open the **Media** tab.
2. Read the total beside each section's name. The sections keep the editor's order, so compare the totals.
3. Select a section's name. The panel shows its counts and sizes by kind, and its five largest items.
4. Select an item in **Largest** to open it.

To find one file, type its entity, location or dictionary name, or its slot name (such as "Ambient Sound"), in **Search media**.

## The header
<!-- keywords: publish size meter, group by type, largest first, filter, linked, embedded, visibility rules, over size budget, sort, no images, missing image, empty gallery, blank card -->
<!-- route: worldEditor.media#list-toolbar -->

The row above the search box holds the **Publish Size** meter and four buttons. The meter shows the same figure and color as the bar in the [Test Bench](Test-Bench).

- **Group by Type** sorts the cards into **Images**, **Sounds**, **3D Models** and **Avatars**. Each card names the entity, location or dictionary it belongs to.
- **Largest First** puts the biggest cards first in each section. Turn it off to return to your order. A stack sorts by its total.
- **Filter** narrows the gallery to **Linked**, **Embedded**, **Has Visibility Rules** or **Over Size Budget** items. **Embedded** keeps every file that isn't a linked image, sounds, 3D Models and Avatars included. The other three filters look at images, so they hide sounds, 3D Models and Avatars. The button shows the filter's name while it's on.
- **No Images** shows one blank card for each entity or location with no image, an empty world thumbnail, and an empty **Map Background**. Blank cards show only their name, with no size. Dictionaries without a cover image have no blank card. Select an entity or location card to open its image panel on the add tile. Select the thumbnail card to upload a file. The card leaves the view after the upload, and one undo brings it back.
- **Optimize Images** shrinks images that are over their size budget. See [Optimize Images](#optimize-images).

The tab remembers **Group by Type** and **Largest First** on this device. The filter resets when you close the editor.

## The gallery
<!-- keywords: cards, sections, stack, count badge, linked badge, rules badge, warning color, over budget -->

The cards sit in sections that follow your editor:

| Section | Holds |
|---|---|
| **World** | The **Thumbnail** and **Background Music** |
| **World › Avatars** | Each Avatar in the world, once |
| **World › Map Background** | The images behind the Locations canvas and the in-game Map |
| **Entities**, and one per entity group | Each entity's images, **Sound** and **3D Model** |
| **Locations**, and one per location with sub-locations | Each location's background images and **Ambient Sound** |
| **Dictionaries** | Each dictionary's **Cover Image** |

Each card shows the image, or an icon for a sound, 3D Model or Avatar. Under it are the name of the entity, location or dictionary, and the file's size.

- 📚 **Stacks.** An entity or location with two or more images shows one card for all of them. The badge counts the images, and the size is their total. The total shows in the warning color when any of the images is over budget. A sound or 3D Model is always its own card.
- 🔗 **Linked.** An image you linked by its address shows **Linked** in place of a size. It adds only its address to the world.
- ⚠️ **Over budget.** A size in the warning color is over that image's size budget. **Optimize Images** shrinks it.
- 🎚️ **Rules.** An image with Visibility rules shows how many it has. A stack counts the rules of all its images.

Only files that exist show. An empty slot makes no card.

## Optimize Images
<!-- keywords: optimize images, shrink images, downscale, over budget, thumbnail budget, spinner, undo optimize -->
<!-- route: worldEditor.media#list-toolbar -->

**Optimize Images** is the last icon in the header row, in both modes. It scans the images in the gallery: the thumbnail, entity images, location images and dictionary cover images. A dialog asks how to shrink them. The icon shows a spinner while it runs, and its tooltip shows the progress. Close the editor to cancel a run. The run is one Step, so one undo brings every image back. Sizes and the Publish Size meter update when it ends.

## The panel
<!-- keywords: preview, play sound, view 3d model, view avatar, download, save file, replace file, swap file, remove file, delete file, undo, go to, used by -->
<!-- route: worldEditor.media -->

Select a card to open it in the panel. An entity's or location's image opens the image panel, described below. Every other card opens on its own.

- **Preview.** An image shows large. A sound plays. A 3D Model and an Avatar turn in the viewer.
- **Size and budget.** The file's size, and an image's size budget.
- **Replace** swaps in a file you pick. The file stays in the same slot. A large image first asks whether to shrink it, as an upload does.
- **Download** saves the file. A linked image shows **Open Link**, which opens its address.
- **Remove** clears the slot, and the card leaves the gallery. Undo brings it back.
- **Go to** opens the entity, location or dictionary that holds the file. World files show **Go to Overview**.

## Avatars
<!-- keywords: add avatar, upload avatar, copy from library, rename avatar, replace avatar, delete avatar, used by, avatar store -->
<!-- route: worldEditor.media -->

The **World › Avatars** section holds the world's Avatars, in Simple and Advanced mode. It shows even when the world has no Avatar, unless a filter or a search is on.

- **Upload Avatar…** adds a `.vrm` or `.glb` file. **Copy From Library** copies one of your Avatars. Select the section's header to see both.
- **Name.** Edit the name at the top of the Avatar's panel. It shows in each entity's **Avatar** dropdown.
- **Replace** swaps the file and keeps the Avatar's name and place, so every entity that picks it keeps its pick.
- **Download** saves the file.
- **Delete** names the entities that use the Avatar, and they go back to **None**. Undo brings it all back.
- **Used By** lists the entities that pick the Avatar. Select one to open it.

Each entity still picks its Avatar in its own **Avatar** dropdown. See [World Avatars](Avatars#world-avatars).

## The image panel
<!-- keywords: entity gallery, location background, reorder images, primary image, generate with ai, image tags, visibility rule, framed image, avatar link -->
<!-- route: worldEditor.media -->

An entity's or location's images open in one panel. A stack opens on its primary image. An image picked from **Largest** opens on that image.

- 🧾 **Header.** The name, the image count and their total, and **Go to**. An entity shows the Avatar it picks: select a world Avatar to open its card.
- 🖼️ **Gallery.** The same gallery as the entity's **Profile** tab or the location's **Media** tab. Select a tile in the strip to frame it. Drag a tile to reorder; drag it to the front to make it the primary image. **Generate with AI** shows in both modes, and **Image Tags** in Advanced.
- ➕ **Add tile.** It frames the empty slot. Upload there, and the frame moves to the new image.
- 📋 **Framed image.** Under the gallery: its slot name, size and budget, then **Replace**, **Download** and **Remove**. Replace keeps the image's place and its Visibility rule.
- 🎚️ **Visibility rule.** The framed image shows its rule editor here, so the strip has no cog. A rule you set here shows on the entity's **Profile** tab or the location's **Media** tab, and a rule set there shows here. On a location, a condition with no owner reads the persona.

Each change is one undo step.

## Map Background
<!-- keywords: map background, world map, map image, map visibility rule, ruined map, map changes in game, go to locations -->

The **World › Map Background** cards hold the picture behind the [Locations canvas](World-Editor-Locations#map-background). Two or more images stack, like an entity's.

- 🖼️ The cards open the image panel, with **Replace**, **Download**, **Remove** and **Go to Locations**.
- 🎚️ Each image can carry a Visibility rule. In play, the Map shows the first visible image, and no image when none is visible. A condition with no owner reads the persona.
- 📐 Every image fits inside one shared frame at its own shape, so a swap lines up with your locations.
- ➕ With no image, **No Images** shows a blank card. An upload there covers your locations.
- 📦 The budget is 2560 px on the long edge and 2.5 MB.

## Sizes
<!-- keywords: how size is measured, mb, kb, publish size match, total -->

A size is what the file adds to the world's saved file, the same measure as the **Publish Size** bar in the [Test Bench](Test-Bench). Each Avatar counts once, however many entities pick it.
