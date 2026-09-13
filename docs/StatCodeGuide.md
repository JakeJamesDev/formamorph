# 🧮 Stat Code Guide

This guide explains Formamorph's **stat code**: a small JavaScript script attached to a stat. It can set the stat's value from other stats, set the stat's own bounds, pin a placeholder, or switch a trait. Each stat has two script boxes, one on each side of the AI's turn. In a world file they are a stat's `beforeCode` and `code` fields; see the [World Format](WorldFormat) for where they live.

## Overview

Stat code runs in a sandbox on every turn (see [When Your Code Runs](#when-your-code-runs)). It can:

- **Derive a value** from other stats (e.g., carrying capacity based on strength)
- **Combine stats** (e.g., defense calculated from armor + agility)
- **React to thresholds** (e.g., speed penalties when health is below 30%)
- **Follow time**: how long a turn took, or what time of day it is (see [The Story Clock](#the-story-clock))
- **Set its own Min, Max, or Regen** (see [Writing to `self`](#writing-to-self))
- **Shape what the AI asked for** before it lands (see [Reading This Turn](#reading-this-turn))
- **Pin a placeholder** to any text (see [Placeholders](#placeholders))
- **Switch a trait** on or off (see [Traits](#traits))

## How It Works

1. Each stat has two optional JavaScript boxes: **Before the AI** and **After the AI**
2. On every turn, each box runs in a safe environment at its own point in the turn
3. Each box reads every stat, the story clock, the world's placeholders, and the world's traits
4. `return <number>` sets the stat's value, clamped to its range. Writes to `self`, `placeholders`, and `traits` apply after the run
5. A script that throws or times out changes nothing

### The Two Boxes

A turn runs your code twice, once on each side of the AI:

| Step | What happens |
| --- | --- |
| 1 | **Before the AI** runs, on the state the turn started in |
| 2 | The prompt is built and the AI answers |
| 3 | The AI's stat changes apply |
| 4 | Regen applies |
| 5 | **After the AI** runs |

**Before the AI** runs before the prompt is built. A value it sets, a placeholder it pins, or a trait it switches is in the prompt for that turn. A value it sets shows on the bar while the AI is still writing.

**After the AI** runs where a single box always ran, so a world written before the split keeps its meaning with no edits. It reads the AI's change, this turn's regen, and the values the before box set.

> ⚠️ **The before box has no turn behind it yet.** `previous` reads as the stat itself, `delta.ai`, `delta.regen`, `delta.total` and `delta.actual` all read zeros, and the clock reads turn start, so `deltaHours` is `0`. Code that scales the AI's change belongs in the after box.

**Bounds carry across both boxes.** A `self.max` the before box sets persists through an after box that never writes it. Emptying one box leaves the bounds the other set. Emptying both clears them.

### When Your Code Runs

**Your code runs on every turn.** There is no schedule to choose and no option to enable. Both boxes run on the opening turn and on a turn with no AI stat change.

> 💡 Both boxes run even when the stat request is off, or when it fails. On such a turn `delta.ai` reads zeros in the after box too, so code that scales an ask leaves the value where it stood.

## Writing Stat Code

### Basic Syntax

Your code is plain JavaScript. Return a number to set the stat's value. The code has access to `stats`, a map of every stat in the game keyed by name, and to `self`, the stat the code belongs to.

```javascript
// Example: Return a fixed value
return 50;
```

A script does not have to return anything. One that only writes `self`, a placeholder, or a trait leaves the value to the AI and regen.

### Accessing Other Stats

Read another stat by its name:

```javascript
// Example: Return the value of another stat
const health = stats.Health.value;
return health;
```

A name with a space needs brackets: `stats["Hit Points"].value`. A name the world does not have reads as a blank entry with every number `0`, so a typo never throws.

> ℹ️ **A stat name with a placeholder chip in it reads in code as the placeholder's own name.** A stat named `{{Beast}} Power` is `stats["Beast Power"]` in every playthrough, whatever the chip rolled. The player still sees the rolled name.

### Stat Properties

Each stat in the `stats` map, `self` included, exposes the following properties:

| Property | What it is |
| --- | --- |
| `id` | Unique identifier |
| `name` | Code name. The authored name with each chip replaced by its placeholder's name |
| `type` | Type of stat (`'number'` or `'percentage'`) |
| `description` | Text description |
| `min` | Minimum value |
| `max` | Maximum value |
| `value` | Current value, with this turn's AI change and regen applied |
| `regen` | Regen per story hour, with traits applied |
| `previous` | The full stat at the start of the turn: `id`, `name`, `type`, `description`, `min`, `max`, `value`, `regen`. Read-only |
| `delta` | Every change this turn made, by source: `ai`, `regen`, `total`, `actual`. Read-only |

> ℹ️ Only these fields are passed into the sandbox. A stat's own `code` and `descriptors` are **not** available from inside a script.

### Writing to `self`

`self` is the stat the code belongs to. It is the same object that sits in `stats`, so `self.value` and `stats[self.name].value` read alike. Four of its fields take writes:

| Write | Effect |
| --- | --- |
| `self.value = n` | Sets the value this turn, clamped to the range. Same as `return n` |
| `self.min = n` | Sets the floor. Holds until the code writes it again |
| `self.max = n` | Sets the cap. Holds until the code writes it again |
| `self.regen = n` | Sets regen per story hour. Holds until the code writes it again |

A field you do not write keeps what the turn gave it. So a script can move the cap and leave the value to the AI:

```javascript
// Max grows with Level. The value still moves as the AI narrates.
const level = stats.Level.value;
self.max = 50 + level * 10;
```

A bound your code sets overrides the authored bound, trait changes, and the AI's max changes for that field. It persists on runs that do not write it. Code-set bounds clear only when both boxes are empty. A write equal to the bound's current number counts as no write. Only `self` accepts writes. A write to another stat's entry does nothing, and the editor underlines it.

### Reading This Turn

Every stat carries the turn's state before the code ran. `previous` holds the full stat, every field `self` has, at the start of the turn. In the before box the turn has done nothing yet, so `previous` reads as the stat itself and every `delta` below reads zero. This section is about the after box.

`delta` holds every change the turn made to the stat, by source. Each member has the same four fields: `value`, `min`, `max`, and `regen`. A field that a source cannot move reads `0`.

| Member | What it is |
| --- | --- |
| `delta.ai` | The change the AI asked for, raw: before flags and the range. The AI asks for `value` and `max` only |
| `delta.regen` | What regen did this turn. Only `value` moves |
| `delta.total` | Every source added up: what the turn asked of the stat, before flags and the range |
| `delta.actual` | Current values minus `previous`. A bound a trait changed since the turn started shows here |

`previous` and `delta` are frozen, so a write to them does nothing. Together they let a script clamp or scale an ask:

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

`placeholders` holds every placeholder in the world, by name. A name with a space needs brackets: `placeholders["Hair Color"]`. Each entry has:

| Member | What it is |
| --- | --- |
| `values` | Every authored value as text, in authored order. Values with weight 0 are included |
| `value` | The current value. One text on a Wildcard or a Variable, a list on an Object |
| `text` | `value` as one string: exactly what the prompt sees. A list joins with `", "`. Read-only |
| `roll()` | One draw with the author's weights. The draw is not kept |
| `pin(x)` | Pin the placeholder. Takes what `value` reads on that entry |
| `unpin()` | Remove the pin code set. The next pin in rank, or the roll, applies again |

#### Paths

Code reaches a placeholder the way the editor names it. An entity or a book that owns placeholders is a step of its own, and a placeholder that holds parts carries them as members:

```javascript
placeholders.Molly.Hair              // the Hair that Molly owns
placeholders.Molly.Hair.Shade        // the Shade that Hair holds
placeholders["Old Molly"]["Eye Color"]  // brackets, at any depth
```

| You write | You reach |
| --- | --- |
| `placeholders.Hair` | The world's own `Hair`, where it has one |
| `placeholders.Molly.Hair` | Molly's `Hair`, always |

A bare name resolves to the world's own row first. Where the world has no row of that name, it resolves to the last one authored, and the editor says so. Write the full path for an exact match.

An owner segment is not a placeholder. It has none of the six members in the table above, only the placeholders it owns. Every placeholder has all six, so a part named `value` or `roll` is shadowed by the member. The editor warns on the part's name field.

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

A write to a placeholder name the world does not have is dropped. **Test Code** and the Test Bench both report it.

### Traits

`traits` holds every authored trait in the world, by name, whether the player has it or not. Each entry has:

| Member | What it is |
| --- | --- |
| `enabled` | True when the player has the trait and it is on. Write it to switch the trait |
| `acquired` | True when the player has the trait, on or off. Read-only |

Writing `enabled` switches the trait after the run, with the same effect as the player's checkbox. Switching on disables its exclusive siblings. Switching on a trait the player never took acquires it. The switch persists until the player, the AI, or a later run switches it again. Code ignores **Player Can Toggle In-Game**, so a script can switch a trait the player cannot toggle.

```javascript
// Cursed while Sanity is on the floor.
traits.Cursed.enabled = self.value <= 0;
```

A write to a trait name the world does not have is dropped. **Test Code** and the Test Bench both report it. A write to `acquired` is dropped, and **Test Code** says so.

> ℹ️ **A trait name with a placeholder chip in it reads in code as the placeholder's own name.** A trait named `{{Beast}} Fury` is `traits["Beast Fury"]` in every playthrough, whatever the chip rolled. The player still sees the rolled name, and the turn log still writes it.

### Order of Effects

Each box is a separate run. Within one run every stat's code reads the same snapshot, so no script sees another stat's writes from that run. After each run, effects apply in this order: trait switches, then bounds, then values, then placeholder pins. A bound a stat set this turn still wins over a bound its own trait switch moved. When two stats write the same placeholder or trait in one run, the later stat in the list wins.

The two runs are ordered against each other, though: everything the before box wrote is already in place when the after box reads.

### The Story Clock

Six values describe the story time. They are plain variables. Use them by name.

| Variable | What it is |
| --- | --- |
| `deltaHours` | Story hours **this turn** consumed |
| `elapsedHours` | Total story hours so far, counting this turn |
| `day` | Day number (1-based) at the **end** of the turn |
| `daypart` | Time of day at the **end** of the turn |
| `startDay` | Day number at the **start** of the turn |
| `startDaypart` | Time of day at the **start** of the turn |

`daypart` and `startDaypart` are one of six words: `night`, `dawn`, `morning`, `midday`, `afternoon`, `evening`.

**Why start and end are both given.** A turn spans time. An eight-hour sleep that begins at 15:00 has `startDaypart === 'afternoon'` and `daypart === 'night'`. Neither reading alone describes the turn.

> ⚠️ **With the clock off, `deltaHours` is always `1`** and every turn advances the story by one hour. Your code works either way; it just gets a flat number instead of a measured one. The setting is **Measured Clock**, under Settings → Output → Memory.

### Examples

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
// Make Morale the average of every stat, this one included
const all = Object.values(stats);
return all.reduce((sum, stat) => sum + stat.value, 0) / all.length;
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

> ⚠️ **`Math.random()` is reseeded from the clock each time your code runs.** Two stats' code running in the same turn draw the **same** first value, and a stat whose value you re-check within the same instant gets the same number back. Turns are far enough apart in real play that a once-per-turn roll varies. If you need two independent rolls, or a roll that changes on demand, mix in a clock variable: `(Math.random() * 100 + elapsedHours) % 100` stays evenly spread and advances on its own.

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
return current + (2 * deltaHours);
```

#### Time of Day

React to when the turn happened rather than to another stat:

```javascript
// A vampire's Power climbs at night and fades by day
const current = stats.Power.value;
const rate = (daypart === 'night' || daypart === 'evening') ? 4 : -4;
return current + (rate * deltaHours);
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

> 💡 **Prefer the `regen` field for plain regeneration.** A stat that simply drifts at a fixed rate already scales with story hours without any code at all. Use `deltaHours` when the rate itself depends on something: the time of day, another stat, a threshold.

## Best Practices

1. **Keep it simple**: Complex code can be hard to debug and may impact performance
2. **Trust the zero default**: a stat name not in the world reads as a blank entry, every number `0`, so a lookup never throws
3. **Stay within min/max**: The system will automatically clamp your result to the stat's min/max range
4. **Avoid infinite loops**: Do not create circular dependencies between stats
5. **Write only what you mean to change**: A field, placeholder, or trait you leave alone keeps the turn's own result
6. **Test your code**: Use the box's own "Test Code" button to validate that box before saving
7. **Pick the right box**: put a write the AI should read this turn in **Before the AI**, and a reaction to what the AI asked in **After the AI**
8. **Add comments**: Document your code for future reference

## Limitations

- Code execution has a timeout of 1 second to prevent infinite loops
- The code cannot access external resources (network, files, etc.)
- Circular dependencies between stats may cause unexpected behavior
- The code runs in a sandboxed environment with limited JavaScript features
- Code writes only its own bounds; another stat's entry is read-only
- **Test Code** runs one box with no player traits, so it cannot preview a long turn or a different daypart. Before the AI runs as the opening turn, where `deltaHours` and `elapsedHours` are both `0`; After the AI runs as a one-hour turn on day one. It shows a trait switch and never applies it to the world
- Each box's **Templates** menu lists only the templates written for that box

### A Note on Accumulating Stats

Most stat code is a **formula**: it reads other stats and returns an answer, and running it twice gives the same result. Code that adds to its own current value (`return current + …`) is a **running total**. It depends on running exactly once per turn.

Formamorph runs it once per turn. A re-roll of a turn's stat changes runs it again by design: the re-roll rebuilds the turn from its starting values, so the total is not counted twice. A running total is more fragile than a formula. Prefer a formula where one will do.

## Troubleshooting

If your code does not work as expected:

1. Check for typos in stat, placeholder, and trait names (they are case-sensitive)
2. Ensure your code returns a number, or writes a field instead
3. Verify that every stat you reference exists
4. Use the "Test Code" button to see any error messages and every field, placeholder, and trait the run wrote
5. Add `console.log()` statements to debug your code (output appears in browser console)

## Advanced Examples

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
