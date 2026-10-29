# 🎒 World Editor: Items
<!-- keywords: inventory, objects, loot, gear, equipment, weapons, potions, keys, things to carry, props -->
<!-- route: worldEditor.items -->

> 🛠️ Part of the [World Editor](WorldEditor) guide.

Items are the objects of your world that someone can own: a sword, a potion, a key, a cursed ring. Each one is defined once on the **Items** tab.

## Why it exists
<!-- keywords: ai forgets items, narrator invents gear, keep track of objects, persistent items -->

Without items, a sword exists only in the prose, and the narrator forgets it a few turns later. An item is a fixed object with its own description, image and rules.

## How to Add an Item
<!-- keywords: create item, new item, make object, add weapon, add potion -->
<!-- route: worldEditor.items#list-toolbar -->

1. Open the **Items** tab. It sits right below **Entities**.
2. Type the item's name in the **Filter Items** box.
3. Select the **+** button (**Add Item**).
4. The new item opens in the panel. Give it an image on the **Profile** tab.
5. On the **Descriptions** tab, write the **AI-Facing Description**.
6. Select **Save**.

> 💡 Drag an item by its grip to change the order of the list. Use the row's buttons to duplicate or delete it.

## The panel
<!-- keywords: item tabs, profile, descriptions, item image, item placeholders, image rule -->
<!-- route: worldEditorItem.profile -->

The item panel works like the entity panel.

| Tab | What it holds |
|---|---|
| **Profile** | The name, the images with their rules, and the image tags |
| **Descriptions** | The player-facing and AI-facing descriptions, and in Advanced mode the **AI-Facing Summary** |
| **Properties** | Value, Stackable, Consumable, Charges, Bound, Slot and Slot Size |
| **Effects** | The stat effect rows: what the item does to its owner's stats |
| **Placeholders** | The item's own placeholders (Advanced mode only) |

An image's **Visibility Rule** reads whoever owns the item. A Condition with no owner reads as **Item Owner**.

An item's placeholders roll once per playthrough. Every Item Copy shows the same value.

## Properties
<!-- keywords: value, price, worth, stack, consumable, charges, uses, bound, quest item, slot, equip -->
<!-- route: worldEditorItem.properties -->

| Property | What it does |
|---|---|
| **Value** | What the item is worth. The unit is a stat, such as Gold, or your own text. |
| **Stackable** | Item Copies group into one row with a quantity. On by default. |
| **Consumable** | The owner can use the item up. |
| **Charges** | How many uses each Item Copy starts with. Leave it blank for none. |
| **Bound** | The player can't drop the item or give it away. The story still can. |
| **Slot** | The slot the item equips into. **Not Equippable** means it can't be worn or held. |
| **Slot Size** | How much of the slot's capacity the item takes, such as 2 for a two-handed sword. |

> ⚠️ An item with **Charges** never stacks. Setting charges turns **Stackable** off. Clearing them leaves it off until you turn it on.

## Effects
<!-- keywords: stat effects, bonus, buff, equip bonus, raise strength, max health, regen, while equipped, while owned, first obtain -->
<!-- route: worldEditorItem.effects -->

An effect row changes one of the owner's own stats. Each row picks a stat, a facet, a timing and an amount.

| Facet | What it changes |
|---|---|
| **Value** | The stat's current value |
| **Min** / **Max** | The stat's lowest or highest value |
| **Regen** | How much the stat recovers over time |

| Timing | When it applies |
|---|---|
| ⚔️ **While Equipped** | While the item is equipped. Two equipped copies apply twice. |
| 🎒 **While Owned** | While the owner has the item. Three copies still count once. |
| ✨ **On First Obtain** | Once, the first time the owner gets the item. It stays after the item is gone. |

- When an effect ends, it gives back exactly what it gave. A +2 that only fit +1 under the maximum takes back 1.
- A stat resting at its maximum rises with a **Max** effect, as it does with a trait.
- Starting items apply their effects when the game starts.
- An owner without the stat skips the row, and the log says so. The player's own stats come from the persona, not the Global Stats.
- The log names the item for each change. A hidden item shows as "An item".

### Trait effects
<!-- keywords: trait effects, grant trait, cursed ring, give trait, item trait -->

A trait effect row gives the owner a trait while its timing holds. Each row picks a trait and a timing.

- 🧬 The trait comes from the owner's own list: an entity's traits, or the played persona's. An owner without that trait skips the row, and the log says so.
- 🔒 The trait stays on while any source holds it. A trait the owner picked stays when the item leaves.
- 🚫 An item grant counts toward no Pick Count and switches off no other trait in its group.
- ⏳ The trait's own requirements still apply. A granted trait whose requirement fails turns on once it holds.
- ✋ The player cannot switch off a trait an item holds on.
- ✨ **On First Obtain** grants the trait for good.
- ⚙️ Automatic traits are not offered: they turn on by their own rules.

## Requirements
<!-- keywords: equip requirements, strength needed, cannot equip, unequips, requirement -->
<!-- route: worldEditorItem.requirements -->

Requirement Rows on the **Requirements** tab set what an owner needs to equip the item. Any one row that holds is enough. With no rows, anyone can equip it.

- 🧑 A Condition with no owner reads the item's owner.
- 🗡️ The item's own effects never count, in either direction. A +2 Strength sword cannot meet its own Strength 5 requirement, and a cursed -2 Strength sword cannot fail it. Every copy of the same item on that owner is left out.
- ⛔ Equipping fails, and the log names the requirement, when no row holds.
- 🔄 An equipped item unequips on its own once no row holds, and its effects reverse. One unequip can set off another; the game settles them all, up to 10 rounds.

## Slots
<!-- keywords: equipment slots, hand, ring, head, armor slot, capacity, two handed -->
<!-- route: worldEditor.overview -->

Slots are the places an item can be equipped, such as Hand or Ring. You set them once for the whole world, on the **Overview** tab under **Slots**. The player and every entity share the same slots.

1. Open the **Overview** tab.
2. Under **Slots**, select **Add Slot**.
3. Type the slot's name.
4. Set its capacity: how many item units fit. A Ring slot with capacity 2 holds two rings.

When you delete a slot that items use, the editor asks first. Those items become not equippable.

## Starting Items
<!-- keywords: starting items, starting gear, give items, place items, loot, hidden item, treasure, merchant stock, persona items -->
<!-- route: worldEditorEntity.items -->

Starting items are the items a new game begins with. You can place them in three spots:

| Where | Where to set it |
|---|---|
| 👤 The player | **Overview** tab, under **Persona Items**. The player gets them whoever they play. |
| 🧑 An entity | The entity's **Items** tab |
| 📍 A location | The location's **Items** tab. They lie there for anyone to pick up. |

Each row picks an item, a quantity and **Hidden**. A hidden item is there, but the player doesn't see it until the story reveals it.

- When the player plays a world entity, that entity's starting items are the player's.
- Two rows of the same stackable item on one owner become one stack. A hidden row stays its own row.
- A persona-only entity that nobody plays gets no items.

> ⚠️ Starting items appear only in a new game. A saved game never gains the items you add later.
