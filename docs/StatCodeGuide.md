# Dynamic Stat Calculation Guide

This guide explains how to use the dynamic stat calculation feature to create complex relationships between stats in your game world.

## Overview

The dynamic stat calculation feature allows you to write JavaScript code that automatically calculates a stat's value based on other stats. This enables you to create:

- **Derived stats** that depend on other stats (e.g., carrying capacity based on strength)
- **Compound stats** that combine multiple stats (e.g., defense calculated from armor + agility)
- **Threshold effects** that change based on conditions (e.g., speed penalties when health is below 30%)
- **Complex formulas** for game mechanics (e.g., damage calculations, regeneration rates)

## How It Works

1. Each stat can have an optional JavaScript code snippet
2. When stats are updated during gameplay, the code is executed in a safe environment
3. The code has access to all current stats and must return a number
4. The returned number becomes the new value of the stat (constrained by min/max)

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

Each stat in the `stats` array has the following properties:

- `id`: Unique identifier
- `name`: Display name of the stat
- `type`: Type of stat ('number' or 'list')
- `description`: Text description
- `min`: Minimum value
- `max`: Maximum value
- `value`: Current value
- `regen`: Regeneration rate
- `code`: The code string (you don't typically need to access this)
- `descriptors`: Array of threshold-based descriptions

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
