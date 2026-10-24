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
<!-- keywords: publish size meter, group by type, largest first, filter, linked, embedded, visibility rules, over size budget, sort -->

The row above the search box holds the **Publish Size** meter and three buttons. The meter shows the same figure and color as the bar in the [Test Bench](Test-Bench).

- **Group by Type** sorts the cards into **Images**, **Sounds**, **3D Models** and **Avatars**. Each card names the entity, location or dictionary it belongs to.
- **Largest First** puts the biggest cards first in each section. Turn it off to return to your order. A stack sorts by its total.
- **Filter** narrows the gallery to **Linked**, **Embedded**, **Has Visibility Rules** or **Over Size Budget** items. **Embedded** keeps every file that isn't a linked image, sounds, 3D Models and Avatars included. The other three filters look at images, so they hide sounds, 3D Models and Avatars. The button shows the filter's name while it's on.

The tab remembers **Group by Type** and **Largest First** on this device. The filter resets when you close the editor.

## The gallery
<!-- keywords: cards, sections, stack, count badge, linked badge, rules badge, warning color, over budget -->

The cards sit in sections that follow your editor:

| Section | Holds |
|---|---|
| **World** | The **Thumbnail** and **Background Music** |
| **World › Avatars** | Each Avatar in the world, once |
| **Entities**, and one per entity group | Each entity's images, **Sound** and **3D Model** |
| **Locations**, and one per location with sub-locations | Each location's **Background Image** and **Ambient Sound** |
| **Dictionaries** | Each dictionary's **Cover Image** |

Each card shows the image, or an icon for a sound, 3D Model or Avatar. Under it are the name of the entity, location or dictionary, and the file's size.

- 📚 **Stacks.** An entity with two or more images shows one card for all of them. The badge counts the images, and the size is their total. The total shows in the warning color when any of the images is over budget. A sound or 3D Model is always its own card.
- 🔗 **Linked.** An image you linked by its address shows **Linked** in place of a size. It adds only its address to the world.
- ⚠️ **Over budget.** A size in the warning color is over that image's size budget. **Optimize Images** shrinks it.
- 🎚️ **Rules.** An image with Visibility rules shows how many it has. A stack counts the rules of all its images.

Only files that exist show. An empty slot makes no card.

## Optimize Images
<!-- keywords: optimize images, shrink images, downscale, over budget, thumbnail budget, spinner, undo optimize -->

**Optimize Images** is the last icon in the header row, in both modes. It scans the images in the gallery: the thumbnail, entity images, location backgrounds and dictionary cover images. A dialog asks how to shrink them. The icon shows a spinner while it runs, and its tooltip shows the progress. Close the editor to cancel a run. The run is one Step, so one undo brings every image back. Sizes and the Publish Size meter update when it ends.

## The panel
<!-- keywords: preview, play sound, view 3d model, view avatar, download, save file, replace file, swap file, remove file, delete file, undo, go to, used by -->

Select a card to open it in the panel. A stack opens its first image.

- **Preview.** An image shows large. A sound plays. A 3D Model and an Avatar turn in the viewer.
- **Size and budget.** The file's size, and an image's size budget.
- **Replace** swaps in a file you pick. The file stays in the same slot. A large image first asks whether to shrink it, as an upload does.
- **Download** saves the file. A linked image shows **Open Link**, which opens its address.
- **Remove** clears the slot, and the card leaves the gallery. Undo brings it back.- **Go to** opens the entity, location or dictionary that holds the file. World files show **Go to Overview**.
- **Used By** lists the entities that pick an Avatar. Select one to open it.

## Sizes
<!-- keywords: how size is measured, mb, kb, publish size match, total -->

A size is what the file adds to the world's saved file, the same measure as the **Publish Size** bar in the [Test Bench](Test-Bench). Each Avatar counts once, however many entities pick it.
