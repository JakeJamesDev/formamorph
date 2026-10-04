# 🚪 Starting a Game
<!-- keywords: character creation, setup screen, new playthrough, before the story, first steps, campaign -->

A new game starts at **Enter World**. One dialog holds every choice before page one: who you play, your starting traits, where you start, and what you add from your library.

> After the story starts, see [How to Play](How-to-Play).

## How to Start a Game
<!-- keywords: play, new, begin, enter, launch, new story, new run, playthrough, adventure, campaign, scenario, restart from scratch, open a world, fresh save -->
<!-- route: mainMenu.worlds -->

1. On the main menu, open the library's **Worlds** tab and select a world. The world dialog opens.
2. Select **Enter World**.
3. If the world has an **Introduction**, read it and close it.
4. In the **Enter World** dialog, select each category in the list on the left and make your picks. The categories are in [The Enter World Dialog](#the-enter-world-dialog).
5. Select **Start game**. In a world with a 3D model, the button reads **Continue to Avatar**, and the avatar step comes next.

A world with nothing to choose skips the **Enter World** dialog.

For the **Persona** category, see [How to Pick a Persona](Personas#how-to-pick-a-persona). To add entities from your library, see [How to Add Your Own Entities to a Game](Entities#how-to-add-your-own-entities-to-a-game).

## How to Start with the Defaults
<!-- keywords: quick, skip, fast, jump in, random, no setup, instant play, one click, bypass creation, just play, auto pick, straight in, without choosing -->
<!-- route: mainMenu.worlds -->

1. On the main menu, select a world.
2. Select **Quick Start**. In portrait it is the icon beside **Enter World**.

**Quick Start** skips the **Introduction** and the **Enter World** dialog. You get the persona that **Enter World** picks first. You also get the author's default traits and a random starting location. When the persona is one of the world's own entities, you start at its location. No library additions come in, and the world's own dictionaries are on.

## How to Pick Starting Traits
<!-- keywords: choose, character creation, options, class, race, perks, background, skills, abilities, attributes, species, feats, start button disabled, greyed out, customize character -->
<!-- route: enterWorld -->

1. In the **Enter World** dialog, open a category under **Starting Traits**.
2. Select the traits you want. A round button allows one pick in its group; a checkbox allows several.
3. Do the same for each category under **Starting Traits**. The category list shows how many traits you picked out of those shown, such as **1/3**.

**Start game** stays off until every group has its minimum picks. A group that is short shows *Choose 1 more trait*.

## How to Pick a Starting Location
<!-- keywords: choose, spawn, begin, random, place, starting area, first room, initial zone, start point, where do i start, home town, origin -->
<!-- route: enterWorld -->

1. In the **Enter World** dialog, open **Starting Location**.
2. Select a location, or **Random** to let the world choose.

## How to Choose a Game's Dictionaries
<!-- keywords: lorebooks, include, order, library additions, enable, world info, codex, reorder, priority, remember my picks, disable, extra knowledge -->
<!-- route: enterWorld -->

1. In the **Enter World** dialog, open **Library Additions**.
2. Under **Dictionaries**, select the checkbox of each dictionary this game should use. Clear one to leave it out.
3. To change the order, drag a row by its grip, or select it and use **Move Up** or **Move Down**.
4. To start future games in this world with the same picks, select **Remember Additions**.

## How to Read the Introduction Again
<!-- keywords: readme, intro, show, see, info, description, author message, welcome text, reopen, missed it, stop popup, world notes, hide on entry, creator instructions -->
<!-- route: enterWorld -->

1. Select **Enter World** on the world.
2. In the **Enter World** dialog, select **Introduction** at the top.

To stop the **Introduction** and the in-game **Readme** from showing on entry, select **Don't Show This Again** in either one. The **Show Readme on entry** checkbox in the world dialog turns them back on.

---

## The World Dialog
<!-- keywords: details popup, clone, copy a scenario, make offline, world page, edit button, author and date, disable custom prompt -->

Select a world in the library to open it. The dialog shows the world's author and dates, and these buttons:

| Button | What it does |
|---|---|
| **Enter World** | Starts a new game, through the choices on this page |
| **Quick Start** | Starts a new game with the defaults. See [How to Start with the Defaults](#how-to-start-with-the-defaults). |
| **Edit World** | Opens the [World Editor](WorldEditor) |
| **Duplicate World** | Makes a copy of the world |
| **Export World** | Saves the world as a file |
| **Make Available Offline** | Downloads the world's linked images. Shows only for a world that has them. |
| **Publish World** | Publishes the world to Community Creations. Shows when you are logged in. |

Under the buttons:

- **Use this world's prompt** (or **prompts**) shows when the world brings its own prompts. Clear it to play with your own.
- **Show Readme on entry** shows when the world has an **Introduction** or a **Readme**.

> [!NOTE]
> When its author removed a source the world requires, **Enter World** and **Quick Start** are off. See [While a Source Is Missing](LinkedContent#while-a-source-is-missing).

## The Enter World Dialog
<!-- keywords: setup screen, pre game menu, new game options, categories button, skipped, nothing to choose, back out, creation screen -->
<!-- route: enterWorld -->

The dialog shows the world's name at the top and a category list on the left. On a narrow screen, a **Categories** button shows the list.

| Category | What you pick | Shows when |
|---|---|---|
| **Persona** | Who you play | The world or your library has a persona to pick, or the world has a **Custom Persona** |
| **Starting Traits** | One category per trait group, and one per entity whose traits you set | The world has traits you can pick |
| **Starting Location** | Where the story begins | The world offers more than one starting location |
| **Library Additions** | Entities and dictionaries for this game | Your library has something to add, or the world has dictionaries |

The dialog opens on the first category. **Cancel** leaves without starting. **Escape** does the same.

## Starting Traits
<!-- keywords: padlock, locked option, unable to unselect, radio button, stat bonus, companion, prerequisite, turned off automatically, default picks -->

**General** holds the world's own traits for you. Each trait group with traits to pick gets its own category.

An entity whose traits you set gets a category with its portrait and name. Your own entity is marked **You**. This is how a world lets you pick a companion's traits, or the race and class of a [Custom Persona](Personas#create-your-own).

| You see | What it means |
|---|---|
| A round button | Pick one. Select it again to clear it. |
| A checkbox | Pick several. When the group is full, the rest turn off. |
| A check mark with no control | **Always On**. The trait is on and you can't change it. |
| A lock and *Requires …* | The trait needs another trait first. Pick one it names and it unlocks. |
| A lock and *Locked* | The trait needs only traits you can't see |
| *Unlocked by …* | The trait you picked that opened it |
| A stat line, such as *Strength: +2* | What the trait does to a stat |

A world can have **Hidden** traits. They work like **Always On** traits, and they never show in the list.

When one pick switches other traits off, a notice names them: *Turned off …, because of …*. Select **Dismiss** to close it.

The author's defaults start picked.

## Starting Location
<!-- keywords: spawn point, random start, begin somewhere else, picked for me, first scene place, home base -->

The list shows **Random** first, then each starting location with its description.

| Pick | Where you start |
|---|---|
| A location | That location |
| **Random** | Any starting location, at random |

When you play one of the world's own entities, its starting location is picked for you. You can pick another. After you pick a location yourself, a persona change no longer moves it.

## Library Additions
<!-- keywords: bring my character, extra npc, companion, mods, custom content, lorebook order, remember for next time, tag meaning, include my own -->

The category has a search box and two lists.

| List | What it holds | Starts |
|---|---|---|
| **Entities** | Entities from your library. Each one you include joins the game at your starting location. See [Entities in Play](Entities). | Excluded |
| **Dictionaries** | The world's own dictionaries, then the ones in your library | The world's on as the author set them; yours off |

Select a row to read it in the details pane. A dictionary row's tag says where it comes from: **World** for one bundled with the world, **Library** for one of yours, **Linked** for the world's copy of a library dictionary.

The dictionary order is the order the AI reads them in. **Remember Additions** saves both lists as this world's defaults on this device.

> [!NOTE]
> One entity has one role per game. A persona you pick leaves the **Entities** list, and an entity you add leaves the persona list.

## The Introduction
<!-- keywords: preface, foreword, author note, welcome popup, readme difference, before setup -->

An author can write an **Introduction** for the world. It opens before the **Enter World** dialog, over it. The in-game **Readme** is a different text. It opens after the game starts.

## The Avatar Step
<!-- keywords: 3d model, appearance, body sliders, finalize, vrm, how i look, continue button -->

In a world with a 3D model, **Continue to Avatar** opens **Character Customization**. Pick a **Player Avatar**, adjust it, and select **Finalize Character** to start. **Back** returns to the **Enter World** dialog. See [Character Customization](Avatars#character-customization).

## What Happens at Start
<!-- keywords: first turn, opening scene, prefilled text, already typed, first message, greeting, popups, intro scene -->

The game applies your picks, then draws one opening:

- An **Opening Narration** becomes page one at once.
- An **Opening Action** fills your action box. Edit it if you like, then send it.

[How a Game Opens](Entities#how-a-game-opens) explains which openings can come up for your picks.

Then, in order, these can open:

1. A setup dialog, when the game can't reach your AI. See [The Set Up Your AI Dialog](Connect-Your-Own-AI#the-set-up-your-ai-dialog).
2. **You're Playing on the Demo AI**, on your first game on the Demo AI. See [The Demo AI Notice](How-to-Play#the-demo-ai-notice).
3. The world's **Readme**, when it has one.

## The Welcome Animation
<!-- keywords: splash screen, logo, startup, title sequence, boot screen, see it again -->
<!-- route: intro -->

The first time you open Formamorph, a short animation spells out the name, then fades into the main menu. To see it again, select the **©** line at the bottom of the main menu. Its tooltip reads **Replay intro**.

## Related

- [🎮 How to Play](How-to-Play): what you do once the story starts
- [🪪 Personas](Personas): who you are in the story
- [🎭 Entities in Play](Entities): the cast, Library Additions and how a game opens
- [🎬 World Editor: Openings](World-Editor-Openings): how authors write openings
