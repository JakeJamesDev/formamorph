# 🛠️ World Editor
<!-- keywords: build my own game, worldbuilding, scenario maker, create a setting, campaign creator, write own adventure -->
<!-- route: worldEditor -->

A guide to each tab in the World Editor: what it does, why it exists, and the settings that aren't clear from the screen.

On desktop, pick a tab from the rail on the left side of the list. **Overview** stands alone at the top. Lines split Stats, Entities, Locations and Traits from Dictionary and Placeholders.

- Select **Collapse** at the foot of the rail to show only icons. Point at an icon to see its tab's name. The editor remembers your choice on this device.
- When the list is narrow, in a small window or after you drag the divider, the rail shows only icons until there's room again.
- While the Test Bench is in the list's place, the rail's tabs are unavailable.

On desktop, the bar at the top of the editor holds the controls that act on the whole world:

| Where | What |
| --- | --- |
| Left | The back arrow, **World Editor**, and the world's name |
| Center | The **Search World** box |
| Right | The **Undo**, **Redo** and **History** controls, the mode select, **Optimize Images** (Advanced mode only), the Test Bench, and **Save** |

**Save** has an arrow beside it. Select the arrow to open a menu with **Export World** and the **Auto Save** checkbox, in both modes. The arrow works when **Save** is dim. In Advanced mode, **Optimize Images** is an icon button. It shows a spinner while it runs, and its tooltip shows the progress. The footer under the list holds only the tab's own actions, on Entities and Dictionary.

On mobile, the header holds the back arrow and the mode select. At the right are **History**, the Test Bench and **Find and replace**. Select **Sections** under the header to pick a tab. The list has the rail's order and lines: **Overview** alone, then Stats, Entities, Locations and Traits, then Dictionary and Placeholders. The footer holds **Save to Library** on Entities and Dictionary. At its right are **Optimize Images** (Advanced mode only) and the **Save** icon with its arrow. The arrow opens **Export World** and **Auto Save**.

Each tab has its own page.

| Page | Covers |
|---|---|
| [🌍 Overview](World-Editor-Overview) | The world's name, card, avatar, music and AI-facing text |
| [🎬 Openings](World-Editor-Openings) | The ways a playthrough can start, on the world, each location and each entity |
| [📊 Stats](World-Editor-Stats) | The numbers that describe the player |
| [🎭 Entities](World-Editor-Entities) | The people, creatures and things in your world |
| [🗺️ Locations](World-Editor-Locations) | The places, and how the story moves between them |
| [🧬 Traits](World-Editor-Traits) | The choices a player makes before the story starts |
| [📖 Dictionary](World-Editor-Dictionary) | Lore that reaches the AI only when a keyword brings it up |
| [🧩 Placeholders](World-Editor-Placeholders) | Reusable text that can change with each playthrough |

To check a world before you play it, see [🧪 Test Bench](Test-Bench).

## How to Switch Editor Mode
<!-- keywords: simple, advanced, more options, hidden settings, show all, expert, tab is missing, fields not showing, beginner view, basic layout, unlock extra tabs, power user, fewer options -->
<!-- route: worldEditor#editor-mode -->

1. Open a world in the World Editor.
2. On desktop, open the mode select in the bar at the top and pick **Simple** or **Advanced**. On mobile, select **Simple** or **Advanced** in the header.

The app remembers your pick for every world. You can't switch while the Authoring Tour runs.

## How to Find and Replace Text
<!-- keywords: search, ctrl+f, rename everywhere, change all, swap a word, bulk rename, substitute, ctrl+h, mass edit, fix typo everywhere, global rename -->
<!-- route: worldEditor#find-button -->

1. On desktop, type in the **Search World** box at the top of the editor, or press **Ctrl+F** to go to it. On mobile, select the magnifier button in the header.
2. Select **Next match** or **Previous match** to go through the results. The editor opens each one on its tab.
3. To narrow the search or to replace, select **Show options and replace** at the end of the box, or press **Ctrl+H**. On mobile, open the replace row.
4. Select **Match case** or **Match whole word** to narrow the search. Type the new text in the **Replace** box.
5. Select **Replace** for this match, or **Replace all** for every match.

## How to Restart the Authoring Tour
<!-- keywords: tutorial, guide, walkthrough, help, intro, learn, onboarding, show me around, beginner lesson -->
<!-- route: settings.data#start-authoring-tour -->

1. Open **Settings**, then select the **Data** tab.
2. Under **Authoring**, select **Start Authoring Tour**.

The tour opens the World Editor on a new world. Your other worlds don't change.

## How to Save or Discard Your Changes
<!-- keywords: unsaved, cancel, undo, exit, leave, throw away, revert, keep, lost my work, close without storing, back out, abandon edits, quit editor, apply edits, back arrow -->
<!-- route: worldEditor -->

1. Select the back arrow at the top left of the editor.
2. In the **Unsaved changes** dialog, select **Save & Exit** to keep your changes. Select **Exit Without Saving** to discard them.

To save and stay in the editor, select **Save**. On desktop it's at the right end of the bar at the top. On mobile it's at the bottom right. You can also press **Ctrl+S** (**Cmd+S** on a Mac).

## How to Undo and Redo
<!-- keywords: undo, redo, ctrl+z, ctrl+y, cmd+z, take back an edit, deleted by mistake, wrong delete, oops, go back one change, revert a change, step back, restore a deleted item, history list, jump back to an earlier point, undo button -->
<!-- route: worldEditor#history -->

1. Press **Ctrl+Z** to undo your last edit.
2. Press **Ctrl+Y** or **Ctrl+Shift+Z** to redo it.

On a Mac, use **Cmd** in place of **Ctrl**.

You can also use the buttons. On desktop, select **Undo** or **Redo** in the bar at the top. On mobile, select **History** in the header, then select **Undo** or **Redo**.

To go back more than one edit, open the list. On desktop, select the arrow beside **Redo**. On mobile, select **History**. Then select a row. The editor moves your world to that point.

## Undo, Redo and History
<!-- keywords: step, steps, how many edits can I undo, undo limit, 100 steps, saved marker, world opened, dimmed rows, undone steps, undo after save, undo typing, undo in a text field, undo does nothing, undo disabled, what cannot be undone, undo a drag, undo a delete, undo optimize images, redo lost, history clears -->

Every change you make to your world is a **Step**. The editor keeps your last 100 Steps for the world you have open.

### What makes one Step

- A run of typing in one field is one Step. A pause of one second ends it.
- A drag is one Step from press to release. This covers boxes on the Locations Canvas, sliders and color pickers.
- A change that touches several things is one Step. Removing a trait and its Links is one Step. So is **Optimize Images**.
- A reorder is one Step.

### What undo brings back

Undo covers every list in the world and the settings on the **Overview** tab. It also covers the images, thumbnails, 3D models and music you add or remove. An undone removal puts the item back in its old place in the list. An edit you made to another item since then is kept.

After an undo or redo, the editor opens the tab of the item it changed and selects the item. If the item is gone, the tab clears its selection. A Connection opens the **Locations** tab. A setting opens the **Overview** tab.

### The History list

The list shows your edits from oldest to newest.

- **World opened** is always the first row. Select it to return to the world as you loaded it.
- Each row names the action, the type, the item and the field, such as **Edit Stat Hunger: Description** or **Remove Location Docks**.
- **Now** marks the current Step.
- Undone Steps show dimmed below it. Select one to redo up to that Step.
- **Saved** marks the Step you last saved.

An edit after an undo erases the undone Steps. The list never branches.

### Saving and history

**Save** keeps your history. You can undo past the last save. The world then counts as unsaved again, and **Save** turns on. Undo back to the saved point, and **Save** turns off.

An auto save doesn't move **Saved** and doesn't split a Step. Text you type across an auto save still undoes in one step.

### Text fields

In a prompt field, **Ctrl+Z** undoes your typing in that field first. When the field has nothing left to undo, the next press undoes the world. A record's name is a prompt field too.

Some fields that hold world data are plain boxes, such as number boxes and the world's name and author. In these, **Ctrl+Z** undoes through the world. The field and the list then show the same text. In a filter box or **Search World**, **Ctrl+Z** works as it does in any browser box. While you compose text with an input method editor, the editor ignores **Ctrl+Z**.

### When undo is off

- The editor ignores **Ctrl+Z** and **Ctrl+Y** while a dialog is open over it.
- While the Authoring Tour runs, the editor records your edits. **Undo**, **Redo** and **History** are off until the tour ends.

### What undo does not cover

- Editor preferences: snap, grid, pane widths, the rail, the mode and your selection.
- Edits in the library's entity and dictionary editors.

History works while the editor is open during play. It clears when you close the editor or open another world.

## Editor Modes
<!-- keywords: difference between views, which tabs hidden, dot on button, lose data switching, stripped down, full feature set, default view -->

The World Editor has two modes. **Simple** is the default.

- **Simple** shows the fields a new world needs. It hides the **Placeholders** tab, the placeholder bar and **Optimize Images**.
- **Advanced** shows every field.

Simple mode also hides these panel tabs:

| Panel | Hidden tabs |
|---|---|
| Entity | **Traits**, **Placeholders**, **Openings** |
| Location | **Pins**, **Openings** |
| Stat | **Descriptors**, **Code** |
| Trait | **Pins** |
| Dictionary entry | **Matching** |
| Dictionary book | **Placeholders** |

Each tab's page says which of its fields Simple mode hides. When a world uses a field Simple mode hides, a dot shows on the mode control.

Switching to Simple mode doesn't remove anything. The hidden fields keep their values, and the AI still reads them.

## Find and Replace
<!-- keywords: swap text for chip, keyboard shortcuts, skip to next result, turn word into variable, undo a swap, confirm bulk change, shift+enter -->
<!-- route: replaceAll -->

A search covers the whole world, on every tab the current mode shows. It matches chips by their label, name or values.

- **Enter** goes to the next match. **Shift+Enter** goes to the previous one. **Esc** clears the search, or closes the bar on mobile.
- On desktop, **Show options and replace** opens the full bar over the top of the editor. **Collapse to search** folds it back and keeps your search. **Close Search** clears your search and folds the bar back.
- Select the **X** button in a box to empty it and keep typing.
- **Match case** and **Match whole word** stay on when you fold the bar back. An icon in the box shows each one that's on. Select it to open the options.
- **Replace all** asks first, and says how many matches and fields it changes.
- A chip can't be replaced as text. Change it from its pop-out.
- A field that can't hold a chip is skipped when you replace text with a placeholder.

In Advanced mode, the replace row can put a placeholder chip in place of text. Select the swap button, then pick a placeholder in **Choose Placeholder**.

To undo a replace, pick an earlier row in [History](#undo-redo-and-history).

## The Authoring Tour
<!-- keywords: wizard, guided setup, use example button, next button stuck, end early, first world helper, in game pane, resume lesson -->
<!-- route: worldEditorTour.world-name -->

The Authoring Tour builds a new world with you, one field at a time. It runs in Simple mode.

The tour first shows as an offer: **Take the Authoring Tour?** Select **Start Tour** or **No Thanks**.

Each step points at one field. Fill it, or select **Use Example**, then select **Next**. **Next** waits until the field has a value. On desktop, the **In Game** pane shows where the field appears in the game and what each prompt reads from it.

The tour goes through the tabs in order: **Overview**, **Locations**, **Entities**, **Stats**, **Traits** and **Dictionary**. Its last steps show the mode control and the Test Bench. Then select **Finish**, or **Play** to enter your world.

- Each **Next** saves the world.
- **End Tour** in the tour bar stops the tour. **Back to Tour** returns you to the current step.
- If you delete an item the tour made, the tour goes back to the step that made it.

## Saving and Discarding
<!-- keywords: does it autosave, auto save, turn off autosave, edits not kept, work disappeared, prompt on closing, new world vanished, manual saving, confirm exit -->

With **Auto Save** on, the editor saves your world by itself:

- After about 300 characters of typing, or about 30 actions such as a toggle, an add or a delete.
- After a pause with no edit, when any change is not saved. The pause is 30 seconds by default. To change it, use **Auto Save Pause** in [Settings](Settings#authoring). The pause can be 10 seconds to 5 minutes.

**Save** and **Ctrl+S** still save at once. A new world isn't stored until you save it once yourself. After that, it auto saves too. A world that comes with Formamorph also waits for one save by you. Until then, it keeps getting the updates that come with the app. Auto save waits while the Authoring Tour runs, because each **Next** saves the world.

**Auto Save** is on by default and applies to every world. To turn it off, select the arrow beside **Save**, then clear **Auto Save**. You can also clear **Auto Save** under **Authoring** in Settings. With it off, your edits stay in the editor until you select **Save**.

If an auto save fails, a message says why and **Save** shows **Failed**. Auto save then stops until a save that you start works.

On desktop, **Save** in the bar at the top is on when you have changes to save and off when you don't.

**Save** shows how a save goes:

| Save shows | Meaning |
|---|---|
| ⏳ **Saving…** | The save is running. |
| ✅ **Saved** | The save worked. After about 2 seconds, **Save** turns dim again. |
| ⚠️ **Failed**, in red | The save didn't work. A message says why. Select **Failed** to try again. It stays until a save works. |

On mobile, the **Save** icon changes the same way, without the words.

When you leave with unsaved changes, the **Unsaved changes** dialog asks what to do:

- **Save & Exit** saves, then closes the editor.
- **Exit Without Saving** discards every change since the last save.
- **Cancel** keeps you in the editor.

## Help Buttons
<!-- keywords: question mark, info icon, explain this section, colored icon, short reference -->

Some sections have a **?** button beside their name, such as **Aliases** and **Dynamic Value Calculation**. It opens a short help window for that section. **Learn more** opens the full page.

A **?** you haven't opened yet shows in the accent color.

---

## Overview

The world's own tab: its name, description, thumbnail and the AI-facing text that frames every turn.

➡️ [World Editor: Overview](World-Editor-Overview)

## Openings

An opening is one way a playthrough can start. The world, each location and each entity can have their own. A playable entity can have Self openings for a player who plays it.

➡️ [World Editor: Openings](World-Editor-Openings)

## Stats

The numbers that describe your player. The AI sees them on every turn.

➡️ [World Editor: Stats](World-Editor-Stats)

## Entities

The people, creatures and things that populate your world.

➡️ [World Editor: Entities](World-Editor-Entities)

## Locations

The places your story happens, and where the story can take the player.

➡️ [World Editor: Locations](World-Editor-Locations)

## Traits

The choices that make one playthrough different from the next.

➡️ [World Editor: Traits](World-Editor-Traits)

## Dictionary

Your world's lorebook. An entry reaches the AI when one of its keywords appears.

➡️ [World Editor: Dictionary](World-Editor-Dictionary)

## Placeholders

Reusable bits of world text you define once and place as chips.

➡️ [World Editor: Placeholders](World-Editor-Placeholders)
