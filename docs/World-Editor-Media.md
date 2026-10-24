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

## The gallery
<!-- keywords: cards, sections, stack, count badge, linked badge, rules badge, warning color, over budget -->

The cards sit in sections that follow your editor:

| Section | Holds |
|---|---|
| **World** | The **Thumbnail** and **Background Music** |
| **World › Avatars** | Each Avatar in the world, once |
| **Entities**, and one per entity group | Each entity's images, **Sound** and **3D Model** |
| **Locations**, and one per location with sub-locations | Each location's **Background Image** and **Ambient Sound** |
| **Dictionaries** | Each dictionary's **Thumbnail** |

Each card shows the image, or an icon for a sound, 3D Model or Avatar. Under it are the name of the entity, location or dictionary, and the file's size.

- 📚 **Stacks.** An entity with two or more images shows one card for all of them. The badge counts the images, and the size is their total. The total shows in the warning color when any of the images is over budget. A sound or 3D Model is always its own card.
- 🔗 **Linked.** An image you linked by its address shows **Linked** in place of a size. It adds only its address to the world.
- ⚠️ **Over budget.** A size in the warning color is over that image's size budget. **Optimize Images** shrinks it.
- 🎚️ **Rules.** An image with Visibility rules shows how many it has. A stack counts the rules of all its images.

Only files that exist show. An empty slot makes no card.

## The panel
<!-- keywords: preview, play sound, view 3d model, view avatar, download, save file, go to, used by -->

Select a card to open it in the panel. A stack opens its first image.

- **Preview.** An image shows large. A sound plays. A 3D Model and an Avatar turn in the viewer.
- **Size and budget.** The file's size, and an image's size budget.
- **Download** saves the file. A linked image shows **Open Link**, which opens its address.
- **Go to** opens the entity, location or dictionary that holds the file. World files show **Go to Overview**.
- **Used By** lists the entities that pick an Avatar. Select one to open it.

## Sizes
<!-- keywords: how size is measured, mb, kb, publish size match, total -->

A size is what the file adds to the world's saved file, the same measure as the **Publish Size** bar in the [Test Bench](Test-Bench). Each Avatar counts once, however many entities pick it.
