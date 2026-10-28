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

## Slots
<!-- keywords: equipment slots, hand, ring, head, armor slot, capacity, two handed -->
<!-- route: worldEditor.overview -->

Slots are the places an item can be equipped, such as Hand or Ring. You set them once for the whole world, on the **Overview** tab under **Slots**. The player and every entity share the same slots.

1. Open the **Overview** tab.
2. Under **Slots**, select **Add Slot**.
3. Type the slot's name.
4. Set its capacity: how many item units fit. A Ring slot with capacity 2 holds two rings.

When you delete a slot that items use, the editor asks first. Those items become not equippable.
