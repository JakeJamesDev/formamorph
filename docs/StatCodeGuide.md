# 🧮 Stat Code Guide

This guide explains Formamorph's **dynamic stat calculation** — attach a small JavaScript snippet to a stat to derive its value from other stats. In a world file this snippet is a stat's `code` field; see the [World Format](WorldFormat) for where it lives.

## Overview

The dynamic stat calculation feature allows you to write JavaScript code that automatically calculates a stat's value based on other stats. This enables you to create:

- **Derived stats** that depend on other stats (e.g., carrying capacity based on strength)
- **Compound stats** that combine multiple stats (e.g., defense calculated from armor + agility)
- **Threshold effects** that change based on conditions (e.g., speed penalties when health is below 30%)
- **Complex formulas** for game mechanics (e.g., damage calculations, regeneration rates)
- **Time-based stats** that respond to how long a turn took or what time of day it is (see [The Story Clock](#the-story-clock))

## How It Works

1. Each stat can have an optional JavaScript code snippet
2. When stats are updated during gameplay, the code is executed in a safe environment
3. The code has access to all current stats, the story clock, and must return a number
4. The returned number becomes the new value of the stat (constrained by min/max)

### When Your Code Runs

| Your code… | Runs… |
| --- | --- |
| doesn't mention a clock variable | whenever a stat changes |
| mentions any clock variable | **every turn**, whether or not a stat changed |

Time passes on every turn, so code that reads the clock has to run on every turn — otherwise a time-based stat would only tick on the turns the AI happened to report a stat change. Code that doesn't read the clock keeps the original schedule.

## Writing Stat Code

### Basic Syntax

Your code should be valid JavaScript that returns a number. The code has access to a `stats` array containing all stats in the game.

```javascript
// Example: Return a fixed value
return 50;
```

### Accessing Other Stats

To access other stats, use the `stats` array and the `find` method to locate stats by name:

```javascript
// Example: Return the value of another stat
const health = stats.find(s => s.name === 'Health')?.value || 0;
return health;
```

The `?.` operator safely accesses the value property (returns undefined if the stat isn't found), and the `|| 0` provides a default value of 0 if the stat isn't found.

### Stat Properties

Each stat in the `stats` array exposes the following properties:

- `id`: Unique identifier
- `name`: Display name of the stat (this is what you match on)
- `type`: Type of stat (`'number'` or `'list'`)
- `description`: Text description
- `min`: Minimum value
- `max`: Maximum value
- `value`: Current value
- `regen`: Regeneration rate

> ℹ️ Only these fields are passed into the sandbox. A stat's own `code` and `descriptors` are **not** available from inside a snippet.

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

> ⚠️ **With the clock off, `deltaHours` is always `1`** and every turn advances the story by one hour. Your code works either way; it just gets a flat number instead of a measured one. The setting is **Measured Clock**, under Settings → Generation → Memory.

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
5. **Test your code**: Use the "Test Code" button to validate your code before saving
6. **Add comments**: Document your code for future reference

## Limitations

- Code execution has a timeout of 1 second to prevent infinite loops
- The code cannot access external resources (network, files, etc.)
- Circular dependencies between stats may cause unexpected behavior
- The code runs in a sandboxed environment with limited JavaScript features
- **Test Code** runs your snippet as a one-hour turn on day one, so it can't preview a long turn or a different daypart

### A Note on Accumulating Stats

Most stat code is a **formula**: it reads other stats and returns an answer, and running it twice gives the same result. Code that adds to its own current value (`return current + …`) is different — it's a **running total**, and it depends on running exactly once per turn.

Formamorph runs it once per turn. But re-rolling a turn's stat changes re-runs it too, deliberately: the re-roll rebuilds the turn from the values it started with, so the total lands where it should instead of being counted twice. Just be aware that a running total is more fragile than a formula, and prefer a formula where one will do.

## Troubleshooting

If your code doesn't work as expected:

1. Check for typos in stat names (they are case-sensitive)
2. Ensure your code returns a number
3. Verify that all stats you're referencing actually exist
4. Use the "Test Code" button to see any error messages
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
