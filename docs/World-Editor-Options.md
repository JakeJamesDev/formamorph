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
   - **Preset**: the player picks one value, and it sets other Options for them. See [How to Set Up a Preset](#how-to-set-up-a-preset).
5. Optional: write a **Player-Facing Description**. The player reads it under the Option.

Drag an Option in the list to change the order the player sees.

## How to Set Up Each Type
<!-- keywords: values, default, minimum, maximum, step, range, on off, checkbox, slider, radio -->

| Type | Fields |
|---|---|
| **Choice** | One box per value. **Default** marks the value a new game starts on. **Add Value** adds one more. |
| **On or Off** | **Default** is **On** or **Off**. |
| **Number** | **Minimum**, **Maximum**, **Step** and **Default**. All are whole numbers. The slider moves by **Step**. |

## How to Set Up a Preset
<!-- keywords: preset, bundle, start, difficulty, hardcore, default start, one click, several options at once -->

A Preset sets several Options, traits, the persona and the Starting Location in one click, such as a **Hardcore** start that turns every hard rule on.

1. Set the Option's **Type** to **Preset**.
2. Pick what happens to the **Other Choices**:
   - **Reset to Defaults**: a value resets every Option and trait it doesn't set to its default.
   - **Keep as Set**: a value changes only what it sets.
3. For each value, write a name and a description. The player reads both.
4. Select **Add Row**, then pick a target and its value:
   - An **Option** shown to the player, and the value to set it to.
   - A world trait or an entity's trait, turned **On** or **Off**. Traits the player can't toggle, such as **Always On** ones, aren't listed.
   - **Persona**, and one of the world's personas. The player's own personas aren't listed.
   - **Starting Location**, and a starting location or a place where one of the world's personas starts.

**Reset to Defaults** never resets the persona or the Starting Location. They change only when a row sets them.

A **Persona** row works like the player's own pick: the Starting Location moves to that persona's start, unless the player chose a location by hand. A **Starting Location** row is set last and wins over that move. If the location isn't offered for the persona and Options the value leaves, the row is skipped.

A value wins against the player's other picks, whatever order they were made in:

- 🔄 A trait in a pick-one category replaces the current pick.
- 🚫 A pick that blocks a trait the value turns on is turned off. It comes back when nothing blocks it.
- 📦 A full category drops the player's latest picks to make room.

The player sees a notice of what the value turned on and off, and of a new persona or Starting Location. If a row can't apply, such as a trait whose requirements still fail, the notice names it and the rest still apply.

⚠️ A value shows **Can't apply** when some of its rows fail on a new game's starting setup. It names each row the way the row reads, such as **Wolf: Feral** or **Persona: Mira**. A row fails when:

- Its trait is **Always On** or **Hidden**, or a requirement blocks it.
- Two rows block each other, or the rows pick more traits than their category allows.
- Its entity isn't in the story at the start, such as a Persona-Only entity the player doesn't play.
- It sets a hidden Option, another Preset, or a value the Option no longer has.
- Its persona is no longer marked as one, or the Starting Location step wouldn't offer its location.
- You deleted its trait, Option, persona or location. The warning counts these, such as **2 deleted traits**.

The player's radio stays on a value while the setup still matches it. If the player changes something the value set, the radio clears.

> 💡 A Preset holds nothing of its own. Requirements, pins and scripts never see it, and it never shows during play.

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

A Preset has neither field. It always shows when a new game starts and never during play.

## What a Save Keeps
<!-- keywords: old save, new option added later, default value, missing value -->

A save keeps the value of each Option. A save made before you added an Option starts that Option on its **Default**. So does a save whose value the Option no longer has, such as a deleted choice value.
