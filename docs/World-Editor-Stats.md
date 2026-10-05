# 📊 World Editor: Stats
<!-- keywords: gauges, meters, hit points, mana, gold, score, resource bars, numbers -->
<!-- route: worldEditor.stats -->

> 🛠️ Part of the [World Editor](WorldEditor) guide.

Stats are the numbers that describe your player: health, coin, reputation, or anything your world needs. Each stat has a value between a **Min** and a **Max**. The AI reads your stats on every turn.

## Why it exists
<!-- keywords: point of meters, do numbers affect story, narrator ignores values, consequences, low energy effects, narrator lists numbers -->

Prose alone changes from turn to turn. A stat is a fact the AI must write around. It can't narrate a sprint across a rooftop while your Stamina reads 4/100, because the number contradicts it.

The narrator's prompt tells it to let stats change how an action turns out. A low stat shows as effort and cost. A high stat shows as ease. The prompt also tells the narrator not to list the stats or report their changes. A separate step changes the numbers.

## How to Add a Stat
<!-- keywords: attribute, health, hp, meter, number, bar, create, new, variable, gauge, mana, counter, currency, gold, score, hunger, resource, skill level, track money -->
<!-- route: worldEditor.stats#list-toolbar -->

1. Open the **Stats** tab.
2. Type the stat's name in the **Search or add new stats** box.
3. Select the **+** button (**Add to Stats**). The new stat opens in the panel.
4. Set **Min**, **Max** and **Initial Value**.
5. Write its **Description**.
6. Select **Save** at the bottom of the editor.

> 💡 With the box empty, the new stat is named "New Stat". A new stat starts at 0 on a 0–100 range, with three descriptors: low, medium and high.

## How to Make a Stat a Percentage
<!-- keywords: percent, 0 to 100, ratio, show as %, fraction, out of hundred, completion meter, locked range -->
<!-- route: worldEditorStat.details -->

1. Select the stat.
2. On the **Details** tab, set **Type** to **Percentage**.
3. Set **Initial Value (%)**. **Min** and **Max** lock at 0 and 100.

## How to Hide a Stat
<!-- keywords: secret, invisible, hidden from player, ai only, conceal, behind the scenes, private, dont show bar, internal counter, gm only, background tracker, remove from sidebar -->
<!-- route: worldEditorStat.details -->

**Advanced mode only.**

1. Select the stat.
2. On the **Details** tab, under **Availability**, check **Hidden**.

The player no longer sees the stat. The AI still reads it, and its Regen and code still run.

## How to Add a Stat Descriptor
<!-- keywords: label, band, threshold, level, word, text for value, range, status, tier, stage, bracket, adjective, name for low health, state names, milestone -->
<!-- route: worldEditorStat.descriptors -->

**Advanced mode only.**

1. Select the stat, then open its **Descriptors** tab.
2. In the empty row at the bottom, type the top of the band in **Up to**.
3. Type the word or phrase in **New Description**.
4. Select the **+** button (**Add Descriptor**).

## What the AI sees
<!-- keywords: what gets sent, ai sees exact number, send only words, too many meters, context budget, token cost, hide numbers from ai -->

Each stat's **Name** is always sent. The Stats chip in your [prompt](Prompts#the-chip-editor) decides what is sent with it:

| Piece | Adds |
|---|---|
| **Range** | The current value and its maximum: `62/100`, or `62%` for a percentage stat |
| **Descriptor** | The matching Stat Descriptor, a word for the current level |
| **Description** | The stat's **Description** |

Each piece is a checkbox on the chip. At least one stays checked.

> ⚠️ **Every active stat is sent on every turn.** Stats use your context budget all the time. Three stats that matter are better than twelve that don't.

## The panel
<!-- keywords: code tab missing, cant find descriptors, no tabs showing, three tabs -->

Select a stat to open its panel. In Advanced mode the panel has three tabs.

| Tab | Holds | Mode |
|---|---|---|
| **Details** | The fields below | Simple and Advanced |
| **Descriptors** | [Stat Descriptors](#stat-descriptors) | Advanced only |
| **Code** | [Dynamic Value Calculation](#dynamic-value-calculation) | Advanced only |

In Simple mode the panel shows the basic fields with no tabs.

## The fields
<!-- keywords: minimum maximum, starting amount, regeneration, heal over time, decay per hour, hunger drain, avatar body changes, stop ai raising, freeze value, off until unlocked -->
<!-- route: worldEditorStat.details -->

| Field | What it does |
|---|---|
| **Name** | The AI uses this name for the stat. The game also uses it to match stat changes to the stat. |
| **Type** | **Number** has a range you set. **Percentage** is fixed at 0–100 and shows everywhere as `N%`. All other fields work the same for both. |
| **Description** | What the stat represents. Sent to the AI when the chip's **Description** piece is on. Takes placeholder chips. |
| **Min** / **Max** | The range. The value always stays in it. A percentage stat locks these at 0 and 100, so you set only its **Initial Value (%)**. |
| **Initial Value** | Where the stat starts. |
| **Regen** | Added to the value for each hour of story time that passes. With **Measured Clock** off, each turn is one hour. A positive number heals over time, and a negative number drains. An inactive stat gets no Regen. |
| **Body Sliders** | Binds the [Avatar's](Avatars#in-the-game) body sliders to this stat. The value, from Min to Max, sets each slider's position. Each slider belongs to one stat only. |

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
<!-- keywords: no status red, gap in coverage, which band wins, raw or percent, scales with max, above top tier, label missing, coverage bar -->
<!-- route: worldEditorStat.descriptors -->

A descriptor turns a number into a word, such as `Winded` or `Exhausted`. The AI gets that word when the chip's **Descriptor** piece is on. A descriptor takes placeholder chips, so a band can name the rolled town or the rolled rival.

Each descriptor has a **threshold** and a **Description**. The coverage bar above the rows shows each band from Min to Max, and it marks where the stat starts. It shows when the stat has one descriptor at least. The range above your top band shows in red with the label "no status". In that range the AI gets no status. Each row says what it covers.

> ⚠️ **A threshold is the top of its band, and the lowest band that fits the value wins.** The game reads descriptors from low to high, in any list order. So `30 → Barren` covers Min to 30, and a `60` row covers the values above 30, up to 60. Give your highest descriptor a threshold of your **Max**, or a value above it gets no descriptor.

### Thresholds in: Raw or % of Max

| Setting | A threshold of `3` on a 0–10 stat means | Raise Max to 20, and |
|---|---|---|
| **Raw** (default) | The value 3 | The band still ends at 3 |
| **% of Max** | 3% of the range from Min to Max: the value 0.3 | The band rescales to 0.6 |

- **Raw** is for counters: "3 rockets is low".
- **% of Max** is for proportions: "the bottom 30% is low".

When you switch, your numbers convert, so no band moves. The choice only changes what happens the next time you change the range. A percentage stat has no switch, because both settings give the same number on 0–100.

### Pins on a descriptor

**Advanced mode only.** Each descriptor row has a pin button. A pin keeps a [placeholder](World-Editor-Placeholders) at one value while the stat is in that band.

## Dynamic Value Calculation
<!-- keywords: javascript, script, formula, derived from another, automatic math, custom logic, programming, ai change overwritten, code box, computed -->
<!-- route: worldEditorStat.code -->

The **Code** tab holds two code boxes. Each box takes JavaScript, and each has its own **Test Code** and **Templates** buttons. **Templates** opens a list of code shapes to insert.

| Box | Runs |
|---|---|
| **Before the AI** | Before the prompt is built |
| **After the AI** | After the AI's stat changes and Regen apply |

The turn order is: Before the AI, the AI's stat changes, Regen, After the AI. An empty box is skipped, and the manual value stays.

Code can do four things:

- Set this stat's value, Min, Max or Regen. A returned number sets the value.
- Pin or unpin a placeholder
- Switch a trait on or off
- Read every active stat, every trait, every placeholder and the story clock

The code runs in an isolated sandbox with no page and no network. The editor suggests the names you can use as you type, and it underlines unknown names. **Test Code** runs one box and shows the result, the warnings and the errors.

> ⚠️ **Code that sets the value overwrites the AI.** The value is set again on every turn, so the AI's change to it is lost. The AI still reads the value and the description.

> 📘 Full reference: [Stat Code Guide](StatCodeGuide).

