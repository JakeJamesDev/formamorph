# 🛠️ World Editor
<!-- keywords: build my own game, worldbuilding, scenario maker, create a setting, campaign creator, write own adventure -->
<!-- route: worldEditor -->

A guide to each tab in the World Editor: what it does, why it exists, and the settings that aren't clear from the screen.

> 💡 Every tab has a **?** button with a short version of its page. It sits in the header row, right of the **Find and replace** button. These pages are the long version.

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
2. In the header, select **Simple** or **Advanced**.

The app remembers your pick for every world. You can't switch while the Authoring Tour runs.

## How to Find and Replace Text
<!-- keywords: search, ctrl+f, rename everywhere, change all, swap a word, bulk rename, substitute, ctrl+h, mass edit, fix typo everywhere, global rename -->
<!-- route: worldEditor#find-button -->

1. Select the magnifier button in the header, or press **Ctrl+F**. Press **Ctrl+H** to open it with the replace row.
2. Type in the **Find** box. Select **Match case** or **Match whole word** to narrow the search.
3. Select **Next match** or **Previous match** to go through the results. The editor opens each one on its tab.
4. To replace, open the replace row and type in the **Replace** box.
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

To save and stay in the editor, select **Save** at the bottom right.

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

Each tab's page says which of its fields Simple mode hides. When a world uses a field Simple mode hides, a dot shows on **Advanced**.

Switching to Simple mode doesn't remove anything. The hidden fields keep their values, and the AI still reads them.

## Find and Replace
<!-- keywords: swap text for chip, keyboard shortcuts, skip to next result, turn word into variable, undo a swap, confirm bulk change, shift+enter -->

The find bar searches the whole world, on every tab the current mode shows. It matches chips by their label, name or values.

- **Enter** goes to the next match. **Shift+Enter** goes to the previous one. **Esc** closes the bar.
- **Replace all** asks first, and says how many matches and fields it changes.
- A chip can't be replaced as text. Change it from its pop-out.
- A field that can't hold a chip is skipped when you replace text with a placeholder.

In Advanced mode, the replace row can put a placeholder chip in place of text. Select the swap button, then pick a placeholder in **Choose Placeholder**.

To undo a replace, exit without saving. That also drops your other changes since the last save.

## The Authoring Tour
<!-- keywords: wizard, guided setup, use example button, next button stuck, end early, first world helper, in play pane, resume lesson -->
<!-- route: worldEditorTour.world-name -->

The Authoring Tour builds a new world with you, one field at a time. It runs in Simple mode.

The tour first shows as an offer: **Take the Authoring Tour?** Select **Start Tour** or **No Thanks**.

Each step points at one field. Fill it, or select **Use Example**, then select **Next**. **Next** waits until the field has a value. On desktop, the **In Play** pane shows where the field appears in play and what each prompt reads from it.

The tour goes through the tabs in order: **Overview**, **Locations**, **Entities**, **Stats**, **Traits** and **Dictionary**. Its last steps show the **Advanced** switch and the Test Bench. Then select **Finish**, or **Play** to enter your world.

- Each **Next** saves the world.
- **End Tour** in the tour bar stops the tour. **Back to Tour** returns you to the current step.
- If you delete an item the tour made, the tour goes back to the step that made it.

## Saving and Discarding
<!-- keywords: does it autosave, edits not kept, work disappeared, prompt on closing, new world vanished, manual saving, confirm exit -->

Your edits stay in the editor until you select **Save**. Nothing saves by itself, except the Authoring Tour's steps. A new world isn't stored until its first save.

When you leave with unsaved changes, the **Unsaved changes** dialog asks what to do:

- **Save & Exit** saves, then closes the editor.
- **Exit Without Saving** discards every change since the last save.
- **Cancel** keeps you in the editor.

## Help Buttons
<!-- keywords: question mark, info icon, explain this tab, colored icon, short reference -->

Every tab has a **?** button in the header row, right of the **Find and replace** button. It opens a short help window for that tab. **Learn more** opens the tab's page in this guide.

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
