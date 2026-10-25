# 🧮 Scripts Guide
<!-- keywords: scripts, stat code, stat script, trait script, world script, scripting, automation, custom logic, game mechanics, coding, rules engine, javascript, dynamic value calculation -->

This guide explains Formamorph's **scripts**. Older worlds and posts call them stat code. A script is one box of JavaScript with a timing. It belongs to a stat, a trait, or the world. A script can set a stat's value from other stats, set its own bounds, or write another stat. It can also pin a placeholder, switch a trait, rewrite a narration sentence, or ask the player a question. In a world file a script is one entry in a `scripts` list ([Scripts](WorldFormat#scripts)). The [World Format](WorldFormat#stats) page describes the rest of a stat.

## How to Add a Script
<!-- keywords: add stat code, stat code, script, javascript, js, formula, calculate, dynamic, programming, tab, computed value, derived, equation, math, tab is missing, where to write it, depends on another stat, auto update each turn, timing, add script button, name a script -->
<!-- route: worldEditorStat.code -->

1. In the World Editor, select **Advanced** in the mode switch. The **Scripts** tab shows in Advanced mode only.
2. Open the **Stats** tab and select the stat. Open its **Scripts** tab. Only a number or percentage stat has it.
3. Select **Add Script**. Pick a timing in the **Timing** menu. For a value the AI should read this turn, use **Before the AI**. For a reaction to the AI's change, use **After the AI**. See [The Five Timings](#the-five-timings).
4. Type your JavaScript in the box. A **Name** is optional. A blank name reads as the owner and timing, such as "Health · After the AI".
5. Select **Test Code** under the box. Read the result, any error, and every write the run made.

A trait has its own **Scripts** tab. It runs its scripts only while the trait is active. The world has a **Scripts** tab in the **Logic** group. It lists every script by timing, in run order. See [How to Review Every Script in One Place](#how-to-review-every-script-in-one-place).

## How to Insert a Template
<!-- keywords: example, snippet, preset code, starter, sample, script, ready made, boilerplate, prebuilt, no coding skills, recipe, wizard, fill in the blanks -->
<!-- route: worldEditorStat.code -->

1. Open the stat's **Scripts** tab.
2. Select **Templates** beside the box's **Test Code** button.
3. Pick a template. Each box lists the templates that work at its timing. The detail under the name lists every timing the template runs in.
4. Fill in the inputs the template asks for.
5. Edit the inserted code as you like.

| Timing | Built-in templates in its menu |
|---|---|
| ⏮️ **Before the AI** | The formulas, **Timer**, **Random Per-Turn Roll**, **Placeholder by Range**, **Trait by Threshold**, **Opening Turn Value** |
| ⏭️ **After the AI** | The formulas, **Timer**, **Random Per-Turn Roll**, **Hourly Change**, **Regen Toward Target**, **Dice Roll With Consequences**, **Placeholder by Range**, **Trait by Threshold** |
| 🎬 **At Game Start** | The formulas, **Placeholder by Range**, **Trait by Threshold**, **Random Starting Value**, **Start From Persona Trait** |
| 🔀 **When a Trait Switches** | The formulas, **Change When a Trait Switches**, **Mirror a Trait** |
| 💬 **During AI Output** | **Replace a Word**, **Count a Word**, **Bold a Word Past a Threshold** |

The formulas are **Weighted Blend**, **Inverse of Another Stat**, **Threshold Flag**, **Daypart Modifier**, **Bound From Another Stat**, **Bonus From Persona Trait** and **Penalty From Entity Trait**.

**Hourly Change** and **Regen Toward Target** read `clock.deltaHours`, which is `0` in every timing but **After the AI**.

In an entity's stat, a stat or trait input lists the entity's own names first, under **Owner**. The global names follow. An **Owner** pick inserts `owner.stats` or `owner.traits`. A Blueprint stat's trait input lists the global traits only.

To save your own template, select **New Template** or **Duplicate**. Pick each timing it works in under **Runs**. The template shows in the menu of each of those timings.

In your own template, a stat or trait input can list the names of one entity. Put the entity input's name in brackets after the type:

| Slot | What the input lists |
|---|---|
| `{{who:entity}}` | The world's entities |
| `{{s:stat(who)}}` | The stats of the entity picked in `who`. Write it as `entities[{{who:entity}}].stats[{{s:stat(who)}}]` |
| `{{t:trait(who)}}` | The traits of the entity picked in `who` |
| `{{s:stat(persona)}}` | Each persona entity's stats. Write it as `persona.stats[{{s:stat(persona)}}]` |
| `{{t:trait(persona)}}` | Each persona entity's traits |
| `{{place:location}}` | The world's locations. Write it as `location.move({{place:location}})` |

When you pick another entity, the stat and trait inputs that list its names clear.

## How to Insert a Name from Your World
<!-- keywords: reference an entity's trait, trait of an entity, find a name, pick a name, insert a path, menu, variable button, drill down, dictionary placeholder, persona trait, stat value, don't type names, copy the right spelling -->
<!-- route: worldEditorStat.code -->

Select the **Variable** button in the toolbar of a code box on a stat's **Scripts** tab. The menu opens on **This Stat**, **Stats**, **Traits**, **Entities**, **Persona**, **Placeholders**, **Dictionaries** and **Clock**. In the box of an entity's stat or a Blueprint stat, an **Owner** group follows **This Stat**. **Stats** always lists the global stats. Each group opens level by level: a list of your world's own names, then a name's fields, and for an entity, its **Traits** and **Placeholders**. Select a field to insert its whole path at the caret. To reach `entities.Mira.traits.Wounded.enabled`, open **Entities**, **Mira**, **Traits**, **Wounded**, and then select **enabled**. The path runs as inserted, with no name to type.

## How to Limit the AI's Change to a Stat
<!-- keywords: clamp, cap, max, restrict, prevent, too fast, delta, script, throttle, big swings, jumps too much, slow down gains, never go up, dampen, narrator overreacts, at most per turn -->
<!-- route: worldEditorStat.code -->

1. Open the stat's **Scripts** tab.
2. Add a script with the **After the AI** timing. Read the AI's ask from `self.delta.ai.value`.
3. Clamp the ask.
4. Set `self.value` from `self.previous.value`, the clamped ask and `self.delta.regen.value`. See [Reading This Turn](#reading-this-turn) for an example.
5. Select **Test Code**.

## How to Change Another Stat from Code
<!-- keywords: move two stats at once, one event changes several stats, one script hurts health and raises luck, dice roll with a penalty, halve health on a bad roll, bonus on a good roll, hub stat, one box for many stats, write to another stat, change a different stat, cap another stat, raise another stat's max, speed up another stat's regen, my script changes the wrong stat, two scripts fight over one stat, split logic across stats, reaction in each stat's box, world script writes stats -->
<!-- route: worldEditorStat.code -->

1. Open the **Scripts** tab of the stat that decides the change. This stat is the hub. For a rule that belongs to no stat, add the script to the world's **Scripts** tab.
2. In its code box, write the field of the stat to move: `stats.Health.value = stats.Health.value / 2`. To move an entity's stat, name the entity: `entities.Mira.stats.Trust.value -= 5`. Use the **After the AI** timing to react to this turn's roll or ask.
3. Select **Test Code**. It lists every write to another stat, such as `stats.Health.value = 30`, with the owner of each target stat.
4. In **Advanced** mode, open the [Test Bench](Test-Bench#issues) and read **Issues**. It warns when two scripts write one field.

See [Writing to Other Stats](#writing-to-other-stats) for the four fields and the rules.

## How to Pin a Placeholder from Code
<!-- keywords: script, javascript, set value, force, wildcard, variable, wording follows a stat, conditional text, override the roll, swap wording by value, lock in, mood changes with number, programmatically -->
<!-- route: worldEditorStat.code -->

1. Open the stat's **Scripts** tab.
2. Add a script with the **Before the AI** timing. Call `pin` on the placeholder, such as `placeholders.Mood.pin('calm')`. A pin from this script is in the prompt for this turn.
3. Select **Test Code**. It lists each placeholder the run pinned.

## How to Rewrite a Narration Sentence
<!-- keywords: filter words, censor, replace a word, swap a word, turn a name into a link, add a link, add an image, markdown link, clean up narration, fix wording, during ai output, narration script, rewrite the story as it streams, remove a phrase, change what the narrator says -->
<!-- route: worldEditorStat.code -->

1. Open a **Scripts** tab and select **Add Script**. A world script suits a rule for the whole story.
2. Pick **During AI Output** in the **Timing** menu.
3. Assign the new sentence to `narration.sentence`, or return a string: `narration.sentence = narration.sentence.replace('door', '[door](https://example.com)');`
4. Type a sentence in **Sample Sentence** and select **Test Code**. The report leads with the rewritten sentence.

See [During AI Output](#during-ai-output) for what the rewrite changes.

## How to Ask the Player a Question
<!-- keywords: prompt the player, ask the player, yes or no, confirm, choose an option, pick from a list, type an answer, show a message, toast, tell the player, dialog, player input, interactive script, question from a script -->
<!-- route: worldEditorStat.code -->

1. Open a **Scripts** tab and select **Add Script**. Pick any timing except **During AI Output**.
2. Call a `player` function. `player.confirm("Open the door?")` returns `true` or `false`. `player.ask("Which path?", ["Left", "Right"])` returns the pick. `player.input("Name the dog")` returns the typed text.
3. Use the answer in the next line. There is no `await`.
4. Select **Test Code**. The question shows under the box, as it does in play.

See [Player](#player) for every call and for what closing a prompt does.

## How to Let the AI Run a Script
<!-- keywords: world tool, tool script, ai decides, ai calls my code, trigger, arm a script, on demand, filter on request, narration filter tool, reply, stack calls, timing, function calling script -->
<!-- route: worldEditor.tools -->

1. In the World Editor, select **Advanced** in the mode switch and open the **Tools** tab in the **Logic** group.
2. Select **Add Tool**. Write a **Description** that names the scene that calls for it.
3. On the **Handler** tab, pick **Script**, then a **Timing**: **On Call**, **During AI Output** or **After the AI**.
4. Write the script. It reads the AI's values from `args`.
5. Select **Save Tool**.

See [World Tools](#world-tools) for what each timing does.

## How to Insert a World Tool Template
<!-- keywords: world tool template, tool script example, starter tool code, args template, parameter slot, report a stat, roll dice, pass time, pin a memory, highlight a name -->
<!-- route: worldEditor.tools -->

1. On the **Handler** tab, pick **Script** and a **Timing**.
2. Select **Templates** under the **Script** box. The menu lists the World Tool templates for that timing. When you change the timing, the menu changes too.
3. Fill in the inputs. A parameter input lists the Tool's Parameters of the type the template needs. The code reads the one you pick from `args`.
4. To add a new Parameter, pick the **New** row in a parameter input. **Insert Code** adds that Parameter to the Tool, so a Tool with no Parameters works too.
5. Select **Insert Code**, then edit the code as you like.

| Timing | Built-in templates in its menu |
|---|---|
| **On Call** | **Report a Stat**, **Roll Dice**, **Change a Stat**, **Move to Location**, **Pass Time**, **Discover an Entity**, **Pin a Memory** |
| **During AI Output** | **Highlight a Name**, **Replace a Word** |
| **After the AI** | **Change a Stat**, **Move to Location**, **Pass Time**, **Discover an Entity**, **Pin a Memory**, **Add a Diary Line** |

At **On Call**, a template's return value is the reply the AI gets. At the other timings, the AI gets the Tool's **Reply**, and the return value does nothing.

World Tool templates share the library and the pack file with stat templates, but each menu lists only its own kind. A stat's **Templates** menu never lists a World Tool template. Save your own with **New Template** or **Duplicate** in a World Tool's menu.

In your own template, `{{name:param(number)=amount}}` is a parameter input. The type is `string`, `number` or `boolean`. The input lists the Tool's Parameters of that type, plus a **New** row named `amount`. A slot with no type adds a text Parameter. A slot with no `=amount` part names the new Parameter after the slot.

## How to Insert a World Script Template
<!-- keywords: world script template, world script example, starter world script code, opening location, advance time while a trait is on, leave when a stat runs out, placeholder by daypart, memory when a trait turns on, diary line when a trait turns on, entity stat follows a global stat, location input -->
<!-- route: worldEditor.scripts -->

1. Open the world's **Scripts** tab and add a world script, or open one that exists.
2. Select **Templates** beside the box's **Test Code** button. The menu lists the world script templates for the box's timing.
3. Fill in the inputs. A location input lists the world's locations and inserts the one you pick as a quoted name.
4. Select **Insert Code**, then edit the code as you like.

A world script has no stat or trait of its own, so its templates never read `self` and never return a value.

| Timing | Built-in templates in its menu |
|---|---|
| ⏮️ **Before the AI** | **Advance Time While a Trait Is On**, **Placeholder by Daypart**, **Entity Stat Follows a Global Stat** |
| ⏭️ **After the AI** | **Advance Time While a Trait Is On**, **Leave When a Stat Runs Out**, **Entity Stat Follows a Global Stat** |
| 🎬 **At Game Start** | **Opening Location**, **Placeholder by Daypart** |
| 🔀 **When a Trait Switches** | **Memory When a Trait Turns On**, **Diary Line When a Trait Turns On** |
| 💬 **During AI Output** | **Replace a Word** |

World script templates share the library and the pack file with the other templates, but each menu lists only its own kind. A stat's or World Tool's **Templates** menu never lists a world script template. A trait's **Scripts** tab has no **Templates** button. Save your own with **New Template** or **Duplicate** in a world script's menu.

## How to Review Every Script in One Place
<!-- keywords: scripts tab, all scripts, list of scripts, run order, order of scripts, drag script, reorder scripts, which script runs first, world script, add a world script, find a script, scripts by timing -->
<!-- route: worldEditor.scripts -->

1. In the World Editor, select **Advanced** in the mode switch and open the **Scripts** tab in the **Logic** group.
2. Read the tree. It has one group for each timing, and each script is a row, in the order the scripts run.
3. Select a row to edit its script in the same box its owner shows. **Open** followed by the owner's name jumps to the owner's **Scripts** tab. A world script has no owner to open.
4. Drag a row to change when it runs in its timing. A drop sets the **order** of the scripts in that timing. A drag to another timing is refused. Change a script's timing in its **Timing** menu.
5. Select **Add Script** and pick a timing. The new script belongs to the world. The text typed in the search box becomes its name.

## How to Debug Scripts
<!-- keywords: error, console, log, fix, broken, not working, test, script, print values, devtools, f12, trace, inspect, wrong number, canceled prompt -->
<!-- route: worldEditorStat.code -->

1. Select **Test Code** to see the error and every write.
2. Add `console.log()` lines.
3. Open your browser's developer console. Each line shows there.
4. In the World Editor's [Test Bench](Test-Bench#issues), read the **Issues** list for writes to unknown names and for two scripts that write one stat field. Each finding names the script by its name, or by its owner and timing.

## Overview

A script runs in a sandbox at its own point in the turn (see [The Five Timings](#the-five-timings)). It can:

- **Derive a value** from other stats (e.g., carrying capacity based on strength)
- **Combine stats** (e.g., defense calculated from armor + agility)
- **React to thresholds** (e.g., speed penalties when health is below 30%)
- **Follow time**: how long a turn took, or what time of day it is (see [The Story Clock](#the-story-clock))
- **Set its own Min, Max, or Regen** (see [Writing to `self`](#writing-to-self))
- **Write another stat**, global or owned by any entity, so one event can move several stats (see [Writing to Other Stats](#writing-to-other-stats))
- **Shape what the AI asked for** before it lands (see [Reading This Turn](#reading-this-turn))
- **Pin a placeholder** to any text (see [Placeholders](#placeholders))
- **Switch a trait** on or off (see [Traits](#traits))
- **Read or switch an entity's traits**, and read its placeholders (see [Persona](#persona) and [Entities](#entities))
- **Find the entity that owns the stat** with `owner` (see [Owner](#owner))
- **Read a dictionary's placeholders and entries** (see [Dictionaries](#dictionaries))
- **Read the locations**, and who is at each (see [Location](#location))
- **Read the memories**, pin or forget one, and add a line (see [Memory](#memory))
- **Read the player's notes** (see [Notes](#notes))
- **Add a line to an entity's diary** (see [Diary](#diary))
- **Rewrite a narration sentence** as it completes (see [Narration](#narration))
- **Tell or ask the player** (see [Player](#player))
- **React when a trait switches** (see [Trait](#trait))
- **Run when the AI decides**, from a World Tool (see [World Tools](#world-tools))

## How It Works
<!-- keywords: which box to use, lifecycle, sequence of steps, pre and post, how often it executes, hooks, script crashes, reads zero early, older single box worlds, where scripts live, home of a script, stat script, trait script, world script -->

1. A script is one box of JavaScript with a timing. A stat, a trait or the world holds any number of them
2. At its timing, each script runs in a safe environment
3. A script reads every stat, the story clock, the world's placeholders and traits, and the entities, locations, dictionaries, memories and notes in the game
4. `return <number>` sets the stat's value, clamped to its range. Writes to `self`, `stats`, `owner`, `placeholders`, `traits`, `persona`, `entities`, `location`, `memories` and `dictionaries` apply after the run
5. A script that throws or times out changes nothing

### The Home of a Script

A script's home decides two things: what `self` is, and when the script is in force.

| Home | `self` | In force |
| --- | --- | --- |
| A stat | The stat | Always. A stat that a trait switched off pauses its scripts |
| A trait | The trait's own entry. It is read-only, and a return value is ignored | While the trait is active. A global trait runs once with `owner` empty. An entity's trait runs once for each entity that holds it, with that entity as `owner` |
| The world | An empty object. A return value and a write to `self` are ignored | Always |

A Blueprint stat's script runs once for each owner, in every timing.

### The Five Timings

A turn runs scripts at five points:

| Timing | When it runs | Writes apply | Names it adds |
| --- | --- | --- | --- |
| **Before the AI** | At the start of a turn, before the prompt is built | In that turn's prompt | `player` |
| **After the AI** | After the AI's changes and Regen apply | When the turn ends | `player` |
| **During AI Output** | Once for each narration sentence, when it completes | The sentence, then the stats with the After the AI scripts | `narration` |
| **At Game Start** | Once, on the opening turn of a new game, before the Before the AI scripts | In the opening prompt | `player` |
| **When a Trait Switches** | Each time a trait turns on or off in play | At once | `player` and `trait` |

A timing adds names to the ones every script reads. The editor's **Variable** menu lists the names a timing adds in a group at the end: **Narration**, **Player**, and **Switched Trait**. In a trait's script, **This Trait** replaces **This Stat**, and a world script has neither.

| Step | What happens |
| --- | --- |
| 1 | **At Game Start** runs, on the opening turn of a new game only |
| 2 | **Before the AI** runs, on the state the turn started in |
| 3 | The prompt is built and the AI answers. **During AI Output** runs on each sentence as the narration streams |
| 4 | The AI's stat changes apply |
| 5 | Regen applies |
| 6 | **After the AI** runs |
| 7 | **When a Trait Switches** runs right after any step above that switches a trait |

**Before the AI** runs before the prompt is built. A value it sets, a placeholder it pins, or a trait it switches is in the prompt for that turn. A value it sets shows on the bar while the AI is still writing.

**After the AI** is where a stat's one code box always ran, so a world written before scripts keeps its meaning with no edits. It reads the AI's change, this turn's regen, and the values the Before the AI scripts set.

> ⚠️ **A Before the AI script has no turn behind it yet.** `previous` reads as the stat itself, `delta.ai`, `delta.regen`, `delta.total` and `delta.actual` all read zeros, and the clock reads turn start, so `clock.deltaHours` is `0`. Code that scales the AI's change belongs in an After the AI script. At Game Start and During AI Output read the same turn start.

**Bounds carry across timings.** A `self.max` a Before the AI script sets persists through an After the AI script that never writes it. Emptying a script leaves the bounds as they are.

#### During AI Output

The script runs once for each narration sentence, when the sentence completes. It never runs for each token. It reads `narration` (see [Narration](#narration)) and rewrites the sentence by assigning `narration.sentence` or by returning a string.

- The rewrite is the one copy. The screen, the save, read-aloud and the AI's recap of the story all carry it.
- A rewrite is one sentence, whatever it holds. The reveal and read-aloud release it as one unit.
- Scripts that run on one sentence chain. Each reads the sentence as the one before left it, in run order.
- A script that throws or times out passes its sentence unchanged. The error logs, and the [Test Bench](Test-Bench#issues) reports it.
- Stat, placeholder and trait writes from every sentence apply once, with the After the AI scripts. Across sentences, sentence N+1 reads the stats as sentences 0 to N left them.
- A turn that you stop but keep lands none of these writes. The kept text shows the rewritten sentences.
- With one of these scripts in the world, the narration reveal shows only complete sentences.
- `player` is not available. A call to it fails the script, and the sentence passes unchanged.

#### At Game Start

The script runs once for each new game, after setup and before the opening turn's AI call. Loading a save never runs it. It runs before the Before the AI scripts, on the current state, so its writes shape the opening prompt. Regenerating the opening of a new game restores the state from before the start scripts, and they run again. Regenerating the opening of a loaded save runs nothing.

#### When a Trait Switches

The script runs once for each trait that turns on or off in play, whatever switched it. A switch can come from the player's checkbox, a script, a group that turns its other traits off, a requirement that stops holding, or a persona change. Setup picks and loading a save run no script. A trait that switches and switches back inside one action fires nothing.

- A script in this timing reads `trait`: the trait that switched, with `enabled` set to its new state (see [Trait](#trait)).
- A trait's own script also has `self`. It runs on its own switch-off too, which is the one time a trait's script runs while the trait is off.
- Several switches from one action run one at a time, the ones that turned off first. Each run reads the state the one before left.
- A switch that a script makes fires its own scripts, to a depth of 8. Past that, the switch applies, no script fires, and the browser console warns.

### When Your Code Runs

**Your scripts run every turn.** There is no schedule to choose and no option to enable. Before the AI and After the AI run on the opening turn and on a turn with no AI stat change.

> 💡 Both run even when the stat request is off, or when it fails. On such a turn `delta.ai` reads zeros in an After the AI script too, so code that scales an ask leaves the value where it stood.

### Run Order

Within one timing, scripts run in this order:

1. Scripts with an **order**, from the lowest. Drag a row in the world's **Scripts** tab to set it.
2. Scripts with no order: world scripts first, then each owner's. Global stats and traits come first, then each entity. Inside one owner, its stats' scripts run in stat order, then its active traits' scripts in the Traits tab's order.

A later write to a field wins. So the order decides who wins: a world script ordered before a stat script loses the field to the stat script. Swap their orders and the world script wins. See [Writing to Other Stats](#writing-to-other-stats).

A [World Tool](#world-tools) the AI called runs before all of these, in its timing.

### World Tools
<!-- keywords: world tool, tool script, trigger, armed, args, reply, stack calls, on call, during ai output, after the ai, ai calls a tool, one turn, filter tool, tool order, tool error -->

A **World Tool** is a Tool that the world holds, on the **Tools** tab in the **Logic** group. When the AI calls a World Tool with a **Script** handler, the call **arms** the script for that turn. The script then runs at the Tool's **Timing**, with the values the AI sent in `args`. See [How to Make a Tool That Changes the Story](Tools#how-to-make-a-tool-that-changes-the-story).

| Timing | When the script runs | What the AI gets back | Writes apply |
| --- | --- | --- | --- |
| **On Call** | At once, when the AI calls | The script's return value. Text goes as is and any other value as JSON. A blank or missing value sends the Tool's **Empty Result** | At once. Later Tool calls and later prompts in the turn read them |
| **During AI Output** | On each narration sentence after the call, for the rest of the turn | The **Reply**, or "Done." when it's blank | The sentence, then the stats with the After the AI scripts |
| **After the AI** | With the After the AI scripts | The **Reply**, or "Done." when it's blank | When the turn ends |

The script reads and writes everything a world script does: stats, traits, placeholders, the [location](#location), the [clock](#passing-time), [discover](#discover), [memories](#memory) and the [diary](#diary). A During AI Output Tool also reads `narration` and rewrites the sentence, as a [During AI Output](#during-ai-output) script does.

- **`args` holds one member for each parameter the AI sent.** An optional parameter the AI left out is missing. `args` is read-only.
- **A call lasts one turn.** Nothing armed carries into the next turn or the save.
- **Stack Calls decides repeat calls.** With it clear, a later call in the turn replaces the earlier one. With it selected, every call runs once, in call order.
- **Called Tools run first in their timing**, in the **Tools** tab's order, then the world's scripts of that timing. A During AI Output Tool passes its sentence on to the next one, then to the scripts.
- **A Planning call covers the narration.** A During AI Output Tool that the AI calls from the Planning prompt rewrites that turn's whole narration.
- **Errors follow the script rules.** A During AI Output Tool that throws passes its sentence unchanged. On Call and After the AI drop the script's writes, as a failed script does. An On Call error goes back to the AI as the Tool's answer.
- **`player` works in On Call and After the AI only**, as in the script timings.
- **A regenerate or a cancel drops everything a Tool did that turn**, On Call writes too. A stop that keeps its narration keeps the On Call writes, because the kept text was written with them.
- **A stat re-roll keeps a Tool's effects.** An After the AI Tool runs again with the AI's call. An On Call Tool's writes come back as they were, so a random result still matches the story. A During AI Output Tool doesn't run again, as a During AI Output script doesn't.
- **With a During AI Output Tool in the world, the reveal shows only complete sentences**, on every turn the Tool is offered.

World Tools need a text endpoint that supports Tools, and **Tools** on in Settings → **Output**. Without them, the AI gets no World Tools and the world plays on. Write the world so it still works without its Tools. See [Endpoints Without Tool Support](Tools#endpoints-without-tool-support).

```js
// A short sketch of a During AI Output Tool: bold the enemy the AI locked onto.
const targetName = String(args.name).trim();
if (targetName) narration.sentence = narration.sentence.split(targetName).join("**⌖ " + targetName + "**");
```

The sketch matches the exact name only. The drone world ships the full **lock_target** Tool, which also matches any letter case and the name's last word, and leaves bold the AI wrote intact. Open it on that world's **Tools** tab.

### Strip Links And Images

**Strip Links And Images** is a setting, not a script. It sends past narration to the AI with each markdown link as its text and every image removed. A script can still add a link or an image to a sentence, and the player sees it. The setting is on by default. See [Settings](Settings).

## Quick Reference
<!-- keywords: cheat sheet, api, syntax, members, fields, properties, objects, globals, what can code read, what can code write, how to access, dot notation, available variables, narration fields, player calls -->

A script can use only these objects. A word in angle brackets stands for a name from your world, `<n>` for a number, and `<text>` for text. A name with a space needs brackets: `stats["<Stat>"]`.

| Object | Members | Read | Write |
| --- | --- | --- | --- |
| `self` | `id`, `name`, `type`, `description`, `enabled`, `min`, `max`, `value`, `regen`, `hidden`, `previous`, `delta` | `self.value` | `self.value = <n>` |
| `stats` | `id`, `name`, `type`, `description`, `enabled`, `min`, `max`, `value`, `regen`, `hidden`, `previous`, `delta` | `stats.<Stat>.value` | `stats.<Stat>.value = <n>` |
| `owner` | `id`, `name`, `type`, `pronouns`, `inScene`, `location`, `following`, `description`, `summary`, `aliases`, `traits`, `placeholders`, `stats`, `move()`, `follow()`, `unfollow()`, `diary()` | `owner.stats.<Stat>.value` | `owner.stats.<Stat>.value = <n>` |
| `clock` | `day`, `daypart`, `hour`, `minute`, `deltaHours`, `elapsedHours`, `previous`, `advance()` | `clock.day` | `clock.advance(<n>)` |
| `turn` | `action`, `number` | `turn.number` | Read-only |
| `locations` | `id`, `name`, `description`, `summary`, `starting`, `present`, `parent`, `children`, `exits` | `locations.<Location>.present` | Read-only |
| `location` | `id`, `name`, `description`, `summary`, `starting`, `present`, `parent`, `children`, `exits`, `move()` | `location.name` | `location.move("<Location>")` |
| `discover` | — | — | `discover(<text>)` |
| `memories` | `id`, `turn`, `timestamp`, `day`, `daypart`, `text`, `custom`, `kept`, `inContext`, `pinned`, `forgotten`, `add()`, `pin()`, `forget()`, `edit()`, `remove()` | `memories.length` | `memories.pin(<text>)` |
| `notes` | — | `notes` | Read-only |
| `traits` | `enabled`, `acquired`, `id`, `name`, `mode`, `available`, `group`, `playerToggle` | `traits.<Trait>.enabled` | `traits.<Trait>.enabled = true` |
| `persona` | `id`, `name`, `type`, `pronouns`, `inScene`, `location`, `following`, `description`, `summary`, `aliases`, `traits`, `placeholders`, `stats` | `persona.traits.<Trait>.enabled` | `persona.traits.<Trait>.enabled = true` |
| `entities` | `id`, `name`, `type`, `pronouns`, `inScene`, `location`, `following`, `description`, `summary`, `aliases`, `traits`, `placeholders`, `stats`, `move()`, `follow()`, `unfollow()`, `diary()` | `entities.<Entity>.stats.<Stat>.value` | `entities.<Entity>.traits.<Trait>.enabled = true` |
| `placeholders` | `id`, `name`, `value`, `values`, `text`, `roll()`, `pin()`, `unpin()` | `placeholders.<Placeholder>.text` | `placeholders.<Placeholder>.pin(<text>)` |
| `dictionaries` | `id`, `name`, `entries`, `placeholders` | `dictionaries.<Dictionary>.placeholders.<Placeholder>.text` | `dictionaries.<Dictionary>.placeholders.<Placeholder>.pin(<text>)` |
| `console` | `log()` | — | `console.log(<text>)` |

A timing adds one name to those objects. A script reads only the name its own timing adds:

| Name | Timing | Members | Read | Write |
| --- | --- | --- | --- | --- |
| **`narration`** | During AI Output only | `sentence`, `sent`, `buffered`, `full`, `index` | `narration.sentence` | `narration.sentence = <text>` |
| **`player`** | Every timing but During AI Output | `tell()`, `toast()`, `confirm()`, `ask()`, `input()` | `player.confirm(<text>)` | Calls, not writes |
| **`trait`** | When a Trait Switches only | `enabled`, `acquired`, `id`, `name`, `mode`, `available`, `group`, `playerToggle`, `owner` | `trait.enabled` | Read-only |

A [World Tool](#world-tools)'s script also reads `args`, the values the AI sent, such as `args.<Parameter>`. It is read-only.

Follow these rules:

- **A stat compares through `.value`.** Write `stats.<Stat>.value > <n>`. `stats.<Stat>` and `self` alone are whole entries, not numbers.
- **A trait switches through `.enabled`.** Write `traits.<Trait>.enabled = true`. The editor underlines `traits.<Trait> = true`.
- **A trait sits under its owner.** `traits` holds the global traits only. A trait on the entity that owns the stat is under `owner.traits`. A trait on the played persona is under `persona.traits`. A trait on another entity is under `entities.<Entity>.traits`, the Custom Persona under a library persona included.
- **`stats` is the global stats in every box.** It means the same in an entity's scripts as in a global stat's, as `traits` does. It never holds the entity's own stats.
- **An entity's scripts read its own entity's stats through `owner.stats`.** `owner` is the entity that owns the running stat, so `owner.stats.<Stat>.value` is the entity's own stat. In a Blueprint stat's script, `owner` is the entity the run is for. In a global stat's script, it's an empty entry: reads are blank, and a write is ignored and reported.
- **Another entity's stats are under `entities.<Entity>.stats`.** The played persona's are under `persona.stats`.
- **"After N days" is `clock.day > <n>`.** `clock.day` starts at 1. For timing in hours, use `clock.elapsedHours`. The time of day is `clock.daypart`.
- **`self` and every `stats` entry take writes to `value`, `min`, `max`, `regen` and `hidden`.** So does every stat entry under `owner.stats`, `entities.<Entity>.stats` and `persona.stats`. Their other fields are read-only.
- **A name that its timing does not add is unknown.** `narration` in a Before the AI script, and `player` in a During AI Output script, show an error underline. A `narration` read fails the run with "not defined". A `player` call in During AI Output throws "can't run in During AI Output".

## Writing Scripts

### Basic Syntax
<!-- keywords: what language, first script, minimal example, is return required, fixed number -->

Your code is plain JavaScript. Return a number to set the stat's value. The code has access to `stats`, a map of the global stats keyed by name, and to `self`, the stat the code belongs to. It also has `owner`, the entity that owns the stat: empty for a global stat, and the entity the run is for in a Blueprint stat (see [Owner](#owner)).

```javascript
// Example: Return a fixed value
return 50;
```

A script does not have to return anything. One that only writes `self`, a placeholder, or a trait leaves the value to the AI and regen.

### Self
<!-- keywords: this stat, the running stat, own value, own entry, current stat, self name, self value -->
<!-- route: worldEditorStat.code -->

`self` is the stat the code belongs to, in every box. It has the [same members as a `stats` entry](#stat-properties). In a global stat's code, it is the same entry as `stats.<own name>`. In an entity stat's code, it is the same entry as `owner.stats.<own name>`. Four of its fields take writes (see [Writing to `self`](#writing-to-self)).

### Stats
<!-- keywords: global stats, stats map, stats object, all stats, other stats, read a stat, stat by name, stats in an entity's code, loop over stats -->
<!-- route: worldEditorStat.code -->

`stats` is a map of the global stats keyed by name, in every box. An entity's scripts get the same map as a global stat's scripts, as `traits` does. It never holds the entity's own stats: those are under `owner.stats`. Each entry has the [same members as `self`](#stat-properties), and takes writes to `value`, `min`, `max` and `regen` (see [Writing to Other Stats](#writing-to-other-stats)). To read a stat by name, see [Accessing Other Stats](#accessing-other-stats).

### Owner
<!-- keywords: own stats, read the entity's other stats, script on a monster's stat, this entity, entity's own stat, self entity, creature code, npc code, blueprint owner, empty owner, owner is blank, owner stats, owner traits, owner placeholders -->
<!-- route: worldEditorStat.code -->

`owner` is the entity that owns the running stat. It has the same members as an [entity entry](#entities): `id`, `name`, `type`, `pronouns`, `inScene`, `location`, `following`, `description`, `summary`, `aliases`, `traits`, `placeholders`, `stats`, `move()`, `follow()`, `unfollow()` and `diary()`. So code reaches the entity's own stats as `owner.stats`, its own traits as `owner.traits`, and its own placeholders as `owner.placeholders`.

| Box | What `owner` is |
| --- | --- |
| A stat on an entity's **Stats** tab | That entity |
| A Blueprint stat | The entity the run is for. The code runs once for each owner |
| A global stat | An empty entry |

In an entity stat's code, `self` is the same entry as `owner.stats.<own name>`, so a write through either route is one write.

```javascript
// On a stat of The Creature: the Creature's Rage grows while it is Hunted.
if (owner.traits.Hunted.enabled) owner.stats.Rage.value += 2;
```

Code that uses `owner` never throws in a global stat's box. Every read is blank, and every trait reads as off. A write through it is ignored and reported.

> ℹ️ **Two entities can share a code name.** The later one is the entry in `entities`. `owner` is still the owner's own entry, so a same-name entity never hides it.

### Accessing Other Stats
<!-- keywords: reference another, dot notation, square brackets, misspelled name, undefined, get hp, missing gives zero, randomized names -->
<!-- route: codeRename -->

Read another stat by its name:

```javascript
// Example: Return the value of another stat
const health = stats.Health.value;
return health;
```

A name with a space needs brackets: `stats["Hit Points"].value`. A name the world does not have reads as a blank entry with every number `0`, so a typo never throws.

To read the entity's own stats in an entity's script, use `owner.stats`. To read another entity's stats, use `entities.<Entity>.stats`:

```javascript
// In a script of The Creature's stat: read a global stat and the Creature's own stat.
const alert = stats["Alert Level"].value;
return owner.stats.Rage.value + alert / 2;
```

Rename a stat, a trait or a placeholder that code names, and **Update Code References** asks whether to change the name in that code too. **Leave Code** keeps the code as it is.

> ℹ️ **A stat name with a placeholder chip in it reads in code as the placeholder's own name.** A stat named `{{Beast}} Power` is `stats["Beast Power"]` in every playthrough, whatever the chip rolled. The player still sees the rolled name.

### Stat Properties
<!-- keywords: attributes, members, api reference, object shape, what can i read, disabled stat, hidden by perk, descriptors unavailable -->

Each stat in the `stats` map, `self` included, exposes the following properties. So does each stat under `owner.stats`, `entities.<Entity>.stats` and `persona.stats`:

| Property | What it is |
| --- | --- |
| `id` | Unique identifier |
| `name` | Code name. The authored name with each chip replaced by its placeholder's name |
| `type` | Type of stat (`'number'` or `'percentage'`) |
| `description` | Text description |
| `min` | Minimum value |
| `max` | Maximum value |
| `value` | Current value, with this turn's AI change and regen applied |
| `enabled` | False while a trait's stat toggle switches the stat off. Read-only |
| `regen` | Regen per story hour, with traits applied |
| `hidden` | True when the stat is hidden from the player. The AI still reads it. See [Hiding and Showing a Stat](#hiding-and-showing-a-stat) |
| `previous` | The full stat at the start of the turn: `id`, `name`, `type`, `description`, `min`, `max`, `value`, `regen`, `hidden`. Read-only |
| `delta` | Every change this turn made, by source: `ai`, `regen`, `total`, `actual`. Read-only |

A stat that a trait switched off still reads as a real entry. Its name, value and bounds read as usual, with `enabled` false. A write to it is ignored and reported. A live stat wins a code name over a switched-off one. Between stats in the same state, the later one wins.

> ℹ️ Only these fields are passed into the sandbox. A stat's own `code` and `descriptors` are **not** available from inside a script.

### Writing to `self`
<!-- keywords: raise the ceiling, upper limit, lower limit, regeneration rate, assign, modify own stat, underlined write, scale with level up, this keyword -->

`self` is the stat the code belongs to. In a global stat's code, it is the same entry that sits in `stats`, so `self.value` and `stats[self.name].value` read the same. In an entity stat's code, it is the same entry that sits in `owner.stats`, so `self.value` and `owner.stats[self.name].value` read the same. A write through either path is one write. Five of its fields take writes:

| Write | Effect |
| --- | --- |
| `self.value = n` | Sets the value this turn, clamped to the range. Same as `return n` |
| `self.min = n` | Sets the floor to `n` now, but never below the authored min. Later changes move it from `n` |
| `self.max = n` | Sets the cap to `n` now. Later changes move it from `n` |
| `self.regen = n` | Sets regen per story hour to `n` now. Later changes move it from `n` |
| `self.hidden = true` | Hides the stat from the player. `false` shows it. See [Hiding and Showing a Stat](#hiding-and-showing-a-stat) |

A field you do not write keeps what the turn gave it. So a script can move the cap and leave the value to the AI:

```javascript
// Max grows with Level. The value still moves as the AI narrates.
const level = stats.Level.value;
self.max = 50 + level * 10;
```

A bound write works like a value write. After `self.max = 20`, the cap reads 20 when the run lands, whatever a trait switch in the same run moved. Every later change moves it from 20:

| Later change | Effect on the cap |
| --- | --- |
| A trait that adds 10 to the max switches on | 30 |
| That trait switches off again | 20 |
| The AI raises the max by 5 | 25 |
| The code writes `self.max = 40` | 40 |

No code bound hides the traits or the AI under it. Deleting the code leaves the bounds as they are. Writing `null` to `value`, `min`, `max` or `regen` fails the run, as any other non-number does. Writing anything but `true` or `false` to `hidden` fails the run. Every other field of `self` is read-only. To write a stat other than `self`, see [Writing to Other Stats](#writing-to-other-stats).

### Writing to Other Stats
<!-- keywords: move another stat, change another stat, hub stat, one event many stats, write stats map, damage health from a roll, raise luck on a twenty, cap another stat, change another stat's max, change another stat's regen, change an entity's stat, drain an npc, push a global stat from an entity's code, cross-owner write, owner order, entity's own stats, npc stat code, two scripts write one stat, which write wins, order of stats, last write wins, target does not see the write, blueprint stat code, each owner's copy, two writers warning, two boxes write one field -->
<!-- route: worldEditorStat.code -->

Code can write any stat in the game, by the route that reaches it. One box can move several stats, so an event needs no reaction code in each target stat. A stat whose code writes other stats is a hub.

| Route | Reaches |
| --- | --- |
| `stats.<Stat>` | A global stat |
| `owner.stats.<Stat>` | A stat of the entity that owns the running stat |
| `entities.<Entity>.stats.<Stat>` | A stat of that entity |
| `persona.stats.<Stat>` | A stat of the played persona |

```javascript
// Roll a d20. A 1 halves Health. A 20 adds 1 to Luck.
const roll = Math.floor(Math.random() * 20) + 1;
if (roll === 1) stats.Health.value = stats.Health.value / 2;
if (roll === 20) stats.Luck.value += 1;
return roll;
```

An entity's stat can move a global stat too. This code runs on a stat of The Creature:

```javascript
// The Creature's Rage pushes the world's Alert Level.
stats["Alert Level"].value += owner.stats.Rage.value / 10;
```

Every stat entry on every route takes writes to the same five fields as `self`: `value`, `min`, `max`, `regen` and `hidden`. They work as they do on `self`. A value clamps to the target's range. A bound sets the number now, and later changes move it from there. A min never goes below the authored min. `stats.Health.max = 20` makes the cap 20 now, and a trait that adds 10 later makes it 30. `null` fails the run.

| Rule | What it means |
| --- | --- |
| Owner order, last write wins | Two writes to one field land in owner order, and the later write wins. The order is the global stats first, then the world's entities in the order you authored them, then the library entities in the order the player picked them. The played persona sits in that order like any entity, so a library persona lands last |
| Stat order inside one owner | Writes from one owner's stats land in the order of that owner's stat list. A write through `self` and a write through any route count alike. The target's own box is one of the writers |
| One snapshot per run | Every box of every owner reads the snapshot the run started from. A hub's write to Health isn't in Health's own box on that run, or in its `delta.actual`. It's in Health's `previous` on the next turn |
| Blueprint stats | A Blueprint stat's code runs once for each owner. In it, `owner` is the entity the run is for, and `owner.stats.Mana.value` lands on that owner's own copy of Mana. A write through `stats` lands on the global stat |
| Unknown or switched-off stats | A write to a name the target doesn't have, or to a stat a trait switched off, is ignored and reported. The editor underlines an unknown name |
| An entity not in the game | A write through `entities.<Entity>.stats` to an entity that isn't in the game is ignored and reported |
| Fields that stay read-only | `id`, `name`, `type`, `description`, `previous` and `delta` never take a write, on any route |
| A whole entry | `stats.Health = 5` is ignored. Write `stats.Health.value = 5` |

A stat that a hub moved shows the change on its bar, as any code change does. The turn log gets no new line. A failed or stopped turn rolls the write back with the rest of the turn.

**Test Code** lists each write to another stat, such as `stats.Health.value = 30`, and applies none of them to your world. A write to an entity's stat shows with the owner, the stat, the field and the number. Every target stat starts at its starting value. In a Blueprint stat's box, `owner.stats` holds only the stats of that Blueprint's group.

#### Two Scripts, One Field

The [Test Bench](Test-Bench#issues) warns when more than one box writes the same field of one stat. The finding names the field and each writer's box. A writer on another owner than the target shows with its stat and owner. It shows in **Advanced** mode.

- It counts a box that assigns the field, such as `self.max = 10` or `stats.Health.value -= 5`. It counts the target's own box too. The **Before the AI** and **After the AI** boxes of one stat count as two.
- It doesn't count `return`. A hub that writes `stats.Health.value` and a Health box that only returns a number raise no finding.
- It reads literal names only: `stats.Health.value`, `stats["Health"].value`, `owner.stats.Rage.value`, `entities.Mira.stats.Trust.value` and `self.max`. It skips a computed name such as `stats[name].value`. It skips a variable that holds a stat entry too.
- Two routes that reach one stat count as one target. `owner.stats.Rage.value`, `entities.Creature.stats.Rage.value` and `persona.stats.Rage.value` are one field when they reach the same stat.
- `persona.stats` reaches every entity that the player can play, because the world doesn't know which one the player picks.
- A Blueprint stat's box counts once for each owner. Each owner's own copy of the stat is judged on its own, so two owners don't clash on their own stats. A Blueprint box that writes a global stat's field gets the warning when it has two or more owners (see [A Note on Accumulating Stats](#a-note-on-accumulating-stats)).

A warning isn't an error. Owner order, then stat order, already settles which write wins. The finding shows two boxes that may overwrite each other by mistake.

### Hiding and Showing a Stat
<!-- keywords: reveal a stat, unhide, unlock a stat, show a stat later, secret stat, stat appears mid story, hide a stat, remove from panel, hidden stat, show to the player -->

`hidden` is the stat's **Hidden** setting during play. A hidden stat is off the player's panel, with its change chips and its lines on trait cards. The AI still reads it, and its regen and scripts still run.

```javascript
// A world script: show Rage once Anger reaches 50.
if (!stats.Rage.hidden) return;
if (stats.Anger.value >= 50) {
  stats.Rage.hidden = false;
  player.tell('A new stat: Rage.');
}
```

- **It applies with the other stat writes.** It applies after the run, in run order, so a later write wins. Later in the same run, the entry reads what you set.
- **A During AI Output write waits.** It applies with the After the AI scripts' writes, before those scripts run.
- **A shown stat shows this turn's changes.** It appears with its change chips for this turn.
- **The game adds no notice.** Call `player.tell` or `player.toast` to tell the player.
- **It persists for the playthrough.** The save keeps it, and an undo or a re-roll takes it back with the turn.
- **`previous.hidden` reads the turn start.** Compare it with `hidden` to find the turn that showed the stat.
- **A user Tool can't write it.** The write is ignored and reported, as every user Tool write is.

### Reading This Turn
<!-- keywords: old value, how much it moved, overflow, wasted gain, halve damage, multiply narrator change, before and after, excess past maximum, requested amount -->

Every stat carries the turn's state before the code ran. `previous` holds the full stat, every field `self` has, at the start of the turn. In a Before the AI script the turn has done nothing yet, so `previous` reads as the stat itself and every `delta` below reads zero. This section is about After the AI scripts.

`delta` holds every change the turn made to the stat, by source. Each member has the same four fields: `value`, `min`, `max`, and `regen`. A field that a source cannot move reads `0`.

| Member | What it is |
| --- | --- |
| `delta.ai` | The change the AI asked for, raw: before flags and the range. The AI asks for `value` and `max` only |
| `delta.regen` | What regen did this turn. Only `value` moves |
| `delta.total` | Every source added up: what the turn asked of the stat, before flags and the range |
| `delta.actual` | Current values minus `previous`. A bound a trait changed since the turn started shows here |

`previous` and `delta` are read-only. A write to them is ignored and reported. Together they let a script clamp or scale an ask:

```javascript
// The AI may lower Sanity by at most 10 per turn, and never raise it.
const ask = Math.max(-10, Math.min(0, self.delta.ai.value));
self.value = self.previous.value + ask + self.delta.regen.value;
```

On a turn with no ask, every field of `delta.ai` is `0`.

#### Refunding What a Cap Ate

`total - actual` is what flags and the range took from the turn. A `noIncrease` flag that blocks a gain still shows the gain in `total`, so the loss shows in the difference.

```javascript
// A gain the cap cut off stretches the cap instead.
const lost = self.delta.total.value - self.delta.actual.value;
if (lost > 0 && self.value === self.max) {
  self.max += lost;
  self.value += lost;
}
```

### Placeholders
<!-- keywords: random text variables, nested path, reroll in script, string versus array, release a forced value, macros in scripts, check current wording, characters own variables, wrong type crashes -->

`placeholders` holds the world's own placeholders, by name. A name with a space needs brackets: `placeholders["Hair Color"]`. A placeholder that an entity or a dictionary owns is not in it. Reach that one through its owner (see [Owned Placeholders](#owned-placeholders)). Each entry has:

| Member | What it is |
| --- | --- |
| `id` | Unique identifier. Read-only |
| `name` | The placeholder's name. Read-only |
| `values` | Every authored value as text, in authored order. Values with weight 0 are included |
| `value` | The current value. One text on a Wildcard or a Variable, a list on an Object |
| `text` | `value` as one string: exactly what the prompt sees. A list joins with `", "`. Read-only |
| `roll()` | One draw with the author's weights. The draw is not kept |
| `pin(x)` | Pin the placeholder. Takes what `value` reads on that entry |
| `unpin()` | Remove the pin code set. The next pin in rank, or the roll, applies again |

#### Paths

Code reaches a placeholder the way the editor names it. A placeholder that holds parts carries them as members, to any depth:

```javascript
placeholders.Hair.Shade                          // the Shade that the world's Hair holds
entities.Molly.placeholders.Hair                 // the Hair that Molly owns
entities["Old Molly"].placeholders["Eye Color"]  // brackets, at any depth
```

| You write | You reach |
| --- | --- |
| `placeholders.Hair` | The world's own `Hair` |
| `placeholders.Hair.Shade` | The `Shade` that the world's `Hair` holds |
| `entities.Molly.placeholders.Hair` | Molly's `Hair` |

Each placeholder has one path. A part's bare name doesn't reach it, and neither does an owner's name under `placeholders`.

Each placeholder has all the members above, so a part named `value` or `roll` is shadowed by the member. The editor warns on the part's name field.

#### Owned Placeholders

An entity or a dictionary can own placeholders. Code reaches them only through the owner's entry:

```javascript
entities.Molly.placeholders.Hair       // the Hair that Molly owns
persona.placeholders.Hair              // the played persona's Hair
dictionaries.Weather.placeholders.Sky  // the Sky that the Weather dictionary owns
```

An owned placeholder has the same members as a world placeholder, and `pin` lands on that placeholder. A name the owner doesn't have reads as a blank entry, and a pin through it is ignored. **Test Code** and the Test Bench report it.

#### The three words

`values` is what the author wrote. `value` is the current value. `text` is what the prompt sees.

A Wildcard draws one value, so its `value` is one text and its `text` is that same text. An Object shows every value at once, so its `value` is the list of current values and its `text` joins that list with `", "`. Compare against narration wording with `text`, never with `value`. `text` reads the same on either kind.

```javascript
// Works on either kind: the prompt's own words.
if (placeholders.Hair.text.includes('gray')) self.value -= 1;
```

#### Pinning

`pin(x)` pins the placeholder until the code changes it again. Assigning `value` is equivalent. `pin` is the documented form, and the last of `pin`, `value` or `unpin` in a run wins. The pin ranks above the roll and every other pin and never replaces them, so `unpin()` restores the next pin in rank or the roll. Any text is allowed, on the list or off it:

```javascript
// Mood follows Sanity's band.
placeholders.Mood.pin(self.value < 20 ? 'furious' : self.value < 50 ? 'wary' : 'calm');
```

`pin` takes the type `value` reads. A Wildcard takes one text. An Object takes a list, and one text handed to an Object pins a one-item list:

```javascript
// The prompt then reads "gray, cropped short".
placeholders.Hair.pin(['gray', 'cropped short']);
```

A list handed to a Wildcard, or anything that is not text, **fails the run**, and every write that run made is discarded.

A write to an unknown placeholder name is ignored. **Test Code** and the Test Bench both report it.

### Traits
<!-- keywords: perks, grant ability, status effect, buff, debuff, unlock, boolean flag, check if player has, apply condition, switch had no effect -->

`traits` holds every trait in the world's own trait list, by name, whether the player has it or not. Blueprint items are in it. A trait that an entity owns is not. Each entry has:

| Member | What it is |
| --- | --- |
| `enabled` | True when the player has the trait and it is on. Write it to switch the trait |
| `acquired` | True when the player has the trait, on or off. Read-only |
| `id` | Unique identifier. Read-only |
| `name` | Code name. Read-only |
| `mode` | `'optional'`, `'alwaysOn'` or `'hidden'`. Read-only |
| `available` | True when the trait's requirements hold for its owner now. Read-only |
| `group` | The code name of the trait's group, or `''` when it has none. Read-only |
| `playerToggle` | True when the player can switch the trait during the game. Read-only |

`enabled` and `acquired` read the player's state only. An entity that holds the same trait does not change them. Use `mode`, `available` and `group` to see why a switch had no effect.

Writing `enabled` switches the trait after the run, with the same effect as the player's checkbox. Switching on disables its siblings in an Up to One group. Code never switches an Automatic or Hidden trait, and it ignores pick counts. Switching on a trait the player never took acquires it. The switch persists until the player, the AI, or a later run switches it again. Code ignores **In Game**, so a script can switch a trait the player cannot toggle.

```javascript
// Cursed while Sanity is on the floor.
traits.Cursed.enabled = self.value <= 0;
```

A write to an unknown trait name is ignored. **Test Code** and the Test Bench both report it. A write to `acquired`, or to any other read-only field, is ignored, and **Test Code** says so.

> ℹ️ **A trait name with a placeholder chip in it reads in code as the placeholder's own name.** A trait named `{{Beast}} Fury` is `traits["Beast Fury"]` in every playthrough, whatever the chip rolled. The player still sees the rolled name, and the turn log still writes it.

### Persona
<!-- keywords: hero object, who is being played, main character perks, current player body, nobody chosen, test run ignores it, custom persona, my character, my own character traits, player character trait -->

`persona` is the entity the player plays: the picked persona, or the **Custom Persona** entity when the player picks **None**.

| Member | What it is |
| --- | --- |
| `name` | The persona's code name, never the name the player typed under **None**. Read-only |
| `traits` | The persona's own traits by name, owned or linked |
| `placeholders` | The placeholders the persona owns. See [Owned Placeholders](#owned-placeholders) |
| `stats` | The persona's own stats by name, as an [entity's `stats`](#entities). Entries take writes |

`persona` also has the `id`, `type`, `pronouns`, `inScene`, `location`, `following`, `description`, `summary` and `aliases` of an [entity entry](#entities). `inScene` is always true for the played persona. `location` is where the player is. `following` is always false. Each entry in `persona.traits` has the [same members as a `traits` entry](#traits), for the persona's state. Writing `enabled` switches the persona's own trait by the same rules as `traits`.

```javascript
// Lose a point each turn while the persona is Scarred.
if (persona.traits.Scarred.enabled) self.value -= 1;

// Read the persona's own placeholder.
if (persona.placeholders.Hair.text.includes('gray')) self.value -= 1;
```

`persona.traits` and `traits` are separate. A global trait and a persona trait can share a name, and each map reads its own.

Writing `value`, `min`, `max` or `regen` on an entry in `persona.stats` moves the persona's stat, by the rules in [Writing to Other Stats](#writing-to-other-stats).

When the player plays no entity, `persona` is an empty entry. Its `name` is `''`, every trait reads as off, and a switch or a stat write through it is ignored and reported. Code that reads `persona.traits.X.enabled` never throws. **Test Code** runs with no persona, so it reports each persona write as ignored.

> ⚠️ **Under a library persona, `persona` is the library persona, not the Custom Persona.** Code reaches the **Custom Persona** entity's stats through `entities[...]`, not through `persona`.

> ℹ️ **The editor offers the traits of every entity that can be played.** A library persona can bring traits and placeholders the world doesn't have, so an unknown name after `persona.traits` or `persona.placeholders` is a warning, not an error.

### Entities
<!-- keywords: companion status, is someone nearby, does character exist, invented ones missing, duplicate names, npc, npc traits, companion traits, another character's trait, side character -->

`entities` holds every entity in the game by its code name: the world's cast, the played persona, and the library entities the player added at **Enter World**. A name with a space needs brackets: `entities["Old Mira"]`. Each entry has:

| Member | What it is |
| --- | --- |
| `id` | Unique identifier. Read-only |
| `name` | The entity's code name. Read-only |
| `type` | The entity's type, or `''` when it has none. Read-only |
| `pronouns` | The entity's pronouns, or `''` when it has none. Read-only |
| `inScene` | True when the entity is in this turn's scene. Read-only |
| `location` | The code name of the location the entity is at. A follower reads the player's location. Empty when the entity has no position of its own and is at every location it lists. Read-only |
| `following` | True when the entity follows the player. Read-only |
| `description` | The full AI description, with each placeholder chip filled in. Read-only |
| `summary` | The short AI summary, with each placeholder chip filled in. Read-only |
| `aliases` | The entity's other names, as a list, with each placeholder chip filled in. Read-only |
| `traits` | The entity's own traits by name, owned or linked |
| `placeholders` | The placeholders the entity owns. See [Owned Placeholders](#owned-placeholders) |
| `stats` | The entity's own stats by name. Entries take writes |
| `move()` | Moves the entity to a location. See [Moving Entities](#moving-entities) |
| `follow()` | Makes the entity follow the player |
| `unfollow()` | Stops the entity following the player |
| `diary(line)` | Adds a line to the entity's diary. See [Diary](#diary) |

Each entry in an entity's `stats` has the [same members as a `stats` entry](#stat-properties), `previous` and `delta` included. Code writes `value`, `min`, `max` and `regen` on an entry, by the rules in [Writing to Other Stats](#writing-to-other-stats). A write to any other field is ignored and reported. An entity's stats run every turn, whether or not the entity is in the scene. A stat the entity has switched off reads with `enabled` false, and a write to it is ignored and reported.

Each entry in an entity's `traits` has the [same members as a `traits` entry](#traits), for that entity's state. Writing `enabled` switches the entity's own trait. The other traits in its groups follow, as after a manual switch. A write to any other field is ignored.

```javascript
// Mira's wound costs the party a point each turn.
if (entities.Mira.traits.Wounded.enabled) self.value -= 1;

// Switch Mira's own trait. Her other traits in the group follow.
entities.Mira.traits.Calm.enabled = self.value > 50;

// React while Mira is in the scene.
if (entities.Mira.inScene) self.value += 1;

// Lose a point when Mira's Trust dropped this turn.
if (entities.Mira.stats.Trust.delta.actual.value < 0) self.value -= 1;

// Drain Mira's Stamina when this stat runs dry.
if (self.value <= 0) entities.Mira.stats.Stamina.value -= 10;
```

- `persona` is the played persona's entry, so `persona === entities[persona.name]` when the persona entity has a code name. A persona entity with no code name still plays as `persona`, but it isn't in `entities`.
- An entity's `traits` lists only that entity's own set. A name outside it reads as a blank entry: `enabled` and `acquired` are false, and a switch through it is ignored and reported.
- An entity the narrator invents during the game is not listed. Neither is a persona-only entity the player didn't pick, the **Custom Persona** entity under a world persona, or an entity with no code name.
- Of two entities that share a code name, the later one is the entry. The played persona always keeps its own name.
- An entity's media are not in the entry.
- An entity the game discovered during play is an entry, with every field above.

A name no entity in the game has reads as a blank entry. Its `name` and `id` are `''`, and every trait reads as off. A switch or a stat write through it is ignored and reported. A `move`, `follow`, `unfollow` or `diary` call through it stops the script with an error. A `diary` call first reads the key as an id, then as a name, so `entities[id].diary(line)` works for an id held in a variable. In the World Editor, a `diary` call through an unknown name only warns, because a discovered entity can have that name. Check `entities.Mira.name` to test whether Mira is in the game.

#### Moving Entities
<!-- keywords: move npc, companion joins, follow player, leave party, schedule, patrol, entity location, send away -->

Three calls on an entity's entry set where it stands. Each one works on any entity, whatever its **Movement**.

- **`entities.<Entity>.move("<Location>")`** puts the entity at a location of your world, by id, else by name. A following entity stops following.
- **`entities.<Entity>.follow()`** makes the entity follow the player, at the player's location.
- **`entities.<Entity>.unfollow()`** stops the entity following and leaves it at the player's location. An entity that isn't following stays where it is.

How the calls apply:

- **The writes apply when the turn ends**, after the player's move, the followers and the AI's entity answers. So a script's write beats the AI's answer. Prompts in the same turn read the entities where they stood.
- **Calls apply in call order**, across every script of the turn. The last call on an entity wins.
- **A `move` or a `follow` keeps a position for the entity from then on.** A **Free** entity then stands at one location, not at every listed one.
- **A location your world doesn't have stops the script with an error.** So does the persona, which moves with the player, and a name no entity has.
- **A When a Trait Switches script that runs outside a turn applies none of them.**
- **In suggest mode, a script's write beats a waiting "come along".** The AI may ask an entity to come along, and that entity waits for **Go**. A write on the entity takes it off the wait.

```js
// The wight leaves its tomb once the crown is whole.
if (traits["Crown Restored"].enabled) entities.Wight.move("Barrow Road");

// Albus joins the party when his trust is high enough.
if (entities.Albus.stats.Trust.value >= 50) entities.Albus.follow();
```

**Test Code** lists every authored entity, with no trait chosen and each stat at its starting value. A switch or a stat write it makes is reported and never applied.

### Dictionaries
<!-- keywords: book variables, disabled book, lore owned values -->

`dictionaries` holds every dictionary in the game by its code name. Each entry has:

| Member | What it is |
| --- | --- |
| `id` | Unique identifier. Read-only |
| `name` | The dictionary's code name. Read-only |
| `entries` | The dictionary's entries by name. See [Entries](#entries) |
| `placeholders` | The placeholders the dictionary owns. See [Owned Placeholders](#owned-placeholders) |

```javascript
// The sky follows Sanity's band.
dictionaries.Weather.placeholders.Sky.pin(self.value < 20 ? 'storm' : 'clear');
```

- The list holds the world's dictionaries that the player left on at **Enter World**, then the library dictionaries the player picked there. Of two that share a code name, the later one is the entry.
- A dictionary the player turned off reads as an unknown dictionary.
- A name no dictionary in the game has reads as a blank entry. Its `name` and `id` are `''`, and every placeholder under it reads as blank. A pin through it is ignored.
- The editor warns on a dictionary name it doesn't know, because a library dictionary can bring more.

#### Entries
<!-- keywords: dictionary entries, lorebook entry, entry text, trigger keywords, read an entry, entry value, keys -->

`dictionaries.<Dictionary>.entries` holds the dictionary's entries by entry name. A name with a space needs brackets: `dictionaries.Lore.entries["Old King"]`. Each entry has four fields. All are read-only.

| Field | What it is |
| --- | --- |
| `id` | Unique identifier |
| `name` | The entry's name |
| `keys` | The entry's Trigger Keywords, as a list |
| `value` | The entry's Value, with each placeholder chip filled in |

```javascript
// The lore entry names the king. Use it when the story is quiet.
if (dictionaries.Lore.entries["Old King"].value.includes("exiled")) self.value += 1;
```

- A disabled entry is not listed. A dictionary the player turned off lists none.
- Of two entries with one name in a dictionary, the later one is the entry. An entry with no name has no key.
- A name the dictionary has no entry for reads as a blank entry. Its `id`, `name` and `value` are `''` and `keys` is an empty list.
### Narration
<!-- keywords: rewrite a sentence, sentence hook, during ai output, narration object, narration sentence, sent, buffered, full, index, filter narration, replace words in the story, narration is not defined, error underline on narration -->
<!-- route: worldEditorStat.code -->

`narration` is the narration around the sentence that just completed. It exists in a **During AI Output** script only. In any other timing the name is unknown.

| Member | What it is |
| --- | --- |
| `sentence` | The sentence that just completed. Write it, or return a string, to replace it |
| `sent` | The earlier sentences the reveal already released, as rewritten. A list. Read-only |
| `buffered` | The complete sentences the reveal still holds, already past their scripts. A list. Read-only |
| `full` | The narration as it stands: the earlier sentences as rewritten, then the current sentence and the partial tail as the model wrote them. Read-only |
| `index` | The sentence's position in the reply, from 0. Read-only |

```javascript
// Turn the first mention of "door" in each sentence into a link.
narration.sentence = narration.sentence.replace('door', '[door](https://example.com)');
```

`sentence` must stay a string. Any other type fails the script, and the sentence passes unchanged. The model's original earlier sentences are not in `narration`: `sent` and `full` hold what earlier scripts left.

When the reveal shows sentences in turn, `sent` and `buffered` split where the reveal stands. Otherwise `buffered` is empty and `sent` holds every earlier sentence. A sentence that completes only when the stream ends reads as `buffered`.

**Test Code** reads a sample. The **Sample Sentence** field gives `sentence`. `sent` and `buffered` are empty and `index` is `0`.

### Player
<!-- keywords: ask the player, tell the player, toast, confirm, ask, input, prompt, dialog, choice, pick one, pick several, multiple, text field, question, answer, wait for the player, await, canceled prompt, player is not defined, message that stays in history -->
<!-- route: worldEditorStat.code -->

`player` is the human who plays, not the entity they play. `persona` stays that entity. `player` has five calls. It exists in every timing except **During AI Output**, where a call fails the script.

| Call | Returns | Shows |
| --- | --- | --- |
| `player.tell(text)` | Nothing | A message line under the turn's narration. It stays with the turn in the save and never reaches the AI |
| `player.toast(text)` | Nothing | A toast. It is not saved |
| `player.confirm(question)` | `true` or `false` | The question with two buttons |
| `player.ask(question, options, { multiple })` | The picked value. With `multiple`, a list | Up to four options as buttons, five or more as a dropdown. With `multiple`, toggle buttons and **OK** |
| `player.input(question, placeholder)` | The typed text | The question with a text field and **OK** |

`options` takes text, or `{ label, value }` pairs. The call returns the `value` of the pick. The script waits for the answer with no `await`.

```javascript
// Ask once, when the game starts.
const path = player.ask('Which road do you take?', [
  { label: 'The ridge', value: 'ridge' },
  { label: 'The river', value: 'river' },
]);
placeholders.Route.pin(path);
```

- **Closing a prompt fails the script.** Cancel, or Escape inside the prompt, fails it as canceled. Its writes drop, as on any error. The turn goes on, and the other scripts in the timing still apply.
- **A prompt needs a screen.** With no game screen to answer, `ask`, `confirm` and `input` fail as canceled at once. `tell` and `toast` do nothing.
- **A bad call is a TypeError.** A question that is not text, an `ask` with no options, or an option that is neither text nor `{ label, value }` throws in the script.
- **A multiple pick with nothing chosen** returns an empty list. A single `ask` always returns one value.
- **Prompts show one at a time.** An open prompt holds every other script that prompts, until you answer it. A script that never names `player` is not held.
- **The timeout pauses** while a prompt is open. The one-second limit counts the script's own work.
- **Write `player.` by name.** A script that reaches `player` another way, such as `const p = player;`, fails with "player is not defined".

A message belongs to the turn that runs when the script makes it. A message from At Game Start goes with the opening turn. A message from a trait switch goes with the latest turn on screen. A re-roll of a turn's stats replaces the messages from the timings it replays and keeps the During AI Output ones.

**Test Code** and the **Test Bench** show the real question, one after another, as play does. Editing the code, or closing the editor, closes an open prompt. `tell` and `toast` appear as lines in the report.

### Trait
<!-- keywords: trait that switched, switch script, trait switched on, trait switched off, trait enabled, which trait changed, when a trait switches, trait is not defined, trait read-only, error underline on trait -->
<!-- route: worldEditorStat.code -->

`trait` is the trait that switched, as it stands after the switch. It exists in a **When a Trait Switches** script only. In any other timing the name is unknown. It is read-only: a write to it is an error.

| Member | What it is |
| --- | --- |
| `enabled` | True when the switch turned the trait on. False when it turned the trait off |
| `owner` | The code name of the entity that holds the trait, or `''` for a global trait |

`trait` also has every other member of a [`traits` entry](#traits): `acquired`, `id`, `name`, `mode`, `available`, `group` and `playerToggle`.

```javascript
// A stat or world script sees every switch. Wounded costs 5 Vigor.
if (trait.name === 'Wounded' && trait.enabled) stats.Vigor.value -= 5;
```

A stat or world script sees every switch through `trait`. A trait's own script sees its own switches, with `self` as the trait and `trait` as the same entry.

**Test Code** reads a sample. In a trait's own script, `trait` is that trait. Elsewhere it is the world's first trait in tree order that is on, or a blank one.

### Order of Effects
<!-- keywords: which script wins, priority, precedence, conflict, race condition, execution sequence, overwrite each other, see other scripts changes -->

Each timing is a separate run. Within one run every script reads the same snapshot, so no script sees another script's writes from that run. After each run, effects apply in this order: trait switches, then bounds, then values, then placeholder pins. A bound a stat writes lands at the written number, after the run's trait switches have moved the bounds. When two stats write the same placeholder, trait, or stat field in one run, owner order decides first, then the later stat in the list wins. See [Writing to Other Stats](#writing-to-other-stats).

Each run covers the global stats and every entity's stats over that one snapshot. Writes land in owner order, then stat order within one owner. The last write to a field wins. See [Writing to Other Stats](#writing-to-other-stats) for the order.

The timings are ordered against each other, though: everything a Before the AI script wrote is already in place when an After the AI script reads. An At Game Start script's writes are in place when Before the AI reads, on the opening turn.

### The Story Clock
<!-- keywords: calendar, date, day night cycle, duration, time passed, timer, how long slept, always one hour, in game time -->

`clock` describes the story time. Its fields are read-only: a write to one is ignored and reported. To pass time, call `clock.advance`.

| Field | What it is |
| --- | --- |
| `clock.deltaHours` | Story hours **this turn** consumed |
| `clock.elapsedHours` | Total story hours so far, counting this turn |
| `clock.day` | Day number (1-based) at the **end** of the turn |
| `clock.daypart` | Time of day at the **end** of the turn |
| `clock.hour` | Hour of the day (from 0) at the **end** of the turn |
| `clock.minute` | Minute of the hour (0 to 59) at the **end** of the turn |
| `clock.previous.day` | Day number at the **start** of the turn |
| `clock.previous.daypart` | Time of day at the **start** of the turn |
| `clock.previous.hour` | Hour of the day at the **start** of the turn |
| `clock.previous.minute` | Minute of the hour at the **start** of the turn |

`clock.daypart` and `clock.previous.daypart` are one of six words: `night`, `dawn`, `morning`, `midday`, `afternoon`, `evening`.

**Why start and end are both given.** A turn spans time. An eight-hour sleep that begins at 15:00 has `clock.previous.daypart === 'afternoon'` and `clock.daypart === 'night'`. Neither reading alone describes the turn.

> ⚠️ **With the clock off, `clock.deltaHours` is always the Time Per Turn setting** (`1` unless the player changes it), and every turn advances the story by that much. Your code works either way; it just gets a flat number instead of a measured one. The setting is **Measured Clock**, under [Settings](Settings#time) → **Output** → **Time**, in **Advanced** mode.

#### Passing Time

`clock.advance(<n>)` sets how long the turn takes, in story minutes. It replaces what the AI measured, or the Time Per Turn when the clock is off.

- **Calls add up.** Two scripts that each call `clock.advance(30)` make the turn take one hour.
- **The clock reads the same for the rest of the run.** A call changes the turn, not the `clock` your script reads.
- **The number must be 0 or more.** A negative or non-finite number stops the script with an error, and its writes are dropped.

```js
// A long rest takes eight hours, whatever the AI measured.
if (traits.Resting.enabled) clock.advance(8 * 60);
```

### Turn
<!-- keywords: player action, what the player typed, player input, turn count, turn counter, every fifth turn, ooc, what did the player say -->

`turn` holds what the player did and which turn it is. Its fields are read-only: a write to one is ignored and reported.

| Field | What it is |
| --- | --- |
| `turn.action` | The player's action this turn, without spaces at the ends. OOC square brackets stay in. Images are never in it. |
| `turn.number` | The turn number, on the same scale as `memories[].turn`. The opening turn is `1`. |

- **The opening turn reads the opening.** `turn.action` is the opening text the AI gets: the player's edit, else the drawn opening. An Opening Narration reads `""`.
- **Undo and re-roll rewind it.** A re-rolled turn reads the same action and number it read the first time.
- **A switch the player makes reads an empty action.** Between turns, it reads the number of the last turn that ended; during a turn, that turn's number. Before the opening turn, `turn.number` is `0`.
- **A switch inside a turn reads that turn.** A trait a script or a gate switches reads the same `turn` as the scripts around it.
- **Test Code reads a sample.** Test Code and the Test Bench read `"Look around."` at turn `2`. An At Game Start script reads the world's heaviest Opening Action at turn `1`.

```js
// Every fifth turn the market restocks, unless the player only gave an OOC direction.
if (turn.number % 5 === 0 && !turn.action.startsWith('[')) stats.Stock.value = stats.Stock.max;
```

### Location
<!-- keywords: move player, teleport, change scene, travel, where am i, current place, go to -->

`locations` holds every location of the world by its code name, as `entities` holds the entities. A name with a space needs brackets: `locations["Old Mill"]`. `location` is the entry of the place the turn is at. Both have the same fields. All are read-only.

| Field | What it is |
| --- | --- |
| `id` | Unique identifier |
| `name` | The location's code name |
| `description` | The full AI description, with each placeholder chip filled in |
| `summary` | The short AI summary, with each placeholder chip filled in |
| `starting` | True when the game can start at the location |
| `present` | The [entity entries](#entities) at the location. The persona comes first when the player is there, then the entities in `entities` order. An entity with no position of its own is in `present` at every location it lists |
| `parent` | The code name of the location that holds this one. Empty at the top level |
| `children` | The code names of the locations inside this one, in the editor's order |
| `exits` | The places the AI can move the player to from here, each with a `name` (a code name) and a `hint` (the Connection's travel hint, or empty). It's the same list the AI picks from |

In a world with no location, `location.id` and `location.name` are empty and `location.present` is an empty list. A name the world has no location for reads as a blank entry.

```js
// React while Mira is in the room.
if (location.present.some((e) => e.name === "Mira")) self.value += 1;

// Read another place.
const mill = locations["Old Mill"].summary;

// Walk to a random place the player can reach from here.
const exit = location.exits[Math.floor(Math.random() * location.exits.length)];
if (exit) location.move(exit.name);
```

`location` and its `exits` keep reading where the turn started, even after `location.move` in the same script.

In Test Code and the Test Bench, no entity has a position. Each entity is in `present` at every location it lists, and the persona is at the starting location.

`location.move("<Location>")` moves the turn to a location of your world, by name or id. It replaces the AI's move for that turn, and it needs no path from where the turn is.

- **A Before the AI move lands before the AI writes.** The narration is written at the new place.
- **A During AI Output or After the AI move lands with the turn.**
- **The last move wins.** When several scripts move the turn, the last one in run order decides.
- **A name your world has no location for stops the script with an error.** Its other writes are dropped too, so a typo shows up in Test Code and the Test Bench.

```js
// Falling asleep in the woods wakes you at camp.
if (stats.Energy.value <= 0) location.move("Camp");
```

### Discover
<!-- keywords: new character, add npc, spawn, introduce someone, meet, create entity -->

`discover(<text>)` adds a new entity to the turn, as if the AI had introduced them.

- **`discover("<Name>")`** adds the name to the turn's cast. The AI then describes them, as it does for an entity the narration invents. With **Describe New Characters** off, nothing more happens. See [How to Get Descriptions for New Entities](Entities#how-to-get-descriptions-for-new-entities).
- **`discover("<Name>", "<Description>")`** creates the entity at once with that description, with no AI call.
- **A name that an entity already has does nothing.**
- **The entity goes away when the turn does.** A regenerate or a stopped turn drops it.

### Memory
<!-- keywords: remember, add memory, pin memory, recall, story so far, long-term memory, note -->

`memories` is a list of the story's memories, the rows of the Memory panel, oldest first. It holds the summaries the story keeps and the **Custom** memories. A memory the player deleted is not in it. The list is empty in Test Code and the Test Bench, where no game runs. Two calls add to it. Each takes one line of text.

- **`memories.add(<text>)`** adds a line to this turn's memory, after the AI's summary of the turn. The AI still writes its summary. Recall finds both on later turns when they fit. The line isn't sent with every request.
- **`memories.pin(<text>)`** adds a memory that is sent with every request, as one you write in the Memory Manager is. It shows there under **Custom**, where the player can edit or delete it.
- **Both go away when the turn does.** A regenerate or a stopped turn drops them.

> ℹ️ **A pinned summary can still lose to the memory limit. A pinned line never does.** A summary that `pin()` keeps still competes for the room that the memory limit sets. A line that `memories.pin` adds is sent on every request, whatever the limit.

#### Memory Entries

Each memory in the list has these fields. All are read-only.

| Field | What it is |
| --- | --- |
| `id` | Unique identifier |
| `turn` | The turn number, from 1. A **Custom** memory has the number of the turn before it was added |
| `timestamp` | Story hours at the end of that turn, on the scale of `clock.elapsedHours` |
| `day` | Day number at that time |
| `daypart` | Time of day at that time. It is one of the six `clock.daypart` words |
| `text` | The text as the Memory panel shows it, edits included |
| `custom` | True for a **Custom** memory |
| `kept` | True when the story keeps the memory. Recall can still leave it out of a turn |
| `inContext` | True when the memory went to the AI on the last turn |
| `pinned` | True when the memory is pinned to stay |
| `forgotten` | True when the memory is pinned to go |

Four calls on a memory write to the Memory panel's verdicts. The writes apply when the turn ends. Later calls in the same turn overwrite earlier ones.

| Call | What it does |
| --- | --- |
| `pin()` | Pins the memory to stay, as **Pin This Memory** does |
| `forget()` | Pins the memory to go, as **Forget This Memory** does |
| `edit(text)` | Rewrites the memory, as an edit in the Memory Manager does. A summary keeps its original and is pinned to stay |
| `remove()` | Erases the memory, as **Delete This Memory** does. The player can restore it in the Memory Manager |

- **`pin()` and `forget()` do nothing on a Custom memory.** The run lists each one as ignored. `edit(text)` and `remove()` work on a Custom memory.
- **A verdict, an edit or a removal persists through a rewind**, as the player's does.
- **A World Tool can write a verdict too.** An On Call Tool's verdict applies when the turn ends. An After the AI Tool's verdict applies with the After the AI scripts.

```js
// The vault opened, so the story keeps the fact for good.
if (stats.Keys.value >= 3) memories.pin("The vault under the chapel is open.");

// Pin the newest summary that the story has not kept.
const last = memories.filter((m) => !m.custom).at(-1);
if (last && !last.kept) last.pin();
```

### Notes
<!-- keywords: player notes, notes text, read notes -->

`notes` is the player's notes, as one text. It's empty in Test Code and the Test Bench, where no game runs. It's read-only.

```js
// The player wrote down the password, so the gate opens.
if (notes.includes("swordfish")) traits.GateOpen.enabled = true;
```

### Diary
<!-- keywords: character diary, journal, entity memory, what they remember, first person -->

`entities.<Entity>.diary(<text>)` adds a line to an entity's diary for this turn, after the AI's entry. The call also finds an entity by id: `entities["<id>"].diary(<text>)`. The AI still writes its entry. A diary line reads in the entity's own voice.

- **Any entity in play is a target**, from your world or discovered during play.
- **An entity the game doesn't have stops the script with an error.** The persona has no diary, so `persona.diary` stops the script too.
- **The line goes away when the turn does.** A regenerate or a stopped turn drops it.

```js
if (traits.Betrayed.enabled) entities.Mira.diary("I trusted them, and they sold me out.");
```

### Code Beats the AI
<!-- keywords: who wins, ai overrides, script vs ai, precedence location clock -->

A script's move, advance or discovery wins over the AI's answer for the same turn. Memory and diary lines are the exception: they join the AI's summary and diary entries instead. With no script write, the AI's answer stands as before. Like every script write, each one belongs to its turn: a regenerate or a stopped turn drops it. A stat re-roll keeps the turn's place, time, cast, memories and diary lines.

### Examples
<!-- keywords: sample scripts, cookbook, survival needs, decay over time, combat math, rng, randomness same number, soft cap, copy paste ideas -->

#### Percentage-Based Stat

Calculate a stat as a percentage of another stat:

```javascript
// Make Stamina 75% of Health
const health = stats.Health.value;
return health * 0.75;
```

#### Average of All Stats

Calculate a stat as the average of every stat, iterating with `Object.values`:

```javascript
// Make Morale the average of every global stat, this one included
const all = Object.values(stats);
return all.reduce((sum, stat) => sum + stat.value, 0) / all.length;
```

`stats` holds the global stats in every box, so this code gives the same average on an entity's stat. To average the entity's own stats, iterate `owner.stats` instead:

```javascript
// On an entity's stat: the average of the entity's own stats, this one included
const own = Object.values(owner.stats);
return own.reduce((sum, stat) => sum + stat.value, 0) / own.length;
```

#### Conditional Calculation

Calculate a stat differently based on conditions:

```javascript
// Make Speed depend on Health
// Full speed when Health > 50, otherwise reduced
const health = stats.Health.value;
const baseSpeed = 100;

if (health > 50) {
  return baseSpeed;
} else {
  // Reduce speed by up to 50% as health approaches 0
  const healthPercent = health / 50;
  return baseSpeed * (0.5 + (healthPercent * 0.5));
}
```

#### Complex Formula

Use more complex formulas for game mechanics:

```javascript
// Calculate Damage based on Strength, Weapon Skill, and a random factor
const strength = stats.Strength.value;
const weaponSkill = stats["Weapon Skill"].value;

// Base damage from strength
const baseDamage = strength * 0.8;

// Skill multiplier (1.0 to 2.0 based on skill)
const skillMultiplier = 1.0 + (weaponSkill / 100);

// Random factor (±20%)
const randomFactor = 0.8 + (Math.random() * 0.4);

return baseDamage * skillMultiplier * randomFactor;
```

> 💡 **Each stat's code draws its own `Math.random()` numbers.** The sandbox seeds from the clock, and two stats' code in one turn starts at different times, so two dice stats roll independently.

#### Diminishing Returns

Implement diminishing returns for stat scaling:

```javascript
// Calculate Dodge Chance with diminishing returns
const agility = stats.Agility.value;

// Diminishing returns formula
// First 50 points give full value, after that diminishing returns
let dodgeChance = 0;

if (agility <= 50) {
  dodgeChance = agility * 0.5; // 0.5% per point
} else {
  // First 50 points give 25% dodge
  // Additional points give less and less
  const baseChance = 25;
  const diminishedPoints = agility - 50;
  const diminishedChance = 25 * (1 - Math.exp(-diminishedPoints / 50));
  
  dodgeChance = baseChance + diminishedChance;
}

// Cap at 75%
return Math.min(dodgeChance, 75);
```

#### Drain Per Hour

Scale a change by how long the turn actually took, so a night's sleep costs more than a short conversation:

```javascript
// Thirst rises 2 per story hour
const current = stats.Thirst.value;
return current + (2 * clock.deltaHours);
```

#### Time of Day

React to when the turn happened rather than to another stat:

```javascript
// A vampire's Power climbs at night and fades by day
const current = stats.Power.value;
const rate = (clock.daypart === 'night' || clock.daypart === 'evening') ? 4 : -4;
return current + (rate * clock.deltaHours);
```

#### Resource Consumption

Calculate resource consumption based on other stats:

```javascript
// Calculate Hunger Rate based on activity and size
const activityLevel = stats.Activity.value;
const size = stats.Size.value;

// Base consumption rate
const baseRate = 1;

// Activity multiplier (1.0 to 3.0)
const activityMultiplier = 1.0 + (activityLevel / 50);

// Size factor (larger characters consume more)
const sizeFactor = size / 50;

return baseRate * activityMultiplier * sizeFactor;
```

> 💡 **Prefer the `regen` field for plain regeneration.** A stat that simply drifts at a fixed rate already scales with story hours without any code at all. Use `clock.deltaHours` when the rate itself depends on something: the time of day, another stat, a threshold.

## Best Practices
<!-- keywords: pitfalls, dos and donts -->

1. **Keep it simple**: Complex code can be hard to debug and may impact performance
2. **Trust the zero default**: a stat name not in the world reads as a blank entry, every number `0`, so a lookup never throws
3. **Stay within min/max**: The system will automatically clamp your result to the stat's min/max range
4. **Avoid infinite loops**: Do not create circular dependencies between stats
5. **Write only what you mean to change**: A field, placeholder, or trait you leave alone keeps the turn's own result
6. **Test your code**: Use the box's own "Test Code" button to validate that box before saving
7. **Pick the right timing**: put a write the AI should read this turn in **Before the AI**, and a reaction to what the AI asked in **After the AI**. Use **At Game Start** for a one-time setup, and **When a Trait Switches** for an effect that follows a gain or a loss
8. **Add comments**: Document your code for future reference

## Limitations
<!-- keywords: not allowed, fetch from internet, http request, freeze or hang, double counting, counter that increments, regenerate adds twice -->

- Code execution has a timeout of 1 second to prevent infinite loops
- The code cannot access external resources (network, files, etc.)
- Circular dependencies between stats may cause unexpected behavior
- The code runs in a sandboxed environment with limited JavaScript features
- Code writes `value`, `min`, `max` and `regen` only. Every other field of a stat entry is read-only on every route
- A write to an entity that isn't in the game, to an unknown stat, or to a stat a trait switched off is ignored and reported
- **Test Code** runs one box with no player traits, so it cannot preview a long turn or a different daypart. After the AI runs as a one-hour turn on day one. Every other timing runs as the opening turn, where `clock.deltaHours` and `clock.elapsedHours` are both `0`. It shows a trait switch and never applies it to the world
- Each box's **Templates** menu lists only the templates that work at that box's timing

### A Note on Accumulating Stats

Most scripts are **formulas**: it reads other stats and returns an answer, and running it twice gives the same result. Code that adds to its own current value (`return current + …`) is a **running total**. It depends on running exactly once per turn.

Formamorph runs it once per turn. A re-roll of a turn's stat changes runs it again by design: the re-roll rebuilds the turn from its starting values, so the total is not counted twice. A running total is more fragile than a formula. Prefer a formula where one will do.

**A Blueprint stat's write to a global stat moves the stat once, not once for each owner.** The code runs once for each owner, but every run reads one snapshot. Two owners that each write `stats.Alert.value += 5` both write the snapshot's Alert plus 5. The later write wins, so Alert rises by 5, not by 10. To count each owner, write to `owner.stats`, where each owner has its own copy. The [Test Bench](Test-Bench#issues) warns on a Blueprint box that writes a global stat's field when two or more owners run it.

## Troubleshooting
<!-- keywords: no effect, value never changes, nan, silent failure, checklist, capital letters matter, ignored writes -->

If your code does not work as expected:

1. Check for typos in stat, placeholder, and trait names (they are case-sensitive)
2. Ensure your code returns a number, or writes a field instead
3. Verify that every stat you reference exists
4. Use the "Test Code" button to see any error messages, every field, placeholder, and trait the run wrote, and every write it ignored
5. Add `console.log()` statements to debug your code (output appears in browser console)

## Advanced Examples
<!-- keywords: rpg attributes, hp per level, leveling up, exhaustion, tiredness, encumbrance, inventory weight, spell strength, dnd style -->

### Stat Scaling with Level

```javascript
// Scale Health based on Level and Constitution
const level = stats.Level.value;
const constitution = stats.Constitution.value;

// Base health
const baseHealth = 50;

// Level scaling (10 health per level)
const levelBonus = (level - 1) * 10;

// Constitution scaling (2 health per point)
const constitutionBonus = (constitution - 10) * 2;

return baseHealth + levelBonus + constitutionBonus;
```

### Fatigue System

```javascript
// Calculate Fatigue based on recent actions and Stamina
const stamina = stats.Stamina.value;
const staminaMax = stats.Stamina.max;
const actions = stats["Recent Actions"].value;

// Base fatigue from actions
const actionFatigue = actions * 5;

// Recovery from stamina (higher stamina = less fatigue)
const staminaFactor = 1 - (stamina / staminaMax);

// Final fatigue value (0-100)
return Math.min(actionFatigue * staminaFactor, 100);
```

### Carrying Capacity

```javascript
// Calculate Carrying Capacity based on Strength
const strength = stats.Strength.value;

// Base capacity
const baseCapacity = 50;

// Linear scaling for first 50 points (2 units per point)
let capacity = baseCapacity;
if (strength <= 50) {
  capacity += strength * 2;
} else {
  // First 50 points add 100 capacity
  // After that, diminishing returns
  capacity += 100;
  capacity += Math.sqrt(strength - 50) * 10;
}

return capacity;
```

### Magical Power

```javascript
// Calculate Magical Power based on Intelligence, Wisdom, and current Mana
const intelligence = stats.Intelligence.value;
const wisdom = stats.Wisdom.value;
const mana = stats.Mana.value;
const maxMana = stats.Mana.max;

// Base power from intelligence
const basePower = intelligence * 1.5;

// Wisdom bonus (diminishing returns)
const wisdomBonus = Math.sqrt(wisdom) * 5;

// Mana percentage factor (more effective with higher mana)
const manaFactor = 0.5 + (0.5 * (mana / maxMana));

return (basePower + wisdomBonus) * manaFactor;
```
