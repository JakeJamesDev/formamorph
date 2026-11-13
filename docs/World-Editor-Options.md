# 🔘 World Editor: Options
<!-- keywords: world settings, game settings, setup choices, difficulty, toggles, switches, new game options, player choices, sliders -->
<!-- route: worldEditor.options -->

> 🛠️ Part of the [World Editor](WorldEditor) guide.

World Options are choices the player makes about the world itself when a new game starts: how long replies run, whether a rule is on, how strong something is. They sit above the traits on the [Enter World dialog](Starting-a-Game#the-enter-world-dialog).

## Why it exists
<!-- keywords: versus traits, difference between, when to use, no ai text, setup not character -->

A trait describes a character. An Option describes how the world is set up. Use an Option when the choice isn't about who the player is, like a reply length or a story style.

> 💡 **An Option never sends text to the AI.** It changes the world only through its [placeholder pins](World-Editor-Placeholders). Every text that uses a pinned placeholder then reads the pinned value.

## How to Add an Option
<!-- keywords: create, new, make, add setting, add switch -->
<!-- route: worldEditor.options#list-toolbar -->

1. Open the **Options** tab.
2. To name the Option as you add it, type the name in the search box.
3. Select **Add Option**. The new Option opens with its fields.
4. Pick a **Type**:
   - **Choice**: the player picks one of named values.
   - **On or Off**: the player turns it on or off.
   - **Number**: the player picks a whole number with a slider.
5. Optional: write a **Player-Facing Description**. The player reads it under the Option.

Drag an Option in the list to change the order the player sees.

## How to Set Up Each Type
<!-- keywords: values, default, minimum, maximum, step, range, on off, checkbox, slider, radio -->

| Type | Fields |
|---|---|
| **Choice** | One box per value. **Default** marks the value a new game starts on. **Add Value** adds one more. |
| **On or Off** | **Default** is **On** or **Off**. |
| **Number** | **Minimum**, **Maximum**, **Step** and **Default**. All are whole numbers. The slider moves by **Step**. |

## How to Make an Option Change Text
<!-- keywords: change wording, switch text, prompt text, style, reply length -->

1. Make a [placeholder](World-Editor-Placeholders) that holds each version of the text.
2. Put the placeholder in your text as a chip.
3. On the Option, under a choice value, or under **Placeholder Pins When On** or **When Off**, select **Add Placeholder Pin**.
4. Pick the placeholder and the value it should read.

A Number Option has no pins.

When a trait and an Option pin the same placeholder, the trait wins. An Option wins over a placeholder value's own pins. The placeholder's **Pins** tab lists every Option pin aimed at it.

## Shown to Player and Changeable During Play
<!-- keywords: hidden option, internal flag, secret, mid game, change later, during play -->

| Field | Off | On |
|---|---|---|
| **Shown to Player** | The player never sees the Option. It still pins placeholders and opens [requirements](World-Editor-Traits#world-option-conditions), and a [script](Scripts-Reference#world-options) can set it. | The Option shows on the **Enter World** dialog. |
| **Changeable During Play** | The player sets it only when the game starts. | The player can change it during play too, on the **World Options** tab of the game's right panel. See [How to Change a World Option](How-to-Play#how-to-change-a-world-option). An Option that is not shown never has a tab entry. |

## What a Save Keeps
<!-- keywords: old save, new option added later, default value, missing value -->

A save keeps the value of each Option. A save made before you added an Option starts that Option on its **Default**. So does a save whose value the Option no longer has, such as a deleted choice value.
