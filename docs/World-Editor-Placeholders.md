# 🧩 World Editor: Placeholders

> 🛠️ Part of the [World Editor](WorldEditor) guide.

Reusable bits of world text you define once and drop into your writing as chips — an eye color, a street name, a deity. Each has a **Name** and a list of **Values**, and everywhere its chip appears, it resolves to one of those values when the story runs.

## Why it exists

So a world can vary without being rewritten. Author *"the {{Eye Color}} stranger"* once and it reads as a real detail every playthrough — the same detail on purpose, or a fresh one each time.

## Variable or Wildcard

The kind is inferred from how many values you give it — there's no separate switch.

| Values | Kind | Resolves to |
|---|---|---|
| **One** | **Variable** | Always that value. Edit it here once and every chip updates. |
| **Two or more** | **Wildcard** | A random one of the values. |
| **None** | — | Nothing (empty). Give it at least one value. |

## World vs. Unique

A **Wildcard** chip chooses how its roll is shared, per placement:

| Scope | Behavior |
|---|---|
| **World** | Every World chip of this placeholder shows the **same** rolled value everywhere — one town name, used consistently. |
| **Unique** | Each placement rolls on its own — ten Unique *Eye Color* chips give ten independent eyes. |

> ⚠️ **Independent doesn't mean different.** Each Unique placement draws on its own, so two of them can land on the same value — three chips from a ten-value list show a repeat about a third of the time. Where two chips *must* differ (two towns that can't share a name), give each its own placeholder with values the other doesn't have.

A **Variable** ignores this — it's the same single value no matter what.

## How a placed chip reads

| Chip | Reads as | Example |
|---|---|---|
| **World** | The placeholder's name | `Town Name` |
| **Unique** | The name plus a letter, one sequence per placeholder | `Town Name (A)`, `Town Name (B)` … `Town Name (AA)` |
| **Labeled** | The label typed in the chip's pop-out | `Hometown` |

The letters follow the order things sit in the world: entities first, as the Entities tree lists them, then locations, traits, stats, dictionaries, the world's own prompt fields, and the placeholders' own values. Remove the first placement and the next one becomes **(A)** — nothing is stored, so a letter tells two placements apart but never names one for good. Give a placement a **Label** in its pop-out when you want a name that stays. Hover any chip or pill to see the placeholder's name, its mode and its values. A chip inside longer text keeps its braces everywhere the name is printed as plain text: `The {Tavern Name (A)} Inn`.

## The roll is frozen for the playthrough

> 💡 A Wildcard rolls **once, when a game begins**, and the result is stored in that save. The stranger with gray eyes on turn one still has them on turn ninety, and reloading the save changes nothing. A new game rolls fresh.

## Where chips work

Placeholders resolve **both** in what the AI reads and in what the player sees, in any field with the chip picker:

- entity, location and dictionary descriptions
- stat descriptions and descriptors
- the readme
- the system prompt addition

> ⚠️ **The World Description is the exception.** It's shown in the library *before* a playthrough exists, so there are no rolls to resolve yet — that field takes no chips at all.

## Groups

Folders for the shared list, like the ones on the Entities tab. In Advanced mode the **+** offers **Add Group**; drag a placeholder under a folder to file it, and drag a folder under another to nest it. The palette strip and the `{` menu list the loose placeholders first, then each folder under its name. Groups are editor-only: they **never reach the AI**, a character card or dictionary file leaves them behind, and a placeholder that belongs to an entity or dictionary stays under its owner rather than in a folder.

## Getting started

Define the placeholder here, then place its chip from any field that offers them. Reach for a Wildcard when you want variety, a Variable when you want one editable fact in many places.
