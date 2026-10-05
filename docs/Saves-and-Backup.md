# 💾 Saves and Backup
<!-- keywords: cloud sync, stored locally, uploaded to server, data safety, persistence, keep my stuff -->

A save keeps one game's progress. A backup keeps your worlds, saves, library entities and library dictionaries in one file. Formamorph keeps all of it on your device. It sends an item to a server only when you publish it.

> To start a new game instead, see [Starting a Game](Starting-a-Game).

## How to Save a Game
<!-- keywords: progress, keep, file, store, checkpoint, quit, stop playing, manual, slot, bookmark, come back later, overwrite, preserve, session, avoid losing -->
<!-- route: gameViewer -->

1. In the game, select the **Menu** button at the top right.
2. Select **Save Game**.
3. Type a name in the box. The box shows the name of the save you loaded or saved last.
4. Select the **Save** button, or press Enter.
5. If a save with that name is in this world, select **Overwrite** to replace it, or **Keep both** to add a second save.

The **Logs** tab records *Game saved as …*. To keep scene images in the save, select their checkbox. See [The Save Game Dialog](#the-save-game-dialog).

## How to Load a Game
<!-- keywords: continue, resume, open save, pick up, saved, return, carry on, previous session, where i left off, old playthrough, reopen story, last time, slot, yesterday -->
<!-- route: menu -->

1. Open **Load Game**:
   - In the game, select **Menu**, then **Load Game**.
   - On the main menu, select the **Menu** button at the top right, then **Load Game**. On a narrow screen, the item is in the **Menu** button at the top center.
2. Select the folder of the world.
3. Select a save. The game opens at the turn you saved.

A save from a world that is not on this device does not load from the main menu. Import or download that world first. See [Loading from Another World](#loading-from-another-world).

## How to Export a Save
<!-- keywords: download, file, share, transfer, move, copy, json, another device, send to friend, sync, pc to phone, extract, portable, single playthrough, offload -->
<!-- route: menu -->

1. Open **Load Game**.
2. Select the world's folder.
3. On the save's row, select the **Export save** button.

You get a `.json` file with the save's name. On Android, choose a folder in the **Save As** sheet. See [Save Exports to a Folder](Install-on-Android#-save-exports-to-a-folder).

## How to Import a Save
<!-- keywords: upload, open file, transfer, move, bring in, another device, json, load from disk, received, sync, phone to pc, add playthrough, from friend, multiple at once -->
<!-- route: menu#import-save -->

1. Open **Load Game**.
2. Select the **Import** button.
3. Select one or more save `.json` files.

Each save goes into the folder of its world. The dialog opens that folder, and a message counts the saves it imported. The dialog skips a file that it cannot read.

## How to Make a Backup
<!-- keywords: back up, everything, export all, reinstall, new computer, new device, migrate, transfer, safe copy, archive, snapshot, switch browser, before clearing cache, format pc, full dump, bulk, sync devices, protect data -->
<!-- route: backup#start-backup -->

1. On the main menu, select the **Menu** button, then **Backup & Restore**.
2. Select the **Backup** button.
3. Clear the checkbox of each item you do not want. All items start selected.
4. Select **Save backup**. You get a file named `formamorph-backup-` and the date.
5. Keep the file in a safe place, away from the app's own folder.

Make a backup before you update the app or move to a new device. See [What a Backup Holds](#what-a-backup-holds).

## How to Restore a Backup
<!-- keywords: recover, bring back, get back, import, reinstall, new device, lost data, migrate, load archive, everything gone, wiped, merge, duplicates, disappeared, old computer, put back -->
<!-- route: backup#start-restore -->

1. On the main menu, select the **Menu** button, then **Backup & Restore**.
2. Select the **Restore** button, then select a backup `.json` file.
3. Clear the checkbox of each item you do not want.
4. Items you already have show an **exists** tag. To replace them, select **Overwrite existing** in their group.
5. Select **Restore**. The app reloads when it is done.

Restore adds to what you have. It never erases an item that is not in the backup.

## How to Update the Desktop App
<!-- keywords: new version, upgrade, latest, download, patch, install, mac, windows, out of date, outdated, auto updater, newer release, dmg, pc client, linux -->
<!-- route: mainMenu#app-version -->

1. On the main menu, look at the version number at the bottom left. It shows **— Update Available!** when a newer release is out.
2. Select the version number. The update dialog opens.
3. Select the **Download** button. A progress bar shows under the version number.
4. Select **Update & Restart**.

On a Mac, **Download** opens the new `.dmg` file in your browser. Open the file and copy the new app over the old one. For Android, see [How to Update the App](Install-on-Android#how-to-update-the-app).

---

## The Save Game Dialog
<!-- keywords: what is stored, include pictures, file size, empty name, contents, replace existing, illustrations, list of slots -->

**Save Game** shows the saves of the world you play.

| Part | What it does |
|---|---|
| Name box | The name of the new save. An empty name saves nothing. |
| **Save** | Saves the game under the name |
| **Import** | Imports save files. See [How to Import a Save](#how-to-import-a-save). |
| A save in the list | Puts its name in the name box, so **Save** replaces it |
| Scene images checkbox | Shows when the game has scene images. Select it to keep them in the save. The checkbox shows how much the images add. |

A save holds the full story and a copy of each turn, so **Rewind to Here** still works after you load it. It also holds your notes, memories, persona, the game's dictionaries and the images you attached to actions.

The autosave is not in this list. You cannot save over it.

## The Load Game Dialog
<!-- keywords: erase a slot, rename, world not installed, wrong world, old version, compatibility, convert, reorder, game time, remove old -->
<!-- route: menu -->

**Load Game** has a folder for each world that has saves. In the game, the folder of the current world is first, with **(current)**. Each folder shows how many saves it has and when you last played.

| Part | What it does |
|---|---|
| **Import** | Imports save files |
| **Back** | Goes back to the folder list |
| Drag handle | Changes the order of folders or saves. Each folder keeps its own order. |
| A save | Loads it |
| **Export save** | Exports the save as a `.json` file |
| **Delete save** | Erases the save after you confirm. You cannot undo it. |

Each save row shows its name, the date and time you saved it, and the **Game Time** of the story. The autosave has an **Auto** tag. A save has no rename control: save it again under the new name, then erase the old one with **Delete save**.

Saves are newest first until you drag one. A new save always goes to the top.

### Loading from Another World

Each save is for the world you played when you made it.

| Where you load | The save's world | What happens |
|---|---|---|
| In the game | The world you play | The save loads |
| In the game | Another world on this device | **Switch worlds and load?** asks first. Your current game closes. |
| In the game | A world not on this device | **Load a save from another world?** asks first. The save loads into the current world and may not work as intended. |
| Main menu | A world on this device | That world opens and the save loads |
| Main menu | A world not on this device | **World not installed** shows. You can still export or delete the save. |

Unsaved progress is lost each time a game closes.

### Old Save Files

Saves from older versions of Formamorph load too. Formamorph converts a save in the oldest format when you load it. A message shows while that runs. If the conversion fails, the game still loads what it can, and the **Logs** tab says *(with conversion errors)*.

## Autosave
<!-- keywords: automatic, forgot, crash, closed tab, lost progress, recover, disable, auto tag, browser closed -->

**Autosave** saves your game after every turn. Each world has one **Autosave** slot, and each turn replaces it.

- It starts after the opening scene, and it also saves after **Re-generate**.
- It never changes your own saves.
- It never keeps scene images.
- It shows under **Load Game** with an **Auto** tag. You can load, export or delete it.
- If an autosave fails, a message shows once. Your own saves still work.

To turn it off, clear **Autosave** in the **Saves** section of the [Settings](Settings#saves) **Data** tab.

## Quick Start
<!-- keywords: continue button, not a resume, new run instantly, lightning icon -->

**Quick Start** starts a new game with the world's defaults. It does not load a save. See [How to Start with the Defaults](Starting-a-Game#how-to-start-with-the-defaults).

## The Backup & Restore Dialog
<!-- keywords: what is included, settings not included, avatars missing, optimize, downscale, invalid file, select all, compress pictures, skip duplicates -->
<!-- route: backup -->

Open it from the main menu's **Menu** button. It has three buttons: **Backup**, **Restore** and **Close**.

**Backup** lists what you have in up to four groups: **Worlds**, **Saves**, **Entities** and **Dictionaries**. A group shows only when it has items. Each group has a checkbox that selects all of its items, and a count of the items you selected. **Save backup** is off when nothing is selected.

**Restore** reads a backup file and shows the groups that the file holds.

| Control | What it does |
|---|---|
| **exists** tag | Marks an item that is already on this device |
| **Overwrite existing** | Replaces the group's existing items. Shows only in a group with **exists** items. When it is clear, the restore skips those items. |
| **World images**, **Entity images** | Choose **Keep as-is**, **Optimize** or **Downscale** for the images the restore writes |
| **Restore** | Writes the selected items, then reloads the app |

A file that is not a Formamorph backup shows *This file is not a Formamorph backup.*

### What a Backup Holds

| In the backup | Not in the backup |
|---|---|
| Worlds, with their images | Settings, prompt presets and Tools |
| Saves | Avatars |
| Library entities | Downloaded AI models |
| Library dictionaries | Cached images and other caches |
| | The order of the **Load Game** list |

To move an avatar, open it on the library's **Avatars** tab and select the **Export** button.

## Where Your Data Lives
<!-- keywords: file location, save folder, appdata, indexeddb, cleared cookies, incognito, uninstall, path, directory, portable -->

Formamorph stores your data in the app's browser storage on your device. Nothing is stored on a server unless you publish it.

| Platform | Where the data is |
|---|---|
| 🌐 Web | The browser's storage for the site. Each browser and each site address keeps its own copy. Clearing the site's data in the browser erases it. |
| 🪟 Windows desktop | The `userdata` folder beside `Formamorph.exe`. AI models are in the `models` folder beside it, unless you choose a different folder. An update never changes either folder. |
| 🐧 Linux AppImage | The `userdata` folder beside the AppImage file |
| 🍎 macOS | The app's default data folder for your user account |
| 📱 Android | The app's own storage. When you remove the app from the device, Android erases this data. |

The web version asks the browser to keep its storage. A browser can still clear it, and a hosted copy of the app on a new address starts empty. Make a backup if your data matters to you.

On Windows and Linux, copy the whole folder to move your data to a new place.

## App Updates
<!-- keywords: release notes, whats new, changelog, stable or beta, check manually, forced to, rollback, failed to start, current version, web reload -->

### The Update Dialog

The desktop and Android apps check for updates on start, then every few hours. Select the version number at the bottom left of the main menu to open the dialog.

| Part | What it does |
|---|---|
| Title | **Update available —** and the version, **You're up to date**, or **Couldn't check for updates** |
| **Release channel** | **Stable** gets finished releases. **Pre-release** also gets beta builds. |
| Release notes | What changed in the new version |
| **Full changelog →** | Opens the full changelog |
| **Download** | Downloads the update. Shows when an update is available. |
| **Check for updates** | Checks again. Shows when no update is available. |

After the download, **Update & Restart** shows under the version number on desktop. On Windows, the app checks the download before it uses it. If the new Windows version fails to start, the app starts the old version again. The web version updates when you reload the page.

Your saves, worlds and settings stay the same through an update.

### The Update Required Dialog

**Update Formamorph** shows when a Community Creations feature needs a newer version of the app than you have. It names the feature and the version you run. Everything else keeps working.

| Button | What it does |
|---|---|
| **Update** | On the web, reloads the page. On desktop and Android, starts the download of the newest version. |
| **Not Now** | Closes the dialog. The feature stays off until you update. |

After the download, select **Update & Restart** on desktop or **Install** on Android, under the version number on the main menu. See [How to Update the Desktop App](#how-to-update-the-desktop-app).

### What's New

On the web, the version number at the bottom left of the main menu opens **What's new**. On a narrow screen, it is in the **More** menu at the bottom right. The dialog shows the notes of the latest release and a **Full changelog →** link.

## Related

- [🎮 How to Play](How-to-Play): the game menu and the **Logs** tab
- [⚙️ Settings](Settings): the **Autosave** setting and the **Data** tab
- [📚 Library](Library): import and export worlds, entities, dictionaries and avatars
- [📱 Install on Android](Install-on-Android): updates and exports on Android
