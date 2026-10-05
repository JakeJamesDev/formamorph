# 🧬 World Editor: Traits
<!-- keywords: character creation, feats, flaws, classes races, starting options, boons, talents -->
<!-- route: worldEditor.traits -->

> 🛠️ Part of the [World Editor](WorldEditor) guide.

Traits are the choices that make each playthrough different: *Scarred*, *Silver-Tongued*, *Afraid of Water*. The player picks traits before the story starts. The AI reads the picked traits on every turn.

## Why it exists
<!-- keywords: versus numbers, permanent facts, when to use which, difference between, unpicked ignored -->

A trait is a fact about the player that doesn't change. Stats change all the time, and the story changes with them. A trait reads the same on turn one and on turn ninety. A stat says *how much*. A trait says *who you are*.

> 💡 **Only active traits reach the AI.** A trait the player didn't pick is sent nowhere and does nothing.

## How to Make a Trait
<!-- keywords: perk, feature, quirk, attribute, ability, background, create, new, characteristic, feat, flaw, talent, skill, class, race, species, boon, disadvantage, starting option -->
<!-- route: worldEditor.traits#list-toolbar -->

1. Open the **Traits** tab.
2. To name the trait as you add it, type the name in the search box.
3. Select **+**. In Advanced mode, select **Add Trait** in the menu. The new trait opens on its **Details** tab.
4. Type the **Name**.
5. Write one line in **AI-Facing Description**. Write a fact about the person, such as *"Flinches at open water"*, not a game rule.
6. Optional: write a **Player-Facing Description**. The player reads it while choosing.
7. Optional: to change a number too, open the **Stats** tab, select **Add Stat Change**, and pick the stat, the type and the number.

A new trait goes to the top level of the list. Drag it to put it in a group.

## How to Require Another Trait
<!-- keywords: prerequisite, depends on, needs, only if, condition, unlock, gate, locked until, skill tree, subclass, chain, tied to, restrict, exclusive to class -->
<!-- route: worldEditorTrait.availability -->

1. Select the trait.
2. Open the **Availability** tab.
3. Under **Requires**, select **Add Requirement**.
4. Pick a target in the **Traits**, **Any Trait in a Group** or **Playing As** list.
5. Pick whose trait counts: **Same Bearer**, **You**, or an entity. A **Playing As** target skips this step.
6. Optional: repeat for a second target. Any one target is enough.

To remove a target, select the **×** on its chip.

## How to Set a Pick Count
<!-- keywords: limit, cap, how many, choose one, max, min, exactly one, radio, multiple, mutually exclusive, single choice, one of, at least two, force selection, mandatory, slots, required choice -->
<!-- route: worldEditor.traits -->

1. Select a trait group. To add one, switch to Advanced mode, select **+**, then **Add Group**.
2. Open the **Pick Count** list and pick **Any**, **Exactly One**, **Up to One** or **Custom**.
3. For **Custom**, type **At Least** and **At Most**. Leave **At Most** empty for no limit.
4. For **Exactly One**, select a trait in the group, open its **Availability** tab, and check **Enabled by Default**. A new game then starts with a valid pick.

## How to Make a Blueprint
<!-- keywords: template, reusable, shared trait, base, prototype, copy for entities, npc only, not for player, master version, common pool, define once, library of classes -->
<!-- route: worldEditor.traits -->

**Advanced mode only.**

1. On the **Traits** tab, select **+**, then **Add Blueprints Group**. A group named **Blueprints** appears at the top level.
2. Add a trait or a group with **+**. It appears at the top level.
3. Drag it into **Blueprints**.

The item is now a blueprint. The player never picks it directly. Entities get it only through [links](#links).

## How to Link to a Blueprint
<!-- keywords: give to entity, assign, share, attach, reuse, template, npc class, apply to characters, same perk several npcs, hand out, drag onto character, tick boxes -->
<!-- route: worldEditor.traits -->

**Advanced mode only.**

1. Select a trait or group in **Blueprints**.
2. Select **Link To…** in the footer below the panel.
3. Check each entity that gets the item. An entity that already has it shows as checked.

Or drag the item from **Blueprints** onto an entity's node in the tree. The original stays in **Blueprints**.

## How to Override a Linked Trait
<!-- keywords: change for one entity, per entity, customize, template, exception, adjust for one npc, different for one npc, undo my edits, reset, restore original, edit master, local change -->
<!-- route: worldEditor.traits -->

1. In the **Traits** tab, open the entity's node and select the link row. It shows a link icon.
2. Open the tab that holds the field: **Availability**, **Stats** or **Pins**.
3. Change the field. It now applies to this entity only.
4. To undo one field, select **Reset** at the end of its label row. To undo every field, select **Reset to Blueprint** in the footer.

To change the trait for every entity that links it, select **Edit Blueprint** in the footer and edit the original.

## What the AI sees
<!-- keywords: does ai know bonus, narrator ignores perk, wording tips, blank text ok, numbers not shown, rule vs fact -->

| Field | Sent? |
|---|---|
| **Name** | Always. The AI gets only the name when the AI-Facing Description is blank. |
| **AI-Facing Description** | Yes. It tells the AI what the trait means. |
| **Player-Facing Description** | **Never** |
| **Stat Changes**, **Stat Availability**, **Placeholder Pins** | **Never** |

A blank **AI-Facing Description** is fine for a name that explains itself, such as *Left-Handed*.

> 💡 **The AI doesn't see Stat Changes.** It reads that the player is *Sickly*. It doesn't read that the trait cost 20 Vigor. The stat carries the number. So write the description as a fact the narrator can use: *"Flinches at open water"*, not *"-20 swimming"*.

## The Panel
<!-- keywords: pins tab missing, stats tab missing, owned by line, details tab, four tabs -->
<!-- route: worldEditorTrait.details -->

Select a trait to open its panel.

| Tab | Holds | Mode |
|---|---|---|
| **Details** | **Name** and the two descriptions | Simple and Advanced |
| **Availability** | **Mode**, the two checkboxes below, and [**Requires**](#requirements) | Simple and Advanced |
| **Stats** | **Stat Changes**, and **Stat Availability** in Advanced mode | Simple and Advanced |
| **Pins** | **Placeholder Pins** | Advanced only |

On an entity's own trait, the **Details** tab starts with the line **Owned by** and the entity's name. The **Stats** tab shows only when the entity can [own stat traits](#entity-traits).

## Availability
<!-- keywords: curse, cursed item, passive, forced on, secret bonus, preselected, switch mid game, innate, cant turn off -->
<!-- route: worldEditorTrait.availability -->

The **Availability** tab sets who controls the trait and when it can be active.

### Mode

**Mode** sets who controls the trait.

| Mode | What it does |
|---|---|
| **Optional** | The player chooses the trait. This is the default. |
| **Always On** | The trait is on whenever its [requirements](#requirements) hold. The player can never switch it. With no requirements, it's always on. |
| **Hidden** | Works like **Always On**, and the player never sees it. The AI reads it like any active trait. |

Only **Optional** traits show the two checkboxes below. **Always On** and **Hidden** hide them, because a value there would mean nothing.

| Checkbox | What it does |
|---|---|
| **Enabled by Default** | Selects the trait when a new game starts. The player can still clear it. |
| **Player Can Toggle In-Game** | The player can turn the trait on or off from the **Traits** tab during play |

### Curses

A curse is an **Always On** trait that requires the cursed item. The player picks the item, and the curse comes with it. The player drops the item, and the curse lifts. The player sees the curse only when it takes effect.

### Hidden traits

A **Hidden** trait can carry **Stat Changes**, and visible stat bars move. Use it for a secret bonus or a hidden nature. A hidden trait's name shows only in tools for authors: the Prompt viewer and the **Test Bench**. Other requirement lines skip it, and a trait whose requirements are all hidden reads **Locked**.

> 💡 **A requirement can point at an Always On or Hidden trait.** A hidden bonus can unlock other traits.

> ⚠️ **Stat code never switches an Always On or Hidden trait.** Its requirements alone decide.

## Stat Changes
<!-- keywords: bonus, buff, debuff, modifier, penalty, extra hp, raise cap, boost, adds not sets -->
<!-- route: worldEditorTrait.stats -->

Each row changes one stat while the trait is active. A row has a stat, a number, and the field to change. Select **Add Stat Change** to add a row.

> ⚠️ **Each type adds to the stat. It doesn't set it.** `+20` on a stat that starts at 50 gives 70, not 20.

| Type | Effect |
|---|---|
| **Starting Value** | Changes where the stat starts |
| **Min** | Raises the Min. A value below the new Min rises with it. A negative number only cancels another trait's raise. It **never goes below the Min you wrote on the stat**. |
| **Max** | Raises or lowers the Max. A value above the new Max drops with it. |
| **Regen** | Adds to the stat's Regen. A negative number drains. |

Min and Max follow different rules on purpose. A trait can put the Max anywhere. A trait can never put a stat below the range you designed.

## Stat Availability
<!-- keywords: unlock a meter, mana for mages, class specific bar, show bar only if, turn on gauge, conditional meter -->

**Advanced mode only.** Select **Add Stat Availability** to add a row. Each row names a stat and picks **Enable** or **Disable**. The row overrides the stat's own [**Enabled** checkbox](World-Editor-Stats#availability) while the trait is active.

A disabled stat isn't shown to the player or sent to the AI. Its Regen and code don't run.

## Placeholder Pins
<!-- keywords: appearance from choice, force a word, lock random text, returns when off, type custom text, hair by perk -->
<!-- route: worldEditorTrait.pins -->

**Advanced mode only.** A pin keeps a [placeholder](World-Editor-Placeholders#pins) at one value while the trait is active. For example, a *Redhead* trait pins Hair Color to *copper*. The playthrough keeps its own roll, and the roll comes back when the trait is switched off.

You can type a value that isn't in the placeholder's list. The game uses it as written.

## When two traits conflict
<!-- keywords: clash, priority, which wins, overlap, contradiction, order matters, tie -->

When two active traits change the availability of the same stat, or pin the same placeholder, the trait lower in the trait list wins. The row tells you when this applies, and it links to the other trait.

## Groups
<!-- keywords: category, start button disabled, choose more message, cant begin game, none of these, swap mid game, over the limit, folders -->

Groups organize the list. A trait group also has text of its own:

| Field | What it does |
|---|---|
| **Group Name** | The heading on the trait selection screen |
| **Player-Facing Description** | Text the player reads under the heading |
| **AI-Facing Description** | A header the AI reads above the group's active traits, such as *"Origin: where this life began"*. A group with no active traits is skipped. |

### Pick Count

**Pick Count** sets how many traits the player must and can pick from the group.

| Preset | Picks |
|---|---|
| **Any** | No minimum, no maximum |
| **Exactly One** | One pick, no more and no less. A class or a species. |
| **Up to One** | Zero or one pick |
| **Custom** | You set **At Least** and **At Most**. Leave **At Most** empty for no limit. |

Only traits placed directly in the group count. A subgroup sets its own count. An **Always On** trait counts toward its group's minimum and maximum.

A group with a maximum of one shows radio buttons. In **Up to One**, pick another trait, and the first one clears. Select the picked trait to clear it, so "none of these" is always possible. In play, a trait the player can toggle works the same way: turn one on, and the others in its group turn off. An **Always On** sibling can't clear, so the switch is refused.

On the setup screen:

- A group that's short of its minimum says how many more picks it needs, such as *Choose 2 more traits*.
- **Start game** stays disabled until every group meets its minimum. In a world with a 3D model, the button reads **Continue to Avatar**. **Quick Start** never blocks, and it leaves the gap in place.
- At a maximum above one, the unchecked rows disable. Uncheck one to pick another.

In play:

- The game refuses a switch-off that drops a group below its minimum.
- A trait that leaves because its requirements stop holding can drop a group below its minimum. The game doesn't ask for a replacement. The trait returns when its requirements hold again.
- An **Always On** trait whose requirements start to hold joins its group even when the group is full. The group runs over its maximum until the player drops a pick.
- **Exactly** N with N above one can't change in play. To allow swaps, set a range with **Custom**.

> 💡 **Give an Exactly One group a default.** Check **Enabled by Default** on one trait, so a new game starts with a valid answer. With two defaults in an **Up to One** group, the first in the list wins.

## Requirements
<!-- keywords: who must have it, either or, any of, depends on player class, npc needs player choice, owner check, relationship perk, holder -->

**Requires** on the **Availability** tab makes a trait available only when one of its targets holds. A target is a trait, any trait in a group, or a persona the player plays as. With two targets, either one is enough.

**Add Requirement** opens a search with three lists: **Traits**, **Any Trait in a Group** and **Playing As**.

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
<!-- keywords: npc perks, npc abilities, give character a class, companion skills, name the holder, can npcs have stats, move to character -->
<!-- route: worldEditorEntity.traits -->

An entity can have traits of its own. Each entity with traits shows as a node in the **Traits** tab, below the world's traits.

- **Add one from the Traits tab.** In Advanced mode, select **+**, then **Add Trait to Entity**, and pick the entity. **Add Group to Entity** adds a group the same way.
- **Or add one in the entity's editor**, in its **Traits** tab, in Advanced mode. Type a name in the search box, select **+**, then **Add Trait to <entity>** or **Add Group to <entity>**.

The entity's **Traits** tab is the **Traits** tab for that entity alone. It shows the entity's traits, groups and links in the same tree, with the same row buttons. Select a row to edit it in place; the **Traits** back row returns to the list. Drag rows, links included, to reorder and nest them inside the entity. A **Requires** chip opens its target when the entity holds it; a world trait or a persona reads as plain text there. To link a trait or move one to another entity, use the **Traits** tab.

An entity's active traits describe it to the AI, the same way the player's do. When the player plays the entity as a [persona](Persona-Authoring), its traits are the player's.

> 💡 **Type `{{char}}` in a trait's text to name its bearer.** It shows as the **Character Name** chip. On an entity, it reads as that entity's name. On the player's traits, it reads as the persona's name, or "the player" with no persona. One *Paladin* text then names each Paladin.

To give a world trait or group to one entity, drag it onto the entity's node. It moves to that entity. A [Blueprints](#blueprints) item links instead, in Advanced mode.

> 💡 **Only a persona's traits can have Stat Changes or Stat Availability.** Only the player has stats. A **Playable**, **Persona-Only** or [Custom Persona](#custom-persona) entity can own stat traits, and they apply when the player plays as it. Any other entity refuses them. Remove an entity's persona mark, and its stat traits stay, but their stats do nothing.

## Links
<!-- keywords: sync across npcs, live reference, unlink, make independent, break connection, stale warning, inherit, instance, detach, carry to another world -->

**Advanced mode only.** A link gives a [Blueprints](#blueprints) trait to an entity without a copy. Write *Paladin* one time under Blueprints, then link it to every entity that can be a Paladin. The trait a link points to is its **original**.

Make a link in one of two ways:

- **Drag** a Blueprints trait or group onto an entity node. The original stays where it is.
- **Select the original** and select **Link To…** in the footer below the panel. **Link To…** shows only on Blueprints items. Check each entity that gets it. An entity that already has it shows as checked.

A link row shows a link icon. It reads the original live until you change a field on the link. Edit the original, and every link that did not override that field changes. A linked group brings all of its traits, also ones you add later, and it keeps the original's **Pick Count**.

Select a link to edit it. The link's **Details** tab starts with **Linked from** and the original's place in the tree. It shows the original's name and descriptions as read-only text. These fields are yours to change for this link only:

| Field | Override |
|---|---|
| **Enabled by Default** | Selects the trait for this entity when a new game starts. A linked group lists each of its traits under **This Link**. |
| **Requires** | Replaces the original's whole list |
| **Placeholder Pins** | Replaces the original's whole list |
| **Mode** | Makes the trait Optional, Always On or Hidden for this entity. One bearer can have a trait innately, and another can pick it. |
| **Player Can Toggle In-Game** | Locks or opens the trait for this entity |
| **Stat Changes** | Replaces the original's whole list |

**Stat Availability** stays read-only on a link. Change it on the original.

Link rules:

- **An entity has each original one time.** A second link to it, direct or through a linked group, is refused.
- **Only Blueprints traits and groups can be originals.** To share a top-level trait or an entity's own trait, move it into [Blueprints](#blueprints), then link it.
- **A linked original stays in Blueprints.** Dragging it out is refused while an entity links it or something in it. The notice names those entities.
- **Links to a top-level trait are removed.** A world or a card made before this rule loses those links, with their overrides, when it opens.
- **Remove a link, and the original stays.** Select **Remove Link** on the link row. Delete the original, and its links go with it. The confirmation tells you how many.
- **The player chooses at Enter World.** A player can change which linked traits an entity starts with, under the same rules as the entity's own traits.
- **The AI reads a linked trait like the entity's own**, with that link's overrides.

> ⚠️ **A link's Stat Changes apply only to the player.** On a **Playable** or **Persona-Only** entity, they apply when the player plays as it. On any other entity, they do nothing. When the player switches persona, the stat changes of the link apply and reverse, not the original's.

### Overrides

A link is **live until edited**. Each field you change becomes an override. The rest of the link keeps following the original. In the tree, an overridden link row has the tooltip **Modified for this link**.

- **Reset** sits at the end of an overridden field's label row. It returns that field to the original.
- **Reset to Blueprint** sits in the footer below every tab. It returns every override on the link. On a trait in a linked group, it returns that trait's overrides. It is disabled while nothing is overridden.
- **Blueprint changed** shows beside a field's **Reset** when the original changed that field after you set your override. Your value may be stale. Edit the field again, or reset it, and the marker clears. It shows on the tab that holds the field, never in the tree.
- **Edit Blueprint** in the footer selects the original. Edit there to change every bearer. It shows in the World Editor's **Traits** tab, not in an entity's **Traits** tab.

A linked group's shape stays live. To add, remove or move a trait for one bearer only, use **Detach**.

### Detach

On a link row's menu, **Detach** takes the place of **Duplicate**. It turns the link into the entity's own trait. The trait no longer follows the original, so edit it freely.

**Detach** rewrites the trait's text so it keeps this bearer's values. Each [blueprint chip](World-Editor-Placeholders#blueprint-chips) and each [pin by blueprint](#pins-by-blueprint) now names the entity's own [copy](World-Editor-Placeholders#copies). Any copy the trait needs and the entity lacks is made. Dragging an original onto an entity as its own trait, and moving an entity's own trait to another entity, do the same rewrite.

On a **Playable**, **Persona-Only** or Custom Persona entity, the trait keeps its **Stat Changes** and **Stat Availability**. On any other entity, a confirmation asks first, and the trait comes without them.

### Links in the Library

An entity's links go with it to the library, to an entity card and into a world bundle. Each link keeps the name of its original and its overrides. When the entity joins a world, each link binds to:

1. The Blueprints trait or group with the same id, when the world has it
2. Else the one Blueprints trait or group of its kind with the same name

With no match, or two, the link is dropped. A top-level trait never matches. A link to a trait the entity already has is dropped too. A requirement that names a bearer, such as "Albus: Paladin", binds to the one entity with that name. A library persona's links bind to the world the player enters.

The library entity editor shows links but never makes them. Opened from a world, it shows them live, with **Reset**, **Remove Link** and **Detach**, and you can still remove a link that world lacks. Opened from the library, it shows them by name only.

## Blueprints
<!-- keywords: template folder, npc only options, hide from player list, master copies, special folder, delete the folder, class definitions -->

**Advanced mode only.** Select **+**, then **Add Blueprints Group**. A blueprint is an item that exists to be linked or copied. A link or a copy reads its blueprint live until you edit it. Traits under Blueprints are never offered to the player. They reach play only through links. Keep originals there that only some entities get, such as classes and races.

- **A world has one Blueprints group.** It stays at the top level. **Add Blueprints Group** leaves the menu while one exists.
- **New items start at the top level.** **Add Trait** and **Add Group** never add inside Blueprints. Drag the new item in.
- **Entities can't go under Blueprints.** Blueprints holds world traits and groups only.
- **Remove it, and each linked item becomes its entities' own trait.** Every link into Blueprints is [detached](#detach), and the linked originals are deleted. Unlinked traits move to the top level, where the player can pick them. A confirmation asks first. It gives the link count and names each cast entity whose copies lose their stat changes.

Placeholders have a [Blueprints group](World-Editor-Placeholders#blueprints) of their own, with the same rule.

## Custom Persona
<!-- keywords: own character, self insert, blank slate hero, oc, no premade hero, library character perks, fourth choice, generic player -->

**Advanced mode only.** Custom Persona is a mark on one entity. The marked entity is a normal entity: it owns traits, links and [copies](World-Editor-Placeholders#copies). Its traits are the player's when the player has no world persona: **None**, or a persona from their own library. Use it to give a race and a class to a player who brings their own persona.

Set the mark on the entity's **Profile** tab. **Custom Persona** is the fourth choice of the **Persona** control, beside **Cast**, **Playable** and **Persona-Only**. See [How to Make a Custom Persona](Persona-Authoring#how-to-make-a-custom-persona) for the steps and [Custom Persona](Persona-Authoring#custom-persona) for the full rules.

- **The Traits and Placeholders tabs always list it** as a bearer, so you can drag to it and link to it while it is empty.
- **Drag a top-level trait onto it to make the trait the persona's.** The trait leaves the top level, so a player with a world persona no longer gets it.
- **Its traits can change stats.** They apply when the player has no world persona.
- **The picks carry over.** A player who switches between **None** and a library persona keeps their Custom Persona picks.
- **In play, its traits have their own heading.** The setup screen and the in-game **Traits** tab show them under the entity's name, marked **You**. Under **None**, the heading takes the name the player entered.
- **It stays at the top level** of the **Traits** tab, in the order you set.

> 💡 With Advanced mode off, links, Blueprints and the Custom Persona entity still show when they hold something, and you can still edit them. Only making new ones needs Advanced mode.

## Pins by Blueprint
<!-- keywords: outfit per class, each holder own value, npc wording leaks, who is affected, per character variation, precedence of text -->

**Advanced mode only.** A trait pin can pin a [blueprint placeholder](World-Editor-Placeholders#blueprints). In the pin's placeholder list, pick the blueprint, then pick its value. You set the value one time, on the original.

On each bearer, the pin traces the blueprint to that bearer's own [copy](World-Editor-Placeholders#copies). Albus's *Paladin* pins *Class Garb*. Albus's copy of *Class Garb* holds the pin, and no other bearer's copy changes.

A link can override its **Placeholder Pins** list. Albus's link can pin *silvered plate*, and another Paladin's link can pin *a plain tabard*.

A pin that names a value the copy removed pins nothing.

### Whose pins apply where

| Text | Pins that apply |
|---|---|
| World text: locations, the world prompt, narration | The world's pins, then the player's trait pins |
| The player's persona | The same as world text |
| An entity's own text | The world's pins, then the player's trait pins, then the entity's own trait pins on top |

An entity's own trait pins never reach anyone else's text. Albus's class never changes the player's description.

## Test Bench Checks
<!-- keywords: validation, errors warnings, can never unlock, impossible setup, broken reference, problems found, redundant, unused, debug my perks -->

The **Test Bench** checks every bearer as if the player picked it. That includes **Playable** and **Persona-Only** entities and the Custom Persona entity.

It shows an error when:

- A trait can never unlock for its bearer. For example, Albus links *Smite*, but nothing on Albus gives *Paladin*.
- A requirement names a trait or group the world no longer has.
- A trait's **Stat Availability** names a stat that doesn't exist.
- A group's **At Least** is above its **At Most**.
- A group needs more picks than its traits can ever unlock.
- A new game starts a group with fewer picks than its minimum. The defaults and active **Always On** traits don't meet it.

It shows a warning when:

- More **Always On** traits can be active together than a group's maximum allows. The check can report a group that never fills, because it ignores the maximums of other groups.
- A group marks more traits as default than its maximum allows. Some defaults won't apply.
- A trait is marked **Enabled by Default**, but no starting choice meets its requirements, so it starts unselected.
- A bearer needs a copy of a blueprint and has none. The warning names the bearer and the trait or chip that needs it.
- A copy removed the value that a pin names. The pin pins nothing.
- A blueprint chip or a pin by blueprint sits where it is refused, such as in a location or a world placeholder.
- A link is redundant, because another link on the same bearer already brings its original.

It shows a note when:

- An edited copy has no trait or chip that uses it. Keep the copy or delete it.
- A group with a maximum of one has one trait or none, so it offers no real choice.

## Example: RPG Classes
<!-- keywords: class system, dnd, job system, spells per class, worked sample, walkthrough, fantasy roles, step by step build, emberwatch -->
<!-- route: worldEditor.traits -->

A world where the player and some entities have a class. The steps run on the **Traits** tab with Advanced mode on, except step 3, which runs on the **Placeholders** tab.

1. **Add a Blueprints group.** Add a **Classes** group set to **Exactly One**, with *Paladin*, *Cleric* and *Wizard*, and drag it into Blueprints. Add a **Spells** group with *Smite* the same way, and set *Smite* to require *Paladin*.
2. **Link Classes and Spells to Albus.** Select the link, then check **Enabled by Default** on *Paladin*. Albus starts as a Paladin, and Smite unlocks for him.
3. **Pin a blueprint from each class.** In the Placeholders tab, add a Blueprints group with *Class Garb*. *Paladin* pins *Class Garb* to *silvered plate*. Albus gets his own copy of *Class Garb* by itself.
4. **Mark a Custom Persona entity and link Classes to it.** A player with no world persona now picks a class too.

In play, a player who picks *Wizard* never unlocks Albus's *Smite*, and Albus's garb never changes the player's description.

The bundled world **Emberwatch** is the full version of this example. Open it in the World Editor with Advanced mode on, and read **How this world is built** in its readme.
