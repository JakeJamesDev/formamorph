# 🧮 Scripts Guide
<!-- keywords: scripts, stat code, stat script, trait script, world script, scripting, automation, custom logic, game mechanics, coding, rules engine, javascript, dynamic value calculation -->

A **script** is one box of JavaScript with a timing. A script belongs to a stat, a trait, an item or the world.

A script can:

- Set a stat's value from other stats, or set its own bounds
- Write another stat
- Pin a placeholder or switch a trait
- Rewrite a narration sentence
- Ask the player a question

This guide covers how to add a script, pick its timing and test it. The [Scripts Reference](Scripts-Reference) lists every object a script reads and writes. In a world file, a script is one entry in a `scripts` list ([Scripts](WorldFormat#scripts)). The [World Format](WorldFormat#stats) page describes the rest of a stat.

## How to Add a Script
<!-- keywords: add stat code, stat code, script, javascript, js, formula, calculate, dynamic, programming, tab, computed value, derived, equation, math, tab is missing, where to write it, depends on another stat, auto update each turn, timing, add script button, name a script -->
<!-- route: worldEditorStat.code -->

1. In the World Editor, select **Advanced** in the mode switch. The **Scripts** tab shows in Advanced mode only.
2. Open the **Stats** tab and select the stat. Open its **Scripts** tab. Only a number or percentage stat has it.
3. Select **Add Script**. Pick a timing in the **Timing** menu:
   - For a value the AI reads this turn, pick **Before the AI**.
   - For a reaction to the AI's change, pick **After the AI**.
   - See [The Five Timings](#the-five-timings) for the others.
4. Type your JavaScript in the box. The **Name** field is optional. A blank name reads as the owner and the timing, such as "Health · After the AI".
5. Select **Test Code** under the box. Read the result, any error and every write the run made.

Other homes for a script:

- **A trait** has its own **Scripts** tab. Its scripts run only while the trait is active.
- **An item** has its own **Scripts** tab, with the item timings. See [Item Timings](#item-timings).
- **The world** has a **Scripts** tab in the **Logic** group. It lists every script by timing, in run order. See [How to Review Every Script in One Place](#how-to-review-every-script-in-one-place).

## How to Insert a Template
<!-- keywords: example, snippet, preset code, starter, sample, script, ready made, boilerplate, prebuilt, no coding skills, recipe, wizard, fill in the blanks -->
<!-- route: worldEditorStat.code -->

1. Open the stat's **Scripts** tab.
2. Select **Templates** beside the box's **Test Code** button.
3. Pick a template. Each box lists the templates that work at its timing. The detail under a template's name lists every timing it runs in.
4. Fill in the inputs the template asks for.
5. Edit the inserted code as you like.

| Timing | Built-in templates in its menu |
|---|---|
| ⏮️ **Before the AI** | The formulas, **Timer**, **Random Per-Turn Roll**, **Placeholder by Range**, **Trait by Threshold**, **Opening Turn Value** |
| ⏭️ **After the AI** | The formulas, **Timer**, **Random Per-Turn Roll**, **Hourly Change**, **Regen Toward Target**, **Dice Roll With Consequences**, **Placeholder by Range**, **Trait by Threshold** |
| 🎬 **At Game Start** | The formulas, **Placeholder by Range**, **Trait by Threshold**, **Random Starting Value**, **Start From Persona Trait** |
| 🔀 **When a Trait Switches** | The formulas, **Change When a Trait Switches**, **Mirror a Trait** |
| 💬 **During AI Output** | **Replace a Word**, **Count a Word**, **Bold a Word Past a Threshold** |

The formulas are seven templates:

- **Weighted Blend**
- **Inverse of Another Stat**
- **Threshold Flag**
- **Daypart Modifier**
- **Bound From Another Stat**
- **Bonus From Persona Trait**
- **Penalty From Entity Trait**

**Hourly Change** and **Regen Toward Target** read `clock.deltaHours`. It is `0` in every timing except **After the AI**.

In an entity's stat, a stat input or a trait input lists the entity's own names first, under **Owner**. The global names follow. An **Owner** pick inserts `owner.stats` or `owner.traits`. In a Blueprint stat, a trait input lists the global traits only.

To save your own template, select **New Template** or **Duplicate**. Under **Runs**, pick each timing the template works in. The template shows in the menu of each of those timings.

In your own template, a stat input or a trait input can list the names of one entity. Put the name of the entity input in brackets after the type:

| Slot | What the input lists |
|---|---|
| `{{who:entity}}` | The world's entities |
| `{{s:stat(who)}}` | The stats of the entity picked in `who`. Write it as `entities[{{who:entity}}].stats[{{s:stat(who)}}]` |
| `{{t:trait(who)}}` | The traits of the entity picked in `who` |
| `{{s:stat(persona)}}` | The stats of each persona entity. Write it as `persona.stats[{{s:stat(persona)}}]` |
| `{{t:trait(persona)}}` | The traits of each persona entity |
| `{{place:location}}` | The world's locations. Write it as `location.move({{place:location}})` |

When you pick another entity, each stat input and trait input that lists its names clears.

## How to Insert a Name from Your World
<!-- keywords: reference an entity's trait, trait of an entity, find a name, pick a name, insert a path, menu, variable button, variable menu, what the variable menu holds, drill down, dictionary placeholder, persona trait, stat value, don't type names, copy the right spelling -->
<!-- route: worldEditorStat.code -->

The **Variable** menu inserts a full path at the caret, so you never type a name.

1. On a stat's **Scripts** tab, select the **Variable** button in the toolbar of a code box.
2. Open a group. Each group opens one level at a time: your world's names, then a name's fields. An entity also opens to its **Traits** and **Placeholders**.
3. Select a field. The menu inserts its whole path at the caret.

For example, to insert `entities.Mira.traits.Wounded.enabled`, open **Entities**, **Mira**, **Traits** and **Wounded**, then select **enabled**.

The menu lists these groups, in order:

- **This Stat**, then **Owner** in the box of an entity's stat or a Blueprint stat
- **Stats**, which always lists the global stats
- **Traits**, **Entities**, **Persona**, **Placeholders**, **Dictionaries**, **Items**, **Clock**, **Turn**, **Locations**, **Location** and **Memories**
- Fields such as `notes`, then verbs such as `discover`

## How to Limit the AI's Change to a Stat
<!-- keywords: clamp, cap, max, restrict, prevent, too fast, delta, script, throttle, big swings, jumps too much, slow down gains, never go up, dampen, narrator overreacts, at most per turn -->
<!-- route: worldEditorStat.code -->

1. Open the stat's **Scripts** tab.
2. Add a script with the **After the AI** timing. Read the AI's ask from `self.delta.ai.value`.
3. Clamp the ask.
4. Set `self.value` from `self.previous.value`, the clamped ask and `self.delta.regen.value`. [Reading This Turn](Scripts-Reference#reading-this-turn) has an example.
5. Select **Test Code**.

## How to Change Another Stat from Code
<!-- keywords: move two stats at once, one event changes several stats, one script hurts health and raises luck, dice roll with a penalty, halve health on a bad roll, bonus on a good roll, hub stat, one box for many stats, write to another stat, change a different stat, cap another stat, raise another stat's max, speed up another stat's regen, my script changes the wrong stat, two scripts fight over one stat, split logic across stats, reaction in each stat's box, world script writes stats -->
<!-- route: worldEditorStat.code -->

1. Open the **Scripts** tab of the stat that decides the change. This stat is the hub. For a rule that belongs to no stat, add the script to the world's **Scripts** tab.
2. In the code box, set the field of the target stat: `stats.Health.value = stats.Health.value / 2`. For an entity's stat, name the entity: `entities.Mira.stats.Trust.value -= 5`. To react to this turn's roll or ask, use the **After the AI** timing.
3. Select **Test Code**. It lists every write to another stat, such as `stats.Health.value = 30`, with the owner of each target stat.
4. In **Advanced** mode, open the [Test Bench](Test-Bench#issues) and read **Issues**. It warns when two scripts of one timing write one field.

[Writing to Other Stats](Scripts-Reference#writing-to-other-stats) lists the fields a script can write and the rules.

## How to Pin a Placeholder from Code
<!-- keywords: script, javascript, set value, force, wildcard, variable, wording follows a stat, conditional text, override the roll, swap wording by value, lock in, mood changes with number, programmatically -->
<!-- route: worldEditorStat.code -->

1. Open the stat's **Scripts** tab.
2. Add a script with the **Before the AI** timing. Call `pin` on the placeholder, such as `placeholders.Mood.pin('calm')`. A pin from this script is in this turn's prompt.
3. Select **Test Code**. It lists each placeholder the run pinned.

## How to Rewrite a Narration Sentence
<!-- keywords: filter words, censor, replace a word, swap a word, turn a name into a link, add a link, add an image, markdown link, clean up narration, fix wording, during ai output, narration script, rewrite the story as it streams, remove a phrase, change what the narrator says -->
<!-- route: worldEditorStat.code -->

1. Open a **Scripts** tab and select **Add Script**. A world script suits a rule for the whole story.
2. In the **Timing** menu, pick **During AI Output**.
3. Assign the new sentence to `narration.sentence`, or return a string: `narration.sentence = narration.sentence.replace('door', '[door](https://example.com)');`
4. Type a sentence in **Sample Sentence** and select **Test Code**. The report starts with the rewritten sentence.

[During AI Output](#during-ai-output) lists what the rewrite changes.

## How to Ask the Player a Question
<!-- keywords: prompt the player, ask the player, yes or no, confirm, choose an option, pick from a list, type an answer, show a message, toast, tell the player, dialog, player input, interactive script, question from a script -->
<!-- route: worldEditorStat.code -->

1. Open a **Scripts** tab and select **Add Script**. Pick any timing except **During AI Output**.
2. Call a `player` function:
   - `player.confirm("Open the door?")` returns `true` or `false`.
   - `player.ask("Which path?", ["Left", "Right"])` returns the pick.
   - `player.input("Name the dog")` returns the typed text.
3. Use the answer on the next line. The call needs no `await`.
4. Select **Test Code**. The question shows under the box, as it does in play.

[Player](Scripts-Reference#player) lists every call and what closing a prompt does.

## How to Let the AI Run a Script
<!-- keywords: world tool, tool script, ai decides, ai calls my code, trigger, arm a script, on demand, filter on request, narration filter tool, reply, stack calls, timing, function calling script -->
<!-- route: worldEditor.tools -->

1. In the World Editor, select **Advanced** in the mode switch. Open the **Tools** tab in the **Logic** group.
2. Select **Add Tool**. Write a **Description** that names the scene that calls for the Tool.
3. On the **Handler** tab, pick **Script**. Then pick a **Timing**: **On Call**, **During AI Output** or **After the AI**.
4. Write the script. It reads the AI's values from `args`.
5. Open **Try It** to run the Tool on sample values.
6. Select **Save Tool**.

[World Tools](#world-tools) lists what each timing does.

## How to Insert a World Tool Template
<!-- keywords: world tool template, tool script example, starter tool code, args template, parameter slot, report a stat, roll dice, pass time, pin a memory, highlight a name -->
<!-- route: worldEditor.tools -->

1. On the **Handler** tab, pick **Script** and a **Timing**.
2. Select **Templates** under the **Script** box. The menu lists the World Tool templates for that timing. A change of timing changes the menu.
3. Fill in the inputs. A parameter input lists the Tool's Parameters of the type the template needs. The code reads the one you pick from `args`.
4. To add a Parameter, pick the **New** row in a parameter input. **Insert Code** then adds that Parameter to the Tool, so a Tool with no Parameters works too.
5. Select **Insert Code**. Then edit the code as you like.

| Timing | Built-in templates in its menu |
|---|---|
| **On Call** | **Report a Stat**, **Roll Dice**, **Change a Stat**, **Move to Location**, **Pass Time**, **Discover an Entity**, **Pin a Memory** |
| **During AI Output** | **Highlight a Name**, **Replace a Word** |
| **After the AI** | **Change a Stat**, **Move to Location**, **Pass Time**, **Discover an Entity**, **Pin a Memory**, **Add a Diary Line** |

At **On Call**, the template's return value is the reply the AI gets. At the other timings, the AI gets the Tool's **Reply**, and the return value is ignored.

World Tool templates share the library and the pack file with stat templates. Each menu lists only its own kind, so a stat's **Templates** menu never lists a World Tool template. To save your own, select **New Template** or **Duplicate** in a World Tool's menu.

In your own template, `{{name:param(number)=amount}}` is a parameter input:

- The type is `string`, `number` or `boolean`.
- The input lists the Tool's Parameters of that type, plus a **New** row named `amount`.
- A slot with no type adds a text Parameter.
- A slot with no `=amount` part names the new Parameter after the slot.

## How to Insert a World Script Template
<!-- keywords: world script template, world script example, starter world script code, opening location, advance time while a trait is on, leave when a stat runs out, placeholder by daypart, memory when a trait turns on, diary line when a trait turns on, entity stat follows a global stat, location input -->
<!-- route: worldEditor.scripts -->

1. Open the world's **Scripts** tab. Add a world script, or open one.
2. Select **Templates** beside the box's **Test Code** button. The menu lists the world script templates for the box's timing.
3. Fill in the inputs. A location input lists the world's locations. It inserts the one you pick as a quoted name.
4. Select **Insert Code**. Then edit the code as you like.

A world script has no stat or trait of its own. Its templates never read `self` and never return a value.

| Timing | Built-in templates in its menu |
|---|---|
| ⏮️ **Before the AI** | **Advance Time While a Trait Is On**, **Placeholder by Daypart**, **Entity Stat Follows a Global Stat** |
| ⏭️ **After the AI** | **Advance Time While a Trait Is On**, **Leave When a Stat Runs Out**, **Entity Stat Follows a Global Stat** |
| 🎬 **At Game Start** | **Opening Location**, **Placeholder by Daypart** |
| 🔀 **When a Trait Switches** | **Memory When a Trait Turns On**, **Diary Line When a Trait Turns On** |
| 💬 **During AI Output** | **Replace a Word** |

World script templates share the library and the pack file with the other templates. Each menu lists only its own kind:

- A stat's or a World Tool's **Templates** menu never lists a world script template.
- A trait's or an item's **Scripts** tab has no **Templates** button.

To save your own, select **New Template** or **Duplicate** in a world script's menu.

## How to Review Every Script in One Place
<!-- keywords: scripts tab, all scripts, list of scripts, run order, order of scripts, drag script, reorder scripts, which script runs first, world script, add a world script, find a script, scripts by timing -->
<!-- route: worldEditor.scripts -->

1. In the World Editor, select **Advanced** in the mode switch. Open the **Scripts** tab in the **Logic** group.
2. Read the tree. It has one group for each timing, in the order a turn reaches them: At Game Start, Before the AI, During AI Output, After the AI, When a Trait Switches. Each script is a row. A row's place is where it runs. A Blueprint script is one row that runs for each owner that uses it.
3. Select a row to edit its script, in the same box its owner shows. **Open** followed by the owner's name opens the owner's **Scripts** tab. A world script has no owner to open.
4. To change when a script runs in its timing, drag its row. A drop sets the **order** of the scripts in that timing. The tree refuses a drag to another timing. To change a script's timing, use its **Timing** menu.
5. To add a world script, select **Add Script** and pick a timing. The script belongs to the world and goes to the bottom of its timing. The text in the search box becomes its name.

## How to Debug Scripts
<!-- keywords: error, console, log, fix, broken, not working, test, script, print values, devtools, f12, trace, inspect, wrong number, canceled prompt -->
<!-- route: worldEditorStat.code -->

1. Select **Test Code** to see the error and every write.
2. Add `console.log()` lines.
3. Open your browser's developer console. Each line shows there.
4. In the World Editor's **[Test Bench](Test-Bench#issues)**, read the **Issues** list. It reports:
   - Unknown stat names
   - A Before the AI script that reads `delta`
   - Two scripts of one timing that write one stat field

   Each finding names the script by its name, or by its owner and timing.

## Overview

A script runs in a sandbox at its own point in the turn (see [The Five Timings](#the-five-timings)). A script can:

- **Calculate a value** from other stats, such as carrying capacity from Strength
- **Combine stats**, such as Defense from Armor plus Agility
- **React to thresholds**, such as a speed penalty when Health is below 30%
- **Follow time**: how long a turn took, or the time of day (see [The Story Clock](Scripts-Reference#the-story-clock))
- **Set its own Min, Max, Regen or Hidden** (see [Writing to `self`](Scripts-Reference#writing-to-self))
- **Write another stat**, global or owned by any entity, so one event sets several stats (see [Writing to Other Stats](Scripts-Reference#writing-to-other-stats))
- **Shape what the AI asked for** before it applies (see [Reading This Turn](Scripts-Reference#reading-this-turn))
- **Pin a placeholder** to any text (see [Placeholders](Scripts-Reference#placeholders))
- **Switch a trait** on or off (see [Traits](Scripts-Reference#traits))
- **Read or switch an entity's traits**, and read its placeholders (see [Persona](Scripts-Reference#persona) and [Entities](Scripts-Reference#entities))
- **Find the entity that owns the stat** with `owner` (see [Owner](Scripts-Reference#owner))
- **Read a dictionary's placeholders and entries** (see [Dictionaries](Scripts-Reference#dictionaries))
- **Read the locations**, and the entities at each (see [Location](Scripts-Reference#location))
- **Move the turn or an entity** to a location (see [Location](Scripts-Reference#location) and [Moving Entities](Scripts-Reference#moving-entities))
- **Read and change items**: give an Item Copy, move it, equip it or use it (see [Items](Scripts-Reference#items))
- **Pass time** (see [Passing Time](Scripts-Reference#passing-time))
- **Change the choices** after the AI (see [Change the choices](Scripts-Reference#change-the-choices))
- **Read the memories**, pin or forget one, and add a line (see [Memory](Scripts-Reference#memory))
- **Read the player's notes** (see [Notes](Scripts-Reference#notes))
- **Add a line to an entity's diary** (see [Diary](Scripts-Reference#diary))
- **Rewrite a narration sentence** when it completes (see [Narration](Scripts-Reference#narration))
- **Tell or ask the player** (see [Player](Scripts-Reference#player))
- **React when a trait switches** (see [Trait](Scripts-Reference#trait))
- **Run when the AI decides**, from a World Tool (see [World Tools](#world-tools))

## How It Works
<!-- keywords: which box to use, lifecycle, sequence of steps, pre and post, how often it executes, hooks, script crashes, reads zero early, older single box worlds, where scripts live, home of a script, stat script, trait script, world script -->

1. A script is one box of JavaScript with a timing. A stat, a trait, an item or the world holds any number of them.
2. At its timing, each script runs in a sandbox.
3. A script reads every stat, the story clock, the world's placeholders and traits, and the entities, locations, dictionaries, items, memories and notes in the game.
4. `return <number>` sets the stat's value, clamped to its range.
5. Writes apply after the run. These include writes to `self`, `stats`, `owner`, `placeholders`, `traits`, `persona`, `entities`, `location`, `memories`, `dictionaries` and `turn.choices`. Calls such as `clock.advance()`, `discover()` and the item verbs apply after the run too.
6. A script that throws or times out changes nothing.

### The Home of a Script

A script's home sets two things: what `self` is, and when the script runs.

| Home | `self` | Runs |
| --- | --- | --- |
| A stat | The stat | Always. A stat that is off pauses its scripts: authored off, or switched off by a trait |
| A trait | The trait's own entry. It is read-only, and a return value is ignored | While the trait is active. A global trait runs once, with `owner` empty. An entity's trait runs once for each entity that holds it, with that entity as `owner` |
| The world | An empty object. A return value and a write to `self` are ignored | Always |
| An item | The item's entry in `items`, plus `event`. It is read-only, and a return value is ignored | On the events of its Item Copies only. `owner` is the entity that owns the Item Copy. It is empty while the Item Copy lies at a location |

A Blueprint stat's script runs once for each owner, in every timing.

### The Five Timings

A turn runs scripts at five points:

| Timing | When it runs | Writes apply | Names it adds |
| --- | --- | --- | --- |
| **Before the AI** | At the start of a turn, before the prompt is built | In that turn's prompt | `player` |
| **After the AI** | After the AI's changes and Regen apply | When the turn ends | `player` |
| **During AI Output** | Once for each narration sentence, when it completes | The sentence, then the stats with the After the AI scripts | `narration` |
| **At Game Start** | Once, on the opening turn of a new game, before the Before the AI scripts | In the opening prompt | `player` |
| **When a Trait Switches** | Each time a trait turns on or off during a game | At once | `player` and `trait` |

A timing adds names to the ones every script reads. The editor's **Variable** menu lists them in one group near the top: **Narration**, **Player** and **Switched Trait**. The group comes after **This Stat** (or **This Trait**) and **Owner**. In a trait's script, **This Trait** replaces **This Stat**. A world script has neither.

| Step | What happens |
| --- | --- |
| 1 | **At Game Start** runs, on the opening turn of a new game only |
| 2 | **Before the AI** runs, on the state the turn started in |
| 3 | The prompt is built and the AI answers. **During AI Output** runs on each sentence as the narration streams |
| 4 | The AI's stat changes apply |
| 5 | Regen applies |
| 6 | **After the AI** runs |
| 7 | **When a Trait Switches** runs right after any step above that switches a trait. After a script's switch, it runs before the next script |

**Before the AI** runs before the prompt is built. The prompt for that turn holds each value it sets, each placeholder it pins and each trait it switches. A value it sets shows on the bar while the AI writes.

**After the AI** is the timing of a stat's code in a world file with a single code box per stat. It reads the AI's change, this turn's regen, and the values the Before the AI scripts set.

> ⚠️ **A Before the AI script has no turn behind it yet.**
> - `previous` reads as the stat when the timing began.
> - `delta.ai`, `delta.regen` and `delta.total` read zeros. `delta.actual` holds what earlier scripts wrote.
> - The clock reads turn start, so `clock.deltaHours` is `0`.
>
> Code that scales the AI's change belongs in an After the AI script. At Game Start and During AI Output read the same turn start.

**Bounds persist across timings.** A `self.max` that a Before the AI script sets persists through an After the AI script that never writes it. An emptied script leaves the bounds as they are.

#### During AI Output

The script runs once for each narration sentence, when the sentence completes. It never runs for each token. It reads `narration` (see [Narration](Scripts-Reference#narration)). It rewrites the sentence when it assigns `narration.sentence` or returns a string.

- **The rewrite is the one copy.** The screen, the save, read-aloud and the AI's recap of the story all use it.
- **A rewrite is one sentence**, whatever it holds. The reveal and read-aloud release it as one unit.
- **Scripts on one sentence run in sequence.** Each reads the sentence as the script before it left it, in run order.
- **A script that throws or times out passes its sentence unchanged.** The error goes to the log, and the [Test Bench](Test-Bench#issues) reports it.
- **Other writes apply once, with the After the AI scripts.** This covers stat, placeholder and trait writes from every sentence. Sentence N+1 reads the stats as sentences 0 to N left them.
- **A turn that you stop but keep applies none of these writes.** The kept text shows the rewritten sentences.
- **The reveal shows only complete sentences** while the world has one of these scripts.
- **`player` is unknown.** A call to it fails the script, and the sentence passes unchanged.

#### At Game Start

The script runs once for each new game, after setup and before the AI call of the opening turn. A loaded save never runs it.

- It runs before the Before the AI scripts, on the current state. Its writes shape the opening prompt.
- A regenerate of a new game's opening restores the state from before the start scripts. Then they run again.
- A regenerate of a loaded save's opening skips the start scripts.
- Starting traits and starting items are in place when it runs, and their effects apply. They run no **When a Trait Switches** script and no item timing. Code that reacts to how a game starts belongs here.

#### When a Trait Switches

The script runs once for each trait that turns on or off during a game, whatever switched it. These sources switch a trait:

- The player's checkbox
- A script
- A group that switches its other traits off
- A requirement that stops holding
- A persona change

Setup picks and a loaded save skip these scripts. So does a trait that switches and switches back inside one script, or across one reply in During AI Output.

- A script in this timing reads `trait`: the trait that switched, with `enabled` set to its new state (see [Trait](Scripts-Reference#trait)).
- A trait's own script also has `self`. It runs on its own switch-off too. That is the one time a trait's script runs while the trait is off.
- Several switches from one action run one at a time, the switch-offs first. Each run reads the state the run before it left.
- A switch that a script makes runs its own scripts, to a depth of 8. Past that depth, the switch applies, no script runs, and the browser console warns.

#### Item Timings

An item's scripts use five timings of their own. Each one runs once for each event of one of the item's Item Copies. The cause of the event does not matter: the Inventory pass, the **Inventory** panel or a script.

| Timing | When it runs |
| --- | --- |
| **When Gained** | An owner or a location gains an Item Copy. A pickup, a gift and a drop each count |
| **When Lost** | An owner or a location loses an Item Copy. A drop is When Lost for the owner, then When Gained at the location |
| **When Equipped** | An Item Copy is equipped. To equip one from a stack runs it once |
| **When Unequipped** | An Item Copy is unequipped: by hand, by a full slot, or by a requirement that stops holding |
| **When Used** | An Item Copy is used. The last use runs this timing only, not When Lost. A **Becomes** result runs its own When Gained |

- `self.event` holds `timing`, `quantity` (the number the event moved) and `copy` (the Item Copy's entry). After the Item Copy is gone, `copy` reads it as it was before the event.
- On **When Used**, `self.event.target` is the entry of the Item Copy the item was used on, such as the lantern the oil went into. It is `null` when the story named no other item, or when that Item Copy is gone.
- The item timings are skipped for a reveal of an Item Copy, a write to its uses, a write to its State, and starting items.
- Their writes apply when each script ends, not when the turn ends. A script's inventory write runs the item timings it causes, to a depth of 3. Past that depth, the write still applies, no timing runs, and the turn log says so.

### When Your Code Runs

**Your scripts run every turn.** You choose no schedule and enable no option. Before the AI and After the AI run on the opening turn, and on a turn with no AI stat change.

> 💡 Both run when the stat request is off, or when it fails. On such a turn, `delta.ai` reads zeros in an After the AI script too. Code that scales an ask then leaves the value as it was.

### Run Order

Within one timing, scripts run in the order the world's **Scripts** tab lists them, from the top row down:

1. Scripts with an **order**, from the lowest. To set it, drag a row in the **Scripts** tab.
2. Scripts with no order:
   - World scripts first.
   - Global stats, then global traits.
   - Each entity in turn. Its stats' scripts run in stat order. Then its active traits' scripts run in the order of the **Traits** tab.
   - Blueprint stats, then Blueprint traits.
3. Scripts of library entities, which you add at Enter World. They run after every row, in the order you picked them. They ignore any **order** they carry.

A Blueprint script is one row. It runs once for each owner that uses it, one owner after another, at the row's place in the list.

Each script reads what the scripts above it wrote, so you can build an effect in steps. Two scripts that each take 5 Health take 10. A hub's write to Health is in Health's own script on the same turn, if Health is lower in the list. Drag a row to change what later scripts read. See [Order of Effects](Scripts-Reference#order-of-effects).

A [World Tool](#world-tools) the AI called runs before all of these, in its timing.

### World Tools
<!-- keywords: world tool, tool script, trigger, armed, args, reply, stack calls, on call, during ai output, after the ai, ai calls a tool, one turn, filter tool, tool order, tool error -->

A **World Tool** is a Tool that the world holds, on the **Tools** tab in the **Logic** group. When the AI calls a World Tool with a **Script** handler, the call **arms** the script for that turn. The script then runs at the Tool's **Timing**, with the values the AI sent in `args`. See [How to Make a Tool That Changes the Story](Tools#how-to-make-a-tool-that-changes-the-story).

| Timing | When the script runs | What the AI gets back | Writes apply |
| --- | --- | --- | --- |
| **On Call** | At once, when the AI calls | The script's return value. Text goes as it is, and any other value goes as JSON. A blank or missing value sends the Tool's **Empty Result** | At once. Later Tool calls and later prompts in the turn read them |
| **During AI Output** | On each narration sentence after the call, for the rest of the turn | The **Reply**, or "Done." when it is blank | The sentence, then the stats with the After the AI scripts |
| **After the AI** | With the After the AI scripts | The **Reply**, or "Done." when it is blank | When the turn ends |

The script reads and writes everything a world script does: stats, traits, placeholders, the [location](Scripts-Reference#location), the [clock](Scripts-Reference#passing-time), [discover](Scripts-Reference#discover), [memories](Scripts-Reference#memory) and the [diary](Scripts-Reference#diary). A During AI Output Tool also reads `narration` and rewrites the sentence, as a [During AI Output](#during-ai-output) script does.

- **`args` holds one member for each parameter the AI sent.** An optional parameter the AI left out is missing. `args` is read-only.
- **A call lasts one turn.** No armed script persists into the next turn or the save.
- **Stack Calls decides repeat calls.** With it clear, a later call in the turn replaces the earlier one. With it selected, every call runs once, in call order.
- **Called Tools run first in their timing**, in the order of the **Tools** tab. Then the world's scripts of that timing run. A During AI Output Tool passes its sentence to the next Tool, then to the scripts.
- **A call from the Planning prompt covers the whole narration.** A During AI Output Tool that the AI calls from the Planning prompt rewrites the whole narration of that turn.
- **Errors follow the script rules.** A During AI Output Tool that throws passes its sentence unchanged. On Call and After the AI discard the script's writes, as for a failed script. An On Call error goes back to the AI as the Tool's answer.
- **`player` works in On Call and After the AI only**, as in the script timings.
- **A regenerate or a cancel discards everything a Tool did that turn**, On Call writes included. A stop that keeps its narration keeps the On Call writes, because they shaped the kept text.
- **A stat re-roll keeps a Tool's effects.** An After the AI Tool runs again with the AI's call. An On Call Tool's writes come back unchanged, so a random result still matches the story. A During AI Output Tool is skipped, the same as a During AI Output script.
- **An On Call Tool's item changes come back too.** On a stat re-roll, the items it gave and the Currency items it paid change once, and their item scripts run again. If the Tool changed an item that a script gave earlier in that turn, the change is skipped and the log says so.
- **A During AI Output Tool makes the reveal show only complete sentences**, on every turn that offers the Tool.

World Tools need two things: a text endpoint that supports Tools, and **Tools** on in Settings → **Output**, in **Advanced** mode. Without them, the AI gets no World Tools, and the game goes on without them. Write the world so it still works without its Tools. See [Endpoints Without Tool Support](Tools#endpoints-without-tool-support).

```js
// A short sketch of a During AI Output Tool: bold the enemy the AI locked onto.
const targetName = String(args.name).trim();
if (targetName) narration.sentence = narration.sentence.split(targetName).join("**⌖ " + targetName + "**");
```

The sketch matches the exact name only. The drone world has the full **lock_target** Tool. It also matches any letter case and the name's last word, and it keeps bold that the AI wrote. Open it on that world's **Tools** tab.

### Strip Links And Images

**Strip Links And Images** is a setting, not a script. It sends past narration to the AI with each markdown link as its text and every image removed. A script can still add a link or an image to a sentence, and the player sees it. The setting is on by default, and it shows in **Advanced** mode. See [Settings](Settings).

## Best Practices
<!-- keywords: pitfalls, dos and donts -->

1. **Keep it simple.** Complex code is hard to debug and can affect performance.
2. **Use the zero default.** A stat name that the world does not have reads as a blank entry with every number `0`, so a lookup never throws.
3. **Let the range clamp.** The game clamps your result to the stat's Min and Max.
4. **Avoid endless loops.** A loop that never ends stops at the timeout and changes nothing.
5. **Write only what you mean to change.** A field, placeholder or trait that you do not write keeps the turn's own result.
6. **Test your code.** Use the box's own **Test Code** button before you save.
7. **Pick the right timing.**
   - **Before the AI**: a write the AI reads this turn
   - **After the AI**: a reaction to what the AI asked
   - **At Game Start**: a one-time setup
   - **When a Trait Switches**: an effect that follows a gain or a loss
8. **Add comments.** A comment tells a later reader what the code is for.

## Limitations
<!-- keywords: not allowed, fetch from internet, http request, freeze or hang, double counting, counter that increments, regenerate adds twice -->

- A run has a timeout of 1 second, so an endless loop stops. A run also has a 16 MB memory limit and a 512 KB stack limit.
- Code has no access to external resources: no network, no files.
- Two stats that read each other never loop. Each script runs once in its timing, and the lower one reads the upper one's write.
- The code is plain JavaScript in a sandbox. Its only globals are the script objects, `console.log` and the standard built-ins, such as `Math`, `JSON` and `Object`.
- Code writes `value`, `min`, `max`, `regen` and `hidden` only. Every other field of a stat entry is read-only on every path.
- A write is ignored and reported when its target is an entity that is not in the game, an unknown stat, or a stat a trait switched off.
- A stat's, a world script's or a World Tool's **Templates** menu lists only the templates that work at its timing.

**Test Code** runs one box with no player traits:

- It cannot preview a long turn or a different daypart.
- After the AI runs as a one-hour turn on day one.
- Every other timing runs as the opening turn, where `clock.deltaHours` and `clock.elapsedHours` are both `0`.
- It shows a trait switch and never applies it to the world.

### A Note on Accumulating Stats

Most scripts are **formulas**. A formula reads other stats and returns an answer, so a second run gives the same result. Code that adds to its own current value, such as `return current + 1`, is a **running total**. It depends on one run per turn.

Formamorph runs it once per turn. A re-roll of a turn's stat changes runs it again, by design. The re-roll rebuilds the turn from its starting values, so the total does not count twice. A running total is still more fragile than a formula. Use a formula where one does the job.

**A Blueprint stat's write to a global stat counts once for each owner.** The code runs once for each owner, and each owner reads what the one before it wrote. Two owners that each write `stats.Alert.value += 5` raise Alert by 10. To keep a total for each owner, write to `owner.stats`, where each owner has its own copy. The [Test Bench](Test-Bench#issues) warns on a Blueprint box that writes a global stat's field when two or more owners run it.

## Troubleshooting
<!-- keywords: no effect, value never changes, nan, silent failure, checklist, capital letters matter, ignored writes -->

When your code does not work as you expect:

1. Check the stat, placeholder and trait names for typos. Names are case-sensitive.
2. Make sure your code returns a number, or writes a field.
3. Make sure every stat you name exists.
4. Select **Test Code**. It shows each error, each field, placeholder and trait the run wrote, and each write it ignored.
5. Add `console.log()` lines. Their output shows in the browser console.
