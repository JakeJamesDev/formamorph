# 🔗 World Editor: Blueprints
<!-- keywords: template, reusable, shared trait, share across characters, npc class, master version, define once, same perk several npcs, class library -->
<!-- route: worldEditor.traits -->

> 🛠️ Part of the [World Editor](WorldEditor) guide.

A blueprint is a trait or a group that you write once and give to several entities. Write *Paladin* once, then link it to every entity that can be a Paladin. Each link follows the blueprint until you change a field for that entity.

Making a blueprint or a link needs Advanced mode. Stats share the same model: see [Blueprint Stats and Links](World-Editor-Stats#blueprint-stats-and-links).

## How to Make a Blueprint
<!-- keywords: template, reusable, shared trait, base, prototype, copy for entities, npc only, not for player, master version, common pool, define once, library of classes -->
<!-- route: worldEditor.traits -->

**Advanced mode only.**

1. On the **Traits** tab, select the **Add to Traits** icon button (+), then **Add Blueprints Group**. A group named **Blueprints** appears at the top level.
2. Add a trait or a group with **Add to Traits**. It appears at the top level.
3. Drag it into **Blueprints**.

The item is now a blueprint. The player never picks it directly. Entities get it only through [links](#links).

> ⚠️ **Blueprints refuses an item that something outside it reads.** That is a requirement that names the item, or a script that reads it by name. A note names the first one. Remove it, then drag again.

## How to Link to a Blueprint
<!-- keywords: give to entity, assign, share, attach, reuse, template, npc class, apply to characters, same perk several npcs, hand out, drag onto character, tick boxes -->
<!-- route: worldEditor.traits -->

**Advanced mode only.**

1. Select a trait or group in **Blueprints**.
2. Select **Link To…** in the footer below the panel.
3. Check each entity that gets the item. An entity that already has it shows as checked.

You can also drag the item from **Blueprints** onto an entity's node in the tree. The original stays in **Blueprints**.

## How to Override a Linked Trait
<!-- keywords: change for one entity, per entity, customize, template, exception, adjust for one npc, different for one npc, undo my edits, reset, restore original, edit master, local change -->
<!-- route: worldEditor.traits -->

1. On the **Traits** tab, open the entity's node and select the link row. It shows a link icon.
2. Open the tab that holds the field: **Availability**, **Stats**, **Pins** or **Scripts**.
3. Change the field. It now applies to this entity only.
4. To undo one field, select **Reset** at the end of its label row. To undo every field, select **Reset to Blueprint** in the footer.

To change the trait for every entity that links it, select **Edit Blueprint** in the footer and edit the original.

## Blueprints
<!-- keywords: template folder, npc only options, hide from player list, master copies, special folder, delete the folder, class definitions -->

**Advanced mode only.** To add the group, select the **Add to Traits** icon button (+), then **Add Blueprints Group**.

A blueprint is an item that exists to be linked or copied. A link or a copy follows its blueprint until you edit it. The player is never offered a trait under Blueprints. Those traits reach play only through links. Keep the originals there that only some entities get, such as classes and races.

- **A world has one Blueprints group.** It stays at the top level. **Add Blueprints Group** leaves the menu while one exists.
- **New items start at the top level.** **Add Trait** and **Add Group** never add inside Blueprints. Drag the new item in.
- **Entities can't go under Blueprints.** Blueprints holds world traits and groups only.
- **Remove it, and each linked item becomes its entities' own trait.** Every link into Blueprints is [detached](#detach), and the linked originals are deleted. Unlinked traits move to the top level, where the player can pick them. A confirmation asks first and gives the link count.

Placeholders have a [Blueprints group](World-Editor-Placeholders#blueprints) of their own, with the same rule.

> 💡 With Advanced mode off, links and the Blueprints group still show when they hold something, and you can still edit them. Only making new ones needs Advanced mode.

## Links
<!-- keywords: sync across npcs, live reference, unlink, make independent, break connection, stale warning, inherit, instance, detach, carry to another world -->

**Advanced mode only.** A link gives a [Blueprints](#blueprints) trait to an entity without a copy. The trait a link points to is its **original**.

Make a link in one of two ways:

- **Drag** a Blueprints trait or group onto an entity node. The original stays where it is.
- **Select the original**, then select **Link To…** in the footer below the panel. Check each entity that gets it. An entity that already has it shows as checked. **Link To…** shows only on Blueprints items.

A link row shows a link icon. The link follows the original until you change a field on the link:

- Edit the original, and every link that didn't override that field changes.
- A linked group brings all of its traits, including ones you add later.
- A linked group keeps the original's **Pick Count**.

Select a link to edit it. Its **Details** tab starts with **Linked from** and the original's place in the tree. It shows the original's name and descriptions as read-only text. You can change these fields for this link only:

| Field | Override |
|---|---|
| **Starts** | Selects the trait for this entity when a new game starts. A linked group lists each of its traits under **Enabled by Default** in **This Link**. |
| **Requires** | Replaces the original's whole list of rows |
| **Placeholder Pins** | Replaces the original's whole list |
| **Mode** | Makes the trait Optional, Automatic or Hidden for this entity. One owner can have a trait innately, and another can pick it. |
| **In Game** | Locks (**Fixed**) or opens (**Toggleable**) the trait for this entity |
| **Stat Changes** | Replaces the original's whole list |
| **Scripts** | Replaces the original's whole list |

**Stat Availability** stays read-only on a link. Change it on the original.

Link rules:

- **An entity has each original one time.** A second link to it, direct or through a linked group, is refused.
- **Only Blueprints traits and groups can be originals.** To share a top-level trait or an entity's own trait, move it into [Blueprints](#blueprints), then link it.
- **A linked original stays in Blueprints.** Dragging it out is refused while an entity links it or something in it. The notice names those entities.
- **Links to a top-level trait are removed.** A world or a card made before this rule loses those links, with their overrides, when it opens.
- **Remove a link, and the original stays.** Select **Remove Link** on the link row. Delete the original, and its links go with it. The confirmation tells you how many.
- **The player chooses at Enter World.** A player can change which linked traits an entity starts with, under the same rules as the entity's own traits.
- **The AI reads a linked trait like the entity's own**, with that link's overrides.

> ⚠️ **A link's Stat Changes apply on any entity.** A row changes the entity's own stat with that id, or else the global stat with that id. The row acts whoever the player plays. The link's own rows apply, never the original's. A persona switch moves none of them.

### Overrides

Each field you change on a link becomes an override. The rest of the link keeps following the original. In the tree, an overridden link row has the tooltip **Modified for this link**.

- **Reset** sits at the end of an overridden field's label row. It returns that field to the original.
- **Reset to Blueprint** sits in the footer below every tab. It returns every override on the link. On a trait in a linked group, it returns that trait's overrides. It is disabled while nothing is overridden.
- **Blueprint changed** shows beside a field's **Reset** when the original changed that field after you set your override. Your value may be stale. Edit the field again, or reset it, and the marker clears. It shows on the tab that holds the field, never in the tree.
- **Edit Blueprint** in the footer selects the original. Edit there to change every owner. It shows in the World Editor's **Traits** and **Stats** tabs, not in an entity's own tabs.

A linked group's shape always follows the original. To add, remove or move a trait for one owner only, use **Detach**.

### Detach

On a link row's menu, **Detach** takes the place of **Duplicate**. It turns the link into the entity's own trait. The trait no longer follows the original, so you can edit it freely.

**Detach** rewrites the trait's text so it keeps this owner's values:

- Each [blueprint chip](World-Editor-Placeholders#blueprint-chips) and each [pin by blueprint](#pins-by-blueprint) now names the entity's own [copy](World-Editor-Placeholders#copies).
- Any copy the trait needs and the entity lacks is made.
- Two other moves do the same rewrite. One drags an original onto an entity as its own trait. The other moves an entity's own trait to another entity.

The trait keeps the link's **Stat Changes** and **Stat Availability** on any entity.

### Links in the Library

An entity's links go with it to the library, to an entity card and into a world bundle. Each link keeps the name of its original and its overrides. When the entity joins a world, each link binds to:

1. The Blueprints trait or group with the same id, when the world has it
2. Else the one Blueprints trait or group of its kind with the same name

With no match, or two, the link is dropped. A top-level trait never matches. A link to a trait the entity already has is dropped too.

- A requirement that names an owner, such as "Albus: Paladin", binds to the one entity with that name.
- A library persona's links bind to the world the player enters.

The library entity editor shows links but never makes them:

- **Opened from a world**, it shows each link with the world's current original, and with **Reset**, **Remove Link** and **Detach**. You can still remove a link that the world lacks.
- **Opened from the library**, it shows links by name only.

## Pins by Blueprint
<!-- keywords: outfit per class, each owner own value, npc wording leaks, who is affected, per character variation, precedence of text -->

**Advanced mode only.** A trait pin can pin a [blueprint placeholder](World-Editor-Placeholders#blueprints). In the pin's placeholder list, pick the blueprint, then pick its value. You set the value one time, on the original.

On each owner, the pin traces the blueprint to that owner's own [copy](World-Editor-Placeholders#copies). Albus's *Paladin* pins *Class Garb*. Albus's copy of *Class Garb* holds the pin, and no other owner's copy changes.

A link can override its **Placeholder Pins** list. Albus's link can pin *silvered plate*, and another Paladin's link can pin *a plain tabard*.

A pin that names a value the copy removed pins nothing.

A [Blueprint stat's](World-Editor-Stats#pins-on-a-descriptor) band pins a blueprint the same way. Two mares link a *Pregnancy* stat, and its *Late* band pins *Term* to *late*. Each mare's copy of *Term* follows her own *Pregnancy* value. A Blueprint stat's band never pins a world placeholder.

### Whose pins apply where

Every text reads the same pins: the world's, the persona's and each entity's. See [Pins](World-Editor-Placeholders#pins) for which pin wins.

A pin by blueprint lands on its owner's own copy, so it changes only the text that reads that copy. Albus's class never changes the player's description.

## Example: RPG Classes
<!-- keywords: class system, dnd, job system, spells per class, worked sample, walkthrough, fantasy roles, step by step build, emberwatch -->
<!-- route: worldEditor.traits -->

This world gives the player and some entities a class. Turn on Advanced mode. Every step runs on the **Traits** tab, except step 3, which runs on the **Placeholders** tab.

1. **Add a Blueprints group.** Add a **Classes** group set to **Exactly One**, with *Paladin*, *Cleric* and *Wizard*, and drag it into Blueprints. Add a **Spells** group with *Smite* the same way, and set *Smite* to require *Paladin*.
2. **Link Classes and Spells to Albus.** Select the link, then set **Starts** to **On** for *Paladin*. Albus starts as a Paladin, and Smite unlocks for Albus.
3. **Pin a blueprint from each class.** On the **Placeholders** tab, add a Blueprints group with *Class Garb*. *Paladin* pins *Class Garb* to *silvered plate*. Albus gets its own copy of *Class Garb* by itself.
4. **Mark a [Custom Persona](World-Editor-Traits#custom-persona) entity and link Classes to it.** A player with no world persona now picks a class too.

During the game, a player who picks *Wizard* never unlocks Albus's *Smite*. Albus's garb never changes the player's description.

The bundled world **Emberwatch** is the full version of this example. Open it in the World Editor with Advanced mode on, and read **How this world is built** in its readme.
