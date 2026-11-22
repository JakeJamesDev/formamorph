# 📦 World Editor: Media
<!-- keywords: files, assets, images, sounds, 3d models, avatars, file size, heavy world, publish size, what makes my world big, gallery, import, unused, shared image -->
<!-- route: worldEditor.media -->

> 🛠️ Part of the [World Editor](WorldEditor) guide.

The **Media** tab shows every image, sound, 3D Model and Avatar in your world, with its size. Use it to find what makes a world heavy. It is under **Overview**, in Simple and Advanced mode.

The world keeps one copy of each image and sound. Entities, locations, items, the Map Background, Bodies and the Overview show that copy. An image two entities share is stored once. 3D Models and dictionary cover images stay on what holds them.

A **Layered Image** is a picture stacked from parts. Each part shows one image at a time, picked by its Visibility rule. These image slots can link a Layered Image:

- 🧍 An entity's gallery.
- 🏞️ A location's images. The game view draws it as the location background. A condition with no owner reads the persona.
- 🎒 An item's images. The item popup, the Inventory and the equipped lists draw it. A condition with no owner reads whoever holds the item, and never holds while the item lies at a location.

The Map Background, the world thumbnail and dictionary cover images take plain images only.

With no card selected, the panel shows **World Media**. It holds the world's counts and sizes by kind, and its five largest items.

## How to Find the Heaviest Files
<!-- keywords: big world, too large, publish limit, 100 mb, file size, largest, heavy, what takes space, shrink world -->
<!-- route: worldEditor.media#list-toolbar -->

1. Open the **Media** tab.
2. Read the total beside each section's name. The sections keep the editor's order, so compare the totals.
3. Select a section's name. The panel shows its counts and sizes by kind, and its five largest items.
4. Select an item in **Largest** to open it.

To find one file, type its entity, location or dictionary name, or its slot name (such as "Ambient Sound"), in **Search media**.

## The header
<!-- keywords: publish size meter, group by type, largest first, filter, linked, embedded, visibility rules, over size budget, unused, sort, no images, missing image, empty gallery, blank card, import media -->
<!-- route: worldEditor.media#list-toolbar -->

The row above the search box holds the **Publish Size** meter and four buttons. The meter shows the same figure and color as the bar in the [Test Bench](Test-Bench).

- **Group by Type** sorts the cards into **Images**, **Sounds**, **3D Models** and **Avatars**. Each image and sound shows once, under its own name, however many places use it. See [Group by Type](#group-by-type).
- **Largest First** puts the biggest cards first in each section. Turn it off to return to your order. A stack sorts by its total.
- **Filter** narrows the gallery to **Linked**, **Embedded**, **Has Visibility Rules**, **Over Size Budget**, **Unused** or **No Images** items. **All Media** turns the filter off. The button shows the filter's name while it's on.
  - **Linked** keeps images and sounds that play from an address. **Embedded** keeps every other file, 3D Models and Avatars included.
  - **Has Visibility Rules** and **Over Size Budget** look at images, so they hide sounds, 3D Models and Avatars.
  - **Unused** keeps the images and sounds that nothing in the world shows or plays.
- The **No Images** filter shows one blank card for each entity or location with no image, an empty world thumbnail, and an empty **Map Background**.
  - Blank cards show only their name, with no size. Dictionaries without a cover image have no blank card.
  - Select an entity or location card to open its image panel on the add tile.
  - Select the thumbnail card to upload a file. The card leaves the view after the upload, and one undo brings it back.
- **Optimize Images** converts or shrinks the world's images. See [Optimize Images](#optimize-images).

Two buttons sit at the bottom of the list:

- **Import Media** adds images, sounds and Avatars. See [Import Media](#import-media).
- **New Layered Image** adds an empty Layered Image and opens it. See [Layered Images](#layered-images).

The tab remembers **Group by Type** and **Largest First** on this device. The filter resets when you close the editor.

## The gallery
<!-- keywords: cards, sections, stack, count badge, linked badge, rules badge, warning color, over budget -->

The cards are in sections that follow your editor:

| Section | Holds |
|---|---|
| **World** | The **Thumbnail** and **Background Music** |
| **World › Avatars** | Each Avatar in the world, once |
| **World › Map Background** | The images behind the Locations canvas and the in-game Map |
| **Entities**, and one per entity group | Each entity's images, **Sound** and **3D Model** |
| **Locations**, and one per location with sub-locations | Each location's background images and **Ambient Sound** |
| **Dictionaries** | Each dictionary's **Cover Image** |
| **Unused** | Each image and sound nothing uses, by its name. The section shows only when there is one |

Each card shows the image, or an icon for a sound, 3D Model or Avatar. Under it are the name of the entity, location or dictionary, and the file's size. A world card shows its slot: **Thumbnail** or **Background Music**. An Avatar card shows the Avatar's name. A map card reads **Map Background**.

- 📚 **Stacks.** An entity or location with two or more images shows one card for all of them. The badge counts the images, and the size is their total. The total shows in the warning color when any of the images is over budget. A sound or 3D Model is always its own card.
- 🔗 **Linked.** An image you linked by its address shows **Linked** in place of a size. It adds only its address to the world.
- ⚠️ **Over budget.** A size in the warning color is over that image's size budget. **Optimize Images** shrinks it.
- 🎚️ **Rules.** An image with Visibility rules shows how many it has. A stack counts the rules of all its images.
- 💤 **Unused.** An image or sound nothing uses shows **Unused**. It stays in the world until you delete it, so an image only a script shows is safe.

Only files that exist show. An empty slot makes no card.

## Group by Type
<!-- keywords: group by type, each image once, shared image, used by, where is this image used, delete from world, rename image, item images -->
<!-- route: worldEditor.media#list-toolbar -->

With **Group by Type** on, each image and sound has one card, named as it is in its slots. Item images show here too, since they have no card when the button is off. 3D Models and dictionary cover images keep one card each.

Select an image or sound card to open its panel:

- ✏️ **Name.** Edit the name at the top. Every slot that uses it shows the new name.
- 📎 **Used By** lists each place that uses it, such as "Wren, Image 2". An image a Layer uses shows the Layered Image and the Layer, such as "Scout Rig · Face". Select one to go there. An unused file says so.
- 🗑️ **Delete From World** lists every place that uses the file first, then takes it out of each of them. Undo brings it all back.
- ⬇️ **Download** saves the file, or **Open Link** opens a linked one.

Visibility rules belong to each place, so you set them in the image panel with **Group by Type** off.

## Import Media
<!-- keywords: import media, upload images, upload sounds, add files, bulk upload, add avatar, vrm -->
<!-- route: worldEditor.media#list-toolbar -->

**Import Media** at the bottom of the list adds files before you decide where they go. Pick several at once.

- 🖼️ Images and 🔊 sounds join the world under their file names, without the extension. They show as **Unused** until a slot uses them. Pick them with **Choose** in any slot.
- 🧍 A `.vrm` file, or a `.glb` with VRM data, becomes an Avatar in **World › Avatars**. A `.glb` without VRM data isn't imported.
- ♻️ A file the world already holds adds nothing new.
- 📐 A large image first asks whether to optimize it, at the background budget.

The panel opens on the first new file.

## Optimize Images
<!-- keywords: optimize images, shrink images, downscale, over budget, thumbnail budget, spinner, undo optimize -->
<!-- route: worldEditor.media#list-toolbar -->

**Optimize Images** is the last icon in the header row, in both modes. It changes the thumbnail, Map Background images, entity images, location images, item images and dictionary cover images. Item images have no card in the gallery. **Unused** images use the background budget. The **Optimize world images?** dialog offers up to two choices, and each shows only when it has an image to act on:

- **Optimize** converts each image that a lossless WebP makes smaller, at any size. The image keeps its resolution. A message then says how many images stayed as they were.
- **Downscale** turns each image that is over its budget, or stored lossless (PNG, BMP, lossless WebP), into a smaller lossy WebP.

**Keep as-is** closes the dialog. With nothing worth optimizing, no dialog shows.

- The icon shows a spinner while a run goes, and its tooltip shows the progress.
- Close the editor to cancel a run.
- The run is one Step, so one undo brings every image back.
- Sizes and the Publish Size meter update when it ends.

## The panel
<!-- keywords: preview, play sound, view 3d model, view avatar, download, save file, replace file, swap file, remove file, delete file, undo, go to, used by -->
<!-- route: worldEditor.media -->

Select a card to open it in the panel. An entity's, location's or Map Background image opens the image panel, described below. Every other card opens on its own.

- **Preview.** An image shows large. A 3D Model and an Avatar turn in the viewer. A sound, the thumbnail and a Body's backdrop show their slot, with its name, **Remove From Slot** and **Delete From World**.
- **Size and budget.** The file's size, and an image's size budget.
- **Replace** swaps in a file you pick, on a 3D Model or a dictionary cover image. The file stays in the same slot. An image that is over budget, stored lossless, or smaller as a WebP first asks whether to optimize it, as an upload does.
- **Download** saves the file. A linked image or sound shows **Open Link**, which opens its address.
- **Remove** clears the slot on those same cards, and the card leaves the gallery. Undo brings it back. A slot uses its own **Remove From Slot**.
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

Each entity still picks its Avatar in its own **Avatar** dropdown, in Simple and Advanced mode. See [World Avatars](Avatars#world-avatars).

## The image panel
<!-- keywords: entity gallery, location background, reorder images, primary image, generate with ai, image tags, visibility rule, framed image, avatar link -->
<!-- route: worldEditor.media -->

An entity's or location's images open in one panel. A stack opens on its primary image. An image picked from **Largest** opens on that image.

- 🧾 **Header.** The name, the image count and their total, and **Go to**. An entity shows the Avatar it picks: select a world Avatar to open its card.
- 🖼️ **Gallery.** The same gallery as the entity's **Profile** tab or the location's **Media** tab. Select a tile in the strip to frame it. Drag a tile to reorder; drag it to the front to make it the primary image. **Generate with AI** shows in both modes, and **Image Tags** in Advanced.
- ➕ **Add tile.** It frames the empty slot. **Import** or **Choose** there, and the frame moves to the new image. See [Image slots](World-Editor-Entities#image-slots).
- 📋 **Framed image.** Under the gallery: its slot name, size and budget, and **Download**. The slot above it holds the image's name, **Remove From Slot** and **Delete From World**.
- 🧩 **Framed Layered Image.** It shows the Layered Image's name. The line under it gives its Layer count and the size of its images, with an image two Layers share counted once. **Edit Layers** is beside **Download**. **Download** saves the image as it shows outside a game.
- 🎚️ **Visibility rule.** The framed image shows its rule editor here, so the strip has no cog. A rule you set here shows on the entity's **Profile** tab or the location's **Media** tab, and a rule set there shows here. On a location, a condition with no owner reads the persona.

Each change is one undo step.

## Layered Images
<!-- keywords: layered image, layers, variants, paper doll, outfit, expression, stacked picture, character parts, preview as, edit layers, size warning -->
<!-- route: layeredEditor -->

A **Layered Image** builds one picture from parts. Each **Layer** holds images called **Variants** and shows one at a time: the first Variant whose Visibility rule holds. A Layer with no Variant showing shows nothing. The list's top Layer draws on top.

**To build one:**

1. Select **New Layered Image** at the bottom of the Media tab's list. It joins the Media List as "Layered Image". Rename it at the top of its panel.
2. Select **Edit Layers**. A full-screen editor opens around a large picture.
3. Select **Add Layer** once for each part, such as Body, Face and Hat.
4. Select a Layer, then **Choose** an image from the Media List or **Import** one. Each becomes a Variant of that Layer.
5. Select a Variant's cog to give it a Visibility rule, as on a gallery image. A Variant with no rule always shows.

**To edit one from a gallery:** select **Edit Layers** on the slot that shows it. In the Media tab it is beside **Download**. On an entity's **Profile** tab it is under the slot's name. On mobile, **Edit Layers** opens the Layer panel.

**In the editor:**

- 🧩 **Layers.** Drag a Layer by its handle to change what draws over what. The eye hides a Layer in the editor only. Each row shows what the Layer shows now.
- 🖼️ **Variants.** The strip under the picture holds the selected Layer's Variants. Drag one to reorder: the first whose rule holds wins. The line under the strip says when the selected Variant shows.
- 🎚️ **Layer settings.** Rename the Layer, set its **Opacity**, **Blend Mode**, **Tint** and **Transition**, or **Delete Layer**.
- 🎨 **Tint.** Pick a color, and the Layer's pixels multiply by it. Transparent pixels stay transparent, and white means no tint. **Clear Tint** removes it. One gray drawing then serves any color, such as one hair drawing for every hair color.
- 🔀 **Blend Mode.** **Normal** draws the Layer over the Layers below it. **Multiply** darkens them, **Screen** lightens them, and **Add** brightens them most, for glows and light. A mode acts on the Layers below it inside this picture only, never on the page behind it. The picture in the panel and in a game shows both settings. The small Layer and Variant thumbnails show the plain art.
- 🎞️ **Transition.** Sets what a Layer does when it shows another Variant, in a game or in the editor.

  | Mode | What it does |
  |---|---|
  | **None** | The new Variant shows at once. |
  | **Dissolve** | The Layer fades from the old Variant to the new one. **Duration** sets how long. New Layers use Dissolve. |
  | **Jelly** | The whole picture squashes and bounces once, and the new Variant shows at the bottom of the squash. **Duration**, **Squash**, **Overshoot** and **Settle Count** tune the bounce. |

  When several Layers change at once, the picture bounces once, tuned by the highest Jelly Layer. Dissolve Layers fade during the bounce. With your system's reduced-motion setting on, Jelly fades like Dissolve. A change to Opacity or Tint shows at once.
- ▶️ **Play**, beside the Transition modes, shows the selected Layer's next Variant with its transition. Press it again to step on. It only changes the picture in the editor.
- 👁️ **Preview As** shows the picture as one of the world's entities at the start of a game. **Default Look** shows each Layer's first Variant, as the library and other places outside a game do.
- ⚠️ **Size warning.** Every Variant stretches to the picture's size: the size of the first Variant in the lowest Layer that has one, usually the bottom Layer. A Variant of another size shows a warning, with both sizes.

On mobile, the panel shows the picture beside the Layer list. The selected Layer sits below, with **Variants**, **Look** and **Motion** tabs. **Look** holds Opacity, Blend Mode and Tint. **Motion** holds the Transition.

**To use one,** select **Choose** in an entity's, a location's or an item's image slot. Layered Images show beside the images. The gallery strip and frame show the picture the Layered Image draws with each Layer's first Variant. The gallery's order and Visibility rules work as they do for any image.

Deleting an image that a Layer uses removes it from that Layer, and the confirm names each Layer first. Images that only Layers use sit in the **Layered Image Variants** section. Each change is one undo step.

## Map Background
<!-- keywords: map background, world map, map image, map visibility rule, ruined map, map changes in game, go to locations -->

The **World › Map Background** cards hold the image behind the [Locations canvas](World-Editor-Locations#map-background). Two or more images stack, like an entity's.

- 🖼️ The cards open the image panel, with the slot's controls, **Download** and **Go to Locations**.
- 🎚️ Each image can carry a Visibility rule. During a game, the Map shows the first visible image, and no image when none is visible. A condition with no owner reads the persona.
- 📐 Every image fits inside one shared frame at its own shape, so a swap lines up with your locations.
- ➕ With no image, **No Images** shows a blank card. An upload there covers your locations.
- 📦 The size budget is in [Image Sizes](#image-sizes).

## Image Sizes
<!-- keywords: image budget, size budget, long edge, thumbnail budget, entity budget, background budget, map budget, over budget -->

Each image slot has a size budget: a long edge and a file size. An image over the file size shows **Over Budget**. **Downscale** shrinks an image over either number, and every PNG, BMP or lossless WebP.

| Slot | Long edge | File size |
|---|---|---|
| Thumbnail, and a dictionary's **Cover Image** | 1024 px | 200 KB |
| Entity | 1280 px | 250 KB |
| Background | 1920 px | 900 KB |
| Map | 2560 px | 1.5 MB |

## Sizes
<!-- keywords: how size is measured, mb, kb, publish size match, total -->

A size is what the file adds to the world's saved file. It is the same measure as the **Publish Size** bar in the [Test Bench](Test-Bench). Each Avatar counts once, however many entities pick it.
