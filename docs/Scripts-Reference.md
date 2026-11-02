# 🧮 Scripts Reference
<!-- keywords: script api, sandbox api, script objects, globals, members, fields, what a script reads, what a script writes, stat code reference, cheat sheet -->

This page lists every object a script reads and writes. The [Scripts Guide](ScriptsGuide) covers how to add a script, pick its timing and test it.

## Quick Reference
<!-- keywords: cheat sheet, api, syntax, members, fields, properties, objects, globals, what can code read, what can code write, how to access, dot notation, available variables, narration fields, player calls -->

A script can use only these objects. In the table, a word in angle brackets is a name from your world, `<n>` is a number, and `<text>` is text. A name with a space needs brackets: `stats["<Stat>"]`.

| Object | Members | Read | Write |
| --- | --- | --- | --- |
| `self` | `id`, `name`, `type`, `description`, `enabled`, `min`, `max`, `value`, `regen`, `hidden`, `descriptor`, `previous`, `delta` | `self.value` | `self.value = <n>` |
| `stats` | `id`, `name`, `type`, `description`, `enabled`, `min`, `max`, `value`, `regen`, `hidden`, `descriptor`, `previous`, `delta` | `stats.<Stat>.value` | `stats.<Stat>.value = <n>` |
| `owner` | `id`, `name`, `type`, `pronouns`, `inScene`, `met`, `location`, `following`, `description`, `summary`, `aliases`, `traits`, `placeholders`, `stats`, `items`, `body`, `move()`, `follow()`, `unfollow()`, `meet()`, `diary()` | `owner.stats.<Stat>.value` | `owner.stats.<Stat>.value = <n>` |
| `clock` | `day`, `daypart`, `hour`, `minute`, `deltaHours`, `elapsedHours`, `previous`, `advance()` | `clock.day` | `clock.advance(<n>)` |
| `turn` | `action`, `number`, `narration`, `choices` | `turn.number` | `turn.choices = [<text>]`, After the AI only |
| `locations` | `id`, `name`, `description`, `summary`, `starting`, `present`, `parent`, `children`, `exits`, `items` | `locations.<Location>.present` | Read-only |
| `location` | `id`, `name`, `description`, `summary`, `starting`, `present`, `parent`, `children`, `exits`, `items`, `move()` | `location.name` | `location.move("<Location>")` |
| `discover` | — | — | `discover(<text>)` |
| `memories` | `id`, `turn`, `timestamp`, `day`, `daypart`, `text`, `custom`, `kept`, `inContext`, `pinned`, `forgotten`, `add()`, `pin()`, `forget()`, `edit()`, `remove()` | `memories.length` | `memories.pin(<text>)` |
| `notes` | — | `notes` | Read-only |
| `traits` | `enabled`, `acquired`, `id`, `name`, `mode`, `available`, `group`, `playerToggle` | `traits.<Trait>.enabled` | `traits.<Trait>.enabled = true` |
| `persona` | `id`, `name`, `type`, `pronouns`, `inScene`, `met`, `location`, `following`, `description`, `summary`, `aliases`, `traits`, `placeholders`, `stats`, `items`, `body` | `persona.traits.<Trait>.enabled` | `persona.traits.<Trait>.enabled = true` |
| `entities` | `id`, `name`, `type`, `pronouns`, `inScene`, `met`, `location`, `following`, `description`, `summary`, `aliases`, `traits`, `placeholders`, `stats`, `items`, `body`, `move()`, `follow()`, `unfollow()`, `meet()`, `diary()` | `entities.<Entity>.stats.<Stat>.value` | `entities.<Entity>.traits.<Trait>.enabled = true` |
| `placeholders` | `id`, `name`, `value`, `values`, `text`, `roll()`, `pin()`, `unpin()` | `placeholders.<Placeholder>.text` | `placeholders.<Placeholder>.pin(<text>)` |
| `dictionaries` | `id`, `name`, `enabled`, `entries`, `placeholders` | `dictionaries.<Dictionary>.enabled` | `dictionaries.<Dictionary>.enabled = true` |
| `items` | `id`, `name`, `unidentifiedName`, `unidentifiedDescription`, `placeholders`, `copies`, `give()` | `items.<Item>.copies.length` | `items.<Item>.give(persona)` |
| `currencies` | `id`, `name`, `kind`, `balance()`, `pay()` | `currencies.<Currency>.balance(persona)` | `currencies.<Currency>.pay(persona, null, <n>)` |
| `console` | `log()` | — | `console.log(<text>)` |

A timing adds one name to those objects. A script reads only the name its own timing adds:

| Name | Timing | Members | Read | Write |
| --- | --- | --- | --- | --- |
| **`narration`** | During AI Output only | `sentence`, `sent`, `buffered`, `full`, `index` | `narration.sentence` | `narration.sentence = <text>` |
| **`player`** | Every timing but During AI Output | `tell()`, `toast()`, `confirm()`, `ask()`, `input()` | `player.confirm(<text>)` | Calls, not writes |
| **`trait`** | When a Trait Switches only | `enabled`, `acquired`, `id`, `name`, `mode`, `available`, `group`, `playerToggle`, `owner` | `trait.enabled` | Read-only |

A [World Tool](ScriptsGuide#world-tools)'s script also reads `args`, the values the AI sent, such as `args.<Parameter>`. It is read-only.

Follow these rules:

- **A stat compares through `.value`.** Write `stats.<Stat>.value > <n>`. `stats.<Stat>` and `self` alone are whole entries, not numbers.
- **A trait switches through `.enabled`.** Write `traits.<Trait>.enabled = true`. The editor underlines `traits.<Trait> = true`.
- **A trait is under its owner.** `traits` holds the global traits only. A trait on the entity that owns the stat is under `owner.traits`. A trait on the played persona is under `persona.traits`. A trait on another entity is under `entities.<Entity>.traits`. That includes the Custom Persona while a library persona plays.
- **`stats` is the global stats in every box.** It means the same in an entity's scripts as in a global stat's scripts, as `traits` does. It never holds the entity's own stats.
- **An entity's scripts read the entity's own stats through `owner.stats`.** `owner` is the entity that owns the running stat, so `owner.stats.<Stat>.value` is the entity's own stat. In a Blueprint stat's script, `owner` is the entity the run is for. In a global stat's script, `owner` is an empty entry: reads are blank, and a write is ignored and reported.
- **Another entity's stats are under `entities.<Entity>.stats`.** The played persona's are under `persona.stats`.
- **"After N days" is `clock.day > <n>`.** `clock.day` starts at 1. For timing in hours, use `clock.elapsedHours`. The time of day is `clock.daypart`.
- **`self` and every `stats` entry take writes to `value`, `min`, `max`, `regen` and `hidden`.** So does every stat entry under `owner.stats`, `entities.<Entity>.stats` and `persona.stats`. Their other fields are read-only.
- **A name that its timing does not add is unknown.** The editor underlines `narration` in a Before the AI script, and `player` in a During AI Output script, as errors. A `narration` read fails the run with "not defined". A `player` call in During AI Output throws "can't run in During AI Output".

## Writing Scripts

### Basic Syntax
<!-- keywords: what language, first script, minimal example, is return required, fixed number -->

Your code is plain JavaScript. Return a number to set the stat's value. The code reads these names:

- `stats`: a map of the global stats, keyed by name
- `self`: the stat the code belongs to
- `owner`: the entity that owns the stat. It is empty for a global stat. In a Blueprint stat, it is the entity the run is for (see [Owner](#owner))

```javascript
// Example: Return a fixed value
return 50;
```

A return value is optional. A script that only writes `self.min`, `self.max`, `self.regen`, `self.hidden`, a placeholder or a trait leaves the value to the AI and regen.

### Self
<!-- keywords: this stat, the running stat, own value, own entry, current stat, self name, self value -->
<!-- route: worldEditorStat.code -->

`self` is the stat the code belongs to, in every box. It has the [same members as a `stats` entry](#stat-properties).

- In a global stat's code, it is the same entry as `stats.<own name>`.
- In an entity stat's code, it is the same entry as `owner.stats.<own name>`.

Five of its fields take writes (see [Writing to `self`](#writing-to-self)).

### Stats
<!-- keywords: global stats, stats map, stats object, all stats, other stats, read a stat, stat by name, stats in an entity's code, loop over stats -->
<!-- route: worldEditorStat.code -->

`stats` is a map of the global stats, keyed by name, in every box. An entity's scripts get the same map as a global stat's scripts, as with `traits`. It never holds the entity's own stats. Those are under `owner.stats`.

Each entry has the [same members as `self`](#stat-properties). Each entry takes writes to `value`, `min`, `max`, `regen` and `hidden` (see [Writing to Other Stats](#writing-to-other-stats)). To read a stat by name, see [Accessing Other Stats](#accessing-other-stats).

### Owner
<!-- keywords: own stats, read the entity's other stats, script on a monster's stat, this entity, entity's own stat, self entity, creature code, npc code, blueprint owner, empty owner, owner is blank, owner stats, owner traits, owner placeholders -->
<!-- route: worldEditorStat.code -->

`owner` is the entity that owns the running stat. It has the same members as an [entity entry](#entities): `id`, `name`, `type`, `pronouns`, `inScene`, `met`, `location`, `following`, `description`, `summary`, `aliases`, `traits`, `placeholders`, `stats`, `items`, `body`, `move()`, `follow()`, `unfollow()`, `meet()` and `diary()`.

The entity's own stats are under `owner.stats`, its own traits under `owner.traits`, and its own placeholders under `owner.placeholders`.

| Box | What `owner` is |
| --- | --- |
| A stat on an entity's **Stats** tab | That entity |
| A Blueprint stat | The entity the run is for. The code runs once for each owner |
| A global stat | An empty entry |

In an entity stat's code, `self` is the same entry as `owner.stats.<own name>`. A write through either path is one write.

```javascript
// On a stat of The Creature: the Creature's Rage grows while it is Hunted.
if (owner.traits.Hunted.enabled) owner.stats.Rage.value += 2;
```

In a global stat's box, `owner` is empty:

- A read through `owner` never throws. Every read is blank, and every trait reads as off.
- A field write through it is ignored and reported.
- A `move`, `follow`, `unfollow`, `meet` or `diary` call on it stops the script with an error. In the World Editor, a `diary` call only warns.

> ℹ️ **Two entities can share a code name.** The later one is the entry in `entities`. `owner` is still the owner's own entry, so a same-name entity never shadows it.

### Accessing Other Stats
<!-- keywords: reference another, dot notation, square brackets, misspelled name, undefined, get hp, missing gives zero, randomized names -->
<!-- route: codeRename -->

Read another stat by its name:

```javascript
// Example: Return the value of another stat
const health = stats.Health.value;
return health;
```

A name with a space needs brackets: `stats["Hit Points"].value`. An unknown name reads as a blank entry, with every number `0` and `enabled` false. A typo never throws.

In an entity's script, read the entity's own stats through `owner.stats`. Read another entity's stats through `entities.<Entity>.stats`:

```javascript
// In a script of The Creature's stat: read a global stat and the Creature's own stat.
const alert = stats["Alert Level"].value;
return owner.stats.Rage.value + alert / 2;
```

You can rename a stat, a trait, a placeholder or a location that code names. The **Update Code References** dialog then asks whether to change the name in that code too:

- **Update Code** changes the name in that code.
- **Leave Code** keeps the code as it is.

> ℹ️ **In code, a placeholder chip in a stat name reads as the placeholder's own name.** A stat named `{{Beast}} Power` is `stats["Beast Power"]` in every playthrough, whatever the chip rolled. The player still sees the rolled name.

### Stat Properties
<!-- keywords: attributes, members, api reference, object shape, what can i read, disabled stat, hidden by perk, descriptors unavailable -->

Each stat in the `stats` map has these properties, `self` included. So does each stat under `owner.stats`, `entities.<Entity>.stats` and `persona.stats`:

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
| `descriptor` | Text of the band the value falls in, with chips filled in, as the AI reads it. Empty when no band applies. Read-only |
| `previous` | The full stat at the start of the turn: `id`, `name`, `type`, `description`, `min`, `max`, `value`, `regen`, `hidden`, `descriptor`. Read-only |
| `delta` | Every change this turn made, by source: `ai`, `regen`, `total`, `actual`. Read-only |

A stat that a trait switched off still reads as a real entry. Its name, value and bounds read as usual, with `enabled` false. A write to it is ignored and reported.

When two stats share a code name, the name resolves to the stat that is on. Between two stats in the same state, it resolves to the later one.

> ℹ️ The sandbox gets only these fields. A stat's own `code` and its list of bands are **not** available in a script. `descriptor` gives the one band that applies now.

How `descriptor` reads:

- 📏 It uses the same thresholds the AI's stat context uses, raw or percent.
- ⏱️ It reads the band at the start of the run. A write to `self.value` doesn't change it until the next run.
- 👁️ It reads the band whatever the player's display settings, and on a stat a trait switched off.
- ↩️ `previous.descriptor` reads the band at the start of the turn, with the placeholder pins of that time. So `self.previous.descriptor !== self.descriptor` is true on a turn whose change crossed a band.
- 🧪 In **Test Code** and the **Test Bench**, chips read as you wrote them.

### Writing to `self`
<!-- keywords: raise the ceiling, upper limit, lower limit, regeneration rate, assign, modify own stat, underlined write, scale with level up, this keyword -->

`self` is the stat the code belongs to.

- In a global stat's code, it is the same entry as the one in `stats`. `self.value` and `stats[self.name].value` read the same.
- In an entity stat's code, it is the same entry as the one in `owner.stats`. `self.value` and `owner.stats[self.name].value` read the same.

A write through either path is one write. Five of its fields take writes:

| Write | Effect |
| --- | --- |
| `self.value = n` | Sets the value this turn, clamped to the range. Same as `return n` |
| `self.min = n` | Sets the floor to `n` now, but never below the authored min. Later changes apply from `n` |
| `self.max = n` | Sets the cap to `n` now. Later changes apply from `n` |
| `self.regen = n` | Sets regen per story hour to `n` now. Later changes apply from `n` |
| `self.hidden = true` | Hides the stat from the player. `false` shows it. See [Hiding and Showing a Stat](#hiding-and-showing-a-stat) |

A field you do not write keeps what the turn gave it. So a script can set the cap and leave the value to the AI:

```javascript
// Max grows with Level. The value still moves as the AI narrates.
const level = stats.Level.value;
self.max = 50 + level * 10;
```

A bound write works like a value write. After `self.max = 20`, the cap reads 20 when the run's writes apply, whatever a trait switch in the same run changed. Every later change applies from 20:

| Later change | Effect on the cap |
| --- | --- |
| A trait that adds 10 to the max switches on | 30 |
| That trait switches off again | 20 |
| The AI raises the max by 5 | 25 |
| The code writes `self.max = 40` | 40 |

- No code bound hides the traits or the AI under it.
- Deleted code leaves the bounds as they are.
- A `null` write to `value`, `min`, `max` or `regen` fails the run, as any other non-number does.
- A write to `hidden` of anything but `true` or `false` fails the run.
- Every other field of `self` is read-only.

To write a stat other than `self`, see [Writing to Other Stats](#writing-to-other-stats).

### Writing to Other Stats
<!-- keywords: move another stat, change another stat, hub stat, one event many stats, write stats map, damage health from a roll, raise luck on a twenty, cap another stat, change another stat's max, change another stat's regen, change an entity's stat, drain an npc, push a global stat from an entity's code, cross-owner write, owner order, entity's own stats, npc stat code, two scripts write one stat, which write wins, order of stats, last write wins, target does not see the write, blueprint stat code, each owner's copy, two writers warning, two boxes write one field -->
<!-- route: worldEditorStat.code -->

Code can write any stat in the game, through the path that resolves to it. One box can set several stats, so an event needs no reaction code in each target stat. A stat whose code writes other stats is a hub.

| Path | Resolves to |
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

Each run draws its own random numbers, so two scripts in one turn never repeat each other's `Math.random()`.

An entity's stat can set a global stat too. This code runs on a stat of The Creature:

```javascript
// The Creature's Rage pushes the world's Alert Level.
stats["Alert Level"].value += owner.stats.Rage.value / 10;
```

Every stat entry on every path takes writes to the same five fields as `self`: `value`, `min`, `max`, `regen` and `hidden`. They work as they do on `self`:

- A value clamps to the target's range.
- A bound sets the number now, and later changes apply from there. `stats.Health.max = 20` makes the cap 20 now. A trait that adds 10 later makes it 30.
- A min never goes below the authored min.
- `null` fails the run.

| Rule | What it means |
| --- | --- |
| Scripts tab order | Writes apply in the order of the **Scripts** tab, and a later write to a field replaces an earlier one. A Blueprint script's row runs for all its owners, one after another. A library entity's scripts run after every row, in the order the player picked them |
| Stat order inside one owner | With no **order** set, one owner's stats run in the order of that owner's stat list. A write through `self` and a write through any other path count the same. The target's own box is one of the writers |
| Each script reads the one before it | If Health is lower in the list than a hub, Health's own script reads the hub's write on the same turn, in `value` and `delta.actual`. If Health is higher, its script reads the write on the next turn |
| Blueprint stats | A Blueprint stat's code runs once for each owner. In it, `owner` is the entity the run is for, and `owner.stats.Mana.value` sets that owner's own copy of Mana. A write through `stats` sets the global stat |
| Unknown or switched-off stats | A write to an unknown name, or to a stat a trait switched off, is ignored and reported. The editor underlines an unknown name |
| An entity not in the game | A write through `entities.<Entity>.stats` to an entity that is not in the game is ignored and reported |
| Fields that stay read-only | `id`, `name`, `type`, `description`, `descriptor`, `previous` and `delta` are read-only on every path |
| A whole entry | `stats.Health = 5` is ignored. Write `stats.Health.value = 5` |

A stat that a hub set shows the change on its bar, as with any code change. The turn log gets no new line. A failed or stopped turn rolls the write back with the rest of the turn.

**Test Code** lists each write to another stat, such as `stats.Health.value = 30`. It applies none of them to your world.

- A write to an entity's stat shows with the owner, the stat, the field and the number.
- Every target stat starts at its starting value.
- In a Blueprint stat's box, `owner.stats` holds only the stats of that Blueprint's group.

#### Two Scripts, One Field

The [Test Bench](Test-Bench#issues) warns when more than one box writes the same field of one stat. The warning shows in **Advanced** mode. The finding names the field and each writer's box, in the order of the **Scripts** tab. Each script reads what the one before it wrote. A writer whose owner is not the target's owner shows with its stat and owner.

- It counts a box that assigns the field, such as `self.max = 10`, `stats.Health.value -= 5` or `stats.Health.value++`. It counts the target's own box too.
- It compares scripts of one timing only. A **Before the AI** box and an **After the AI** box that write one field raise no finding.
- It counts world scripts and trait scripts as writers, as well as stat boxes. It skips a target stat that is off.
- It doesn't count `return`. A hub that writes `stats.Health.value` and a Health box that only returns a number raise no finding.
- It reads literal names only: `stats.Health.value`, `stats["Health"].value`, `owner.stats.Rage.value`, `entities.Mira.stats.Trust.value` and `self.max`. It skips a computed name, such as `stats[name].value`. It also skips a variable that holds a stat entry.
- Two paths that resolve to one stat count as one target. `owner.stats.Rage.value`, `entities.Creature.stats.Rage.value` and `persona.stats.Rage.value` are one field when they resolve to the same stat.
- `persona.stats` resolves to every entity that the player can play, because the world does not know which one the player picks.
- A Blueprint stat's box counts once for each owner. The check reads each owner's own copy of the stat separately, so two owners do not clash on their own stats. A Blueprint box that writes a global stat's field gets the warning when it has two or more owners (see [A Note on Accumulating Stats](ScriptsGuide#a-note-on-accumulating-stats)).

A warning is not an error. The finding shows who writes a field and in what order, so you can check how the writes stack. Drag the rows in the **Scripts** tab to change the order.

### Hiding and Showing a Stat
<!-- keywords: reveal a stat, unhide, unlock a stat, show a stat later, secret stat, stat appears mid story, hide a stat, remove from panel, hidden stat, show to the player -->

`hidden` is the stat's **Hidden** setting during a game. A hidden stat is not on the player's panel. Its change chips and its lines on trait cards are hidden too. The AI still reads it, and its regen and scripts still run.

```javascript
// A world script: show Rage once Anger reaches 50.
if (!stats.Rage.hidden) return;
if (stats.Anger.value >= 50) {
  stats.Rage.hidden = false;
  player.tell('A new stat: Rage.');
}
```

- **It applies with the other stat writes.** It applies after the script, and a later write wins. Later in the same script, and in later scripts, the entry reads what you set.
- **A During AI Output write waits.** It applies with the writes of the After the AI scripts, before those scripts run.
- **A shown stat shows this turn's changes.** It appears with its change chips for this turn.
- **The game adds no notice.** To tell the player, call `player.tell` or `player.toast`.
- **It persists for the playthrough.** The save keeps it. An undo or a re-roll reverts it with the turn.
- **`previous.hidden` reads the turn start.** Compare it with `hidden` to find the turn that showed the stat.
- **A user Tool cannot write it.** The write is ignored and reported, as is every user Tool write.

### Reading This Turn
<!-- keywords: old value, how much it moved, overflow, wasted gain, halve damage, multiply narrator change, before and after, excess past maximum, requested amount -->

This section is about After the AI scripts. Every stat has the turn's state from before the code ran:

- `previous` holds the stat's fields at the start of the turn (see the `previous` row in [Stat Properties](#stat-properties)).
- `delta` holds every change the turn made to the stat, by source.

In a Before the AI script, the AI and regen have done nothing yet. `previous` reads as the stat when the timing began, and `delta.ai`, `delta.regen` and `delta.total` read zero. `delta.actual` holds what earlier scripts wrote.

Each `delta` member has the same four fields: `value`, `min`, `max` and `regen`. A field that a source cannot change reads `0`.

| Member | What it is |
| --- | --- |
| `delta.ai` | The change the AI asked for, raw: before flags and the range. The AI asks for `value` and `max` only |
| `delta.regen` | What regen did this turn. Only `value` changes |
| `delta.total` | Every source added up: what the turn asked of the stat, before flags and the range |
| `delta.actual` | Current values minus `previous`. A bound a trait changed since the turn started shows here |

`previous` and `delta` are read-only. A write to them is ignored and reported. With both, a script can clamp or scale an ask:

```javascript
// The AI may lower Sanity by at most 10 per turn, and never raise it.
const ask = Math.max(-10, Math.min(0, self.delta.ai.value));
self.value = self.previous.value + ask + self.delta.regen.value;
```

On a turn with no ask, every field of `delta.ai` is `0`.

#### Refunding What a Cap Ate

`total - actual` is what flags and the range removed from the turn. A `noIncrease` flag that blocks a gain still shows the gain in `total`, so the loss shows in the difference.

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

`placeholders` holds the world's own placeholders, by name. A name with a space needs brackets: `placeholders["Hair Color"]`. A placeholder that an entity, a dictionary or an item owns is not in it. Read that one through its owner (see [Owned Placeholders](#owned-placeholders)). Each entry has:

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

A placeholder's path in code follows the name the editor shows. A placeholder that holds parts has them as members, to any depth:

```javascript
placeholders.Hair.Shade                          // the Shade that the world's Hair holds
entities.Molly.placeholders.Hair                 // the Hair that Molly owns
entities["Old Molly"].placeholders["Eye Color"]  // brackets, at any depth
```

| Path | Resolves to |
| --- | --- |
| `placeholders.Hair` | The world's own `Hair` |
| `placeholders.Hair.Shade` | The `Shade` that the world's `Hair` holds |
| `entities.Molly.placeholders.Hair` | Molly's `Hair` |

Each placeholder has one path. A part's bare name does not resolve to it. An owner's name under `placeholders` does not either.

Each placeholder has all the members above, so the member shadows a part named `value` or `roll`. The editor warns on the part's name field.

#### Owned Placeholders

An entity, a dictionary or an item can own placeholders. Code reads them only through the owner's entry:

```javascript
entities.Molly.placeholders.Hair       // the Hair that Molly owns
persona.placeholders.Hair              // the played persona's Hair
dictionaries.Weather.placeholders.Sky  // the Sky that the Weather dictionary owns
items.Lamp.placeholders.Glow           // the Glow that the Lamp item owns
```

An owned placeholder has the same members as a world placeholder, and `pin` pins that placeholder. A name the owner does not have reads as a blank entry, and a pin through it is ignored. **Test Code** and the **Test Bench** report it.

#### The three words

`values` is what the author wrote. `value` is the current value. `text` is what the prompt sees.

- **A Wildcard** draws one value. Its `value` is one text, and its `text` is that same text.
- **An Object** shows every value at once. Its `value` is the list of current values, and its `text` joins that list with `", "`.

To compare with narration wording, use `text`, never `value`. `text` reads the same on either kind.

```javascript
// Works on either kind: the prompt's own words.
if (placeholders.Hair.text.includes('gray')) self.value -= 1;
```

#### Pinning

`pin(x)` pins the placeholder until the code changes it again.

- An assignment to `value` does the same. `pin` is the documented form.
- In one run, the last of `pin`, `value` or `unpin` wins.
- The pin ranks above the roll and every other pin, and never replaces them. So `unpin()` restores the next pin in rank, or the roll.
- Any text is allowed, on the list or not:

```javascript
// Mood follows Sanity's band.
placeholders.Mood.pin(self.value < 20 ? 'furious' : self.value < 50 ? 'wary' : 'calm');
```

`pin` takes the type that `value` reads. A Wildcard takes one text. An Object takes a list. One text passed to an Object pins a one-item list:

```javascript
// The prompt then reads "gray, cropped short".
placeholders.Hair.pin(['gray', 'cropped short']);
```

A number pins as its text. Two values **fail the run**: a list passed to a Wildcard, and anything that is not text or a number. Every write that run made is discarded.

An assignment to the whole entry pins too: `placeholders.Mood = 'calm'` is `placeholders.Mood.pin('calm')`. For a stat, a whole-entry write such as `stats.Health = 5` is ignored.

A write to an unknown placeholder name is ignored. **Test Code** and the **Test Bench** both report it.

### Traits
<!-- keywords: perks, grant ability, status effect, buff, debuff, unlock, boolean flag, check if player has, apply condition, switch had no effect -->

`traits` holds every trait in the world's own trait list, by name, whether the player has it or not. Blueprint items are in it. A trait that an entity owns is not in it. Each entry has:

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

`enabled` and `acquired` read the player's state only. An entity that holds the same trait does not change them. To see why a switch had no effect, read `mode`, `available` and `group`.

A write to `enabled` switches the trait after the run, with the same effect as the player's checkbox:

- A switch on turns off the trait's siblings in an Up to One group.
- Code never switches an Automatic or Hidden trait. It ignores pick counts.
- A switch on of a trait the player never took acquires it.
- The switch persists until the player, the AI or a later run switches it again.
- Code ignores **In Game**, so a script can switch a trait that the player cannot switch.
- A write of anything but `true` or `false` to `enabled` fails the run.

```javascript
// Cursed while Sanity is on the floor.
traits.Cursed.enabled = self.value <= 0;
```

A write to an unknown trait name is ignored. **Test Code** and the **Test Bench** both report it. A write to `acquired`, or to any other read-only field, is ignored, and **Test Code** says so.

> ℹ️ **In code, a placeholder chip in a trait name reads as the placeholder's own name.** A trait named `{{Beast}} Fury` is `traits["Beast Fury"]` in every playthrough, whatever the chip rolled. The player still sees the rolled name, and the turn log still writes it.

### Persona
<!-- keywords: hero object, who is being played, main character perks, current player body, nobody chosen, test run ignores it, custom persona, my character, my own character traits, player character trait -->

`persona` is the entity the player plays: the picked persona, or the **Custom Persona** entity when the player picks **None**.

| Member | What it is |
| --- | --- |
| `name` | The persona's code name, never the name the player typed under **None**. Read-only |
| `traits` | The persona's own traits by name, owned or linked |
| `placeholders` | The placeholders the persona owns. See [Owned Placeholders](#owned-placeholders) |
| `stats` | The persona's own stats by name, as an [entity's `stats`](#entities). Entries take writes |

`persona` also has the `id`, `type`, `pronouns`, `inScene`, `met`, `location`, `following`, `description`, `summary`, `aliases`, `items` and `body` of an [entity entry](#entities).

- `inScene` and `met` are always true for the played persona.
- `location` is where the player is. `following` is always false.
- While a persona plays, `persona.meet()` is ignored. `persona.move`, `follow`, `unfollow` and `diary` stop the script with an error.
- Each entry in `persona.traits` has the [same members as a `traits` entry](#traits), for the persona's state. A write to `enabled` switches the persona's own trait, by the same rules as `traits`.

```javascript
// Lose a point each turn while the persona is Scarred.
if (persona.traits.Scarred.enabled) self.value -= 1;

// Read the persona's own placeholder.
if (persona.placeholders.Hair.text.includes('gray')) self.value -= 1;
```

`persona.traits` and `traits` are separate. A global trait and a persona trait can share a name, and each map reads its own.

An entry in `persona.stats` takes writes to `value`, `min`, `max`, `regen` and `hidden`. The write sets the persona's stat, by the rules in [Writing to Other Stats](#writing-to-other-stats).

When the player plays no entity, `persona` is an empty entry:

- Its `name` is `''`, and every trait reads as off.
- A switch or a stat write through it is ignored and reported.
- A `move`, `follow`, `unfollow`, `meet` or `diary` call on it stops the script with an error.
- Code that reads `persona.traits.X.enabled` never throws.

**Test Code** plays the **Custom Persona** entity as `persona` when the world has one. Otherwise `persona` is empty, and **Test Code** reports each persona write as ignored.

> ⚠️ **While a library persona plays, `persona` is the library persona, not the Custom Persona.** Read the **Custom Persona** entity's stats through `entities[...]`, not through `persona`.

> ℹ️ **The editor offers the traits of every entity that can be played.** A library persona can bring traits and placeholders the world doesn't have, so an unknown name after `persona.traits` or `persona.placeholders` is a warning, not an error.

### Entities
<!-- keywords: companion status, is someone nearby, does character exist, invented ones missing, duplicate names, npc, npc traits, companion traits, another character's trait, side character -->

`entities` holds every entity in the game by its code name: the world's own entities, the played persona, and the library entities the player added at **Enter World**. A name with a space needs brackets: `entities["Old Mira"]`. Each entry has:

| Member | What it is |
| --- | --- |
| `id` | Unique identifier. Read-only |
| `name` | The entity's code name. Read-only |
| `type` | The entity's type, or `''` when it has none. Read-only |
| `pronouns` | The entity's pronouns, or `''` when it has none. Read-only |
| `inScene` | True when the entity is in this turn's scene. Read-only |
| `met` | True when the player has met the entity. Never turns false. Read-only |
| `location` | The code name of the location the entity is at. A follower reads the player's location. Empty when the entity has no position of its own and is at every location it lists. Read-only |
| `following` | True when the entity follows the player. Read-only |
| `description` | The full AI description, with each placeholder chip filled in. Read-only |
| `summary` | The short AI summary, with each placeholder chip filled in. Read-only |
| `aliases` | The entity's other names, as a list, with each placeholder chip filled in. Read-only |
| `traits` | The entity's own traits by name, owned or linked |
| `placeholders` | The placeholders the entity owns. See [Owned Placeholders](#owned-placeholders) |
| `stats` | The entity's own stats by name. Entries take writes |
| `items` | The Item Copies the entity owns. See [Items](#items). Read-only |
| `body` | The entity's Body in force, or `null`. Assign a Body name to set its base Body. See [Bodies](#bodies) |
| `move()` | Moves the entity to a location. See [Moving Entities](#moving-entities) |
| `follow()` | Makes the entity follow the player |
| `unfollow()` | Stops the entity following the player |
| `meet()` | The player meets the entity. See [Meeting Entities](#meeting-entities) |
| `diary(line)` | Adds a line to the entity's diary. See [Diary](#diary) |

Each entry in an entity's `stats` has the [same members as a `stats` entry](#stat-properties), `previous` and `delta` included.

- Code writes `value`, `min`, `max`, `regen` and `hidden` on an entry, by the rules in [Writing to Other Stats](#writing-to-other-stats). A write to any other field is ignored and reported.
- An entity's stats run every turn, whether or not the entity is in the scene.
- A stat that the entity has switched off reads with `enabled` false. A write to it is ignored and reported.

Each entry in an entity's `traits` has the [same members as a `traits` entry](#traits), for that entity's state. A write to `enabled` switches the entity's own trait. The other traits in its groups follow, as after a manual switch. A write to any other field is ignored.

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

- `persona` is the played persona's entry, so `persona === entities[persona.name]` when the persona entity has a code name. A persona entity with no code name still plays as `persona`, but it is not in `entities`.
- An entity's `traits` lists only that entity's own set. A name outside it reads as a blank entry: `enabled` and `acquired` are false, and a switch through it is ignored and reported.
- These entities are not listed:
  - An entity that the narration names but the game has not described yet
  - A persona-only entity that the player did not pick
  - The **Custom Persona** entity while a world persona plays
  - An entity with no code name. A name of only spaces counts as no name, for locations too.
- Of two entities that share a code name, the later one is the entry. The played persona always keeps its own name.
- An entity's media are not in the entry.
- An entity that the game discovered during a game is an entry, with every field above.

An unknown entity name reads as a blank entry:

- Its `name` and `id` are `''`, `met` reads false, and every trait reads as off.
- A switch or a stat write through it is ignored and reported.
- A `move`, `follow`, `unfollow`, `meet` or `diary` call through it stops the script with an error.
- In the World Editor, a `diary` call through an unknown name only warns, because a discovered entity can have that name.

A `diary` call reads the key as an id first, then as a name. So `entities[id].diary(line)` works for an id in a variable. To test whether Mira is in the game, check `entities.Mira.name`.

#### Meeting Entities
<!-- keywords: met, meet, stranger, introduce, reveal identity, stranger name, known entity, hooded stranger -->

The player sees an entity with a **Stranger Name** under that name until the player meets it. The player meets it when the narration uses its name. [Strangers](World-Editor-Entities#strangers) lists the rules. `entities.<Entity>.met` is true after the player has met the entity. It never turns false again.

**`entities.<Entity>.meet()`** makes the player meet the entity, so the player sees its name from then on.

- Use it when the story reveals a stranger without the narration naming it, such as in a found letter.
- It works on any entity in the game, at the player's location or not.
- On an entity whose `met` is already true, the call is ignored.

- A later read of `met` in the same run returns true.
- The change applies when the turn ends.
- A user Tool script can read `met` but has no `meet()`.

```javascript
// Once the clue stat reaches 3, the player learns who the hooded stranger is.
if (self.value >= 3) entities.Sylvie.meet();
```

#### Moving Entities
<!-- keywords: move npc, companion joins, follow player, leave party, schedule, patrol, entity location, send away -->

Three calls on an entity's entry set its location. Each one works on any entity, whatever its **Movement**.

- **`entities.<Entity>.move("<Location>")`** puts the entity at a location of your world, by id, else by name. A following entity stops following.
- **`entities.<Entity>.follow()`** makes the entity follow the player, at the player's location.
- **`entities.<Entity>.unfollow()`** stops the entity following and leaves it at the player's location. An entity that is not following keeps its location.

How the calls apply:

- **The writes apply when the turn ends**, after the player's move, the followers and the AI's entity answers. So a script's write wins over the AI's answer. Prompts in the same turn read the entities at their earlier locations.
- **Calls apply in call order**, across every script of the turn. The last call on an entity wins.
- **A `move` or a `follow` gives the entity a position of its own from then on.** A **Free** entity is then at one location, not at every listed one.
- **Three targets stop the script with an error:** a location your world does not have, the persona (which moves with the player), and an unknown entity name.
- **A When a Trait Switches script that runs outside a turn applies none of them.**
- **In suggest mode, a script's write wins over a waiting "come along".** The AI can ask an entity to come along, and that entity waits for **Go**. A write on the entity ends its wait.

```js
// The wight leaves its tomb once the crown is whole.
if (traits["Crown Restored"].enabled) entities.Wight.move("Barrow Road");

// Albus joins the party when his trust is high enough.
if (entities.Albus.stats.Trust.value >= 50) entities.Albus.follow();
```

**Test Code** lists every authored entity except persona-only ones. No trait is chosen, and each stat is at its starting value. A switch or a stat write that it makes is reported and never applied.

### Dictionaries
<!-- keywords: book variables, disabled book, lore owned values, unlock a book, switch a book on, switch a book off, hidden book -->

`dictionaries` holds every dictionary in the game by its code name. Each entry has:

| Member | What it is |
| --- | --- |
| `id` | Unique identifier. Read-only |
| `name` | The dictionary's code name. Read-only |
| `enabled` | True when the dictionary is on, so the AI can get its entries. Write `true` or `false` to switch it |
| `entries` | The dictionary's entries by name. See [Entries](#entries) |
| `placeholders` | The placeholders the dictionary owns. See [Owned Placeholders](#owned-placeholders) |

```javascript
// The sky follows Sanity's band.
dictionaries.Weather.placeholders.Sky.pin(self.value < 20 ? 'storm' : 'clear');
```

```javascript
// A world script: open the second chapter's lore once the gate falls.
if (stats.Gate.value === 0) dictionaries["Chapter Two"].enabled = true;
```

- **The list holds the world's dictionaries, then the library dictionaries.** The world's dictionaries are the ones that the player left on at **Enter World** and the ones you ship off. The library dictionaries are the ones that the player picked there. Of two that share a code name, the later one is the entry.
- **A dictionary you ship off reads `enabled: false`.** To keep its entries from the AI, clear the dictionary's **Enabled** checkbox, in **Advanced** mode. A script can switch it on later in the story.
- **A dictionary that the player turned off at Enter World reads as an unknown dictionary.** A write to it is ignored and reported.
- **A write applies as an entry write does.** It applies after the script, and later in the same script, and in later scripts, the dictionary reads what you set. An undo or a re-roll clears it with the turn. A Before the AI write changes this turn's narration.
- **A library dictionary that the player picked takes writes like any other.** The player's library copy never changes.
- **Test Code reads each dictionary's own Enabled setting,** because it has no **Enter World**.
- **An unknown dictionary name reads as a blank entry.** Its `name` and `id` are `''`, and every placeholder under it reads as blank. A pin through it is ignored.
- **The editor warns on a dictionary name it does not know,** because a library dictionary can add more.

#### Entries
<!-- keywords: dictionary entries, lorebook entry, entry text, trigger keywords, read an entry, entry value, keys, unlock lore, enable an entry, disable an entry, constant entry, always on lore -->

`dictionaries.<Dictionary>.entries` holds the dictionary's entries by entry name, disabled ones included. A name with a space needs brackets: `dictionaries.Lore.entries["Old King"]`. Each entry has six fields. `enabled` and `constant` take writes. The others are read-only.

| Field | What it is |
| --- | --- |
| `id` | Unique identifier |
| `name` | The entry's name |
| `keys` | The entry's Trigger Keywords, as a list |
| `value` | The entry's Value, with each placeholder chip filled in |
| `enabled` | True when the entry is on. Write `true` or `false` to switch it |
| `constant` | True when the AI gets the entry on every turn, with no keyword match. Write `true` or `false` to change it |

```javascript
// The lore entry names the king. Use it when the story is quiet.
if (dictionaries.Lore.entries["Old King"].value.includes("exiled")) self.value += 1;
```

```javascript
// A world script: unlock the vault's lore once the player holds the key.
if (traits["Vault Key"].enabled) dictionaries.Lore.entries["Sealed Vault"].enabled = true;
```

- **A disabled entry reads `enabled: false`.** A dictionary the player turned off lists none.
- **An entry with no name is left out.** A name of only spaces counts as no name. Scripts can't read it or write to it. It still works in the story.
- **Of two entries with one name, the name resolves to the enabled one.** Between two enabled or two disabled entries, it resolves to the later one. A write through the name sets that entry.
- **A name with no entry in the dictionary reads as a blank entry.** Its `id`, `name` and `value` are `''`, `keys` is an empty list, and `enabled` and `constant` are false. A write through it is ignored and reported.
- **A write applies after the script.** A later write wins. Later in the same script, and in later scripts, the entry reads what you set. Its name still resolves to the entry it named at the start of the script.
- **A Before the AI write shapes this turn.** The narration reads the entry this turn. An After the AI write shapes the next turn. A During AI Output write waits for the writes of the After the AI scripts.
- **It persists for the playthrough.** The save keeps it. An undo or a re-roll reverts it with the turn. The dictionary itself never changes.
- **Keywords find a newly enabled entry at once.** Meaning-based recall can miss it until the game has indexed it. The index starts at once and does not delay the turn.
- **A write of anything but `true` or `false` fails the run.**
- **A user Tool cannot write it.** The write is ignored and reported, as is every user Tool write.

### Items
<!-- keywords: items, item copies, inventory, give item, take item, who owns, has key, equip from code, recharge, set uses, set state, use from code, reveal item, identify item, unidentified, item script, when gained, when lost, when equipped, when unequipped, when consumed -->

`items` holds every item of the world by code name. Each entry has `id`, `name`, `unidentifiedName`, `unidentifiedDescription`, its own `placeholders`, and `copies`: its Item Copies in the game. An unidentified field is `''` when the item leaves it blank.

Each Item Copy has these members. They are read-only.

| Member | What it is |
| --- | --- |
| `id` | Unique identifier |
| `item` | Code name of its item, a key of `items` |
| `owner` | Code name of the entity that owns it, the persona included. It is `''` while the Item Copy lies at a location, or when the persona has no code name |
| `location` | Code name of the location it lies at, or `''` while an entity owns it |
| `quantity` | How many it holds |
| `equipped` and `slot` | Whether it is equipped, and the slot's name. An **All of** item reads its first listed slot |
| `hidden` | True when the player cannot see it |
| `unidentified` | True when the player sees the item's unidentified face |
| `uses` | Uses left, or `null` when the item has no **Uses** |
| `state` | Its **State** word, or `null` when it has none |

An entity's entry, `persona` and a location's entry each have `items`: the Item Copies that it holds.

```javascript
// The cellar door opens for whoever carries the key.
const hasKey = persona.items.some((copy) => copy.item === 'Cellar Key');
```

Change the inventory through verbs. A target is an entity, the persona or a location, as an entry or by name:

| Verb | What it does |
| --- | --- |
| `items.<Item>.give(to, n?)` | Gives `to` a new Item Copy, or `n` of them. `n` is 1 when left out |
| `copy.lose(n?)` | Removes the Item Copy, or `n` of it |
| `copy.moveTo(to, n?)` | Moves the Item Copy, or `n` of it, to `to` |
| `copy.equip(slot?)` and `copy.unequip()` | Equips or unequips it, as the panel does. `slot` is a slot's name from the item's list; left out, the first free one |
| `copy.use()` | Uses it once, as **Use** does |
| `copy.reveal(n?)` | Makes a hidden Item Copy visible. On a visible unidentified one, identifies it |
| `copy.setUses(n)` | Sets its uses left, from 0 up to the item's **Uses** |
| `copy.setState(word)` | Sets its **State**. `''` clears it |

- **The writes apply when the script ends**, in run order, through the same checks as the panel. A check that fails skips that write and logs the reason.
- **Bound stops the player only.** A script can remove or move a **Bound** Item Copy.
- **A script can give to an entity that is not present.**
- **Under a library persona, the Custom Persona entity means the player.** A `give` or a `pay` that names it reaches the player.
- **An unknown target stops the script with an error.** So does `give` on an unknown item name.
- **A bad argument to a verb throws a TypeError.**

```javascript
// Resting at the shrine refills every wand the player carries.
if (location.name === 'Shrine') for (const copy of persona.items) if (copy.item === 'Wand') copy.setUses(3);
```

### Currencies
<!-- keywords: currencies, money, balance, pay, toll, gold, items, price, afford, fee, bribe, income, change, refuse -->

`currencies` holds every Currency of the world by code name. Each entry has `id`, `name`, `kind` (`"stat"`, `"items"` or `"name"`) and two calls. The world's **Currencies** entry on the **Items** tab sets them up.

| Call | What it does |
| --- | --- |
| `currencies.<Currency>.balance(owner)` | What an entity or the persona holds. An Items Currency counts visible, identified items as one number. It is `null` when the owner has no balance, and for a name-only Currency |
| `currencies.<Currency>.pay(payer, payee, amount)` | Moves money as a payment in the game does, and answers `{ paid, reason }` at once |

The `owner`, `payer` and `payee` are an entity or the persona, as an entry or by name. A `payer` of `null` is income. A `payee` of `null` takes the money out of the world. The `amount` is a whole number of the Currency's smallest unit, or text such as `"1 Gold, 5 Copper"`.

```javascript
// The toll gate takes 5, or says why not.
const toll = currencies.Coin.pay(persona, "Gatekeeper", 5);
if (!toll.paid) player.toast("You can't pay the toll.");
```

- **A payment follows the game's rules.** It spends the smallest items first, makes change in the fewest items, and refuses what the payer can't afford. A stat with **No Decrease** or **No Increase** refuses it too.
- **A refused payment changes nothing.** `paid` is `false` and `reason` says why.
- **The result is in the run.** The script can read `paid` and the next `balance`. The money lands when the script ends.
- **`balance` leaves out the script's own `give` calls and stat writes.** It counts the starting state and the payments this script made.
- **A payment adds to your own write of the same stat.** After `stats.Funds.value = 100`, a payment of 30 leaves 70.
- **A later payment can't spend change an earlier one made.** It refuses instead.
- **Stat writes and `give` still work** on a stat or item that backs a Currency.
- **An unknown Currency or party stops the script with an error.**
- **A user Tool has no `currencies`.**

### Bodies
<!-- keywords: body, bodies, transform, wolf form, change slots, set body from code, body in force, base body, unequip on transform, unknown body name -->

`body` is on an entity's entry, on `persona` and on `owner`. It reads the owner's Body in force, or `null` when the owner has no Body. A Body has:

| Member | What it is |
| --- | --- |
| `name` | The Body's name. Read-only |
| `slots` | The Body's slots, in the Body's order. A list. Read-only |

Each slot has `name`, `capacity` and `items`: the Item Copies equipped in it. An **All of** item is listed under every slot it takes. They have the [members of an Item Copy](#items).

```javascript
// A curse turns the player into a wolf for good.
persona.body = "Wolf";
```

- **Assign a Body name to set the owner's base Body.** Assign `null` for no Body. The name is the Body's name in the **Equipment Settings** editor. Of two Bodies with one name, the first in the list is the match.
- **An active trait's Body still wins.** `body` reads the trait's Body until the trait ends. Then the base Body returns.
- **A name the world has no Body for stops the script with an error.** The Test Bench reports a literal name that is not a Body.
- **The write settles at once.** Items in a slot the new Body lacks, or past a smaller capacity, unequip and stay carried. Their effects reverse, **When Unequipped** runs and the log names the Body and the items. This holds in a **When a Trait Switches** script and an item script.
- **`body` reads the new Body in the same run,** with the items equipped in its slots.
- **The base Body is saved with the game.** A script cannot return the base to the Body the world picked. Assign that Body's name.

### Narration
<!-- keywords: rewrite a sentence, sentence hook, during ai output, narration object, narration sentence, sent, buffered, full, index, filter narration, replace words in the story, narration is not defined, error underline on narration -->
<!-- route: worldEditorStat.code -->

`narration` is the narration around the sentence that just completed. It exists in a **During AI Output** script only. In any other timing the name is unknown.

| Member | What it is |
| --- | --- |
| `sentence` | The sentence that just completed. Write it, or return a string, to replace it |
| `sent` | The earlier sentences the reveal already released, as rewritten. A list. Read-only |
| `buffered` | The complete sentences the reveal still holds, already past their scripts. A list. Read-only |
| `full` | The narration so far: the earlier sentences as rewritten, then the current sentence and the partial tail as the model wrote them. Read-only |
| `index` | The sentence's position in the reply, from 0. Read-only |

```javascript
// Turn the first mention of "door" in each sentence into a link.
narration.sentence = narration.sentence.replace('door', '[door](https://example.com)');
```

- **`sentence` must stay a string.** Any other type fails the script, and the sentence passes unchanged.
- **`narration` has no copy of the model's original earlier sentences.** `sent` and `full` hold what earlier scripts left.
- **When the reveal shows sentences one at a time, `sent` and `buffered` split at the reveal's position.** Otherwise `buffered` is empty, and `sent` holds every earlier sentence.
- **A sentence that completes only when the stream ends reads as `buffered`.**

**Test Code** reads a sample. The **Sample Sentence** field gives `sentence`. `sent` and `buffered` are empty, and `index` is `0`.

### Player
<!-- keywords: ask the player, tell the player, toast, confirm, ask, input, prompt, dialog, choice, pick one, pick several, multiple, text field, question, answer, wait for the player, await, canceled prompt, player is not defined, message that stays in history -->
<!-- route: worldEditorStat.code -->

`player` is the human who plays, not the entity they play. `persona` is that entity. `player` has five calls. It exists in every timing except **During AI Output**, where a call fails the script.

| Call | Returns | Shows |
| --- | --- | --- |
| `player.tell(text)` | Nothing | A message line under the turn's narration. The save keeps it with the turn. The AI never gets it |
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

- **Closing a prompt fails the script.** Cancel, or Escape inside the prompt, fails it as canceled. Its writes are discarded, as on any error. The turn goes on, and the other scripts in the timing still apply.
- **A prompt needs a screen.** With no game screen to answer, `ask`, `confirm` and `input` fail as canceled at once. `tell` and `toast` do nothing.
- **A bad call throws a TypeError in the script.** A bad call is a message, question or placeholder that is not text, an `ask` with no options, or an option that is neither text nor `{ label, value }`.
- **A multiple pick with nothing chosen** returns an empty list. A single `ask` always returns one value.
- **Prompts show one at a time.** An open prompt holds every later script in its timing until you answer it, including a script that never names `player`.
- **The timeout pauses** while a prompt is open. The one-second limit counts the script's own work.
- **Write `player.` by name.** A script that reads `player` another way, such as `const p = player;`, fails with "player is not defined".

A message belongs to the turn that runs when the script makes it:

- A message from At Game Start goes with the opening turn.
- A message from a trait switch goes with the latest turn on screen.
- A re-roll of a turn's stats replaces the messages from the timings it runs again. It keeps the During AI Output messages.

**Test Code** and the **Test Bench** show the real question, one after another, as in a game. An edit to the code, or a close of the editor, closes an open prompt. `tell` and `toast` show as lines in the report.

### Trait
<!-- keywords: trait that switched, switch script, trait switched on, trait switched off, trait enabled, which trait changed, when a trait switches, trait is not defined, trait read-only, error underline on trait -->
<!-- route: worldEditorStat.code -->

`trait` is the trait that switched, in its state after the switch. It exists in a **When a Trait Switches** script only. In any other timing, the name is unknown. It is read-only. The editor underlines a write to it as an error. In a run, the write is ignored and reported.

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

**Test Code** reads a sample. In a trait's own script, `trait` is that trait. In other scripts, it is the world's first trait in tree order, read as switched on, or a blank trait.

### Order of Effects
<!-- keywords: which script wins, priority, precedence, conflict, race condition, execution sequence, overwrite each other, see other scripts changes -->

Each timing is a separate run. Within one run, scripts run one by one, in the order of the **Scripts** tab (see [Run Order](ScriptsGuide#run-order)). Each script reads what the scripts above it wrote: stats, trait switches, placeholder pins, dictionary entries, the sentence in During AI Output and `turn.choices` in After the AI.

Two scripts that each write `stats.Health.value -= 5` take 10 from Health.

After each script, its effects apply in this order:

1. Trait switches
2. Bounds
3. Values
4. Placeholder pins

A bound that a stat writes applies at the written number, after that script's trait switches have changed the bounds.

- **Later writes replace earlier ones.** The last write to a field wins. See [Writing to Other Stats](#writing-to-other-stats).
- **A failed script adds nothing.** The scripts below it still run, and they read the state as if it never ran.
- **A switch applies to the scripts below it.** A script that an earlier script switched off doesn't run. A script that an earlier script switched on runs if it is lower in the list.
- **`previous` holds the start value.** In After the AI, it is the value at the start of the turn. In every other timing, it is the value when the timing began. `value` and `delta.actual` include earlier scripts' writes. `delta.ai` and `delta.regen` keep their meaning.
- **During AI Output scripts read each other's writes on each sentence.** The writes still land with After the AI, and a stopped turn applies none.
- **A World Tool's writes come first.** On a re-roll, its saved writes apply before the list, and every script reads them.
- **When a Trait Switches scripts run after the timing's scripts.** So do item events.
- **Some writes apply after the timing's scripts.** These are writes to items, Bodies, the location, the clock, memories, diaries and discoveries. A later script doesn't read them yet.

The timings run in order against each other. Everything a Before the AI script wrote is in place when an After the AI script reads. On the opening turn, an At Game Start script's writes are in place when Before the AI reads.

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

**The clock gives both the start and the end of a turn.** A turn takes time. An eight-hour sleep that begins at 15:00 has `clock.previous.daypart === 'afternoon'` and `clock.daypart === 'night'`. Neither reading alone describes the turn.

> ⚠️ **With the clock off, `clock.deltaHours` is always the Time Per Turn setting.** It is `1` unless the player changes it. Every turn advances the story by that much. Your code works either way, with a fixed number in place of a measured one. The clock is the **Measured Clock** setting, under [Settings](Settings#time) → **Output** → **Time**, in **Advanced** mode.

#### Passing Time

`clock.advance(<n>)` sets how long the turn takes, in story minutes. It replaces what the AI measured, or the Time Per Turn when the clock is off.

- **Calls add up.** Two scripts that each call `clock.advance(30)` make the turn take one hour.
- **The clock reads the same for the rest of the run.** A call changes the turn, not the `clock` your script reads.
- **The number must be 0 or more.** A negative or non-finite number stops the script with an error, and its writes are discarded.

```js
// A long rest takes eight hours, whatever the AI measured.
if (traits.Resting.enabled) clock.advance(8 * 60);
```

### Turn
<!-- keywords: player action, what the player typed, player input, turn count, turn counter, every fifth turn, ooc, what did the player say, what the ai wrote, read the narration, read the reply, read the choices, what choices the player has -->

`turn` holds what the player did, which turn it is, and what the AI wrote back. Its fields are read-only, except `turn.choices` in an After the AI script (see [Change the choices](#change-the-choices)). A write to a read-only field is ignored and reported. `clock`, `location` and `notes` are read-only too. The editor underlines a write to them.

| Field | What it is |
| --- | --- |
| `turn.action` | The player's action this turn, without spaces at the ends. OOC square brackets stay in. Images are never in it. |
| `turn.number` | The turn number, on the same scale as `memories[].turn`. The opening turn is `1`. |
| `turn.narration` | The page the player sees this turn, with the During AI Output rewrites applied. |
| `turn.choices` | The choices the player sees this turn, in order, as a list of strings. |

- **The page and choices wait for the reply.** Before the AI, At Game Start and During AI Output read `turn.narration` as `""` and `turn.choices` as `[]`. After the AI reads them filled. To work on each sentence as it streams, use `narration` (see [Narration](#narration)).
- **Choices off reads no choices.** When the player turns choices off, `turn.choices` is `[]`.
- **Between turns, it reads the last page.** A switch the player makes, or a Tool call, reads the page and choices of the last turn that ended. While a turn runs, they read empty until its reply arrives.
- **The opening turn reads the opening.** `turn.action` is the opening text the AI gets: the player's edit, else the drawn opening. An Opening Narration reads `""`.
- **Undo and re-roll rewind it.** A re-rolled turn reads the same action and number it read the first time.
- **A switch the player makes reads an empty action.** Between turns, it reads the number of the last turn that ended. During a turn, it reads that turn's number. Before the opening turn, `turn.number` is `0`.
- **A switch inside a turn reads that turn.** A trait that a script or a gate switches reads the same `turn` as the scripts around it.
- **Test Code reads a sample.** **Test Code** and the **Test Bench** read `"Look around."` at turn `2`. An At Game Start script reads the world's heaviest Opening Action at turn `1`. An After the AI script reads a short sample page and three sample choices.

```js
// Every fifth turn the market restocks, unless the player only gave an OOC direction.
if (turn.number % 5 === 0 && !turn.action.startsWith('[')) stats.Stock.value = stats.Stock.max;
```

#### Change the choices
<!-- keywords: change the choices, remove a choice, add a choice, hide an option, reorder choices, edit choices, clear the choices, filter choices -->

An After the AI script can change the choices the player sees. Edit `turn.choices` as you edit any list: assign a new or filtered list, or use `push`, `splice` or an index.

- **The choices wait for the scripts.** In a world with an After the AI script that uses `turn`, the choices show when the After the AI scripts finish. The input box unlocks with them. In other worlds, the choices show as soon as the narration settles.
- **Scripts edit one list in turn.** Each After the AI script reads the list as the scripts before it left it. The player sees the list the last script leaves.
- **A bad item fails the run.** Every item must be text that is not blank. Otherwise the script fails, and none of its writes apply. The list stays as the scripts before it left it.
- **An empty list is allowed.** The turn then shows no choices, and the player types an action.
- **It is read-only at other timings.** Before the AI, At Game Start, During AI Output, When a Trait Switches, Tools and runs between turns read the list. A change there is ignored and reported. With the player's choices off, a change is ignored too.
- **A stats re-roll starts again.** It runs the scripts on the AI's own choices. Edits never stack. The save keeps both lists.
- **Regenerate Choices runs the scripts again.** They read the new list and the AI's stat changes for the turn. Only their choice edits apply. The new list shows once they finish.
- **A `player` call shows nothing on that run.** `tell` and `toast` show nothing, `confirm` answers `false`, `ask` answers `null` (`[]` with `multiple`), and `input` answers `""`. The script runs on.

```js
// Once the bridge is down, no choice crosses it.
if (stats.Bridge.value === 0) turn.choices = turn.choices.filter((choice) => !/bridge/i.test(choice));
```

### Location
<!-- keywords: move player, teleport, change scene, travel, where am i, current place, go to -->

`locations` holds every location of the world by its code name, as `entities` holds the entities. A name with a space needs brackets: `locations["Old Mill"]`. `location` is the entry of the location the turn is at. Both have the same fields. All fields are read-only.

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
| `items` | The Item Copies lying at the location. See [Items](#items) |

In a world with no location, `location.id` and `location.name` are empty, and `location.present` is an empty list. An unknown location name reads as a blank entry.

```js
// React while Mira is in the room.
if (location.present.some((e) => e.name === "Mira")) self.value += 1;

// Read another place.
const mill = locations["Old Mill"].summary;

// Walk to a random place the player can reach from here.
const exit = location.exits[Math.floor(Math.random() * location.exits.length)];
if (exit) location.move(exit.name);
```

`location` and its `exits` keep reading the location where the turn started, even after `location.move` in the same script.

In **Test Code** and the **Test Bench**, no entity has a position. Each entity is in `present` at every location it lists, and the persona is at the starting location.

`location.move("<Location>")` moves the turn to a location of your world, by name or id. It replaces the AI's move for that turn. It needs no path from the turn's location.

- **A Before the AI move applies before the AI writes.** The narration is written at the new location.
- **A During AI Output or After the AI move applies with the turn.**
- **The last move wins.** When several scripts move the turn, the last one in run order decides.
- **An unknown location name stops the script with an error.** Its other writes are discarded too, so **Test Code** and the **Test Bench** show a typo.

```js
// Falling asleep in the woods wakes you at camp.
if (stats.Energy.value <= 0) location.move("Camp");
```

### Discover
<!-- keywords: new character, add npc, spawn, introduce someone, meet, create entity -->

`discover(<text>)` adds a new entity to the turn, as if the AI had introduced it.

- **`discover("<Name>")`** adds the name to the entities in the turn's scene. The AI then describes the entity, as it does for an entity the narration invents. With **Describe New Characters** off, nothing more happens. See [How to Get Descriptions for New Entities](Entities#how-to-get-descriptions-for-new-entities).
- **`discover("<Name>", "<Description>")`** creates the entity at once with that description, with no AI call.
- **A name that an entity already has is skipped.**
- **A blank name or a blank description throws a TypeError.** Both are trimmed.
- **The entity clears with its turn.** A regenerate or a stopped turn discards it.

### Memory
<!-- keywords: remember, add memory, pin memory, recall, story so far, long-term memory, note -->

`memories` is a list of the story's memories: the rows of the Memory panel, oldest first. It holds the summaries the story keeps and the **Custom** memories. A memory that the player deleted is not in it. The list is empty in **Test Code** and the **Test Bench**, where no game runs.

Two calls add to it. Each takes one line of text.

- **`memories.add(<text>)`** adds a line to this turn's memory, after the AI's summary of the turn. The AI still writes its summary. Recall finds both on later turns when they fit. The line is not sent with every request.
- **`memories.pin(<text>)`** adds a memory that is sent with every request, like one you write in the Memory Manager. It shows there under **Custom**, where the player can edit or delete it.
- **Both clear with their turn.** A regenerate or a stopped turn discards them.
- **A blank or non-text line throws a TypeError.** Lines are trimmed.

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

Four calls on a memory write the Memory panel's verdicts. The writes apply when the turn ends. A later call in the same turn overwrites an earlier one.

| Call | What it does |
| --- | --- |
| `pin()` | Pins the memory to stay, as **Pin This Memory** does |
| `forget()` | Pins the memory to go, as **Forget This Memory** does |
| `edit(text)` | Rewrites the memory, as an edit in the Memory Manager does. A summary keeps its original and is pinned to stay |
| `remove()` | Erases the memory, as **Delete This Memory** does. The player can restore it in the Memory Manager |

- **`pin()` and `forget()` are ignored on a Custom memory.** The run lists each one as ignored. `edit(text)` and `remove()` work on a Custom memory.
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

`notes` is the player's notes, as one text. It is empty in **Test Code** and the **Test Bench**, where no game runs. It is read-only.

```js
// The player wrote down the password, so the gate opens.
if (notes.includes("swordfish")) traits.GateOpen.enabled = true;
```

### Diary
<!-- keywords: character diary, journal, entity memory, what they remember, first person -->

`entities.<Entity>.diary(<text>)` adds a line to an entity's diary for this turn, after the AI's entry. The AI still writes its entry. A diary line reads in the entity's own voice. The key also resolves as an id: `entities["<id>"].diary(<text>)`.

- **Any entity in the game is a target**, from your world or discovered during the game.
- **An entity that is not in the game stops the script with an error.** The persona has no diary, so `persona.diary` stops the script too.
- **The line clears with its turn.** A regenerate or a stopped turn discards it.
- **A blank or non-text line throws a TypeError.**

```js
if (traits.Betrayed.enabled) entities.Mira.diary("I trusted them, and they sold me out.");
```

### Code Beats the AI
<!-- keywords: who wins, ai overrides, script vs ai, precedence location clock -->

A script's move, advance or discovery wins over the AI's answer for the same turn. Memory and diary lines are the exception. They join the AI's summary and diary entries. With no script write, the AI's answer applies.

Like every script write, each one belongs to its turn. A regenerate or a stopped turn discards it. A stat re-roll keeps the turn's location, time, scene entities, memories and diary lines.

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

Scale a change by the length of the turn, so a night's sleep costs more than a short conversation:

```javascript
// Thirst rises 2 per story hour
const current = stats.Thirst.value;
return current + (2 * clock.deltaHours);
```

#### Time of Day

React to the time of the turn, not to another stat:

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

// Size factor (larger entities consume more)
const sizeFactor = size / 50;

return baseRate * activityMultiplier * sizeFactor;
```

> 💡 **Use the `regen` field for plain regeneration.** Regen at a fixed rate already scales with story hours, with no code. Use `clock.deltaHours` when the rate depends on something else: the time of day, another stat or a threshold.

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
