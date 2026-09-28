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
| **Details** | Name and the two descriptions | Simple and Advanced |
| **Availability** | The two checkboxes below, [**Requires**](#requirements), and a link's **This Link** section | Simple and Advanced |
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

## Requirements

**Requires** on the **Details** tab makes a trait available only when one of its targets holds. A target is a trait, any trait in a group, or a persona the player plays as. With two targets, either one is enough.

### Whose trait counts

The entity that has a trait is its **bearer**. The player is one bearer, marked **You**. Each entity in the cast is another.

A requirement checks the same bearer by default. *Smite* requires *Paladin* means Paladin on the entity that has Smite. The player's *Wizard* never unlocks Smite for anyone else.

To check another bearer, pick one after you pick the target:

| Bearer | The requirement holds when |
|---|---|
| **Same Bearer** | Whoever has the trait also has the target. This is the default. |
| **You** | The player has the target |
| An entity | That entity has the target. The list shows only entities that can have it. |

For example, *Squire* requires **You**: *Paladin*. A squire entity gets its Squire trait only when the player is a Paladin.

A requirement that names an entity describes a relationship to someone else. When the player plays that entity, the requirement falls away. *Squire to Albus* requires *Albus: Paladin*, so it is offered to every player except Albus. A trait with a second target, such as *Paladin* on the same bearer, stays and uses the other target. An entity's own traits keep every requirement, so Albus can still gate his own trait on *Albus: Paladin*.

## Entity Traits

An entity can have traits of its own. Each entity with traits shows as a node in the **Traits** tab, below the world's traits.

- **Add one from the Traits tab.** In Advanced mode, select **+**, then **Add Trait to Entity**, and pick the entity. **Add Group to Entity** adds a group the same way.
- **Or add one in the entity's editor**, in its **Traits** tab, in Advanced mode. Type a name in the search box, select **+**, then **Add Trait to <entity>** or **Add Group to <entity>**.

The entity's **Traits** tab is the **Traits** tab for that entity alone. It shows the entity's traits, groups and links in the same tree, with the same row buttons. Select a row to edit it in place; the **Traits** back row returns to the list. Drag rows, links included, to reorder and nest them inside the entity. A **Requires** chip opens its target when the entity holds it; a world trait or a persona reads as plain text there. To link a trait or move one to another entity, use the **Traits** tab.

An entity's active traits describe it to the AI, the same way the player's do. When the player plays the entity as a [persona](Persona-Authoring), its traits are the player's.

> 💡 **Type `{{char}}` in a trait's text to name its bearer.** On an entity, it reads as that entity's name. On the player's traits, it reads as the persona's name, or "the player" with no persona. One *Paladin* text then names each Paladin.

> 💡 **Entity traits can't have Stat Changes or Stat Availability.** Only the player has stats.

## Links

**Advanced mode only.** A link gives a world trait to an entity without a copy. Write *Paladin* one time, then link it to every entity that can be a Paladin. The trait a link points to is its **original**.

Make a link in one of two ways:

- **Drag** a world trait or group onto an entity node. The original stays where it is.
- **Select the original** and select **Link To…** at the top of its **Details** tab. Pick each entity that gets it. An entity that already has it shows as checked.

A link row shows a link icon. It reads the original live: name, descriptions, requirements and pins. Edit the original, and every link changes. A linked group brings all of its traits, also ones you add later, and it stays **Exclusive** when the original is.

Select a link to open the original's **Details** under the line "Linked from **Templates › Classes › Paladin**. Edits change every link." Below them, the **This Link** section holds what belongs to this link only:

| Setting | What it does |
|---|---|
| **Enabled by Default** | Selects the trait for this entity when a new game starts. A linked group lists each of its traits. |
| *Placeholder* **→** | The value for a [Bearer's Own pin](#bearers-own-pins) on this entity |

Link rules:

- **An entity has each original one time.** A second link to it, direct or through a linked group, is refused.
- **Only world traits and groups can be originals.** To share an entity's own trait, move it to the world's traits or to [Templates](#templates), then link it.
- **Remove a link, and the original stays.** Delete the original, and its links go with it. The confirmation tells you how many.
- **The player chooses at Enter World.** A player can change which linked traits an entity starts with, under the same rules as the entity's own traits. **Player Can Toggle In-Game** follows the original.
- **The AI reads a linked trait like the entity's own**, with that link's pin values.

> ⚠️ **A link's Stat Changes apply only to the player.** On a **Playable** or **Persona-Only** entity, they apply when the player plays as it. On any other entity, they do nothing. The **This Link** section says which applies.

### Detach

On a link row's menu, **Detach** takes the place of **Duplicate**. It turns the link into the entity's own trait. The copy no longer follows the original, so edit it freely.

Entity traits can't have stat effects. When the original has **Stat Changes** or **Stat Availability**, a confirmation asks first, and the copy comes without them.

### Links in the Library

An entity's links go with it to the library, to a character card and into a world bundle. Each link keeps the name of its original. When the entity joins a world, each link binds to:

1. The trait or group with the same id, when the world has it
2. Else the one trait or group of its kind with the same name

With no match, or two, the link is dropped. A link to a trait the entity already has is dropped too. Its **This Link** picks follow their traits the same way. A requirement that names a bearer, such as "Albus: Paladin", binds to the one entity with that name. A library persona's links bind to the world the player enters.

The library entity editor shows links but never makes them. Opened from a world, it shows them live, with **This Link**, **Remove Link** and **Detach**, and you can still remove a link that world lacks. Opened from the library, it shows them by name only.

## Templates

**Advanced mode only.** Select **+**, then **Add Templates Group**. Traits under Templates are never offered to the player. They reach play only through links. Keep originals there that only some entities get, such as classes and races.

- **A world has one Templates group.** It stays at the top level.
- **Entities can't go under Templates.** Templates holds world traits and groups only.
- **Remove it, and its traits move to the top level.** They're then offered to the player, so a confirmation asks first.

## Custom Persona

**Advanced mode only.** Select **+**, then **Add Custom Persona**. The Custom Persona node holds links only. Its linked traits are the player's when the player has no world persona: **None**, or a persona from their own library. Use it to give a race and a class to a player who brings their own persona.

- **The picks carry over.** A player who switches between **None** and a library persona keeps their Custom Persona picks.
- **In play, its traits sit with the world's top-level traits.** They have no separate heading.
- **It can't link what the top level already offers.** The player has those traits already.
- **Remove it, and its links go too.** The confirmation tells you how many.

> 💡 With Advanced mode off, links, Templates and Custom Persona still show when they hold something, and you can still edit them. Only making new ones needs Advanced mode.

## Bearer's Own Pins

**Advanced mode only.** A trait pin can pin each bearer's own placeholder in place of one world placeholder. In the pin's placeholder list, pick a name under **Bearer's Own**. On each bearer, the pin uses that bearer's own placeholder with that name. A bearer with no placeholder of that name uses the world placeholder with that name.

Each link picks its own value in its **This Link** section. Albus's *Paladin* can pin his *Class Garb* to *silvered plate*, and another Paladin's link can pick *a plain tabard*. A link with no value pins nothing.

The pin's own value applies when a bearer has the trait directly, with no link. It is also the first value of a new link that uses the world placeholder.

### Whose pins apply where

| Text | Pins that apply |
|---|---|
| World text: locations, the world prompt, narration | The world's pins, then the player's trait pins |
| The player's persona | The same as world text |
| An entity's own text | The world's pins, then the player's trait pins, then the entity's own trait pins on top |

An entity's own trait pins never reach anyone else's text. Albus's class never changes the player's description.

> 💡 **A persona's own placeholder takes the pin, not the world's.** When the player plays Albus, his *Paladin* pins his own *Class Garb*, and a world *Class Garb* chip in an opening shows its rolled value. When world text should read the played persona's garb, give the persona no placeholder of that name and pick its link values from the world list. The bundled world **Emberwatch** does both: its cast owns Class Garb and Heritage, and its personas use the world's.

## Test Bench Checks

The **Test Bench** checks every bearer as if the player picked it. That includes **Playable** and **Persona-Only** entities and Custom Persona.

It shows an error when a trait can never unlock for its bearer. For example, Albus links *Smite*, but nothing on Albus gives *Paladin*.

It shows a warning when:

- A link has no value for a Bearer's Own pin. The warning opens the link.
- A Bearer's Own name matches no placeholder on the bearer or in the world.
- A link is redundant, because another link on the same bearer already brings its original.

## Example: RPG Classes

A world where the player and some entities have a class.

1. **Add a Templates group.** Under it, add an exclusive **Classes** group with *Paladin*, *Cleric* and *Wizard*. Add a **Spells** group with *Smite*, and set *Smite* to require *Paladin*.
2. **Link Classes and Spells to Albus.** In **This Link**, check **Enabled by Default** on *Paladin*. Albus starts as a Paladin, and Smite unlocks for him.
3. **Give each class a Bearer's Own pin.** *Paladin* pins **Bearer's Own** *Class Garb*. Give Albus a *Class Garb* placeholder, and pick its value in his link.
4. **Add Custom Persona and link Classes to it.** A player with no world persona now picks a class too.

In play, a player who picks *Wizard* never unlocks Albus's *Smite*, and Albus's garb never changes the player's description.

The bundled world **Emberwatch** is the full version of this example. Open it in the World Editor with Advanced mode on, and read **How this world is built** in its readme.

## Getting started

Name the trait. Write one line of AI-Facing Description that reads as a fact about the person, not as game rules. Add Stat Changes only when the trait must also change a number.
