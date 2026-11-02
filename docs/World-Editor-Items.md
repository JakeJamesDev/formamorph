# 🎒 World Editor: Items
<!-- keywords: inventory, objects, loot, gear, equipment, weapons, potions, keys, things to carry, props -->
<!-- route: worldEditor.items -->

> 🛠️ Part of the [World Editor](WorldEditor) guide.

Items are the objects of your world that the player or an entity can own: a sword, a potion, a key, a cursed ring. Each one is defined once on the **Items** tab.

## Why it exists
<!-- keywords: ai forgets items, narrator invents gear, keep track of objects, persistent items -->

Without items, a sword exists only in the prose, and the narrator forgets it a few turns later. An item is a fixed object with its own description, image and rules.

## How to Add an Item
<!-- keywords: create item, new item, make object, add weapon, add potion -->
<!-- route: worldEditor.items#list-toolbar -->

1. Open the **Items** tab. It sits right below **Entities**.
2. Type the item's name in the **Filter Items** box.
3. Select the **Add Item** icon button (+).
4. The new item opens in the panel. Give it an image on the **Profile** tab.
5. On the **Descriptions** tab, write the **AI-Facing Description**.
6. Select **Save**.

- With the box empty, the new item is named "New Item".
- Drag an item by its grip to change the order of the list.
- Use the row's buttons to duplicate or delete an item. Deleting an item also removes it from every **Starting Items** list.

## The panel
<!-- keywords: item tabs, profile, descriptions, item image, item placeholders, image rule -->
<!-- route: worldEditorItem.profile -->

The item panel works like the entity panel.

| Tab | What it holds |
|---|---|
| **Profile** | The name, the [**Icon**](#icon), the images with their rules, and the image tags |
| **Descriptions** | The player-facing and AI-facing descriptions, in Advanced mode the **AI-Facing Summary**, and the **Unidentified Name** and **Unidentified Description** |
| **Properties** | Value, Stackable, Uses, State, When Empty, Bound and Slots |
| **Effects** | The stat and trait effect rows: what the item does to its owner |
| **Requirements** | The [Equip Requirements](#requirements) |
| **Scripts** | The item's [scripts](#scripts) (Advanced mode only) |
| **Placeholders** | The item's own placeholders (Advanced mode only) |

An image's **Visibility Rule** reads whoever owns the item. A Condition with no owner reads as **Item Owner**.

An item's placeholders roll once per playthrough. Every Item Copy shows the same value.

## Icon
<!-- keywords: item icon, icon field, auto icon, pick an icon, wrong icon, no icon, show item image on doll, inventory icon -->
<!-- route: worldEditorItem.profile -->

The **Icon** field picks what the **Inventory** tab shows for the item, on the figure and in its rows. Search the grid by a word, such as "blade" for a sword.

| Choice | What shows |
|---|---|
| **Auto** | An icon from the item's name, then its slots. This is the default, and the field shows the icon you get. |
| An icon | That icon |
| **None** | The item's image. With no image, a filled box on the figure and no icon in a row. |

- 🖼️ The item's popup keeps its image under every choice.
- 🔒 An unidentified copy ignores this field and the item's image. Its icon comes from what the player sees, so it reveals nothing.
- 🎲 The field reads a placeholder in the name by its label. During the game, Auto reads the rolled value, so the icon can differ.

## Unidentified items
<!-- keywords: unidentified, identify, mystery item, cursed item, true name, hidden identity, unidentified name, unidentified description -->
<!-- route: worldEditorItem.descriptions -->

An item can hide its true name and description until the story reveals them. A cursed ring can look like a plain ring.

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
| **Value** | What the item is worth, and the [Currency](#currencies) it is priced in. With **No Currency**, the item has no price. |
| **Stackable** | Item Copies group into one row with a quantity. On by default. |
| **Uses** | How many times each Item Copy can be used. Leave it blank for unlimited. |
| **When Empty** | What a copy's last use leaves: **Stays** (kept at zero uses), **Gone** (removed), **Becomes** (turns into another item you pick) or **Changes State** (kept at zero uses with the word you type). Shows once **Uses** is set; it starts at **Gone**. |
| **State** | The word each Item Copy starts with, such as *sealed* or *unlit*. The story and scripts can change it. Leave it blank for none. |
| **Bound** | The player can't drop the item or give it away. The player can still pick it up, and the story can still move it. |
| **Slots** | The slots the item equips into, in the order it tries them. With no slots, it can't be worn or held. |
| **Either of / All of** | Shows once **Slots** lists two. **Either of** takes one of them, such as a dagger in Main Hand or Off Hand. **All of** takes every one, such as a greatsword in both. |

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

Requirement Rows on the **Requirements** tab set what an owner needs to equip the item. Any one row that holds is enough. With no rows, any owner can equip it.

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

The [Scripts Guide](Scripts-Reference#items) lists what an item script can read and write.

## Currencies
<!-- keywords: money, currency, currencies, credits, gold, price, worth, wallet, default currency, stat money, no currency -->
<!-- route: worldEditor.items -->

**Currencies** sits at the top of the **Items** list, below **Equipment Settings**. It lists the money your world uses.

| Type | What it does |
|---|---|
| 📊 **Stat** | The money is a number on a stat you pick. |
| 🪙 **Coin Items** | The money is coins, each one a Stackable item, such as Copper, Silver and Gold. |
| 🏷️ **Name Only** | The money is only a name, such as goats. Nothing tracks it. |

With **Coin Items**, pick **Add Coin** to add a row. Each row is an item and its worth in the smallest coin:

- 1️⃣ One coin is worth 1. The first row you add takes it. Later rows start at ten times the largest worth.
- 🔢 Each worth is a whole number, and no two coins share one.
- 🧱 A coin is a Stackable item, and an item is a coin of one Currency at most.
- ↕️ The arrows move a row. The player always reads coins from largest to smallest.

An item priced in a coin Currency shows one **Value** field per coin. Type 1 in **Gold** and 5 in **Copper** to store 105. The fields tidy up when you leave them, so 15 Copper becomes 1 Silver and 5 Copper. If you change a coin's worth, each item keeps its total, and its fields change to match.

- 🥇 A new item takes the first Currency in the list. Drag a row to change which one comes first.
- 🔗 The stat list holds your global stats, the stats your Personas link, and each Persona's own stats. A stat that many Personas link shows once.
- 💰 The player sees an item's worth in its popup, such as "Worth 40 Credits" or "Worth 1 Gold, 5 Copper". An unidentified copy shows no worth.
- 👛 The **Inventory** tab lists the player's money under **Money**: one row for each Currency with coins or a stat the player has. A **Name Only** Currency has no row. A hidden stat has no row either.
- 🤖 The **Inventory** chip tells the AI each listed item's worth, and how much money the player and each entity have.
- 🏪 To limit how much an entity can pay, place one of the coins on it, or give it the stat. An entity with neither has no money to run out of. A Global Stat is the player's money only.
- 🚫 An item with **No Currency** shows no worth, even with a **Value**.

### Deleting money

A delete is never blocked. When something uses what you delete, a confirm names what changes. Nothing else asks.

- 📊 Delete a stat that backs a Currency, or the Persona who owns it, and that Currency becomes **Name Only**. Deleting Blueprints does the same when it removes the stat's last copy.
- 🪙 Delete a coin item and its row leaves the Currency. If it was the last coin, the Currency becomes **Name Only**. If it was the coin worth 1, the other coins stay, and the Currency shows a hint until a coin is worth 1.
- 🗑️ Delete a Currency and its items lose their **Currency**. The confirm gives the item count.
- 🏷️ Every item keeps its **Value**. A delete clears the Currency and leaves each price in place.
- ↩️ Each delete is one undo step.

## Equipment Settings
<!-- keywords: equipment, equipment settings, slots, bodies, body, hand, ring, head, armor slot, capacity, two handed, dog, creature, default body -->
<!-- route: worldEditor.items -->

**Equipment Settings** sits at the top of the **Items** list. It holds three sections:

| Section | What it sets |
|---|---|
| 🧤 **Slots** | The places an item can be equipped, such as Hand or Ring |
| 🧍 **Bodies** | Which slots an owner has, and how many items fit in each |
| 🎒 **Persona Items** | What the player starts with (see [Starting Items](#starting-items)) |

### Slots

Slots are one list for the whole world, so a helmet fits every Body with a Head.

1. Select **Equipment Settings**.
2. Under **Slots**, select **Add Slot**.
3. Type the slot's name.

Drag a slot by its grip to reorder the list.

### Bodies

A Body is a name and a list of slots, each with a **Capacity**. A Humanoid can have Main Hand, Off Hand and Ring with Capacity 2. A Dog can have only Collar.

1. Under **Bodies**, select **Add Body**.
2. Expand it and type its **Name**.
3. Pick a slot from **Add Slot**, then set its **Capacity**.

- 🥇 **The first Body is the Default.** Every entity without a pick uses it, and so do entities the AI adds. Drag a Body by its grip to change which one is first.
- ⚠️ Two Bodies with one name get a warning. Scripts pick a Body by its name.
- 💍 Each unit of Capacity holds one item. Use Capacity for slots that work alike, such as rings. Use two slots when the difference matters, such as hands.
- 🚫 A world with no Bodies gives no one a slot.
- 📄 Select a Body's **Duplicate** button to copy it, with its figure and boxes.

### Laying out a Body
<!-- keywords: body layout, paperdoll, doll, figure, backdrop, humanoid, quadruped, slot box, snap to others, move box, resize box -->

An expanded Body shows a figure with one box for each unit of each slot. Hand with Capacity 2 gets **Hand 1** and **Hand 2**.

| To do this | Do this |
|---|---|
| Move a box | Drag it |
| Resize a box | Select it, then drag a corner |
| Change the figure's height | Drag its bottom edge. Boxes stretch with it |
| Change the figure | Pick from **Backdrop**: **Humanoid**, **Quadruped**, **Plain** or **Custom Image** |
| Fade a Custom Image | Move the **Opacity** slider under the image. It runs from 0 to 100% and starts at 100%. It fades the image in the editor and on the **Inventory** tab's figure |
| Line boxes up | Turn on **Snap to Others**. Hold Alt to skip it for one drag |
| Move or resize by keyboard | Select the box, then use the arrow keys, or Shift + arrow keys to resize |

- ➕ A raised **Capacity** adds a small box at the center. A lowered one removes the last box.
- 👆 A small box draws above a large one, so you can still select a ring on a hand.
- 🔍 Select a slot's row to find its box. Select the row again to reach the next unit, even one hidden behind another box.
- 💾 **Snap to Others** is your own setting. It isn't saved in the world.

### Each entity's Body

An entity picks its Body at the top of its **Items** tab:

| Option | Means |
|---|---|
| **Default (Humanoid)** | The first Body, whichever it is now |
| **None** | No slots. The entity can carry items but can't equip them |
| A Body's name | That Body |

The **Custom Persona** entity's Body is also the player's when they pick **None** or a library persona.

### Deleting a slot or a Body

A slot or Body nothing uses deletes at once. One in use asks first, and says what changes:

- **Slot:** its Body entries go, and items that equip into it drop it from their **Slots**.
- **Body:** the entities that picked it go back to **Default**, and trait Body rows that named it go blank.

## Starting Items
<!-- keywords: starting items, starting gear, give items, place items, loot, hidden item, treasure, merchant stock, persona items -->
<!-- route: worldEditorEntity.items -->

Starting items are the items a new game begins with. You can place them in three spots:

| Where | Where to set it |
|---|---|
| 👤 The player | **Equipment Settings**, under **Persona Items**. The player gets them whoever they play. |
| 🧑 An entity | The entity's **Items** tab |
| 📍 A location | The location's **Items** tab. They lie there for the player or any entity to pick up. |

Each row picks an item, a quantity and **Hidden**. A hidden item is there, but the player doesn't see it until the story reveals it.

- When the player plays a world entity, that entity's starting items are the player's.
- Two rows of the same stackable item on one owner become one stack. Hidden rows stack only with hidden rows.
- A persona-only entity that nobody plays gets no items.

> ⚠️ Starting items appear only in a new game. A saved game never gains the items you add later.

### Equipped
<!-- keywords: start equipped, starting equipment, starting armor, wear at start, equipped at start -->

On the player or an entity, a row whose item has a slot also shows **Equipped**. ⚔️ An Equipped item starts the game equipped, and its **While Equipped** effects apply from the first turn.

- Rows equip in list order. When a slot is full, a later row unequips the earlier item, which starts carried.
- A row with a quantity equips each copy in turn. Three rings in a slot that holds two leave one carried.
- An item that can't be equipped starts carried. The row warns you when its Body lacks the slots it needs.
- An item whose [Requirements](#requirements) fail at the start also starts carried.
- An Equipped item can also be **Hidden**. It fills its slot, but the player doesn't see it.

## Items in the story
<!-- keywords: inventory pass, ai gives items, story picks up item, invented item, runtime item, item names, narrator item changes -->

After each turn's narration, the **Inventory** prompt reads the turn and records what it did to items. It can give, take, move, equip, unequip and use an item, change its State, and reveal a hidden or unidentified one. It sees the items of the player, of the entities in the scene, and of the location.

- 🧪 A use follows the item's **When Empty**. For a plain item the story made, the story says whether the use kept it or used it up.
- 🔤 A name in the story matches your item when it's the same name, ignoring case and the spaces at the ends. "iron sword" is your **Iron Sword**. "iron swords" is not. An unidentified copy also matches its **Unidentified Name**.
- ➕ A name that matches no item makes a plain item with that name: it stacks, it can be used, and it has no slot and no effects. The same name later reuses it.
- 🎒 The step runs only while the world has items or the game holds any. A world with no items never sends it.
- ⚖️ The story can take a **Bound** item. Only the player's buttons can't.

The step's prompt is on the **Prompts** tab in Settings, under **Inventory**. That tab shows in Advanced mode.
