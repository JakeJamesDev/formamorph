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
| **Descriptions** | The player-facing and AI-facing descriptions, in Advanced mode the **AI-Facing Summary**, and the **Unidentified Name** and **Unidentified Description** |
| **Properties** | Value, Stackable, Uses, When Empty, Bound, Slot and Slot Size |
| **Effects** | The stat effect rows: what the item does to its owner's stats |
| **Placeholders** | The item's own placeholders (Advanced mode only) |

An image's **Visibility Rule** reads whoever owns the item. A Condition with no owner reads as **Item Owner**.

An item's placeholders roll once per playthrough. Every Item Copy shows the same value.

## Unidentified items
<!-- keywords: unidentified, identify, mystery item, cursed item, true name, hidden identity, unidentified name, unidentified description -->
<!-- route: worldEditorItem.descriptions -->

An item can hide what it really is until the story reveals it. A cursed ring can look like a plain ring.

| Field | What it does |
|---|---|
| **Unidentified Name** | The name the player sees until the item is identified |
| **Unidentified Description** | The description the player sees until the item is identified |

- 🔒 Fill either field, and every copy of the item starts unidentified. A blank field shows the normal value.
- 👁️ The player sees only the unidentified face: in the **Inventory** tab, in the log and in Formaquestion.
- 📖 The narrator sees both faces, with the true one marked unknown to the player. It can reveal the truth when the story does.
- ✨ The item's effects apply while it's unidentified.
- 🔍 A reveal identifies a visible unidentified copy, from the story or from a script's `reveal()`. A hidden copy first comes into view and stays unidentified; a second reveal identifies it.
- 📦 Unidentified and identified copies never stack. An identified copy joins a matching stack in the same place.

## Properties
<!-- keywords: value, price, worth, stack, consumable, charges, uses, when empty, empty bottle, becomes, changes state, single use, state, sealed, opened, lit, bound, quest item, slot, equip -->
<!-- route: worldEditorItem.properties -->

| Property | What it does |
|---|---|
| **Value** | What the item is worth. The unit is a stat, such as Gold, or your own text. |
| **Stackable** | Item Copies group into one row with a quantity. On by default. |
| **Uses** | How many times each Item Copy can be used. Leave it blank for unlimited. |
| **When Empty** | What a copy's last use leaves: **Stays** (kept at zero uses), **Gone** (removed), **Becomes** (turns into another item you pick) or **Changes State** (kept at zero uses with the word you type). Shows once **Uses** is set; it starts at **Gone**. |
| **State** | The word each Item Copy starts with, such as *sealed* or *unlit*. The story and scripts can change it. Leave it blank for none. |
| **Bound** | The player can't drop the item or give it away. The player can still pick it up, and the story can still move it. |
| **Slot** | The slot the item equips into. **Not Equippable** means it can't be worn or held. |
| **Slot Size** | How much of the slot's capacity the item takes, such as 2 for a two-handed sword. |

> ⚠️ An item with **Uses** 2 or more never stacks, because each copy counts its own. Setting it turns **Stackable** off. Clearing it leaves it off until you turn it on. **Uses** 1 still stacks.

| Item | Uses | When Empty |
|---|---|---|
| 🧪 Potion that leaves a bottle | 1 | Becomes Empty Bottle |
| 🍷 Potion with three gulps | 3 | Gone |
| 🪄 Wand | 3 | Stays |
| ✉️ Letter | 1 | Changes State "opened" |
| 📯 Horn | blank | — |

> 🧭 The **Test Bench** flags an item that **Becomes** an item you deleted.

### State

- 🏷️ The player sees each copy's **State** beside its name in the **Inventory** tab. The AI sees it beside the name too.
- 🧱 Copies with different States never stack. "Lit" and "lit" count as the same.
- ✋ The **Inventory** tab has no control to change it. The story and scripts do.

## Effects
<!-- keywords: stat effects, bonus, buff, equip bonus, raise strength, max health, regen, while equipped, while owned, first obtain, after use, after consumed, potion, duration, timed effect -->
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
| 🧪 **After Use** | When the owner uses the item, for a set time or for good. A row here makes the item usable, even with **Uses** blank. |
| ✨ **On First Obtain** | Once, the first time the owner gets the item. It stays after the item is gone. |

- When an effect ends, it gives back exactly what it gave. A +2 that only fit +1 under the maximum takes back 1.
- A stat resting at its maximum rises with a **Max** effect, as it does with a trait.
- Starting items apply their effects when the game starts.
- An owner without the stat skips the row, and the log says so. The player's own stats come from the persona, not the Global Stats.
- The log names the item for each change. A hidden item shows as "An item".

### After Use effects
<!-- keywords: consume, after consumed, use item, drink, potion, buff duration, timed effect, permanent, second dose, refresh, charges, wand, recharge -->

An **After Use** row also picks a **Duration**: **Permanent**, or an amount of story time in minutes, hours, days or weeks.

- 🧪 **Use** shows on an item with **Uses**, **After Use** effects or a **When Used** script. It spends one use.
- 🔋 The last use runs **When Empty** on that one copy. A copy that **Stays** keeps **Use** off until a script recharges it.
- 📯 An item with **Uses** blank can be used any number of times and never changes.
- ⏳ A timed effect ends once the story clock passes its duration, and gives back exactly what it gave.
- 🔁 A second dose while the effect runs restarts its timer. The effect doesn't stack.
- ♾️ A **Permanent** effect never ends, and each dose applies it again.
- 🎲 Each Item Copy keeps its own uses. Giving one wand away moves only its own count.

### Trait effects
<!-- keywords: trait effects, grant trait, cursed ring, give trait, item trait -->

A trait effect row gives the owner a trait while its timing holds. Each row picks a trait and a timing.

- 🧬 The trait comes from the owner's own list: an entity's traits, or the played persona's. An owner without that trait skips the row, and the log says so.
- 🔒 The trait stays on while any source holds it. A trait the owner picked stays when the item leaves.
- 🚫 An item grant counts toward no Pick Count and switches off no other trait in its group.
- ⏳ The trait's own requirements still apply. A granted trait whose requirement fails turns on once it holds.
- ✋ The player cannot switch off a trait an item holds on.
- ✨ **On First Obtain** grants the trait for good.
- 🧪 **After Use** grants the trait for its duration, or for good when **Permanent**.
- ⚙️ Automatic traits are not offered: they turn on by their own rules.

## Requirements
<!-- keywords: equip requirements, strength needed, cannot equip, unequips, requirement -->
<!-- route: worldEditorItem.requirements -->

Requirement Rows on the **Requirements** tab set what an owner needs to equip the item. Any one row that holds is enough. With no rows, anyone can equip it.

- 🧑 A Condition with no owner reads the item's owner.
- 🗡️ The item's own effects never count, in either direction. A +2 Strength sword cannot meet its own Strength 5 requirement, and a cursed -2 Strength sword cannot fail it. Every copy of the same item on that owner is left out.
- ⛔ Equipping fails, and the log names the requirement, when no row holds.
- 🔄 An equipped item unequips on its own once no row holds, and its effects reverse. One unequip can set off another; the game settles them all, up to 10 rounds.

## Scripts
<!-- keywords: item scripts, when gained, when lost, when equipped, when unequipped, when used, when consumed, item code, item event -->
<!-- route: worldEditorItem.scripts -->

The **Scripts** tab runs code on the item's events. It shows in Advanced mode.

| Timing | Runs when |
| --- | --- |
| **When Gained** | An owner or a location gains an Item Copy |
| **When Lost** | An owner or a location loses an Item Copy |
| **When Equipped** | An Item Copy is equipped |
| **When Unequipped** | An Item Copy is unequipped |
| **When Used** | An Item Copy is used |

- 🧑 `owner` is the Item Copy's owner, and empty while it lies at a location. `self` is the item.
- 🔗 A script that gives or takes items runs those items' scripts too, 3 levels deep at most.
- 🌱 Starting items run no script.

The [Scripts Guide](ScriptsGuide#items) lists what an item script can read and write.

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

## Items in the story
<!-- keywords: inventory pass, ai gives items, story picks up item, invented item, runtime item, item names, narrator item changes -->

After each turn's narration, the **Inventory** prompt reads the turn and records what it did to items. It can give, take, move, equip, unequip and use up an item, and reveal a hidden one. It sees the items of the player, of the people here, and of the location.

- 🔤 A name in the story matches your item when it's the same name, ignoring case and spaces. "iron sword" is your **Iron Sword**. "iron swords" is not. An unidentified copy also matches its **Unidentified Name**.
- ➕ A name that matches no item makes a plain item with that name: it stacks, it can be used up, and it has no slot and no effects. The same name later reuses it.
- 🎒 The step runs only while the world has items or the game holds any. A world with no items never sends it.
- ⚖️ The story can take a **Bound** item. Only the player's buttons can't.

The step's prompt is on the **Prompts** tab in Settings, under **Inventory**.
