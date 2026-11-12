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
2. To name the trait as you add it, type the name in the **Filter Traits** box.
3. Select the **Add to Traits** icon button (+). In Advanced mode, select **Add Trait** in its menu. The new trait opens on its **Details** tab.
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
5. Pick whose trait counts: **Same Owner**, **Persona**, or an entity. A **Playing As** target skips this step, and so does a target that only one owner can have.
6. Optional: to need a second target as well, select **And** in the same row and pick it. The trait then needs both.
7. Optional: to open the trait another way, select **Or Another Way** and pick a target for the new row. Any one row is enough.

To remove a target, select the **×** on its chip. To remove a whole row, select the **×** at the end of the row.

## How to Set a Pick Count
<!-- keywords: limit, cap, how many, choose one, max, min, exactly one, radio, multiple, mutually exclusive, single choice, one of, at least two, force selection, mandatory, slots, required choice -->
<!-- route: worldEditor.traits -->

1. Select a trait group. To add one, switch to Advanced mode, select the **Add to Traits** icon button (+), then **Add Group**.
2. Open the **Pick Count** list and pick **Any**, **Exactly One**, **Up to One** or **Custom**.
3. For **Custom**, type **At Least** and **At Most**. Leave **At Most** empty for no limit.
4. For **Exactly One**, select a trait in the group, open its **Availability** tab, and set **Starts** to **On**. A new game then starts with a valid pick.

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
<!-- keywords: pins tab missing, scripts tab missing, stats tab missing, owned by line, details tab, five tabs -->
<!-- route: worldEditorTrait.details -->

Select a trait to open its panel.

| Tab | Holds | Mode |
|---|---|---|
| **Details** | **Name** and the two descriptions | Simple and Advanced |
| **Availability** | **Mode**, **Starts**, **In Game** and [**Requires**](#requirements) | Simple and Advanced |
| **Stats** | **Stat Changes** and **Stat Availability** in Advanced mode | Simple and Advanced |
| **Appearance** | [**Body**](#body), [**Sliders**](#sliders) and [**Colors**](#colors) | Simple and Advanced |
| **Pins** | **Placeholder Pins** | Advanced only |
| **Scripts** | [Scripts](#scripts) | Advanced only |

In the World Editor's **Traits** tab, an entity's own trait opens its **Details** tab with **Owned by** and the entity's name.

## Availability
<!-- keywords: automatic, always on, curse, cursed item, passive, forced on, secret bonus, preselected, switch mid game, innate, cant turn off -->
<!-- route: worldEditorTrait.availability -->

The **Availability** tab sets who controls the trait and when it can be active. It opens with three rows, **Mode**, **Starts** and **In Game**. One sentence under them states the rule they make together.

### Mode

**Mode** sets who controls the trait.

| Mode | What it does |
|---|---|
| **Optional** | The player chooses the trait. This is the default. |
| **Automatic** | The trait is on whenever its [requirements](#requirements) hold. The player can never switch it. With no requirements, it's always on. |
| **Hidden** | Works like **Automatic**, and the player never sees it. The AI reads it like any active trait. |

Only **Optional** traits use **Starts** and **In Game**. Under **Automatic** and **Hidden** they stay in place and dim. A value there has no effect.

| Row | Choices | What it does |
|---|---|---|
| **Starts** | **Off** or **On** | **On** selects the trait when a new game starts. The player can still clear it. |
| **In Game** | **Fixed** or **Toggleable** | **Toggleable** lets the player turn the trait on or off from the **Traits** tab during the game |

### Curses

A curse is an **Automatic** trait that requires the cursed item. The player picks the item, and the curse comes with it. The player drops the item, and the curse lifts. The player sees the curse only when it takes effect.

### Hidden traits

Use a **Hidden** trait for a secret bonus or a hidden nature. It can carry **Stat Changes**, and visible stat bars move with them.

- Its name shows only in tools for authors: the Prompt viewer and the **Test Bench**.
- The requirement lines of other traits skip it, and skip **Not** conditions on it too.
- A trait whose requirements are all hidden reads **Locked**.

> 💡 **A requirement can point at an Automatic or Hidden trait.** A hidden bonus can unlock other traits.

> ⚠️ **A script never switches an Automatic or Hidden trait.** Its requirements alone decide.

## Stat Changes
<!-- keywords: bonus, buff, debuff, modifier, penalty, extra hp, raise cap, boost, adds not sets -->
<!-- route: worldEditorTrait.stats -->

Each row changes one stat while the trait is active. A row has a stat, a number, and the field to change. Select **Add Stat Change** to add a row.

> ⚠️ **Each type adds to the stat. It doesn't set it.** `+20` on a stat that starts at 50 gives 70, not 20.

The AI never reads Stat Changes. It reads that you're *Sickly*, not that the trait costs you 20 Vigor. The change shows only in the stat's value.

| Type | Effect |
|---|---|
| **Starting Value** | Changes where the stat starts |
| **Min** | Raises the Min. A value below the new Min rises with it. A negative number only cancels another trait's raise. It **never goes below the Min you wrote on the stat**. |
| **Max** | Raises or lowers the Max. A value above the new Max drops with it. |
| **Regen** | Adds to the stat's Regen. A negative number drains. |

Min and Max follow different rules on purpose. A trait can put the Max anywhere. A trait can never put a stat below the range you designed.

On an entity's trait, the rows change that entity's own stats. The stat list shows its stats, then a **Global** group with the global stats. See [Entity Traits and Stats](#entity-traits-and-stats).

## Stat Availability
<!-- keywords: unlock a meter, mana for mages, class specific bar, show bar only if, turn on gauge, conditional meter -->

**Advanced mode only.** Select **Add Stat Availability** to add a row. Each row names a stat and picks **Enable** or **Disable**. The row overrides the stat's own [**Enabled** checkbox](World-Editor-Stats#availability) while the trait is active.

A disabled stat isn't shown to the player or sent to the AI. Its Regen and scripts don't run.

## Body
<!-- keywords: transformation, wolf form, change shape, equipment slots, lose slots, unequip on transform, curse body -->
<!-- route: worldEditorTrait.appearance -->

A Body row changes which equipment slots the trait's owner has while the trait is active. For example, a *Wolf Form* trait sets the Body to *Wolf*, which has no hand slots.

- Select **Add Body**, then pick a Body in the menu. **None** leaves no slots at all.
- A world trait changes the player. An entity's own trait changes that entity.
- Items in a slot the new Body lacks come off and stay in the inventory. Where a slot holds fewer items, the item equipped last comes off first.
- The game log shows the change, such as *Body: Wolf. Unequipped Iron Helm*.

When two active traits set a Body, the one switched on last wins. When it switches off, the one before it takes over. With none left, the Body goes back to the one the owner started with.

## Sliders
<!-- keywords: elf ears, ear shape, trait changes avatar, set slider, lock slider, race look, head features trait -->

**Sliders** set the [Avatar's](Avatars#in-the-game) sliders while the trait is active. For example, an *Elf* trait sets Ear Shape to 1, and a *Human* trait sets it to 0.

- On the **Appearance** tab, pick sliders in the **Sliders** list. It has two groups for each model: **Body Sliders** and **Head Features**. On an entity's own trait, the list holds the sliders of its 3D model and of the Avatar it shows on this device. For **User's Default**, that is your Default Avatar. On a world trait, the list holds the Avatar of each persona the player can pick, once each. A world that allows one persona lists one Avatar. A library persona or **None** uses your **Custom Persona**'s Avatar. **Starts On** does not narrow the list. With no Avatar and no 3D model, the **Appearance** tab asks you to pick one.
- A slider you bound that the list no longer holds stays on the trait, and you can remove it.
- Each picked slider gets a row with a **Set To** number, 1 by default. Any number works, even one past what Customization allows.
- The slider takes the **Set To** value in place of the player's own setting. A stat bound to that slider still adds its change on top.
- When the trait switches off, the player's own setting comes back.
- A world trait changes the player's Avatar. An entity's own trait changes that entity's model.
- A row shows **Not on this model** when none of the models the trait plays on has that slider.

When two active traits set the same slider, the one switched on last wins. A row says **Also set by** and names the other traits. Traits in a group where only one can be picked never show it.

## Colors
<!-- keywords: skin color trait, drow skin, eye color, hair color, trait changes color, recolor avatar -->

**Colors** set the [Avatar's](Avatars#in-the-game) skin, eye or hair color while the trait is active. For example, a *Drow* trait sets the skin to gray.

- Pick **Skin**, **Eye** or **Hair** in the **Colors** list. Each gets a row with a **Set To** color, which starts at the Avatar's own color, or white when the trait has no Avatar.
- The color replaces the player's own pick. A stat bound to that color still shifts it on from there.
- When the trait switches off, the player's own color comes back.
- Colors work on Avatars only. An entity's 3D model keeps its colors.
- A row shows **Not on this model** when the model lacks that color.

When two active traits set the same color, the one switched on last wins. The row says **Also set by**, as for [Sliders](#sliders).

## Preview
<!-- keywords: preview trait look, see trait on avatar, set ears by eye, try trait sliders, avatar preview -->
<!-- route: appearancePreview -->

**Preview** shows the trait's look on its Avatar, so you can set sliders and colors by eye.

- On the **Appearance** tab, select **Preview** at the bottom left of the panel. The dialog opens the Avatar the trait plays on. With several, it opens the first and offers an **Avatar** menu to switch. Your changes stay when you switch. A control the other Avatar lacks is hidden there, and Save still writes its change.
- Each slider shows its **Set To** value, or the Avatar's own value where the trait has no row. Colors work the same way. Only this trait's rows apply.
- The dialog has the Avatar's **Head Features**, **Body Sliders**, and its hair, eye and skin colors.
- Each control's **Undo** button returns it to the value it had when the dialog opened.
- **Save** writes your changes to the trait. A changed row keeps its place. A slider or color you changed that has no row gets a new one. Save never removes a row. One **Undo** in the editor takes the whole change back.
- Closing with unsaved changes asks before it discards them.
- With no Avatar, **Preview** is disabled. An entity's 3D model has no Preview, so set an Avatar on its **Profile** tab first.

## Placeholder Pins
<!-- keywords: appearance from choice, force a word, lock random text, returns when off, type custom text, hair by perk -->
<!-- route: worldEditorTrait.pins -->

**Advanced mode only.** A pin keeps a [placeholder](World-Editor-Placeholders#pins) at one value while the trait is active. For example, a *Redhead* trait pins Hair Color to *copper*. The playthrough keeps its own roll, and the roll comes back when the trait is switched off.

You can type a value that isn't in the placeholder's list. The game uses it as written.

A value that is one chip pins the part that chip holds. Pin a Wildcard to the value that holds *isAsian*, and every chip of that Wildcard reads that variant.

[Pin a blueprint](World-Editor-Blueprints#pins-by-blueprint) to pin each owner's own copy of it. A link can replace this list for one owner.

An entity's trait pins every text, whoever the player plays.

A stat descriptor's pin outranks a location's, and a location's outranks a trait's. See [Pins](World-Editor-Placeholders#pins) for the full order.

## Scripts
<!-- keywords: trait script, script only while active, rule that follows a trait, switch script, add script, when a trait switches -->
<!-- route: worldEditorTrait.scripts -->

**Advanced mode only.** The **Scripts** tab holds the trait's own scripts. Select **Add Script**, pick a timing in the **Timing** menu, and write JavaScript in the box.

- A trait's script runs only while the trait is active. A stat with **Enabled** cleared pauses its scripts the same way.
- In the script, `self` is the trait, read-only.
- A trait's own **When a Trait Switches** script also runs when the trait switches off.
- On a trait that an entity owns or links, the script runs once for each entity that holds the trait. `owner` is that entity.

> 📘 Full reference: [Scripts Reference](Scripts-Reference).

## When two traits conflict
<!-- keywords: clash, priority, which wins, overlap, contradiction, order matters, tie -->

Two active traits can change the availability of the same stat, or pin the same placeholder. The trait lower in the trait list then wins. The row tells you when this applies, and it links to the other trait.

For a pin on traits of different owners, a world trait wins, then the played persona's, then the entity lower in the entity list.

[Body](#body) rows, [Sliders](#sliders) and [Colors](#colors) work differently: the trait switched on last wins.

## Groups
<!-- keywords: category, start button disabled, choose more message, cant begin game, none of these, swap mid game, over the limit, folders -->

Groups organize the list. A trait group also has text of its own:

| Field | What it does |
|---|---|
| **Group Name** | The heading on the trait selection screen |
| **Player-Facing Description** | Text the player reads under the heading |
| **AI-Facing Description** | A header the AI reads above the group's active traits, such as *"Origin: where this life began"*. A group with no active traits is skipped. |
| **Show Heading to AI** | Sends the group's name and description to the AI. Clear it to group traits only for yourself: the AI then reads the group's traits as if they had no group, and a group inside it moves up one level. |

### Pick Count

**Pick Count** sets how many traits the player must and can pick from the group.

| Preset | Picks |
|---|---|
| **Any** | No minimum, no maximum |
| **Exactly One** | One pick, no more and no less. A class or a species. |
| **Up to One** | Zero or one pick |
| **Custom** | You set **At Least** and **At Most**. Leave **At Most** empty for no limit. |

Only traits placed directly in the group count. A subgroup sets its own count. An **Automatic** trait counts toward its group's minimum and maximum.

A group with a maximum of one shows radio buttons:

- In **Up to One**, pick another trait, and the first one clears.
- Select the picked trait to clear it. "None of these" is always possible.
- During the game, a trait the player can toggle works the same way. Turn one on, and the others in its group turn off.
- An **Automatic** sibling can't clear, so the switch is refused.

On the setup screen:

- A group that's short of its minimum says how many more picks it needs, such as *Choose 2 more traits*.
- **Start Game** stays disabled until every group meets its minimum. When the persona you play has an Avatar, the button reads **Continue to Avatar**. **Quick Start** never blocks, and it leaves the gap in place.
- At a maximum above one, the unchecked rows disable. Uncheck one to pick another.

During the game:

- The game refuses a switch-off that drops a group below its minimum.
- A trait that leaves because its requirements stop holding can drop a group below its minimum. The game doesn't ask for a replacement. The trait returns when its requirements hold again.
- An **Automatic** trait whose requirements start to hold joins its group even when the group is full. The group runs over its maximum until the player drops a pick.
- **Exactly** N with N above one can't change during the game. To allow swaps, set a range with **Custom**.

> 💡 **Give an Exactly One group a default.** Set **Starts** to **On** for one trait, so a new game starts with a valid answer. With two defaults in an **Up to One** group, the first in the list wins.

## Requirements
<!-- keywords: rows, and, or another way, not, exclude, cant have both, only when not, condition, who must have it, either or, any of, depends on player class, npc needs player choice, owner check, relationship perk -->

**Requires** on the **Availability** tab makes a trait available only when its requirements hold. A trait with no requirements is always available. The requirements are rows of conditions.

### Rows

A **row** is one way to open the trait. It holds when every condition in it holds, so a row means **and**. The trait opens when any one row holds, so rows mean **or**.

- **Add Requirement** adds the first condition. It opens a search with these lists: **Traits**, **Any Trait in a Group**, **Stats** with a page for each owner, **Items**, **Time of Day** and **Playing As**. In a large world, the search opens on those lists with a count beside each. Select a list, then an owner, to see its targets. Type in the search to find a target in every list.
- **And** (in a row) adds another condition to that row.
- **Or Another Way** (below the rows) adds a new row.
- The **X** at the end of a row removes the whole row. Remove the last condition in a row, and the row goes too.

For example, two rows read *Knight and Heavy Build*, then *Mercenary*. The trait opens for a Knight with Heavy Build, and it opens for a Mercenary.

### Conditions

A **condition** checks one target. A target is one of these:

- A trait
- Any trait in a group
- A persona the player plays as
- A stat
- The [time of day](#time-conditions)

Select a condition to open its target. A [stat condition](#stat-conditions) or a time condition has nowhere to open, so it shows its controls instead.

Select **Require it to be off** on a condition's chip to make it **Not**. A Not condition shows a **NOT** mark and a dashed border, and it holds while its target is off. Select the button again to require the target instead.

| Not condition | Holds when |
|---|---|
| *not Paladin* | The owner doesn't have Paladin on |
| *not any Class* | No trait in the Class group is on |
| *not playing as Sir Aldric* | The player plays any other persona |
| *Ash: not Tamed* | Ash doesn't have Tamed on |

For example, one row reads *Knight and not Paladin*, and a second row reads *Mercenary*. The trait opens for a Knight who isn't a Paladin, and for a Mercenary.

A trait's own state never counts toward its own requirements. A condition whose target is gone never holds, so the trait stays locked. The chip reads red under its saved name.

> 💡 **Two traits can exclude each other.** Give each one a *not* condition for the other. The pick made first stays on, and the later trait turns off with a notice. It returns when the first pick goes.

> 💡 **Use Not on an Automatic trait to switch it off in some cases.** *Automatic unless Paladin* turns the trait on, and off again if the player takes Paladin.

### Stat conditions
<!-- keywords: stat threshold, needs a stat, rage at 80, health under, percent of max, raw or percent, greater than, less than, not equal, trait needs stat, turns off when stat drops, comes back when stat recovers -->
<!-- route: worldEditorTrait.availability -->

A **stat condition** compares an owner's stat to a number. *Berserk* requires *Rage >= 80*, so it opens at 80 Rage or more.

1. Open the trait's **Availability** tab.
2. Under **Requires**, select **Add Requirement**, then pick a stat from a **Stats** list.
3. Pick the **Operator**, type the **Value**, and pick **Raw** or **%**.

| Choice | What it does |
|---|---|
| **Operator** | One of `>`, `<`, `>=`, `<=`, `=` or `≠` |
| **Raw** | Compares the number in the stat's own units. *Gold > 100* |
| **%** | Compares the share of the stat's range, from its min to its max. *Health < 20%* keeps working when you change the max. |

- **Not** works like on any condition. *not Health = 0* is one chip.
- Add the same stat twice in one row for a range. *Rage >= 20* and *Rage < 80* are two conditions.
- To check another owner's stat, pick that owner, as with a trait. The list holds that owner's own stats.
- **=** and **≠** compare the number the stat bar shows, rounded. A bar that reads 20 matches *= 20*.
- A stat with the same min and max reads 0%, so a **%** condition on it is always 0%. Use **Raw** or widen the range.
- A stat that's switched off, or gone, never holds. The chip reads red under its saved name.

#### When the game checks

The game reads the stats once per turn, after the turn's stat changes have landed. A trait that requires a stat then follows it:

- The trait turns off when its condition stops holding. Its stat changes reverse, and the log says *Trait switched off: Berserk*.
- The trait returns when its condition holds again.
- A trait the player switched off by hand stays off, even when its condition holds.
- One turn settles once. A stat that moves up and down during the turn never flickers the trait.

A trait's own stat changes don't make the game check again in the same turn. A trait that raises the stat its own condition reads can flip its own gate on the next turn. The [Test Bench](#test-bench-checks) warns about this.

> 💡 **Gate on a different stat than the trait changes.** *Berserk* requires *Rage >= 80* and adds Strength. It's safe. If it also lowered Rage, it could turn itself off.

### Item conditions
<!-- keywords: item condition, needs an item, owns an item, wearing an item, equipped item, cursed ring, trait needs item, set bonus, item owner -->
<!-- route: worldEditorTrait.availability -->

An **item condition** holds while an owner has an item. It reads one of two states:

- **Owned** holds while the owner has a copy of the item, carried or equipped.
- **Equipped** holds while the owner has a copy in a slot. A copy that is only carried doesn't count.

*Cursed* is an Automatic trait that requires the *Cursed Ring*, owned. It turns on when the ring joins the inventory and off when the ring leaves.

1. Open the trait's **Availability** tab.
2. Under **Requires**, select **Add Requirement**, then pick **Items**.
3. Pick the item from **Owned** or **Equipped**, then pick the owner.

An item chip also has two optional checks. They narrow the condition to one copy that passes every check:

- **State** holds only for a copy with that State word, such as *lit*. Case and spaces at the ends don't matter. A blank State checks nothing.
- **Identity** holds only for an **Identified** or an **Unidentified** copy. **Any** checks nothing.

The chip reads the checks in parentheses: *owning Lantern (lit)*, or *equipping Ring (lit, unidentified)*. A lantern can grant *Darkvision* only while its State is *lit*.

The player reads an unidentified item's Unidentified Name in the lock line while the owner has no visible identified copy of it.

The owner is **Same Owner**, the **Persona**, or an entity. On a global trait, **Same Owner** reads the Persona. A hidden copy still counts. Use the swap button to require that the owner doesn't have the item.

In an item's image rule, a condition with no owner reads the owner of that copy. While the copy lies at a location, the condition doesn't hold, with or without Not.

### Time conditions
<!-- keywords: time of day, only at night, daytime, evening, dawn, dusk, day night cycle, nocturnal, night form, works at night, story clock, daypart -->
<!-- route: worldEditorTrait.availability -->

A **time condition** checks the story's time of day. *Night Hunter* requires *evening or night*, so it opens when the evening starts.

1. Open the trait's **Availability** tab.
2. Under **Requires**, select **Add Requirement**, then pick **Time of Day**.
3. Turn on each time of day that counts: **Night**, **Dawn**, **Morning**, **Midday**, **Afternoon** or **Evening**.

| Time of day | On a 24-hour day |
|---|---|
| 🌙 Night | 20:00 to 6:00 |
| 🌅 Dawn | 6:00 to 8:00 |
| ☀️ Morning | 8:00 to 11:00 |
| 🕛 Midday | 11:00 to 13:00 |
| 🌤️ Afternoon | 13:00 to 17:00 |
| 🌆 Evening | 17:00 to 20:00 |

- The narration's time of day uses the same split, so the condition matches what the story says.
- At least one time of day stays on. To exclude one, turn on the others. A time condition has no **Not**.
- A row holds one time condition. It never checks the day number or an hour.
- The game checks once per turn, after the turn's time passes, like a [stat condition](#when-the-game-checks). With the AI clock off, each turn is one hour.
- Outside play, the [Test Bench](#test-bench-checks) reads the time the story opens at, which is morning.

### What the player reads

A locked trait shows its requirements as one line: *Requires Knight and not Paladin, or Mercenary*.

- Conditions join with **and**, and rows join with **or**.
- Stat conditions read the same way: *Requires Rage >= 80*, with **%** after a percent.
- A trait that opens shows the rows that opened it, after *Unlocked by*.
- The line leaves out conditions on a [Hidden](#hidden-traits) trait, a hidden stat or a switched-off stat.
- A row with nothing left to show is dropped. A trait with no row left to show reads **Locked**.

### Whose trait counts

The entity that has a trait, as its own or through a link, is its *owner*. The entity the player plays is one owner, named **Persona**. Each entity in the cast is another.

A trait outside every entity, such as one the player picks at the start, is a *global trait*. A global trait has no owner. It never counts as the persona's trait, so no persona trait can use it as its same-owner target.

A condition checks the same owner by default. *Smite* requires *Paladin* means Paladin on the entity that has Smite. A global *Wizard* never unlocks Smite for another owner.

To check another owner, pick one after you pick the target. When only one owner can have the target, the search skips this step and adds the condition at once. For a global target, the search skips this step: the condition reads the global scope.

| Owner | The condition holds when |
|---|---|
| **Same Owner** | Whoever has the trait also has the target. This is the default. It never pairs a global trait with an entity's trait. |
| **Persona** | The entity the player plays has the target. With no entity played, it never holds. |
| An entity | That entity has the target. The list shows only entities that can have it. |

For example, *Squire* requires **Persona**: *Paladin*. A squire entity gets its Squire trait only when the player plays a Paladin.

> ⚠️ **A global trait can't use Same Owner with an entity's trait.** A global *Duelist* that requires an entity's *Paladin* from the same owner never opens. The [Test Bench](Test-Bench) warns about it. Pick **Persona** or the entity.

A condition that names an entity describes a relationship to another entity. When the player plays that entity, the relationship would point at the persona itself. The row with that condition can never hold, so the game drops it.

- *Squire to Albus* requires *Albus: Paladin*. It is offered to every player except Albus.
- A trait with a second row, such as *Paladin* on the same owner, stays and opens by that row.
- A trait with no row left is not offered.
- An entity's own traits keep every row. Albus can still gate its own trait on *Albus: Paladin*.

## Entity Traits
<!-- keywords: npc perks, npc abilities, give character a class, companion skills, name the owner, can npcs have stats, move to character -->
<!-- route: worldEditorEntity.traits -->

An entity can have traits of its own. Each entity with traits shows as a node in the **Traits** tab, below the global traits.

- **Add one from the Traits tab.** In Advanced mode, select the **Add to Traits** icon button (+), then **Add Trait to Entity**, and pick the entity. **Add Group to Entity** adds a group the same way.
- **Or add one in the entity's editor**, in its **Traits** tab, in Advanced mode. Type a name in the **Filter Traits** box. Select the **Add to** *entity name* icon button (+), then **Add Trait to** *entity name* or **Add Group to** *entity name*.

The entity's **Traits** tab is the **Traits** tab for that entity alone. It shows the entity's traits, groups and links in the same tree, with the same row buttons.

- Select a row to edit it in place. The **Traits** back row returns to the list.
- Drag rows, links included, to reorder and nest them inside the entity.
- A **Requires** chip opens its target when the entity holds it. A world trait or a persona reads as plain text there.
- To link a trait or move one to another entity, use the World Editor's **Traits** tab.

An entity's active traits describe it to the AI, the same way the player's do. When the player plays the entity as a [persona](Persona-Authoring), its traits are the persona's.

> 💡 **Type `{{char}}` in a trait's text to name its owner.** It shows as the **Entity Name** chip. On an entity, it reads as that entity's name. On the player's traits, it reads as the persona's name, or "the player" with no persona. One *Paladin* text then names each Paladin.

To give a global trait or group to one entity, drag it onto the entity's node. It moves to that entity. A [Blueprints](World-Editor-Blueprints#blueprints) item links instead, in Advanced mode.

> 🔗 To give one trait to several entities, write it once as a blueprint and link it to each one. See [World Editor: Blueprints](World-Editor-Blueprints).

### Entity Traits and Stats
<!-- keywords: monster trait raises city stat, trait changes global stat, unplayed entity changes a world stat, global row, rampage, stat row on npc trait, same id as global stat -->

An entity's traits change the entity's own stats: Min, Max, Starting Value, Regen and Stat Availability. Its links do the same. A *Hardy* trait on Bram raises Bram's Vigor.

A row can also name a global stat. The picker lists the entity's own stats first, then a **Global** group. Every entity gets that group, played or not. A row on a global stat changes it whoever you play. A *Rampage* trait on a monster can raise the city's Destruction.

> 💡 **Pick from the Global group when an entity's stat has the same id as a global stat.** A row with no pick from that group names the entity's own stat first.

> ⚠️ **A row that names a stat neither the entity nor the world has does nothing.** The **Issues** tab of the [Test Bench](Test-Bench) warns about it.

## Custom Persona
<!-- keywords: own character, self insert, blank slate hero, oc, no premade hero, library character perks, fourth choice, generic player -->

**Advanced mode only.** Custom Persona is a mark on one entity. The marked entity is a normal entity: it owns traits, links and [copies](World-Editor-Placeholders#copies). Its traits are the persona's traits when the player has no world persona: **None**, or a persona from their own library. Use it to give a race and a class to a player who brings their own persona.

Set the mark on the entity's **Profile** tab. **Custom Persona** is the fourth choice of the **Persona** control, beside **Cast**, **Playable** and **Persona-Only**. See [How to Make a Custom Persona](Persona-Authoring#how-to-make-a-custom-persona) for the steps and [Custom Persona](Persona-Authoring#custom-persona) for the full rules.

- **The Traits and Placeholders tabs always list it** as an owner, so you can drag to it and link to it while it is empty.
- **Drag a top-level trait onto it to make the trait the persona's.** The trait leaves the top level, so a player with a world persona no longer gets it.
- **Its traits can change stats.** They apply when the player has no world persona.
- **The picks carry over.** A player who switches between **None** and a library persona keeps their Custom Persona picks.
- **During the game, its traits have their own heading.** The setup screen and the in-game **Traits** tab show them under the entity's name, marked **You**. Under **None**, the heading takes the name the player entered.
- **It stays at the top level** of the **Traits** tab, in the order you set.

> 💡 With Advanced mode off, links, Blueprints and the Custom Persona entity still show when they hold something, and you can still edit them. Only making new ones needs Advanced mode.

## Test Bench Checks
<!-- keywords: validation, errors warnings, can never unlock, impossible setup, broken reference, problems found, redundant, unused, debug my perks -->

The **Test Bench** checks every owner as if the player picked it. That includes **Playable** and **Persona-Only** entities and the Custom Persona entity.

It shows an error when:

- A trait can never unlock for its owner. For example, Albus links *Smite*, but nothing on Albus gives *Paladin*.
- A condition names a trait or group the world no longer has. The check reports each condition.
- A [Visibility rule](World-Editor-Entities#visibility-rules) on an image names a trait or group the world no longer has, or a stat its owner doesn't have.
- Requirements loop through a **Not** and can never settle. For example, *A* requires *B*, and *B* requires *not A*. Two traits that exclude each other, such as *A: not B* and *B: not A*, are fine.
- A trait's **Stat Availability** names a stat that doesn't exist.
- A group's **At Least** is above its **At Most**.
- A group needs more picks than its traits can ever unlock.
- A new game starts a group with fewer picks than its minimum. The defaults and active **Automatic** traits don't meet it.

It shows a warning when:

- More **Automatic** traits can be active together than a group's maximum allows. The check can report a group that never fills, because it ignores the maximums of other groups.
- A group marks more traits as default than its maximum allows. Some defaults won't apply.
- A row can never hold, such as *Paladin and not Paladin*. Remove the row or change a condition.
- A global trait requires an entity's trait, group or stat from the same owner. Only entities have the target, so the row never holds. Pick **Persona** or the entity.
- A trait requires a stat that the trait changes itself, including the stat's min, max or on/off state. Its own effect can flip the requirement.
- A **%** condition, in a trait's rule or an image's Visibility rule, reads a stat whose min and max are equal. It always reads 0%.
- Every image of an entity has a Visibility rule, and the rules don't cover every case. The entity can end up with no image. Two images with opposite conditions cover every case. So do images that name every pick of required groups, where each group has a minimum and a maximum of one pick.
- A trait has **Starts** set to **On**, but no starting choice meets its requirements, so it starts unselected. Two defaults that exclude each other count: the later one starts unselected.
- An owner needs a copy of a blueprint and has none. The warning names the owner and the trait or chip that needs it.
- A copy removed the value that a pin names. The pin pins nothing.
- A blueprint chip or a pin by blueprint sits where it is refused, such as in a location or a world placeholder.
- A link is redundant, because another link on the same owner already brings its original.
- An entity's trait or link changes a stat that the entity doesn't own. The row does nothing.
- A stat starts disabled, and no trait ever enables it.
- In Advanced mode: a trait lowers a stat that already starts at its floor, so the change does nothing.
- In Advanced mode: a trait changes a stat whose script recomputes the value, so the script erases the change.

It shows a note when:

- An edited copy has no trait or chip that uses it. Keep the copy or delete it.
- A group with a maximum of one has one trait or none, so it offers no real choice.
