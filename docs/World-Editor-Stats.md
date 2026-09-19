# 📊 World Editor: Stats

> 🛠️ Part of the [World Editor](WorldEditor) guide.

Stats are the numbers that describe your player: health, coin, reputation, or anything your world needs. Each stat has a value between a **Min** and a **Max**. The AI reads your stats on every turn.

## Why it exists

Prose alone changes from turn to turn. A stat is a fact the AI must write around. It can't narrate a sprint across a rooftop while your Stamina reads 4/100, because the number contradicts it.

The narrator's prompt tells it to let stats change how an action turns out. A low stat shows as effort and cost. A high stat shows as ease. The prompt also tells the narrator not to list the stats or report their changes. A separate step changes the numbers.

## What the AI sees

Each stat's **Name** is always sent. The Stats chip in your prompt decides what is sent with it:

| Piece | Adds |
|---|---|
| **Values** | The current value and its maximum: `62/100`, or `62%` for a percentage stat |
| **Status** | The matching Stat Descriptor, a word for the current level |
| **Meaning** | The stat's **Description** |

With no piece selected, the line is only the stat's name.

> ⚠️ **Every active stat is sent on every turn.** Stats use your context budget all the time. Three stats that matter are better than twelve that don't.

## The panel

Select a stat to open its panel. In Advanced mode the panel has three tabs.

| Tab | Holds | Mode |
|---|---|---|
| **Details** | The fields below | Simple and Advanced |
| **Descriptors** | [Stat Descriptors](#stat-descriptors) | Advanced only |
| **Code** | [Dynamic Value Calculation](#dynamic-value-calculation) | Advanced only |

In Simple mode the panel shows the basic fields with no tabs.

## The fields

| Field | What it does |
|---|---|
| **Name** | The AI uses this name for the stat. The game also uses it to match stat changes to the stat. |
| **Type** | **Number** has a range you set. **Percentage** is fixed at 0–100 and shows everywhere as `N%`. All other fields work the same for both. |
| **Description** | What the stat represents. Sent to the AI when the chip's **Meaning** piece is on. Takes placeholder chips. |
| **Min** / **Max** | The range. The value always stays in it. A percentage stat locks these at 0 and 100, so you set only its **Initial Value (%)**. |
| **Initial Value** | Where the stat starts. |
| **Regen** | Added to the value one time per turn. A positive number heals over time, and a negative number drains. |
| **Body Sliders** | Binds body sliders to this stat. The value, from Min to Max, sets each slider's position. Each slider belongs to one stat only. |

### Availability

**Advanced mode only.** Two checkboxes:

| Checkbox | What it does |
|---|---|
| **Enabled** | Keeps the stat active. Uncheck it, and the stat stays inactive until a [trait](World-Editor-Traits#stat-availability) enables it. An inactive stat isn't shown to the player or sent to the AI. Its Regen and code don't run. |
| **Hidden** | Hides the stat from the player. The AI still reads it, and its Regen and code still run. Use it for dice rolls, cooldowns and other bookkeeping. |

### Prevent AI Changes

**Advanced mode only.** Four checkboxes stop the AI from changing a stat in one direction. Your world's own rules can still change it.

| Checkbox | Stops the AI from |
|---|---|
| **Don't Increase** | Raising the value |
| **Don't Decrease** | Lowering the value |
| **Don't Increase Max** | Raising the Max |
| **Don't Decrease Max** | Lowering the Max |

A percentage stat shows only the first two, because its Max is always 100.

## Stat Descriptors

A descriptor turns a number into a word, such as `Winded` or `Exhausted`. The AI gets that word when the chip's **Status** piece is on. A descriptor takes placeholder chips, so a band can name the rolled town or the rolled rival.

Each descriptor has a **threshold** and a **Description**. The coverage bar above the rows shows each band from Min to Max, and it marks where the stat starts. The range above your top band shows in red with the label "no status". In that range the AI gets no status. Each row says what it covers.

> ⚠️ **A threshold is the top of its band, and the lowest band that fits the value wins.** The game reads descriptors from low to high, in any list order. So `30 → Barren` covers Min–30, and a `60` row covers 31–60. Give your highest descriptor a threshold of your **Max**, or a value above it gets no descriptor.

### Thresholds in: Raw or % of Max

| Setting | A threshold of `3` on a 0–10 stat means | Raise Max to 20, and |
|---|---|---|
| **Raw** (default) | The value 3 | The band still ends at 3 |
| **% of Max** | 3% of the range from Min to Max: the value 0.3 | The band rescales to 0.6 |

- **Raw** is for counters: "3 rockets is low".
- **% of Max** is for proportions: "the bottom 30% is low".

When you switch, your numbers convert, so no band moves. The choice only changes what happens the next time you change the range. A percentage stat has no switch, because both settings give the same number on 0–100.

### Pins on a descriptor

Each descriptor row has a pin button. A pin keeps a [placeholder](World-Editor-Placeholders) at one value while the stat is in that band.

## Dynamic Value Calculation

The **Code** tab holds two code boxes. Each box takes JavaScript, and each has its own **Test Code** button and **Templates** menu.

| Box | Runs |
|---|---|
| **Before the AI** | Before the prompt is built |
| **After the AI** | After the AI's stat changes and Regen apply |

The turn order is: Before the AI, the AI's stat changes, Regen, After the AI. An empty box is skipped, and the manual value stays.

Code can do four things:

- Set this stat's value, Min, Max or Regen. A returned number sets the value.
- Pin or unpin a placeholder
- Switch a trait on or off
- Read every stat, every trait, every placeholder and the story clock

The code runs in an isolated sandbox with no page and no network. The editor suggests the names you can use as you type, and it underlines unknown names. **Test Code** runs one box and shows the result, the warnings and the errors.

> ⚠️ **Code that sets the value overwrites the AI.** The value is set again on every turn, so the AI's change to it is lost. The AI still reads the value and the description.

> 📘 Full reference: [Stat Code Guide](StatCodeGuide).

## Getting started

Start with two or three stats your story depends on. Give each a Min, a Max and two descriptors. Add Regen, **Prevent AI Changes** and code only when a stat needs behavior the AI shouldn't invent.
