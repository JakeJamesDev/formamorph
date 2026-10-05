# 📚 Library
<!-- keywords: home screen, my collection, world list, dashboard, start screen, installed content -->
<!-- route: mainMenu -->

The library is the main menu's board of everything on this device: your worlds, entities, dictionaries and avatars. Each one is a tile. You can size tiles, move them and put them in Groups.

> A world's own copy of a library entity or dictionary is a linked copy. See [Linked Content](LinkedContent).

## How to Import a World
<!-- keywords: load, open, add, bring in, json file, upload, install, file, downloaded, scenario, adventure file, story pack, from discord, received from friend, sideload content, custom game -->
<!-- route: mainMenu.worlds#import-world -->

1. On the **Worlds** tab, select **Import World**.
2. Select one or more world `.json` files.
3. If the files have large images, choose how to store them, or select **Keep as-is**.

One file opens its world dialog. More files add their tiles. If the world brings entities or dictionaries you do not have, see [Importing a World File](LinkedContent#importing-a-world-file).

## How to Export a World
<!-- keywords: save to file, download, back up, json, share file, copy, send to friend, scenario file, give to someone, embed images, smaller filesize, transfer to other pc, extract, distribute -->
<!-- route: mainMenu.worlds -->

1. On the **Worlds** tab, select the world.
2. Select **Export World**.
3. Choose how to store the world's images, or select **Keep as-is**.
4. If the world links its images, select **Keep Links — Smaller File** or **Download and Embed — Works Offline**.

You get a `.json` file with the world's name.

## How to Import an Entity
<!-- keywords: character card, png card, chub, load character, add character, upload, tavern card, npc file, bot, janitorai, v2 spec, companion, risu -->
<!-- route: mainMenu.entities#import-entity -->

1. On the **Entities** tab, select **Import Entity**.
2. Select one or more files. These work:
   - A Formamorph entity card (`.webp`)
   - A SillyTavern card (`.png` or `.json`)
   - A SillyTavern persona backup, with its avatar images. See [How to Import SillyTavern Personas](Personas#how-to-import-sillytavern-personas).

A lorebook inside a SillyTavern card also comes in, as a dictionary. If you import one file that names worlds, a review opens. See [Importing an Entity or Dictionary File](LinkedContent#importing-an-entity-or-dictionary-file).

## How to Import a Dictionary
<!-- keywords: lorebook, sillytavern, load, add, upload, json, world info, worldbook, lore file, codex, knowledge base, encyclopedia -->
<!-- route: mainMenu.dictionaries#import-dictionary -->

1. On the **Dictionaries** tab, select **Import Dictionary**.
2. Select one or more `.json` files. A Formamorph dictionary and a SillyTavern World Info lorebook both work.

If you import one file that names worlds, a review opens. See [Importing an Entity or Dictionary File](LinkedContent#importing-an-entity-or-dictionary-file).

## How to Export an Entity or a Dictionary
<!-- keywords: character card, lorebook, save to file, download, share, webp, json, send to friend, extract, bot, portrait image, single item backup, lore pack -->
<!-- route: mainMenu -->

1. Select the tile. Its editor opens.
2. Select **Export** at the bottom of the editor.

An entity exports as a `.webp` card: its portrait with the entity's data inside. An entity with no portrait gets a generated image. A dictionary exports as a `.json` file.

To import or export an avatar, see [How to Import an Avatar](Avatars#how-to-import-an-avatar) and [How to Export an Avatar](Avatars#how-to-export-an-avatar).

## How to Make a Group
<!-- keywords: folder, create folder, organize, sort, collection, category, new folder, stack, bundle, tidy up, declutter, directory, drawer, drag onto another, combine -->
<!-- route: mainMenu.worlds -->

1. Right-click a tile. On a touch screen, press and hold it.
2. Select **Create New Group…**.
3. Type a **Group Name**, then select **Create Group**.

The Group goes where the tile was, at the same size, and the tile goes into it.

You can also drag one tile onto the near half of another tile and hold it there. Release it, and both tiles go into a new Group named *New Group*.

## How to Add a Tile to a Group
<!-- keywords: folder, put in, move into, organize, sort, collection, drop onto, file away, assign, include in, place inside -->
<!-- route: mainMenu -->

1. Right-click the tile.
2. Under **Add To Group**, select a Group. Only three Groups show there. To see all of them, select **Add To Group…** and find the Group by name.

You can also drag the tile onto the near half of a Group's tile, hold it, and release it.

## How to Remove a Tile from a Group
<!-- keywords: folder, take out, move out, ungroup, pull out, back to main, separate, unassign, eject -->
<!-- route: mainMenu -->

1. Open the Group.
2. Right-click the tile, then select **Remove From Group**.

The tile goes to the end of the board. Formamorph removes a Group that has no tiles left.

## How to Move a Tile
<!-- keywords: drag, reorder, rearrange, sort, organize, swap, position, change order, arrange, shuffle, relocate, red ring, put first, icon placement -->
<!-- route: mainMenu -->

1. Drag the tile. On a touch screen, press and hold it first.
2. Hold it over the far half of another tile. The tiles show where the tile will go.
3. Release it.

A tile that shares a row or a column with the target pushes the tiles between them. Otherwise the two tiles swap. A red ring means the tile cannot go there.

## How to Change a Tile's Size
<!-- keywords: bigger, smaller, resize, large, small, medium, grid, enlarge, shrink, thumbnail, icon, compact, name hidden, scale -->
<!-- route: mainMenu.worlds -->

1. Right-click the tile.
2. Under **Tile Size**, select **Small**, **Medium** or **Large**.

A **Small** tile hides its name. Point to it to see the name. **Tile Size** shows only in the grid view.

## How to Rename a Group
<!-- keywords: folder, name, change name, title, relabel, label, retitle, call it something -->
<!-- route: mainMenu -->

1. Select the Group to open it.
2. Select its name at the top, and type a new one.
3. Press Enter to keep the name, or Escape to cancel.

## How to Delete a Group
<!-- keywords: folder, remove, ungroup, get rid of, disband, dissolve, erase, break apart, trash, lose contents -->
<!-- route: mainMenu -->

1. Right-click the Group.
2. Select **Delete Group**.

The Group's tiles go back to the board. In the grid view, each tile goes to the first free place. In the detailed view, the tiles take the Group's place in the order. Formamorph erases no items.

---

## The Library Tabs
<!-- keywords: categories, sections, create new world, new button, personas switch, bottom bar, switch between lists -->
<!-- route: mainMenu.worlds -->

| Tab | What it holds | Select a tile to… |
|---|---|---|
| **Worlds** | Your worlds, and the worlds that come with Formamorph | Open the world dialog. See [The World Dialog](Starting-a-Game#the-world-dialog). |
| **Entities** | Library entities | Open the entity editor |
| **Dictionaries** | Library dictionaries | Open the dictionary editor |
| **Avatars** | 3D player avatars | Open the avatar's details and preview |

On a wide screen, the tabs are at the top left. On mobile, they are at the bottom of the screen.

Each tab has a **New** button, such as **New World**, and an **Import** button, such as **Import World**. **Avatars** has only **Import Avatar**. On a narrow screen, these buttons are in the **Menu** button at the top center.

The **Entities** tab also has an **All** and **Personas** switch. **Personas** shows only the entities you can play as. See [Personas](Personas). While **Personas** is on, you cannot move tiles, change their size or change Groups.

## The Board
<!-- keywords: list view, alphabetical, filter, find a world, layout, compact view, order lost -->

**Grid view** and **Detailed view** are the two buttons at the top right. Each tab keeps its own view.

- **Grid view** shows tiles in three sizes. A **Large** tile is twice as wide as a **Medium** tile; a **Small** tile is half as wide.
- **Detailed view** shows one card size with more text. Drag a card to change the order.

The board keeps the place of each tile on this device. A narrow screen and a wide screen each keep their own order. The order is not in a world export or a backup.

The board has no sort or search.

## Groups
<!-- keywords: folders, subfolder, nested, open folder, zoom out, preset for folder, how many inside -->
<!-- route: mainMenu -->

A Group holds tiles of one tab. Its tile shows a small image of its board, and a count of its tiles.

- Select a Group to open it. The view zooms from the Group's tile to its board. Select **Library** at the top to zoom back out.
- Inside a Group, you can move and size tiles as on the main board.
- A Group cannot hold another Group.
- On the **Worlds** tab, an open Group has a **Prompts** list. The worlds in the Group use that prompt preset unless a world has its own. See [Prompts](Prompts).

### The Group Dialogs

**Add To Group** lists your Groups. Type in **Find a Group** to filter them, then select one. **Create New Group…** opens the second dialog.

**Create New Group** asks for a **Group Name**. Each Group needs its own name. **Create Group** makes the Group and adds the tile to it.

## The Card Menu
<!-- keywords: context menu, long press, delete world, uninstall, trash, erase character, options popup, thumbnail -->

Right-click a tile, or press and hold it on a touch screen. With the keyboard, press Shift+F10.

| Item | Tabs | What it does |
|---|---|---|
| **Tile Size** | All | Sets **Small**, **Medium** or **Large**. Grid view only. |
| **Add To Group** | All | Adds the tile to a Group. See [How to Add a Tile to a Group](#how-to-add-a-tile-to-a-group). |
| **Create New Group…** | All | Makes a Group that holds the tile |
| **Remove From Group** | All | Takes the tile out of its Group |
| **Check for Updates** | Entities, Dictionaries | Looks for worlds that have an older version of this item. See [Update Available](LinkedContent#update-available). |
| **Set as Default Persona** | Entities | Makes the entity your default persona. Shows for a persona entity. See [Personas](Personas#how-to-set-a-default-persona). |
| **Publish** | Avatars | Publishes the avatar to Community Creations. Shows when you are logged in. |
| **Thumbnail** | Avatars | Uses the image in the file, or a generated one. Shows when the file has an image. |
| **Delete** | All | Erases the item after you confirm |

A Group's menu has **Tile Size**, **Open Group** and **Delete Group**.

World actions such as **Edit World** and **Publish World** are in the world dialog, not in this menu.

### Deleting an Item

**Delete** asks you to confirm, and you cannot undo it. Make a backup first. See [How to Make a Backup](Saves-and-Backup#how-to-make-a-backup).

- When saves use an avatar, the dialog names them. Those saves use the default avatar after you erase it.
- You cannot delete your last avatar.
- To restore an erased world that came with Formamorph, see [How to Restore Default Worlds](Settings#how-to-restore-default-worlds).
- When worlds use a deleted entity or dictionary, see [Removing a Library Item](LinkedContent#removing-a-library-item).

## The Library Editors
<!-- keywords: edit npc, create character, edit lorebook, discard edits, close without saving, standalone, make new lore -->

**New Entity** and an entity tile open the entity editor. **New Dictionary** and a dictionary tile open the dictionary editor. Their tabs are the same as in the World Editor. See [In the library](World-Editor-Entities#in-the-library) for entities and [In the library](World-Editor-Dictionary#in-the-library) for dictionaries.

| Button | What it does |
|---|---|
| **Export** | Exports the item as a file |
| **Publish** | Publishes the item to Community Creations. Shows when you are logged in. |
| **Save** | Saves your changes. A new item is stored only when you save it. |

If you close the editor with unsaved changes, **Unsaved changes** asks what to do: **Save & Exit**, **Exit Without Saving** or **Cancel**.

**New World** and **Edit World** open the [World Editor](WorldEditor) on the whole screen. Use its back arrow at the top left to close it.

## Related

- [🚪 Starting a Game](Starting-a-Game): the world dialog and Quick Start
- [💾 Saves and Backup](Saves-and-Backup): load games, and back up the whole library
- [🔗 Linked Content](LinkedContent): linked copies, updates, publishing and downloads
- [🪪 Personas](Personas): persona entities and the default persona
