# 🧮 Stat Code Guide

This guide explains Formamorph's **stat code** — a small JavaScript script attached to a stat. It can set the stat's value from other stats, move the stat's own bounds, pin a placeholder, or switch a trait. In a world file this script is a stat's `code` field; see the [World Format](WorldFormat) for where it lives.

## Overview

Stat code runs in a sandbox when a stat changes, or every turn when it reads the clock (see [When Your Code Runs](#when-your-code-runs)). It can:

- **Derive a value** from other stats (e.g., carrying capacity based on strength)
- **Combine stats** (e.g., defense calculated from armor + agility)
- **React to thresholds** (e.g., speed penalties when health is below 30%)
- **Follow time** — how long a turn took, or what time of day it is (see [The Story Clock](#the-story-clock))
- **Set its own Min, Max, or Regen** (see [Writing to `self`](#writing-to-self))
- **Shape what the AI asked for** before it lands (see [Reading This Turn](#reading-this-turn))
- **Pin a placeholder** to any text (see [Placeholders](#placeholders))
- **Switch a trait** on or off (see [Traits](#traits))

## How It Works

1. Each stat can have an optional JavaScript script
2. When the AI changes a stat, or every turn if any code reads the clock, the script runs in a safe environment after the AI's changes and regen apply
3. The script reads every stat, the story clock, the world's placeholders, and the world's traits
4. `return <number>` sets the stat's value, clamped to its range. Writes to `self`, `placeholders`, and `traits` apply after the run
5. A script that throws or times out changes nothing

### When Your Code Runs

| Your code… | Runs… |
| --- | --- |
| doesn't mention a clock variable | whenever a stat changes |
| mentions any clock variable | **every turn**, whether or not a stat changed |

Time passes on every turn, so code that reads the clock has to run on every turn — otherwise a time-based stat would only tick on the turns the AI happened to report a stat change. Code that doesn't read the clock keeps the original schedule.

## Writing Stat Code

### Basic Syntax

Your code is plain JavaScript. Return a number to set the stat's value. The code has access to a `stats` array containing all stats in the game, and to `self`, the stat the code belongs to.

```javascript
// Example: Return a fixed value
return 50;
```

A script does not have to return anything. One that only writes `self`, a placeholder, or a trait leaves the value to the AI and regen.

### Accessing Other Stats

To access other stats, use the `stats` array and the `find` method to locate stats by name:

```javascript
// Example: Return the value of another stat
const health = stats.find(s => s.name === 'Health')?.value || 0;
return health;
```

The `?.` operator safely accesses the value property (returns undefined if the stat isn't found), and the `|| 0` provides a default value of 0 if the stat isn't found.

### Stat Properties

Each stat in the `stats` array, `self` included, exposes the following properties:

| Property | What it is |
| --- | --- |
| `id` | Unique identifier |
| `name` | Display name (this is what you match on) |
| `type` | Type of stat (`'number'` or `'percentage'`) |
| `description` | Text description |
| `min` | Minimum value |
| `max` | Maximum value |
| `value` | Current value, with this turn's AI change and regen applied |
| `regen` | Regen per story hour, with traits applied |
| `previous` | `{ value, max }` at the start of the turn |
| `requested` | `{ value, max }` the AI asked to change this turn, before flags and clamping |
| `regenApplied` | The regen this turn added, after clamping |

> ℹ️ Only these fields are passed into the sandbox. A stat's own `code` and `descriptors` are **not** available from inside a script.

### Writing to `self`

`self` is the stat the code belongs to. It is the same object that sits in `stats`, so `self.value` and `stats.find(s => s.id === self.id).value` read alike. Four of its fields take writes:

| Write | Effect |
| --- | --- |
| `self.value = n` | Sets the value this turn, clamped to the range. Same as `return n` |
| `self.min = n` | Sets the floor. Holds until the code writes it again |
| `self.max = n` | Sets the cap. Holds until the code writes it again |
| `self.regen = n` | Sets regen per story hour. Holds until the code writes it again |

A field you do not write keeps what the turn gave it. So a script can move the cap and leave the value to the AI:

```javascript
// Max grows with Level. The value still moves as the AI narrates.
const level = stats.find(s => s.name === 'Level')?.value ?? 1;
self.max = 50 + level * 10;
```

A bound your code sets wins over the authored bound, trait changes, and the AI's max changes for that field. It stays set on runs that do not write it, and empty code clears every code-set bound. A write equal to the bound's current number counts as leaving it alone. Only `self` takes writes; a write to another stat's entry does nothing, and the editor underlines it.

### Reading This Turn

Every stat carries what the turn did before the code ran. `previous` holds the value and max at the start of the turn. `requested` holds the change the AI asked for, raw. `regenApplied` holds the regen this turn added. Together they let a script clamp or scale an ask:

```javascript
// The AI may lower Sanity by at most 10 per turn, and never raise it.
const ask = Math.max(-10, Math.min(0, self.requested.value));
self.value = self.previous.value + ask + self.regenApplied;
```

On a turn with no ask, `requested.value` and `requested.max` are both `0`.

### Placeholders

`placeholders` holds every placeholder in the world, by name. A name with a space needs brackets: `placeholders["Hair Color"]`. Each entry has:

| Member | What it is |
| --- | --- |
| `value` | The text the placeholder reads as now, with pins applied. Write it to pin the placeholder |
| `values` | Every authored value as text, in authored order. Values with weight 0 are included |
| `roll()` | One draw with the author's weights. The draw is not kept |
| `unpin()` | Remove the pin code set. The next pin in rank, or the roll, shows again |

Writing `value` pins the placeholder to that text until the code changes it again. The pin sits over the roll and every other pin; it never replaces them, so `unpin()` hands the placeholder back to whatever sat underneath. Any text is allowed, on the list or off it:

```javascript
// Mood follows Sanity's band.
placeholders.Mood.value = self.value < 20 ? 'furious' : self.value < 50 ? 'wary' : 'calm';
```

A write to a placeholder name the world does not have is dropped. **Test Code** and the Test Bench both report it.

### Traits

`traits` holds every authored trait in the world, by name, whether the player has it or not. Each entry has:

| Member | What it is |
| --- | --- |
| `enabled` | Whether the player has the trait and it is on. Write it to switch the trait |
| `acquired` | Whether the player has the trait at all, on or off. Read-only |

Writing `enabled` switches the trait after the run, exactly as the player's checkbox does. Switching on retires its exclusive siblings. Switching on a trait the player never took acquires it. The switch persists until the player, the AI, or a later run switches it again. Code ignores **Player Can Toggle In-Game**, so a script can drive a curse or a rank the player has no checkbox for.

```javascript
// Cursed while Sanity is on the floor.
traits.Cursed.enabled = self.value <= 0;
```

A write to a trait name the world does not have is dropped. **Test Code** and the Test Bench both report it. A write to `acquired` is dropped, and **Test Code** says so.

### Order of Effects

Every stat's code runs over the same snapshot, so no script sees another's writes in the same turn. After the run, effects apply in this order: trait switches, then bounds, then values, then placeholder pins. A bound a stat set this turn still wins over a bound its own trait switch moved. When two stats write the same placeholder or trait in one turn, the later stat in the list wins.

### The Story Clock

Six values describe where the story stands in time. They're plain variables — just use them by name.

| Variable | What it is |
| --- | --- |
| `deltaHours` | Story hours **this turn** consumed |
| `elapsedHours` | Total story hours so far, counting this turn |
| `day` | Day number (1-based) at the **end** of the turn |
| `daypart` | Time of day at the **end** of the turn |
| `startDay` | Day number at the **start** of the turn |
| `startDaypart` | Time of day at the **start** of the turn |

`daypart` and `startDaypart` are one of six words: `night`, `dawn`, `morning`, `midday`, `afternoon`, `evening`.

**Why start and end are both given.** A turn spans time. An eight-hour sleep that begins at 15:00 has `startDaypart === 'afternoon'` and `daypart === 'night'` — neither reading alone describes the turn.

> ⚠️ **With the clock off, `deltaHours` is always `1`** and every turn advances the story by one hour. Your code works either way; it just gets a flat number instead of a measured one. The setting is **Measured Clock**, under Settings → Output → Memory.

### Examples

#### Percentage-Based Stat

Calculate a stat as a percentage of another stat:

```javascript
// Make Stamina 75% of Health
const health = stats.find(s => s.name === 'Health')?.value || 0;
return health * 0.75;
```

#### Average of Multiple Stats

Calculate a stat as the average of multiple other stats:

```javascript
// Make Defense the average of Strength and Agility
const strength = stats.find(s => s.name === 'Strength')?.value || 0;
const agility = stats.find(s => s.name === 'Agility')?.value || 0;
return (strength + agility) / 2;
```

#### Conditional Calculation

Calculate a stat differently based on conditions:

```javascript
// Make Speed depend on Health
// Full speed when Health > 50, otherwise reduced
const health = stats.find(s => s.name === 'Health')?.value || 0;
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
const strength = stats.find(s => s.name === 'Strength')?.value || 0;
const weaponSkill = stats.find(s => s.name === 'Weapon Skill')?.value || 0;

// Base damage from strength
const baseDamage = strength * 0.8;

// Skill multiplier (1.0 to 2.0 based on skill)
const skillMultiplier = 1.0 + (weaponSkill / 100);

// Random factor (±20%)
const randomFactor = 0.8 + (Math.random() * 0.4);

return baseDamage * skillMultiplier * randomFactor;
```

> ⚠️ **`Math.random()` is reseeded from the clock each time your code runs.** Two stats' code running in the same turn draw the **same** first value, and a stat whose value you re-check within the same instant gets the same number back. Turns are far enough apart in real play that a once-per-turn roll varies fine — but if you need two independent rolls, or a roll that visibly moves on demand, mix a clock variable in: `(Math.random() * 100 + elapsedHours) % 100` stays evenly spread and advances on its own.

#### Diminishing Returns

Implement diminishing returns for stat scaling:

```javascript
// Calculate Dodge Chance with diminishing returns
const agility = stats.find(s => s.name === 'Agility')?.value || 0;

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
const current = stats.find(s => s.name === 'Thirst')?.value || 0;
return current + (2 * deltaHours);
```

#### Time of Day

React to when the turn happened rather than to another stat:

```javascript
// A vampire's Power climbs at night and fades by day
const current = stats.find(s => s.name === 'Power')?.value || 50;
const rate = (daypart === 'night' || daypart === 'evening') ? 4 : -4;
return current + (rate * deltaHours);
```

#### Resource Consumption

Calculate resource consumption based on other stats:

```javascript
// Calculate Hunger Rate based on activity and size
const activityLevel = stats.find(s => s.name === 'Activity')?.value || 0;
const size = stats.find(s => s.name === 'Size')?.value || 0;

// Base consumption rate
const baseRate = 1;

// Activity multiplier (1.0 to 3.0)
const activityMultiplier = 1.0 + (activityLevel / 50);

// Size factor (larger characters consume more)
const sizeFactor = size / 50;

return baseRate * activityMultiplier * sizeFactor;
```

> 💡 **Prefer the `regen` field for plain regeneration.** A stat that simply drifts at a fixed rate already scales with story hours without any code at all. Reach for `deltaHours` when the rate itself depends on something — the time of day, another stat, a threshold.

## Best Practices

1. **Keep it simple**: Complex code can be hard to debug and may impact performance
2. **Handle missing stats**: Always use default values (`|| 0`) when accessing stats that might not exist
3. **Stay within min/max**: The system will automatically clamp your result to the stat's min/max range
4. **Avoid infinite loops**: Don't create circular dependencies between stats
5. **Write only what you mean to change**: A field, placeholder, or trait you leave alone keeps the turn's own result
6. **Test your code**: Use the "Test Code" button to validate your code before saving
7. **Add comments**: Document your code for future reference

## Limitations

- Code execution has a timeout of 1 second to prevent infinite loops
- The code cannot access external resources (network, files, etc.)
- Circular dependencies between stats may cause unexpected behavior
- The code runs in a sandboxed environment with limited JavaScript features
- Code writes only its own bounds; another stat's entry is read-only
- **Test Code** runs your script as a one-hour turn on day one with no player traits, so it can't preview a long turn or a different daypart. It shows a trait switch and never applies it to the world

### A Note on Accumulating Stats

Most stat code is a **formula**: it reads other stats and returns an answer, and running it twice gives the same result. Code that adds to its own current value (`return current + …`) is different — it's a **running total**, and it depends on running exactly once per turn.

Formamorph runs it once per turn. But re-rolling a turn's stat changes re-runs it too, deliberately: the re-roll rebuilds the turn from the values it started with, so the total lands where it should instead of being counted twice. Just be aware that a running total is more fragile than a formula, and prefer a formula where one will do.

## Troubleshooting

If your code doesn't work as expected:

1. Check for typos in stat, placeholder, and trait names (they are case-sensitive)
2. Ensure your code returns a number, or writes a field instead
3. Verify that all stats you're referencing actually exist
4. Use the "Test Code" button to see any error messages and every field, placeholder, and trait the run wrote
5. Add `console.log()` statements to debug your code (output appears in browser console)

## Advanced Examples

### Stat Scaling with Level

```javascript
// Scale Health based on Level and Constitution
const level = stats.find(s => s.name === 'Level')?.value || 1;
const constitution = stats.find(s => s.name === 'Constitution')?.value || 10;

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
const stamina = stats.find(s => s.name === 'Stamina')?.value || 0;
const staminaMax = stats.find(s => s.name === 'Stamina')?.max || 100;
const actions = stats.find(s => s.name === 'Recent Actions')?.value || 0;

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
const strength = stats.find(s => s.name === 'Strength')?.value || 0;

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
const intelligence = stats.find(s => s.name === 'Intelligence')?.value || 0;
const wisdom = stats.find(s => s.name === 'Wisdom')?.value || 0;
const mana = stats.find(s => s.name === 'Mana')?.value || 0;
const maxMana = stats.find(s => s.name === 'Mana')?.max || 100;

// Base power from intelligence
const basePower = intelligence * 1.5;

// Wisdom bonus (diminishing returns)
const wisdomBonus = Math.sqrt(wisdom) * 5;

// Mana percentage factor (more effective with higher mana)
const manaFactor = 0.5 + (0.5 * (mana / maxMana));

return (basePower + wisdomBonus) * manaFactor;
