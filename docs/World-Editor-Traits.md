# 🧬 World Editor: Traits

> 🛠️ Part of the [World Editor](WorldEditor) guide.

Traits are the choices that make each playthrough different: *Scarred*, *Silver-Tongued*, *Afraid of Water*. The player picks traits before the story starts. The AI reads the picked traits on every turn.

## Why it exists

A trait is a fact about the player that doesn't change. Stats change all the time, and the story changes with them. A trait reads the same on turn one and on turn ninety. A stat says *how much*. A trait says *who you are*.

> 💡 **Only active traits reach the AI.** A trait the player didn't pick is sent nowhere and does nothing.

## What the AI sees

| Field | Sent? |
|---|---|
| **Name** | Always. The AI gets only the name when the AI-Facing Description is blank. |
| **AI-Facing Description** | Yes. It tells the AI what the trait means. |
| **Player-Facing Description** | **Never** |
| **Stat Changes**, **Stat Availability**, **Placeholder Pins** | **Never** |

A blank **AI-Facing Description** is fine for a name that explains itself, such as *Left-Handed*.

> 💡 **The AI doesn't see Stat Changes.** It reads that the player is *Sickly*. It doesn't read that the trait cost 20 Vigor. The stat carries the number. So write the description as a fact the narrator can use: *"Flinches at open water"*, not *"-20 swimming"*.

## The panel

Select a trait to open its panel.

| Tab | Holds | Mode |
|---|---|---|
| **Details** | Name, the two descriptions and the two checkboxes below | Simple and Advanced |
| **Stats** | **Stat Changes**, and **Stat Availability** in Advanced mode | Simple and Advanced |
| **Pins** | **Placeholder Pins** | Advanced only |

## The checkboxes

| Checkbox | What it does |
|---|---|
| **Enabled by Default** | Selects the trait when a new game starts. The player can still clear it. |
| **Player Can Toggle In-Game** | The player can turn the trait on or off from the **Traits** tab during play |

## Stat Changes

Each row changes one stat while the trait is active. A row has a stat, a number, and the field to change.

> ⚠️ **Each type adds to the stat. It doesn't set it.** `+20` on a stat that starts at 50 gives 70, not 20.

| Type | Effect |
|---|---|
| **Starting Value** | Changes where the stat starts |
| **Min** | Raises the Min. A value below the new Min rises with it. A negative number only cancels another trait's raise. It **never goes below the Min you wrote on the stat**. |
| **Max** | Raises or lowers the Max. A value above the new Max drops with it. |
| **Regen** | Adds to the stat's Regen. A negative number drains. |

Min and Max follow different rules on purpose. A trait can put the Max anywhere. A trait can never put a stat below the range you designed.

## Stat Availability

**Advanced mode only.** Each row names a stat and says whether the trait enables or disables it. The row overrides the stat's own [**Enabled** checkbox](World-Editor-Stats#availability) while the trait is active.

A disabled stat isn't shown to the player or sent to the AI. Its Regen and code don't run.

## Placeholder Pins

**Advanced mode only.** A pin keeps a [placeholder](World-Editor-Placeholders#pins) at one value while the trait is active. For example, a *Redhead* trait pins Hair Color to *copper*. The playthrough keeps its own roll, and the roll comes back when the trait is switched off.

You can type a value that isn't in the placeholder's list. The game uses it as written.

## When two traits conflict

When two active traits change the availability of the same stat, or pin the same placeholder, the trait lower in the trait list wins. The row tells you when this applies, and it links to the other trait.

## Groups

Groups organize the list. A trait group also has text of its own:

| Field | What it does |
|---|---|
| **Group Name** | The heading on the trait selection screen |
| **Player-Facing Description** | Text the player reads under the heading |
| **AI-Facing Description** | A header the AI reads above the group's active traits, such as *"Origin: where this life began"*. A group with no active traits is skipped. |

### Exclusive

Check **Exclusive** when the group is one choice between options: a species, an origin, a starting class. The group shows radio buttons and allows one trait at most. Pick another trait, and the first one clears. Click the picked trait to clear it, so "none of these" is always possible. In play, a trait the player can toggle works the same way: turn one on, and the others in its group turn off.

> 💡 **Give an exclusive group a default.** Check **Enabled by Default** on one trait, so the group always has an answer. With two defaults, the first in the list wins.

## Getting started

Name the trait. Write one line of AI-Facing Description that reads as a fact about the person, not as game rules. Add Stat Changes only when the trait must also change a number.
