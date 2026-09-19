# 🧩 World Editor: Placeholders

> 🛠️ Part of the [World Editor](WorldEditor) guide.

**Advanced mode only.** Placeholders are reusable pieces of world text: an eye color, a street name, a deity. You define one here, then put it into your writing as a chip. Each placeholder has a **Name** and a list of **Values**. When the story runs, each chip shows one of those values.

## Why it exists

Placeholders let a world change without a rewrite. Write *"the {{Eye Color}} stranger"* one time, and it reads as a real detail in each playthrough. It can be the same detail each time, or a new one.

## Kind

The **Kind** row says what a placeholder is:

| Kind | Resolves to | Use it for |
|---|---|---|
| **Wildcard** | One value, picked at random. Every World chip of it shows that pick. | Variety |
| **Object** | All its values, joined with commas | A thing made of parts |
| **Variable** | Its one value. Either kind is a Variable while it has one value. Edit the value here, and every chip updates. | One fact in many places |

A new placeholder starts as a Wildcard. A placeholder with no values shows nothing, so give it one value at least.

> 💡 **A Variable can still roll.** When its one value contains Wildcard chips, the value is a template. The chips in it roll, and its own chips take World or Unique like a Wildcard.

## Draw Weight

Each value of a Wildcard has a **Draw Weight**. A value with no weight counts as 1. Weight 0 keeps the value in the list and never picks it.

## Parts

A value that is exactly one chip is a **part** of the placeholder that holds it. You address it as `Name › Part`. This is how you build an Object from other placeholders. Away from its owner, a part's chip reads with the owner's name, such as `Molly › Eyes`.

## World or Unique

Each chip of a Wildcard chooses how it shares the roll:

| Scope | Behavior |
|---|---|
| **World** | Every World chip of this placeholder shows the **same** rolled value. One town name, the same in the whole world. |
| **Unique** | Each chip rolls on its own. Ten Unique *Eye Color* chips give ten independent rolls. |

> ⚠️ **Independent doesn't mean different.** Two Unique chips can roll the same value. Three chips from a list of ten values show a repeat about 28% of the time. Where two chips *must* differ, such as two towns, give each its own placeholder with values the other doesn't have.

## How a chip reads in the editor

| Chip | Reads as | Example |
|---|---|---|
| **World** | The placeholder's name | `Town Name` |
| **Unique** | The name plus a letter, one sequence per placeholder | `Town Name (A)`, `Town Name (B)` … `Town Name (AA)` |
| **Labeled** | The label you typed in the chip's pop-out | `Hometown` |

The letters follow the order of the world: entities first, in the order of the Entities tree. Then locations, traits, trait groups, stats, dictionaries, the world's own prompt fields and openings, and last the placeholders' own values.

- **Letters aren't stored.** Remove the first chip, and the next one becomes **(A)**. A letter tells two chips apart, but it isn't a permanent name.
- **Give a chip a Label** in its pop-out when you want a name that stays.
- **Hover a chip** to see the placeholder's name, its mode and its values.
- A chip in longer text keeps its braces where the name prints as plain text: `The {Tavern Name (A)} Inn`.

## The roll stays for the playthrough

> 💡 A Wildcard rolls **one time, when a game starts**, and the save keeps the result. The stranger with gray eyes on turn one still has them on turn ninety. A loaded save changes nothing. A new game rolls again.

## Pins

A pin keeps a placeholder at one value while a condition is true. The playthrough keeps its own roll, and the roll shows again when the pin ends. Four things can pin a placeholder:

| Pin source | Active while | Set it on |
|---|---|---|
| A stat descriptor | The stat is in that band | The pin button on the [descriptor row](World-Editor-Stats#pins-on-a-descriptor) |
| A location | The player is there | The location's [**Pins** tab](World-Editor-Locations#placeholder-pins) |
| A trait | The trait is active | The trait's [**Pins** tab](World-Editor-Traits#placeholder-pins) |
| A placeholder value | That value is the placeholder's current value | The value's row |

When two sources pin the same placeholder, the higher row in this table wins. [Stat code](StatCodeGuide) can also pin and unpin a placeholder.

## Where chips work

Chips resolve **both** in the text the AI reads and in the text the player sees. Use them in each field that has the chip picker:

- names and descriptions of entities, locations, stats and traits
- stat descriptors and dictionary entries
- image tags
- openings
- both readme tabs
- the system prompt addition
- the values of other placeholders

> ⚠️ **The World Description takes no chips.** The library shows it before a playthrough exists, so there are no rolls to use.

## Placeholders that belong to an entity or a dictionary

An entity, a dictionary book and a library persona can each have their own placeholders, on their **Placeholders** tab. These placeholders travel with their owner in a character card, a dictionary file and a published listing. They show under their owner in the list, not in a group.

## Groups

Groups are folders for the shared list, like the groups on the **Entities** tab. The **+** button offers **Add Group**. Drag a placeholder under a group to put it there, and drag a group under another group to nest it. The palette strip and the `{` menu list the ungrouped placeholders first, then each group under its name.

Groups are for the editor only. They **never reach the AI**, and a character card or a dictionary file doesn't keep them.

## Getting started

Define the placeholder here. Then place its chip from a field that has the chip picker. Use a Wildcard for variety. Use a Variable for one fact you can edit in one place.
